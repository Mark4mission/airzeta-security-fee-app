import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, setDoc, getDoc, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import { ShieldCheck, PlaneTakeoff, ExternalLink, AlertTriangle, Globe, RefreshCw, Loader, Sparkles, Search, ChevronRight } from 'lucide-react';

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

// Auto-cycle interval (ms)
const CYCLE_INTERVAL = 5000;

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
// RSS FETCHER
// ============================================================
async function fetchAllRSSFeeds() {
  const allArticles = [];
  const fetchPromises = RSS_FEEDS.map(async (feed) => {
    try {
      const url = `${RSS2JSON_API}?rss_url=${encodeURIComponent(feed.rssUrl)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status !== 'ok' || !data.items) return [];
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
  return allArticles;
}

// ============================================================
// GEMINI AI FILTERING
// ============================================================
async function filterWithGemini(articles) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const firebaseKey = import.meta.env.VITE_FIREBASE_API_KEY;

  // Diagnostics: log API key status (masked for security)
  if (!apiKey) {
    console.warn('[Gemini] ❌ VITE_GEMINI_API_KEY is not set. Using keyword fallback.');
    console.warn('[Gemini] 💡 Set a valid Gemini API key in Vercel env vars (https://aistudio.google.com/apikey)');
    return { items: keywordFallbackFilter(articles), method: 'keyword' };
  }

  if (apiKey === firebaseKey) {
    console.warn('[Gemini] ⚠️ VITE_GEMINI_API_KEY is the same as VITE_FIREBASE_API_KEY.');
    console.warn('[Gemini] ⚠️ Firebase API keys do NOT have Generative Language API enabled by default.');
    console.warn('[Gemini] 💡 Either:');
    console.warn('  1. Create a separate Gemini API key at https://aistudio.google.com/apikey');
    console.warn('  2. Or enable "Gemini Developer API" in Firebase Console → AI Logic → Settings');
  }

  const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
  console.log(`[Gemini] 🔑 Using API key: ${maskedKey} (${articles.length} articles to filter)`);

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
3. "headlineEn": Concise English headline (max 100 chars)
4. "headlineKr": Korean translation/summary (max 60 chars)
5. "priority": "critical" if imminent threat/emergency directive, else "normal"

Return ONLY a JSON array of 5 objects. No markdown, no code fences.`;

    console.log('[Gemini] 📡 Calling gemini-2.5-flash-lite...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });

    let text = response.text.trim();
    console.log('[Gemini] ✅ Response received, length:', text.length);

    if (text.startsWith('```')) {
      text = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Gemini returned invalid JSON structure');
    }

    const items = parsed.slice(0, 5).map(item => {
      const idx = typeof item.index === 'number' ? item.index : 0;
      const orig = articles[idx] || articles[0];
      return {
        ...orig,
        region: item.region || 'Global',
        headlineEn: item.headlineEn || orig.title,
        headlineKr: item.headlineKr || '',
        priority: item.priority || 'normal',
      };
    });

    console.log('[Gemini] ✅ AI curation successful:', items.map(i => i.headlineEn?.substring(0, 40)));
    return { items, method: 'gemini' };
  } catch (err) {
    // Detailed error diagnosis
    const msg = err.message || String(err);
    console.error('[Gemini] ❌ AI filtering failed:', msg);

    if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('blocked')) {
      console.error('[Gemini] 🔒 API key does NOT have Generative Language API permission.');
      console.error('[Gemini] 💡 FIX: Go to https://aistudio.google.com/apikey and create a new API key,');
      console.error('         then set it as VITE_GEMINI_API_KEY in Vercel environment variables.');
    } else if (msg.includes('400') || msg.includes('INVALID')) {
      console.error('[Gemini] ❓ Invalid request. The API key or model may be incorrect.');
    } else if (msg.includes('429') || msg.includes('RATE')) {
      console.error('[Gemini] ⏳ Rate limit exceeded. Try again later.');
    }

    return { items: keywordFallbackFilter(articles), method: 'keyword' };
  }
}

// ============================================================
// KEYWORD FALLBACK FILTER
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
const CACHE_HOURS = 20;

async function getCachedNews() {
  try {
    const newsRef = collection(db, 'securityNews');
    const q = query(newsRef, orderBy('createdAt', 'desc'), limit(6));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.id !== CACHE_DOC_ID);
  } catch (err) {
    console.warn('[Cache] Failed to read cached news:', err.message);
    return [];
  }
}

async function getCachedMeta() {
  try {
    const metaRef = doc(db, 'securityNews', CACHE_DOC_ID);
    const metaSnap = await getDoc(metaRef);
    if (!metaSnap.exists()) return null;
    return metaSnap.data();
  } catch { return null; }
}

async function isCacheStale() {
  try {
    const data = await getCachedMeta();
    if (!data) return true;
    const lastUpdate = data.lastUpdated?.toDate?.() || new Date(data.lastUpdated);
    const now = new Date();
    return (now - lastUpdate) / (1000 * 60 * 60) >= CACHE_HOURS;
  } catch { return true; }
}

async function cleanOldNews() {
  try {
    const newsRef = collection(db, 'securityNews');
    const q = query(newsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.filter(d => d.id !== CACHE_DOC_ID);
    if (docs.length > 10) {
      for (const d of docs.slice(10)) {
        await deleteDoc(doc(db, 'securityNews', d.id));
      }
    }
  } catch {}
}

async function saveNewsToFirestore(newsItems, filterMethod) {
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

    const metaRef = doc(db, 'securityNews', CACHE_DOC_ID);
    batch.set(metaRef, {
      lastUpdated: serverTimestamp(),
      count: newsItems.length,
      filterMethod: filterMethod || 'unknown',
    });

    await batch.commit();
    cleanOldNews().catch(() => {});
  } catch (err) {
    console.error('[Cache] Save error:', err);
  }
}

// ============================================================
// MAIN PIPELINE
// ============================================================
async function runNewsPipeline() {
  const articles = await fetchAllRSSFeeds();
  if (articles.length === 0) return { items: [], method: 'none' };

  const { items, method } = await filterWithGemini(articles);
  if (items.length > 0) {
    await saveNewsToFirestore(items, method);
  }
  return { items, method };
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [filterMethod, setFilterMethod] = useState('');
  const [isHovering, setIsHovering] = useState(false);
  const [imgTransition, setImgTransition] = useState(false);
  const { isAdmin } = useAuth();
  const mountedRef = useRef(true);
  const cycleRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Auto-cycle through articles
  useEffect(() => {
    if (newsItems.length <= 1 || isHovering) {
      if (cycleRef.current) clearInterval(cycleRef.current);
      return;
    }
    cycleRef.current = setInterval(() => {
      setImgTransition(true);
      setTimeout(() => {
        setActiveIndex(prev => (prev + 1) % Math.min(newsItems.length, 5));
        setTimeout(() => setImgTransition(false), 50);
      }, 200);
    }, CYCLE_INTERVAL);
    return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
  }, [newsItems.length, isHovering]);

  // Handle manual article selection with transition
  const selectArticle = useCallback((idx) => {
    if (idx === activeIndex) return;
    setImgTransition(true);
    setTimeout(() => {
      setActiveIndex(idx);
      setTimeout(() => setImgTransition(false), 50);
    }, 180);
  }, [activeIndex]);

  const loadNews = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);

      if (!forceRefresh) {
        const cached = await getCachedNews();
        if (cached.length > 0 && mountedRef.current) {
          setNewsItems(cached);
          setLoading(false);
          const meta = await getCachedMeta();
          if (meta?.filterMethod) setFilterMethod(meta.filterMethod);

          const stale = await isCacheStale();
          if (!stale) return;
        }
      }

      if (forceRefresh && mountedRef.current) setRefreshing(true);
      const { items: freshNews, method } = await runNewsPipeline();

      if (mountedRef.current && method) setFilterMethod(method);

      if (freshNews.length > 0 && mountedRef.current) {
        const newCached = await getCachedNews();
        setNewsItems(newCached.length > 0 ? newCached : freshNews.map((n, i) => ({ ...n, id: `temp_${i}` })));
        setActiveIndex(0);
      } else if (mountedRef.current) {
        const cached = await getCachedNews();
        if (cached.length > 0) setNewsItems(cached);
      }
    } catch (err) {
      console.error('[GlobalSecurityNews] Error:', err);
      if (mountedRef.current) setError('Unable to load security news.');
    } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => { loadNews(); }, [loadNews]);

  const handleRefresh = () => { if (!refreshing) loadNews(true); };
  const handleImageError = (newsId) => setImageErrors(prev => ({ ...prev, [newsId]: true }));
  const getRegionStyle = (region) => REGION_COLORS[region] || REGION_COLORS['Global'];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  };

  // ---- Filter Method Badge ----
  const FilterBadge = () => {
    if (!filterMethod) return null;
    const isAI = filterMethod === 'gemini';
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
        fontSize: '0.58rem', fontWeight: '700', letterSpacing: '0.04em',
        padding: '0.15rem 0.5rem', borderRadius: '10px',
        background: isAI
          ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.15))'
          : 'rgba(245, 158, 11, 0.12)',
        color: isAI ? '#C4B5FD' : '#FCD34D',
        border: `1px solid ${isAI ? 'rgba(139, 92, 246, 0.35)' : 'rgba(245, 158, 11, 0.3)'}`,
        textTransform: 'uppercase',
      }}>
        {isAI ? <Sparkles size={9} /> : <Search size={9} />}
        {isAI ? 'AI Curated' : 'Keyword Filter'}
      </span>
    );
  };

  // ---- LOADING SKELETON ----
  if (loading) {
    return (
      <div style={{
        background: COLORS.card, borderRadius: '1rem', border: `1px solid ${COLORS.cardBorder}`,
        padding: '1.25rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Globe size={18} color={COLORS.accent} />
          <div style={{ width: '200px', height: '14px', background: '#1E3A5F', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: '1 1 55%' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ padding: '0.5rem 0.6rem', borderBottom: `1px solid rgba(30,58,95,0.5)`, animation: 'pulse 1.5s ease-in-out infinite' }}>
                <div style={{ width: `${80 - i * 6}%`, height: '11px', background: '#1E3A5F', borderRadius: '3px', marginBottom: '0.3rem' }} />
                <div style={{ width: '50%', height: '9px', background: '#1E3A5F', borderRadius: '3px' }} />
              </div>
            ))}
          </div>
          <div style={{ flex: '0 0 42%', aspectRatio: '16/10', background: '#1E3A5F', borderRadius: '0.6rem', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    );
  }

  // ---- EMPTY STATE ----
  if (!loading && newsItems.length === 0 && !refreshing) {
    return (
      <div style={{
        background: COLORS.card, borderRadius: '1rem', border: `1px solid ${COLORS.cardBorder}`,
        padding: '1.25rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={18} color={COLORS.accent} />
            <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: COLORS.text, margin: 0 }}>Global Cargo Security News</h2>
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
        <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: COLORS.textSecondary }}>
          <ShieldCheck size={36} color={COLORS.textSecondary} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: '0.8rem' }}>No security news available.</p>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem' }}>
            {isAdmin ? 'Click "Fetch News" to load articles.' : 'News updates are published daily.'}
          </p>
        </div>
      </div>
    );
  }

  // ---- ACTIVE NEWS DATA ----
  const activeNews = newsItems[activeIndex] || newsItems[0];
  const activeHasImage = activeNews?.imageUrl && !imageErrors[activeNews?.id];
  const ActiveFallback = FALLBACK_ICONS[activeIndex % FALLBACK_ICONS.length];
  const isCritical = activeNews?.priority === 'critical';

  // ---- MAIN RENDER ----
  return (
    <div
      style={{
        background: COLORS.card, borderRadius: '1rem', border: `1px solid ${COLORS.cardBorder}`,
        padding: '1.25rem', marginBottom: '1.5rem',
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* ===== Header ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Globe size={18} color={COLORS.accent} />
          <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: COLORS.text, margin: 0 }}>
            Global Cargo Security News
          </h2>
          <FilterBadge />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.6rem', color: COLORS.textSecondary }}>
            {newsItems[0]?.date ? formatDate(newsItems[0].date) : ''}
          </span>
          {isAdmin && (
            <button onClick={handleRefresh} disabled={refreshing} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem',
              background: 'transparent', border: `1px solid ${COLORS.cardBorder}`, borderRadius: '0.35rem',
              color: refreshing ? COLORS.textSecondary : COLORS.accentBlue,
              fontSize: '0.58rem', fontWeight: '600', cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}>
              {refreshing ? <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={10} />}
              {refreshing ? 'Updating...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.4rem', padding: '0.4rem 0.6rem', marginBottom: '0.6rem',
          fontSize: '0.7rem', color: '#FCA5A5',
        }}>{error}</div>
      )}

      {refreshing && newsItems.length > 0 && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '0.4rem', padding: '0.35rem 0.6rem', marginBottom: '0.6rem',
          fontSize: '0.65rem', color: '#60A5FA', display: 'flex', alignItems: 'center', gap: '0.3rem',
        }}>
          <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Fetching latest security news...
        </div>
      )}

      {/* ===== Main: Article List (left) + Image Spotlight (right) ===== */}
      <div style={{ display: 'flex', gap: '0.75rem', minHeight: '240px' }}>

        {/* LEFT: Compact article list */}
        <div style={{ flex: '1 1 55%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {newsItems.slice(0, 5).map((news, idx) => {
            const isActive = idx === activeIndex;
            const regionStyle = getRegionStyle(news.region);
            const critical = news.priority === 'critical';

            return (
              <div
                key={news.id || idx}
                onClick={() => selectArticle(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  padding: '0.5rem 0.6rem',
                  borderLeft: `3px solid ${isActive ? (critical ? COLORS.accent : COLORS.accentBlue) : 'transparent'}`,
                  background: isActive
                    ? (critical ? 'rgba(233, 69, 96, 0.06)' : 'rgba(59, 130, 246, 0.05)')
                    : 'transparent',
                  borderRadius: '0 0.3rem 0.3rem 0',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  flex: isActive ? '1.15' : '1',
                  gap: '0.45rem',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.03)';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Numbering circle */}
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: isActive
                    ? (critical ? COLORS.accent : COLORS.accentBlue)
                    : COLORS.surface,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '0.1rem',
                  transition: 'all 0.25s ease',
                  border: isActive ? 'none' : `1px solid ${COLORS.cardBorder}`,
                }}>
                  <span style={{
                    fontSize: '0.55rem', fontWeight: '700',
                    color: isActive ? '#fff' : COLORS.textSecondary,
                  }}>{idx + 1}</span>
                </div>

                {/* Text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Row 1: Region + source + date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.15rem' }}>
                    {critical && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.1rem',
                        padding: '0.05rem 0.25rem', borderRadius: '3px', fontSize: '0.48rem', fontWeight: '700',
                        background: 'rgba(233, 69, 96, 0.2)', color: COLORS.accent,
                        border: '1px solid rgba(233, 69, 96, 0.4)', letterSpacing: '0.04em',
                      }}>
                        <AlertTriangle size={7} /> CRITICAL
                      </span>
                    )}
                    <span style={{
                      padding: '0.05rem 0.25rem', borderRadius: '3px', fontSize: '0.48rem', fontWeight: '600',
                      background: regionStyle.bg, color: regionStyle.text, border: `1px solid ${regionStyle.border}`,
                      letterSpacing: '0.02em',
                    }}>
                      {news.region || 'Global'}
                    </span>
                    <span style={{ fontSize: '0.48rem', color: COLORS.textSecondary }}>
                      {news.source}
                    </span>
                    <span style={{ fontSize: '0.48rem', color: COLORS.textSecondary, marginLeft: 'auto' }}>
                      {formatDate(news.date)}
                    </span>
                  </div>

                  {/* Row 2: English headline */}
                  <h3 style={{
                    fontSize: isActive ? '0.75rem' : '0.7rem',
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? COLORS.text : COLORS.textSecondary,
                    margin: 0, lineHeight: '1.35',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    transition: 'all 0.25s ease',
                  }}>
                    {news.headlineEn || news.title}
                  </h3>

                  {/* Row 3: Korean subtitle */}
                  {news.headlineKr && news.headlineKr !== news.headlineEn ? (
                    <p style={{
                      fontSize: '0.63rem',
                      color: isActive ? '#93A3B8' : '#5F6B7A',
                      margin: '0.1rem 0 0 0', lineHeight: '1.3',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontWeight: '400',
                      transition: 'color 0.25s ease',
                      fontStyle: 'normal',
                    }}>
                      {news.headlineKr}
                    </p>
                  ) : (
                    /* No Korean headline: show thin placeholder line for visual consistency */
                    <p style={{
                      fontSize: '0.6rem', color: '#3F4F5F',
                      margin: '0.1rem 0 0 0', lineHeight: '1.3',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontStyle: 'italic',
                    }}>
                      {filterMethod === 'keyword' ? '(Korean headline unavailable)' : '\u00A0'}
                    </p>
                  )}
                </div>

                {/* Active indicator arrow */}
                {isActive && (
                  <ChevronRight size={14} color={COLORS.accentBlue} style={{ flexShrink: 0, alignSelf: 'center', opacity: 0.7 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT: Image Spotlight with smooth transition */}
        <div style={{
          flex: '0 0 42%', maxWidth: '42%',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}>
          {/* Image container */}
          <div style={{
            position: 'relative', width: '100%', borderRadius: '0.6rem', overflow: 'hidden',
            background: COLORS.surface, aspectRatio: '16/10',
            border: `1px solid ${isCritical ? 'rgba(233, 69, 96, 0.3)' : COLORS.cardBorder}`,
            transition: 'border-color 0.3s ease',
          }}>
            {activeHasImage ? (
              <img
                key={`img-${activeNews.id || activeIndex}`}
                src={activeNews.imageUrl}
                alt=""
                loading="lazy"
                onError={() => handleImageError(activeNews.id)}
                style={{
                  width: '100%', height: '100%', display: 'block',
                  objectFit: 'cover',
                  opacity: imgTransition ? 0 : 1,
                  transform: imgTransition ? 'scale(1.04)' : 'scale(1)',
                  transition: 'opacity 0.35s ease, transform 0.4s ease',
                }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.card} 100%)`,
                opacity: imgTransition ? 0 : 1,
                transition: 'opacity 0.35s ease',
              }}>
                <ActiveFallback size={40} color={isCritical ? COLORS.accent : COLORS.textSecondary} style={{ opacity: 0.3 }} />
              </div>
            )}

            {/* Gradient overlay at bottom of image */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
              background: 'linear-gradient(to top, rgba(19,47,76,0.92) 0%, rgba(19,47,76,0) 100%)',
              pointerEvents: 'none',
            }} />

            {/* Region + Source overlay on image */}
            <div style={{
              position: 'absolute', top: '0.5rem', left: '0.5rem',
              display: 'flex', gap: '0.25rem', alignItems: 'center',
            }}>
              {isCritical && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.1rem',
                  padding: '0.12rem 0.35rem', borderRadius: '4px', fontSize: '0.5rem', fontWeight: '700',
                  background: 'rgba(233, 69, 96, 0.85)', color: '#fff',
                  letterSpacing: '0.04em', backdropFilter: 'blur(4px)',
                }}>
                  <AlertTriangle size={8} /> CRITICAL
                </span>
              )}
              <span style={{
                padding: '0.12rem 0.35rem', borderRadius: '4px', fontSize: '0.5rem', fontWeight: '600',
                background: 'rgba(0,0,0,0.55)', color: '#fff',
                backdropFilter: 'blur(4px)', letterSpacing: '0.02em',
              }}>
                {activeNews?.source}
              </span>
            </div>

            {/* Bottom overlay: headline + link inside image */}
            <div style={{
              position: 'absolute', bottom: '0.5rem', left: '0.6rem', right: '0.6rem',
              opacity: imgTransition ? 0 : 1,
              transform: imgTransition ? 'translateY(6px)' : 'translateY(0)',
              transition: 'opacity 0.3s ease, transform 0.3s ease',
            }}>
              <h4 style={{
                fontSize: '0.76rem', fontWeight: '700', color: '#fff',
                margin: 0, lineHeight: '1.35',
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {activeNews?.headlineEn || activeNews?.title}
              </h4>
              {activeNews?.headlineKr && activeNews.headlineKr !== activeNews.headlineEn && (
                <p style={{
                  fontSize: '0.66rem', color: 'rgba(255,255,255,0.75)', margin: '0.15rem 0 0 0',
                  lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}>
                  {activeNews.headlineKr}
                </p>
              )}
            </div>

            {/* Progress indicator dots */}
            <div style={{
              position: 'absolute', bottom: '0.35rem', right: '0.5rem',
              display: 'flex', gap: '0.2rem', alignItems: 'center',
            }}>
              {newsItems.slice(0, 5).map((_, i) => (
                <div
                  key={i}
                  onClick={(e) => { e.stopPropagation(); selectArticle(i); }}
                  style={{
                    width: i === activeIndex ? '14px' : '5px',
                    height: '5px',
                    borderRadius: '2.5px',
                    background: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.35)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Article link under image */}
          {activeNews?.link && (
            <a href={activeNews.link} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                fontSize: '0.63rem', color: COLORS.accentBlue, textDecoration: 'none',
                fontWeight: '600', padding: '0.2rem 0',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#93C5FD'}
              onMouseLeave={e => e.currentTarget.style.color = COLORS.accentBlue}
            >
              Read full article <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default GlobalSecurityNews;
