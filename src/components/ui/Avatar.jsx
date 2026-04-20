import './Avatar.css';

/** Deterministic gradient from name string */
function nameToGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1},70%,55%), hsl(${h2},80%,45%))`;
}

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

const SIZE_MAP = { sm: 32, md: 44, lg: 56, xl: 80 };

/**
 * Avatar component
 * Props: name, size (sm|md|lg|xl), status (online|offline|in_call|searching), image?
 */
export default function Avatar({ name = '', size = 'md', status, image, className = '' }) {
  const px = SIZE_MAP[size] ?? 44;
  const fontSize = px * 0.36;

  return (
    <div
      className={`avatar avatar-${size} ${status ? `status-${status}` : ''} ${className}`}
      style={{ width: px, height: px, fontSize, background: image ? 'none' : nameToGradient(name) }}
      aria-label={name}
    >
      {image
        ? <img src={image} alt={name} className="avatar-img" />
        : <span className="avatar-initials">{getInitials(name)}</span>
      }
      {status && status !== 'offline' && (
        <span className={`avatar-status-dot dot-${status}`} />
      )}
    </div>
  );
}
