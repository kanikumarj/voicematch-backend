import { createContext, useContext, useState, useCallback, useRef, useId } from 'react';
import './Toast.css';

const ToastContext = createContext(null);
const MAX_TOASTS = 3;

const ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

function ToastItem({ toast, onRemove }) {
  return (
    <div
      className={`toast toast-${toast.type}`}
      role="alert"
      aria-live="polite"
    >
      <span className="toast-icon">{ICONS[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={() => onRemove(toast.id)} aria-label="Dismiss">✕</button>
      <div className="toast-progress" />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++counterRef.current;
    setToasts(prev => {
      const next = [...prev, { id, message, type }];
      return next.slice(-MAX_TOASTS);
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const api = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error',   dur),
    warning: (msg, dur) => addToast(msg, 'warning',  dur),
    info:    (msg, dur) => addToast(msg, 'info',     dur),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}

/* Legacy singleton for non-hook usage (modules/matchmaking etc.) */
let _toastApi = null;
export function ToastBridge() {
  const api = useToast();
  _toastApi = api;
  return null;
}

export const toast = {
  success: (...a) => _toastApi?.success(...a),
  error:   (...a) => _toastApi?.error(...a),
  warning: (...a) => _toastApi?.warning(...a),
  info:    (...a) => _toastApi?.info(...a),
};
