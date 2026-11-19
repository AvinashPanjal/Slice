export const DEFAULT_AI_KEY = 'slice_sec_99a8b7c6d5e4';

/**
 * Validates the API key from:
 * 1. Authorization header (Bearer token)
 * 2. x-api-key header
 * 3. Query parameter (?key=... or ?api_key=... or ?token=...)
 */
export function validateAiAuth(request: Request): { authenticated: boolean; error?: string } {
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  let providedKey = '';
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    providedKey = authHeader.slice(7).trim();
  } else if (apiKeyHeader) {
    providedKey = apiKeyHeader.trim();
  }

  // Fallback to query parameter (convenient for MCP Server URLs)
  if (!providedKey) {
    try {
      const url = new URL(request.url);
      providedKey =
        url.searchParams.get('key')?.trim() ||
        url.searchParams.get('api_key')?.trim() ||
        url.searchParams.get('token')?.trim() ||
        '';
    } catch {
      // ignore URL parse errors
    }
  }

  const expectedKey = process.env.SLICE_AI_API_KEY || process.env.AI_SECRET_KEY || DEFAULT_AI_KEY;

  if (!providedKey) {
    return {
      authenticated: false,
      error: 'Missing API key. Provide Bearer token, x-api-key header, or ?key=... in the URL.',
    };
  }

  if (providedKey !== expectedKey) {
    return {
      authenticated: false,
      error: 'Invalid API key. Please check your AI API key in Settings.',
    };
  }

  return { authenticated: true };
}
