import './Skeleton.css';

export function SkeletonLine({ width = '100%', height = 14, rounded = false }) {
  return (
    <div
      className="skeleton-line"
      style={{ width, height, borderRadius: rounded ? 999 : 6 }}
    />
  );
}

export function SkeletonAvatar({ size = 44 }) {
  return (
    <div className="skeleton-line" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />
  );
}

export function SkeletonChatItem() {
  return (
    <div className="skeleton-chat-item">
      <SkeletonAvatar size={44} />
      <div className="skeleton-chat-info">
        <SkeletonLine width="40%" height={13} />
        <SkeletonLine width="70%" height={11} />
      </div>
    </div>
  );
}
