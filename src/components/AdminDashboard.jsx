import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, Filter, RefreshCw } from 'lucide-react';
import { getAllSecurityCosts } from '../firebase/collections';

const COLORS = {
  primary: '#1B3A7D',
  secondary: '#E94560',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  background: '#f3f4f6',
  surface: '#ffffff',
  text: { primary: '#1f2937', secondary: '#6b7280', light: '#9ca3af' }
};

const fmt = (n) => {
  if (!n) return '0';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

function AdminDashboard({ branches }) {
  const [allCosts, setAllCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllSecurityCosts();
      setAllCosts(data);
    } catch (err) {
      console.error('[AdminDashboard] load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const years = useMemo(() => {
    const s = new Set(allCosts.map(c => c.targetMonth?.slice(0, 4)).filter(Boolean));
    s.add(now.getFullYear().toString());
    return [...s].sort().reverse();
  }, [allCosts]);

  const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Build summary: for each branch+month, get latest submission
  const summaryData = useMemo(() => {
    const branchNames = (branches || []).map(b => b.name).filter(Boolean).sort();
    const filtered = allCosts.filter(c => {
      if (!c.targetMonth) return false;
      const y = c.targetMonth.slice(0, 4);
      const m = c.targetMonth.slice(5, 7);
      if (filterYear && y !== filterYear) return false;
      if (filterMonth && m !== filterMonth) return false;
      if (filterBranch && c.branchName !== filterBranch) return false;
      return true;
    });

    // Group by branch+month, keep latest
    const map = {};
    filtered.forEach(c => {
      const key = `${c.branchName}__${c.targetMonth}`;
      const ts = c.submittedAt?.seconds || 0;
      if (!map[key] || ts > (map[key].submittedAt?.seconds || 0)) {
        map[key] = c;
      }
    });

    // Determine which months to show
    const activeMonths = filterMonth
      ? [filterMonth]
      : months.filter(m => {
          // show months that have any data OR are <= current month if current year
          if (filterYear === now.getFullYear().toString()) {
            return parseInt(m) <= now.getMonth() + 1;
          }
          return true;
        });

    const displayBranches = filterBranch
      ? branchNames.filter(b => b === filterBranch)
      : branchNames;

    return { map, activeMonths, displayBranches };
  }, [allCosts, branches, filterYear, filterMonth, filterBranch]);

  const isRecent = (cost) => {
    if (!cost?.submittedAt?.seconds) return false;
    const d = new Date(cost.submittedAt.seconds * 1000);
    return d >= threeDaysAgo;
  };

  if (loading) {
    return (
      <section style={{ background: COLORS.surface, padding: '2rem', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
        <div style={{ textAlign: 'center', color: COLORS.text.secondary, padding: '2rem' }}>Loading dashboard data...</div>
      </section>
    );
  }

  const { map, activeMonths, displayBranches } = summaryData;

  return (
    <section style={{ background: COLORS.surface, padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: COLORS.text.primary, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <BarChart3 size={22} color={COLORS.primary} />
          All Branches - Cost Status
        </h2>
        <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', background: COLORS.info, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={16} color={COLORS.text.secondary} />
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.8rem' }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.8rem' }}>
          <option value="">All Months</option>
          {months.map((m, i) => <option key={m} value={m}>{monthLabels[i]}</option>)}
        </select>
        <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.8rem' }}>
          <option value="">All Branches</option>
          {(branches || []).map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.65rem', color: COLORS.text.secondary, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.success, display: 'inline-block' }} /> Both submitted
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.info, display: 'inline-block' }} /> Est. only
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#e5e7eb', display: 'inline-block' }} /> No data
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fef3c7', border: '2px solid #f59e0b', display: 'inline-block' }} /> Updated within 3 days
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ padding: '0.5rem 0.4rem', textAlign: 'left', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 1, borderBottom: '2px solid #d1d5db', fontWeight: '700', color: COLORS.primary, minWidth: '90px' }}>Branch</th>
              {activeMonths.map((m, i) => (
                <th key={m} style={{ padding: '0.5rem 0.25rem', textAlign: 'center', borderBottom: '2px solid #d1d5db', fontWeight: '600', color: COLORS.text.secondary, minWidth: '70px' }}>
                  {monthLabels[parseInt(m) - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayBranches.map(bn => (
              <tr key={bn} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.4rem', fontWeight: '600', color: COLORS.text.primary, position: 'sticky', left: 0, background: 'white', zIndex: 1, whiteSpace: 'nowrap' }}>
                  {bn.length > 12 ? bn.slice(0, 12) + '..' : bn}
                </td>
                {activeMonths.map(m => {
                  const key = `${bn}__${filterYear}-${m}`;
                  const cost = map[key];
                  const hasEst = cost && cost.totalEstimated > 0;
                  const hasAct = cost && cost.totalActual > 0;
                  const recent = isRecent(cost);
                  
                  let bg = '#f9fafb';
                  let borderColor = 'transparent';
                  if (hasEst && hasAct) bg = '#d1fae5';
                  else if (hasEst) bg = '#dbeafe';
                  
                  if (recent) {
                    borderColor = COLORS.warning;
                    bg = hasEst && hasAct ? '#bbf7d0' : hasEst ? '#bfdbfe' : '#fef9c3';
                  }

                  return (
                    <td key={m} style={{ padding: '0.25rem', textAlign: 'center' }}>
                      <div style={{
                        padding: '0.3rem 0.2rem',
                        background: bg,
                        borderRadius: '0.25rem',
                        border: recent ? `2px solid ${borderColor}` : '1px solid #e5e7eb',
                        minHeight: '2.2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        position: 'relative'
                      }}>
                        {cost ? (
                          <>
                            <div style={{ fontSize: '0.6rem', color: COLORS.primary, fontWeight: '600' }}>
                              E: {fmt(cost.totalEstimated)}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: hasAct ? COLORS.secondary : COLORS.text.light, fontWeight: hasAct ? '600' : '400' }}>
                              A: {hasAct ? fmt(cost.totalActual) : '-'}
                            </div>
                            {recent && (
                              <div style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: '50%', background: COLORS.warning }} />
                            )}
                          </>
                        ) : (
                          <div style={{ color: COLORS.text.light, fontSize: '0.6rem' }}>-</div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {displayBranches.length === 0 && (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: COLORS.text.secondary, fontSize: '0.85rem' }}>
          No branches found. Add branches in Settings.
        </div>
      )}
    </section>
  );
}

export default AdminDashboard;
