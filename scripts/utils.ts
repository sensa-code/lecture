// Shared utilities for batch scripts
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';

/** Validate required environment variables */
export function validateEnv(required: string[]): void {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

/** Create authenticated Supabase client */
export function createSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
  return createClient(url, key);
}

/** Create Claude API client */
export function createClaude() {
  return new Anthropic();
}

/** Cost tracker for budget cap enforcement */
export class CostTracker {
  private spent = 0;
  private readonly budget: number;

  constructor(budgetUsd: number) {
    this.budget = budgetUsd;
  }

  add(cost: number): void {
    this.spent += cost;
  }

  get total(): number {
    return this.spent;
  }

  get remaining(): number {
    return Math.max(0, this.budget - this.spent);
  }

  get isOverBudget(): boolean {
    return this.spent >= this.budget;
  }

  toString(): string {
    return `$${this.spent.toFixed(4)} / $${this.budget.toFixed(2)}`;
  }
}

/** Simple progress bar */
export function progressBar(current: number, total: number, label = ''): string {
  if (total <= 0) return `[no items] ${label}`.trim();
  const width = 30;
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  const pct = Math.round((current / total) * 100);
  return `[${bar}] ${pct}% (${current}/${total}) ${label}`;
}

/** Sleep helper */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate and parse a numeric CLI option.
 * Returns the parsed number or exits with error.
 */
export function parseNumericOption(
  value: string,
  name: string,
  opts: { min?: number; max?: number; integer?: boolean } = {}
): number {
  const num = parseFloat(value);
  if (isNaN(num) || !isFinite(num)) {
    console.error(`❌ Error: --${name} must be a finite number, got '${value}'`);
    process.exit(1);
  }
  if (opts.integer && !Number.isInteger(num)) {
    console.error(`❌ Error: --${name} must be an integer, got ${num}`);
    process.exit(1);
  }
  if (opts.min !== undefined && num < opts.min) {
    console.error(`❌ Error: --${name} must be >= ${opts.min}, got ${num}`);
    process.exit(1);
  }
  if (opts.max !== undefined && num > opts.max) {
    console.error(`⚠️ Warning: --${name} is very high (${num}). Max recommended: ${opts.max}`);
  }
  return num;
}

/**
 * Safe file reader with user-friendly error.
 */
export async function readFileSafe(path: string, description: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      console.error(`❌ Error: ${description} not found: ${path}`);
      process.exit(1);
    }
    throw err;
  }
}

/**
 * Top-level error handler for CLI scripts.
 * Shows clean message instead of raw stack trace.
 */
export function handleError(error: unknown): never {
  if (error instanceof Error) {
    console.error(`\n❌ ${error.message}`);
    if (process.env.VERBOSE === '1' || process.argv.includes('--verbose')) {
      console.error(error.stack);
    }
  } else {
    console.error(`\n❌ Unknown error:`, error);
  }
  process.exit(1);
}

/** Circuit breaker: tracks consecutive failures */
export class CircuitBreaker {
  private consecutiveFailures = 0;
  private readonly threshold: number;

  constructor(threshold = 3) {
    this.threshold = threshold;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures++;
  }

  get isOpen(): boolean {
    return this.consecutiveFailures >= this.threshold;
  }

  get failures(): number {
    return this.consecutiveFailures;
  }
}
