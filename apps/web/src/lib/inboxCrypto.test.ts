import { describe, expect, it } from 'vitest';
import {
  decryptInboxDropWithPkcs8,
  encryptInboxDrop,
  INBOX_ALGORITHM,
} from './inboxCrypto';
import { generateAccountKeyPair } from './accountCrypto';

describe('inboxCrypto', () => {
  it('encrypts and decrypts inbox drops with RSA hybrid encryption', async () => {
    const keyPair = await generateAccountKeyPair();
    const secret = {
      body: 'super-secret-token',
      metadata: { from: 'bob', label: 'API key', recipient: 'alice' },
    };

    const encrypted = await encryptInboxDrop(keyPair.publicKeySpki, secret);

    expect(encrypted.algorithm).toBe(INBOX_ALGORITHM);

    const decrypted = await decryptInboxDropWithPkcs8(keyPair.privateKeyPkcs8, encrypted);
    expect(decrypted).toEqual(secret);
  });
});
