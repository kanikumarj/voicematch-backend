import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSocket } from '../../lib/socket'
import { useAuth } from '../../context/AuthContext'
import useOnlineStats from '../../hooks/useOnlineStats'
import './MatchChatScreen.css'

const API = import.meta.env.VITE_API_URL;

const MatchChatScreen = ({ roomId, partnerName, partnerSocketId, partnerId, mode = 'chat' }) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const onlineStats = useOnlineStats()

  const [messages, setMessages]           = useState([])
  const [inputText, setInputText]         = useState('')
  const [friendState, setFriendState]     = useState('none')
  // 'none' | 'pending' | 'accepted' | 'already'
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [isEnded, setIsEnded]             = useState(false)
  const [chatDuration, setChatDuration]   = useState(0)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  const messagesEndRef = useRef(null)
  const typingTimeout  = useRef(null)
  const timerRef       = useRef(null)
  const inputRef       = useRef(null)

  let socket;
  try { socket = getSocket(); } catch { socket = null; }

  // ── Check if already friends on mount
  useEffect(() => {
    if (!partnerId) return;
    const token = localStorage.getItem('vm_token');
    if (!token) return;

    fetch(`${API}/api/friends/check/${partnerId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.isFriend) setFriendState('already')
      })
      .catch(() => {});

    // Start duration timer
    timerRef.current = setInterval(() => {
      setChatDuration(s => s + 1)
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [partnerId])

  // ── Auto scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Socket event listeners
  useEffect(() => {
    if (!socket) return

    const onMessage = ({ text, fromSocketId, timestamp }) => {
      setMessages(prev => [...prev, {
        id: `${Date.now()}_${Math.random()}`,
        text,
        fromMe: false,
        timestamp: timestamp || Date.now()
      }])
    }

    const onTyping = ({ fromSocketId }) => {
      if (fromSocketId !== socket.id) {
        setPartnerTyping(true)
        clearTimeout(typingTimeout.current)
        typingTimeout.current = setTimeout(() => setPartnerTyping(false), 2000)
      }
    }

    const onEnded = () => {
      setIsEnded(true)
      clearInterval(timerRef.current)
      addSystemMsg(`${partnerName || 'Partner'} has left the chat.`)
    }

    // Friend request confirmations
    const onConfirm = () => {
      // Backend confirmed request was sent
    }

    const onAlreadyFriends = () => {
      setFriendState('already')
      addSystemMsg('You are already friends! 🎉')
    }

    const onFriendshipCreated = ({ friendshipId }) => {
      setFriendState('accepted')
      addSystemMsg(`🎉 You and ${partnerName || 'they'} are now friends!`)
    }

    const onFriendRequestReceived = ({ fromUser }) => {
      if (fromUser?.id === partnerId) {
        addSystemMsg(`${fromUser.displayName || partnerName} sent you a friend request`, 'request', fromUser.id)
      }
    }

    socket.on('match_message', onMessage)
    socket.on('match_typing', onTyping)
    socket.on('match_ended', onEnded)
    socket.on('friend_request_sent_confirm', onConfirm)
    socket.on('already_friends', onAlreadyFriends)
    socket.on('friendship_created', onFriendshipCreated)
    socket.on('friend_request_received', onFriendRequestReceived)

    return () => {
      socket.off('match_message', onMessage)
      socket.off('match_typing', onTyping)
      socket.off('match_ended', onEnded)
      socket.off('friend_request_sent_confirm', onConfirm)
      socket.off('already_friends', onAlreadyFriends)
      socket.off('friendship_created', onFriendshipCreated)
      socket.off('friend_request_received', onFriendRequestReceived)
      clearTimeout(typingTimeout.current)
    }
  }, [socket, partnerId, partnerName])

  const addSystemMsg = (text, type = 'info', fromId = null) => {
    setMessages(prev => [...prev, {
      id: `sys_${Date.now()}_${Math.random()}`,
      text, isSystem: true,
      systemType: type, fromId,
      timestamp: Date.now()
    }])
  }

  const formatDuration = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // ── Send message
  const sendMessage = () => {
    const text = inputText.trim()
    if (!text || isEnded || !socket) return

    setMessages(prev => [...prev, {
      id: `${Date.now()}_${Math.random()}`,
      text, fromMe: true,
      timestamp: Date.now()
    }])

    socket.emit('match_message', {
      roomId,
      targetSocketId: partnerSocketId,
      text
    })

    setInputText('')
    inputRef.current?.focus()
  }

  // ── Typing indicator
  const handleTyping = (e) => {
    setInputText(e.target.value)
    socket?.emit('match_typing', { roomId, targetSocketId: partnerSocketId })
  }

  // ── FIXED: Add friend via socket with correct parameter names
  const addFriend = () => {
    if (friendState !== 'none' || !partnerId || !socket) return
    setFriendState('pending')

    // Backend expects: { toUserId, sessionId }
    // NOT: { targetUserId, targetSocketId }
    socket.emit('send_friend_request', {
      toUserId: partnerId,
      sessionId: roomId  // roomId is the sessionId from matchmaking
    })

    addSystemMsg('Friend request sent! ✓')
  }

  // ── End chat with confirmation
  const endChat = () => {
    if (chatDuration > 30 && friendState === 'none') {
      setShowEndConfirm(true)
    } else {
      confirmEnd()
    }
  }

  const confirmEnd = () => {
    socket?.emit('match_end', { roomId, targetSocketId: partnerSocketId })
    clearInterval(timerRef.current)
    navigate('/feedback', {
      state: { partnerId, partnerName, duration: chatDuration, source: mode }
    })
  }

  // ── Accept incoming friend request
  const acceptRequest = (requestFromId) => {
    // Use respond_friend_request socket event (already built in backend)
    // But we don't have the requestId here — emit accept via alternate path
    socket?.emit('send_friend_request', {
      toUserId: requestFromId,
      sessionId: roomId
    })
    // Backend auto-accepts mutual requests, so this creates a friendship
  }

  // ── Friend state badge
  const FriendButton = () => {
    if (friendState === 'already' || friendState === 'accepted') return (
      <div className="match-friend-badge match-friend-badge--connected">
        <span>{friendState === 'accepted' ? '🎉' : '✓'}</span>
        {friendState === 'accepted' ? 'Connected!' : 'Friends'}
      </div>
    )
    if (friendState === 'pending') return (
      <div className="match-friend-badge match-friend-badge--pending">
        ✓ Sent
      </div>
    )
    return (
      <button onClick={addFriend} className="match-friend-btn" disabled={isEnded}>
        <span>👋</span> Add Friend
      </button>
    )
  }

  return (
    <div className="match-chat-page">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="match-chat-header">
        <div className="match-header-left">
          {/* Avatar with status ring */}
          <div className="match-avatar-wrap">
            <div className="match-avatar">
              {(partnerName || 'S')[0].toUpperCase()}
            </div>
            <div className={`match-avatar-dot ${isEnded ? 'offline' : 'online'}`} />
          </div>

          {/* Info */}
          <div className="match-header-info">
            <div className="match-header-name">
              {partnerName || 'Stranger'}
            </div>
            <div className="match-header-meta">
              <span className="match-stranger-pill">👤 Stranger</span>
              <span className="match-timer">⏱ {formatDuration(chatDuration)}</span>
              {partnerTyping && <span className="match-typing-label">typing...</span>}
            </div>
          </div>
        </div>

        <div className="match-header-actions">
          <FriendButton />
          <button onClick={endChat} className="match-end-btn">
            End
          </button>
        </div>
      </header>

      {/* ── PRIVACY NOTICE (empty state) ──────────────────────── */}
      {messages.length === 0 && (
        <div className="match-privacy-notice">
          <div className="match-privacy-icon">🔒</div>
          <div className="match-privacy-title">Anonymous conversation</div>
          <div className="match-privacy-desc">
            Messages disappear when chat ends. Add as friend to keep in touch.
          </div>
        </div>
      )}

      {/* ── MESSAGES AREA ─────────────────────────────────────── */}
      <div className="match-messages">
        {messages.map(msg => {
          if (msg.isSystem) return (
            <div key={msg.id} className="match-system-msg-wrap">
              <div className="match-system-msg">{msg.text}</div>
              {msg.systemType === 'request' && msg.fromId && (
                <div className="match-system-actions">
                  <button className="match-accept-btn" onClick={() => acceptRequest(msg.fromId)}>
                    Accept
                  </button>
                  <button className="match-decline-btn">
                    Decline
                  </button>
                </div>
              )}
            </div>
          )

          return (
            <div key={msg.id} className={`match-bubble-wrap ${msg.fromMe ? 'own' : 'other'}`}>
              <div className={`match-bubble ${msg.fromMe ? 'own' : 'other'}`}>
                <div className="match-bubble-text">{msg.text}</div>
                <div className="match-bubble-time">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          )
        })}

        {/* Typing indicator */}
        {partnerTyping && (
          <div className="match-bubble-wrap other">
            <div className="match-bubble other match-typing-bubble">
              <span className="typing-dots"><span /><span /><span /></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── INPUT BAR ─────────────────────────────────────────── */}
      <div className="match-input-bar">
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={handleTyping}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          disabled={isEnded}
          placeholder={isEnded ? 'Chat ended' : 'Message...'}
          rows={1}
          className="match-input"
        />
        <button
          onClick={sendMessage}
          disabled={!inputText.trim() || isEnded}
          className={`match-send-btn ${inputText.trim() && !isEnded ? 'active' : ''}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      {/* ── END CONFIRM MODAL ─────────────────────────────────── */}
      {showEndConfirm && (
        <div className="match-modal-overlay">
          <div className="match-modal">
            <div className="match-modal-emoji">👋</div>
            <div className="match-modal-title">End this chat?</div>
            <div className="match-modal-desc">
              You've been chatting for {formatDuration(chatDuration)}.
              Add {partnerName || 'them'} as a friend to keep in touch!
            </div>

            {friendState === 'none' && (
              <button
                onClick={() => { addFriend(); setShowEndConfirm(false) }}
                className="match-modal-add-btn"
              >
                👋 Add Friend First
              </button>
            )}

            <div className="match-modal-actions">
              <button onClick={() => setShowEndConfirm(false)} className="match-modal-cancel">
                Keep Chatting
              </button>
              <button onClick={confirmEnd} className="match-modal-end">
                End Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MatchChatScreen
