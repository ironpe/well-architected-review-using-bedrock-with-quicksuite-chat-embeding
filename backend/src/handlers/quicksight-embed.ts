/**
 * QuickSight Embed URL Handler
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QuickSightService } from '../services/QuickSightService.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { ValidationError } from '../types/index.js';

const quicksightService = new QuickSightService();
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

  return createResponse(500, { 
    error: 'Internal server error',
    message: error instanceof Error ? error.message : 'Unknown error'
  });
}

/**
 * GET /quicksight/embed-url
 * Generate QuickSight Chat embed URL
 */
export async function getEmbedUrlHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);

    // Check if QuickSight is configured
    if (!quicksightService.isConfigured()) {
      return createResponse(503, {
        error: 'QuickSight not configured',
        message: 'QUICKSIGHT_ACCOUNT_ID and QUICKSIGHT_AGENT_ID environment variables are required',
      });
    }

    const { embedUrl, agentId } = await quicksightService.generateChatEmbedUrl(
      authContext.userId,
      authContext.email
    );

    return createResponse(200, {
      embedUrl,
      agentId,
    });
  } catch (error) {
    return handleError(error);
  }
}
