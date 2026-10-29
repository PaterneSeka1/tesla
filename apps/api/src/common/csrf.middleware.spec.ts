import { type Request, type Response } from 'express';
import { csrfProtection } from './csrf.middleware.js';

function run(method: string, headers: Record<string, string>) {
  const next = vi.fn();
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { status } as unknown as Response;
  csrfProtection(['http://localhost:3000'])(
    { method, headers, originalUrl: '/api/v1/teams' } as unknown as Request,
    response,
    next,
  );
  return { next, status, json };
}

describe('Protection CSRF', () => {
  it('laisse passer les lectures', () => {
    expect(run('GET', {}).next).toHaveBeenCalled();
  });

  it('exige l’en-tête dédié sur les écritures', () => {
    const { next, status, json } = run('POST', { origin: 'http://localhost:3000' });
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_REJECTED' }));
  });

  it('refuse une origine non autorisée même avec l’en-tête', () => {
    expect(
      run('POST', { origin: 'https://evil.test', 'x-tesla-csrf': '1' }).next,
    ).not.toHaveBeenCalled();
  });

  it('accepte une écriture conforme', () => {
    expect(
      run('PATCH', { origin: 'http://localhost:3000', 'x-tesla-csrf': '1' }).next,
    ).toHaveBeenCalled();
    expect(run('POST', { 'x-tesla-csrf': '1' }).next).toHaveBeenCalled();
  });
});
