import React from 'react';
import useFriendStatus from '../../hooks/useFriendStatus';

const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return 'last seen recently';
  const diff = Date.now() - new Date(lastSeen).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
};

/**
 * OnlineStatus — Displays real-time online status or last seen time in chat header.
 * Premium Apple-style indicator with animated dot.
 */
const OnlineStatus = ({ friendId }) => {
  const { isOnline, lastSeen } = useFriendStatus(friendId);
  
  if (isOnline) {
    return (
      <span style={{
        fontSize: '12px',
        fontWeight: '600',
        color: '#34D399',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        letterSpacing: '0.01em',
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#34D399',
          boxShadow: '0 0 6px rgba(52,211,153,0.5)',
          animation: 'pulse-online-dot 2s ease-in-out infinite',
          flexShrink: 0,
        }} />
        Online
      </span>
    );
  }

  return (
    <span style={{
      fontSize: '12px',
      fontWeight: '500',
      color: 'var(--text-muted)',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: 'var(--text-muted)',
        opacity: 0.5,
        flexShrink: 0,
      }} />
      {formatLastSeen(lastSeen)}
    </span>
  );
};

export default OnlineStatus;
