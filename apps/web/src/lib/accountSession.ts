import { clearUnlockedSharedInboxKeys } from './sharedInboxSession';
import type { EncryptedVaultSecret } from './vaultCrypto';

export interface AccountUser {
  id: string;
  handle: string;
  email: string | null;
  totpEnabled: boolean;
  publicKey: string;
  encryptedPrivateKey: EncryptedVaultSecret;
}

let currentUser: AccountUser | null = null;
let unlockedPrivateKeyPkcs8: string | null = null;

export function setAccountUser(user: AccountUser | null): void {
  currentUser = user;
  if (!user) {
    unlockedPrivateKeyPkcs8 = null;
    clearUnlockedSharedInboxKeys();
  }
}

export function getAccountUser(): AccountUser | null {
  return currentUser;
}

export function setUnlockedPrivateKey(privateKeyPkcs8: string | null): void {
  unlockedPrivateKeyPkcs8 = privateKeyPkcs8;
}

export function getUnlockedPrivateKey(): string | null {
  return unlockedPrivateKeyPkcs8;
}

export function isAccountUnlocked(): boolean {
  return Boolean(currentUser && unlockedPrivateKeyPkcs8);
}

export async function fetchCurrentUser(): Promise<AccountUser | null> {
  const response = await fetch('/api/auth');

  if (!response.ok) {
    setAccountUser(null);
    return null;
  }

  const data = (await response.json()) as { user: AccountUser | null };
  setAccountUser(data.user);
  return data.user;
}

export async function logoutAccount(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
  setAccountUser(null);
  setUnlockedPrivateKey(null);
  clearUnlockedSharedInboxKeys();
}

export function inboxShareUrl(origin: string, handle: string): string {
  return `${origin.replace(/\/$/, '')}/${encodeURIComponent(handle)}`;
}
