// Safe JSON parsing utility
// Returns null on parse failure instead of throwing

/**
 * Safely parse a JSON string, returning null on failure.
 * Handles common AI output issues:
 * - Leading/trailing markdown code blocks
 * - HTML content mixed in
 * - Empty strings
 */
export function safeParseJSON<T = unknown>(input: string): T | null {
  if (!input || typeof input !== 'string') return null;

  // Remove markdown code block wrappers if present
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
  cleaned = cleaned.trim();

  if (!cleaned) return null;

  // Check for HTML content (common when API returns error pages)
  if (cleaned.startsWith('<!DOCTYPE') || cleaned.startsWith('<html')) {
    return null;
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
