import { readFile } from 'node:fs/promises';
import { resolveConfiguredBaseUrl } from '../config.js';
import { assertSecretWithinLimit, MAX_SECRET_BYTES, MAX_SECRET_MIB } from './secretLimits.js';
import { storeEncryptedSecret } from './api.js';
import { buildShareUrl, encryptSecret } from './crypto.js';

export interface CreateSecretInput {
  secret?: string;
  file?: string;
  from?: string;
  label?: string;
  description?: string;
  ttlHours?: number;
  url?: string;
}

export interface CreateSecretResult {
  id: string;
  url: string;
  expiresAt: string;
  ttlHours: number;
}

const VALID_TTL = new Set([1, 24, 72, 168]);

export function parseTtlHours(value: number | undefined): number {
  if (value === undefined) return 24;
  if (!VALID_TTL.has(value)) {
    throw new Error('TTL must be one of: 1, 24, 72, 168');
  }
  return value;
}

function finalizeSecretBody(raw: string): string {
  const trimmed = raw.replace(/\r?\n$/, '');
  assertSecretWithinLimit(trimmed);
  return trimmed;
}

export async function readSecretBody(input: Pick<CreateSecretInput, 'secret' | 'file'>): Promise<string> {
  if (input.secret !== undefined) {
    return finalizeSecretBody(input.secret);
  }

  if (input.file) {
    const contents = await readFile(input.file, 'utf8');
    return finalizeSecretBody(contents);
  }

  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of process.stdin) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      total += buf.length;
      if (total > MAX_SECRET_BYTES + 1) {
        throw new Error(`Secret is too large (max ${MAX_SECRET_MIB} MiB).`);
      }
      chunks.push(buf);
    }
    return finalizeSecretBody(Buffer.concat(chunks).toString('utf8'));
  }

  return '';
}

export async function createEncryptedShareLink(
  input: CreateSecretInput & { secret: string; ttlHours: number },
  deps: { fetch?: typeof fetch } = {},
): Promise<CreateSecretResult> {
  if (!input.secret.trim()) {
    throw new Error('Secret cannot be empty. Pass text, --file, or pipe via stdin.');
  }

  const baseUrl = await resolveConfiguredBaseUrl(input.url);
  const encrypted = await encryptSecret(
    {
      body: input.secret,
      metadata: {
        from: input.from,
        label: input.label,
        description: input.description,
      },
    },
    input.ttlHours,
  );

  const stored = await storeEncryptedSecret(
    baseUrl,
    {
      ...encrypted.payload,
      ttlHours: input.ttlHours,
      metadataPreview: {
        from: input.from,
        label: input.label,
        description: input.description,
      },
    },
    deps.fetch,
  );

  return {
    id: stored.id,
    url: buildShareUrl(baseUrl, stored.id, encrypted.key),
    expiresAt: stored.expiresAt,
    ttlHours: input.ttlHours,
  };
}
