/**
 * Review Request API Handlers
 * Requirements: 1.2, 1.4, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ReviewService } from '../services/ReviewService.js';
import { DocumentService } from '../services/DocumentService.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { authorizationService } from '../middleware/authorization.js';
import {
  CreateReviewRequestRequest,
  UpdateReviewRequestStatusRequest,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ReviewRequest,
} from '../types/index.js';

const reviewService = new ReviewService();
const documentService = new DocumentService();
const authMiddleware = new AuthMiddleware();

/**
 * Helper function to create API response
 */
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

/**
 * Helper function to handle errors
 */
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
 * POST /review-requests
 * Create a new review request
 * Requirements: 1.2, 1.4, 7.2
 */
export async function createReviewRequestHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Authenticate user
    const authContext = await authMiddleware.authenticate(event);

    // Authorize - only A_Group can create review requests
    authorizationService.requirePermission(authContext.userGroup, 'create:review-request');

    // Parse request body
    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const request: CreateReviewRequestRequest = JSON.parse(event.body);

    // Verify document exists and get document info
    const document = await documentService.getDocument(request.documentId);

    // Create review request with document title
    const reviewRequestId = await reviewService.createReviewRequest({
      documentId: request.documentId,
      submitterEmail: authContext.email,
      submitterUserId: authContext.userId,
      reviewerEmail: request.reviewerEmail,
      documentTitle: document.title, // Include document title
    });

    // TODO: Send notification email (will be implemented in Task 7)

    return createResponse(201, {
      reviewRequestId,
      message: 'Review request created successfully',
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /review-requests/{reviewRequestId}
 * Get review request details
 * Requirements: 7.1, 8.2
 */
export async function getReviewRequestHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Authenticate user
    const authContext = await authMiddleware.authenticate(event);

    // Authorize - both groups can view
    authorizationService.requirePermission(authContext.userGroup, 'view:review-request');

    // Get reviewRequestId from path
    const reviewRequestId = event.pathParameters?.reviewRequestId;
    if (!reviewRequestId) {
      throw new ValidationError('reviewRequestId is required');
    }

    // Get review request
    const reviewRequest = await reviewService.getReviewRequest(reviewRequestId);

    // Get versions
    const versions = await documentService.getVersions(reviewRequest.reviewRequestId);

    return createResponse(200, {
      reviewRequest,
      versions,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /review-requests/{reviewRequestId}/status
 * Update review request status
 * Requirements: 7.2, 7.3, 7.4, 7.5
 */
export async function updateReviewRequestStatusHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Authenticate user
    const authContext = await authMiddleware.authenticate(event);

    // Get reviewRequestId from path
    const reviewRequestId = event.pathParameters?.reviewRequestId;
    if (!reviewRequestId) {
      throw new ValidationError('reviewRequestId is required');
    }

    // Parse request body
    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const request: UpdateReviewRequestStatusRequest = JSON.parse(event.body);

    // Get current review request to check permissions (validates it exists)
    await reviewService.getReviewRequest(reviewRequestId);

    // Authorization logic based on status transition
    if (request.status === 'Modification Required') {
      // Only B_Group can request modifications
      authorizationService.requirePermission(authContext.userGroup, 'request:modification');
    } else if (request.status === 'Review Completed') {
      // Only B_Group can mark as completed
      authorizationService.requireBGroup(authContext.userGroup);
    } else if (request.status === 'Rejected') {
      // Only B_Group can reject
      authorizationService.requireBGroup(authContext.userGroup);
    } else if (request.status === 'In Review') {
      // Both groups can set back to In Review (after modification)
      authorizationService.requirePermission(authContext.userGroup, 'view:review-request');
    }

    // Update status
    await reviewService.updateStatus(reviewRequestId, request.status, request.comment);

    return createResponse(200, {
      message: 'Status updated successfully',
      reviewRequestId,
      newStatus: request.status,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /review-requests
 * List review requests for current user
 * Requirements: 7.1
 */
export async function listReviewRequestsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Authenticate user
    const authContext = await authMiddleware.authenticate(event);

    // Authorize
    authorizationService.requirePermission(authContext.userGroup, 'view:review-request');

    let reviewRequests: ReviewRequest[];

    // Get requests based on user group
    if (authContext.userGroup === 'A_Group') {
      // A_Group sees their submitted requests
      reviewRequests = await reviewService.getReviewRequestsBySubmitter(authContext.userId);
    } else if (authContext.userGroup === 'B_Group') {
      // B_Group sees requests assigned to them
      reviewRequests = await reviewService.getReviewRequestsByReviewer(authContext.userId);
    } else {
      reviewRequests = [];
    }

    // Enrich with document titles
    const enrichedRequests = await Promise.all(
      reviewRequests.map(async (request) => {
        try {
          // Get document info to include title
          const document = await documentService.getDocument(request.documentId);
          return {
            ...request,
            documentTitle: document.title,
          };
        } catch (error) {
          // If document not found, use documentId as fallback
          console.warn(`Document ${request.documentId} not found:`, error);
          return {
            ...request,
            documentTitle: request.documentTitle || request.documentId,
          };
        }
      })
    );

    return createResponse(200, {
      reviewRequests: enrichedRequests,
      count: enrichedRequests.length,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /review-requests/{reviewRequestId}
 * Delete review request
 */
export async function deleteReviewRequestHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);
    
    const reviewRequestId = event.pathParameters?.reviewRequestId;
    if (!reviewRequestId) {
      throw new ValidationError('reviewRequestId is required');
    }

    // Get review request to check ownership
    const reviewRequest = await reviewService.getReviewRequest(reviewRequestId);
    
    // Only submitter or B_Group can delete
    if (authContext.userGroup === 'A_Group' && reviewRequest.submitterUserId !== authContext.userId) {
      throw new UnauthorizedError('You can only delete your own review requests');
    }
    
    if (authContext.userGroup !== 'A_Group' && authContext.userGroup !== 'B_Group') {
      throw new UnauthorizedError('Insufficient permissions to delete review requests');
    }

    await reviewService.deleteReviewRequest(reviewRequestId);

    return createResponse(200, {
      message: 'Review request deleted successfully',
      reviewRequestId,
    });
  } catch (error) {
    return handleError(error);
  }
}
