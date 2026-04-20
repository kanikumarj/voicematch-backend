import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * PublicOnlyRoute
 * Redirects authenticated users to /dashboard.
 * Used for login, register, etc.
 */
export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;   // Brief flash — auth revalidating

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}
