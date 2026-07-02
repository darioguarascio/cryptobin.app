import { describe, expect, it } from 'vitest';
import { buildShareUrl, decryptSecret, encryptSecret, parseShareUrl } from './crypto';

describe('secret crypto', () => {
  it('encrypts and decrypts a secret with metadata', async () => {
    const encrypted = await encryptSecret({
      body: 'prod-api-key-123',
      metadata: {
        from: 'D',
        label: 'Production API key',
        description: 'Rotate after importing',
      },
    });

    expect(encrypted.payload.ciphertext).not.toContain('prod-api-key-123');
    expect(encrypted.payload.algorithm).toBe('AES-GCM-256');

    const decrypted = await decryptSecret(encrypted.payload, encrypted.key);

    expect(decrypted).toEqual({
      body: 'prod-api-key-123',
      metadata: {
        from: 'D',
        label: 'Production API key',
        description: 'Rotate after importing',
      },
    });
  });

  it('rejects decryption with the wrong key', async () => {
    const first = await encryptSecret({ body: 'first', metadata: {} });
    const second = await encryptSecret({ body: 'second', metadata: {} });

    await expect(decryptSecret(first.payload, second.key)).rejects.toThrow();
  });

  it('puts the key in the URL fragment', async () => {
    const url = buildShareUrl('https://cryptobin.app', 'secret-id', 'key-material');

    expect(url).toBe('https://cryptobin.app/s/secret-id#key-material');
  });

  it('parses path-based share URLs', () => {
    expect(
      parseShareUrl({ pathname: '/s/550e8400-e29b-41d4-a716-446655440000', hash: '#key-part' }),
    ).toEqual({
      secretId: '550e8400-e29b-41d4-a716-446655440000',
      key: 'key-part',
    });
  });

  it('rejects URLs without a path id or fragment key', () => {
    expect(parseShareUrl({ pathname: '/s/secret-id', hash: '' })).toBeNull();
    expect(parseShareUrl({ pathname: '/', hash: '#key-part' })).toBeNull();
  });
});
