import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, getDoc, setDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../core/AuthContext';
import { ShieldAlert, Plus, Trash2, Save, Calendar, AlertTriangle, CheckCircle, Globe2, Info, History, Palette, ChevronDown, ChevronUp, X, MapPin } from 'lucide-react';

const COLORS = {
  surface: '#132F4C', surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F', accent: '#E94560', blue: '#3B82F6',
  input: { bg: '#1A3A5C', border: '#2A5080', text: '#E8EAED' },
};

const COLOR_KEYWORDS = {
  green: '#22c55e', blue: '#3b82f6', yellow: '#eab308', orange: '#f97316',
  red: '#ef4444', white: '#f8fafc', gray: '#94a3b8', grey: '#94a3b8',
  // Korean color keywords
  '\ucd08\ub85d': '#22c55e', '\ud30c\ub791': '#3b82f6', '\ub178\ub791': '#eab308',
  '\uc8fc\ud669': '#f97316', '\ube68\uac15': '#ef4444',
  // Korean security level keywords
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

// Classify any level into 3 risk tiers for admin map
function getRiskTier(activeIdx, totalLevels, levelColor) {
  // If there's an explicit color, map it to a tier
  if (levelColor) {
    const lc = levelColor.toLowerCase();
    if (['#22c55e', '#3b82f6', '#f8fafc', '#94a3b8'].includes(lc)) return '#22c55e'; // green tier
    if (['#eab308', '#f97316'].includes(lc)) return '#f97316'; // yellow/orange tier
    if (lc === '#ef4444') return '#ef4444'; // red tier
  }
  return getRiskColor(activeIdx, totalLevels);
}

// Airport coordinates — comprehensive list
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
  HANSF: { lat: 37.46, lng: 126.44, city: 'Seoul/Incheon' },
  DAD: { lat: 16.05, lng: 108.20, city: 'Da Nang' },
  CTS: { lat: 42.78, lng: 141.69, city: 'Sapporo/Chitose' },
  KMG: { lat: 24.99, lng: 102.74, city: 'Kunming' },
  TAO: { lat: 36.27, lng: 120.37, city: 'Qingdao' },
};

// Miller cylindrical projection — better proportions than simple equirectangular
function latLngToXY(lat, lng, width, height) {
  const x = ((lng + 180) / 360) * width;
  // Miller projection formula
  const latRad = (lat * Math.PI) / 180;
  const millerY = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * latRad));
  const maxMillerY = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * (80 * Math.PI / 180)));
  const y = (height / 2) - (millerY / maxMillerY) * (height / 2);
  return { x, y };
}

// Much improved world map SVG paths (Natural Earth style, 960x500 normalized to 960x480 viewBox)
const WORLD_MAP_PATHS = [
  // North America
  "M130,65 L145,55 155,48 170,45 185,42 200,45 210,42 218,46 210,55 195,58 188,65 175,72 165,80 155,88 148,95 142,100 130,105 125,98 118,102 112,108 105,115 95,122 88,125 80,118 85,108 92,100 98,92 105,85 112,78 118,72 125,68 Z",
  // Central America / Caribbean
  "M130,105 L138,102 145,108 150,115 155,118 160,122 158,128 150,125 142,120 135,118 130,112 Z",
  // South America
  "M165,128 L172,125 180,128 188,135 195,145 198,158 200,172 198,185 195,198 192,210 188,222 182,230 178,235 172,232 168,225 162,215 158,202 155,188 152,175 152,162 155,150 158,140 162,132 Z",
  // Europe
  "M410,48 L415,42 425,38 435,42 445,38 455,42 465,45 475,50 478,58 475,62 470,68 465,72 460,68 455,72 450,70 445,72 440,68 435,65 428,62 420,58 415,52 Z",
  // UK/Ireland
  "M400,48 L405,44 410,48 408,52 404,50 Z",
  // Africa
  "M420,88 L432,85 445,82 455,85 465,88 475,95 482,105 485,118 482,132 484,148 482,162 478,178 474,188 468,195 462,192 455,188 448,192 442,188 435,180 428,168 422,152 418,138 415,122 415,108 418,98 Z",
  // Russia/Siberia
  "M462,30 L480,25 510,22 545,20 580,22 615,25 650,28 680,32 700,35 710,30 720,34 725,40 718,48 705,45 680,40 660,38 635,35 610,33 580,30 550,28 520,30 490,32 475,38 465,35 Z",
  // Middle East
  "M485,72 L498,68 510,72 520,78 516,85 508,88 498,86 490,82 Z",
  // India / South Asia
  "M545,78 L555,85 560,92 565,88 572,95 575,105 570,115 562,120 555,118 548,112 542,105 540,95 542,88 Z",
  // Central / East Asia
  "M560,38 L580,42 600,45 620,48 640,52 660,55 675,58 680,50 668,48 650,45 628,42 605,40 585,38 Z",
  // Southeast Asia
  "M595,95 L605,92 615,95 625,100 632,105 638,112 635,118 625,115 615,112 608,108 600,105 595,100 Z",
  // Indonesia / Philippines
  "M620,120 L635,115 650,118 665,122 678,125 688,130 682,135 670,138 658,135 645,132 632,128 625,125 Z",
  // Japan
  "M685,52 L690,48 695,52 698,58 695,62 690,60 Z",
  // Korean Peninsula
  "M670,52 L675,48 678,52 677,58 673,56 Z",
  // Australia
  "M640,178 L658,172 678,175 695,182 705,192 700,202 688,208 675,206 662,200 652,195 645,188 Z",
  // New Zealand
  "M720,210 L725,205 728,212 726,218 722,215 Z",
  // Greenland
  "M250,22 L265,18 280,20 288,28 285,35 275,38 265,35 255,30 Z",
];

// ============================================================
// BRANCH USER VIEW
// ============================================================
function BranchUserView({ currentUser }) {
  const branchName = currentUser?.branchName || '';
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
        setLevels([
          { name: 'Level 1' },
          { name: 'Level 2' },
          { name: 'Level 3' },
        ]);
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
        history,
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

  const getLevelDisplayColor = (lvl, idx) => {
    return lvl.color || null; // Return null if no color — colors are optional
  };

  // Fallback color for display when no explicit color is set
  const getLevelColor = (lvl, idx) => {
    return lvl.color || getRiskColor(idx, levels.length);
  };

  // Determine max level-name button width for uniform sizing
  const maxLevelChars = Math.max(...levels.map(l => (l.name || 'Level X').length), 8);
  const btnMinWidth = `${Math.max(100, maxLevelChars * 9)}px`;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceLight} 100%)`,
        borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`,
        padding: '1.5rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(59,130,246,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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

      {/* Current Active Level selector */}
      {levels.length > 0 && (
        <div style={{
          background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`,
          padding: '1.25rem', textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.7rem', fontWeight: '600', color: COLORS.text.secondary, margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Threat Level
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {levels.map((lvl, i) => {
              const color = getLevelColor(lvl, i);
              const hasExplicitColor = !!lvl.color;
              const isActive = activeLevel === i;
              return (
                <button
                  key={i}
                  onClick={() => handleSelectLevel(i)}
                  style={{
                    padding: '0.6rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer',
                    width: btnMinWidth, minWidth: btnMinWidth,
                    border: isActive ? `2px solid ${color}` : `1px solid ${COLORS.border}`,
                    background: isActive
                      ? (hasExplicitColor ? `${color}22` : 'rgba(59,130,246,0.12)')
                      : COLORS.surfaceLight,
                    color: isActive ? color : COLORS.text.secondary,
                    fontWeight: isActive ? '700' : '500',
                    fontSize: '0.8rem',
                    transform: isActive ? 'scale(1.03)' : 'scale(1)',
                    transition: 'all 0.2s',
                    boxShadow: isActive ? `0 0 12px ${color}40` : 'none',
                    textAlign: 'center',
                  }}
                >
                  {hasExplicitColor && (
                    <span style={{
                      display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                      background: color, marginRight: '0.35rem', verticalAlign: 'middle',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }} />
                  )}
                  {lvl.name || `Level ${i + 1}`}
                </button>
              );
            })}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
            Security Levels Configuration
          </h2>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button onClick={() => setShowColorPicker(!showColorPicker)} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.35rem 0.6rem', background: showColorPicker ? 'rgba(59,130,246,0.12)' : COLORS.surfaceLight,
              border: `1px solid ${showColorPicker ? 'rgba(59,130,246,0.3)' : COLORS.border}`, borderRadius: '0.35rem',
              color: showColorPicker ? COLORS.blue : COLORS.text.secondary, fontSize: '0.68rem', fontWeight: '600', cursor: 'pointer',
            }}>
              <Palette size={12} /> {showColorPicker ? 'Hide Colors' : 'Colors (Optional)'}
            </button>
            <button onClick={handleAddLevel} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.35rem 0.7rem', background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.3)', borderRadius: '0.35rem',
              color: COLORS.blue, fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer',
            }}>
              <Plus size={13} /> Add Level
            </button>
          </div>
        </div>
        {showColorPicker && (
          <div style={{ fontSize: '0.62rem', color: COLORS.text.light, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.5rem', background: 'rgba(59,130,246,0.05)', borderRadius: '0.25rem', border: '1px solid rgba(59,130,246,0.1)' }}>
            <Info size={10} /> Colors are optional. Include color names (Green, Blue, Yellow, Orange, Red) for auto-detection, or pick manually. Not all airports need colors.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {levels.map((lvl, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.6rem', background: COLORS.surfaceLight,
              borderRadius: '0.4rem', border: `1px solid ${COLORS.border}`,
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, width: '1.5rem', textAlign: 'center', flexShrink: 0 }}>
                {i + 1}
              </span>
              {showColorPicker && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                  <input
                    type="color" value={lvl.color || '#8B99A8'}
                    onChange={e => handleLevelColorChange(i, e.target.value)}
                    style={{ width: '26px', height: '26px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
                  />
                  {lvl.color && (
                    <button onClick={() => handleRemoveColor(i)} title="Remove custom color" style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: COLORS.text.light, fontSize: '0.55rem', padding: '0',
                    }}>
                      <X size={10} />
                    </button>
                  )}
                </div>
              )}
              <input
                type="text" value={lvl.name} placeholder={`Level ${i + 1} name (e.g., Normal, Elevated, High)`}
                onChange={e => handleLevelNameChange(i, e.target.value)}
                style={{
                  flex: 1, padding: '0.4rem 0.6rem', background: COLORS.input.bg,
                  border: `1px solid ${COLORS.input.border}`, borderRadius: '0.35rem',
                  color: COLORS.input.text, fontSize: '0.8rem',
                }}
              />
              {lvl.color && (
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: lvl.color, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
              )}
              <button onClick={() => handleRemoveLevel(i)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', padding: '0.2rem', flexShrink: 0,
              }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action Guidelines Table — aligned buttons */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary, margin: '0 0 1rem' }}>
          Action Guidelines per Level
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {levels.map((lvl, i) => {
            const color = getLevelColor(lvl, i);
            const hasColor = !!lvl.color;
            return (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{
                  padding: '0.4rem 0.5rem', borderRadius: '0.35rem', fontSize: '0.72rem',
                  fontWeight: '600', width: btnMinWidth, minWidth: btnMinWidth,
                  textAlign: 'center', flexShrink: 0, boxSizing: 'border-box',
                  background: hasColor ? `${color}18` : 'rgba(59,130,246,0.08)',
                  color: hasColor ? color : COLORS.text.secondary,
                  border: `1px solid ${hasColor ? `${color}40` : 'rgba(59,130,246,0.15)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
                }}>
                  {hasColor && (
                    <span style={{
                      display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
                      background: color, flexShrink: 0,
                    }} />
                  )}
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
            );
          })}
        </div>
      </div>

      {/* Level Change History */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem' }}>
        <button onClick={() => setShowHistory(!showHistory)} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, margin: '0 0 0.5rem',
        }}>
          <History size={16} color={COLORS.blue} />
          <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary, margin: 0, flex: 1, textAlign: 'left' }}>
            Level Change History
          </h2>
          <span style={{ fontSize: '0.6rem', color: COLORS.text.light, background: COLORS.surfaceLight, padding: '0.15rem 0.4rem', borderRadius: '9999px' }}>
            {history.length} record{history.length !== 1 ? 's' : ''}
          </span>
          {showHistory ? <ChevronUp size={14} color={COLORS.text.light} /> : <ChevronDown size={14} color={COLORS.text.light} />}
        </button>
        {showHistory && (
          <>
            {history.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: COLORS.text.light, textAlign: 'center', padding: '1rem' }}>
                No level changes recorded yet. Changes are tracked when you select a different level.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '280px', overflowY: 'auto' }}>
                {history.map((entry, i) => {
                  // Try to find color for the "to" level
                  const toLvl = levels.find(l => l.name === entry.to);
                  const toColor = toLvl?.color || COLORS.text.primary;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.45rem 0.6rem', background: COLORS.surfaceLight,
                      borderRadius: '0.35rem', fontSize: '0.72rem',
                      borderLeft: toLvl?.color ? `3px solid ${toLvl.color}` : `3px solid ${COLORS.border}`,
                    }}>
                      <Calendar size={12} color={COLORS.text.light} style={{ flexShrink: 0 }} />
                      <span style={{ color: COLORS.text.light, fontFamily: 'monospace', fontSize: '0.68rem', flexShrink: 0, minWidth: '72px' }}>
                        {entry.date}
                      </span>
                      <span style={{ color: COLORS.text.secondary, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.from}
                      </span>
                      <span style={{ color: COLORS.text.light, flexShrink: 0 }}>{'\u2192'}</span>
                      <span style={{ color: toColor, fontWeight: '600', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.to}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
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
// ADMIN VIEW: World Map with SVG and proper markers
// ============================================================
function AdminWorldMapView() {
  const [allLevels, setAllLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredStation, setHoveredStation] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const mapRef = useRef(null);

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

  const mapWidth = 960;
  const mapHeight = 480;

  // Match stations by branchName (exact or uppercase), or by ID as IATA code
  const stationsWithCoords = allLevels.map(s => {
    const code = s.branchName || s.id;
    const coords = AIRPORT_COORDS[code] || AIRPORT_COORDS[code?.toUpperCase()] || AIRPORT_COORDS[code?.replace(/[^A-Za-z]/g, '')?.toUpperCase()];
    const activeIdx = s.activeLevel ?? 0;
    const totalLevels = s.levels?.length || 1;
    const activeLevelData = s.levels?.[activeIdx];
    const riskColor = getRiskTier(activeIdx, totalLevels, activeLevelData?.color);
    const pos = coords ? latLngToXY(coords.lat, coords.lng, mapWidth, mapHeight) : null;
    return {
      ...s,
      code: code?.toUpperCase() || code,
      coords,
      pos,
      riskColor,
      activeLevelData,
      activeIdx,
      hasCoords: !!coords,
    };
  });

  const mappedStations = stationsWithCoords.filter(s => s.hasCoords);
  const unmappedStations = stationsWithCoords.filter(s => !s.hasCoords);
  const totalStations = allLevels.length;

  // Risk tier breakdown
  const greenCount = stationsWithCoords.filter(s => s.riskColor === '#22c55e').length;
  const orangeCount = stationsWithCoords.filter(s => s.riskColor === '#f97316').length;
  const redCount = stationsWithCoords.filter(s => s.riskColor === '#ef4444').length;

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
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.15rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
              Global Security Level Overview
            </h1>
            <p style={{ fontSize: '0.72rem', color: COLORS.text.secondary, margin: 0 }}>
              {totalStations} station{totalStations !== 1 ? 's' : ''} reporting ({mappedStations.length} on map)
            </p>
          </div>
          {/* Risk summary badges */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { color: '#22c55e', count: greenCount, label: 'Safe' },
              { color: '#f97316', count: orangeCount, label: 'Caution' },
              { color: '#ef4444', count: redCount, label: 'Alert' },
            ].filter(b => b.count > 0).map(b => (
              <span key={b.label} style={{
                padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.6rem',
                fontWeight: '700', background: `${b.color}20`, color: b.color,
                border: `1px solid ${b.color}40`, display: 'flex', alignItems: 'center', gap: '0.2rem',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: b.color }} />
                {b.count} {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* World Map */}
      <div style={{
        background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`,
        padding: '1rem', overflow: 'hidden',
      }}>
        <div ref={mapRef} style={{ position: 'relative', width: '100%', margin: '0 auto' }}>
          <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} style={{ width: '100%', height: 'auto', background: '#0a1628', borderRadius: '0.5rem', display: 'block' }}>
            <defs>
              {/* Glow filters for markers */}
              <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feFlood floodColor="#22c55e" floodOpacity="0.4" />
                <feComposite in2="blur" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feFlood floodColor="#f97316" floodOpacity="0.4" />
                <feComposite in2="blur" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feFlood floodColor="#ef4444" floodOpacity="0.5" />
                <feComposite in2="blur" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <rect width={mapWidth} height={mapHeight} fill="#0a1628" />

            {/* Subtle grid */}
            {[...Array(9)].map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i * (mapHeight / 8)} x2={mapWidth} y2={i * (mapHeight / 8)} stroke="#1E3A5F" strokeWidth="0.4" strokeDasharray="4,6" opacity="0.15" />
            ))}
            {[...Array(13)].map((_, i) => (
              <line key={`v${i}`} x1={i * (mapWidth / 12)} y1="0" x2={i * (mapWidth / 12)} y2={mapHeight} stroke="#1E3A5F" strokeWidth="0.4" strokeDasharray="4,6" opacity="0.15" />
            ))}

            {/* Equator */}
            <line x1="0" y1={mapHeight * 0.52} x2={mapWidth} y2={mapHeight * 0.52} stroke="#2a5080" strokeWidth="0.5" strokeDasharray="8,4" opacity="0.25" />

            {/* World map continent fills */}
            {WORLD_MAP_PATHS.map((path, i) => (
              <path key={i} d={path} fill="#1a3a5c" stroke="#2a5080" strokeWidth="0.6" opacity="0.7" />
            ))}

            {/* Station markers — render in order: green, orange, red (so red is on top) */}
            {[...mappedStations].sort((a, b) => {
              const order = { '#22c55e': 0, '#f97316': 1, '#ef4444': 2 };
              return (order[a.riskColor] || 0) - (order[b.riskColor] || 0);
            }).map(station => {
              const glowId = station.riskColor === '#ef4444' ? 'glow-red'
                : station.riskColor === '#f97316' ? 'glow-orange' : 'glow-green';
              const isHovered = hoveredStation === station.code;
              return (
                <g key={station.code}
                  onMouseEnter={() => setHoveredStation(station.code)}
                  onMouseLeave={() => setHoveredStation(null)}
                  onClick={() => setSelectedStation(selectedStation === station.code ? null : station.code)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Animated pulse ring */}
                  <circle cx={station.pos.x} cy={station.pos.y} r={12} fill="none" stroke={station.riskColor} strokeWidth="1" opacity="0.3">
                    <animate attributeName="r" values="8;16;8" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0.05;0.3" dur="3s" repeatCount="indefinite" />
                  </circle>
                  {/* Outer halo */}
                  <circle cx={station.pos.x} cy={station.pos.y} r={isHovered ? 10 : 7} fill={station.riskColor} opacity={isHovered ? 0.2 : 0.12}
                    style={{ transition: 'r 0.2s, opacity 0.2s' }} />
                  {/* Main dot with glow */}
                  <circle cx={station.pos.x} cy={station.pos.y} r={isHovered ? 6 : 4.5}
                    fill={station.riskColor} stroke="#0a1628" strokeWidth="1.5"
                    filter={`url(#${glowId})`}
                    style={{ transition: 'r 0.2s' }}
                  />
                  {/* IATA code label */}
                  <text x={station.pos.x} y={station.pos.y - 10}
                    textAnchor="middle" fill="#E8EAED"
                    fontSize={isHovered ? '10' : '8'} fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif"
                    style={{ transition: 'font-size 0.2s', pointerEvents: 'none' }}
                  >
                    {station.code}
                  </text>
                  {/* Level name below dot */}
                  {isHovered && (
                    <text x={station.pos.x} y={station.pos.y + 14}
                      textAnchor="middle" fill={station.riskColor}
                      fontSize="7" fontWeight="600" fontFamily="system-ui"
                      style={{ pointerEvents: 'none' }}
                    >
                      {station.activeLevelData?.name || `Level ${station.activeIdx + 1}`}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Floating tooltip for selected station */}
          {(selectedStation || hoveredStation) && (() => {
            const code = selectedStation || hoveredStation;
            const station = mappedStations.find(s => s.code === code);
            if (!station) return null;
            const leftPct = (station.pos.x / mapWidth) * 100;
            const topPct = (station.pos.y / mapHeight) * 100;
            return (
              <div style={{
                position: 'absolute',
                left: `${Math.min(Math.max(leftPct, 10), 90)}%`,
                top: `${Math.max(topPct - 8, 2)}%`,
                transform: 'translate(-50%, -100%)',
                background: 'rgba(19,47,76,0.96)', border: `1px solid ${station.riskColor}50`,
                borderRadius: '0.5rem', padding: '0.6rem 0.8rem', zIndex: 10,
                boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 8px ${station.riskColor}30`,
                minWidth: '160px', pointerEvents: 'none',
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', color: COLORS.text.primary, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <MapPin size={12} color={station.riskColor} />
                  {station.code} — {station.coords?.city || 'Unknown'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: station.riskColor, display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: '600', color: station.riskColor }}>
                    {station.activeLevelData?.name || `Level ${station.activeIdx + 1}`}
                  </span>
                </div>
                {station.activeSince && (
                  <div style={{ fontSize: '0.62rem', color: COLORS.text.light, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Calendar size={9} /> Since {station.activeSince}
                  </div>
                )}
                {/* Show level breakdown */}
                {station.levels && station.levels.length > 1 && (
                  <div style={{ display: 'flex', gap: '2px', marginTop: '0.35rem' }}>
                    {station.levels.map((lvl, i) => {
                      const c = lvl.color || getRiskColor(i, station.levels.length);
                      return (
                        <div key={i} style={{
                          flex: 1, height: '3px', borderRadius: '2px',
                          background: i === station.activeIdx ? c : COLORS.border,
                          opacity: i === station.activeIdx ? 1 : 0.3,
                        }} title={lvl.name || `Level ${i + 1}`} />
                      );
                    })}
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
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: COLORS.text.secondary }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, border: '1px solid rgba(255,255,255,0.1)' }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Station Cards List */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: COLORS.text.primary, margin: '0 0 1rem' }}>
          All Station Security Levels
        </h2>
        {allLevels.length === 0 ? (
          <p style={{ color: COLORS.text.light, fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>
            No stations have configured security levels yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.6rem' }}>
            {stationsWithCoords.map(station => {
              const activeIdx = station.activeLevel ?? 0;
              const activeLvl = station.levels?.[activeIdx];
              const riskColor = station.riskColor;
              const levelName = activeLvl?.name || `Level ${activeIdx + 1}`;
              return (
                <div key={station.id} style={{
                  padding: '0.8rem', background: COLORS.surfaceLight,
                  borderRadius: '0.5rem', border: `1px solid ${COLORS.border}`,
                  borderLeft: `3px solid ${riskColor}`,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  cursor: station.hasCoords ? 'pointer' : 'default',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.3)`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  onClick={() => station.hasCoords && setSelectedStation(station.code)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={12} color={riskColor} />
                      <span style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary }}>
                        {station.code || station.branchName || station.id}
                      </span>
                      {station.coords?.city && (
                        <span style={{ fontSize: '0.62rem', color: COLORS.text.light }}>
                          {station.coords.city}
                        </span>
                      )}
                    </div>
                    <span style={{
                      padding: '0.15rem 0.45rem', borderRadius: '9999px', fontSize: '0.62rem',
                      fontWeight: '700', background: `${riskColor}20`, color: riskColor,
                      border: `1px solid ${riskColor}40`,
                    }}>
                      {levelName}
                    </span>
                  </div>
                  {station.activeSince && (
                    <div style={{ fontSize: '0.65rem', color: COLORS.text.light, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={10} /> Since {station.activeSince}
                    </div>
                  )}
                  {/* Mini level bar */}
                  <div style={{ display: 'flex', gap: '2px', marginTop: '0.4rem' }}>
                    {(station.levels || []).map((lvl, i) => {
                      const c = lvl.color || getRiskColor(i, station.levels?.length || 1);
                      return (
                        <div key={i} style={{
                          flex: 1, height: '4px', borderRadius: '2px',
                          background: i === activeIdx ? c : COLORS.border,
                          opacity: i === activeIdx ? 1 : 0.35,
                        }} title={lvl.name || `Level ${i + 1}`} />
                      );
                    })}
                  </div>
                  {/* History preview */}
                  {station.history && station.history.length > 0 && (
                    <div style={{ marginTop: '0.4rem', borderTop: `1px solid ${COLORS.border}`, paddingTop: '0.3rem' }}>
                      <div style={{ fontSize: '0.58rem', color: COLORS.text.light, marginBottom: '0.15rem' }}>
                        Recent changes:
                      </div>
                      {station.history.slice(0, 2).map((entry, i) => (
                        <div key={i} style={{ fontSize: '0.58rem', color: COLORS.text.light, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ fontFamily: 'monospace' }}>{entry.date}</span>
                          <span>{entry.from}</span>
                          <span>{'\u2192'}</span>
                          <span style={{ color: COLORS.text.secondary, fontWeight: '600' }}>{entry.to}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unmapped stations notice */}
        {unmappedStations.length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.7rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '0.4rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#FBBF24', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
              <AlertTriangle size={11} /> {unmappedStations.length} station{unmappedStations.length !== 1 ? 's' : ''} not shown on map (unknown IATA code):
            </div>
            <div style={{ fontSize: '0.62rem', color: COLORS.text.light }}>
              {unmappedStations.map(s => s.code || s.branchName || s.id).join(', ')}
            </div>
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
