// FIX: [Area 4] MessageStatus — Enhanced delivery status ticks
// Single grey ✓ = sent, Double grey ✓✓ = delivered, Double blue ✓✓ = read

import React from 'react';

const MessageStatus = ({ status }) => {
  if (status === 'sending') return (
    <span
      style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '4px' }}
      title="Sending..."
    >
      ⏱
    </span>
  );
  
  // FIX: [Area 4] Single grey tick — sent
  if (status === 'sent') return (
    <span
      style={{
        color: 'rgba(255,255,255,0.5)',
        fontSize: '11px',
        marginLeft: '4px',
        letterSpacing: '-2px',
      }}
      title="Sent"
    >
      ✓
    </span>
  );
  
  // FIX: [Area 4] Double grey tick — delivered
  if (status === 'delivered') return (
    <span
      style={{
        color: 'rgba(255,255,255,0.5)',
        fontSize: '11px',
        marginLeft: '4px',
        letterSpacing: '-4px',
        display: 'inline-flex',
        alignItems: 'center',
      }}
      title="Delivered"
    >
      <span>✓</span><span>✓</span>
    </span>
  );
  
  // FIX: [Area 4] Double BLUE tick — read
  if (status === 'read') return (
    <span
      style={{
        color: '#60A5FA', // bright blue — visible on dark + light theme
        fontSize: '11px',
        marginLeft: '4px',
        letterSpacing: '-4px',
        display: 'inline-flex',
        alignItems: 'center',
      }}
      title="Read"
    >
      <span>✓</span><span>✓</span>
    </span>
  );
  
  return null;
};

export default MessageStatus;
