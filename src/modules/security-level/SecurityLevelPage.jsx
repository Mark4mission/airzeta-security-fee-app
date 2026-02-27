import React, { useState, useEffect, useCallback } from 'react';
import { collection, doc, getDoc, setDoc, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../core/AuthContext';
import { ShieldAlert, Plus, Trash2, Save, Calendar, MapPin, AlertTriangle, CheckCircle, ChevronDown, Globe2, Info } from 'lucide-react';

const COLORS = {
  surface: '#132F4C', surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F', accent: '#E94560', blue: '#3B82F6',
  input: { bg: '#1A3A5C', border: '#2A5080', text: '#E8EAED' },
};

// Color name detection for automatic level coloring
const COLOR_KEYWORDS = {
  green: '#22c55e', blue: '#3b82f6', yellow: '#eab308', orange: '#f97316',
  red: '#ef4444', 초록: '#22c55e', 파랑: '#3b82f6', 노랑: '#eab308',
  주황: '#f97316', 빨강: '#ef4444', 평시: '#22c55e', 관심: '#3b82f6',
  주의: '#eab308', 경계: '#f97316', 심각: '#ef4444',
};

function detectColor(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [keyword, color] of Object.entries(COLOR_KEYWORDS)) {
    if (lower.includes(keyword)) return color;
  }
  return null;
}

// Risk color based on position in levels array (thirds: green/orange/red)
function getRiskColor(index, total) {
  if (total <= 1) return '#22c55e';
  const ratio = index / (total - 1);
  if (ratio < 0.4) return '#22c55e';
  if (ratio < 0.7) return '#f97316';
  return '#ef4444';
}

// Airport coordinates for world map (major IATA codes)
const AIRPORT_COORDS = {
  ICN: { lat: 37.46, lng: 126.44, city: 'Seoul/Incheon' },
  GMP: { lat: 37.56, lng: 126.79, city: 'Seoul/Gimpo' },
  NRT: { lat: 35.76, lng: 140.39, city: 'Tokyo/Narita' },
  KIX: { lat: 34.43, lng: 135.24, city: 'Osaka/Kansai' },
  HND: { lat: 35.55, lng: 139.78, city: 'Tokyo/Haneda' },
  NGO: { lat: 34.86, lng: 136.81, city: 'Nagoya' },
  PVG: { lat: 31.14, lng: 121.81, city: 'Shanghai/Pudong' },
  PEK: { lat: 40.08, lng: 116.58, city: 'Beijing' },
  HKG: { lat: 22.31, lng: 113.92, city: 'Hong Kong' },
  SIN: { lat: 1.36, lng: 103.99, city: 'Singapore' },
  BKK: { lat: 13.69, lng: 100.75, city: 'Bangkok' },
  SGN: { lat: 10.82, lng: 106.65, city: 'Ho Chi Minh' },
  HAN: { lat: 21.22, lng: 105.81, city: 'Hanoi' },
  MNL: { lat: 14.51, lng: 121.02, city: 'Manila' },
  KUL: { lat: 2.75, lng: 101.71, city: 'Kuala Lumpur' },
  CGK: { lat: -6.13, lng: 106.66, city: 'Jakarta' },
  DEL: { lat: 28.57, lng: 77.10, city: 'Delhi' },
  BOM: { lat: 19.09, lng: 72.87, city: 'Mumbai' },
  DXB: { lat: 25.25, lng: 55.36, city: 'Dubai' },
  DOH: { lat: 25.26, lng: 51.57, city: 'Doha' },
  IST: { lat: 41.26, lng: 28.74, city: 'Istanbul' },
  FRA: { lat: 50.03, lng: 8.57, city: 'Frankfurt' },
  CDG: { lat: 49.01, lng: 2.55, city: 'Paris/CDG' },
  LHR: { lat: 51.47, lng: -0.46, city: 'London/Heathrow' },
  AMS: { lat: 52.31, lng: 4.77, city: 'Amsterdam' },
  MAD: { lat: 40.47, lng: -3.57, city: 'Madrid' },
  FCO: { lat: 41.80, lng: 12.24, city: 'Rome' },
  JFK: { lat: 40.64, lng: -73.78, city: 'New York/JFK' },
  LAX: { lat: 33.94, lng: -118.41, city: 'Los Angeles' },
  ORD: { lat: 41.98, lng: -87.90, city: 'Chicago' },
  ATL: { lat: 33.64, lng: -84.43, city: 'Atlanta' },
  SFO: { lat: 37.62, lng: -122.38, city: 'San Francisco' },
  YYZ: { lat: 43.68, lng: -79.63, city: 'Toronto' },
  GRU: { lat: -23.43, lng: -46.47, city: 'Sao Paulo' },
  SYD: { lat: -33.95, lng: 151.18, city: 'Sydney' },
  MEL: { lat: -37.67, lng: 144.84, city: 'Melbourne' },
  NBO: { lat: -1.32, lng: 36.93, city: 'Nairobi' },
  JNB: { lat: -26.14, lng: 28.25, city: 'Johannesburg' },
  CAI: { lat: 30.12, lng: 31.41, city: 'Cairo' },
};

// Convert lat/lng to simple equirectangular projection
function latLngToXY(lat, lng, width, height) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

// ============================================================
// BRANCH USER VIEW: Level Input + Action Guidelines
// ============================================================
function BranchUserView({ currentUser }) {
  const branchName = currentUser?.branchName || '';
  const [levels, setLevels] = useState([]);
  const [activeLevel, setActiveLevel] = useState(0);
  const [activeSince, setActiveSince] = useState('');
  const [guidelines, setGuidelines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!branchName) return;
    const loadData = async () => {
      const snap = await getDoc(doc(db, 'securityLevels', branchName));
      if (snap.exists()) {
        const data = snap.data();
        setLevels(data.levels || []);
        setActiveLevel(data.activeLevel ?? 0);
        setActiveSince(data.activeSince || new Date().toISOString().split('T')[0]);
        setGuidelines(data.guidelines || []);
      } else {
        // Default template (Korean ICN style)
        setLevels([
          { name: 'Normal (Green)', color: '#22c55e' },
          { name: 'Guarded (Blue)', color: '#3b82f6' },
          { name: 'Elevated (Yellow)', color: '#eab308' },
          { name: 'High (Orange)', color: '#f97316' },
          { name: 'Severe (Red)', color: '#ef4444' },
        ]);
        setActiveLevel(0);
        setActiveSince(new Date().toISOString().split('T')[0]);
        setGuidelines([
          { level: 0, action: 'Standard security procedures in effect' },
          { level: 1, action: 'Enhanced screening and monitoring' },
          { level: 2, action: 'Additional access controls and inspections' },
          { level: 3, action: 'Maximum screening, restricted access zones' },
          { level: 4, action: 'Emergency protocols, full lockdown procedures' },
        ]);
      }
    };
    loadData();
  }, [branchName]);

  const handleAddLevel = () => {
    setLevels([...levels, { name: '', color: '#8B99A8' }]);
    setGuidelines([...guidelines, { level: levels.length, action: '' }]);
  };

  const handleRemoveLevel = (idx) => {
    setLevels(levels.filter((_, i) => i !== idx));
    setGuidelines(guidelines.filter((_, i) => i !== idx));
    if (activeLevel >= levels.length - 1) setActiveLevel(Math.max(0, levels.length - 2));
  };

  const handleLevelNameChange = (idx, name) => {
    const updated = [...levels];
    const detectedColor = detectColor(name);
    updated[idx] = { ...updated[idx], name, color: detectedColor || updated[idx].color || '#8B99A8' };
    setLevels(updated);
  };

  const handleLevelColorChange = (idx, color) => {
    const updated = [...levels];
    updated[idx] = { ...updated[idx], color };
    setLevels(updated);
  };

  const handleGuidelineChange = (idx, action) => {
    const updated = [...guidelines];
    if (!updated[idx]) updated[idx] = { level: idx, action: '' };
    updated[idx] = { ...updated[idx], action };
    setGuidelines(updated);
  };

  const handleSave = async () => {
    if (!branchName) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'securityLevels', branchName), {
        branchName,
        levels,
        activeLevel,
        activeSince,
        guidelines,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || 'unknown',
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('[SecurityLevel] Save error:', err);
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceLight} 100%)`,
        borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`,
        padding: '1.5rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(59,130,246,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={22} color={COLORS.blue} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
                {branchName} — Security Level
              </h1>
              <p style={{ fontSize: '0.72rem', color: COLORS.text.secondary, margin: 0 }}>
                Define and manage aviation security threat levels for your station
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Active Level */}
      {levels.length > 0 && (
        <div style={{
          background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`,
          padding: '1.25rem', textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.7rem', fontWeight: '600', color: COLORS.text.secondary, margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Threat Level
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {levels.map((lvl, i) => (
              <button
                key={i}
                onClick={() => setActiveLevel(i)}
                style={{
                  padding: '0.6rem 1.2rem', borderRadius: '0.5rem', cursor: 'pointer',
                  border: activeLevel === i ? `2px solid ${lvl.color || '#8B99A8'}` : `1px solid ${COLORS.border}`,
                  background: activeLevel === i ? `${lvl.color || '#8B99A8'}22` : COLORS.surfaceLight,
                  color: activeLevel === i ? lvl.color || '#E8EAED' : COLORS.text.secondary,
                  fontWeight: activeLevel === i ? '700' : '500',
                  fontSize: '0.82rem',
                  transform: activeLevel === i ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all 0.2s',
                  boxShadow: activeLevel === i ? `0 0 12px ${lvl.color || '#8B99A8'}40` : 'none',
                }}
              >
                {lvl.name || `Level ${i + 1}`}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={14} color={COLORS.text.secondary} />
            <label style={{ fontSize: '0.72rem', color: COLORS.text.secondary }}>Effective since:</label>
            <input
              type="date" value={activeSince}
              onChange={e => setActiveSince(e.target.value)}
              style={{
                padding: '0.3rem 0.5rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                borderRadius: '0.35rem', color: COLORS.input.text, fontSize: '0.75rem',
              }}
            />
          </div>
        </div>
      )}

      {/* Level Editor */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
            Security Levels Configuration
          </h2>
          <button onClick={handleAddLevel} style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.35rem 0.7rem', background: 'rgba(59,130,246,0.12)',
            border: `1px solid rgba(59,130,246,0.3)`, borderRadius: '0.35rem',
            color: COLORS.blue, fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer',
          }}>
            <Plus size={13} /> Add Level
          </button>
        </div>
        <div style={{ fontSize: '0.65rem', color: COLORS.text.light, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Info size={11} /> Tip: Include color names (Green, Blue, Yellow, Orange, Red) and the color will auto-detect.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {levels.map((lvl, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.6rem', background: COLORS.surfaceLight,
              borderRadius: '0.4rem', border: `1px solid ${COLORS.border}`,
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, width: '1.5rem', textAlign: 'center' }}>
                {i + 1}
              </span>
              <input
                type="color" value={lvl.color || '#8B99A8'}
                onChange={e => handleLevelColorChange(i, e.target.value)}
                style={{ width: '28px', height: '28px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              />
              <input
                type="text" value={lvl.name} placeholder={`Level ${i + 1} name (e.g., Normal/Green)`}
                onChange={e => handleLevelNameChange(i, e.target.value)}
                style={{
                  flex: 1, padding: '0.4rem 0.6rem', background: COLORS.input.bg,
                  border: `1px solid ${COLORS.input.border}`, borderRadius: '0.35rem',
                  color: COLORS.input.text, fontSize: '0.8rem',
                }}
              />
              <button onClick={() => handleRemoveLevel(i)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', padding: '0.2rem',
              }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action Guidelines Table */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary, margin: '0 0 1rem' }}>
          Action Guidelines per Level
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {levels.map((lvl, i) => (
            <div key={i} style={{
              display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
            }}>
              <div style={{
                padding: '0.4rem 0.6rem', borderRadius: '0.35rem', fontSize: '0.72rem',
                fontWeight: '600', minWidth: '100px', textAlign: 'center', flexShrink: 0,
                background: `${lvl.color || '#8B99A8'}18`, color: lvl.color || '#8B99A8',
                border: `1px solid ${lvl.color || '#8B99A8'}40`,
              }}>
                {lvl.name || `Level ${i + 1}`}
              </div>
              <textarea
                value={guidelines[i]?.action || ''}
                onChange={e => handleGuidelineChange(i, e.target.value)}
                placeholder="Describe actions and procedures for this level..."
                rows={2}
                style={{
                  flex: 1, padding: '0.4rem 0.6rem', background: COLORS.input.bg,
                  border: `1px solid ${COLORS.input.border}`, borderRadius: '0.35rem',
                  color: COLORS.input.text, fontSize: '0.78rem', lineHeight: '1.5',
                  resize: 'vertical', minHeight: '40px',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <button onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.6rem 1.5rem', borderRadius: '0.5rem', border: 'none',
          background: saved ? '#22c55e' : saving ? COLORS.text.light : COLORS.accent,
          color: 'white', fontSize: '0.85rem', fontWeight: '700',
          cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
        }}>
          {saved ? <><CheckCircle size={16} /> Saved!</> : saving ? <><Save size={16} /> Saving...</> : <><Save size={16} /> Save Configuration</>}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN VIEW: World Map with Security Levels
// ============================================================
function AdminWorldMapView() {
  const [allLevels, setAllLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredStation, setHoveredStation] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'securityLevels'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllLevels(data);
      } catch (err) {
        console.error('[SecurityLevel] Load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: COLORS.text.secondary }}>Loading security levels...</div>;
  }

  const mapWidth = 900;
  const mapHeight = 450;

  // Get stations with coordinates
  const stationsWithCoords = allLevels.filter(s => {
    const code = s.branchName?.toUpperCase();
    return AIRPORT_COORDS[code];
  }).map(s => {
    const code = s.branchName.toUpperCase();
    const coords = AIRPORT_COORDS[code];
    const activeIdx = s.activeLevel ?? 0;
    const totalLevels = s.levels?.length || 1;
    const activeLevelData = s.levels?.[activeIdx];
    const riskColor = activeLevelData?.color || getRiskColor(activeIdx, totalLevels);
    const pos = latLngToXY(coords.lat, coords.lng, mapWidth, mapHeight);
    return { ...s, code, coords, pos, riskColor, activeLevelData, activeIdx };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceLight} 100%)`,
        borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: 'rgba(233,69,96,0.12)', border: '1px solid rgba(233,69,96,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe2 size={22} color={COLORS.accent} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
              Global Security Level Overview
            </h1>
            <p style={{ fontSize: '0.72rem', color: COLORS.text.secondary, margin: 0 }}>
              {stationsWithCoords.length} stations reporting — Real-time threat level visualization
            </p>
          </div>
        </div>
      </div>

      {/* World Map */}
      <div style={{
        background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`,
        padding: '1rem', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: `${mapWidth}px`, margin: '0 auto' }}>
          <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} style={{ width: '100%', height: 'auto', background: '#0a1628', borderRadius: '0.5rem' }}>
            {/* Simple world map outline (simplified continents) */}
            <defs>
              <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1a3a5c" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0a1628" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width={mapWidth} height={mapHeight} fill="#0a1628" />
            {/* Grid lines */}
            {[...Array(7)].map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i * (mapHeight / 6)} x2={mapWidth} y2={i * (mapHeight / 6)} stroke="#1E3A5F" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.3" />
            ))}
            {[...Array(13)].map((_, i) => (
              <line key={`v${i}`} x1={i * (mapWidth / 12)} y1="0" x2={i * (mapWidth / 12)} y2={mapHeight} stroke="#1E3A5F" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.3" />
            ))}
            {/* Simplified continent outlines */}
            <ellipse cx={mapWidth * 0.15} cy={mapHeight * 0.35} rx={80} ry={55} fill="#132F4C" opacity="0.4" />
            <ellipse cx={mapWidth * 0.22} cy={mapHeight * 0.6} rx={40} ry={60} fill="#132F4C" opacity="0.4" />
            <ellipse cx={mapWidth * 0.48} cy={mapHeight * 0.3} rx={80} ry={40} fill="#132F4C" opacity="0.4" />
            <ellipse cx={mapWidth * 0.5} cy={mapHeight * 0.55} rx={50} ry={45} fill="#132F4C" opacity="0.4" />
            <ellipse cx={mapWidth * 0.75} cy={mapHeight * 0.35} rx={90} ry={50} fill="#132F4C" opacity="0.4" />
            <ellipse cx={mapWidth * 0.68} cy={mapHeight * 0.5} rx={40} ry={25} fill="#132F4C" opacity="0.4" />
            <ellipse cx={mapWidth * 0.85} cy={mapHeight * 0.7} rx={35} ry={25} fill="#132F4C" opacity="0.4" />

            {/* Station markers */}
            {stationsWithCoords.map(station => (
              <g key={station.code}
                onMouseEnter={() => setHoveredStation(station.code)}
                onMouseLeave={() => setHoveredStation(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Pulse ring */}
                <circle cx={station.pos.x} cy={station.pos.y} r={12} fill={station.riskColor} opacity="0.15">
                  <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2s" repeatCount="indefinite" />
                </circle>
                {/* Main dot */}
                <circle cx={station.pos.x} cy={station.pos.y} r={5} fill={station.riskColor} stroke="#0a1628" strokeWidth="1.5" />
                {/* Label */}
                <text x={station.pos.x} y={station.pos.y - 9} textAnchor="middle" fill="#E8EAED" fontSize="7" fontWeight="700" fontFamily="system-ui">
                  {station.code}
                </text>
              </g>
            ))}
          </svg>

          {/* Hover tooltip */}
          {hoveredStation && (() => {
            const station = stationsWithCoords.find(s => s.code === hoveredStation);
            if (!station) return null;
            return (
              <div style={{
                position: 'absolute', left: `${(station.pos.x / mapWidth) * 100}%`,
                top: `${(station.pos.y / mapHeight) * 100 - 15}%`,
                transform: 'translate(-50%, -100%)',
                background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                borderRadius: '0.5rem', padding: '0.6rem 0.8rem', zIndex: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)', minWidth: '160px',
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: COLORS.text.primary, marginBottom: '0.25rem' }}>
                  {station.code} — {station.coords.city}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: station.riskColor, display: 'inline-block',
                  }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: '600', color: station.riskColor }}>
                    {station.activeLevelData?.name || `Level ${station.activeIdx + 1}`}
                  </span>
                </div>
                {station.activeSince && (
                  <div style={{ fontSize: '0.62rem', color: COLORS.text.light }}>
                    Since: {station.activeSince}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { color: '#22c55e', label: 'Safe / Normal' },
            { color: '#f97316', label: 'Caution / Elevated' },
            { color: '#ef4444', label: 'Alert / High' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: COLORS.text.secondary }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Station List */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: COLORS.text.primary, margin: '0 0 1rem' }}>
          All Station Security Levels
        </h2>
        {allLevels.length === 0 ? (
          <p style={{ color: COLORS.text.light, fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>
            No stations have configured security levels yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.6rem' }}>
            {allLevels.map(station => {
              const activeIdx = station.activeLevel ?? 0;
              const activeLvl = station.levels?.[activeIdx];
              const riskColor = activeLvl?.color || getRiskColor(activeIdx, station.levels?.length || 1);
              return (
                <div key={station.id} style={{
                  padding: '0.8rem', background: COLORS.surfaceLight,
                  borderRadius: '0.5rem', border: `1px solid ${COLORS.border}`,
                  borderLeft: `3px solid ${riskColor}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary }}>
                      {station.branchName}
                    </span>
                    <span style={{
                      padding: '0.15rem 0.45rem', borderRadius: '9999px', fontSize: '0.62rem',
                      fontWeight: '700', background: `${riskColor}20`, color: riskColor,
                      border: `1px solid ${riskColor}40`,
                    }}>
                      {activeLvl?.name || `Level ${activeIdx + 1}`}
                    </span>
                  </div>
                  {station.activeSince && (
                    <div style={{ fontSize: '0.65rem', color: COLORS.text.light, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={10} /> Since {station.activeSince}
                    </div>
                  )}
                  {/* Mini level bar */}
                  <div style={{ display: 'flex', gap: '2px', marginTop: '0.4rem' }}>
                    {(station.levels || []).map((lvl, i) => (
                      <div key={i} style={{
                        flex: 1, height: '4px', borderRadius: '2px',
                        background: i === activeIdx ? (lvl.color || riskColor) : `${COLORS.border}`,
                        opacity: i === activeIdx ? 1 : 0.4,
                      }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function SecurityLevelPage() {
  const { currentUser, isAdmin } = useAuth();

  return isAdmin ? <AdminWorldMapView /> : <BranchUserView currentUser={currentUser} />;
}
