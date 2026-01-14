/**
 * Governance Policy Handlers
 * Requirements: 2.1, 2.2
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GovernancePolicyService } from '../services/GovernancePolicyService.js';
import { ValidationError, NotFoundError, UnauthorizedError } from '../types/index.js';
import { AuthMiddleware } from '../middleware/auth.js';

const governancePolicyService = new GovernancePolicyService();
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
 * POST /governance/policies/upload
 * Upload governance policy document
 */
export async function uploadGovernancePolicyHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await authMiddleware.authenticate(event);
    
    // Parse JSON body
    const body = JSON.parse(event.body || '{}');
    
    if (!body.file || !body.title) {
      throw new ValidationError('file and title are required');
    }

    const fileBuffer = Buffer.from(body.file, 'base64');
    
    const policyId = await governancePolicyService.uploadPolicy(fileBuffer, {
      title: body.title,
      description: body.description || '',
      uploadedBy: user.email,
      fileName: body.fileName || 'policy.pdf',
    });

    return createResponse(201, { policyId });
  } catch (error) {
    console.error('Upload governance policy error:', error);
    return handleError(error);
  }
}

/**
 * GET /governance/policies
 * Get all governance policies
 */
export async function getGovernancePoliciesHandler(
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const policies = await governancePolicyService.getAllPolicies();
    
    return createResponse(200, {
      policies,
      count: policies.length,
    });
  } catch (error) {
    console.error('Get governance policies error:', error);
    return handleError(error);
  }
}

/**
 * DELETE /governance/policies/{policyId}
 * Delete governance policy
 */
export async function deleteGovernancePolicyHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const policyId = event.pathParameters?.policyId;
    
    if (!policyId) {
      throw new ValidationError('policyId is required');
    }

    await governancePolicyService.deletePolicy(policyId);
    
    return createResponse(200, { message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('Delete governance policy error:', error);
    return handleError(error);
  }
}

/**
 * Router for governance policy endpoints
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log('Governance Policy Router:', event.httpMethod, event.path);
  
  const path = event.path;
  const method = event.httpMethod;

  // POST /governance/policies/upload
  if (method === 'POST' && path.includes('/upload')) {
    return await uploadGovernancePolicyHandler(event);
  }

  // GET /governance/policies
  if (method === 'GET' && path === '/governance/policies') {
    return await getGovernancePoliciesHandler(event);
  }

  // DELETE /governance/policies/{policyId}
  if (method === 'DELETE' && path.match(/\/governance\/policies\/[^/]+$/)) {
    return await deleteGovernancePolicyHandler(event);
  }

  return createResponse(404, { error: 'Not found' });
}
