import { describe, expect, it } from 'vitest';
import {
  VAULT_CIPHER_ALGORITHM,
  VAULT_CRYPTO_VERSION,
  VAULT_KDF_ALGORITHM,
  VAULT_KDF_HASH,
  VAULT_KDF_ITERATIONS,
  decryptVaultSecret,
  encryptVaultSecret,
  type EncryptedVaultSecret,
} from './vaultCrypto';

const sampleSecret = {
  body: 'vault-api-key-456',
  metadata: {
    from: 'Alice',
    label: 'Staging API key',
    description: 'Saved from one-time link',
  },
};

describe('vault crypto', () => {
  it('encrypts and decrypts a secret with metadata', async () => {
    const encrypted = await encryptVaultSecret(sampleSecret, 'master-password');

    expect(encrypted.version).toBe(VAULT_CRYPTO_VERSION);
    expect(encrypted.algorithm).toBe(VAULT_CIPHER_ALGORITHM);
    expect(encrypted.kdf).toEqual({
      algorithm: VAULT_KDF_ALGORITHM,
      hash: VAULT_KDF_HASH,
      iterations: VAULT_KDF_ITERATIONS,
    });
    expect(encrypted.ciphertext).not.toContain('vault-api-key-456');

    const decrypted = await decryptVaultSecret(encrypted, 'master-password');

    expect(decrypted).toEqual(sampleSecret);
  });

  it('rejects decryption with the wrong master password', async () => {
    const encrypted = await encryptVaultSecret({ body: 'secret', metadata: {} }, 'correct-password');

    await expect(decryptVaultSecret(encrypted, 'wrong-password')).rejects.toThrow();
  });

  it('uses different salts and ciphertexts for repeated encryptions', async () => {
    const first = await encryptVaultSecret({ body: 'same', metadata: {} }, 'master-password');
    const second = await encryptVaultSecret({ body: 'same', metadata: {} }, 'master-password');

    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('rejects unsupported vault payloads', async () => {
    const encrypted = await encryptVaultSecret({ body: 'secret', metadata: {} }, 'master-password');

    const unsupportedVersion: EncryptedVaultSecret = {
      ...encrypted,
      version: 2 as typeof VAULT_CRYPTO_VERSION,
    };
    await expect(decryptVaultSecret(unsupportedVersion, 'master-password')).rejects.toThrow(
      'Unsupported vault secret version',
    );

    const unsupportedKdf: EncryptedVaultSecret = {
      ...encrypted,
      kdf: { ...encrypted.kdf, iterations: 100_000 },
    };
    await expect(decryptVaultSecret(unsupportedKdf, 'master-password')).rejects.toThrow(
      'Unsupported vault KDF parameters',
    );

    const unsupportedCipher: EncryptedVaultSecret = {
      ...encrypted,
      algorithm: 'AES-GCM-128' as typeof VAULT_CIPHER_ALGORITHM,
    };
    await expect(decryptVaultSecret(unsupportedCipher, 'master-password')).rejects.toThrow(
      'Unsupported vault cipher algorithm',
    );
  });
});
