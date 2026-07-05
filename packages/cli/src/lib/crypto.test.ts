import { describe, expect, it } from 'vitest';
import { buildShareUrl, decryptSecret, encryptSecret } from './crypto.js';

describe('crypto', () => {
  it('encrypts and decrypts secrets', async () => {
    const plain = {
      body: 'super-secret-token',
      metadata: { label: 'rotation' },
    };

    const encrypted = await encryptSecret(plain, 24);
    const decrypted = await decryptSecret(encrypted.payload, encrypted.key);

    expect(decrypted).toEqual(plain);
  });

  it('uses shorter keys for one-hour links', async () => {
    const encrypted = await encryptSecret({ body: 'x', metadata: {} }, 1);
    expect(encrypted.payload.algorithm).toBe('AES-GCM-128');
  });

  it('builds share URLs with fragment keys', () => {
    expect(buildShareUrl('https://cryptobin.app', 'abc', 'key123')).toBe(
      'https://cryptobin.app/s/abc#key123',
    );
  });

  it('rejects unsupported payload versions', async () => {
    const encrypted = await encryptSecret({ body: 'x', metadata: {} }, 24);
    await expect(
      decryptSecret({ ...encrypted.payload, version: 2 as 1 }, encrypted.key),
    ).rejects.toThrow('Unsupported secret payload');
  });
});
