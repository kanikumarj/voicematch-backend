import BottomNav from './BottomNav';
import './AppShell.css';

/**
 * AppShell — wraps all authenticated pages
 * Provides mobile bottom nav + desktop sidebar stub
 */
export default function AppShell({ children, badges = {} }) {
  return (
    <div className="app-shell">
      <main className="app-shell-main">
        {children}
      </main>
      <BottomNav badges={badges} />
    </div>
  );
}
