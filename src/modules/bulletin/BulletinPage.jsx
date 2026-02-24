import React from 'react';
import { Megaphone, Clock } from 'lucide-react';

function BulletinPage() {
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
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Megaphone size={40} color="#F59E0B" />
      </div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#E8EAED' }}>
        Security Bulletin Board
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#8B99A8', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6' }}>
        This module is under development. It will allow posting and sharing security bulletins, notices, and announcements across all stations.
      </p>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.5rem 1rem',
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '0.5rem',
        fontSize: '0.75rem',
        color: '#FBBF24',
        fontWeight: '600',
      }}>
        <Clock size={14} />
        Coming Soon
      </div>
    </div>
  );
}

export default BulletinPage;
