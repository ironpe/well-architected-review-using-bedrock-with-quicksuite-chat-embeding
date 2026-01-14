/**
 * Confirm document upload and create document record
 * Called after successful S3 upload
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE || 'ArchitectureReview-Documents';
const BUCKET_NAME = process.env.DOCUMENTS_BUCKET || 'architecture-review-documents';

interface ConfirmUploadRequest {
  documentId: string;
  s3Key: string;
  metadata: {
    title: string;
    description: string;
    format: string;
    submitterUserId: string;
  };
}

// Allowed and rejected file formats
const ALLOWED_FORMATS = ['pdf', 'png', 'jpg', 'jpeg'];
const REJECTED_FORMATS = ['ppt', 'pptx', 'doc', 'docx'];

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Confirm Upload Request:', JSON.stringify(event, null, 2));

  // CORS headers
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };

  try {
    const body: ConfirmUploadRequest = JSON.parse(event.body || '{}');
    const { documentId, s3Key, metadata } = body;

    if (!documentId || !s3Key) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'documentId and s3Key are required' }),
      };
    }

    // Validate file format
    const format = metadata.format.toLowerCase();
    
    // Reject PPT files
    if (REJECTED_FORMATS.includes(format)) {
      console.log(`Rejected file format: ${format}`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'PPT 파일은 지원하지 않습니다. PDF 또는 이미지 파일(PNG, JPG)로 변환하여 업로드해주세요.',
          supportedFormats: ALLOWED_FORMATS,
          rejectedFormat: format,
        }),
      };
    }
    
    // Check allowed formats
    if (!ALLOWED_FORMATS.includes(format)) {
      console.log(`Unsupported file format: ${format}`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: '지원하지 않는 파일 형식입니다. PDF 또는 이미지 파일(PNG, JPG)만 업로드 가능합니다.',
          supportedFormats: ALLOWED_FORMATS,
        }),
      };
    }

    // Verify file exists in S3
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const s3Object = await s3Client.send(headCommand);
    const fileSize = s3Object.ContentLength || 0;
    const uploadedAt = s3Object.LastModified?.toISOString() || new Date().toISOString();

    // Create document record with proper DynamoDB keys
    const document: any = {
      PK: `DOC#${documentId}`,
      SK: `VERSION#${1}`,
      documentId,
      versionNumber: 1,
      s3Bucket: BUCKET_NAME,
      s3Key,
      format: metadata.format,
      title: metadata.title,
      description: metadata.description,
      uploadedBy: metadata.submitterUserId,
      uploadedAt,
      fileSize,
      checksum: s3Object.ETag?.replace(/"/g, '') || '',
      status: 'uploaded',
    };

    // Don't include reviewRequestId if empty (GSI doesn't allow empty strings)
    // It will be added when review request is created

    await docClient.send(
      new PutCommand({
        TableName: DOCUMENTS_TABLE,
        Item: document,
      })
    );

    console.log('Document record created:', documentId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        documentId,
        message: 'Upload confirmed successfully',
        document,
      }),
    };
  } catch (error: any) {
    console.error('Error confirming upload:', error);
    
    // Handle S3 object not found
    if (error.name === 'NotFound') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'File not found in S3. Upload may have failed.' }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to confirm upload' }),
    };
  }
}
