import { describe, expect, it } from 'vitest';
import {
  clearSessionCookieHeader,
  createSessionToken,
  getSessionTokenFromRequest,
  hashPassword,
  hashSessionToken,
  safeEqualString,
  sessionCookieHeader,
  verifyPassword,
} from './sessionHelpers';

describe('session helpers', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  }, 15000);

  it('hashes session tokens deterministically', () => {
    expect(hashSessionToken('abc')).toHaveLength(64);
    expect(hashSessionToken('abc')).toBe(hashSessionToken('abc'));
  });

  it('creates random session tokens', () => {
    expect(createSessionToken()).not.toBe(createSessionToken());
  });

  it('reads session cookies from requests', () => {
    const request = new Request('https://cryptobin.app/api/auth', {
      headers: { cookie: 'other=1; cryptobin_session=token%2Bvalue; foo=bar' },
    });
    expect(getSessionTokenFromRequest(request)).toBe('token+value');
  });

  it('builds session cookie headers', () => {
    const header = sessionCookieHeader('abc', new Date(Date.now() + 60_000));
    expect(header).toContain('cryptobin_session=abc');
    expect(header).toContain('HttpOnly');
  });

  it('clears session cookies', () => {
    expect(clearSessionCookieHeader()).toContain('Max-Age=0');
  });

  it('compares strings safely', () => {
    expect(safeEqualString('same', 'same')).toBe(true);
    expect(safeEqualString('same', 'other')).toBe(false);
  });
});
