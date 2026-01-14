/**
 * Governance Policy Service
 * Requirements: 2.1, 2.2
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
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
   * Get all active governance policies
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
      .filter(item => (item as GovernancePolicyRecord).isActive)
      .map(item => governancePolicyRecordToDomain(item as GovernancePolicyRecord));
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
