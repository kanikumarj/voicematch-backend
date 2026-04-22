import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../lib/socket';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import StreakBadge from '../../components/ui/StreakBadge';
import { useToast } from '../../components/ui/Toast';
import './FriendProfilePage.css';

const API = import.meta.env.VITE_API_URL;

export default function FriendProfilePage() {
  const { userId } = useParams();
  const { token }  = useAuth();
  const navigate   = useNavigate();
  const toast      = useToast();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [friendship, setFriendship] = useState(null);

  useEffect(() => {
    if (!userId || !token) return;
    setLoading(true);

    // Try to get the friend's profile from the friends list
    fetch(`${API}/api/friends`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.friends) {
          const friend = d.friends.find(f => f.id === userId);
          if (friend) {
            setProfile({
              displayName: friend.displayName,
              id: friend.id,
              status: friend.status || 'offline',
              total_calls: friend.totalCalls,
              avg_rating: friend.avgRating,
              streak_count: friend.streakCount,
            });
            setFriendship(friend.friendshipId);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, token]);

  function callFriend() {
    try {
      getSocket().emit('direct_call_request', { toUserId: userId });
      toast.info('Calling…');
    } catch {
      toast.error('Connection error');
    }
  }

  async function unfriend() {
    if (!friendship) return;
    if (!confirm('Are you sure you want to unfriend?')) return;
    try {
      await fetch(`${API}/api/friends/${friendship}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Unfriended');
      navigate('/friends');
    } catch {
      toast.error('Failed to unfriend');
    }
  }

  if (loading) {
    return (
      <div className="fp-loading">
        <div className="fp-spinner" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fp-loading">
        <p>User not found</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="friend-profile-page">
      {/* Header */}
      <header className="fp-header">
        <button className="fp-back" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="fp-header-title">Profile</span>
        <div style={{ width: 32 }} />
      </header>

      <div className="fp-body">
        {/* Hero section */}
        <div className="fp-hero">
          <Avatar name={profile.displayName} size="xl" status={profile.status} />
          <h2 className="fp-name">{profile.displayName}</h2>
          <span className={`fp-status fp-status-${profile.status}`}>
            {profile.status === 'online' ? '🟢 Online' :
             profile.status === 'in_call' ? '🟣 In a call' :
             '⚫ Offline'}
          </span>
          {profile.streak_count > 0 && <StreakBadge streak={profile.streak_count} />}
        </div>

        {/* Stats */}
        <div className="fp-stats">
          <div className="fp-stat">
            <span className="fp-stat-value">{profile.total_calls ?? 0}</span>
            <span className="fp-stat-label">Calls</span>
          </div>
          <div className="fp-stat">
            <span className="fp-stat-value">{profile.avg_rating ? `${profile.avg_rating}★` : '—'}</span>
            <span className="fp-stat-label">Avg Rating</span>
          </div>
          <div className="fp-stat">
            <span className="fp-stat-value">{profile.streak_count ?? 0}</span>
            <span className="fp-stat-label">Streak</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="fp-actions">
          <Button fullWidth onClick={() => navigate(`/chat/${friendship}`)}>
            💬 Send Message
          </Button>
          <Button fullWidth variant="secondary" onClick={callFriend}>
            📞 Voice Call
          </Button>
          <Button fullWidth variant="ghost" className="fp-unfriend-btn" onClick={unfriend}>
            🚫 Unfriend
          </Button>
        </div>
      </div>
    </div>
  );
}
