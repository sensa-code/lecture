import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEnv, CostTracker, CircuitBreaker, progressBar, sleep, parseNumericOption, handleError } from '../scripts/utils.js';

// ============================================
// validateEnv
// ============================================
describe('validateEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should pass when all required env vars are present', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    expect(() => validateEnv(['ANTHROPIC_API_KEY', 'SUPABASE_URL'])).not.toThrow();
  });

  it('should throw when a required env var is missing', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => validateEnv(['ANTHROPIC_API_KEY'])).toThrow('Missing environment variables: ANTHROPIC_API_KEY');
  });

  it('should list all missing env vars in error', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.SUPABASE_URL;
    expect(() => validateEnv(['ANTHROPIC_API_KEY', 'SUPABASE_URL'])).toThrow('ANTHROPIC_API_KEY, SUPABASE_URL');
  });

  it('should pass with empty required list', () => {
    expect(() => validateEnv([])).not.toThrow();
  });
});

// ============================================
// CostTracker
// ============================================
describe('CostTracker', () => {
  it('should start at zero', () => {
    const tracker = new CostTracker(5);
    expect(tracker.total).toBe(0);
    expect(tracker.remaining).toBe(5);
    expect(tracker.isOverBudget).toBe(false);
  });

  it('should accumulate costs', () => {
    const tracker = new CostTracker(5);
    tracker.add(1.5);
    expect(tracker.total).toBe(1.5);
    expect(tracker.remaining).toBe(3.5);
    tracker.add(2.0);
    expect(tracker.total).toBe(3.5);
    expect(tracker.remaining).toBe(1.5);
  });

  it('should detect over budget', () => {
    const tracker = new CostTracker(1);
    tracker.add(0.5);
    expect(tracker.isOverBudget).toBe(false);
    tracker.add(0.5);
    expect(tracker.isOverBudget).toBe(true);
  });

  it('should handle exceeding budget', () => {
    const tracker = new CostTracker(1);
    tracker.add(2);
    expect(tracker.isOverBudget).toBe(true);
    expect(tracker.remaining).toBe(0); // clamped at 0
  });

  it('should format as string', () => {
    const tracker = new CostTracker(5);
    tracker.add(1.2345);
    expect(tracker.toString()).toBe('$1.2345 / $5.00');
  });

  it('should handle zero budget', () => {
    const tracker = new CostTracker(0);
    expect(tracker.isOverBudget).toBe(true); // 0 >= 0
    expect(tracker.remaining).toBe(0);
  });

  it('should handle small increments precisely', () => {
    const tracker = new CostTracker(10);
    for (let i = 0; i < 100; i++) {
      tracker.add(0.08);
    }
    // Floating point: should be approximately 8.0
    expect(tracker.total).toBeCloseTo(8.0, 1);
    expect(tracker.isOverBudget).toBe(false);
  });
});

// ============================================
// CircuitBreaker
// ============================================
describe('CircuitBreaker', () => {
  it('should start closed', () => {
    const cb = new CircuitBreaker(3);
    expect(cb.isOpen).toBe(false);
    expect(cb.failures).toBe(0);
  });

  it('should open after threshold failures', () => {
    const cb = new CircuitBreaker(3);
    cb.recordFailure();
    expect(cb.isOpen).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);
    expect(cb.failures).toBe(3);
  });

  it('should reset on success', () => {
    const cb = new CircuitBreaker(3);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.failures).toBe(0);
    expect(cb.isOpen).toBe(false);
  });

  it('should track consecutive failures only', () => {
    const cb = new CircuitBreaker(3);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess(); // reset
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen).toBe(false); // only 2 consecutive
  });

  it('should use default threshold of 3', () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);
  });

  it('should handle threshold of 1', () => {
    const cb = new CircuitBreaker(1);
    expect(cb.isOpen).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);
  });
});

// ============================================
// progressBar
// ============================================
describe('progressBar', () => {
  it('should show 0% at start', () => {
    const bar = progressBar(0, 10);
    expect(bar).toContain('0%');
    expect(bar).toContain('(0/10)');
  });

  it('should show 100% at end', () => {
    const bar = progressBar(10, 10);
    expect(bar).toContain('100%');
    expect(bar).toContain('(10/10)');
  });

  it('should show 50% at midpoint', () => {
    const bar = progressBar(5, 10);
    expect(bar).toContain('50%');
    expect(bar).toContain('(5/10)');
  });

  it('should include label when provided', () => {
    const bar = progressBar(3, 10, 'lesson-01-03');
    expect(bar).toContain('lesson-01-03');
  });

  it('should work without label', () => {
    const bar = progressBar(1, 5);
    expect(bar).toContain('20%');
    expect(bar).toContain('(1/5)');
  });

  it('should contain bar characters', () => {
    const bar = progressBar(5, 10);
    // Should contain block characters (█ and ░)
    expect(bar).toMatch(/[█░]/);
  });

  it('should handle total=0 without NaN (N-6)', () => {
    const bar = progressBar(0, 0);
    expect(bar).toContain('no items');
    expect(bar).not.toContain('NaN');
  });

  it('should handle total=0 with label', () => {
    const bar = progressBar(0, 0, 'test');
    expect(bar).toContain('no items');
    expect(bar).toContain('test');
  });
});

// ============================================
// sleep
// ============================================
describe('sleep', () => {
  it('should resolve after specified time', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some tolerance
  });
});

// ============================================
// parseNumericOption (N-5: new tests for Round 1 functions)
// ============================================
describe('parseNumericOption', () => {
  // We need to mock process.exit since it calls it on error
  let mockExit: ReturnType<typeof vi.fn>;
  let mockConsoleError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should parse valid number', () => {
    expect(parseNumericOption('5', 'budget')).toBe(5);
  });

  it('should parse decimal number', () => {
    expect(parseNumericOption('3.14', 'budget')).toBeCloseTo(3.14);
  });

  it('should reject NaN (N-1 original fix)', () => {
    expect(() => parseNumericOption('abc', 'budget')).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('must be a finite number'));
  });

  it('should reject Infinity (N-1)', () => {
    expect(() => parseNumericOption('Infinity', 'budget')).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('must be a finite number'));
  });

  it('should reject -Infinity', () => {
    expect(() => parseNumericOption('-Infinity', 'budget')).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('must be a finite number'));
  });

  it('should reject empty string', () => {
    expect(() => parseNumericOption('', 'budget')).toThrow('process.exit called');
  });

  it('should enforce min', () => {
    expect(() => parseNumericOption('-1', 'budget', { min: 0.01 })).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('must be >= 0.01'));
  });

  it('should allow value at min boundary', () => {
    expect(parseNumericOption('0.01', 'budget', { min: 0.01 })).toBe(0.01);
  });

  it('should warn on high value (max)', () => {
    const result = parseNumericOption('200', 'budget', { max: 100 });
    expect(result).toBe(200); // still returns the value
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('very high'));
  });

  it('should enforce integer mode (N-4)', () => {
    expect(() => parseNumericOption('2.7', 'concurrency', { integer: true })).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('must be an integer'));
  });

  it('should accept integer in integer mode', () => {
    expect(parseNumericOption('3', 'concurrency', { integer: true })).toBe(3);
  });

  it('should accept integer value "2.0" in integer mode', () => {
    expect(parseNumericOption('2.0', 'concurrency', { integer: true })).toBe(2);
  });
});

// ============================================
// handleError (N-5: test the error handler)
// ============================================
describe('handleError', () => {
  let mockExit: ReturnType<typeof vi.fn>;
  let mockConsoleError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should display Error message cleanly', () => {
    expect(() => handleError(new Error('Something failed'))).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Something failed'));
  });

  it('should handle non-Error objects', () => {
    expect(() => handleError('string error')).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Unknown error'), 'string error');
  });

  it('should exit with code 1', () => {
    try { handleError(new Error('test')); } catch { /* expected */ }
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
