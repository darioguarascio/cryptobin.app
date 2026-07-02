import { AlertTriangle, Clipboard, Eye, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  decryptSecret,
  type EncryptedSecretPayload,
  type PlainSecret,
} from '@/lib/crypto';
import CipherHeroCanvas from './CipherHeroCanvas';
import VaultSaveControl from './VaultSaveControl';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; secret: PlainSecret };

interface SecretReceivePageProps {
  secretId: string;
}

export default function SecretReceivePage({ secretId }: SecretReceivePageProps) {
  const [view,       setView]       = useState<ViewState>({ kind: 'loading' });
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    const key = window.location.hash.slice(1);

    if (!secretId || !key) {
      setView({ kind: 'error', message: 'This link is missing the secret id or decryption key.' });
      return;
    }

    void fetch(`/api/secrets/${encodeURIComponent(secretId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('This secret is missing, expired, or already opened.');
        const payload = (await response.json()) as EncryptedSecretPayload;
        const plain = await decryptSecret(payload, key);
        setView({ kind: 'ready', secret: plain });
      })
      .catch((error: unknown) => {
        setView({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unable to open this secret.',
        });
      });
  }, [secretId]);

  async function copySecret(body: string) {
    await navigator.clipboard.writeText(body);
    setCopyStatus('copied');
    window.setTimeout(() => setCopyStatus('idle'), 2000);
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
        </header>

        {/* Content */}
        <div className="receive-center">
          <div className="receive-header">
            <div className="receive-header-icon">
              <Eye size={24} aria-hidden="true" />
            </div>
            <h1>A secret has been shared with you</h1>
          </div>

          <section className="receive-card">
            {view.kind === 'loading' && (
              <p className="receive-status">Decrypting secret in your browser…</p>
            )}

            {view.kind === 'error' && (
              <p className="receive-status receive-status-error" role="alert">
                {view.message}
              </p>
            )}

            {view.kind === 'ready' && (
              <>
                {(view.secret.metadata.label || view.secret.metadata.from) && (
                  <div className="receive-metadata">
                    {view.secret.metadata.from && (
                      <span>From: {view.secret.metadata.from}</span>
                    )}
                    {view.secret.metadata.label && (
                      <span>{view.secret.metadata.label}</span>
                    )}
                  </div>
                )}

                {view.secret.metadata.description && (
                  <p className="receive-description">{view.secret.metadata.description}</p>
                )}

                <div className="secret-display">
                  <button
                    type="button"
                    className="secret-copy"
                    onClick={() => void copySecret(view.secret.body)}
                  >
                    <Clipboard size={13} aria-hidden="true" />
                    {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                  </button>
                  <pre className="secret-body">{view.secret.body}</pre>
                </div>

                <div className="receive-warning" role="note">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <p>
                    Save this secret somewhere safe now. Once you leave this page, it
                    can&apos;t be opened again — it has already been deleted from the server.
                  </p>
                </div>

                <VaultSaveControl secret={view.secret} />
              </>
            )}
          </section>

          <section className="receive-card receive-about">
            <h2>About CryptoBin</h2>
            <p>
              Each secret is a one-time link. The moment you opened it, it was permanently
              deleted from the server. No second chance.
            </p>
            <p>
              Everything is encrypted and decrypted in your browser. The decryption key lives
              in the URL fragment, which browsers never send to servers — so we can never read it.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
