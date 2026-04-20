import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../lib/socket';
import AppShell from '../../components/layout/AppShell';
import TopBar from '../../components/layout/TopBar';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { SkeletonChatItem } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import './FriendsPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

export default function FriendsPage() {
  const { token } = useAuth();
  const navigate  = useNavigate();
  const toast     = useToast();
  const [params]  = useSearchParams();

  const [tab,      setTab]     = useState(params.get('tab') || 'friends');
  const [data,     setData]    = useState({ friends: [], pendingReceived: [], pendingSent: [] });
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState('');
  const [friendStatus, setFriendStatus] = useState({});

  useEffect(() => { fetchFriends(); }, []);

  // Listen for real-time presence updates
  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }
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
      const res = await fetch(`${API}/api/friends`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        // Populate initial statuses
        const init = {};
        json.friends.forEach(f => { if (f.status) init[f.id] = f.status; });
        setFriendStatus(init);
      }
    } catch {}
    setLoading(false);
  }

  async function acceptReq(requestId) {
    try {
      await fetch(`${API}/api/friends/requests/${requestId}/accept`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Friend added!');
      fetchFriends();
    } catch {}
  }

  async function rejectReq(requestId) {
    try {
      await fetch(`${API}/api/friends/requests/${requestId}/reject`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      });
      fetchFriends();
    } catch {}
  }

  async function unfriend(friendshipId, e) {
    e.stopPropagation();
    if (!confirm('Unfriend this person?')) return;
    try {
      await fetch(`${API}/api/friends/${friendshipId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Unfriended');
      fetchFriends();
    } catch {}
  }

  function callFriend(friendId, e) {
    e.stopPropagation();
    try { getSocket().emit('direct_call_request', { toUserId: friendId }); toast.info('Calling…'); }
    catch { toast.error('Connection error'); }
  }

  const filtered = data.friends.filter(f =>
    !search || f.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = data.pendingReceived?.length || 0;

  return (
    <AppShell badges={{ friends: pendingCount }}>
      <TopBar title="Friends" rightSlot={
        <button className="friends-req-btn" onClick={() => setTab(tab === 'received' ? 'friends' : 'received')}>
          Requests{pendingCount > 0 && <Badge count={pendingCount} />}
        </button>
      } />

      {/* ── Tabs ── */}
      <div className="friends-tabs">
        {[['friends', 'Friends'], ['received', 'Received'], ['sent', 'Sent']].map(([id, label]) => (
          <button key={id} className={`friends-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
            {id === 'received' && pendingCount > 0 && <Badge count={pendingCount} />}
          </button>
        ))}
      </div>

      {/* ── Friends tab ── */}
      {tab === 'friends' && (
        <div className="friends-content">
          <div className="friends-search-wrap">
            <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 3.5 3.5"/></svg>
            <input
              className="friends-search"
              placeholder="Search friends…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              type="search"
            />
          </div>

          {loading
            ? Array.from({ length: 5 }, (_, i) => <SkeletonChatItem key={i} />)
            : filtered.length === 0
              ? <div className="friends-empty"><span>👥</span><p>{search ? 'No matches' : 'No friends yet'}</p><p>Friends are made during voice calls!</p></div>
              : filtered.sort((a, b) => {
                  // Unread first, then by last message
                  if (b.unreadCount !== a.unreadCount) return (b.unreadCount || 0) - (a.unreadCount || 0);
                  return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
                }).map(f => {
                  const status = friendStatus[f.id] || f.status || 'offline';
                  return (
                    <div key={f.id} className="friend-item" onClick={() => navigate(`/chat/${f.friendshipId}`)}>
                      <Avatar name={f.displayName} size="md" status={status} />
                      <div className="friend-item-info">
                        <span className="friend-item-name">{f.displayName}</span>
                        <span className="friend-item-last">
                          {f.lastMessage || <em style={{ color: 'var(--text-muted)' }}>Start a conversation</em>}
                        </span>
                      </div>
                      <div className="friend-item-meta">
                        {f.lastMessageAt && <span className="friend-item-time">{timeAgo(f.lastMessageAt)}</span>}
                        {f.unreadCount > 0 && <Badge count={f.unreadCount} />}
                        <button className="friend-call-btn" onClick={e => callFriend(f.id, e)} aria-label="Call">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 5.95 5.95l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })
          }
        </div>
      )}

      {/* ── Received tab ── */}
      {tab === 'received' && (
        <div className="friends-content">
          {data.pendingReceived.length === 0
            ? <div className="friends-empty"><span>📭</span><p>No pending requests</p></div>
            : data.pendingReceived.map(req => (
                <div key={req.requestId} className="req-item">
                  <Avatar name={req.fromUser.displayName} size="md" />
                  <div className="req-info">
                    <strong>{req.fromUser.displayName}</strong>
                    <span>Connected during a call · {timeAgo(req.sentAt)}</span>
                  </div>
                  <div className="req-btns">
                    <Button size="sm" onClick={() => acceptReq(req.requestId)}>Accept</Button>
                    <Button size="sm" variant="ghost" onClick={() => rejectReq(req.requestId)}>✕</Button>
                  </div>
                </div>
              ))
          }
        </div>
      )}

      {/* ── Sent tab ── */}
      {tab === 'sent' && (
        <div className="friends-content">
          {data.pendingSent.length === 0
            ? <div className="friends-empty"><span>📤</span><p>No sent requests</p></div>
            : data.pendingSent.map(req => (
                <div key={req.requestId} className="req-item">
                  <Avatar name={req.toUser.displayName} size="md" />
                  <div className="req-info">
                    <strong>{req.toUser.displayName}</strong>
                    <span>Pending · {timeAgo(req.sentAt)}</span>
                  </div>
                  <span className="pending-pill">Pending</span>
                </div>
              ))
          }
        </div>
      )}
    </AppShell>
  );
}
