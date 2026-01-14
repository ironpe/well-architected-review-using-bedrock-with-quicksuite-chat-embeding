/**
 * Document Service - Handles document upload, retrieval, and version management
 * Requirements: 1.1, 1.5, 6.3, 8.1
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { environment } from '../config/environment.js';
import {
  Document,
  DocumentRecord,
  DocumentFormat,
  VersionInfo,
  NotFoundError,
} from '../types/index.js';
import { documentRecordToDomain } from '../utils/type-converters.js';
import {
  validateRequiredString,
  validateDocumentFormat,
  validateFileSize,
  validateFileExtension,
} from '../utils/validators.js';

export class DocumentService {
  private s3Client: S3Client;
  private dynamoClient: DynamoDBDocumentClient;
  private documentsBucket: string;
  private documentsTable: string;

  constructor() {
    this.s3Client = new S3Client({ region: environment.aws.region });
    const ddbClient = new DynamoDBClient({ region: environment.aws.region });
    this.dynamoClient = DynamoDBDocumentClient.from(ddbClient);
    this.documentsBucket = environment.s3.documentsBucket;
    this.documentsTable = environment.dynamodb.documentsTable;
  }

  /**
   * Upload a document to S3 and store metadata in DynamoDB
   * Requirements: 1.1, 1.5
   */
  async uploadDocument(
    file: Buffer,
    metadata: {
      title: string;
      description: string;
      format: DocumentFormat;
      reviewRequestId: string;
      uploadedBy: string;
      fileName: string;
    }
  ): Promise<{ documentId: string; uploadUrl: string }> {
    // Validate inputs
    validateRequiredString(metadata.title, 'title');
    validateRequiredString(metadata.description, 'description');
    validateRequiredString(metadata.reviewRequestId, 'reviewRequestId');
    validateRequiredString(metadata.uploadedBy, 'uploadedBy');
    validateDocumentFormat(metadata.format);
    validateFileSize(file.length);
    validateFileExtension(metadata.fileName, metadata.format);

    // Generate document ID and version
    const documentId = uuidv4();
    const versionNumber = 1;
    const checksum = createHash('sha256').update(file).digest('hex');
    const timestamp = new Date().toISOString();

    // Construct S3 key
    const s3Key = `documents/${metadata.reviewRequestId}/v${versionNumber}/${documentId}.${this.getFileExtension(metadata.format)}`;

    // Upload to S3
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.documentsBucket,
        Key: s3Key,
        Body: file,
        ContentType: this.getContentType(metadata.format),
        Metadata: {
          documentId,
          reviewRequestId: metadata.reviewRequestId,
          versionNumber: versionNumber.toString(),
          uploadedBy: metadata.uploadedBy,
        },
      })
    );

    // Store metadata in DynamoDB
    const documentRecord: DocumentRecord = {
      PK: `DOC#${documentId}`,
      SK: `VERSION#${versionNumber}`,
      documentId,
      reviewRequestId: metadata.reviewRequestId,
      versionNumber,
      s3Bucket: this.documentsBucket,
      s3Key,
      format: metadata.format,
      title: metadata.title,
      description: metadata.description,
      uploadedBy: metadata.uploadedBy,
      uploadedAt: timestamp,
      fileSize: file.length,
      checksum,
    };

    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.documentsTable,
        Item: documentRecord,
      })
    );

    // Generate presigned URL for download
    const uploadUrl = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.documentsBucket,
        Key: s3Key,
      }),
      { expiresIn: 3600 }
    );

    return { documentId, uploadUrl };
  }

  /**
   * Get document metadata and download URL
   * Requirements: 1.1
   */
  async getDocument(documentId: string, versionNumber: number = 1): Promise<Document> {
    validateRequiredString(documentId, 'documentId');

    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.documentsTable,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `DOC#${documentId}`,
          ':sk': `VERSION#${versionNumber}`,
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      throw new NotFoundError(`Document ${documentId} version ${versionNumber} not found`);
    }

    return documentRecordToDomain(result.Items[0] as DocumentRecord);
  }

  /**
   * Create a new version of an existing document
   * Requirements: 6.3, 6.4, 8.1
   */
  async createVersion(
    reviewRequestId: string,
    file: Buffer,
    metadata: {
      title: string;
      description: string;
      format: DocumentFormat;
      uploadedBy: string;
      fileName: string;
    }
  ): Promise<{ documentId: string; versionNumber: number }> {
    // Validate inputs
    validateRequiredString(reviewRequestId, 'reviewRequestId');
    validateRequiredString(metadata.title, 'title');
    validateRequiredString(metadata.uploadedBy, 'uploadedBy');
    validateDocumentFormat(metadata.format);
    validateFileSize(file.length);
    validateFileExtension(metadata.fileName, metadata.format);

    // Get existing versions to determine next version number
    const versions = await this.getVersions(reviewRequestId);
    const nextVersionNumber = versions.length > 0 
      ? Math.max(...versions.map(v => v.versionNumber)) + 1 
      : 1;

    // Generate new document ID
    const documentId = uuidv4();
    const checksum = createHash('sha256').update(file).digest('hex');
    const timestamp = new Date().toISOString();

    // Construct S3 key
    const s3Key = `documents/${reviewRequestId}/v${nextVersionNumber}/${documentId}.${this.getFileExtension(metadata.format)}`;

    // Upload to S3
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.documentsBucket,
        Key: s3Key,
        Body: file,
        ContentType: this.getContentType(metadata.format),
        Metadata: {
          documentId,
          reviewRequestId,
          versionNumber: nextVersionNumber.toString(),
          uploadedBy: metadata.uploadedBy,
        },
      })
    );

    // Store metadata in DynamoDB
    const documentRecord: DocumentRecord = {
      PK: `DOC#${documentId}`,
      SK: `VERSION#${nextVersionNumber}`,
      documentId,
      reviewRequestId,
      versionNumber: nextVersionNumber,
      s3Bucket: this.documentsBucket,
      s3Key,
      format: metadata.format,
      title: metadata.title,
      description: metadata.description,
      uploadedBy: metadata.uploadedBy,
      uploadedAt: timestamp,
      fileSize: file.length,
      checksum,
    };

    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.documentsTable,
        Item: documentRecord,
      })
    );

    return { documentId, versionNumber: nextVersionNumber };
  }

  /**
   * Get all versions for a review request
   * Requirements: 8.1, 8.2
   */
  async getVersions(reviewRequestId: string): Promise<VersionInfo[]> {
    validateRequiredString(reviewRequestId, 'reviewRequestId');

    // Query all documents for this review request
    // Note: This requires a GSI on reviewRequestId, or we scan
    // For simplicity, we'll use a scan with filter for now
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.documentsTable,
        IndexName: 'ReviewRequestIndex', // This GSI needs to be added to the table
        KeyConditionExpression: 'reviewRequestId = :reviewRequestId',
        ExpressionAttributeValues: {
          ':reviewRequestId': reviewRequestId,
        },
      })
    );

    if (!result.Items) {
      return [];
    }

    return result.Items.map((item) => {
      const doc = item as DocumentRecord;
      return {
        versionNumber: doc.versionNumber,
        documentId: doc.documentId,
        uploadedAt: doc.uploadedAt,
      };
    }).sort((a, b) => a.versionNumber - b.versionNumber);
  }

  /**
   * Generate a presigned URL for document download
   */
  async getDownloadUrl(documentId: string, versionNumber: number = 1): Promise<string> {
    const document = await this.getDocument(documentId, versionNumber);

    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: document.s3Bucket,
        Key: document.s3Key,
      }),
      { expiresIn: 3600 }
    );
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  private getFileExtension(format: DocumentFormat): string {
    const extensionMap: Record<DocumentFormat, string> = {
      pdf: 'pdf',
      png: 'png',
      jpg: 'jpg',
      jpeg: 'jpeg',
    };
    return extensionMap[format];
  }

  private getContentType(format: DocumentFormat): string {
    const contentTypeMap: Record<DocumentFormat, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
    };
    return contentTypeMap[format];
  }

  /**
   * Get presigned URL for document preview
   */
  async getDocumentPreviewUrl(documentId: string): Promise<string> {
    validateRequiredString(documentId, 'documentId');

    // Get document metadata
    const document = await this.getDocument(documentId);

    // Generate presigned URL (valid for 1 hour)
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    
    const command = new GetObjectCommand({
      Bucket: document.s3Bucket,
      Key: document.s3Key,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return url;
  }
}
