/**
 * Type conversion utilities for transforming between DynamoDB records and domain models
 */

import {
  ReviewRequestRecord,
  ReviewRequest,
  DocumentRecord,
  Document,
  ReviewExecutionRecord,
  ReviewExecution,
  PillarConfigurationRecord,
  PillarConfig,
  PillarName,
  GovernancePolicyRecord,
  GovernancePolicy,
} from '../types/index.js';

// ========================================
// ReviewRequest Converters
// ========================================

export function reviewRequestRecordToDomain(record: ReviewRequestRecord): ReviewRequest {
  return {
    reviewRequestId: record.reviewRequestId,
    documentId: record.documentId,
    documentTitle: record.documentTitle,
    submitterEmail: record.submitterEmail,
    submitterUserId: record.submitterUserId,
    reviewerEmail: record.reviewerEmail,
    reviewerUserId: record.reviewerUserId,
    status: record.status,
    currentVersion: record.currentVersion,
    executionId: record.executionId, // Add executionId
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    rejectionReason: record.rejectionReason,
  };
}

export function reviewRequestToRecord(
  domain: ReviewRequest,
  reviewRequestId: string
): ReviewRequestRecord {
  return {
    PK: `REQ#${reviewRequestId}`,
    SK: 'METADATA',
    reviewRequestId: domain.reviewRequestId,
    documentId: domain.documentId,
    submitterEmail: domain.submitterEmail,
    submitterUserId: domain.submitterUserId,
    reviewerEmail: domain.reviewerEmail,
    reviewerUserId: domain.reviewerUserId,
    status: domain.status,
    currentVersion: domain.currentVersion,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    GSI1PK: `USER#${domain.submitterUserId}`,
    GSI1SK: `REQ#${domain.createdAt}`,
    GSI2PK: domain.reviewerUserId ? `USER#${domain.reviewerUserId}` : '',
    GSI2SK: `REQ#${domain.createdAt}`,
  };
}

// ========================================
// Document Converters
// ========================================

export function documentRecordToDomain(record: DocumentRecord): Document {
  return {
    documentId: record.documentId,
    reviewRequestId: record.reviewRequestId,
    versionNumber: record.versionNumber,
    s3Bucket: record.s3Bucket,
    s3Key: record.s3Key,
    format: record.format,
    title: record.title,
    description: record.description,
    uploadedBy: record.uploadedBy,
    uploadedAt: record.uploadedAt,
    fileSize: record.fileSize,
    checksum: record.checksum,
  };
}

export function documentToRecord(
  domain: Document,
  documentId: string,
  versionNumber: number
): DocumentRecord {
  return {
    PK: `DOC#${documentId}`,
    SK: `VERSION#${versionNumber}`,
    documentId: domain.documentId,
    reviewRequestId: domain.reviewRequestId,
    versionNumber: domain.versionNumber,
    s3Bucket: domain.s3Bucket,
    s3Key: domain.s3Key,
    format: domain.format,
    title: domain.title,
    description: domain.description,
    uploadedBy: domain.uploadedBy,
    uploadedAt: domain.uploadedAt,
    fileSize: domain.fileSize,
    checksum: domain.checksum,
  };
}

// ========================================
// ReviewExecution Converters
// ========================================

export function reviewExecutionRecordToDomain(record: ReviewExecutionRecord): ReviewExecution {
  return {
    executionId: record.executionId,
    reviewRequestId: record.reviewRequestId,
    documentId: record.documentId,
    versionNumber: record.versionNumber,
    status: record.status,
    selectedPillars: record.selectedPillars,
    governancePolicyIds: record.governancePolicyIds,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    pillarResults: record.pillarResults,
    reportS3Key: record.reportS3Key,
    visionSummary: record.visionSummary,
    executiveSummary: record.executiveSummary,
    language: record.language,
    costBreakdown: record.costBreakdown,
    governanceAnalysis: record.governanceAnalysis,
  };
}

export function reviewExecutionToRecord(
  domain: ReviewExecution,
  executionId: string
): ReviewExecutionRecord {
  return {
    PK: `EXEC#${executionId}`,
    SK: 'METADATA',
    executionId: domain.executionId,
    reviewRequestId: domain.reviewRequestId,
    documentId: domain.documentId,
    versionNumber: domain.versionNumber,
    status: domain.status,
    selectedPillars: domain.selectedPillars,
    governancePolicyIds: domain.governancePolicyIds,
    startedAt: domain.startedAt,
    completedAt: domain.completedAt,
    pillarResults: domain.pillarResults,
    reportS3Key: domain.reportS3Key,
  };
}

// ========================================
// PillarConfiguration Converters
// ========================================

export function pillarConfigRecordToDomain(record: PillarConfigurationRecord): PillarConfig {
  return {
    pillarName: record.pillarName as PillarName,
    systemPrompt: record.systemPrompt,
    enabled: record.enabled,
  };
}

export function pillarConfigToRecord(
  domain: PillarConfig,
  createdBy: string,
  timestamp: string
): PillarConfigurationRecord {
  return {
    PK: `PILLAR#${domain.pillarName}`,
    SK: `VERSION#${timestamp}`,
    pillarName: domain.pillarName,
    systemPrompt: domain.systemPrompt,
    enabled: domain.enabled,
    createdBy,
    createdAt: timestamp,
    isActive: true,
  };
}

// ========================================
// GovernancePolicy Converters
// ========================================

export function governancePolicyRecordToDomain(record: GovernancePolicyRecord): GovernancePolicy {
  return {
    policyId: record.policyId,
    title: record.title,
    description: record.description,
    fileName: record.fileName,
    qBusinessDataSourceId: record.qBusinessDataSourceId,
    s3Bucket: record.s3Bucket,
    s3Key: record.s3Key,
    uploadedBy: record.uploadedBy,
    uploadedAt: record.uploadedAt,
    isActive: record.isActive,
  };
}

export function governancePolicyToRecord(
  domain: GovernancePolicy,
  policyId: string
): GovernancePolicyRecord {
  return {
    PK: `POLICY#${policyId}`,
    SK: 'METADATA',
    policyId: domain.policyId,
    title: domain.title,
    description: domain.description,
    fileName: domain.fileName || 'policy.pdf',
    qBusinessDataSourceId: domain.qBusinessDataSourceId,
    s3Bucket: domain.s3Bucket,
    s3Key: domain.s3Key,
    uploadedBy: domain.uploadedBy,
    uploadedAt: domain.uploadedAt,
    isActive: domain.isActive,
  };
}
