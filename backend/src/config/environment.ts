export const environment = {
  aws: {
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
  },
  dynamodb: {
    reviewRequestsTable: process.env.REVIEW_REQUESTS_TABLE || 'ArchitectureReview-ReviewRequests',
    documentsTable: process.env.DOCUMENTS_TABLE || 'ArchitectureReview-Documents',
    reviewExecutionsTable: process.env.REVIEW_EXECUTIONS_TABLE || 'ArchitectureReview-ReviewExecutions',
    pillarConfigurationsTable: process.env.PILLAR_CONFIGURATIONS_TABLE || 'ArchitectureReview-PillarConfigurations',
    governancePoliciesTable: process.env.GOVERNANCE_POLICIES_TABLE || 'ArchitectureReview-GovernancePolicies',
  },
  s3: {
    documentsBucket: process.env.DOCUMENTS_BUCKET || 'architecture-review-documents',
    reportsBucket: process.env.REPORTS_BUCKET || 'architecture-review-reports',
  },
  bedrock: {
    modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    agentTimeout: parseInt(process.env.BEDROCK_AGENT_TIMEOUT || '300000', 10),
  },
  optimization: {
    // Pillar 분석에 이미지 포함 여부 (false = 텍스트만, 성능 최적화)
    includePillarImages: process.env.INCLUDE_PILLAR_IMAGES === 'true',
    // Executive Summary 동기 생성 여부 (false = 비동기, 성능 최적화)
    generateExecutiveSummarySync: process.env.GENERATE_EXECUTIVE_SUMMARY_SYNC === 'true',
  },
  qBusiness: {
    applicationId: process.env.Q_BUSINESS_APPLICATION_ID || '',
    dataSourceId: process.env.Q_BUSINESS_DATA_SOURCE_ID || '',
  },
  ses: {
    fromEmail: process.env.SES_FROM_EMAIL || 'noreply@example.com',
    replyToEmail: process.env.SES_REPLY_TO_EMAIL || 'support@example.com',
  },
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID || '',
    clientId: process.env.COGNITO_CLIENT_ID || '',
  },
  quicksight: {
    accountId: process.env.QUICKSIGHT_ACCOUNT_ID || process.env.AWS_ACCOUNT_ID || '',
    namespace: process.env.QUICKSIGHT_NAMESPACE || 'default',
    agentId: process.env.QUICKSIGHT_AGENT_ID || '',
  },
};
