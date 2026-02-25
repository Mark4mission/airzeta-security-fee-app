import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, arrayUnion, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import { useReactToPrint } from 'react-to-print';
import 'react-quill-new/dist/quill.snow.css';
import { ArrowLeft, Printer, CheckCircle, Paperclip, Download, MessageSquare, Send, Users, AlertCircle, Edit, Trash2 } from 'lucide-react';

const COLORS = {
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F',
  accent: '#E94560',
  blue: '#3B82F6',
};

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [allBranches, setAllBranches] = useState([]);

  const printRef = useRef(null);

  const branchName = currentUser?.branchName || currentUser?.displayName || '';
  const userRole = currentUser?.role || 'branch_user';

  useEffect(() => {
    const fetchPost = async () => {
      const docSnap = await getDoc(doc(db, 'bulletinPosts', id));
      if (docSnap.exists()) setPost({ id: docSnap.id, ...docSnap.data() });
      else navigate('/bulletin');
      setLoading(false);
    };
    fetchPost();

    const q = query(collection(db, `bulletinPosts/${id}/comments`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

    if (isAdmin) {
      getDocs(collection(db, 'branchCodes')).then(snap => setAllBranches(snap.docs.map(d => d.id)));
    }
    return () => unsubscribe();
  }, [id, navigate, isAdmin]);

  const handleAcknowledge = async () => {
    if (!branchName || post.acknowledgedBy?.includes(branchName)) return;
    await updateDoc(doc(db, 'bulletinPosts', id), { acknowledgedBy: arrayUnion(branchName) });
    setPost(prev => ({ ...prev, acknowledgedBy: [...(prev.acknowledgedBy || []), branchName] }));
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await addDoc(collection(db, `bulletinPosts/${id}/comments`), {
      text: newComment.trim(),
      authorId: currentUser?.uid || 'unknown',
      authorBranch: branchName,
      authorRole: userRole,
      createdAt: serverTimestamp(),
    });
    setNewComment('');
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this directive?")) {
      await deleteDoc(doc(db, 'bulletinPosts', id));
      navigate('/bulletin');
    }
  };

  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: `AirZeta_${post?.title}` });

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: COLORS.text.secondary }}>Loading...</div>;
  if (!post) return null;

  const isAcknowledged = post.acknowledgedBy?.includes(branchName);
  const isBranchUser = userRole === 'branch_user';
  const isAuthorOrAdmin = isAdmin || currentUser?.uid === post.authorId;

  const renderAdminAckStatus = () => {
    if (!isAdmin || allBranches.length === 0) return null;
    const ackList = post.acknowledgedBy || [];
    const pendingList = allBranches.filter(b => !ackList.includes(b));
    const showAcknowledged = ackList.length < (allBranches.length / 2);

    return (
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.text.primary, margin: 0 }}>
            <Users size={18} color={COLORS.blue} /> Acknowledgement Tracker
          </h3>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', background: COLORS.surfaceLight, padding: '0.3rem 0.75rem', borderRadius: '9999px', color: COLORS.text.primary }}>
            {ackList.length} / {allBranches.length} Acknowledged
          </span>
        </div>
        {showAcknowledged ? (
          <div>
            <p style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34D399' }}>
              <CheckCircle size={14} /> Acknowledged
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {ackList.map(b => (
                <span key={b} style={{ padding: '0.3rem 0.7rem', background: 'rgba(16,185,129,0.1)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.4rem', fontSize: '0.75rem' }}>{b}</span>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#F87171' }}>
              <AlertCircle size={14} /> Pending
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {pendingList.map(b => (
                <span key={b} style={{ padding: '0.3rem 0.7rem', background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.4rem', fontSize: '0.75rem' }}>{b}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '3rem' }}>
      {/* Action bar */}
      <div className="print:hidden" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: COLORS.surface, padding: '0.75rem 1rem', borderRadius: '0.75rem',
        border: `1px solid ${COLORS.border}`,
      }}>
        <button onClick={() => navigate('/bulletin')} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none',
          color: COLORS.text.secondary, cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500',
        }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isAuthorOrAdmin && (
            <>
              <button onClick={() => navigate(`/bulletin/edit/${id}`)} style={{
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
          {isBranchUser && (
            <button onClick={handleAcknowledge} disabled={isAcknowledged} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem',
              background: isAcknowledged ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
              color: isAcknowledged ? '#34D399' : '#FBBF24',
              border: `1px solid ${isAcknowledged ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
              borderRadius: '0.4rem', cursor: isAcknowledged ? 'default' : 'pointer',
              fontSize: '0.75rem', fontWeight: '600',
            }}>
              <CheckCircle size={14} /> {isAcknowledged ? 'Acknowledged' : 'Acknowledge Receipt'}
            </button>
          )}
          <button onClick={handlePrint} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem',
            background: COLORS.accent, color: 'white', border: 'none',
            borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600',
          }}>
            <Printer size={14} /> Print to PDF
          </button>
        </div>
      </div>

      {/* Admin ack status */}
      {renderAdminAckStatus()}

      {/* Post content */}
      <div ref={printRef} style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
        {/* Title area */}
        <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '1.5rem', background: COLORS.surfaceLight }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: COLORS.text.primary, marginBottom: '0.75rem' }}>{post.title}</h1>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem' }}>
            <span style={{ background: COLORS.surface, padding: '0.3rem 0.7rem', borderRadius: '0.375rem', border: `1px solid ${COLORS.border}`, color: COLORS.text.secondary }}>
              From: {post.authorName}
            </span>
            <span style={{ background: COLORS.surface, padding: '0.3rem 0.7rem', borderRadius: '0.375rem', border: `1px solid ${COLORS.border}`, color: COLORS.text.secondary }}>
              Date: {post.createdAt?.toDate().toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', minHeight: '250px' }}>
          <div className="ql-editor" style={{ color: COLORS.text.primary, lineHeight: '1.7' }} dangerouslySetInnerHTML={{ __html: post.content }} />
        </div>

        {/* Attachments */}
        {post.attachments && post.attachments.length > 0 && (
          <div style={{ padding: '1.25rem', borderTop: `1px solid ${COLORS.border}`, background: COLORS.surfaceLight }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.text.primary, marginBottom: '0.75rem' }}>
              <Paperclip size={16} /> Attachments
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.5rem' }}>
              {post.attachments.map((file, i) => (
                <a key={i} href={file.url} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', padding: '0.6rem 0.8rem',
                    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                    borderRadius: '0.5rem', textDecoration: 'none', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.blue}
                  onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}
                >
                  <Download size={16} color={COLORS.blue} style={{ marginRight: '0.6rem', flexShrink: 0 }} />
                  <div style={{ overflow: 'hidden' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: '500', color: COLORS.text.primary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                    <p style={{ fontSize: '0.65rem', color: COLORS.text.light, margin: 0 }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="print:hidden" style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surfaceLight, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={16} color={COLORS.blue} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>Questions & Comments ({comments.length})</h3>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {comments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {comments.map((comment) => (
                <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', alignItems: comment.authorRole === 'hq_admin' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', borderRadius: '0.75rem', padding: '0.7rem 1rem',
                    background: comment.authorRole === 'hq_admin' ? '#E0F2FE' : COLORS.surfaceLight,
                    color: comment.authorRole === 'hq_admin' ? '#1a1a1a' : COLORS.text.primary,
                    borderTopRightRadius: comment.authorRole === 'hq_admin' ? '0.15rem' : '0.75rem',
                    borderTopLeftRadius: comment.authorRole !== 'hq_admin' ? '0.15rem' : '0.75rem',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem',
                      marginBottom: '0.3rem', paddingBottom: '0.3rem',
                      borderBottom: `1px solid ${comment.authorRole === 'hq_admin' ? 'rgba(0,0,0,0.1)' : COLORS.border}`,
                    }}>
                      <span style={{ fontWeight: '700', fontSize: '0.75rem' }}>
                        {comment.authorBranch} {comment.authorRole === 'hq_admin' ? '(HQ Admin)' : ''}
                      </span>
                      <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>
                        {comment.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', lineHeight: '1.5', margin: 0 }}>{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.text.light }}>
              <MessageSquare size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.2 }} />
              <p style={{ margin: 0, fontSize: '0.8rem' }}>No comments or questions yet.</p>
            </div>
          )}

          {/* Comment form */}
          <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ask a question or leave a comment..."
              rows="1"
              style={{
                flex: 1, padding: '0.6rem 0.8rem', resize: 'none', height: '2.8rem',
                background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
                borderRadius: '0.5rem', color: COLORS.text.primary, fontSize: '0.8rem', outline: 'none',
              }}
            />
            <button type="submit" disabled={!newComment.trim()} style={{
              padding: '0.6rem 1rem', background: COLORS.accent, color: 'white', border: 'none',
              borderRadius: '0.5rem', cursor: newComment.trim() ? 'pointer' : 'not-allowed',
              opacity: newComment.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontWeight: '600', fontSize: '0.8rem',
            }}>
              <Send size={14} /> Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
