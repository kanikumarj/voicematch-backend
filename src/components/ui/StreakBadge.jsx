import { useState, useEffect } from 'react';
import './StreakBadge.css';

const MILESTONES = [3, 7, 14, 30];

export default function StreakBadge({ streak }) {
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (MILESTONES.includes(streak)) {
      setShowCelebration(true);
      const id = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(id);
    }
  }, [streak]);

  if (!streak || streak === 0) return null;

  return (
    <>
      <div className="streak-badge" title={`${streak} day streak`}>
        <span className="streak-fire">🔥</span>
        <span className="streak-count">{streak}</span>
      </div>

      {showCelebration && (
        <div className="streak-celebration" role="status">
          🔥 {streak} Day Streak! Keep it up.
        </div>
      )}
    </>
  );
}
