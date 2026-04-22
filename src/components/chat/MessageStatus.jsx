import React from 'react';

/**
 * MessageStatus — Displays delivery status ticks for friend chat messages.
 * statuses: 'sending' | 'sent' | 'delivered' | 'read'
 */
const MessageStatus = ({ status }) => {
  if (status === 'sending') return (
    <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '4px' }} title="Sending...">
      ⏱
    </span>
  );
  
  if (status === 'sent') return (
    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '4px' }} title="Sent">
      ✓
    </span>
  );
  
  if (status === 'delivered') return (
    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '4px' }} title="Delivered">
      ✓✓
    </span>
  );
  
  if (status === 'read') return (
    <span style={{ color: 'var(--info)', fontSize: '11px', marginLeft: '4px' }} title="Read">
      ✓✓
    </span>
  );
  
  return null;
};

export default MessageStatus;
