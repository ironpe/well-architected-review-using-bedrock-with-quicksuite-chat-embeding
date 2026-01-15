/**
 * Review Execution Router
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  executeReviewHandler,
  getReviewStatusHandler,
  getReviewResultsHandler,
  downloadReportHandler,
  getReviewExecutionsHandler,
} from './review-execution.js';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Review Execution Router:', event.httpMethod, event.path);
  console.log('Path parameters:', JSON.stringify(event.pathParameters));

  const method = event.httpMethod;
  const path = event.path;

  try {
    // POST /reviews/execute
    if (method === 'POST' && path.endsWith('/execute')) {
      console.log('Routing to executeReviewHandler');
      return await executeReviewHandler(event);
    }

    // GET /reviews/request/{reviewRequestId}/executions
    if (method === 'GET' && path.includes('/request/') && path.endsWith('/executions')) {
      console.log('Routing to getReviewExecutionsHandler');
      return await getReviewExecutionsHandler(event);
    }

    // GET /reviews/{executionId} - status (changed from /status)
    if (method === 'GET' && path.match(/^\/reviews\/[^/]+$/) && event.pathParameters?.executionId) {
      console.log('Routing to getReviewStatusHandler');
      return await getReviewStatusHandler(event);
    }

    // GET /reviews/{executionId}/results
    if (method === 'GET' && path.includes('/results')) {
      console.log('Routing to getReviewResultsHandler');
      return await getReviewResultsHandler(event);
    }

    // POST /reviews/{executionId}/download
    if (method === 'POST' && path.includes('/download')) {
      console.log('Routing to downloadReportHandler');
      return await downloadReportHandler(event);
    }

    console.log('No route matched, returning 404');
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
