import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext'; // Assuming socket context exists or import from lib

export default function useActiveUsers() {
  const [count, setCount] = useState(0);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    
    const handleActiveUsers = ({ count }) => setCount(count);
    
    socket.on('active_users_count', handleActiveUsers);
    return () => socket.off('active_users_count', handleActiveUsers);
  }, [socket]);

  return count;
}
