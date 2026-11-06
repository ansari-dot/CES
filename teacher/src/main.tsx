import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';
import './index.css';

// Security: Aggressively purge any legacy auth tokens or storage secrets
if (typeof window !== 'undefined' && window.localStorage) {
  try {
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

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <App />
  </Provider>
);
