/**
 * Local Agent Test Script
 * Run Bedrock agents locally without Lambda
 */

import { AgentOrchestrationService } from './services/AgentOrchestrationService.js';
import { PillarConfigurationService } from './services/PillarConfigurationService.js';
import { Document, PillarName } from './types/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock document for testing
const mockDocument: Document = {
  documentId: 'test-doc-001',
  reviewRequestId: 'test-req-001',
  versionNumber: 1,
  s3Bucket: 'test-bucket',
  s3Key: 'test-key',
  format: 'pdf',
  title: 'E-Commerce Microservices Architecture',
  description: `
This architecture implements a scalable e-commerce platform using microservices on AWS.

Key Components:
- Frontend: React SPA hosted on S3 + CloudFront
- API Gateway: REST API with Lambda authorizer
- Microservices: ECS Fargate containers
- Database: Aurora PostgreSQL Multi-AZ
- Cache: ElastiCache Redis
- Message Queue: SQS for async processing
- Storage: S3 for product images
- CDN: CloudFront for global delivery
- Monitoring: CloudWatch + X-Ray

Architecture Highlights:
- Auto-scaling for compute resources
- Multi-AZ deployment for high availability
- Encryption at rest and in transit
- CI/CD pipeline with CodePipeline
- Infrastructure as Code with CloudFormation
  `,
  uploadedBy: 'test-user',
  uploadedAt: new Date().toISOString(),
  fileSize: 1024,
  checksum: 'test-checksum',
};

async function testSinglePillar(pillar: PillarName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing ${pillar} Pillar Agent`);
  console.log('='.repeat(80));

  const agentService = new AgentOrchestrationService();
  const pillarService = new PillarConfigurationService();

  try {
    // Get pillar configuration
    let config;
    try {
      config = await pillarService.getActivePillarConfig(pillar);
    } catch {
      // Use default if not found
      config = {
        pillarName: pillar,
        systemPrompt: pillarService['getDefaultPrompt'](pillar),
        enabled: true,
      };
    }

    console.log(`\nSystem Prompt (first 200 chars):`);
    console.log(config.systemPrompt.substring(0, 200) + '...\n');

    console.log('Executing review...\n');

    // Execute review
    const result = await agentService.executePillarReview(
      pillar,
      mockDocument,
      config.systemPrompt,
      [], // No governance policies for local test
      'Focus on critical issues and provide top 3 recommendations'
    );

    console.log('Status:', result.status);
    console.log('\nFindings:');
    console.log(result.findings);
    console.log('\nRecommendations:');
    result.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });

    if (result.error) {
      console.log('\nError:', result.error);
    }

    // Save result to file
    const outputDir = path.join(__dirname, '../test-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, `${pillar.replace(/\s+/g, '-').toLowerCase()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\nResult saved to: ${outputFile}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

async function testAllPillars() {
  console.log('\n' + '='.repeat(80));
  console.log('Testing All Pillar Agents in Parallel');
  console.log('='.repeat(80));

  const agentService = new AgentOrchestrationService();
  const pillarService = new PillarConfigurationService();

  const pillars: PillarName[] = [
    'Operational Excellence',
    'Security',
    'Reliability',
    'Performance Efficiency',
    'Cost Optimization',
    'Sustainability',
  ];

  try {
    // Get all pillar configurations
    const pillarConfigs: Record<string, any> = {};
    for (const pillar of pillars) {
      try {
        pillarConfigs[pillar] = await pillarService.getActivePillarConfig(pillar);
      } catch {
        pillarConfigs[pillar] = {
          pillarName: pillar,
          systemPrompt: pillarService['getDefaultPrompt'](pillar),
          enabled: true,
          additionalInstructions: 'Provide concise analysis with top 3 recommendations',
        };
      }
    }

    console.log('\nExecuting all pillars in parallel...\n');

    const startTime = Date.now();
    const { pillarResults } = await agentService.executeAllPillars(
      mockDocument,
      pillarConfigs,
      []
    );
    const duration = Date.now() - startTime;

    console.log(`\nCompleted in ${(duration / 1000).toFixed(2)} seconds\n`);

    // Display summary
    Object.entries(pillarResults).forEach(([pillarName, result]) => {
      console.log(`\n${pillarName}:`);
      console.log(`  Status: ${result.status}`);
      console.log(`  Recommendations: ${result.recommendations.length}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });

    // Save all results
    const outputDir = path.join(__dirname, '../test-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, 'all-pillars-result.json');
    fs.writeFileSync(outputFile, JSON.stringify(pillarResults, null, 2));
    console.log(`\nAll results saved to: ${outputFile}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Main execution
const args = process.argv.slice(2);
const pillarArg = args[0];

if (pillarArg === 'all') {
  testAllPillars();
} else if (pillarArg) {
  testSinglePillar(pillarArg as PillarName);
} else {
  console.log(`
Usage:
  npm run test:agent <pillar>
  npm run test:agent all

Examples:
  npm run test:agent "Security"
  npm run test:agent "Operational Excellence"
  npm run test:agent all

Available Pillars:
  - Operational Excellence
  - Security
  - Reliability
  - Performance Efficiency
  - Cost Optimization
  - Sustainability
  `);
}
