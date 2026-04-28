// MusicSync — Host/Client model, YouTube IFrame API, synchronized playback
// Host: picks and controls music. Both: have independent volume slider.

import { useState, useEffect, useRef, useCallback } from 'react';

export default function MusicSync({
  socket,
  isCallConnected,
  callAudioRef,
  mode = 'call',           // 'call' | 'chat'
  friendshipId = null,
  // For call screen split rendering:
  buttonOnly   = false,
  panelOnly    = false,
  isOpen: isOpenProp = undefined,     // controlled from parent
  onOpenChange          = null,       // (bool) => void
}) {
  // If parent controls isOpen (call screen) use prop, else internal state
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = isOpenProp !== undefined ? isOpenProp : isOpenInternal;
  const setIsOpen = (v) => {
    if (onOpenChange) onOpenChange(v);
    else setIsOpenInternal(v);
  };

  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [musicVolume, setMusicVolume]   = useState(50);
  const [voiceVolume, setVoiceVolume]   = useState(100);
  const [queue, setQueue]               = useState([]);
  const [playerReady, setPlayerReady]   = useState(false);
  const [isHost, setIsHost]             = useState(false);   // who can control playback
  const [urlInput, setUrlInput]         = useState('');
  const [searchQuery, setSearchQuery]   = useState('');
  const [results, setResults]           = useState([]);
  const [searching, setSearching]       = useState(false);
  const [activeTab, setActiveTab]       = useState('search');

  const playerRef   = useRef(null);
  const isSyncing   = useRef(false);
  const searchTimer = useRef(null);

  const API = import.meta.env.VITE_API_URL;

  // ── Load YouTube IFrame API once ──
  useEffect(() => {
    if (window.YT && window.YT.Player) { setPlayerReady(true); return; }
    if (document.getElementById('yt-api-script')) {
      // Script already added, wait for callback
      window._ytReadyCallbacks = window._ytReadyCallbacks || [];
      window._ytReadyCallbacks.push(() => setPlayerReady(true));
      return;
    }
    const tag = document.createElement('script');
    tag.id  = 'yt-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      setPlayerReady(true);
      (window._ytReadyCallbacks || []).forEach(cb => cb());
      window._ytReadyCallbacks = [];
    };
  }, []);

  // ── Init YouTube player ──
  const initPlayer = useCallback((videoId, autoplay = true) => {
    if (!playerReady || !window.YT || !window.YT.Player) return;

    // Destroy existing player
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }

    // Ensure hidden container exists
    let el = document.getElementById('vm-yt-player');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vm-yt-player';
      el.style.cssText = 'position:fixed;bottom:-999px;left:-999px;width:1px;height:1px;';
      document.body.appendChild(el);
    }

    playerRef.current = new window.YT.Player('vm-yt-player', {
      height: '1', width: '1', videoId,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        controls: 0, disablekb: 1, fs: 0,
        iv_load_policy: 3, modestbranding: 1, rel: 0, playsinline: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (e) => {
          e.target.setVolume(musicVolume);
          if (autoplay) { e.target.playVideo(); setIsPlaying(true); }
        },
        onStateChange: (e) => {
          const S = window.YT.PlayerState;
          if (e.data === S.PLAYING)  setIsPlaying(true);
          if (e.data === S.PAUSED)   setIsPlaying(false);
          if (e.data === S.ENDED) {
            setIsPlaying(false);
            if (queue.length > 0) {
              const [next, ...rest] = queue;
              setQueue(rest);
              playTrack(next);
            } else {
              setCurrentTrack(null);
            }
          }
        },
        onError: () => {
          setCurrentTrack(null);
          setIsPlaying(false);
        }
      }
    });
  }, [playerReady, musicVolume, queue]);

  // ── Play a track (host action) ──
  const playTrack = useCallback((track) => {
    setCurrentTrack(track);
    setIsHost(true);
    setIsOpen(true);
    initPlayer(track.videoId);
    // Broadcast to partner
    const evt = mode === 'chat' ? 'friend_music_share' : 'music_share';
    socket?.emit(evt, {
      friendshipId,
      videoId: track.videoId,
      title: track.title,
      thumbnail: track.thumbnail,
    });
  }, [socket, mode, friendshipId, initPlayer]);

  // ── Socket listeners ──
  useEffect(() => {
    if (!socket) return;

    const shareEvt   = mode === 'chat' ? 'friend_music_started' : 'music_started';
    const controlEvt = mode === 'chat' ? 'friend_music_control' : 'music_control';
    const stopEvt    = mode === 'chat' ? 'friend_music_stopped' : 'music_stopped';

    // Partner started music — client (listener) role
    const onStarted = ({ videoId, title, thumbnail, isSharer }) => {
      if (isSharer) return; // own echo
      setCurrentTrack({ videoId, title, thumbnail });
      setIsHost(false);
      setIsOpen(true);
      initPlayer(videoId, true);
    };

    // Host sent play/pause/seek — apply if we are listener
    const onControl = ({ action, timestamp }) => {
      isSyncing.current = true;
      try {
        if (action === 'play')  { playerRef.current?.playVideo?.();  setIsPlaying(true);  }
        if (action === 'pause') { playerRef.current?.pauseVideo?.(); setIsPlaying(false); }
        if (action === 'seek')  { playerRef.current?.seekTo?.(timestamp, true); }
      } catch {}
      setTimeout(() => { isSyncing.current = false; }, 800);
    };

    const onStopped = () => {
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
      setCurrentTrack(null);
      setIsPlaying(false);
      setQueue([]);
      setIsHost(false);
    };

    socket.on(shareEvt,   onStarted);
    socket.on(controlEvt, onControl);
    socket.on(stopEvt,    onStopped);

    return () => {
      socket.off(shareEvt,   onStarted);
      socket.off(controlEvt, onControl);
      socket.off(stopEvt,    onStopped);
    };
  }, [socket, mode, initPlayer]);

  // ── Volume controls ──
  const handleMusicVolume = (v) => {
    setMusicVolume(v);
    try { playerRef.current?.setVolume?.(v); } catch {}
  };

  const handleVoiceVolume = (v) => {
    setVoiceVolume(v);
    if (callAudioRef?.current) callAudioRef.current.volume = v / 100;
  };

  // ── Host: play/pause ──
  const togglePlayPause = () => {
    if (!isHost) return; // only host controls playback
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
    if (!isSyncing.current) {
      const evt = mode === 'chat' ? 'friend_music_control' : 'music_control';
      socket?.emit(evt, { friendshipId, action: isPlaying ? 'pause' : 'play' });
    }
  };

  // ── Host: stop music ──
  const stopMusic = () => {
    if (!isHost) return;
    try { playerRef.current?.stopVideo?.(); } catch {}
    setCurrentTrack(null);
    setIsPlaying(false);
    setIsHost(false);
    const evt = mode === 'chat' ? 'friend_music_stop' : 'music_stop';
    socket?.emit(evt, { friendshipId });
  };

  // ── YouTube search ──
  const handleSearch = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/music/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('vm_token')}` }
        });
        if (res.ok) setResults(await res.json());
      } catch {}
      setSearching(false);
    }, 500);
  };

  // ── Extract YouTube video ID from URL ──
  const extractVideoId = (url) => {
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
    const patterns = [
      /youtube\.com\/watch\?v=([^&\n?#]+)/,
      /youtu\.be\/([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];
    for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
    return null;
  };

  const playFromUrl = () => {
    const vid = extractVideoId(urlInput.trim());
    if (!vid) return;
    playTrack({ videoId: vid, title: 'YouTube Video', thumbnail: `https://img.youtube.com/vi/${vid}/mqdefault.jpg` });
    setUrlInput('');
  };

  // ── Guard: call mode + not connected ──
  if (!isCallConnected && mode === 'call') return null;

  // ── Music panel content ──
  const MusicPanel = () => (
    <div style={{
      background: 'var(--bg-elevated)',
      borderRadius: '16px 16px 0 0',
      padding: '20px',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
      maxHeight: '70vh',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>🎵 Music Sync</span>
          {isHost
            ? <span style={{ fontSize: '11px', background: 'rgba(124,58,237,0.15)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>HOST</span>
            : currentTrack
              ? <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.15)', color: '#10B981', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>LISTENING</span>
              : null
          }
        </div>
        <button onClick={() => setIsOpen(false)} style={{ color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', background: 'none', border: 'none' }}>×</button>
      </div>

      {/* Now Playing */}
      {currentTrack && (
        <div style={{
          background: 'var(--bg-tertiary)',
          borderRadius: '12px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          {currentTrack.thumbnail && (
            <img src={currentTrack.thumbnail} alt="" style={{ width: '56px', height: '42px', borderRadius: '8px', objectFit: 'cover' }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentTrack.title}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              {isHost ? 'You are hosting' : 'Partner is hosting'}
            </div>
          </div>
          {/* Only host can play/pause/stop */}
          {isHost && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={togglePlayPause} style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--accent-primary)', border: 'none', color: '#fff',
                fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button onClick={stopMusic} style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#EF4444', fontSize: '14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                ⏹
              </button>
            </div>
          )}
        </div>
      )}

      {/* Volume Controls — BOTH users always see these */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '80px' }}>🎵 Music</span>
          <input type="range" min="0" max="100" value={musicVolume}
            onChange={e => handleMusicVolume(+e.target.value)}
            style={{ flex: 1, accentColor: 'var(--accent-primary)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '11px', width: '28px' }}>{musicVolume}%</span>
        </div>
        {mode === 'call' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '80px' }}>🎤 Voice</span>
            <input type="range" min="0" max="100" value={voiceVolume}
              onChange={e => handleVoiceVolume(+e.target.value)}
              style={{ flex: 1, accentColor: 'var(--accent-primary)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', width: '28px' }}>{voiceVolume}%</span>
          </div>
        )}
      </div>

      {/* Host-only: search/add music */}
      {isHost && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px' }}>
            {['search', 'url'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                flex: 1, padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === t ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: activeTab === t ? 600 : 400, fontSize: '13px',
              }}>
                {t === 'search' ? '🔍 Search' : '🔗 URL'}
              </button>
            ))}
          </div>

          {activeTab === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="Search YouTube..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px', color: 'var(--text-primary)',
                  fontSize: '14px', boxSizing: 'border-box',
                }}
              />
              {searching && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Searching...</div>}
              {results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {results.map((r, i) => (
                    <button key={i} onClick={() => { playTrack(r); setResults([]); setSearchQuery(''); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px', borderRadius: '8px',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                        cursor: 'pointer', textAlign: 'left',
                      }}>
                      {r.thumbnail && <img src={r.thumbnail} alt="" style={{ width: '48px', height: '36px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />}
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
                type="text"
                placeholder="YouTube URL or Video ID"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && playFromUrl()}
                style={{
                  flex: 1, padding: '10px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px',
                }}
              />
              <button onClick={playFromUrl} style={{
                padding: '10px 16px', background: 'var(--accent-primary)',
                border: 'none', borderRadius: '8px', color: '#fff',
                cursor: 'pointer', fontWeight: 600, flexShrink: 0,
              }}>Play</button>
            </div>
          )}

          {/* Queue */}
          {queue.length > 0 && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '6px' }}>QUEUE ({queue.length})</div>
              {queue.map((q, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '16px' }}>{i + 1}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px', flex: 1 }}>{q.title}</span>
                  <button onClick={() => setQueue(queue.filter((_, j) => j !== i))}
                    style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', fontSize: '16px' }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* If listener hasn't become host yet, let them initiate */}
          {!currentTrack && !isHost && (
            <button onClick={() => setIsHost(true)} style={{
              padding: '10px', background: 'var(--accent-primary)', border: 'none',
              borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600,
            }}>
              🎵 Become Host & Share Music
            </button>
          )}
        </>
      )}

      {/* Listener: button to become host */}
      {!isHost && (
        <button onClick={() => setIsHost(true)} style={{
          padding: '10px', background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: '14px',
        }}>
          🎵 Share your own music
        </button>
      )}

      {/* Hidden YT player container */}
      <div id="vm-yt-player" style={{ display: 'none' }} />
    </div>
  );

  // ── BUTTON ONLY (call screen secondary row) ──
  if (buttonOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
        <button onClick={() => setIsOpen(!isOpen)} style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: (isOpen || currentTrack) ? 'rgba(124,58,237,0.2)' : 'var(--bg-tertiary)',
          color: (isOpen || currentTrack) ? 'var(--accent-primary)' : 'var(--text-primary)',
          fontSize: '22px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: (isOpen || currentTrack) ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border-default)',
          position: 'relative', transition: 'all 0.2s',
        }}>
          🎵
          {isPlaying && (
            <div style={{
              position: 'absolute', bottom: '2px', right: '2px',
              width: '10px', height: '10px', borderRadius: '50%',
              background: '#10B981', border: '2px solid var(--bg-primary)',
            }} />
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
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        zIndex: 40,
        animation: 'slide-up 0.25s ease',
      }}>
        <MusicPanel />
      </div>
    );
  }

  // ── CHAT MODE: inline panel ──
  return (
    <div style={{ width: '100%' }}>
      {isOpen && <MusicPanel />}
    </div>
  );
}
