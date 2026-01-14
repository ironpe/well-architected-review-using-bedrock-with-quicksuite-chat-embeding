/**
 * IaC Generation Handler
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { IaCGenerationService } from '../services/IaCGenerationService.js';
import { ReviewService } from '../services/ReviewService.js';
import { DocumentService } from '../services/DocumentService.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { authorizationService } from '../middleware/authorization.js';
import {
  GenerateIaCRequest,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from '../types/index.js';

const iacService = new IaCGenerationService();
const reviewService = new ReviewService();
const documentService = new DocumentService();
const authMiddleware = new AuthMiddleware();

function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
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
 * POST /iac/generate
 * Generate IaC template
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
export async function generateIaCHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);
    authorizationService.requirePermission(authContext.userGroup, 'generate:iac');

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const request: GenerateIaCRequest = JSON.parse(event.body);

    // Get review request
    const reviewRequest = await reviewService.getReviewRequest(request.reviewRequestId);

    // Verify status is "Review Completed"
    if (reviewRequest.status !== 'Review Completed') {
      throw new ValidationError(
        'IaC generation is only allowed for completed reviews. Current status: ' + reviewRequest.status
      );
    }

    // Get document
    const document = await documentService.getDocument(
      reviewRequest.documentId,
      reviewRequest.currentVersion
    );

    // Get latest review execution (simplified - should query by reviewRequestId)
    // For now, we'll create a mock review report
    const mockReviewReport = {
      executionId: 'exec-mock',
      reviewRequestId: request.reviewRequestId,
      documentId: document.documentId,
      versionNumber: document.versionNumber,
      pillarResults: {},
      overallSummary: 'Review completed successfully',
      generatedAt: new Date().toISOString(),
    };

    // Generate template
    let template: string;
    if (request.format === 'cloudformation') {
      template = await iacService.generateCloudFormation(document, mockReviewReport);
    } else {
      template = await iacService.generateTerraform(document, mockReviewReport);
    }

    // Save to S3 and get download URL
    const templateUrl = await iacService.saveTemplateAndGetUrl(
      request.reviewRequestId,
      request.format,
      template
    );

    return createResponse(200, {
      templateUrl,
      format: request.format,
      message: 'IaC template generated successfully',
    });
  } catch (error) {
    return handleError(error);
  }
}
