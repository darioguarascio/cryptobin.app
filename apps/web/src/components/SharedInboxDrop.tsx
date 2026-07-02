import { CheckCircle, ChevronDown, Eye, Lock, Send, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import type { PlainSecret } from '@/lib/crypto';
import { encryptSharedInboxDrop } from '@/lib/sharedInboxCrypto';
import CipherHeroCanvas from './CipherHeroCanvas';
import ThemeSwitcher from './ThemeSwitcher';

interface Props {
  slug: string;
  name: string;
}

export default function SharedInboxDrop({ slug, name }: Props) {
  const [from, setFrom] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [secret, setSecret] = useState('');
  const [delivered, setDelivered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAdv, setShowAdv] = useState(false);

  async function submitDrop(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;
    setError('');
    setBusy(true);
    setDelivered(false);

    try {
      const publicKeyResponse = await fetch(`/api/shared-inbox/public/${encodeURIComponent(slug)}`);
      if (!publicKeyResponse.ok) {
        throw new Error('This shared inbox does not exist.');
      }

      const { publicKey } = (await publicKeyResponse.json()) as { publicKey: string };
      const plain: PlainSecret = {
        body: secret,
        metadata: {
          from: from.trim() || undefined,
          label: label.trim() || undefined,
          description: description.trim() || undefined,
          recipient: slug,
        },
      };

      const encrypted = await encryptSharedInboxDrop(publicKey, plain);
      const response = await fetch(`/api/shared-inbox/drop/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...encrypted,
          metadataPreview: plain.metadata,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to deliver the encrypted shared inbox drop.');
      }

      setDelivered(true);
      setSecret('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create drop.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <CipherHeroCanvas />

      <div className="page-inner">
        <header className="top-bar">
          <div className="top-bar-logo">
            <Lock size={16} />
            CryptoBin
          </div>
          <div className="top-bar-chips">
            <span className="chip"><Users size={11} /> Shared inbox</span>
            <span className="chip"><ShieldCheck size={11} /> Browser-only crypto</span>
            <span className="chip"><Eye size={11} /> Team encrypted</span>
          </div>
          <div className="top-bar-actions">
            <ThemeSwitcher />
          </div>
        </header>

        <main className="page-center">
          <div className="encrypt-card">
            {delivered ? (
              <div className="result-view" aria-live="polite">
                <div className="result-check">
                  <CheckCircle size={22} />
                  <p className="result-ready">Secret delivered to shared inbox</p>
                </div>
                <small className="result-expiry">
                  Encrypted for <span style={{ color: 'var(--accent)' }}>{name}</span>.
                  Only invited members can decrypt it after unlocking their accounts.
                </small>
                <button
                  className="new-btn"
                  type="button"
                  onClick={() => { setDelivered(false); setError(''); }}
                >
                  Send another
                </button>
              </div>
            ) : (
              <>
                <div className="card-head">
                  <h1>Drop a secret to <span style={{ color: 'var(--accent)' }}>{name}</span></h1>
                  <p>Shared inbox · Encrypted in your browser · Readable by invited members only</p>
                </div>

                <form className="composer" onSubmit={(e) => void submitDrop(e)}>
                  <div className="field">
                    <span className="field-label">Secret</span>
                    <textarea
                      rows={5}
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder="Paste a password, API key, recovery code, or short note…"
                      autoFocus
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      className="advanced-toggle"
                      aria-expanded={showAdv}
                      onClick={() => setShowAdv((v) => !v)}
                    >
                      <ChevronDown size={13} />
                      {showAdv ? 'Hide' : 'Add'} sender &amp; label
                    </button>

                    {showAdv && (
                      <div className="advanced-fields" style={{ marginTop: 12 }}>
                        <div className="field-row">
                          <div className="field">
                            <span className="field-label">From</span>
                            <input
                              value={from}
                              onChange={(e) => setFrom(e.target.value)}
                              placeholder="Your name or alias"
                            />
                          </div>
                          <div className="field">
                            <span className="field-label">Label</span>
                            <input
                              value={label}
                              onChange={(e) => setLabel(e.target.value)}
                              placeholder="Production API key"
                            />
                          </div>
                        </div>
                        <div className="field">
                          <span className="field-label">Description</span>
                          <input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What this unlocks or why it was sent"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="status-msg error" role="alert">{error}</p>
                  )}

                  <button type="submit" className="create-btn" disabled={!secret.trim() || busy}>
                    {busy ? (
                      <><span className="btn-spinner" aria-hidden="true" /> Encrypting…</>
                    ) : (
                      <><Send size={15} /> Seal &amp; send to shared inbox</>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
