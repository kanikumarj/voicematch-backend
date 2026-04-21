import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth(); // Assuming useAuth provides setUser. If not, useAuth's refreshUser can be called.

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      navigate('/login?error=google_failed');
      return;
    }
    
    if (token) {
      localStorage.setItem('vm_token', token);
      api.get('/api/auth/me')
        .then(res => {
          const freshUser = res.user || res;
          localStorage.setItem('vm_user', JSON.stringify(freshUser));
          // If useAuth needs to be notified we can trigger a reload or context update
          // navigate will trigger a re-render
          window.location.href = '/dashboard';
        })
        .catch(() => {
          navigate('/login?error=google_fetch_failed');
        });
    } else {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <span className="btn-spinner" style={{ borderColor: 'var(--primary)', width: 40, height: 40, borderWidth: 4 }}></span>
      <p style={{ marginTop: 16 }}>Signing you in...</p>
    </div>
  );
}
