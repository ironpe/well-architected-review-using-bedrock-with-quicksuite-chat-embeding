/**
 * Report Generation Service - PDF and Word report generation
 * Requirements: 5.3, 5.4, 5.5
 */

import PDFDocument from 'pdfkit';
import { Document as DocxDocument, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { environment } from '../config/environment.js';
import { ReviewReport, PillarResult } from '../types/index.js';

export class ReportGenerationService {
  private s3Client: S3Client;
  private reportsBucket: string;

  constructor() {
    this.s3Client = new S3Client({ region: environment.aws.region });
    this.reportsBucket = environment.s3.reportsBucket;
  }

  /**
   * Generate PDF report
   * Requirements: 5.3, 5.5
   */
  async generatePDF(report: ReviewReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ 
        margin: 50,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        // 한글 폰트 등록
        const fontPath = './fonts/NotoSansKR-Regular.ttf';
        doc.registerFont('NotoSansKR', fontPath);
        doc.font('NotoSansKR');
      } catch (error) {
        console.warn('Failed to load Korean font, using default font:', error);
      }
      
      // Title Page
      doc.fontSize(28).text('아키텍처 검토 리포트', { align: 'center' });
      doc.fontSize(20).text('Architecture Review Report', { align: 'center' });
      doc.moveDown(3);

      // Metadata
      doc.fontSize(12);
      doc.text(`검토 요청 ID: ${report.reviewRequestId}`);
      doc.text(`문서 ID: ${report.documentId}`);
      doc.text(`버전: ${report.versionNumber}`);
      doc.text(`생성 일시: ${new Date(report.generatedAt).toLocaleString('ko-KR')}`);
      doc.moveDown(2);

      // Table of Contents
      doc.addPage();
      doc.fontSize(20).text('목차', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text('1. 종합 요약 (Executive Summary)');
      doc.text('2. 아키텍처 다이어그램 분석');
      doc.text('3. 아키텍처 영역별 분석 (6개 Pillar)');
      doc.text('   3.1 운영 우수성 (Operational Excellence)');
      doc.text('   3.2 보안 (Security)');
      doc.text('   3.3 안정성 (Reliability)');
      doc.text('   3.4 성능 효율성 (Performance Efficiency)');
      doc.text('   3.5 비용 최적화 (Cost Optimization)');
      doc.text('   3.6 지속 가능성 (Sustainability)');
      doc.moveDown(2);

      // 1. Executive Summary
      doc.addPage();
      doc.fontSize(22).text('1. 종합 요약', { underline: true });
      doc.fontSize(16).text('Executive Summary', { underline: false });
      doc.moveDown();
      
      if ((report as any).executiveSummary) {
        this.renderMarkdownToPDF((report as any).executiveSummary, doc);
      } else {
        doc.fontSize(11).text('Executive Summary가 생성되지 않았습니다.', { 
          lineGap: 5 
        });
      }
      doc.moveDown(2);

      // 2. Architecture Diagram Analysis
      doc.addPage();
      doc.fontSize(22).text('2. 아키텍처 다이어그램 분석', { underline: true });
      doc.fontSize(16).text('Architecture Diagram Analysis', { underline: false });
      doc.moveDown();
      
      if (report.overallSummary) {
        this.renderMarkdownToPDF(report.overallSummary, doc);
      } else {
        doc.fontSize(11).text('아키텍처 다이어그램 분석이 없습니다.', { 
          lineGap: 5 
        });
      }
      doc.moveDown(2);

      // 3. Pillar Results
      doc.addPage();
      doc.fontSize(22).text('3. 아키텍처 영역별 분석', { underline: true });
      doc.fontSize(16).text('Well-Architected Pillar Analysis', { underline: false });
      doc.moveDown(2);

      const pillarOrder = [
        'Operational Excellence',
        'Security',
        'Reliability',
        'Performance Efficiency',
        'Cost Optimization',
        'Sustainability'
      ];

      const pillarLabels: Record<string, string> = {
        'Operational Excellence': '운영 우수성',
        'Security': '보안',
        'Reliability': '안정성',
        'Performance Efficiency': '성능 효율성',
        'Cost Optimization': '비용 최적화',
        'Sustainability': '지속 가능성'
      };

      pillarOrder.forEach((pillarName, idx) => {
        const result = report.pillarResults[pillarName];
        if (!result) return;

        doc.addPage();
        
        // Pillar name
        doc.fontSize(20).text(`3.${idx + 1} ${pillarLabels[pillarName]}`, { underline: true });
        doc.fontSize(16).text(pillarName, { underline: false });
        doc.moveDown();

        // Status
        doc.fontSize(12).text(`상태: ${result.status}`);
        if (result.completedAt) {
          doc.text(`완료 시간: ${new Date(result.completedAt).toLocaleString('ko-KR')}`);
        }
        doc.moveDown();

        // Findings
        doc.fontSize(16).text('주요 발견사항', { underline: true });
        doc.moveDown(0.5);
        this.renderMarkdownToPDF(result.findings || '발견사항 없음', doc);
        doc.moveDown(1.5);

        // Recommendations
        doc.fontSize(16).text(`권장사항 (${result.recommendations.length}개)`, { underline: true });
        doc.moveDown(0.5);
        result.recommendations.forEach((rec, index) => {
          doc.fontSize(11).fillColor('#424242').text(`${index + 1}.`, { continued: true });
          doc.fillColor('black');
          doc.text(' ');
          this.renderMarkdownToPDF(rec, doc);
          doc.moveDown(0.5);
        });
        doc.moveDown();

        // Governance Violations
        if (result.governanceViolations && result.governanceViolations.length > 0) {
          doc.fontSize(16).text('거버넌스 정책 위반', { underline: true });
          doc.moveDown(0.5);
          result.governanceViolations.forEach((violation, index) => {
            doc.fontSize(12).text(`${index + 1}. ${this.sanitizeText(violation.policyTitle)} [${violation.severity}]`, {
              continued: false
            });
            doc.fontSize(10).text(`   위반 내용: ${this.sanitizeText(violation.violationDescription)}`);
            doc.fontSize(10).text(`   권장 조치: ${this.sanitizeText(violation.recommendedCorrection)}`);
            doc.moveDown(0.5);
          });
        }

        // Error
        if (result.error) {
          doc.fontSize(16).text('오류', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(11).fillColor('red').text(result.error);
          doc.fillColor('black');
        }
      });

      doc.end();
    });
  }

  /**
   * Sanitize text for PDF generation
   * Remove problematic characters that PDFKit can't handle
   */
  private sanitizeText(text: string): string {
    if (!text) return '';
    
    return text
      // 헤더 제거 (##, ###)
      .replace(/^#{1,6}\s+/gm, '')
      // 볼드 제거 (**텍스트**)
      .replace(/\*\*(.*?)\*\*/g, '[$1]')  // 볼드는 []로 강조
      // 이탤릭 제거 (*텍스트*)
      .replace(/\*(.*?)\*/g, '$1')
      // 코드 제거 (`코드`)
      .replace(/`(.*?)`/g, '"$1"')  // 코드는 ""로 표시
      // 리스트 마커 정리
      .replace(/^[-*]\s+/gm, '• ')
      // 과도한 줄바꿈 제거
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Render markdown text to PDF with proper formatting
   */
  private renderMarkdownToPDF(text: string, doc: any) {
    if (!text) return;
    
    const lines = text.split('\n');
    let inList = false;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // 빈 줄
      if (!trimmed) {
        doc.moveDown(0.3);
        inList = false;
        return;
      }
      
      // H2 헤더 (##)
      if (trimmed.startsWith('## ')) {
        if (inList) doc.moveDown(0.5);
        doc.fontSize(16)
           .fillColor('#1976d2')
           .text(trimmed.replace(/^##\s*/, ''), { underline: true });
        doc.fillColor('black');
        doc.moveDown(0.5);
        inList = false;
      }
      // H3 헤더 (###)
      else if (trimmed.startsWith('### ')) {
        if (inList) doc.moveDown(0.5);
        doc.fontSize(13)
           .fillColor('#1976d2')
           .text(trimmed.replace(/^###\s*/, ''));
        doc.fillColor('black');
        doc.moveDown(0.3);
        inList = false;
      }
      // H4 헤더 (####)
      else if (trimmed.startsWith('#### ')) {
        if (inList) doc.moveDown(0.5);
        doc.fontSize(12)
           .fillColor('#424242')
           .text(trimmed.replace(/^####\s*/, ''), { underline: true });
        doc.fillColor('black');
        doc.moveDown(0.3);
        inList = false;
      }
      // 리스트 항목 (-, *)
      else if (trimmed.match(/^[-*]\s/)) {
        const text = trimmed.replace(/^[-*]\s*/, '');
        const parsed = this.parseInlineMarkdown(text);
        doc.fontSize(10).text(`  • ${parsed}`, { 
          indent: 20,
          lineGap: 2 
        });
        inList = true;
      }
      // 번호 리스트 (1., 2.)
      else if (trimmed.match(/^\d+\.\s/)) {
        const match = trimmed.match(/^(\d+\.)\s*(.*)$/);
        if (match) {
          const parsed = this.parseInlineMarkdown(match[2]);
          doc.fontSize(10).text(`  ${match[1]} ${parsed}`, { 
            indent: 20,
            lineGap: 2 
          });
          inList = true;
        }
      }
      // 일반 텍스트
      else {
        if (inList) {
          doc.moveDown(0.3);
          inList = false;
        }
        const parsed = this.parseInlineMarkdown(trimmed);
        doc.fontSize(10).text(parsed, { lineGap: 3, align: 'left' });
      }
    });
  }

  /**
   * Parse inline markdown (bold, italic, code)
   */
  private parseInlineMarkdown(text: string): string {
    return text
      // 볼드 강조 (**텍스트** → [텍스트])
      .replace(/\*\*(.*?)\*\*/g, '[$1]')
      // 이탤릭 제거
      .replace(/\*(.*?)\*/g, '$1')
      // 코드 표시 (`코드` → "코드")
      .replace(/`(.*?)`/g, '"$1"')
      // 링크 제거 ([텍스트](url) → 텍스트)
      .replace(/\[(.*?)\]\(.*?\)/g, '$1');
  }

  /**
   * Generate Word report
   * Requirements: 5.4, 5.5
   */
  async generateWord(report: ReviewReport): Promise<Buffer> {
    const pillarLabels: Record<string, string> = {
      'Operational Excellence': '운영 우수성',
      'Security': '보안',
      'Reliability': '안정성',
      'Performance Efficiency': '성능 효율성',
      'Cost Optimization': '비용 최적화',
      'Sustainability': '지속 가능성'
    };

    const doc = new DocxDocument({
      sections: [
        {
          properties: {},
          children: [
            // Title
            new Paragraph({
              text: '아키텍처 검토 리포트',
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: 'Architecture Review Report',
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: '' }),

            // Metadata
            new Paragraph({
              children: [
                new TextRun({ text: '검토 요청 ID: ', bold: true }),
                new TextRun(report.reviewRequestId),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: '문서 ID: ', bold: true }),
                new TextRun(report.documentId),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: '버전: ', bold: true }),
                new TextRun(report.versionNumber.toString()),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: '생성 일시: ', bold: true }),
                new TextRun(new Date(report.generatedAt).toLocaleString('ko-KR')),
              ],
            }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: '' }),

            // 1. Executive Summary
            new Paragraph({
              text: '1. 종합 요약 (Executive Summary)',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({ text: '' }),
            ...this.textToParagraphs((report as any).executiveSummary || 'Executive Summary가 생성되지 않았습니다.'),
            new Paragraph({ text: '' }),
            new Paragraph({ text: '' }),

            // 2. Architecture Diagram Analysis
            new Paragraph({
              text: '2. 아키텍처 다이어그램 분석',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({ text: '' }),
            ...this.textToParagraphs(report.overallSummary || '아키텍처 다이어그램 분석이 없습니다.'),
            new Paragraph({ text: '' }),
            new Paragraph({ text: '' }),

            // 3. Pillar Results
            new Paragraph({
              text: '3. 아키텍처 영역별 분석',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: 'Well-Architected Pillar Analysis',
            }),
            new Paragraph({ text: '' }),
            ...this.generatePillarParagraphs(report.pillarResults, pillarLabels),
          ],
        },
      ],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }

  /**
   * Convert text to paragraphs (handle line breaks)
   */
  private textToParagraphs(text: string): Paragraph[] {
    return this.renderMarkdownToWord(text);
  }

  /**
   * Render markdown text to Word paragraphs with proper formatting
   */
  private renderMarkdownToWord(text: string): Paragraph[] {
    if (!text) return [new Paragraph({ text: '' })];
    
    const lines = text.split('\n');
    const paragraphs: Paragraph[] = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // 빈 줄
      if (!trimmed) {
        paragraphs.push(new Paragraph({ text: '' }));
        return;
      }
      
      // H2 헤더 (##)
      if (trimmed.startsWith('## ')) {
        paragraphs.push(new Paragraph({
          text: trimmed.replace(/^##\s*/, ''),
          heading: HeadingLevel.HEADING_1,
        }));
      }
      // H3 헤더 (###)
      else if (trimmed.startsWith('### ')) {
        paragraphs.push(new Paragraph({
          text: trimmed.replace(/^###\s*/, ''),
          heading: HeadingLevel.HEADING_2,
        }));
      }
      // H4 헤더 (####)
      else if (trimmed.startsWith('#### ')) {
        paragraphs.push(new Paragraph({
          text: trimmed.replace(/^####\s*/, ''),
          heading: HeadingLevel.HEADING_3,
        }));
      }
      // 리스트 항목 (-, *)
      else if (trimmed.match(/^[-*]\s/)) {
        const text = trimmed.replace(/^[-*]\s*/, '');
        paragraphs.push(new Paragraph({
          children: this.parseInlineStylesForWord(text),
          bullet: { level: 0 },
        }));
      }
      // 번호 리스트 (1., 2.)
      else if (trimmed.match(/^\d+\.\s/)) {
        const text = trimmed.replace(/^\d+\.\s*/, '');
        paragraphs.push(new Paragraph({
          children: this.parseInlineStylesForWord(text),
          numbering: { reference: 'default-numbering', level: 0 },
        }));
      }
      // 일반 텍스트
      else {
        paragraphs.push(new Paragraph({
          children: this.parseInlineStylesForWord(trimmed),
        }));
      }
    });
    
    return paragraphs;
  }

  /**
   * Parse inline markdown styles for Word (bold, italic, code)
   */
  private parseInlineStylesForWord(text: string): TextRun[] {
    const runs: TextRun[] = [];
    
    // **볼드** 처리
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    parts.forEach(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // 볼드 텍스트
        const boldText = part.replace(/\*\*/g, '');
        // 볼드 안에 `코드` 처리
        const codeParts = boldText.split(/(`.*?`)/g);
        codeParts.forEach(codePart => {
          if (codePart.startsWith('`') && codePart.endsWith('`')) {
            runs.push(new TextRun({
              text: codePart.replace(/`/g, ''),
              bold: true,
              font: 'Courier New',
            }));
          } else if (codePart) {
            runs.push(new TextRun({
              text: codePart,
              bold: true,
            }));
          }
        });
      } else if (part) {
        // 일반 텍스트에서 `코드` 처리
        const codeParts = part.split(/(`.*?`)/g);
        codeParts.forEach(codePart => {
          if (codePart.startsWith('`') && codePart.endsWith('`')) {
            runs.push(new TextRun({
              text: codePart.replace(/`/g, ''),
              font: 'Courier New',
            }));
          } else if (codePart) {
            // *이탤릭* 처리
            const italicParts = codePart.split(/(\*.*?\*)/g);
            italicParts.forEach(italicPart => {
              if (italicPart.startsWith('*') && italicPart.endsWith('*') && !italicPart.startsWith('**')) {
                runs.push(new TextRun({
                  text: italicPart.replace(/\*/g, ''),
                  italics: true,
                }));
              } else if (italicPart) {
                runs.push(new TextRun(italicPart));
              }
            });
          }
        });
      }
    });
    
    return runs.length > 0 ? runs : [new TextRun(text)];
  }

  /**
   * Generate paragraphs for pillar results
   */
  private generatePillarParagraphs(
    pillarResults: Record<string, PillarResult>,
    pillarLabels: Record<string, string>
  ): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    const pillarOrder = [
      'Operational Excellence',
      'Security',
      'Reliability',
      'Performance Efficiency',
      'Cost Optimization',
      'Sustainability'
    ];

    pillarOrder.forEach((pillarName, idx) => {
      const result = pillarResults[pillarName];
      if (!result) return;

      paragraphs.push(new Paragraph({ text: '' }));
      paragraphs.push(
        new Paragraph({
          text: `3.${idx + 1} ${pillarLabels[pillarName]}`,
          heading: HeadingLevel.HEADING_2,
        })
      );
      paragraphs.push(
        new Paragraph({
          text: pillarName,
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: '상태: ', bold: true }),
            new TextRun(result.status),
          ],
        })
      );

      if (result.completedAt) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: '완료 시간: ', bold: true }),
              new TextRun(new Date(result.completedAt).toLocaleString('ko-KR')),
            ],
          })
        );
      }

      paragraphs.push(new Paragraph({ text: '' }));
      paragraphs.push(
        new Paragraph({
          text: '주요 발견사항',
          heading: HeadingLevel.HEADING_3,
        })
      );
      paragraphs.push(...this.renderMarkdownToWord(result.findings || '발견사항 없음'));

      paragraphs.push(new Paragraph({ text: '' }));
      paragraphs.push(
        new Paragraph({
          text: `권장사항 (${result.recommendations.length}개)`,
          heading: HeadingLevel.HEADING_3,
        })
      );
      result.recommendations.forEach((rec, index) => {
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: `${index + 1}. `, bold: true }),
            ...this.parseInlineStylesForWord(rec),
          ],
        }));
      });

      if (result.governanceViolations && result.governanceViolations.length > 0) {
        paragraphs.push(new Paragraph({ text: '' }));
        paragraphs.push(
          new Paragraph({
            text: '거버넌스 정책 위반',
            heading: HeadingLevel.HEADING_3,
          })
        );
        result.governanceViolations.forEach((violation, index) => {
          paragraphs.push(
            new Paragraph({
              text: `${index + 1}. ${violation.policyTitle} [${violation.severity}]`,
            })
          );
          paragraphs.push(new Paragraph({ text: `   위반 내용: ${violation.violationDescription}` }));
          paragraphs.push(
            new Paragraph({ text: `   권장 조치: ${violation.recommendedCorrection}` })
          );
        });
      }

      if (result.error) {
        paragraphs.push(new Paragraph({ text: '' }));
        paragraphs.push(
          new Paragraph({
            text: '오류',
            heading: HeadingLevel.HEADING_3,
          })
        );
        paragraphs.push(new Paragraph({ text: result.error }));
      }
    });

    return paragraphs;
  }

  /**
   * Save report to S3 and return presigned URL
   * Requirements: 5.3, 5.4
   */
  async saveAndGetDownloadUrl(
    executionId: string,
    format: 'pdf' | 'word',
    reportBuffer: Buffer
  ): Promise<string> {
    const extension = format === 'pdf' ? 'pdf' : 'docx';
    const s3Key = `reports/${executionId}/full-report.${extension}`;

    // Upload to S3
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.reportsBucket,
        Key: s3Key,
        Body: reportBuffer,
        ContentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    );

    // Generate presigned URL (valid for 1 hour)
    const downloadUrl = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.reportsBucket,
        Key: s3Key,
      }),
      { expiresIn: 3600 }
    );

    return downloadUrl;
  }
}
