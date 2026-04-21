import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSocket } from '../../lib/socket'
import { useAuth } from '../../context/AuthContext'

const MatchChatScreen = ({ roomId, partnerName, partnerSocketId, partnerId }) => {
  const navigate = useNavigate()
  const socket = getSocket()
  const { user } = useAuth()

  const [messages, setMessages]           = useState([])
  const [inputText, setInputText]         = useState('')
  const [friendAdded, setFriendAdded]     = useState(false)
  const [friendPending, setFriendPending] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [isEnded, setIsEnded]             = useState(false)

  const messagesEndRef  = useRef(null)
  const typingTimeout   = useRef(null)
  const inputRef        = useRef(null)

  // ── Auto scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Socket event listeners
  useEffect(() => {
    if (!socket) return

    // Receive message from partner
    socket.on('match_message', ({ text, fromSocketId, timestamp }) => {
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        text,
        fromMe: false,
        timestamp: timestamp || Date.now()
      }])
    })

    // Partner typing indicator
    socket.on('match_typing', ({ fromSocketId }) => {
      if (fromSocketId !== socket.id) {
        setPartnerTyping(true)
        clearTimeout(typingTimeout.current)
        typingTimeout.current = setTimeout(() => {
          setPartnerTyping(false)
        }, 2000)
      }
    })

    // Partner ended chat
    socket.on('match_ended', () => {
      setIsEnded(true)
      setMessages(prev => [...prev, {
        id: 'ended',
        text: `${partnerName} has left the chat.`,
        isSystem: true,
        timestamp: Date.now()
      }])
    })

    // Friend request accepted
    socket.on('friend_request_accepted', ({ fromId }) => {
      if (fromId === partnerId) {
        setFriendAdded(true)
        setFriendPending(false)
      }
    })

    return () => {
      socket.off('match_message')
      socket.off('match_typing')
      socket.off('match_ended')
      socket.off('friend_request_accepted')
      clearTimeout(typingTimeout.current)
    }
  }, [socket, partnerId, partnerName])

  // ── Send message
  const sendMessage = () => {
    const text = inputText.trim()
    if (!text || isEnded) return

    // Optimistic UI — show immediately
    setMessages(prev => [...prev, {
      id: Date.now(),
      text,
      fromMe: true,
      timestamp: Date.now()
    }])

    // Emit to backend — relay to partner
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
    socket.emit('match_typing', {
      roomId,
      targetSocketId: partnerSocketId
    })
  }

  // ── Send on Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── End chat
  const endChat = () => {
    socket.emit('match_end', { roomId, targetSocketId: partnerSocketId })
    navigate('/feedback', {
      state: { partnerId, partnerName, source: 'chat' }
    })
  }

  // ── Add friend
  const addFriend = () => {
    if (friendAdded || friendPending) return
    socket.emit('send_friend_request', {
      targetUserId: partnerId,
      targetSocketId: partnerSocketId
    })
    setFriendPending(true)
    setMessages(prev => [...prev, {
      id: 'friend-req',
      text: 'Friend request sent!',
      isSystem: true,
      timestamp: Date.now()
    }])
  }

  // ── Format timestamp
  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      background: 'var(--bg-primary)',
      maxWidth: '600px',
      margin: '0 auto'
    }}>

      {/* ── HEADER */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        {/* Partner info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'var(--accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '700', fontSize: '16px'
          }}>
            {partnerName?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{
              fontWeight: '600',
              color: 'var(--text-primary)',
              fontSize: '15px'
            }}>
              {partnerName || 'Stranger'}
            </div>
            <div style={{
              fontSize: '12px',
              color: partnerTyping
                ? 'var(--accent-primary)'
                : 'var(--text-muted)'
            }}>
              {partnerTyping ? 'typing...' : 'Connected'}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Add Friend button */}
          {!friendAdded && (
            <button
              onClick={addFriend}
              disabled={friendPending || isEnded}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: 'none',
                background: friendPending
                  ? 'var(--bg-tertiary)'
                  : 'var(--accent-primary)',
                color: friendPending
                  ? 'var(--text-muted)'
                  : 'white',
                fontSize: '13px',
                fontWeight: '600',
                cursor: friendPending ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {friendPending ? '✓ Sent' : '+ Add Friend'}
            </button>
          )}

          {friendAdded && (
            <span style={{
              padding: '8px 14px',
              borderRadius: '20px',
              background: 'var(--success)',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              ✓ Friends
            </span>
          )}

          {/* End chat button */}
          <button
            onClick={endChat}
            style={{
              padding: '8px 14px',
              borderRadius: '20px',
              border: 'none',
              background: 'var(--error)',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            End
          </button>
        </div>
      </div>

      {/* ── MESSAGES AREA */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            marginTop: '40px',
            fontSize: '14px'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <div>Say hi to {partnerName}!</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              This conversation is private
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => {
          if (msg.isSystem) return (
            <div key={msg.id} style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
              padding: '4px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '12px',
              alignSelf: 'center',
              maxWidth: '80%'
            }}>
              {msg.text}
            </div>
          )

          return (
            <div key={msg.id} style={{
              display: 'flex',
              justifyContent: msg.fromMe ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                maxWidth: '72%',
                padding: '10px 14px',
                borderRadius: msg.fromMe
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px',
                background: msg.fromMe
                  ? 'var(--accent-primary)'
                  : 'var(--bg-tertiary)',
                color: msg.fromMe
                  ? 'white'
                  : 'var(--text-primary)',
                fontSize: '15px',
                lineHeight: '1.4',
                wordBreak: 'break-word'
              }}>
                <div>{msg.text}</div>
                <div style={{
                  fontSize: '11px',
                  marginTop: '4px',
                  opacity: 0.7,
                  textAlign: 'right'
                }}>
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          )
        })}

        {/* Typing indicator */}
        {partnerTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: '18px 18px 18px 4px',
              background: 'var(--bg-tertiary)',
              display: 'flex', gap: '4px', alignItems: 'center'
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '6px', height: '6px',
                  borderRadius: '50%',
                  background: 'var(--text-muted)',
                  animation: 'bounce-dot 1.2s infinite',
                  animationDelay: `${i * 0.2}s`
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── INPUT BAR */}
      <div style={{
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end'
      }}>
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={handleTyping}
          onKeyDown={handleKeyDown}
          placeholder={isEnded ? 'Chat ended' : 'Message...'}
          disabled={isEnded}
          rows={1}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '22px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: '15px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            maxHeight: '120px',
            lineHeight: '1.4'
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!inputText.trim() || isEnded}
          style={{
            width: '44px', height: '44px',
            borderRadius: '50%',
            border: 'none',
            background: inputText.trim() && !isEnded
              ? 'var(--accent-primary)'
              : 'var(--bg-tertiary)',
            color: inputText.trim() && !isEnded
              ? 'white'
              : 'var(--text-muted)',
            fontSize: '18px',
            cursor: inputText.trim() && !isEnded
              ? 'pointer'
              : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s'
          }}
        >
          ➤
        </button>
      </div>
    </div>
  )
}

export default MatchChatScreen
