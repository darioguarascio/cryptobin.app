import { CheckCircle, ChevronDown, Eye, Inbox, KeyRound, Link2, Lock, Plus, Send, ShieldCheck, Timer, Trash2, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildShareUrl, encryptSecret } from '@/lib/crypto';
import CipherHeroCanvas from './CipherHeroCanvas';
import CopyButton from './CopyButton';
import ThemeSwitcher from './ThemeSwitcher';

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
      const encrypted = await encryptSecret(
        {
          body: secret,
          metadata: {
            from:        from.trim()        || undefined,
            label:       label.trim()       || undefined,
            description: description.trim() || undefined,
          },
        },
        ttlHours,
      );

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

  function handleReset() {
    setCreated(null);
    setError('');
  }

  const expiresLabel = created
    ? new Date(created.expiresAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '';

  return (
    <div className="page" id="top">
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
          <div className="top-bar-actions">
            <ThemeSwitcher />
            <div className="top-bar-auth-links">
              <a className="chip-btn" href="/login">Log in</a>
              <a className="chip-btn accent" href="/register">Create inbox</a>
            </div>
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
                  <CopyButton text={created.url} label="Copy" variant="inline" />
                </div>

                <small className="result-expiry">
                  Burns after one open · Expires {expiresLabel}
                </small>

                <div className="result-actions">
                  <CopyButton text={created.url} label="Copy link" />
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

        <section className="landing-section" aria-label="Features">
          <div className="landing-head">
            <p className="eyebrow">Built for real handoffs</p>
            <h2>Share credentials without leaving a trail</h2>
            <p>
              Passwords, API keys, recovery codes — anything too sensitive for Slack or email.
              CryptoBin encrypts before upload and destroys after read.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-card-icon" aria-hidden="true"><KeyRound size={18} /></span>
              <h3>Zero-knowledge by design</h3>
              <p>
                Keys never touch the server. The decryption material stays in the URL hash,
                which browsers do not send in HTTP requests.
              </p>
            </article>
            <article className="feature-card">
              <span className="feature-card-icon" aria-hidden="true"><Trash2 size={18} /></span>
              <h3>Burn after reading</h3>
              <p>
                One-time links are deleted the moment they are opened. No replays, no
                accidental re-sharing from a stale cache.
              </p>
            </article>
            <article className="feature-card">
              <span className="feature-card-icon" aria-hidden="true"><Timer size={18} /></span>
              <h3>Expiry you control</h3>
              <p>
                Pick 1 hour to 7 days. Shorter TTLs use tighter link formats — less to
                copy, same AES-256-GCM protection.
              </p>
            </article>
            <article className="feature-card">
              <span className="feature-card-icon" aria-hidden="true"><Inbox size={18} /></span>
              <h3>Personal inbox</h3>
              <p>
                Register a handle and let others drop secrets to you. RSA-OAEP wraps each
                delivery; only your unlocked key can read it.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-section" aria-label="Two ways to share">
          <div className="landing-head">
            <p className="eyebrow">Two modes</p>
            <h2>One-time link or standing inbox</h2>
            <p>Use the right tool for the moment — both run the same client-side crypto.</p>
          </div>
          <div className="mode-grid">
            <article className="mode-card">
              <span className="feature-card-icon" aria-hidden="true"><Link2 size={18} /></span>
              <h3>One-time share link</h3>
              <p>
                Paste a secret, get a link, send it anywhere. The recipient clicks to reveal;
                the ciphertext is gone after that single view.
              </p>
              <a href="#top">Create a link ↑</a>
            </article>
            <article className="mode-card">
              <span className="feature-card-icon" aria-hidden="true"><Inbox size={18} /></span>
              <h3>Encrypted inbox</h3>
              <p>
                Claim a handle like <code>you.cryptobin.app/yourname</code>. Teammates drop
                secrets there; you decrypt and optionally save to your vault.
              </p>
              <a href="/register">Create your inbox →</a>
            </article>
          </div>
        </section>

        <section className="landing-section" aria-label="Security model">
          <div className="landing-head">
            <p className="eyebrow">Security</p>
            <h2>What we can and cannot see</h2>
            <p>CryptoBin is intentionally dumb about your data — that is the point.</p>
          </div>
          <ul className="trust-list">
            <li>
              <span className="trust-bullet" aria-hidden="true">✓</span>
              <div>
                <strong>Encrypted in the browser</strong>
                AES-256-GCM for share links; RSA-OAEP + AES-GCM for inbox drops. Plaintext
                never hits our API.
              </div>
            </li>
            <li>
              <span className="trust-bullet" aria-hidden="true">✓</span>
              <div>
                <strong>Fragment keys stay local</strong>
                Share-link decryption keys live after the <code>#</code> in the URL. Servers
                and logs never receive them.
              </div>
            </li>
            <li>
              <span className="trust-bullet" aria-hidden="true">✓</span>
              <div>
                <strong>Optional 2FA on accounts</strong>
                Inbox owners can enable TOTP. Your master password unlocks your private key
                client-side — we store only a bcrypt hash.
              </div>
            </li>
            <li>
              <span className="trust-bullet" aria-hidden="true">!</span>
              <div>
                <strong>You still need a safe channel</strong>
                Send the link itself over a channel you trust. CryptoBin protects the secret
                at rest, not who you share the link with.
              </div>
            </li>
          </ul>
        </section>

        <footer className="site-footer">
          <p>
            <Zap size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6, color: 'var(--accent)' }} aria-hidden="true" />
            CryptoBin — zero-knowledge secret exchange.
            {' '}
            <a href="/register">Get an inbox</a>
            {' · '}
            <a href="/login">Log in</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
