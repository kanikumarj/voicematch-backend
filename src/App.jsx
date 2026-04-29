import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth }     from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider, ToastBridge } from './components/ui/Toast';
import ProtectedRoute  from './routes/ProtectedRoute';
import PublicOnlyRoute from './routes/PublicOnlyRoute';
import GlobalCallManager from './components/GlobalCallManager';

// ── Pages ──────────────────────────────────────────────────────────────────
import LoginPage      from './pages/auth/LoginPage';
import RegisterPage   from './pages/auth/RegisterPage';
import OnboardingPage from './pages/auth/OnboardingPage';
import VerifyEmail    from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword  from './pages/auth/ResetPassword';
import DashboardPage  from './pages/DashboardPage';
import FriendsPage    from './pages/friends/FriendsPage';
import ChatPage       from './pages/chat/ChatPage';
import MessagesPage   from './pages/messages/MessagesPage';
import ProfilePage    from './pages/profile/ProfilePage';
import FriendProfilePage from './pages/profile/FriendProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminShell     from './pages/admin/AdminShell';
import SecretAdminRoute from './routes/AdminRoute';
import NotFoundPage   from './pages/NotFoundPage';
// NEW: [Feature 4] Public profile
import PublicProfilePage from './pages/profile/PublicProfilePage';
// Google OAuth callback
import GoogleCallbackPage from './pages/auth/GoogleCallbackPage';

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const { token } = useAuth();

  return (
    <ThemeProvider>
      <ToastProvider>
        <ToastBridge />
        <BrowserRouter>
          <NotificationProvider>
            <GlobalCallManager>
              <Routes>
                {/* Root */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* Public only */}
                <Route path="/login"    element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
                <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

                {/* Always public */}
                <Route path="/verify-email"    element={<VerifyEmail />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password"  element={<ResetPassword />} />

                {/* Google OAuth callback — receives token from backend */}
                <Route path="/auth/callback" element={<GoogleCallbackPage />} />

                {/* NEW: [Feature 4] Public profile — no auth */}
                <Route path="/u/:username" element={<PublicProfilePage />} />

                {/* Onboarding (protected, bypass onboarded check) */}
                <Route path="/onboarding" element={
                  <ProtectedRoute requireOnboarded={false}><OnboardingPage /></ProtectedRoute>
                } />

                {/* Protected pages */}
                <Route path="/dashboard" element={
                  <ProtectedRoute><DashboardPage /></ProtectedRoute>
                } />

                <Route path="/friends" element={
                  <ProtectedRoute><FriendsPage /></ProtectedRoute>
                } />

                <Route path="/messages" element={
                  <ProtectedRoute><MessagesPage /></ProtectedRoute>
                } />

                <Route path="/chat/:friendshipId" element={
                  <ProtectedRoute><ChatPage /></ProtectedRoute>
                } />

                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage token={token} onBack={() => window.history.back()} />
                  </ProtectedRoute>
                } />

                <Route path="/profile/:userId" element={
                  <ProtectedRoute><FriendProfilePage /></ProtectedRoute>
                } />

                {/* Admin */}
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <AdminRoute><AdminDashboard token={token} /></AdminRoute>
                  </ProtectedRoute>
                } />

                {/* Secret Admin — no links point here */}
                <Route path="/x-admin" element={
                  <SecretAdminRoute><AdminShell /></SecretAdminRoute>
                } />

                {/* 404 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </GlobalCallManager>
          </NotificationProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
