/**
 * Local Express Server for Development
 * Runs AI Agents locally without Lambda
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { AgentOrchestrationService } from './services/AgentOrchestrationService.js';
import { PillarConfigurationService } from './services/PillarConfigurationService.js';
import { ReportGenerationService } from './services/ReportGenerationService.js';
import { Document, ReviewReport } from './types/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const BUCKET_NAME = 'local-dev-bucket';

app.use(cors());
app.use(express.json());

const agentService = new AgentOrchestrationService();
const pillarService = new PillarConfigurationService();
const reportService = new ReportGenerationService();

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        group: string;
      };
    }
  }
}

// Mock auth middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.user = {
    userId: 'local-user',
    email: 'local@example.com',
    group: 'B_Group',
  };
  next();
});

// POST /documents/get-upload-url - Get S3 presigned URL
app.post('/documents/get-upload-url', async (req, res) => {
  try {
    const { fileName, fileSize, contentType, metadata } = req.body;

    // Validate
    if (!fileName || !fileSize || !contentType) {
      return res.status(400).json({ error: 'fileName, fileSize, contentType are required' });
    }

    // File size limit: 100MB
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` 
      });
    }

    // Generate unique document ID and S3 key
    const documentId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = fileName.split('.').pop();
    const s3Key = `uploads/${metadata.submitterUserId}/${timestamp}-${documentId}.${fileExtension}`;

    console.log(`\n📤 Upload URL 생성:`);
    console.log(`  Document ID: ${documentId}`);
    console.log(`  File: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  S3 Key: ${s3Key}\n`);

    // For local development, create mock presigned URL
    // In production, this would use real S3
    const uploadUrl = `http://localhost:3001/mock-s3-upload/${documentId}`;

    return res.json({
      uploadUrl,
      documentId,
      s3Key,
      expiresIn: 900,
    });
  } catch (error: any) {
    console.error('Error generating upload URL:', error);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// PUT /mock-s3-upload/:documentId - Mock S3 upload endpoint
app.put('/mock-s3-upload/:documentId', (req, res) => {
  const { documentId } = req.params;
  
  // In local dev, save file to uploads directory
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Handle raw body upload (like real S3)
  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const destPath = path.join(uploadDir, `${documentId}.file`);
      fs.writeFileSync(destPath, buffer);
      console.log(`✅ File saved: ${destPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      res.status(200).send('OK');
    } catch (error: any) {
      console.error('Mock S3 upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  req.on('error', (error) => {
    console.error('Request error:', error);
    res.status(500).json({ error: error.message });
  });
});

// Store uploaded documents and review requests in memory (for local development)
const uploadedDocuments: Record<string, any> = {};
const reviewRequests: Record<string, any> = {};

// POST /documents/confirm-upload - Confirm upload
app.post('/documents/confirm-upload', async (req, res) => {
  const ALLOWED_FORMATS = ['pdf', 'png', 'jpg', 'jpeg'];
  const REJECTED_FORMATS = ['ppt', 'pptx', 'doc', 'docx'];
  
  try {
    const { documentId, s3Key, metadata } = req.body;
    
    // Validate file format
    const format = metadata.format.toLowerCase();
    
    // Reject PPT files
    if (REJECTED_FORMATS.includes(format)) {
      console.log(`❌ Rejected file format: ${format}`);
      return res.status(400).json({
        error: 'PPT 파일은 지원하지 않습니다. PDF 또는 이미지 파일(PNG, JPG)로 변환하여 업로드해주세요.',
        supportedFormats: ALLOWED_FORMATS,
        rejectedFormat: format,
      });
    }
    
    // Check allowed formats
    if (!ALLOWED_FORMATS.includes(format)) {
      console.log(`❌ Unsupported file format: ${format}`);
      return res.status(400).json({
        error: '지원하지 않는 파일 형식입니다. PDF 또는 이미지 파일(PNG, JPG)만 업로드 가능합니다.',
        supportedFormats: ALLOWED_FORMATS,
      });
    }

    if (!documentId || !s3Key) {
      return res.status(400).json({ error: 'documentId and s3Key are required' });
    }

    console.log(`\n✅ Upload 확인:`);
    console.log(`  Document ID: ${documentId}`);
    console.log(`  Title: ${metadata.title}`);
    console.log(`  S3 Key: ${s3Key}\n`);

    // Get file size from uploaded file
    const uploadDir = path.join(__dirname, '../../uploads');
    const filePath = path.join(uploadDir, `${documentId}.file`);
    let fileSize = 0;
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      fileSize = stats.size;
    }

    // Create document record
    const document = {
      documentId,
      reviewRequestId: '',
      versionNumber: 1,
      s3Bucket: BUCKET_NAME,
      s3Key,
      format: metadata.format,
      title: metadata.title,
      description: metadata.description,
      uploadedBy: metadata.submitterUserId,
      uploadedAt: new Date().toISOString(),
      fileSize,
      checksum: 'local-checksum',
      status: 'uploaded',
    };

    // Store document
    uploadedDocuments[documentId] = document;

    return res.json({
      documentId,
      message: 'Upload confirmed successfully',
      document,
    });
  } catch (error: any) {
    console.error('Error confirming upload:', error);
    return res.status(500).json({ error: 'Failed to confirm upload' });
  }
});

// POST /review-requests - Create review request
app.post('/review-requests', async (req, res) => {
  try {
    const { documentId, title, description, submitterEmail, submitterName } = req.body;
    
    const reviewRequestId = `req-${Date.now()}`;
    const document = uploadedDocuments[documentId];
    
    console.log('\n📝 검토 요청 생성:');
    console.log(`  Review Request ID: ${reviewRequestId}`);
    console.log(`  Document: ${title || document?.title || 'Unknown'}`);
    console.log(`  Submitter: ${submitterName || submitterEmail || 'local@example.com'}\n`);
    
    // Create review request
    const reviewRequest = {
      reviewRequestId,
      documentId: documentId || 'doc-001',
      documentTitle: title || document?.title || 'Untitled',
      submitterEmail: submitterEmail || 'local@example.com',
      submitterName: submitterName || (submitterEmail ? submitterEmail.split('@')[0] : 'local'),
      submitterUserId: submitterEmail ? submitterEmail.split('@')[0] : 'local-user',
      reviewerEmail: 'reviewer@example.com',
      status: 'Pending Review',
      currentVersion: 1,
      title: title || document?.title || 'Untitled',
      description: description || document?.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Store review request
    reviewRequests[reviewRequestId] = reviewRequest;
    
    // Update document with review request ID
    if (document) {
      document.reviewRequestId = reviewRequestId;
    }
    
    res.json({
      reviewRequestId,
      message: 'Review request created successfully',
      reviewRequest,
    });
  } catch (error: any) {
    console.error('Error creating review request:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /review-requests - List review requests
app.get('/review-requests', async (_req, res) => {
  try {
    // Return all stored review requests
    const requestList = Object.values(reviewRequests);
    
    console.log(`\n📋 검토 요청 목록 조회: ${requestList.length}개\n`);
    
    res.json({
      reviewRequests: requestList,
      count: requestList.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /reviews/execute - Execute review with AI agents
app.post('/reviews/execute', async (req, res) => {
  try {
    const { reviewRequestId, pillarSelection, governancePolicies, instructions } = req.body;
    
    console.log('\n' + '='.repeat(80));
    console.log('🤖 AI Agent 검토 시작');
    console.log('='.repeat(80));
    console.log(`Review Request ID: ${reviewRequestId}`);
    console.log(`Selected Pillars: ${pillarSelection.join(', ')}`);
    console.log('='.repeat(80) + '\n');

    // Mock document (in production, fetch from DynamoDB/S3)
    const document: Document = {
      documentId: 'doc-001',
      reviewRequestId,
      versionNumber: 1,
      s3Bucket: 'local',
      s3Key: 'local',
      format: 'pdf',
      title: '전사 BI QuickSight 아키텍처',
      description: 'Amazon QuickSight 기반 전사 BI 시스템 아키텍처 (24페이지)',
      uploadedBy: 'local-user',
      uploadedAt: new Date().toISOString(),
      fileSize: 4 * 1024 * 1024,
      checksum: 'local-checksum',
    };

    // Get pillar configurations
    const pillarConfigs: Record<string, any> = {};
    for (const pillar of pillarSelection) {
      try {
        pillarConfigs[pillar] = await pillarService.getActivePillarConfig(pillar);
      } catch {
        pillarConfigs[pillar] = {
          pillarName: pillar,
          systemPrompt: pillarService['getDefaultPrompt'](pillar),
          enabled: true,
          additionalInstructions: instructions[pillar] || '',
        };
      }
    }

    // Execute agents in background
    const executionId = `exec-${Date.now()}`;
    
    // Start async execution
    executeReviewAsync(executionId, document, pillarConfigs, governancePolicies);

    res.status(202).json({
      executionId,
      message: 'Review execution started',
    });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Store execution results in memory (for local development)
const executionResults: Record<string, any> = {};

async function executeReviewAsync(
  executionId: string,
  document: Document,
  pillarConfigs: Record<string, any>,
  governancePolicies: string[]
) {
  // Initialize execution status
  executionResults[executionId] = {
    executionId,
    status: 'In Progress',
    startedAt: new Date().toISOString(),
  };

  try {
    console.log(`\n⏳ 검토 실행 중... (Execution ID: ${executionId})\n`);

    const startTime = Date.now();
    const { pillarResults } = await agentService.executeAllPillars(
      document,
      pillarConfigs,
      governancePolicies
    );
    const duration = Date.now() - startTime;

    console.log(`\n✅ 검토 완료! (${(duration / 1000).toFixed(2)}초)\n`);

    // Display summary
    Object.entries(pillarResults).forEach(([pillarName, result]: [string, any]) => {
      console.log(`${pillarName}: ${result.status} (${result.recommendations.length} 권장사항)`);
    });

    // Store results
    executionResults[executionId] = {
      executionId,
      reviewRequestId: document.reviewRequestId,
      documentId: document.documentId,
      versionNumber: document.versionNumber,
      status: 'Completed',
      pillarResults,
      startedAt: executionResults[executionId].startedAt,
      completedAt: new Date().toISOString(),
    };

    // Generate reports
    const reviewReport: ReviewReport = {
      executionId,
      reviewRequestId: document.reviewRequestId,
      documentId: document.documentId,
      versionNumber: document.versionNumber,
      pillarResults,
      overallSummary: `검토 완료: ${Object.keys(pillarResults).length}개 Pillar`,
      generatedAt: new Date().toISOString(),
    };

    // Save to file
    const outputDir = path.join(__dirname, '../../uploads/review-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const jsonFile = path.join(outputDir, `${executionId}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(reviewReport, null, 2));

    const pdfBuffer = await reportService.generatePDF(reviewReport);
    const pdfFile = path.join(outputDir, `${executionId}.pdf`);
    fs.writeFileSync(pdfFile, pdfBuffer);

    const wordBuffer = await reportService.generateWord(reviewReport);
    const wordFile = path.join(outputDir, `${executionId}.docx`);
    fs.writeFileSync(wordFile, wordBuffer);

    console.log(`\n📄 리포트 생성 완료:`);
    console.log(`  - JSON: ${path.basename(jsonFile)}`);
    console.log(`  - PDF: ${path.basename(pdfFile)}`);
    console.log(`  - Word: ${path.basename(wordFile)}\n`);

  } catch (error) {
    console.error('Review execution failed:', error);
    executionResults[executionId] = {
      executionId,
      status: 'Failed',
      error: (error as Error).message,
    };
  }
}

// GET /reviews/:executionId/status - Get execution status
app.get('/reviews/:executionId/status', (_req, res) => {
  const { executionId } = _req.params;
  const result = executionResults[executionId];

  if (!result) {
    return res.status(404).json({ error: 'Execution not found' });
  }

  return res.json({
    status: result.status,
    pillarResults: result.pillarResults || {},
    startedAt: result.startedAt,
    completedAt: result.completedAt,
  });
});

// GET /reviews/:executionId/results - Get review results
app.get('/reviews/:executionId/results', (_req, res) => {
  const { executionId } = _req.params;
  const result = executionResults[executionId];

  if (!result) {
    return res.status(404).json({ error: 'Execution not found' });
  }

  if (result.status !== 'Completed') {
    return res.status(400).json({ error: 'Review not yet completed' });
  }

  return res.json({ reviewReport: result });
});

// GET /agents/pillars - Get pillar configurations
app.get('/agents/pillars', async (_req, res) => {
  try {
    const pillars = await pillarService.getAllPillars();
    res.json({ pillars });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /review-requests/:reviewRequestId/status - Update review request status (for development)
app.patch('/review-requests/:reviewRequestId/status', async (req, res) => {
  try {
    const { reviewRequestId } = req.params;
    const { status } = req.body;
    
    const reviewRequest = reviewRequests[reviewRequestId];
    
    if (!reviewRequest) {
      return res.status(404).json({ error: 'Review request not found' });
    }
    
    // Update status
    reviewRequest.status = status;
    reviewRequest.updatedAt = new Date().toISOString();
    
    console.log(`\n✅ 검토 요청 상태 변경: ${reviewRequestId}`);
    console.log(`   문서: ${reviewRequest.documentTitle}`);
    console.log(`   상태: ${status}\n`);
    
    return res.json({
      message: 'Status updated successfully',
      reviewRequest,
    });
  } catch (error: any) {
    console.error('Error updating status:', error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 Local Backend Server Running`);
  console.log('='.repeat(80));
  console.log(`\nServer: http://localhost:${PORT}`);
  console.log(`Frontend: http://localhost:3000`);
  console.log(`\nAI Agent: Amazon Bedrock Claude 3.5 Sonnet`);
  console.log(`\nEndpoints:`);
  console.log(`  POST   /documents/get-upload-url`);
  console.log(`  POST   /documents/confirm-upload`);
  console.log(`  POST   /review-requests`);
  console.log(`  GET    /review-requests`);
  console.log(`  POST   /reviews/execute`);
  console.log(`  GET    /reviews/:id/status`);
  console.log(`  GET    /reviews/:id/results`);
  console.log(`  GET    /agents/pillars`);
  console.log(`\n${'='.repeat(80)}\n`);
});

// GET /reviews/:executionId - Get review execution status (changed from /status)
app.get('/reviews/:executionId', (req, res) => {
  const { executionId } = req.params;
  
  const result = executionResults[executionId];
  
  if (!result) {
    return res.status(404).json({ error: 'Execution not found' });
  }
  
  return res.json({
    status: result.status,
    pillarResults: result.pillarResults || {},
    startedAt: result.startedAt,
    completedAt: result.completedAt,
  });
});

// GET /reviews/:executionId/results - Get review results
app.get('/reviews/:executionId/results', (req, res) => {
  const { executionId } = req.params;
  
  const result = executionResults[executionId];
  
  if (!result) {
    return res.status(404).json({ error: 'Execution not found' });
  }
  
  if (result.status !== 'Completed') {
    return res.status(400).json({ error: 'Review execution is not yet completed' });
  }
  
  return res.json({
    reviewReport: {
      executionId: result.executionId,
      reviewRequestId: result.reviewRequestId,
      documentId: result.documentId,
      versionNumber: result.versionNumber,
      pillarResults: result.pillarResults,
      overallSummary: `검토 완료: ${Object.keys(result.pillarResults).length}개 Pillar`,
      generatedAt: result.completedAt,
    },
  });
});
