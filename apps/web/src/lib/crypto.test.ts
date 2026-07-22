import { describe, expect, it } from 'vitest';
import { buildShareUrl, decryptSecret, encryptSecret, parseShareUrl } from './crypto';
import { MAX_SECRET_BYTES } from './secretLimits';

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

  it('uses shorter keys and algorithms for one-hour links', async () => {
    const encrypted = await encryptSecret({ body: 'short-lived', metadata: {} }, 1);

    expect(encrypted.payload.algorithm).toBe('AES-GCM-128');
    expect(encrypted.key.length).toBeLessThan(30);

    const decrypted = await decryptSecret(encrypted.payload, encrypted.key);
    expect(decrypted.body).toBe('short-lived');
  });

  it('builds more compact one-hour share URLs than week-long links', async () => {
    const origin = 'https://cryptobin.app';
    const short = await encryptSecret({ body: 'a', metadata: {} }, 1);
    const long = await encryptSecret({ body: 'a', metadata: {} }, 168);

    const shortUrl = buildShareUrl(origin, 'abcdefgh', short.key);
    const longUrl = buildShareUrl(origin, 'abcdefghijklmnopqrstuv', long.key);

    expect(shortUrl.length).toBeLessThan(longUrl.length);
    expect(short.key.length).toBeLessThan(long.key.length);
  });

  it('puts the key in the URL fragment', async () => {
    const url = buildShareUrl('https://cryptobin.app', 'secret-id', 'key-material');

    expect(url).toBe('https://cryptobin.app/s/secret-id#key-material');
  });

  it('parses path-based share URLs', () => {
    expect(
      parseShareUrl({ pathname: '/s/aZ83kd9Q', hash: '#key-part' }),
    ).toEqual({
      secretId: 'aZ83kd9Q',
      key: 'key-part',
    });
  });

  it('rejects URLs without a path id or fragment key', () => {
    expect(parseShareUrl({ pathname: '/s/secret-id', hash: '' })).toBeNull();
    expect(parseShareUrl({ pathname: '/', hash: '#key-part' })).toBeNull();
  });

  it('rejects secrets larger than 4 MiB', async () => {
    await expect(
      encryptSecret({ body: 'x'.repeat(MAX_SECRET_BYTES + 1), metadata: {} }),
    ).rejects.toThrow(/4 MiB/);
  });
});
