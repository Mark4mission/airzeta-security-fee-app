import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import { FileText, Plus, Clock, Search, Filter, Eye, MessageCircle } from 'lucide-react';

const COLORS = {
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F',
  accent: '#E94560',
  blue: '#60A5FA',
};

// Board configuration
const BOARD_CONFIG = {
  directive: {
    collection: 'bulletinPosts',
    title: 'Security Directives',
    subtitle: 'Check the latest HQ guidelines and updates',
    newButton: 'New Directive',
    searchPlaceholder: 'Search directives...',
    emptyText: 'No security directives found.',
    noMatchText: 'No matching directives found.',
    loadingText: 'Loading directives...',
    basePath: '/bulletin',
    adminOnly: true,
  },
  communication: {
    collection: 'communicationPosts',
    title: 'Security Communication',
    subtitle: 'Share updates and communicate with all stations',
    newButton: 'New Post',
    searchPlaceholder: 'Search communications...',
    emptyText: 'No communications found.',
    noMatchText: 'No matching communications found.',
    loadingText: 'Loading communications...',
    basePath: '/communication',
    adminOnly: false,
  },
};

// Get site code prefix for display
function getSitePrefix(authorName, authorRole) {
  if (authorRole === 'hq_admin') return 'TA';
  if (authorName) {
    const match = authorName.match(/^([A-Z]{2,4})/);
    if (match) return match[1];
    const code = authorName.substring(0, 3).toUpperCase();
    if (code.length >= 2) return code;
  }
  return '';
}

export default function BulletinDashboard({ boardType = 'directive' }) {
  const config = BOARD_CONFIG[boardType] || BOARD_CONFIG.directive;
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, config.collection), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [config.collection]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    try {
      return timestamp.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const filteredPosts = posts.filter(post =>
    !searchTerm || post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.authorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const branchName = currentUser?.branchName || currentUser?.displayName || '';
  const canWrite = config.adminOnly ? isAdmin : true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: COLORS.surface, padding: '1.25rem 1.5rem', borderRadius: '0.75rem',
        border: `1px solid ${COLORS.border}`,
      }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: '700', color: COLORS.text.primary, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {boardType === 'communication' && <MessageCircle size={22} />}
            {config.title}
          </h1>
          <p style={{ color: COLORS.text.secondary, fontSize: '0.8rem', marginTop: '0.25rem' }}>
            {config.subtitle}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: COLORS.text.light }} />
            <input
              type="text"
              placeholder={config.searchPlaceholder}
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
          {canWrite && (
            <button
              onClick={() => navigate(`${config.basePath}/write`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: boardType === 'communication' ? '#3B82F6' : COLORS.accent, color: 'white',
                padding: '0.55rem 1.1rem', borderRadius: '0.5rem', border: 'none',
                cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem',
                boxShadow: boardType === 'communication' ? '0 2px 8px rgba(59,130,246,0.25)' : '0 2px 8px rgba(233,69,96,0.25)',
              }}
            >
              <Plus size={18} /> {config.newButton}
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
            {config.loadingText}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: COLORS.text.secondary }}>
            <FileText size={40} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
            <p>{searchTerm ? config.noMatchText : config.emptyText}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ padding: '0.7rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Title</th>
                  <th style={{ padding: '0.7rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Author</th>
                  <th style={{ padding: '0.7rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase', width: '60px' }}>Views</th>
                  <th style={{ padding: '0.7rem 1.25rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => {
                  const sitePrefix = getSitePrefix(post.authorName, post.authorRole);
                  return (
                    <tr
                      key={post.id}
                      onClick={() => navigate(`${config.basePath}/post/${post.id}`)}
                      style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceLight}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.65rem 1.25rem' }}>
                        <div style={{ fontWeight: '600', color: COLORS.text.primary, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {sitePrefix && (
                            <span style={{
                              padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.62rem', fontWeight: '700',
                              background: post.authorRole === 'hq_admin' ? 'rgba(233,69,96,0.15)' : 'rgba(96,165,250,0.15)',
                              color: post.authorRole === 'hq_admin' ? '#E94560' : '#60A5FA',
                              border: `1px solid ${post.authorRole === 'hq_admin' ? 'rgba(233,69,96,0.3)' : 'rgba(96,165,250,0.3)'}`,
                              letterSpacing: '0.04em', flexShrink: 0,
                            }}>{sitePrefix}</span>
                          )}
                          <span>{post.title}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 1.25rem', fontSize: '0.8rem', color: COLORS.text.secondary }}>
                        {post.authorName || 'HQ Admin'}
                      </td>
                      <td style={{ padding: '0.65rem 1.25rem', fontSize: '0.8rem', color: COLORS.text.light }}>
                        {formatDate(post.createdAt)}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: COLORS.text.light }}>
                          <Eye size={11} /> {post.viewCount || 0}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 1.25rem', textAlign: 'center' }}>
                        {post.acknowledgedBy?.includes(branchName) ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem',
                            borderRadius: '9999px', fontSize: '0.68rem', fontWeight: '600',
                            background: 'rgba(16,185,129,0.15)', color: '#34D399',
                            border: '1px solid rgba(16,185,129,0.2)',
                          }}>Acknowledged</span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem',
                            borderRadius: '9999px', fontSize: '0.68rem', fontWeight: '600',
                            background: 'rgba(245,158,11,0.15)', color: '#FBBF24',
                            border: '1px solid rgba(245,158,11,0.2)',
                          }}>Pending</span>
                        )}
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
