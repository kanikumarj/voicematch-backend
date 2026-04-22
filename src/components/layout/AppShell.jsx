import { useNotifications } from '../../context/NotificationContext';
import { useMobile } from '../../hooks/useMobile';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import './AppShell.css';

/**
 * AppShell — wraps all authenticated pages
 * Mobile  (< 768px): bottom nav
 * Desktop (≥ 768px): left sidebar
 */
export default function AppShell({ children }) {
  const { isMobile } = useMobile();
  const { totalUnread, pendingRequests } = useNotifications();

  const badgeData = {
    messages: totalUnread,
    friends: pendingRequests
  };

  return (
    <div className="app-shell">
      {/* Desktop sidebar — hidden on mobile via CSS */}
      {!isMobile && (
        <Sidebar
          pendingCount={pendingRequests}
          unreadCount={totalUnread}
        />
      )}

      <main className="app-shell-main">
        {children}
      </main>

      {/* Mobile bottom nav — hidden on desktop via CSS */}
      <BottomNav badges={badgeData} />
    </div>
  );
}
