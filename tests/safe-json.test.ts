import { describe, it, expect } from 'vitest';
import { safeParseJSON } from '../src/lib/safe-json.js';

describe('safeParseJSON', () => {
  it('parses valid JSON', () => {
    const result = safeParseJSON<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: 'test' });
  });

  it('parses JSON wrapped in markdown code blocks', () => {
    const input = '```json\n{"name": "test"}\n```';
    const result = safeParseJSON<{ name: string }>(input);
    expect(result).toEqual({ name: 'test' });
  });

  it('parses JSON with code block without json label', () => {
    const input = '```\n{"name": "test"}\n```';
    const result = safeParseJSON<{ name: string }>(input);
    expect(result).toEqual({ name: 'test' });
  });

  it('returns null for HTML content', () => {
    const input = '<!DOCTYPE html><html><body>Error</body></html>';
    expect(safeParseJSON(input)).toBeNull();
  });

  it('returns null for html tag content', () => {
    const input = '<html><head></head><body>Server Error</body></html>';
    expect(safeParseJSON(input)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeParseJSON('')).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(safeParseJSON(null as unknown as string)).toBeNull();
    expect(safeParseJSON(undefined as unknown as string)).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(safeParseJSON('{name: test}')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(safeParseJSON(42 as unknown as string)).toBeNull();
  });

  it('handles JSON arrays', () => {
    const result = safeParseJSON<number[]>('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it('handles nested objects', () => {
    const input = '{"a": {"b": {"c": 1}}}';
    const result = safeParseJSON<Record<string, unknown>>(input);
    expect(result).toEqual({ a: { b: { c: 1 } } });
  });

  it('handles whitespace-only string', () => {
    expect(safeParseJSON('   \n\t  ')).toBeNull();
  });
});
