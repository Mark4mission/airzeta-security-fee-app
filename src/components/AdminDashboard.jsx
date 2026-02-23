import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart3, Filter, RefreshCw, Upload, FileSpreadsheet, X, Eye } from 'lucide-react';
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

const fmtKRW = (n) => {
  if (!n || isNaN(n)) return '';
  return '\u20A9' + Math.round(Number(n)).toLocaleString('en-US');
};

function AdminDashboard({ branches, onCellClick, exchangeRates, isAdmin, onExchangeRateUpload }) {
  const [allCosts, setAllCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState('');
  const [showRateTable, setShowRateTable] = useState(false);
  const fileInputRef = useRef(null);

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

  // Helper: get exchange rate for currency (1 unit -> KRW)
  const getRateForCurrency = (currencyCode) => {
    if (!exchangeRates?.rates || !currencyCode) return null;
    if (currencyCode === 'KRW') return 1;
    const entry = exchangeRates.rates.find(r => r.currency === currencyCode);
    if (!entry) return null;
    const ratio = entry.ratio || 1;
    return entry.rate / ratio;
  };

  // Build branch -> currency mapping
  const branchCurrencyMap = useMemo(() => {
    const m = {};
    (branches || []).forEach(b => { if (b.name) m[b.name] = b.currency || 'USD'; });
    return m;
  }, [branches]);

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

  // Monthly KRW totals
  const monthlyKRWTotals = useMemo(() => {
    if (!exchangeRates?.rates) return {};
    const { map, activeMonths, displayBranches } = summaryData;
    const totals = {};
    
    activeMonths.forEach(m => {
      let estTotal = 0;
      let actTotal = 0;
      let hasAnyEst = false;
      let hasAnyAct = false;
      
      displayBranches.forEach(bn => {
        const key = `${bn}__${filterYear}-${m}`;
        const cost = map[key];
        if (!cost) return;
        
        const branchCurrency = cost.currency || branchCurrencyMap[bn] || 'USD';
        const rate = getRateForCurrency(branchCurrency);
        if (!rate) return;
        
        if (cost.totalEstimated > 0) {
          estTotal += cost.totalEstimated * rate;
          hasAnyEst = true;
        }
        if (cost.totalActual > 0) {
          actTotal += cost.totalActual * rate;
          hasAnyAct = true;
        }
      });
      
      if (hasAnyEst || hasAnyAct) {
        totals[m] = { est: hasAnyEst ? estTotal : null, act: hasAnyAct ? actTotal : null };
      }
    });
    
    return totals;
  }, [summaryData, exchangeRates, branchCurrencyMap, filterYear]);

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
  const hasRates = exchangeRates?.rates?.length > 0;

  return (
    <section style={{ background: COLORS.surface, padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: COLORS.text.primary, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <BarChart3 size={22} color={COLORS.primary} />
          All Stations - Cost Status
        </h2>
        <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', background: COLORS.info, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters + Exchange Rate Upload */}
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
          <option value="">All Stations</option>
          {(branches || []).filter(b => b.name !== 'HQ' && b.name !== 'hq').map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
        </select>

        {/* Exchange Rate Upload (admin only) */}
        {isAdmin && (
          <>
            <div style={{ borderLeft: '1px solid #d1d5db', height: '24px', margin: '0 0.25rem' }} />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={onExchangeRateUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.35rem 0.7rem',
                background: hasRates ? '#f0fdf4' : '#fef3c7',
                color: hasRates ? '#065f46' : '#92400e',
                border: `1px solid ${hasRates ? '#6ee7b7' : '#fbbf24'}`,
                borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '500'
              }}
              title={hasRates ? `Loaded: ${exchangeRates.fileName}` : 'Upload exchange rate XLSX'}
            >
              <Upload size={13} />
              {hasRates ? 'Update Rates' : 'Upload Rates'}
            </button>
            {hasRates && (
              <>
                <button
                  onClick={() => setShowRateTable(!showRateTable)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.35rem 0.6rem',
                    background: showRateTable ? COLORS.primary : 'white',
                    color: showRateTable ? 'white' : COLORS.primary,
                    border: `1px solid ${COLORS.primary}`,
                    borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '500'
                  }}
                  title="View exchange rate table"
                >
                  <Eye size={13} />
                  {showRateTable ? 'Hide' : 'View'}
                </button>
                <span style={{ fontSize: '0.6rem', color: COLORS.text.light }}>
                  <FileSpreadsheet size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                  {exchangeRates.fileName}
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Exchange Rate Table Modal */}
      {showRateTable && hasRates && (
        <div style={{
          marginBottom: '1rem', padding: '0.75rem',
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: '0.5rem', maxHeight: '300px', overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: COLORS.primary }}>
              Exchange Rate Table ({exchangeRates.rates.length} currencies)
            </span>
            <button onClick={() => setShowRateTable(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.text.light, padding: '2px' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.25rem' }}>
            {exchangeRates.rates.map(r => {
              const perUnit = r.ratio > 1 ? `${r.ratio} ${r.currency}` : `1 ${r.currency}`;
              return (
                <div key={r.currency} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.25rem 0.5rem', background: 'white', borderRadius: '0.25rem',
                  border: '1px solid #e5e7eb', fontSize: '0.65rem'
                }}>
                  <span style={{ fontWeight: '600', color: COLORS.primary }}>{perUnit}</span>
                  <span style={{ color: COLORS.text.secondary }}>{fmtKRW(r.rate)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ color: COLORS.error, fontWeight: '700' }}>▲</span> Over budget
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ color: COLORS.success, fontWeight: '700' }}>▼</span> Under budget
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem', fontStyle: 'italic', color: COLORS.primary }}>
          Click a cell to load cost data
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
          <thead>
            {/* Monthly KRW Totals Row (above month headers) */}
            {hasRates && Object.keys(monthlyKRWTotals).length > 0 && (
              <>
                <tr>
                  <th style={{ padding: '0.15rem 0.4rem', textAlign: 'left', position: 'sticky', left: 0, background: '#eef2ff', zIndex: 2, fontSize: '0.55rem', color: COLORS.primary, fontWeight: '600', borderBottom: 'none', verticalAlign: 'bottom' }}>
                    Est. (KRW)
                  </th>
                  {activeMonths.map(m => {
                    const t = monthlyKRWTotals[m];
                    return (
                      <th key={`est-${m}`} style={{ padding: '0.15rem 0.2rem', textAlign: 'center', background: '#eef2ff', fontSize: '0.55rem', color: COLORS.primary, fontWeight: '700', borderBottom: 'none', whiteSpace: 'nowrap' }}>
                        {t?.est != null ? fmtKRW(t.est) : ''}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  <th style={{ padding: '0.15rem 0.4rem', textAlign: 'left', position: 'sticky', left: 0, background: '#fff1f2', zIndex: 2, fontSize: '0.55rem', color: COLORS.secondary, fontWeight: '600', borderBottom: '1px solid #e5e7eb', verticalAlign: 'bottom' }}>
                    Act. (KRW)
                  </th>
                  {activeMonths.map(m => {
                    const t = monthlyKRWTotals[m];
                    return (
                      <th key={`act-${m}`} style={{ padding: '0.15rem 0.2rem', textAlign: 'center', background: '#fff1f2', fontSize: '0.55rem', color: COLORS.secondary, fontWeight: '700', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                        {t?.act != null ? fmtKRW(t.act) : ''}
                      </th>
                    );
                  })}
                </tr>
              </>
            )}
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ padding: '0.5rem 0.4rem', textAlign: 'left', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 1, borderBottom: '2px solid #d1d5db', fontWeight: '700', color: COLORS.primary, minWidth: '90px' }}>Station</th>
              {activeMonths.map((m) => (
                <th key={m} style={{ padding: '0.5rem 0.25rem', textAlign: 'center', borderBottom: '2px solid #d1d5db', fontWeight: '600', color: COLORS.text.secondary, minWidth: '70px' }}>
                  {monthLabels[parseInt(m) - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayBranches.map(bn => {
              const branchCurrency = branchCurrencyMap[bn] || 'USD';
              const krwRate = getRateForCurrency(branchCurrency);
              
              return (
                <tr key={bn} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.4rem', fontWeight: '600', color: COLORS.text.primary, position: 'sticky', left: 0, background: 'white', zIndex: 1, whiteSpace: 'nowrap' }}>
                    <div>{bn.length > 12 ? bn.slice(0, 12) + '..' : bn}</div>
                    {hasRates && krwRate && (
                      <div style={{ fontSize: '0.5rem', color: COLORS.text.light, fontWeight: '400', marginTop: '1px' }}>
                        1 {branchCurrency} = {fmtKRW(krwRate)}
                      </div>
                    )}
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

                    // Variance calculation
                    const variance = (hasEst && hasAct) ? cost.totalActual - cost.totalEstimated : null;
                    const variancePct = (hasEst && hasAct && cost.totalEstimated > 0)
                      ? ((cost.totalActual - cost.totalEstimated) / cost.totalEstimated * 100)
                      : null;

                    return (
                      <td key={m} style={{ padding: '0.25rem', textAlign: 'center' }}>
                        <div
                          onClick={() => {
                            console.log('[AdminDashboard] Cell clicked:', bn, `${filterYear}-${m}`);
                            if (onCellClick) onCellClick(bn, `${filterYear}-${m}`);
                          }}
                          style={{
                            padding: '0.3rem 0.2rem',
                            background: bg,
                            borderRadius: '0.25rem',
                            border: recent ? `2px solid ${borderColor}` : '1px solid #e5e7eb',
                            minHeight: '2.8rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            userSelect: 'none',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(27,58,125,0.3)'; e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.borderColor = COLORS.primary; }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = recent ? borderColor : '#e5e7eb'; }}
                          title={`Click to load ${bn} - ${monthLabels[parseInt(m) - 1]} ${filterYear}${variancePct !== null ? `\nVariance: ${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}%` : ''}`}
                        >
                          {cost ? (
                            <>
                              <div style={{ fontSize: '0.6rem', color: COLORS.primary, fontWeight: '600' }}>
                                E: {fmt(cost.totalEstimated)}
                              </div>
                              <div style={{ fontSize: '0.6rem', color: hasAct ? COLORS.secondary : COLORS.text.light, fontWeight: hasAct ? '600' : '400' }}>
                                A: {hasAct ? fmt(cost.totalActual) : '-'}
                              </div>
                              {/* Variance indicator */}
                              {variancePct !== null && (
                                <div style={{
                                  fontSize: '0.55rem',
                                  fontWeight: '700',
                                  marginTop: '1px',
                                  padding: '0px 3px',
                                  borderRadius: '3px',
                                  background: variance > 0 ? '#fef2f2' : variance < 0 ? '#f0fdf4' : '#f5f5f5',
                                  color: variance > 0 ? COLORS.error : variance < 0 ? COLORS.success : COLORS.text.secondary,
                                  lineHeight: '1.4',
                                }}>
                                  {variance > 0 ? '▲' : variance < 0 ? '▼' : '='}{' '}
                                  {Math.abs(variancePct).toFixed(1)}%
                                </div>
                              )}
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
              );
            })}
          </tbody>
        </table>
      </div>

      {displayBranches.length === 0 && (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: COLORS.text.secondary, fontSize: '0.85rem' }}>
          No stations found. Add stations in Settings.
        </div>
      )}
    </section>
  );
}

export default AdminDashboard;
