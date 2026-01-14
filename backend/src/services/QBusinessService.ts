/**
 * Q Business Service - Query governance policies
 * Requirements: 2.4, 2.5
 */

import { QBusinessClient, ChatSyncCommand } from '@aws-sdk/client-qbusiness';
import { environment } from '../config/environment.js';
import { PolicyViolation } from '../types/index.js';
import { validateRequiredString } from '../utils/validators.js';

export class QBusinessService {
  private qBusinessClient: QBusinessClient;
  private applicationId: string;

  constructor() {
    this.qBusinessClient = new QBusinessClient({ region: environment.aws.region });
    this.applicationId = environment.qBusiness.applicationId;
  }

  /**
   * Query governance policies for violations
   * Requirements: 2.4, 2.5
   */
  async queryGovernancePolicies(
    policyIds: string[],
    architectureContext: string
  ): Promise<PolicyViolation[]> {
    validateRequiredString(architectureContext, 'architectureContext');

    if (!this.applicationId) {
      console.warn('Q Business application ID not configured, skipping governance check');
      return [];
    }

    if (policyIds.length === 0) {
      return [];
    }

    const violations: PolicyViolation[] = [];

    try {
      // Construct query for Q Business
      const query = this.constructGovernanceQuery(policyIds, architectureContext);

      // Query Q Business
      const response = await this.qBusinessClient.send(
        new ChatSyncCommand({
          applicationId: this.applicationId,
          userMessage: query,
          userId: 'system-governance-check',
        })
      );

      // Parse response for violations
      if (response.systemMessage) {
        violations.push(...this.parseViolations(response.systemMessage, policyIds));
      }
    } catch (error) {
      console.error('Q Business query failed:', error);
      // Don't throw - allow review to continue without governance check
    }

    return violations;
  }

  /**
   * Construct query for governance policy checking
   * Requirements: 2.4
   */
  private constructGovernanceQuery(policyIds: string[], architectureContext: string): string {
    return `
Based on the following architecture description, identify any violations of our governance policies:

Architecture Context:
${architectureContext}

Please check against the governance policies in our knowledge base (Policy IDs: ${policyIds.join(', ')}).

For each violation found, provide:
1. Policy ID and title
2. Description of the violation
3. Recommended correction
4. Severity (High/Medium/Low)

Format your response as a structured list of violations.
    `.trim();
  }

  /**
   * Parse Q Business response for policy violations
   * Requirements: 2.5
   */
  private parseViolations(response: string, policyIds: string[]): PolicyViolation[] {
    const violations: PolicyViolation[] = [];

    // Simple parsing logic - in production, this would be more sophisticated
    // Look for violation patterns in the response
    const lines = response.split('\n');
    let currentViolation: Partial<PolicyViolation> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for policy ID
      if (trimmed.includes('Policy ID:') || trimmed.includes('Policy:')) {
        if (currentViolation && currentViolation.policyId) {
          violations.push(currentViolation as PolicyViolation);
        }
        currentViolation = {
          policyId: policyIds[0] || 'unknown',
          policyTitle: 'Governance Policy',
          severity: 'Medium',
        };
      }

      // Check for violation description
      if (trimmed.includes('Violation:') || trimmed.includes('Issue:')) {
        if (currentViolation) {
          currentViolation.violationDescription = trimmed.split(':')[1]?.trim() || trimmed;
        }
      }

      // Check for recommendation
      if (trimmed.includes('Recommendation:') || trimmed.includes('Correction:')) {
        if (currentViolation) {
          currentViolation.recommendedCorrection = trimmed.split(':')[1]?.trim() || trimmed;
        }
      }

      // Check for severity
      if (trimmed.includes('Severity:')) {
        if (currentViolation) {
          const severity = trimmed.toLowerCase();
          if (severity.includes('high')) {
            currentViolation.severity = 'High';
          } else if (severity.includes('low')) {
            currentViolation.severity = 'Low';
          } else {
            currentViolation.severity = 'Medium';
          }
        }
      }
    }

    // Add last violation
    if (currentViolation && currentViolation.policyId) {
      violations.push(currentViolation as PolicyViolation);
    }

    return violations;
  }
}
