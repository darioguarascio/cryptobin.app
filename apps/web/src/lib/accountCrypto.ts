import { base64UrlToBytes, bytesToBase64Url } from './encoding';
import { encryptVaultSecret, decryptVaultSecret, type EncryptedVaultSecret } from './vaultCrypto';

export const ACCOUNT_KEY_ALGORITHM = 'RSA-OAEP-2048' as const;

const RSA_OAEP: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export interface AccountKeyPair {
  publicKeySpki: string;
  privateKeyPkcs8: string;
}

export async function generateAccountKeyPair(): Promise<AccountKeyPair> {
  const pair = await crypto.subtle.generateKey(RSA_OAEP, true, ['encrypt', 'decrypt']);
  const publicKey = await crypto.subtle.exportKey('spki', pair.publicKey);
  const privateKey = await crypto.subtle.exportKey('pkcs8', pair.privateKey);

  return {
    publicKeySpki: bytesToBase64Url(new Uint8Array(publicKey)),
    privateKeyPkcs8: bytesToBase64Url(new Uint8Array(privateKey)),
  };
}

export async function encryptAccountPrivateKey(
  privateKeyPkcs8: string,
  masterPassword: string,
): Promise<EncryptedVaultSecret> {
  return encryptVaultSecret(
    {
      body: privateKeyPkcs8,
      metadata: { label: 'account-private-key' },
    },
    masterPassword,
  );
}

export async function decryptAccountPrivateKey(
  payload: EncryptedVaultSecret,
  masterPassword: string,
): Promise<string> {
  const decrypted = await decryptVaultSecret(payload, masterPassword);
  return decrypted.body;
}

export async function importPublicKey(publicKeySpki: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    toArrayBuffer(base64UrlToBytes(publicKeySpki)),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
}

export async function importPrivateKey(privateKeyPkcs8: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    toArrayBuffer(base64UrlToBytes(privateKeyPkcs8)),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
}

export async function unlockAccountPrivateKey(
  encryptedPrivateKey: EncryptedVaultSecret,
  masterPassword: string,
): Promise<CryptoKey> {
  const privateKeyPkcs8 = await decryptAccountPrivateKey(encryptedPrivateKey, masterPassword);
  return importPrivateKey(privateKeyPkcs8);
}
