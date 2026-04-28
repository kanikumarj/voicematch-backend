// MusicSync — Host/Client model, YouTube sync
// CRITICAL FIX: No nested component definitions

import { useState, useEffect, useRef, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL;

// ─── Standalone panel component (OUTSIDE MusicSync) ─────────────────────────
function MusicPanelUI({
  isHost, currentTrack, isPlaying, queue, musicVolume, voiceVolume,
  activeTab, setActiveTab, searchQuery, handleSearch, results, searching,
  urlInput, setUrlInput, playTrack, playFromUrl, stopMusic, togglePlayPause,
  handleMusicVolume, handleVoiceVolume, setQueue, setIsHost,
  onClose, mode,
}) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      borderRadius: mode === 'call' ? '16px 16px 0 0' : '12px',
      padding: '16px',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>🎵 Music Sync</span>
          {isHost
            ? <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(124,58,237,0.15)', color: 'var(--accent-primary)', fontWeight: 700 }}>HOST</span>
            : currentTrack
              ? <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(16,185,129,0.15)', color: '#10B981', fontWeight: 700 }}>LISTENER</span>
              : null
          }
        </div>
        <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '22px', cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1, padding: '0 4px' }}>×</button>
      </div>

      {/* Now Playing */}
      {currentTrack && (
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {currentTrack.thumbnail && (
            <img src={currentTrack.thumbnail} alt="" style={{ width: '52px', height: '39px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{isHost ? 'You are hosting' : 'Partner is hosting'}</div>
          </div>
          {isHost && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={togglePlayPause} style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-primary)', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button onClick={stopMusic} style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ⏹
              </button>
            </div>
          )}
        </div>
      )}

      {/* Volume sliders — always visible for both users */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px', minWidth: '72px' }}>🎵 Music</span>
          <input
            type="range" min="0" max="100" value={musicVolume}
            onChange={e => handleMusicVolume(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '11px', minWidth: '30px', textAlign: 'right' }}>{musicVolume}%</span>
        </label>
        {mode === 'call' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', minWidth: '72px' }}>🎤 Voice</span>
            <input
              type="range" min="0" max="100" value={voiceVolume}
              onChange={e => handleVoiceVolume(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', minWidth: '30px', textAlign: 'right' }}>{voiceVolume}%</span>
          </label>
        )}
      </div>

      {/* Host controls */}
      {isHost && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px', gap: '3px' }}>
            {['search', 'url'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                flex: 1, padding: '6px 4px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === t ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: activeTab === t ? 600 : 400, fontSize: '13px', transition: 'all 0.15s',
              }}>
                {t === 'search' ? '🔍 Search' : '🔗 URL'}
              </button>
            ))}
          </div>

          {activeTab === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="text" placeholder="Search YouTube…"
                value={searchQuery} onChange={e => handleSearch(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
              />
              {searching && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Searching…</span>}
              {results.length > 0 && (
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {results.map((r, i) => (
                    <button key={i} onClick={() => playTrack(r)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px', borderRadius: '7px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                      {r.thumbnail && <img src={r.thumbnail} alt="" style={{ width: '44px', height: '33px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />}
                      <span style={{ color: 'var(--text-primary)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'url' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text" placeholder="YouTube URL or video ID"
                value={urlInput} onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && playFromUrl()}
                style={{ flex: 1, padding: '9px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
              />
              <button onClick={playFromUrl} style={{ padding: '9px 14px', background: 'var(--accent-primary)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>Play</button>
            </div>
          )}
        </>
      )}

      {/* Listener: offer to become host */}
      {!isHost && (
        <button onClick={() => setIsHost(true)} style={{ padding: '9px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', width: '100%' }}>
          🎵 Share my own music (become host)
        </button>
      )}

      {/* Hidden YT player */}
      <div id="vm-yt-player" style={{ position: 'fixed', bottom: '-999px', left: '-999px', width: '1px', height: '1px' }} />
    </div>
  );
}

// ─── Main MusicSync component ─────────────────────────────────────────────────
export default function MusicSync({
  socket,
  isCallConnected,
  callAudioRef,
  mode = 'call',
  friendshipId = null,
  buttonOnly   = false,
  panelOnly    = false,
  isOpen: isOpenProp,
  onOpenChange,
}) {
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen    = isOpenProp !== undefined ? isOpenProp : isOpenInternal;
  const setIsOpen = useCallback((v) => {
    if (onOpenChange) onOpenChange(v);
    else setIsOpenInternal(v);
  }, [onOpenChange]);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [musicVolume, setMusicVolume]   = useState(50);
  const [voiceVolume, setVoiceVolume]   = useState(100);
  const [queue, setQueue]               = useState([]);
  const [playerReady, setPlayerReady]   = useState(false);
  const [isHost, setIsHost]             = useState(false);
  const [urlInput, setUrlInput]         = useState('');
  const [searchQuery, setSearchQuery]   = useState('');
  const [results, setResults]           = useState([]);
  const [searching, setSearching]       = useState(false);
  const [activeTab, setActiveTab]       = useState('search');

  const playerRef   = useRef(null);
  const isSyncing   = useRef(false);
  const searchTimer = useRef(null);
  const musicVolRef = useRef(50); // ref to avoid stale closure in YT callbacks

  // Keep ref in sync
  useEffect(() => { musicVolRef.current = musicVolume; }, [musicVolume]);

  // ── Load YouTube IFrame API ──
  useEffect(() => {
    if (window.YT && window.YT.Player) { setPlayerReady(true); return; }
    if (!document.getElementById('yt-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'yt-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    // Support multiple MusicSync instances waiting for API
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      setPlayerReady(true);
      if (typeof prev === 'function') prev();
    };
    return () => {};
  }, []);

  // ── Init player ──
  const initPlayer = useCallback((videoId, autoplay = true) => {
    if (!window.YT || !window.YT.Player) return;

    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }

    let el = document.getElementById('vm-yt-player');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vm-yt-player';
      el.style.cssText = 'position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(el);
    } else {
      // Reset to plain div so YT can re-init
      el.innerHTML = '';
    }

    try {
      playerRef.current = new window.YT.Player('vm-yt-player', {
        height: '1', width: '1', videoId,
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (e) => {
            e.target.setVolume(musicVolRef.current);
            if (autoplay) { e.target.playVideo(); setIsPlaying(true); }
          },
          onStateChange: (e) => {
            const S = window.YT?.PlayerState;
            if (!S) return;
            if (e.data === S.PLAYING)  setIsPlaying(true);
            if (e.data === S.PAUSED)   setIsPlaying(false);
            if (e.data === S.ENDED) {
              setIsPlaying(false);
              setCurrentTrack(null);
            }
          },
          onError: () => { setCurrentTrack(null); setIsPlaying(false); },
        },
      });
    } catch (err) {
      console.warn('YT player init failed:', err);
    }
  }, []); // stable — uses refs

  // ── Play track ──
  const playTrack = useCallback((track) => {
    setCurrentTrack(track);
    setIsHost(true);
    setIsOpen(true);
    setResults([]);
    setSearchQuery('');
    initPlayer(track.videoId);
    const evt = mode === 'chat' ? 'friend_music_share' : 'music_share';
    socket?.emit(evt, { friendshipId, videoId: track.videoId, title: track.title, thumbnail: track.thumbnail });
  }, [socket, mode, friendshipId, initPlayer, setIsOpen]);

  // ── Stop music ──
  const stopMusic = useCallback(() => {
    if (!isHost) return;
    try { playerRef.current?.stopVideo?.(); } catch {}
    setCurrentTrack(null); setIsPlaying(false); setIsHost(false);
    const evt = mode === 'chat' ? 'friend_music_stop' : 'music_stop';
    socket?.emit(evt, { friendshipId });
  }, [isHost, socket, mode, friendshipId]);

  // ── Play/pause ──
  const togglePlayPause = useCallback(() => {
    if (!isHost || !playerRef.current) return;
    if (isPlaying) {
      try { playerRef.current.pauseVideo(); } catch {}
      setIsPlaying(false);
      const evt = mode === 'chat' ? 'friend_music_control' : 'music_control';
      socket?.emit(evt, { friendshipId, action: 'pause' });
    } else {
      try { playerRef.current.playVideo(); } catch {}
      setIsPlaying(true);
      const evt = mode === 'chat' ? 'friend_music_control' : 'music_control';
      socket?.emit(evt, { friendshipId, action: 'play' });
    }
  }, [isHost, isPlaying, socket, mode, friendshipId]);

  // ── Volume ──
  const handleMusicVolume = useCallback((v) => {
    setMusicVolume(v);
    musicVolRef.current = v;
    try { playerRef.current?.setVolume?.(v); } catch {}
  }, []);

  const handleVoiceVolume = useCallback((v) => {
    setVoiceVolume(v);
    if (callAudioRef?.current) callAudioRef.current.volume = v / 100;
  }, [callAudioRef]);

  // ── URL play ──
  const extractVideoId = (url) => {
    url = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
    const patterns = [/[?&]v=([^&#]+)/, /youtu\.be\/([^?&#]+)/, /embed\/([^?&#]+)/, /shorts\/([^?&#]+)/];
    for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
    return null;
  };

  const playFromUrl = useCallback(() => {
    const vid = extractVideoId(urlInput);
    if (!vid) return;
    playTrack({ videoId: vid, title: 'YouTube Video', thumbnail: `https://img.youtube.com/vi/${vid}/mqdefault.jpg` });
    setUrlInput('');
  }, [urlInput, playTrack]);

  // ── Search ──
  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('vm_token') || localStorage.getItem('token') || '';
        const res = await fetch(`${API}/api/music/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) { const data = await res.json(); setResults(Array.isArray(data) ? data : []); }
      } catch {}
      setSearching(false);
    }, 500);
  }, []);

  // ── Socket listeners ──
  useEffect(() => {
    if (!socket) return;
    const shareEvt   = mode === 'chat' ? 'friend_music_started' : 'music_started';
    const controlEvt = mode === 'chat' ? 'friend_music_control' : 'music_control';
    const stopEvt    = mode === 'chat' ? 'friend_music_stopped' : 'music_stopped';

    const onStarted = ({ videoId, title, thumbnail, isSharer }) => {
      if (isSharer) return;
      setCurrentTrack({ videoId, title, thumbnail });
      setIsHost(false);
      setIsOpen(true);
      initPlayer(videoId, true);
    };
    const onControl = ({ action, timestamp }) => {
      isSyncing.current = true;
      try {
        if (action === 'play')  { playerRef.current?.playVideo?.();  setIsPlaying(true);  }
        if (action === 'pause') { playerRef.current?.pauseVideo?.(); setIsPlaying(false); }
        if (action === 'seek' && timestamp !== undefined) playerRef.current?.seekTo?.(timestamp, true);
      } catch {}
      setTimeout(() => { isSyncing.current = false; }, 600);
    };
    const onStopped = () => {
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
      setCurrentTrack(null); setIsPlaying(false); setIsHost(false);
    };

    socket.on(shareEvt,   onStarted);
    socket.on(controlEvt, onControl);
    socket.on(stopEvt,    onStopped);
    return () => {
      socket.off(shareEvt,   onStarted);
      socket.off(controlEvt, onControl);
      socket.off(stopEvt,    onStopped);
    };
  }, [socket, mode, initPlayer, setIsOpen]);

  // ── Cleanup player on unmount ──
  useEffect(() => () => {
    try { playerRef.current?.destroy?.(); } catch {}
  }, []);

  // Guard
  if (!isCallConnected && mode === 'call') return null;

  const panelProps = {
    isHost, currentTrack, isPlaying, queue, musicVolume, voiceVolume,
    activeTab, setActiveTab, searchQuery, handleSearch, results, searching,
    urlInput, setUrlInput, playTrack, playFromUrl, stopMusic,
    togglePlayPause, handleMusicVolume, handleVoiceVolume,
    setQueue, setIsHost, onClose: () => setIsOpen(false), mode,
  };

  // ── BUTTON ONLY (call screen) ──
  if (buttonOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: (isOpen || currentTrack) ? 'rgba(124,58,237,0.2)' : 'var(--bg-tertiary)',
            color: (isOpen || currentTrack) ? 'var(--accent-primary)' : 'var(--text-primary)',
            fontSize: '22px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: (isOpen || currentTrack) ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border-default)',
            position: 'relative', transition: 'all 0.2s',
          }}
        >
          🎵
          {isPlaying && (
            <div style={{ position: 'absolute', bottom: '2px', right: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#10B981', border: '2px solid var(--bg-primary)' }} />
          )}
        </button>
        <span style={{ color: isPlaying ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: 500 }}>Music</span>
      </div>
    );
  }

  // ── PANEL ONLY (call screen overlay) ──
  if (panelOnly) {
    if (!isOpen) return null;
    return (
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40 }}>
        <MusicPanelUI {...panelProps} />
      </div>
    );
  }

  // ── CHAT / INLINE MODE ──
  if (!isOpen) return null;
  return (
    <div style={{ padding: '0 0 8px 0' }}>
      <MusicPanelUI {...panelProps} />
    </div>
  );
}
