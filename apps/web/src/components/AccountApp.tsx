import { useCallback, useEffect, useState } from 'react';
import { Clipboard, Eye, Inbox, Lock, LogOut, Save, Shield, Trash2, Users, Vault } from 'lucide-react';
import AuthPanel from './AuthPanel';
import {
  fetchCurrentUser,
  getAccountUser,
  getUnlockedPrivateKey,
  inboxShareUrl,
  logoutAccount,
  setUnlockedPrivateKey,
  type AccountUser,
} from '@/lib/accountSession';
import { decryptAccountPrivateKey } from '@/lib/accountCrypto';
import { decryptInboxDropWithPkcs8, type InboxEncryptedPayload } from '@/lib/inboxCrypto';
import type { PlainSecret } from '@/lib/crypto';
import { encryptVaultSecret, decryptVaultSecret } from '@/lib/vaultCrypto';
import type { EncryptedVaultSecret } from '@/lib/vaultCrypto';
import CipherHeroCanvas from './CipherHeroCanvas';
import CopyButton from './CopyButton';
import ThemeSwitcher from './ThemeSwitcher';
import SharedInboxPanel from './SharedInboxPanel';

interface InboxListItem {
  id: string;
  metadataPreview?: { from?: string; label?: string; description?: string };
  readAt: string | null;
  createdAt: string;
}

interface VaultListItem {
  id: string;
  encryptedPayload: EncryptedVaultSecret;
  createdAt: string;
}

type AppTab = 'inbox' | 'shared' | 'vault' | 'security';

export default function AccountApp() {
  const [user, setUser] = useState<AccountUser | null>(getAccountUser());
  const [unlocked, setUnlocked] = useState(Boolean(getUnlockedPrivateKey()));
  const [unlockPassword, setUnlockPassword] = useState('');
  const [tab, setTab] = useState<AppTab>('inbox');
  const [inboxItems, setInboxItems] = useState<InboxListItem[]>([]);
  const [vaultItems, setVaultItems] = useState<VaultListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openedSecret, setOpenedSecret] = useState<PlainSecret | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [totpSetup, setTotpSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [copyLabel, setCopyLabel] = useState('Copy link');

  const refreshInbox = useCallback(async () => {
    const response = await fetch('/api/inbox');
    if (!response.ok) throw new Error('Unable to load inbox.');
    const data = (await response.json()) as { items: InboxListItem[] };
    setInboxItems(data.items);
  }, []);

  const refreshVault = useCallback(async () => {
    const response = await fetch('/api/vault');
    if (!response.ok) throw new Error('Unable to load vault.');
    const data = (await response.json()) as { items: VaultListItem[] };
    setVaultItems(data.items);
  }, []);

  useEffect(() => {
    void fetchCurrentUser().then((current) => {
      if (current) {
        setUser(current);
        setUnlocked(Boolean(getUnlockedPrivateKey()));
      }
    });
  }, []);

  useEffect(() => {
    if (!user || !unlocked) return;
    void refreshInbox().catch(() => undefined);
    void refreshVault().catch(() => undefined);
  }, [user, unlocked, refreshInbox, refreshVault]);

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError('');
    setBusy(true);

    try {
      const privateKeyPkcs8 = await decryptAccountPrivateKey(
        user.encryptedPrivateKey,
        unlockPassword,
      );
      setUnlockedPrivateKey(privateKeyPkcs8);
      setUnlocked(true);
      setUnlockPassword('');
    } catch {
      setError('Invalid master password.');
    } finally {
      setBusy(false);
    }
  }

  function selectInboxItem(id: string) {
    setSelectedId(id);
    setOpenedSecret(null);
    setError('');
  }

  async function decryptSelectedInbox() {
    if (!selectedId) return;

    setBusy(true);
    setError('');
    setOpenedSecret(null);

    try {
      const privateKeyPkcs8 = getUnlockedPrivateKey();
      if (!privateKeyPkcs8) throw new Error('Unlock your account first.');

      const response = await fetch(`/api/inbox/${encodeURIComponent(selectedId)}`);
      if (!response.ok) throw new Error('Unable to open inbox item.');

      const payload = (await response.json()) as InboxEncryptedPayload & {
        metadataPreview?: InboxListItem['metadataPreview'];
      };

      const secret = await decryptInboxDropWithPkcs8(privateKeyPkcs8, payload);
      setOpenedSecret(secret);
      await refreshInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to decrypt item.');
    } finally {
      setBusy(false);
    }
  }

  function selectVaultItem(id: string) {
    setSelectedId(id);
    setOpenedSecret(null);
    setError('');
  }

  async function decryptSelectedVault() {
    if (!selectedId) return;

    setBusy(true);
    setError('');
    setOpenedSecret(null);

    try {
      if (!unlockPassword) {
        throw new Error('Enter your master password to decrypt vault entries.');
      }

      const item = vaultItems.find((entry) => entry.id === selectedId);
      if (!item) throw new Error('Vault entry not found.');

      const secret = await decryptVaultSecret(item.encryptedPayload, unlockPassword);
      setOpenedSecret(secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to decrypt vault entry.');
    } finally {
      setBusy(false);
    }
  }

  async function saveOpenedToVault() {
    if (!openedSecret || !unlockPassword) {
      setError('Re-enter your master password to save to vault.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const encryptedPayload = await encryptVaultSecret(openedSecret, unlockPassword);
      const response = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ encryptedPayload }),
      });

      if (!response.ok) throw new Error('Unable to save to vault.');
      setMessage('Saved to your encrypted vault.');
      await refreshVault();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save to vault.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteInboxItem(id: string) {
    await fetch(`/api/inbox/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (selectedId === id) {
      setSelectedId(null);
      setOpenedSecret(null);
    }
    await refreshInbox();
  }

  async function startTotpSetup() {
    const response = await fetch('/api/auth/totp', { method: 'POST' });
    if (!response.ok) {
      setError('Unable to start 2FA setup.');
      return;
    }
    setTotpSetup((await response.json()) as { secret: string; uri: string });
  }

  async function confirmTotpSetup() {
    if (!totpSetup) return;
    const response = await fetch('/api/auth/totp', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: totpSetup.secret, code: totpCode }),
    });

    if (!response.ok) {
      setError('Invalid authenticator code.');
      return;
    }

    setTotpSetup(null);
    setTotpCode('');
    setMessage('Two-factor authentication enabled.');
    const refreshed = await fetchCurrentUser();
    if (refreshed) setUser(refreshed);
  }

  async function disableTotp() {
    await fetch('/api/auth/totp', { method: 'DELETE' });
    setMessage('Two-factor authentication disabled.');
    const refreshed = await fetchCurrentUser();
    if (refreshed) setUser(refreshed);
  }

  async function handleCopyInboxLink() {
    if (!user) return;
    const url = inboxShareUrl(window.location.origin, user.handle);
    await navigator.clipboard.writeText(url);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy link'), 2000);
  }

  if (!user) {
    return (
      <div className="page">
        <CipherHeroCanvas />
        <div className="page-inner page-inner-narrow">
          <AuthPanel
            onAuthenticated={(nextUser, isUnlocked) => {
              setUser(nextUser);
              setUnlocked(isUnlocked);
            }}
          />
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="page">
        <CipherHeroCanvas />
        <div className="page-inner page-inner-narrow">
          <div className="auth-panel">
            <div className="auth-panel-head">
              <div className="auth-panel-icon"><Lock size={22} /></div>
              <h1>Unlock @{user.handle}</h1>
              <p>Enter your master password to decrypt inbox drops and vault entries.</p>
            </div>
            <form className="auth-form" onSubmit={(event) => void handleUnlock(event)}>
              <div className="field">
                <span className="field-label">Master password</span>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(event) => setUnlockPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && <p className="status-msg error" role="alert">{error}</p>}
              <button type="submit" className="create-btn" disabled={busy}>Unlock</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <CipherHeroCanvas />
      <div className="page-inner">
        <header className="top-bar">
          <div className="top-bar-logo"><Lock size={16} /> CryptoBin · @{user.handle}</div>
          <div className="top-bar-actions">
            <ThemeSwitcher />
            <button type="button" className="chip-btn" onClick={() => void handleCopyInboxLink()}>
              <Clipboard size={12} /> {copyLabel}
            </button>
            <button type="button" className="chip-btn" onClick={() => void logoutAccount().then(() => window.location.reload())}>
              <LogOut size={12} /> Log out
            </button>
          </div>
        </header>

        <div className="account-shell">
          <nav className="account-nav" aria-label="Account sections">
            <button type="button" className={tab === 'inbox' ? 'active' : ''} onClick={() => setTab('inbox')}>
              <Inbox size={16} /> Inbox
            </button>
            <button type="button" className={tab === 'shared' ? 'active' : ''} onClick={() => setTab('shared')}>
              <Users size={16} /> Shared
            </button>
            <button type="button" className={tab === 'vault' ? 'active' : ''} onClick={() => setTab('vault')}>
              <Vault size={16} /> Vault
            </button>
            <button type="button" className={tab === 'security' ? 'active' : ''} onClick={() => setTab('security')}>
              <Shield size={16} /> Security
            </button>
          </nav>

          <section className="account-panel">
            {message && <p className="status-msg success" role="status">{message}</p>}
            {error && <p className="status-msg error" role="alert">{error}</p>}

            {tab === 'inbox' && (
              <div className="split-panel">
                <div className="list-panel">
                  <h2>Inbox drops</h2>
                  {!inboxItems.length ? (
                    <p className="empty-copy">Share your inbox link to receive encrypted secrets.</p>
                  ) : (
                    <ul className="item-list">
                      {inboxItems.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={`item-row${selectedId === item.id ? ' active' : ''}${item.readAt ? '' : ' unread'}`}
                            onClick={() => selectInboxItem(item.id)}
                          >
                            <strong>{item.metadataPreview?.label ?? 'Encrypted secret'}</strong>
                            <span>{item.metadataPreview?.from ? `From ${item.metadataPreview.from}` : new Date(item.createdAt).toLocaleString()}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="detail-panel">
                  {!selectedId ? (
                    <p className="empty-copy">Select a drop, then decrypt it in your browser.</p>
                  ) : !openedSecret ? (
                    <>
                      {(() => {
                        const item = inboxItems.find((entry) => entry.id === selectedId);
                        if (!item) return null;
                        return (
                          <>
                            {(item.metadataPreview?.label || item.metadataPreview?.from) && (
                              <div className="receive-metadata">
                                {item.metadataPreview?.from && (
                                  <span>From: {item.metadataPreview.from}</span>
                                )}
                                {item.metadataPreview?.label && (
                                  <span>{item.metadataPreview.label}</span>
                                )}
                              </div>
                            )}
                            {item.metadataPreview?.description && (
                              <p className="receive-description">{item.metadataPreview.description}</p>
                            )}
                          </>
                        );
                      })()}
                      <p className="empty-copy">
                        Decryption runs locally after you confirm. The server only stores ciphertext.
                      </p>
                      <button
                        type="button"
                        className="create-btn"
                        disabled={busy}
                        onClick={() => void decryptSelectedInbox()}
                      >
                        <Eye size={15} /> Decrypt drop
                      </button>
                    </>
                  ) : (
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
                      <div className="detail-actions">
                        <div className="field">
                          <span className="field-label">Confirm master password to save</span>
                          <input
                            type="password"
                            value={unlockPassword}
                            onChange={(event) => setUnlockPassword(event.target.value)}
                            placeholder="Master password"
                            autoComplete="current-password"
                          />
                        </div>
                        <button type="button" className="create-btn" disabled={busy} onClick={() => void saveOpenedToVault()}>
                          <Save size={15} /> Save to vault
                        </button>
                        {selectedId && (
                          <button type="button" className="new-btn" onClick={() => void deleteInboxItem(selectedId)}>
                            <Trash2 size={15} /> Remove from inbox
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {tab === 'shared' && user && (
              <SharedInboxPanel user={user} />
            )}

            {tab === 'vault' && (
              <div className="split-panel">
                <div className="list-panel">
                  <h2>Encrypted vault</h2>
                  <p className="empty-copy">Saved secrets are encrypted with your master password before upload.</p>
                  {!vaultItems.length ? (
                    <p className="empty-copy">No saved secrets yet.</p>
                  ) : (
                    <ul className="item-list">
                      {vaultItems.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={`item-row${selectedId === item.id ? ' active' : ''}`}
                            onClick={() => selectVaultItem(item.id)}
                          >
                            <strong>Encrypted entry</strong>
                            <span>{new Date(item.createdAt).toLocaleString()}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="detail-panel">
                  {!selectedId ? (
                    <p className="empty-copy">Select a vault entry to decrypt it.</p>
                  ) : !openedSecret ? (
                    <>
                      <p className="empty-copy">
                        Enter your master password, then decrypt this entry in your browser.
                      </p>
                      <div className="field">
                        <span className="field-label">Master password</span>
                        <input
                          type="password"
                          value={unlockPassword}
                          onChange={(event) => setUnlockPassword(event.target.value)}
                          placeholder="Master password"
                          autoComplete="current-password"
                        />
                      </div>
                      <button
                        type="button"
                        className="create-btn"
                        disabled={busy}
                        onClick={() => void decryptSelectedVault()}
                      >
                        <Eye size={15} /> Decrypt entry
                      </button>
                    </>
                  ) : (
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
                </div>
              </div>
            )}

            {tab === 'security' && (
              <div>
                <h2>Two-factor authentication</h2>
                <p className="empty-copy">
                  {user.totpEnabled
                    ? 'Your account requires an authenticator code at login.'
                    : 'Add TOTP 2FA for an extra layer on top of your master password.'}
                </p>
                {user.totpEnabled ? (
                  <button type="button" className="new-btn" onClick={() => void disableTotp()}>Disable 2FA</button>
                ) : totpSetup ? (
                  <div className="security-setup">
                    <p>Add this secret to your authenticator app:</p>
                    <code className="setup-code">{totpSetup.secret}</code>
                    <div className="field">
                      <span className="field-label">Verification code</span>
                      <input value={totpCode} onChange={(event) => setTotpCode(event.target.value)} inputMode="numeric" />
                    </div>
                    <button type="button" className="create-btn" onClick={() => void confirmTotpSetup()}>Enable 2FA</button>
                  </div>
                ) : (
                  <button type="button" className="create-btn" onClick={() => void startTotpSetup()}>Set up 2FA</button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
