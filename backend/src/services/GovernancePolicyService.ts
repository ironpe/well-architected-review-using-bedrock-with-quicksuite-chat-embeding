/**
 * Governance Policy Service
 * Requirements: 2.1, 2.2
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { environment } from '../config/environment.js';
import {
  GovernancePolicy,
  GovernancePolicyRecord,
  NotFoundError,
} from '../types/index.js';
import { governancePolicyRecordToDomain } from '../utils/type-converters.js';
import { validateRequiredString } from '../utils/validators.js';

export class GovernancePolicyService {
  private s3Client: S3Client;
  private dynamoClient: DynamoDBDocumentClient;
  private governanceBucket: string;
  private governancePoliciesTable: string;

  constructor() {
    this.s3Client = new S3Client({ region: environment.aws.region });
    const ddbClient = new DynamoDBClient({ region: environment.aws.region });
    this.dynamoClient = DynamoDBDocumentClient.from(ddbClient);
    this.governanceBucket = environment.s3.documentsBucket; // Using documents bucket for now
    this.governancePoliciesTable = environment.dynamodb.governancePoliciesTable;
  }

  /**
   * Upload governance policy document
   * Requirements: 2.1
   */
  async uploadPolicy(
    file: Buffer,
    metadata: {
      title: string;
      description: string;
      uploadedBy: string;
      fileName: string;
    }
  ): Promise<string> {
    validateRequiredString(metadata.title, 'title');
    validateRequiredString(metadata.description, 'description');
    validateRequiredString(metadata.uploadedBy, 'uploadedBy');

    const policyId = uuidv4();
    const timestamp = new Date().toISOString();
    const s3Key = `governance-policies/${policyId}/${metadata.fileName}`;

    // Upload to S3
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.governanceBucket,
        Key: s3Key,
        Body: file,
        ContentType: 'application/pdf',
        Metadata: {
          policyId,
          uploadedBy: metadata.uploadedBy,
        },
      })
    );

    // Store metadata in DynamoDB
    const policyRecord: GovernancePolicyRecord = {
      PK: 'POLICIES',
      SK: `POLICY#${policyId}`,
      policyId,
      title: metadata.title,
      description: metadata.description,
      fileName: metadata.fileName,
      qBusinessDataSourceId: environment.qBusiness.dataSourceId,
      s3Bucket: this.governanceBucket,
      s3Key,
      uploadedBy: metadata.uploadedBy,
      uploadedAt: timestamp,
      isActive: true,
    };

    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.governancePoliciesTable,
        Item: policyRecord,
      })
    );

    return policyId;
  }

  /**
   * Get all governance policies (both active and inactive)
   * Requirements: 2.2
   */
  async getAllPolicies(): Promise<GovernancePolicy[]> {
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.governancePoliciesTable,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'POLICIES',
          ':sk': 'POLICY#',
        },
      })
    );

    if (!result.Items) {
      return [];
    }

    return result.Items
      .map(item => governancePolicyRecordToDomain(item as GovernancePolicyRecord));
  }

  /**
   * Get only active governance policies
   */
  async getActivePolicies(): Promise<GovernancePolicy[]> {
    const all = await this.getAllPolicies();
    return all.filter(p => p.isActive);
  }

  /**
   * Toggle policy active/inactive
   */
  async togglePolicyActive(policyId: string, isActive: boolean): Promise<void> {
    validateRequiredString(policyId, 'policyId');

    await this.dynamoClient.send(
      new UpdateCommand({
        TableName: this.governancePoliciesTable,
        Key: {
          PK: 'POLICIES',
          SK: `POLICY#${policyId}`,
        },
        UpdateExpression: 'SET isActive = :isActive',
        ExpressionAttributeValues: {
          ':isActive': isActive,
        },
        ConditionExpression: 'attribute_exists(PK)',
      })
    );
  }

  /**
   * Get policy content from S3 (text extraction)
   */
  async getPolicyContent(policyId: string): Promise<string> {
    validateRequiredString(policyId, 'policyId');

    // Get policy metadata
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.governancePoliciesTable,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'POLICIES',
          ':sk': `POLICY#${policyId}`,
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      throw new NotFoundError(`Policy ${policyId} not found`);
    }

    const policy = result.Items[0] as GovernancePolicyRecord;

    // Download from S3
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: policy.s3Bucket,
        Key: policy.s3Key,
      })
    );

    if (!response.Body) {
      throw new Error('Empty policy document body from S3');
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // For PDF files, return base64 (will be processed by Bedrock)
    // For text files, return as string
    if (policy.fileName.endsWith('.pdf')) {
      return `[PDF Document: ${policy.title}]\nFile: ${policy.fileName}\nSize: ${(buffer.length / 1024).toFixed(1)} KB\nBase64 content available for AI analysis.`;
    }

    return buffer.toString('utf-8');
  }

  /**
   * Get policy S3 buffer for Bedrock analysis
   */
  async getPolicyBuffer(policyId: string): Promise<{ buffer: Buffer; policy: GovernancePolicy }> {
    validateRequiredString(policyId, 'policyId');

    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.governancePoliciesTable,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'POLICIES',
          ':sk': `POLICY#${policyId}`,
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      throw new NotFoundError(`Policy ${policyId} not found`);
    }

    const record = result.Items[0] as GovernancePolicyRecord;
    const policy = governancePolicyRecordToDomain(record);

    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: record.s3Bucket,
        Key: record.s3Key,
      })
    );

    if (!response.Body) {
      throw new Error('Empty policy document body from S3');
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return { buffer: Buffer.concat(chunks), policy };
  }

  /**
   * Delete governance policy
   * Requirements: 2.2
   */
  async deletePolicy(policyId: string): Promise<void> {
    validateRequiredString(policyId, 'policyId');

    // Get policy to find S3 key
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.governancePoliciesTable,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'POLICIES',
          ':sk': `POLICY#${policyId}`,
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      throw new NotFoundError(`Policy ${policyId} not found`);
    }

    const policy = result.Items[0] as GovernancePolicyRecord;

    // Delete from S3
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: policy.s3Bucket,
        Key: policy.s3Key,
      })
    );

    // Delete from DynamoDB
    await this.dynamoClient.send(
      new DeleteCommand({
        TableName: this.governancePoliciesTable,
        Key: {
          PK: 'POLICIES',
          SK: `POLICY#${policyId}`,
        },
      })
    );
  }
}
