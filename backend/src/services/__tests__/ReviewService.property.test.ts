/**
 * Property-Based Tests for ReviewService
 * Feature: architecture-review-system, Property 8: Status Transition Validity
 * Validates: Requirements 7.2, 7.3, 7.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ReviewService } from '../ReviewService';
import type { ReviewStatus } from '../../types/index.js';

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-dynamodb');
vi.mock('@aws-sdk/lib-dynamodb');

describe('ReviewService Property Tests', () => {
  let reviewService: ReviewService;
  let mockDynamoSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDynamoSend = vi.fn().mockResolvedValue({});

    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    DynamoDBDocumentClient.from = vi.fn().mockReturnValue({
      send: mockDynamoSend,
    });

    reviewService = new ReviewService();
  });

  /**
   * Property 8: Status Transition Validity
   * For any review request, status transitions should follow the valid state machine:
   * "In Review" → "Modification Required" → "In Review" → "Review Completed"
   */
  it('Property 8: should allow valid status transitions', async () => {
    const validTransitions: Array<[ReviewStatus, ReviewStatus]> = [
      ['In Review', 'Modification Required'],
      ['In Review', 'Review Completed'],
      ['Modification Required', 'In Review'],
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...validTransitions),
        fc.uuid(),
        async ([currentStatus, newStatus], reviewRequestId) => {
          // Mock getReviewRequest to return current status
          mockDynamoSend.mockResolvedValueOnce({
            Item: {
              PK: `REQ#${reviewRequestId}`,
              SK: 'METADATA',
              reviewRequestId,
              documentId: 'doc-123',
              submitterEmail: 'submitter@example.com',
              submitterUserId: 'user-1',
              reviewerEmail: 'reviewer@example.com',
              status: currentStatus,
              currentVersion: 1,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              GSI1PK: 'USER#user-1',
              GSI1SK: 'REQ#2024-01-01T00:00:00Z',
              GSI2PK: '',
              GSI2SK: 'REQ#2024-01-01T00:00:00Z',
            },
          });

          // Mock update
          mockDynamoSend.mockResolvedValueOnce({});

          // Should not throw
          await expect(
            reviewService.updateStatus(reviewRequestId, newStatus)
          ).resolves.not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: should reject invalid status transitions', async () => {
    const invalidTransitions: Array<[ReviewStatus, ReviewStatus]> = [
      ['Review Completed', 'In Review'],
      ['Review Completed', 'Modification Required'],
      ['Modification Required', 'Review Completed'],
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...invalidTransitions),
        fc.uuid(),
        async ([currentStatus, newStatus], reviewRequestId) => {
          // Mock getReviewRequest to return current status
          mockDynamoSend.mockResolvedValueOnce({
            Item: {
              PK: `REQ#${reviewRequestId}`,
              SK: 'METADATA',
              reviewRequestId,
              documentId: 'doc-123',
              submitterEmail: 'submitter@example.com',
              submitterUserId: 'user-1',
              reviewerEmail: 'reviewer@example.com',
              status: currentStatus,
              currentVersion: 1,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              GSI1PK: 'USER#user-1',
              GSI1SK: 'REQ#2024-01-01T00:00:00Z',
              GSI2PK: '',
              GSI2SK: 'REQ#2024-01-01T00:00:00Z',
            },
          });

          // Should throw ValidationError
          await expect(
            reviewService.updateStatus(reviewRequestId, newStatus)
          ).rejects.toThrow('Invalid status transition');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create review request with initial status "In Review"', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          documentId: fc.uuid(),
          submitterEmail: fc.emailAddress(),
          submitterUserId: fc.uuid(),
          reviewerEmail: fc.emailAddress(),
        }),
        async (params) => {
          mockDynamoSend.mockResolvedValueOnce({});

          const reviewRequestId = await reviewService.createReviewRequest(params);

          expect(reviewRequestId).toBeDefined();
          expect(typeof reviewRequestId).toBe('string');

          // Verify DynamoDB put was called with correct initial status
          const putCalls = mockDynamoSend.mock.calls.filter(
            (call: any) => call[0].input && call[0].input.Item
          );
          expect(putCalls.length).toBeGreaterThan(0);
          const putCall = putCalls[0][0];
          expect(putCall.input.Item.status).toBe('In Review');
          expect(putCall.input.Item.currentVersion).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject invalid email addresses', async () => {
    const invalidEmails = ['invalid', 'user@', '@example.com', 'user @example.com'];

    for (const invalidEmail of invalidEmails) {
      await expect(
        reviewService.createReviewRequest({
          documentId: 'doc-123',
          submitterEmail: invalidEmail,
          submitterUserId: 'user-1',
          reviewerEmail: 'valid@example.com',
        })
      ).rejects.toThrow('Invalid');
    }
  });
});
