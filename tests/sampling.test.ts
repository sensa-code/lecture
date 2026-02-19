import { describe, it, expect } from 'vitest';
import { shouldForceManualReview } from '../src/lib/auto-fix.js';

describe('shouldForceManualReview (F-3 sampling)', () => {
  describe('default sampleRate (5)', () => {
    it('forces review at index 0', () => {
      expect(shouldForceManualReview(0, 5)).toBe(true);
    });

    it('skips review at indices 1-4', () => {
      for (let i = 1; i <= 4; i++) {
        expect(shouldForceManualReview(i, 5)).toBe(false);
      }
    });

    it('forces review at index 5', () => {
      expect(shouldForceManualReview(5, 5)).toBe(true);
    });

    it('forces review at multiples of 5', () => {
      expect(shouldForceManualReview(10, 5)).toBe(true);
      expect(shouldForceManualReview(15, 5)).toBe(true);
      expect(shouldForceManualReview(20, 5)).toBe(true);
      expect(shouldForceManualReview(25, 5)).toBe(true);
    });

    it('skips review at non-multiples of 5', () => {
      expect(shouldForceManualReview(7, 5)).toBe(false);
      expect(shouldForceManualReview(13, 5)).toBe(false);
      expect(shouldForceManualReview(22, 5)).toBe(false);
    });
  });

  describe('custom sampleRate', () => {
    it('sampleRate 1 reviews every lesson', () => {
      for (let i = 0; i < 10; i++) {
        expect(shouldForceManualReview(i, 1)).toBe(true);
      }
    });

    it('sampleRate 3 reviews every 3rd lesson', () => {
      expect(shouldForceManualReview(0, 3)).toBe(true);
      expect(shouldForceManualReview(1, 3)).toBe(false);
      expect(shouldForceManualReview(2, 3)).toBe(false);
      expect(shouldForceManualReview(3, 3)).toBe(true);
      expect(shouldForceManualReview(6, 3)).toBe(true);
    });

    it('sampleRate 10 reviews every 10th lesson', () => {
      expect(shouldForceManualReview(0, 10)).toBe(true);
      expect(shouldForceManualReview(5, 10)).toBe(false);
      expect(shouldForceManualReview(9, 10)).toBe(false);
      expect(shouldForceManualReview(10, 10)).toBe(true);
    });
  });

  describe('for a typical 25-lesson course', () => {
    it('samples exactly 5 out of 25 lessons with sampleRate 5', () => {
      let sampledCount = 0;
      for (let i = 0; i < 25; i++) {
        if (shouldForceManualReview(i, 5)) sampledCount++;
      }
      expect(sampledCount).toBe(5);
    });

    it('samples the correct lessons: 0, 5, 10, 15, 20', () => {
      const sampled: number[] = [];
      for (let i = 0; i < 25; i++) {
        if (shouldForceManualReview(i, 5)) sampled.push(i);
      }
      expect(sampled).toEqual([0, 5, 10, 15, 20]);
    });
  });
});
