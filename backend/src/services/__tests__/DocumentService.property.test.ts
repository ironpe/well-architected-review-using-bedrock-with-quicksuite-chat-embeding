/**
 * Property-Based Tests for DocumentService
 * Feature: architecture-review-system, Property 1 & 7
 * Validates: Requirements 1.1, 1.5, 6.3, 6.4, 8.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { DocumentService } from '../DocumentService';
import type { DocumentFormat } from '../../types/index.js';

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/client-dynamodb');
vi.mock('@aws-sdk/lib-dynamodb');
vi.mock('@aws-sdk/s3-request-presigner');

describe('DocumentService Property Tests', () => {
  let documentService: DocumentService;
  let mockS3Send: ReturnType<typeof vi.fn>;
  let mockDynamoSend: ReturnType<typeof vi.fn>;
  let mockGetSignedUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock implementations
    mockS3Send = vi.fn().mockResolvedValue({});
    mockDynamoSend = vi.fn().mockResolvedValue({});
    mockGetSignedUrl = vi.fn().mockResolvedValue('https://example.com/signed-url');

    // Mock S3Client
    const { S3Client } = require('@aws-sdk/client-s3');
    S3Client.prototype.send = mockS3Send;

    // Mock DynamoDB
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    DynamoDBDocumentClient.from = vi.fn().mockReturnValue({
      send: mockDynamoSend,
    });

    // Mock getSignedUrl
    const presigner = require('@aws-sdk/s3-request-presigner');
    presigner.getSignedUrl = mockGetSignedUrl;

    documentService = new DocumentService();
  });

  /**
   * Property 1: Document Upload Completeness
   * For any architecture document upload, the document should be successfully 
   * stored in S3 and its metadata should be recorded in DynamoDB with a valid documentId
   */
  it('Property 1: should store document in S3 and metadata in DynamoDB for any valid upload', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random valid document metadata
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          format: fc.constantFrom<DocumentFormat>('ppt', 'pdf', 'word', 'gdoc'),
          reviewRequestId: fc.uuid(),
          uploadedBy: fc.uuid(),
        }),
        // Generate random file content (small size for testing)
        fc.uint8Array({ minLength: 100, maxLength: 1000 }),
        async (metadata, fileContent) => {
          // Ensure fileName matches format
          const fileNameMap: Record<DocumentFormat, string> = {
            ppt: 'test.pptx',
            pdf: 'test.pdf',
            word: 'test.docx',
            gdoc: 'test.gdoc',
          };
          const fileName = fileNameMap[metadata.format];

          const file = Buffer.from(fileContent);

          // Execute upload
          const result = await documentService.uploadDocument(file, {
            ...metadata,
            fileName,
          });

          // Verify documentId is generated
          expect(result.documentId).toBeDefined();
          expect(typeof result.documentId).toBe('string');
          expect(result.documentId.length).toBeGreaterThan(0);

          // Verify uploadUrl is generated
          expect(result.uploadUrl).toBeDefined();
          expect(typeof result.uploadUrl).toBe('string');

          // Verify S3 upload was called
          expect(mockS3Send).toHaveBeenCalled();
          const s3Calls = mockS3Send.mock.calls.filter((call: any) => 
            call[0].input && call[0].input.Bucket
          );
          expect(s3Calls.length).toBeGreaterThan(0);

          // Verify DynamoDB put was called
          const dynamoCalls = mockDynamoSend.mock.calls.filter((call: any) => 
            call[0].input && call[0].input.Item
          );
          expect(dynamoCalls.length).toBeGreaterThan(0);
          const dynamoCall = dynamoCalls[dynamoCalls.length - 1][0];
          expect(dynamoCall.input.Item.documentId).toBe(result.documentId);
          expect(dynamoCall.input.Item.PK).toBe(`DOC#${result.documentId}`);
          expect(dynamoCall.input.Item.SK).toBe('VERSION#1');
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });

  /**
   * Property 7: Version Creation and Linking
   * For any new architecture document upload for an existing review request, 
   * a new version should be created and linked to the original request with 
   * an incremented version number
   */
  it('Property 7: should create new version with incremented number for existing review', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          format: fc.constantFrom<DocumentFormat>('ppt', 'pdf', 'word', 'gdoc'),
          reviewRequestId: fc.uuid(),
          uploadedBy: fc.uuid(),
        }),
        fc.uint8Array({ minLength: 100, maxLength: 1000 }),
        fc.integer({ min: 1, max: 5 }), // Existing version count
        async (metadata, fileContent, existingVersionCount) => {
          // Ensure fileName matches format
          const fileNameMap: Record<DocumentFormat, string> = {
            ppt: 'test.pptx',
            pdf: 'test.pdf',
            word: 'test.docx',
            gdoc: 'test.gdoc',
          };
          const fileName = fileNameMap[metadata.format];

          const file = Buffer.from(fileContent);

          // Mock existing versions
          const existingVersions = Array.from({ length: existingVersionCount }, (_, i) => ({
            versionNumber: i + 1,
            documentId: `doc-${i + 1}`,
            uploadedAt: new Date().toISOString(),
          }));

          mockDynamoSend.mockResolvedValueOnce({ Items: existingVersions });
          mockS3Send.mockResolvedValueOnce({});
          mockDynamoSend.mockResolvedValueOnce({});

          // Execute createVersion
          const result = await documentService.createVersion(
            metadata.reviewRequestId,
            file,
            { ...metadata, fileName }
          );

          // Verify version number is incremented
          expect(result.versionNumber).toBe(existingVersionCount + 1);

          // Verify documentId is generated
          expect(result.documentId).toBeDefined();
          expect(typeof result.documentId).toBe('string');

          // Verify S3 upload was called with correct version in key
          const s3Calls = mockS3Send.mock.calls.filter((call: any) => 
            call[0].input && call[0].input.Key
          );
          expect(s3Calls.length).toBeGreaterThan(0);
          const s3Call = s3Calls[s3Calls.length - 1][0];
          expect(s3Call.input.Key).toContain(`/v${existingVersionCount + 1}/`);

          // Verify DynamoDB put was called with correct version
          const dynamoCalls = mockDynamoSend.mock.calls.filter((call: any) => 
            call[0].input && call[0].input.Item
          );
          expect(dynamoCalls.length).toBeGreaterThan(0);
          const lastDynamoCall = dynamoCalls[dynamoCalls.length - 1][0];
          expect(lastDynamoCall.input.Item.versionNumber).toBe(existingVersionCount + 1);
          expect(lastDynamoCall.input.Item.SK).toBe(`VERSION#${existingVersionCount + 1}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create version 1 for new review request with no existing versions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          format: fc.constantFrom<DocumentFormat>('pdf'),
          reviewRequestId: fc.uuid(),
          uploadedBy: fc.uuid(),
        }),
        fc.uint8Array({ minLength: 100, maxLength: 1000 }),
        async (metadata, fileContent) => {
          const file = Buffer.from(fileContent);

          // Reset mocks - no existing versions
          mockDynamoSend.mockResolvedValueOnce({ Items: [] });
          mockS3Send.mockResolvedValueOnce({});
          mockDynamoSend.mockResolvedValueOnce({});

          const result = await documentService.createVersion(
            metadata.reviewRequestId,
            file,
            { ...metadata, fileName: 'test.pdf' }
          );

          // Verify version number is 1 for new review request
          expect(result.versionNumber).toBe(1);
        }
      ),
      { numRuns: 50 }
    );
  });
});
