/**
 * Review Execution Worker
 * This Lambda is invoked asynchronously to perform the actual review execution
 */

import { ReviewExecutionService } from '../services/ReviewExecutionService.js';
import { PillarName } from '../types/index.js';

const reviewExecutionService = new ReviewExecutionService();

interface WorkerPayload {
  executionId: string;
  reviewRequestId: string;
  documentId: string;
  versionNumber: number;
  selectedPillars: PillarName[];
  governancePolicyIds: string[];
  architecturePages?: number[];
  instructions: Record<string, string>;
}

export async function handler(event: WorkerPayload): Promise<void> {
  console.log('Review Execution Worker started:', event.executionId);
  console.log('Selected Pillars:', event.selectedPillars);

  try {
    // Execute the review
    await reviewExecutionService.executeReviewSync({
      executionId: event.executionId,
      reviewRequestId: event.reviewRequestId,
      documentId: event.documentId,
      versionNumber: event.versionNumber,
      selectedPillars: event.selectedPillars,
      governancePolicyIds: event.governancePolicyIds,
      architecturePages: event.architecturePages,
      instructions: event.instructions,
    });

    console.log('Review execution completed:', event.executionId);
  } catch (error) {
    console.error('Review execution worker failed:', error);
    // Error handling is done in executeReviewSync
    throw error;
  }
}
