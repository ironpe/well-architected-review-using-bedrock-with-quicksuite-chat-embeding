/**
 * Authorization Middleware
 * User group permission validation
 * Requirements: 10.3, 10.4, 10.5
 */

import { UserGroup, UnauthorizedError } from '../types/index.js';

export type Permission =
  | 'upload:document'
  | 'create:review-request'
  | 'execute:review'
  | 'configure:agent'
  | 'manage:governance-policy'
  | 'view:review-request'
  | 'view:review-results'
  | 'request:modification'
  | 'generate:iac';

// Permission matrix for each user group
const PERMISSIONS: Record<UserGroup, Permission[]> = {
  A_Group: [
    'upload:document',
    'create:review-request',
    'view:review-request',
    'view:review-results',
    'generate:iac',
  ],
  B_Group: [
    'execute:review',
    'configure:agent',
    'manage:governance-policy',
    'view:review-request',
    'view:review-results',
    'request:modification',
  ],
};

export class AuthorizationService {
  /**
   * Check if user group has specific permission
   * Requirements: 10.3, 10.4, 10.5
   */
  hasPermission(userGroup: UserGroup | null, permission: Permission): boolean {
    if (!userGroup) {
      return false;
    }

    const groupPermissions = PERMISSIONS[userGroup];
    return groupPermissions.includes(permission);
  }

  /**
   * Require specific permission or throw error
   */
  requirePermission(userGroup: UserGroup | null, permission: Permission): void {
    if (!this.hasPermission(userGroup, permission)) {
      throw new UnauthorizedError(
        `User group ${userGroup || 'none'} does not have permission: ${permission}`
      );
    }
  }

  /**
   * Require user to be in A_Group
   */
  requireAGroup(userGroup: UserGroup | null): void {
    if (userGroup !== 'A_Group') {
      throw new UnauthorizedError('This action requires A_Group membership');
    }
  }

  /**
   * Require user to be in B_Group
   */
  requireBGroup(userGroup: UserGroup | null): void {
    if (userGroup !== 'B_Group') {
      throw new UnauthorizedError('This action requires B_Group membership');
    }
  }

  /**
   * Check if user can upload documents (A_Group only)
   * Requirements: 10.3
   */
  canUploadDocument(userGroup: UserGroup | null): boolean {
    return this.hasPermission(userGroup, 'upload:document');
  }

  /**
   * Check if user can create review requests (A_Group only)
   * Requirements: 10.3
   */
  canCreateReviewRequest(userGroup: UserGroup | null): boolean {
    return this.hasPermission(userGroup, 'create:review-request');
  }

  /**
   * Check if user can execute reviews (B_Group only)
   * Requirements: 10.4
   */
  canExecuteReview(userGroup: UserGroup | null): boolean {
    return this.hasPermission(userGroup, 'execute:review');
  }

  /**
   * Check if user can configure agents (B_Group only)
   * Requirements: 10.4
   */
  canConfigureAgent(userGroup: UserGroup | null): boolean {
    return this.hasPermission(userGroup, 'configure:agent');
  }

  /**
   * Check if user can manage governance policies (B_Group only)
   * Requirements: 10.4
   */
  canManageGovernancePolicy(userGroup: UserGroup | null): boolean {
    return this.hasPermission(userGroup, 'manage:governance-policy');
  }

  /**
   * Check if user can request modifications (B_Group only)
   * Requirements: 10.4
   */
  canRequestModification(userGroup: UserGroup | null): boolean {
    return this.hasPermission(userGroup, 'request:modification');
  }

  /**
   * Check if user can view review requests (Both groups)
   */
  canViewReviewRequest(userGroup: UserGroup | null): boolean {
    return this.hasPermission(userGroup, 'view:review-request');
  }

  /**
   * Check if user can view review results (Both groups)
   */
  canViewReviewResults(userGroup: UserGroup | null): boolean {
    return this.hasPermission(userGroup, 'view:review-results');
  }

  /**
   * Check if user can generate IaC templates (A_Group only)
   * Requirements: 10.3
   */
  canGenerateIaC(userGroup: UserGroup | null): boolean {
    return this.hasPermission(userGroup, 'generate:iac');
  }

  /**
   * Get all permissions for a user group
   */
  getPermissions(userGroup: UserGroup | null): Permission[] {
    if (!userGroup) {
      return [];
    }
    return PERMISSIONS[userGroup];
  }
}

// Singleton instance
export const authorizationService = new AuthorizationService();
