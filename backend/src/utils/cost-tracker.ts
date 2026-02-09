/**
 * Cost Tracker - Tracks AWS service usage costs during a review execution
 * 
 * Pricing is based on us-east-1 region (as of 2025).
 * Bedrock model pricing: per 1K input/output tokens
 */

export interface CostItem {
  service: string;        // e.g. "Amazon Bedrock", "Amazon S3", "Amazon DynamoDB"
  operation: string;      // e.g. "Claude 3.5 Sonnet - Pillar Review (Security)"
  modelId?: string;       // Bedrock model ID
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;    // For vision API calls
  requestCount?: number;  // For S3/DynamoDB/Lambda
  dataTransferKB?: number;
  cost: number;           // USD
  timestamp: string;
}

export interface CostBreakdown {
  items: CostItem[];
  totalCost: number;
  currency: string;
  breakdown: {
    bedrock: number;
    s3: number;
    dynamodb: number;
    lambda: number;
    other: number;
  };
}

// Bedrock pricing per 1K tokens (us-east-1, on-demand, as of 2025)
const BEDROCK_PRICING: Record<string, { input: number; output: number }> = {
  // Claude models (per 1K tokens)
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0': { input: 0.003, output: 0.015 },
  'us.anthropic.claude-3-5-sonnet-20240620-v1:0': { input: 0.003, output: 0.015 },
  'us.anthropic.claude-sonnet-4-20250514-v1:0': { input: 0.003, output: 0.015 },
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { input: 0.003, output: 0.015 },
  'anthropic.claude-sonnet-4-5-20250929-v1:0': { input: 0.003, output: 0.015 },
  'anthropic.claude-3-5-sonnet-20241022-v2:0': { input: 0.003, output: 0.015 },
  'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
  'us.anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
  'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
  // Nova models
  'us.amazon.nova-lite-v1:0': { input: 0.00006, output: 0.00024 },
  'us.amazon.nova-pro-v1:0': { input: 0.0008, output: 0.0032 },
  'amazon.nova-lite-v1:0': { input: 0.00006, output: 0.00024 },
  'amazon.nova-pro-v1:0': { input: 0.0008, output: 0.0032 },
  // Mistral
  'mistral.pixtral-large-2502-v1:0': { input: 0.002, output: 0.006 },
};

// S3 pricing (us-east-1)
const S3_GET_COST_PER_1K = 0.0004;  // per 1,000 GET requests

// DynamoDB pricing (us-east-1, on-demand)
const DYNAMODB_READ_COST_PER_UNIT = 0.00000025;  // per RRU
const DYNAMODB_WRITE_COST_PER_UNIT = 0.00000125;  // per WRU

// Lambda pricing
const LAMBDA_INVOKE_COST = 0.0000002;  // per request
const LAMBDA_GB_SECOND_COST = 0.0000166667;  // per GB-second

export class CostTracker {
  private items: CostItem[] = [];

  /**
   * Track a Bedrock model invocation
   */
  trackBedrockInvocation(params: {
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    operation: string;
    imageCount?: number;
  }): void {
    const pricing = this.getBedrockPricing(params.modelId);
    const inputCost = (params.inputTokens / 1000) * pricing.input;
    const outputCost = (params.outputTokens / 1000) * pricing.output;
    const cost = inputCost + outputCost;

    this.items.push({
      service: 'Amazon Bedrock',
      operation: params.operation,
      modelId: params.modelId,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      imageCount: params.imageCount,
      cost,
      timestamp: new Date().toISOString(),
    });

    console.log(`[CostTracker] Bedrock: ${params.operation} | ${params.modelId} | in:${params.inputTokens} out:${params.outputTokens} | $${cost.toFixed(6)}`);
  }

  /**
   * Track an S3 operation
   */
  trackS3Operation(params: {
    operation: string;
    dataTransferKB?: number;
  }): void {
    const cost = S3_GET_COST_PER_1K / 1000; // single request

    this.items.push({
      service: 'Amazon S3',
      operation: params.operation,
      requestCount: 1,
      dataTransferKB: params.dataTransferKB,
      cost,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track a DynamoDB operation
   */
  trackDynamoDBOperation(params: {
    operation: string;
    type: 'read' | 'write';
    units?: number;
  }): void {
    const units = params.units || 1;
    const cost = params.type === 'read'
      ? units * DYNAMODB_READ_COST_PER_UNIT
      : units * DYNAMODB_WRITE_COST_PER_UNIT;

    this.items.push({
      service: 'Amazon DynamoDB',
      operation: params.operation,
      requestCount: 1,
      cost,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track a Lambda invocation
   */
  trackLambdaInvocation(params: {
    operation: string;
    durationMs?: number;
    memoryMB?: number;
  }): void {
    let cost = LAMBDA_INVOKE_COST;
    if (params.durationMs && params.memoryMB) {
      const gbSeconds = (params.memoryMB / 1024) * (params.durationMs / 1000);
      cost += gbSeconds * LAMBDA_GB_SECOND_COST;
    }

    this.items.push({
      service: 'AWS Lambda',
      operation: params.operation,
      requestCount: 1,
      cost,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get the full cost breakdown
   */
  getBreakdown(): CostBreakdown {
    const breakdown = { bedrock: 0, s3: 0, dynamodb: 0, lambda: 0, other: 0 };

    for (const item of this.items) {
      switch (item.service) {
        case 'Amazon Bedrock': breakdown.bedrock += item.cost; break;
        case 'Amazon S3': breakdown.s3 += item.cost; break;
        case 'Amazon DynamoDB': breakdown.dynamodb += item.cost; break;
        case 'AWS Lambda': breakdown.lambda += item.cost; break;
        default: breakdown.other += item.cost; break;
      }
    }

    return {
      items: this.items,
      totalCost: this.items.reduce((sum, item) => sum + item.cost, 0),
      currency: 'USD',
      breakdown,
    };
  }

  /**
   * Get Bedrock pricing for a model, with fallback
   */
  private getBedrockPricing(modelId: string): { input: number; output: number } {
    if (BEDROCK_PRICING[modelId]) {
      return BEDROCK_PRICING[modelId];
    }

    // Fuzzy match
    const lowerModelId = modelId.toLowerCase();
    if (lowerModelId.includes('claude') && lowerModelId.includes('sonnet')) {
      return { input: 0.003, output: 0.015 };
    }
    if (lowerModelId.includes('claude') && lowerModelId.includes('haiku')) {
      return { input: 0.00025, output: 0.00125 };
    }
    if (lowerModelId.includes('claude') && lowerModelId.includes('opus')) {
      return { input: 0.015, output: 0.075 };
    }
    if (lowerModelId.includes('nova-lite')) {
      return { input: 0.00006, output: 0.00024 };
    }
    if (lowerModelId.includes('nova-pro')) {
      return { input: 0.0008, output: 0.0032 };
    }
    if (lowerModelId.includes('pixtral')) {
      return { input: 0.002, output: 0.006 };
    }

    // Default fallback (Claude Sonnet pricing)
    console.warn(`[CostTracker] Unknown model pricing for: ${modelId}, using default`);
    return { input: 0.003, output: 0.015 };
  }
}
