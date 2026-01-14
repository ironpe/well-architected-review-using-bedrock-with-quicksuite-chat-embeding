/**
 * Document Preview Handler
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DocumentService } from '../services/DocumentService.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { ValidationError, NotFoundError, UnauthorizedError } from '../types/index.js';

const documentService = new DocumentService();
const authMiddleware = new AuthMiddleware();

function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
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
 * GET /documents/{documentId}/preview
 * Get presigned URL for document preview
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await authMiddleware.authenticate(event);
    
    const documentId = event.pathParameters?.documentId;
    if (!documentId) {
      throw new ValidationError('documentId is required');
    }

    const previewUrl = await documentService.getDocumentPreviewUrl(documentId);

    return createResponse(200, { previewUrl });
  } catch (error) {
    return handleError(error);
  }
}
