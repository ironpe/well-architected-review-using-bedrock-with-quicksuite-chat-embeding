/**
 * Pillar Config Router
 * Routes requests to appropriate handlers
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  getPillarsHandler,
  updatePillarHandler,
  getPillarHistoryHandler,
  getNovaVisionHandler,
  updateNovaVisionHandler,
} from './pillar-config.js';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Pillar Config Router:', event.httpMethod, event.path);

  const method = event.httpMethod;
  const path = event.path;

  try {
    // GET /agents/nova-vision
    if (method === 'GET' && path.endsWith('/nova-vision')) {
      return await getNovaVisionHandler(event);
    }

    // PUT /agents/nova-vision
    if (method === 'PUT' && path.endsWith('/nova-vision')) {
      return await updateNovaVisionHandler(event);
    }

    // GET /agents/pillars - Get all pillars
    if (method === 'GET' && path.endsWith('/pillars')) {
      return await getPillarsHandler(event);
    }

    // PUT /agents/pillars/{pillarName} - Update pillar
    if (method === 'PUT' && path.includes('/pillars/') && !path.includes('/history')) {
      // Decode pillarName from URL
      if (event.pathParameters?.pillarName) {
        event.pathParameters.pillarName = decodeURIComponent(event.pathParameters.pillarName);
      }
      return await updatePillarHandler(event);
    }

    // GET /agents/pillars/{pillarName}/history - Get history
    if (method === 'GET' && path.includes('/history')) {
      // Decode pillarName from URL
      if (event.pathParameters?.pillarName) {
        event.pathParameters.pillarName = decodeURIComponent(event.pathParameters.pillarName);
      }
      return await getPillarHistoryHandler(event);
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
