import { describe, it, expect } from 'vitest';
import {
  reviewRequestRecordToDomain,
  reviewRequestToRecord,
  documentRecordToDomain,
  documentToRecord,
  reviewExecutionRecordToDomain,
  reviewExecutionToRecord,
  pillarConfigRecordToDomain,
  pillarConfigToRecord,
  governancePolicyRecordToDomain,
  governancePolicyToRecord,
} from '../type-converters';
import type {
  ReviewRequestRecord,
  ReviewRequest,
  DocumentRecord,
  Document,
} from '../../types/index.js';

describe('Type Converters', () => {
  describe('ReviewRequest Converters', () => {
    it('should convert record to domain model', () => {
      const record: ReviewRequestRecord = {
        PK: 'REQ#123',
        SK: 'METADATA',
        reviewRequestId: '123',
        documentId: 'doc-456',
        submitterEmail: 'submitter@example.com',
        submitterUserId: 'user-1',
        reviewerEmail: 'reviewer@example.com',
        reviewerUserId: 'user-2',
        status: 'In Review',
        currentVersion: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        GSI1PK: 'USER#user-1',
        GSI1SK: 'REQ#2024-01-01T00:00:00Z',
        GSI2PK: 'USER#user-2',
        GSI2SK: 'REQ#2024-01-01T00:00:00Z',
      };

      const domain = reviewRequestRecordToDomain(record);

      expect(domain.reviewRequestId).toBe('123');
      expect(domain.documentId).toBe('doc-456');
      expect(domain.status).toBe('In Review');
      expect(domain.currentVersion).toBe(1);
    });

    it('should convert domain model to record', () => {
      const domain: ReviewRequest = {
        reviewRequestId: '123',
        documentId: 'doc-456',
        submitterEmail: 'submitter@example.com',
        submitterUserId: 'user-1',
        reviewerEmail: 'reviewer@example.com',
        reviewerUserId: 'user-2',
        status: 'In Review',
        currentVersion: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const record = reviewRequestToRecord(domain, '123');

      expect(record.PK).toBe('REQ#123');
      expect(record.SK).toBe('METADATA');
      expect(record.GSI1PK).toBe('USER#user-1');
      expect(record.GSI2PK).toBe('USER#user-2');
    });
  });

  describe('Document Converters', () => {
    it('should convert record to domain model', () => {
      const record: DocumentRecord = {
        PK: 'DOC#doc-123',
        SK: 'VERSION#1',
        documentId: 'doc-123',
        reviewRequestId: 'req-456',
        versionNumber: 1,
        s3Bucket: 'test-bucket',
        s3Key: 'documents/req-456/v1/doc-123.pdf',
        format: 'pdf',
        title: 'Test Document',
        description: 'Test description',
        uploadedBy: 'user-1',
        uploadedAt: '2024-01-01T00:00:00Z',
        fileSize: 1024,
        checksum: 'abc123',
      };

      const domain = documentRecordToDomain(record);

      expect(domain.documentId).toBe('doc-123');
      expect(domain.versionNumber).toBe(1);
      expect(domain.format).toBe('pdf');
    });

    it('should convert domain model to record', () => {
      const domain: Document = {
        documentId: 'doc-123',
        reviewRequestId: 'req-456',
        versionNumber: 1,
        s3Bucket: 'test-bucket',
        s3Key: 'documents/req-456/v1/doc-123.pdf',
        format: 'pdf',
        title: 'Test Document',
        description: 'Test description',
        uploadedBy: 'user-1',
        uploadedAt: '2024-01-01T00:00:00Z',
        fileSize: 1024,
        checksum: 'abc123',
      };

      const record = documentToRecord(domain, 'doc-123', 1);

      expect(record.PK).toBe('DOC#doc-123');
      expect(record.SK).toBe('VERSION#1');
      expect(record.documentId).toBe('doc-123');
    });
  });

  describe('Round-trip Conversions', () => {
    it('should preserve data through record -> domain -> record conversion', () => {
      const originalRecord: ReviewRequestRecord = {
        PK: 'REQ#123',
        SK: 'METADATA',
        reviewRequestId: '123',
        documentId: 'doc-456',
        submitterEmail: 'submitter@example.com',
        submitterUserId: 'user-1',
        reviewerEmail: 'reviewer@example.com',
        reviewerUserId: 'user-2',
        status: 'In Review',
        currentVersion: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        GSI1PK: 'USER#user-1',
        GSI1SK: 'REQ#2024-01-01T00:00:00Z',
        GSI2PK: 'USER#user-2',
        GSI2SK: 'REQ#2024-01-01T00:00:00Z',
      };

      const domain = reviewRequestRecordToDomain(originalRecord);
      const convertedRecord = reviewRequestToRecord(domain, '123');

      expect(convertedRecord.reviewRequestId).toBe(originalRecord.reviewRequestId);
      expect(convertedRecord.documentId).toBe(originalRecord.documentId);
      expect(convertedRecord.status).toBe(originalRecord.status);
      expect(convertedRecord.PK).toBe(originalRecord.PK);
      expect(convertedRecord.SK).toBe(originalRecord.SK);
    });
  });
});
