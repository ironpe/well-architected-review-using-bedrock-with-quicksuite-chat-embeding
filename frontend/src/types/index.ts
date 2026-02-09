// Frontend types for Architecture Review System

export type ReviewStatus = 'Pending Review' | 'In Review' | 'Modification Required' | 'Review Completed' | 'Rejected';

export type DocumentFormat = 'pdf' | 'png' | 'jpg' | 'jpeg';

export type PillarName = 
  | 'Operational Excellence'
  | 'Security'
  | 'Reliability'
  | 'Performance Efficiency'
  | 'Cost Optimization'
  | 'Sustainability';

export type UserGroup = 'Requester_Group' | 'Reviewer_Group';

export type ExecutionStatus = 'Pending' | 'In Progress' | 'Completed' | 'Failed';

export type PillarStatus = 'Pending' | 'In Progress' | 'Completed' | 'Failed';

export type PolicySeverity = 'High' | 'Medium' | 'Low';

// ========================================
// Cost Tracking Types
// ========================================

export interface CostItem {
  service: string;
  operation: string;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  requestCount?: number;
  dataTransferKB?: number;
  cost: number;
  timestamp: string;
}

export interface CostBreakdown {
  items: CostItem[];
  totalCost: number;
  currency: string;
  breakdown: {
    bedrock: number;
    s3: number;
    dynamodb: number;
    lambda: number;
    other: number;
  };
}

// ========================================
// Domain Models
// ========================================

export interface ReviewRequest {
  reviewRequestId: string;
  documentId: string;
  documentTitle?: string;        // Document title for display
  submitterEmail: string;
  submitterName?: string;        // Submitter name for display
  submitterUserId: string;
  reviewerEmail: string;
  reviewerUserId?: string;
  status: ReviewStatus;
  currentVersion: number;
  executionId?: string;          // Latest execution ID for completed reviews
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

export interface GovernancePolicy {
  policyId: string;
  title: string;
  description: string;
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
  overallSummary: string;        // Architecture analysis (for architecture tab)
  executiveSummary?: string;     // Executive summary (for summary tab)
  costBreakdown?: CostBreakdown; // Cost breakdown (for cost tab)
  governanceAnalysis?: GovernanceAnalysisResult; // Governance compliance (for governance tab)
  generatedAt: string;
}

// ========================================
// Governance Compliance Analysis Types
// ========================================

export interface GovernanceComplianceResult {
  policyId: string;
  policyTitle: string;
  status: 'Compliant' | 'Non-Compliant' | 'Partially Compliant' | 'Not Applicable';
  findings: string;
  violations: GovernanceViolationDetail[];
  recommendations: string[];
}

export interface GovernanceViolationDetail {
  rule: string;
  description: string;
  severity: PolicySeverity;
  recommendation: string;
}

export interface GovernanceAnalysisResult {
  analyzedAt: string;
  totalPolicies: number;
  compliantCount: number;
  nonCompliantCount: number;
  partiallyCompliantCount: number;
  notApplicableCount: number;
  policyResults: GovernanceComplianceResult[];
  overallStatus: 'Compliant' | 'Non-Compliant' | 'Partially Compliant';
  summary: string;
}

export interface PromptVersion {
  pillarName: PillarName;
  systemPrompt: string;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

// ========================================
// User & Authentication
// ========================================

export interface User {
  userId: string;
  email: string;
  name: string;
  group: UserGroup;
  cognitoSub: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

// ========================================
// API Request/Response Types
// ========================================

// Document Upload
export interface UploadDocumentRequest {
  title: string;
  description: string;
  format: DocumentFormat;
  file: File;
}

export interface UploadDocumentResponse {
  documentId: string;
  uploadUrl: string;
}

// Review Request
export interface CreateReviewRequestRequest {
  documentId: string;
  title?: string;
  description?: string;
  submitterEmail?: string;
  submitterName?: string;
  reviewerEmail: string;
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
  language?: 'ko' | 'en';
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
export interface UploadGovernancePolicyRequest {
  file: File;
  title: string;
  description: string;
}

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
// UI State Types
// ========================================

export interface ReviewRequestListItem {
  reviewRequestId: string;
  documentTitle: string;
  submitterEmail: string;
  reviewerEmail: string;
  status: ReviewStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface PillarSelectionState {
  [key: string]: {
    selected: boolean;
    additionalInstructions: string;
  };
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
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

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}
