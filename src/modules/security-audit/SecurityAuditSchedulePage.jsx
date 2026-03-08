/**
 * Security Audit Schedule Page (Admin-Only Module) — v2
 * 
 * Integrated from the standalone branch-security-audit app
 * (https://branch-security-audit.vercel.app)
 * 
 * Features:
 * - Comprehensive Annual Schedule Table (12-month Gantt-style view)
 * - Inspector-specific schedule cards
 * - View/manage audit schedules for all branches
 * - Create, edit, delete audit entries
 * - Status tracking (scheduled, in_progress, completed, cancelled, postponed)
 * - Dashboard statistics with visual cards
 * - Year/branch/status filtering
 * - Calendar-style month view
 * - Light background with dark text for readability
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
  ChevronDown, ArrowUpDown, Pause, User, List, Grid3X3, Eye
} from 'lucide-react';

// ============================================================
// Light-Theme Color Palette
// ============================================================

const COLORS = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  text: { primary: '#1E293B', secondary: '#64748B', light: '#94A3B8', white: '#FFFFFF' },
  accent: '#E94560',
  blue: '#3B82F6',
  green: '#16A34A',
  yellow: '#D97706',
  red: '#DC2626',
  purple: '#7C3AED',
  orange: '#EA580C',
  cyan: '#0891B2',
  indigo: '#4F46E5',
};

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: COLORS.blue, bg: '#EFF6FF', border: '#BFDBFE', icon: Calendar },
  in_progress: { label: 'In Progress', color: COLORS.yellow, bg: '#FFFBEB', border: '#FDE68A', icon: Clock },
  completed: { label: 'Completed', color: COLORS.green, bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: COLORS.red, bg: '#FEF2F2', border: '#FECACA', icon: XCircle },
  postponed: { label: 'Postponed', color: COLORS.orange, bg: '#FFF7ED', border: '#FED7AA', icon: Pause }
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  const [viewMode, setViewMode] = useState('annual'); // 'annual', 'table', 'calendar', 'inspector'

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
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
              Branch security audit planning & tracking — {selectedYear}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={loadData} disabled={refreshing} style={{
            ...btnSecondary,
            cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.6 : 1
          }}>
            <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
          <button onClick={() => { setEditingSchedule(null); setShowForm(true); }} style={btnPrimary}>
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
          <option value="">All Branches</option>
          {branches.map(b => (
            <option key={b.id} value={b.branchName || b.name}>{b.branchName || b.name}</option>
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
              <v.icon size={13} />
              {v.label}
            </button>
          ))}
        </div>

        <span style={{
          padding: '0.25rem 0.6rem', borderRadius: '0.3rem',
          background: '#EFF6FF', color: COLORS.blue,
          fontSize: '0.7rem', fontWeight: '700', border: '1px solid #BFDBFE'
        }}>
          {filteredSchedules.length} audit{filteredSchedules.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Annual Schedule Table */}
      {viewMode === 'annual' && (
        <AnnualScheduleTable
          schedules={filteredSchedules}
          branches={branches}
          selectedYear={selectedYear}
          onEdit={(s) => { setEditingSchedule(s); setShowForm(true); }}
        />
      )}

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

      {/* Inspector View */}
      {viewMode === 'inspector' && (
        <InspectorView
          schedules={filteredSchedules}
          selectedYear={selectedYear}
          onEdit={(s) => { setEditingSchedule(s); setShowForm(true); }}
        />
      )}

      {/* Modals */}
      {showForm && (
        <AuditFormModal
          schedule={editingSchedule}
          branches={branches}
          auditSettings={auditSettings}
          onSave={(data) => editingSchedule ? handleUpdate(editingSchedule.id, data) : handleCreate(data)}
          onClose={() => { setShowForm(false); setEditingSchedule(null); }}
        />
      )}

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
  padding: '0.4rem 0.6rem', background: COLORS.surface,
  border: `1px solid ${COLORS.border}`, borderRadius: '0.4rem',
  color: COLORS.text.primary, fontSize: '0.75rem', outline: 'none'
};

const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem',
  background: COLORS.accent, border: 'none', borderRadius: '0.5rem',
  color: 'white', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(233,69,96,0.25)'
};

const btnSecondary = {
  display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem',
  background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.4rem',
  color: COLORS.text.secondary, fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer'
};

// ============================================================
// Statistics Dashboard (light theme)
// ============================================================

function StatsDashboard({ stats }) {
  const cards = [
    { label: 'Total Audits', value: stats.total, icon: BarChart3, color: COLORS.indigo, bg: '#EEF2FF', border: '#C7D2FE' },
    { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: COLORS.blue, bg: '#EFF6FF', border: '#BFDBFE' },
    { label: 'In Progress', value: stats.inProgress, icon: Clock, color: COLORS.yellow, bg: '#FFFBEB', border: '#FDE68A' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: COLORS.green, bg: '#F0FDF4', border: '#BBF7D0' },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: COLORS.red, bg: '#FEF2F2', border: '#FECACA' },
    { label: 'Branches', value: Object.keys(stats.byBranch).length, icon: Building2, color: COLORS.purple, bg: '#F5F3FF', border: '#DDD6FE' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div key={card.label} style={{
            background: card.bg, border: `1px solid ${card.border}`,
            borderRadius: '0.75rem', padding: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Icon size={15} color={card.color} />
              <span style={{ fontSize: '0.7rem', fontWeight: '600', color: COLORS.text.secondary }}>{card.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: '900', color: card.color }}>{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Annual Schedule Table (Comprehensive 12-month Gantt-style)
// ============================================================

function AnnualScheduleTable({ schedules, branches, selectedYear, onEdit }) {
  const year = parseInt(selectedYear);

  // Group schedules by branch
  const branchSchedules = useMemo(() => {
    const grouped = {};
    schedules.forEach(s => {
      const branch = s.branchName || 'Unknown';
      if (!grouped[branch]) grouped[branch] = [];
      grouped[branch].push(s);
    });
    // Sort branches alphabetically
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [schedules]);

  // Get the month range for a schedule
  const getMonthRange = (schedule) => {
    const start = schedule.startDate || schedule.auditDate || '';
    const end = schedule.endDate || start;
    if (!start) return [];
    const startMonth = parseInt(start.substring(5, 7), 10) - 1;
    const endMonth = end ? parseInt(end.substring(5, 7), 10) - 1 : startMonth;
    const startDay = parseInt(start.substring(8, 10), 10) || 1;
    const endDay = end ? parseInt(end.substring(8, 10), 10) || 28 : startDay;
    return { startMonth, endMonth, startDay, endDay };
  };

  const todayMonth = new Date().getMonth();
  const todayDay = new Date().getDate();
  const isCurrentYear = new Date().getFullYear() === year;

  return (
    <div style={{
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      marginBottom: '1rem'
    }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Grid3X3 size={18} color={COLORS.accent} />
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: COLORS.text.primary }}>
          Annual Audit Schedule — {selectedYear}
        </h3>
        <span style={{ fontSize: '0.7rem', color: COLORS.text.secondary, marginLeft: 'auto' }}>
          {branchSchedules.length} branches | {schedules.length} audits
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr>
              <th style={{
                position: 'sticky', left: 0, zIndex: 2, background: '#F8FAFC',
                padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.72rem',
                fontWeight: '700', color: COLORS.text.secondary, borderBottom: `2px solid ${COLORS.border}`,
                minWidth: '140px', borderRight: `1px solid ${COLORS.border}`
              }}>
                Branch / Station
              </th>
              {MONTHS.map((m, i) => (
                <th key={m} style={{
                  padding: '0.6rem 0.4rem', textAlign: 'center', fontSize: '0.7rem',
                  fontWeight: '700', borderBottom: `2px solid ${COLORS.border}`,
                  color: isCurrentYear && i === todayMonth ? COLORS.accent : COLORS.text.secondary,
                  background: isCurrentYear && i === todayMonth ? '#FFF1F2' : '#F8FAFC',
                  minWidth: '58px'
                }}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {branchSchedules.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ padding: '2rem', textAlign: 'center', color: COLORS.text.light, fontSize: '0.85rem' }}>
                  No audit schedules found for {selectedYear}. Click "New Audit" to create one.
                </td>
              </tr>
            ) : (
              branchSchedules.map(([branch, items], rowIdx) => (
                <tr key={branch} style={{ borderBottom: `1px solid ${COLORS.borderLight}` }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 1, background: rowIdx % 2 === 0 ? '#FFFFFF' : '#FAFBFC',
                    padding: '0.5rem 0.75rem', fontSize: '0.78rem', fontWeight: '600',
                    color: COLORS.text.primary, borderRight: `1px solid ${COLORS.border}`,
                    whiteSpace: 'nowrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={12} color={COLORS.blue} />
                      {branch}
                    </div>
                  </td>
                  {MONTHS.map((m, monthIdx) => {
                    const cellSchedules = items.filter(s => {
                      const range = getMonthRange(s);
                      if (!range.startMonth && range.startMonth !== 0) return false;
                      return monthIdx >= range.startMonth && monthIdx <= range.endMonth;
                    });
                    const isCurrentMonth = isCurrentYear && monthIdx === todayMonth;
                    return (
                      <td key={monthIdx} style={{
                        padding: '0.25rem', textAlign: 'center', verticalAlign: 'middle',
                        background: isCurrentMonth
                          ? 'rgba(233,69,96,0.03)'
                          : (rowIdx % 2 === 0 ? '#FFFFFF' : '#FAFBFC'),
                        borderLeft: `1px solid ${COLORS.borderLight}`,
                        position: 'relative', minHeight: '36px'
                      }}>
                        {cellSchedules.map((s, si) => {
                          const statusCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
                          return (
                            <div key={si} onClick={() => onEdit(s)} title={`${s.auditType || 'Audit'}\n${s.auditor || 'No auditor'}\n${s.startDate} ~ ${s.endDate || ''}`}
                              style={{
                                padding: '0.15rem 0.25rem', margin: '1px', borderRadius: '0.25rem',
                                background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
                                cursor: 'pointer', overflow: 'hidden', transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                              <div style={{ fontSize: '0.55rem', fontWeight: '700', color: statusCfg.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {s.auditType ? s.auditType.split(' ').map(w => w[0]).join('') : 'A'}
                              </div>
                              {s.auditor && (
                                <div style={{ fontSize: '0.48rem', color: COLORS.text.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {s.auditor.split(' ')[0]}
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
      <div style={{
        padding: '0.75rem 1.25rem', borderTop: `1px solid ${COLORS.border}`,
        display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center'
      }}>
        <span style={{ fontSize: '0.68rem', fontWeight: '600', color: COLORS.text.secondary }}>Legend:</span>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: cfg.bg, border: `1px solid ${cfg.border}` }} />
            <span style={{ fontSize: '0.65rem', color: COLORS.text.secondary }}>{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Inspector View (Inspector-specific schedule cards)
// ============================================================

function InspectorView({ schedules, selectedYear, onEdit }) {
  // Group by auditor
  const inspectorGroups = useMemo(() => {
    const grouped = {};
    schedules.forEach(s => {
      const auditor = s.auditor || 'Unassigned';
      if (!grouped[auditor]) grouped[auditor] = [];
      grouped[auditor].push(s);
    });
    // Sort: non-empty auditors first, then alphabetically
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
        <div style={{
          gridColumn: '1 / -1', padding: '3rem', textAlign: 'center',
          background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem'
        }}>
          <User size={40} color={COLORS.text.light} style={{ marginBottom: '0.75rem' }} />
          <p style={{ color: COLORS.text.secondary, fontSize: '0.9rem', fontWeight: '600' }}>No audit schedules found</p>
        </div>
      ) : (
        inspectorGroups.map(([auditor, items]) => {
          const completedCount = items.filter(s => s.status === 'completed').length;
          const upcomingCount = items.filter(s => s.status === 'scheduled' && (s.startDate || '') >= now).length;
          const overdueCount = items.filter(s => s.status === 'scheduled' && (s.endDate || s.startDate || '') < now).length;

          return (
            <div key={auditor} style={{
              background: COLORS.surface, border: `1px solid ${COLORS.border}`,
              borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}>
              {/* Inspector Header */}
              <div style={{
                padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`,
                background: auditor === 'Unassigned' ? '#FEF2F2' : '#F8FAFC'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: auditor === 'Unassigned' ? '#FEE2E2' : '#EFF6FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${auditor === 'Unassigned' ? '#FECACA' : '#BFDBFE'}`
                  }}>
                    <User size={18} color={auditor === 'Unassigned' ? COLORS.red : COLORS.blue} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: COLORS.text.primary }}>
                      {auditor}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: COLORS.text.secondary }}>
                      {items.length} audit{items.length !== 1 ? 's' : ''} in {selectedYear}
                    </p>
                  </div>
                </div>
                {/* Mini stats */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Upcoming', value: upcomingCount, color: COLORS.blue, bg: '#EFF6FF' },
                    { label: 'Completed', value: completedCount, color: COLORS.green, bg: '#F0FDF4' },
                    { label: 'Overdue', value: overdueCount, color: COLORS.red, bg: '#FEF2F2' },
                  ].filter(s => s.value > 0).map(s => (
                    <span key={s.label} style={{
                      padding: '0.2rem 0.5rem', borderRadius: '0.3rem',
                      background: s.bg, color: s.color,
                      fontSize: '0.65rem', fontWeight: '700'
                    }}>
                      {s.value} {s.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Schedule List */}
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {items.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '')).map((s, i) => {
                  const statusCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
                  const StatusIcon = statusCfg.icon;
                  const isOverdue = s.status === 'scheduled' && (s.endDate || s.startDate || '') < now;
                  return (
                    <div key={s.id || i} onClick={() => onEdit(s)}
                      style={{
                        padding: '0.75rem 1.25rem', borderBottom: `1px solid ${COLORS.borderLight}`,
                        cursor: 'pointer', transition: 'background 0.15s',
                        background: isOverdue ? '#FFFBEB' : 'transparent'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceAlt}
                      onMouseLeave={e => e.currentTarget.style.background = isOverdue ? '#FFFBEB' : 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <MapPin size={12} color={COLORS.blue} />
                          <span style={{ fontSize: '0.82rem', fontWeight: '600', color: COLORS.text.primary }}>
                            {s.branchName}
                          </span>
                        </div>
                        <span style={{
                          padding: '0.15rem 0.4rem', borderRadius: '0.25rem',
                          background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}`,
                          fontSize: '0.62rem', fontWeight: '700',
                          display: 'flex', alignItems: 'center', gap: '0.2rem'
                        }}>
                          <StatusIcon size={10} />
                          {statusCfg.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: COLORS.text.secondary }}>
                        <span style={{ fontFamily: 'monospace' }}>{s.startDate || '-'} ~ {s.endDate || '-'}</span>
                        <span>{s.auditType || 'General'}</span>
                      </div>
                      {isOverdue && (
                        <div style={{ marginTop: '0.3rem', fontSize: '0.62rem', color: COLORS.red, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <AlertTriangle size={10} /> Overdue
                        </div>
                      )}
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
// Schedule Table (light theme)
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
        border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem'
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
      borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {columns.map(col => (
                <th key={col.key}
                  onClick={() => !col.noSort && onSort(col.key)}
                  style={{
                    padding: '0.65rem 0.75rem', textAlign: 'left', fontSize: '0.72rem',
                    fontWeight: '700', color: COLORS.text.secondary, borderBottom: `2px solid ${COLORS.border}`,
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
                  borderBottom: idx < schedules.length - 1 ? `1px solid ${COLORS.borderLight}` : 'none',
                  background: idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC'}
                >
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={12} color={COLORS.blue} />
                      <span style={{ fontWeight: '600', color: COLORS.text.primary }}>{schedule.branchName || '-'}</span>
                    </div>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ color: COLORS.text.primary, fontSize: '0.78rem' }}>{schedule.auditType || 'General'}</span>
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
                    <StatusDropdown currentStatus={schedule.status} onChange={(newStatus) => onStatusChange(schedule.id, newStatus)} />
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
  padding: '0.3rem', background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
  borderRadius: '0.3rem', color: COLORS.text.secondary, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center'
};

// ============================================================
// Status Dropdown (light theme)
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
        background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
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
            background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: '140px'
          }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button key={key} onClick={() => { onChange(key); setOpen(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%',
                  padding: '0.5rem 0.65rem', border: 'none', cursor: 'pointer',
                  background: key === currentStatus ? COLORS.surfaceAlt : 'transparent',
                  color: cfg.color, fontSize: '0.75rem', fontWeight: '600', textAlign: 'left'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = key === currentStatus ? COLORS.surfaceAlt : 'transparent'}
                >
                  <Icon size={13} />
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
// Calendar View (light theme)
// ============================================================

function CalendarView({ schedules, selectedYear, onEdit }) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const monthSchedules = useMemo(() => {
    return schedules.filter(s => {
      const date = s.startDate || s.auditDate || '';
      const m = parseInt(date.substring(5, 7), 10) - 1;
      return m === currentMonth;
    });
  }, [schedules, currentMonth]);

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
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {/* Month Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button onClick={() => setCurrentMonth(m => Math.max(0, m - 1))} style={btnSecondary}>
          <ChevronLeft size={16} />
        </button>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: COLORS.text.primary }}>
          {MONTHS[currentMonth]} {selectedYear}
        </h3>
        <button onClick={() => setCurrentMonth(m => Math.min(11, m + 1))} style={btnSecondary}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Month Quick Select */}
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {MONTHS.map((m, i) => (
          <button key={m} onClick={() => setCurrentMonth(i)} style={{
            padding: '0.3rem 0.5rem', borderRadius: '0.3rem',
            border: `1px solid ${i === currentMonth ? COLORS.accent : COLORS.border}`,
            background: i === currentMonth ? '#FFF1F2' : 'transparent',
            color: i === currentMonth ? COLORS.accent : COLORS.text.secondary,
            fontSize: '0.68rem', fontWeight: '600', cursor: 'pointer'
          }}>{m}</button>
        ))}
      </div>

      {/* Day Headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{
            padding: '0.35rem', textAlign: 'center', fontSize: '0.68rem',
            fontWeight: '700', color: COLORS.text.secondary,
            background: '#F8FAFC', borderRadius: '0.25rem'
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
              minHeight: '64px', padding: '0.25rem',
              background: isToday ? '#FFF1F2' : (day ? '#FAFBFC' : 'transparent'),
              borderRadius: '0.3rem', border: isToday ? `1.5px solid ${COLORS.accent}` : `1px solid ${COLORS.borderLight}`,
              opacity: day ? 1 : 0.3
            }}>
              {day && (
                <>
                  <div style={{
                    fontSize: '0.68rem', fontWeight: isToday ? '800' : '600',
                    color: isToday ? COLORS.accent : COLORS.text.secondary,
                    padding: '0.1rem 0.2rem'
                  }}>{day}</div>
                  {daySchedules.slice(0, 2).map((s, i) => {
                    const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
                    return (
                      <div key={i} onClick={() => onEdit(s)} style={{
                        padding: '0.1rem 0.25rem', margin: '1px 0', borderRadius: '0.2rem',
                        background: cfg.bg, borderLeft: `2.5px solid ${cfg.color}`,
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
        marginTop: '1rem', padding: '0.75rem 1rem', background: '#F8FAFC',
        borderRadius: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap',
        border: `1px solid ${COLORS.border}`
      }}>
        <span style={{ fontSize: '0.75rem', color: COLORS.text.secondary }}>
          <strong style={{ color: COLORS.text.primary }}>{monthSchedules.length}</strong> audits in {MONTHS[currentMonth]}
        </span>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = monthSchedules.filter(s => s.status === key).length;
          if (count === 0) return null;
          return (
            <span key={key} style={{ fontSize: '0.72rem', color: cfg.color, fontWeight: '600' }}>
              {cfg.label}: <strong>{count}</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Audit Form Modal (light theme)
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
      background: 'rgba(0,0,0,0.4)', padding: '1rem', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: '1rem', width: '100%', maxWidth: '600px',
        maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
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
            <div>
              <label style={labelStyle}>Audit Type</label>
              <select value={form.auditType} onChange={e => updateField('auditType', e.target.value)}
                style={{ ...inputStyle, width: '100%' }}>
                {(auditSettings.auditTypes || []).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => updateField('startDate', e.target.value)}
                required style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" value={form.endDate} onChange={e => updateField('endDate', e.target.value)}
                min={form.startDate} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Auditor / Inspector</label>
              <input type="text" value={form.auditor} onChange={e => updateField('auditor', e.target.value)}
                placeholder="Inspector name" style={{ ...inputStyle, width: '100%' }}
                list="auditor-suggestions" />
              <datalist id="auditor-suggestions">
                {(auditSettings.defaultAuditors || []).map(a => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => updateField('status', e.target.value)}
                style={{ ...inputStyle, width: '100%' }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
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

          <div style={{ marginTop: '0.75rem' }}>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={e => updateField('notes', e.target.value)}
              placeholder="Additional notes about this audit..."
              rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
          </div>

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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: `1px solid ${COLORS.border}` }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving || !form.branchName || !form.startDate} style={{
              ...btnPrimary, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer'
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

const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.3rem' };
const inputStyle = {
  padding: '0.5rem 0.6rem', background: COLORS.surface,
  border: `1px solid ${COLORS.border}`, borderRadius: '0.4rem',
  color: COLORS.text.primary, fontSize: '0.82rem', outline: 'none',
  boxSizing: 'border-box'
};

// ============================================================
// Delete Confirmation Modal (light theme)
// ============================================================

function DeleteConfirmModal({ schedule, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)', padding: '1rem', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: '1rem', padding: '1.5rem', maxWidth: '420px', width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center'
      }}>
        <div style={{
          width: '50px', height: '50px', borderRadius: '50%',
          background: '#FEF2F2', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 1rem', border: '2px solid #FECACA'
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
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
          <button onClick={onConfirm} style={{
            ...btnPrimary, background: COLORS.red, boxShadow: '0 2px 8px rgba(220,38,38,0.25)'
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export default SecurityAuditSchedulePage;
