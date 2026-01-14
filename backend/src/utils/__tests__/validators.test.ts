import { describe, it, expect } from 'vitest';
import {
  isReviewStatus,
  isDocumentFormat,
  isPillarName,
  validateEmail,
  validateReviewStatus,
  validateDocumentFormat,
  validatePillarName,
  validatePillarNames,
  validateRequiredString,
  validateStatusTransition,
  validateFileSize,
  validateFileExtension,
} from '../validators';
import { ValidationError } from '../../types/index.js';

describe('Type Guards', () => {
  describe('isReviewStatus', () => {
    it('should return true for valid review statuses', () => {
      expect(isReviewStatus('In Review')).toBe(true);
      expect(isReviewStatus('Modification Required')).toBe(true);
      expect(isReviewStatus('Review Completed')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isReviewStatus('Invalid')).toBe(false);
      expect(isReviewStatus(123)).toBe(false);
      expect(isReviewStatus(null)).toBe(false);
    });
  });

  describe('isDocumentFormat', () => {
    it('should return true for valid document formats', () => {
      expect(isDocumentFormat('ppt')).toBe(true);
      expect(isDocumentFormat('pdf')).toBe(true);
      expect(isDocumentFormat('word')).toBe(true);
      expect(isDocumentFormat('gdoc')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isDocumentFormat('txt')).toBe(false);
      expect(isDocumentFormat(123)).toBe(false);
    });
  });

  describe('isPillarName', () => {
    it('should return true for valid pillar names', () => {
      expect(isPillarName('Operational Excellence')).toBe(true);
      expect(isPillarName('Security')).toBe(true);
      expect(isPillarName('Reliability')).toBe(true);
      expect(isPillarName('Performance Efficiency')).toBe(true);
      expect(isPillarName('Cost Optimization')).toBe(true);
      expect(isPillarName('Sustainability')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isPillarName('Invalid Pillar')).toBe(false);
      expect(isPillarName('')).toBe(false);
    });
  });
});

describe('Validation Functions', () => {
  describe('validateEmail', () => {
    it('should return true for valid emails', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user@company.co.kr')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validateReviewStatus', () => {
    it('should return status for valid values', () => {
      expect(validateReviewStatus('In Review')).toBe('In Review');
    });

    it('should throw ValidationError for invalid values', () => {
      expect(() => validateReviewStatus('Invalid')).toThrow(ValidationError);
    });
  });

  describe('validatePillarNames', () => {
    it('should return array for valid pillar names', () => {
      const pillars = ['Security', 'Reliability'];
      expect(validatePillarNames(pillars)).toEqual(pillars);
    });

    it('should throw ValidationError for empty array', () => {
      expect(() => validatePillarNames([])).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid pillar', () => {
      expect(() => validatePillarNames(['Invalid'])).toThrow(ValidationError);
    });
  });

  describe('validateRequiredString', () => {
    it('should return trimmed string for valid input', () => {
      expect(validateRequiredString('  test  ', 'field')).toBe('test');
    });

    it('should throw ValidationError for empty string', () => {
      expect(() => validateRequiredString('', 'field')).toThrow(ValidationError);
      expect(() => validateRequiredString('   ', 'field')).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-string', () => {
      expect(() => validateRequiredString(123, 'field')).toThrow(ValidationError);
    });
  });
});

describe('Status Transition Validation', () => {
  describe('validateStatusTransition', () => {
    it('should allow valid transitions', () => {
      expect(() => 
        validateStatusTransition('In Review', 'Modification Required')
      ).not.toThrow();
      
      expect(() => 
        validateStatusTransition('In Review', 'Review Completed')
      ).not.toThrow();
      
      expect(() => 
        validateStatusTransition('Modification Required', 'In Review')
      ).not.toThrow();
    });

    it('should reject invalid transitions', () => {
      expect(() => 
        validateStatusTransition('Review Completed', 'In Review')
      ).toThrow(ValidationError);
      
      expect(() => 
        validateStatusTransition('Modification Required', 'Review Completed')
      ).toThrow(ValidationError);
    });
  });
});

describe('File Validation', () => {
  describe('validateFileSize', () => {
    it('should not throw for valid file sizes', () => {
      expect(() => validateFileSize(1024)).not.toThrow();
      expect(() => validateFileSize(50 * 1024 * 1024)).not.toThrow();
    });

    it('should throw ValidationError for oversized files', () => {
      expect(() => validateFileSize(200 * 1024 * 1024)).toThrow(ValidationError);
    });
  });

  describe('validateFileExtension', () => {
    it('should not throw for valid extensions', () => {
      expect(() => validateFileExtension('doc.pdf', 'pdf')).not.toThrow();
      expect(() => validateFileExtension('presentation.pptx', 'ppt')).not.toThrow();
      expect(() => validateFileExtension('document.docx', 'word')).not.toThrow();
    });

    it('should throw ValidationError for mismatched extensions', () => {
      expect(() => validateFileExtension('doc.pdf', 'word')).toThrow(ValidationError);
      expect(() => validateFileExtension('doc.txt', 'pdf')).toThrow(ValidationError);
    });
  });
});
