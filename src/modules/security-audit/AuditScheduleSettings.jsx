/**
 * Audit Schedule Settings Component
 * 
 * Integrates into the portal's existing Settings page.
 * Allows admins to configure:
 * - Audit types
 * - Audit frequencies
 * - Default auditors list
 * - Notification settings
 * - Default audit duration
 */

import React, { useState, useEffect } from 'react';
import {
  CalendarDays, Plus, X, Save, Loader, Settings, Users,
  Clock, Bell, ChevronDown, ChevronUp, Edit3, Trash2, CheckCircle,
  Building2, MapPin
} from 'lucide-react';
import { loadAuditSettings, saveAuditSettings, DEFAULT_AUDIT_SETTINGS } from '../../firebase/auditSchedule';

const COLORS = {
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  border: '#1E3A5F',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  accent: '#E94560',
  green: '#22c55e',
  yellow: '#f59e0b',
  blue: '#3B82F6'
};

function AuditScheduleSettings() {
  const [settings, setSettings] = useState(DEFAULT_AUDIT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  // Temp inputs for adding items
  const [newAuditType, setNewAuditType] = useState('');
  const [newFrequency, setNewFrequency] = useState('');
  const [newAuditor, setNewAuditor] = useState('');
  const [newStation, setNewStation] = useState({ partner: '', domestic: '', internal: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await loadAuditSettings();
        setSettings(data);
      } catch (err) {
        console.error('[AuditSettings] Load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAuditSettings(settings);
      setMessage('Audit schedule settings saved successfully!');
      setDirty(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const addToList = (key, value, clearFn) => {
    if (!value.trim()) return;
    const list = settings[key] || [];
    if (list.includes(value.trim())) return;
    updateSetting(key, [...list, value.trim()]);
    clearFn('');
  };

  const removeFromList = (key, index) => {
    const list = [...(settings[key] || [])];
    list.splice(index, 1);
    updateSetting(key, list);
  };

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: COLORS.text.secondary }} />
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '1.5rem',
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: '0.75rem',
      overflow: 'hidden'
    }}>
      {/* Header (collapsible) */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '1rem 1.25rem',
          background: 'transparent', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', color: COLORS.text.primary
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <CalendarDays size={20} color={COLORS.accent} />
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>
              Audit Schedule Settings
            </h3>
            <p style={{ margin: 0, fontSize: '0.7rem', color: COLORS.text.secondary }}>
              Configure audit types, frequencies, auditors & notifications
            </p>
          </div>
          {dirty && (
            <span style={{
              padding: '0.15rem 0.4rem', borderRadius: '0.2rem',
              background: 'rgba(245,158,11,0.15)', color: COLORS.yellow,
              fontSize: '0.6rem', fontWeight: '700'
            }}>UNSAVED</span>
          )}
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: `1px solid ${COLORS.border}` }}>
          {/* Success Message */}
          {message && (
            <div style={{
              padding: '0.5rem 0.75rem', marginTop: '0.75rem', borderRadius: '0.4rem',
              background: message.includes('Failed') ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
              color: message.includes('Failed') ? '#F87171' : '#34D399',
              fontSize: '0.78rem', fontWeight: '500',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
              <CheckCircle size={14} />
              {message}
            </div>
          )}

          {/* Audit Types */}
          <div style={{ marginTop: '1rem' }}>
            <h4 style={sectionTitleStyle}>
              <Settings size={14} color={COLORS.blue} />
              Audit Types
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
              {(settings.auditTypes || []).map((type, i) => (
                <span key={i} style={tagStyle}>
                  {type}
                  <button onClick={() => removeFromList('auditTypes', i)} style={tagRemoveBtnStyle}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <input
                type="text" value={newAuditType} onChange={e => setNewAuditType(e.target.value)}
                placeholder="Add audit type..."
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToList('auditTypes', newAuditType, setNewAuditType))}
                style={smallInputStyle}
              />
              <button onClick={() => addToList('auditTypes', newAuditType, setNewAuditType)} style={addBtnStyle}>
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Audit Frequencies */}
          <div style={{ marginTop: '1rem' }}>
            <h4 style={sectionTitleStyle}>
              <Clock size={14} color={COLORS.blue} />
              Frequencies
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
              {(settings.auditFrequencies || []).map((freq, i) => (
                <span key={i} style={tagStyle}>
                  {freq}
                  <button onClick={() => removeFromList('auditFrequencies', i)} style={tagRemoveBtnStyle}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <input
                type="text" value={newFrequency} onChange={e => setNewFrequency(e.target.value)}
                placeholder="Add frequency..."
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToList('auditFrequencies', newFrequency, setNewFrequency))}
                style={smallInputStyle}
              />
              <button onClick={() => addToList('auditFrequencies', newFrequency, setNewFrequency)} style={addBtnStyle}>
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Default Auditors */}
          <div style={{ marginTop: '1rem' }}>
            <h4 style={sectionTitleStyle}>
              <Users size={14} color={COLORS.blue} />
              Default Auditors
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
              {(settings.defaultAuditors || []).map((auditor, i) => (
                <span key={i} style={tagStyle}>
                  {auditor}
                  <button onClick={() => removeFromList('defaultAuditors', i)} style={tagRemoveBtnStyle}>
                    <X size={10} />
                  </button>
                </span>
              ))}
              {(settings.defaultAuditors || []).length === 0 && (
                <span style={{ fontSize: '0.72rem', color: COLORS.text.light }}>No default auditors configured</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <input
                type="text" value={newAuditor} onChange={e => setNewAuditor(e.target.value)}
                placeholder="Add auditor name..."
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToList('defaultAuditors', newAuditor, setNewAuditor))}
                style={smallInputStyle}
              />
              <button onClick={() => addToList('defaultAuditors', newAuditor, setNewAuditor)} style={addBtnStyle}>
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Station Categories */}
          <div style={{ marginTop: '1rem' }}>
            <h4 style={sectionTitleStyle}>
              <Building2 size={14} color={COLORS.blue} />
              Station Categories
            </h4>
            <p style={{ fontSize: '0.68rem', color: COLORS.text.light, marginBottom: '0.6rem' }}>
              Manage stations beyond overseas branches. Add partners, domestic branches, and internal check items.
            </p>
            {[
              { key: 'partner', label: '🤝 협력업체 (Partners)', placeholder: 'Add partner name...' },
              { key: 'domestic', label: '🏢 국내지점 (Domestic Branches)', placeholder: 'Add domestic branch...' },
              { key: 'internal', label: '🔍 사내점검 (Internal Checks)', placeholder: 'Add internal check item...' },
            ].map(cat => {
              const stationList = settings.stationCategories?.[cat.key]?.stations || [];
              return (
                <div key={cat.key} style={{ marginBottom: '0.75rem', padding: '0.5rem 0.6rem', background: COLORS.surfaceLight, borderRadius: '0.4rem', border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '700', color: COLORS.text.primary, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MapPin size={11} color={COLORS.accent} />
                    {cat.label}
                    <span style={{ fontSize: '0.6rem', fontWeight: '500', color: COLORS.text.light, marginLeft: 'auto' }}>{stationList.length} station(s)</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
                    {stationList.map((station, i) => (
                      <span key={i} style={tagStyle}>
                        {station}
                        <button onClick={() => {
                          const updated = { ...settings.stationCategories };
                          const stations = [...(updated[cat.key]?.stations || [])];
                          stations.splice(i, 1);
                          updated[cat.key] = { ...updated[cat.key], stations };
                          updateSetting('stationCategories', updated);
                        }} style={tagRemoveBtnStyle}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {stationList.length === 0 && (
                      <span style={{ fontSize: '0.68rem', color: COLORS.text.light }}>No stations added</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <input
                      type="text"
                      value={newStation[cat.key] || ''}
                      onChange={e => setNewStation(prev => ({ ...prev, [cat.key]: e.target.value }))}
                      placeholder={cat.placeholder}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (newStation[cat.key] || '').trim();
                          if (!val) return;
                          const updated = { ...settings.stationCategories };
                          const stations = [...(updated[cat.key]?.stations || [])];
                          if (stations.includes(val)) return;
                          stations.push(val);
                          updated[cat.key] = { ...updated[cat.key], stations };
                          updateSetting('stationCategories', updated);
                          setNewStation(prev => ({ ...prev, [cat.key]: '' }));
                        }
                      }}
                      style={smallInputStyle}
                    />
                    <button onClick={() => {
                      const val = (newStation[cat.key] || '').trim();
                      if (!val) return;
                      const updated = { ...settings.stationCategories };
                      const stations = [...(updated[cat.key]?.stations || [])];
                      if (stations.includes(val)) return;
                      stations.push(val);
                      updated[cat.key] = { ...updated[cat.key], stations };
                      updateSetting('stationCategories', updated);
                      setNewStation(prev => ({ ...prev, [cat.key]: '' }));
                    }} style={addBtnStyle}>
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notification Settings */}
          <div style={{ marginTop: '1rem' }}>
            <h4 style={sectionTitleStyle}>
              <Bell size={14} color={COLORS.blue} />
              Notification & Defaults
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: COLORS.text.secondary, display: 'block', marginBottom: '0.2rem' }}>
                  Reminder Days Before
                </label>
                <input
                  type="number" min={1} max={30}
                  value={settings.notificationDaysBefore || 7}
                  onChange={e => updateSetting('notificationDaysBefore', parseInt(e.target.value) || 7)}
                  style={{ ...smallInputStyle, width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: COLORS.text.secondary, display: 'block', marginBottom: '0.2rem' }}>
                  Default Audit Duration (days)
                </label>
                <input
                  type="number" min={1} max={30}
                  value={settings.defaultAuditDuration || 3}
                  onChange={e => updateSetting('defaultAuditDuration', parseInt(e.target.value) || 3)}
                  style={{ ...smallInputStyle, width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={saving || !dirty} style={{
              padding: '0.5rem 1.2rem', background: dirty ? COLORS.accent : COLORS.surfaceLight,
              border: dirty ? 'none' : `1px solid ${COLORS.border}`,
              borderRadius: '0.4rem', color: dirty ? 'white' : COLORS.text.light,
              fontSize: '0.78rem', fontWeight: '700', cursor: saving || !dirty ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              opacity: saving ? 0.7 : 1
            }}>
              {saving ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
              Save Audit Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Shared Styles
// ============================================================

const sectionTitleStyle = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  margin: '0 0 0.5rem 0', fontSize: '0.78rem', fontWeight: '700', color: COLORS.text.primary
};

const tagStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
  padding: '0.2rem 0.5rem', borderRadius: '0.3rem',
  background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
  color: COLORS.text.primary, fontSize: '0.72rem', fontWeight: '500'
};

const tagRemoveBtnStyle = {
  background: 'none', border: 'none', color: COLORS.text.light,
  cursor: 'pointer', padding: '0.1rem', display: 'flex', alignItems: 'center'
};

const smallInputStyle = {
  padding: '0.35rem 0.5rem', background: COLORS.surfaceLight,
  border: `1px solid ${COLORS.border}`, borderRadius: '0.3rem',
  color: COLORS.text.primary, fontSize: '0.75rem', outline: 'none',
  flex: 1, boxSizing: 'border-box'
};

const addBtnStyle = {
  padding: '0.35rem 0.5rem', background: COLORS.surfaceLight,
  border: `1px solid ${COLORS.border}`, borderRadius: '0.3rem',
  color: COLORS.text.secondary, cursor: 'pointer', display: 'flex',
  alignItems: 'center'
};

export default AuditScheduleSettings;
