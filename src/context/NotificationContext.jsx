import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';
import { ToastStack } from '../components/notifications/ToastStack';
import './NotificationContext.css';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [unreadCounts, setUnreadCounts] = useState({});
  const [pendingRequests, setPendingRequests] = useState(0);
  const [toasts, setToasts] = useState([]);
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);

  // Keep locationRef current to avoid stale closures in socket listeners
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // ── Show notification toast ────────────────────────────────────────────────
  const addToast = useCallback((toast) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
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

  // ── Clear methods ──────────────────────────────────────────────────────────
  const clearUnread = useCallback((friendshipId) => {
    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[friendshipId];
      return next;
    });
  }, []);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;

    // NEW MESSAGE
    const onNewMessage = (msg) => {
      const { friendshipId, senderId, senderName, text } = msg;

      // Check if user is currently viewing this conversation
      const currentPath = locationRef.current.pathname;
      const isViewingChat = currentPath === `/chat/${friendshipId}`;

      if (!isViewingChat) {
        // Increment unread badge
        setUnreadCounts(prev => ({
          ...prev,
          [friendshipId]: (prev[friendshipId] || 0) + 1
        }));

        // Show notification toast
        addToast({
          type: 'message',
          title: senderName || 'New message',
          body: text?.substring(0, 60) || 'Sent a message',
          avatar: senderName?.[0]?.toUpperCase() || '?',
          avatarColor: stringToColor(senderId || friendshipId),
          onClick: () => {
            navigate(`/chat/${friendshipId}`);
            clearUnread(friendshipId);
          },
          duration: 5000
        });
      }
    };

    // FRIEND REQUEST RECEIVED
    const onFriendRequest = ({ fromId, fromName }) => {
      setPendingRequests(c => c + 1);
      addToast({
        type: 'friend_request',
        title: 'Friend request',
        body: `${fromName || 'Someone'} wants to connect`,
        avatar: '👥',
        avatarColor: '#8B5CF6',
        onClick: () => navigate('/friends'),
        duration: 8000
      });
    };

    // FRIEND REQUEST ACCEPTED
    const onFriendAccepted = ({ fromName }) => {
      addToast({
        type: 'success',
        title: 'Now connected!',
        body: `You and ${fromName || 'them'} are friends`,
        avatar: '✓',
        avatarColor: '#10B981',
        duration: 4000
      });
    };

    // FRIEND ONLINE
    const onFriendOnline = ({ name, userId }) => {
      if (name) {
        addToast({
          type: 'online',
          title: `${name} is online`,
          body: 'Tap to start chatting',
          avatar: name[0].toUpperCase(),
          avatarColor: stringToColor(userId),
          onClick: () => navigate(`/profile/${userId}`), // Navigate to profile or chat? Plan says ChatPage/userId
          duration: 3000
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
  }, [user, addToast, navigate, clearUnread]);

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <NotificationContext.Provider value={{
      unreadCounts,
      totalUnread,
      pendingRequests,
      setPendingRequests,
      clearUnread,
      addToast
    }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside <NotificationProvider>');
  return ctx;
}

// Color from string (consistent per user)
const stringToColor = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#7C3AED', '#2563EB', '#DC2626', '#059669',
    '#D97706', '#7C3AED', '#DB2777', '#0891B2'
  ];
  return colors[Math.abs(hash) % colors.length];
};
