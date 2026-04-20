import { useState, useEffect } from 'react';
import '../auth/AuthPages.css';

const API = import.meta.env.VITE_API_URL;

export default function VerifyEmail() {
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token found. Please use the link from your email.');
      return;
    }

    (async () => {
      try {
        const res  = await fetch(`${API}/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const body = await res.json();
        if (res.ok) {
          setStatus('success');
          setMessage(body.message || 'Your email has been verified!');
        } else {
          setStatus('error');
          setMessage(body.error || 'Verification failed. The link may have expired.');
        }
      } catch {
        setStatus('error');
        setMessage('Network error. Please try again.');
      }
    })();
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className={`verify-icon ${status}`}>
          {status === 'verifying' && <span className="spinner-lg" />}
          {status === 'success'   && '✅'}
          {status === 'error'     && '❌'}
        </div>
        <h1 className="auth-title">
          {status === 'verifying' && 'Verifying your email…'}
          {status === 'success'   && 'Email Verified!'}
          {status === 'error'     && 'Verification Failed'}
        </h1>
        <p className="auth-subtitle">{message}</p>
        {status !== 'verifying' && (
          <a href="/login" className="auth-btn" id="btn-go-login">
            {status === 'success' ? 'Go to Login' : 'Back to Login'}
          </a>
        )}
      </div>
    </div>
  );
}
