/**
 * Pillar Configuration API Handlers
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PillarConfigurationService } from '../services/PillarConfigurationService.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { authorizationService } from '../middleware/authorization.js';
import {
  UpdatePillarRequest,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  PillarName,
} from '../types/index.js';

const pillarConfigService = new PillarConfigurationService();
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
 * GET /agents/pillars
 * Get all pillar configurations
 * Requirements: 3.1
 */
export async function getPillarsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);
    authorizationService.requireBGroup(authContext.userGroup);

    const pillars = await pillarConfigService.getAllPillars();

    return createResponse(200, { pillars });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /agents/pillars/{pillarName}
 * Update pillar configuration
 * Requirements: 3.3
 */
export async function updatePillarHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);
    authorizationService.requirePermission(authContext.userGroup, 'configure:agent');

    const pillarName = event.pathParameters?.pillarName as PillarName;
    if (!pillarName) {
      throw new ValidationError('pillarName is required');
    }

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const request: UpdatePillarRequest = JSON.parse(event.body);

    await pillarConfigService.updatePillarConfig(
      pillarName,
      request.systemPrompt,
      request.enabled,
      authContext.userId
    );

    return createResponse(200, {
      updated: true,
      pillarName,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /agents/pillars/{pillarName}/history
 * Get prompt history for a pillar
 * Requirements: 3.5
 */
export async function getPillarHistoryHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);
    authorizationService.requireBGroup(authContext.userGroup);

    const pillarName = event.pathParameters?.pillarName as PillarName;
    if (!pillarName) {
      throw new ValidationError('pillarName is required');
    }

    const promptHistory = await pillarConfigService.getPillarHistory(pillarName);

    return createResponse(200, { promptHistory });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /agents/nova-vision
 * Get Nova Vision configuration
 */
export async function getNovaVisionHandler(
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const config = await pillarConfigService.getNovaVisionConfig();
    return createResponse(200, config);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /agents/nova-vision
 * Update Nova Vision configuration
 */
export async function updateNovaVisionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);
    authorizationService.requirePermission(authContext.userGroup, 'configure:agent');

    const request = JSON.parse(event.body || '{}');
    
    if (!request.systemPrompt) {
      throw new ValidationError('systemPrompt is required');
    }

    if (!request.modelId) {
      throw new ValidationError('modelId is required');
    }

    await pillarConfigService.updateNovaVisionConfig(
      request.modelId,
      request.maxTokens || 8192,
      request.temperature !== undefined ? request.temperature : 0.3,
      request.systemPrompt,
      request.enabled !== false,
      authContext.email
    );

    return createResponse(200, {
      updated: true,
      message: 'Nova Vision configuration updated',
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /agents/review-model
 * Get Pillar Review Model configuration
 */
export async function getPillarReviewModelHandler(
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const config = await pillarConfigService.getPillarReviewModelConfig();
    return createResponse(200, config);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /agents/review-model
 * Update Pillar Review Model configuration
 */
export async function updatePillarReviewModelHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authContext = await authMiddleware.authenticate(event);
    authorizationService.requirePermission(authContext.userGroup, 'configure:agent');

    const request = JSON.parse(event.body || '{}');

    if (!request.modelId) {
      throw new ValidationError('modelId is required');
    }

    await pillarConfigService.updatePillarReviewModelConfig(
      request.modelId,
      authContext.email
    );

    return createResponse(200, {
      updated: true,
      message: 'Pillar review model configuration updated',
    });
  } catch (error) {
    return handleError(error);
  }
}
