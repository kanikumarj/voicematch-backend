import { useNavigate } from 'react-router-dom';
import './NotFoundPage.css';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="nf-page">
      <div className="nf-card">
        <div className="nf-code">404</div>
        <div className="nf-emoji">🌌</div>
        <h1 className="nf-title">Page not found</h1>
        <p className="nf-sub">This page doesn't exist or was moved.</p>
        <button id="btn-go-home" className="nf-btn" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
