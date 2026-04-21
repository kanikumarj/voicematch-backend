import { useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { useToast } from '../components/ui/Toast';

export default function useFriendNotifications() {
  const toast = useToast();

  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;

    const handleFriendOnline = ({ userId, status }) => {
      toast.info(`A friend is online`);
    };

    socket.on('friend_online', handleFriendOnline);
    return () => socket.off('friend_online', handleFriendOnline);
  }, [toast]);
}
