/**
 * src/lib/socket.js
 * Singleton Socket.IO client.
 * Re-exports the existing socketClient — single source of truth.
 * Never create socket instances outside this file.
 */
export {
  createSocket as connectSocket,
  destroySocket as disconnectSocket,
  getSocket,
} from '../socket/socketClient';
