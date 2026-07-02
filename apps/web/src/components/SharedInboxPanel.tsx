import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Clipboard,
  Eye,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { AccountUser } from '@/lib/accountSession';
import { getUnlockedPrivateKey } from '@/lib/accountSession';
import { generateAccountKeyPair } from '@/lib/accountCrypto';
import type { PlainSecret } from '@/lib/crypto';
import {
  decryptSharedInboxDrop,
  sharedInboxDropUrl,
  unwrapInboxPrivateKeyForMember,
  wrapInboxPrivateKeyForMember,
} from '@/lib/sharedInboxCrypto';
import type {
  SharedInboxDetail,
  SharedInboxInviteItem,
  SharedInboxSummary,
} from '@/lib/sharedInboxSession';
import {
  getUnlockedSharedInboxKey,
  setUnlockedSharedInboxKey,
} from '@/lib/sharedInboxSession';
import type { InboxEncryptedPayload } from '@/lib/inboxCrypto';
import CopyButton from './CopyButton';

interface Props {
  user: AccountUser;
}

export default function SharedInboxPanel({ user }: Props) {
  const [items, setItems] = useState<SharedInboxSummary[]>([]);
  const [invites, setInvites] = useState<SharedInboxInviteItem[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<SharedInboxDetail | null>(null);
  const [selectedDropId, setSelectedDropId] = useState<string | null>(null);
  const [openedSecret, setOpenedSecret] = useState<PlainSecret | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createSlug, setCreateSlug] = useState('');
  const [createName, setCreateName] = useState('');
  const [inviteHandle, setInviteHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copyLabel, setCopyLabel] = useState('Copy drop link');

  const refreshItems = useCallback(async () => {
    const response = await fetch('/api/shared-inbox');
    if (!response.ok) throw new Error('Unable to load shared inboxes.');
    const data = (await response.json()) as { items: SharedInboxSummary[] };
    setItems(data.items);
  }, []);

  const refreshInvites = useCallback(async () => {
    const response = await fetch('/api/shared-inbox/invites');
    if (!response.ok) throw new Error('Unable to load invites.');
    const data = (await response.json()) as { items: SharedInboxInviteItem[] };
    setInvites(data.items);
  }, []);

  const loadDetail = useCallback(async (slug: string) => {
    const response = await fetch(`/api/shared-inbox/${encodeURIComponent(slug)}`);
    if (!response.ok) throw new Error('Unable to load shared inbox.');
    const data = (await response.json()) as SharedInboxDetail;
    setDetail(data);
    setSelectedSlug(slug);
    setSelectedDropId(null);
    setOpenedSecret(null);
  }, []);

  useEffect(() => {
    void refreshItems().catch(() => undefined);
    void refreshInvites().catch(() => undefined);
  }, [refreshItems, refreshInvites]);

  async function ensureInboxPrivateKey(
    slug: string,
    wrappedPrivateKey: InboxEncryptedPayload,
  ): Promise<string> {
    const cached = getUnlockedSharedInboxKey(slug);
    if (cached) return cached;

    const memberPrivateKey = getUnlockedPrivateKey();
    if (!memberPrivateKey) {
      throw new Error('Unlock your account first.');
    }

    const inboxPrivateKey = await unwrapInboxPrivateKeyForMember(
      memberPrivateKey,
      wrappedPrivateKey,
    );
    setUnlockedSharedInboxKey(slug, inboxPrivateKey);
    return inboxPrivateKey;
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const memberPrivateKey = getUnlockedPrivateKey();
      if (!memberPrivateKey) {
        throw new Error('Unlock your account before creating a shared inbox.');
      }

      const inboxKeys = await generateAccountKeyPair();
      const wrappedPrivateKey = await wrapInboxPrivateKeyForMember(
        inboxKeys.privateKeyPkcs8,
        user.publicKey,
      );

      const normalizedSlug = createSlug.trim().toLowerCase();
      const response = await fetch('/api/shared-inbox', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: normalizedSlug,
          name: createName,
          publicKey: inboxKeys.publicKeySpki,
          wrappedPrivateKey,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Unable to create shared inbox.');
      }

      setUnlockedSharedInboxKey(normalizedSlug, inboxKeys.privateKeyPkcs8);
      setCreateSlug('');
      setCreateName('');
      setShowCreate(false);
      setMessage('Shared inbox created.');
      await refreshItems();
      await loadDetail(normalizedSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create shared inbox.');
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const inboxPrivateKey = await ensureInboxPrivateKey(
        detail.slug,
        detail.wrappedPrivateKey,
      );

      const publicKeyResponse = await fetch(
        `/api/inbox/public/${encodeURIComponent(inviteHandle.trim().toLowerCase())}`,
      );
      if (!publicKeyResponse.ok) {
        throw new Error('That account does not exist.');
      }

      const { publicKey } = (await publicKeyResponse.json()) as { publicKey: string };
      const wrappedPrivateKey = await wrapInboxPrivateKeyForMember(inboxPrivateKey, publicKey);

      const response = await fetch(
        `/api/shared-inbox/${encodeURIComponent(detail.slug)}/invites`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            inviteeHandle: inviteHandle.trim().toLowerCase(),
            wrappedPrivateKey,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Unable to send invite.');
      }

      setInviteHandle('');
      setMessage(`Invite sent to @${inviteHandle.trim().toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send invite.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptInvite(invite: SharedInboxInviteItem) {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const memberPrivateKey = getUnlockedPrivateKey();
      if (!memberPrivateKey) {
        throw new Error('Unlock your account before accepting an invite.');
      }

      const response = await fetch(`/api/shared-inbox/invites/${encodeURIComponent(invite.id)}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Unable to accept invite.');
      }

      const inboxPrivateKey = await unwrapInboxPrivateKeyForMember(
        memberPrivateKey,
        invite.wrappedPrivateKey,
      );
      setUnlockedSharedInboxKey(invite.slug, inboxPrivateKey);
      setMessage(`Joined shared inbox "${invite.name}".`);
      await refreshItems();
      await refreshInvites();
      await loadDetail(invite.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept invite.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeclineInvite(inviteId: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/shared-inbox/invites/${encodeURIComponent(inviteId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Unable to decline invite.');
      await refreshInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to decline invite.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(memberUserId: string) {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/shared-inbox/${encodeURIComponent(detail.slug)}/members/${encodeURIComponent(memberUserId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Unable to remove member.');
      }
      setMessage('Member removed.');
      await loadDetail(detail.slug);
      await refreshItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove member.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyDropLink() {
    if (!detail) return;
    const url = sharedInboxDropUrl(window.location.origin, detail.slug);
    await navigator.clipboard.writeText(url);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy drop link'), 2000);
  }

  async function decryptSelectedDrop() {
    if (!detail || !selectedDropId) return;

    setBusy(true);
    setError('');
    setOpenedSecret(null);

    try {
      const inboxPrivateKey = await ensureInboxPrivateKey(
        detail.slug,
        detail.wrappedPrivateKey,
      );

      const response = await fetch(`/api/shared-inbox/drops/${encodeURIComponent(selectedDropId)}`);
      if (!response.ok) throw new Error('Unable to open shared inbox drop.');

      const payload = (await response.json()) as InboxEncryptedPayload;
      const secret = await decryptSharedInboxDrop(inboxPrivateKey, payload);
      setOpenedSecret(secret);
      await loadDetail(detail.slug);
      await refreshItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to decrypt drop.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shared-inbox-panel">
      {message && <p className="status-msg success" role="status">{message}</p>}
      {error && <p className="status-msg error" role="alert">{error}</p>}

      {invites.length > 0 && (
        <section className="shared-invites">
          <h3>Pending invites</h3>
          <ul className="item-list">
            {invites.map((invite) => (
              <li key={invite.id}>
                <div className="item-row static">
                  <strong>{invite.name}</strong>
                  <span>From @{invite.invitedByHandle} · /i/{invite.slug}</span>
                  <div className="shared-invite-actions">
                    <button type="button" className="chip-btn accent" disabled={busy} onClick={() => void handleAcceptInvite(invite)}>
                      <Check size={12} /> Accept
                    </button>
                    <button type="button" className="chip-btn" disabled={busy} onClick={() => void handleDeclineInvite(invite.id)}>
                      <X size={12} /> Decline
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="shared-toolbar">
        <h2>Shared inboxes</h2>
        <button type="button" className="chip-btn accent" onClick={() => setShowCreate((value) => !value)}>
          <Plus size={12} /> New shared inbox
        </button>
      </div>

      {showCreate && (
        <form className="shared-create-form" onSubmit={(event) => void handleCreate(event)}>
          <div className="field-row">
            <div className="field">
              <span className="field-label">Slug</span>
              <input
                value={createSlug}
                onChange={(event) => setCreateSlug(event.target.value)}
                placeholder="oncall-team"
                required
              />
            </div>
            <div className="field">
              <span className="field-label">Name</span>
              <input
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="On-call credentials"
                required
              />
            </div>
          </div>
          <p className="empty-copy">Drop link will be `/i/your-slug`. Slugs must be unique and cannot match personal handles.</p>
          <button type="submit" className="create-btn" disabled={busy}>
            <Users size={15} /> Create shared inbox
          </button>
        </form>
      )}

      <div className="split-panel">
        <div className="list-panel">
          {!items.length ? (
            <p className="empty-copy">Create a shared inbox and invite teammates to decrypt the same encrypted drops.</p>
          ) : (
            <ul className="item-list">
              {items.map((item) => (
                <li key={item.slug}>
                  <button
                    type="button"
                    className={`item-row${selectedSlug === item.slug ? ' active' : ''}${item.unreadCount ? ' unread' : ''}`}
                    onClick={() => void loadDetail(item.slug)}
                  >
                    <strong>{item.name}</strong>
                    <span>
                      /i/{item.slug} · {item.memberCount} members
                      {item.unreadCount ? ` · ${item.unreadCount} unread` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="detail-panel">
          {!detail ? (
            <p className="empty-copy">Select a shared inbox to manage members and decrypt drops.</p>
          ) : (
            <>
              <div className="shared-detail-head">
                <div>
                  <h3>{detail.name}</h3>
                  <p className="empty-copy">/i/{detail.slug} · {detail.role}</p>
                </div>
                <button type="button" className="chip-btn" onClick={() => void handleCopyDropLink()}>
                  <Clipboard size={12} /> {copyLabel}
                </button>
              </div>

              <section className="shared-members">
                <h4>Members</h4>
                <ul className="shared-member-list">
                  {detail.members.map((member) => (
                    <li key={member.userId}>
                      <span>@{member.handle}</span>
                      <span>{member.role}</span>
                      {detail.role === 'owner' && member.role === 'member' && member.userId !== user.id && (
                        <button
                          type="button"
                          className="chip-btn"
                          disabled={busy}
                          onClick={() => void handleRemoveMember(member.userId)}
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {detail.role === 'owner' && (
                <form className="shared-invite-form" onSubmit={(event) => void handleInvite(event)}>
                  <div className="field">
                    <span className="field-label">Invite by handle</span>
                    <input
                      value={inviteHandle}
                      onChange={(event) => setInviteHandle(event.target.value)}
                      placeholder="teammate-handle"
                      required
                    />
                  </div>
                  <button type="submit" className="create-btn" disabled={busy || !inviteHandle.trim()}>
                    <UserPlus size={15} /> Send invite
                  </button>
                </form>
              )}

              <section className="shared-drops">
                <h4>Drops</h4>
                {!detail.drops.length ? (
                  <p className="empty-copy">No drops yet. Share the `/i/{detail.slug}` link with senders.</p>
                ) : (
                  <ul className="item-list">
                    {detail.drops.map((drop) => (
                      <li key={drop.id}>
                        <button
                          type="button"
                          className={`item-row${selectedDropId === drop.id ? ' active' : ''}${drop.readAt ? '' : ' unread'}`}
                          onClick={() => {
                            setSelectedDropId(drop.id);
                            setOpenedSecret(null);
                          }}
                        >
                          <strong>{drop.metadataPreview?.label ?? 'Encrypted secret'}</strong>
                          <span>
                            {drop.metadataPreview?.from
                              ? `From ${drop.metadataPreview.from}`
                              : new Date(drop.createdAt).toLocaleString()}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {selectedDropId && !openedSecret && (
                <button type="button" className="create-btn" disabled={busy} onClick={() => void decryptSelectedDrop()}>
                  <Eye size={15} /> Decrypt drop
                </button>
              )}

              {openedSecret && (
                <>
                  {(openedSecret.metadata.label || openedSecret.metadata.from) && (
                    <div className="receive-metadata">
                      {openedSecret.metadata.from && <span>From: {openedSecret.metadata.from}</span>}
                      {openedSecret.metadata.label && <span>{openedSecret.metadata.label}</span>}
                    </div>
                  )}
                  {openedSecret.metadata.description && (
                    <p className="receive-description">{openedSecret.metadata.description}</p>
                  )}
                  <pre className="secret-body">{openedSecret.body}</pre>
                  <CopyButton text={openedSecret.body} label="Copy secret" />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
