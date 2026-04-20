import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../ui/ThemeToggle';
import './TopBar.css';

export default function TopBar({ title, showBack = false, rightSlot }) {
  const navigate = useNavigate();

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
      </div>
    </header>
  );
}
