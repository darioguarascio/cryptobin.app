import { beforeEach, describe, expect, it } from 'vitest';
import { callApi } from '@/test/helpers/api';
import { POST as createStream } from '@/pages/api/streams/index';
import { POST as postFrame } from '@/pages/api/streams/[id]/frames';
import { clearStreamSessionsForTest, createStreamSession, formatStreamSse } from '@/lib/server/streamSessions';

describe('streams API routes (unit)', () => {
  beforeEach(() => {
    clearStreamSessionsForTest();
  });

  it('returns 201 with producer token when POST body is valid', async () => {
    const response = await callApi(createStream, {
      method: 'POST',
      url: 'http://localhost/api/streams',
      body: { ttlHours: 2 },
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      id: string;
      producerToken: string;
      expiresAt: string;
      algorithm: string;
    };
    expect(body.id.length).toBeGreaterThan(8);
    expect(body.producerToken.length).toBeGreaterThan(16);
    expect(body.algorithm).toBe('AES-GCM-256');
    expect(body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('accepts encrypted frames with a valid producer token', async () => {
    const session = createStreamSession(1);

    const denied = await callApi(postFrame, {
      method: 'POST',
      url: `http://localhost/api/streams/${session.id}/frames`,
      params: { id: session.id },
      body: {
        type: 'frame',
        seq: 1,
        iv: 'abcdefghijkl',
        ciphertext: 'abcdefghijklmnopqrstuvwxyz',
      },
    });
    expect(denied.status).toBe(403);

    const request = new Request(`http://localhost/api/streams/${session.id}/frames`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.producerToken}`,
      },
      body: JSON.stringify({
        type: 'frame',
        seq: 1,
        iv: 'abcdefghijkl',
        ciphertext: 'abcdefghijklmnopqrstuvwxyz',
      }),
    });

    const response = await postFrame({
      request,
      params: { id: session.id },
    } as unknown as Parameters<typeof postFrame>[0]);

    expect(response.status).toBe(204);
  });

  it('formats SSE payloads', () => {
    expect(formatStreamSse({ type: 'hello', algorithm: 'AES-GCM-256' })).toBe(
      'data: {"type":"hello","algorithm":"AES-GCM-256"}\n\n',
    );
  });
});
