import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { getSocket } from '../../lib/socket';
import Avatar from '../../components/ui/Avatar';
import MessageStatus from '../../components/chat/MessageStatus';
import OnlineStatus from '../../components/chat/OnlineStatus';
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
  const { clearUnread }  = useNotifications();
  const navigate         = useNavigate();
  const { state }        = useLocation();
  const toast            = useToast();
  const { keyboardHeight } = useKeyboard();

  const [messages, setMessages]     = useState([]);
  const [text, setText]             = useState('');
  const [typing, setTyping]         = useState(false);
  const [friendInfo, setFriendInfo] = useState(state?.friend || null);
  const [showScrollBtn, setScroll]  = useState(false);
  const [loading, setLoading]       = useState(!state?.friend);

  const endRef      = useRef(null);
  const areaRef     = useRef(null);
  const typingTimer = useRef(null);
  const tempCounter = useRef(0);
  const prevMsgLen  = useRef(0);

  // ── Load friend info + messages ─────────────────────────────────────────────
  useEffect(() => {
    if (!token || !friendshipId) return;
    setLoading(true);

    // Clear unread for this friend instantly
    clearUnread(friendshipId);

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

    // Load friend profile — always fetch fresh data for id + online status
    fetch(`${API}/api/friends/${friendshipId}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setFriendInfo(prev => ({ ...prev, ...d }));
      })
      .catch(() => {
        // Fallback: get from /api/friends list
        fetch(`${API}/api/friends`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            const friend = d?.friends?.find(f => String(f.friendshipId) === String(friendshipId));
            if (friend) setFriendInfo(prev => ({
              ...prev, displayName: friend.displayName, id: friend.id
            }));
          })
          .catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [friendshipId, token, clearUnread]);

  // ── Socket listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;

    // Tell backend user is viewing this conversation
    socket.emit('viewing_conversation', { friendshipId });

    function onNewMessage(msg) {
      if (String(msg.friendshipId) === String(friendshipId)) {
        setMessages(p => {
          const exists = p.some(m => m.id === msg.id || m.tempId === msg.tempId);
          if (exists) {
            return p.map(m => (m.tempId === msg.tempId || m.id === msg.id) ? { ...msg, fromMe: m.fromMe } : m);
          }
          return [...p, { ...msg, fromMe: false }];
        });
        socket.emit('chat_mark_read', { friendshipId });
      }
    }

    function onMessageDelivered({ messageId, friendshipId: fId }) {
      if (String(fId) === String(friendshipId)) {
        setMessages(p => p.map(m => m.id === messageId ? { ...m, status: 'delivered' } : m));
      }
    }

    function onMessagesRead({ friendshipId: fId }) {
      if (String(fId) === String(friendshipId)) {
        setMessages(p => p.map(m => m.senderId === user?.id ? { ...m, status: 'read' } : m));
      }
    }

    function onConfirm({ tempId, messageId, sentAt, status }) {
      setMessages(p => p.map(m => m.id === tempId ? { ...m, id: messageId, sentAt, pending: false, status: status || 'sent' } : m));
    }

    function onTyping()     { setTyping(true);  }
    function onStopTyping() { setTyping(false); }
    function onDeleted({ messageId }) {
      setMessages(p => p.map(m => m.id === messageId ? { ...m, isDeleted: true, content: '' } : m));
    }
    function onRemoved() { toast.info('You are no longer friends'); navigate('/friends'); }

    socket.on('new_message',            onNewMessage);
    socket.on('message_delivered',      onMessageDelivered);
    socket.on('messages_read',          onMessagesRead);
    socket.on('chat_message_confirmed', onConfirm);
    socket.on('friend_typing',          onTyping);
    socket.on('friend_stopped_typing',  onStopTyping);
    socket.on('message_deleted',        onDeleted);
    socket.on('friend_removed',         onRemoved);

    return () => {
      socket.off('new_message',            onNewMessage);
      socket.off('message_delivered',      onMessageDelivered);
      socket.off('messages_read',          onMessagesRead);
      socket.off('chat_message_confirmed', onConfirm);
      socket.off('friend_typing',          onTyping);
      socket.off('friend_stopped_typing',  onStopTyping);
      socket.off('message_deleted',        onDeleted);
      socket.off('friend_removed',         onRemoved);
    };
  }, [friendshipId, user?.id, navigate, toast]);

  function scrollToBottom(force = false) {
    endRef.current?.scrollIntoView({ behavior: force ? 'auto' : 'smooth' });
  }

  useEffect(() => {
    if (messages.length > prevMsgLen.current) {
      scrollToBottom();
      prevMsgLen.current = messages.length;
    }
  }, [messages.length]);

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
      id: tempId, tempId, senderId: user?.id, content,
      sentAt: new Date().toISOString(), isDeleted: false, pending: true, status: 'sending', fromMe: true
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

  const grouped = [];
  messages.forEach((m, i) => {
    if (i === 0 || !isSameDay(messages[i - 1].sentAt, m.sentAt)) {
      grouped.push({ type: 'separator', label: dateLabel(m.sentAt), key: `sep-${i}` });
    }
    grouped.push(m);
  });

  const friendName = friendInfo?.displayName || friendInfo?.display_name || (loading ? '…' : 'Friend');

  return (
    <div className="chat-page" style={{ paddingBottom: keyboardHeight || 0 }}>
      {/* Header */}
      <header className="chat-header">
        <button className="chat-back" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div className="chat-header-info">
          <div className="chat-header-avatar-wrap">
            <Avatar name={friendName} size="sm" />
            {friendInfo?.id && (
              <span className={`chat-header-dot ${friendInfo?.isOnline ? 'online' : 'offline'}`} />
            )}
          </div>
          <div className="chat-header-text">
            <strong className="chat-header-name">{friendName}</strong>
            <div className="chat-header-status">
              {typing
                ? <span style={{ color: 'var(--accent-primary)', fontStyle: 'italic' }}>typing...</span>
                : friendInfo?.id
                  ? <OnlineStatus friendId={friendInfo.id} />
                  : loading
                    ? <span style={{ color: 'var(--text-muted)' }}>loading…</span>
                    : null
              }
            </div>
          </div>
        </div>

        <button className="chat-call-btn" onClick={callFriend} aria-label="Voice call">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 5.95 5.95l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </button>
      </header>

      {/* Messages Area */}
      <div className="chat-messages" ref={areaRef} onScroll={handleScroll}>
        {loading && <div className="chat-loading"><span>Loading messages…</span></div>}

        {!loading && messages.length === 0 && (
          <div className="chat-empty">
            <Avatar name={friendName} size="lg" />
            <p>Start a conversation with <strong>{friendName}</strong></p>
          </div>
        )}

        {grouped.map(item => {
          if (item.type === 'separator') {
            return <div key={item.key} className="chat-date-sep"><span>{item.label}</span></div>;
          }

          const isOwn = item.senderId === user?.id || item.fromMe;
          return (
            <div key={item.id} className={`chat-bubble-wrap ${isOwn ? 'own' : 'friend'}`}>
              <div className={`chat-bubble ${item.isDeleted ? 'deleted' : ''} ${item.pending ? 'pending' : ''}`}>
                {item.isDeleted ? <em className="deleted-msg">🚫 Message deleted</em> : <span>{item.content || item.text}</span>}
                <div className="chat-time-wrap">
                  <span className="chat-time">{fmtTime(item.sentAt || item.createdAt)}</span>
                  {isOwn && <MessageStatus status={item.status} />}
                </div>
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="chat-bubble-wrap friend">
            <div className="chat-bubble typing-bubble">
              <span className="typing-dots"><span /><span /><span /></span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {showScrollBtn && (
        <button className="scroll-fab" onClick={() => scrollToBottom()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}

      {/* Input Bar */}
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
        </div>
        <button type="submit" className={`chat-send-btn ${text.trim() ? 'active' : ''}`} disabled={!text.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
