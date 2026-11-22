// Shared Content Security Policy helpers for Vite dev, preview and static hosts.

export const FALLBACK_API_URL = 'http://localhost:8000';

export interface CspOptions {
  apiUrl?: string;
  isDev?: boolean;
}

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, '');
  }
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function buildContentSecurityPolicy({ apiUrl, isDev = false }: CspOptions = {}): string {
  const apiOrigin = originOf(apiUrl || FALLBACK_API_URL);
  const connectSources = unique([
    "'self'",
    apiOrigin,
    isDev ? 'ws://localhost:*' : null,
    isDev ? 'ws://127.0.0.1:*' : null,
  ]);
  const scriptSources = isDev ? ["'self'", "'unsafe-inline'"] : ["'self'"];

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    `connect-src ${connectSources.join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function buildSecurityHeaders({
  apiUrl,
  isProduction,
}: {
  apiUrl?: string;
  isProduction: boolean;
}): Record<string, string> {
  return {
    'Content-Security-Policy': buildContentSecurityPolicy({
      apiUrl,
      isDev: !isProduction,
    }),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    ...(isProduction
      ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' }
      : {}),
  };
}
