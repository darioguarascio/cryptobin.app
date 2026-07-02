import { CheckCircle, ChevronDown, Clipboard, Eye, Lock, Plus, Send, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildShareUrl, encryptSecret } from '@/lib/crypto';
import CipherHeroCanvas from './CipherHeroCanvas';

interface CreatedSecret {
  url: string;
  expiresAt: string;
}

const TTL_OPTIONS = [
  { hours: 1,   label: '1 hr' },
  { hours: 24,  label: '24 hr' },
  { hours: 72,  label: '3 days' },
  { hours: 168, label: '7 days' },
];

export default function CryptoBinApp() {
  const [secret,      setSecret]      = useState('');
  const [from,        setFrom]        = useState('');
  const [label,       setLabel]       = useState('');
  const [description, setDescription] = useState('');
  const [ttlHours,    setTtlHours]    = useState(24);
  const [created,     setCreated]     = useState<CreatedSecret | null>(null);
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState('');
  const [copyLabel,   setCopyLabel]   = useState('Copy link');
  const [showAdv,     setShowAdv]     = useState(false);

  const canCreate = useMemo(
    () => secret.trim().length > 0 && !busy,
    [secret, busy],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) { setError('Add a secret first.'); return; }
    setError('');
    setBusy(true);
    setCreated(null);

    try {
      const encrypted = await encryptSecret({
        body: secret,
        metadata: {
          from:        from.trim()        || undefined,
          label:       label.trim()       || undefined,
          description: description.trim() || undefined,
        },
      });

      const res = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...encrypted.payload, ttlHours }),
      });

      if (!res.ok) throw new Error('Could not store the encrypted secret.');

      const data = (await res.json()) as { id: string; expiresAt: string };
      setCreated({
        expiresAt: data.expiresAt,
        url: buildShareUrl(window.location.origin, data.id, encrypted.key),
      });
      setSecret('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!created) return;
    await navigator.clipboard.writeText(created.url);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy link'), 2000);
  }

  function handleReset() {
    setCreated(null);
    setError('');
    setCopyLabel('Copy link');
  }

  const expiresLabel = created
    ? new Date(created.expiresAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '';

  return (
    <div className="page">
      <CipherHeroCanvas />

      <div className="page-inner">
        {/* ── Top bar ── */}
        <header className="top-bar">
          <div className="top-bar-logo">
            <Lock size={16} />
            CryptoBin
          </div>
          <div className="top-bar-chips" aria-label="Security properties">
            <span className="chip"><ShieldCheck size={11} /> Browser-only crypto</span>
            <span className="chip">AES-256-GCM</span>
            <span className="chip"><Eye size={11} /> Burn once</span>
          </div>
        </header>

        {/* ── Main card ── */}
        <main className="page-center">
          <div className="encrypt-card">

            {created ? (
              /* ── Result view ── */
              <div className="result-view" aria-live="polite">
                <div className="result-check">
                  <CheckCircle size={22} />
                  <p className="result-ready">Encrypted link ready</p>
                </div>

                <div className="result-url-box">
                  <a href={created.url} className="result-url">{created.url}</a>
                </div>

                <small className="result-expiry">
                  Burns after one open · Expires {expiresLabel}
                </small>

                <div className="result-actions">
                  <button className="create-btn" type="button" onClick={() => void handleCopy()}>
                    <Clipboard size={15} />
                    {copyLabel}
                  </button>
                  <button className="new-btn" type="button" onClick={handleReset}>
                    <Plus size={15} />
                    New
                  </button>
                </div>
              </div>
            ) : (
              /* ── Compose form ── */
              <>
                <div className="card-head">
                  <h1>Send a secret, once.</h1>
                  <p>Encrypted here · Decrypted there · Server sees only ciphertext</p>
                </div>

                <form className="composer" onSubmit={(e) => void handleCreate(e)}>
                  {/* Secret textarea */}
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

                  {/* TTL pills */}
                  <div className="ttl-row">
                    <span className="ttl-label">Expires</span>
                    <div className="ttl-pills">
                      {TTL_OPTIONS.map((opt) => (
                        <button
                          key={opt.hours}
                          type="button"
                          className={`ttl-pill${ttlHours === opt.hours ? ' active' : ''}`}
                          aria-pressed={ttlHours === opt.hours}
                          onClick={() => setTtlHours(opt.hours)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
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

                  {/* Error */}
                  {error && (
                    <p className="status-msg error" role="alert">{error}</p>
                  )}

                  {/* Submit */}
                  <button type="submit" className="create-btn" disabled={!canCreate}>
                    {busy ? (
                      <><span className="btn-spinner" aria-hidden="true" /> Encrypting…</>
                    ) : (
                      <><Send size={15} /> Create encrypted link</>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </main>

        {/* ── How it works ── */}
        <section className="how-section" aria-label="How CryptoBin works">
          <p className="eyebrow" style={{ marginBottom: 24 }}>How it works</p>
          <div className="how-steps">
            <div className="how-step">
              <span className="how-n">01</span>
              <h3>Browser encrypts</h3>
              <p>AES-256-GCM runs entirely in your browser. The plaintext never leaves your device.</p>
            </div>
            <div className="how-divider" aria-hidden="true" />
            <div className="how-step">
              <span className="how-n">02</span>
              <h3>Server stores ciphertext</h3>
              <p>Only the encrypted blob is uploaded. The decryption key lives in the URL fragment — invisible to servers.</p>
            </div>
            <div className="how-divider" aria-hidden="true" />
            <div className="how-step">
              <span className="how-n">03</span>
              <h3>Recipient decrypts once</h3>
              <p>On first open the secret is decrypted in their browser, then permanently deleted from the server.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
