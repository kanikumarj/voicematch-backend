import { useState, useEffect } from 'react';
import { getSocket } from '../lib/socket';

export default function useActiveUsers() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;
    
    const handleActiveUsers = ({ count }) => setCount(count);
    
    socket.on('active_users_count', handleActiveUsers);
    return () => socket.off('active_users_count', handleActiveUsers);
  }, []);

  return count;
}
