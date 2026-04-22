import { useState, useEffect } from 'react';
import { getSocket } from '../lib/socket';

/**
 * useOnlineStats — Listens for real-time online stats from backend.
 * Returns: { total, voice, chat }
 *   total — total connected users
 *   voice — number searching for voice calls
 *   chat  — number searching for text chat
 */
export default function useOnlineStats() {
  const [stats, setStats] = useState({ total: 0, voice: 0, chat: 0 });

  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;

    const handleStats = (data) => setStats(data);

    // Listen for new online_stats event
    socket.on('online_stats', handleStats);

    // Also keep backward compat with existing active_users_count
    const handleLegacy = ({ count }) => {
      setStats(prev => ({ ...prev, total: count }));
    };
    socket.on('active_users_count', handleLegacy);

    return () => {
      socket.off('online_stats', handleStats);
      socket.off('active_users_count', handleLegacy);
    };
  }, []);

  return stats;
}
