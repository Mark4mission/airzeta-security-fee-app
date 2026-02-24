import React, { useState, useEffect } from 'react';
import { useAuth } from '../../core/AuthContext';
import { loadSettingsFromFirestore } from '../../firebase/collections';
import Settings from '../../components/Settings';
import { ShieldAlert } from 'lucide-react';

const DEFAULT_SETTINGS = {
  branches: [],
  costItems: [],
  currencies: ['USD', 'EUR', 'KRW', 'JPY', 'SGD', 'HKD', 'THB'],
  paymentMethods: ['Bank Transfer', 'Credit Card', 'Cash', 'Check', 'Online Payment']
};

function SettingsPage() {
  const { currentUser, isAdmin } = useAuth();
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('securityAppSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      if (currentUser) {
        try {
          const fs = await loadSettingsFromFirestore();
          const merged = { ...settings };
          if (fs.branches?.length > 0) merged.branches = fs.branches;
          if (fs.costItems?.length > 0) merged.costItems = fs.costItems;
          if (fs.currencies?.length > 0) merged.currencies = fs.currencies;
          if (fs.paymentMethods?.length > 0) merged.paymentMethods = fs.paymentMethods;
          setSettings(merged);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
      }
    };
    load();
  }, [currentUser]);

  const handleSave = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('securityAppSettings', JSON.stringify(newSettings));
    setShowModal(false);
    setMessage('Settings saved successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <ShieldAlert size={48} color="#F87171" />
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#E8EAED' }}>Access Restricted</h2>
        <p style={{ fontSize: '0.85rem', color: '#8B99A8' }}>Only HQ administrators can access settings.</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#8B99A8' }}>Loading settings...</div>;
  }

  return (
    <div>
      {message && (
        <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: '0.5rem', background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.85rem', fontWeight: '500' }}>
          {message}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Stations', value: settings.branches?.length || 0, color: '#60A5FA' },
          { label: 'Cost Items', value: settings.costItems?.length || 0, color: '#34D399' },
          { label: 'Currencies', value: settings.currencies?.length || 0, color: '#FBBF24' },
          { label: 'Payment Methods', value: settings.paymentMethods?.length || 0, color: '#E94560' },
        ].map(card => (
          <div key={card.label} style={{ background: '#132F4C', border: '1px solid #1E3A5F', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <p style={{ fontSize: '0.72rem', color: '#8B99A8', marginBottom: '0.3rem', fontWeight: '600' }}>{card.label}</p>
            <p style={{ fontSize: '1.8rem', fontWeight: '900', color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Open settings button */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          padding: '0.8rem 1.8rem',
          background: '#E94560',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          fontSize: '0.9rem',
          fontWeight: '700',
          cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(233,69,96,0.3)',
        }}
      >
        Open Settings Manager
      </button>

      {/* Settings modal */}
      {showModal && (
        <Settings
          settings={settings}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default SettingsPage;
