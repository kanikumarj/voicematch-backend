import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { getSocket } from '../lib/socket';

const CallContext = createContext(null);

const INITIAL_STATE = {
  callStatus:  'idle',   // idle|searching|matched|connecting|connected|ended|feedback
  partnerId:   null,
  partnerName: null,
  sessionId:   null,
  isInitiator: false,
  callDuration: 0,       // live counter in seconds
};

export function CallProvider({ children }) {
  const [state,      setState]      = useState(INITIAL_STATE);
  const timerRef   = useRef(null);

  // ── Live call duration counter ─────────────────────────────────────────────
  useEffect(() => {
    if (state.callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setState(s => ({ ...s, callDuration: s.callDuration + 1 }));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [state.callStatus]);

  // ── Methods ────────────────────────────────────────────────────────────────
  const joinPool = useCallback(() => {
    getSocket().emit('join_pool');
    setState(s => ({ ...s, callStatus: 'searching' }));
  }, []);

  const leavePool = useCallback(() => {
    getSocket().emit('leave_pool');
    setState(s => ({ ...s, callStatus: 'idle' }));
  }, []);

  const setMatch = useCallback(({ partnerId, partnerName }) => {
    setState(s => ({ ...s, callStatus: 'matched', partnerId, partnerName }));
  }, []);

  const setConnecting = useCallback((isInitiator) => {
    setState(s => ({ ...s, callStatus: 'connecting', isInitiator }));
  }, []);

  const setConnected = useCallback((sessionId) => {
    setState(s => ({ ...s, callStatus: 'connected', sessionId, callDuration: 0 }));
  }, []);

  const endCall = useCallback((reason = 'user_end') => {
    clearInterval(timerRef.current);
    if (reason === 'user_end') {
      try { getSocket().emit('call_end', { reason }); } catch { /* socket may be gone */ }
    }
    const duration = state.callDuration;
    // Transition to feedback only if call lasted > 30s
    const nextStatus = duration > 30 ? 'feedback' : 'idle';
    setState(s => ({ ...s, callStatus: nextStatus }));
    return duration;
  }, [state.callDuration]);

  const resetCall = useCallback(() => {
    clearInterval(timerRef.current);
    setState(INITIAL_STATE);
  }, []);

  const setStatus = useCallback((callStatus) => {
    setState(s => ({ ...s, callStatus }));
  }, []);

  const value = {
    ...state,
    joinPool,
    leavePool,
    setMatch,
    setConnecting,
    setConnected,
    endCall,
    resetCall,
    setStatus,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within <CallProvider>');
  return ctx;
}
