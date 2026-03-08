/**
 * Security Audit Schedule Page (Admin-Only Module) — v3.3
 * 
 * v3.3 Enhancements:
 * - File upload: improved error handling, explicit error messages for Firestore permission errors,
 *   added retry mechanism, cleaner drag-and-drop UX, progress feedback
 * - Findings/Recommendations: added numeric count fields (findingsCount, recommendationsCount)
 *   in completed/in_progress status. Counts shown in dashboard totals and table '결과' column.
 * - Dashboard summary cards: hover popover with detailed breakdown per card
 * - Statistics: getAuditStatistics now aggregates findingsCount + recommendationsCount totals
 *
 * v3.2 Fixes:
 * - Auditor multi-edit now persists correctly (explicit auditor+auditors sync on save)
 * - File upload: fixed async error handling, added drag-and-drop, reset input after upload
 * - Korean IME composition handling (prevents orphaned last character on Enter)
 * - Table text readability improved (lighter text colors, better contrast)
 * - Status dropdown: flips upward when near bottom of viewport
 * - Dashboard charts: fixed empty-state handling, shows placeholder when no data
 * - All original v3 features retained
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../core/AuthContext';
import {
  getAuditSchedules, createAuditSchedule, updateAuditSchedule,
  deleteAuditSchedule, getAuditStatistics, loadAuditSettings,
  DEFAULT_AUDIT_SETTINGS, uploadAuditScheduleFile,
  getAuditScheduleFiles, downloadAuditScheduleFile, deleteAuditScheduleFile
} from '../../firebase/auditSchedule';
import { getAllBranches } from '../../firebase/collections';
import {
  ShieldAlert, Calendar, Plus, Edit3, Trash2, CheckCircle, Clock, AlertTriangle,
  XCircle, Filter, RefreshCw, ChevronLeft, ChevronRight, Building2, Users,
  Search, Loader, X, Save, CalendarDays, BarChart3, MapPin,
  ChevronDown, ArrowUpDown, Pause, User, List, Grid3X3,
  Printer, Upload, Download, FileText, Paperclip, PieChart, TrendingUp
} from 'lucide-react';

// ============================================================
// Color Palette & Constants
// ============================================================

const COLORS = {
  bg: '#F8FAFC', surface: '#FFFFFF', surfaceAlt: '#F1F5F9',
  border: '#E2E8F0', borderLight: '#F1F5F9',
  text: { primary: '#1E293B', secondary: '#64748B', light: '#94A3B8', white: '#FFFFFF' },
  accent: '#E94560', blue: '#3B82F6', green: '#16A34A', yellow: '#D97706',
  red: '#DC2626', purple: '#7C3AED', orange: '#EA580C', cyan: '#0891B2', indigo: '#4F46E5',
};

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: COLORS.blue, bg: '#EFF6FF', border: '#BFDBFE', icon: Calendar },
  in_progress: { label: 'In Progress', color: COLORS.yellow, bg: '#FFFBEB', border: '#FDE68A', icon: Clock },
  completed: { label: 'Completed', color: COLORS.green, bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: COLORS.red, bg: '#FEF2F2', border: '#FECACA', icon: XCircle },
  postponed: { label: 'Postponed', color: COLORS.orange, bg: '#FFF7ED', border: '#FED7AA', icon: Pause }
};

// Auditor color palette - dark tones, clearly distinguishable
const AUDITOR_COLORS = [
  { bg: '#1E3A5F', text: '#BFDBFE', border: '#2563EB' }, // dark blue
  { bg: '#5C3D2E', text: '#FDE68A', border: '#92400E' }, // dark brown
  { bg: '#14532D', text: '#BBF7D0', border: '#16A34A' }, // dark green
  { bg: '#831843', text: '#FBCFE8', border: '#BE185D' }, // dark pink
  { bg: '#713F12', text: '#FEF08A', border: '#CA8A04' }, // dark yellow
  { bg: '#374151', text: '#D1D5DB', border: '#6B7280' }, // dark gray
  { bg: '#312E81', text: '#C7D2FE', border: '#6366F1' }, // dark indigo
  { bg: '#4C1D95', text: '#DDD6FE', border: '#7C3AED' }, // dark purple
  { bg: '#7C2D12', text: '#FED7AA', border: '#EA580C' }, // dark orange
  { bg: '#164E63', text: '#A5F3FC', border: '#0891B2' }, // dark teal
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CATEGORY_LABELS = {
  overseas: { label: '해외지점', labelEn: 'Overseas', icon: '✈️' },
  domestic: { label: '국내지점', labelEn: 'Domestic', icon: '🏢' },
  partner: { label: '협력업체', labelEn: 'Partner', icon: '🤝' },
  internal: { label: '사내점검', labelEn: 'Internal', icon: '🔍' },
};

// Build a stable color map for auditor names
const getAuditorColor = (auditorName, allAuditors) => {
  const idx = allAuditors.indexOf(auditorName);
  return AUDITOR_COLORS[(idx >= 0 ? idx : auditorName.length) % AUDITOR_COLORS.length];
};

// ============================================================
// Main Page Component
// ============================================================

function SecurityAuditSchedulePage() {
  const { currentUser, isAdmin } = useAuth();

  const [schedules, setSchedules] = useState([]);
  const [branches, setBranches] = useState([]);
  const [auditSettings, setAuditSettings] = useState(DEFAULT_AUDIT_SETTINGS);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [filterBranch, setFilterBranch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('startDate');
  const [sortAsc, setSortAsc] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [viewMode, setViewMode] = useState('annual');

  const printRef = useRef(null);

  // Build station list from branches + settings categories
  const allStations = useMemo(() => {
    const overseas = branches.map(b => ({
      name: b.branchName || b.name || '',
      category: 'overseas'
    }));
    const cats = auditSettings.stationCategories || {};
    const extra = [];
    Object.entries(cats).forEach(([catKey, catData]) => {
      (catData.stations || []).forEach(s => {
        extra.push({ name: s, category: catKey });
      });
    });
    return [...overseas, ...extra].filter(s => s.name).sort((a, b) => a.name.localeCompare(b.name));
  }, [branches, auditSettings]);

  // Unique auditor list for color assignment
  const allAuditors = useMemo(() => {
    const set = new Set();
    schedules.forEach(s => {
      (s.auditors || []).forEach(a => set.add(a));
      if (s.auditor && !(s.auditors?.length)) set.add(s.auditor);
    });
    (auditSettings.defaultAuditors || []).forEach(a => set.add(a));
    return Array.from(set).sort();
  }, [schedules, auditSettings]);

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <ShieldAlert size={48} color="#DC2626" />
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: COLORS.text.primary }}>Access Restricted</h2>
        <p style={{ fontSize: '0.85rem', color: COLORS.text.secondary }}>
          Only HQ administrators can access the Security Audit Schedule module.
        </p>
      </div>
    );
  }

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [schedulesData, branchesData, settingsData, statsData] = await Promise.all([
        getAuditSchedules(selectedYear),
        getAllBranches(),
        loadAuditSettings(),
        getAuditStatistics(selectedYear)
      ]);
      setSchedules(schedulesData);
      setBranches(branchesData.filter(b => b.active !== false).sort((a, b) => (a.branchName || a.name || '').localeCompare(b.branchName || b.name || '')));
      setAuditSettings(settingsData);
      setStats(statsData);
    } catch (err) {
      console.error('[AuditSchedule] Load error:', err);
      showMessage('Failed to load audit schedules.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const filteredSchedules = useMemo(() => {
    let result = [...schedules];
    if (filterBranch) result = result.filter(s => s.branchName === filterBranch);
    if (filterStatus) result = result.filter(s => s.status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.branchName || '').toLowerCase().includes(q) ||
        (s.auditType || '').toLowerCase().includes(q) ||
        (s.auditors || []).some(a => a.toLowerCase().includes(q)) ||
        (s.auditor || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = aVal.localeCompare ? aVal.localeCompare(bVal) : aVal - bVal;
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [schedules, filterBranch, filterStatus, searchQuery, sortField, sortAsc]);

  const handleCreate = async (data) => {
    try {
      await createAuditSchedule(data);
      showMessage('Audit schedule created successfully.');
      setShowForm(false);
      setEditingSchedule(null);
      loadData();
    } catch (err) {
      showMessage('Failed to create audit schedule.', 'error');
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await updateAuditSchedule(id, data);
      showMessage('Audit schedule updated successfully.');
      setShowForm(false);
      setEditingSchedule(null);
      loadData();
    } catch (err) {
      showMessage('Failed to update audit schedule.', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAuditSchedule(id);
      showMessage('Audit schedule deleted.');
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      showMessage('Failed to delete audit schedule.', 'error');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateAuditSchedule(id, { status: newStatus });
      showMessage(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}.`);
      loadData();
    } catch (err) {
      showMessage('Failed to update status.', 'error');
    }
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const handlePrint = () => {
    // Enhanced print: build a clean print window for A4 PDF-ready layout
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) { window.print(); return; }

    const title = `Security Audit Schedule — ${selectedYear}`;
    const now = new Date().toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' });

    // Build schedule rows for print table
    const rows = filteredSchedules.map(s => {
      const statusLabel = STATUS_CONFIG[s.status]?.label || s.status;
      const auditorNames = (s.auditors || []).join(', ') || s.auditor || '-';
      const cat = CATEGORY_LABELS[s.stationCategory];
      const catLabel = cat ? `${cat.icon} ${cat.label}` : '';
      const fc = parseInt(s.findingsCount) || 0;
      const rc = parseInt(s.recommendationsCount) || 0;
      const resultStr = (fc > 0 || rc > 0) ? `시정${fc}/권고${rc}` : '-';
      return `<tr>
        <td>${s.branchName || '-'}</td>
        <td style="font-size:0.7rem;color:#64748B">${catLabel}</td>
        <td>${s.auditType || 'General'}</td>
        <td style="font-family:monospace">${s.startDate || '-'}</td>
        <td style="font-family:monospace">${s.endDate || '-'}</td>
        <td>${auditorNames}</td>
        <td>${statusLabel}</td>
        <td style="text-align:center;font-weight:700">${resultStr}</td>
        <td style="font-size:0.72rem;color:#64748B">${(s.notes || '-').substring(0, 80)}</td>
      </tr>`;
    }).join('');

    // Build stats summary
    const statsSummary = stats ? `
      <div class="stats-row">
        <div class="stat-card"><span class="stat-val">${stats.total}</span><span class="stat-lbl">Total</span></div>
        <div class="stat-card"><span class="stat-val" style="color:#3B82F6">${stats.scheduled}</span><span class="stat-lbl">Scheduled</span></div>
        <div class="stat-card"><span class="stat-val" style="color:#D97706">${stats.inProgress}</span><span class="stat-lbl">In Progress</span></div>
        <div class="stat-card"><span class="stat-val" style="color:#16A34A">${stats.completed}</span><span class="stat-lbl">Completed</span></div>
        <div class="stat-card"><span class="stat-val" style="color:#DC2626">${stats.overdue}</span><span class="stat-lbl">Overdue</span></div>
        <div class="stat-card"><span class="stat-val" style="color:#7C3AED">${Object.keys(stats.byBranch).length}</span><span class="stat-lbl">Stations</span></div>
      </div>` : '';

    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1E293B; padding: 16px; }
      .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #E94560; padding-bottom: 8px; margin-bottom: 12px; }
      .header h1 { font-size: 18px; font-weight: 800; color: #1E293B; }
      .header .meta { font-size: 10px; color: #64748B; text-align: right; }
      .stats-row { display: flex; gap: 8px; margin-bottom: 14px; }
      .stat-card { flex: 1; text-align: center; padding: 6px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; }
      .stat-val { display: block; font-size: 18px; font-weight: 900; color: #1E293B; }
      .stat-lbl { display: block; font-size: 9px; color: #64748B; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      thead th { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 6px 8px; font-weight: 700; color: #1E293B; text-align: left; white-space: nowrap; }
      tbody td { border: 1px solid #E2E8F0; padding: 5px 8px; vertical-align: top; }
      tbody tr:nth-child(even) { background: #FAFBFC; }
      .footer { margin-top: 12px; padding-top: 6px; border-top: 1px solid #E2E8F0; font-size: 9px; color: #94A3B8; display: flex; justify-content: space-between; }
    </style></head><body>
    <div class="header">
      <h1>🛡️ ${title}</h1>
      <div class="meta">Printed: ${now}<br>View: ${viewMode} | Filters: ${filterBranch || 'All Stations'}, ${filterStatus || 'All Status'}<br>Total: ${filteredSchedules.length} audit(s)</div>
    </div>
    ${statsSummary}
    <table>
      <thead><tr><th>Station</th><th>Category</th><th>Audit Type</th><th>Start</th><th>End</th><th>Auditors</th><th>Status</th><th>Results</th><th>Notes</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:#94A3B8">No audit schedules found</td></tr>'}</tbody>
    </table>
    <div class="footer"><span>AirZeta Security Portal — Audit Schedule</span><span>Page 1</span></div>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '0.75rem' }}>
        <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: COLORS.accent }} />
        <p style={{ color: COLORS.text.secondary, fontSize: '0.85rem' }}>Loading audit schedules...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '100%' }} ref={printRef}>
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          [data-print-area], [data-print-area] * { visibility: visible; }
          [data-print-area] { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 12mm; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {message.text && (
        <div className="no-print" style={{
          padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: '0.5rem',
          background: message.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          color: message.type === 'error' ? '#DC2626' : '#16A34A',
          border: `1px solid ${message.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
          fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          {message.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: `linear-gradient(135deg, ${COLORS.accent} 0%, #c23150 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(233,69,96,0.3)'
          }}>
            <CalendarDays size={22} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: COLORS.text.primary }}>
              Security Audit Schedule
            </h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: COLORS.text.secondary }}>
              Station security audit planning & tracking — {selectedYear}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={handlePrint} style={btnSecondary} title="Print current view">
            <Printer size={14} /> Print
          </button>
          <button onClick={loadData} disabled={refreshing} style={{ ...btnSecondary, opacity: refreshing ? 0.6 : 1 }}>
            <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
          </button>
          <button onClick={() => { setEditingSchedule(null); setShowForm(true); }} style={btnPrimary}>
            <Plus size={16} /> New Audit
          </button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div data-print-area>
        {stats && <AnalyticsDashboard stats={stats} allAuditors={allAuditors} selectedYear={selectedYear} viewMode={viewMode} schedules={filteredSchedules} />}
      </div>

      {/* Filters Bar */}
      <div className="no-print" style={{
        display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center',
        padding: '0.75rem 1rem', background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <Filter size={15} color={COLORS.text.secondary} style={{ flexShrink: 0 }} />
        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={selectStyle}>
          {Array.from({ length: 5 }, (_, i) => {
            const y = new Date().getFullYear() - 2 + i;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
        <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={selectStyle}>
          <option value="">All Stations</option>
          {allStations.map((s, i) => (
            <option key={`${s.category}-${s.name}-${i}`} value={s.name}>
              {CATEGORY_LABELS[s.category]?.icon || ''} {s.name}
            </option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: COLORS.text.light }} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search audits..."
            style={{ ...selectStyle, width: '100%', paddingLeft: '1.7rem', minWidth: '120px' }}
          />
        </div>

        {/* View Mode Buttons */}
        <div style={{ display: 'flex', background: COLORS.surfaceAlt, borderRadius: '0.5rem', overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
          {[
            { key: 'annual', icon: Grid3X3, label: 'Annual' },
            { key: 'table', icon: List, label: 'Table' },
            { key: 'calendar', icon: Calendar, label: 'Calendar' },
            { key: 'inspector', icon: User, label: 'Inspector' },
          ].map(v => (
            <button key={v.key} onClick={() => setViewMode(v.key)} title={v.label} style={{
              padding: '0.35rem 0.55rem', border: 'none', cursor: 'pointer', fontSize: '0.68rem', fontWeight: '600',
              background: viewMode === v.key ? COLORS.accent : 'transparent',
              color: viewMode === v.key ? 'white' : COLORS.text.secondary,
              display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s'
            }}>
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>

        <span style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', background: '#EFF6FF', color: COLORS.blue, fontSize: '0.7rem', fontWeight: '700', border: '1px solid #BFDBFE' }}>
          {filteredSchedules.length} audit{filteredSchedules.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content Area (printable) */}
      <div data-print-area>
        {viewMode === 'annual' && (
          <AnnualScheduleTable schedules={filteredSchedules} branches={branches} selectedYear={selectedYear}
            onEdit={(s) => { setEditingSchedule(s); setShowForm(true); }} allAuditors={allAuditors} />
        )}
        {viewMode === 'table' && (
          <ScheduleTable schedules={filteredSchedules} sortField={sortField} sortAsc={sortAsc} onSort={toggleSort}
            onEdit={(s) => { setEditingSchedule(s); setShowForm(true); }}
            onDelete={(s) => setDeleteConfirm(s)} onStatusChange={handleStatusChange} allAuditors={allAuditors} />
        )}
        {viewMode === 'calendar' && (
          <CalendarView schedules={filteredSchedules} selectedYear={selectedYear}
            onEdit={(s) => { setEditingSchedule(s); setShowForm(true); }} allAuditors={allAuditors} />
        )}
        {viewMode === 'inspector' && (
          <InspectorView schedules={filteredSchedules} selectedYear={selectedYear}
            onEdit={(s) => { setEditingSchedule(s); setShowForm(true); }} allAuditors={allAuditors} />
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <AuditFormModal schedule={editingSchedule} allStations={allStations} auditSettings={auditSettings}
          onSave={(data) => editingSchedule ? handleUpdate(editingSchedule.id, data) : handleCreate(data)}
          onClose={() => { setShowForm(false); setEditingSchedule(null); }} allAuditors={allAuditors} />
      )}
      {deleteConfirm && (
        <DeleteConfirmModal schedule={deleteConfirm}
          onConfirm={() => handleDelete(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)} />
      )}
    </div>
  );
}

// ============================================================
// Shared Styles
// ============================================================

const selectStyle = { padding: '0.4rem 0.6rem', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.4rem', color: COLORS.text.primary, fontSize: '0.75rem', outline: 'none' };
const btnPrimary = { display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: COLORS.accent, border: 'none', borderRadius: '0.5rem', color: 'white', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 8px rgba(233,69,96,0.25)' };
const btnSecondary = { display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.4rem', color: COLORS.text.secondary, fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' };
const cellStyle = { padding: '0.6rem 0.75rem', fontSize: '0.78rem', verticalAlign: 'middle', color: '#334155' };
const actionBtnStyle = { padding: '0.3rem', background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: '0.3rem', color: COLORS.text.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.3rem' };
const inputStyle = { padding: '0.5rem 0.6rem', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.4rem', color: COLORS.text.primary, fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' };

// ============================================================
// Auditor Tag Component (with color)
// ============================================================

function AuditorTag({ name, allAuditors, size = 'sm' }) {
  const c = getAuditorColor(name, allAuditors);
  const isSm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
      padding: isSm ? '0.1rem 0.35rem' : '0.2rem 0.5rem',
      borderRadius: '0.25rem', background: c.bg, color: c.text,
      fontSize: isSm ? '0.58rem' : '0.72rem', fontWeight: '600',
      border: `1px solid ${c.border}`, whiteSpace: 'nowrap'
    }}>
      <User size={isSm ? 8 : 11} /> {name}
    </span>
  );
}

// ============================================================
// Hover Tooltip Component (for calendar)
// ============================================================

function HoverTooltip({ schedule, allAuditors, style }) {
  const statusCfg = STATUS_CONFIG[schedule.status] || STATUS_CONFIG.scheduled;
  const cat = CATEGORY_LABELS[schedule.stationCategory] || CATEGORY_LABELS.overseas;
  return (
    <div style={{
      position: 'absolute', zIndex: 1000, background: '#1E293B', color: '#E2E8F0',
      borderRadius: '0.5rem', padding: '0.75rem', minWidth: '220px', maxWidth: '300px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)', fontSize: '0.72rem', lineHeight: '1.5',
      pointerEvents: 'none', ...style
    }}>
      <div style={{ fontWeight: '700', fontSize: '0.82rem', marginBottom: '0.4rem', color: '#F8FAFC' }}>
        {cat.icon} {schedule.branchName || 'Unknown'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
        <span style={{ padding: '0.1rem 0.3rem', borderRadius: '0.2rem', background: statusCfg.color, color: '#fff', fontSize: '0.6rem', fontWeight: '700' }}>
          {statusCfg.label}
        </span>
        <span style={{ color: '#94A3B8' }}>{schedule.auditType || 'General'}</span>
      </div>
      <div style={{ color: '#94A3B8', marginBottom: '0.2rem' }}>
        📅 {schedule.startDate || '-'} ~ {schedule.endDate || '-'}
      </div>
      {schedule.frequency && <div style={{ color: '#94A3B8', marginBottom: '0.2rem' }}>🔄 {schedule.frequency}</div>}
      {(schedule.auditors?.length > 0 || schedule.auditor) && (
        <div style={{ marginBottom: '0.3rem' }}>
          <span style={{ color: '#94A3B8' }}>👤 Auditors: </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.15rem' }}>
            {(schedule.auditors || [schedule.auditor]).filter(Boolean).map(a => (
              <AuditorTag key={a} name={a} allAuditors={allAuditors} size="sm" />
            ))}
          </div>
        </div>
      )}
      {schedule.notes && (
        <div style={{ borderTop: '1px solid #334155', paddingTop: '0.35rem', marginTop: '0.25rem', color: '#CBD5E1' }}>
          📝 {schedule.notes.length > 120 ? schedule.notes.substring(0, 120) + '...' : schedule.notes}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Analytics Dashboard (charts via CSS)
// ============================================================

function AnalyticsDashboard({ stats, allAuditors, selectedYear, viewMode, schedules }) {
  const [hoveredCard, setHoveredCard] = useState(null);

  // Build detail data for card hover popovers
  const cardDetails = useMemo(() => {
    if (!schedules) return {};
    const now = new Date().toISOString().split('T')[0];
    return {
      'Total Audits': schedules.slice(0, 8).map(s => `${s.branchName || '-'} (${STATUS_CONFIG[s.status]?.label || s.status})`),
      'Scheduled': schedules.filter(s => s.status === 'scheduled').slice(0, 8).map(s => `${s.branchName || '-'} — ${s.startDate || '?'}`),
      'In Progress': schedules.filter(s => s.status === 'in_progress').slice(0, 8).map(s => `${s.branchName || '-'} — ${s.startDate || '?'}`),
      'Completed': schedules.filter(s => s.status === 'completed').slice(0, 8).map(s => `${s.branchName || '-'} — ${s.startDate || '?'}`),
      'Overdue': schedules.filter(s => s.status === 'scheduled' && (s.endDate || s.auditDate || '') < now).slice(0, 8).map(s => `${s.branchName || '-'} — ${s.endDate || '?'}`),
      'Stations': Object.entries((stats || {}).byBranch || {}).slice(0, 10).map(([b, cnt]) => `${b}: ${cnt}`),
      'Findings': schedules.filter(s => (s.findingsCount || 0) > 0).slice(0, 8).map(s => `${s.branchName || '-'}: ${s.findingsCount}`),
      'Recommendations': schedules.filter(s => (s.recommendationsCount || 0) > 0).slice(0, 8).map(s => `${s.branchName || '-'}: ${s.recommendationsCount}`),
    };
  }, [schedules, stats]);

  if (!stats) return null;
  // Show dashboard even with 0 total to indicate empty state

  // Mini bar chart helper
  const MiniBarChart = ({ data, maxVal, colorFn }) => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '60px' }}>
      {Object.entries(data).slice(0, 12).map(([key, val]) => {
        const h = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const c = colorFn ? colorFn(key) : COLORS.blue;
        return (
          <div key={key} title={`${key}: ${val}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <div style={{ width: '100%', minWidth: '8px', maxWidth: '28px', height: `${Math.max(h, 4)}%`, background: c, borderRadius: '2px 2px 0 0', transition: 'height 0.3s' }} />
            <span style={{ fontSize: '0.5rem', color: COLORS.text.light, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '28px' }}>
              {key.length > 4 ? key.substring(5) || key.substring(0, 3) : key}
            </span>
          </div>
        );
      })}
    </div>
  );

  const maxMonth = Math.max(...Object.values(stats.byMonth || {}), 1);
  const maxType = Math.max(...Object.values(stats.byAuditType || {}), 1);
  const maxAuditor = Math.max(...Object.values(stats.byAuditor || {}), 1);

  // Donut-like status indicator
  const statusItems = [
    { key: 'scheduled', val: stats.scheduled, color: COLORS.blue },
    { key: 'in_progress', val: stats.inProgress, color: COLORS.yellow },
    { key: 'completed', val: stats.completed, color: COLORS.green },
    { key: 'cancelled', val: stats.cancelled, color: COLORS.red },
    { key: 'postponed', val: stats.postponed || 0, color: COLORS.orange },
  ].filter(s => s.val > 0);

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  // Aggregate findings and recommendations totals
  const totalFindings = (schedules || []).reduce((sum, s) => sum + (parseInt(s.findingsCount) || 0), 0);
  const totalRecommendations = (schedules || []).reduce((sum, s) => sum + (parseInt(s.recommendationsCount) || 0), 0);

  if (stats.total === 0) {
    return (
      <div style={{ marginBottom: '1.25rem', padding: '1.5rem', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem', textAlign: 'center' }}>
        <BarChart3 size={32} color={COLORS.text.light} style={{ marginBottom: '0.5rem' }} />
        <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.text.secondary, fontWeight: '600' }}>No audit data for {selectedYear}</p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: COLORS.text.light }}>Create your first audit schedule to see analytics</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {/* Summary Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
        {[
          { label: 'Total Audits', value: stats.total, icon: BarChart3, color: COLORS.indigo, bg: '#EEF2FF', border: '#C7D2FE' },
          { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: COLORS.blue, bg: '#EFF6FF', border: '#BFDBFE' },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, color: COLORS.yellow, bg: '#FFFBEB', border: '#FDE68A' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, color: COLORS.green, bg: '#F0FDF4', border: '#BBF7D0' },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: COLORS.red, bg: '#FEF2F2', border: '#FECACA' },
          { label: 'Stations', value: Object.keys(stats.byBranch).length, icon: Building2, color: COLORS.purple, bg: '#F5F3FF', border: '#DDD6FE' },
          { label: 'Findings', value: totalFindings, icon: AlertTriangle, color: COLORS.orange, bg: '#FFF7ED', border: '#FED7AA' },
          { label: 'Recommendations', value: totalRecommendations, icon: FileText, color: COLORS.cyan, bg: '#ECFEFF', border: '#A5F3FC' },
        ].map(card => {
          const Icon = card.icon;
          const details = cardDetails[card.label] || [];
          const isHovered = hoveredCard === card.label;
          return (
            <div key={card.label}
              onMouseEnter={() => setHoveredCard(card.label)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: '0.6rem', padding: '0.75rem', position: 'relative', cursor: 'default', transition: 'box-shadow 0.2s', boxShadow: isHovered ? '0 4px 16px rgba(0,0,0,0.12)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.35rem' }}>
                <Icon size={13} color={card.color} />
                <span style={{ fontSize: '0.65rem', fontWeight: '600', color: COLORS.text.secondary }}>{card.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', color: card.color }}>{card.value}</p>
              {/* Hover detail popover */}
              {isHovered && details.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 100,
                  marginTop: '0.35rem', background: '#1E293B', color: '#E2E8F0', borderRadius: '0.5rem',
                  padding: '0.6rem 0.75rem', minWidth: '180px', maxWidth: '260px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)', fontSize: '0.68rem', lineHeight: '1.6',
                  pointerEvents: 'none'
                }}>
                  <div style={{ fontWeight: '700', fontSize: '0.72rem', marginBottom: '0.3rem', color: card.color, borderBottom: '1px solid #334155', paddingBottom: '0.25rem' }}>
                    {card.label}: {card.value}
                  </div>
                  {details.map((d, i) => (
                    <div key={i} style={{ color: '#CBD5E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d}
                    </div>
                  ))}
                  {(cardDetails[card.label] || []).length > details.length && (
                    <div style={{ color: '#94A3B8', fontStyle: 'italic', marginTop: '0.15rem' }}>+more...</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {/* Completion Rate */}
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.6rem', padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
            <PieChart size={13} color={COLORS.green} />
            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.primary }}>Completion Rate</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ position: 'relative', width: '52px', height: '52px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={COLORS.green} strokeWidth="3"
                  strokeDasharray={`${completionRate} ${100 - completionRate}`} strokeLinecap="round" />
              </svg>
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '800', color: COLORS.green }}>{completionRate}%</span>
            </div>
            <div style={{ flex: 1 }}>
              {statusItems.map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.15rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color }} />
                  <span style={{ fontSize: '0.6rem', color: COLORS.text.secondary }}>{STATUS_CONFIG[s.key]?.label}: <strong>{s.val}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly Distribution */}
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.6rem', padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={13} color={COLORS.blue} />
            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.primary }}>Monthly Distribution</span>
          </div>
          <MiniBarChart data={(() => {
            const d = {};
            MONTHS.forEach((m, i) => {
              const key = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
              d[m] = stats.byMonth[key] || 0;
            });
            return d;
          })()} maxVal={maxMonth} />
        </div>

        {/* By Audit Type */}
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.6rem', padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
            <FileText size={13} color={COLORS.purple} />
            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.primary }}>By Audit Type</span>
          </div>
          <MiniBarChart data={stats.byAuditType} maxVal={maxType} colorFn={() => COLORS.purple} />
        </div>

        {/* By Auditor */}
        {Object.keys(stats.byAuditor || {}).length > 0 && (
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.6rem', padding: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
              <Users size={13} color={COLORS.cyan} />
              <span style={{ fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.primary }}>By Auditor</span>
            </div>
            <MiniBarChart data={stats.byAuditor} maxVal={maxAuditor} colorFn={(name) => getAuditorColor(name, allAuditors).bg} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Annual Schedule Table
// ============================================================

function AnnualScheduleTable({ schedules, branches, selectedYear, onEdit, allAuditors }) {
  const year = parseInt(selectedYear);
  const [tooltip, setTooltip] = useState(null);

  const branchSchedules = useMemo(() => {
    const grouped = {};
    schedules.forEach(s => {
      const branch = s.branchName || 'Unknown';
      if (!grouped[branch]) grouped[branch] = [];
      grouped[branch].push(s);
    });
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [schedules]);

  const getMonthRange = (schedule) => {
    const start = schedule.startDate || schedule.auditDate || '';
    const end = schedule.endDate || start;
    if (!start) return {};
    return {
      startMonth: parseInt(start.substring(5, 7), 10) - 1,
      endMonth: end ? parseInt(end.substring(5, 7), 10) - 1 : parseInt(start.substring(5, 7), 10) - 1,
    };
  };

  const todayMonth = new Date().getMonth();
  const isCurrentYear = new Date().getFullYear() === year;

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '1rem', position: 'relative' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Grid3X3 size={18} color={COLORS.accent} />
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: COLORS.text.primary }}>
          Annual Audit Schedule — {selectedYear}
        </h3>
        <span style={{ fontSize: '0.7rem', color: COLORS.text.secondary, marginLeft: 'auto' }}>
          {branchSchedules.length} stations | {schedules.length} audits
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, zIndex: 2, background: '#F8FAFC', padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: '700', color: COLORS.text.secondary, borderBottom: `2px solid ${COLORS.border}`, minWidth: '140px', borderRight: `1px solid ${COLORS.border}` }}>
                Station
              </th>
              {MONTHS.map((m, i) => (
                <th key={m} style={{ padding: '0.6rem 0.4rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: '700', borderBottom: `2px solid ${COLORS.border}`, color: isCurrentYear && i === todayMonth ? COLORS.accent : COLORS.text.secondary, background: isCurrentYear && i === todayMonth ? '#FFF1F2' : '#F8FAFC', minWidth: '58px' }}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {branchSchedules.length === 0 ? (
              <tr><td colSpan={13} style={{ padding: '2rem', textAlign: 'center', color: COLORS.text.light, fontSize: '0.85rem' }}>No audit schedules found for {selectedYear}.</td></tr>
            ) : (
              branchSchedules.map(([branch, items], rowIdx) => (
                <tr key={branch} style={{ borderBottom: `1px solid ${COLORS.borderLight}` }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: rowIdx % 2 === 0 ? '#FFFFFF' : '#FAFBFC', padding: '0.5rem 0.75rem', fontSize: '0.78rem', fontWeight: '600', color: COLORS.text.primary, borderRight: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={12} color={COLORS.blue} /> {branch}
                    </div>
                  </td>
                  {MONTHS.map((m, monthIdx) => {
                    const cellSchedules = items.filter(s => {
                      const range = getMonthRange(s);
                      if (range.startMonth === undefined) return false;
                      return monthIdx >= range.startMonth && monthIdx <= range.endMonth;
                    });
                    const isCurrentMonth = isCurrentYear && monthIdx === todayMonth;
                    return (
                      <td key={monthIdx} style={{ padding: '0.25rem', textAlign: 'center', verticalAlign: 'middle', background: isCurrentMonth ? 'rgba(233,69,96,0.03)' : (rowIdx % 2 === 0 ? '#FFFFFF' : '#FAFBFC'), borderLeft: `1px solid ${COLORS.borderLight}` }}>
                        {cellSchedules.map((s, si) => {
                          const statusCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
                          const primaryAuditor = (s.auditors || [])[0] || s.auditor;
                          const auditorColor = primaryAuditor ? getAuditorColor(primaryAuditor, allAuditors) : null;
                          return (
                            <div key={si} onClick={() => onEdit(s)}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltip({ schedule: s, x: rect.right + 8, y: rect.top });
                              }}
                              onMouseLeave={() => setTooltip(null)}
                              style={{
                                padding: '0.15rem 0.25rem', margin: '1px', borderRadius: '0.25rem',
                                background: auditorColor ? auditorColor.bg : statusCfg.bg,
                                border: `1px solid ${auditorColor ? auditorColor.border : statusCfg.border}`,
                                cursor: 'pointer', overflow: 'hidden', transition: 'all 0.15s'
                              }}
                            >
                              <div style={{ fontSize: '0.55rem', fontWeight: '700', color: auditorColor ? auditorColor.text : statusCfg.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {s.auditType ? s.auditType.split(' ').map(w => w[0]).join('') : 'A'}
                              </div>
                              {primaryAuditor && (
                                <div style={{ fontSize: '0.48rem', color: auditorColor ? auditorColor.text : COLORS.text.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.8 }}>
                                  {primaryAuditor.split(' ')[0]}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ padding: '0.75rem 1.25rem', borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.68rem', fontWeight: '600', color: COLORS.text.secondary }}>Auditors:</span>
        {allAuditors.slice(0, 10).map(a => <AuditorTag key={a} name={a} allAuditors={allAuditors} size="sm" />)}
        {allAuditors.length > 10 && <span style={{ fontSize: '0.6rem', color: COLORS.text.light }}>+{allAuditors.length - 10} more</span>}
      </div>

      {/* Floating Tooltip */}
      {tooltip && <HoverTooltip schedule={tooltip.schedule} allAuditors={allAuditors} style={{ position: 'fixed', left: Math.min(tooltip.x, window.innerWidth - 320), top: tooltip.y }} />}
    </div>
  );
}

// ============================================================
// Inspector View (with auditor colors)
// ============================================================

function InspectorView({ schedules, selectedYear, onEdit, allAuditors }) {
  const inspectorGroups = useMemo(() => {
    const grouped = {};
    schedules.forEach(s => {
      const auditors = s.auditors?.length > 0 ? s.auditors : (s.auditor ? [s.auditor] : ['Unassigned']);
      auditors.forEach(a => {
        if (!grouped[a]) grouped[a] = [];
        grouped[a].push(s);
      });
    });
    return Object.entries(grouped).sort((a, b) => {
      if (a[0] === 'Unassigned') return 1;
      if (b[0] === 'Unassigned') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [schedules]);

  const now = new Date().toISOString().split('T')[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
      {inspectorGroups.length === 0 ? (
        <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem' }}>
          <User size={40} color={COLORS.text.light} style={{ marginBottom: '0.75rem' }} />
          <p style={{ color: COLORS.text.secondary, fontSize: '0.9rem', fontWeight: '600' }}>No audit schedules found</p>
        </div>
      ) : (
        inspectorGroups.map(([auditor, items]) => {
          const c = getAuditorColor(auditor, allAuditors);
          const completedCount = items.filter(s => s.status === 'completed').length;
          const upcomingCount = items.filter(s => s.status === 'scheduled' && (s.startDate || '') >= now).length;

          return (
            <div key={auditor} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`, background: auditor === 'Unassigned' ? '#FEF2F2' : '#F8FAFC', borderLeft: `4px solid ${c.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${c.border}` }}>
                    <User size={18} color={c.text} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: COLORS.text.primary }}>{auditor}</h4>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: COLORS.text.secondary }}>{items.length} audit{items.length !== 1 ? 's' : ''} in {selectedYear}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {upcomingCount > 0 && <span style={{ padding: '0.15rem 0.4rem', borderRadius: '0.25rem', background: '#EFF6FF', color: COLORS.blue, fontSize: '0.62rem', fontWeight: '700' }}>{upcomingCount} Upcoming</span>}
                  {completedCount > 0 && <span style={{ padding: '0.15rem 0.4rem', borderRadius: '0.25rem', background: '#F0FDF4', color: COLORS.green, fontSize: '0.62rem', fontWeight: '700' }}>{completedCount} Completed</span>}
                </div>
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {items.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '')).map((s, i) => {
                  const statusCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <div key={s.id || i} onClick={() => onEdit(s)} style={{ padding: '0.75rem 1.25rem', borderBottom: `1px solid ${COLORS.borderLight}`, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceAlt}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: COLORS.text.primary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <MapPin size={12} color={COLORS.blue} /> {s.branchName}
                        </span>
                        <span style={{ padding: '0.1rem 0.35rem', borderRadius: '0.2rem', background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}`, fontSize: '0.6rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                          <StatusIcon size={9} /> {statusCfg.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: COLORS.text.secondary }}>
                        {s.startDate || '-'} ~ {s.endDate || '-'} · {s.auditType || 'General'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ============================================================
// Schedule Table
// ============================================================

function ScheduleTable({ schedules, sortField, sortAsc, onSort, onEdit, onDelete, onStatusChange, allAuditors }) {
  const columns = [
    { key: 'branchName', label: 'Station', width: '12%' },
    { key: 'auditType', label: 'Audit Type', width: '12%' },
    { key: 'startDate', label: 'Start Date', width: '9%' },
    { key: 'endDate', label: 'End Date', width: '9%' },
    { key: 'auditors', label: 'Auditors', width: '14%', noSort: true },
    { key: 'status', label: 'Status', width: '10%' },
    { key: 'results', label: '결과', width: '8%', noSort: true },
    { key: 'notes', label: 'Notes', width: '14%' },
    { key: 'actions', label: 'Actions', width: '12%', noSort: true },
  ];

  if (schedules.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem' }}>
        <CalendarDays size={40} color={COLORS.text.light} style={{ marginBottom: '0.75rem' }} />
        <p style={{ color: COLORS.text.secondary, fontSize: '0.9rem', fontWeight: '600' }}>No audit schedules found</p>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {columns.map(col => (
                <th key={col.key} onClick={() => !col.noSort && onSort(col.key)} style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: '700', color: '#475569', borderBottom: `2px solid ${COLORS.border}`, cursor: col.noSort ? 'default' : 'pointer', width: col.width }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {col.label}
                    {!col.noSort && sortField === col.key && <ArrowUpDown size={11} color={COLORS.accent} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule, idx) => {
              const statusCfg = STATUS_CONFIG[schedule.status] || STATUS_CONFIG.scheduled;
              return (
                <tr key={schedule.id || idx} style={{ borderBottom: `1px solid ${COLORS.borderLight}`, background: idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC'}>
                  <td style={cellStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MapPin size={12} color={COLORS.blue} /><span style={{ fontWeight: '600', color: '#1E293B' }}>{schedule.branchName || '-'}</span></div></td>
                  <td style={{ ...cellStyle, color: '#475569' }}>{schedule.auditType || 'General'}</td>
                  <td style={cellStyle}><span style={{ fontFamily: 'monospace', color: '#475569' }}>{schedule.startDate || '-'}</span></td>
                  <td style={cellStyle}><span style={{ fontFamily: 'monospace', color: '#475569' }}>{schedule.endDate || '-'}</span></td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                      {(schedule.auditors || []).map(a => <AuditorTag key={a} name={a} allAuditors={allAuditors} />)}
                      {!(schedule.auditors?.length) && schedule.auditor && <AuditorTag name={schedule.auditor} allAuditors={allAuditors} />}
                      {!(schedule.auditors?.length) && !schedule.auditor && <span style={{ fontSize: '0.72rem', color: COLORS.text.light }}>-</span>}
                    </div>
                  </td>
                  <td style={cellStyle}><StatusDropdown currentStatus={schedule.status} onChange={(s) => onStatusChange(schedule.id, s)} /></td>
                  <td style={cellStyle}>
                    {(schedule.findingsCount > 0 || schedule.recommendationsCount > 0) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        {schedule.findingsCount > 0 && (
                          <span style={{ fontSize: '0.68rem', color: COLORS.orange, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <AlertTriangle size={10} /> 시정 {schedule.findingsCount}
                          </span>
                        )}
                        {schedule.recommendationsCount > 0 && (
                          <span style={{ fontSize: '0.68rem', color: COLORS.cyan, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <FileText size={10} /> 권고 {schedule.recommendationsCount}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: COLORS.text.light }}>—</span>
                    )}
                  </td>
                  <td style={cellStyle}><span style={{ color: '#64748B', fontSize: '0.72rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{schedule.notes || '-'}</span></td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button onClick={() => onEdit(schedule)} title="Edit" style={actionBtnStyle}><Edit3 size={13} /></button>
                      <button onClick={() => onDelete(schedule)} title="Delete" style={{ ...actionBtnStyle, color: COLORS.red }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Status Dropdown
// ============================================================

function StatusDropdown({ currentStatus, onChange }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [dropUp, setDropUp] = useState(false);
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.scheduled;
  const StatusIcon = statusCfg.icon;

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 220);
    }
    setOpen(!open);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} onClick={handleToggle} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.5rem', borderRadius: '0.35rem', background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color, fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer' }}>
        <StatusIcon size={12} /> {statusCfg.label} <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 500 }} />
          <div style={{ position: 'absolute', [dropUp ? 'bottom' : 'top']: '100%', left: 0, zIndex: 501, [dropUp ? 'marginBottom' : 'marginTop']: '0.2rem', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: '140px' }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button key={key} onClick={() => { onChange(key); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', padding: '0.5rem 0.65rem', border: 'none', cursor: 'pointer', background: key === currentStatus ? COLORS.surfaceAlt : 'transparent', color: cfg.color, fontSize: '0.75rem', fontWeight: '600', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = key === currentStatus ? COLORS.surfaceAlt : 'transparent'}>
                  <Icon size={13} /> {cfg.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Calendar View (with hover tooltips)
// ============================================================

function CalendarView({ schedules, selectedYear, onEdit, allAuditors }) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [tooltip, setTooltip] = useState(null);

  const firstDay = new Date(parseInt(selectedYear), currentMonth, 1).getDay();
  const daysInMonth = new Date(parseInt(selectedYear), currentMonth + 1, 0).getDate();
  const dayGrid = [];
  for (let i = 0; i < firstDay; i++) dayGrid.push(null);
  for (let d = 1; d <= daysInMonth; d++) dayGrid.push(d);

  const getSchedulesForDay = (day) => {
    if (!day) return [];
    const dateStr = `${selectedYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return schedules.filter(s => {
      const start = s.startDate || s.auditDate || '';
      const end = s.endDate || start;
      return dateStr >= start && dateStr <= end;
    });
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthSchedules = schedules.filter(s => {
    const m = parseInt((s.startDate || '').substring(5, 7), 10) - 1;
    return m === currentMonth;
  });

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button onClick={() => setCurrentMonth(m => Math.max(0, m - 1))} style={btnSecondary}><ChevronLeft size={16} /></button>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: COLORS.text.primary }}>{MONTHS[currentMonth]} {selectedYear}</h3>
        <button onClick={() => setCurrentMonth(m => Math.min(11, m + 1))} style={btnSecondary}><ChevronRight size={16} /></button>
      </div>

      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {MONTHS.map((m, i) => (
          <button key={m} onClick={() => setCurrentMonth(i)} style={{ padding: '0.3rem 0.5rem', borderRadius: '0.3rem', border: `1px solid ${i === currentMonth ? COLORS.accent : COLORS.border}`, background: i === currentMonth ? '#FFF1F2' : 'transparent', color: i === currentMonth ? COLORS.accent : COLORS.text.secondary, fontSize: '0.68rem', fontWeight: '600', cursor: 'pointer' }}>{m}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ padding: '0.35rem', textAlign: 'center', fontSize: '0.68rem', fontWeight: '700', color: COLORS.text.secondary, background: '#F8FAFC', borderRadius: '0.25rem' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {dayGrid.map((day, idx) => {
          const daySchedules = getSchedulesForDay(day);
          const dateStr = day ? `${selectedYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
          const isToday = dateStr === todayStr;
          return (
            <div key={idx} style={{ minHeight: '72px', padding: '0.25rem', background: isToday ? '#FFF1F2' : (day ? '#FAFBFC' : 'transparent'), borderRadius: '0.3rem', border: isToday ? `1.5px solid ${COLORS.accent}` : `1px solid ${COLORS.borderLight}`, opacity: day ? 1 : 0.3 }}>
              {day && (
                <>
                  <div style={{ fontSize: '0.68rem', fontWeight: isToday ? '800' : '600', color: isToday ? COLORS.accent : COLORS.text.secondary, padding: '0.1rem 0.2rem' }}>{day}</div>
                  {daySchedules.slice(0, 2).map((s, i) => {
                    const primaryAuditor = (s.auditors || [])[0] || s.auditor;
                    const ac = primaryAuditor ? getAuditorColor(primaryAuditor, allAuditors) : null;
                    const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
                    return (
                      <div key={i} onClick={() => onEdit(s)}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ schedule: s, x: rect.right + 8, y: rect.top });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          padding: '0.1rem 0.25rem', margin: '1px 0', borderRadius: '0.2rem',
                          background: ac ? ac.bg : cfg.bg, borderLeft: `2.5px solid ${ac ? ac.border : cfg.color}`,
                          cursor: 'pointer', overflow: 'hidden'
                        }}>
                        <span style={{ fontSize: '0.55rem', fontWeight: '600', color: ac ? ac.text : cfg.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                          {s.branchName}
                        </span>
                      </div>
                    );
                  })}
                  {daySchedules.length > 2 && <div style={{ fontSize: '0.5rem', color: COLORS.text.light, textAlign: 'center' }}>+{daySchedules.length - 2} more</div>}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Month Summary */}
      <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', border: `1px solid ${COLORS.border}` }}>
        <span style={{ fontSize: '0.75rem', color: COLORS.text.secondary }}><strong style={{ color: COLORS.text.primary }}>{monthSchedules.length}</strong> audits in {MONTHS[currentMonth]}</span>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = monthSchedules.filter(s => s.status === key).length;
          if (count === 0) return null;
          return <span key={key} style={{ fontSize: '0.72rem', color: cfg.color, fontWeight: '600' }}>{cfg.label}: <strong>{count}</strong></span>;
        })}
      </div>

      {tooltip && <HoverTooltip schedule={tooltip.schedule} allAuditors={allAuditors} style={{ position: 'fixed', left: Math.min(tooltip.x, window.innerWidth - 320), top: tooltip.y }} />}
    </div>
  );
}

// ============================================================
// Audit Form Modal (with multi-auditor, station categories, file upload)
// ============================================================

function AuditFormModal({ schedule, allStations, auditSettings, onSave, onClose, allAuditors }) {
  const isEdit = !!schedule;
  const [form, setForm] = useState({
    branchName: schedule?.branchName || '',
    stationCategory: schedule?.stationCategory || 'overseas',
    auditType: schedule?.auditType || (auditSettings.auditTypes?.[0] || 'Regular Security Audit'),
    startDate: schedule?.startDate || schedule?.auditDate || '',
    endDate: schedule?.endDate || '',
    auditors: schedule?.auditors || (schedule?.auditor ? schedule.auditor.split(',').map(a => a.trim()).filter(Boolean) : []),
    status: schedule?.status || 'scheduled',
    frequency: schedule?.frequency || '',
    notes: schedule?.notes || '',
    findings: schedule?.findings || '',
    recommendations: schedule?.recommendations || '',
    findingsCount: schedule?.findingsCount || 0,
    recommendationsCount: schedule?.recommendationsCount || 0
  });
  const [saving, setSaving] = useState(false);
  const [auditorInput, setAuditorInput] = useState('');
  const [showAuditorDropdown, setShowAuditorDropdown] = useState(false);

  // File management
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Load existing files for edit mode
  useEffect(() => {
    if (isEdit && schedule?.id) {
      setLoadingFiles(true);
      getAuditScheduleFiles(schedule.id).then(f => setFiles(f)).catch(() => {}).finally(() => setLoadingFiles(false));
    }
  }, [isEdit, schedule?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.branchName || !form.startDate) return;
    setSaving(true);
    try {
      // Ensure auditors array and backward-compat auditor string are synced
      const submitData = {
        ...form,
        auditors: form.auditors || [],
        auditor: (form.auditors || []).join(', '),
        findingsCount: parseInt(form.findingsCount) || 0,
        recommendationsCount: parseInt(form.recommendationsCount) || 0
      };
      await onSave(submitData);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addAuditor = (name) => {
    const trimmed = name.trim();
    if (!trimmed || form.auditors.includes(trimmed)) return;
    updateField('auditors', [...form.auditors, trimmed]);
    setAuditorInput('');
    setShowAuditorDropdown(false);
  };

  const removeAuditor = (name) => {
    updateField('auditors', form.auditors.filter(a => a !== name));
  };

  const filteredSuggestions = (auditSettings.defaultAuditors || []).filter(a =>
    !form.auditors.includes(a) && a.toLowerCase().includes(auditorInput.toLowerCase())
  );

  // Station selection grouped by category
  const stationsByCategory = useMemo(() => {
    const grouped = {};
    allStations.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s.name);
    });
    return grouped;
  }, [allStations]);

  // File upload handler - supports both input change and drag-and-drop
  const [uploadError, setUploadError] = useState('');
  const handleFileUpload = async (fileToUpload) => {
    setUploadError('');
    if (!isEdit || !schedule?.id) {
      setUploadError('Save the schedule first, then re-open to attach files.');
      return;
    }
    // Accept File object directly or from event
    const file = fileToUpload instanceof File ? fileToUpload : fileToUpload?.target?.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be under 5MB');
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const result = await uploadAuditScheduleFile(schedule.id, file.name, base64, file.type, file.size);
      setFiles(prev => [...prev, { id: result.id, fileName: file.name, fileType: file.type, fileSize: file.size }]);
      setUploadError('');
    } catch (err) {
      console.error('Upload error:', err);
      if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        setUploadError('Firestore permission denied. Check database rules allow write to auditScheduleFiles.');
      } else if (err.code === 'unavailable' || err.message?.includes('offline')) {
        setUploadError('Network error. Check your internet connection.');
      } else {
        setUploadError(`Upload failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setUploading(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag-and-drop handlers for file area
  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) handleFileUpload(droppedFile);
  };

  const handleFileDownload = async (fileItem) => {
    try {
      const data = await downloadAuditScheduleFile(fileItem.id);
      if (!data?.fileBase64) return;
      const link = document.createElement('a');
      link.href = `data:${data.fileType};base64,${data.fileBase64}`;
      link.download = data.fileName;
      link.click();
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleFileDelete = async (fileItem) => {
    if (!confirm(`Delete "${fileItem.fileName}"?`)) return;
    try {
      await deleteAuditScheduleFile(fileItem.id);
      setFiles(prev => prev.filter(f => f.id !== fileItem.id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '1rem', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: COLORS.surface, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarDays size={20} color={COLORS.accent} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: COLORS.text.primary }}>{isEdit ? 'Edit Audit Schedule' : 'New Audit Schedule'}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLORS.text.secondary, cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* Station selection with categories */}
            <div>
              <label style={labelStyle}>Station *</label>
              <select value={form.branchName} onChange={e => {
                const station = allStations.find(s => s.name === e.target.value);
                updateField('branchName', e.target.value);
                if (station) updateField('stationCategory', station.category);
              }} required style={{ ...inputStyle, width: '100%' }}>
                <option value="">Select Station</option>
                {Object.entries(stationsByCategory).map(([catKey, stations]) => (
                  <optgroup key={catKey} label={`${CATEGORY_LABELS[catKey]?.icon || ''} ${CATEGORY_LABELS[catKey]?.label || catKey}`}>
                    {stations.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Audit Type</label>
              <select value={form.auditType} onChange={e => updateField('auditType', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                {(auditSettings.auditTypes || []).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => updateField('startDate', e.target.value)} required style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" value={form.endDate} onChange={e => updateField('endDate', e.target.value)} min={form.startDate} style={{ ...inputStyle, width: '100%' }} />
            </div>

            {/* Multi-Auditor Selection */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Auditor / Inspector (multi-select)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
                {form.auditors.map(a => (
                  <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', borderRadius: '0.3rem', background: getAuditorColor(a, allAuditors).bg, color: getAuditorColor(a, allAuditors).text, fontSize: '0.75rem', fontWeight: '600', border: `1px solid ${getAuditorColor(a, allAuditors).border}` }}>
                    <User size={11} /> {a}
                    <button type="button" onClick={() => removeAuditor(a)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0', display: 'flex', opacity: 0.7 }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <input type="text" value={auditorInput} onChange={e => { setAuditorInput(e.target.value); setShowAuditorDropdown(true); }}
                  onFocus={() => setShowAuditorDropdown(true)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent?.isComposing) { e.preventDefault(); addAuditor(auditorInput); } }}
                  onCompositionEnd={e => { setAuditorInput(e.target.value); }}
                  placeholder="Type name and press Enter, or select from list..."
                  style={{ ...inputStyle, width: '100%' }} />
                {showAuditorDropdown && (auditorInput || filteredSuggestions.length > 0) && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.4rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '160px', overflowY: 'auto', marginTop: '0.2rem' }}>
                    {filteredSuggestions.map(a => (
                      <button key={a} type="button" onClick={() => addAuditor(a)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%', padding: '0.45rem 0.6rem', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.78rem', color: COLORS.text.primary, textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceAlt}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <User size={12} color={COLORS.text.secondary} /> {a}
                      </button>
                    ))}
                    {auditorInput.trim() && !filteredSuggestions.includes(auditorInput.trim()) && (
                      <button type="button" onClick={() => addAuditor(auditorInput)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%', padding: '0.45rem 0.6rem', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.78rem', color: COLORS.blue, textAlign: 'left', borderTop: `1px solid ${COLORS.border}` }}>
                        <Plus size={12} /> Add "{auditorInput.trim()}"
                      </button>
                    )}
                  </div>
                )}
              </div>
              {showAuditorDropdown && <div onClick={() => setShowAuditorDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />}
            </div>

            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => updateField('status', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Frequency</label>
              <select value={form.frequency} onChange={e => updateField('frequency', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                <option value="">Select Frequency</option>
                {(auditSettings.auditFrequencies || []).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={e => updateField('notes', e.target.value)}
              placeholder="Additional notes..." rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
          </div>

          {(form.status === 'completed' || form.status === 'in_progress') && (
            <>
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#FFFBEB', borderRadius: '0.5rem', border: '1px solid #FDE68A' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={14} color={COLORS.orange} />
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: COLORS.text.primary }}>Findings (시정조치)</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: '600', color: COLORS.text.secondary, whiteSpace: 'nowrap' }}>건수:</label>
                  <input type="number" min="0" value={form.findingsCount} onChange={e => updateField('findingsCount', parseInt(e.target.value) || 0)}
                    style={{ ...inputStyle, width: '80px', textAlign: 'center', fontWeight: '700', fontSize: '0.9rem' }} />
                </div>
                <textarea value={form.findings} onChange={e => updateField('findings', e.target.value)}
                  placeholder="시정조치 세부 내용..." rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
              </div>
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#ECFEFF', borderRadius: '0.5rem', border: '1px solid #A5F3FC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <FileText size={14} color={COLORS.cyan} />
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: COLORS.text.primary }}>Recommendations (개선권고)</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: '600', color: COLORS.text.secondary, whiteSpace: 'nowrap' }}>건수:</label>
                  <input type="number" min="0" value={form.recommendationsCount} onChange={e => updateField('recommendationsCount', parseInt(e.target.value) || 0)}
                    style={{ ...inputStyle, width: '80px', textAlign: 'center', fontWeight: '700', fontSize: '0.9rem' }} />
                </div>
                <textarea value={form.recommendations} onChange={e => updateField('recommendations', e.target.value)}
                  placeholder="개선권고 세부 내용..." rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
              </div>
            </>
          )}

          {/* File Attachments (edit mode only) */}
          {isEdit && (
            <div
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              style={{
                marginTop: '1rem', padding: '0.75rem',
                background: dragOver ? '#EFF6FF' : COLORS.surfaceAlt,
                borderRadius: '0.5rem',
                border: dragOver ? `2px dashed ${COLORS.blue}` : `1px solid ${COLORS.border}`,
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ ...labelStyle, margin: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Paperclip size={14} /> Attachments
                </label>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  style={{ ...btnSecondary, fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}>
                  {uploading ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={12} />}
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => handleFileUpload(e)}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.zip" />
              </div>
              {dragOver && (
                <div style={{ padding: '0.75rem', textAlign: 'center', color: COLORS.blue, fontSize: '0.78rem', fontWeight: '600' }}>
                  Drop file here to upload
                </div>
              )}
              {uploadError && (
                <div style={{ padding: '0.5rem 0.6rem', marginBottom: '0.4rem', borderRadius: '0.3rem', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: '0.72rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <AlertTriangle size={12} /> {uploadError}
                </div>
              )}
              {loadingFiles ? (
                <div style={{ padding: '0.5rem', textAlign: 'center' }}><Loader size={14} style={{ animation: 'spin 1s linear infinite', color: COLORS.text.light }} /></div>
              ) : files.length === 0 && !dragOver ? (
                <p style={{ margin: 0, fontSize: '0.72rem', color: COLORS.text.light }}>No files attached. Upload or drag & drop checklists, documents, or photos.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {files.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', background: COLORS.surface, borderRadius: '0.3rem', border: `1px solid ${COLORS.border}` }}>
                      <FileText size={14} color={COLORS.blue} />
                      <span style={{ flex: 1, fontSize: '0.72rem', color: COLORS.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</span>
                      <span style={{ fontSize: '0.6rem', color: COLORS.text.light }}>{f.fileSize ? `${(f.fileSize / 1024).toFixed(0)}KB` : ''}</span>
                      <button type="button" onClick={() => handleFileDownload(f)} style={{ ...actionBtnStyle, padding: '0.2rem' }} title="Download"><Download size={12} /></button>
                      <button type="button" onClick={() => handleFileDelete(f)} style={{ ...actionBtnStyle, padding: '0.2rem', color: COLORS.red }} title="Delete"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: `1px solid ${COLORS.border}` }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving || !form.branchName || !form.startDate} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
              {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Delete Confirmation Modal
// ============================================================

function DeleteConfirmModal({ schedule, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '1rem', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.5rem', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', border: '2px solid #FECACA' }}>
          <Trash2 size={24} color={COLORS.red} />
        </div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '700', color: COLORS.text.primary }}>Delete Audit Schedule?</h3>
        <p style={{ fontSize: '0.82rem', color: COLORS.text.secondary, marginBottom: '1.25rem' }}>
          This will permanently delete the audit schedule for <strong>{schedule.branchName}</strong> on {schedule.startDate || schedule.auditDate}.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
          <button onClick={onConfirm} style={{ ...btnPrimary, background: COLORS.red }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export default SecurityAuditSchedulePage;
