/**
 * Security Audit Schedule Page (Admin-Only Module)
 * 
 * Integrated from the standalone branch-security-audit app
 * (https://branch-security-audit.vercel.app)
 * 
 * Features:
 * - View/manage audit schedules for all branches
 * - Create, edit, delete audit entries
 * - Status tracking (scheduled, in_progress, completed, cancelled, postponed)
 * - Dashboard statistics with visual cards
 * - Year/branch/status filtering
 * - Calendar-style month view
 * - Admin-only access via AuthContext
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../core/AuthContext';
import {
  getAuditSchedules,
  createAuditSchedule,
  updateAuditSchedule,
  deleteAuditSchedule,
  getAuditStatistics,
  loadAuditSettings,
  DEFAULT_AUDIT_SETTINGS
} from '../../firebase/auditSchedule';
import { getAllBranches } from '../../firebase/collections';
import {
  ShieldAlert, Calendar, Plus, Edit3, Trash2, CheckCircle, Clock, AlertTriangle,
  XCircle, Filter, RefreshCw, ChevronLeft, ChevronRight, Building2, Users,
  FileText, Search, Loader, X, Save, CalendarDays, BarChart3, MapPin,
  ChevronDown, ArrowUpDown, Pause
} from 'lucide-react';

// ============================================================
// Constants
// ============================================================

const COLORS = {
  bg: '#0F2030',
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  border: '#1E3A5F',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  accent: '#E94560',
  blue: '#3B82F6',
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
  purple: '#a855f7',
  orange: '#f97316',
  cyan: '#06b6d4'
};

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: COLORS.blue, icon: Calendar, bg: 'rgba(59,130,246,0.12)' },
  in_progress: { label: 'In Progress', color: COLORS.yellow, icon: Clock, bg: 'rgba(245,158,11,0.12)' },
  completed: { label: 'Completed', color: COLORS.green, icon: CheckCircle, bg: 'rgba(34,197,94,0.12)' },
  cancelled: { label: 'Cancelled', color: COLORS.red, icon: XCircle, bg: 'rgba(239,68,68,0.12)' },
  postponed: { label: 'Postponed', color: COLORS.orange, icon: Pause, bg: 'rgba(249,115,22,0.12)' }
};

// ============================================================
// Main Page Component
// ============================================================

function SecurityAuditSchedulePage() {
  const { currentUser, isAdmin } = useAuth();

  // Data state
  const [schedules, setSchedules] = useState([]);
  const [branches, setBranches] = useState([]);
  const [auditSettings, setAuditSettings] = useState(DEFAULT_AUDIT_SETTINGS);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [filterBranch, setFilterBranch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('startDate');
  const [sortAsc, setSortAsc] = useState(false);

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'calendar'

  // Access restriction
  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <ShieldAlert size={48} color="#F87171" />
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: COLORS.text.primary }}>Access Restricted</h2>
        <p style={{ fontSize: '0.85rem', color: COLORS.text.secondary }}>
          Only HQ administrators can access the Security Audit Schedule module.
        </p>
      </div>
    );
  }

  // Load data
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

  // Filtered & sorted schedules
  const filteredSchedules = useMemo(() => {
    let result = [...schedules];
    if (filterBranch) result = result.filter(s => s.branchName === filterBranch);
    if (filterStatus) result = result.filter(s => s.status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.branchName || '').toLowerCase().includes(q) ||
        (s.auditType || '').toLowerCase().includes(q) ||
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

  // CRUD handlers
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

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '0.75rem' }}>
        <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: COLORS.accent }} />
        <p style={{ color: COLORS.text.secondary, fontSize: '0.85rem' }}>Loading audit schedules...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '100%' }}>
      {/* Message Banner */}
      {message.text && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: '0.5rem',
          background: message.type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
          color: message.type === 'error' ? '#F87171' : '#34D399',
          border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          {message.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `linear-gradient(135deg, ${COLORS.accent} 0%, #c23150 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(233,69,96,0.3)'
          }}>
            <CalendarDays size={22} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: COLORS.text.primary }}>
              Security Audit Schedule
            </h1>
            <p style={{ margin: 0, fontSize: '0.72rem', color: COLORS.text.secondary }}>
              Branch security audit planning & tracking
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={loadData} disabled={refreshing} style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem',
            background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`, borderRadius: '0.4rem',
            color: COLORS.text.secondary, fontSize: '0.75rem', fontWeight: '600', cursor: refreshing ? 'not-allowed' : 'pointer'
          }}>
            <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
          <button onClick={() => { setEditingSchedule(null); setShowForm(true); }} style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.9rem',
            background: COLORS.accent, border: 'none', borderRadius: '0.4rem',
            color: 'white', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(233,69,96,0.3)'
          }}>
            <Plus size={16} />
            New Audit
          </button>
        </div>
      </div>

      {/* Statistics Dashboard */}
      {stats && <StatsDashboard stats={stats} />}

      {/* Filters Bar */}
      <div style={{
        display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center',
        padding: '0.75rem', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.6rem'
      }}>
        <Filter size={15} color={COLORS.text.secondary} style={{ flexShrink: 0 }} />

        {/* Year selector */}
        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
          style={selectStyle}>
          {Array.from({ length: 5 }, (_, i) => {
            const y = new Date().getFullYear() - 2 + i;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>

        {/* Branch filter */}
        <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}
          style={selectStyle}>
          <option value="">All Branches</option>
          {branches.map(b => (
            <option key={b.id} value={b.branchName || b.name}>{b.branchName || b.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={selectStyle}>
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: COLORS.text.light }} />
          <input
            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search audits..."
            style={{
              ...selectStyle, width: '100%', paddingLeft: '1.7rem', minWidth: '120px'
            }}
          />
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', background: COLORS.surfaceLight, borderRadius: '0.35rem', overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
          <button onClick={() => setViewMode('table')} style={{
            padding: '0.35rem 0.6rem', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600',
            background: viewMode === 'table' ? COLORS.accent : 'transparent',
            color: viewMode === 'table' ? 'white' : COLORS.text.secondary
          }}>Table</button>
          <button onClick={() => setViewMode('calendar')} style={{
            padding: '0.35rem 0.6rem', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600',
            background: viewMode === 'calendar' ? COLORS.accent : 'transparent',
            color: viewMode === 'calendar' ? 'white' : COLORS.text.secondary
          }}>Calendar</button>
        </div>

        {/* Count badge */}
        <span style={{
          padding: '0.25rem 0.6rem', borderRadius: '0.3rem',
          background: `${COLORS.blue}20`, color: COLORS.blue,
          fontSize: '0.7rem', fontWeight: '700'
        }}>
          {filteredSchedules.length} audit{filteredSchedules.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <ScheduleTable
          schedules={filteredSchedules}
          sortField={sortField}
          sortAsc={sortAsc}
          onSort={toggleSort}
          onEdit={(s) => { setEditingSchedule(s); setShowForm(true); }}
          onDelete={(s) => setDeleteConfirm(s)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <CalendarView
          schedules={filteredSchedules}
          selectedYear={selectedYear}
          onEdit={(s) => { setEditingSchedule(s); setShowForm(true); }}
        />
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <AuditFormModal
          schedule={editingSchedule}
          branches={branches}
          auditSettings={auditSettings}
          onSave={(data) => editingSchedule ? handleUpdate(editingSchedule.id, data) : handleCreate(data)}
          onClose={() => { setShowForm(false); setEditingSchedule(null); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <DeleteConfirmModal
          schedule={deleteConfirm}
          onConfirm={() => handleDelete(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Shared Styles
// ============================================================

const selectStyle = {
  padding: '0.4rem 0.6rem', background: COLORS.surfaceLight,
  border: `1px solid ${COLORS.border}`, borderRadius: '0.35rem',
  color: COLORS.text.primary, fontSize: '0.75rem', outline: 'none'
};

// ============================================================
// Statistics Dashboard
// ============================================================

function StatsDashboard({ stats }) {
  const cards = [
    { label: 'Total Audits', value: stats.total, icon: BarChart3, color: COLORS.blue },
    { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: COLORS.blue },
    { label: 'In Progress', value: stats.inProgress, icon: Clock, color: COLORS.yellow },
    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: COLORS.green },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: COLORS.red },
    { label: 'Branches', value: Object.keys(stats.byBranch).length, icon: Building2, color: COLORS.purple },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
      gap: '0.75rem', marginBottom: '1.25rem'
    }}>
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div key={card.label} style={{
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: '0.65rem', padding: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <Icon size={14} color={card.color} />
              <span style={{ fontSize: '0.68rem', fontWeight: '600', color: COLORS.text.secondary }}>{card.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', color: card.color }}>{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Schedule Table
// ============================================================

function ScheduleTable({ schedules, sortField, sortAsc, onSort, onEdit, onDelete, onStatusChange }) {
  const columns = [
    { key: 'branchName', label: 'Branch', width: '12%' },
    { key: 'auditType', label: 'Audit Type', width: '15%' },
    { key: 'startDate', label: 'Start Date', width: '10%' },
    { key: 'endDate', label: 'End Date', width: '10%' },
    { key: 'auditor', label: 'Auditor', width: '12%' },
    { key: 'status', label: 'Status', width: '12%' },
    { key: 'notes', label: 'Notes', width: '17%' },
    { key: 'actions', label: 'Actions', width: '12%', noSort: true },
  ];

  if (schedules.length === 0) {
    return (
      <div style={{
        padding: '3rem', textAlign: 'center', background: COLORS.surface,
        border: `1px solid ${COLORS.border}`, borderRadius: '0.65rem'
      }}>
        <CalendarDays size={40} color={COLORS.text.light} style={{ marginBottom: '0.75rem' }} />
        <p style={{ color: COLORS.text.secondary, fontSize: '0.9rem', fontWeight: '600' }}>No audit schedules found</p>
        <p style={{ color: COLORS.text.light, fontSize: '0.78rem' }}>Create a new audit schedule to get started.</p>
      </div>
    );
  }

  return (
    <div style={{
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: '0.65rem', overflow: 'hidden'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ background: COLORS.surfaceLight }}>
              {columns.map(col => (
                <th key={col.key}
                  onClick={() => !col.noSort && onSort(col.key)}
                  style={{
                    padding: '0.65rem 0.75rem', textAlign: 'left', fontSize: '0.7rem',
                    fontWeight: '700', color: COLORS.text.secondary, borderBottom: `1px solid ${COLORS.border}`,
                    cursor: col.noSort ? 'default' : 'pointer', userSelect: 'none',
                    width: col.width, whiteSpace: 'nowrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {col.label}
                    {!col.noSort && sortField === col.key && (
                      <ArrowUpDown size={11} color={COLORS.accent} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule, idx) => {
              const statusCfg = STATUS_CONFIG[schedule.status] || STATUS_CONFIG.scheduled;
              const StatusIcon = statusCfg.icon;
              return (
                <tr key={schedule.id || idx} style={{
                  borderBottom: idx < schedules.length - 1 ? `1px solid ${COLORS.border}` : 'none'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceLight}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={12} color={COLORS.blue} />
                      <span style={{ fontWeight: '600', color: COLORS.text.primary }}>{schedule.branchName || '-'}</span>
                    </div>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ color: COLORS.text.primary, fontSize: '0.78rem' }}>
                      {schedule.auditType || 'General'}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ color: COLORS.text.primary, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      {schedule.startDate || schedule.auditDate || '-'}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ color: COLORS.text.primary, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      {schedule.endDate || '-'}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Users size={12} color={COLORS.text.secondary} />
                      <span style={{ color: COLORS.text.primary, fontSize: '0.78rem' }}>{schedule.auditor || '-'}</span>
                    </div>
                  </td>
                  <td style={cellStyle}>
                    <StatusDropdown
                      currentStatus={schedule.status}
                      onChange={(newStatus) => onStatusChange(schedule.id, newStatus)}
                    />
                  </td>
                  <td style={cellStyle}>
                    <span style={{ color: COLORS.text.secondary, fontSize: '0.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {schedule.notes || '-'}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button onClick={() => onEdit(schedule)} title="Edit" style={actionBtnStyle}>
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => onDelete(schedule)} title="Delete" style={{ ...actionBtnStyle, color: COLORS.red }}>
                        <Trash2 size={13} />
                      </button>
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

const cellStyle = { padding: '0.6rem 0.75rem', fontSize: '0.78rem', verticalAlign: 'middle' };
const actionBtnStyle = {
  padding: '0.3rem', background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
  borderRadius: '0.3rem', color: COLORS.text.secondary, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center'
};

// ============================================================
// Status Dropdown
// ============================================================

function StatusDropdown({ currentStatus, onChange }) {
  const [open, setOpen] = useState(false);
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.scheduled;
  const StatusIcon = statusCfg.icon;

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: '0.3rem',
        padding: '0.25rem 0.5rem', borderRadius: '0.35rem',
        background: statusCfg.bg, border: `1px solid ${statusCfg.color}30`,
        color: statusCfg.color, fontSize: '0.72rem', fontWeight: '600',
        cursor: 'pointer', whiteSpace: 'nowrap'
      }}>
        <StatusIcon size={12} />
        {statusCfg.label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 500 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 501, marginTop: '0.2rem',
            background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.4rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden', minWidth: '130px'
          }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button key={key} onClick={() => { onChange(key); setOpen(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%',
                  padding: '0.45rem 0.65rem', border: 'none', cursor: 'pointer',
                  background: key === currentStatus ? COLORS.surfaceLight : 'transparent',
                  color: cfg.color, fontSize: '0.72rem', fontWeight: '600', textAlign: 'left'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceLight}
                  onMouseLeave={e => e.currentTarget.style.background = key === currentStatus ? COLORS.surfaceLight : 'transparent'}
                >
                  <Icon size={12} />
                  {cfg.label}
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
// Calendar View
// ============================================================

function CalendarView({ schedules, selectedYear, onEdit }) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthSchedules = useMemo(() => {
    return schedules.filter(s => {
      const date = s.startDate || s.auditDate || '';
      const m = parseInt(date.substring(5, 7), 10) - 1;
      return m === currentMonth;
    });
  }, [schedules, currentMonth]);

  // Build day grid
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

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.65rem', padding: '1rem' }}>
      {/* Month Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button onClick={() => setCurrentMonth(m => Math.max(0, m - 1))} style={{ ...actionBtnStyle, padding: '0.4rem' }}>
          <ChevronLeft size={16} />
        </button>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: COLORS.text.primary }}>
          {months[currentMonth]} {selectedYear}
        </h3>
        <button onClick={() => setCurrentMonth(m => Math.min(11, m + 1))} style={{ ...actionBtnStyle, padding: '0.4rem' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Month Quick Select */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {months.map((m, i) => (
          <button key={m} onClick={() => setCurrentMonth(i)} style={{
            padding: '0.25rem 0.45rem', borderRadius: '0.25rem',
            border: `1px solid ${i === currentMonth ? COLORS.accent : COLORS.border}`,
            background: i === currentMonth ? `${COLORS.accent}20` : 'transparent',
            color: i === currentMonth ? COLORS.accent : COLORS.text.secondary,
            fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer'
          }}>{m}</button>
        ))}
      </div>

      {/* Day Headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{
            padding: '0.3rem', textAlign: 'center', fontSize: '0.65rem',
            fontWeight: '700', color: COLORS.text.secondary,
            background: COLORS.surfaceLight, borderRadius: '0.2rem'
          }}>{d}</div>
        ))}
      </div>

      {/* Day Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {dayGrid.map((day, idx) => {
          const daySchedules = getSchedulesForDay(day);
          const dateStr = day ? `${selectedYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
          const isToday = dateStr === todayStr;
          return (
            <div key={idx} style={{
              minHeight: '60px', padding: '0.2rem',
              background: isToday ? `${COLORS.accent}10` : (day ? COLORS.surfaceLight : 'transparent'),
              borderRadius: '0.25rem', border: isToday ? `1px solid ${COLORS.accent}40` : `1px solid transparent`,
              opacity: day ? 1 : 0.3
            }}>
              {day && (
                <>
                  <div style={{
                    fontSize: '0.65rem', fontWeight: isToday ? '800' : '600',
                    color: isToday ? COLORS.accent : COLORS.text.secondary,
                    padding: '0.1rem 0.2rem'
                  }}>{day}</div>
                  {daySchedules.slice(0, 2).map((s, i) => {
                    const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
                    return (
                      <div key={i} onClick={() => onEdit(s)} style={{
                        padding: '0.1rem 0.25rem', margin: '1px 0', borderRadius: '0.15rem',
                        background: cfg.bg, borderLeft: `2px solid ${cfg.color}`,
                        cursor: 'pointer', overflow: 'hidden'
                      }}>
                        <span style={{ fontSize: '0.55rem', fontWeight: '600', color: cfg.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                          {s.branchName}
                        </span>
                      </div>
                    );
                  })}
                  {daySchedules.length > 2 && (
                    <div style={{ fontSize: '0.5rem', color: COLORS.text.light, textAlign: 'center' }}>
                      +{daySchedules.length - 2} more
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Month Summary */}
      <div style={{
        marginTop: '1rem', padding: '0.75rem', background: COLORS.surfaceLight,
        borderRadius: '0.4rem', display: 'flex', gap: '1rem', flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '0.72rem', color: COLORS.text.secondary }}>
          <strong style={{ color: COLORS.text.primary }}>{monthSchedules.length}</strong> audits in {months[currentMonth]}
        </span>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = monthSchedules.filter(s => s.status === key).length;
          if (count === 0) return null;
          return (
            <span key={key} style={{ fontSize: '0.68rem', color: cfg.color }}>
              {cfg.label}: <strong>{count}</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Audit Form Modal (Create/Edit)
// ============================================================

function AuditFormModal({ schedule, branches, auditSettings, onSave, onClose }) {
  const isEdit = !!schedule;
  const [form, setForm] = useState({
    branchName: schedule?.branchName || '',
    auditType: schedule?.auditType || (auditSettings.auditTypes?.[0] || 'Regular Security Audit'),
    startDate: schedule?.startDate || schedule?.auditDate || '',
    endDate: schedule?.endDate || '',
    auditor: schedule?.auditor || '',
    status: schedule?.status || 'scheduled',
    frequency: schedule?.frequency || '',
    notes: schedule?.notes || '',
    findings: schedule?.findings || '',
    recommendations: schedule?.recommendations || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.branchName || !form.startDate) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', padding: '1rem'
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: '0.75rem', width: '100%', maxWidth: '600px',
        maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: COLORS.surface, zIndex: 1
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarDays size={20} color={COLORS.accent} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: COLORS.text.primary }}>
              {isEdit ? 'Edit Audit Schedule' : 'New Audit Schedule'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLORS.text.secondary, cursor: 'pointer', padding: '0.2rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* Branch */}
            <div>
              <label style={labelStyle}>Branch *</label>
              <select value={form.branchName} onChange={e => updateField('branchName', e.target.value)}
                required style={{ ...inputStyle, width: '100%' }}>
                <option value="">Select Branch</option>
                {branches.map(b => (
                  <option key={b.id} value={b.branchName || b.name}>{b.branchName || b.name}</option>
                ))}
              </select>
            </div>

            {/* Audit Type */}
            <div>
              <label style={labelStyle}>Audit Type</label>
              <select value={form.auditType} onChange={e => updateField('auditType', e.target.value)}
                style={{ ...inputStyle, width: '100%' }}>
                {(auditSettings.auditTypes || []).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label style={labelStyle}>Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => updateField('startDate', e.target.value)}
                required style={{ ...inputStyle, width: '100%' }} />
            </div>

            {/* End Date */}
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" value={form.endDate} onChange={e => updateField('endDate', e.target.value)}
                min={form.startDate}
                style={{ ...inputStyle, width: '100%' }} />
            </div>

            {/* Auditor */}
            <div>
              <label style={labelStyle}>Auditor</label>
              <input type="text" value={form.auditor} onChange={e => updateField('auditor', e.target.value)}
                placeholder="Auditor name" style={{ ...inputStyle, width: '100%' }}
                list="auditor-suggestions" />
              <datalist id="auditor-suggestions">
                {(auditSettings.defaultAuditors || []).map(a => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>

            {/* Status */}
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => updateField('status', e.target.value)}
                style={{ ...inputStyle, width: '100%' }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>

            {/* Frequency */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Frequency</label>
              <select value={form.frequency} onChange={e => updateField('frequency', e.target.value)}
                style={{ ...inputStyle, width: '100%' }}>
                <option value="">Select Frequency</option>
                {(auditSettings.auditFrequencies || []).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginTop: '0.75rem' }}>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={e => updateField('notes', e.target.value)}
              placeholder="Additional notes about this audit..."
              rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
          </div>

          {/* Findings (for completed audits) */}
          {(form.status === 'completed' || form.status === 'in_progress') && (
            <>
              <div style={{ marginTop: '0.75rem' }}>
                <label style={labelStyle}>Findings</label>
                <textarea value={form.findings} onChange={e => updateField('findings', e.target.value)}
                  placeholder="Audit findings..."
                  rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <label style={labelStyle}>Recommendations</label>
                <textarea value={form.recommendations} onChange={e => updateField('recommendations', e.target.value)}
                  placeholder="Recommendations..."
                  rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
              </div>
            </>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: `1px solid ${COLORS.border}` }}>
            <button type="button" onClick={onClose} style={{
              padding: '0.55rem 1.2rem', background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
              borderRadius: '0.4rem', color: COLORS.text.secondary, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
            }}>Cancel</button>
            <button type="submit" disabled={saving || !form.branchName || !form.startDate} style={{
              padding: '0.55rem 1.2rem', background: COLORS.accent, border: 'none',
              borderRadius: '0.4rem', color: 'white', fontSize: '0.8rem', fontWeight: '700',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: '0.35rem'
            }}>
              {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
              {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.3rem' };
const inputStyle = {
  padding: '0.5rem 0.6rem', background: COLORS.surfaceLight,
  border: `1px solid ${COLORS.border}`, borderRadius: '0.4rem',
  color: COLORS.text.primary, fontSize: '0.82rem', outline: 'none',
  boxSizing: 'border-box'
};

// ============================================================
// Delete Confirmation Modal
// ============================================================

function DeleteConfirmModal({ schedule, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', padding: '1rem'
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '420px', width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', textAlign: 'center'
      }}>
        <div style={{
          width: '50px', height: '50px', borderRadius: '50%',
          background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 1rem'
        }}>
          <Trash2 size={24} color={COLORS.red} />
        </div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '700', color: COLORS.text.primary }}>
          Delete Audit Schedule?
        </h3>
        <p style={{ fontSize: '0.82rem', color: COLORS.text.secondary, marginBottom: '1.25rem', lineHeight: '1.5' }}>
          This will permanently delete the audit schedule for<br />
          <strong style={{ color: COLORS.text.primary }}>{schedule.branchName}</strong> on {schedule.startDate || schedule.auditDate}.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button onClick={onCancel} style={{
            padding: '0.55rem 1.5rem', background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
            borderRadius: '0.4rem', color: COLORS.text.secondary, fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer'
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '0.55rem 1.5rem', background: COLORS.red, border: 'none',
            borderRadius: '0.4rem', color: 'white', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer'
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export default SecurityAuditSchedulePage;
