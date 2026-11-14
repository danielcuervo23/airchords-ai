import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Rule { source: string; headers: { key: string; value: string }[] }
const cfg = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8')) as { headers: Rule[] };
const all = cfg.headers.find((h) => h.source === '/(.*)')!;
const get = (rule: Rule | undefined, key: string) => rule?.headers.find((h) => h.key === key)?.value;

describe('vercel.json headers', () => {
  it('has a global rule', () => expect(all).toBeDefined());
  it('CSP is strict for scripts and denies framing', () => {
    const csp = get(all, 'Content-Security-Policy')!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('worker-src');
  });
  it('Permissions-Policy allows only own camera', () =>
    expect(get(all, 'Permissions-Policy')).toBe('camera=(self), microphone=()'));
  it('Referrer-Policy', () => expect(get(all, 'Referrer-Policy')).toBe('no-referrer'));
  it('nosniff', () => expect(get(all, 'X-Content-Type-Options')).toBe('nosniff'));
  it('immutable cache only for hashed /assets', () => {
    const cc = get(cfg.headers.find((h) => h.source === '/assets/(.*)'), 'Cache-Control');
    expect(cc).toContain('immutable');
    expect(cc).toContain('max-age=31536000');
  });
  it('unhashed /mediapipe is revalidated, not immutable', () => {
    const cc = get(cfg.headers.find((h) => h.source === '/mediapipe/(.*)'), 'Cache-Control');
    expect(cc).toBe('public, max-age=86400, stale-while-revalidate=604800');
  });
});
