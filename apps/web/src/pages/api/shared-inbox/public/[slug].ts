import type { APIRoute } from 'astro';
import { normalizeHandle } from '@/lib/handles';
import { getSharedInboxBySlug } from '@/lib/server/sharedInboxAccess';

export const GET: APIRoute = async ({ params }) => {
  const slug = normalizeHandle(params.slug ?? '');
  if (!slug) {
    return Response.json({ error: 'Slug required.' }, { status: 400 });
  }

  const inbox = await getSharedInboxBySlug(slug);
  if (!inbox) {
    return Response.json({ error: 'Shared inbox not found.' }, { status: 404 });
  }

  return Response.json({
    slug: inbox.slug,
    name: inbox.name,
    publicKey: inbox.publicKey,
  });
};

export const prerender = false;
