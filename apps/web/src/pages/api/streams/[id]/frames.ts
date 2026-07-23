import type { APIRoute } from 'astro';
import { z, ZodError } from 'zod';
import {
  getStreamSession,
  MAX_STREAM_FRAME_BYTES,
  markStreamEnded,
  producerTokenFromRequest,
  pushStreamFrame,
  validateProducerToken,
} from '@/lib/server/streamSessions';

export const prerender = false;

const frameSchema = z.object({
  type: z.literal('frame'),
  seq: z.number().int().positive(),
  iv: z.string().min(12),
  ciphertext: z.string().min(16).max(MAX_STREAM_FRAME_BYTES * 2),
});

const endSchema = z.object({
  type: z.literal('end'),
});

const bodySchema = z.union([frameSchema, endSchema]);

export const POST: APIRoute = async ({ params, request }) => {
  const streamId = params.id;
  if (!streamId) {
    return Response.json({ error: 'Missing stream id' }, { status: 400 });
  }

  const session = getStreamSession(streamId);
  if (!session) {
    return Response.json({ error: 'Stream missing or expired' }, { status: 404 });
  }

  if (session.ended) {
    return Response.json({ error: 'Stream already ended' }, { status: 409 });
  }

  const token = producerTokenFromRequest(request);
  if (!validateProducerToken(session, token)) {
    return Response.json({ error: 'Invalid producer token' }, { status: 403 });
  }

  try {
    const body = bodySchema.parse(await request.json());

    if (body.type === 'end') {
      markStreamEnded(session);
      return new Response(null, { status: 204 });
    }

    pushStreamFrame(session, {
      seq: body.seq,
      iv: body.iv,
      ciphertext: body.ciphertext,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return Response.json({ error: 'Invalid stream frame' }, { status: 400 });
    }
    return Response.json({ error: 'Unable to accept stream frame' }, { status: 500 });
  }
};
