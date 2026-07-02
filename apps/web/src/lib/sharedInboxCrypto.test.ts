import { describe, expect, it } from 'vitest';
import { generateAccountKeyPair } from './accountCrypto';
import {
  decryptSharedInboxDrop,
  encryptSharedInboxDrop,
  sharedInboxDropUrl,
  unwrapInboxPrivateKeyForMember,
  wrapInboxPrivateKeyForMember,
} from './sharedInboxCrypto';

describe('sharedInboxCrypto', () => {
  it('wraps and unwraps the shared inbox private key for a member', async () => {
    const inboxKeys = await generateAccountKeyPair();
    const memberKeys = await generateAccountKeyPair();

    const wrapped = await wrapInboxPrivateKeyForMember(
      inboxKeys.privateKeyPkcs8,
      memberKeys.publicKeySpki,
    );

    const unwrapped = await unwrapInboxPrivateKeyForMember(memberKeys.privateKeyPkcs8, wrapped);
    expect(unwrapped).toBe(inboxKeys.privateKeyPkcs8);
  });

  it('encrypts and decrypts shared inbox drops with the inbox key pair', async () => {
    const inboxKeys = await generateAccountKeyPair();
    const secret = {
      body: 'team-shared-secret',
      metadata: { label: 'On-call login', from: 'ops' },
    };

    const encrypted = await encryptSharedInboxDrop(inboxKeys.publicKeySpki, secret);
    const decrypted = await decryptSharedInboxDrop(inboxKeys.privateKeyPkcs8, encrypted);

    expect(decrypted).toEqual(secret);
  });

  it('builds shared inbox drop urls', () => {
    expect(sharedInboxDropUrl('https://cryptobin.app', 'oncall')).toBe(
      'https://cryptobin.app/i/oncall',
    );
  });
});
