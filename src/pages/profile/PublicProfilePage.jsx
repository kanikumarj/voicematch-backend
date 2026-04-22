// NEW: [Feature 4 — Public Profile Page]

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

const PERSONALITY_COLORS = {
  'The Legend':      '#F59E0B',
  'The Charmer':     '#EC4899',
  'The Storyteller': '#7C3AED',
  'The Deep Talker': '#3B82F6',
  'The Dedicated':   '#EF4444',
  'The Regular':     '#10B981',
  'The Explorer':    '#F97316',
  'New Voice':       '#6B7280',
  'Voice Explorer':  '#6B7280',
};

export default function PublicProfilePage() {
  const { username } = useParams();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState(false);
  const [showQR, setShowQR]     = useState(false);

  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/u/${username}`
    : '';

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API}/api/public/u/${username}`);
        const data = await res.json();
        if (data.success) setProfile(data.data);
        else setProfile(null);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copy this link:', profileUrl);
    }
  };

  const handleWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`Connect with me on VoiceMatch! 🎙️ ${profileUrl}`)}`,
      '_blank'
    );
  };

  const handleTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent('Connect with me on VoiceMatch! 🎙️')}&url=${encodeURIComponent(profileUrl)}`,
      '_blank'
    );
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.displayName} on VoiceMatch`,
          text: 'Connect with me on VoiceMatch! 🎙️',
          url: profileUrl,
        });
      } catch {}
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0A0A0A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#F9FAFB', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        Loading...
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0A0A0A',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#F9FAFB', gap: '16px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ fontSize: '48px' }}>🎙️</div>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Profile not found</h1>
        <Link to="/" style={{ color: '#7C3AED', textDecoration: 'none' }}>
          Go to VoiceMatch →
        </Link>
      </div>
    );
  }

  const tagColor = PERSONALITY_COLORS[profile.personalityTag] || '#6B7280';
  const initials = profile.displayName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || '?';

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0A0A', color: '#F9FAFB',
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 16px 48px',
    }}>
      {/* App Header */}
      <div style={{ width: '100%', maxWidth: '440px', padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
        <Link to="/" style={{ color: '#7C3AED', textDecoration: 'none', fontWeight: 800, fontSize: '20px', letterSpacing: '-0.5px' }}>
          🎙️ VoiceMatch
        </Link>
      </div>

      {/* Profile Card */}
      <div style={{
        width: '100%', maxWidth: '440px',
        background: '#141414', borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '32px 24px', textAlign: 'center', marginTop: '8px',
      }}>
        {/* Avatar */}
        <div style={{
          width: '96px', height: '96px', borderRadius: '50%',
          background: `${tagColor}33`, border: `3px solid ${tagColor}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: '36px', fontWeight: 800, color: tagColor,
        }}>
          {initials}
        </div>

        <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>
          {profile.displayName}
        </h1>

        {/* Personality tag */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', background: `${tagColor}22`, border: `1px solid ${tagColor}44`,
          borderRadius: '999px', color: tagColor, fontSize: '13px', fontWeight: 700, marginBottom: '28px',
        }}>
          🏆 {profile.personalityTag}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
          {[
            { icon: '🔥', value: profile.streakCount, label: 'Day streak' },
            { icon: '🎙️', value: profile.totalCalls, label: 'Calls' },
            { icon: '⭐', value: profile.averageRating, label: 'Rating' },
          ].map(({ icon, value, label }) => (
            <div key={label} style={{
              flex: 1, padding: '14px 8px', background: 'rgba(255,255,255,0.04)',
              borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#F9FAFB' }}>{value}</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Member since */}
        <p style={{ color: '#6B7280', fontSize: '12px', marginBottom: '24px' }}>
          Member since {new Date(profile.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>

        {/* CTA */}
        <Link
          to="/"
          style={{
            display: 'block', padding: '16px', background: '#7C3AED',
            borderRadius: '14px', color: 'white', fontWeight: 700,
            fontSize: '16px', textDecoration: 'none', marginBottom: '8px',
          }}
        >
          Connect on VoiceMatch 🎙️
        </Link>
        <p style={{ color: '#6B7280', fontSize: '12px' }}>
          Join free — no credit card needed
        </p>
      </div>

      {/* Share Section */}
      <div style={{
        width: '100%', maxWidth: '440px',
        background: '#141414', borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '24px', marginTop: '16px',
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: '#F9FAFB' }}>
          Share this profile
        </h3>

        <div style={{
          padding: '12px', background: 'rgba(255,255,255,0.04)',
          borderRadius: '10px', fontSize: '12px', color: '#9CA3AF',
          marginBottom: '16px', wordBreak: 'break-all',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {profileUrl}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <button onClick={handleCopy} style={{
            padding: '12px',
            background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '10px',
            color: copied ? '#10B981' : '#F9FAFB',
            cursor: 'pointer', fontSize: '14px', fontWeight: 600,
          }}>
            {copied ? '✅ Copied!' : '📋 Copy Link'}
          </button>

          <button onClick={handleWhatsApp} style={{
            padding: '12px', background: 'rgba(37,211,102,0.1)',
            border: '1px solid rgba(37,211,102,0.2)',
            borderRadius: '10px', color: '#25D366', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
          }}>
            WhatsApp
          </button>

          <button onClick={handleTwitter} style={{
            padding: '12px', background: 'rgba(29,161,242,0.1)',
            border: '1px solid rgba(29,161,242,0.2)',
            borderRadius: '10px', color: '#1DA1F2', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
          }}>
            Twitter / X
          </button>

          {typeof navigator !== 'undefined' && navigator.share && (
            <button onClick={handleNativeShare} style={{
              padding: '12px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', color: '#F9FAFB', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            }}>
              More...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
