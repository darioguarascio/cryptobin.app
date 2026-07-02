import type { PlainSecret } from './crypto';
import { base64UrlToBytes, bytesToBase64Url, bytesToString, stringToBytes } from './encoding';

export const VAULT_CRYPTO_VERSION = 1 as const;
export const VAULT_KDF_ALGORITHM = 'PBKDF2' as const;
export const VAULT_KDF_HASH = 'SHA-256' as const;
export const VAULT_KDF_ITERATIONS = 600_000;
export const VAULT_SALT_LENGTH_BYTES = 16;
export const VAULT_IV_LENGTH_BYTES = 12;
export const VAULT_CIPHER_ALGORITHM = 'AES-GCM-256' as const;
export const VAULT_KEY_LENGTH_BITS = 256;

const AES_GCM = 'AES-GCM';
const PBKDF2 = 'PBKDF2';

export interface VaultKdfParams {
  algorithm: typeof VAULT_KDF_ALGORITHM;
  hash: typeof VAULT_KDF_HASH;
  iterations: number;
}

export interface EncryptedVaultSecret {
  version: typeof VAULT_CRYPTO_VERSION;
  kdf: VaultKdfParams;
  salt: string;
  algorithm: typeof VAULT_CIPHER_ALGORITHM;
  iv: string;
  ciphertext: string;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function defaultKdfParams(): VaultKdfParams {
  return {
    algorithm: VAULT_KDF_ALGORITHM,
    hash: VAULT_KDF_HASH,
    iterations: VAULT_KDF_ITERATIONS,
  };
}

function assertSupportedVaultPayload(payload: EncryptedVaultSecret): void {
  if (payload.version !== VAULT_CRYPTO_VERSION) {
    throw new Error('Unsupported vault secret version');
  }

  if (
    payload.kdf.algorithm !== VAULT_KDF_ALGORITHM ||
    payload.kdf.hash !== VAULT_KDF_HASH ||
    payload.kdf.iterations !== VAULT_KDF_ITERATIONS
  ) {
    throw new Error('Unsupported vault KDF parameters');
  }

  if (payload.algorithm !== VAULT_CIPHER_ALGORITHM) {
    throw new Error('Unsupported vault cipher algorithm');
  }
}

async function deriveVaultKey(
  masterPassword: string,
  salt: Uint8Array,
  kdf: VaultKdfParams,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(stringToBytes(masterPassword)),
    PBKDF2,
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: PBKDF2,
      salt: toArrayBuffer(salt),
      iterations: kdf.iterations,
      hash: kdf.hash,
    },
    keyMaterial,
    { name: AES_GCM, length: VAULT_KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptVaultSecret(
  secret: PlainSecret,
  masterPassword: string,
): Promise<EncryptedVaultSecret> {
  const salt = crypto.getRandomValues(new Uint8Array(VAULT_SALT_LENGTH_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(VAULT_IV_LENGTH_BYTES));
  const kdf = defaultKdfParams();
  const key = await deriveVaultKey(masterPassword, salt, kdf);
  const encoded = stringToBytes(JSON.stringify(secret));
  const encrypted = await crypto.subtle.encrypt(
    { name: AES_GCM, iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoded),
  );

  return {
    version: VAULT_CRYPTO_VERSION,
    kdf,
    salt: bytesToBase64Url(salt),
    algorithm: VAULT_CIPHER_ALGORITHM,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(encrypted)),
  };
}

export async function decryptVaultSecret(
  payload: EncryptedVaultSecret,
  masterPassword: string,
): Promise<PlainSecret> {
  assertSupportedVaultPayload(payload);

  const salt = base64UrlToBytes(payload.salt);
  const key = await deriveVaultKey(masterPassword, salt, payload.kdf);
  const decrypted = await crypto.subtle.decrypt(
    { name: AES_GCM, iv: toArrayBuffer(base64UrlToBytes(payload.iv)) },
    key,
    toArrayBuffer(base64UrlToBytes(payload.ciphertext)),
  );

  return JSON.parse(bytesToString(new Uint8Array(decrypted))) as PlainSecret;
}
