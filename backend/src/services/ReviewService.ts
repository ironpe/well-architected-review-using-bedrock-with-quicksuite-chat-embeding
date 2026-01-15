/**
 * Review Service - Handles review request creation and management
 * Requirements: 1.2, 1.4, 7.1, 7.2, 7.3, 7.4, 7.5, 8.2
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { environment } from '../config/environment.js';
import { NotificationService } from './NotificationService.js';
import {
  ReviewRequest,
  ReviewRequestRecord,
  ReviewStatus,
  NotFoundError,
  ValidationError,
} from '../types/index.js';
import { reviewRequestRecordToDomain } from '../utils/type-converters.js';
import {
  validateRequiredString,
  validateEmail,
  validateReviewStatus,
  validateStatusTransition,
} from '../utils/validators.js';

export class ReviewService {
  private dynamoClient: DynamoDBDocumentClient;
  private reviewRequestsTable: string;
  private notificationService: NotificationService;

  constructor() {
    const ddbClient = new DynamoDBClient({ region: environment.aws.region });
    this.dynamoClient = DynamoDBDocumentClient.from(ddbClient);
    this.reviewRequestsTable = environment.dynamodb.reviewRequestsTable;
    this.notificationService = new NotificationService();
  }

  /**
   * Create a new review request
   * Requirements: 1.2, 1.4, 7.2
   */
  async createReviewRequest(params: {
    documentId: string;
    submitterEmail: string;
    submitterUserId: string;
    reviewerEmail: string;
    documentTitle?: string;
  }): Promise<string> {
    // Validate inputs
    validateRequiredString(params.documentId, 'documentId');
    validateRequiredString(params.submitterUserId, 'submitterUserId');
    
    if (!validateEmail(params.submitterEmail)) {
      throw new ValidationError('Invalid submitter email format');
    }
    if (!validateEmail(params.reviewerEmail)) {
      throw new ValidationError('Invalid reviewer email format');
    }

    // Generate review request ID
    const reviewRequestId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create review request record
    const reviewRequest: ReviewRequestRecord = {
      PK: `REQ#${reviewRequestId}`,
      SK: 'METADATA',
      reviewRequestId,
      documentId: params.documentId,
      documentTitle: params.documentTitle || params.documentId, // Store document title
      submitterEmail: params.submitterEmail,
      submitterUserId: params.submitterUserId,
      reviewerEmail: params.reviewerEmail,
      status: 'Pending Review', // Initial status - 검토 대기 중
      currentVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      GSI1PK: `USER#${params.submitterUserId}`,
      GSI1SK: `REQ#${timestamp}`,
      GSI2PK: '', // Will be set when reviewer accepts
      GSI2SK: `REQ#${timestamp}`,
    };

    // Store in DynamoDB
    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.reviewRequestsTable,
        Item: reviewRequest,
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );

    // Send notification email
    // Requirements: 1.3
    await this.notificationService.sendReviewRequestEmail(
      params.reviewerEmail,
      reviewRequestId,
      params.documentTitle || 'Architecture Document',
      params.submitterEmail
    );

    return reviewRequestId;
  }

  /**
   * Get review request by ID
   * Requirements: 7.1, 8.2
   */
  async getReviewRequest(reviewRequestId: string): Promise<ReviewRequest> {
    validateRequiredString(reviewRequestId, 'reviewRequestId');

    const result = await this.dynamoClient.send(
      new GetCommand({
        TableName: this.reviewRequestsTable,
        Key: {
          PK: `REQ#${reviewRequestId}`,
          SK: 'METADATA',
        },
      })
    );

    if (!result.Item) {
      throw new NotFoundError(`Review request ${reviewRequestId} not found`);
    }

    return reviewRequestRecordToDomain(result.Item as ReviewRequestRecord);
  }

  /**
   * Update review request status
   * Requirements: 7.2, 7.3, 7.4, 7.5
   */
  async updateStatus(
    reviewRequestId: string,
    newStatus: ReviewStatus,
    comment?: string
  ): Promise<void> {
    validateRequiredString(reviewRequestId, 'reviewRequestId');
    validateReviewStatus(newStatus);

    // Get current review request
    const currentRequest = await this.getReviewRequest(reviewRequestId);

    // Validate status transition
    validateStatusTransition(currentRequest.status, newStatus);

    const timestamp = new Date().toISOString();

    // Build update expression
    let updateExpression = 'SET #status = :status, updatedAt = :updatedAt';
    const expressionAttributeValues: any = {
      ':status': newStatus,
      ':updatedAt': timestamp,
    };

    // Add rejection reason if status is Rejected
    if (newStatus === 'Rejected' && comment) {
      updateExpression += ', rejectionReason = :rejectionReason';
      expressionAttributeValues[':rejectionReason'] = comment;
    }

    // Update status
    await this.dynamoClient.send(
      new UpdateCommand({
        TableName: this.reviewRequestsTable,
        Key: {
          PK: `REQ#${reviewRequestId}`,
          SK: 'METADATA',
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    // If comment provided, store it (implementation can be extended)
    if (comment && newStatus !== 'Rejected') {
      // Store comment in a separate item or attribute
      // For now, we'll just log it
      console.log(`Status update comment for ${reviewRequestId}: ${comment}`);
    }
  }

  /**
   * Get review requests by submitter
   * Requirements: 7.1
   */
  async getReviewRequestsBySubmitter(submitterUserId: string): Promise<ReviewRequest[]> {
    validateRequiredString(submitterUserId, 'submitterUserId');

    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.reviewRequestsTable,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': `USER#${submitterUserId}`,
        },
        ScanIndexForward: false, // Most recent first
      })
    );

    if (!result.Items) {
      return [];
    }

    return result.Items.map(item => reviewRequestRecordToDomain(item as ReviewRequestRecord));
  }

  /**
   * Get review requests by reviewer
   * Requirements: 7.1
   */
  async getReviewRequestsByReviewer(reviewerUserId: string): Promise<ReviewRequest[]> {
    validateRequiredString(reviewerUserId, 'reviewerUserId');

    // Use scan to get all review requests (not efficient but works for minimal stack)
    // In production, use GSI2 with reviewerUserId
    const result = await this.dynamoClient.send(
      new ScanCommand({
        TableName: this.reviewRequestsTable,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: {
          ':sk': 'METADATA',
        },
      })
    );

    if (!result.Items) {
      return [];
    }

    return result.Items
      .map(item => reviewRequestRecordToDomain(item as ReviewRequestRecord))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Update current version number
   * Requirements: 6.3, 6.4
   */
  async updateCurrentVersion(reviewRequestId: string, versionNumber: number): Promise<void> {
    validateRequiredString(reviewRequestId, 'reviewRequestId');

    const timestamp = new Date().toISOString();

    await this.dynamoClient.send(
      new UpdateCommand({
        TableName: this.reviewRequestsTable,
        Key: {
          PK: `REQ#${reviewRequestId}`,
          SK: 'METADATA',
        },
        UpdateExpression: 'SET currentVersion = :version, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':version': versionNumber,
          ':updatedAt': timestamp,
        },
      })
    );
  }

  /**
   * Delete review request and associated documents
   */
  async deleteReviewRequest(reviewRequestId: string): Promise<void> {
    validateRequiredString(reviewRequestId, 'reviewRequestId');

    // Check if review request exists
    const reviewRequest = await this.getReviewRequest(reviewRequestId);
    
    // Only allow deletion if status is Pending Review
    if (reviewRequest.status !== 'Pending Review') {
      throw new ValidationError('Cannot delete review request. Only requests with "Pending Review" status can be deleted.');
    }

    // Import S3 client for file deletion
    const { S3Client, DeleteObjectCommand, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    
    const s3Client = new S3Client({ region: environment.aws.region });
    const documentsBucket = environment.s3.documentsBucket;

    // 1. Delete S3 files (all versions under this review request)
    try {
      const s3Prefix = `documents/${reviewRequestId}/`;
      
      // List all objects with this prefix
      const listResult = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: documentsBucket,
          Prefix: s3Prefix,
        })
      );

      // Delete each object
      if (listResult.Contents && listResult.Contents.length > 0) {
        for (const obj of listResult.Contents) {
          if (obj.Key) {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: documentsBucket,
                Key: obj.Key,
              })
            );
            console.log(`Deleted S3 object: ${obj.Key}`);
          }
        }
      }
    } catch (error) {
      console.error('Error deleting S3 files:', error);
      // Continue with DynamoDB deletion even if S3 fails
    }

    // 2. Delete document records from DynamoDB
    try {
      // Query documents table for this review request
      const documentsTable = environment.dynamodb.documentsTable;
      const docResult = await this.dynamoClient.send(
        new QueryCommand({
          TableName: documentsTable,
          IndexName: 'ReviewRequestIndex',
          KeyConditionExpression: 'reviewRequestId = :reviewRequestId',
          ExpressionAttributeValues: {
            ':reviewRequestId': reviewRequestId,
          },
        })
      );

      // Delete each document record
      if (docResult.Items && docResult.Items.length > 0) {
        for (const doc of docResult.Items) {
          await this.dynamoClient.send(
            new DeleteCommand({
              TableName: documentsTable,
              Key: {
                PK: doc.PK,
                SK: doc.SK,
              },
            })
          );
          console.log(`Deleted document record: ${doc.documentId}`);
        }
      }
    } catch (error) {
      console.error('Error deleting document records:', error);
      // Continue with review request deletion
    }

    // 3. Delete review request from DynamoDB
    await this.dynamoClient.send(
      new DeleteCommand({
        TableName: this.reviewRequestsTable,
        Key: {
          PK: `REQ#${reviewRequestId}`,
          SK: 'METADATA',
        },
      })
    );

    console.log(`Deleted review request: ${reviewRequestId}`);
  }
}
