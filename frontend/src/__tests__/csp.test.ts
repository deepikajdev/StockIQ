import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildContentSecurityPolicy, buildSecurityHeaders } from '../utils/csp.ts';

describe('Content Security Policy', () => {
  it('allows Vite HMR and inline bootstrap scripts in development', () => {
    const csp = buildContentSecurityPolicy({
      apiUrl: 'http://localhost:8000',
      isDev: true,
    });

    assert.match(csp, /script-src 'self' 'unsafe-inline'/);
    assert.match(csp, /connect-src[^;]*ws:\/\/localhost:\*/);
    assert.match(csp, /connect-src[^;]*http:\/\/localhost:8000/);
    assert.match(csp, /frame-ancestors 'none'/);
  });

  it('omits inline scripts and restricts API origins in production', () => {
    const csp = buildContentSecurityPolicy({
      apiUrl: 'https://api.example.com/v1',
      isDev: false,
    });

    assert.match(csp, /script-src 'self'(?! 'unsafe-inline')/);
    assert.match(csp, /connect-src 'self' https:\/\/api\.example\.com/);
    assert.doesNotMatch(csp, /ws:\/\//);
    assert.match(csp, /object-src 'none'/);
  });

  it('adds HSTS only for production headers', () => {
    const dev = buildSecurityHeaders({ isProduction: false });
    const prod = buildSecurityHeaders({
      apiUrl: 'https://api.example.com',
      isProduction: true,
    });

    assert.equal(dev['Strict-Transport-Security'], undefined);
    assert.match(prod['Strict-Transport-Security'], /max-age=31536000/);
    assert.equal(prod['X-Content-Type-Options'], 'nosniff');
    assert.equal(prod['X-Frame-Options'], 'DENY');
  });
});
