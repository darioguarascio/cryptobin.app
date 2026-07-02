import { describe, expect, it } from 'vitest';
import {
  getAccountUser,
  inboxShareUrl,
  isAccountUnlocked,
  setAccountUser,
  setUnlockedPrivateKey,
} from './accountSession';

describe('accountSession', () => {
  it('tracks unlocked account state in memory', () => {
    setAccountUser({
      id: '1',
      handle: 'alice',
      email: null,
      totpEnabled: false,
      publicKey: 'pk',
      encryptedPrivateKey: {} as never,
    });
    setUnlockedPrivateKey('private-key');

    expect(getAccountUser()?.handle).toBe('alice');
    expect(isAccountUnlocked()).toBe(true);
    expect(inboxShareUrl('https://cryptobin.app', 'alice')).toBe('https://cryptobin.app/alice');
  });
});
