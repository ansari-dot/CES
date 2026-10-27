import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ParentProvider } from './context/ParentContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ParentProvider>
        <App />
      </ParentProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
