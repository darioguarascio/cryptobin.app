import { useEffect, useState } from 'react';
import { Lock, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import {
  decryptAccountPrivateKey,
  encryptAccountPrivateKey,
  generateAccountKeyPair,
} from '@/lib/accountCrypto';
import {
  fetchCurrentUser,
  setAccountUser,
  setUnlockedPrivateKey,
  type AccountUser,
} from '@/lib/accountSession';
import { handleValidationMessage, normalizeHandle } from '@/lib/handles';
import type { EncryptedVaultSecret } from '@/lib/vaultCrypto';

type Mode = 'login' | 'register';

interface AuthPanelProps {
  onAuthenticated: (user: AccountUser, unlocked: boolean) => void;
  initialMode?: Mode;
}

export default function AuthPanel({ onAuthenticated, initialMode = 'login' }: AuthPanelProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requiresTotp, setRequiresTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchCurrentUser().then((user) => {
      if (user) {
        onAuthenticated(user, false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const normalized = normalizeHandle(handle);
      const handleError = handleValidationMessage(normalized);
      if (handleError) {
        throw new Error(handleError);
      }

      if (mode === 'register') {
        if (masterPassword.length < 12) {
          throw new Error('Master password must be at least 12 characters.');
        }
        if (masterPassword !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const keyPair = await generateAccountKeyPair();
        const encryptedPrivateKey = await encryptAccountPrivateKey(
          keyPair.privateKeyPkcs8,
          masterPassword,
        );

        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            handle: normalized,
            masterPassword,
            email: email.trim() || undefined,
            publicKey: keyPair.publicKeySpki,
            encryptedPrivateKey,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? 'Registration failed.');
        }

        const payload = (await response.json()) as { user: AccountUser };
        setAccountUser(payload.user);
        setUnlockedPrivateKey(keyPair.privateKeyPkcs8);
        onAuthenticated(payload.user, true);
        return;
      }

      const response = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle: normalized,
          masterPassword,
          totpCode: totpCode || undefined,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        requiresTotp?: boolean;
        user?: AccountUser;
      };

      if (!response.ok) {
        setRequiresTotp(Boolean(payload.requiresTotp));
        throw new Error(payload.error ?? 'Login failed.');
      }

      if (!payload.user) {
        throw new Error('Login failed.');
      }

      const privateKeyPkcs8 = await decryptAccountPrivateKey(
        payload.user.encryptedPrivateKey as EncryptedVaultSecret,
        masterPassword,
      );

      setAccountUser(payload.user);
      setUnlockedPrivateKey(privateKeyPkcs8);
      onAuthenticated(payload.user, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-panel">
      <div className="auth-panel-head">
        <div className="auth-panel-icon">
          {mode === 'register' ? <UserPlus size={22} /> : <LogIn size={22} />}
        </div>
        <h1>{mode === 'register' ? 'Create your encrypted inbox' : 'Unlock your account'}</h1>
        <p>
          {mode === 'register'
            ? 'Claim a handle, encrypt your keys locally, and share your inbox link.'
            : 'Your secrets stay encrypted. Only your master password can unlock them.'}
        </p>
      </div>

      <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>
        <div className="field">
          <span className="field-label">Handle</span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="your-handle"
            autoComplete="username"
            required
          />
        </div>

        {mode === 'register' && (
          <div className="field">
            <span className="field-label">Email (for inbox notifications)</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
        )}

        <div className="field">
          <span className="field-label">Master password</span>
          <input
            type="password"
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.target.value)}
            placeholder="At least 12 characters"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
          />
        </div>

        {mode === 'register' && (
          <div className="field">
            <span className="field-label">Confirm master password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat master password"
              autoComplete="new-password"
              required
            />
          </div>
        )}

        {(requiresTotp || mode === 'login') && (
          <div className="field">
            <span className="field-label">Authenticator code {requiresTotp ? '' : '(if enabled)'}</span>
            <input
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>
        )}

        {error && <p className="status-msg error" role="alert">{error}</p>}

        <button type="submit" className="create-btn" disabled={busy}>
          {busy ? (
            <><span className="btn-spinner" aria-hidden="true" /> Working…</>
          ) : mode === 'register' ? (
            <><Lock size={15} /> Create account</>
          ) : (
            <><ShieldCheck size={15} /> Unlock account</>
          )}
        </button>
      </form>

      <p className="auth-switch">
        {mode === 'register' ? 'Already have an account?' : 'Need an inbox link?'}
        {' '}
        <button type="button" className="link-btn" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>
          {mode === 'register' ? 'Log in' : 'Create one'}
        </button>
      </p>
    </div>
  );
}
