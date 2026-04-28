import { useState, useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';

/**
 * useFriendStatus — real-time online/offline tracking.
 * Fails silently if the status API doesn't exist.
 */
export default function useFriendStatus(friendId) {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!friendId) return;

    // Best-effort status fetch — ignore if endpoint missing
    const controller = new AbortController();
    fetch(`${import.meta.env.VITE_API_URL}/api/friends/status/${friendId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('vm_token') || localStorage.getItem('token') || ''}` },
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!mountedRef.current || !d) return;
        setIsOnline(!!d.isOnline);
        setLastSeen(d.lastSeen || null);
      })
      .catch(() => {}); // silently ignore 404 / network errors

    // Real-time socket updates
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;

    const onStatusChange = ({ userId, isOnline: online, lastSeen: ls }) => {
      if (String(userId) === String(friendId) && mountedRef.current) {
        setIsOnline(!!online); setLastSeen(ls || null);
      }
    };
    const onOnline = ({ userId }) => {
      if (String(userId) === String(friendId) && mountedRef.current) setIsOnline(true);
    };
    const onOffline = ({ userId }) => {
      if (String(userId) === String(friendId) && mountedRef.current) {
        setIsOnline(false); setLastSeen(new Date().toISOString());
      }
    };

    socket.on('friend_status_change', onStatusChange);
    socket.on('friend_online',        onOnline);
    socket.on('friend_offline',       onOffline);

    return () => {
      controller.abort();
      socket.off('friend_status_change', onStatusChange);
      socket.off('friend_online',        onOnline);
      socket.off('friend_offline',       onOffline);
    };
  }, [friendId]);

  return { isOnline, lastSeen };
}
