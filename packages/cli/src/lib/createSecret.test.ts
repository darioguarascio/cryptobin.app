import { describe, expect, it, vi } from 'vitest';
import {
  createEncryptedShareLink,
  parseTtlHours,
  readSecretBody,
} from './createSecret.js';

describe('parseTtlHours', () => {
  it('accepts supported TTL values', () => {
    expect(parseTtlHours(72)).toBe(72);
  });

  it('defaults to 24 hours', () => {
    expect(parseTtlHours(undefined)).toBe(24);
  });

  it('rejects unsupported TTL values', () => {
    expect(() => parseTtlHours(12)).toThrow('TTL must be one of');
  });
});

describe('readSecretBody', () => {
  it('returns inline secret text', async () => {
    await expect(readSecretBody({ secret: 'inline' })).resolves.toBe('inline');
  });
});

describe('createEncryptedShareLink', () => {
  it('creates a share URL', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'drop-id', expiresAt: '2026-07-06T10:00:00.000Z' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await createEncryptedShareLink(
      {
        secret: 'hello world',
        ttlHours: 24,
        url: 'https://cryptobin.app',
        label: 'test',
      },
      { fetch: fetchImpl },
    );

    expect(result.url).toMatch(/^https:\/\/cryptobin\.app\/s\/drop-id#/);
    expect(result.ttlHours).toBe(24);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('rejects empty secrets', async () => {
    await expect(
      createEncryptedShareLink({ secret: '   ', ttlHours: 24 }),
    ).rejects.toThrow('Secret cannot be empty');
  });
});
