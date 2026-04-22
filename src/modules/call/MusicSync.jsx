// NEW: [Feature 2 — Music Sync UI]

import { useState, useRef, useEffect, useCallback } from 'react';

export default function MusicSync({ socket, isCallConnected }) {
  const [isOpen, setIsOpen]         = useState(false);
  const [videoId, setVideoId]       = useState(null);
  const [videoThumb, setVideoThumb] = useState(null);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const [ytReady, setYtReady]       = useState(false);

  const playerRef        = useRef(null);
  const isSyncing        = useRef(false);
  const inputRef         = useRef(null);
  const progressInterval = useRef(null);

  // Extract YouTube video ID from any URL format
  const extractVideoId = (url) => {
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

  const handleShare = () => {
    const url = inputRef.current?.value?.trim();
    if (!url) return;

    const id = extractVideoId(url);
    if (!id) {
      alert('Please paste a valid YouTube link');
      return;
    }

    const thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    setVideoId(id);
    setVideoThumb(thumb);
    loadYouTubeAPI();

    socket.emit('music_share', {
      videoId: id, title: 'Shared Song', thumbnail: thumb,
    });
  };

  const handleControl = (action, timestamp) => {
    if (isSyncing.current) return;

    const ts = timestamp !== undefined
      ? timestamp
      : (playerRef.current?.getCurrentTime?.() || 0);

    socket.emit('music_control', { action, timestamp: ts });

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
    socket.emit('music_stop');
    try { playerRef.current?.destroy?.(); } catch {}
    playerRef.current = null;
    setVideoId(null);
    setVideoThumb(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    clearInterval(progressInterval.current);
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

    const onMusicStarted = ({ videoId: vid, thumbnail }) => {
      setVideoId(vid);
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
      setIsPlaying(false);
      setCurrentTime(0);
      clearInterval(progressInterval.current);
    };

    socket.on('music_started', onMusicStarted);
    socket.on('music_control', onMusicControl);
    socket.on('music_stopped', onMusicStopped);

    return () => {
      socket.off('music_started', onMusicStarted);
      socket.off('music_control', onMusicControl);
      socket.off('music_stopped', onMusicStopped);
      clearInterval(progressInterval.current);
    };
  }, [socket, loadYouTubeAPI]);

  if (!isCallConnected) return null;

  return (
    <>
      {/* Hidden YouTube Player */}
      <div id="vm-yt-player" style={{ display: 'none' }} />

      {/* Music Button */}
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

      {/* Music Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100px', left: '50%',
          transform: 'translateX(-50%)',
          width: '320px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-lg, 16px)',
          border: '1px solid var(--border-default)',
          padding: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 50,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '14px',
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={inputRef}
                placeholder="Paste YouTube link..."
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
              >Share</button>
            </div>
          ) : (
            <>
              {/* Thumbnail */}
              {videoThumb && (
                <img
                  src={videoThumb} alt="Now playing"
                  style={{
                    width: '100%', height: '120px', objectFit: 'cover',
                    borderRadius: 'var(--radius-md)', marginBottom: '12px',
                  }}
                />
              )}

              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '10px', textAlign: 'center' }}>
                🎵 Playing Together
              </p>

              {/* Progress bar */}
              <div
                onClick={handleSeek}
                style={{
                  height: '4px', background: 'var(--bg-secondary)',
                  borderRadius: '2px', cursor: 'pointer', marginBottom: '8px', position: 'relative',
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

              {/* Controls */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                  onClick={() => handleControl(isPlaying ? 'pause' : 'play')}
                  style={{
                    padding: '10px 20px', background: 'var(--accent-primary)',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    color: 'white', cursor: 'pointer', fontSize: '18px',
                  }}
                >
                  {isPlaying ? '⏸' : '▶️'}
                </button>
                <button
                  onClick={handleStop}
                  style={{
                    padding: '10px 20px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px',
                  }}
                >⏹ Stop</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
