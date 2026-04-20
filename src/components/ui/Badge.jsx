import './Badge.css';
export default function Badge({ count = 0, max = 99 }) {
  if (!count) return null;
  return (
    <span className="badge" aria-label={`${count} notifications`}>
      {count > max ? `${max}+` : count}
    </span>
  );
}
