import { afterEach, describe, expect, it } from 'vitest';
import { createStreamSession, postStreamPayload } from './streamApi.js';

describe('createStreamSession', () => {
  afterEach(() => {
    delete process.env.CRYPTOBIN_API_URL;
    delete process.env.CRYPTOBIN_API_HOST;
  });

  it('creates a stream session', async () => {
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://cryptobin.app/api/streams');
      expect(JSON.parse(String(init?.body))).toEqual({ ttlHours: 24, label: 'logs' });
      return new Response(
        JSON.stringify({
          id: 'stream1',
          producerToken: 'token',
          expiresAt: '2026-07-24T00:00:00.000Z',
          algorithm: 'AES-GCM-256',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    };

    const session = await createStreamSession(
      'https://cryptobin.app',
      { ttlHours: 24, label: 'logs' },
      fetchImpl as typeof fetch,
    );
    expect(session.id).toBe('stream1');
    expect(session.producerToken).toBe('token');
  });

  it('uses CRYPTOBIN_API_URL and Host override', async () => {
    process.env.CRYPTOBIN_API_URL = 'http://127.0.0.1:18080';
    process.env.CRYPTOBIN_API_HOST = 'cryptobin.app';

    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('http://127.0.0.1:18080/api/streams');
      const headers = init?.headers as Record<string, string>;
      expect(headers.Host).toBe('cryptobin.app');
      return new Response(
        JSON.stringify({
          id: 's',
          producerToken: 't',
          expiresAt: '2026-07-24T00:00:00.000Z',
          algorithm: 'AES-GCM-256',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    };

    await createStreamSession('https://cryptobin.app', {}, fetchImpl as typeof fetch);
  });

  it('surfaces redirect errors for edge-protected APIs', async () => {
    const fetchImpl = async () => new Response('', { status: 302 });
    await expect(createStreamSession('https://cryptobin.app', {}, fetchImpl as typeof fetch)).rejects.toThrow(
      /login redirect/,
    );
  });
});

describe('postStreamPayload', () => {
  it('posts encrypted frames', async () => {
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://cryptobin.app/api/streams/abc/frames');
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization).toBe('Bearer secret');
      return new Response(null, { status: 204 });
    };

    await postStreamPayload(
      'https://cryptobin.app',
      'abc',
      'secret',
      { type: 'frame', seq: 1, iv: 'iv', ciphertext: 'ct' },
      fetchImpl as typeof fetch,
    );
  });

  it('surfaces API errors', async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: 'Invalid producer token' }), { status: 403 });

    await expect(
      postStreamPayload('https://cryptobin.app', 'abc', 'bad', { type: 'end' }, fetchImpl as typeof fetch),
    ).rejects.toThrow('Invalid producer token');
  });
});
