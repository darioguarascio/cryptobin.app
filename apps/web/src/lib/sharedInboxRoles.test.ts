import { describe, expect, it } from 'vitest';
import {
  normalizeMembershipRole,
  requireMembership,
  requireOwnerMembership,
} from './sharedInboxRoles';

const membership = {
  inbox: {
    id: 'inbox-1',
    slug: 'oncall',
    name: 'On-call',
    ownerId: 'owner-1',
    publicKey: 'public-key',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  role: 'member' as const,
};

describe('sharedInboxRoles', () => {
  it('normalizes membership roles', () => {
    expect(normalizeMembershipRole('owner')).toBe('owner');
    expect(normalizeMembershipRole('member')).toBe('member');
    expect(normalizeMembershipRole('admin')).toBe('member');
  });

  it('requires membership before access', () => {
    expect(requireMembership(membership)).toEqual(membership);
    expect(() => requireMembership(null)).toThrow('NOT_MEMBER');
  });

  it('requires owner role for owner-only actions', () => {
    expect(requireOwnerMembership({ ...membership, role: 'owner' }).role).toBe('owner');
    expect(() => requireOwnerMembership(membership)).toThrow('NOT_OWNER');
  });
});
