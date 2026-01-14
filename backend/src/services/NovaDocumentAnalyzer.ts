/**
 * Amazon Nova Document Analyzer
 * Uses Amazon Nova Lite for multilingual PDF analysis (including Korean)
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export interface NovaPageAnalysis {
  pageNumber: number;
  text: string;
  hasArchitecture: boolean;
  confidence: number;
}

export class NovaDocumentAnalyzer {
  private bedrockClient: BedrockRuntimeClient;

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
  }

  /**
   * Analyze PDF with Amazon Nova Lite (supports Korean)
   */
  async analyzePdf(pdfBuffer: Buffer): Promise<{
    pageCount: number;
    pages: NovaPageAnalysis[];
  }> {
    try {
      console.log('Analyzing PDF with Amazon Nova Lite (multilingual)...');
      
      const payload = {
        messages: [{
          role: 'user',
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
              text: `이 PDF 문서의 각 페이지를 분석하여 다음 형식으로 반환하세요:

TOTAL_PAGES: [전체 페이지 수]

PAGE 1
TEXT: [페이지 1의 주요 내용을 한 문장으로 요약]
ARCHITECTURE: [YES 또는 NO]
CONFIDENCE: [0-100]

PAGE 2
TEXT: [페이지 2의 주요 내용을 한 문장으로 요약]
ARCHITECTURE: [YES 또는 NO]
CONFIDENCE: [0-100]

...계속...

**아키텍처 다이어그램 판단 기준 (매우 중요!):**

다음 중 **하나라도 해당하면 ARCHITECTURE: YES**로 판단하세요:

1. **시각적 다이어그램 요소**
   - 박스, 화살표, 연결선이 있는 구성도
   - 시스템 구조를 보여주는 그림/차트
   - 네트워크 토폴로지 다이어그램
   - 데이터 흐름도 (Data Flow Diagram)
   - 시퀀스 다이어그램

2. **AWS 서비스 아이콘/로고**
   - AWS 서비스 아이콘이 포함된 다이어그램
   - VPC, Subnet, EC2, Lambda, S3, RDS 등의 시각적 표현

3. **아키텍처 관련 키워드 (3개 이상)**
   - 아키텍처, 구성도, 다이어그램, Architecture, Diagram
   - AWS, VPC, Lambda, S3, EC2, RDS, DynamoDB, QuickSight
   - 시스템 구성, 인프라, Infrastructure, 네트워크, Network
   - API Gateway, Load Balancer, CloudFront, Route 53
   - 데이터베이스, Database, 스토리지, Storage
   - 보안 그룹, Security Group, IAM, 암호화

4. **계층 구조 설명**
   - 프론트엔드/백엔드/데이터베이스 계층 구분
   - 3-tier, N-tier 아키텍처 언급
   - 마이크로서비스 구조 설명

**CONFIDENCE 점수 계산:**
- 시각적 다이어그램 있음: +40점
- AWS 서비스 3개 이상: +30점
- 아키텍처 키워드 5개 이상: +20점
- 데이터 흐름 설명: +10점

**예시:**
- 표지, 목차, 소개 페이지 → ARCHITECTURE: NO, CONFIDENCE: 10-30
- AWS 서비스 나열만 있는 페이지 → ARCHITECTURE: NO, CONFIDENCE: 40-60
- 다이어그램이 있는 페이지 → ARCHITECTURE: YES, CONFIDENCE: 70-100

각 페이지를 신중히 분석하여 위 형식으로 반환하세요:`,
            },
          ],
        }],
        inferenceConfig: {
          maxTokens: 8192,
          temperature: 0.3,
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
      
      if (responseBody.output?.message?.content) {
        const textContent = responseBody.output.message.content.find((c: any) => c.text);
        if (textContent) {
          let responseText = textContent.text;
          console.log('Nova response (first 1000 chars):', responseText.substring(0, 1000));
          
          // Parse simple text format instead of JSON
          const result = this.parseNovaTextResponse(responseText);
          
          if (result) {
            console.log(`Nova analyzed ${result.pageCount} pages, ${result.pages.filter((p: any) => p.hasArchitecture).length} with architecture`);
            return result;
          }
        }
      }

      console.error('Invalid Nova response structure');
      throw new Error('Invalid response from Nova');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        pdfSize: pdfBuffer.length,
      };
      
      // AWS SDK 에러
      if (error && typeof error === 'object' && '$metadata' in error) {
        Object.assign(errorDetails, {
          httpStatusCode: (error as any).$metadata?.httpStatusCode,
          requestId: (error as any).$metadata?.requestId,
          errorCode: (error as any).name,
        });
      }
      
      console.error('Nova PDF analysis failed:', errorDetails);
      throw error;
    }
  }

  /**
   * Parse Nova's simple text response format
   */
  private parseNovaTextResponse(text: string): {
    pageCount: number;
    pages: NovaPageAnalysis[];
  } | null {
    try {
      // Extract total pages
      const totalPagesMatch = text.match(/TOTAL_PAGES:\s*(\d+)/i);
      if (!totalPagesMatch) {
        console.error('Could not find TOTAL_PAGES in response');
        return null;
      }
      
      const pageCount = parseInt(totalPagesMatch[1], 10);
      const pages: NovaPageAnalysis[] = [];
      
      // Extract each page
      const pagePattern = /PAGE\s+(\d+)\s+TEXT:\s*([^\n]+)\s+ARCHITECTURE:\s*(YES|NO)\s+CONFIDENCE:\s*(\d+)/gi;
      let match;
      
      while ((match = pagePattern.exec(text)) !== null) {
        const pageNumber = parseInt(match[1], 10);
        const pageText = match[2].trim();
        const hasArchitecture = match[3].toUpperCase() === 'YES';
        const confidence = parseInt(match[4], 10);
        
        pages.push({
          pageNumber,
          text: pageText,
          hasArchitecture,
          confidence,
        });
      }
      
      if (pages.length === 0) {
        console.error('No pages found in Nova response');
        return null;
      }
      
      console.log(`Parsed ${pages.length} pages from Nova response`);
      return { pageCount, pages };
    } catch (error) {
      console.error('Error parsing Nova text response:', error);
      return null;
    }
  }

  /**
   * Fix malformed Unicode escape sequences in JSON string
   */
  private fixUnicodeEscapes(text: string): string {
    try {
      // Replace malformed Unicode escapes with safe characters
      // Pattern: \uXXXX where XXXX is not a valid hex number
      text = text.replace(/\\u([0-9a-fA-F]{0,3}(?![0-9a-fA-F]))/g, (_match, hex) => {
        // If incomplete hex, pad with zeros
        const paddedHex = hex.padEnd(4, '0');
        return `\\u${paddedHex}`;
      });
      
      // Remove any remaining invalid escape sequences
      text = text.replace(/\\u(?![0-9a-fA-F]{4})/g, '');
      
      // Fix common Korean character issues
      // Replace sequences of \u00b7 (middle dot) that might be corrupted
      text = text.replace(/\\u00b7+/g, '·');
      
      return text;
    } catch (error) {
      console.error('Error fixing Unicode escapes:', error);
      return text;
    }
  }

  /**
   * Sanitize JSON string to fix common issues
   */
  private sanitizeJsonString(text: string): string {
    try {
      // First, try to extract just the JSON object
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return text;
      }
      
      let jsonStr = jsonMatch[0];
      
      // Fix unescaped newlines within string values
      // This regex finds "text": "..." patterns and fixes newlines inside
      jsonStr = jsonStr.replace(/"text"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g, (_match, content) => {
        // Replace actual newlines with \n
        const fixed = content.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        return `"text": "${fixed}"`;
      });
      
      // Fix unescaped quotes within string values (but not the closing quote)
      jsonStr = jsonStr.replace(/"text"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g, (match, _content) => {
        // This is already handled by the JSON structure, but ensure no unescaped quotes
        return match;
      });
      
      return jsonStr;
    } catch (error) {
      console.error('Error sanitizing JSON:', error);
      return text;
    }
  }

  /**
   * Analyze specific PDF page with Nova Vision
   */
  async analyzePageWithNova(
    pdfBuffer: Buffer,
    pageNumber: number,
    modelId: string = 'us.amazon.nova-lite-v1:0',
    maxTokens: number = 8192,
    temperature: number = 0.3,
    customPrompt?: string
  ): Promise<string> {
    try {
      console.log(`Analyzing page ${pageNumber} with Amazon Nova Lite Vision...`);
      
      // Use custom prompt if provided, otherwise use default
      const analysisPrompt = customPrompt || this.getDefaultVisionPrompt();
      
      const payload = {
        messages: [{
          role: 'user',
          content: [
            {
              document: {
                format: 'pdf',
                name: `page-${pageNumber}.pdf`,
                source: {
                  bytes: pdfBuffer.toString('base64'),
                },
              },
            },
            {
              text: analysisPrompt,
            },
          ],
        }],
        inferenceConfig: {
          maxTokens,
          temperature,
        },
      };

      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      if (responseBody.output?.message?.content) {
        const textContent = responseBody.output.message.content.find((c: any) => c.text);
        if (textContent) {
          return textContent.text;
        }
      }

      throw new Error('Invalid response from Nova');
    } catch (error) {
      console.error('Nova page analysis failed:', error);
      throw error;
    }
  }

  /**
   * Select best architecture page
   */
  selectBestPage(pages: NovaPageAnalysis[]): NovaPageAnalysis | null {
    const candidates = pages.filter(p => p.hasArchitecture);
    
    if (candidates.length === 0) {
      console.log('No architecture pages found');
      return null;
    }
    
    candidates.sort((a, b) => b.confidence - a.confidence);
    
    const best = candidates[0];
    console.log(`Selected page ${best.pageNumber} (confidence: ${best.confidence}%)`);
    
    return best;
  }

  /**
   * Extract single page from PDF
   */
  async extractPdfPage(pdfBuffer: Buffer, _pageNumber: number): Promise<Buffer> {
    // For Nova, we can pass the full PDF and specify page in prompt
    // Or use pdf-lib to extract single page
    // For now, return full PDF (Nova will handle it)
    return pdfBuffer;
  }

  /**
   * Get default vision prompt
   */
  private getDefaultVisionPrompt(): string {
    return `이 PDF 페이지의 아키텍처 다이어그램을 상세히 분석하여 구조적이고 기술적인 설명을 작성하세요.

# 분석 구조

## 1. 🎯 아키텍처 개요
**시스템의 목적과 전체 구조를 2-3문장으로 요약하세요.**

## 2. 🏗️ 주요 구성 요소
**다이어그램에 표시된 모든 AWS 서비스와 컴포넌트를 계층별로 그룹화하여 설명하세요.**

## 3. 🔄 데이터 흐름 분석
**데이터가 시스템을 통해 어떻게 흐르는지 단계별로 설명하세요.**

## 4. 🔒 보안 및 네트워크 구성
**보안 아키텍처를 상세히 설명하세요.**

## 5. ⚡ 아키텍처 특징 및 패턴
**이 아키텍처의 주요 특징과 설계 패턴을 설명하세요.**

## 6. 📊 기술 스택 요약
**사용된 모든 AWS 서비스를 카테고리별로 정리하세요.**

위 구조에 따라 아키텍처 다이어그램을 상세히 분석하세요:`;
  }
}
