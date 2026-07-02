import type { APIRoute } from 'astro';
import { consumeSecret } from '@/lib/serverSecrets';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;

  if (!id) {
    return Response.json({ error: 'Missing secret id' }, { status: 400 });
  }

  const record = consumeSecret(id);

  if (!record) {
    return Response.json({ error: 'Secret not found or already consumed' }, { status: 404 });
  }

  return Response.json({
    version: record.payload.version,
    algorithm: record.payload.algorithm,
    iv: record.payload.iv,
    ciphertext: record.payload.ciphertext,
  });
};
