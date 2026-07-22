import { base64UrlToBytes, bytesToBase64Url, bytesToString, stringToBytes } from './encoding.js';
import { assertSecretWithinLimit } from './secretLimits.js';
import { shareLinkProfileForTtlHours, type ShareCipherAlgorithm } from './shareLink.js';

export interface SecretMetadata {
  from?: string;
  label?: string;
  description?: string;
  recipient?: string;
}

export interface PlainSecret {
  body: string;
  metadata: SecretMetadata;
}

export interface EncryptedSecretPayload {
  version: 1;
  algorithm: ShareCipherAlgorithm;
  iv: string;
  ciphertext: string;
}

const AES_GCM = 'AES-GCM';
const IV_LENGTH_BYTES = 12;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function encryptSecret(
  secret: PlainSecret,
  ttlHours = 24,
): Promise<{
  payload: EncryptedSecretPayload;
  key: string;
}> {
  assertSecretWithinLimit(secret.body);
  const profile = shareLinkProfileForTtlHours(ttlHours);
  const key = await crypto.subtle.generateKey(
    { name: AES_GCM, length: profile.keyBits },
    true,
    ['encrypt', 'decrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encoded = stringToBytes(JSON.stringify(secret));
  const encrypted = await crypto.subtle.encrypt(
    { name: AES_GCM, iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoded),
  );
  const rawKey = await crypto.subtle.exportKey('raw', key);

  return {
    payload: {
      version: 1,
      algorithm: profile.algorithm,
      iv: bytesToBase64Url(new Uint8Array(iv)),
      ciphertext: bytesToBase64Url(new Uint8Array(encrypted)),
    },
    key: bytesToBase64Url(new Uint8Array(rawKey)),
  };
}

export function buildShareUrl(origin: string, secretId: string, key: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/s/${secretId}#${key}`;
}

export async function decryptSecret(
  payload: EncryptedSecretPayload,
  key: string,
): Promise<PlainSecret> {
  if (payload.version !== 1) {
    throw new Error('Unsupported secret payload');
  }

  const importedKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(base64UrlToBytes(key)),
    AES_GCM,
    false,
    ['decrypt'],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: AES_GCM, iv: toArrayBuffer(base64UrlToBytes(payload.iv)) },
    importedKey,
    toArrayBuffer(base64UrlToBytes(payload.ciphertext)),
  );

  return JSON.parse(bytesToString(new Uint8Array(decrypted))) as PlainSecret;
}
