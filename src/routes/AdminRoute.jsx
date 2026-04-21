import { Navigate } from 'react-router-dom';

/**
 * AdminRoute guard — checks admin_token in localStorage.
 * Silently redirects to /login if missing. Never reveals /x-admin exists.
 */
export default function AdminRoute({ children }) {
  const token = localStorage.getItem('admin_token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Basic JWT expiry check (without verifying signature — backend verifies)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('admin_token');
      return <Navigate to="/login" replace />;
    }
  } catch {
    localStorage.removeItem('admin_token');
    return <Navigate to="/login" replace />;
  }

  return children;
}
