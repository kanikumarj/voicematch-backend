import { useNavigate, useLocation } from 'react-router-dom';
import Badge from '../ui/Badge';
import './BottomNav.css';

const TABS = [
  { path: '/dashboard', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>), label: 'Home', id: 'home' },
  { path: '/friends', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>), label: 'Friends', id: 'friends' },
  { path: '/connect', icon: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>), label: 'Connect', id: 'connect', isCTA: true },
  { path: '/friends?tab=chat', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>), label: 'Messages', id: 'messages' },
  { path: '/profile', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>), label: 'Profile', id: 'profile' },
];

export default function BottomNav({ badges = {} }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function isActive(tab) {
    if (tab.id === 'connect') return false; // always use dashboard for "active"
    return pathname.startsWith(tab.path.split('?')[0]);
  }

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <div className="bottom-nav-inner">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`bnav-item ${tab.isCTA ? 'bnav-cta' : ''} ${isActive(tab) ? 'bnav-active' : ''}`}
            onClick={() => navigate(tab.id === 'connect' ? '/dashboard' : tab.path)}
            aria-label={tab.label}
            aria-current={isActive(tab) ? 'page' : undefined}
          >
            <span className="bnav-icon-wrap">
              {tab.icon}
              {badges[tab.id] > 0 && (
                <span className="bnav-badge"><Badge count={badges[tab.id]} /></span>
              )}
            </span>
            {!tab.isCTA && <span className="bnav-label">{tab.label}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}
