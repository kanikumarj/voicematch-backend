import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../components/ui/Toast';

export default function useFriendNotifications() {
  const { socket } = useSocket();
  const toast = useToast();

  useEffect(() => {
    if (!socket) return;

    const handleFriendOnline = ({ userId, status }) => {
      // Find a way to get the friend's name, or just display "A friend is online"
      toast.info(`A friend is online`);
    };

    socket.on('friend_online', handleFriendOnline);
    return () => socket.off('friend_online', handleFriendOnline);
  }, [socket, toast]);
}
