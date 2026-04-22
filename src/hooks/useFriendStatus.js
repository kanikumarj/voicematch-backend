import { useState, useEffect } from 'react';
import { getSocket } from '../lib/socket';
import api from '../lib/api';

/**
 * useFriendStatus — Hook to track a friend's online status and last seen time.
 * Listens for live socket updates via friend_status_change, friend_online, friend_offline.
 */
export default function useFriendStatus(friendId) {
  const [status, setStatus] = useState({ isOnline: false, lastSeen: null });

  useEffect(() => {
    if (!friendId) return;

    // 1. Initial fetch
    api.get(`/api/users/${friendId}/status`)
      .then(res => setStatus(res.data))
      .catch(() => {});

    // 2. Listen for live changes
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;

    const onStatusChange = ({ userId, isOnline, lastSeen }) => {
      if (String(userId) === String(friendId)) {
        setStatus({ isOnline, lastSeen });
      }
    };

    const onFriendOnline = ({ userId }) => {
      if (String(userId) === String(friendId)) {
        setStatus({ isOnline: true, lastSeen: new Date().toISOString() });
      }
    };

    const onFriendOffline = ({ userId }) => {
      if (String(userId) === String(friendId)) {
        setStatus({ isOnline: false, lastSeen: new Date().toISOString() });
      }
    };

    socket.on('friend_status_change', onStatusChange);
    socket.on('friend_online', onFriendOnline);
    socket.on('friend_offline', onFriendOffline);

    return () => {
      socket.off('friend_status_change', onStatusChange);
      socket.off('friend_online', onFriendOnline);
      socket.off('friend_offline', onFriendOffline);
    };
  }, [friendId]);

  return status;
}
