import { describe, expect, it, vi } from 'vitest';
import { type Request, type Response } from 'express';
import { securityHeaders } from './security-headers.middleware.js';

describe('securityHeaders', () => {
  it('interdit la mise en cache et l’affichage en cadre', () => {
    const headers = new Map<string, string>();
    const response = {
      setHeader: (k: string, v: string) => headers.set(k, v),
    } as unknown as Response;
    const next = vi.fn();
    securityHeaders({ path: '/api/v1/scouts' } as Request, response, next);
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(next).toHaveBeenCalledOnce();
  });
});
