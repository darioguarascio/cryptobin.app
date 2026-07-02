import type { SharedInbox } from '@/db/schema';

export interface SharedInboxMembership {
  inbox: SharedInbox;
  role: 'owner' | 'member';
}

export function normalizeMembershipRole(role: string): 'owner' | 'member' {
  return role === 'owner' ? 'owner' : 'member';
}

export function requireMembership(
  membership: SharedInboxMembership | null,
): SharedInboxMembership {
  if (!membership) {
    throw new Error('NOT_MEMBER');
  }
  return membership;
}

export function requireOwnerMembership(
  membership: SharedInboxMembership,
): SharedInboxMembership {
  if (membership.role !== 'owner') {
    throw new Error('NOT_OWNER');
  }
  return membership;
}
