import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import { storeSecret } from '@/lib/serverSecrets';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const record = storeSecret(body);

    return Response.json(
      {
        id: record.id,
        expiresAt: new Date(record.expiresAt).toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return Response.json({ error: 'Invalid encrypted secret payload' }, { status: 400 });
    }

    return Response.json({ error: 'Unable to store secret' }, { status: 500 });
  }
};
