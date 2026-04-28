// NEW: FriendRequestButton — extracted for call screen secondary row

import { useState, useEffect } from 'react';
import { getSocket } from '../../lib/socket';

export default function FriendRequestButton({ partner, sessionId, buttonOnly = false }) {
  const [friendState, setFriendState] = useState('idle');
  // idle | sent | friends

  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket || !partner?.id) return;

    // Check if already friends
    const token = localStorage.getItem('vm_token');
    if (token) {
      fetch(`${import.meta.env.VITE_API_URL}/api/friends/check/${partner.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => { if (data.isFriend) setFriendState('friends'); })
        .catch(() => {});
    }

    const onSent    = () => setFriendState('sent');
    const onCreated = () => setFriendState('friends');
    const onAlready = () => setFriendState('friends');

    socket.on('friend_request_sent_confirm', onSent);
    socket.on('friendship_created', onCreated);
    socket.on('already_friends', onAlready);

    return () => {
      socket.off('friend_request_sent_confirm', onSent);
      socket.off('friendship_created', onCreated);
      socket.off('already_friends', onAlready);
    };
  }, [partner?.id]);

  const handleSend = () => {
    if (friendState !== 'idle') return;
    let socket;
    try { socket = getSocket(); } catch { return; }
    socket.emit('send_friend_request', { toUserId: partner?.id, sessionId });
  };

  const isSent = friendState === 'sent';
  const isFriend = friendState === 'friends';
  const isActive = isSent || isFriend;

  if (buttonOnly) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px'
      }}>
        <button
          onClick={handleSend}
          disabled={isActive}
          style={{
            width: '56px', height: '56px',
            borderRadius: '50%', border: 'none',
            background: isFriend
              ? 'rgba(16,185,129,0.2)'
              : isSent
                ? 'rgba(16,185,129,0.12)'
                : 'rgba(255,255,255,0.1)',
            color: isActive ? '#10B981' : 'var(--text-primary)',
            fontSize: '22px', cursor: isActive ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            border: isActive
              ? '1px solid rgba(16,185,129,0.3)'
              : '1px solid var(--border-subtle)',
            opacity: isActive ? 0.8 : 1,
            transition: 'all 0.2s'
          }}
        >
          {isFriend ? '✓' : '👤'}
        </button>
        <span style={{
          color: isActive ? '#10B981' : 'var(--text-secondary)',
          fontSize: '11px', fontWeight: '500'
        }}>
          {isFriend ? 'Friends' : isSent ? 'Sent' : 'Add'}
        </span>
      </div>
    );
  }

  return null;
}
