import type { APIRoute } from 'astro';
import { ZodError, z } from 'zod';
import { createStreamSession } from '@/lib/server/streamSessions';

export const prerender = false;

const createStreamSchema = z.object({
  ttlHours: z.number().int().min(1).max(168).default(24),
  label: z.string().max(160).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = createStreamSchema.parse(await request.json().catch(() => ({})));
    const session = createStreamSession(body.ttlHours);

    return Response.json(
      {
        id: session.id,
        producerToken: session.producerToken,
        expiresAt: new Date(session.expiresAt).toISOString(),
        algorithm: session.algorithm,
        label: body.label,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return Response.json({ error: 'Invalid stream payload' }, { status: 400 });
    }

    return Response.json({ error: 'Unable to create stream' }, { status: 500 });
  }
};
