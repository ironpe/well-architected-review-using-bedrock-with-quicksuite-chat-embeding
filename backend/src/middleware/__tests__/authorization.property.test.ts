/**
 * Property-Based Tests for Authorization
 * Feature: architecture-review-system, Property 11: User Authorization
 * Validates: Requirements 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AuthorizationService, Permission } from '../authorization';
import type { UserGroup } from '../../types/index.js';

describe('Authorization Property Tests', () => {
  const authService = new AuthorizationService();

  /**
   * Property 11: User Authorization
   * For any API request, users should only be able to access resources and 
   * perform actions that are authorized for their user group (A_Group or B_Group)
   */
  it('Property 11: A_Group should only have A_Group permissions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Permission>(
          'upload:document',
          'create:review-request',
          'execute:review',
          'configure:agent',
          'manage:governance-policy',
          'view:review-request',
          'view:review-results',
          'request:modification',
          'generate:iac'
        ),
        (permission) => {
          const hasPermission = authService.hasPermission('A_Group', permission);

          // A_Group specific permissions
          const aGroupPermissions: Permission[] = [
            'upload:document',
            'create:review-request',
            'view:review-request',
            'view:review-results',
            'generate:iac',
          ];

          // Verify permission matches expected
          if (aGroupPermissions.includes(permission)) {
            expect(hasPermission).toBe(true);
          } else {
            expect(hasPermission).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: B_Group should only have B_Group permissions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Permission>(
          'upload:document',
          'create:review-request',
          'execute:review',
          'configure:agent',
          'manage:governance-policy',
          'view:review-request',
          'view:review-results',
          'request:modification',
          'generate:iac'
        ),
        (permission) => {
          const hasPermission = authService.hasPermission('B_Group', permission);

          // B_Group specific permissions
          const bGroupPermissions: Permission[] = [
            'execute:review',
            'configure:agent',
            'manage:governance-policy',
            'view:review-request',
            'view:review-results',
            'request:modification',
          ];

          // Verify permission matches expected
          if (bGroupPermissions.includes(permission)) {
            expect(hasPermission).toBe(true);
          } else {
            expect(hasPermission).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: null user group should have no permissions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Permission>(
          'upload:document',
          'create:review-request',
          'execute:review',
          'configure:agent',
          'manage:governance-policy',
          'view:review-request',
          'view:review-results',
          'request:modification',
          'generate:iac'
        ),
        (permission) => {
          const hasPermission = authService.hasPermission(null, permission);
          expect(hasPermission).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify A_Group exclusive permissions', () => {
    const aGroupExclusive: Permission[] = ['upload:document', 'create:review-request', 'generate:iac'];

    aGroupExclusive.forEach(permission => {
      expect(authService.hasPermission('A_Group', permission)).toBe(true);
      expect(authService.hasPermission('B_Group', permission)).toBe(false);
    });
  });

  it('should correctly identify B_Group exclusive permissions', () => {
    const bGroupExclusive: Permission[] = [
      'execute:review',
      'configure:agent',
      'manage:governance-policy',
      'request:modification',
    ];

    bGroupExclusive.forEach(permission => {
      expect(authService.hasPermission('B_Group', permission)).toBe(true);
      expect(authService.hasPermission('A_Group', permission)).toBe(false);
    });
  });

  it('should correctly identify shared permissions', () => {
    const sharedPermissions: Permission[] = ['view:review-request', 'view:review-results'];

    sharedPermissions.forEach(permission => {
      expect(authService.hasPermission('A_Group', permission)).toBe(true);
      expect(authService.hasPermission('B_Group', permission)).toBe(true);
    });
  });

  it('should throw UnauthorizedError when requiring permission user does not have', () => {
    expect(() => {
      authService.requirePermission('A_Group', 'execute:review');
    }).toThrow('does not have permission');

    expect(() => {
      authService.requirePermission('B_Group', 'upload:document');
    }).toThrow('does not have permission');
  });

  it('should not throw when user has required permission', () => {
    expect(() => {
      authService.requirePermission('A_Group', 'upload:document');
    }).not.toThrow();

    expect(() => {
      authService.requirePermission('B_Group', 'execute:review');
    }).not.toThrow();
  });
});
