import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../core/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Megaphone, ShieldAlert, Shield, ArrowRight, Clock, FileText, Globe2, Link2, QrCode, ExternalLink, X, MapPin, TrendingUp } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import GlobalSecurityNews from './components/GlobalSecurityNews';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
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

// AIRPORT_COORDS subset for mini-map (same keys as SecurityLevelPage)
const MINI_AIRPORT_COORDS = {
  ICN: { lat: 37.46, lng: 126.44 }, GMP: { lat: 37.56, lng: 126.79 },
  NRT: { lat: 35.76, lng: 140.39 }, KIX: { lat: 34.43, lng: 135.24 },
  HND: { lat: 35.55, lng: 139.78 }, NGO: { lat: 34.86, lng: 136.81 },
  FUK: { lat: 33.59, lng: 130.45 }, PVG: { lat: 31.14, lng: 121.81 },
  PEK: { lat: 40.08, lng: 116.58 }, CAN: { lat: 23.39, lng: 113.30 },
  HKG: { lat: 22.31, lng: 113.92 }, TPE: { lat: 25.08, lng: 121.23 },
  SIN: { lat: 1.36, lng: 103.99 }, BKK: { lat: 13.69, lng: 100.75 },
  SGN: { lat: 10.82, lng: 106.65 }, HAN: { lat: 21.22, lng: 105.81 },
  MNL: { lat: 14.51, lng: 121.02 }, CEB: { lat: 10.31, lng: 123.98 },
  KUL: { lat: 2.75, lng: 101.71 }, CGK: { lat: -6.13, lng: 106.66 },
  DEL: { lat: 28.57, lng: 77.10 }, BOM: { lat: 19.09, lng: 72.87 },
  DXB: { lat: 25.25, lng: 55.36 }, DOH: { lat: 25.26, lng: 51.57 },
  IST: { lat: 41.26, lng: 28.74 }, FRA: { lat: 50.03, lng: 8.57 },
  CDG: { lat: 49.01, lng: 2.55 }, LHR: { lat: 51.47, lng: -0.46 },
  AMS: { lat: 52.31, lng: 4.77 }, MAD: { lat: 40.47, lng: -3.57 },
  FCO: { lat: 41.80, lng: 12.24 }, JFK: { lat: 40.64, lng: -73.78 },
  LAX: { lat: 33.94, lng: -118.41 }, ORD: { lat: 41.98, lng: -87.90 },
  ATL: { lat: 33.64, lng: -84.43 }, SFO: { lat: 37.62, lng: -122.38 },
  YYZ: { lat: 43.68, lng: -79.63 }, GRU: { lat: -23.43, lng: -46.47 },
  SYD: { lat: -33.95, lng: 151.18 }, MEL: { lat: -37.67, lng: 144.84 },
  NBO: { lat: -1.32, lng: 36.93 }, JNB: { lat: -26.14, lng: 28.25 },
  CAI: { lat: 30.12, lng: 31.41 }, DAD: { lat: 16.05, lng: 108.20 },
  CTS: { lat: 42.78, lng: 141.69 }, DPS: { lat: -8.75, lng: 115.17 },
  STN: { lat: 51.89, lng: 0.26 }, LGW: { lat: 51.15, lng: -0.19 },
  VIE: { lat: 48.11, lng: 16.57 }, BRU: { lat: 50.90, lng: 4.48 },
  CPH: { lat: 55.62, lng: 12.66 }, MUC: { lat: 48.35, lng: 11.79 },
  ZRH: { lat: 47.46, lng: 8.55 }, BCN: { lat: 41.30, lng: 2.08 },
  SEA: { lat: 47.45, lng: -122.31 }, MIA: { lat: 25.80, lng: -80.29 },
  CJU: { lat: 33.51, lng: 126.49 }, PUS: { lat: 35.18, lng: 128.94 },
  OKA: { lat: 26.20, lng: 127.65 },
};

function extractIATA(branchName) {
  if (!branchName) return null;
  const clean = branchName.replace(/[^A-Za-z]/g, '').toUpperCase();
  return clean.length >= 3 ? clean.substring(0, 3) : clean;
}

function getRiskTierSimple(activeIdx, totalLevels, levelColor) {
  if (levelColor) {
    const lc = levelColor.toLowerCase();
    if (['#22c55e', '#3b82f6', '#f8fafc', '#94a3b8'].includes(lc)) return '#22c55e';
    if (['#eab308', '#f97316'].includes(lc)) return '#f97316';
    if (lc === '#ef4444') return '#ef4444';
  }
  if (totalLevels <= 1) return '#22c55e';
  const ratio = activeIdx / (totalLevels - 1);
  if (ratio < 0.4) return '#22c55e';
  if (ratio < 0.7) return '#f97316';
  return '#ef4444';
}

// Mini projection for a card-sized map
const MINI_W = 320;
const MINI_H = 140;
function miniProject(lng, lat) {
  const x = ((lng + 180) / 360) * MINI_W;
  const latRad = (lat * Math.PI) / 180;
  const maxLatRad = (85 * Math.PI) / 180;
  const clampedLat = Math.min(Math.max(latRad, -maxLatRad), maxLatRad);
  const mercY = Math.log(Math.tan(Math.PI / 4 + clampedLat / 2));
  const maxMercY = Math.log(Math.tan(Math.PI / 4 + maxLatRad / 2));
  const y = MINI_H / 2 - (mercY / maxMercY) * (MINI_H / 2);
  return [x, y];
}

// ============================================================
// TIME ZONE DISPLAY COMPONENT
// ============================================================
function TimeZoneInfo() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });
  const kstStr = now.toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
  const localStr = now.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const shortTz = localTz.split('/').pop().replace(/_/g, ' ');

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <Globe2 size={13} color={COLORS.textSecondary} style={{ flexShrink: 0 }} />
      {[{ label: 'UTC', time: utcStr }, { label: 'KST', time: kstStr }, { label: shortTz, time: localStr }].map((tz, i) => (
        <span key={i} style={{
          fontSize: '0.65rem', color: COLORS.textSecondary,
          background: 'rgba(59,130,246,0.06)', padding: '0.2rem 0.45rem',
          borderRadius: '4px', border: '1px solid rgba(59,130,246,0.1)',
          fontFamily: 'monospace', letterSpacing: '0.02em',
        }}>
          <span style={{ color: '#60A5FA', fontWeight: '600' }}>{tz.label}</span> {tz.time}
        </span>
      ))}
    </div>
  );
}

// ============================================================
// SECURITY LEVEL MINI MAP (for card)
// ============================================================
function SecurityLevelMiniMap({ stations }) {
  const mapped = useMemo(() => {
    return stations.map(s => {
      const iata = s.airportCode?.toUpperCase().trim() || extractIATA(s.branchName || s.id);
      const coords = MINI_AIRPORT_COORDS[s.airportCode?.toUpperCase().trim()] || MINI_AIRPORT_COORDS[extractIATA(s.branchName || s.id)];
      if (!coords) return null;
      const activeIdx = s.activeLevel ?? 0;
      const totalLevels = s.levels?.length || 1;
      const activeLevelData = s.levels?.[activeIdx];
      const color = getRiskTierSimple(activeIdx, totalLevels, activeLevelData?.color);
      const [x, y] = miniProject(coords.lng, coords.lat);
      return { iata, x, y, color, name: activeLevelData?.name || '' };
    }).filter(Boolean);
  }, [stations]);

  const green = mapped.filter(s => s.color === '#22c55e').length;
  const orange = mapped.filter(s => s.color === '#f97316').length;
  const red = mapped.filter(s => s.color === '#ef4444').length;

  // Simplified continent path outlines (low-detail shapes for visual appeal)
  const continentPaths = [
    // North America
    'M32,20 C36,18 44,18 52,22 C56,24 62,30 64,36 C60,40 52,44 46,42 C40,46 34,42 30,38 C28,34 30,26 32,20Z',
    // South America
    'M52,50 C56,48 60,50 62,54 C64,60 62,68 58,74 C56,78 52,80 50,76 C46,70 44,62 46,56 C48,52 50,50 52,50Z',
    // Europe
    'M140,18 C144,16 152,16 156,20 C158,24 156,28 152,30 C148,32 142,30 140,26 C138,22 138,20 140,18Z',
    // Africa
    'M140,36 C146,34 152,36 156,40 C160,46 158,56 154,62 C150,66 144,66 140,60 C136,54 134,44 138,38Z',
    // Asia
    'M170,14 C180,12 200,14 218,18 C226,22 230,28 228,34 C224,40 216,44 206,44 C196,46 186,42 178,38 C170,34 164,28 166,22 C168,16 170,14Z',
    // Oceania
    'M220,56 C228,54 238,56 242,60 C244,64 240,68 234,68 C228,66 222,62 220,58Z',
    // Oceania (NZ)
    'M248,68 C250,66 254,68 254,72 C252,74 248,72 248,68Z',
  ];

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${MINI_W} ${MINI_H}`} style={{
        width: '100%', height: 'auto', display: 'block', borderRadius: '0.5rem',
        background: 'linear-gradient(180deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)',
      }}>
        <defs>
          <radialGradient id="mg" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#1a2d4a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0a1628" stopOpacity="0" />
          </radialGradient>
          {/* Glow filters for markers */}
          <filter id="glow-g"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="glow-o"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="glow-r"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect width={MINI_W} height={MINI_H} fill="url(#mg)" />
        {/* Grid lines */}
        {[-60, -30, 0, 30, 60].map(lat => {
          const [, y] = miniProject(0, lat);
          return <line key={`lat${lat}`} x1="0" y1={y} x2={MINI_W} y2={y} stroke="#1E3A5F" strokeWidth="0.3" strokeDasharray="2,6" opacity="0.12" />;
        })}
        {[-120, -60, 0, 60, 120].map(lng => {
          const [x] = miniProject(lng, 0);
          return <line key={`lng${lng}`} x1={x} y1="0" x2={x} y2={MINI_H} stroke="#1E3A5F" strokeWidth="0.3" strokeDasharray="2,6" opacity="0.12" />;
        })}
        {/* Continent outlines */}
        {continentPaths.map((d, i) => (
          <path key={`c${i}`} d={d} fill="#172e4a" stroke="#1E3A5F" strokeWidth="0.4" opacity="0.55" />
        ))}
        {/* Connection lines between nearby stations (diagram effect) */}
        {mapped.length > 1 && mapped.slice(0, -1).map((s, i) => {
          const next = mapped[i + 1];
          const dist = Math.hypot(s.x - next.x, s.y - next.y);
          if (dist < 50) {
            return <line key={`conn${i}`} x1={s.x} y1={s.y} x2={next.x} y2={next.y}
              stroke="#1E3A5F" strokeWidth="0.3" opacity="0.25" strokeDasharray="1,2" />;
          }
          return null;
        })}
        {/* Animated pulse ring for red alerts */}
        {mapped.filter(s => s.color === '#ef4444').map((s, i) => (
          <circle key={`pulse${i}`} cx={s.x} cy={s.y} r="6" fill="none" stroke="#ef4444" strokeWidth="0.4" opacity="0.3">
            <animate attributeName="r" from="4" to="10" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
          </circle>
        ))}
        {/* Station markers */}
        {mapped.map((s, i) => {
          const glowId = s.color === '#ef4444' ? 'glow-r' : s.color === '#f97316' ? 'glow-o' : 'glow-g';
          return (
            <g key={i} filter={`url(#${glowId})`}>
              <circle cx={s.x} cy={s.y} r="5.5" fill={s.color} opacity="0.12" />
              <circle cx={s.x} cy={s.y} r="2.8" fill={s.color} stroke="#0a1628" strokeWidth="0.5" />
              <circle cx={s.x} cy={s.y} r="1" fill="#fff" opacity="0.5" />
            </g>
          );
        })}
        {/* IATA labels for a few prominent stations */}
        {mapped.filter((_, i) => i % Math.max(1, Math.floor(mapped.length / 5)) === 0).slice(0, 5).map((s, i) => (
          <text key={`lbl${i}`} x={s.x} y={s.y - 5} textAnchor="middle" fontSize="3.5" fill={s.color} opacity="0.7" fontWeight="700" fontFamily="monospace">
            {s.iata}
          </text>
        ))}
      </svg>
      {/* Stats overlay */}
      <div style={{
        position: 'absolute', bottom: '0.35rem', right: '0.35rem',
        display: 'flex', gap: '0.35rem', padding: '0.2rem 0.45rem',
        background: 'rgba(10,22,40,0.88)', borderRadius: '0.3rem',
        backdropFilter: 'blur(4px)', border: '1px solid rgba(30,58,95,0.5)',
      }}>
        {[{ c: '#22c55e', n: green, label: 'Safe' }, { c: '#f97316', n: orange, label: 'Caution' }, { c: '#ef4444', n: red, label: 'Alert' }]
          .filter(v => v.n > 0).map((v, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.55rem', color: v.c, fontWeight: '700' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: v.c, display: 'inline-block', boxShadow: `0 0 3px ${v.c}` }} />
            {v.n}
          </span>
        ))}
        <span style={{ fontSize: '0.5rem', color: '#8B99A8', marginLeft: '0.1rem' }}>
          {mapped.length} stations
        </span>
      </div>
      {/* Left label */}
      <div style={{
        position: 'absolute', top: '0.35rem', left: '0.35rem',
        display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.35rem',
        background: 'rgba(10,22,40,0.75)', borderRadius: '0.25rem',
        border: '1px solid rgba(30,58,95,0.4)', backdropFilter: 'blur(4px)',
      }}>
        <MapPin size={8} color="#8B99A8" />
        <span style={{ fontSize: '0.48rem', color: '#8B99A8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Global Status</span>
      </div>
    </div>
  );
}

// ============================================================
// SECURITY FEE MINI CHART (SVG sparkline with area fill)
// ============================================================
function SecurityFeeMiniChart({ data }) {
  // data = array of { month, est, act }
  if (!data || data.length === 0) return null;
  const W = 280, H = 55, PAD = 4;
  const allVals = data.flatMap(d => [d.est, d.act]).filter(v => v > 0);
  const maxVal = Math.max(...allVals, 1);
  const stepX = (W - PAD * 2) / Math.max(data.length - 1, 1);

  const toPoints = (key) => {
    return data.map((d, i) => ({
      x: PAD + i * stepX,
      y: PAD + (H - PAD * 2) - ((d[key] || 0) / maxVal) * (H - PAD * 2),
      val: d[key] || 0,
    }));
  };

  const toPath = (pts) => {
    const valid = pts.filter(p => p.val > 0);
    if (valid.length < 2) return '';
    return valid.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  };

  const toArea = (pts) => {
    const valid = pts.filter(p => p.val > 0);
    if (valid.length < 2) return '';
    const baseline = H - PAD;
    const line = valid.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return `${line} L${valid[valid.length - 1].x.toFixed(1)},${baseline} L${valid[0].x.toFixed(1)},${baseline} Z`;
  };

  const estPts = toPoints('est');
  const actPts = toPoints('act');
  const estPath = toPath(estPts);
  const actPath = toPath(actPts);
  const estArea = toArea(estPts);
  const actArea = toArea(actPts);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '50px', display: 'block', marginTop: '0.25rem' }}>
      <defs>
        <linearGradient id="estGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34D399" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#34D399" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Baseline */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#1E3A5F" strokeWidth="0.5" opacity="0.3" />
      {/* Area fills */}
      {estArea && <path d={estArea} fill="url(#estGrad)" />}
      {actArea && <path d={actArea} fill="url(#actGrad)" />}
      {/* Est line */}
      {estPath && <path d={estPath} fill="none" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />}
      {/* Act line */}
      {actPath && <path d={actPath} fill="none" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />}
      {/* Dots on last points */}
      {data.map((d, i) => {
        if (i !== data.length - 1) return null;
        const yE = d.est > 0 ? PAD + (H - PAD * 2) - (d.est / maxVal) * (H - PAD * 2) : null;
        const yA = d.act > 0 ? PAD + (H - PAD * 2) - (d.act / maxVal) * (H - PAD * 2) : null;
        const x = PAD + i * stepX;
        return (
          <g key={i}>
            {yE !== null && <><circle cx={x} cy={yE} r="3" fill="#60A5FA" opacity="0.2" /><circle cx={x} cy={yE} r="1.8" fill="#60A5FA" /></>}
            {yA !== null && <><circle cx={x} cy={yA} r="3" fill="#34D399" opacity="0.2" /><circle cx={x} cy={yA} r="1.8" fill="#34D399" /></>}
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================
// HOME PAGE
// ============================================================
function HomePage() {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [latestBulletins, setLatestBulletins] = useState([]);
  const [securityLevels, setSecurityLevels] = useState([]);
  const [feeStats, setFeeStats] = useState({ lastMonthActual: 0, thisMonthEst: 0, totalBranches: 0, chartData: [] });

  useEffect(() => {
    // Fetch bulletins
    getDocs(query(collection(db, 'bulletinPosts'), orderBy('createdAt', 'desc'), limit(5)))
      .then(snap => setLatestBulletins(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(err => console.error('[HomePage] Bulletins:', err));

    // Fetch security levels (for mini map)
    getDocs(collection(db, 'securityLevels'))
      .then(snap => setSecurityLevels(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(err => console.error('[HomePage] SecurityLevels:', err));

    // Fetch fee data summary
    const fetchFeeStats = async () => {
      try {
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastDate = new Date(now.getFullYear(), now.getMonth(), 0);
        const lastMonth = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;

        const snap = await getDocs(collection(db, 'securityCosts'));
        const allCosts = snap.docs.map(d => d.data());

        // Count branches with actual cost data for last month
        const lastMonthDocs = allCosts.filter(d => d.targetMonth === lastMonth);
        const lastMonthBranches = new Set(lastMonthDocs.filter(d => {
          const items = d.costItems || [];
          return items.some(i => parseFloat(i.actualCost) > 0);
        }).map(d => d.branchName));

        // Count branches with est cost data for this month
        const thisMonthDocs = allCosts.filter(d => d.targetMonth === thisMonth);
        const thisMonthBranches = new Set(thisMonthDocs.filter(d => {
          const items = d.costItems || [];
          return items.some(i => parseFloat(i.estimatedCost) > 0);
        }).map(d => d.branchName));

        // Total branches
        const branchSnap = await getDocs(collection(db, 'branchCodes'));
        const totalBranches = branchSnap.docs.length;

        // Chart data: last 6 months aggregate (est + act totals)
        const chartData = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = d.toLocaleString('en-US', { month: 'short' });
          const monthDocs = allCosts.filter(c => c.targetMonth === key);
          let est = 0, act = 0;
          monthDocs.forEach(doc => {
            (doc.costItems || []).forEach(item => {
              est += parseFloat(item.estimatedCost) || 0;
              act += parseFloat(item.actualCost) || 0;
            });
          });
          chartData.push({ month: label, est, act });
        }

        setFeeStats({
          lastMonthActual: lastMonthBranches.size,
          thisMonthEst: thisMonthBranches.size,
          totalBranches,
          chartData,
          lastMonthLabel: lastDate.toLocaleString('en-US', { month: 'short' }),
          thisMonthLabel: now.toLocaleString('en-US', { month: 'short' }),
        });
      } catch (err) {
        console.error('[HomePage] FeeStats:', err);
      }
    };
    fetchFeeStats();
  }, []);

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #132F4C 0%, #1A3A5C 100%)',
        borderRadius: '1rem', padding: '2rem 2.5rem', marginBottom: '1.5rem',
        border: `1px solid ${COLORS.cardBorder}`, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: '-30px', top: '-30px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(233,69,96,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: COLORS.text, marginBottom: '0.5rem', letterSpacing: '0.01em' }}>
            Welcome, {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: COLORS.textSecondary, lineHeight: '1.6', maxWidth: '600px' }}>
            Airzeta Station Security System - Manage security operations, costs, and communications across all stations from one unified portal.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(59,130,246,0.12)', borderRadius: '0.5rem', border: '1px solid rgba(59,130,246,0.2)', fontSize: '0.72rem', color: '#60A5FA', fontWeight: '600' }}>
              {isAdmin ? 'HQ Administrator' : `Station: ${currentUser?.branchName || 'N/A'}`}
            </div>
            <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(16,185,129,0.12)', borderRadius: '0.5rem', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.72rem', color: '#34D399', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Clock size={12} />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <TimeZoneInfo />
        </div>
      </div>

      {/* Module Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* ── Bulletin Card ── */}
        <div
          onClick={() => navigate('/bulletin')}
          style={{
            background: COLORS.card, borderRadius: '0.875rem', border: `1px solid ${COLORS.cardBorder}`,
            padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.accentOrange; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.cardBorder; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '700', letterSpacing: '0.05em', background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(16,185,129,0.3)' }}>ACTIVE</div>
          <div style={{ width: '44px', height: '44px', borderRadius: '0.75rem', background: `${COLORS.accentOrange}15`, border: `1px solid ${COLORS.accentOrange}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <Megaphone size={22} color={COLORS.accentOrange} />
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.text, marginBottom: '0.5rem' }}>Security Bulletin Board</h3>
          <p style={{ fontSize: '0.78rem', color: COLORS.textSecondary, lineHeight: '1.55', marginBottom: '1rem' }}>
            Share security announcements, notices and important updates across all stations.
          </p>
          {latestBulletins.length > 0 && (
            <div style={{ marginBottom: '0.75rem', borderTop: `1px solid ${COLORS.cardBorder}`, paddingTop: '0.6rem' }}>
              {latestBulletins.slice(0, 3).map(post => (
                <div key={post.id}
                  onClick={(e) => { e.stopPropagation(); navigate(`/bulletin/post/${post.id}`); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.4rem', borderRadius: '0.375rem', cursor: 'pointer', transition: 'background 0.15s', marginBottom: '0.2rem' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <FileText size={13} color={COLORS.accentOrange} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.72rem', color: COLORS.text, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{post.title}</span>
                  <span style={{ fontSize: '0.6rem', color: COLORS.textSecondary, flexShrink: 0 }}>
                    {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: COLORS.accentOrange, fontSize: '0.78rem', fontWeight: '600' }}>
            Open module <ArrowRight size={14} />
          </div>
        </div>

        {/* ── Security Fee Card ── */}
        <div
          onClick={() => navigate('/security-fee')}
          style={{
            background: COLORS.card, borderRadius: '0.875rem', border: `1px solid ${COLORS.cardBorder}`,
            padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.accentBlue; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.cardBorder; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '700', letterSpacing: '0.05em', background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(16,185,129,0.3)' }}>ACTIVE</div>
          <div style={{ width: '44px', height: '44px', borderRadius: '0.75rem', background: `${COLORS.accentBlue}15`, border: `1px solid ${COLORS.accentBlue}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <DollarSign size={22} color={COLORS.accentBlue} />
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.text, marginBottom: '0.5rem' }}>Security Fee Management</h3>
          <p style={{ fontSize: '0.78rem', color: COLORS.textSecondary, lineHeight: '1.55', marginBottom: '0.75rem' }}>
            Submit, review and manage station security costs. Upload exchange rates and track monthly budgets.
          </p>

          {/* Fee Stats Summary */}
          {feeStats.totalBranches > 0 && (
            <div style={{ borderTop: `1px solid ${COLORS.cardBorder}`, paddingTop: '0.6rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <div style={{ flex: 1, padding: '0.45rem 0.55rem', background: 'rgba(52,211,153,0.06)', borderRadius: '0.35rem', border: '1px solid rgba(52,211,153,0.12)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginBottom: '0.15rem' }}>
                    <TrendingUp size={10} color="#34D399" />
                    <span style={{ fontSize: '0.52rem', color: '#8B99A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {feeStats.lastMonthLabel || 'Last'} Actual
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#34D399' }}>
                    {feeStats.lastMonthActual}<span style={{ fontSize: '0.6rem', fontWeight: '400', color: '#5F6B7A' }}>/{feeStats.totalBranches} sites</span>
                  </div>
                </div>
                <div style={{ flex: 1, padding: '0.45rem 0.55rem', background: 'rgba(96,165,250,0.06)', borderRadius: '0.35rem', border: '1px solid rgba(96,165,250,0.12)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginBottom: '0.15rem' }}>
                    <TrendingUp size={10} color="#60A5FA" />
                    <span style={{ fontSize: '0.52rem', color: '#8B99A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {feeStats.thisMonthLabel || 'This'} Estimated
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#60A5FA' }}>
                    {feeStats.thisMonthEst}<span style={{ fontSize: '0.6rem', fontWeight: '400', color: '#5F6B7A' }}>/{feeStats.totalBranches} sites</span>
                  </div>
                </div>
              </div>
              {/* Mini sparkline */}
              {feeStats.chartData.some(d => d.est > 0 || d.act > 0) && (
                <div style={{ position: 'relative' }}>
                  <SecurityFeeMiniChart data={feeStats.chartData} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0.15rem' }}>
                    {feeStats.chartData.map((d, i) => (
                      <span key={i} style={{ fontSize: '0.45rem', color: '#5F6B7A', fontFamily: 'monospace' }}>{d.month}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.25rem', justifyContent: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.52rem', color: '#8B99A8' }}>
                      <span style={{ width: '10px', height: '2px', background: '#60A5FA', borderRadius: '1px', display: 'inline-block' }} /> Estimated
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.52rem', color: '#8B99A8' }}>
                      <span style={{ width: '10px', height: '2px', background: '#34D399', borderRadius: '1px', display: 'inline-block' }} /> Actual
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: COLORS.accentBlue, fontSize: '0.78rem', fontWeight: '600' }}>
            Open module <ArrowRight size={14} />
          </div>
        </div>

        {/* ── Security Level Card with Mini Map ── */}
        <div
          onClick={() => navigate('/security-level')}
          style={{
            background: COLORS.card, borderRadius: '0.875rem', border: `1px solid ${COLORS.cardBorder}`,
            padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.accentGreen; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.cardBorder; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '700', letterSpacing: '0.05em', background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(16,185,129,0.3)' }}>ACTIVE</div>
          <div style={{ width: '44px', height: '44px', borderRadius: '0.75rem', background: `${COLORS.accentGreen}15`, border: `1px solid ${COLORS.accentGreen}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <ShieldAlert size={22} color={COLORS.accentGreen} />
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.text, marginBottom: '0.5rem' }}>Security Level</h3>
          <p style={{ fontSize: '0.78rem', color: COLORS.textSecondary, lineHeight: '1.55', marginBottom: '0.75rem' }}>
            Manage aviation security threat levels. View global risk status on an interactive world map.
          </p>

          {/* Mini World Map */}
          {securityLevels.length > 0 && (
            <div style={{ borderTop: `1px solid ${COLORS.cardBorder}`, paddingTop: '0.6rem', marginBottom: '0.75rem' }}>
              <SecurityLevelMiniMap stations={securityLevels} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: COLORS.accentGreen, fontSize: '0.78rem', fontWeight: '600' }}>
            Open module <ArrowRight size={14} />
          </div>
        </div>
      </div>

      {/* Global Security News */}
      <GlobalSecurityNews />

      {/* Security Pledge */}
      <SecurityPledgeCard />
    </div>
  );
}

// ============================================================
// SECURITY PLEDGE AGREEMENT CARD
// ============================================================
function SecurityPledgeCard() {
  const [showModal, setShowModal] = useState(false);
  const pledgeUrl = 'https://mark4mission.github.io/airzeta-security-agreement/';

  return (
    <>
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.card} 0%, #1A3A5C 100%)`,
        borderRadius: '1rem', border: `1px solid ${COLORS.cardBorder}`,
        padding: '1.5rem', marginTop: '0.5rem', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative background element */}
        <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(233,69,96,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '-10px', top: '-10px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(59,130,246,0.03)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <div
            onClick={() => setShowModal(true)}
            style={{
              width: '110px', height: '110px', background: '#ffffff',
              borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, position: 'relative', overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)', padding: '8px', flexDirection: 'column',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)'; }}
          >
            <QRCodeSVG value={pledgeUrl} size={88} level="M" includeMargin={false} bgColor="#ffffff" fgColor="#1a1a1a" />
            <div style={{ fontSize: '0.4rem', color: '#666', textAlign: 'center', marginTop: '2px', fontWeight: '600', letterSpacing: '0.05em' }}>SCAN TO SIGN</div>
          </div>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '0.4rem', background: 'rgba(233,69,96,0.12)', border: '1px solid rgba(233,69,96,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={15} color={COLORS.accent} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.text, margin: 0 }}>Security Pledge Agreement</h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: COLORS.textSecondary, lineHeight: '1.6', margin: '0 0 0.5rem' }}>
              All personnel handling Security Sensitive Information (SSI) must sign the Security Pledge Agreement before accessing restricted materials.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.65rem', color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontWeight: '600' }}>
                SSI Access Required
              </span>
              <span style={{ fontSize: '0.65rem', color: '#60A5FA', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontWeight: '600' }}>
                Mobile Friendly
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => setShowModal(true)} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1rem', borderRadius: '0.5rem',
                background: 'rgba(233,69,96,0.12)', border: '1px solid rgba(233,69,96,0.3)',
                color: COLORS.accent, fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(233,69,96,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(233,69,96,0.12)'; }}
              >
                <QrCode size={15} /> Open Pledge Form
              </button>
              <a href={pledgeUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                background: 'transparent', border: `1px solid ${COLORS.cardBorder}`,
                color: COLORS.textSecondary, fontSize: '0.72rem', fontWeight: '500', cursor: 'pointer', textDecoration: 'none', transition: 'all 0.2s',
              }}>
                <ExternalLink size={12} /> New Tab
              </a>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }} onClick={() => setShowModal(false)}>
          <div style={{ background: COLORS.card, borderRadius: '1rem', border: `1px solid ${COLORS.cardBorder}`, width: '95%', maxWidth: '800px', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: `1px solid ${COLORS.cardBorder}`, background: '#0B1929' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={16} color={COLORS.accent} />
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#E8EAED' }}>Security Pledge Agreement</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <a href={pledgeUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#60A5FA', fontSize: '0.7rem', textDecoration: 'none' }}>
                  <ExternalLink size={12} /> Open in new tab
                </a>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B99A8', padding: '0.2rem' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe src={pledgeUrl} title="Security Pledge Agreement" style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }} allow="camera;microphone" />
          </div>
        </div>
      )}
    </>
  );
}

export default HomePage;
