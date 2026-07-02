import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { bytesToBase64Url } from './encoding';
import { shareLinkProfileForTtlHours } from './shareLink';

export const storedSecretSchema = z.object({
  version: z.literal(1),
  algorithm: z.enum(['AES-GCM-256', 'AES-GCM-128']),
  iv: z.string().min(12),
  ciphertext: z.string().min(16),
  metadataPreview: z
    .object({
      from: z.string().max(120).optional(),
      label: z.string().max(160).optional(),
      description: z.string().max(500).optional(),
      recipient: z.string().max(80).optional(),
    })
    .optional(),
  ttlHours: z.number().int().min(1).max(168).default(24),
});

export type StoredSecretInput = z.input<typeof storedSecretSchema>;
export type StoredSecretPayload = z.output<typeof storedSecretSchema>;

interface StoredRecord {
  id: string;
  payload: StoredSecretPayload;
  createdAt: number;
  expiresAt: number;
}

const records = new Map<string, StoredRecord>();
const ONE_HOUR_MS = 60 * 60 * 1000;

function generateSecretId(ttlHours: number): string {
  const { idBytes } = shareLinkProfileForTtlHours(ttlHours);
  return bytesToBase64Url(new Uint8Array(randomBytes(idBytes)));
}

export function storeSecret(input: StoredSecretInput): StoredRecord {
  const payload = storedSecretSchema.parse(input);
  const now = Date.now();
  const record: StoredRecord = {
    id: generateSecretId(payload.ttlHours),
    payload,
    createdAt: now,
    expiresAt: now + payload.ttlHours * ONE_HOUR_MS,
  };

  records.set(record.id, record);
  return record;
}

export function consumeSecret(id: string, now = Date.now()): StoredRecord | null {
  const record = records.get(id);

  if (!record) {
    return null;
  }

  records.delete(id);

  if (record.expiresAt <= now) {
    return null;
  }

  return record;
}

export function clearExpiredSecrets(now = Date.now()): number {
  let removed = 0;

  for (const [id, record] of records) {
    if (record.expiresAt <= now) {
      records.delete(id);
      removed += 1;
    }
  }

  return removed;
}

export function clearSecretsForTest(): void {
  records.clear();
}
