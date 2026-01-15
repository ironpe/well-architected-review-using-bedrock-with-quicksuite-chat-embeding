/**
 * Review Execution Service
 * Requirements: 4.1, 4.2, 4.5, 5.1, 5.2
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { environment } from '../config/environment.js';
import { AgentOrchestrationService } from './AgentOrchestrationService.js';
import { DocumentService } from './DocumentService.js';
import { PillarConfigurationService } from './PillarConfigurationService.js';
import {
  ReviewExecution,
  ReviewExecutionRecord,
  PillarName,
  PillarResult,
  PillarConfig,
  ExecutionStatus,
  NotFoundError,
} from '../types/index.js';
import { reviewExecutionRecordToDomain } from '../utils/type-converters.js';
import { validateRequiredString, validatePillarNames } from '../utils/validators.js';

export class ReviewExecutionService {
  private dynamoClient: DynamoDBDocumentClient;
  private reviewExecutionsTable: string;
  private agentOrchestration: AgentOrchestrationService;
  private documentService: DocumentService;
  private pillarConfigService: PillarConfigurationService;

  constructor() {
    const ddbClient = new DynamoDBClient({ region: environment.aws.region });
    this.dynamoClient = DynamoDBDocumentClient.from(ddbClient);
    this.reviewExecutionsTable = environment.dynamodb.reviewExecutionsTable;
    this.agentOrchestration = new AgentOrchestrationService();
    this.documentService = new DocumentService();
    this.pillarConfigService = new PillarConfigurationService();
  }

  /**
   * Create execution record (without executing)
   */
  async createExecution(params: {
    reviewRequestId: string;
    documentId: string;
    versionNumber: number;
    selectedPillars: PillarName[];
    governancePolicyIds: string[];
    architecturePages?: number[];
    instructions: Record<string, string>;
  }): Promise<string> {
    validateRequiredString(params.reviewRequestId, 'reviewRequestId');
    validateRequiredString(params.documentId, 'documentId');
    validatePillarNames(params.selectedPillars);

    const executionId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create execution record
    const executionRecord: ReviewExecutionRecord = {
      PK: `EXEC#${executionId}`,
      SK: 'METADATA',
      executionId,
      reviewRequestId: params.reviewRequestId,
      documentId: params.documentId,
      versionNumber: params.versionNumber,
      status: 'In Progress',
      selectedPillars: params.selectedPillars,
      governancePolicyIds: params.governancePolicyIds,
      architecturePages: params.architecturePages,
      startedAt: timestamp,
    };

    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.reviewExecutionsTable,
        Item: executionRecord,
      })
    );

    // Update ReviewRequest status to "In Review"
    try {
      await this.updateReviewRequestStatus(params.reviewRequestId, 'In Review', executionId);
      console.log(`Updated review request ${params.reviewRequestId} status to "In Review"`);
    } catch (error) {
      console.warn('Failed to update review request status:', error);
    }

    return executionId;
  }

  /**
   * Execute review synchronously (for worker Lambda)
   */
  async executeReviewSync(params: {
    executionId: string;
    reviewRequestId: string;
    documentId: string;
    versionNumber: number;
    selectedPillars: PillarName[];
    governancePolicyIds: string[];
    architecturePages?: number[];
    instructions: Record<string, string>;
  }): Promise<void> {
    try {
      console.log(`Starting review execution: ${params.executionId}`);
      console.log(`Selected pillars: ${params.selectedPillars.join(', ')}`);
      console.log(`Total pillars: ${params.selectedPillars.length}`);

      // Get document
      const document = await this.documentService.getDocument(
        params.documentId,
        params.versionNumber
      );

      console.log(`Document loaded: ${document.title}`);

      // Get pillar configurations
      const pillarConfigs: Record<string, PillarConfig> = {};
      for (const pillar of params.selectedPillars) {
        console.log(`Loading config for: ${pillar}`);
        try {
          const config = await this.pillarConfigService.getActivePillarConfig(pillar);
          pillarConfigs[pillar] = {
            ...config,
            additionalInstructions: params.instructions[pillar],
          };
        } catch (error) {
          console.warn(`No config found for ${pillar}, using default`);
          pillarConfigs[pillar] = {
            pillarName: pillar,
            systemPrompt: this.getDefaultPrompt(pillar),
            enabled: true,
            additionalInstructions: params.instructions[pillar],
          };
        }
      }

      console.log(`Loaded ${Object.keys(pillarConfigs).length} pillar configs`);

      // Execute all pillars
      console.log('Executing all pillars...');
      const { pillarResults, visionSummary, executiveSummary } = await this.agentOrchestration.executeAllPillars(
        document,
        pillarConfigs,
        params.governancePolicyIds,
        params.architecturePages
      );

      console.log(`Completed ${Object.keys(pillarResults).length} pillar reviews`);

      // Update execution with results, vision summary, and executive summary
      await this.updateExecutionResults(params.executionId, pillarResults, 'Completed', visionSummary, executiveSummary);
      
      // Update ReviewRequest status to "Review Completed"
      try {
        await this.updateReviewRequestStatus(params.reviewRequestId, 'Review Completed', params.executionId);
        console.log(`Updated review request ${params.reviewRequestId} status to "Review Completed"`);
      } catch (error) {
        console.warn('Failed to update review request status on completion:', error);
      }
      
      console.log(`Execution ${params.executionId} completed successfully`);
    } catch (error) {
      console.error('Review execution failed:', error);
      await this.updateExecutionStatus(params.executionId, 'Failed');
      throw error;
    }
  }

  /**
   * Execute review (async - returns immediately)
   * Requirements: 4.1, 4.2
   */
  async executeReview(params: {
    reviewRequestId: string;
    documentId: string;
    versionNumber: number;
    selectedPillars: PillarName[];
    governancePolicyIds: string[];
    architecturePages?: number[];
    instructions: Record<string, string>;
  }): Promise<string> {
    validateRequiredString(params.reviewRequestId, 'reviewRequestId');
    validateRequiredString(params.documentId, 'documentId');
    validatePillarNames(params.selectedPillars);

    const executionId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create execution record
    const executionRecord: ReviewExecutionRecord = {
      PK: `EXEC#${executionId}`,
      SK: 'METADATA',
      executionId,
      reviewRequestId: params.reviewRequestId,
      documentId: params.documentId,
      versionNumber: params.versionNumber,
      status: 'In Progress',
      selectedPillars: params.selectedPillars,
      governancePolicyIds: params.governancePolicyIds,
      architecturePages: params.architecturePages,
      startedAt: timestamp,
    };

    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.reviewExecutionsTable,
        Item: executionRecord,
      })
    );

    // Update ReviewRequest status to "In Review"
    try {
      await this.updateReviewRequestStatus(params.reviewRequestId, 'In Review', executionId);
      console.log(`Updated review request ${params.reviewRequestId} status to "In Review"`);
    } catch (error) {
      console.warn('Failed to update review request status:', error);
    }

    // Execute review synchronously (Lambda has 15min timeout)
    // We await the full execution to ensure Lambda keeps running
    try {
      await this.executeReviewAsync(executionId, params);
    } catch (error) {
      console.error(`Execution failed for ${executionId}:`, error);
      // Error is already handled in executeReviewAsync
    }

    // Return execution ID
    return executionId;
  }

  /**
   * Execute review asynchronously (background process)
   */
  private async executeReviewAsync(
    executionId: string,
    params: {
      reviewRequestId: string;
      documentId: string;
      versionNumber: number;
      selectedPillars: PillarName[];
      governancePolicyIds: string[];
      architecturePages?: number[];
      instructions: Record<string, string>;
    }
  ): Promise<void> {
    try {
      console.log(`Starting async review execution: ${executionId}`);
      console.log(`Selected pillars: ${params.selectedPillars.join(', ')}`);
      console.log(`Total pillars: ${params.selectedPillars.length}`);

      // Get document
      const document = await this.documentService.getDocument(
        params.documentId,
        params.versionNumber
      );

      console.log(`Document loaded: ${document.title}`);

      // Get pillar configurations
      const pillarConfigs: Record<string, PillarConfig> = {};
      for (const pillar of params.selectedPillars) {
        console.log(`Loading config for: ${pillar}`);
        try {
          const config = await this.pillarConfigService.getActivePillarConfig(pillar);
          pillarConfigs[pillar] = {
            ...config,
            additionalInstructions: params.instructions[pillar],
          };
        } catch (error) {
          console.warn(`No config found for ${pillar}, using default`);
          pillarConfigs[pillar] = {
            pillarName: pillar,
            systemPrompt: this.getDefaultPrompt(pillar),
            enabled: true,
            additionalInstructions: params.instructions[pillar],
          };
        }
      }

      console.log(`Loaded ${Object.keys(pillarConfigs).length} pillar configs`);

      // Execute all pillars
      console.log('Executing all pillars...');
      const { pillarResults, visionSummary, executiveSummary } = await this.agentOrchestration.executeAllPillars(
        document,
        pillarConfigs,
        params.governancePolicyIds,
        params.architecturePages
      );

      console.log(`Completed ${Object.keys(pillarResults).length} pillar reviews`);

      // Update execution with results, vision summary, and executive summary
      await this.updateExecutionResults(executionId, pillarResults, 'Completed', visionSummary, executiveSummary);
      
      // Update ReviewRequest status to "Review Completed"
      try {
        await this.updateReviewRequestStatus(params.reviewRequestId, 'Review Completed', executionId);
        console.log(`Updated review request ${params.reviewRequestId} status to "Review Completed"`);
      } catch (error) {
        console.warn('Failed to update review request status on completion:', error);
      }
      
      console.log(`Execution ${executionId} completed successfully`);
    } catch (error) {
      console.error('Async review execution failed:', error);
      await this.updateExecutionStatus(executionId, 'Failed');
    }
  }

  private getDefaultPrompt(pillarName: PillarName): string {
    // Fallback default prompts
    return `You are an expert in AWS Well-Architected Framework's ${pillarName} pillar. Review the architecture and provide recommendations.`;
  }

  /**
   * Get execution status
   * Requirements: 4.5
   */
  async getExecutionStatus(executionId: string): Promise<ReviewExecution> {
    validateRequiredString(executionId, 'executionId');

    const result = await this.dynamoClient.send(
      new GetCommand({
        TableName: this.reviewExecutionsTable,
        Key: {
          PK: `EXEC#${executionId}`,
          SK: 'METADATA',
        },
      })
    );

    if (!result.Item) {
      throw new NotFoundError(`Execution ${executionId} not found`);
    }

    return reviewExecutionRecordToDomain(result.Item as ReviewExecutionRecord);
  }

  /**
   * Get all executions for a review request
   */
  async getExecutionsByReviewRequest(reviewRequestId: string): Promise<ReviewExecution[]> {
    validateRequiredString(reviewRequestId, 'reviewRequestId');

    // Use Scan with filter (not optimal but works without GSI)
    const result = await this.dynamoClient.send(
      new ScanCommand({
        TableName: this.reviewExecutionsTable,
        FilterExpression: 'reviewRequestId = :reviewRequestId AND SK = :sk',
        ExpressionAttributeValues: {
          ':reviewRequestId': reviewRequestId,
          ':sk': 'METADATA',
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return [];
    }

    // Sort by startedAt descending (most recent first)
    const executions = result.Items.map(item => reviewExecutionRecordToDomain(item as ReviewExecutionRecord));
    return executions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  /**
   * Update execution status
   */
  private async updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    await this.dynamoClient.send(
      new UpdateCommand({
        TableName: this.reviewExecutionsTable,
        Key: {
          PK: `EXEC#${executionId}`,
          SK: 'METADATA',
        },
        UpdateExpression: 'SET #status = :status, completedAt = :completedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':completedAt': timestamp,
        },
      })
    );
  }

  /**
   * Update execution with results
   */
  private async updateExecutionResults(
    executionId: string,
    pillarResults: Record<string, PillarResult>,
    status: ExecutionStatus,
    visionSummary?: string,
    executiveSummary?: string
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    // Remove undefined values from pillarResults
    const cleanedResults: Record<string, any> = {};
    for (const [key, value] of Object.entries(pillarResults)) {
      cleanedResults[key] = this.removeUndefinedValues(value);
    }

    const updateParts = ['#status = :status', 'pillarResults = :results', 'completedAt = :completedAt'];
    const expressionValues: any = {
      ':status': status,
      ':results': cleanedResults,
      ':completedAt': timestamp,
    };

    if (visionSummary) {
      updateParts.push('visionSummary = :visionSummary');
      expressionValues[':visionSummary'] = visionSummary;
    }

    if (executiveSummary) {
      updateParts.push('executiveSummary = :executiveSummary');
      expressionValues[':executiveSummary'] = executiveSummary;
    }

    await this.dynamoClient.send(
      new UpdateCommand({
        TableName: this.reviewExecutionsTable,
        Key: {
          PK: `EXEC#${executionId}`,
          SK: 'METADATA',
        },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: expressionValues,
      })
    );
  }

  /**
   * Remove undefined values from object
   */
  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.filter(item => item !== undefined).map(item => this.removeUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  /**
   * Update ReviewRequest status when execution starts
   */
  private async updateReviewRequestStatus(
    reviewRequestId: string,
    status: string,
    executionId: string
  ): Promise<void> {
    const reviewRequestsTable = environment.dynamodb.reviewRequestsTable;
    const timestamp = new Date().toISOString();

    await this.dynamoClient.send(
      new UpdateCommand({
        TableName: reviewRequestsTable,
        Key: {
          PK: `REQ#${reviewRequestId}`,
          SK: 'METADATA',
        },
        UpdateExpression: 'SET #status = :status, executionId = :executionId, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':executionId': executionId,
          ':updatedAt': timestamp,
        },
      })
    );
  }
}
