/**
 * QuickSight Router
 * Routes QuickSight-related requests
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getEmbedUrlHandler } from './quicksight-embed.js';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('QuickSight Router:', event.httpMethod, event.path);

  const method = event.httpMethod;
  const path = event.path;

  try {
    // GET /quicksight/embed-url
    if (method === 'GET' && path.endsWith('/embed-url')) {
      return await getEmbedUrlHandler(event);
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
