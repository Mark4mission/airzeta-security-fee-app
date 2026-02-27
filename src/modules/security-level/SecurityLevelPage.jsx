import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { collection, doc, getDoc, setDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../core/AuthContext';
import { ShieldAlert, Plus, Trash2, Save, Calendar, AlertTriangle, CheckCircle, Globe2, Info, History, Palette, ChevronDown, ChevronUp, X, MapPin, ArrowLeft, Edit3, Eye } from 'lucide-react';
import * as topojson from 'topojson-client';

const COLORS = {
  surface: '#132F4C', surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F', accent: '#E94560', blue: '#3B82F6',
  input: { bg: '#1A3A5C', border: '#2A5080', text: '#E8EAED' },
};

const COLOR_KEYWORDS = {
  green: '#22c55e', blue: '#3b82f6', yellow: '#eab308', orange: '#f97316',
  red: '#ef4444', white: '#f8fafc', gray: '#94a3b8', grey: '#94a3b8',
  '\ucd08\ub85d': '#22c55e', '\ud30c\ub791': '#3b82f6', '\ub178\ub791': '#eab308',
  '\uc8fc\ud669': '#f97316', '\ube68\uac15': '#ef4444',
  '\ud3c9\uc2dc': '#22c55e', '\uad00\uc2ec': '#3b82f6',
  '\uc8fc\uc758': '#eab308', '\uacbd\uacc4': '#f97316', '\uc2ec\uac01': '#ef4444',
};

function detectColor(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [keyword, color] of Object.entries(COLOR_KEYWORDS)) {
    if (lower.includes(keyword)) return color;
  }
  return null;
}

function getRiskColor(index, total) {
  if (total <= 1) return '#22c55e';
  const ratio = index / (total - 1);
  if (ratio < 0.4) return '#22c55e';
  if (ratio < 0.7) return '#f97316';
  return '#ef4444';
}

function getRiskTier(activeIdx, totalLevels, levelColor) {
  if (levelColor) {
    const lc = levelColor.toLowerCase();
    if (['#22c55e', '#3b82f6', '#f8fafc', '#94a3b8'].includes(lc)) return '#22c55e';
    if (['#eab308', '#f97316'].includes(lc)) return '#f97316';
    if (lc === '#ef4444') return '#ef4444';
  }
  return getRiskColor(activeIdx, totalLevels);
}

/** Extract IATA 3-letter code from branchName — e.g. "HANSF" → "HAN", "ICN01" → "ICN" */
function extractIATA(branchName) {
  if (!branchName) return null;
  const clean = branchName.replace(/[^A-Za-z]/g, '').toUpperCase();
  return clean.length >= 3 ? clean.substring(0, 3) : clean;
}

// Airport coordinates
const AIRPORT_COORDS = {
  ICN: { lat: 37.46, lng: 126.44, city: 'Seoul/Incheon' },
  GMP: { lat: 37.56, lng: 126.79, city: 'Seoul/Gimpo' },
  NRT: { lat: 35.76, lng: 140.39, city: 'Tokyo/Narita' },
  KIX: { lat: 34.43, lng: 135.24, city: 'Osaka/Kansai' },
  HND: { lat: 35.55, lng: 139.78, city: 'Tokyo/Haneda' },
  NGO: { lat: 34.86, lng: 136.81, city: 'Nagoya' },
  FUK: { lat: 33.59, lng: 130.45, city: 'Fukuoka' },
  PVG: { lat: 31.14, lng: 121.81, city: 'Shanghai/Pudong' },
  PEK: { lat: 40.08, lng: 116.58, city: 'Beijing' },
  CAN: { lat: 23.39, lng: 113.30, city: 'Guangzhou' },
  HKG: { lat: 22.31, lng: 113.92, city: 'Hong Kong' },
  TPE: { lat: 25.08, lng: 121.23, city: 'Taipei' },
  SIN: { lat: 1.36, lng: 103.99, city: 'Singapore' },
  BKK: { lat: 13.69, lng: 100.75, city: 'Bangkok' },
  SGN: { lat: 10.82, lng: 106.65, city: 'Ho Chi Minh' },
  HAN: { lat: 21.22, lng: 105.81, city: 'Hanoi' },
  MNL: { lat: 14.51, lng: 121.02, city: 'Manila' },
  CEB: { lat: 10.31, lng: 123.98, city: 'Cebu' },
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
  DAD: { lat: 16.05, lng: 108.20, city: 'Da Nang' },
  CTS: { lat: 42.78, lng: 141.69, city: 'Sapporo' },
  KMG: { lat: 24.99, lng: 102.74, city: 'Kunming' },
  TAO: { lat: 36.27, lng: 120.37, city: 'Qingdao' },
  DPS: { lat: -8.75, lng: 115.17, city: 'Bali' },
  CMB: { lat: 7.18, lng: 79.88, city: 'Colombo' },
  ADD: { lat: 8.98, lng: 38.80, city: 'Addis Ababa' },
  LIM: { lat: -12.02, lng: -77.11, city: 'Lima' },
  MEX: { lat: 19.44, lng: -99.07, city: 'Mexico City' },
  SCL: { lat: -33.39, lng: -70.79, city: 'Santiago' },
  EZE: { lat: -34.82, lng: -58.54, city: 'Buenos Aires' },
  MUC: { lat: 48.35, lng: 11.79, city: 'Munich' },
  ZRH: { lat: 47.46, lng: 8.55, city: 'Zurich' },
  BCN: { lat: 41.30, lng: 2.08, city: 'Barcelona' },
};

// ============================================================
// SVG GEO PROJECTION — Natural Earth–like Mercator
// ============================================================
const MAP_W = 960;
const MAP_H = 500;

function projectGeo(lng, lat) {
  // Robinson-like projection
  const x = ((lng + 180) / 360) * MAP_W;
  const latRad = (lat * Math.PI) / 180;
  const maxLat = 85;
  const maxLatRad = (maxLat * Math.PI) / 180;
  // Mercator with clamping
  const mercY = Math.log(Math.tan(Math.PI / 4 + Math.min(Math.max(latRad, -maxLatRad), maxLatRad) / 2));
  const maxMercY = Math.log(Math.tan(Math.PI / 4 + maxLatRad / 2));
  const y = MAP_H / 2 - (mercY / maxMercY) * (MAP_H / 2);
  return [x, y];
}

function geoPathFromRing(ring) {
  if (!ring || ring.length === 0) return '';
  const parts = ring.map((coord, i) => {
    const [x, y] = projectGeo(coord[0], coord[1]);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return parts.join(' ') + ' Z';
}

function geoPathFromGeometry(geometry) {
  if (!geometry) return '';
  const paths = [];
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => paths.push(geoPathFromRing(ring)));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(polygon => {
      polygon.forEach(ring => paths.push(geoPathFromRing(ring)));
    });
  }
  return paths.join(' ');
}

// ============================================================
// BRANCH USER VIEW — also used when admin clicks into a station
// ============================================================
function BranchUserView({ currentUser, stationId, onBack, isAdminEditing }) {
  const branchName = stationId || currentUser?.branchName || '';
  const [levels, setLevels] = useState([]);
  const [activeLevel, setActiveLevel] = useState(0);
  const [activeSince, setActiveSince] = useState('');
  const [guidelines, setGuidelines] = useState([]);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

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
        setHistory(data.history || []);
      } else {
        setLevels([{ name: 'Level 1' }, { name: 'Level 2' }, { name: 'Level 3' }]);
        setActiveLevel(0);
        setActiveSince(new Date().toISOString().split('T')[0]);
        setGuidelines([
          { level: 0, action: 'Standard security procedures in effect' },
          { level: 1, action: 'Enhanced screening and monitoring' },
          { level: 2, action: 'Maximum screening, restricted access zones' },
        ]);
        setHistory([]);
      }
    };
    loadData();
  }, [branchName]);

  const handleAddLevel = () => {
    setLevels([...levels, { name: '' }]);
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
    updated[idx] = { ...updated[idx], name };
    if (detectedColor) updated[idx].color = detectedColor;
    setLevels(updated);
  };
  const handleLevelColorChange = (idx, color) => {
    const updated = [...levels];
    updated[idx] = { ...updated[idx], color };
    setLevels(updated);
  };
  const handleRemoveColor = (idx) => {
    const updated = [...levels];
    delete updated[idx].color;
    setLevels(updated);
  };
  const handleGuidelineChange = (idx, action) => {
    const updated = [...guidelines];
    if (!updated[idx]) updated[idx] = { level: idx, action: '' };
    updated[idx] = { ...updated[idx], action };
    setGuidelines(updated);
  };
  const handleSelectLevel = (idx) => {
    if (idx === activeLevel) return;
    const prevLevel = activeLevel;
    setActiveLevel(idx);
    setActiveSince(new Date().toISOString().split('T')[0]);
    const newEntry = {
      from: levels[prevLevel]?.name || `Level ${prevLevel + 1}`,
      to: levels[idx]?.name || `Level ${idx + 1}`,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
    };
    setHistory(prev => [newEntry, ...prev].slice(0, 50));
  };
  const handleDeleteHistory = (idx) => {
    if (!window.confirm('Delete this history entry?')) return;
    setHistory(prev => prev.filter((_, i) => i !== idx));
  };
  const handleSave = async () => {
    if (!branchName) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'securityLevels', branchName), {
        branchName, levels, activeLevel, activeSince, guidelines, history,
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

  const getLevelColor = (lvl, idx) => lvl.color || getRiskColor(idx, levels.length);
  const maxLevelChars = Math.max(...levels.map(l => (l.name || 'Level X').length), 8);
  const btnMinWidth = `${Math.max(100, maxLevelChars * 9)}px`;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Back button when admin is editing a station */}
      {onBack && (
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.7rem',
          background: 'rgba(59,130,246,0.08)', border: `1px solid rgba(59,130,246,0.2)`,
          borderRadius: '0.4rem', color: COLORS.blue, fontSize: '0.75rem', fontWeight: '600',
          cursor: 'pointer', alignSelf: 'flex-start',
        }}>
          <ArrowLeft size={14} /> Back to Global Overview
        </button>
      )}

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceLight} 100%)`,
        borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`,
        padding: '1.5rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(59,130,246,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: isAdminEditing ? 'rgba(233,69,96,0.12)' : 'rgba(59,130,246,0.12)', border: `1px solid ${isAdminEditing ? 'rgba(233,69,96,0.2)' : 'rgba(59,130,246,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={22} color={isAdminEditing ? COLORS.accent : COLORS.blue} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: '700', color: COLORS.text.primary, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {branchName} — Security Level
              {isAdminEditing && (
                <span style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(233,69,96,0.12)', color: COLORS.accent, border: '1px solid rgba(233,69,96,0.2)', fontWeight: '700' }}>
                  ADMIN EDIT
                </span>
              )}
            </h1>
            <p style={{ fontSize: '0.72rem', color: COLORS.text.secondary, margin: 0 }}>
              {isAdminEditing ? 'Editing station configuration as administrator' : 'Define and manage aviation security threat levels for your station'}
            </p>
          </div>
        </div>
      </div>

      {/* Current Active Level selector */}
      {levels.length > 0 && (
        <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: '600', color: COLORS.text.secondary, margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Threat Level
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {levels.map((lvl, i) => {
              const color = getLevelColor(lvl, i);
              const hasExplicitColor = !!lvl.color;
              const isActive = activeLevel === i;
              return (
                <button key={i} onClick={() => handleSelectLevel(i)} style={{
                  padding: '0.6rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer',
                  width: btnMinWidth, minWidth: btnMinWidth,
                  border: isActive ? `2px solid ${color}` : `1px solid ${COLORS.border}`,
                  background: isActive ? (hasExplicitColor ? `${color}22` : 'rgba(59,130,246,0.12)') : COLORS.surfaceLight,
                  color: isActive ? color : COLORS.text.secondary,
                  fontWeight: isActive ? '700' : '500', fontSize: '0.8rem',
                  transform: isActive ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.2s',
                  boxShadow: isActive ? `0 0 12px ${color}40` : 'none', textAlign: 'center',
                }}>
                  {hasExplicitColor && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: color, marginRight: '0.35rem', verticalAlign: 'middle', border: '1px solid rgba(255,255,255,0.2)' }} />}
                  {lvl.name || `Level ${i + 1}`}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={14} color={COLORS.text.secondary} />
            <label style={{ fontSize: '0.72rem', color: COLORS.text.secondary }}>Effective since:</label>
            <input type="date" value={activeSince} onChange={e => setActiveSince(e.target.value)}
              style={{ padding: '0.3rem 0.5rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.35rem', color: COLORS.input.text, fontSize: '0.75rem' }} />
          </div>
        </div>
      )}

      {/* Level Editor */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>Security Levels Configuration</h2>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button onClick={() => setShowColorPicker(!showColorPicker)} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.6rem',
              background: showColorPicker ? 'rgba(59,130,246,0.12)' : COLORS.surfaceLight,
              border: `1px solid ${showColorPicker ? 'rgba(59,130,246,0.3)' : COLORS.border}`, borderRadius: '0.35rem',
              color: showColorPicker ? COLORS.blue : COLORS.text.secondary, fontSize: '0.68rem', fontWeight: '600', cursor: 'pointer',
            }}>
              <Palette size={12} /> {showColorPicker ? 'Hide Colors' : 'Colors (Optional)'}
            </button>
            <button onClick={handleAddLevel} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.7rem',
              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '0.35rem',
              color: COLORS.blue, fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer',
            }}>
              <Plus size={13} /> Add Level
            </button>
          </div>
        </div>
        {showColorPicker && (
          <div style={{ fontSize: '0.62rem', color: COLORS.text.light, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.5rem', background: 'rgba(59,130,246,0.05)', borderRadius: '0.25rem', border: '1px solid rgba(59,130,246,0.1)' }}>
            <Info size={10} /> Colors are optional. Include color names (Green, Blue, Yellow, Orange, Red) for auto-detection, or pick manually.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {levels.map((lvl, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.6rem', background: COLORS.surfaceLight, borderRadius: '0.4rem', border: `1px solid ${COLORS.border}` }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, width: '1.5rem', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
              {showColorPicker && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                  <input type="color" value={lvl.color || '#8B99A8'} onChange={e => handleLevelColorChange(i, e.target.value)}
                    style={{ width: '26px', height: '26px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                  {lvl.color && (
                    <button onClick={() => handleRemoveColor(i)} title="Remove color" style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.text.light, padding: '0' }}>
                      <X size={10} />
                    </button>
                  )}
                </div>
              )}
              <input type="text" value={lvl.name} placeholder={`Level ${i + 1} name`} onChange={e => handleLevelNameChange(i, e.target.value)}
                style={{ flex: 1, padding: '0.4rem 0.6rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.35rem', color: COLORS.input.text, fontSize: '0.8rem' }} />
              {lvl.color && <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: lvl.color, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />}
              <button onClick={() => handleRemoveLevel(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', padding: '0.2rem', flexShrink: 0 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action Guidelines — aligned */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary, margin: '0 0 1rem' }}>Action Guidelines per Level</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {levels.map((lvl, i) => {
            const color = getLevelColor(lvl, i);
            const hasColor = !!lvl.color;
            return (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{
                  padding: '0.4rem 0.5rem', borderRadius: '0.35rem', fontSize: '0.72rem', fontWeight: '600',
                  width: btnMinWidth, minWidth: btnMinWidth, textAlign: 'center', flexShrink: 0, boxSizing: 'border-box',
                  background: hasColor ? `${color}18` : 'rgba(59,130,246,0.08)',
                  color: hasColor ? color : COLORS.text.secondary,
                  border: `1px solid ${hasColor ? `${color}40` : 'rgba(59,130,246,0.15)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
                }}>
                  {hasColor && <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />}
                  {lvl.name || `Level ${i + 1}`}
                </div>
                <textarea value={guidelines[i]?.action || ''} onChange={e => handleGuidelineChange(i, e.target.value)}
                  placeholder="Describe actions and procedures for this level..." rows={2}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.35rem', color: COLORS.input.text, fontSize: '0.78rem', lineHeight: '1.5', resize: 'vertical', minHeight: '40px' }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Level Change History with delete */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem' }}>
        <button onClick={() => setShowHistory(!showHistory)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, margin: '0 0 0.5rem' }}>
          <History size={16} color={COLORS.blue} />
          <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary, margin: 0, flex: 1, textAlign: 'left' }}>Level Change History</h2>
          <span style={{ fontSize: '0.6rem', color: COLORS.text.light, background: COLORS.surfaceLight, padding: '0.15rem 0.4rem', borderRadius: '9999px' }}>{history.length}</span>
          {showHistory ? <ChevronUp size={14} color={COLORS.text.light} /> : <ChevronDown size={14} color={COLORS.text.light} />}
        </button>
        {showHistory && (
          history.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: COLORS.text.light, textAlign: 'center', padding: '1rem' }}>No level changes recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '280px', overflowY: 'auto' }}>
              {history.map((entry, i) => {
                const toLvl = levels.find(l => l.name === entry.to);
                const toColor = toLvl?.color || COLORS.text.primary;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.5rem',
                    background: COLORS.surfaceLight, borderRadius: '0.35rem', fontSize: '0.72rem',
                    borderLeft: toLvl?.color ? `3px solid ${toLvl.color}` : `3px solid ${COLORS.border}`,
                  }}>
                    <Calendar size={11} color={COLORS.text.light} style={{ flexShrink: 0 }} />
                    <span style={{ color: COLORS.text.light, fontFamily: 'monospace', fontSize: '0.66rem', flexShrink: 0, minWidth: '70px' }}>{entry.date}</span>
                    <span style={{ color: COLORS.text.secondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.from} {'\u2192'} <span style={{ color: toColor, fontWeight: '600' }}>{entry.to}</span>
                    </span>
                    <button onClick={() => handleDeleteHistory(i)} title="Delete this entry"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', padding: '0.1rem', flexShrink: 0, opacity: 0.6, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <button onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.5rem', borderRadius: '0.5rem', border: 'none',
          background: saved ? '#22c55e' : saving ? COLORS.text.light : COLORS.accent,
          color: 'white', fontSize: '0.85rem', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
        }}>
          {saved ? <><CheckCircle size={16} /> Saved!</> : saving ? <><Save size={16} /> Saving...</> : <><Save size={16} /> Save Configuration</>}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN VIEW: Real World Map with TopoJSON
// ============================================================
function AdminWorldMapView({ currentUser, onEditStation }) {
  const [allLevels, setAllLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [geoData, setGeoData] = useState(null);
  const [hoveredStation, setHoveredStation] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    // Load map data + Firestore data concurrently
    Promise.all([
      fetch('/countries-110m.json').then(r => r.json()).catch(() => null),
      getDocs(collection(db, 'securityLevels')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))).catch(() => []),
    ]).then(([topo, data]) => {
      if (topo) {
        try {
          const countries = topojson.feature(topo, topo.objects.countries);
          setGeoData(countries);
        } catch (e) {
          console.error('[Map] TopoJSON parse error:', e);
        }
      }
      setAllLevels(data);
      setLoading(false);
    });
  }, []);

  // Generate SVG paths from GeoJSON
  const countryPaths = useMemo(() => {
    if (!geoData) return [];
    return geoData.features.map((feature, i) => ({
      key: feature.id || i,
      d: geoPathFromGeometry(feature.geometry),
    }));
  }, [geoData]);

  // Build station data — use IATA from first 3 chars of branchName
  const stationData = useMemo(() => {
    return allLevels.map(s => {
      const rawCode = s.branchName || s.id;
      const iata = extractIATA(rawCode);
      const coords = AIRPORT_COORDS[iata] || AIRPORT_COORDS[rawCode?.toUpperCase()];
      const activeIdx = s.activeLevel ?? 0;
      const totalLevels = s.levels?.length || 1;
      const activeLevelData = s.levels?.[activeIdx];
      const riskColor = getRiskTier(activeIdx, totalLevels, activeLevelData?.color);
      const pos = coords ? projectGeo(coords.lng, coords.lat) : null;
      return {
        ...s, rawCode, iata, coords, pos: pos ? { x: pos[0], y: pos[1] } : null,
        riskColor, activeLevelData, activeIdx, hasCoords: !!coords,
      };
    });
  }, [allLevels]);

  const mappedStations = stationData.filter(s => s.hasCoords);
  const unmappedStations = stationData.filter(s => !s.hasCoords);

  const greenCount = stationData.filter(s => s.riskColor === '#22c55e').length;
  const orangeCount = stationData.filter(s => s.riskColor === '#f97316').length;
  const redCount = stationData.filter(s => s.riskColor === '#ef4444').length;

  const handleStationHover = (station, e) => {
    setHoveredStation(station.rawCode);
    if (svgRef.current && e) {
      const rect = svgRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: COLORS.text.secondary }}>
        <Globe2 size={32} style={{ animation: 'spin 2s linear infinite', marginBottom: '0.5rem' }} />
        <p>Loading global security data...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceLight} 100%)`,
        borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: 'rgba(233,69,96,0.12)', border: '1px solid rgba(233,69,96,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe2 size={22} color={COLORS.accent} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.15rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>Global Security Level Overview</h1>
            <p style={{ fontSize: '0.72rem', color: COLORS.text.secondary, margin: 0 }}>
              {stationData.length} station{stationData.length !== 1 ? 's' : ''} reporting ({mappedStations.length} on map) — Click a station card to edit
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[{ color: '#22c55e', count: greenCount, label: 'Safe' }, { color: '#f97316', count: orangeCount, label: 'Caution' }, { color: '#ef4444', count: redCount, label: 'Alert' }]
              .filter(b => b.count > 0).map(b => (
                <span key={b.label} style={{ padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.6rem', fontWeight: '700', background: `${b.color}20`, color: b.color, border: `1px solid ${b.color}40`, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: b.color }} />{b.count} {b.label}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* World Map */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '0.75rem', overflow: 'hidden' }}>
        <div ref={svgRef} style={{ position: 'relative', width: '100%' }}>
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: '100%', height: 'auto', background: 'linear-gradient(180deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)', borderRadius: '0.5rem', display: 'block' }}>
            <defs>
              <radialGradient id="ocean-glow" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#1a2d4a" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#0a1628" stopOpacity="0" />
              </radialGradient>
              <filter id="marker-shadow" x="-100%" y="-100%" width="300%" height="300%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
              </filter>
            </defs>

            <rect width={MAP_W} height={MAP_H} fill="url(#ocean-glow)" />

            {/* Latitude/longitude grid */}
            {[-60, -30, 0, 30, 60].map(lat => {
              const [, y] = projectGeo(0, lat);
              return <line key={`lat${lat}`} x1="0" y1={y} x2={MAP_W} y2={y} stroke="#1E3A5F" strokeWidth="0.3" strokeDasharray="3,5" opacity="0.2" />;
            })}
            {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map(lng => {
              const [x] = projectGeo(lng, 0);
              return <line key={`lng${lng}`} x1={x} y1="0" x2={x} y2={MAP_H} stroke="#1E3A5F" strokeWidth="0.3" strokeDasharray="3,5" opacity="0.2" />;
            })}

            {/* Country/continent fills from TopoJSON */}
            {countryPaths.map(cp => (
              <path key={cp.key} d={cp.d} fill="#172e4a" stroke="#1E4D7A" strokeWidth="0.4" opacity="0.85" />
            ))}

            {/* Fallback if no geo loaded */}
            {countryPaths.length === 0 && (
              <text x={MAP_W / 2} y={MAP_H / 2} textAnchor="middle" fill={COLORS.text.light} fontSize="14">Loading map data...</text>
            )}

            {/* Station markers — sorted so red renders on top */}
            {[...mappedStations].sort((a, b) => {
              const ord = { '#22c55e': 0, '#f97316': 1, '#ef4444': 2 };
              return (ord[a.riskColor] || 0) - (ord[b.riskColor] || 0);
            }).map(station => {
              const isHovered = hoveredStation === station.rawCode;
              const r = isHovered ? 7 : 5;
              return (
                <g key={station.rawCode}
                  onMouseEnter={e => handleStationHover(station, e.nativeEvent)}
                  onMouseLeave={() => { setHoveredStation(null); setTooltipPos(null); }}
                  onMouseMove={e => { if (svgRef.current) { const rect = svgRef.current.getBoundingClientRect(); setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); }}}
                  onClick={() => onEditStation(station.rawCode)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Pulse */}
                  <circle cx={station.pos.x} cy={station.pos.y} r="12" fill="none" stroke={station.riskColor} strokeWidth="0.8" opacity="0.25">
                    <animate attributeName="r" values="6;14;6" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
                  </circle>
                  {/* Halo */}
                  <circle cx={station.pos.x} cy={station.pos.y} r={r + 3} fill={station.riskColor} opacity={isHovered ? 0.18 : 0.08} />
                  {/* Dot */}
                  <circle cx={station.pos.x} cy={station.pos.y} r={r} fill={station.riskColor} stroke="#0a1628" strokeWidth="1.5" filter="url(#marker-shadow)" />
                  {/* White inner highlight */}
                  <circle cx={station.pos.x - 1.2} cy={station.pos.y - 1.2} r={r * 0.3} fill="rgba(255,255,255,0.3)" />
                  {/* IATA label */}
                  <text x={station.pos.x} y={station.pos.y - r - 4} textAnchor="middle" fill="#E8EAED" fontSize={isHovered ? '10' : '7.5'} fontWeight="700" fontFamily="system-ui, sans-serif" style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                    {station.iata || station.rawCode}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Floating tooltip following cursor */}
          {hoveredStation && tooltipPos && (() => {
            const station = mappedStations.find(s => s.rawCode === hoveredStation);
            if (!station) return null;
            return (
              <div style={{
                position: 'absolute', left: tooltipPos.x + 12, top: tooltipPos.y - 10,
                background: 'rgba(10,22,40,0.95)', border: `1px solid ${station.riskColor}60`,
                borderRadius: '0.5rem', padding: '0.55rem 0.7rem', zIndex: 20,
                boxShadow: `0 6px 24px rgba(0,0,0,0.6)`, minWidth: '170px', pointerEvents: 'none',
                backdropFilter: 'blur(12px)',
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: COLORS.text.primary, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <MapPin size={11} color={station.riskColor} />
                  {station.iata || station.rawCode} — {station.coords?.city || 'Unknown'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.15rem' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: station.riskColor }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: '600', color: station.riskColor }}>{station.activeLevelData?.name || `Level ${station.activeIdx + 1}`}</span>
                </div>
                {station.activeSince && <div style={{ fontSize: '0.6rem', color: COLORS.text.light }}>Since: {station.activeSince}</div>}
                <div style={{ fontSize: '0.55rem', color: COLORS.blue, marginTop: '0.2rem', fontWeight: '600' }}>Click to edit configuration</div>
              </div>
            );
          })()}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
          {[{ color: '#22c55e', label: 'Safe / Normal' }, { color: '#f97316', label: 'Caution / Elevated' }, { color: '#ef4444', label: 'Alert / High' }].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', color: COLORS.text.secondary }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: item.color, border: '1px solid rgba(255,255,255,0.1)' }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Station Cards — clicking opens edit view */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: COLORS.text.primary, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          All Stations <span style={{ fontSize: '0.62rem', color: COLORS.text.light, fontWeight: '500' }}>— click to edit</span>
        </h2>
        {stationData.length === 0 ? (
          <p style={{ color: COLORS.text.light, fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>No stations have configured security levels yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.6rem' }}>
            {stationData.map(station => {
              const activeIdx = station.activeLevel ?? 0;
              const activeLvl = station.levels?.[activeIdx];
              const levelName = activeLvl?.name || `Level ${activeIdx + 1}`;
              return (
                <div key={station.id} onClick={() => onEditStation(station.rawCode)}
                  style={{
                    padding: '0.75rem', background: COLORS.surfaceLight, borderRadius: '0.5rem',
                    border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${station.riskColor}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'; e.currentTarget.style.borderColor = station.riskColor; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = COLORS.border; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={12} color={station.riskColor} />
                      <span style={{ fontSize: '0.88rem', fontWeight: '700', color: COLORS.text.primary }}>{station.iata || station.rawCode}</span>
                      {station.coords?.city && <span style={{ fontSize: '0.6rem', color: COLORS.text.light }}>{station.coords.city}</span>}
                    </div>
                    <span style={{ padding: '0.15rem 0.4rem', borderRadius: '9999px', fontSize: '0.6rem', fontWeight: '700', background: `${station.riskColor}20`, color: station.riskColor, border: `1px solid ${station.riskColor}40` }}>
                      {levelName}
                    </span>
                  </div>
                  {station.activeSince && (
                    <div style={{ fontSize: '0.62rem', color: COLORS.text.light, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={10} /> Since {station.activeSince}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '2px', marginTop: '0.35rem' }}>
                    {(station.levels || []).map((lvl, i) => (
                      <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i === activeIdx ? (lvl.color || station.riskColor) : COLORS.border, opacity: i === activeIdx ? 1 : 0.3 }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.35rem', fontSize: '0.58rem', color: COLORS.blue, fontWeight: '600' }}>
                    <Edit3 size={9} /> Edit Configuration
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {unmappedStations.length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.4rem 0.6rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '0.35rem' }}>
            <div style={{ fontSize: '0.65rem', color: '#FBBF24', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={10} /> {unmappedStations.length} station{unmappedStations.length !== 1 ? 's' : ''} not shown on map (IATA code not recognized): {unmappedStations.map(s => s.rawCode).join(', ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE — routes between admin map and station edit views
// ============================================================
export default function SecurityLevelPage() {
  const { currentUser, isAdmin } = useAuth();
  const [editingStation, setEditingStation] = useState(null);

  if (isAdmin) {
    if (editingStation) {
      return (
        <BranchUserView
          currentUser={currentUser}
          stationId={editingStation}
          onBack={() => setEditingStation(null)}
          isAdminEditing={true}
        />
      );
    }
    return <AdminWorldMapView currentUser={currentUser} onEditStation={setEditingStation} />;
  }

  return <BranchUserView currentUser={currentUser} />;
}
