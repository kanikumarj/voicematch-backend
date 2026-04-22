import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../lib/socket';
import './NotificationContext.css';

const NotificationContext = createContext(null);

/**
 * NotificationProvider — manages real-time notification state.
 * Tracks:
 *   - unreadMessages: { [friendId]: count }
 *   - pendingRequests: number
 * Exposes methods to clear unread counts.
 */
export function NotificationProvider({ children }) {
  const [unreadMessages, setUnreadMessages] = useState({});
  const [pendingRequests, setPendingRequests] = useState(0);
  const [toasts, setToasts] = useState([]);
  const toastCounter = useRef(0);

  // ── Show notification toast ────────────────────────────────────────────────
  const showToast = useCallback((toast) => {
    const id = ++toastCounter.current;
    const duration = toast.duration || 5000;
    setToasts(prev => [...prev.slice(-2), { ...toast, id, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;

    // New message from friend
    const onNewMessage = ({ fromId, fromName, preview }) => {
      setUnreadMessages(prev => ({
        ...prev,
        [fromId]: (prev[fromId] || 0) + 1
      }));
      showToast({
        type: 'message',
        title: fromName,
        body: preview || 'Sent you a message',
        avatar: fromName?.[0] || '?',
        duration: 5000,
      });
    };

    // Friend request received
    const onFriendRequest = ({ fromId, fromName }) => {
      setPendingRequests(c => c + 1);
      showToast({
        type: 'friend_request',
        title: 'New friend request',
        body: `${fromName || 'Someone'} wants to connect`,
        avatar: '👥',
        duration: 8000,
      });
    };

    // Friend request accepted
    const onFriendAccepted = ({ fromName }) => {
      showToast({
        type: 'success',
        title: 'Request accepted!',
        body: `You and ${fromName || 'them'} are now friends`,
        avatar: '✓',
        duration: 5000,
      });
    };

    // Friend came online
    const onFriendOnline = ({ name, userId }) => {
      if (name) {
        showToast({
          type: 'online',
          title: `${name} is online`,
          body: 'Tap to start a chat',
          avatar: name[0],
          duration: 3000,
        });
      }
    };

    socket.on('new_message', onNewMessage);
    socket.on('friend_request_received', onFriendRequest);
    socket.on('friend_request_accepted_notify', onFriendAccepted);
    socket.on('friend_online', onFriendOnline);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('friend_request_received', onFriendRequest);
      socket.off('friend_request_accepted_notify', onFriendAccepted);
      socket.off('friend_online', onFriendOnline);
    };
  }, [showToast]);

  // ── Clear methods ──────────────────────────────────────────────────────────
  const clearUnread = useCallback((friendId) => {
    setUnreadMessages(prev => {
      const next = { ...prev };
      delete next[friendId];
      return next;
    });
  }, []);

  const clearAllUnread = useCallback(() => {
    setUnreadMessages({});
  }, []);

  const totalUnread = Object.values(unreadMessages).reduce((a, b) => a + b, 0);

  const value = {
    unreadMessages,
    pendingRequests,
    setPendingRequests,
    clearUnread,
    clearAllUnread,
    totalUnread,
    showToast,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {/* Notification Toast Stack */}
      <NotificationToastStack toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside <NotificationProvider>');
  return ctx;
}

// ── Toast Stack Component ──────────────────────────────────────────────────
function NotificationToastStack({ toasts, onDismiss }) {
  return (
    <div className="notif-toast-stack">
      {toasts.map(toast => (
        <NotificationToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── Single Toast Item ──────────────────────────────────────────────────────
function NotificationToastItem({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setExiting(true);
    }, (toast.duration || 5000) - 200);
    return () => clearTimeout(exitTimer);
  }, [toast.duration]);

  const typeColors = {
    message: 'var(--accent-primary)',
    friend_request: '#8B5CF6',
    success: 'var(--success)',
    online: 'var(--online-dot)',
  };

  const accentColor = typeColors[toast.type] || 'var(--accent-primary)';

  return (
    <div
      className={`notif-toast ${exiting ? 'notif-toast-exit' : ''}`}
      onClick={() => onDismiss(toast.id)}
      role="alert"
    >
      {/* Avatar */}
      <div className="notif-toast-avatar" style={{ background: accentColor }}>
        {toast.type === 'friend_request' ? '👥' :
         toast.type === 'online' ? '🟢' :
         toast.type === 'success' ? '✓' :
         toast.avatar || '💬'}
      </div>

      {/* Content */}
      <div className="notif-toast-content">
        <span className="notif-toast-title">{toast.title}</span>
        <span className="notif-toast-body">{toast.body}</span>
      </div>

      {/* Dismiss */}
      <button
        className="notif-toast-close"
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
        aria-label="Dismiss"
      >
        ✕
      </button>

      {/* Progress bar */}
      <div
        className="notif-toast-progress"
        style={{
          background: accentColor,
          animationDuration: `${toast.duration || 5000}ms`,
        }}
      />
    </div>
  );
}
