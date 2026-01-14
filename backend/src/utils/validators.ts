/**
 * Validation utilities for type checking and data validation
 */

import {
  ReviewStatus,
  DocumentFormat,
  PillarName,
  ValidationError,
} from '../types/index.js';

// ========================================
// Type Guards
// ========================================

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return (
    typeof value === 'string' &&
    ['In Review', 'Modification Required', 'Review Completed', 'Rejected'].includes(value)
  );
}

export function isDocumentFormat(value: unknown): value is DocumentFormat {
  return (
    typeof value === 'string' &&
    ['pdf', 'png', 'jpg', 'jpeg'].includes(value)
  );
}

export function isPillarName(value: unknown): value is PillarName {
  return (
    typeof value === 'string' &&
    [
      'Operational Excellence',
      'Security',
      'Reliability',
      'Performance Efficiency',
      'Cost Optimization',
      'Sustainability',
    ].includes(value)
  );
}

// ========================================
// Validation Functions
// ========================================

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateReviewStatus(status: unknown): ReviewStatus {
  if (!isReviewStatus(status)) {
    throw new ValidationError(
      `Invalid review status: ${status}. Must be one of: In Review, Modification Required, Review Completed, Rejected`
    );
  }
  return status;
}

export function validateDocumentFormat(format: unknown): DocumentFormat {
  if (!isDocumentFormat(format)) {
    throw new ValidationError(
      `Invalid document format: ${format}. Must be one of: pdf, png, jpg, jpeg`
    );
  }
  return format;
}

export function validatePillarName(pillar: unknown): PillarName {
  if (!isPillarName(pillar)) {
    throw new ValidationError(
      `Invalid pillar name: ${pillar}. Must be one of the 6 Well-Architected pillars`
    );
  }
  return pillar;
}

export function validatePillarNames(pillars: unknown[]): PillarName[] {
  if (!Array.isArray(pillars)) {
    throw new ValidationError('Pillars must be an array');
  }
  
  if (pillars.length === 0) {
    throw new ValidationError('At least one pillar must be selected');
  }
  
  return pillars.map(validatePillarName);
}

export function validateRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required and must be a non-empty string`);
  }
  return value.trim();
}

export function validateRequiredNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} is required and must be a valid number`);
  }
  return value;
}

export function validatePositiveNumber(value: number, fieldName: string): number {
  if (value <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number`);
  }
  return value;
}

export function validateUUID(value: string, fieldName: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`);
  }
  return value;
}

export function validateISODate(value: string, fieldName: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid ISO 8601 date string`);
  }
  return value;
}

// ========================================
// Status Transition Validation
// ========================================

const VALID_STATUS_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  'Pending Review': ['In Review', 'Rejected'],
  'In Review': ['Modification Required', 'Review Completed', 'Rejected'],
  'Modification Required': ['In Review'],
  'Review Completed': ['In Review'], // 재검토 허용
  'Rejected': [],
};

export function validateStatusTransition(
  currentStatus: ReviewStatus,
  newStatus: ReviewStatus
): void {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
  
  if (!allowedTransitions.includes(newStatus)) {
    throw new ValidationError(
      `Invalid status transition from "${currentStatus}" to "${newStatus}". ` +
      `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
    );
  }
}

// ========================================
// File Validation
// ========================================

export function validateFileSize(fileSize: number, maxSizeBytes: number = 100 * 1024 * 1024): void {
  if (fileSize > maxSizeBytes) {
    throw new ValidationError(
      `File size ${fileSize} bytes exceeds maximum allowed size of ${maxSizeBytes} bytes`
    );
  }
}

export function validateFileExtension(fileName: string, format: DocumentFormat): void {
  const extensionMap: Record<DocumentFormat, string[]> = {
    pdf: ['.pdf'],
    png: ['.png'],
    jpg: ['.jpg', '.jpeg'],
    jpeg: ['.jpg', '.jpeg'],
  };
  
  const allowedExtensions = extensionMap[format];
  const hasValidExtension = allowedExtensions.some(ext => 
    fileName.toLowerCase().endsWith(ext)
  );
  
  if (!hasValidExtension) {
    throw new ValidationError(
      `File extension for ${fileName} does not match format ${format}. ` +
      `Expected one of: ${allowedExtensions.join(', ')}`
    );
  }
}
