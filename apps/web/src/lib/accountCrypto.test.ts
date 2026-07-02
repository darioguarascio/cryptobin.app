import { describe, expect, it } from 'vitest';
import {
  decryptAccountPrivateKey,
  encryptAccountPrivateKey,
  generateAccountKeyPair,
} from './accountCrypto';

describe('accountCrypto', () => {
  it('generates an RSA key pair', async () => {
    const keyPair = await generateAccountKeyPair();
    expect(keyPair.publicKeySpki.length).toBeGreaterThan(32);
    expect(keyPair.privateKeyPkcs8.length).toBeGreaterThan(32);
  });

  it('encrypts and decrypts the account private key with a master password', async () => {
    const keyPair = await generateAccountKeyPair();
    const encrypted = await encryptAccountPrivateKey(keyPair.privateKeyPkcs8, 'correct-horse-battery-staple');
    const decrypted = await decryptAccountPrivateKey(encrypted, 'correct-horse-battery-staple');
    expect(decrypted).toBe(keyPair.privateKeyPkcs8);
  });
});
