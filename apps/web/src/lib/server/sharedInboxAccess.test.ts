import { beforeEach, describe, expect, it, vi } from 'vitest';

const { selectLimit, select, selectFrom } = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const chain = {
    limit: selectLimit,
    where: vi.fn(),
    innerJoin: vi.fn(),
  };
  chain.where.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  const selectFrom = vi.fn(() => chain);
  const select = vi.fn(() => ({ from: selectFrom }));
  return { selectLimit, select, selectFrom };
});

vi.mock('@/db', () => ({
  getDb: () => ({ select }),
}));

import {
  getMemberPublicKey,
  getSharedInboxBySlug,
  getSharedInboxMembership,
  getUserByHandle,
  requireSharedInboxMember,
  requireSharedInboxOwner,
} from './sharedInboxAccess';

describe('sharedInboxAccess', () => {
  beforeEach(() => {
    select.mockClear();
    selectFrom.mockClear();
    selectLimit.mockReset();
  });

  it('returns null when a shared inbox slug does not exist', async () => {
    selectLimit.mockResolvedValueOnce([]);
    await expect(getSharedInboxBySlug('missing')).resolves.toBeNull();
  });

  it('returns membership details for a member', async () => {
    selectLimit.mockResolvedValueOnce([
      {
        inbox: {
          id: 'inbox-1',
          slug: 'oncall',
          name: 'On-call',
          ownerId: 'owner-1',
          publicKey: 'public-key',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        role: 'member',
      },
    ]);

    const membership = await getSharedInboxMembership('user-1', 'oncall');
    expect(membership?.role).toBe('member');
    expect(membership?.inbox.slug).toBe('oncall');
  });

  it('throws when membership is required but missing', async () => {
    selectLimit.mockResolvedValueOnce([]);
    await expect(requireSharedInboxMember('user-1', 'missing')).rejects.toThrow('NOT_MEMBER');
  });

  it('throws when a non-owner tries to require owner access', async () => {
    selectLimit.mockResolvedValueOnce([
      {
        inbox: {
          id: 'inbox-1',
          slug: 'oncall',
          name: 'On-call',
          ownerId: 'owner-1',
          publicKey: 'public-key',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        role: 'member',
      },
    ]);

    await expect(requireSharedInboxOwner('user-1', 'oncall')).rejects.toThrow('NOT_OWNER');
  });

  it('loads member public keys and users by handle', async () => {
    selectLimit.mockResolvedValueOnce([{ publicKey: 'member-public-key' }]);
    await expect(getMemberPublicKey('user-1')).resolves.toBe('member-public-key');

    selectLimit.mockResolvedValueOnce([
      { id: 'user-2', handle: 'bob', publicKey: 'bob-public-key' },
    ]);
    await expect(getUserByHandle('bob')).resolves.toEqual({
      id: 'user-2',
      handle: 'bob',
      publicKey: 'bob-public-key',
    });
  });
});
