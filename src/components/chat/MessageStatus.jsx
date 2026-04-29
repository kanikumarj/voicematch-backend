// FIX: [Area 4] MessageStatus — Enhanced delivery status ticks
// Single grey ✓ = sent, Double grey ✓✓ = delivered, Double blue ✓✓ = read
// Redesigned with SVG checkmarks for crystal-clear visibility on all backgrounds

import React from 'react';

const Tick = ({ color = 'currentColor', size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DoubleTick = ({ color = 'currentColor', size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 8.5L5.5 12L12 4.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 8.5L11.5 12L18 4.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Clock = ({ color = 'currentColor', size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.5" />
    <path d="M8 4.5V8L10.5 9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MessageStatus = ({ status }) => {
  if (status === 'sending') return (
    <span className="msg-status msg-status--sending" title="Sending...">
      <Clock color="rgba(255,255,255,0.45)" />
    </span>
  );

  if (status === 'sent') return (
    <span className="msg-status msg-status--sent" title="Sent">
      <Tick color="rgba(255,255,255,0.55)" />
    </span>
  );

  if (status === 'delivered') return (
    <span className="msg-status msg-status--delivered" title="Delivered">
      <DoubleTick color="rgba(255,255,255,0.55)" />
    </span>
  );

  if (status === 'read') return (
    <span className="msg-status msg-status--read" title="Read">
      <DoubleTick color="#34D399" />
    </span>
  );

  return null;
};

export default MessageStatus;
