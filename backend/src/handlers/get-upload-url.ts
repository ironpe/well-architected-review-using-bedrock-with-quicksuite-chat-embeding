/**
 * Generate S3 Presigned URL for direct upload
 * Solves API Gateway 10MB payload limit
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.DOCUMENTS_BUCKET || 'architecture-review-documents';

interface GetUploadUrlRequest {
  fileName: string;
  fileSize: number;
  contentType: string;
  metadata: {
    title: string;
    description: string;
    format: string;
    submitterUserId: string;
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Get Upload URL Request:', JSON.stringify(event, null, 2));

  // CORS headers
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };

  try {
    // Parse request body
    const body: GetUploadUrlRequest = JSON.parse(event.body || '{}');
    const { fileName, fileSize, contentType, metadata } = body;

    // Validate
    if (!fileName || !fileSize || !contentType) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'fileName, fileSize, contentType are required' }),
      };
    }

    // File size limit: 100MB
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }),
      };
    }

    // Generate unique document ID and S3 key
    const documentId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = fileName.split('.').pop();
    const s3Key = `uploads/${metadata.submitterUserId}/${timestamp}-${documentId}.${fileExtension}`;

    // Generate presigned URL (valid for 15 minutes)
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
      Metadata: {
        documentId,
        title: metadata.title,
        description: metadata.description,
        format: metadata.format,
        submitterUserId: metadata.submitterUserId,
        originalFileName: fileName,
      },
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes

    console.log('Generated presigned URL:', { documentId, s3Key });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        uploadUrl,
        documentId,
        s3Key,
        expiresIn: 900,
      }),
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to generate upload URL' }),
    };
  }
}
