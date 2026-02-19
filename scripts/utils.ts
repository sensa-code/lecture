// Shared utilities for batch scripts
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

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
