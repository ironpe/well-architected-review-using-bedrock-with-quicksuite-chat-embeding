import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class MinimalArchitectureReviewStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // S3 Buckets
    // ========================================

    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          exposedHeaders: [
            'ETag',
            'x-amz-server-side-encryption',
            'x-amz-request-id',
            'x-amz-id-2',
          ],
          maxAge: 3000,
        },
      ],
    });

    const reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // ========================================
    // DynamoDB Tables
    // ========================================

    const reviewRequestsTable = new dynamodb.Table(this, 'ReviewRequestsTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    reviewRequestsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    const documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    documentsTable.addGlobalSecondaryIndex({
      indexName: 'ReviewRequestIndex',
      partitionKey: { name: 'reviewRequestId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'versionNumber', type: dynamodb.AttributeType.NUMBER },
    });

    const pillarConfigurationsTable = new dynamodb.Table(this, 'PillarConfigurationsTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const reviewExecutionsTable = new dynamodb.Table(this, 'ReviewExecutionsTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const governancePoliciesTable = new dynamodb.Table(this, 'GovernancePoliciesTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // Cognito
    // ========================================

    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('Client', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    new cognito.CfnUserPoolGroup(this, 'AGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Requester_Group',
      description: 'Submitters',
    });

    new cognito.CfnUserPoolGroup(this, 'BGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Reviewer_Group',
      description: 'Reviewers',
    });

    // ========================================
    // Lambda & API Gateway
    // ========================================

    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Add Bedrock permissions for AI agent execution
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeAgent',
        'bedrock:InvokeModel',
      ],
      resources: ['*'],
    }));

    // Add Lambda invoke permissions (for PDF converter and worker)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [
        `arn:aws:lambda:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:function:*PdfConverterFn*`,
        `arn:aws:lambda:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:function:*ReviewExecutionWorkerFn*`,
      ],
    }));

    // Add QuickSight permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'quicksight:GenerateEmbedUrlForRegisteredUser',
        'quicksight:RegisterUser',
        'quicksight:DescribeUser',
      ],
      resources: ['*'],
    }));

    reviewRequestsTable.grantReadWriteData(lambdaRole);
    documentsTable.grantReadWriteData(lambdaRole);
    pillarConfigurationsTable.grantReadWriteData(lambdaRole);
    reviewExecutionsTable.grantReadWriteData(lambdaRole);
    governancePoliciesTable.grantReadWriteData(lambdaRole);
    documentsBucket.grantReadWrite(lambdaRole);
    reportsBucket.grantReadWrite(lambdaRole);

    const lambdaEnv = {
      REVIEW_REQUESTS_TABLE: reviewRequestsTable.tableName,
      DOCUMENTS_TABLE: documentsTable.tableName,
      PILLAR_CONFIGURATIONS_TABLE: pillarConfigurationsTable.tableName,
      REVIEW_EXECUTIONS_TABLE: reviewExecutionsTable.tableName,
      GOVERNANCE_POLICIES_TABLE: governancePoliciesTable.tableName,
      DOCUMENTS_BUCKET: documentsBucket.bucketName,
      REPORTS_BUCKET: reportsBucket.bucketName,
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
      // Performance optimization flags (set to 'true' to rollback)
      INCLUDE_PILLAR_IMAGES: 'false',  // Pillar 분석에 이미지 포함 여부
      GENERATE_EXECUTIVE_SUMMARY_SYNC: 'true',  // Executive Summary 동기 생성 (종합 요약 탭용)
      // QuickSight configuration (optional)
      QUICKSIGHT_ACCOUNT_ID: cdk.Aws.ACCOUNT_ID,
      QUICKSIGHT_NAMESPACE: 'default',
      QUICKSIGHT_AGENT_ID: 'bea6272a-c328-466a-89d5-e2368460f32d',  // QuickSight Chat Agent ID (README의 QuickSuite MCP 연동 후 설정)
      QUICKSIGHT_USER_NAME: 'admin/ironpe-Isengard',  // QuickSight 사용자 이름 (README의 QuickSuite MCP 연동 후 설정)
    };

    // Lambda Layer with dependencies
    const dependenciesLayer = new lambda.LayerVersion(this, 'DependenciesLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/lambda-layer/lambda-layer.zip')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Node modules for Architecture Review System',
    });

    const reviewRequestFn = new lambda.Function(this, 'ReviewRequestFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/review-request-router.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['node_modules', 'lambda-layer', 'src', '*.test.ts', 'test-results', 'uploads'],
      }),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      layers: [dependenciesLayer],
    });

    const listReviewRequestsFn = new lambda.Function(this, 'ListReviewRequestsFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/review-request-router.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['node_modules', 'lambda-layer', 'src', '*.test.ts', 'test-results', 'uploads'],
      }),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      layers: [dependenciesLayer],
    });

    // Document upload function (simplified - just creates review request)
    const uploadDocumentFn = new lambda.Function(this, 'UploadDocumentFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/review-request.createReviewRequestHandler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['node_modules', 'lambda-layer', 'src', '*.test.ts', 'test-results', 'uploads'],
      }),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      layers: [dependenciesLayer],
    });

    // S3 Presigned URL functions
    const getUploadUrlFn = new lambda.Function(this, 'GetUploadUrlFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/get-upload-url.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['node_modules', 'lambda-layer', 'src', '*.test.ts', 'test-results', 'uploads'],
      }),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      layers: [dependenciesLayer],
    });

    const confirmUploadFn = new lambda.Function(this, 'ConfirmUploadFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/confirm-upload.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['node_modules', 'lambda-layer', 'src', '*.test.ts', 'test-results', 'uploads'],
      }),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      layers: [dependenciesLayer],
    });

    // Pillar configuration function
    const pillarConfigFn = new lambda.Function(this, 'PillarConfigFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/pillar-config-router.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['node_modules', 'lambda-layer', 'src', '*.test.ts', 'test-results', 'uploads'],
      }),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      layers: [dependenciesLayer],
    });

    // Review execution worker function (long-running)
    const reviewExecutionWorkerFn = new lambda.Function(this, 'ReviewExecutionWorkerFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/review-execution-worker.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['node_modules', 'lambda-layer', 'src', '*.test.ts', 'test-results', 'uploads'],
      }),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.minutes(15),
      memorySize: 3008,
      ephemeralStorageSize: cdk.Size.gibibytes(2),
      layers: [dependenciesLayer],
    });

    // Review execution function
    const reviewExecutionFn = new lambda.Function(this, 'ReviewExecutionFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/review-execution-router.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['node_modules', 'lambda-layer', 'src', '*.test.ts', 'test-results', 'uploads'],
      }),
      role: lambdaRole,
      environment: {
        ...lambdaEnv,
        REVIEW_WORKER_FUNCTION_NAME: reviewExecutionWorkerFn.functionName,
      },
      timeout: cdk.Duration.seconds(30), // Short timeout for API responses
      memorySize: 512,
      layers: [dependenciesLayer],
    });

    // PDF to Image Converter (Python Lambda)
    const pdfConverterFn = new lambda.Function(this, 'PdfConverterFn', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/pdf-converter')),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Add PDF_CONVERTER_FUNCTION_NAME to Worker environment
    reviewExecutionWorkerFn.addEnvironment('PDF_CONVERTER_FUNCTION_NAME', pdfConverterFn.functionName);

    // QuickSight embed function
    const quicksightEmbedFn = new lambda.Function(this, 'QuickSightEmbedFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/quicksight-router.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['node_modules', 'lambda-layer', 'src', '*.test.ts', 'test-results', 'uploads'],
      }),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      layers: [dependenciesLayer],
    });

    // Governance policy function
    const governancePolicyFn = new lambda.Function(this, 'GovernancePolicyFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/governance-policy.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['node_modules', 'lambda-layer', 'src', '*.test.ts', 'test-results', 'uploads'],
      }),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      layers: [dependenciesLayer],
    });

    // Document preview function
    const documentPreviewFn = new lambda.Function(this, 'DocumentPreviewFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/handlers/document-preview.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['node_modules', 'lambda-layer', 'src', '*.test.ts', 'test-results', 'uploads'],
      }),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      layers: [dependenciesLayer],
    });

    // MCP Server function for QuickSuite Chat Agent
    const mcpServerFn = new lambda.Function(this, 'McpServerFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/mcp-server/lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/lambda-code.zip')),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      // Layer 없이 배포 (코드에 모든 의존성 포함)
    });

    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'ArchReviewAPI',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      cloudWatchRole: false,
      deployOptions: {
        stageName: 'prod',
      },
    });

    // Add CORS headers to Gateway Responses for 4xx and 5xx errors
    api.addGatewayResponse('Unauthorized', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    api.addGatewayResponse('AccessDenied', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      statusCode: '403',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    api.addGatewayResponse('Default4XX', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    api.addGatewayResponse('Default5XX', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
    });

    const reviewRequests = api.root.addResource('review-requests');
    reviewRequests.addMethod('POST', new apigateway.LambdaIntegration(reviewRequestFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    reviewRequests.addMethod('GET', new apigateway.LambdaIntegration(listReviewRequestsFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Review request by ID with status update
    const reviewRequestById = reviewRequests.addResource('{reviewRequestId}');
    reviewRequestById.addMethod('GET', new apigateway.LambdaIntegration(reviewRequestFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    reviewRequestById.addMethod('DELETE', new apigateway.LambdaIntegration(reviewRequestFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    const reviewRequestStatus = reviewRequestById.addResource('status');
    reviewRequestStatus.addMethod('PATCH', new apigateway.LambdaIntegration(reviewRequestFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Documents endpoint
    const documents = api.root.addResource('documents', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    
    const upload = documents.addResource('upload');
    upload.addMethod('POST', new apigateway.LambdaIntegration(uploadDocumentFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // S3 Presigned URL endpoints
    const getUploadUrl = documents.addResource('get-upload-url', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    getUploadUrl.addMethod('POST', new apigateway.LambdaIntegration(getUploadUrlFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const confirmUpload = documents.addResource('confirm-upload', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    confirmUpload.addMethod('POST', new apigateway.LambdaIntegration(confirmUploadFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Document preview endpoint
    const documentById = documents.addResource('{documentId}');
    const documentPreview = documentById.addResource('preview', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    
    documentPreview.addMethod('GET', new apigateway.LambdaIntegration(documentPreviewFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Agents/Pillars endpoint
    const agents = api.root.addResource('agents', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    const pillars = agents.addResource('pillars', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    pillars.addMethod('GET', new apigateway.LambdaIntegration(pillarConfigFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Individual pillar endpoint for updates
    const pillarByName = pillars.addResource('{pillarName}', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['PUT', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    pillarByName.addMethod('PUT', new apigateway.LambdaIntegration(pillarConfigFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Nova Vision endpoint
    const novaVision = agents.addResource('nova-vision', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'PUT', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    
    novaVision.addMethod('GET', new apigateway.LambdaIntegration(pillarConfigFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    novaVision.addMethod('PUT', new apigateway.LambdaIntegration(pillarConfigFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Reviews endpoint
    const reviews = api.root.addResource('reviews', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    
    const reviewsExecute = reviews.addResource('execute', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    reviewsExecute.addMethod('POST', new apigateway.LambdaIntegration(reviewExecutionFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /reviews/request/{reviewRequestId}/executions
    const reviewsRequest = reviews.addResource('request');
    const reviewRequestByIdForExecutions = reviewsRequest.addResource('{reviewRequestId}');
    const executions = reviewRequestByIdForExecutions.addResource('executions');
    executions.addMethod('GET', new apigateway.LambdaIntegration(reviewExecutionFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Review by ID endpoint
    const reviewById = reviews.addResource('{executionId}');
    
    // GET /reviews/{executionId} - Get review status
    reviewById.addMethod('GET', new apigateway.LambdaIntegration(reviewExecutionFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Review results endpoint
    const reviewResults = reviewById.addResource('results', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    reviewResults.addMethod('GET', new apigateway.LambdaIntegration(reviewExecutionFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Download endpoint
    const reviewDownload = reviewById.addResource('download', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    reviewDownload.addMethod('POST', new apigateway.LambdaIntegration(reviewExecutionFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Governance policies endpoint
    const governance = api.root.addResource('governance', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    
    const policies = governance.addResource('policies', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    
    policies.addMethod('GET', new apigateway.LambdaIntegration(governancePolicyFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    const policiesUpload = policies.addResource('upload', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    
    policiesUpload.addMethod('POST', new apigateway.LambdaIntegration(governancePolicyFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    const policyById = policies.addResource('{policyId}', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });
    
    policyById.addMethod('DELETE', new apigateway.LambdaIntegration(governancePolicyFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // QuickSight endpoint
    const quicksight = api.root.addResource('quicksight', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });

    const embedUrl = quicksight.addResource('embed-url');
    embedUrl.addMethod('GET', new apigateway.LambdaIntegration(quicksightEmbedFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ========================================
    // Outputs
    // ========================================

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'UserPoolIdOutput', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientIdOutput', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito Client ID',
    });

    new cdk.CfnOutput(this, 'DocumentsBucketOutput', {
      value: documentsBucket.bucketName,
      description: 'Documents Bucket Name',
    });

    new cdk.CfnOutput(this, 'ReportsBucketOutput', {
      value: reportsBucket.bucketName,
      description: 'Reports Bucket Name',
    });

    new cdk.CfnOutput(this, 'McpServerFunctionArn', {
      value: mcpServerFn.functionArn,
      description: 'MCP Server Lambda Function ARN',
    });
  }
}
