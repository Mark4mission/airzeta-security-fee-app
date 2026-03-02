import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import { FolderOpen, Plus, Clock, Search, Eye, Pin, Lock, Users, Download } from 'lucide-react';

const COLORS = {
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F',
  accent: '#E94560',
  blue: '#60A5FA',
};

const CATEGORY_COLORS = {
  Regulation: { bg: 'rgba(239,68,68,0.12)', color: '#F87171', border: 'rgba(239,68,68,0.2)' },
  Guideline: { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA', border: 'rgba(59,130,246,0.2)' },
  Material: { bg: 'rgba(16,185,129,0.12)', color: '#34D399', border: 'rgba(16,185,129,0.2)' },
  General: { bg: 'rgba(245,158,11,0.12)', color: '#FBBF24', border: 'rgba(245,158,11,0.2)' },
  Other: { bg: 'rgba(139,153,168,0.12)', color: '#8B99A8', border: 'rgba(139,153,168,0.2)' },
};

export default function DocumentDashboard() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  const branchName = currentUser?.branchName || currentUser?.displayName || '';
  const userRole = currentUser?.role || 'branch_user';

  useEffect(() => {
    const q = query(collection(db, 'documentLibrary'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDocuments(docs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    try {
      return timestamp.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  // Filter: user can only see documents they have permission to access
  const accessibleDocuments = documents.filter(doc => {
    if (isAdmin) return true;
    // All Branches permission
    if (doc.downloadPermission === 'all_branches') return true;
    // Admin only
    if (doc.downloadPermission === 'admin_only' && isAdmin) return true;
    // Uploader's branch auto-access
    if (doc.uploaderBranch && doc.uploaderBranch === branchName) return true;
    return false;
  });

  // Apply search and category filter
  const filteredDocuments = accessibleDocuments.filter(doc => {
    const matchSearch = !searchTerm ||
      doc.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.iataCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.uploaderBranch?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = filterCategory === 'All' || doc.category === filterCategory;
    return matchSearch && matchCategory;
  });

  // Sort: pinned first, then by createdAt desc
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: COLORS.surface, padding: '1.25rem 1.5rem', borderRadius: '0.75rem',
        border: `1px solid ${COLORS.border}`, flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
            Document Library
          </h1>
          <p style={{ color: COLORS.text.secondary, fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Station Security Operation Manuals (SSOP) & Reference Documents
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{
              padding: '0.5rem 0.6rem', border: `1px solid ${COLORS.border}`,
              borderRadius: '0.5rem', background: COLORS.surfaceLight,
              color: COLORS.text.primary, fontSize: '0.8rem', outline: 'none',
            }}
          >
            <option value="All">All Categories</option>
            <option value="Regulation">Regulation</option>
            <option value="Guideline">Guideline</option>
            <option value="Material">Material</option>
            <option value="General">General</option>
            <option value="Other">Other</option>
          </select>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: COLORS.text.light }} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '0.5rem 0.5rem 0.5rem 2rem', width: '220px',
                border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem',
                background: COLORS.surfaceLight, color: COLORS.text.primary,
                fontSize: '0.8rem', outline: 'none',
              }}
            />
          </div>
          {(isAdmin || userRole === 'branch_user') && (
            <button
              onClick={() => navigate('/document-library/upload')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: COLORS.accent, color: 'white',
                padding: '0.55rem 1.1rem', borderRadius: '0.5rem', border: 'none',
                cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem',
                boxShadow: '0 2px 8px rgba(233,69,96,0.25)',
              }}
            >
              <Plus size={18} /> Upload Document
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: COLORS.surface, borderRadius: '0.75rem',
        border: `1px solid ${COLORS.border}`, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: COLORS.text.secondary }}>
            <Clock size={20} style={{ marginRight: '0.5rem', animation: 'spin 1s linear infinite' }} />
            Loading documents...
          </div>
        ) : sortedDocuments.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: COLORS.text.secondary }}>
            <FolderOpen size={40} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
            <p>{searchTerm || filterCategory !== 'All' ? 'No matching documents found.' : 'No documents uploaded yet.'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ padding: '0.7rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase', width: '40px' }}></th>
                  <th style={{ padding: '0.7rem 0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Title</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase', width: '90px' }}>Category</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase', width: '100px' }}>Uploaded By</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase', width: '100px' }}>Date</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase', width: '70px' }}>Access</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase', width: '70px' }}>Downloads</th>
                </tr>
              </thead>
              <tbody>
                {sortedDocuments.map((doc) => {
                  const catStyle = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.Other;
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => navigate(`/document-library/doc/${doc.id}`)}
                      style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceLight}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.65rem 0.5rem 0.65rem 1.25rem', textAlign: 'center' }}>
                        {doc.pinned && <Pin size={13} color="#FBBF24" style={{ transform: 'rotate(-45deg)' }} />}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <div style={{ fontWeight: '600', color: COLORS.text.primary, fontSize: '0.85rem' }}>
                          {doc.iataCode && (
                            <span style={{ color: COLORS.blue, fontWeight: '700', marginRight: '0.35rem', fontSize: '0.78rem' }}>
                              [{doc.iataCode}]
                            </span>
                          )}
                          {doc.title}
                        </div>
                        {doc.description && (
                          <div style={{ fontSize: '0.72rem', color: COLORS.text.light, marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                            {doc.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span style={{
                          display: 'inline-block', padding: '0.15rem 0.5rem',
                          borderRadius: '9999px', fontSize: '0.68rem', fontWeight: '600',
                          background: catStyle.bg, color: catStyle.color,
                          border: `1px solid ${catStyle.border}`,
                        }}>
                          {doc.category || 'Other'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', color: COLORS.text.secondary }}>
                        {doc.uploaderBranch || 'HQ'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', color: COLORS.text.light }}>
                        {formatDate(doc.createdAt)}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        {doc.downloadPermission === 'admin_only' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', color: '#F87171' }}>
                            <Lock size={11} /> Admin
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', color: '#34D399' }}>
                            <Users size={11} /> All
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: COLORS.text.light }}>
                          <Download size={11} /> {doc.downloadCount || 0}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
