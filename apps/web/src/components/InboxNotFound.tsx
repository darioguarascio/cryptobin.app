import { Lock } from 'lucide-react';
import CipherHeroCanvas from './CipherHeroCanvas';

interface Props {
  handle: string;
  kind?: 'personal' | 'shared';
}

export default function InboxNotFound({ handle, kind = 'personal' }: Props) {
  const isShared = kind === 'shared';

  return (
    <div className="page">
      <CipherHeroCanvas />
      <div className="page-inner page-inner-narrow">
        <div className="auth-panel">
          <div className="auth-panel-head">
            <div className="auth-panel-icon"><Lock size={22} /></div>
            <h1>{isShared ? 'Shared inbox not found' : 'Inbox not found'}</h1>
            <p>
              {isShared ? (
                <>
                  <strong>/i/{handle}</strong> does not exist. Shared inboxes are created from your account dashboard.
                </>
              ) : (
                <>
                  <strong>{handle}</strong> is not registered yet. Claim it to start receiving encrypted drops.
                </>
              )}
            </p>
          </div>
          <a className="create-btn" href={isShared ? '/app/inbox' : '/register'}>
            {isShared ? 'Open dashboard' : 'Create account'}
          </a>
        </div>
      </div>
    </div>
  );
}
