import { randomBytes } from 'node:crypto';
import { bytesToBase64Url } from '@/lib/encoding';
import type { StreamCipherAlgorithm, StreamFrame } from '@/lib/streamCrypto';

export const MAX_STREAM_FRAME_BYTES = 64 * 1024;
export const STREAM_RING_BUFFER_SIZE = 500;

export interface StreamSession {
  id: string;
  producerToken: string;
  createdAt: number;
  expiresAt: number;
  algorithm: StreamCipherAlgorithm;
  producerActive: boolean;
  subscribers: Set<StreamSink>;
  buffer: StreamFrame[];
  ended: boolean;
}

export interface StreamSink {
  push: (chunk: string) => void;
  close: () => void;
}

const SESSIONS_KEY = Symbol.for('cryptobin.streamSessions');

function sessionsMap(): Map<string, StreamSession> {
  const globalStore = globalThis as typeof globalThis & {
    [SESSIONS_KEY]?: Map<string, StreamSession>;
  };
  if (!globalStore[SESSIONS_KEY]) {
    globalStore[SESSIONS_KEY] = new Map();
  }
  return globalStore[SESSIONS_KEY];
}

const ONE_HOUR_MS = 60 * 60 * 1000;

function generateId(bytes = 16): string {
  return bytesToBase64Url(new Uint8Array(randomBytes(bytes)));
}

export function formatStreamSse(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function broadcast(session: StreamSession, payload: Record<string, unknown>): void {
  const chunk = formatStreamSse(payload);
  for (const sink of session.subscribers) {
    sink.push(chunk);
  }
}

export function createStreamSession(ttlHours = 24): StreamSession {
  const now = Date.now();
  const session: StreamSession = {
    id: generateId(),
    producerToken: generateId(24),
    createdAt: now,
    expiresAt: now + ttlHours * ONE_HOUR_MS,
    algorithm: 'AES-GCM-256',
    producerActive: false,
    subscribers: new Set(),
    buffer: [],
    ended: false,
  };
  sessionsMap().set(session.id, session);
  return session;
}

export function getStreamSession(id: string, now = Date.now()): StreamSession | null {
  const session = sessionsMap().get(id);
  if (!session || session.expiresAt <= now) {
    if (session) {
      sessionsMap().delete(id);
    }
    return null;
  }
  return session;
}

export function validateProducerToken(session: StreamSession, token: string | null): boolean {
  return Boolean(token && token === session.producerToken);
}

export function pushStreamFrame(session: StreamSession, frame: StreamFrame): void {
  session.producerActive = true;
  session.buffer.push(frame);
  if (session.buffer.length > STREAM_RING_BUFFER_SIZE) {
    session.buffer.shift();
  }
  broadcast(session, { type: 'frame', ...frame });
}

export function markStreamEnded(session: StreamSession): void {
  session.ended = true;
  session.producerActive = false;
  broadcast(session, { type: 'end' });
  for (const sink of session.subscribers) {
    sink.close();
  }
  session.subscribers.clear();
}

export function subscribeToStream(session: StreamSession, sink: StreamSink): () => void {
  session.subscribers.add(sink);
  sink.push(formatStreamSse({ type: 'hello', algorithm: session.algorithm }));
  for (const frame of session.buffer) {
    sink.push(formatStreamSse({ type: 'frame', ...frame }));
  }
  if (session.ended) {
    sink.push(formatStreamSse({ type: 'end' }));
    sink.close();
  }

  return () => {
    session.subscribers.delete(sink);
  };
}

export function clearStreamSessionsForTest(): void {
  sessionsMap().clear();
}

export function clearExpiredStreamSessions(now = Date.now()): number {
  let removed = 0;
  for (const [id, session] of sessionsMap()) {
    if (session.expiresAt <= now) {
      sessionsMap().delete(id);
      removed += 1;
    }
  }
  return removed;
}

export function producerTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim() || null;
  }
  return request.headers.get('x-stream-producer-token');
}
