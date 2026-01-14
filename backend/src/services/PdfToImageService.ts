/**
 * PDF to Image Conversion Service
 * Uses Python Lambda function with PyMuPDF
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export class PdfToImageService {
  private lambdaClient: LambdaClient;
  private converterFunctionName: string;

  constructor() {
    this.lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.converterFunctionName = process.env.PDF_CONVERTER_FUNCTION_NAME || '';
    
    if (!this.converterFunctionName) {
      console.warn('PDF_CONVERTER_FUNCTION_NAME not set, PDF to image conversion will fail');
    }
  }

  /**
   * Convert PDF page to PNG image using Python Lambda + PyMuPDF
   */
  async convertPdfPageToImage(
    pdfBuffer: Buffer,
    pageNumber: number,
    s3Bucket?: string,
    s3Key?: string,
    dpi: number = 150
  ): Promise<Buffer> {
    try {
      console.log(`Converting PDF page ${pageNumber} to image (DPI: ${dpi})...`);
      
      // Prepare payload
      const payload: any = {
        pageNumber,
        dpi,
      };
      
      // If S3 location provided, use it (more efficient)
      if (s3Bucket && s3Key) {
        payload.s3Bucket = s3Bucket;
        payload.s3Key = s3Key;
        console.log(`Using S3 source: s3://${s3Bucket}/${s3Key}`);
      } else {
        // Otherwise, send PDF as base64 (less efficient, size limit)
        payload.pdfBase64 = pdfBuffer.toString('base64');
        console.log(`Using inline PDF: ${(pdfBuffer.length / 1024).toFixed(1)}KB`);
      }
      
      // Invoke Python Lambda
      const command = new InvokeCommand({
        FunctionName: this.converterFunctionName,
        Payload: JSON.stringify(payload),
      });
      
      const response = await this.lambdaClient.send(command);
      
      if (!response.Payload) {
        throw new Error('No response from PDF converter');
      }
      
      // Parse response
      const result = JSON.parse(new TextDecoder().decode(response.Payload));
      
      if (result.statusCode !== 200) {
        const error = JSON.parse(result.body);
        throw new Error(`PDF conversion failed: ${error.error}`);
      }
      
      const data = JSON.parse(result.body);
      
      // Decode base64 image
      const imageBuffer = Buffer.from(data.imageBase64, 'base64');
      
      console.log(`✅ Converted page ${pageNumber}: ${data.width}x${data.height} pixels, ${(imageBuffer.length / 1024).toFixed(1)}KB`);
      
      return imageBuffer;
    } catch (error) {
      console.error('PDF to image conversion failed:', error);
      throw error;
    }
  }
  
  /**
   * Check if PDF converter is available
   */
  async checkConverterAvailable(): Promise<boolean> {
    try {
      if (!this.converterFunctionName) {
        return false;
      }
      
      // Test invoke with minimal payload
      const command = new InvokeCommand({
        FunctionName: this.converterFunctionName,
        Payload: JSON.stringify({ test: true }),
      });
      
      await this.lambdaClient.send(command);
      return true;
    } catch (error) {
      console.error('PDF converter not available:', error);
      return false;
    }
  }
}


export interface PdfPageAnalysis {
  pageNumber: number;
  text: string;
  hasArchitectureKeywords: boolean;
  confidence: number;
  blockCount: number;
}

export class TextractPdfAnalyzer {
  private textractClient: any;

  constructor(textractClient: any) {
    this.textractClient = textractClient;
  }

  /**
   * Analyze PDF with Textract
   */
  async analyzePdf(pdfBuffer: Buffer): Promise<{
    pageCount: number;
    pages: PdfPageAnalysis[];
  }> {
    const { DetectDocumentTextCommand } = await import('@aws-sdk/client-textract');
    
    const command = new DetectDocumentTextCommand({
      Document: { Bytes: pdfBuffer },
    });

    const response = await this.textractClient.send(command);
    const blocks = response.Blocks || [];
    
    // 페이지별 그룹화
    const pageBlocks = new Map<number, any[]>();
    for (const block of blocks) {
      const pageNum = block.Page || 1;
      if (!pageBlocks.has(pageNum)) pageBlocks.set(pageNum, []);
      pageBlocks.get(pageNum)!.push(block);
    }
    
    const pages: PdfPageAnalysis[] = [];
    const keywords = [
      '아키텍처', '구성도', '다이어그램', 'architecture', 'diagram',
      'AWS', 'VPC', 'Lambda', 'S3', 'EC2', 'RDS', 'QuickSight'
    ];
    
    for (const [pageNum, blocks] of pageBlocks.entries()) {
      const text = blocks
        .filter((b: any) => b.BlockType === 'LINE' && b.Text)
        .map((b: any) => b.Text)
        .join(' ');
      
      let confidence = 0;
      const textLower = text.toLowerCase();
      
      if (textLower.includes('아키텍처') || textLower.includes('architecture')) confidence += 30;
      if (textLower.includes('구성도') || textLower.includes('diagram')) confidence += 30;
      
      keywords.forEach(kw => {
        if (textLower.includes(kw.toLowerCase())) confidence += 5;
      });
      
      if (blocks.length > 100) confidence += 10;
      
      confidence = Math.min(confidence, 100);
      
      pages.push({
        pageNumber: pageNum,
        text,
        hasArchitectureKeywords: confidence > 0,
        confidence,
        blockCount: blocks.length,
      });
    }
    
    pages.sort((a, b) => a.pageNumber - b.pageNumber);
    
    return { pageCount: pages.length, pages };
  }
  
  /**
   * Select best architecture page
   */
  selectBestPage(pages: PdfPageAnalysis[]): PdfPageAnalysis | null {
    const candidates = pages.filter(p => p.hasArchitectureKeywords);
    if (candidates.length === 0) return null;
    
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0];
  }
}
