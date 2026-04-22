import React from 'react';
import useFriendStatus from '../../hooks/useFriendStatus';

const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return 'last seen recently';
  const diff = Date.now() - new Date(lastSeen).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `last seen ${mins}m ago`;
  if (hours < 24) return `last seen ${hours}h ago`;
  if (days === 1) return 'last seen yesterday';
  return `last seen ${days} days ago`;
};

/**
 * OnlineStatus — Displays real-time online status or last seen time in chat header.
 */
const OnlineStatus = ({ friendId }) => {
  const { isOnline, lastSeen } = useFriendStatus(friendId);
  
  return (
    <span style={{
      fontSize: '12px',
      fontWeight: '500',
      color: isOnline ? 'var(--success)' : 'var(--text-muted)',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }}>
      {isOnline ? (
        <>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
          Online
        </>
      ) : (
        formatLastSeen(lastSeen)
      )}
    </span>
  );
};

export default OnlineStatus;
