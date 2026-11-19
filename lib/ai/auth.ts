export const DEFAULT_AI_KEY = 'slice_sec_99a8b7c6d5e4';

/**
 * Validates the API key from Authorization header (Bearer token) or x-api-key header.
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

  const expectedKey = process.env.SLICE_AI_API_KEY || process.env.AI_SECRET_KEY || DEFAULT_AI_KEY;

  if (!providedKey) {
    return {
      authenticated: false,
      error: 'Missing API key. Please provide Bearer token in Authorization header or x-api-key header.',
    };
  }

  if (providedKey !== expectedKey) {
    return {
      authenticated: false,
      error: 'Invalid API key. Please check your AI API key in Settings or environment variables.',
    };
  }

  return { authenticated: true };
}
