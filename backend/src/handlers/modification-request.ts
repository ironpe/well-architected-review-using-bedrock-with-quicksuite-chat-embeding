/**
 * Modification Request Handler
 * Requirements: 6.1, 6.2, 7.3
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ReviewService } from '../services/ReviewService.js';
import { NotificationService } from '../services/NotificationService.js';
import { DocumentService } from '../services/DocumentService.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { authorizationService } from '../middleware/authorization.js';
import {
  ModificationRequestRequest,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from '../types/index.js';

const reviewService = new ReviewService();
const notificationService = new NotificationService();
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
 * POST /review-requests/{reviewRequestId}/modification-request
 * Request modifications to architecture
 * Requirements: 6.1, 6.2, 7.3
 */
export async function requestModificationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);
    authorizationService.requirePermission(authContext.userGroup, 'request:modification');

    const reviewRequestId = event.pathParameters?.reviewRequestId;
    if (!reviewRequestId) {
      throw new ValidationError('reviewRequestId is required');
    }

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const request: ModificationRequestRequest = JSON.parse(event.body);

    // Get review request
    const reviewRequest = await reviewService.getReviewRequest(reviewRequestId);

    // Get document for title
    const document = await documentService.getDocument(
      reviewRequest.documentId,
      reviewRequest.currentVersion
    );

    // Update status to "Modification Required"
    await reviewService.updateStatus(reviewRequestId, 'Modification Required', request.modificationDetails);

    // Send notification email
    await notificationService.sendModificationRequestEmail(
      reviewRequest.submitterEmail,
      reviewRequestId,
      request.modificationDetails,
      document.title
    );

    return createResponse(200, {
      message: 'Modification request sent successfully',
      reviewRequestId,
    });
  } catch (error) {
    return handleError(error);
  }
}
