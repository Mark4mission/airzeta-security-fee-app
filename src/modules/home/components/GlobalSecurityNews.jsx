import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { ShieldCheck, PlaneTakeoff, ExternalLink, AlertTriangle, Globe, RefreshCw } from 'lucide-react';

// Color constants matching project theme
const COLORS = {
  card: '#132F4C',
  cardBorder: '#1E3A5F',
  text: '#E8EAED',
  textSecondary: '#8B99A8',
  accent: '#E94560',
  accentBlue: '#3B82F6',
  accentGreen: '#10B981',
  accentOrange: '#F59E0B',
  surface: '#1A3A5C',
  bg: '#0F2030',
};

// Region badge colors
const REGION_COLORS = {
  'Global': { bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.3)' },
  'Asia': { bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: 'rgba(16, 185, 129, 0.3)' },
  'Americas': { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)' },
  'Europe/CIS': { bg: 'rgba(139, 92, 246, 0.15)', text: '#A78BFA', border: 'rgba(139, 92, 246, 0.3)' },
  'Middle East/Africa': { bg: 'rgba(244, 63, 94, 0.15)', text: '#FB7185', border: 'rgba(244, 63, 94, 0.3)' },
};

// Fallback icons for missing images
const FALLBACK_ICONS = [ShieldCheck, PlaneTakeoff];

function GlobalSecurityNews() {
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageErrors, setImageErrors] = useState({});

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch latest 5 news items from Firestore
      const newsRef = collection(db, 'securityNews');
      const q = query(newsRef, orderBy('createdAt', 'desc'), limit(5));
      const snapshot = await getDocs(q);
      
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setNewsItems(items);
    } catch (err) {
      console.error('[GlobalSecurityNews] Fetch error:', err);
      setError('Unable to load security news');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleImageError = (newsId) => {
    setImageErrors(prev => ({ ...prev, [newsId]: true }));
  };

  const getRegionStyle = (region) => {
    return REGION_COLORS[region] || REGION_COLORS['Global'];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div style={{
        background: COLORS.card,
        borderRadius: '1rem',
        border: `1px solid ${COLORS.cardBorder}`,
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Globe size={20} color={COLORS.accent} />
          <h2 style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.text, margin: 0 }}>
            Global Cargo Security News
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: COLORS.surface,
              borderRadius: '0.75rem',
              padding: '1rem',
              display: 'flex',
              gap: '1rem',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              <div style={{ flex: '0 0 70%' }}>
                <div style={{ width: '60px', height: '18px', background: '#1E3A5F', borderRadius: '4px', marginBottom: '0.5rem' }} />
                <div style={{ width: '100%', height: '16px', background: '#1E3A5F', borderRadius: '4px', marginBottom: '0.35rem' }} />
                <div style={{ width: '70%', height: '14px', background: '#1E3A5F', borderRadius: '4px' }} />
              </div>
              <div style={{
                flex: '0 0 30%',
                aspectRatio: '16/9',
                background: '#1E3A5F',
                borderRadius: '0.5rem',
              }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No news items
  if (!loading && newsItems.length === 0) {
    return (
      <div style={{
        background: COLORS.card,
        borderRadius: '1rem',
        border: `1px solid ${COLORS.cardBorder}`,
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={20} color={COLORS.accent} />
            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.text, margin: 0 }}>
              Global Cargo Security News
            </h2>
          </div>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          color: COLORS.textSecondary,
          fontSize: '0.85rem',
        }}>
          <ShieldCheck size={40} color={COLORS.textSecondary} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
          <p style={{ margin: 0 }}>No security news available at this time.</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>News updates are published daily at 16:00 KST.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: COLORS.card,
      borderRadius: '1rem',
      border: `1px solid ${COLORS.cardBorder}`,
      padding: '1.5rem',
      marginBottom: '1.5rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Globe size={20} color={COLORS.accent} />
          <h2 style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.text, margin: 0 }}>
            Global Cargo Security News
          </h2>
          <span style={{
            fontSize: '0.6rem',
            color: COLORS.textSecondary,
            background: COLORS.surface,
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            fontWeight: '600',
          }}>
            AI Curated
          </span>
        </div>
        <span style={{
          fontSize: '0.65rem',
          color: COLORS.textSecondary,
        }}>
          Updated: {newsItems[0]?.date ? formatDate(newsItems[0].date) : 'Today'}
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem',
          marginBottom: '0.75rem',
          fontSize: '0.75rem',
          color: '#FCA5A5',
        }}>
          {error}
        </div>
      )}

      {/* News Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {newsItems.map((news, idx) => {
          const regionStyle = getRegionStyle(news.region);
          const isCritical = news.priority === 'critical';
          const hasImage = news.imageUrl && !imageErrors[news.id];
          const FallbackIcon = FALLBACK_ICONS[idx % FALLBACK_ICONS.length];
          
          return (
            <div
              key={news.id}
              style={{
                background: isCritical
                  ? 'linear-gradient(135deg, rgba(233, 69, 96, 0.08) 0%, rgba(26, 58, 92, 1) 100%)'
                  : COLORS.surface,
                borderRadius: '0.75rem',
                border: `1px solid ${isCritical ? 'rgba(233, 69, 96, 0.3)' : COLORS.cardBorder}`,
                padding: '0.875rem',
                display: 'flex',
                gap: '0.875rem',
                transition: 'all 0.2s ease',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = isCritical ? COLORS.accent : COLORS.accentBlue;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = isCritical ? 'rgba(233, 69, 96, 0.3)' : COLORS.cardBorder;
                e.currentTarget.style.transform = 'none';
              }}
            >
              {/* Left: Content (70%) */}
              <div style={{ flex: '1 1 70%', minWidth: 0 }}>
                {/* Top row: Region badge + priority */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  {isCritical && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.55rem',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                      background: 'rgba(233, 69, 96, 0.2)',
                      color: COLORS.accent,
                      border: `1px solid rgba(233, 69, 96, 0.4)`,
                    }}>
                      <AlertTriangle size={10} />
                      CRITICAL
                    </span>
                  )}
                  <span style={{
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    fontSize: '0.55rem',
                    fontWeight: '600',
                    letterSpacing: '0.03em',
                    background: regionStyle.bg,
                    color: regionStyle.text,
                    border: `1px solid ${regionStyle.border}`,
                  }}>
                    {news.region || 'Global'}
                  </span>
                  {news.source && (
                    <span style={{
                      fontSize: '0.55rem',
                      color: COLORS.textSecondary,
                      fontWeight: '500',
                    }}>
                      {news.source}
                    </span>
                  )}
                </div>

                {/* English headline */}
                <h3 style={{
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  color: COLORS.text,
                  margin: '0 0 0.25rem 0',
                  lineHeight: '1.4',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {news.headlineEn || news.title}
                </h3>

                {/* Korean summary */}
                {news.headlineKr && news.headlineKr !== news.headlineEn && (
                  <p style={{
                    fontSize: '0.72rem',
                    color: COLORS.textSecondary,
                    margin: '0 0 0.4rem 0',
                    lineHeight: '1.45',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {news.headlineKr}
                  </p>
                )}

                {/* Bottom: Date + Link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.65rem', color: COLORS.textSecondary }}>
                    {formatDate(news.date)}
                  </span>
                  {news.link && (
                    <a
                      href={news.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.65rem',
                        color: COLORS.accentBlue,
                        textDecoration: 'none',
                        fontWeight: '600',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#93C5FD'}
                      onMouseLeave={e => e.currentTarget.style.color = COLORS.accentBlue}
                    >
                      Read article <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>

              {/* Right: Image frame (30%) */}
              <div style={{
                flex: '0 0 28%',
                maxWidth: '28%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {hasImage ? (
                  <div style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    background: COLORS.cardBorder,
                  }}>
                    <img
                      src={news.imageUrl}
                      alt=""
                      loading="lazy"
                      onError={() => handleImageError(news.id)}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    borderRadius: '0.5rem',
                    background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.card} 100%)`,
                    border: `1px solid ${COLORS.cardBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FallbackIcon
                      size={28}
                      color={isCritical ? COLORS.accent : COLORS.textSecondary}
                      style={{ opacity: 0.4 }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GlobalSecurityNews;
