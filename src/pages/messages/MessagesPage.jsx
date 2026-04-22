import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../lib/socket';
import AppShell from '../../components/layout/AppShell';
import TopBar from '../../components/layout/TopBar';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { SkeletonChatItem } from '../../components/ui/Skeleton';
import './MessagesPage.css';

const API = import.meta.env.VITE_API_URL;

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

export default function MessagesPage() {
  const { token } = useAuth();
  const navigate  = useNavigate();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [friendStatus, setFriendStatus] = useState({});

  useEffect(() => {
    fetchFriends();
  }, []);

  // Presence updates
  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;
    const onOnline  = ({ userId }) => setFriendStatus(p => ({ ...p, [userId]: 'online' }));
    const onOffline = ({ userId }) => setFriendStatus(p => ({ ...p, [userId]: 'offline' }));
    const onChange  = ({ userId, status }) => setFriendStatus(p => ({ ...p, [userId]: status }));
    socket.on('friend_online',        onOnline);
    socket.on('friend_offline',       onOffline);
    socket.on('friend_status_change', onChange);
    return () => {
      socket.off('friend_online',        onOnline);
      socket.off('friend_offline',       onOffline);
      socket.off('friend_status_change', onChange);
    };
  }, []);

  async function fetchFriends() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setFriends(json.friends || []);
        const init = {};
        json.friends?.forEach(f => { if (f.status) init[f.id] = f.status; });
        setFriendStatus(init);
      }
    } catch {}
    setLoading(false);
  }

  // Filter and sort: search → unread first → then by last_message_at DESC
  // Online friends pinned at top with green dot
  const filtered = friends.filter(f =>
    !search || f.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const aStatus = friendStatus[a.id] || a.status || 'offline';
    const bStatus = friendStatus[b.id] || b.status || 'offline';
    // Unread first
    if ((b.unreadCount || 0) !== (a.unreadCount || 0)) {
      return (b.unreadCount || 0) - (a.unreadCount || 0);
    }
    // Online first
    const aOnline = aStatus === 'online' ? 1 : 0;
    const bOnline = bStatus === 'online' ? 1 : 0;
    if (bOnline !== aOnline) return bOnline - aOnline;
    // Then by last message time
    return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
  });

  // Only show conversations (friends who have chatted or have unread)
  const conversations = sorted.filter(f => f.lastMessage || f.unreadCount > 0);
  const noConversations = conversations.length === 0 && sorted.length > 0;

  return (
    <AppShell>
      <TopBar title="Messages" />

      <div className="messages-content">
        {/* Search */}
        <div className="messages-search-wrap">
          <svg className="messages-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 3.5 3.5"/>
          </svg>
          <input
            className="messages-search"
            placeholder="Search conversations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            type="search"
          />
        </div>

        {/* Conversation list */}
        {loading ? (
          Array.from({ length: 6 }, (_, i) => <SkeletonChatItem key={i} />)
        ) : sorted.length === 0 && !search ? (
          <div className="messages-empty">
            <span className="messages-empty-icon">💬</span>
            <h3>No conversations yet</h3>
            <p>Connect with someone and add them as a friend</p>
            <Button onClick={() => navigate('/dashboard')}>Connect Now</Button>
          </div>
        ) : sorted.length === 0 && search ? (
          <div className="messages-empty">
            <span className="messages-empty-icon">🔍</span>
            <p>No results for "{search}"</p>
          </div>
        ) : (
          <>
            {/* Show all friends as potential conversations */}
            {sorted.map(f => {
              const status = friendStatus[f.id] || f.status || 'offline';
              return (
                <div
                  key={f.id}
                  className={`msg-item ${f.unreadCount > 0 ? 'msg-unread' : ''}`}
                  onClick={() => navigate(`/chat/${f.friendshipId}`)}
                >
                  <Avatar name={f.displayName} size="md" status={status} />
                  <div className="msg-item-info">
                    <span className="msg-item-name">{f.displayName}</span>
                    <span className="msg-item-preview">
                      {f.lastMessage || <em style={{ color: 'var(--text-muted)' }}>Say hello!</em>}
                    </span>
                  </div>
                  <div className="msg-item-meta">
                    {f.lastMessageAt && (
                      <span className="msg-item-time">{timeAgo(f.lastMessageAt)}</span>
                    )}
                    {f.unreadCount > 0 && <Badge count={f.unreadCount} />}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </AppShell>
  );
}
