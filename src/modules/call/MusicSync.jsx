// FIX: MusicSync — buttonOnly / panelOnly, YouTube search + URL + queue + volume

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../lib/api';

export default function MusicSync({
  socket, isCallConnected, callAudioRef,
  mode = 'call', friendshipId = null,
  buttonOnly = false, panelOnly = false
}) {
  const [isOpen, setIsOpen]           = useState(false);
  const [activeTab, setActiveTab]     = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults]         = useState([]);
  const [searching, setSearching]     = useState(false);
  const [searchError, setSearchError] = useState('');
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [queue, setQueue]             = useState([]);
  const [musicVolume, setMusicVolume] = useState(50);
  const [voiceVolume, setVoiceVolume] = useState(100);
  const [urlInput, setUrlInput]       = useState('');
  const [playerReady, setPlayerReady] = useState(false);

  const playerRef   = useRef(null);
  const searchTimer = useRef(null);
  const isSyncing   = useRef(false);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) { setPlayerReady(true); return; }
    if (document.getElementById('yt-api-script')) return;
    const tag = document.createElement('script');
    tag.id  = 'yt-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => setPlayerReady(true);
  }, []);

  const initPlayer = useCallback((videoId) => {
    if (!playerReady || !window.YT) return;
    if (playerRef.current) { try { playerRef.current.destroy(); } catch {} playerRef.current = null; }

    // Ensure container
    let el = document.getElementById('vm-yt-player');
    if (!el) { el = document.createElement('div'); el.id = 'vm-yt-player'; el.style.display = 'none'; document.body.appendChild(el); }

    playerRef.current = new window.YT.Player('vm-yt-player', {
      height: '0', width: '0', videoId,
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, playsinline: 1 },
      events: {
        onReady: (e) => { e.target.setVolume(musicVolume); e.target.playVideo(); setIsPlaying(true); },
        onStateChange: (e) => {
          if (e.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
          if (e.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
          if (e.data === window.YT.PlayerState.ENDED) {
            setIsPlaying(false);
            if (queue.length > 0) {
              const [next, ...rest] = queue;
              setQueue(rest);
              playTrack(next);
            } else {
              setCurrentTrack(null);
            }
          }
        }
      }
    });
  }, [playerReady, musicVolume, queue]);

  const playTrack = useCallback((track) => {
    setCurrentTrack(track);
    initPlayer(track.videoId);
    const event = mode === 'chat' ? 'friend_music_share' : 'music_share';
    socket?.emit(event, { friendshipId, videoId: track.videoId, title: track.title, thumbnail: track.thumbnail });
  }, [socket, mode, friendshipId, initPlayer]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;
    const startedEvent = mode === 'chat' ? 'friend_music_started' : 'music_started';
    const controlEvent = mode === 'chat' ? 'friend_music_control' : 'music_control';
    const stoppedEvent = mode === 'chat' ? 'friend_music_stopped' : 'music_stopped';

    const onStarted = ({ videoId, title, thumbnail, isSharer }) => {
      if (!isSharer) { setCurrentTrack({ videoId, title, thumbnail }); setIsOpen(true); initPlayer(videoId); }
    };
    const onControl = ({ action, timestamp }) => {
      isSyncing.current = true;
      if (action === 'play') { playerRef.current?.playVideo?.(); setIsPlaying(true); }
      else if (action === 'pause') { playerRef.current?.pauseVideo?.(); setIsPlaying(false); }
      else if (action === 'seek') { playerRef.current?.seekTo?.(timestamp, true); }
      setTimeout(() => { isSyncing.current = false; }, 600);
    };
    const onStopped = () => {
      try { playerRef.current?.destroy?.(); } catch {} playerRef.current = null;
      setCurrentTrack(null); setIsPlaying(false); setQueue([]);
    };
    const onQueued = ({ queueItem }) => setQueue(prev => [...prev, queueItem]);

    socket.on(startedEvent, onStarted);
    socket.on(controlEvent, onControl);
    socket.on(stoppedEvent, onStopped);
    socket.on('friend_music_queued', onQueued);
    socket.on('music_queued', onQueued);

    return () => {
      socket.off(startedEvent, onStarted);
      socket.off(controlEvent, onControl);
      socket.off(stoppedEvent, onStopped);
      socket.off('friend_music_queued', onQueued);
      socket.off('music_queued', onQueued);
      clearTimeout(searchTimer.current);
    };
  }, [socket, mode, initPlayer]);

  // Search with debounce
  const handleSearch = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (q.length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true); setSearchError('');
      try {
        const res = await api.get(`/api/music/search?q=${encodeURIComponent(q)}`);
        setResults(res?.data?.results || []);
      } catch (err) {
        setSearchError(err.message?.includes('not available') ? 'Search unavailable. Use URL tab.' : 'Search failed.');
        setResults([]);
      } finally { setSearching(false); }
    }, 500);
  };

  const handleMusicVolume = (v) => { setMusicVolume(v); try { playerRef.current?.setVolume?.(v); } catch {} };
  const handleVoiceVolume = (v) => { setVoiceVolume(v); if (callAudioRef?.current) callAudioRef.current.volume = v / 100; };

  const extractVideoId = (url) => {
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
    const patterns = [/youtube\.com\/watch\?v=([^&\n?#]+)/, /youtu\.be\/([^&\n?#]+)/, /youtube\.com\/embed\/([^&\n?#]+)/, /youtube\.com\/shorts\/([^&\n?#]+)/];
    for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
    return null;
  };

  const playFromUrl = () => {
    const vid = extractVideoId(urlInput.trim());
    if (!vid) return;
    playTrack({ videoId: vid, title: 'YouTube Video', thumbnail: `https://img.youtube.com/vi/${vid}/mqdefault.jpg` });
    setUrlInput('');
  };

  const stopMusic = () => {
    try { playerRef.current?.stopVideo?.(); } catch {}
    setCurrentTrack(null); setIsPlaying(false);
    socket?.emit(mode === 'chat' ? 'friend_music_stop' : 'music_stop', { friendshipId });
  };

  const togglePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) { playerRef.current.pauseVideo(); setIsPlaying(false); }
    else { playerRef.current.playVideo(); setIsPlaying(true); }
    if (!isSyncing.current) {
      const event = mode === 'chat' ? 'friend_music_control' : 'music_control';
      socket?.emit(event, { friendshipId, action: isPlaying ? 'pause' : 'play' });
    }
  };

  if (!isCallConnected && mode === 'call') return null;

  // ── BUTTON ONLY ──
  if (buttonOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
        <button onClick={() => setIsOpen(!isOpen)} style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: (isOpen || currentTrack) ? 'rgba(124,58,237,0.2)' : 'var(--bg-tertiary)',
          color: (isOpen || currentTrack) ? 'var(--accent-primary)' : 'var(--text-primary)',
          fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: (isOpen || currentTrack) ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border-default)',
          position: 'relative', transition: 'all 0.2s'
        }}>
          🎵
          {isPlaying && (
            <div style={{
              position: 'absolute', bottom: '2px', right: '2px',
              width: '10px', height: '10px', borderRadius: '50%',
              background: '#10B981', border: '2px solid var(--bg-primary)',
              animation: 'pulse-dot 1.5s infinite'
            }} />
          )}
        </button>
        <span style={{
          color: isPlaying ? 'var(--accent-primary)' : 'var(--text-secondary)',
          fontSize: '11px', fontWeight: 500
        }}>Music</span>
      </div>
    );
  }

  // ── PANEL ONLY — render panel if isOpen (set by button click in buttonOnly sibling) ──
  if (panelOnly) {
    if (!isOpen) return null;
  }

  // Chat mode inline button
  if (!buttonOnly && !panelOnly && mode === 'chat') {
    return (
      <>
        <button onClick={() => setIsOpen(!isOpen)} style={{
          padding: '8px 12px', background: isOpen ? 'rgba(124,58,237,0.15)' : 'var(--bg-secondary)',
          border: `1px solid ${isOpen ? 'var(--accent-primary)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)', color: isOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
          cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 500
        }}>🎵{isPlaying && <span style={{ fontSize: '11px', color: 'var(--success)' }}>●</span>}</button>
        {isOpen && <MusicPanel {...{ mode, currentTrack, isPlaying, queue, musicVolume, voiceVolume, activeTab, setActiveTab, searchQuery, handleSearch, results, searching, searchError, urlInput, setUrlInput, playTrack, playFromUrl, stopMusic, togglePlayPause, handleMusicVolume, handleVoiceVolume, setQueue, onClose: () => setIsOpen(false) }} />}
        <div id="vm-yt-player" style={{ display: 'none' }} />
      </>
    );
  }

  // panelOnly renders panel directly
  return (
    <>
      {isOpen && <MusicPanel {...{ mode, currentTrack, isPlaying, queue, musicVolume, voiceVolume, activeTab, setActiveTab, searchQuery, handleSearch, results, searching, searchError, urlInput, setUrlInput, playTrack, playFromUrl, stopMusic, togglePlayPause, handleMusicVolume, handleVoiceVolume, setQueue, onClose: () => setIsOpen(false) }} />}
      <div id="vm-yt-player" style={{ display: 'none' }} />
    </>
  );
}

// ── Extracted Panel ──
function MusicPanel({ mode, currentTrack, isPlaying, queue, musicVolume, voiceVolume, activeTab, setActiveTab, searchQuery, handleSearch, results, searching, searchError, urlInput, setUrlInput, playTrack, playFromUrl, stopMusic, togglePlayPause, handleMusicVolume, handleVoiceVolume, setQueue, onClose }) {
  const tabStyle = (active) => ({
    flex: 1, padding: '10px 8px', border: 'none', background: 'none',
    borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
    fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
  });

  return (
    <div style={{
      position: 'fixed',
      bottom: mode === 'call' ? '160px' : 'auto',
      top: mode === 'chat' ? '60px' : 'auto',
      left: '50%', transform: 'translateX(-50%)',
      width: 'min(380px, calc(100vw - 24px))',
      maxHeight: '60vh', background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      zIndex: mode === 'call' ? 40 : 50,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      animation: 'slide-up 220ms ease'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🎵 Music Sync
          {isPlaying && <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 500 }}>● Playing</span>}
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>×</button>
      </div>

      {/* Now Playing */}
      {currentTrack && (
        <div style={{ padding: '10px 16px', background: 'rgba(124,58,237,0.08)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          {currentTrack.thumbnail && <img src={currentTrack.thumbnail} alt="" style={{ width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover' }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTrack.title}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Now playing</div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={togglePlayPause} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>{isPlaying ? '⏸' : '▶'}</button>
            <button onClick={stopMusic} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>⏹</button>
          </div>
        </div>
      )}

      {/* Volume */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', width: '70px', flexShrink: 0 }}>🎵 Music</span>
          <input type="range" min="0" max="100" value={musicVolume} onChange={e => handleMusicVolume(Number(e.target.value))} style={{ flex: 1, height: '4px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '32px', textAlign: 'right' }}>{musicVolume}%</span>
        </div>
        {mode === 'call' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', width: '70px', flexShrink: 0 }}>🎤 Voice</span>
            <input type="range" min="0" max="100" value={voiceVolume} onChange={e => handleVoiceVolume(Number(e.target.value))} style={{ flex: 1, height: '4px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '32px', textAlign: 'right' }}>{voiceVolume}%</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
        <button style={tabStyle(activeTab === 'search')} onClick={() => setActiveTab('search')}>🔍 Search</button>
        <button style={tabStyle(activeTab === 'url')} onClick={() => setActiveTab('url')}>🔗 URL</button>
        <button style={tabStyle(activeTab === 'queue')} onClick={() => setActiveTab('queue')}>📋 Queue{queue.length > 0 ? ` (${queue.length})` : ''}</button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {activeTab === 'search' && (
          <div>
            <input value={searchQuery} onChange={e => handleSearch(e.target.value)} placeholder="Search songs, artists..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-default)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '10px' }} />
            {searching && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '16px' }}>Searching...</div>}
            {searchError && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '8px' }}>{searchError}</div>}
            {results.map(r => (
              <div key={r.videoId} onClick={() => { playTrack(r); setResults([]); setSearchQuery(''); }}
                style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {r.thumbnail && <img src={r.thumbnail} alt="" style={{ width: '48px', height: '36px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.channel}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); setQueue(prev => [...prev, r]); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '4px', flexShrink: 0 }}
                  title="Add to queue">+</button>
              </div>
            ))}
            {!searching && searchQuery.length > 1 && results.length === 0 && !searchError && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>No results found</div>
            )}
          </div>
        )}

        {activeTab === 'url' && (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '10px' }}>Paste a YouTube URL or video ID</p>
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://youtube.com/watch?v=..."
              onKeyDown={e => { if (e.key === 'Enter') playFromUrl(); }}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-default)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '10px' }} />
            <button onClick={playFromUrl} disabled={!urlInput.trim()}
              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: urlInput.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: urlInput.trim() ? '#fff' : 'var(--text-muted)', fontSize: '14px', fontWeight: 600, cursor: urlInput.trim() ? 'pointer' : 'default' }}>▶ Play from URL</button>
          </div>
        )}

        {activeTab === 'queue' && (
          <div>
            {queue.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '24px' }}>📋 Queue is empty<br /><span style={{ fontSize: '12px' }}>Search and add songs to queue</span></div>
            ) : queue.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px', borderRadius: '8px', marginBottom: '4px', background: 'var(--bg-tertiary)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '16px', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                </div>
                <button onClick={() => setQueue(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '4px', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
