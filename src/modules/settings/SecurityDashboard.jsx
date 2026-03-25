/**
 * Security Dashboard Component (Admin Only)
 * Displays security monitoring information:
 * - Security configuration status
 * - App Check status
 * - Recent security audit logs
 * - Login attempt statistics
 */

import React, { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldOff,
  Activity, AlertTriangle, CheckCircle, XCircle,
  Clock, Users, Lock, Globe, Eye, EyeOff,
  RefreshCw, ChevronDown, ChevronUp, Loader
} from 'lucide-react';
import { getSecurityConfig, getRecentSecurityLogs, getSecuritySummary } from '../../firebase/security';

const COLORS = {
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F',
  accent: '#E94560',
  blue: '#3B82F6',
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444'
};

const EVENT_LABELS = {
  login_success: { label: 'Login Success', color: COLORS.green, icon: CheckCircle },
  login_failed: { label: 'Login Failed', color: COLORS.red, icon: XCircle },
  login_locked: { label: 'Account Locked', color: COLORS.red, icon: Lock },
  logout: { label: 'Logout', color: COLORS.text.secondary, icon: Users },
  session_timeout: { label: 'Session Timeout', color: COLORS.yellow, icon: Clock },
  password_change: { label: 'Password Changed', color: COLORS.blue, icon: Lock },
  password_reset_request: { label: 'Password Reset', color: COLORS.yellow, icon: Lock },
  account_created: { label: 'Account Created', color: COLORS.green, icon: Users },
  google_login: { label: 'Google Login', color: COLORS.green, icon: CheckCircle },
  google_login_failed: { label: 'Google Login Failed', color: COLORS.red, icon: XCircle },
  suspicious_activity: { label: 'Suspicious Activity', color: COLORS.red, icon: AlertTriangle },
  role_change: { label: 'Role Changed', color: COLORS.blue, icon: Shield },
  app_check_fallback: { label: 'App Check Fallback', color: COLORS.yellow, icon: Globe },
  app_check_init_failed: { label: 'App Check Failed', color: COLORS.yellow, icon: ShieldOff }
};

function SecurityDashboard() {
  const [config, setConfig] = useState(null);
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setRefreshing(true);
      const [cfg, sum, recentLogs] = await Promise.all([
        Promise.resolve(getSecurityConfig()),
        getSecuritySummary(),
        getRecentSecurityLogs(30)
      ]);
      setConfig(cfg);
      setSummary(sum);
      setLogs(recentLogs);
    } catch (err) {
      console.warn('[SecurityDashboard] Load error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite', color: COLORS.text.secondary }} />
        <p style={{ color: COLORS.text.secondary, fontSize: '0.85rem', marginTop: '0.5rem' }}>Loading security data...</p>
      </div>
    );
  }

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldCheck size={24} color={COLORS.green} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: COLORS.text.primary }}>
              Security Dashboard
            </h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: COLORS.text.secondary }}>
              Authentication & access monitoring
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.4rem 0.75rem', background: COLORS.surfaceLight,
            border: `1px solid ${COLORS.border}`, borderRadius: '0.35rem',
            color: COLORS.text.secondary, fontSize: '0.72rem', fontWeight: '600',
            cursor: refreshing ? 'not-allowed' : 'pointer'
          }}
        >
          <RefreshCw size={13} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Security Config Status Cards */}
      {config && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
          gap: '0.75rem', marginBottom: '1.25rem'
        }}>
          {/* App Check */}
          <StatusCard
            icon={config.appCheck.active ? ShieldCheck : ShieldOff}
            title="App Check"
            value={config.appCheck.active ? 'Active' : config.appCheck.enabled ? 'Configured' : 'Not Configured'}
            color={config.appCheck.active ? COLORS.green : config.appCheck.enabled ? COLORS.yellow : COLORS.text.light}
            detail={config.appCheck.provider}
          />
          {/* Rate Limiting */}
          <StatusCard
            icon={Lock}
            title="Rate Limiting"
            value="Active"
            color={COLORS.green}
            detail={`Max ${config.rateLimiting.maxAttempts} attempts, ${config.rateLimiting.lockoutDuration}s lockout`}
          />
          {/* Session Mgmt */}
          <StatusCard
            icon={Clock}
            title="Session Timeout"
            value={`${config.sessionManagement.timeoutMinutes} min`}
            color={COLORS.blue}
            detail={`Warning at ${config.sessionManagement.warningMinutes} min before`}
          />
          {/* Audit Logging */}
          <StatusCard
            icon={Activity}
            title="Audit Logging"
            value="Enabled"
            color={COLORS.green}
            detail={`${config.auditLogging.events} event types tracked`}
          />
          {/* Password Policy */}
          <StatusCard
            icon={Shield}
            title="Password Policy"
            value="Enforced"
            color={COLORS.green}
            detail={`Min ${config.passwordPolicy.minLength} chars, mixed case + numbers`}
          />
          {/* Global Access */}
          <StatusCard
            icon={Globe}
            title="Global Access"
            value="Supported"
            color={COLORS.blue}
            detail={config.globalAccess?.description || 'Graceful degradation for restricted regions'}
          />
        </div>
      )}

      {/* 24h Summary */}
      {summary && (
        <div style={{
          background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
          borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem'
        }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.82rem', fontWeight: '700', color: COLORS.text.primary }}>
            Last 24 Hours
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <SummaryItem label="Total Events" value={summary.totalEventsLast24h} color={COLORS.blue} />
            <SummaryItem label="Successful Logins" value={summary.loginSuccessCount} color={COLORS.green} />
            <SummaryItem label="Failed Logins" value={summary.loginFailedCount} color={summary.loginFailedCount > 0 ? COLORS.yellow : COLORS.text.secondary} />
            <SummaryItem label="Google Logins" value={summary.googleLoginCount} color={COLORS.blue} />
            <SummaryItem label="Suspicious" value={summary.suspiciousCount} color={summary.suspiciousCount > 0 ? COLORS.red : COLORS.text.secondary} />
            <SummaryItem label="Lockouts" value={summary.lockoutCount} color={summary.lockoutCount > 0 ? COLORS.red : COLORS.text.secondary} />
          </div>
        </div>
      )}

      {/* Recent Audit Logs (expandable) */}
      <div style={{
        background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
        borderRadius: '0.75rem', overflow: 'hidden'
      }}>
        <button
          onClick={() => setShowLogs(!showLogs)}
          style={{
            width: '100%', padding: '0.85rem 1rem',
            background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', color: COLORS.text.primary
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={16} color={COLORS.blue} />
            <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>Recent Security Events</span>
            <span style={{
              background: COLORS.blue + '20',
              color: COLORS.blue,
              padding: '0.15rem 0.45rem',
              borderRadius: '0.25rem',
              fontSize: '0.68rem',
              fontWeight: '700'
            }}>
              {logs.length}
            </span>
          </div>
          {showLogs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showLogs && (
          <div style={{
            maxHeight: '400px', overflowY: 'auto',
            borderTop: `1px solid ${COLORS.border}`
          }}>
            {logs.length === 0 ? (
              <p style={{ padding: '1.5rem', textAlign: 'center', color: COLORS.text.secondary, fontSize: '0.82rem' }}>
                No security events recorded yet.
              </p>
            ) : (
              logs.map((log, idx) => {
                const eventInfo = EVENT_LABELS[log.eventType] || { label: log.eventType, color: COLORS.text.secondary, icon: Activity };
                const Icon = eventInfo.icon;
                return (
                  <div
                    key={log.id || idx}
                    style={{
                      padding: '0.65rem 1rem',
                      borderBottom: idx < logs.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      fontSize: '0.78rem'
                    }}
                  >
                    <Icon size={14} color={eventInfo.color} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ color: eventInfo.color, fontWeight: '600' }}>{eventInfo.label}</span>
                      {log.userEmail && (
                        <span style={{ color: COLORS.text.secondary, marginLeft: '0.5rem' }}>
                          {log.userEmail}
                        </span>
                      )}
                      {log.email && !log.userEmail && (
                        <span style={{ color: COLORS.text.secondary, marginLeft: '0.5rem' }}>
                          {log.email}
                        </span>
                      )}
                    </div>
                    <span style={{ color: COLORS.text.light, fontSize: '0.68rem', flexShrink: 0 }}>
                      {formatTimestamp(log.timestamp || log.clientTimestamp)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Setup Instructions (simplified v3.0) */}
      <div style={{
        marginTop: '1.25rem', padding: '1rem',
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <ShieldCheck size={16} color={COLORS.green} />
          <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: '700', color: COLORS.green }}>
            Security v3.0 — Simplified
          </h4>
        </div>
        <p style={{ fontSize: '0.78rem', color: COLORS.text.secondary, lineHeight: '1.6', margin: 0 }}>
          App Check has been removed to ensure stable portal operation. Security is enforced via Firestore Security Rules,
          Firebase Authentication, client-side rate limiting, and session management.
        </p>
      </div>
    </div>
  );
}

// Sub-components
function StatusCard({ icon: Icon, title, value, color, detail }) {
  return (
    <div style={{
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: '0.6rem', padding: '0.85rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: '0.68rem', fontWeight: '600', color: COLORS.text.secondary }}>{title}</span>
      </div>
      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color }}>{value}</p>
      {detail && (
        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.62rem', color: COLORS.text.light, lineHeight: '1.4' }}>
          {detail}
        </p>
      )}
    </div>
  );
}

function SummaryItem({ label, value, color }) {
  return (
    <div style={{ minWidth: '80px' }}>
      <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color }}>{value}</p>
      <p style={{ margin: 0, fontSize: '0.65rem', color: COLORS.text.secondary, fontWeight: '600' }}>{label}</p>
    </div>
  );
}

export default SecurityDashboard;
