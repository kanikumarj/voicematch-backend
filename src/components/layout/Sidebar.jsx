import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import './Sidebar.css';

/**
 * Sidebar — Desktop-only persistent left navigation.
 * Collapses to 72px icon-only, expands to 240px on hover.
 * Props:
 *   pendingCount — friend request badge count
 *   unreadCount  — total unread message badge count
 */
export default function Sidebar({ pendingCount = 0, unreadCount = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const { pathname } = useLocation();
  const { logout } = useAuth();

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      path: '/dashboard',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      id: 'friends',
      label: 'Friends',
      path: '/friends',
      badge: pendingCount,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'connect',
      label: 'Connect',
      path: '/dashboard',
      isCTA: true,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      ),
    },
    {
      id: 'messages',
      label: 'Messages',
      path: '/messages',
      badge: unreadCount,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      path: '/profile',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ];

  function isActive(item) {
    if (item.isCTA) return false;
    if (item.path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(item.path);
  }

  return (
    <nav
      className={`sidebar ${expanded ? 'expanded' : ''}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">🎙️</span>
        <span className="sidebar-logo-text">VoiceMatch</span>
      </div>

      {/* Nav items */}
      <div className="sidebar-nav">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={`sidebar-item ${active ? 'active' : ''} ${item.isCTA ? 'cta' : ''}`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <div className="sidebar-icon">
                {item.icon}
              </div>

              {/* Label */}
              {item.isCTA
                ? <span className="sidebar-cta-label">{item.label}</span>
                : <span className="sidebar-label">{item.label}</span>
              }

              {/* Badge */}
              {item.badge > 0 && (
                <span className="sidebar-badge">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}

              {/* Tooltip (visible only in collapsed mode) */}
              {!item.isCTA && (
                <span className="sidebar-tooltip">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="sidebar-spacer" />

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-item">
          <ThemeToggle />
          <span className="sidebar-footer-label">Theme</span>
        </div>
        <button className="sidebar-footer-item sidebar-logout" onClick={logout} aria-label="Logout" title="Logout">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span className="sidebar-footer-label">Logout</span>
        </button>
      </div>
    </nav>
  );
}
