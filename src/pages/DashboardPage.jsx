import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';
import AppShell from '../components/layout/AppShell';
import TopBar from '../components/layout/TopBar';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import CallScreen from '../modules/call/CallScreen';
import MatchChatScreen from './chat/MatchChatScreen';
import useActiveUsers from '../hooks/useActiveUsers';
import useFriendNotifications from '../hooks/useFriendNotifications';
import './DashboardPage.css';

const API = import.meta.env.VITE_API_URL;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ── App states ──────────────────────────────────────────────────────────────
// idle → searching → matched → connecting → connected → ended
// ────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, token, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [appState, setAppState]         = useState('idle');
  const [partner, setPartner]           = useState(null);
  const [isInitiator, setIsInitiator]   = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [friendsData, setFriendsData]   = useState({ friends: [], pendingReceived: [] });
  const [searchTimer, setSearchTimer]   = useState(0);
  const [noUsersAvailable, setNoUsers]  = useState(false);
  
  // Use new hooks
  const activeUsers = useActiveUsers();
  useFriendNotifications();

  const [mode, setMode] = useState(localStorage.getItem('vm_mode') || 'voice');
  const [matchMode, setMatchMode] = useState('voice'); // The mode of the found match

  const handleModeChange = (newMode) => {
    setMode(newMode);
    localStorage.setItem('vm_mode', newMode);
  };

  const timerRef      = useRef(null);
  const socketListened = useRef(false);

  // Load friends data
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/friends`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setFriendsData(d))
      .catch(() => {});
  }, [token]);

  const handleEndCall = useCallback(() => {
    setPartner(null);
    setAppState('idle');
    clearInterval(timerRef.current);
    setSearchTimer(0);
    refreshUser().catch(() => {});
  }, [refreshUser]);

  // Socket events — register once, stable reference via refs
  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;

    function onRestored({ state }) {
      setReconnecting(false);
      if (state === 'in_call') setAppState('connected');
    }
    function onMatchFound({ mode: foundMode, partnerId, partnerName, sessionId, partnerSocketId }) {
      setNoUsers(false);
      setMatchMode(foundMode || 'voice');
      setPartner({ id: partnerId, name: partnerName, sessionId, partnerSocketId });
      setAppState('matched');
    }
    function onBothReady({ initiator }) {
      setIsInitiator(initiator);
      setAppState('connecting');
    }
    function onPartnerDisconnect({ reason } = {}) {
      setPartner(null);
      if (reason === 'skip' || reason === 'exit') {
        // Partner skipped us — go back to searching automatically
        setAppState('searching');
        toast.info('Your partner moved on. Finding a new match…');
      } else if (reason === 'ready_timeout') {
        setAppState('idle');
        toast.warning('Match timed out. Try connecting again.');
      } else {
        setAppState('idle');
        if (reason !== 'skip') toast.error('Partner disconnected');
      }
    }
    function onSkipConfirmed() {
      setPartner(null);
      setAppState('searching');
    }
    function onDirectCall({ initiator }) {
      setIsInitiator(initiator);
      setAppState('connecting');
    }
    function onQueuePosition({ waiting }) {
      if (waiting && appState === 'searching') {
        setNoUsers(false); // still queued
      }
    }
    function onConnect()    { setReconnecting(false); }
    function onDisconnect() { setReconnecting(true);  }

    socket.on('session_restored',     onRestored);
    socket.on('match_found',          onMatchFound);
    socket.on('both_ready',           onBothReady);
    socket.on('partner_disconnected', onPartnerDisconnect);
    socket.on('skip_confirmed',       onSkipConfirmed);
    socket.on('direct_call_accepted', onDirectCall);
    socket.on('queue_position',       onQueuePosition);
    socket.on('connect',              onConnect);
    socket.on('disconnect',           onDisconnect);

    return () => {
      socket.off('session_restored',     onRestored);
      socket.off('match_found',          onMatchFound);
      socket.off('both_ready',           onBothReady);
      socket.off('partner_disconnected', onPartnerDisconnect);
      socket.off('skip_confirmed',       onSkipConfirmed);
      socket.off('direct_call_accepted', onDirectCall);
      socket.off('queue_position',       onQueuePosition);
      socket.off('connect',              onConnect);
      socket.off('disconnect',           onDisconnect);
    };
  }, [toast]); // stable deps only

  // Search timer
  useEffect(() => {
    if (appState === 'searching') {
      setNoUsers(false);
      timerRef.current = setInterval(() => setSearchTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setSearchTimer(0);
    }
    return () => clearInterval(timerRef.current);
  }, [appState]);

  // Show "no users available" after 30s of searching
  useEffect(() => {
    if (appState !== 'searching') return;
    const timeout = setTimeout(() => setNoUsers(true), 30_000);
    return () => clearTimeout(timeout);
  }, [appState]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  function getSocket_safe() {
    try { return getSocket(); } catch { toast.error('Connection error, please refresh'); return null; }
  }

  function joinPool() {
    const socket = getSocket_safe(); if (!socket) return;
    socket.emit('find_match', { mode });
    setAppState('searching');
    setNoUsers(false);
  }

  function leavePool() {
    const socket = getSocket_safe(); if (!socket) return;
    socket.emit('leave_pool');
    setAppState('idle');
    setNoUsers(false);
  }

  function exitAll() {
    const socket = getSocket_safe(); if (!socket) return;
    socket.emit('exit_pool');
    setPartner(null);
    setAppState('idle');
    setNoUsers(false);
  }

  function confirmReady() {
    const socket = getSocket_safe(); if (!socket) return;
    socket.emit('ready_confirm');
  }

  function skipMatch() {
    const socket = getSocket_safe(); if (!socket) return;
    socket.emit('skip');
    setPartner(null);
    setAppState('searching');
  }

  // ── Call / Chat screen ───────────────────────────────────────────────────────
  if (appState === 'connected' || appState === 'connecting') {
    if (matchMode === 'chat') {
      return (
        <MatchChatScreen
          roomId={partner?.sessionId}
          partnerName={partner?.name}
          partnerSocketId={partner?.partnerSocketId}
          partnerId={partner?.id}
        />
      );
    }

    return (
      <CallScreen
        socket={getSocket()}
        token={token}
        partnerName={partner?.name}
        partnerId={partner?.id}
        sessionId={partner?.sessionId}
        isInitiator={isInitiator}
        onCallEnd={handleEndCall}
      />
    );
  }

  const onlineFriends = friendsData.friends.filter(f => f.status === 'online');
  const pendingCount  = friendsData.pendingReceived?.length || 0;

  return (
    <AppShell badges={{ friends: pendingCount }}>
      <TopBar title="🎙️ VoiceMatch" />

      {reconnecting && (
        <div className="reconnecting-bar" role="status">↻ Reconnecting…</div>
      )}

      <div className="dash-content">
        {/* ── Greeting ── */}
        <section className="dash-greeting anim-fade-in">
          <div>
            <h2 className="dash-hello">
              {getGreeting()}, {user?.displayName || 'there'} 👋
            </h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {user?.streak_count > 1 && (
                <span className="dash-streak">🔥 {user.streak_count} day streak</span>
              )}
              {activeUsers > 0 && (
                <span style={{ fontSize: '12px', background: 'var(--surface)', padding: '4px 8px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <span className="active-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4caf50', marginRight: 4 }} />
                  {activeUsers} online
                </span>
              )}
            </div>
          </div>
          <Avatar name={user?.displayName} size="md" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }} />
        </section>

        {/* ── Connect Card ── */}
        <section className="dash-connect-card anim-fade-in">

          {/* IDLE */}
          {appState === 'idle' && (
            <div className="connect-idle">
              <h3>How do you want to connect?</h3>
              <div style={{ display: 'flex', gap: 12, margin: '20px 0', justifyContent: 'center' }}>
                <Button 
                  variant={mode === 'voice' ? 'primary' : 'outline'} 
                  onClick={() => handleModeChange('voice')}
                  style={{ flex: 1 }}
                >
                  🎙️ Voice Call
                </Button>
                <Button 
                  variant={mode === 'chat' ? 'primary' : 'outline'} 
                  onClick={() => handleModeChange('chat')}
                  style={{ flex: 1 }}
                >
                  💬 Text Chat
                </Button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                Match with {mode === 'voice' ? 'voice' : 'chat'} users only
              </p>
              <Button size="lg" fullWidth onClick={joinPool}>
                Connect Now
              </Button>
            </div>
          )}

          {/* SEARCHING */}
          {appState === 'searching' && !noUsersAvailable && (
            <div className="connect-searching">
              <div className="radar-wrap">
                <div className="radar-ring" style={{ animationDelay: '0s' }} />
                <div className="radar-ring" style={{ animationDelay: '0.5s' }} />
                <div className="radar-ring" style={{ animationDelay: '1s' }} />
                <div className="radar-core">🎙️</div>
              </div>
              <h3>Finding someone for you…</h3>
              <p className="connect-timer">Searching for {searchTimer}s</p>
              <div className="connect-action-row">
                <Button variant="ghost" onClick={leavePool}>Cancel</Button>
                <Button variant="danger" size="sm" onClick={exitAll}>Exit</Button>
              </div>
            </div>
          )}

          {/* NO USERS AVAILABLE */}
          {appState === 'searching' && noUsersAvailable && (
            <div className="connect-no-users anim-fade-in">
              <span className="no-users-icon">😴</span>
              <h3>No new users available</h3>
              <p>Everyone you've connected with recently is on cooldown.<br />Try again in a moment.</p>
              <div className="connect-action-row">
                <Button variant="ghost" onClick={exitAll}>Exit</Button>
                <Button onClick={() => { setNoUsers(false); }}>Retry</Button>
              </div>
            </div>
          )}

          {/* MATCHED */}
          {appState === 'matched' && (
            <div className="connect-matched anim-slide-up">
              <div className="match-avatar-wrap">
                <Avatar name={partner?.name} size="xl" status="online" />
              </div>
              <h3>Match found!</h3>
              <p>Connected with <strong>{partner?.name || 'someone'}</strong></p>
              <div className="connect-action-row">
                <Button variant="ghost" onClick={skipMatch}>Skip</Button>
                <Button variant="danger" size="sm" onClick={exitAll}>Exit</Button>
                <Button fullWidth onClick={confirmReady}>Ready to Talk 🎙️</Button>
              </div>
            </div>
          )}
        </section>

        {/* ── Stats Row ── */}
        <section className="dash-stats anim-fade-in">
          {[
            { label: 'Total Calls', value: user?.total_calls   ?? 0, icon: '🎙️' },
            { label: 'Friends',     value: friendsData.friends?.length ?? 0, icon: '👥' },
            { label: 'Day Streak',  value: user?.streak_count  ?? 0, icon: '🔥' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </section>

        {/* ── Online Friends ── */}
        {onlineFriends.length > 0 && (
          <section className="dash-section anim-fade-in">
            <div className="section-header">
              <h4>Friends Online</h4>
              <button className="section-more" onClick={() => navigate('/friends')}>See all</button>
            </div>
            <div className="online-friends-row">
              {onlineFriends.slice(0, 8).map(f => (
                <button
                  key={f.id}
                  className="online-friend"
                  onClick={() => navigate(`/chat/${f.friendshipId}`)}
                  aria-label={`Chat with ${f.displayName}`}
                >
                  <Avatar name={f.displayName} size="md" status="online" />
                  <span className="online-friend-name">{f.displayName?.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Pending Requests ── */}
        {pendingCount > 0 && (
          <section className="dash-section anim-fade-in">
            <div className="pending-card" onClick={() => navigate('/friends?tab=received')}>
              <span className="pending-icon">👥</span>
              <div>
                <strong>{pendingCount} friend request{pendingCount > 1 ? 's' : ''} waiting</strong>
                <p>Tap to view and respond</p>
              </div>
              <span className="pending-arrow">›</span>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
