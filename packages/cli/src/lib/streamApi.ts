import { apiHostHeaders, resolveApiBaseUrl } from '../config.js';

export interface CreateStreamResponse {
  id: string;
  producerToken: string;
  expiresAt: string;
  algorithm: 'AES-GCM-256';
}

export async function createStreamSession(
  publicBaseUrl: string,
  input: { ttlHours?: number; label?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<CreateStreamResponse> {
  const apiBaseUrl = resolveApiBaseUrl(publicBaseUrl);
  const url = `${apiBaseUrl}/api/streams`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...apiHostHeaders(publicBaseUrl, apiBaseUrl),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = `Stream setup failed (${response.status})`;
    if (response.status >= 301 && response.status <= 308) {
      message =
        `API login redirect (HTTP ${response.status}). Set CRYPTOBIN_API_URL to your internal API base URL and CRYPTOBIN_API_HOST to the public site hostname`;
    } else {
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // ignore malformed error bodies
      }
    }
    throw new Error(message);
  }

  return (await response.json()) as CreateStreamResponse;
}

export async function postStreamPayload(
  publicBaseUrl: string,
  streamId: string,
  producerToken: string,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const apiBaseUrl = resolveApiBaseUrl(publicBaseUrl);
  const url = `${apiBaseUrl}/api/streams/${encodeURIComponent(streamId)}/frames`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${producerToken}`,
      ...apiHostHeaders(publicBaseUrl, apiBaseUrl),
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 204) {
    return;
  }

  let message = `Stream upload failed (${response.status})`;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // ignore malformed error bodies
  }
  throw new Error(message);
}
