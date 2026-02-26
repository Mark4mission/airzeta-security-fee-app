import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../core/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Megaphone, Package, Shield, ArrowRight, Clock, FileText, Globe2 } from 'lucide-react';
import GlobalSecurityNews from './components/GlobalSecurityNews';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

const COLORS = {
  card: '#132F4C',
  cardBorder: '#1E3A5F',
  text: '#E8EAED',
  textSecondary: '#8B99A8',
  accent: '#E94560',
  accentBlue: '#3B82F6',
  accentGreen: '#10B981',
  accentOrange: '#F59E0B',
};

// ============================================================
// TIME ZONE DISPLAY COMPONENT
// ============================================================
function TimeZoneInfo() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // update every minute
    return () => clearInterval(timer);
  }, []);

  const utcStr = now.toLocaleString('en-US', {
    timeZone: 'UTC',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const kstStr = now.toLocaleString('en-US', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const localStr = now.toLocaleString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  // Detect user's timezone abbreviation
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const shortTz = localTz.split('/').pop().replace(/_/g, ' ');

  return (
    <div style={{
      display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap', alignItems: 'center',
    }}>
      <Globe2 size={13} color={COLORS.textSecondary} style={{ flexShrink: 0 }} />
      {[
        { label: 'UTC', time: utcStr },
        { label: 'KST', time: kstStr },
        { label: shortTz, time: localStr },
      ].map((tz, i) => (
        <span key={i} style={{
          fontSize: '0.65rem', color: COLORS.textSecondary,
          background: 'rgba(59, 130, 246, 0.06)', padding: '0.2rem 0.45rem',
          borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.1)',
          fontFamily: 'monospace', letterSpacing: '0.02em',
        }}>
          <span style={{ color: '#60A5FA', fontWeight: '600' }}>{tz.label}</span> {tz.time}
        </span>
      ))}
    </div>
  );
}

// ============================================================
// HOME PAGE
// ============================================================
function HomePage() {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [latestBulletins, setLatestBulletins] = useState([]);

  useEffect(() => {
    const fetchBulletins = async () => {
      try {
        const q = query(collection(db, 'bulletinPosts'), orderBy('createdAt', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        setLatestBulletins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('[HomePage] Failed to fetch bulletins:', err);
      }
    };
    fetchBulletins();
  }, []);

  const modules = useMemo(() => [
    {
      title: 'Security Bulletin Board',
      description: 'Share security announcements, notices and important updates across all stations.',
      icon: Megaphone,
      path: '/bulletin',
      color: COLORS.accentOrange,
      status: 'Active',
    },
    {
      title: 'Security Fee Management',
      description: 'Submit, review and manage station security costs. Upload exchange rates and track monthly budgets.',
      icon: DollarSign,
      path: '/security-fee',
      color: COLORS.accentBlue,
      status: 'Active',
    },
    {
      title: 'Aviation Security Level',
      description: 'Manage aviation security threat levels and compliance status for each station.',
      icon: Package,
      path: '/security-level',
      color: COLORS.accentGreen,
      status: 'Planned',
    },
  ], []);

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #132F4C 0%, #1A3A5C 100%)',
        borderRadius: '1rem',
        padding: '2rem 2.5rem',
        marginBottom: '1.5rem',
        border: `1px solid ${COLORS.cardBorder}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          right: '-30px',
          top: '-30px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'rgba(233, 69, 96, 0.06)',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: COLORS.text, 
            marginBottom: '0.5rem',
            letterSpacing: '0.01em',
          }}>
            Welcome, {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: COLORS.textSecondary, lineHeight: '1.6', maxWidth: '600px' }}>
            Airzeta Station Security System - Manage security operations, costs, and communications across all stations from one unified portal.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <div style={{ 
              padding: '0.4rem 0.8rem', 
              background: 'rgba(59, 130, 246, 0.12)', 
              borderRadius: '0.5rem',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              fontSize: '0.72rem',
              color: '#60A5FA',
              fontWeight: '600',
            }}>
              {isAdmin ? 'HQ Administrator' : `Station: ${currentUser?.branchName || 'N/A'}`}
            </div>
            <div style={{ 
              padding: '0.4rem 0.8rem', 
              background: 'rgba(16, 185, 129, 0.12)', 
              borderRadius: '0.5rem',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              fontSize: '0.72rem',
              color: '#34D399',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}>
              <Clock size={12} />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          {/* Time Zone Info */}
          <TimeZoneInfo />
        </div>
      </div>

      {/* Module Cards (load independently, no blocking by news) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        {modules.map(mod => {
          const Icon = mod.icon;
          const isActive = mod.status === 'Active';
          return (
            <div
              key={mod.path}
              onClick={() => isActive && navigate(mod.path)}
              style={{
                background: COLORS.card,
                borderRadius: '0.875rem',
                border: `1px solid ${COLORS.cardBorder}`,
                padding: '1.5rem',
                cursor: isActive ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                opacity: isActive ? 1 : 0.6,
                position: 'relative',
              }}
              onMouseEnter={e => { if (isActive) { e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.3)`; }}}
              onMouseLeave={e => { if (isActive) { e.currentTarget.style.borderColor = COLORS.cardBorder; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}}
            >
              {/* Status badge */}
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.6rem',
                fontWeight: '700',
                letterSpacing: '0.05em',
                background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: isActive ? '#34D399' : '#FBBF24',
                border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              }}>
                {mod.status.toUpperCase()}
              </div>

              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '0.75rem',
                background: `${mod.color}15`,
                border: `1px solid ${mod.color}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <Icon size={22} color={mod.color} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.text, marginBottom: '0.5rem' }}>
                {mod.title}
              </h3>
              <p style={{ fontSize: '0.78rem', color: COLORS.textSecondary, lineHeight: '1.55', marginBottom: '1rem' }}>
                {mod.description}
              </p>
              {/* Latest bulletin items for the bulletin card */}
              {mod.path === '/bulletin' && latestBulletins.length > 0 && (
                <div style={{ marginBottom: '0.75rem', borderTop: `1px solid ${COLORS.cardBorder}`, paddingTop: '0.6rem' }}>
                  {latestBulletins.slice(0, 3).map(post => (
                    <div
                      key={post.id}
                      onClick={(e) => { e.stopPropagation(); navigate(`/bulletin/post/${post.id}`); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.35rem 0.4rem', borderRadius: '0.375rem',
                        cursor: 'pointer', transition: 'background 0.15s',
                        marginBottom: '0.2rem',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <FileText size={13} color={COLORS.accentOrange} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '0.72rem', color: COLORS.text, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {post.title}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: COLORS.textSecondary, flexShrink: 0 }}>
                        {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {isActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: mod.color, fontSize: '0.78rem', fontWeight: '600' }}>
                  Open module <ArrowRight size={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Global Security News Section (loads independently, after module cards) */}
      <GlobalSecurityNews />
    </div>
  );
}

export default HomePage;
