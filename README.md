# Voice Match — Real-time P2P Voice Calling

Random real-time peer-to-peer voice calling between strangers.  
Built with Node.js, Socket.IO, WebRTC, PostgreSQL, and Redis.

---

## Architecture

```
Browser A                    Server                    Browser B
   │                           │                           │
   │──── JWT login ───────────▶│                           │
   │◀─── token ────────────────│                           │
   │                           │                           │
   │──── WS connect (JWT) ────▶│◀──── WS connect (JWT) ───│
   │──── join_pool ───────────▶│◀──── join_pool ───────────│
   │                           │                           │
   │◀─── match_found ──────────│──── match_found ─────────▶│
   │──── ready_confirm ───────▶│◀─── ready_confirm ────────│
   │◀─── both_ready ───────────│──── both_ready ──────────▶│
   │                           │                           │
   │──── webrtc_offer ────────▶│──── webrtc_offer ────────▶│
   │◀─── webrtc_answer ────────│◀─── webrtc_answer ────────│
   │◀══════════ P2P audio stream (direct WebRTC) ══════════▶│
   │                           │                           │
   │──── call_end ────────────▶│──── partner_disconnected ▶│
   │◀─── match_found ──────────│   (requeue both)          │
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Realtime | Socket.IO 4.x |
| Voice | WebRTC (browser native) |
| Database | PostgreSQL |
| Cache | Redis (ioredis) |
| Auth | JWT + bcrypt |
| TURN | Coturn (self-hosted) |

---

## Project Structure

```
voice-match/
├── server.js                          # Express + Socket.IO entry point
├── package.json
├── .env.example                       # Copy to .env before running
├── docker-compose.turn.yml            # Self-hosted TURN server
│
├── db/
│   ├── index.js                       # pg Pool singleton
│   ├── redis.js                       # ioredis singleton
│   ├── migrate.js                     # Migration runner (npm run migrate)
│   └── migrations/
│       ├── 001_create_users.sql
│       └── 002_create_sessions.sql
│
├── middleware/
│   ├── rateLimiter.js                 # express-rate-limit + Redis store
│   └── errorHandler.js                # asyncHandler, globalErrorHandler, notFoundHandler
│
├── socket/
│   ├── socket.server.js               # Socket.IO init + namespace
│   └── socket.auth.js                 # JWT handshake middleware
│
└── modules/
    ├── auth/
    │   ├── auth.routes.js             # POST /api/auth/register|login|onboarding GET /me
    │   ├── auth.controller.js
    │   ├── auth.service.js            # Zod validation, bcrypt, JWT signing
    │   └── auth.middleware.js         # authenticateToken
    │
    ├── presence/
    │   ├── presence.service.js        # Redis ops + session DB helpers + Lua script
    │   ├── presence.events.js         # connect, join_pool, leave_pool, disconnect
    │   └── reconnection.service.js    # State restore on socket reconnect
    │
    ├── matchmaking/
    │   ├── matchmaking.service.js     # attemptMatch, resolveReadyConfirm, 10s timeout
    │   ├── matchmaking.events.js      # ready_confirm, skip
    │   └── matchmaking_pair.lua       # Atomic RPOP Lua script
    │
    ├── signaling/
    │   └── signaling.events.js        # webrtc_offer/answer/ice relay, call_end
    │
    └── call/
        ├── call.routes.js             # GET /api/call/turn-credentials
        └── call.controller.js         # HMAC-SHA1 TURN credential generator

Frontend (src/)
├── socket/
│   └── socketClient.js               # Socket.IO client singleton + auto-reconnect
│
└── modules/call/
    ├── useWebRTC.js                   # RTCPeerConnection hook (full lifecycle)
    ├── useCallQuality.js              # ICE stats polling (RTT, jitter, packet loss)
    ├── callSocket.js                  # Socket event bind/unbind helpers
    ├── CallScreen.jsx                 # 3-state call UI (connecting/connected/ended)
    └── CallScreen.css                 # Dark glassmorphism styles

src/components/
└── ErrorBoundary.jsx                  # React error boundary for call subtree
```

---

## Setup

### 1. Prerequisites

- Node.js >= 18
- PostgreSQL running
- Redis running
- (Optional) Docker for TURN server

### 2. Install

```bash
npm install
```

### 3. Environment

```bash
cp .env.example .env
# Edit .env with your values
```

Generate your JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Database

```bash
# Run all migrations in order
npm run migrate
```

### 5. TURN Server (optional for LAN testing, required for production)

```bash
# Copy and edit the config file first
mkdir coturn
cat > coturn/turnserver.conf << 'EOF'
listening-port=3478
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=YOUR_TURN_SECRET
realm=voicematch.local
total-quota=100
no-multicast-peers
no-stdout-log
EOF

docker-compose -f docker-compose.turn.yml up -d
```

### 6. Run

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server starts at: `http://localhost:4000`  
Health check: `GET /health`

---

## API Reference

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ✗ | Register new user |
| POST | `/api/auth/login` | ✗ | Login, returns JWT |
| POST | `/api/auth/onboarding` | ✓ | Set display name, age, gender |
| GET | `/api/auth/me` | ✓ | Get current user profile |
| GET | `/api/call/turn-credentials` | ✓ | Get time-limited TURN credentials |

### Auth endpoints: rate limited to 10 requests per 15 minutes per IP.

---

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join_pool` | — | Enter matchmaking queue |
| `leave_pool` | — | Exit queue |
| `ready_confirm` | — | Confirm ready after match |
| `skip` | — | End call and requeue both |
| `reconnect_restore` | — | Restore state after reconnect |
| `webrtc_offer` | `{ offer }` | Relay SDP offer |
| `webrtc_answer` | `{ answer }` | Relay SDP answer |
| `webrtc_ice_candidate` | `{ candidate }` | Relay ICE candidate |
| `call_end` | `{ reason }` | End the current call |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `match_found` | `{ partnerId, partnerName }` | Match successful |
| `both_ready` | `{ initiator: boolean }` | Both confirmed — start WebRTC |
| `partner_disconnected` | `{ reason }` | Partner left or timed out |
| `partner_reconnected` | — | Partner came back after blip |
| `queue_position` | `{ waiting: true }` | Still waiting in pool |
| `session_restored` | `{ state }` | Reconnect state recovery |
| `error` | `{ message }` | Server-side error |

---

## Phases

| Phase | Status | Scope |
|---|---|---|
| 1 — Auth + Onboarding | ✅ Complete | Register, login, JWT, onboarding |
| 2 — Presence + Matchmaking | ✅ Complete | Pool, pairing, ready handshake |
| 3 — WebRTC Signaling | ✅ Complete | Offer/answer/ICE relay, call UI |
| 4 — Resilience | ✅ Complete | Rate limiting, reconnect, Lua atomicity |
| 5 — Polish + Analytics | 🔜 Next | Email verify, refresh tokens, Sentry, call history |

---

## Redis Key Reference

| Key | Type | Purpose |
|---|---|---|
| `user_socket_map` | HASH | userId → socketId |
| `active_pair_map` | HASH | userId → partnerId (bidirectional) |
| `searching_pool` | LIST | Ordered queue of searching userIds |
| `pending_ready` | SET | Users who confirmed ready |
| `session_id_map` | HASH | pairKey → sessionId (DB reference) |
| `rl:auth:<ip>` | STRING | Auth rate limit counter |
| `rl:pool:<userId>` | STRING | Pool join rate limit counter |
| `rl:api:<ip>` | STRING | General API rate limit counter |

---

## Security Notes

- Passwords hashed with bcrypt (12 salt rounds)
- JWT signed with HS256, 7-day expiry
- TURN credentials HMAC-SHA1 signed, 1-hour expiry, userId embedded
- Constant-time bcrypt comparison on login (prevents timing attacks)
- No stack traces exposed in `NODE_ENV=production`
- `express.json` body capped at 16kb
- All SQL queries parameterised (no injection surface)
