import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getSecurityCostsByBranchYear } from '../../../firebase/collections';

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

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '\u20AC', KRW: '\u20A9', JPY: '\u00A5', SGD: 'S$',
  HKD: 'HK$', THB: '\u0E3F', GBP: '\u00A3', CNY: 'CN\u00A5'
};

const fmt = (n, decimals = 0) => {
  if (!n && n !== 0) return '0';
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function BranchCostHistory({ branchName, currency }) {
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);

  const sym = CURRENCY_SYMBOLS[currency] || currency;

  // Generate year options
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        console.log(`[BranchCostHistory] Loading data for branch=${branchName}, year=${targetYear}, currency=${currency}`);
        const data = await getSecurityCostsByBranchYear(branchName, targetYear.toString());
        console.log(`[BranchCostHistory] Loaded ${data.length} records`);
        if (data.length > 0) {
          console.log('[BranchCostHistory] Sample:', data[0].targetMonth, 'Est:', data[0].totalEstimated, 'Act:', data[0].totalActual);
        }
        setAllData(data);
      } catch (err) {
        console.error('[BranchCostHistory] load error:', err);
        setAllData([]);
      } finally {
        setLoading(false);
      }
    };
    if (branchName) loadData();
  }, [branchName, targetYear]);

  // Build monthly data: for each month, get the latest submission
  const monthlyData = useMemo(() => {
    const result = [];
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${targetYear}-${String(m).padStart(2, '0')}`;
      const monthEntries = allData.filter(d => d.targetMonth === monthStr);

      // Get latest entry by submittedAt
      let latest = null;
      monthEntries.forEach(entry => {
        const ts = entry.submittedAt?.seconds || 0;
        if (!latest || ts > (latest.submittedAt?.seconds || 0)) {
          latest = entry;
        }
      });

      result.push({
        month: m,
        label: MONTH_LABELS[m - 1],
        estimated: latest?.totalEstimated || 0,
        actual: latest?.totalActual || 0,
        hasData: !!latest
      });
    }
    return result;
  }, [allData, targetYear]);

  // Compute max value for chart scaling
  const maxVal = useMemo(() => {
    let max = 0;
    monthlyData.forEach(d => {
      if (d.estimated > max) max = d.estimated;
      if (d.actual > max) max = d.actual;
    });
    return max || 1;
  }, [monthlyData]);

  // Calculate month-over-month changes
  const getChange = (current, previous) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  const totalEstimated = monthlyData.reduce((s, d) => s + d.estimated, 0);
  const totalActual = monthlyData.reduce((s, d) => s + d.actual, 0);

  return (
    <section style={{
      background: COLORS.surface,
      padding: '1.5rem 2rem',
      borderRadius: '1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginTop: '2rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <h2 style={{
          fontSize: '1.25rem', fontWeight: 'bold', color: COLORS.text.primary,
          display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0
        }}>
          <Calendar size={22} color={COLORS.primary} />
          Cost History - {branchName}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: COLORS.text.secondary, fontWeight: '500' }}>
            Target Year:
          </label>
          <select
            value={targetYear}
            onChange={(e) => setTargetYear(parseInt(e.target.value))}
            style={{
              padding: '0.35rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.text.secondary }}>
          Loading history...
        </div>
      ) : (
        <>
          {/* Summary totals */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem', background: '#eef2ff', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                Total Estimated ({targetYear})
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: COLORS.primary }}>
                {sym}{fmt(totalEstimated)}
              </div>
            </div>
            <div style={{ padding: '0.75rem', background: '#fef2f2', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                Total Actual ({targetYear})
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: COLORS.secondary }}>
                {sym}{fmt(totalActual)}
              </div>
            </div>
            <div style={{ padding: '0.75rem', background: totalActual > totalEstimated ? '#fef2f2' : '#d1fae5', borderRadius: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                Variance
              </div>
              <div style={{
                fontSize: '1.1rem', fontWeight: '700',
                color: totalActual > totalEstimated ? COLORS.error : COLORS.success
              }}>
                {sym}{fmt(totalActual - totalEstimated)}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', fontSize: '0.7rem',
            color: COLORS.text.secondary, justifyContent: 'center'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, background: COLORS.primary, display: 'inline-block' }} />
              Estimated Cost
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, background: COLORS.secondary, display: 'inline-block' }} />
              Actual Cost
            </span>
          </div>

          {/* Bar Chart */}
          <div style={{
            background: '#fafbfc',
            borderRadius: '0.75rem',
            padding: '1rem 0.5rem 0.5rem',
            border: '1px solid #e5e7eb',
            overflowX: 'auto'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '0.25rem',
              minHeight: '220px',
              paddingBottom: '0.5rem',
              minWidth: '600px'
            }}>
              {monthlyData.map((d, i) => {
                const estH = d.estimated > 0 ? Math.max((d.estimated / maxVal) * 170, 4) : 0;
                const actH = d.actual > 0 ? Math.max((d.actual / maxVal) * 170, 4) : 0;
                const prevMonth = i > 0 ? monthlyData[i - 1] : null;
                const estChange = prevMonth && prevMonth.estimated > 0 && d.estimated > 0
                  ? getChange(d.estimated, prevMonth.estimated) : null;
                const actChange = prevMonth && prevMonth.actual > 0 && d.actual > 0
                  ? getChange(d.actual, prevMonth.actual) : null;

                return (
                  <div key={d.month} style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.15rem',
                    minWidth: '46px'
                  }}>
                    {/* Change indicators */}
                    <div style={{ minHeight: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.05rem' }}>
                      {estChange !== null && (
                        <div style={{
                          fontSize: '0.5rem',
                          color: parseFloat(estChange) > 0 ? COLORS.error : COLORS.success,
                          fontWeight: '600',
                          display: 'flex', alignItems: 'center', gap: '0.1rem',
                          lineHeight: 1
                        }}>
                          {parseFloat(estChange) > 0 ? <TrendingUp size={8} /> : parseFloat(estChange) < 0 ? <TrendingDown size={8} /> : <Minus size={8} />}
                          {estChange}%
                        </div>
                      )}
                      {actChange !== null && (
                        <div style={{
                          fontSize: '0.5rem',
                          color: parseFloat(actChange) > 0 ? '#dc2626' : '#059669',
                          fontWeight: '600',
                          display: 'flex', alignItems: 'center', gap: '0.1rem',
                          lineHeight: 1
                        }}>
                          {parseFloat(actChange) > 0 ? <TrendingUp size={8} /> : parseFloat(actChange) < 0 ? <TrendingDown size={8} /> : <Minus size={8} />}
                          {actChange}%
                        </div>
                      )}
                    </div>

                    {/* Value labels */}
                    {d.estimated > 0 && (
                      <div style={{ fontSize: '0.5rem', color: COLORS.primary, fontWeight: '600', textAlign: 'center', lineHeight: 1.1 }}>
                        {fmt(d.estimated)}
                      </div>
                    )}
                    {d.actual > 0 && (
                      <div style={{ fontSize: '0.5rem', color: COLORS.secondary, fontWeight: '600', textAlign: 'center', lineHeight: 1.1 }}>
                        {fmt(d.actual)}
                      </div>
                    )}

                    {/* Bars */}
                    <div style={{
                      display: 'flex',
                      gap: '2px',
                      alignItems: 'flex-end',
                      height: '170px'
                    }}>
                      {/* Estimated bar */}
                      <div
                        style={{
                          width: '16px',
                          height: `${estH}px`,
                          background: d.estimated > 0
                            ? `linear-gradient(180deg, ${COLORS.primary} 0%, #2d5bb9 100%)`
                            : '#e5e7eb',
                          borderRadius: '2px 2px 0 0',
                          transition: 'height 0.4s ease',
                          minHeight: d.hasData ? '4px' : '2px'
                        }}
                        title={`Est: ${sym}${fmt(d.estimated)}`}
                      />
                      {/* Actual bar */}
                      <div
                        style={{
                          width: '16px',
                          height: `${actH}px`,
                          background: d.actual > 0
                            ? `linear-gradient(180deg, ${COLORS.secondary} 0%, #c23150 100%)`
                            : '#e5e7eb',
                          borderRadius: '2px 2px 0 0',
                          transition: 'height 0.4s ease',
                          minHeight: d.hasData ? '4px' : '2px'
                        }}
                        title={`Act: ${sym}${fmt(d.actual)}`}
                      />
                    </div>

                    {/* Month label */}
                    <div style={{
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      color: d.hasData ? COLORS.text.primary : COLORS.text.light,
                      marginTop: '0.2rem'
                    }}>
                      {d.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly detail table */}
          <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '0.4rem', textAlign: 'left', borderBottom: '2px solid #d1d5db', fontWeight: '700', color: COLORS.primary }}>Month</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right', borderBottom: '2px solid #d1d5db', fontWeight: '600', color: COLORS.primary }}>Estimated</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right', borderBottom: '2px solid #d1d5db', fontWeight: '600', color: COLORS.secondary }}>Actual</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right', borderBottom: '2px solid #d1d5db', fontWeight: '600', color: COLORS.text.secondary }}>Variance</th>
                  <th style={{ padding: '0.4rem', textAlign: 'center', borderBottom: '2px solid #d1d5db', fontWeight: '600', color: COLORS.text.secondary }}>MoM Change</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((d, i) => {
                  const variance = d.actual - d.estimated;
                  const prevMonth = i > 0 ? monthlyData[i - 1] : null;
                  const estChange = prevMonth && prevMonth.estimated > 0 && d.estimated > 0
                    ? getChange(d.estimated, prevMonth.estimated) : null;

                  if (!d.hasData) return null;

                  return (
                    <tr key={d.month} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.4rem', fontWeight: '600', color: COLORS.text.primary }}>
                        {d.label} {targetYear}
                      </td>
                      <td style={{ padding: '0.4rem', textAlign: 'right', color: COLORS.primary, fontWeight: '600' }}>
                        {sym}{fmt(d.estimated)}
                      </td>
                      <td style={{ padding: '0.4rem', textAlign: 'right', color: d.actual > 0 ? COLORS.secondary : COLORS.text.light, fontWeight: d.actual > 0 ? '600' : '400' }}>
                        {d.actual > 0 ? `${sym}${fmt(d.actual)}` : '-'}
                      </td>
                      <td style={{
                        padding: '0.4rem', textAlign: 'right',
                        color: d.actual > 0 ? (variance > 0 ? COLORS.error : COLORS.success) : COLORS.text.light,
                        fontWeight: '600'
                      }}>
                        {d.actual > 0 ? `${sym}${fmt(variance)}` : '-'}
                      </td>
                      <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                        {estChange !== null ? (
                          <span style={{
                            fontSize: '0.65rem',
                            color: parseFloat(estChange) > 0 ? COLORS.error : COLORS.success,
                            fontWeight: '600'
                          }}>
                            {parseFloat(estChange) > 0 ? '+' : ''}{estChange}%
                          </span>
                        ) : (
                          <span style={{ color: COLORS.text.light }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* No data message */}
          {monthlyData.every(d => !d.hasData) && (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: COLORS.text.secondary, fontSize: '0.85rem' }}>
              No cost data found for {targetYear}. Submit cost entries to see history here.
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default BranchCostHistory;
