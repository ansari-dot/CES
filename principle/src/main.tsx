import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Security: Aggressively purge any legacy auth tokens, session keys, or database dumps from browser storage
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const legacyKeys = [
      'iqra_principal_portal_auth_token_v1',
      'iqra_principal_portal_remember_email',
      'iqra_principal_portal_db_clean_v4',
    ];
    legacyKeys.forEach((k) => window.localStorage.removeItem(k));
    Object.keys(window.localStorage).forEach((k) => {
      if (
        k.startsWith('iqra_') ||
        k.toLowerCase().includes('token') ||
        k.toLowerCase().includes('auth')
      ) {
        window.localStorage.removeItem(k);
      }
    });
    window.sessionStorage.clear();
  } catch (_) {}
}

createRoot(document.getElementById('root')!).render(<App />);
