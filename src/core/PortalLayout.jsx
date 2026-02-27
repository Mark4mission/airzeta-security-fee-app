import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Shield, Home, Megaphone, DollarSign, ShieldAlert, Settings as SettingsIcon, 
  LogOut, ChevronLeft, ChevronRight, Menu, X, Users, FileText, Link2
} from 'lucide-react';
import { useAuth } from './AuthContext';

const COLORS = {
  sidebar: {
    bg: '#0B1929',
    bgHover: '#132F4C',
    bgActive: '#1A3A5C',
    text: '#B2BAC2',
    textActive: '#FFFFFF',
    accent: '#E94560',
    border: '#1E3A5F',
    header: '#0A1628',
  },
  header: {
    bg: 'linear-gradient(135deg, #0D2137 0%, #0B1929 100%)',
  },
  content: {
    bg: '#0F2030',
  }
};

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: Home, roles: ['hq_admin', 'branch_user'] },
  { path: '/security-policy', label: 'Security Policy', icon: FileText, roles: ['hq_admin', 'branch_user'] },
  { path: '/bulletin', label: 'Security Bulletin', icon: Megaphone, roles: ['hq_admin', 'branch_user'] },
  { path: '/security-fee', label: 'Security Fee', icon: DollarSign, roles: ['hq_admin', 'branch_user'] },
  { path: '/security-level', label: 'Security Level', icon: ShieldAlert, roles: ['hq_admin', 'branch_user'] },
  { path: '/important-links', label: 'Important Links', icon: Link2, roles: ['hq_admin', 'branch_user'] },
  { path: '/settings', label: 'Settings & Users', icon: SettingsIcon, roles: ['hq_admin'] },
];

function PortalLayout({ children }) {
  const { currentUser, handleLogout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const userRole = currentUser?.role || 'branch_user';
  const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(userRole));

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.content.bg }}>
      {/* Sidebar - Desktop */}
      <aside style={{
        width: sidebarOpen ? '240px' : '64px',
        minHeight: '100vh',
        background: COLORS.sidebar.bg,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 200,
        borderRight: `1px solid ${COLORS.sidebar.border}`,
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: sidebarOpen ? '1.25rem 1.25rem' : '1.25rem 0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: COLORS.sidebar.header,
          borderBottom: `1px solid ${COLORS.sidebar.border}`,
          minHeight: '68px',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: `linear-gradient(135deg, ${COLORS.sidebar.accent} 0%, #c23150 100%)`,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(233, 69, 96, 0.3)',
          }}>
            <Shield size={20} color="white" strokeWidth={2.5} />
          </div>
          {sidebarOpen && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.sidebar.textActive, letterSpacing: '0.03em' }}>
                AIRZETA
              </div>
              <div style={{ fontSize: '0.6rem', color: COLORS.sidebar.text, letterSpacing: '0.05em', marginTop: '1px' }}>
                Station Security System
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filteredNav.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: sidebarOpen ? '0.65rem 0.85rem' : '0.65rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  color: isActive ? COLORS.sidebar.textActive : COLORS.sidebar.text,
                  background: isActive ? COLORS.sidebar.bgActive : 'transparent',
                  fontWeight: isActive ? '600' : '500',
                  fontSize: '0.82rem',
                  transition: 'all 0.15s ease',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  position: 'relative',
                  borderLeft: isActive ? `3px solid ${COLORS.sidebar.accent}` : '3px solid transparent',
                }}
                title={!sidebarOpen ? item.label : undefined}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = COLORS.sidebar.bgHover; e.currentTarget.style.color = COLORS.sidebar.textActive; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = COLORS.sidebar.text; }}}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {sidebarOpen && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Toggle + User */}
        <div style={{ 
          padding: '0.75rem 0.5rem', 
          borderTop: `1px solid ${COLORS.sidebar.border}`,
          background: COLORS.sidebar.header,
        }}>
          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              gap: '0.75rem',
              padding: '0.5rem 0.85rem',
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: COLORS.sidebar.text,
              cursor: 'pointer',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = COLORS.sidebar.bgHover; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title={sidebarOpen ? 'Collapse menu' : 'Expand menu'}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            {sidebarOpen && <span>Collapse</span>}
          </button>

          {/* User info */}
          {sidebarOpen && (
            <div style={{ 
              padding: '0.6rem 0.85rem', 
              marginTop: '0.5rem',
              borderRadius: '0.5rem',
              background: COLORS.sidebar.bgHover,
            }}>
              <div style={{ fontSize: '0.72rem', color: COLORS.sidebar.textActive, fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser?.displayName || currentUser?.email || 'User'}
              </div>
              <div style={{ fontSize: '0.6rem', color: COLORS.sidebar.text, marginTop: '2px' }}>
                {isAdmin ? 'Administrator' : 'Station User'}
                {currentUser?.branchName && ` | ${currentUser.branchName}`}
              </div>
            </div>
          )}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              gap: '0.75rem',
              padding: '0.5rem 0.85rem',
              width: '100%',
              marginTop: '0.5rem',
              background: 'transparent',
              border: 'none',
              color: COLORS.sidebar.accent,
              cursor: 'pointer',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: '600',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(233, 69, 96, 0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title="Logout"
          >
            <LogOut size={16} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150,
          }} 
        />
      )}

      {/* Main content area */}
      <div style={{ 
        flex: 1, 
        marginLeft: sidebarOpen ? '240px' : '64px',
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        {/* Top header bar */}
        <header style={{
          background: COLORS.header.bg,
          padding: '0 1.5rem',
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${COLORS.sidebar.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'none', // visible only on mobile via media query
              background: 'none',
              border: 'none',
              color: COLORS.sidebar.text,
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <Menu size={22} />
          </button>

          {/* Page title from current route */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {(() => {
              const activeItem = NAV_ITEMS.find(i => 
                i.path === location.pathname || 
                (i.path !== '/' && location.pathname.startsWith(i.path))
              ) || NAV_ITEMS[0];
              const Icon = activeItem.icon;
              return (
                <>
                  <Icon size={18} color={COLORS.sidebar.accent} />
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#E8EAED', letterSpacing: '0.02em' }}>
                    {activeItem.label}
                  </span>
                </>
              );
            })()}
          </div>

          {/* Right side info */}
          <div style={{ fontSize: '0.72rem', color: COLORS.sidebar.text, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>{currentUser?.email}</span>
            <span style={{ 
              padding: '0.2rem 0.5rem', 
              borderRadius: '4px', 
              background: isAdmin ? 'rgba(233, 69, 96, 0.15)' : 'rgba(59, 130, 246, 0.15)',
              color: isAdmin ? COLORS.sidebar.accent : '#60A5FA',
              fontWeight: '600',
              fontSize: '0.65rem',
              letterSpacing: '0.04em',
            }}>
              {isAdmin ? 'ADMIN' : 'USER'}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main style={{ 
          flex: 1, 
          padding: '1.5rem',
          background: COLORS.content.bg,
          minHeight: 0,
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default PortalLayout;
