// FIX: [Area 7] MusicSync — complete redesign with search, queue, volume controls
// Works for both random call AND friends chat

import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../lib/api';

export default function MusicSync({ socket, isCallConnected, mode = 'call', friendshipId, callAudioRef }) {
  const [isOpen, setIsOpen]         = useState(false);
  const [videoId, setVideoId]       = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoThumb, setVideoThumb] = useState(null);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const [ytReady, setYtReady]       = useState(false);

  // FIX: [Area 7] Search state
  const [activeTab, setActiveTab]   = useState('url'); // 'search' | 'url' | 'queue'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');

  // FIX: [Area 7] Queue state
  const [queue, setQueue]           = useState([]);

  // FIX: [Area 7] Volume controls
  const [musicVolume, setMusicVolume] = useState(50);
  const [voiceVolume, setVoiceVolume] = useState(100);

  const playerRef        = useRef(null);
  const isSyncing        = useRef(false);
  const inputRef         = useRef(null);
  const progressInterval = useRef(null);
  const searchTimer      = useRef(null);

  // Extract YouTube video ID from any URL format
  const extractVideoId = (url) => {
    if (!url) return null;
    // If it's already just an ID (11 chars, alphanumeric + dash/underscore)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
    const patterns = [
      /youtube\.com\/watch\?v=([^&\n?#]+)/,
      /youtu\.be\/([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Load YouTube IFrame API
  const loadYouTubeAPI = useCallback(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true);
      return;
    }
    if (document.getElementById('yt-api-script')) return;

    const tag = document.createElement('script');
    tag.id  = 'yt-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => setYtReady(true);
  }, []);

  // Initialize player when videoId and API ready
  useEffect(() => {
    if (!videoId || !ytReady) return;

    const initTimeout = setTimeout(() => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
      }

      // FIX: [Area 7] Ensure player container exists
      let container = document.getElementById('vm-yt-player');
      if (!container) {
        container = document.createElement('div');
        container.id = 'vm-yt-player';
        container.style.display = 'none';
        document.body.appendChild(container);
      }

      playerRef.current = new window.YT.Player('vm-yt-player', {
        height: '0',
        width: '0',
        videoId,
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, fs: 0,
          iv_load_policy: 3, modestbranding: 1, playsinline: 1,
        },
        events: {
          onReady: (e) => {
            e.target.playVideo();
            e.target.setVolume(musicVolume);
            setIsPlaying(true);
            setDuration(e.target.getDuration());

            progressInterval.current = setInterval(() => {
              if (playerRef.current?.getCurrentTime) {
                setCurrentTime(playerRef.current.getCurrentTime());
                setDuration(playerRef.current.getDuration());
              }
            }, 1000);
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
            else if (e.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
            else if (e.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              clearInterval(progressInterval.current);
              // FIX: [Area 7] Auto-play next in queue
              if (queue.length > 0) {
                const next = queue[0];
                setQueue(prev => prev.slice(1));
                playTrack(next.videoId, next.title, next.thumbnail);
              }
            }
          },
        },
      });
    }, 100);

    return () => {
      clearTimeout(initTimeout);
      clearInterval(progressInterval.current);
    };
  }, [videoId, ytReady]);

  // FIX: [Area 7] Volume handlers
  const handleMusicVolume = (value) => {
    setMusicVolume(value);
    try { playerRef.current?.setVolume?.(value); } catch {}
  };

  const handleVoiceVolume = (value) => {
    setVoiceVolume(value);
    if (callAudioRef?.current) {
      callAudioRef.current.volume = value / 100;
    }
  };

  // FIX: [Area 7] YouTube search with debounce
  const doSearch = async (query) => {
    if (!query || query.length < 2) return;
    setSearching(true);
    setSearchError('');
    try {
      // Note: api interceptor unwraps response.data — res IS the data
      const res = await api.get(`/api/music/search?q=${encodeURIComponent(query)}`);
      if (res?.success) {
        setSearchResults(res.data?.results || []);
      } else {
        setSearchError(res?.message || 'Search failed');
        setSearchResults([]);
      }
    } catch (err) {
      if (err.message?.includes('not available')) {
        setSearchError('Search unavailable. Use URL tab instead.');
      } else {
        setSearchError('Search failed. Try URL paste.');
      }
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchInput = (value) => {
    setSearchQuery(value);
    clearTimeout(searchTimer.current);
    if (value.length >= 2) {
      searchTimer.current = setTimeout(() => doSearch(value), 500);
    }
  };

  // Play a track (shared helper)
  const playTrack = (vid, title, thumb) => {
    const thumbnailUrl = thumb || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
    setVideoId(vid);
    setVideoTitle(title || 'Now Playing');
    setVideoThumb(thumbnailUrl);
    loadYouTubeAPI();

    // FIX: [Area 7] Emit based on mode
    const event = mode === 'chat' ? 'friend_music_share' : 'music_share';
    const payload = { videoId: vid, title: title || 'Shared Song', thumbnail: thumbnailUrl };
    if (mode === 'chat') payload.friendshipId = friendshipId;
    socket.emit(event, payload);
  };

  const handleShare = () => {
    const url = inputRef.current?.value?.trim();
    if (!url) return;

    const id = extractVideoId(url);
    if (!id) {
      alert('Please paste a valid YouTube link or video ID');
      return;
    }

    playTrack(id, 'Shared Song', null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleControl = (action, timestamp) => {
    if (isSyncing.current) return;

    const ts = timestamp !== undefined
      ? timestamp
      : (playerRef.current?.getCurrentTime?.() || 0);

    const event = mode === 'chat' ? 'friend_music_control' : 'music_control';
    const payload = { action, timestamp: ts };
    if (mode === 'chat') payload.friendshipId = friendshipId;
    socket.emit(event, payload);

    if (action === 'play') {
      playerRef.current?.playVideo?.();
      setIsPlaying(true);
    } else if (action === 'pause') {
      playerRef.current?.pauseVideo?.();
      setIsPlaying(false);
    } else if (action === 'seek') {
      playerRef.current?.seekTo?.(ts, true);
      setCurrentTime(ts);
    }
  };

  const handleStop = () => {
    const event = mode === 'chat' ? 'friend_music_stop' : 'music_stop';
    const payload = mode === 'chat' ? { friendshipId } : {};
    socket.emit(event, payload);
    try { playerRef.current?.destroy?.(); } catch {}
    playerRef.current = null;
    setVideoId(null);
    setVideoTitle('');
    setVideoThumb(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setQueue([]);
    clearInterval(progressInterval.current);
  };

  // FIX: [Area 7] Add to queue
  const addToQueue = (item) => {
    setQueue(prev => [...prev, item]);
    if (mode === 'chat') {
      socket.emit('friend_music_queue_add', { friendshipId, ...item });
    }
  };

  const handleSeek = (e) => {
    const rect    = e.currentTarget.getBoundingClientRect();
    const x       = e.clientX - rect.left;
    const percent = x / rect.width;
    const seekTo  = percent * duration;
    handleControl('seek', seekTo);
  };

  const formatTime = (secs) => {
    const s = Math.floor(secs || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    // FIX: [Area 7] Listen for both call and friend music events
    const startedEvent = mode === 'chat' ? 'friend_music_started' : 'music_started';
    const controlEvent = mode === 'chat' ? 'friend_music_control' : 'music_control';
    const stoppedEvent = mode === 'chat' ? 'friend_music_stopped' : 'music_stopped';

    const onMusicStarted = ({ videoId: vid, title, thumbnail }) => {
      setVideoId(vid);
      setVideoTitle(title || 'Now Playing');
      setVideoThumb(thumbnail);
      setIsOpen(true);
      loadYouTubeAPI();
    };

    const onMusicControl = ({ action, timestamp }) => {
      isSyncing.current = true;
      if (action === 'play') {
        playerRef.current?.playVideo?.();
        setIsPlaying(true);
      } else if (action === 'pause') {
        playerRef.current?.pauseVideo?.();
        setIsPlaying(false);
      } else if (action === 'seek') {
        playerRef.current?.seekTo?.(timestamp, true);
        setCurrentTime(timestamp);
      }
      setTimeout(() => { isSyncing.current = false; }, 600);
    };

    const onMusicStopped = () => {
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
      setVideoId(null);
      setVideoTitle('');
      setIsPlaying(false);
      setCurrentTime(0);
      setQueue([]);
      clearInterval(progressInterval.current);
    };

    const onQueued = ({ queueItem }) => {
      setQueue(prev => [...prev, queueItem]);
    };

    socket.on(startedEvent, onMusicStarted);
    socket.on(controlEvent, onMusicControl);
    socket.on(stoppedEvent, onMusicStopped);
    if (mode === 'chat') {
      socket.on('friend_music_queued', onQueued);
    }

    return () => {
      socket.off(startedEvent, onMusicStarted);
      socket.off(controlEvent, onMusicControl);
      socket.off(stoppedEvent, onMusicStopped);
      if (mode === 'chat') {
        socket.off('friend_music_queued', onQueued);
      }
      clearInterval(progressInterval.current);
      clearTimeout(searchTimer.current);
    };
  }, [socket, mode, loadYouTubeAPI]);

  if (!isCallConnected && mode === 'call') return null;

  // FIX: [Area 7] Slider style helper
  const sliderBg = (value) => `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${value}%, var(--bg-secondary) ${value}%, var(--bg-secondary) 100%)`;

  // FIX: [Area 1] Panel style — positioned correctly for both modes
  const panelStyle = mode === 'call' ? {
    position: 'fixed',
    bottom: '140px', left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(380px, calc(100vw - 32px))',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-lg, 16px)',
    border: '1px solid var(--border-default)',
    padding: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: 10, // FIX: [Area 1] Music panel z-index
    maxHeight: '70vh',
    overflowY: 'auto',
  } : {
    background: 'var(--bg-elevated)',
    borderBottom: '1px solid var(--border-default)',
    padding: '12px 16px',
  };

  // FIX: [Area 7] Tab style helper
  const tabStyle = (isActive) => ({
    padding: '6px 14px',
    background: isActive ? 'var(--accent-primary)' : 'var(--bg-secondary)',
    border: isActive ? 'none' : '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-full, 999px)',
    color: isActive ? 'white' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  });

  // Music button for call mode
  const musicButton = mode === 'call' ? (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="call-ctrl"
      style={{
        background: videoId ? 'var(--accent-primary)' : undefined,
        color: videoId ? 'white' : undefined,
      }}
    >
      <span style={{ fontSize: '20px' }}>🎵</span>
      <span>{videoId ? 'LIVE' : 'Music'}</span>
    </button>
  ) : null;

  return (
    <>
      {/* Hidden YouTube Player */}
      <div id="vm-yt-player" style={{ display: 'none' }} />

      {musicButton}

      {/* Music Panel */}
      {isOpen && (
        <div style={panelStyle}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '12px',
          }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '15px' }}>
              🎵 Listen Together
            </span>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}
            >×</button>
          </div>

          {!videoId ? (
            <>
              {/* FIX: [Area 7] Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button style={tabStyle(activeTab === 'search')} onClick={() => setActiveTab('search')}>🔍 Search</button>
                <button style={tabStyle(activeTab === 'url')} onClick={() => setActiveTab('url')}>🔗 URL</button>
              </div>

              {/* FIX: [Area 7] Search tab */}
              {activeTab === 'search' && (
                <div>
                  <input
                    placeholder="Search for a song..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                      marginBottom: '10px', boxSizing: 'border-box',
                    }}
                  />

                  {searching && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px' }}>
                      Searching...
                    </p>
                  )}

                  {searchError && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '8px' }}>
                      {searchError}
                    </p>
                  )}

                  {/* Search results */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {searchResults.map(result => (
                      <button
                        key={result.videoId}
                        onClick={() => {
                          playTrack(result.videoId, result.title, result.thumbnail);
                          setSearchResults([]);
                          setSearchQuery('');
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '8px', background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {result.thumbnail && (
                          <img
                            src={result.thumbnail}
                            alt=""
                            style={{ width: '48px', height: '36px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0,
                          }}>
                            {result.title}
                          </p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '10px', margin: 0 }}>
                            {result.channel}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {!searching && searchResults.length === 0 && searchQuery.length >= 2 && !searchError && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px' }}>
                      No results found
                    </p>
                  )}
                </div>
              )}

              {/* FIX: [Area 7] URL tab */}
              {activeTab === 'url' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    ref={inputRef}
                    placeholder="Paste YouTube URL or video ID..."
                    style={{
                      flex: 1, padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleShare(); }}
                  />
                  <button
                    onClick={handleShare}
                    style={{
                      padding: '10px 14px', background: 'var(--accent-primary)',
                      border: 'none', borderRadius: 'var(--radius-md)',
                      color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                    }}
                  >Play</button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Now Playing */}
              {videoThumb && (
                <img
                  src={videoThumb} alt="Now playing"
                  style={{
                    width: '100%', height: '100px', objectFit: 'cover',
                    borderRadius: 'var(--radius-md)', marginBottom: '10px',
                  }}
                />
              )}

              <p style={{
                color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
                marginBottom: '4px', textAlign: 'center',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {videoTitle || '🎵 Now Playing'}
              </p>

              <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '10px', textAlign: 'center' }}>
                🎵 Playing Together
              </p>

              {/* Progress bar */}
              <div
                onClick={handleSeek}
                style={{
                  height: '4px', background: 'var(--bg-secondary)',
                  borderRadius: '2px', cursor: 'pointer', marginBottom: '6px', position: 'relative',
                }}
              >
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  background: 'var(--accent-primary)', borderRadius: '2px',
                  transition: 'width 0.5s linear',
                }} />
              </div>

              {/* Time */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                color: 'var(--text-muted)', fontSize: '11px', marginBottom: '12px',
              }}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Playback Controls */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '14px' }}>
                <button
                  onClick={() => handleControl(isPlaying ? 'pause' : 'play')}
                  style={{
                    padding: '8px 20px', background: 'var(--accent-primary)',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    color: 'white', cursor: 'pointer', fontSize: '18px',
                  }}
                >
                  {isPlaying ? '⏸' : '▶️'}
                </button>
                <button
                  onClick={handleStop}
                  style={{
                    padding: '8px 16px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px',
                  }}
                >⏹ Stop</button>
              </div>

              {/* FIX: [Area 7] Volume Controls */}
              <div style={{
                padding: '10px 0',
                borderTop: '1px solid var(--border-subtle)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '8px', fontSize: '12px',
                }}>
                  <span style={{ color: 'var(--text-secondary)', width: '58px', flexShrink: 0 }}>🎵 Music</span>
                  <input
                    type="range" min="0" max="100"
                    value={musicVolume}
                    onChange={e => handleMusicVolume(Number(e.target.value))}
                    style={{
                      flex: 1, height: '4px', cursor: 'pointer',
                      WebkitAppearance: 'none', appearance: 'none',
                      borderRadius: '2px',
                      background: sliderBg(musicVolume),
                      outline: 'none',
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', width: '30px', textAlign: 'right' }}>{musicVolume}%</span>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '12px',
                }}>
                  <span style={{ color: 'var(--text-secondary)', width: '58px', flexShrink: 0 }}>🎤 Voice</span>
                  <input
                    type="range" min="0" max="100"
                    value={voiceVolume}
                    onChange={e => handleVoiceVolume(Number(e.target.value))}
                    style={{
                      flex: 1, height: '4px', cursor: 'pointer',
                      WebkitAppearance: 'none', appearance: 'none',
                      borderRadius: '2px',
                      background: sliderBg(voiceVolume),
                      outline: 'none',
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', width: '30px', textAlign: 'right' }}>{voiceVolume}%</span>
                </div>
              </div>

              {/* FIX: [Area 7] Queue section */}
              {queue.length > 0 && (
                <div style={{
                  marginTop: '10px', paddingTop: '10px',
                  borderTop: '1px solid var(--border-subtle)',
                }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
                    📋 Up Next ({queue.length})
                  </p>
                  {queue.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '4px 0', fontSize: '11px', color: 'var(--text-secondary)',
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>{i + 1}.</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title || 'Queued song'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
