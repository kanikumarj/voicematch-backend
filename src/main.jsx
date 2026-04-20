import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/globals.css';

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UnhandledRejection]', event.reason);
});

// ─── Mount ────────────────────────────────────────────────────────────────
const FallbackUI = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100dvh',
    background: '#0A0A0A', color: '#F9FAFB',
    fontFamily: 'Inter, system-ui, sans-serif', gap: '1rem',
  }}>
    <span style={{ fontSize: 48 }}>🎙️</span>
    <h2 style={{ fontSize: 20, fontWeight: 700 }}>Something went wrong</h2>
    <button
      onClick={() => window.location.reload()}
      style={{
        padding: '12px 28px', borderRadius: '999px',
        background: '#7C3AED', border: 'none',
        color: '#fff', cursor: 'pointer',
        fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
      }}
    >
      Reload App
    </button>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<FallbackUI />}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
