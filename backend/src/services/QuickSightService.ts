/**
 * QuickSight Service - Chat Agent Embedding
 */

import { 
  QuickSightClient, 
  GenerateEmbedUrlForRegisteredUserCommand,
  RegisterUserCommand,
  DescribeUserCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-quicksight';
import { environment } from '../config/environment.js';

export class QuickSightService {
  private client: QuickSightClient;
  private accountId: string;
  private namespace: string;
  private agentId: string;

  constructor() {
    this.client = new QuickSightClient({ region: environment.aws.region });
    this.accountId = process.env.QUICKSIGHT_ACCOUNT_ID || process.env.AWS_ACCOUNT_ID || '';
    this.namespace = process.env.QUICKSIGHT_NAMESPACE || 'default';
    this.agentId = process.env.QUICKSIGHT_AGENT_ID || '';
    
    if (!this.accountId) {
      console.warn('QUICKSIGHT_ACCOUNT_ID not set');
    }
  }

  /**
   * Generate embed URL for QuickSight Chat
   */
  async generateChatEmbedUrl(_userId: string, _email: string): Promise<{
    embedUrl: string;
    agentId: string;
  }> {
    // Check if Agent ID is configured
    if (!this.agentId) {
      throw new Error('QUICKSIGHT_AGENT_ID environment variable is not configured. Please follow the QuickSuite MCP setup guide in README.');
    }

    try {
      // QuickSight 사용자 이름 사용 (환경 변수에서)
      const quicksightUserName = process.env.QUICKSIGHT_USER_NAME || 'Admin/admin';
      
      const command = new GenerateEmbedUrlForRegisteredUserCommand({
        AwsAccountId: this.accountId,
        UserArn: `arn:aws:quicksight:${environment.aws.region}:${this.accountId}:user/${this.namespace}/${quicksightUserName}`,
        ExperienceConfiguration: {
          QuickChat: {
            InitialAgentId: this.agentId,  // QuickChat 전용 설정
          },
        },
        SessionLifetimeInMinutes: 600,
        AllowedDomains: ['http://localhost:3000'],
      });

      const response = await this.client.send(command);
      
      if (!response.EmbedUrl) {
        throw new Error('Failed to generate embed URL');
      }

      console.log('Generated QuickSight embed URL for user:', quicksightUserName);

      return {
        embedUrl: response.EmbedUrl,
        agentId: this.agentId,
      };
    } catch (error) {
      console.error('Error generating QuickSight embed URL:', error);
      throw error;
    }
  }

  /**
   * Ensure user is registered in QuickSight
   */
  private async ensureUserRegistered(email: string): Promise<void> {
    try {
      // Check if user exists
      const describeCommand = new DescribeUserCommand({
        AwsAccountId: this.accountId,
        Namespace: this.namespace,
        UserName: email,
      });

      await this.client.send(describeCommand);
      console.log('QuickSight user already exists:', email);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        // User doesn't exist, register
        console.log('Registering new QuickSight user:', email);
        await this.registerUser(email);
      } else {
        throw error;
      }
    }
  }

  /**
   * Register user in QuickSight
   */
  private async registerUser(email: string): Promise<void> {
    const command = new RegisterUserCommand({
      AwsAccountId: this.accountId,
      Namespace: this.namespace,
      Email: email,
      IdentityType: 'IAM',  // QUICKSIGHT → IAM (Cognito 사용자)
      UserRole: 'READER',
      IamArn: `arn:aws:iam::${this.accountId}:role/quicksight-fed-role`,  // Federated role
    });

    try {
      await this.client.send(command);
      console.log('QuickSight user registered:', email);
    } catch (error) {
      console.error('Failed to register QuickSight user:', error);
      // 등록 실패해도 계속 진행 (이미 등록되었을 수 있음)
    }
  }

  /**
   * Check if QuickSight is configured
   */
  isConfigured(): boolean {
    return !!(this.accountId && this.agentId);
  }
}
