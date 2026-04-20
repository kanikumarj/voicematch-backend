import './StatusDot.css';

export default function StatusDot({ status = 'offline', className = '' }) {
  return <span className={`status-dot status-${status} ${className}`} aria-label={status} />;
}
