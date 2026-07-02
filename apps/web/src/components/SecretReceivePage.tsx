import { AlertTriangle, Eye, Lock } from 'lucide-react';
import { useState } from 'react';
import {
  decryptSecret,
  type EncryptedSecretPayload,
  type PlainSecret,
} from '@/lib/crypto';
import CipherHeroCanvas from './CipherHeroCanvas';
import CopyButton from './CopyButton';
import ThemeSwitcher from './ThemeSwitcher';
import VaultSaveControl from './VaultSaveControl';

type ViewState =
  | { kind: 'cta' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; secret: PlainSecret };

interface SecretReceivePageProps {
  secretId: string;
}

function readShareKey(): string {
  return window.location.hash.slice(1);
}

export default function SecretReceivePage({ secretId }: SecretReceivePageProps) {
  const [view, setView] = useState<ViewState>(() => {
    const decryptionKey = typeof window !== 'undefined' ? readShareKey() : '';
    if (!secretId || !decryptionKey) {
      return {
        kind: 'error',
        message: 'This link is missing the secret id or decryption key.',
      };
    }
    return { kind: 'cta' };
  });

  async function revealSecret() {
    const decryptionKey = readShareKey();

    if (!secretId || !decryptionKey) {
      setView({
        kind: 'error',
        message: 'This link is missing the secret id or decryption key.',
      });
      return;
    }

    setView({ kind: 'loading' });

    try {
      const response = await fetch(`/api/secrets/${encodeURIComponent(secretId)}`);
      if (!response.ok) {
        throw new Error('This secret is missing, expired, or already opened.');
      }

      const payload = (await response.json()) as EncryptedSecretPayload;
      const plain = await decryptSecret(payload, decryptionKey);
      setView({ kind: 'ready', secret: plain });
    } catch (error: unknown) {
      setView({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to open this secret.',
      });
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
          <div className="top-bar-actions">
            <ThemeSwitcher />
          </div>
        </header>

        <div className="receive-center">
          <div className="receive-header">
            <div className="receive-header-icon">
              <Eye size={24} aria-hidden="true" />
            </div>
            <h1>
              {view.kind === 'ready'
                ? 'Your secret is ready'
                : 'A secret has been shared with you'}
            </h1>
          </div>

          <section className="receive-card">
            {view.kind === 'cta' && (
              <div className="receive-reveal">
                <p className="receive-reveal-copy">
                  Someone sent you a one-time encrypted message. Reveal it only when you are
                  ready — opening it permanently deletes it from the server.
                </p>
                <div className="receive-warning" role="note">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <p>
                    This link works once. After you reveal the secret, it cannot be opened again.
                  </p>
                </div>
                <button type="button" className="create-btn" onClick={() => void revealSecret()}>
                  <Eye size={15} />
                  Reveal secret
                </button>
              </div>
            )}

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
                  <pre className="secret-body">{view.secret.body}</pre>
                </div>

                <CopyButton text={view.secret.body} label="Copy secret" />

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
              Each secret is a one-time link. Nothing is fetched until you choose to reveal it.
              After that, it is permanently deleted from the server.
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
