import type { PlainSecret } from './crypto';
import { base64UrlToBytes, bytesToBase64Url, bytesToString, stringToBytes } from './encoding';
import { importPrivateKey, importPublicKey } from './accountCrypto';

export const INBOX_ALGORITHM = 'RSA-OAEP-AES-GCM-256' as const;

const AES_GCM = 'AES-GCM';
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export interface InboxEncryptedPayload {
  algorithm: typeof INBOX_ALGORITHM;
  iv: string;
  ciphertext: string;
  wrappedKey: string;
}

export async function encryptInboxDrop(
  publicKeySpki: string,
  secret: PlainSecret,
): Promise<InboxEncryptedPayload> {
  const publicKey = await importPublicKey(publicKeySpki);
  const contentKey = await crypto.subtle.generateKey(
    { name: AES_GCM, length: KEY_LENGTH_BITS },
    true,
    ['encrypt', 'decrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encoded = stringToBytes(JSON.stringify(secret));
  const encrypted = await crypto.subtle.encrypt(
    { name: AES_GCM, iv: toArrayBuffer(iv) },
    contentKey,
    toArrayBuffer(encoded),
  );
  const rawKey = await crypto.subtle.exportKey('raw', contentKey);
  const wrappedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    toArrayBuffer(new Uint8Array(rawKey)),
  );

  return {
    algorithm: INBOX_ALGORITHM,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(encrypted)),
    wrappedKey: bytesToBase64Url(new Uint8Array(wrappedKey)),
  };
}

export async function decryptInboxDrop(
  privateKey: CryptoKey,
  payload: InboxEncryptedPayload,
): Promise<PlainSecret> {
  if (payload.algorithm !== INBOX_ALGORITHM) {
    throw new Error('Unsupported inbox payload');
  }

  const rawKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    toArrayBuffer(base64UrlToBytes(payload.wrappedKey)),
  );
  const contentKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    AES_GCM,
    false,
    ['decrypt'],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: AES_GCM, iv: toArrayBuffer(base64UrlToBytes(payload.iv)) },
    contentKey,
    toArrayBuffer(base64UrlToBytes(payload.ciphertext)),
  );

  return JSON.parse(bytesToString(new Uint8Array(decrypted))) as PlainSecret;
}

export async function decryptInboxDropWithPkcs8(
  privateKeyPkcs8: string,
  payload: InboxEncryptedPayload,
): Promise<PlainSecret> {
  const privateKey = await importPrivateKey(privateKeyPkcs8);
  return decryptInboxDrop(privateKey, payload);
}
