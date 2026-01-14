/**
 * IaC Generation Service - CloudFormation and Terraform template generation
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { environment } from '../config/environment.js';
import { Document, ReviewReport } from '../types/index.js';

export class IaCGenerationService {
  private bedrockClient: BedrockRuntimeClient;
  private s3Client: S3Client;
  private iacBucket: string;
  private modelId: string;

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient({ region: environment.aws.region });
    this.s3Client = new S3Client({ region: environment.aws.region });
    this.iacBucket = environment.s3.documentsBucket; // Using documents bucket
    this.modelId = environment.bedrock.modelId;
  }

  /**
   * Generate CloudFormation template
   * Requirements: 9.2
   */
  async generateCloudFormation(
    document: Document,
    reviewReport: ReviewReport
  ): Promise<string> {
    const prompt = this.constructCloudFormationPrompt(document, reviewReport);
    const template = await this.invokeBedrockForIaC(prompt);
    return template;
  }

  /**
   * Generate Terraform template
   * Requirements: 9.3
   */
  async generateTerraform(
    document: Document,
    reviewReport: ReviewReport
  ): Promise<string> {
    const prompt = this.constructTerraformPrompt(document, reviewReport);
    const template = await this.invokeBedrockForIaC(prompt);
    return template;
  }

  /**
   * Save template to S3 and return download URL
   * Requirements: 9.4
   */
  async saveTemplateAndGetUrl(
    reviewRequestId: string,
    format: 'cloudformation' | 'terraform',
    template: string
  ): Promise<string> {
    const extension = format === 'cloudformation' ? 'yaml' : 'tf';
    const s3Key = `iac-templates/${reviewRequestId}/${format}.${extension}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.iacBucket,
        Key: s3Key,
        Body: template,
        ContentType: 'text/plain',
      })
    );

    const downloadUrl = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.iacBucket,
        Key: s3Key,
      }),
      { expiresIn: 3600 }
    );

    return downloadUrl;
  }

  /**
   * Construct CloudFormation generation prompt
   */
  private constructCloudFormationPrompt(document: Document, reviewReport: ReviewReport): string {
    return `
You are an expert in AWS CloudFormation and infrastructure as code.

Based on the following architecture document and review feedback, generate a complete CloudFormation template.

Architecture Document:
- Title: ${document.title}
- Description: ${document.description}

Review Feedback Summary:
${reviewReport.overallSummary}

Key Recommendations:
${this.extractKeyRecommendations(reviewReport)}

Generate a CloudFormation template (YAML format) that:
1. Implements the architecture described in the document
2. Incorporates the review recommendations
3. Follows AWS best practices
4. Includes proper resource naming and tagging
5. Has appropriate security configurations

Provide ONLY the CloudFormation YAML template, no additional explanation.
    `.trim();
  }

  /**
   * Construct Terraform generation prompt
   */
  private constructTerraformPrompt(document: Document, reviewReport: ReviewReport): string {
    return `
You are an expert in Terraform and infrastructure as code.

Based on the following architecture document and review feedback, generate a complete Terraform configuration.

Architecture Document:
- Title: ${document.title}
- Description: ${document.description}

Review Feedback Summary:
${reviewReport.overallSummary}

Key Recommendations:
${this.extractKeyRecommendations(reviewReport)}

Generate a Terraform configuration (.tf format) that:
1. Implements the architecture described in the document
2. Incorporates the review recommendations
3. Follows AWS best practices
4. Includes proper resource naming and tagging
5. Has appropriate security configurations
6. Uses AWS provider

Provide ONLY the Terraform configuration, no additional explanation.
    `.trim();
  }

  /**
   * Extract key recommendations from review report
   */
  private extractKeyRecommendations(reviewReport: ReviewReport): string {
    const recommendations: string[] = [];

    Object.entries(reviewReport.pillarResults).forEach(([pillarName, result]) => {
      if (result.recommendations && result.recommendations.length > 0) {
        recommendations.push(`\n${pillarName}:`);
        result.recommendations.slice(0, 3).forEach((rec, index) => {
          recommendations.push(`  ${index + 1}. ${rec}`);
        });
      }
    });

    return recommendations.join('\n');
  }

  /**
   * Invoke Bedrock for IaC generation
   */
  private async invokeBedrockForIaC(prompt: string): Promise<string> {
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more deterministic code generation
    };

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await this.bedrockClient.send(command);

    if (!response.body) {
      throw new Error('Empty response from Bedrock');
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (responseBody.content && responseBody.content.length > 0) {
      return responseBody.content[0].text;
    }

    throw new Error('Invalid response format from Bedrock');
  }
}
