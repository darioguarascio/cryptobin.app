import type { APIRoute } from 'astro';
import { getStreamSession, subscribeToStream } from '@/lib/server/streamSessions';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const streamId = params.id;
  if (!streamId) {
    return new Response('Missing stream id', { status: 400 });
  }

  const session = getStreamSession(streamId);
  if (!session) {
    return new Response('Stream missing or expired', { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));

      unsubscribe = subscribeToStream(session, {
        push: (chunk) => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            /* stream closed */
          }
        },
        close: () => {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
      });
    },
    cancel() {
      unsubscribe();
    },
  });

  request.signal.addEventListener('abort', () => {
    unsubscribe();
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};
