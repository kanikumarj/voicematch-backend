import React, { useState, useEffect } from 'react';

/**
 * ToastStack — Displays a list of real-time notification toasts.
 * Positioned fixed at the top-right of the screen.
 */
export const ToastStack = ({ toasts, onDismiss }) => (
  <div style={{
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: 'min(360px, calc(100vw - 32px))',
    pointerEvents: 'none'
  }}>
    {toasts.map(toast => (
      <ToastItem
        key={toast.id}
        toast={toast}
        onDismiss={() => onDismiss(toast.id)}
      />
    ))}
  </div>
);

/**
 * ToastItem — Single notification toast with progress bar.
 */
const ToastItem = ({ toast, onDismiss }) => {
  const [progress, setProgress] = useState(100);
  const duration = toast.duration || 5000;

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [duration]);

  return (
    <div
      onClick={() => {
        toast.onClick?.();
        onDismiss();
      }}
      style={{
        pointerEvents: 'all',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '14px',
        padding: '12px 14px',
        cursor: toast.onClick ? 'pointer' : 'default',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        overflow: 'hidden',
        animation: 'slide-in-right 120ms ease',
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
      }}
    >
      {/* Avatar */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: toast.avatarColor || 'var(--accent-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: '700',
        fontSize: '16px',
        flexShrink: 0
      }}>
        {toast.avatar}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: '600',
          color: 'var(--text-primary)',
          fontSize: '13px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {toast.title}
        </div>
        <div style={{
          color: 'var(--text-secondary)',
          fontSize: '12px',
          marginTop: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {toast.body}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '16px',
          padding: '4px',
          flexShrink: 0
        }}
      >
        ×
      </button>

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: '3px',
        width: `${progress}%`,
        background: 'var(--accent-primary)',
        transition: 'width 50ms linear',
        borderRadius: '0 0 14px 14px'
      }} />
    </div>
  );
};
