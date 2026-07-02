import { afterEach, describe, expect, it } from 'vitest';
import {
  clearUnlockedSharedInboxKeys,
  getUnlockedSharedInboxKey,
  setUnlockedSharedInboxKey,
} from './sharedInboxSession';

describe('sharedInboxSession', () => {
  afterEach(() => {
    clearUnlockedSharedInboxKeys();
  });

  it('stores and reads unlocked shared inbox keys by normalized slug', () => {
    setUnlockedSharedInboxKey('OnCall-Team', 'inbox-private-key');
    expect(getUnlockedSharedInboxKey('oncall-team')).toBe('inbox-private-key');
  });

  it('clears one shared inbox key or all keys', () => {
    setUnlockedSharedInboxKey('alpha', 'key-a');
    setUnlockedSharedInboxKey('beta', 'key-b');

    setUnlockedSharedInboxKey('alpha', null);
    expect(getUnlockedSharedInboxKey('alpha')).toBeNull();
    expect(getUnlockedSharedInboxKey('beta')).toBe('key-b');

    clearUnlockedSharedInboxKeys();
    expect(getUnlockedSharedInboxKey('beta')).toBeNull();
  });
});
