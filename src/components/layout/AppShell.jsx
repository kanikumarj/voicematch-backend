import { useMobile } from '../../hooks/useMobile';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import './AppShell.css';

/**
 * AppShell — wraps all authenticated pages
 * Mobile  (< 768px): bottom nav
 * Desktop (≥ 768px): left sidebar
 */
export default function AppShell({ children, badges = {} }) {
  const { isMobile } = useMobile();

  return (
    <div className="app-shell">
      {/* Desktop sidebar — hidden on mobile via CSS */}
      {!isMobile && (
        <Sidebar
          pendingCount={badges.friends || 0}
          unreadCount={badges.messages || 0}
        />
      )}

      <main className="app-shell-main">
        {children}
      </main>

      {/* Mobile bottom nav — hidden on desktop via CSS */}
      <BottomNav badges={badges} />
    </div>
  );
}
