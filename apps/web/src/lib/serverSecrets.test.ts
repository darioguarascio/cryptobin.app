import { beforeEach, describe, expect, it } from 'vitest';
import { clearExpiredSecrets, clearSecretsForTest, consumeSecret, storeSecret } from './serverSecrets';

const payload = {
  version: 1 as const,
  algorithm: 'AES-GCM-256' as const,
  iv: 'abcdefghijklmnop',
  ciphertext: 'abcdefghijklmnopqrstuvwxyz',
  ttlHours: 1,
};

describe('server secret store', () => {
  beforeEach(() => {
    clearSecretsForTest();
  });

  it('stores and consumes a secret only once', () => {
    const record = storeSecret(payload);

    expect(consumeSecret(record.id)?.payload.ciphertext).toBe(payload.ciphertext);
    expect(consumeSecret(record.id)).toBeNull();
  });

  it('does not return expired secrets', () => {
    const record = storeSecret(payload);

    expect(consumeSecret(record.id, record.expiresAt + 1)).toBeNull();
  });

  it('clears expired records without touching fresh records', () => {
    const expired = storeSecret(payload);
    const fresh = storeSecret({ ...payload, ttlHours: 24 });

    expect(clearExpiredSecrets(expired.expiresAt + 1)).toBe(1);
    expect(consumeSecret(fresh.id)?.id).toBe(fresh.id);
  });

  it('generates shorter ids for shorter expiries', () => {
    const short = storeSecret(payload);
    const long = storeSecret({ ...payload, algorithm: 'AES-GCM-256', ttlHours: 168 });

    expect(short.id.length).toBeLessThan(long.id.length);
  });

  it('rejects malformed encrypted payloads', () => {
    expect(() =>
      storeSecret({
        version: 1,
        algorithm: 'AES-GCM-256',
        iv: 'short',
        ciphertext: 'also-short',
        ttlHours: 24,
      }),
    ).toThrow();
  });
});
