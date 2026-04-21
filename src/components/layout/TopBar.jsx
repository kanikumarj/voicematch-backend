import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import './TopBar.css';

export default function TopBar({ title, showBack = false, rightSlot }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        {showBack
          ? <button className="top-bar-back" onClick={() => navigate(-1)} aria-label="Go back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          : null
        }
        <span className="top-bar-title">{title}</span>
      </div>
      <div className="top-bar-right">
        {rightSlot}
        <ThemeToggle />
        {/* FIXED: Logout button — was completely missing */}
        <button
          className="top-bar-back"
          onClick={logout}
          aria-label="Logout"
          title="Logout"
          style={{ marginLeft: 4 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
