import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../lib/socket';
import Avatar from '../../components/ui/Avatar';
import StatusDot from '../../components/ui/StatusDot';
import { useToast } from '../../components/ui/Toast';
import { useKeyboard } from '../../hooks/useKeyboard';
import './ChatPage.css';

const API = import.meta.env.VITE_API_URL;

function isSameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function dateLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today))     return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
  const { friendshipId } = useParams();
  const { user, token }  = useAuth();
  const navigate         = useNavigate();
  const toast            = useToast();
  const { keyboardHeight } = useKeyboard();

  const [messages, setMessages]     = useState([]);
  const [text, setText]             = useState('');
  const [typing, setTyping]         = useState(false);
  const [friendInfo, setFriendInfo] = useState(null);
  const [friendStatus, setFStatus]  = useState('offline');
  const [showScrollBtn, setScroll]  = useState(false);
  const [loading, setLoading]       = useState(true);

  const endRef      = useRef(null);
  const areaRef     = useRef(null);
  const typingTimer = useRef(null);
  const tempCounter = useRef(0);
  const prevMsgLen  = useRef(0); // FIXED 4E: track previous length to avoid scroll loop

  // ── Load friend info + messages ─────────────────────────────────────────────
  useEffect(() => {
    if (!token || !friendshipId) return;
    setLoading(true);

    // Load messages
    fetch(`${API}/api/chat/${friendshipId}/messages?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.messages) setMessages(d.messages);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Load friend profile — try dedicated endpoint, fallback to friends list
    fetch(`${API}/api/friends/${friendshipId}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setFriendInfo(d);
          setFStatus(d.status || 'offline');
        }
      })
      .catch(() => {
        // Fallback: get from /api/friends list
        fetch(`${API}/api/friends`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            const friend = d?.friends?.find(f => f.friendshipId === friendshipId);
            if (friend) {
              setFriendInfo({ displayName: friend.displayName, id: friend.id });
              setFStatus(friend.status || 'offline');
            }
          })
          .catch(() => {});
      });
  }, [friendshipId, token]);

  // ── Socket listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }

    socket.emit('chat_mark_read', { friendshipId });

    function onMessage({ message }) {
      if (String(message.friendshipId) === String(friendshipId)) {
        setMessages(p => [...p, message]);
        socket.emit('chat_mark_read', { friendshipId });
        scrollToBottom();
      }
    }
    function onConfirm({ tempId, messageId, sentAt }) {
      setMessages(p => p.map(m => m.id === tempId ? { ...m, id: messageId, sentAt, pending: false } : m));
    }
    function onTyping()     { setTyping(true);  }
    function onStopTyping() { setTyping(false); }
    function onDeleted({ messageId }) {
      setMessages(p => p.map(m => m.id === messageId ? { ...m, isDeleted: true, content: '' } : m));
    }
    function onRemoved() { toast.info('You are no longer friends'); navigate('/friends'); }
    function onFriendOnline({ userId }) {
      if (friendInfo?.id === userId) setFStatus('online');
    }
    function onFriendOffline({ userId }) {
      if (friendInfo?.id === userId) setFStatus('offline');
    }
    function onStatusChange({ userId, status }) {
      if (friendInfo?.id === userId) setFStatus(status);
    }

    socket.on('chat_message_received',  onMessage);
    socket.on('chat_message_confirmed', onConfirm);
    socket.on('friend_typing',          onTyping);
    socket.on('friend_stopped_typing',  onStopTyping);
    socket.on('message_deleted',        onDeleted);
    socket.on('friend_removed',         onRemoved);
    socket.on('friend_online',          onFriendOnline);
    socket.on('friend_offline',         onFriendOffline);
    socket.on('friend_status_change',   onStatusChange);

    return () => {
      socket.off('chat_message_received',  onMessage);
      socket.off('chat_message_confirmed', onConfirm);
      socket.off('friend_typing',          onTyping);
      socket.off('friend_stopped_typing',  onStopTyping);
      socket.off('message_deleted',        onDeleted);
      socket.off('friend_removed',         onRemoved);
      socket.off('friend_online',          onFriendOnline);
      socket.off('friend_offline',         onFriendOffline);
      socket.off('friend_status_change',   onStatusChange);
    };
  }, [friendshipId, friendInfo?.id, navigate, toast]);

  function scrollToBottom(force = false) {
    endRef.current?.scrollIntoView({ behavior: force ? 'auto' : 'smooth' });
  }

  // FIXED 4E: Only scroll when a genuinely new message arrives (length grew).
  // Separating 'fetch messages' and 'scroll on new message' prevents the loop
  // where scrollToBottom → render → scrollToBottom → …
  useEffect(() => {
    if (messages.length > prevMsgLen.current) {
      scrollToBottom();
      prevMsgLen.current = messages.length;
    }
  }, [messages.length]);

  // Scroll when the typing indicator appears so it's always visible
  useEffect(() => {
    if (typing) scrollToBottom();
  }, [typing]);

  function handleScroll() {
    const el = areaRef.current;
    if (!el) return;
    setScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 300);
  }

  function handleSend(e) {
    e?.preventDefault();
    const content = text.trim();
    if (!content) return;

    let socket;
    try { socket = getSocket(); } catch { return; }

    const tempId = `temp_${++tempCounter.current}`;
    setMessages(p => [...p, {
      id: tempId, senderId: user?.id, content,
      sentAt: new Date().toISOString(), isDeleted: false, pending: true,
    }]);
    setText('');
    scrollToBottom();

    socket.emit('chat_send_message', { friendshipId, content, tempId });
    socket.emit('chat_typing_stop',  { friendshipId });
    clearTimeout(typingTimer.current);
  }

  function handleTyping(e) {
    setText(e.target.value);
    let socket;
    try { socket = getSocket(); } catch { return; }
    socket.emit('chat_typing_start', { friendshipId });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      try { getSocket().emit('chat_typing_stop', { friendshipId }); } catch {}
    }, 3000);
  }

  function callFriend() {
    try { getSocket().emit('direct_call_request', { toUserId: friendInfo?.id }); toast.info('Calling…'); }
    catch { toast.error('Connection error'); }
  }

  // Group messages by day for date separators
  const grouped = [];
  messages.forEach((m, i) => {
    if (i === 0 || !isSameDay(messages[i - 1].sentAt, m.sentAt)) {
      grouped.push({ type: 'separator', label: dateLabel(m.sentAt), key: `sep-${i}` });
    }
    grouped.push(m);
  });

  const friendName = friendInfo?.displayName || friendInfo?.display_name || '…';

  return (
    <div className="chat-page" style={{ paddingBottom: keyboardHeight || 0 }}>
      {/* ── Sticky Header ── */}
      <header className="chat-header">
        <button className="chat-back" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div className="chat-header-info">
          <Avatar name={friendName} size="sm" status={friendStatus} />
          <div className="chat-header-text">
            <strong className="chat-header-name">{friendName}</strong>
            <span className="chat-header-status">
              <StatusDot status={friendStatus} />
              {friendStatus === 'online' ? ' Online'
                : friendStatus === 'in_call' ? ' In a call'
                : ' Offline'}
            </span>
          </div>
        </div>

        <button className="chat-call-btn" onClick={callFriend} aria-label="Voice call" title="Voice call">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 5.95 5.95l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </button>
      </header>

      {/* ── Message Area ── */}
      <div className="chat-messages" ref={areaRef} onScroll={handleScroll}>
        {loading && (
          <div className="chat-loading">
            <span>Loading messages…</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="chat-empty">
            <Avatar name={friendName} size="lg" />
            <p>Start a conversation with <strong>{friendName}</strong></p>
            <span>Say hello! 👋</span>
          </div>
        )}

        {grouped.map(item => {
          if (item.type === 'separator') {
            return (
              <div key={item.key} className="chat-date-sep">
                <span>{item.label}</span>
              </div>
            );
          }

          const isOwn = item.senderId === user?.id;
          return (
            <div key={item.id} className={`chat-bubble-wrap ${isOwn ? 'own' : 'friend'}`}>
              <div className={`chat-bubble ${item.isDeleted ? 'deleted' : ''} ${item.pending ? 'pending' : ''}`}>
                {item.isDeleted
                  ? <em className="deleted-msg">🚫 Message deleted</em>
                  : <span>{item.content}</span>
                }
                <span className="chat-time">
                  {fmtTime(item.sentAt)}
                  {item.pending && ' ⏱'}
                </span>
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="chat-bubble-wrap friend">
            <div className="chat-bubble typing-bubble">
              <span className="typing-dots">
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* ── Scroll FAB ── */}
      {showScrollBtn && (
        <button className="scroll-fab" onClick={() => scrollToBottom()} aria-label="Scroll to bottom">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}

      {/* ── Input Bar ── */}
      <form className="chat-input-bar" onSubmit={handleSend}>
        <div className="chat-input-wrap">
          <input
            className="chat-input"
            placeholder="Message…"
            value={text}
            onChange={handleTyping}
            maxLength={1000}
            autoComplete="off"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e); }}
          />
          {text.length > 900 && (
            <span className="char-count">{text.length}/1000</span>
          )}
        </div>
        <button
          type="submit"
          className={`chat-send-btn ${text.trim() ? 'active' : ''}`}
          disabled={!text.trim()}
          aria-label="Send"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
