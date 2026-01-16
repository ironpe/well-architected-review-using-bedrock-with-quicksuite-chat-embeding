import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mcpTools, McpToolName } from './tools';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// 환경 변수
const REVIEW_REQUESTS_TABLE = process.env.REVIEW_REQUESTS_TABLE!;
const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE!;
const REVIEW_EXECUTIONS_TABLE = process.env.REVIEW_EXECUTIONS_TABLE!;
const PILLAR_CONFIGURATIONS_TABLE = process.env.PILLAR_CONFIGURATIONS_TABLE!;
const GOVERNANCE_POLICIES_TABLE = process.env.GOVERNANCE_POLICIES_TABLE!;
const REPORTS_BUCKET = process.env.REPORTS_BUCKET!;

export async function handler(event: any, context?: any): Promise<any> {
  console.log('MCP Lambda invoked:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));

  try {
    // AgentCore Gateway Lambda Target 호출 (context에서 toolName 추출)
    if (context?.clientContext?.custom?.bedrockAgentCoreToolName) {
      const fullToolName = context.clientContext.custom.bedrockAgentCoreToolName;
      // "arch-review-waf-tools___list_documents" → "list_documents"
      const toolName = fullToolName.includes('___') 
        ? fullToolName.split('___')[1] 
        : fullToolName;
      
      const result = await executeTool(toolName as McpToolName, event || {});
      
      // AgentCore Gateway 응답 형식
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }

    // MCP Protocol 처리
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || event;
    const { method, params, id } = body;

    // health check
    if (method === 'health') {
      return formatResponse({
        status: 'healthy',
        service: 'architecture-review-mcp',
        timestamp: new Date().toISOString(),
      });
    }

    // tools/list 요청
    if (method === 'tools/list') {
      return formatResponse({
        jsonrpc: '2.0',
        result: { tools: mcpTools },
        id,
      });
    }

    // tools/call 요청
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      const result = await executeTool(name as McpToolName, args || {});
      
      return formatResponse({
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
        id,
      });
    }

    // 직접 호출 (AgentCore Lambda Target)
    if (event.toolName || event.name) {
      const toolName = event.toolName || event.name;
      const args = event.arguments || event.input || event;
      const result = await executeTool(toolName as McpToolName, args);
      
      // AgentCore Gateway 응답 형식
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }

    return formatResponse({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found' },
      id,
    });
  } catch (error) {
    console.error('Error:', error);
    return formatResponse({
      jsonrpc: '2.0',
      error: { code: -32603, message: error instanceof Error ? error.message : 'Internal error' },
      id: null,
    });
  }
}

function formatResponse(body: any): any {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

async function executeTool(name: McpToolName, args: Record<string, any>): Promise<any> {
  switch (name) {
    case 'list_review_requests':
      return listReviewRequests(args.limit, args.status);
    case 'get_review_request':
      return getReviewRequest(args.reviewRequestId);
    case 'list_documents':
      return listDocuments(args.limit, args.reviewRequestId);
    case 'get_document':
      return getDocument(args.documentId, args.versionNumber);
    case 'list_review_executions':
      return listReviewExecutions(args.limit, args.reviewRequestId);
    case 'get_review_execution':
      return getReviewExecution(args.executionId);
    case 'list_pillar_configs':
      return listPillarConfigs();
    case 'list_governance_policies':
      return listGovernancePolicies(args.limit);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ========================================
// Tool Implementations
// ========================================

async function listReviewRequests(limit = 20, status?: string): Promise<any> {
  const params: any = {
    TableName: REVIEW_REQUESTS_TABLE,
    Limit: limit,
  };

  if (status) {
    params.FilterExpression = '#status = :status';
    params.ExpressionAttributeNames = { '#status': 'status' };
    params.ExpressionAttributeValues = { ':status': status };
  }

  const result = await docClient.send(new ScanCommand(params));
  
  return {
    reviewRequests: result.Items?.map(formatReviewRequest) || [],
    count: result.Count || 0,
  };
}

async function getReviewRequest(reviewRequestId: string): Promise<any> {
  if (!reviewRequestId) {
    return { error: 'reviewRequestId is required' };
  }

  const result = await docClient.send(new GetCommand({
    TableName: REVIEW_REQUESTS_TABLE,
    Key: { PK: `REQ#${reviewRequestId}`, SK: 'METADATA' },
  }));

  if (!result.Item) {
    return { error: 'Review request not found' };
  }

  return formatReviewRequest(result.Item);
}

async function listDocuments(limit = 20, reviewRequestId?: string): Promise<any> {
  let params: any = {
    TableName: DOCUMENTS_TABLE,
    Limit: limit,
  };

  if (reviewRequestId) {
    params = {
      TableName: DOCUMENTS_TABLE,
      IndexName: 'ReviewRequestIndex',
      KeyConditionExpression: 'reviewRequestId = :rid',
      ExpressionAttributeValues: { ':rid': reviewRequestId },
      Limit: limit,
    };
    const result = await docClient.send(new QueryCommand(params));
    return {
      documents: result.Items?.map(formatDocument) || [],
      count: result.Count || 0,
    };
  }

  const result = await docClient.send(new ScanCommand(params));
  return {
    documents: result.Items?.map(formatDocument) || [],
    count: result.Count || 0,
  };
}

async function getDocument(documentId: string, versionNumber = 1): Promise<any> {
  if (!documentId) {
    return { error: 'documentId is required' };
  }

  const result = await docClient.send(new GetCommand({
    TableName: DOCUMENTS_TABLE,
    Key: { PK: `DOC#${documentId}`, SK: `VERSION#${versionNumber}` },
  }));

  if (!result.Item) {
    return { error: 'Document not found' };
  }

  return formatDocument(result.Item);
}

async function listReviewExecutions(limit = 20, reviewRequestId?: string): Promise<any> {
  const params: any = {
    TableName: REVIEW_EXECUTIONS_TABLE,
    Limit: limit,
  };

  if (reviewRequestId) {
    params.FilterExpression = 'reviewRequestId = :rid';
    params.ExpressionAttributeValues = { ':rid': reviewRequestId };
  }

  const result = await docClient.send(new ScanCommand(params));
  
  return {
    executions: result.Items?.map(formatReviewExecution) || [],
    count: result.Count || 0,
  };
}

async function getReviewExecution(executionId: string): Promise<any> {
  if (!executionId) {
    return { error: 'executionId is required' };
  }

  const result = await docClient.send(new GetCommand({
    TableName: REVIEW_EXECUTIONS_TABLE,
    Key: { PK: `EXEC#${executionId}`, SK: 'METADATA' },
  }));

  if (!result.Item) {
    return { error: 'Review execution not found' };
  }

  const execution = formatReviewExecution(result.Item);

  // 리포트 S3 URL 생성 (있는 경우)
  if (result.Item.reportS3Key && REPORTS_BUCKET) {
    try {
      const command = new GetObjectCommand({
        Bucket: REPORTS_BUCKET,
        Key: result.Item.reportS3Key,
      });
      execution.reportDownloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (e) {
      console.warn('Failed to generate report URL:', e);
    }
  }

  return execution;
}

async function listPillarConfigs(): Promise<any> {
  const result = await docClient.send(new ScanCommand({
    TableName: PILLAR_CONFIGURATIONS_TABLE,
    FilterExpression: 'isActive = :active',
    ExpressionAttributeValues: { ':active': true },
  }));

  return {
    pillars: result.Items?.map(formatPillarConfig) || [],
    count: result.Count || 0,
  };
}

async function listGovernancePolicies(limit = 20): Promise<any> {
  const result = await docClient.send(new ScanCommand({
    TableName: GOVERNANCE_POLICIES_TABLE,
    FilterExpression: 'isActive = :active',
    ExpressionAttributeValues: { ':active': true },
    Limit: limit,
  }));

  return {
    policies: result.Items?.map(formatGovernancePolicy) || [],
    count: result.Count || 0,
  };
}

// ========================================
// Formatters
// ========================================

function formatReviewRequest(item: any): any {
  return {
    reviewRequestId: item.reviewRequestId,
    documentId: item.documentId,
    documentTitle: item.documentTitle,
    submitterEmail: item.submitterEmail,
    reviewerEmail: item.reviewerEmail,
    status: item.status,
    currentVersion: item.currentVersion,
    executionId: item.executionId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    rejectionReason: item.rejectionReason,
  };
}

function formatDocument(item: any): any {
  return {
    documentId: item.documentId,
    reviewRequestId: item.reviewRequestId,
    versionNumber: item.versionNumber,
    title: item.title,
    description: item.description,
    format: item.format,
    uploadedBy: item.uploadedBy,
    uploadedAt: item.uploadedAt,
    fileSize: item.fileSize,
  };
}

function formatReviewExecution(item: any): any {
  return {
    executionId: item.executionId,
    reviewRequestId: item.reviewRequestId,
    documentId: item.documentId,
    versionNumber: item.versionNumber,
    status: item.status,
    selectedPillars: item.selectedPillars,
    startedAt: item.startedAt,
    completedAt: item.completedAt,
    pillarResults: item.pillarResults,
    visionSummary: item.visionSummary,
    executiveSummary: item.executiveSummary,
  };
}

function formatPillarConfig(item: any): any {
  return {
    pillarName: item.pillarName,
    enabled: item.enabled,
    isActive: item.isActive,
    createdAt: item.createdAt,
  };
}

function formatGovernancePolicy(item: any): any {
  return {
    policyId: item.policyId,
    title: item.title,
    description: item.description,
    fileName: item.fileName,
    isActive: item.isActive,
    uploadedBy: item.uploadedBy,
    uploadedAt: item.uploadedAt,
  };
}
