import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import {
  ArrowLeft, Download, Trash2, Edit, Pin, Lock, Users, FileText,
  Clock, Eye, ChevronDown, ChevronUp, AlertCircle, Paperclip,
} from 'lucide-react';

const COLORS = {
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F',
  accent: '#E94560',
  blue: '#3B82F6',
};

const CATEGORY_COLORS = {
  Regulation: { bg: 'rgba(239,68,68,0.12)', color: '#F87171', border: 'rgba(239,68,68,0.2)' },
  Guideline: { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA', border: 'rgba(59,130,246,0.2)' },
  Material: { bg: 'rgba(16,185,129,0.12)', color: '#34D399', border: 'rgba(16,185,129,0.2)' },
  General: { bg: 'rgba(245,158,11,0.12)', color: '#FBBF24', border: 'rgba(245,158,11,0.2)' },
  Other: { bg: 'rgba(139,153,168,0.12)', color: '#8B99A8', border: 'rgba(139,153,168,0.2)' },
};

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDownloadLog, setShowDownloadLog] = useState(false);

  const branchName = currentUser?.branchName || currentUser?.displayName || '';
  const userRole = currentUser?.role || 'branch_user';

  useEffect(() => {
    const fetchDocument = async () => {
      const docSnap = await getDoc(doc(db, 'documentLibrary', id));
      if (docSnap.exists()) {
        setDocument({ id: docSnap.id, ...docSnap.data() });
      } else {
        navigate('/document-library');
      }
      setLoading(false);
    };
    fetchDocument();
  }, [id, navigate]);

  // Check download permission (not view permission - everyone can view)
  const hasDownloadAccess = () => {
    if (!document) return false;
    if (isAdmin) return true;
    if (document.downloadPermission === 'all_branches') return true;
    if (document.uploaderBranch === branchName) return true;
    return false;
  };

  // Same-branch users can edit/delete documents uploaded by their branch
  const isAuthorOrAdmin = () => {
    if (!document) return false;
    if (isAdmin) return true;
    if (currentUser?.uid === document.uploaderId) return true;
    if (branchName && document.uploaderBranch === branchName) return true;
    return false;
  };

  const trackDownload = async (fileName) => {
    try {
      const downloadEntry = {
        userId: currentUser?.uid || 'unknown',
        userEmail: currentUser?.email || '',
        branchName: branchName,
        fileName: fileName,
        downloadedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'documentLibrary', id), {
        downloadCount: (document.downloadCount || 0) + 1,
        downloadLog: arrayUnion(downloadEntry),
      });

      setDocument(prev => ({
        ...prev,
        downloadCount: (prev.downloadCount || 0) + 1,
        downloadLog: [...(prev.downloadLog || []), downloadEntry],
      }));
    } catch (err) {
      console.warn('[DocDetail] Download tracking error:', err.message);
    }
  };

  const handleDownload = async (file) => {
    if (!hasDownloadAccess()) return;

    // Record download in Firestore
    await trackDownload(file.name);

    // Fetch and download the file properly (not just open in new tab)
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab if fetch fails (e.g. CORS)
      window.open(file.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Handle drag start for file download via drag-and-drop
  const handleDragStart = (e, file) => {
    if (!hasDownloadAccess()) {
      e.preventDefault();
      return;
    }
    // Set download data for drag-and-drop to desktop
    e.dataTransfer.setData('DownloadURL', `${file.type || 'application/octet-stream'}:${file.name}:${file.url}`);
    e.dataTransfer.setData('text/uri-list', file.url);
    e.dataTransfer.setData('text/plain', file.url);
    e.dataTransfer.effectAllowed = 'copy';
    // Track the download
    trackDownload(file.name);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'documentLibrary', id));
      navigate('/document-library');
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleTogglePin = async () => {
    if (!isAdmin) return;
    try {
      const newPinned = !document.pinned;
      await updateDoc(doc(db, 'documentLibrary', id), { pinned: newPinned });
      setDocument(prev => ({ ...prev, pinned: newPinned }));
    } catch (err) {
      console.warn('[DocDetail] Pin toggle error:', err.message);
    }
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: COLORS.text.secondary }}>Loading...</div>;
  if (!document) return null;

  const catStyle = CATEGORY_COLORS[document.category] || CATEGORY_COLORS.Other;
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    try {
      if (typeof timestamp === 'string') return new Date(timestamp).toLocaleString();
      return timestamp.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  // Group download log by branch
  const downloadLogByBranch = {};
  (document.downloadLog || []).forEach(entry => {
    const branch = entry.branchName || 'Unknown';
    if (!downloadLogByBranch[branch]) downloadLogByBranch[branch] = [];
    downloadLogByBranch[branch].push(entry);
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '3rem' }}>
      {/* Action bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: COLORS.surface, padding: '0.75rem 1rem', borderRadius: '0.75rem',
        border: `1px solid ${COLORS.border}`, flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <button onClick={() => navigate('/document-library')} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none',
          color: COLORS.text.secondary, cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500',
        }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={handleTogglePin} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem',
              background: document.pinned ? 'rgba(245,158,11,0.1)' : COLORS.surfaceLight,
              color: document.pinned ? '#FBBF24' : COLORS.text.primary,
              border: `1px solid ${document.pinned ? 'rgba(245,158,11,0.2)' : COLORS.border}`,
              borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '500',
            }}>
              <Pin size={14} style={{ transform: 'rotate(-45deg)' }} />
              {document.pinned ? 'Unpin' : 'Pin to Top'}
            </button>
          )}
          {isAuthorOrAdmin() && (
            <>
              <button onClick={() => navigate(`/document-library/edit/${id}`)} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem',
                background: COLORS.surfaceLight, color: COLORS.text.primary, border: `1px solid ${COLORS.border}`,
                borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '500',
              }}>
                <Edit size={14} /> Edit
              </button>
              <button onClick={handleDelete} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem',
                background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '500',
              }}>
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Document Info */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '1.5rem', background: COLORS.surfaceLight }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            {document.pinned && (
              <Pin size={16} color="#FBBF24" style={{ transform: 'rotate(-45deg)', flexShrink: 0 }} />
            )}
            <span style={{
              padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: '600',
              background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}`,
            }}>
              {document.category || 'Other'}
            </span>
            {document.downloadPermission === 'admin_only' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', color: '#F87171', background: 'rgba(239,68,68,0.08)', padding: '0.15rem 0.5rem', borderRadius: '9999px', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Lock size={11} /> Admin Only
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', color: '#34D399', background: 'rgba(16,185,129,0.08)', padding: '0.15rem 0.5rem', borderRadius: '9999px', border: '1px solid rgba(16,185,129,0.2)' }}>
                <Users size={11} /> All Branches
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: COLORS.text.primary, margin: '0 0 0.3rem', lineHeight: '1.3' }}>
            {document.iataCode && (
              <span style={{ color: COLORS.blue, marginRight: '0.4rem' }}>[{document.iataCode}]</span>
            )}
            {document.title}
          </h1>
          {document.description && (
            <p style={{ fontSize: '0.85rem', color: COLORS.text.secondary, lineHeight: '1.5', margin: '0.5rem 0 0' }}>
              {document.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.75rem' }}>
            <span style={{ background: COLORS.surface, padding: '0.3rem 0.7rem', borderRadius: '0.375rem', border: `1px solid ${COLORS.border}`, color: COLORS.text.secondary }}>
              By: {document.uploaderBranch || 'HQ'}
            </span>
            <span style={{ background: COLORS.surface, padding: '0.3rem 0.7rem', borderRadius: '0.375rem', border: `1px solid ${COLORS.border}`, color: COLORS.text.secondary }}>
              {formatDate(document.createdAt)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: COLORS.surface, padding: '0.3rem 0.7rem', borderRadius: '0.375rem', border: `1px solid ${COLORS.border}`, color: COLORS.text.light, fontSize: '0.75rem' }}>
              <Download size={12} /> {document.downloadCount || 0} downloads
            </span>
          </div>
        </div>

        {/* Files section */}
        <div style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.text.primary, marginBottom: '0.75rem' }}>
            <Paperclip size={16} /> Attached Files
          </h3>

          {!hasDownloadAccess() ? (
            <div>
              {/* Show file names so users can see what's available, but no download */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {(document.attachments || []).map((file, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', padding: '0.7rem 0.9rem',
                    background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
                    borderRadius: '0.5rem', opacity: 0.6,
                  }}>
                    <FileText size={18} color={COLORS.text.light} style={{ marginRight: '0.6rem', flexShrink: 0 }} />
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: '500', color: COLORS.text.secondary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                      <p style={{ fontSize: '0.65rem', color: COLORS.text.light, margin: 0 }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Lock size={14} color="#F87171" style={{ flexShrink: 0 }} />
                  </div>
                ))}
              </div>
              <div style={{
                padding: '1rem', textAlign: 'center', background: 'rgba(239,68,68,0.05)',
                borderRadius: '0.5rem', border: '1px solid rgba(239,68,68,0.1)',
              }}>
                <p style={{ color: '#F87171', fontSize: '0.8rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <Lock size={14} /> Download Restricted
                </p>
                <p style={{ color: COLORS.text.light, fontSize: '0.72rem', marginTop: '0.2rem' }}>
                  File downloads are restricted to admin users or the uploading branch.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
              {(document.attachments || []).map((file, i) => (
                <a key={i}
                  href={file.url}
                  download={file.name}
                  draggable="true"
                  onClick={(e) => { e.preventDefault(); handleDownload(file); }}
                  onDragStart={(e) => handleDragStart(e, file)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '0.7rem 0.9rem',
                    background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
                    borderRadius: '0.5rem', cursor: 'pointer', transition: 'border-color 0.15s',
                    textAlign: 'left', width: '100%', textDecoration: 'none', boxSizing: 'border-box',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.blue}
                  onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}
                >
                  <Download size={18} color={COLORS.blue} style={{ marginRight: '0.6rem', flexShrink: 0 }} />
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: '500', color: COLORS.text.primary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                    <p style={{ fontSize: '0.65rem', color: COLORS.text.light, margin: 0 }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB — click or drag to download
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Download Tracking (Admin only) */}
      {isAdmin && (document.downloadLog || []).length > 0 && (
        <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
          <button
            onClick={() => setShowDownloadLog(!showDownloadLog)}
            style={{
              width: '100%', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: COLORS.surfaceLight, border: 'none', cursor: 'pointer',
              borderBottom: showDownloadLog ? `1px solid ${COLORS.border}` : 'none',
            }}
          >
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.text.primary, margin: 0 }}>
              <Eye size={16} color={COLORS.blue} /> Download Tracking
              <span style={{ fontSize: '0.72rem', fontWeight: '500', color: COLORS.text.light, marginLeft: '0.25rem' }}>
                ({(document.downloadLog || []).length} records)
              </span>
            </h3>
            {showDownloadLog ? <ChevronUp size={18} color={COLORS.text.light} /> : <ChevronDown size={18} color={COLORS.text.light} />}
          </button>

          {showDownloadLog && (
            <div style={{ padding: '1rem 1.25rem' }}>
              {Object.entries(downloadLogByBranch).sort().map(([branch, entries]) => (
                <div key={branch} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: '700', color: COLORS.blue,
                      background: 'rgba(59,130,246,0.08)', padding: '0.2rem 0.6rem',
                      borderRadius: '0.3rem',
                    }}>
                      {branch}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: COLORS.text.light }}>
                      ({entries.length} download{entries.length > 1 ? 's' : ''})
                    </span>
                  </div>
                  {entries.map((entry, idx) => (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.3rem 0.5rem 0.3rem 1.5rem',
                      fontSize: '0.72rem', color: COLORS.text.secondary,
                      borderLeft: `2px solid ${COLORS.border}`,
                    }}>
                      <span>{entry.userEmail}</span>
                      <span style={{ color: COLORS.text.light, fontSize: '0.65rem' }}>
                        {entry.fileName} - {new Date(entry.downloadedAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
