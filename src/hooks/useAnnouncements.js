// NEW: [Feature 5 — Announcement User Hook]

import { useEffect } from 'react';
import { getSocket } from '../lib/socket';

const TYPE_STYLES = {
  info:    { background: '#1E3A5F', border: '#3B82F6', color: '#93C5FD' },
  success: { background: '#064E3B', border: '#10B981', color: '#6EE7B7' },
  warning: { background: '#451A03', border: '#F59E0B', color: '#FCD34D' },
};

function showAnnouncementBanner(announcement) {
  const styles = TYPE_STYLES[announcement.type] || TYPE_STYLES.info;

  const banner = document.createElement('div');
  banner.className = 'vm-announcement-banner';
  banner.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${styles.background};
    border: 1px solid ${styles.border};
    border-radius: 14px;
    padding: 14px 20px;
    max-width: 420px;
    width: calc(100% - 32px);
    z-index: 9999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: slideDown 0.3s ease;
    font-family: Inter, system-ui, sans-serif;
  `;

  banner.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div>
        <p style="color:${styles.color};font-weight:700;font-size:14px;margin:0 0 4px">
          📣 ${announcement.title}
        </p>
        <p style="color:#E6EDF3;font-size:13px;margin:0;line-height:1.4">
          ${announcement.message}
        </p>
      </div>
      <button
        onclick="this.parentElement.parentElement.remove()"
        style="background:none;border:none;color:#9CA3AF;cursor:pointer;font-size:18px;padding:0;flex-shrink:0"
      >×</button>
    </div>
  `;

  document.body.appendChild(banner);

  // Auto remove after 8 seconds
  setTimeout(() => {
    if (banner.parentElement) {
      banner.style.animation = 'slideUp 0.3s ease';
      setTimeout(() => {
        if (banner.parentElement) banner.remove();
      }, 300);
    }
  }, 8000);
}

export default function useAnnouncements() {
  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;

    const handleAnnouncement = (announcement) => {
      showAnnouncementBanner(announcement);
    };

    socket.on('system_announcement', handleAnnouncement);

    return () => {
      socket.off('system_announcement', handleAnnouncement);
    };
  }, []);
}
