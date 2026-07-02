import { Save, Vault } from 'lucide-react';
import { useState } from 'react';
import { encryptVaultSecret } from '@/lib/vaultCrypto';
import { appendVaultRecord } from '@/lib/vaultStore';
import type { PlainSecret } from '@/lib/crypto';

export default function VaultSaveControl({ secret }: { secret: PlainSecret }) {
  const [masterPassword, setMasterPassword] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'busy' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  async function saveToVault() {
    if (!masterPassword) {
      setSaveStatus('error');
      setSaveMessage('Enter a master password.');
      return;
    }

    setSaveStatus('busy');
    setSaveMessage('Encrypting for local vault...');

    try {
      const payload = await encryptVaultSecret(secret, masterPassword);

      appendVaultRecord(localStorage, {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        payload,
      });

      setMasterPassword('');
      setSaveStatus('success');
      setSaveMessage('Saved to local vault in this browser.');
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(error instanceof Error ? error.message : 'Could not save to vault.');
    }
  }

  return (
    <div className="vault-save">
      <div className="vault-save-heading">
        <Vault size={16} />
        <span>Save to local vault</span>
      </div>
      <div className="vault-save-row">
        <label>
          <span className="sr-only">Master password</span>
          <input
            type="password"
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.target.value)}
            placeholder="Master password"
            autoComplete="new-password"
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
