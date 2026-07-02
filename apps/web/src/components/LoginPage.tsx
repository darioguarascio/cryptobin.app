import AuthPanel from '@/components/AuthPanel';
import { Lock } from 'lucide-react';
import CipherHeroCanvas from './CipherHeroCanvas';
import ThemeSwitcher from './ThemeSwitcher';

export default function LoginPage() {
  return (
    <div className="page">
      <CipherHeroCanvas />
      <div className="page-inner page-inner-narrow">
        <header className="top-bar" style={{ marginBottom: 24, borderRadius: 12 }}>
          <div className="top-bar-logo">
            <Lock size={16} />
            CryptoBin
          </div>
          <div className="top-bar-actions">
            <ThemeSwitcher />
          </div>
        </header>
        <AuthPanel
          initialMode="login"
          onAuthenticated={() => {
            window.location.assign('/app/inbox');
          }}
        />
      </div>
    </div>
  );
}
