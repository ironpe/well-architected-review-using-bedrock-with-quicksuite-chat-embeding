/**
 * Authentication Middleware
 * JWT token verification and user group validation
 * Requirements: 10.1, 10.2
 */

import { APIGatewayProxyEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { environment } from '../config/environment.js';
import { UserGroup, UnauthorizedError } from '../types/index.js';

interface CognitoToken {
  sub: string;
  email: string;
  'cognito:username': string;
  'cognito:groups'?: string[];
  iss: string;
  exp: number;
  iat: number;
}

interface AuthContext {
  userId: string;
  email: string;
  username: string;
  groups: string[];
  userGroup: UserGroup | null;
}

export class AuthMiddleware {
  private jwksClient: jwksClient.JwksClient;
  private issuer: string;

  constructor() {
    const region = environment.aws.region;
    const userPoolId = environment.cognito.userPoolId;
    this.issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    this.jwksClient = jwksClient({
      jwksUri: `${this.issuer}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
    });
  }

  /**
   * Verify JWT token from Authorization header
   */
  async verifyToken(token: string): Promise<CognitoToken> {
    try {
      // Decode token to get kid (key id)
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        throw new UnauthorizedError('Invalid token format');
      }

      const kid = decoded.header.kid;
      if (!kid) {
        throw new UnauthorizedError('Token missing kid');
      }

      // Get signing key
      const key = await this.jwksClient.getSigningKey(kid);
      const signingKey = key.getPublicKey();

      // Verify token
      const verified = jwt.verify(token, signingKey, {
        issuer: this.issuer,
        algorithms: ['RS256'],
      }) as CognitoToken;

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (verified.exp < now) {
        throw new UnauthorizedError('Token expired');
      }

      return verified;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError(`Token verification failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract and parse authorization token from event
   */
  extractToken(event: APIGatewayProxyEvent): string {
    // Handle null headers
    const headers = event.headers || {};
    const authHeader = headers.Authorization || headers.authorization;
    
    if (!authHeader) {
      throw new UnauthorizedError('Missing Authorization header');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedError('Invalid Authorization header format. Expected: Bearer <token>');
    }

    return parts[1];
  }

  /**
   * Get user group from Cognito groups
   * Maps Cognito group names to internal UserGroup types
   * - Reviewer_Group -> B_Group (reviewers)
   * - Requester_Group -> A_Group (requesters)
   */
  getUserGroup(groups: string[] = []): UserGroup | null {
    // B_Group mappings (reviewers)
    if (groups.includes('Reviewer_Group')) {
      return 'B_Group';
    }
    
    // A_Group mappings (requesters)
    if (groups.includes('Requester_Group')) {
      return 'A_Group';
    }
    
    return null;
  }

  /**
   * Authenticate request and extract user context
   */
  async authenticate(event: APIGatewayProxyEvent): Promise<AuthContext> {
    const token = this.extractToken(event);
    const cognitoToken = await this.verifyToken(token);

    const groups = cognitoToken['cognito:groups'] || [];
    const userGroup = this.getUserGroup(groups);

    return {
      userId: cognitoToken.sub,
      email: cognitoToken.email,
      username: cognitoToken['cognito:username'],
      groups,
      userGroup,
    };
  }

  /**
   * Generate API Gateway authorizer response
   */
  generateAuthorizerResponse(
    principalId: string,
    effect: 'Allow' | 'Deny',
    resource: string,
    context?: Record<string, string>
  ): APIGatewayAuthorizerResult {
    return {
      principalId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: effect,
            Resource: resource,
          },
        ],
      },
      context,
    };
  }
}

/**
 * Lambda Authorizer Handler
 * Used by API Gateway to authorize requests
 */
export async function authorizerHandler(
  event: any
): Promise<APIGatewayAuthorizerResult> {
  const authMiddleware = new AuthMiddleware();

  try {
    const token = event.authorizationToken?.replace('Bearer ', '') || '';
    const cognitoToken = await authMiddleware.verifyToken(token);

    const groups = cognitoToken['cognito:groups'] || [];
    const userGroup = authMiddleware.getUserGroup(groups);

    return authMiddleware.generateAuthorizerResponse(
      cognitoToken.sub,
      'Allow',
      event.methodArn,
      {
        userId: cognitoToken.sub,
        email: cognitoToken.email,
        username: cognitoToken['cognito:username'],
        userGroup: userGroup || 'none',
        groups: groups.join(','),
      }
    );
  } catch (error) {
    console.error('Authorization failed:', error);
    return authMiddleware.generateAuthorizerResponse(
      'unauthorized',
      'Deny',
      event.methodArn
    );
  }
}
