import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
