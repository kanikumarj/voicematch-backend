import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../styles/admin.css';

// Pages
import OverviewPage  from './overview/OverviewPage';
import UsersPage     from './users/UsersPage';
import LiveCallsPage from './calls/LiveCallsPage';
import ReportsPage   from './reports/ReportsPage';
import BannedPage    from './banned/BannedPage';
import AnalyticsPage from './analytics/AnalyticsPage';
import SystemPage    from './system/SystemPage';
// NEW: [Feature 5] Announcements
import AnnouncementsPage from './announcements/AnnouncementsPage';

const NAV_ITEMS = [
  { key: 'overview',  icon: '📊', label: 'Overview' },
  { key: 'users',     icon: '👥', label: 'Users' },
  { key: 'calls',     icon: '🎙️', label: 'Live Calls' },
  { key: 'reports',   icon: '🚨', label: 'Reports' },
  { key: 'banned',    icon: '🔇', label: 'Banned Users' },
  { key: 'analytics', icon: '📈', label: 'Analytics' },
  { key: 'system',    icon: '⚙️',  label: 'System' },
  // NEW: [Feature 5] Announcements
  { key: 'announcements', icon: '📣', label: 'Announcements' },
];

const PAGE_MAP = {
  overview:  OverviewPage,
  users:     UsersPage,
  calls:     LiveCallsPage,
  reports:   ReportsPage,
  banned:    BannedPage,
  analytics: AnalyticsPage,
  system:    SystemPage,
  // NEW: [Feature 5] Announcements
  announcements: AnnouncementsPage,
};

export default function AdminShell() {
  const [activePage, setActivePage] = useState('overview');
  const navigate = useNavigate();

  const ActiveComponent = PAGE_MAP[activePage] || OverviewPage;

  function handleLogout() {
    localStorage.removeItem('admin_token');
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span>🛡️</span>
          <div>
            <h2>VoiceMatch</h2>
            <small>Admin Console</small>
          </div>
        </div>

        <nav className="admin-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={`admin-nav-item ${activePage === item.key ? 'active' : ''}`}
              onClick={() => setActivePage(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="admin-nav-logout">
          <button className="admin-nav-item" onClick={handleLogout}>
            <span className="nav-icon">🚪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main">
        <header className="admin-header">
          <h1>{NAV_ITEMS.find(n => n.key === activePage)?.label || 'Admin'}</h1>
          <div className="admin-header-meta">
            <span>🛡️ Superadmin</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </header>
        <div className="admin-content">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}
