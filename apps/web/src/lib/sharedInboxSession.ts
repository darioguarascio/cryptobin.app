import type { InboxEncryptedPayload } from './inboxCrypto';

const unlockedKeys = new Map<string, string>();

export function setUnlockedSharedInboxKey(slug: string, inboxPrivateKeyPkcs8: string | null): void {
  const normalized = slug.trim().toLowerCase();
  if (!inboxPrivateKeyPkcs8) {
    unlockedKeys.delete(normalized);
    return;
  }
  unlockedKeys.set(normalized, inboxPrivateKeyPkcs8);
}

export function getUnlockedSharedInboxKey(slug: string): string | null {
  return unlockedKeys.get(slug.trim().toLowerCase()) ?? null;
}

export function clearUnlockedSharedInboxKeys(): void {
  unlockedKeys.clear();
}

export interface SharedInboxSummary {
  slug: string;
  name: string;
  role: 'owner' | 'member';
  memberCount: number;
  unreadCount: number;
}

export interface SharedInboxMemberView {
  userId: string;
  handle: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface SharedInboxDropListItem {
  id: string;
  metadataPreview?: { from?: string; label?: string; description?: string };
  readAt: string | null;
  createdAt: string;
}

export interface SharedInboxInviteItem {
  id: string;
  slug: string;
  name: string;
  invitedByHandle: string;
  expiresAt: string;
  wrappedPrivateKey: InboxEncryptedPayload;
}

export interface SharedInboxDetail {
  slug: string;
  name: string;
  role: 'owner' | 'member';
  publicKey: string;
  wrappedPrivateKey: InboxEncryptedPayload;
  members: SharedInboxMemberView[];
  drops: SharedInboxDropListItem[];
}
