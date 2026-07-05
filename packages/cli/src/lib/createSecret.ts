import { readFile } from 'node:fs/promises';
import { resolveConfiguredBaseUrl } from '../config.js';
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

export async function readSecretBody(input: Pick<CreateSecretInput, 'secret' | 'file'>): Promise<string> {
  if (input.secret !== undefined) {
    return input.secret;
  }

  if (input.file) {
    const contents = await readFile(input.file, 'utf8');
    return contents.replace(/\r?\n$/, '');
  }

  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
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
