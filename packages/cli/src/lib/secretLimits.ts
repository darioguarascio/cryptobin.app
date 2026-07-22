/** Keep in sync with apps/web/src/lib/secretLimits.ts */
export const MAX_SECRET_BYTES = 4 * 1024 * 1024;

export const MAX_SECRET_MIB = MAX_SECRET_BYTES / (1024 * 1024);

export function secretByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function assertSecretWithinLimit(text: string): void {
  const bytes = secretByteLength(text);
  if (bytes > MAX_SECRET_BYTES) {
    throw new Error(`Secret is too large (max ${MAX_SECRET_MIB} MiB).`);
  }
}
