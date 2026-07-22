import type { EncryptedVaultSecret } from '@/lib/vaultCrypto';
import { INBOX_ALGORITHM } from '@/lib/inboxCrypto';

export const testEncryptedPrivateKey: EncryptedVaultSecret = {
  version: 1,
  kdf: { algorithm: 'PBKDF2', hash: 'SHA-256', iterations: 600_000 },
  salt: 'abcdefghijklmnop',
  algorithm: 'AES-GCM-256',
  iv: 'abcdefghijkl',
  ciphertext: 'abcdefghijklmnopqrstuvwxyz0123456789',
};

export const testPublicKey = 'fixture-public-key-spki-base64';

export const testInboxWrappedKey = {
  algorithm: INBOX_ALGORITHM,
  iv: 'abcdefghijklmnop',
  ciphertext: 'abcdefghijklmnopqrst',
  wrappedKey: 'abcdefghijklmnopqrst',
};

export const testCryptoFixtures = {
  encryptedPrivateKey: testEncryptedPrivateKey,
  publicKey: testPublicKey,
  inboxPayload: testInboxWrappedKey,
};
