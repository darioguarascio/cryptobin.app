import type { EncryptedSecretPayload } from './crypto.js';

export interface StoreSecretResponse {
  id: string;
  expiresAt: string;
}

export interface StoreSecretRequest extends EncryptedSecretPayload {
  ttlHours: number;
  metadataPreview?: {
    from?: string;
    label?: string;
    description?: string;
    recipient?: string;
  };
}

export async function storeEncryptedSecret(
  baseUrl: string,
  payload: StoreSecretRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<StoreSecretResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/secrets`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore malformed error bodies
    }
    throw new Error(message);
  }

  return (await response.json()) as StoreSecretResponse;
}
