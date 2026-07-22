/** Maximum plaintext secret size (bytes of UTF-8) for one-time share links. */
export const MAX_SECRET_BYTES = 4 * 1024 * 1024;

export const MAX_SECRET_MIB = MAX_SECRET_BYTES / (1024 * 1024);

/** Upper bound for base64url ciphertext field in stored JSON. */
export const MAX_CIPHERTEXT_B64_LENGTH = Math.ceil((MAX_SECRET_BYTES + 512 + 16) * (4 / 3)) + 64;

export function secretByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function assertSecretWithinLimit(text: string): void {
  const bytes = secretByteLength(text);
  if (bytes > MAX_SECRET_BYTES) {
    throw new Error(`Secret is too large (max ${MAX_SECRET_MIB} MiB).`);
  }
}
