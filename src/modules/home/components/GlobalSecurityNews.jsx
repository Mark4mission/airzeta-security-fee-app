import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, setDoc, getDoc, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import { ShieldCheck, PlaneTakeoff, ExternalLink, AlertTriangle, Globe, RefreshCw, Loader } from 'lucide-react';

// ============================================================
// CONSTANTS
// ============================================================
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
};

const REGION_COLORS = {
  'Global': { bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.3)' },
  'Asia': { bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: 'rgba(16, 185, 129, 0.3)' },
  'Americas': { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)' },
  'Europe/CIS': { bg: 'rgba(139, 92, 246, 0.15)', text: '#A78BFA', border: 'rgba(139, 92, 246, 0.3)' },
  'Middle East/Africa': { bg: 'rgba(244, 63, 94, 0.15)', text: '#FB7185', border: 'rgba(244, 63, 94, 0.3)' },
};

const FALLBACK_ICONS = [ShieldCheck, PlaneTakeoff];

// Sanitize text to prevent XSS from RSS content
function sanitizeText(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// RSS feeds via rss2json.com (free, returns JSON, supports CORS)
const RSS_FEEDS = [
  { name: 'Air Cargo News', rssUrl: 'https://www.aircargonews.net/feed/' },
  { name: 'Passenger Terminal Today', rssUrl: 'https://www.passengerterminaltoday.com/feed/' },
  { name: 'AeroTime Hub', rssUrl: 'https://www.aerotime.aero/feed' },
  { name: 'Simple Flying', rssUrl: 'https://simpleflying.com/feed/' },
];

const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';

// ============================================================
// RSS FETCHER (via rss2json.com – returns JSON, no CORS issues)
// ============================================================
async function fetchAllRSSFeeds() {
  const allArticles = [];
  const fetchPromises = RSS_FEEDS.map(async (feed) => {
    try {
      const url = `${RSS2JSON_API}?rss_url=${encodeURIComponent(feed.rssUrl)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status !== 'ok' || !data.items) {
        console.warn(`[News] ${feed.name}: API returned status ${data.status}`);
        return [];
      }
      return data.items.slice(0, 15).map(item => ({
        title: sanitizeText(item.title || ''),
        link: item.link || '',
        description: sanitizeText((item.description || '').replace(/<[^>]+>/g, '').substring(0, 500)),
        pubDate: item.pubDate || '',
        source: feed.name,
        imageUrl: item.thumbnail || item.enclosure?.link || '',
        categories: Array.isArray(item.categories) ? item.categories : [],
      }));
    } catch (err) {
      console.warn(`[News] Failed to fetch ${feed.name}:`, err.message);
      return [];
    }
  });

  const results = await Promise.allSettled(fetchPromises);
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allArticles.push(...result.value);
    }
  }
  console.log(`[News] Total articles fetched: ${allArticles.length}`);
  return allArticles;
}

// ============================================================
// GEMINI AI FILTERING (client-side via Google GenAI SDK)
// ============================================================
async function filterWithGemini(articles) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] No API key, using keyword fallback');
    return keywordFallbackFilter(articles);
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const summaries = articles
      .map((a, i) => `[${i}] "${a.title}" - ${a.description?.substring(0, 150) || 'N/A'} (${a.source})`)
      .join('\n');

    const prompt = `You are a cargo security intelligence analyst for an airline security team.

TASK: Select exactly 5 articles most relevant to aviation cargo security. Prioritize:
- Security screening: ETD (Explosive Trace Detection), K9, CSD (Cargo Screening Device), X-ray
- Cargo security incidents, threats, dangerous goods (DG), lithium battery
- ICAO/TSA/IATA regulatory policy changes, compliance
- Airport security operations, customs inspection
- Cargo theft, tampering, smuggling, contraband
- Risk assessment, security fee, security cost
- Air cargo logistics and freight operations

ARTICLES:
${summaries}

For each selected article:
1. "index": article number [0-${articles.length - 1}]
2. "region": one of [Global, Asia, Americas, Europe/CIS, Middle East/Africa]
3. "headlineEn": English headline (max 120 chars)
4. "headlineKr": Korean summary (max 80 chars)
5. "priority": "critical" if imminent threat/emergency directive, else "normal"

Return ONLY a JSON array of 5 objects. No markdown, no code fences.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });

    let text = response.text.trim();
    // Strip markdown code fences if present
    if (text.startsWith('```')) {
      text = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Gemini returned invalid response');
    }

    return parsed.slice(0, 5).map(item => {
      const idx = typeof item.index === 'number' ? item.index : 0;
      const orig = articles[idx] || articles[0];
      return {
        ...orig,
        region: item.region || 'Global',
        headlineEn: item.headlineEn || orig.title,
        headlineKr: item.headlineKr || orig.title,
        priority: item.priority || 'normal',
      };
    });
  } catch (err) {
    console.warn('[Gemini] AI filtering failed, using keyword fallback:', err.message);
    return keywordFallbackFilter(articles);
  }
}

// ============================================================
// KEYWORD FALLBACK FILTER (when Gemini is unavailable)
// ============================================================
function keywordFallbackFilter(articles) {
  const keywords = [
    'security', 'cargo', 'screening', 'etd', 'k9', 'csd', 'x-ray', 'xray',
    'threat', 'explosive', 'dangerous goods', 'icao', 'tsa', 'iata',
    'smuggling', 'theft', 'terror', 'bomb', 'inspection',
    'aviation security', 'air cargo', 'freight', 'customs',
    'checkpoint', 'regulation', 'compliance', 'dg goods',
    'lithium', 'contraband', 'tamper', 'hijack', 'drone',
    'known consignor', 'regulated agent', 'acc3',
  ];

  const scored = articles.map(a => {
    const text = `${a.title} ${a.description} ${(a.categories || []).join(' ')}`.toLowerCase();
    let score = 0;
    keywords.forEach(kw => {
      if (text.includes(kw)) score += (kw.length > 5 ? 2 : 1);
    });
    return { ...a, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);

  const regions = ['Global', 'Asia', 'Americas', 'Europe/CIS', 'Middle East/Africa'];
  return scored.slice(0, 5).map((a, i) => ({
    ...a,
    region: regions[i % regions.length],
    headlineEn: a.title,
    headlineKr: '',
    priority: a._score > 5 ? 'critical' : 'normal',
  }));
}

// ============================================================
// FIRESTORE CACHE LOGIC
// ============================================================
const CACHE_DOC_ID = 'latestNewsMeta';
const CACHE_HOURS = 20; // refresh once per day (~20h gap)

async function getCachedNews() {
  try {
    const newsRef = collection(db, 'securityNews');
    const q = query(newsRef, orderBy('createdAt', 'desc'), limit(5));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.id !== CACHE_DOC_ID); // exclude meta doc
  } catch (err) {
    console.warn('[Cache] Failed to read cached news:', err.message);
    return [];
  }
}

async function isCacheStale() {
  try {
    const metaRef = doc(db, 'securityNews', CACHE_DOC_ID);
    const metaSnap = await getDoc(metaRef);
    if (!metaSnap.exists()) return true;

    const data = metaSnap.data();
    const lastUpdate = data.lastUpdated?.toDate?.() || new Date(data.lastUpdated);
    const now = new Date();
    const hoursSince = (now - lastUpdate) / (1000 * 60 * 60);
    return hoursSince >= CACHE_HOURS;
  } catch {
    return true;
  }
}

async function cleanOldNews() {
  try {
    const newsRef = collection(db, 'securityNews');
    const q = query(newsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.filter(d => d.id !== CACHE_DOC_ID);

    // Keep only latest 10 items, delete the rest
    if (docs.length > 10) {
      const toDelete = docs.slice(10);
      for (const d of toDelete) {
        await deleteDoc(doc(db, 'securityNews', d.id));
      }
      console.log(`[Cache] Cleaned ${toDelete.length} old news items`);
    }
  } catch (err) {
    console.warn('[Cache] Cleanup error:', err.message);
  }
}

async function saveNewsToFirestore(newsItems) {
  try {
    const batch = writeBatch(db);
    const today = new Date().toISOString().split('T')[0];

    for (const item of newsItems) {
      const docRef = doc(collection(db, 'securityNews'));
      batch.set(docRef, {
        region: item.region || 'Global',
        headlineEn: item.headlineEn || item.title,
        headlineKr: item.headlineKr || '',
        date: today,
        link: item.link || '',
        imageUrl: item.imageUrl || '',
        priority: item.priority || 'normal',
        source: item.source || '',
        createdAt: serverTimestamp(),
      });
    }

    // Update meta document
    const metaRef = doc(db, 'securityNews', CACHE_DOC_ID);
    batch.set(metaRef, { lastUpdated: serverTimestamp(), count: newsItems.length });

    await batch.commit();
    console.log(`[Cache] Saved ${newsItems.length} news items to Firestore`);

    // Clean old items in background
    cleanOldNews().catch(() => {});
  } catch (err) {
    console.error('[Cache] Save error:', err);
  }
}

// ============================================================
// MAIN PIPELINE: fetch RSS → Gemini filter → save to Firestore
// ============================================================
async function runNewsPipeline() {
  console.log('[News Pipeline] Starting...');
  const articles = await fetchAllRSSFeeds();
  if (articles.length === 0) {
    console.warn('[News Pipeline] No articles fetched from any source');
    return [];
  }
  console.log(`[News Pipeline] Total articles: ${articles.length}`);

  const filtered = await filterWithGemini(articles);
  console.log(`[News Pipeline] Filtered: ${filtered.length} articles`);

  if (filtered.length > 0) {
    await saveNewsToFirestore(filtered);
  }
  return filtered;
}

// ============================================================
// COMPONENT
// ============================================================
function GlobalSecurityNews() {
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const { isAdmin } = useAuth();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load cached news first, then check if refresh needed
  const loadNews = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);

      // 1. Try loading from Firestore cache first (fast)
      if (!forceRefresh) {
        const cached = await getCachedNews();
        if (cached.length > 0 && mountedRef.current) {
          setNewsItems(cached);
          setLoading(false);

          // Check if stale in background
          const stale = await isCacheStale();
          if (!stale) return; // cache is fresh
          console.log('[News] Cache is stale, refreshing in background...');
        }
      }

      // 2. Run pipeline (RSS → Gemini → Firestore)
      if (forceRefresh && mountedRef.current) setRefreshing(true);
      const freshNews = await runNewsPipeline();

      if (freshNews.length > 0 && mountedRef.current) {
        // Re-read from Firestore to get proper IDs and timestamps
        const newCached = await getCachedNews();
        setNewsItems(newCached.length > 0 ? newCached : freshNews.map((n, i) => ({ ...n, id: `temp_${i}` })));
      } else if (mountedRef.current) {
        // Pipeline returned nothing but we have no cached data either
        const cached = await getCachedNews();
        if (cached.length > 0) setNewsItems(cached);
      }
    } catch (err) {
      console.error('[GlobalSecurityNews] Error:', err);
      if (mountedRef.current) setError('Unable to load security news. Will retry automatically.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const handleRefresh = () => {
    if (refreshing) return;
    loadNews(true);
  };

  const handleImageError = (newsId) => {
    setImageErrors(prev => ({ ...prev, [newsId]: true }));
  };

  const getRegionStyle = (region) => REGION_COLORS[region] || REGION_COLORS['Global'];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div style={{
        background: COLORS.card, borderRadius: '1rem', border: `1px solid ${COLORS.cardBorder}`,
        padding: '1.5rem', marginBottom: '1.5rem',
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
              background: COLORS.surface, borderRadius: '0.75rem', padding: '1rem',
              display: 'flex', gap: '1rem', animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              <div style={{ flex: '0 0 70%' }}>
                <div style={{ width: '60px', height: '18px', background: '#1E3A5F', borderRadius: '4px', marginBottom: '0.5rem' }} />
                <div style={{ width: '100%', height: '16px', background: '#1E3A5F', borderRadius: '4px', marginBottom: '0.35rem' }} />
                <div style={{ width: '70%', height: '14px', background: '#1E3A5F', borderRadius: '4px' }} />
              </div>
              <div style={{ flex: '0 0 30%', aspectRatio: '16/9', background: '#1E3A5F', borderRadius: '0.5rem' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && newsItems.length === 0 && !refreshing) {
    return (
      <div style={{
        background: COLORS.card, borderRadius: '1rem', border: `1px solid ${COLORS.cardBorder}`,
        padding: '1.5rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={20} color={COLORS.accent} />
            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.text, margin: 0 }}>
              Global Cargo Security News
            </h2>
          </div>
          {isAdmin && (
            <button onClick={handleRefresh} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem',
              background: COLORS.surface, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '0.4rem',
              color: COLORS.accentBlue, fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer',
            }}>
              <RefreshCw size={12} /> Fetch News
            </button>
          )}
        </div>
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: COLORS.textSecondary, fontSize: '0.85rem' }}>
          <ShieldCheck size={40} color={COLORS.textSecondary} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
          <p style={{ margin: 0 }}>No security news available at this time.</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>
            {isAdmin ? 'Click "Fetch News" to load the latest articles.' : 'News updates are published daily.'}
          </p>
          {error && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: '#FCA5A5' }}>{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: COLORS.card, borderRadius: '1rem', border: `1px solid ${COLORS.cardBorder}`,
      padding: '1.5rem', marginBottom: '1.5rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Globe size={20} color={COLORS.accent} />
          <h2 style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.text, margin: 0 }}>
            Global Cargo Security News
          </h2>
          <span style={{
            fontSize: '0.6rem', color: COLORS.textSecondary, background: COLORS.surface,
            padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: '600',
          }}>
            AI Curated
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.65rem', color: COLORS.textSecondary }}>
            {newsItems[0]?.date ? formatDate(newsItems[0].date) : ''}
          </span>
          {isAdmin && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem',
                background: 'transparent', border: `1px solid ${COLORS.cardBorder}`, borderRadius: '0.35rem',
                color: refreshing ? COLORS.textSecondary : COLORS.accentBlue,
                fontSize: '0.6rem', fontWeight: '600', cursor: refreshing ? 'not-allowed' : 'pointer',
              }}
            >
              {refreshing ? <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />}
              {refreshing ? 'Updating...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem', padding: '0.5rem 0.75rem', marginBottom: '0.75rem',
          fontSize: '0.75rem', color: '#FCA5A5',
        }}>
          {error}
        </div>
      )}

      {/* Refreshing overlay indicator */}
      {refreshing && newsItems.length > 0 && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '0.5rem', padding: '0.4rem 0.75rem', marginBottom: '0.6rem',
          fontSize: '0.7rem', color: '#60A5FA', display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
          Fetching latest security news...
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
              key={news.id || idx}
              style={{
                background: isCritical
                  ? 'linear-gradient(135deg, rgba(233, 69, 96, 0.08) 0%, rgba(26, 58, 92, 1) 100%)'
                  : COLORS.surface,
                borderRadius: '0.75rem',
                border: `1px solid ${isCritical ? 'rgba(233, 69, 96, 0.3)' : COLORS.cardBorder}`,
                padding: '0.875rem', display: 'flex', gap: '0.875rem',
                transition: 'all 0.2s ease', cursor: 'default',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = isCritical ? COLORS.accent : COLORS.accentBlue; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isCritical ? 'rgba(233, 69, 96, 0.3)' : COLORS.cardBorder; e.currentTarget.style.transform = 'none'; }}
            >
              {/* Left: Content (70%) */}
              <div style={{ flex: '1 1 70%', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  {isCritical && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                      padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.55rem', fontWeight: '700',
                      letterSpacing: '0.05em', background: 'rgba(233, 69, 96, 0.2)', color: COLORS.accent,
                      border: '1px solid rgba(233, 69, 96, 0.4)',
                    }}>
                      <AlertTriangle size={10} /> CRITICAL
                    </span>
                  )}
                  <span style={{
                    padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.55rem', fontWeight: '600',
                    letterSpacing: '0.03em', background: regionStyle.bg, color: regionStyle.text,
                    border: `1px solid ${regionStyle.border}`,
                  }}>
                    {news.region || 'Global'}
                  </span>
                  {news.source && (
                    <span style={{ fontSize: '0.55rem', color: COLORS.textSecondary, fontWeight: '500' }}>
                      {news.source}
                    </span>
                  )}
                </div>

                <h3 style={{
                  fontSize: '0.82rem', fontWeight: '700', color: COLORS.text,
                  margin: '0 0 0.25rem 0', lineHeight: '1.4', overflow: 'hidden',
                  textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {news.headlineEn || news.title}
                </h3>

                {news.headlineKr && news.headlineKr !== news.headlineEn && (
                  <p style={{
                    fontSize: '0.72rem', color: COLORS.textSecondary, margin: '0 0 0.4rem 0',
                    lineHeight: '1.45', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {news.headlineKr}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.65rem', color: COLORS.textSecondary }}>
                    {formatDate(news.date)}
                  </span>
                  {news.link && (
                    <a href={news.link} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        fontSize: '0.65rem', color: COLORS.accentBlue, textDecoration: 'none', fontWeight: '600',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#93C5FD'}
                      onMouseLeave={e => e.currentTarget.style.color = COLORS.accentBlue}
                    >
                      Read article <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>

              {/* Right: Image (30%) with aspect-video and object-cover */}
              <div style={{ flex: '0 0 28%', maxWidth: '28%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {hasImage ? (
                  <div className="aspect-video" style={{ width: '100%', borderRadius: '0.5rem', overflow: 'hidden', background: COLORS.cardBorder }}>
                    <img src={news.imageUrl} alt="" loading="lazy"
                      onError={() => handleImageError(news.id)}
                      className="object-cover"
                      style={{ width: '100%', height: '100%', display: 'block' }}
                    />
                  </div>
                ) : (
                  <div className="aspect-video" style={{
                    width: '100%', borderRadius: '0.5rem',
                    background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.card} 100%)`,
                    border: `1px solid ${COLORS.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <FallbackIcon size={28} color={isCritical ? COLORS.accent : COLORS.textSecondary} style={{ opacity: 0.4 }} />
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
