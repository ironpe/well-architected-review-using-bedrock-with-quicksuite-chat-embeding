/**
 * Agent Orchestration Service - Bedrock agent coordination
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { environment } from '../config/environment.js';
import { QBusinessService } from './QBusinessService.js';
import { NovaDocumentAnalyzer } from './NovaDocumentAnalyzer.js';
import { PdfToImageService } from './PdfToImageService.js';
import { PillarConfigurationService } from './PillarConfigurationService.js';
import {
  PillarName,
  PillarResult,
  PillarConfig,
  Document,
  PolicyViolation,
  CostBreakdown,
  GovernanceAnalysisResult,
  GovernanceComplianceResult,
  GovernanceViolationDetail,
  GovernancePolicy,
} from '../types/index.js';
import { validatePillarName, validateRequiredString } from '../utils/validators.js';
import { CostTracker } from '../utils/cost-tracker.js';

export class AgentOrchestrationService {
  private bedrockClient: BedrockRuntimeClient;
  private s3Client: S3Client;
  private qBusinessService: QBusinessService;
  private novaAnalyzer: NovaDocumentAnalyzer;
  private pdfToImageService: PdfToImageService;
  private pillarConfigService: PillarConfigurationService;
  private modelId: string;
  private timeout: number;
  private costTracker: CostTracker | null = null;

  /**
   * Get current cost breakdown (useful after governance analysis)
   */
  getCostBreakdown(): CostBreakdown | null {
    return this.costTracker ? this.costTracker.getBreakdown() : null;
  }

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient({ region: environment.aws.region });
    this.s3Client = new S3Client({ region: environment.aws.region });
    this.qBusinessService = new QBusinessService();
    this.novaAnalyzer = new NovaDocumentAnalyzer();
    this.pdfToImageService = new PdfToImageService();
    this.pillarConfigService = new PillarConfigurationService();
    this.modelId = environment.bedrock.modelId;
    this.timeout = environment.bedrock.agentTimeout;
  }

  /**
   * Execute review for a single pillar with pre-extracted content
   */
  async executePillarReviewWithContent(
    pillar: PillarName,
    document: Document,
    documentContent: string,
    images: Array<{buffer: Buffer, name: string, type: string}>,
    systemPrompt: string,
    governancePolicies: string[],
    additionalInstructions?: string,
    language: 'ko' | 'en' = 'ko'
  ): Promise<PillarResult> {
    validatePillarName(pillar);
    validateRequiredString(systemPrompt, 'systemPrompt');

    const startTime = Date.now();

    try {
      console.log(`[${pillar}] Starting review...`);

      // Construct full prompt
      const fullPrompt = this.constructPrompt(
        systemPrompt,
        document,
        documentContent,
        additionalInstructions,
        language
      );

      // Invoke Bedrock model (with vision if images available)
      let response: string;
      if (images.length > 0) {
        console.log(`[${pillar}] Using vision model with ${images.length} images`);
        response = await this.invokeBedrockVisionModel(fullPrompt, images.slice(0, 5), language);
      } else {
        console.log(`[${pillar}] Using text model`);
        response = await this.invokeBedrockModel(fullPrompt, `Pillar Review - ${pillar}`);
      }

      // Query governance policies
      let governanceViolations: PolicyViolation[] = [];
      if (governancePolicies.length > 0) {
        governanceViolations = await this.qBusinessService.queryGovernancePolicies(
          governancePolicies,
          documentContent
        );
      }

      // Parse response
      const { findings, recommendations } = this.parseBedrockResponse(response);

      const duration = Date.now() - startTime;
      console.log(`[${pillar}] Completed in ${(duration / 1000).toFixed(2)}s`);

      return {
        pillarName: pillar,
        status: 'Completed',
        findings,
        recommendations,
        governanceViolations: governanceViolations.length > 0 ? governanceViolations : undefined,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[${pillar}] Review failed:`, error);

      if (Date.now() - startTime > this.timeout) {
        return {
          pillarName: pillar,
          status: 'Failed',
          findings: '',
          recommendations: [],
          error: 'Review timed out after 5 minutes',
        };
      }

      return {
        pillarName: pillar,
        status: 'Failed',
        findings: '',
        recommendations: [],
        error: (error as Error).message,
      };
    }
  }

  /**
   * Execute review for all selected pillars in parallel
   */
  async executeAllPillars(
    document: Document,
    pillarConfigs: Record<string, PillarConfig>,
    governancePolicies: string[],
    architecturePages?: number[],
    language: 'ko' | 'en' = 'ko'
  ): Promise<{ 
    pillarResults: Record<string, PillarResult>, 
    visionSummary: string,
    executiveSummary: string,
    costBreakdown: CostBreakdown,
    documentContent: string
  }> {
    const results: Record<string, PillarResult> = {};
    this.costTracker = new CostTracker();

    // Share cost tracker with sub-services
    this.novaAnalyzer.costTracker = this.costTracker;

    // Load configurable pillar review model
    try {
      const reviewModelConfig = await this.pillarConfigService.getPillarReviewModelConfig();
      console.log(`Using pillar review model: ${reviewModelConfig.modelId}`);
      this.modelId = reviewModelConfig.modelId;
    } catch (error) {
      console.warn('Failed to load pillar review model config, using default:', this.modelId);
    }

    // Extract document content once
    console.log('Extracting document content...');
    let documentContent = '';
    let images: Array<{buffer: Buffer, name: string, type: string}> = [];
    let visionSummary = '';
    
    // Store user-specified pages in document for parsePdfFile to use
    if (architecturePages && architecturePages.length > 0) {
      (document as any)._userSpecifiedPages = architecturePages;
      console.log(`User specified architecture pages: ${architecturePages.join(', ')}`);
    }
    
    // Store language preference for content generation
    (document as any)._language = language;
    
    try {
      documentContent = await this.extractDocumentContent(document);
      images = (document as any)._images || [];
      console.log(`Extracted ${documentContent.length} characters and ${images.length} images`);
      
      // Get vision analyses
      const visionAnalyses = (document as any)._visionAnalyses;
      if (visionAnalyses && visionAnalyses.length > 0) {
        visionSummary = visionAnalyses.join('\n\n');
        console.log(`Vision analyses available: ${visionAnalyses.length} diagrams analyzed`);
      } else if (images.length > 0) {
        visionSummary = language === 'en'
          ? `📊 **Architecture Diagram Information**\n\nThe document contains ${images.length} diagram(s)/image(s).\nVision AI analysis was used for each pillar review.`
          : `📊 **아키텍처 다이어그램 정보**\n\n문서에 ${images.length}개의 다이어그램/이미지가 포함되어 있습니다.\nVision AI 분석은 각 원칙별 검토에 활용되었습니다.`;
        console.log(`Vision analysis not available, using fallback message for ${images.length} images`);
      }
    } catch (error) {
      console.warn('Failed to extract document content:', error);
      documentContent = `Document metadata only:\nTitle: ${document.title}\nDescription: ${document.description}`;
    }

    // Execute all pillars in parallel
    const promises = Object.entries(pillarConfigs).map(async ([pillarName, config]) => {
      if (!config.enabled) {
        return {
          pillarName,
          result: {
            pillarName: pillarName as PillarName,
            status: 'Completed' as const,
            findings: 'Pillar review skipped (disabled)',
            recommendations: [],
          },
        };
      }

      const result = await this.executePillarReviewWithContent(
        pillarName as PillarName,
        document,
        documentContent,
        environment.optimization.includePillarImages ? images : [], // 환경 변수로 제어
        config.systemPrompt,
        governancePolicies,
        config.additionalInstructions,
        language
      );

      return { pillarName, result };
    });

    const pillarResults = await Promise.all(promises);

    for (const { pillarName, result } of pillarResults) {
      results[pillarName] = result;
    }

    // Executive Summary 생성 (환경 변수로 제어)
    let executiveSummary = '';
    
    if (environment.optimization.generateExecutiveSummarySync) {
      console.log('Generating executive summary synchronously...');
      executiveSummary = await this.generateExecutiveSummary(
        visionSummary,
        results,
        language
      );
    } else {
      console.log('Executive summary generation skipped (async mode). User can view results immediately.');
    }

    return { pillarResults: results, visionSummary, executiveSummary, costBreakdown: this.costTracker!.getBreakdown(), documentContent };
  }

  /**
   * Extract document content from S3
   */
  private async extractDocumentContent(document: Document): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: document.s3Bucket,
      Key: document.s3Key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty document body from S3');
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    console.log(`Downloaded document: ${document.title} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Track S3 cost
    if (this.costTracker) {
      this.costTracker.trackS3Operation({
        operation: 'GetObject - Document Download',
        dataTransferKB: Math.round(buffer.length / 1024),
      });
    }

    // Parse based on format
    if (document.format === 'pdf') {
      return await this.parsePdfFile(buffer, document);
    } else if (document.format === 'png' || document.format === 'jpg' || document.format === 'jpeg') {
      return await this.parseImageFile(buffer, document);
    } else {
      return this.getDocumentMetadata(document, buffer.length);
    }
  }

  /**
   * Parse PDF file - Amazon Nova Lite (multilingual support)
   */
  private async parsePdfFile(buffer: Buffer, document: Document): Promise<string> {
    try {
      console.log(`Parsing PDF with Amazon Nova Lite... Buffer size: ${buffer.length} bytes`);
      
      // Check if user specified architecture pages
      const userSpecifiedPages = (document as any)._userSpecifiedPages as number[] | undefined;
      
      let pagesToAnalyze: number[] = [];
      let pdfAnalysis: any = null;
      
      if (userSpecifiedPages && userSpecifiedPages.length > 0) {
        // Use user-specified pages
        console.log(`Using user-specified pages: ${userSpecifiedPages.join(', ')}`);
        pagesToAnalyze = userSpecifiedPages;
      } else {
        // Auto-scan to find architecture pages
        console.log('Auto-scanning PDF for architecture pages...');
        pdfAnalysis = await this.novaAnalyzer.analyzePdf(buffer);
        console.log(`PDF analysis completed. Reported page count: ${pdfAnalysis.pageCount}`);
        console.log(`Detailed page analysis:`, pdfAnalysis.pages.map((p: any) => ({
          pageNumber: p.pageNumber,
          hasArchitecture: p.hasArchitecture,
          confidence: p.confidence
        })));
        
        const bestPage = this.novaAnalyzer.selectBestPage(pdfAnalysis.pages);
        if (bestPage) {
          pagesToAnalyze = [bestPage.pageNumber];
          console.log(`Auto-selected page ${bestPage.pageNumber} (confidence: ${bestPage.confidence}%)`);
        }
      }
      
      // 콘텐츠 생성
      const lang = (document as any)._language || 'ko';
      let content = lang === 'en'
        ? `=== Document Information ===\nTitle: ${document.title}\nFormat: PDF\n`
        : `=== 문서 정보 ===\n제목: ${document.title}\n형식: PDF\n`;
      
      if (pdfAnalysis) {
        content += lang === 'en'
          ? `Pages: ${pdfAnalysis.pageCount}\n`
          : `페이지 수: ${pdfAnalysis.pageCount}개\n`;
        if (userSpecifiedPages) {
          content += lang === 'en'
            ? `User-specified pages: ${userSpecifiedPages.join(', ')}\n\n`
            : `사용자 지정 페이지: ${userSpecifiedPages.join(', ')}\n\n`;
        } else {
          const bestPage = this.novaAnalyzer.selectBestPage(pdfAnalysis.pages);
          if (bestPage) {
            content += lang === 'en'
              ? `Auto-selected page: ${bestPage.pageNumber} (confidence: ${bestPage.confidence}%)\n\n`
              : `자동 선택된 페이지: ${bestPage.pageNumber} (신뢰도: ${bestPage.confidence}%)\n\n`;
          }
        }
      } else {
        content += lang === 'en'
          ? `User-specified pages: ${userSpecifiedPages!.join(', ')}\n\n`
          : `사용자 지정 페이지: ${userSpecifiedPages!.join(', ')}\n\n`;
      }
      
      content += lang === 'en'
        ? `=== Document Description ===\n${document.description}\n\n`
        : `=== 문서 설명 ===\n${document.description}\n\n`;
      
      // Extract full PDF text content using Nova Lite for pillar reviews
      try {
        console.log('Extracting full PDF text content for pillar reviews...');
        const fullPdfText = await this.extractPdfFullText(buffer);
        if (fullPdfText && fullPdfText.length > 100) {
          content += lang === 'en'
            ? `=== Full Document Content ===\n\n${fullPdfText.substring(0, 30000)}\n\n`
            : `=== 문서 전체 내용 ===\n\n${fullPdfText.substring(0, 30000)}\n\n`;
          console.log(`Extracted ${fullPdfText.length} chars of full PDF text (included up to 30000 chars)`);
        }
      } catch (textError) {
        console.warn('Failed to extract full PDF text, continuing with metadata only:', textError);
      }

      // 아키텍처 관련 페이지 요약 (자동 스캔한 경우만)
      if (pdfAnalysis) {
        const archPages = pdfAnalysis.pages.filter((p: any) => p.hasArchitecture);
        if (archPages.length > 0) {
          content += lang === 'en'
            ? `=== Architecture-Related Pages (${archPages.length}) ===\n\n`
            : `=== 아키텍처 관련 페이지 (${archPages.length}개) ===\n\n`;
          archPages.forEach((page: any) => {
            if (page.text.trim()) {
              content += lang === 'en'
                ? `--- Page ${page.pageNumber} (confidence: ${page.confidence}%) ---\n`
                : `--- 페이지 ${page.pageNumber} (신뢰도: ${page.confidence}%) ---\n`;
              content += page.text.substring(0, 300) + (page.text.length > 300 ? '...' : '') + '\n\n';
            }
          });
        }
      }
      
      // Step 3: 선택된 페이지들 상세 Vision 분석
      const visionAnalyses: string[] = [];
      const allImages: Array<{buffer: Buffer, name: string, type: string}> = [];
      
      if (pagesToAnalyze.length > 0) {
        // Load Nova Vision prompt from config
        const novaVisionConfig = await this.pillarConfigService.getNovaVisionConfig();
        
        // If English is selected, replace the vision prompt with an English version
        let visionPrompt = novaVisionConfig.systemPrompt;
        if (lang === 'en') {
          visionPrompt = this.getEnglishVisionPrompt(novaVisionConfig.systemPrompt);
        }
        
        for (const pageNum of pagesToAnalyze) {
          try {
            console.log(`Analyzing page ${pageNum} with ${novaVisionConfig.modelId}...`);
            
            // 단일 페이지 추출
            const pageBuffer = await this.novaAnalyzer.extractPdfPage(buffer, pageNum);
            
            // 모델이 Claude인 경우 이미지로 변환 필요
            const isClaude = novaVisionConfig.modelId.includes('claude');
            
            let primaryAnalysis: string;
            let imageBuffer: Buffer | null = null;
            
            if (isClaude) {
              // Claude는 PDF 직접 처리 불가 → 이미지로 변환
              try {
                console.log(`Converting page ${pageNum} to image for Claude...`);
                imageBuffer = await this.pdfToImageService.convertPdfPageToImage(
                  pageBuffer,
                  pageNum,
                  document.s3Bucket,
                  document.s3Key,
                  150
                );
                
                // Track Lambda invocation cost
                if (this.costTracker) {
                  this.costTracker.trackLambdaInvocation({
                    operation: `PDF-to-Image Conversion (Page ${pageNum})`,
                    memoryMB: 512,
                    durationMs: 3000,
                  });
                }
                
                console.log(`Analyzing page ${pageNum} with Claude Vision...`);
                primaryAnalysis = await this.analyzeImageWithVision(
                  imageBuffer,
                  'image/png',
                  novaVisionConfig.modelId,
                  novaVisionConfig.maxTokens,
                  novaVisionConfig.temperature,
                  visionPrompt
                );
              } catch (popplerError) {
                console.warn(`PDF to image conversion failed for page ${pageNum}, falling back to Nova Lite:`, popplerError);
                
                // Fallback: Nova Lite로 PDF 직접 분석
                primaryAnalysis = await this.novaAnalyzer.analyzePageWithNova(
                  pageBuffer,
                  pageNum,
                  'us.amazon.nova-lite-v1:0',
                  novaVisionConfig.maxTokens,
                  novaVisionConfig.temperature,
                  visionPrompt
                );
                
                // 사용자에게 알림 추가
                primaryAnalysis = lang === 'en'
                  ? `⚠️ **Notice**: PDF conversion failed, analyzed with Nova Lite instead of Claude.\n\n${primaryAnalysis}`
                  : `⚠️ **알림**: PDF 변환 실패로 Claude 대신 Nova Lite로 분석했습니다.\n\n${primaryAnalysis}`;
              }
            } else {
              // Nova/Mistral은 PDF 직접 처리 가능
              console.log(`Analyzing page ${pageNum} with Vision model (PDF direct)...`);
              console.log(`Page buffer size for page ${pageNum}: ${pageBuffer.length} bytes`);
              primaryAnalysis = await this.novaAnalyzer.analyzePageWithNova(
                pageBuffer, 
                pageNum,
                novaVisionConfig.modelId,
                novaVisionConfig.maxTokens,
                novaVisionConfig.temperature,
                visionPrompt
              );
            }
            
            console.log(`Primary analysis completed for page ${pageNum}`);
            
            // Primary 분석 결과 저장
            visionAnalyses.push(lang === 'en'
              ? `## Page ${pageNum}\n\n${primaryAnalysis}`
              : `## 페이지 ${pageNum}\n\n${primaryAnalysis}`);
            
            // 이미지 저장 (Claude 선택 시에만)
            if (imageBuffer) {
              allImages.push({
                buffer: imageBuffer,
                name: `architecture-page-${pageNum}.png`,
                type: 'image/png'
              });
            }
          } catch (pageError) {
            console.error(`Failed to analyze page ${pageNum}:`, pageError);
            visionAnalyses.push(lang === 'en'
              ? `## Page ${pageNum}\n\nAnalysis failed: ${pageError}`
              : `## 페이지 ${pageNum}\n\n분석 실패: ${pageError}`);
          }
        }
        
        // 모든 분석 결과 통합
        if (visionAnalyses.length > 0) {
          content += lang === 'en'
            ? `=== Architecture Diagram Analysis ===\n\n`
            : `=== 아키텍처 다이어그램 분석 ===\n\n`;
          content += visionAnalyses.join('\n\n---\n\n');
          content += '\n\n';
        }
        
        // 이미지들을 저장하여 Pillar 검토에서 사용
        (document as any)._images = allImages;
        (document as any)._visionAnalyses = visionAnalyses;
      } else {
        content += lang === 'en'
          ? `=== Architecture Diagrams ===\nNo architecture pages found.\n\n`
          : `=== 아키텍처 다이어그램 ===\n아키텍처 페이지를 찾을 수 없습니다.\n\n`;
        (document as any)._images = [];
        (document as any)._visionAnalyses = [];
      }
      
      console.log(`Generated ${content.length} characters of content`);
      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('PDF parsing failed:', {
        error: errorMessage,
        stack: errorStack,
        documentId: document.documentId,
        format: document.format,
        title: document.title,
      });
      
      // AWS SDK 에러인 경우 추가 정보
      if (error && typeof error === 'object' && '$metadata' in error) {
        console.error('AWS SDK Error details:', {
          httpStatusCode: (error as any).$metadata?.httpStatusCode,
          requestId: (error as any).$metadata?.requestId,
          errorCode: (error as any).name,
          errorMessage: (error as any).message,
        });
      }
      
      return this.getDocumentMetadata(document, buffer.length);
    }
  }

  /**
   * Parse image file
   */
  private async parseImageFile(buffer: Buffer, document: Document): Promise<string> {
    console.log('Parsing image file...');
    const lang = (document as any)._language || 'ko';
    
    // Store image for Vision analysis
    (document as any)._images = [{
      buffer,
      name: document.title,
      type: document.format === 'png' ? 'image/png' : 'image/jpeg',
    }];
    
    // Analyze with Vision
    try {
      // If English is selected, add language override to default vision prompt
      let visionPrompt: string | undefined;
      if (lang === 'en') {
        visionPrompt = `CRITICAL: You MUST write your ENTIRE analysis in English. AWS service names should remain as-is.

Analyze this architecture diagram in detail and write in English:

## Analysis Items

1. **Key AWS Services and Components**
   - List all AWS services shown in the diagram
   - Role and purpose of each service

2. **Data Flow and Connections**
   - Step-by-step explanation of data flow
   - Relationships between services

3. **Security Configuration**
   - VPC, Subnet configuration
   - IAM roles and permissions
   - Encryption and security boundaries

4. **Network Architecture**
   - VPC structure
   - Public/Private Subnet placement

5. **Architecture Patterns and Characteristics**
   - Design patterns used
   - High availability and scalability considerations

**Important**: Read the text and labels in the diagram accurately and write specifically.`;
      }

      const analysis = await this.analyzeImageWithVision(
        buffer,
        document.format === 'png' ? 'image/png' : 'image/jpeg',
        undefined,
        undefined,
        undefined,
        visionPrompt
      );
      
      (document as any)._visionAnalyses = [analysis];
      
      let content: string;
      if (lang === 'en') {
        content = `=== Document Information ===\n`;
        content += `Title: ${document.title}\n`;
        content += `Format: Image (${document.format.toUpperCase()})\n`;
        content += `Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`;
        content += `Upload date: ${new Date(document.uploadedAt).toLocaleString('en-US')}\n\n`;
        content += `=== Document Description ===\n`;
        content += `${document.description}\n\n`;
        content += `=== Architecture Diagram Analysis (AI Vision) ===\n\n`;
        content += analysis;
      } else {
        content = `=== 문서 정보 ===\n`;
        content += `제목: ${document.title}\n`;
        content += `형식: 이미지 (${document.format.toUpperCase()})\n`;
        content += `크기: ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`;
        content += `업로드 날짜: ${new Date(document.uploadedAt).toLocaleString('ko-KR')}\n\n`;
        content += `=== 문서 설명 ===\n`;
        content += `${document.description}\n\n`;
        content += `=== 아키텍처 다이어그램 분석 (AI Vision) ===\n\n`;
        content += analysis;
      }
      
      return content;
    } catch (error) {
      console.error('Image analysis failed:', error);
      return this.getDocumentMetadata(document, buffer.length);
    }
  }

  /**
   * Get English version of the vision analysis prompt
   * Replaces Korean section titles/instructions with English equivalents
   */
  private getEnglishVisionPrompt(_koreanPrompt: string): string {
    return `Analyze the architecture diagram in detail and write a structured, technical description in English.

(IMPORTANT) The analysis results MUST only mention what is actually shown in the architecture diagram.

# Analysis Structure

## 1. 🎯 Architecture Overview
**Summarize the system's purpose and overall structure in 7 sentences or less.**
- What business problem does this system solve?

## 2. 🏗️ Key Components
**Group and describe all AWS services and components shown in the diagram by layer.**

### 2.1 Frontend / User Layer
- User interface and access methods
- CDN, API Gateway, etc.

### 2.2 Application Layer
- Compute resources (Lambda, ECS, EC2, etc.)
- Business logic processing
- Role and responsibility of each service

### 2.3 Data Layer
- Databases (RDS, DynamoDB, S3, etc.)
- Caching layer (ElastiCache, DAX, etc.)
- Data storage and management strategy

### 2.4 Integration & Messaging
- Inter-service communication methods
- Event bus, queues, topics, etc.

### 2.5 External Service Integration
- Third-party services (Okta, IdP, external APIs, etc.)
- Integration methods and protocols

## 3. 🔄 Data Flow Analysis
**Describe step by step how data flows through the system.**

### 3.1 Main Data Flow Paths
1. **User Request → Response Path**
   - Step-by-step processing
   - Services used at each step

2. **Data Collection & Storage Path**
   - Data ingestion methods
   - Transformation and processing
   - Final storage location

3. **Batch Processing & Analytics Path** (if applicable)
   - Scheduling methods
   - Processing pipeline

### 3.2 Data Flow Characteristics
- Synchronous/asynchronous processing
- Data transformation and validation points
- Error handling and retry mechanisms

## 4. 🔒 Security & Network Configuration
**Describe the security architecture in detail.**

### 4.1 Network Structure
- VPC configuration (CIDR, Subnet placement)
- Public/Private Subnet separation
- NAT Gateway, Internet Gateway placement
- Transit Gateway, VPC Peering (if applicable)

### 4.2 Security Layers
- **Authentication/Authorization**: Cognito, IAM, external IdP, etc.
- **Network Security**: Security Group, NACL, WAF
- **Data Security**: Encryption (in transit/at rest), KMS
- **Access Control**: IAM roles and policies, resource-based policies

### 4.3 Security Boundaries
- Identify security boundaries between layers
- Trust boundary identification

## 5. ⚡ Architecture Characteristics & Patterns
**Describe the key characteristics and design patterns of this architecture.**

### 5.1 Design Patterns
- Architecture patterns used (e.g., CQRS, Event Sourcing, Saga, etc.)
- Microservice boundaries (if applicable)
- API design patterns

### 5.2 High Availability & Scalability
- Multi-AZ deployment
- Auto Scaling configuration
- Load balancing strategy
- Failover mechanisms

### 5.3 Performance Optimization
- Caching strategy
- Asynchronous processing
- Database optimization

### 5.4 Operations & Monitoring
- Logging and monitoring (CloudWatch, X-Ray, etc.)
- Alarms and notifications
- Backup and recovery strategy

## 6. 📊 Technology Stack Summary
**Organize all AWS services used by category.**

| Category | Service | Purpose |
|----------|---------|---------|
| Compute | Lambda, ECS, etc. | Application execution |
| Storage | S3, EBS, etc. | Data storage |
| Database | RDS, DynamoDB, etc. | Data management |
| Networking | VPC, ALB, etc. | Network configuration |
| Security | IAM, KMS, etc. | Security management |

---

**Writing Guidelines:**
1. **Structured writing**: Follow the structure above systematically
2. **Technical accuracy**: Accurately describe AWS service names, settings, and configurations
3. **Readability**: Use markdown formatting (headings, lists, tables, emphasis)
4. **Specificity**: Use specific service names instead of "various services"
5. **Write in English**: Keep AWS service names as-is, write descriptions in English
6. **Diagram fidelity**: Accurately read and reflect all labels and text shown in the diagram

**IMPORTANT**: Carefully observe all arrows, connection lines, and labels in the diagram to accurately identify data flows.

Analyze the architecture diagram in detail following the structure above:`;
  }

  /**
   * Get document metadata as fallback
   */
  private getDocumentMetadata(document: Document, fileSize: number): string {
    const lang = (document as any)._language || 'ko';
    
    if (lang === 'en') {
      const fallbackMessage = `📄 **Document Information**\n\nDocument format: ${document.format.toUpperCase()}\nSize: ${(fileSize / 1024 / 1024).toFixed(2)} MB\n\nDocument parsing failed. Review was performed using metadata only.`;
      (document as any)._visionAnalyses = [fallbackMessage];
      (document as any)._images = [];
      
      return `
=== Document Information ===
Title: ${document.title}
Format: ${document.format.toUpperCase()}
Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB
Description: ${document.description}

Note: This document is in ${document.format.toUpperCase()} format.
The AI agent performs the review based on document metadata and description.
`;
    }
    
    // Korean (default)
    const fallbackMessage = `📄 **문서 정보**\n\n문서 형식: ${document.format.toUpperCase()}\n크기: ${(fileSize / 1024 / 1024).toFixed(2)} MB\n\n문서 파싱에 실패하여 메타데이터만 사용하여 검토를 수행했습니다.`;
    (document as any)._visionAnalyses = [fallbackMessage];
    (document as any)._images = [];
    
    return `
=== 문서 정보 ===
제목: ${document.title}
형식: ${document.format.toUpperCase()}
크기: ${(fileSize / 1024 / 1024).toFixed(2)} MB
설명: ${document.description}

참고: 이 문서는 ${document.format.toUpperCase()} 형식입니다.
AI 에이전트는 문서 메타데이터와 설명을 기반으로 검토를 수행합니다.
`;
  }

  /**
   * Construct full prompt for Bedrock
   */
  private constructPrompt(
    systemPrompt: string,
    _document: Document,
    documentContent: string,
    additionalInstructions?: string,
    language: 'ko' | 'en' = 'ko'
  ): string {
    let prompt = '';

    // When English is selected, add a strong language override instruction BEFORE the system prompt
    // This is critical because the system prompt from /admin/agents is written in Korean
    if (language === 'en') {
      prompt += `=== CRITICAL LANGUAGE INSTRUCTION ===\n`;
      prompt += `You MUST write your ENTIRE response in English. The system prompt below may be written in Korean, but you must ignore the language of the system prompt and respond ONLY in English. All findings, recommendations, analysis, and summaries must be in English. AWS service names should remain as-is.\n\n`;
    }

    prompt += systemPrompt + '\n\n';

    prompt += `=== Architecture Document ===\n\n`;
    prompt += documentContent + '\n\n';

    if (additionalInstructions) {
      prompt += `=== Additional Instructions ===\n${additionalInstructions}\n\n`;
    }

    prompt += `=== Review Task ===\n`;

    if (language === 'en') {
      prompt += `**IMPORTANT: You MUST write ALL review results in English. Follow the markdown format below.**\n\n`;
      prompt += `## Key Findings\n\n`;
      prompt += `### Strengths\n`;
      prompt += `- List the strengths of the current architecture\n\n`;
      prompt += `### Weaknesses\n`;
      prompt += `- Areas that need improvement\n\n`;
      prompt += `### Key Characteristics\n`;
      prompt += `- Core design decisions of the architecture\n\n`;
      prompt += `## Recommendations\n\n`;
      prompt += `Write each recommendation in the following format:\n\n`;
      prompt += `1. **[Recommendation Title]**\n`;
      prompt += `   - **Current State**: [Current implementation status and issues]\n`;
      prompt += `   - **Improvement Plan**: [Specific solution]\n`;
      prompt += `   - **Priority**: High/Medium/Low\n`;
      prompt += `   - **Expected Impact**: [Expected benefits after improvement]\n\n`;
    } else {
      prompt += `**중요: 모든 검토 결과를 한글로 작성하고, 반드시 아래 마크다운 형식을 따르세요.**\n\n`;
      prompt += `## 주요 발견사항 (Key Findings)\n\n`;
      prompt += `### 강점 (Strengths)\n`;
      prompt += `- 현재 아키텍처의 우수한 점들을 나열\n\n`;
      prompt += `### 약점 (Weaknesses)\n`;
      prompt += `- 개선이 필요한 영역\n\n`;
      prompt += `### 주요 특징 (Key Characteristics)\n`;
      prompt += `- 아키텍처의 핵심 설계 결정사항\n\n`;
      prompt += `## 권장사항 (Recommendations)\n\n`;
      prompt += `각 권장사항을 다음 형식으로 작성:\n\n`;
      prompt += `1. **[권장사항 제목]**\n`;
      prompt += `   - **현재 상태**: [현재 구현 상태와 문제점]\n`;
      prompt += `   - **개선 방안**: [구체적인 해결 방법]\n`;
      prompt += `   - **우선순위**: High/Medium/Low\n`;
      prompt += `   - **예상 효과**: [개선 시 기대되는 이점]\n\n`;
    }

    return prompt;
  }

  /**
   * Invoke Bedrock model with vision (multimodal) - Converse API
   */
  private async invokeBedrockVisionModel(
    prompt: string, 
    images: Array<{buffer: Buffer, name: string, type: string}>,
    language: 'ko' | 'en' = 'ko'
  ): Promise<string> {
    const selectedImages = images.slice(0, 5);
    
    const contentBlocks: any[] = [
      { text: prompt },
    ];

    for (const image of selectedImages) {
      const formatMap: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpeg',
        'image/gif': 'gif',
        'image/webp': 'webp',
      };
      contentBlocks.push({
        image: {
          format: formatMap[image.type] || 'png',
          source: { bytes: image.buffer },
        },
      });
    }

    contentBlocks.push({
      text: language === 'en'
        ? `\n\nAnalyze the above ${selectedImages.length} architecture diagram(s) and perform the review.`
        : `\n\n위 ${selectedImages.length}개의 아키텍처 다이어그램을 분석하여 검토를 수행하세요.`,
    });

    const command = new ConverseCommand({
      modelId: this.modelId,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
      inferenceConfig: {
        maxTokens: 8192,
        temperature: 0.7,
      },
    });

    const response = await this.bedrockClient.send(command);

    // Track cost
    const usage = response.usage;
    if (this.costTracker && usage) {
      this.costTracker.trackBedrockInvocation({
        modelId: this.modelId,
        inputTokens: usage.inputTokens || 0,
        outputTokens: usage.outputTokens || 0,
        operation: `Vision - Pillar Review (${selectedImages.length} images)`,
        imageCount: selectedImages.length,
      });
    } else if (this.costTracker) {
      const responseText = response.output?.message?.content?.[0]?.text || '';
      this.costTracker.trackBedrockInvocation({
        modelId: this.modelId,
        inputTokens: Math.ceil(prompt.length / 4),
        outputTokens: Math.ceil(responseText.length / 4),
        operation: `Vision - Pillar Review (${selectedImages.length} images)`,
        imageCount: selectedImages.length,
      });
    }
    
    const outputText = response.output?.message?.content?.[0]?.text;
    if (outputText) {
      return outputText;
    }

    throw new Error('Invalid response format from Bedrock Converse API');
  }

  /**
   * Invoke Bedrock model (text only) - Converse API
   */
  private async invokeBedrockModel(prompt: string, costOperation?: string): Promise<string> {
    console.log(`Invoking Bedrock model ${this.modelId} (prompt: ${prompt.length} chars)`);
    
    const command = new ConverseCommand({
      modelId: this.modelId,
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 8192,
        temperature: 0.7,
      },
    });

    const response = await this.bedrockClient.send(command);

    // Track cost
    const usage = response.usage;
    if (this.costTracker && usage) {
      this.costTracker.trackBedrockInvocation({
        modelId: this.modelId,
        inputTokens: usage.inputTokens || 0,
        outputTokens: usage.outputTokens || 0,
        operation: costOperation || 'Bedrock Text Invocation',
      });
    } else if (this.costTracker) {
      const responseText = response.output?.message?.content?.[0]?.text || '';
      this.costTracker.trackBedrockInvocation({
        modelId: this.modelId,
        inputTokens: Math.ceil(prompt.length / 4),
        outputTokens: Math.ceil(responseText.length / 4),
        operation: costOperation || 'Bedrock Text Invocation',
      });
    }
    
    const outputText = response.output?.message?.content?.[0]?.text;
    if (outputText) {
      return outputText;
    }

    throw new Error('Invalid response format from Bedrock Converse API');
  }

  /**
   * Generate executive summary for summary tab
   */
  private async generateExecutiveSummary(
    visionSummary: string,
    pillarResults: Record<string, PillarResult>,
    language: 'ko' | 'en' = 'ko'
  ): Promise<string> {
    try {
      // 모든 권장사항 수집
      const allRecommendations = Object.values(pillarResults)
        .flatMap(r => r.recommendations || [])
        .slice(0, 10);
      
      // 모든 거버넌스 위반 수집
      const allViolations = Object.values(pillarResults)
        .flatMap(r => r.governanceViolations || []);

      let prompt: string;

      if (language === 'en') {
        prompt = `The following are the results of an architecture review based on the AWS Well-Architected Framework.
Write an **Executive Summary** for executives and decision-makers.

# Architecture Analysis (Nova + Claude Vision)
${visionSummary.substring(0, 3000)}

# Pillar Review Results
${Object.entries(pillarResults).map(([pillar, result]) => `
## ${pillar}
- Recommendations: ${result.recommendations?.length || 0}
- Policy violations: ${result.governanceViolations?.length || 0}
`).join('\n')}

# Key Recommendations (Top 10)
${allRecommendations.map((rec, i) => `${i + 1}. ${rec.substring(0, 200)}...`).join('\n')}

# Governance Policy Violations
${allViolations.map(v => `- [${v.severity}] ${v.policyTitle}: ${v.violationDescription}`).join('\n')}

---

**Writing Guidelines:**

Write the Executive Summary in English with the following structure:

## 📊 Architecture Diagram Analysis Summary
- Explain the system's purpose and business value in 2-3 sentences based on Vision analysis
- Briefly summarize key AWS services and architecture patterns
- Describe the overall structure and characteristics in non-technical language
- Briefly describe data flow and key components

## 🏗️ Analysis Summary by Architecture Area
Summarize key findings for each Well-Architected Pillar:

### Operational Excellence
- 1-2 key findings
- 1 key recommendation

### Security
- 1-2 key findings
- 1 key recommendation

### Reliability
- 1-2 key findings
- 1 key recommendation

### Performance Efficiency
- 1-2 key findings
- 1 key recommendation

### Cost Optimization
- 1-2 key findings
- 1 key recommendation

### Sustainability
- 1-2 key findings
- 1 key recommendation

## 📈 Overall Review Results
- Areas reviewed: ${Object.keys(pillarResults).length}
- Recommendations found: ${allRecommendations.length}
- Governance policy violations: ${allViolations.length}
- Overall architecture maturity assessment (High/Medium/Low)

## 🎯 Priority Action Items

### 🔴 High Priority (Immediate Action)
${allViolations.filter(v => v.severity === 'High').slice(0, 3).map((v, i) => `${i + 1}. ${v.policyTitle}: ${v.violationDescription.substring(0, 100)}...`).join('\n') || '- None'}

### 🟡 Medium Priority (Short-term Plan)
List top 3-5 recommendations briefly

### 🟢 Low Priority (Long-term Improvement)
Summarize long-term improvement items

## 💡 Expected Benefits
Expected benefits from applying improvements:
- Cost reduction estimates
- Performance improvement estimates
- Security enhancement estimates
- Operational efficiency improvement estimates

**Important**: 
- Use business language that executives can understand
- Minimize technical jargon and explain briefly when necessary
- Include specific numbers and impact assessments
- Use markdown format
- Write in English (keep AWS service names as-is)

Write the Executive Summary:`;
      } else {
        prompt = `다음은 AWS Well-Architected Framework 기반 아키텍처 검토 결과입니다.
경영진과 의사결정자를 위한 **Executive Summary**를 작성하세요.

# 아키텍처 분석 (Nova + Claude Vision)
${visionSummary.substring(0, 3000)}

# 6개 Pillar 검토 결과
${Object.entries(pillarResults).map(([pillar, result]) => `
## ${pillar}
- 권장사항: ${result.recommendations?.length || 0}개
- 정책 위반: ${result.governanceViolations?.length || 0}개
`).join('\n')}

# 주요 권장사항 (상위 10개)
${allRecommendations.map((rec, i) => `${i + 1}. ${rec.substring(0, 200)}...`).join('\n')}

# 거버넌스 정책 위반
${allViolations.map(v => `- [${v.severity}] ${v.policyTitle}: ${v.violationDescription}`).join('\n')}

---

**작성 지침:**

다음 구조로 Executive Summary를 한글로 작성하세요:

## 📊 아키텍처 다이어그램 분석 요약
- Vision 분석 결과를 바탕으로 시스템의 목적과 비즈니스 가치를 2-3문장으로 설명
- 주요 AWS 서비스와 아키텍처 패턴을 간단히 요약
- 전체적인 구조와 특징을 비기술적 언어로 설명
- 데이터 흐름과 주요 컴포넌트를 간략히 설명

## 🏗️ 아키텍처 영역별 분석 요약
각 Well-Architected Pillar별 주요 발견사항을 요약:

### 운영 우수성
- 주요 발견사항 1-2개
- 핵심 권장사항 1개

### 보안
- 주요 발견사항 1-2개
- 핵심 권장사항 1개

### 안정성
- 주요 발견사항 1-2개
- 핵심 권장사항 1개

### 성능 효율성
- 주요 발견사항 1-2개
- 핵심 권장사항 1개

### 비용 최적화
- 주요 발견사항 1-2개
- 핵심 권장사항 1개

### 지속 가능성
- 주요 발견사항 1-2개
- 핵심 권장사항 1개

## 📈 전체 검토 결과
- 검토된 영역: ${Object.keys(pillarResults).length}개
- 발견된 권장사항: ${allRecommendations.length}개
- 거버넌스 정책 위반: ${allViolations.length}개
- 전반적인 아키텍처 성숙도 평가 (상/중/하)

## 🎯 우선순위별 핵심 조치 사항

### 🔴 High Priority (즉시 조치)
${allViolations.filter(v => v.severity === 'High').slice(0, 3).map((v, i) => `${i + 1}. ${v.policyTitle}: ${v.violationDescription.substring(0, 100)}...`).join('\n') || '- 없음'}

### 🟡 Medium Priority (단기 계획)
상위 3-5개 권장사항을 간략히 나열

### 🟢 Low Priority (장기 개선)
장기적으로 개선할 사항 요약

## 💡 기대 효과
개선 사항 적용 시 예상되는 효과:
- 비용 절감 예상
- 성능 개선 예상
- 보안 강화 예상
- 운영 효율성 향상 예상

**중요**: 
- 경영진이 이해할 수 있는 비즈니스 언어 사용
- 기술 용어는 최소화하고 필요시 간단히 설명
- 구체적인 숫자와 영향도 포함
- 마크다운 형식 사용
- 한글로 작성 (AWS 서비스명은 영문 유지)

Executive Summary를 작성하세요:`;
      }

      const summary = await this.invokeBedrockModel(prompt, 'Executive Summary Generation');
      return summary;
    } catch (error) {
      console.error('Failed to generate executive summary:', error);
      // Fallback
      const totalRecommendations = Object.values(pillarResults)
        .reduce((sum, r) => sum + (r.recommendations?.length || 0), 0);
      const totalViolations = Object.values(pillarResults)
        .reduce((sum, r) => sum + (r.governanceViolations?.length || 0), 0);
      
      if (language === 'en') {
        return `## 📊 Review Results Summary

Review of ${Object.keys(pillarResults).length} pillars has been completed.

- **Recommendations**: ${totalRecommendations}
- **Policy violations**: ${totalViolations}

See the "Architecture Analysis" and "Pillar Review" tabs for details.`;
      }
      
      return `## 📊 검토 결과 요약

${Object.keys(pillarResults).length}개 원칙에 대한 검토가 완료되었습니다.

- **권장사항**: ${totalRecommendations}개
- **정책 위반**: ${totalViolations}개

상세 내용은 "아키텍처 분석" 및 "Pillar 검토" 탭에서 확인하세요.`;
    }
  }

  /**
   * Generate comprehensive architecture summary from Nova and Claude analyses
   */
  private async generateArchitectureSummary(
    novaAnalysis: string,
    claudeAnalysis: string,
    extractedText: string
  ): Promise<string> {
    try {
      const prompt = `다음은 동일한 아키텍처 다이어그램에 대한 두 가지 AI 분석 결과입니다.
이를 종합하여 아키텍처의 특성을 잘 표현하는 통합 설명을 작성하세요.

# Nova Lite 분석 (한글 텍스트 중심)
${novaAnalysis}

# Claude Vision 분석 (시각적 구조 중심)
${claudeAnalysis}

# 추출된 텍스트
${extractedText.substring(0, 2000)}

---

**작성 지침:**
1. 두 분석 결과를 통합하여 아키텍처의 전체적인 특성을 설명
2. 다음 구조로 작성:
   - **아키텍처 개요**: 시스템의 목적과 전체 구조를 2-3문장으로 요약
   - **주요 구성 요소**: 핵심 AWS 서비스와 컴포넌트를 그룹화하여 설명
   - **데이터 흐름**: 데이터가 어떻게 흐르는지 단계별로 설명
   - **보안 및 네트워크**: VPC, 보안 그룹, IAM 등 보안 구성
   - **아키텍처 특징**: 고가용성, 확장성, 비용 최적화 등 주요 특징

3. 단순 나열이 아닌 **스토리텔링 방식**으로 작성
4. 한글로 작성하되 AWS 서비스명은 영문 유지
5. 마크다운 형식 사용 (제목, 리스트, 강조 등)

통합 아키텍처 설명을 작성하세요:`;

      const response = await this.invokeBedrockModel(prompt, 'Architecture Summary Generation');
      console.log('Architecture summary generated:', response.substring(0, 200));
      return response;
    } catch (error) {
      console.error('Failed to generate comprehensive summary:', error);
      // Fallback: Nova와 Claude 분석을 단순 결합
      return `## Nova Lite 분석\n\n${novaAnalysis}\n\n## Claude Vision 분석\n\n${claudeAnalysis}`;
    }
  }

  /**
   * Analyze image with Vision model (Claude or others)
   */
  private async analyzeImageWithVision(
    imageBuffer: Buffer,
    mediaType: string,
    modelId: string = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    maxTokens: number = 4096,
    temperature: number = 0.7,
    customPrompt?: string
  ): Promise<string> {
    try {
      const analysisPrompt = customPrompt || `이 아키텍처 다이어그램을 상세히 분석하여 한글로 작성하세요:

## 분석 항목

1. **주요 AWS 서비스 및 컴포넌트**
   - 다이어그램에 표시된 모든 AWS 서비스 나열
   - 각 서비스의 역할과 목적

2. **데이터 흐름 및 연결**
   - 데이터가 어떻게 흐르는지 단계별 설명
   - 서비스 간 연결 관계

3. **보안 구성**
   - VPC, Subnet 구성
   - IAM 역할 및 권한
   - 암호화 및 보안 경계

4. **네트워크 아키텍처**
   - VPC 구조
   - Public/Private Subnet 배치

5. **아키텍처 패턴 및 특징**
   - 사용된 설계 패턴
   - 고가용성, 확장성 고려사항

**중요**: 다이어그램의 텍스트와 레이블을 정확히 읽고, 구체적으로 작성하세요.`;

      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBuffer.toString('base64'),
              },
            },
            {
              type: 'text',
              text: analysisPrompt,
            },
          ],
        }],
      };

      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      // Track cost
      if (this.costTracker && responseBody.usage) {
        this.costTracker.trackBedrockInvocation({
          modelId,
          inputTokens: responseBody.usage.input_tokens || 0,
          outputTokens: responseBody.usage.output_tokens || 0,
          operation: `Vision Analysis - Image (${modelId.split('.').pop()})`,
          imageCount: 1,
        });
      } else if (this.costTracker) {
        const responseText = responseBody.content?.[0]?.text || '';
        this.costTracker.trackBedrockInvocation({
          modelId,
          inputTokens: Math.ceil(analysisPrompt.length / 4),
          outputTokens: Math.ceil(responseText.length / 4),
          operation: `Vision Analysis - Image (${modelId.split('.').pop()})`,
          imageCount: 1,
        });
      }
      
      if (responseBody.content && responseBody.content.length > 0) {
        return responseBody.content[0].text;
      }

      const errorMsg = 'Vision API returned empty content';
      console.error('Vision analysis error:', {
        error: errorMsg,
        responseBody: JSON.stringify(responseBody),
        imageSize: imageBuffer.length,
        mediaType
      });
      throw new Error(errorMsg);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        imageSize: imageBuffer.length,
        mediaType,
        modelId: 'us.anthropic.claude-opus-4-5-20251101-v1:0'
      };
      
      if (error && typeof error === 'object' && '$metadata' in error) {
        Object.assign(errorDetails, {
          httpStatusCode: (error as any).$metadata?.httpStatusCode,
          requestId: (error as any).$metadata?.requestId,
          awsErrorCode: (error as any).name
        });
      }
      
      console.error('Vision analysis error:', errorDetails);
      throw error;
    }
  }

  /**
   * Extract AWS service names from text
   */
  private extractAwsServices(text: string): string[] {
    const services = [
      'EC2', 'S3', 'Lambda', 'RDS', 'DynamoDB', 'VPC', 'CloudFront', 'Route 53',
      'ELB', 'ALB', 'NLB', 'API Gateway', 'CloudWatch', 'IAM', 'KMS', 'Secrets Manager',
      'QuickSight', 'Redshift', 'Athena', 'Glue', 'EMR', 'Kinesis', 'SQS', 'SNS',
      'Step Functions', 'EventBridge', 'ECS', 'EKS', 'Fargate', 'Aurora', 'Neptune',
      'ElastiCache', 'CloudFormation', 'CDK', 'Systems Manager', 'Config', 'GuardDuty',
      'Security Hub', 'WAF', 'Shield', 'Cognito', 'STS', 'Organizations'
    ];
    
    const found: string[] = [];
    const textUpper = text.toUpperCase();
    
    for (const service of services) {
      if (textUpper.includes(service.toUpperCase())) {
        found.push(service);
      }
    }
    
    return [...new Set(found)];
  }
  
  /**
   * Detect architecture patterns from text
   */
  private detectArchitecturePatterns(text: string): string[] {
    const patterns: string[] = [];
    const textLower = text.toLowerCase();
    
    if (textLower.includes('multi') && (textLower.includes('az') || textLower.includes('가용 영역'))) {
      patterns.push('Multi-AZ 고가용성 구성');
    }
    
    if (textLower.includes('vpc') && textLower.includes('subnet')) {
      patterns.push('VPC 네트워크 분리');
    }
    
    if (textLower.includes('load balancer') || textLower.includes('alb') || textLower.includes('nlb')) {
      patterns.push('로드 밸런싱');
    }
    
    if (textLower.includes('auto scaling') || textLower.includes('오토 스케일링')) {
      patterns.push('Auto Scaling');
    }
    
    if (textLower.includes('serverless') || textLower.includes('lambda')) {
      patterns.push('서버리스 아키텍처');
    }
    
    if (textLower.includes('microservice') || textLower.includes('마이크로서비스')) {
      patterns.push('마이크로서비스 아키텍처');
    }
    
    if (textLower.includes('data lake') || textLower.includes('데이터 레이크')) {
      patterns.push('데이터 레이크');
    }
    
    if (textLower.includes('etl') || textLower.includes('glue')) {
      patterns.push('ETL 파이프라인');
    }
    
    return patterns;
  }

  /**
   * Analyze architecture document against governance policies using Bedrock
   */
  async analyzeGovernanceCompliance(
    documentContent: string,
    policies: Array<{ policy: GovernancePolicy; buffer: Buffer }>,
    language: 'ko' | 'en' = 'ko'
  ): Promise<GovernanceAnalysisResult> {
    const policyResults: GovernanceComplianceResult[] = [];

    for (const { policy, buffer } of policies) {
      try {
        console.log(`Analyzing compliance for policy: ${policy.title}`);

        let policyText = '';
        if (policy.fileName?.endsWith('.pdf')) {
          // PDF 정책 문서의 텍스트를 Nova Lite로 추출
          try {
            console.log(`Extracting text from PDF policy: ${policy.title} (${(buffer.length / 1024).toFixed(1)} KB)`);
            policyText = await this.extractPdfPolicyText(buffer, policy.title);
            console.log(`Extracted ${policyText.length} chars from PDF policy: ${policy.title}`);
          } catch (extractError) {
            console.warn(`Failed to extract PDF policy text for ${policy.title}:`, extractError);
            policyText = `[PDF Policy Document: ${policy.title}]\nDescription: ${policy.description}\nFile size: ${(buffer.length / 1024).toFixed(1)} KB\n\nNote: PDF text extraction failed. Analysis based on metadata only.`;
          }
        } else {
          policyText = buffer.toString('utf-8').substring(0, 15000);
        }

        const prompt = language === 'en'
          ? `You are a governance compliance analyst. Analyze whether the following architecture document complies with the given governance policy.

=== GOVERNANCE POLICY ===
Title: ${policy.title}
Description: ${policy.description}
Content:
${policyText}

=== ARCHITECTURE DOCUMENT ===
${documentContent.substring(0, 15000)}

=== ANALYSIS INSTRUCTIONS ===
Analyze the architecture document against the governance policy and respond in the following JSON format ONLY (no markdown, no code blocks):

{
  "status": "Compliant" or "Non-Compliant" or "Partially Compliant" or "Not Applicable",
  "findings": "Overall analysis summary in 2-3 sentences",
  "violations": [
    {
      "rule": "Policy rule that was violated",
      "description": "Description of the violation",
      "severity": "High" or "Medium" or "Low",
      "recommendation": "Recommended corrective action"
    }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

IMPORTANT: Return ONLY valid JSON. No markdown formatting, no code blocks.`
          : `당신은 거버넌스 준수 분석가입니다. 다음 아키텍처 문서가 주어진 거버넌스 정책을 준수하는지 분석하세요.

=== 거버넌스 정책 ===
제목: ${policy.title}
설명: ${policy.description}
내용:
${policyText}

=== 아키텍처 문서 ===
${documentContent.substring(0, 15000)}

=== 분석 지침 ===
아키텍처 문서를 거버넌스 정책과 대조하여 분석하고, 다음 JSON 형식으로만 응답하세요 (마크다운 없이, 코드 블록 없이):

{
  "status": "Compliant" 또는 "Non-Compliant" 또는 "Partially Compliant" 또는 "Not Applicable",
  "findings": "전체 분석 요약 2-3문장",
  "violations": [
    {
      "rule": "위반된 정책 규칙",
      "description": "위반 내용 설명",
      "severity": "High" 또는 "Medium" 또는 "Low",
      "recommendation": "권장 시정 조치"
    }
  ],
  "recommendations": ["권장사항 1", "권장사항 2"]
}

중요: 유효한 JSON만 반환하세요. 마크다운 형식이나 코드 블록을 사용하지 마세요.`;

        const response = await this.invokeBedrockModel(prompt, `Governance Compliance - ${policy.title}`);

        let parsed: any;
        try {
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch (parseError) {
          console.warn(`Failed to parse governance analysis for ${policy.title}:`, parseError);
          parsed = {
            status: 'Not Applicable',
            findings: response.substring(0, 500),
            violations: [],
            recommendations: [],
          };
        }

        policyResults.push({
          policyId: policy.policyId,
          policyTitle: policy.title,
          status: parsed.status || 'Not Applicable',
          findings: parsed.findings || '',
          violations: (parsed.violations || []).map((v: any) => ({
            rule: v.rule || '',
            description: v.description || '',
            severity: v.severity || 'Medium',
            recommendation: v.recommendation || '',
          })),
          recommendations: parsed.recommendations || [],
        });
      } catch (error) {
        console.error(`Governance analysis failed for policy ${policy.title}:`, error);
        policyResults.push({
          policyId: policy.policyId,
          policyTitle: policy.title,
          status: 'Not Applicable',
          findings: `Analysis failed: ${(error as Error).message}`,
          violations: [],
          recommendations: [],
        });
      }
    }

    const compliantCount = policyResults.filter(r => r.status === 'Compliant').length;
    const nonCompliantCount = policyResults.filter(r => r.status === 'Non-Compliant').length;
    const partiallyCompliantCount = policyResults.filter(r => r.status === 'Partially Compliant').length;
    const notApplicableCount = policyResults.filter(r => r.status === 'Not Applicable').length;

    let overallStatus: 'Compliant' | 'Non-Compliant' | 'Partially Compliant' = 'Compliant';
    if (nonCompliantCount > 0) overallStatus = 'Non-Compliant';
    else if (partiallyCompliantCount > 0) overallStatus = 'Partially Compliant';

    const summary = language === 'en'
      ? `Governance compliance analysis completed for ${policyResults.length} policies. Compliant: ${compliantCount}, Non-Compliant: ${nonCompliantCount}, Partially Compliant: ${partiallyCompliantCount}, Not Applicable: ${notApplicableCount}.`
      : `${policyResults.length}개 거버넌스 정책에 대한 준수 분석이 완료되었습니다. 준수: ${compliantCount}개, 미준수: ${nonCompliantCount}개, 부분 준수: ${partiallyCompliantCount}개, 해당 없음: ${notApplicableCount}개.`;

    return {
      analyzedAt: new Date().toISOString(),
      totalPolicies: policyResults.length,
      compliantCount,
      nonCompliantCount,
      partiallyCompliantCount,
      notApplicableCount,
      policyResults,
      overallStatus,
      summary,
    };
  }

  /**
   * Extract full text content from a PDF document using Nova Lite
   * Used to provide complete document context to pillar review models
   */
  private async extractPdfFullText(pdfBuffer: Buffer): Promise<string> {
    const payload = {
      messages: [{
        role: 'user' as const,
        content: [
          {
            document: {
              format: 'pdf',
              name: 'document.pdf',
              source: {
                bytes: pdfBuffer.toString('base64'),
              },
            },
          },
          {
            text: `이 PDF 문서의 전체 텍스트 내용을 페이지별로 추출하세요.

각 페이지의 내용을 다음 형식으로 작성하세요:

--- 페이지 1 ---
[페이지 1의 전체 텍스트 내용]

--- 페이지 2 ---
[페이지 2의 전체 텍스트 내용]

...

**지침:**
- 모든 텍스트를 빠짐없이 추출하세요 (제목, 본문, 표, 목록, 주석 등)
- 표는 텍스트 형태로 변환하세요
- 다이어그램의 레이블과 텍스트도 포함하세요
- 요약하지 말고 원문 그대로 추출하세요
- 페이지 번호를 정확히 표시하세요`,
          },
        ],
      }],
      inferenceConfig: {
        maxTokens: 10240,
        temperature: 0.1,
      },
    };

    const command = new InvokeModelCommand({
      modelId: 'us.amazon.nova-lite-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await this.bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Track cost
    if (this.costTracker) {
      const usage = responseBody.usage;
      this.costTracker.trackBedrockInvocation({
        modelId: 'us.amazon.nova-lite-v1:0',
        inputTokens: usage?.inputTokens || usage?.input_tokens || Math.ceil(pdfBuffer.length / 4),
        outputTokens: usage?.outputTokens || usage?.output_tokens || 500,
        operation: 'Nova Lite - Full PDF Text Extraction',
      });
    }

    if (responseBody.output?.message?.content) {
      const textContent = responseBody.output.message.content.find((c: any) => c.text);
      if (textContent) {
        return textContent.text;
      }
    }

    throw new Error('Failed to extract full text from PDF');
  }

  /**
   * Extract text content from a PDF policy document using Nova Lite
   */
  private async extractPdfPolicyText(pdfBuffer: Buffer, policyTitle: string): Promise<string> {
    const payload = {
      messages: [{
        role: 'user' as const,
        content: [
          {
            document: {
              format: 'pdf',
              name: 'policy.pdf',
              source: {
                bytes: pdfBuffer.toString('base64'),
              },
            },
          },
          {
            text: `이 PDF 문서의 전체 텍스트 내용을 그대로 추출하세요. 
문서의 모든 섹션, 규칙, 요구사항, 지침을 빠짐없이 포함하세요.
형식을 유지하면서 텍스트만 추출하세요. 요약하지 말고 원문 그대로 추출하세요.`,
          },
        ],
      }],
      inferenceConfig: {
        maxTokens: 8192,
        temperature: 0.1,
      },
    };

    const command = new InvokeModelCommand({
      modelId: 'us.amazon.nova-lite-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await this.bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Track cost
    if (this.costTracker) {
      const usage = responseBody.usage;
      this.costTracker.trackBedrockInvocation({
        modelId: 'us.amazon.nova-lite-v1:0',
        inputTokens: usage?.inputTokens || usage?.input_tokens || Math.ceil(pdfBuffer.length / 4),
        outputTokens: usage?.outputTokens || usage?.output_tokens || 500,
        operation: `Nova Lite - PDF Policy Text Extraction (${policyTitle})`,
      });
    }

    if (responseBody.output?.message?.content) {
      const textContent = responseBody.output.message.content.find((c: any) => c.text);
      if (textContent) {
        return textContent.text.substring(0, 15000);
      }
    }

    throw new Error('Failed to extract text from PDF policy');
  }

  /**
   * Parse Bedrock response
   */
  private parseBedrockResponse(response: string): {
    findings: string;
    recommendations: string[];
  } {
    console.log(`Parsing Bedrock response (${response.length} chars)`);
    
    const sections = response.split(/\n(?=##\s)/);
    
    let findings = '';
    let recommendationSection = '';

    for (const section of sections) {
      const lower = section.toLowerCase();
      
      if (lower.includes('권장사항') || lower.includes('recommendation')) {
        recommendationSection = section;
      } else if (lower.includes('발견사항') || lower.includes('finding') || 
                 lower.includes('분석') || lower.includes('analysis')) {
        findings += section + '\n\n';
      }
    }

    const recommendations: string[] = [];
    
    if (recommendationSection) {
      const recParts = recommendationSection.split(/\n(?=\d+\.\s)/);
      
      for (const part of recParts) {
        const trimmed = part.trim();
        if (trimmed.startsWith('##') || trimmed.length < 20) continue;
        
        const cleaned = trimmed.replace(/^\d+\.\s*/, '').trim();
        if (cleaned.length > 20) {
          recommendations.push(cleaned);
        }
      }
    }

    if (!findings || findings.length < 100) {
      const beforeRec = response.split(/##\s*권장사항|##\s*Recommendation/i)[0];
      findings = beforeRec || response;
    }

    if (recommendations.length === 0) {
      recommendations.push('Please refer to the findings above for detailed review results. / 상세한 검토 결과는 위의 발견사항을 참고하세요.');
    }

    return { findings: findings.trim(), recommendations };
  }
}
