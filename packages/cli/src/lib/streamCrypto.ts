import { base64UrlToBytes, bytesToBase64Url, bytesToString, stringToBytes } from './encoding.js';

export type StreamCipherAlgorithm = 'AES-GCM-256';

export interface StreamFrame {
  seq: number;
  iv: string;
  ciphertext: string;
}

const AES_GCM = 'AES-GCM';
const STREAM_ALGORITHM: StreamCipherAlgorithm = 'AES-GCM-256';
const IV_LENGTH_BYTES = 12;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function generateStreamKey(): Promise<{ key: string; algorithm: StreamCipherAlgorithm }> {
  const cryptoKey = await crypto.subtle.generateKey({ name: AES_GCM, length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const rawKey = await crypto.subtle.exportKey('raw', cryptoKey);
  return {
    key: bytesToBase64Url(new Uint8Array(rawKey)),
    algorithm: STREAM_ALGORITHM,
  };
}

async function importStreamKey(key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(base64UrlToBytes(key)),
    AES_GCM,
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptStreamFrame(key: string, seq: number, plaintext: string): Promise<StreamFrame> {
  const cryptoKey = await importStreamKey(key);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: AES_GCM, iv: toArrayBuffer(iv) },
    cryptoKey,
    toArrayBuffer(stringToBytes(plaintext)),
  );

  return {
    seq,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(encrypted)),
  };
}

export function buildStreamUrl(origin: string, streamId: string, key: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/stream/${streamId}#${key}`;
}
