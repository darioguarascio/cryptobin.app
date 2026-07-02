import type { APIRoute } from 'astro';
import {
  clearSessionCookieHeader,
  deleteSession,
  getSessionTokenFromRequest,
} from '@/lib/server/auth';

export const POST: APIRoute = async ({ request }) => {
  const token = getSessionTokenFromRequest(request);

  if (token) {
    await deleteSession(token);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': clearSessionCookieHeader(),
    },
  });
};
