/**
 * Review Request Router
 * Routes requests to appropriate handlers based on HTTP method and path
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createReviewRequestHandler,
  getReviewRequestHandler,
  listReviewRequestsHandler,
  updateReviewRequestStatusHandler,
  deleteReviewRequestHandler,
} from './review-request.js';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Review Request Router:', event.httpMethod, event.path);

  const method = event.httpMethod;
  const path = event.path;

  try {
    // POST /review-requests - Create review request
    if (method === 'POST' && path.endsWith('/review-requests')) {
      return await createReviewRequestHandler(event);
    }

    // GET /review-requests - List review requests
    if (method === 'GET' && path.endsWith('/review-requests')) {
      return await listReviewRequestsHandler(event);
    }

    // DELETE /review-requests/{id} - Delete review request
    if (method === 'DELETE' && path.match(/\/review-requests\/[^/]+$/) && !path.includes('/status')) {
      return await deleteReviewRequestHandler(event);
    }

    // GET /review-requests/{id} - Get review request
    if (method === 'GET' && path.includes('/review-requests/') && !path.includes('/status')) {
      return await getReviewRequestHandler(event);
    }

    // PATCH /review-requests/{id}/status - Update status
    if (method === 'PATCH' && path.includes('/status')) {
      return await updateReviewRequestStatusHandler(event);
    }

    // Not found
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    console.error('Router error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
