import type { PlainSecret } from './crypto';
import {
  decryptInboxDropWithPkcs8,
  encryptInboxDrop,
  type InboxEncryptedPayload,
} from './inboxCrypto';

export type WrappedInboxPrivateKey = InboxEncryptedPayload;

export async function wrapInboxPrivateKeyForMember(
  inboxPrivateKeyPkcs8: string,
  memberPublicKeySpki: string,
): Promise<WrappedInboxPrivateKey> {
  return encryptInboxDrop(memberPublicKeySpki, {
    body: inboxPrivateKeyPkcs8,
    metadata: { label: 'shared-inbox-private-key' },
  });
}

export async function unwrapInboxPrivateKeyForMember(
  memberPrivateKeyPkcs8: string,
  wrapped: WrappedInboxPrivateKey,
): Promise<string> {
  const plain = await decryptInboxDropWithPkcs8(memberPrivateKeyPkcs8, wrapped);
  return plain.body;
}

export async function encryptSharedInboxDrop(
  inboxPublicKeySpki: string,
  secret: PlainSecret,
): Promise<InboxEncryptedPayload> {
  return encryptInboxDrop(inboxPublicKeySpki, secret);
}

export async function decryptSharedInboxDrop(
  inboxPrivateKeyPkcs8: string,
  payload: InboxEncryptedPayload,
): Promise<PlainSecret> {
  return decryptInboxDropWithPkcs8(inboxPrivateKeyPkcs8, payload);
}

export function sharedInboxDropUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, '')}/i/${encodeURIComponent(slug)}`;
}
