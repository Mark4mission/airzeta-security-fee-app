import React from 'react';
import { Package, Clock } from 'lucide-react';

function SecurityLevelPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '1.5rem',
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '1rem',
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Package size={40} color="#10B981" />
      </div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#E8EAED' }}>
        Aviation Security Level Management
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#8B99A8', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6' }}>
        This module is planned for future development. It will manage aviation security threat levels and compliance status.
      </p>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.5rem 1rem',
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '0.5rem',
        fontSize: '0.75rem',
        color: '#34D399',
        fontWeight: '600',
      }}>
        <Clock size={14} />
        Planned
      </div>
    </div>
  );
}

export default SecurityLevelPage;
