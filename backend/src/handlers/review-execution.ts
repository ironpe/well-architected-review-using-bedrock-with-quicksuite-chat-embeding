/**
 * Review Execution API Handlers
 * Requirements: 4.1, 4.2, 4.5, 5.1, 5.2
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ReviewExecutionService } from '../services/ReviewExecutionService.js';
import { ReviewService } from '../services/ReviewService.js';
import { ReportGenerationService } from '../services/ReportGenerationService.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { authorizationService } from '../middleware/authorization.js';
import {
  ExecuteReviewRequest,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  PillarResult,
  DownloadReportRequest,
} from '../types/index.js';

const reviewExecutionService = new ReviewExecutionService();
const reviewService = new ReviewService();
const authMiddleware = new AuthMiddleware();

function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(body),
  };
}

function handleError(error: unknown): APIGatewayProxyResult {
  console.error('Handler error:', error);

  if (error instanceof ValidationError) {
    return createResponse(400, { error: error.message });
  }
  if (error instanceof NotFoundError) {
    return createResponse(404, { error: error.message });
  }
  if (error instanceof UnauthorizedError) {
    return createResponse(403, { error: error.message });
  }

  return createResponse(500, { error: 'Internal server error' });
}

/**
 * POST /reviews/execute
 * Execute architecture review
 * Requirements: 4.1, 4.2
 */
export async function executeReviewHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.log('Execute Review Request:', JSON.stringify(event.body, null, 2));
    
    const authContext = await authMiddleware.authenticate(event);
    authorizationService.requirePermission(authContext.userGroup, 'execute:review');

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const request: ExecuteReviewRequest = JSON.parse(event.body);
    
    console.log('Selected Pillars:', request.pillarSelection);
    console.log('Total Pillars:', request.pillarSelection.length);

    // Verify review request exists
    const reviewRequest = await reviewService.getReviewRequest(request.reviewRequestId);

    // Execute review
    const executionId = await reviewExecutionService.executeReview({
      reviewRequestId: request.reviewRequestId,
      documentId: reviewRequest.documentId,
      versionNumber: reviewRequest.currentVersion,
      selectedPillars: request.pillarSelection,
      governancePolicyIds: request.governancePolicies,
      architecturePages: request.architecturePages,
      instructions: request.instructions,
    });

    console.log('Review execution started:', executionId);

    return createResponse(202, {
      executionId,
      message: 'Review execution started',
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /reviews/{executionId}/status
 * Get review execution status
 * Requirements: 4.5
 */
export async function getReviewStatusHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);
    authorizationService.requirePermission(authContext.userGroup, 'view:review-results');

    const executionId = event.pathParameters?.executionId;
    if (!executionId) {
      throw new ValidationError('executionId is required');
    }

    const execution = await reviewExecutionService.getExecutionStatus(executionId);

    return createResponse(200, {
      status: execution.status,
      pillarResults: execution.pillarResults || {},
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /reviews/{executionId}/results
 * Get completed review results
 * Requirements: 5.1, 5.2
 */
export async function getReviewResultsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);
    authorizationService.requirePermission(authContext.userGroup, 'view:review-results');

    const executionId = event.pathParameters?.executionId;
    if (!executionId) {
      throw new ValidationError('executionId is required');
    }

    const execution = await reviewExecutionService.getExecutionStatus(executionId);

    if (execution.status !== 'Completed') {
      throw new ValidationError('Review execution is not yet completed');
    }

    // Construct review report
    const reviewReport = {
      executionId: execution.executionId,
      reviewRequestId: execution.reviewRequestId,
      documentId: execution.documentId,
      versionNumber: execution.versionNumber,
      pillarResults: execution.pillarResults || {},
      overallSummary: execution.visionSummary || generateOverallSummary(execution.pillarResults || {}),
      executiveSummary: execution.executiveSummary || '', // Executive summary for summary tab
      generatedAt: execution.completedAt || new Date().toISOString(),
    };

    return createResponse(200, { reviewReport });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Generate overall summary from pillar results
 */
function generateOverallSummary(pillarResults: Record<string, PillarResult>): string {
  const completedPillars = Object.values(pillarResults).filter(
    r => r.status === 'Completed'
  );
  const failedPillars = Object.values(pillarResults).filter(
    r => r.status === 'Failed'
  );

  let summary = `## 아키텍처 검토 종합 요약\n\n`;

  // 검토 완료 상태
  summary += `### 검토 현황\n`;
  summary += `- 완료된 원칙: ${completedPillars.length}개\n`;
  if (failedPillars.length > 0) {
    summary += `- 실패한 원칙: ${failedPillars.length}개\n`;
  }
  summary += `\n`;

  // 전체 권장사항 수
  const totalRecommendations = completedPillars.reduce(
    (sum, r) => sum + (r.recommendations?.length || 0),
    0
  );
  summary += `### 권장사항 통계\n`;
  summary += `- 총 권장사항: ${totalRecommendations}개\n`;
  summary += `\n`;

  // 원칙별 요약
  summary += `### 원칙별 주요 발견사항\n\n`;
  
  const pillarNames: Record<string, string> = {
    'Operational Excellence': '운영 우수성',
    'Security': '보안',
    'Reliability': '안정성',
    'Performance Efficiency': '성능 효율성',
    'Cost Optimization': '비용 최적화',
    'Sustainability': '지속 가능성',
  };

  completedPillars.forEach(pillar => {
    const koreanName = pillarNames[pillar.pillarName] || pillar.pillarName;
    summary += `**${koreanName}**\n`;
    
    // Extract first key point from findings
    const findings = pillar.findings || '';
    const lines = findings.split('\n').filter(l => l.trim().length > 20);
    const firstPoint = lines.slice(0, 2).join(' ').substring(0, 200);
    
    if (firstPoint) {
      summary += `${firstPoint}...\n`;
    }
    
    summary += `권장사항: ${pillar.recommendations?.length || 0}개\n\n`;
  });

  // 거버넌스 위반 요약
  const totalViolations = completedPillars.reduce(
    (sum, r) => sum + (r.governanceViolations?.length || 0),
    0
  );
  
  if (totalViolations > 0) {
    summary += `### 거버넌스 정책\n`;
    summary += `- 발견된 위반사항: ${totalViolations}개\n`;
    summary += `\n`;
  }

  summary += `### 다음 단계\n`;
  summary += `1. 각 원칙별 상세 검토 결과를 확인하세요\n`;
  summary += `2. 우선순위가 높은 권장사항부터 적용을 검토하세요\n`;
  summary += `3. 필요시 아키텍처 수정 후 재검토를 요청하세요\n`;

  return summary;
}


const reportService = new ReportGenerationService();

/**
 * POST /reviews/{executionId}/download
 * Download review report
 * Requirements: 5.3, 5.4
 */
export async function downloadReportHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);
    authorizationService.requirePermission(authContext.userGroup, 'view:review-results');

    const executionId = event.pathParameters?.executionId;
    if (!executionId) {
      throw new ValidationError('executionId is required');
    }

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const request: DownloadReportRequest = JSON.parse(event.body);

    const execution = await reviewExecutionService.getExecutionStatus(executionId);

    if (execution.status !== 'Completed') {
      throw new ValidationError('Review execution is not yet completed');
    }

    const reviewReport = {
      executionId: execution.executionId,
      reviewRequestId: execution.reviewRequestId,
      documentId: execution.documentId,
      versionNumber: execution.versionNumber,
      pillarResults: execution.pillarResults || {},
      overallSummary: execution.visionSummary || generateOverallSummary(execution.pillarResults || {}),
      executiveSummary: execution.executiveSummary || '',
      generatedAt: execution.completedAt || new Date().toISOString(),
    };

    let reportBuffer: Buffer;
    if (request.format === 'pdf') {
      reportBuffer = await reportService.generatePDF(reviewReport);
    } else {
      reportBuffer = await reportService.generateWord(reviewReport);
    }

    const downloadUrl = await reportService.saveAndGetDownloadUrl(
      executionId,
      request.format,
      reportBuffer
    );

    return createResponse(200, {
      downloadUrl,
      format: request.format,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Lambda handler - routes to appropriate function based on path
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  console.log(`Handler invoked: ${method} ${path}`);
  console.log('Path parameters:', JSON.stringify(event.pathParameters));

  // Route to appropriate handler
  if (path === '/reviews/execute' && method === 'POST') {
    console.log('Routing to executeReviewHandler');
    return executeReviewHandler(event);
  } else if (path.match(/^\/reviews\/[^/]+$/) && method === 'GET') {
    // GET /reviews/{executionId} -> status
    console.log('Routing to getReviewStatusHandler');
    return getReviewStatusHandler(event);
  } else if (path.match(/^\/reviews\/[^/]+\/results$/) && method === 'GET') {
    console.log('Routing to getReviewResultsHandler');
    return getReviewResultsHandler(event);
  } else if (path.match(/^\/reviews\/[^/]+\/download$/) && method === 'POST') {
    console.log('Routing to downloadReportHandler');
    return downloadReportHandler(event);
  }

  console.log('No route matched, returning 404');
  return createResponse(404, { error: 'Not found' });
}
