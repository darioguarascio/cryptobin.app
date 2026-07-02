import { CheckCircle, ChevronDown, Clipboard, Eye, Lock, Plus, Send, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { buildShareUrl, encryptSecret } from '@/lib/crypto';
import CipherHeroCanvas from './CipherHeroCanvas';

interface Props {
  handle: string;
}

export default function InboxDrop({ handle }: Props) {
  const [from,        setFrom]        = useState('');
  const [label,       setLabel]       = useState('');
  const [description, setDescription] = useState('');
  const [secret,      setSecret]      = useState('');
  const [link,        setLink]        = useState('');
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState('');
  const [copyLabel,   setCopyLabel]   = useState('Copy link');
  const [showAdv,     setShowAdv]     = useState(false);

  async function submitDrop(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;
    setError('');
    setBusy(true);
    setLink('');

    try {
      const encrypted = await encryptSecret({
        body: secret,
        metadata: {
          from:        from.trim()        || undefined,
          label:       label.trim()       || undefined,
          description: description.trim() || undefined,
          recipient: handle,
        },
      });

      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...encrypted.payload, ttlHours: 24 }),
      });

      if (!response.ok) throw new Error('Unable to store the encrypted inbox drop.');

      const result = (await response.json()) as { id: string };
      setLink(buildShareUrl(window.location.origin, result.id, encrypted.key));
      setSecret('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create drop.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy link'), 2000);
  }

  return (
    <div className="page">
      <CipherHeroCanvas />

      <div className="page-inner">
        {/* Top bar */}
        <header className="top-bar">
          <div className="top-bar-logo">
            <Lock size={16} />
            CryptoBin
          </div>
          <div className="top-bar-chips">
            <span className="chip"><ShieldCheck size={11} /> Browser-only crypto</span>
            <span className="chip">AES-256-GCM</span>
            <span className="chip"><Eye size={11} /> Burn once</span>
          </div>
        </header>

        {/* Main card */}
        <main className="page-center">
          <div className="encrypt-card">
            {link ? (
              /* Result view */
              <div className="result-view" aria-live="polite">
                <div className="result-check">
                  <CheckCircle size={22} />
                  <p className="result-ready">Encrypted drop created</p>
                </div>

                <div className="result-url-box">
                  <a href={link} className="result-url">{link}</a>
                </div>

                <small className="result-expiry">
                  Burns after one open · Expires in 24 hours · Addressed to {handle}
                </small>

                <div className="result-actions">
                  <button className="create-btn" type="button" onClick={() => void handleCopy()}>
                    <Clipboard size={15} />
                    {copyLabel}
                  </button>
                  <button
                    className="new-btn"
                    type="button"
                    onClick={() => { setLink(''); setError(''); setCopyLabel('Copy link'); }}
                  >
                    <Plus size={15} />
                    New
                  </button>
                </div>
              </div>
            ) : (
              /* Compose form */
              <>
                <div className="card-head">
                  <h1>Drop a secret to <span style={{ color: 'var(--accent)' }}>{handle}</span></h1>
                  <p>Encrypted here in your browser · Burned after one open</p>
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

                  {/* Advanced toggle */}
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
                      <><Send size={15} /> Seal &amp; send drop</>
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
