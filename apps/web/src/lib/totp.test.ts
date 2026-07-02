import { describe, expect, it } from 'vitest';
import { buildTotpUri, createTotpSecret, normalizeTotpCode, verifyTotpCode } from './totp';

describe('totp', () => {
  it('creates secrets and otpauth URIs', () => {
    const secret = createTotpSecret();
    expect(secret.length).toBeGreaterThan(10);
    expect(buildTotpUri(secret, 'alice')).toContain('otpauth://');
  });

  it('normalizes authenticator codes', () => {
    expect(normalizeTotpCode('123 456')).toBe('123456');
  });

  it('rejects invalid codes', async () => {
    const secret = createTotpSecret();
    await expect(verifyTotpCode(secret, '000000')).resolves.toBe(false);
  });
});
