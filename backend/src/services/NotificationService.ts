/**
 * Notification Service - Handles email notifications via Amazon SES
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { environment } from '../config/environment.js';
import { validateEmail, validateRequiredString } from '../utils/validators.js';

interface EmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export class NotificationService {
  private sesClient: SESClient;
  private fromEmail: string;
  private replyToEmail: string;
  private maxRetries: number = 3;

  constructor() {
    this.sesClient = new SESClient({ region: environment.aws.region });
    this.fromEmail = environment.ses.fromEmail;
    this.replyToEmail = environment.ses.replyToEmail;
  }

  /**
   * Send email with retry logic
   * Requirements: 11.5
   */
  private async sendEmailWithRetry(params: EmailParams): Promise<boolean> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.sesClient.send(
          new SendEmailCommand({
            Source: this.fromEmail,
            Destination: {
              ToAddresses: [params.to],
            },
            Message: {
              Subject: {
                Data: params.subject,
                Charset: 'UTF-8',
              },
              Body: {
                Html: {
                  Data: params.htmlBody,
                  Charset: 'UTF-8',
                },
                Text: {
                  Data: params.textBody,
                  Charset: 'UTF-8',
                },
              },
            },
            ReplyToAddresses: [this.replyToEmail],
          })
        );

        console.log(`Email sent successfully to ${params.to} on attempt ${attempt}`);
        return true;
      } catch (error) {
        lastError = error as Error;
        console.error(`Email send attempt ${attempt} failed:`, error);

        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error(`Failed to send email after ${this.maxRetries} attempts:`, lastError);
    return false;
  }

  /**
   * Send review request notification email
   * Requirements: 11.1, 11.4
   */
  async sendReviewRequestEmail(
    reviewerEmail: string,
    reviewRequestId: string,
    documentTitle: string,
    submitterEmail: string
  ): Promise<boolean> {
    validateRequiredString(reviewRequestId, 'reviewRequestId');
    validateRequiredString(documentTitle, 'documentTitle');
    
    if (!validateEmail(reviewerEmail)) {
      throw new Error('Invalid reviewer email');
    }

    const reviewUrl = `${process.env.FRONTEND_URL || 'https://example.com'}/reviews/${reviewRequestId}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #232f3e; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f5f5f5; }
          .button { display: inline-block; padding: 12px 24px; background-color: #ff9900; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Architecture Review System</h1>
          </div>
          <div class="content">
            <h2>새로운 아키텍처 검토 요청</h2>
            <p>안녕하세요,</p>
            <p>${submitterEmail}님이 아키텍처 검토를 요청했습니다.</p>
            <p><strong>문서 제목:</strong> ${documentTitle}</p>
            <p><strong>검토 요청 ID:</strong> ${reviewRequestId}</p>
            <a href="${reviewUrl}" class="button">검토 시작하기</a>
            <p>위 버튼을 클릭하여 검토를 시작하실 수 있습니다.</p>
          </div>
          <div class="footer">
            <p>이 메일은 Architecture Review System에서 자동으로 발송되었습니다.</p>
            <p>이 메일에 회신하지 마세요.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
Architecture Review System

새로운 아키텍처 검토 요청

안녕하세요,

${submitterEmail}님이 아키텍처 검토를 요청했습니다.

문서 제목: ${documentTitle}
검토 요청 ID: ${reviewRequestId}

검토 시작하기: ${reviewUrl}

---
이 메일은 Architecture Review System에서 자동으로 발송되었습니다.
이 메일에 회신하지 마세요.
    `;

    return this.sendEmailWithRetry({
      to: reviewerEmail,
      subject: `[Architecture Review] 새로운 검토 요청: ${documentTitle}`,
      htmlBody,
      textBody,
    });
  }

  /**
   * Send modification request notification email
   * Requirements: 11.2, 11.4
   */
  async sendModificationRequestEmail(
    submitterEmail: string,
    reviewRequestId: string,
    modificationDetails: string,
    documentTitle: string
  ): Promise<boolean> {
    validateRequiredString(reviewRequestId, 'reviewRequestId');
    validateRequiredString(modificationDetails, 'modificationDetails');
    
    if (!validateEmail(submitterEmail)) {
      throw new Error('Invalid submitter email');
    }

    const reviewUrl = `${process.env.FRONTEND_URL || 'https://example.com'}/reviews/${reviewRequestId}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #232f3e; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f5f5f5; }
          .button { display: inline-block; padding: 12px 24px; background-color: #ff9900; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .modification { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Architecture Review System</h1>
          </div>
          <div class="content">
            <h2>아키텍처 수정 요청</h2>
            <p>안녕하세요,</p>
            <p>귀하의 아키텍처 문서 "<strong>${documentTitle}</strong>"에 대한 검토가 완료되었으며, 수정이 필요합니다.</p>
            <div class="modification">
              <h3>수정 요청 사항:</h3>
              <p>${modificationDetails}</p>
            </div>
            <p><strong>검토 요청 ID:</strong> ${reviewRequestId}</p>
            <a href="${reviewUrl}" class="button">검토 결과 확인하기</a>
            <p>수정된 문서를 업로드하여 재검토를 요청하실 수 있습니다.</p>
          </div>
          <div class="footer">
            <p>이 메일은 Architecture Review System에서 자동으로 발송되었습니다.</p>
            <p>이 메일에 회신하지 마세요.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
Architecture Review System

아키텍처 수정 요청

안녕하세요,

귀하의 아키텍처 문서 "${documentTitle}"에 대한 검토가 완료되었으며, 수정이 필요합니다.

수정 요청 사항:
${modificationDetails}

검토 요청 ID: ${reviewRequestId}

검토 결과 확인하기: ${reviewUrl}

수정된 문서를 업로드하여 재검토를 요청하실 수 있습니다.

---
이 메일은 Architecture Review System에서 자동으로 발송되었습니다.
이 메일에 회신하지 마세요.
    `;

    return this.sendEmailWithRetry({
      to: submitterEmail,
      subject: `[Architecture Review] 수정 요청: ${documentTitle}`,
      htmlBody,
      textBody,
    });
  }

  /**
   * Send review complete notification email
   * Requirements: 11.3, 11.4
   */
  async sendReviewCompleteEmail(
    submitterEmail: string,
    reviewRequestId: string,
    documentTitle: string,
    resultsUrl: string
  ): Promise<boolean> {
    validateRequiredString(reviewRequestId, 'reviewRequestId');
    validateRequiredString(resultsUrl, 'resultsUrl');
    
    if (!validateEmail(submitterEmail)) {
      throw new Error('Invalid submitter email');
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #232f3e; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f5f5f5; }
          .button { display: inline-block; padding: 12px 24px; background-color: #ff9900; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .success { background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Architecture Review System</h1>
          </div>
          <div class="content">
            <h2>아키텍처 검토 완료</h2>
            <p>안녕하세요,</p>
            <div class="success">
              <p>귀하의 아키텍처 문서 "<strong>${documentTitle}</strong>"에 대한 검토가 완료되었습니다.</p>
            </div>
            <p><strong>검토 요청 ID:</strong> ${reviewRequestId}</p>
            <a href="${resultsUrl}" class="button">검토 결과 확인하기</a>
            <p>검토 결과를 확인하시고, 필요한 경우 IaC 템플릿을 생성하실 수 있습니다.</p>
          </div>
          <div class="footer">
            <p>이 메일은 Architecture Review System에서 자동으로 발송되었습니다.</p>
            <p>이 메일에 회신하지 마세요.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
Architecture Review System

아키텍처 검토 완료

안녕하세요,

귀하의 아키텍처 문서 "${documentTitle}"에 대한 검토가 완료되었습니다.

검토 요청 ID: ${reviewRequestId}

검토 결과 확인하기: ${resultsUrl}

검토 결과를 확인하시고, 필요한 경우 IaC 템플릿을 생성하실 수 있습니다.

---
이 메일은 Architecture Review System에서 자동으로 발송되었습니다.
이 메일에 회신하지 마세요.
    `;

    return this.sendEmailWithRetry({
      to: submitterEmail,
      subject: `[Architecture Review] 검토 완료: ${documentTitle}`,
      htmlBody,
      textBody,
    });
  }
}
