// Common types for the Architecture Review System

export type ReviewStatus = 'Pending Review' | 'In Review' | 'Modification Required' | 'Review Completed' | 'Rejected';

export type DocumentFormat = 'pdf' | 'png' | 'jpg' | 'jpeg';

export type PillarName = 
  | 'Operational Excellence'
  | 'Security'
  | 'Reliability'
  | 'Performance Efficiency'
  | 'Cost Optimization'
  | 'Sustainability';

export type UserGroup = 'A_Group' | 'B_Group';

export type ExecutionStatus = 'Pending' | 'In Progress' | 'Completed' | 'Failed';

export type PillarStatus = 'Pending' | 'In Progress' | 'Completed' | 'Failed';

export type PolicySeverity = 'High' | 'Medium' | 'Low';

// ========================================
// DynamoDB Record Types
// ========================================

export interface ReviewRequestRecord {
  PK: string;                    // "REQ#{reviewRequestId}"
  SK: string;                    // "METADATA"
  reviewRequestId: string;
  documentId: string;
  documentTitle?: string;        // Document title for display
  submitterEmail: string;
  submitterUserId: string;
  reviewerEmail: string;
  reviewerUserId?: string;
  status: ReviewStatus;
  currentVersion: number;
  executionId?: string;          // Latest execution ID
  createdAt: string;             // ISO 8601
  updatedAt: string;
  rejectionReason?: string;      // Reason for rejection
  GSI1PK: string;                // "USER#{submitterUserId}"
  GSI1SK: string;                // "REQ#{createdAt}"
  GSI2PK: string;                // "USER#{reviewerUserId}"
  GSI2SK: string;                // "REQ#{createdAt}"
}

export interface DocumentRecord {
  PK: string;                    // "DOC#{documentId}"
  SK: string;                    // "VERSION#{versionNumber}"
  documentId: string;
  reviewRequestId: string;
  versionNumber: number;
  s3Bucket: string;
  s3Key: string;
  format: DocumentFormat;
  title: string;
  description: string;
  uploadedBy: string;
  uploadedAt: string;
  fileSize: number;
  checksum: string;
}

export interface ReviewExecutionRecord {
  PK: string;                    // "EXEC#{executionId}"
  SK: string;                    // "METADATA"
  executionId: string;
  reviewRequestId: string;
  documentId: string;
  versionNumber: number;
  status: ExecutionStatus;
  selectedPillars: PillarName[];
  governancePolicyIds: string[];
  architecturePages?: number[];  // User-specified architecture diagram pages
  startedAt: string;
  completedAt?: string;
  pillarResults?: Record<string, PillarResult>;
  reportS3Key?: string;
  visionSummary?: string;        // Vision analysis summary for architecture tab
  executiveSummary?: string;     // Executive summary for summary tab
}

export interface PillarConfigurationRecord {
  PK: string;                    // "PILLAR#{pillarName}" or "VISION#NOVA"
  SK: string;                    // "VERSION#{timestamp}"
  pillarName: string;            // PillarName or 'Nova Vision'
  systemPrompt: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

export interface GovernancePolicyRecord {
  PK: string;                    // "POLICY#{policyId}"
  SK: string;                    // "METADATA"
  policyId: string;
  title: string;
  description: string;
  fileName: string;
  qBusinessDataSourceId: string;
  s3Bucket: string;
  s3Key: string;
  uploadedBy: string;
  uploadedAt: string;
  isActive: boolean;
}

// ========================================
// Business Domain Types
// ========================================

export interface ReviewRequest {
  reviewRequestId: string;
  documentId: string;
  documentTitle?: string;        // Document title for display
  submitterEmail: string;
  submitterUserId: string;
  reviewerEmail: string;
  reviewerUserId?: string;
  status: ReviewStatus;
  currentVersion: number;
  executionId?: string;          // Latest execution ID
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;      // Reason for rejection
}

export interface Document {
  documentId: string;
  reviewRequestId: string;
  versionNumber: number;
  s3Bucket: string;
  s3Key: string;
  format: DocumentFormat;
  title: string;
  description: string;
  uploadedBy: string;
  uploadedAt: string;
  fileSize: number;
  checksum: string;
}

export interface PillarConfig {
  pillarName: PillarName;
  systemPrompt: string;
  enabled: boolean;
  additionalInstructions?: string;
}

export interface VisionModelConfig {
  modelId: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  enabled: boolean;
}

export interface GovernancePolicy {
  policyId: string;
  title: string;
  description: string;
  fileName: string;
  qBusinessDataSourceId: string;
  s3Bucket: string;
  s3Key: string;
  uploadedBy: string;
  uploadedAt: string;
  isActive: boolean;
}

export interface ReviewExecution {
  executionId: string;
  reviewRequestId: string;
  documentId: string;
  versionNumber: number;
  status: ExecutionStatus;
  selectedPillars: PillarName[];
  governancePolicyIds: string[];
  startedAt: string;
  completedAt?: string;
  pillarResults?: Record<string, PillarResult>;
  reportS3Key?: string;
  visionSummary?: string;        // Vision analysis summary (for architecture tab)
  executiveSummary?: string;     // Executive summary (for summary tab)
}

export interface PillarResult {
  pillarName: PillarName;
  status: PillarStatus;
  findings: string;
  recommendations: string[];
  governanceViolations?: PolicyViolation[];
  completedAt?: string;
  error?: string;
}

export interface PolicyViolation {
  policyId: string;
  policyTitle: string;
  violationDescription: string;
  recommendedCorrection: string;
  severity: PolicySeverity;
}

// ========================================
// API Request/Response Types
// ========================================

// Document Upload
export interface UploadDocumentRequest {
  title: string;
  description: string;
  format: DocumentFormat;
  submitterUserId: string;
}

export interface UploadDocumentResponse {
  documentId: string;
  uploadUrl: string;
}

// Review Request
export interface CreateReviewRequestRequest {
  documentId: string;
  reviewerEmail: string;
  submitterEmail: string;
  submitterUserId: string;
}

export interface CreateReviewRequestResponse {
  reviewRequestId: string;
}

export interface GetReviewRequestResponse {
  reviewRequest: ReviewRequest;
  versions: VersionInfo[];
}

export interface UpdateReviewRequestStatusRequest {
  status: ReviewStatus;
  comment?: string;
}

// Review Execution
export interface ExecuteReviewRequest {
  reviewRequestId: string;
  pillarSelection: PillarName[];
  governancePolicies: string[];
  instructions: Record<string, string>;
  architecturePages?: number[];  // User-specified architecture diagram pages
}

export interface ExecuteReviewResponse {
  executionId: string;
}

export interface GetReviewStatusResponse {
  status: ExecutionStatus;
  pillarResults: Record<string, PillarResult>;
}

export interface GetReviewResultsResponse {
  reviewReport: ReviewReport;
}

export interface DownloadReportRequest {
  format: 'pdf' | 'word';
}

export interface DownloadReportResponse {
  downloadUrl: string;
}

// Pillar Configuration
export interface GetPillarsResponse {
  pillars: PillarConfig[];
}

export interface UpdatePillarRequest {
  systemPrompt: string;
  enabled: boolean;
}

export interface UpdatePillarResponse {
  updated: boolean;
}

export interface GetPillarHistoryResponse {
  promptHistory: PromptVersion[];
}

// Governance Policy
export interface UploadGovernancePolicyResponse {
  policyId: string;
}

export interface GetGovernancePoliciesResponse {
  policies: GovernancePolicy[];
}

// IaC Generation
export interface GenerateIaCRequest {
  reviewRequestId: string;
  format: 'cloudformation' | 'terraform';
}

export interface GenerateIaCResponse {
  templateUrl: string;
}

// Modification Request
export interface ModificationRequestRequest {
  modificationDetails: string;
}

// ========================================
// Supporting Types
// ========================================

export interface VersionInfo {
  versionNumber: number;
  documentId: string;
  reviewReportId?: string;
  uploadedAt: string;
}

export interface ReviewReport {
  executionId: string;
  reviewRequestId: string;
  documentId: string;
  versionNumber: number;
  pillarResults: Record<string, PillarResult>;
  overallSummary: string;
  executiveSummary?: string;  // Executive Summary (종합 요약)
  generatedAt: string;
}

export interface PromptVersion {
  pillarName: PillarName;
  systemPrompt: string;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

// ========================================
// Utility Types
// ========================================

export interface PaginationParams {
  limit?: number;
  nextToken?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
}

// ========================================
// Error Types
// ========================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
