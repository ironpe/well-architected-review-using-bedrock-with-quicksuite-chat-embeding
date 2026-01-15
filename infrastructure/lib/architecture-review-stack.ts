import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class ArchitectureReviewStack extends cdk.Stack {
  // DynamoDB Tables
  public readonly reviewRequestsTable: dynamodb.Table;
  public readonly documentsTable: dynamodb.Table;
  public readonly reviewExecutionsTable: dynamodb.Table;
  public readonly pillarConfigurationsTable: dynamodb.Table;
  public readonly governancePoliciesTable: dynamodb.Table;

  // S3 Buckets
  public readonly documentsBucket: s3.Bucket;
  public readonly reportsBucket: s3.Bucket;
  public readonly governancePoliciesBucket: s3.Bucket;
  public readonly iacTemplatesBucket: s3.Bucket;

  // Cognito
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly aGroup: cognito.CfnUserPoolGroup;
  public readonly bGroup: cognito.CfnUserPoolGroup;

  // SES
  public readonly emailTemplate: ses.CfnTemplate;

  // Lambda & API Gateway
  public readonly api: apigateway.RestApi;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // S3 Buckets
    // ========================================

    // Documents Bucket - stores architecture documents
    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Reports Bucket
    this.reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'DeleteOldReports',
          expiration: cdk.Duration.days(365),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    // Governance Policies Bucket
    this.governancePoliciesBucket = new s3.Bucket(this, 'GovernancePoliciesBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    // IaC Templates Bucket
    this.iacTemplatesBucket = new s3.Bucket(this, 'IaCTemplatesBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'DeleteOldTemplates',
          expiration: cdk.Duration.days(180),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    // ========================================
    // Amazon Cognito
    // ========================================

    // User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${this.stackName}-UserPool`,
      selfSignUpEnabled: false, // Admin creates users
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // User Pool Client
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      userPoolClientName: `${this.stackName}-Client`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // A_Group - Architecture submitters
    this.aGroup = new cognito.CfnUserPoolGroup(this, 'AGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'A_Group',
      description: 'Architecture design document submitters',
      precedence: 1,
    });

    // B_Group - CCoE reviewers
    this.bGroup = new cognito.CfnUserPoolGroup(this, 'BGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'B_Group',
      description: 'CCoE team members who review architectures',
      precedence: 0, // Higher priority
    });

    // ========================================
    // Amazon SES Email Templates
    // ========================================

    // Email template for review notifications
    this.emailTemplate = new ses.CfnTemplate(this, 'ReviewNotificationTemplate', {
      template: {
        templateName: `${this.stackName}-ReviewNotification`,
        subjectPart: 'Architecture Review: {{subject}}',
        htmlPart: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #232f3e; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f5f5f5; }
              .button { display: inline-block; padding: 12px 24px; background-color: #ff9900; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
              .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Architecture Review System</h1>
              </div>
              <div class="content">
                <h2>{{title}}</h2>
                <p>{{message}}</p>
                {{#if actionUrl}}
                <a href="{{actionUrl}}" class="button">{{actionText}}</a>
                {{/if}}
                <p><strong>Details:</strong></p>
                <ul>
                  {{#if documentTitle}}<li>Document: {{documentTitle}}</li>{{/if}}
                  {{#if reviewRequestId}}<li>Review Request ID: {{reviewRequestId}}</li>{{/if}}
                  {{#if submitter}}<li>Submitter: {{submitter}}</li>{{/if}}
                  {{#if reviewer}}<li>Reviewer: {{reviewer}}</li>{{/if}}
                </ul>
              </div>
              <div class="footer">
                <p>This is an automated message from the Architecture Review System.</p>
                <p>Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        textPart: `
{{title}}

{{message}}

{{#if actionUrl}}
{{actionText}}: {{actionUrl}}
{{/if}}

Details:
{{#if documentTitle}}- Document: {{documentTitle}}{{/if}}
{{#if reviewRequestId}}- Review Request ID: {{reviewRequestId}}{{/if}}
{{#if submitter}}- Submitter: {{submitter}}{{/if}}
{{#if reviewer}}- Reviewer: {{reviewer}}{{/if}}

---
This is an automated message from the Architecture Review System.
Please do not reply to this email.
        `,
      },
    });

    // ========================================
    // AWS Q Business
    // ========================================
    // Note: Q Business Application and Data Source must be created manually
    // or using AWS CLI/Console as CDK L2 constructs are not yet available.
    // 
    // Manual setup steps:
    // 1. Create Q Business Application in AWS Console
    // 2. Create S3 Data Source pointing to governancePoliciesBucket
    // 3. Configure IAM roles for Q Business to access S3
    // 4. Update environment variables with Application ID and Data Source ID
    //
    // Required IAM permissions for Lambda to use Q Business:
    // - qbusiness:Chat
    // - qbusiness:ChatSync
    // - qbusiness:ListConversations
    //
    // The governancePoliciesBucket is already created above and can be used
    // as the data source for Q Business.

    // ========================================
    // DynamoDB Tables
    // ========================================

    // ReviewRequests Table
    this.reviewRequestsTable = new dynamodb.Table(this, 'ReviewRequestsTable', {
      tableName: `${this.stackName}-ReviewRequests`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // GSI1: Query by submitter user
    this.reviewRequestsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Query by reviewer user
    this.reviewRequestsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Documents Table
    this.documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      tableName: `${this.stackName}-Documents`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // GSI: Query documents by reviewRequestId
    this.documentsTable.addGlobalSecondaryIndex({
      indexName: 'ReviewRequestIndex',
      partitionKey: {
        name: 'reviewRequestId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'versionNumber',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ReviewExecutions Table
    this.reviewExecutionsTable = new dynamodb.Table(this, 'ReviewExecutionsTable', {
      tableName: `${this.stackName}-ReviewExecutions`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // PillarConfigurations Table
    this.pillarConfigurationsTable = new dynamodb.Table(this, 'PillarConfigurationsTable', {
      tableName: `${this.stackName}-PillarConfigurations`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // GovernancePolicies Table
    this.governancePoliciesTable = new dynamodb.Table(this, 'GovernancePoliciesTable', {
      tableName: `${this.stackName}-GovernancePolicies`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // ========================================
    // Lambda Functions & API Gateway
    // ========================================

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Poppler Layer (공개 Layer 사용 - 빠른 구현)
    // 나중에 자체 빌드 Layer로 교체 가능
    const popplerLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'PopplerLayer',
      'arn:aws:lambda:us-east-1:764866452798:layer:poppler:2'
    );

    // Grant permissions to Lambda
    this.reviewRequestsTable.grantReadWriteData(lambdaRole);
    this.documentsTable.grantReadWriteData(lambdaRole);
    this.reviewExecutionsTable.grantReadWriteData(lambdaRole);
    this.pillarConfigurationsTable.grantReadWriteData(lambdaRole);
    this.governancePoliciesTable.grantReadWriteData(lambdaRole);
    this.documentsBucket.grantReadWrite(lambdaRole);
    this.reportsBucket.grantReadWrite(lambdaRole);
    this.governancePoliciesBucket.grantReadWrite(lambdaRole);
    this.iacTemplatesBucket.grantReadWrite(lambdaRole);

    // Grant Bedrock permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: ['*'],
      })
    );

    // Grant Textract permissions for PDF analysis
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['textract:AnalyzeDocument', 'textract:DetectDocumentText'],
        resources: ['*'],
      })
    );

    // Grant Q Business permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['qbusiness:Chat', 'qbusiness:ChatSync'],
        resources: ['*'],
      })
    );

    // Grant SES permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendTemplatedEmail'],
        resources: ['*'],
      })
    );

    // Environment variables for Lambda
    const lambdaEnvironment = {
      REVIEW_REQUESTS_TABLE: this.reviewRequestsTable.tableName,
      DOCUMENTS_TABLE: this.documentsTable.tableName,
      REVIEW_EXECUTIONS_TABLE: this.reviewExecutionsTable.tableName,
      PILLAR_CONFIGURATIONS_TABLE: this.pillarConfigurationsTable.tableName,
      GOVERNANCE_POLICIES_TABLE: this.governancePoliciesTable.tableName,
      DOCUMENTS_BUCKET: this.documentsBucket.bucketName,
      REPORTS_BUCKET: this.reportsBucket.bucketName,
      SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || 'noreply@example.com',
      SES_REPLY_TO_EMAIL: process.env.SES_REPLY_TO_EMAIL || 'support@example.com',
      COGNITO_USER_POOL_ID: this.userPool.userPoolId,
      COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
    };

    // Lambda function for review requests
    const reviewRequestFunction = new lambda.Function(this, 'ReviewRequestFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/review-request.createReviewRequestHandler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/lambda-code.zip')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Lambda function for review execution
    const reviewExecutionFunction = new lambda.Function(this, 'ReviewExecutionFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/review-execution-router.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/lambda-code.zip')),
      role: lambdaRole,
      environment: {
        ...lambdaEnvironment,
        PATH: '/opt/bin:/usr/local/bin:/usr/bin:/bin',
        LD_LIBRARY_PATH: '/opt/lib:/lib64:/usr/lib64',
      },
      layers: [popplerLayer],
      timeout: cdk.Duration.minutes(15),
      memorySize: 3008,
      ephemeralStorageSize: cdk.Size.gibibytes(2),
    });

    // Lambda function for pillar config
    const pillarConfigFunction = new lambda.Function(this, 'PillarConfigFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/pillar-config.getPillarsHandler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/lambda-code.zip')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Lambda function for S3 presigned URL generation
    const getUploadUrlFunction = new lambda.Function(this, 'GetUploadUrlFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/get-upload-url.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/lambda-code.zip')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
    });

    // Lambda function for upload confirmation
    const confirmUploadFunction = new lambda.Function(this, 'ConfirmUploadFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/confirm-upload.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/lambda-code.zip')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
    });

    // API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${this.stackName}-API`,
      description: 'Architecture Review System API',
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: true,
      },
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        // Disable logging to avoid CloudWatch Logs role requirement
        loggingLevel: apigateway.MethodLoggingLevel.OFF,
      },
      cloudWatchRole: false, // Disable CloudWatch role creation
    });

    // Cognito Authorizer
    this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [this.userPool],
      authorizerName: 'CognitoAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    // API Gateway Resources
    const reviewRequests = this.api.root.addResource('review-requests');
    
    reviewRequests.addMethod('POST', new apigateway.LambdaIntegration(reviewRequestFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    reviewRequests.addMethod('GET', new apigateway.LambdaIntegration(reviewRequestFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const reviewRequestById = reviewRequests.addResource('{reviewRequestId}');
    reviewRequestById.addMethod('GET', new apigateway.LambdaIntegration(reviewRequestFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const reviews = this.api.root.addResource('reviews');
    const reviewsExecute = reviews.addResource('execute');
    
    // Manually add OPTIONS method for CORS (no auth required)
    reviewsExecute.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      authorizationType: apigateway.AuthorizationType.NONE,
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
    });
    
    reviewsExecute.addMethod('POST', new apigateway.LambdaIntegration(reviewExecutionFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Add status endpoint - use /reviews/{executionId} directly for status (v2)
    const reviewById = reviews.addResource('{executionId}');
    
    // OPTIONS for CORS (v2)
    reviewById.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      authorizationType: apigateway.AuthorizationType.NONE,
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
    });
    
    // GET method for status
    reviewById.addMethod('GET', new apigateway.LambdaIntegration(reviewExecutionFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Add results endpoint
    const reviewResults = reviewById.addResource('results');
    reviewResults.addMethod('GET', new apigateway.LambdaIntegration(reviewExecutionFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Add download endpoint
    const reviewDownload = reviewById.addResource('download');
    
    // OPTIONS for CORS
    reviewDownload.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      authorizationType: apigateway.AuthorizationType.NONE,
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
    });
    
    // POST method for download
    reviewDownload.addMethod('POST', new apigateway.LambdaIntegration(reviewExecutionFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const agents = this.api.root.addResource('agents');
    const pillars = agents.addResource('pillars');
    
    pillars.addMethod('GET', new apigateway.LambdaIntegration(pillarConfigFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Document upload endpoints (S3 Presigned URL)
    const documents = this.api.root.addResource('documents');
    const getUploadUrl = documents.addResource('get-upload-url');
    const confirmUpload = documents.addResource('confirm-upload');
    
    getUploadUrl.addMethod('POST', new apigateway.LambdaIntegration(getUploadUrlFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    confirmUpload.addMethod('POST', new apigateway.LambdaIntegration(confirmUploadFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ========================================
    // MCP Lambda Function (AgentCore Gateway Target)
    // ========================================

    // MCP Lambda function for DynamoDB queries
    const mcpServerFunction = new lambda.Function(this, 'McpServerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/mcp-server/lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/lambda-code.zip')),
      role: lambdaRole,
      environment: {
        ...lambdaEnvironment,
        GOVERNANCE_POLICIES_BUCKET: this.governancePoliciesBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      description: 'MCP Server Lambda for Architecture Review DynamoDB queries (AgentCore Gateway Target)',
    });

    // MCP API Gateway endpoints (optional - for direct HTTP access)
    const mcp = this.api.root.addResource('mcp');
    const mcpV1 = mcp.addResource('v1');
    const mcpTools = mcpV1.addResource('tools');
    const mcpToolsList = mcpTools.addResource('list');
    const mcpToolsCall = mcpTools.addResource('call');
    const mcpHealth = mcp.addResource('health');

    // MCP tools/list endpoint
    mcpToolsList.addMethod('POST', new apigateway.LambdaIntegration(mcpServerFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // MCP tools/call endpoint
    mcpToolsCall.addMethod('POST', new apigateway.LambdaIntegration(mcpServerFunction), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // MCP health check endpoint (no auth)
    mcpHealth.addMethod('GET', new apigateway.LambdaIntegration(mcpServerFunction, {
      requestTemplates: {
        'application/json': JSON.stringify({ method: 'health' }),
      },
    }), {
      authorizationType: apigateway.AuthorizationType.NONE,
    });
    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
      description: 'Architecture Review System Stack Name',
    });

    // DynamoDB Table Outputs
    new cdk.CfnOutput(this, 'ReviewRequestsTableName', {
      value: this.reviewRequestsTable.tableName,
      description: 'ReviewRequests DynamoDB Table Name',
      exportName: `${this.stackName}-ReviewRequestsTable`,
    });

    new cdk.CfnOutput(this, 'DocumentsTableName', {
      value: this.documentsTable.tableName,
      description: 'Documents DynamoDB Table Name',
      exportName: `${this.stackName}-DocumentsTable`,
    });

    new cdk.CfnOutput(this, 'ReviewExecutionsTableName', {
      value: this.reviewExecutionsTable.tableName,
      description: 'ReviewExecutions DynamoDB Table Name',
      exportName: `${this.stackName}-ReviewExecutionsTable`,
    });

    new cdk.CfnOutput(this, 'PillarConfigurationsTableName', {
      value: this.pillarConfigurationsTable.tableName,
      description: 'PillarConfigurations DynamoDB Table Name',
      exportName: `${this.stackName}-PillarConfigurationsTable`,
    });

    new cdk.CfnOutput(this, 'GovernancePoliciesTableName', {
      value: this.governancePoliciesTable.tableName,
      description: 'GovernancePolicies DynamoDB Table Name',
      exportName: `${this.stackName}-GovernancePoliciesTable`,
    });

    // S3 Bucket Outputs
    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: this.documentsBucket.bucketName,
      description: 'Documents S3 Bucket Name',
      exportName: `${this.stackName}-DocumentsBucket`,
    });

    new cdk.CfnOutput(this, 'ReportsBucketName', {
      value: this.reportsBucket.bucketName,
      description: 'Reports S3 Bucket Name',
      exportName: `${this.stackName}-ReportsBucket`,
    });

    new cdk.CfnOutput(this, 'GovernancePoliciesBucketName', {
      value: this.governancePoliciesBucket.bucketName,
      description: 'Governance Policies S3 Bucket Name',
      exportName: `${this.stackName}-GovernancePoliciesBucket`,
    });

    new cdk.CfnOutput(this, 'IaCTemplatesBucketName', {
      value: this.iacTemplatesBucket.bucketName,
      description: 'IaC Templates S3 Bucket Name',
      exportName: `${this.stackName}-IaCTemplatesBucket`,
    });

    // Cognito Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${this.stackName}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${this.stackName}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'AGroupName', {
      value: this.aGroup.groupName!,
      description: 'A_Group (Submitters) Name',
    });

    new cdk.CfnOutput(this, 'BGroupName', {
      value: this.bGroup.groupName!,
      description: 'B_Group (Reviewers) Name',
    });

    // API Gateway Output
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `${this.stackName}-ApiUrl`,
    });

    // MCP Lambda Output (for AgentCore Gateway registration)
    new cdk.CfnOutput(this, 'McpServerFunctionArn', {
      value: mcpServerFunction.functionArn,
      description: 'MCP Server Lambda Function ARN (for AgentCore Gateway)',
      exportName: `${this.stackName}-McpServerFunctionArn`,
    });

    new cdk.CfnOutput(this, 'McpServerFunctionName', {
      value: mcpServerFunction.functionName,
      description: 'MCP Server Lambda Function Name',
      exportName: `${this.stackName}-McpServerFunctionName`,
    });

    new cdk.CfnOutput(this, 'McpApiEndpoint', {
      value: `${this.api.url}mcp/v1/tools`,
      description: 'MCP API Endpoint (HTTP access)',
      exportName: `${this.stackName}-McpApiEndpoint`,
    });
  }
}
