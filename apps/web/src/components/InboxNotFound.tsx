import { Lock } from 'lucide-react';
import CipherHeroCanvas from './CipherHeroCanvas';

interface Props {
  handle: string;
}

export default function InboxNotFound({ handle }: Props) {
  return (
    <div className="page">
      <CipherHeroCanvas />
      <div className="page-inner page-inner-narrow">
        <div className="auth-panel">
          <div className="auth-panel-head">
            <div className="auth-panel-icon"><Lock size={22} /></div>
            <h1>Inbox not found</h1>
            <p>
              <strong>{handle}</strong> is not registered yet. Claim it to start receiving encrypted drops.
            </p>
          </div>
          <a className="create-btn" href="/register">Create account</a>
        </div>
      </div>
    </div>
  );
}
