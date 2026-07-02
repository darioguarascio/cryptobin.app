import { Inbox, LogIn, Save, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchCurrentUser, type AccountUser } from '@/lib/accountSession';
import type { PlainSecret } from '@/lib/crypto';
import { encryptVaultSecret } from '@/lib/vaultCrypto';

type AuthState =
  | { kind: 'loading' }
  | { kind: 'guest' }
  | { kind: 'user'; user: AccountUser };

export default function VaultSaveControl({ secret }: { secret: PlainSecret }) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });
  const [masterPassword, setMasterPassword] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'busy' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    void fetchCurrentUser().then((user) => {
      setAuth(user ? { kind: 'user', user } : { kind: 'guest' });
    });
  }, []);

  async function saveToVault() {
    if (auth.kind !== 'user') return;

    if (!masterPassword) {
      setSaveStatus('error');
      setSaveMessage('Enter your master password.');
      return;
    }

    setSaveStatus('busy');
    setSaveMessage('Encrypting for your vault…');

    try {
      const encryptedPayload = await encryptVaultSecret(secret, masterPassword);
      const response = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ encryptedPayload }),
      });

      if (!response.ok) {
        throw new Error('Unable to save to your vault.');
      }

      setMasterPassword('');
      setSaveStatus('success');
      setSaveMessage('Saved to your encrypted vault. Open your inbox to view it.');
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(error instanceof Error ? error.message : 'Could not save to vault.');
    }
  }

  if (auth.kind === 'loading') {
    return null;
  }

  if (auth.kind === 'guest') {
    return (
      <div className="vault-save vault-save-cta">
        <div className="vault-save-heading">
          <Inbox size={16} />
          <span>Keep this secret in your inbox</span>
        </div>
        <p className="vault-save-cta-copy">
          Create a free CryptoBin inbox to save encrypted secrets to your account vault.
        </p>
        <div className="vault-save-cta-actions">
          <a className="create-btn" href="/register">
            <UserPlus size={15} />
            Create inbox
          </a>
          <a className="chip-btn" href="/login">
            <LogIn size={12} />
            Log in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-save">
      <div className="vault-save-heading">
        <Inbox size={16} />
        <span>Save to inbox</span>
      </div>
      <p className="vault-save-cta-copy">
        Encrypt with your master password and store in @{auth.user.handle}&apos;s vault.
      </p>
      <div className="vault-save-row">
        <label>
          <span className="sr-only">Master password</span>
          <input
            type="password"
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.target.value)}
            placeholder="Master password"
            autoComplete="current-password"
            disabled={saveStatus === 'busy'}
          />
        </label>
        <button type="button" onClick={() => void saveToVault()} disabled={saveStatus === 'busy'}>
          <Save size={16} /> Save
        </button>
      </div>
      {saveMessage ? (
        <p className={`vault-save-status ${saveStatus}`} role="status">
          {saveMessage}
        </p>
      ) : null}
    </div>
  );
}
