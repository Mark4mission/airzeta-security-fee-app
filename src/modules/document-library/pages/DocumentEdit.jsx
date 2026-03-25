import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import { ArrowLeft, AlertCircle, X, Paperclip, UploadCloud, Pin, Lock, Users, ChevronDown } from 'lucide-react';

const COLORS = {
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F',
  accent: '#E94560',
  blue: '#3B82F6',
  input: { bg: '#1A3A5C', border: '#2A5080', text: '#E8EAED' },
};

const CATEGORIES = ['Regulation', 'Guideline', 'Material', 'General', 'Other'];
const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function DocumentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [iataCode, setIataCode] = useState('');
  const [downloadPermission, setDownloadPermission] = useState('all_branches');
  const [pinned, setPinned] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [allBranches, setAllBranches] = useState([]);
  const [showIataDropdown, setShowIataDropdown] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const fetchDoc = async () => {
      const docSnap = await getDoc(doc(db, 'documentLibrary', id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTitle(data.title || '');
        setDescription(data.description || '');
        setCategory(data.category || 'General');
        setIataCode(data.iataCode || '');
        setDownloadPermission(data.downloadPermission || 'all_branches');
        setPinned(data.pinned || false);
        setExistingAttachments(data.attachments || []);
      } else {
        navigate('/document-library');
      }
      setIsLoading(false);
    };
    fetchDoc();
  }, [id, navigate]);

  useEffect(() => {
    if (isAdmin) {
      getDocs(collection(db, 'branchCodes')).then(snap => {
        setAllBranches(snap.docs.map(d => d.id));
      });
    }
  }, [isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('Title is required.');
    setIsSubmitting(true);
    setError('');

    const uploadedAttachments = [...existingAttachments];

    try {
      if (newFiles.length > 0 && storage) {
        for (let file of newFiles) {
          const storageRef = ref(storage, `document_library/${Date.now()}_${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          await new Promise((resolve) => {
            uploadTask.on('state_changed', null, null, async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              uploadedAttachments.push({ name: file.name, size: file.size, type: file.type, url });
              resolve();
            });
          });
        }
      }

      await updateDoc(doc(db, 'documentLibrary', id), {
        title: title.trim(),
        description: description.trim(),
        category,
        iataCode: iataCode.toUpperCase(),
        downloadPermission,
        pinned: isAdmin ? pinned : undefined,
        attachments: uploadedAttachments,
        updatedAt: serverTimestamp(),
      });

      navigate(`/document-library/doc/${id}`);
    } catch (err) {
      console.warn('[DocEdit]', err.message);
      setError('Failed to save: ' + err.message);
      setIsSubmitting(false);
    }
  };

  const iataOptions = [...new Set(allBranches.map(b => b.substring(0, 3).toUpperCase()))].sort();

  if (isLoading) return <div style={{ padding: '3rem', textAlign: 'center', color: COLORS.text.secondary }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(`/document-library/doc/${id}`)} style={{
          padding: '0.5rem', background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
          borderRadius: '0.5rem', cursor: 'pointer', color: COLORS.text.secondary, display: 'flex',
        }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
          Edit Document
        </h1>
      </div>

      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.5rem' }}>
        <form onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              color: '#F87171', background: 'rgba(239,68,68,0.1)',
              padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem',
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <p style={{ margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Title Prefix (IATA + Category) */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 120px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>IATA Code</label>
              {isAdmin ? (
                <div style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setShowIataDropdown(!showIataDropdown)}
                    style={{
                      width: '100%', padding: '0.7rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                      borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.9rem', cursor: 'pointer',
                    }}>
                    <span>{iataCode || 'Select'}</span>
                    <ChevronDown size={14} />
                  </button>
                  {showIataDropdown && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.25rem', zIndex: 50,
                      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                      borderRadius: '0.4rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      maxHeight: '200px', overflowY: 'auto',
                    }}>
                      <div style={{ padding: '0.3rem 0.5rem', borderBottom: `1px solid ${COLORS.border}` }}>
                        <input type="text" maxLength={3} placeholder="Type code..." value={iataCode}
                          onChange={(e) => setIataCode(e.target.value.toUpperCase())}
                          style={{
                            width: '100%', padding: '0.3rem 0.4rem', background: COLORS.input.bg,
                            border: `1px solid ${COLORS.input.border}`, borderRadius: '0.3rem',
                            color: COLORS.input.text, fontSize: '0.8rem', outline: 'none',
                          }}
                        />
                      </div>
                      {iataOptions.map(code => (
                        <div key={code}
                          onClick={() => { setIataCode(code); setShowIataDropdown(false); }}
                          style={{
                            padding: '0.4rem 0.65rem', cursor: 'pointer', fontSize: '0.78rem',
                            color: iataCode === code ? COLORS.blue : COLORS.text.primary,
                            background: iataCode === code ? 'rgba(59,130,246,0.1)' : 'transparent',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = iataCode === code ? 'rgba(59,130,246,0.1)' : 'transparent'}
                        >
                          {code}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <input type="text" maxLength={3} value={iataCode}
                  onChange={(e) => setIataCode(e.target.value.toUpperCase())}
                  style={{
                    width: '100%', padding: '0.7rem 0.75rem',
                    background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                    borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.9rem', outline: 'none',
                    textTransform: 'uppercase', fontWeight: '700',
                  }}
                />
              )}
            </div>

            <div style={{ flex: '0 0 150px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%', padding: '0.7rem 0.75rem',
                  background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                  borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.9rem', outline: 'none',
                }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>Title</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off"
                style={{
                  width: '100%', padding: '0.7rem 1rem',
                  background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                  borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.9rem', outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3"
              style={{
                width: '100%', padding: '0.7rem 1rem', resize: 'vertical',
                background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.85rem', outline: 'none', lineHeight: '1.5',
              }}
            />
          </div>

          {/* Permission & Pin */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.5rem' }}>Download Permission</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                  padding: '0.5rem 0.75rem', borderRadius: '0.4rem',
                  background: downloadPermission === 'admin_only' ? 'rgba(239,68,68,0.08)' : 'transparent',
                  border: `1px solid ${downloadPermission === 'admin_only' ? 'rgba(239,68,68,0.2)' : COLORS.border}`,
                }}>
                  <input type="radio" name="perm" value="admin_only" checked={downloadPermission === 'admin_only'} onChange={() => setDownloadPermission('admin_only')} style={{ accentColor: '#F87171' }} />
                  <Lock size={14} color="#F87171" />
                  <span style={{ fontSize: '0.8rem', color: downloadPermission === 'admin_only' ? '#F87171' : COLORS.text.secondary }}>Admin Only</span>
                </label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                  padding: '0.5rem 0.75rem', borderRadius: '0.4rem',
                  background: downloadPermission === 'all_branches' ? 'rgba(16,185,129,0.08)' : 'transparent',
                  border: `1px solid ${downloadPermission === 'all_branches' ? 'rgba(16,185,129,0.2)' : COLORS.border}`,
                }}>
                  <input type="radio" name="perm" value="all_branches" checked={downloadPermission === 'all_branches'} onChange={() => setDownloadPermission('all_branches')} style={{ accentColor: '#34D399' }} />
                  <Users size={14} color="#34D399" />
                  <span style={{ fontSize: '0.8rem', color: downloadPermission === 'all_branches' ? '#34D399' : COLORS.text.secondary }}>All Branches</span>
                </label>
              </div>
            </div>
            {isAdmin && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.5rem' }}>Display</label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                  padding: '0.5rem 0.75rem', borderRadius: '0.4rem',
                  background: pinned ? 'rgba(245,158,11,0.08)' : 'transparent',
                  border: `1px solid ${pinned ? 'rgba(245,158,11,0.2)' : COLORS.border}`,
                }}>
                  <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} style={{ accentColor: '#FBBF24' }} />
                  <Pin size={14} color="#FBBF24" style={{ transform: 'rotate(-45deg)' }} />
                  <span style={{ fontSize: '0.8rem', color: pinned ? '#FBBF24' : COLORS.text.secondary }}>Pin to Top</span>
                </label>
              </div>
            )}
          </div>

          {/* Existing + New Files */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>Attachments</label>
            {existingAttachments.map((f, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.5rem 0.75rem', marginBottom: '0.4rem',
                background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                  <Paperclip size={14} color={COLORS.text.light} />
                  <span style={{ fontSize: '0.8rem', color: COLORS.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ fontSize: '0.65rem', color: COLORS.text.light, flexShrink: 0 }}>({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button type="button" onClick={() => setExistingAttachments(existingAttachments.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', display: 'flex', padding: '0.15rem' }}>
                  <X size={16} />
                </button>
              </div>
            ))}
            {newFiles.map((f, i) => (
              <div key={`new-${i}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.5rem 0.75rem', marginBottom: '0.4rem',
                background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                  <UploadCloud size={14} color={COLORS.blue} />
                  <span style={{ fontSize: '0.8rem', color: COLORS.blue, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name} (new)</span>
                  <span style={{ fontSize: '0.65rem', color: COLORS.text.light, flexShrink: 0 }}>({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button type="button" onClick={() => setNewFiles(newFiles.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', display: 'flex', padding: '0.15rem' }}>
                  <X size={16} />
                </button>
              </div>
            ))}
            {/* Drag-and-drop zone + Add Files button */}
            <div
              style={{
                marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '1.25rem', border: `2px dashed ${isDragOver ? COLORS.blue : COLORS.border}`,
                borderRadius: '0.5rem', background: isDragOver ? 'rgba(59,130,246,0.08)' : COLORS.surfaceLight,
                cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
              }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); document.getElementById('edit-file-input')?.click(); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setIsDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
                const droppedFiles = Array.from(e.dataTransfer?.files || []);
                if (droppedFiles.length === 0) return;
                const validFiles = droppedFiles.filter(file => {
                  if (file.size > MAX_FILE_SIZE_BYTES) {
                    setError(`File "${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
                    return false;
                  }
                  return true;
                });
                if (validFiles.length > 0) {
                  setError('');
                  setNewFiles(prev => [...prev, ...validFiles]);
                }
              }}
            >
              <UploadCloud size={28} color={isDragOver ? COLORS.blue : COLORS.text.light} style={{ marginBottom: '0.35rem', transition: 'color 0.2s' }} />
              <p style={{ fontSize: '0.78rem', color: isDragOver ? COLORS.blue : COLORS.text.secondary, margin: 0, transition: 'color 0.2s' }}>
                {isDragOver ? 'Drop files here to add' : 'Click to browse or drag & drop files here'}
              </p>
              <p style={{ fontSize: '0.65rem', color: COLORS.text.light, margin: '0.15rem 0 0' }}>
                Max {MAX_FILE_SIZE_MB}MB per file
              </p>
              <input id="edit-file-input" type="file" multiple style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files).filter(f => {
                    if (f.size > MAX_FILE_SIZE_BYTES) {
                      setError(`File "${f.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
                      return false;
                    }
                    return true;
                  });
                  if (files.length > 0) setNewFiles(prev => [...prev, ...files]);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: `1px solid ${COLORS.border}` }}>
            <button type="button" onClick={() => navigate(`/document-library/doc/${id}`)}
              style={{
                padding: '0.6rem 1.25rem', border: `1px solid ${COLORS.border}`,
                borderRadius: '0.5rem', background: 'transparent', color: COLORS.text.secondary,
                cursor: 'pointer', fontSize: '0.85rem',
              }}>Cancel</button>
            <button type="submit" disabled={isSubmitting}
              style={{
                padding: '0.6rem 1.25rem', border: 'none', borderRadius: '0.5rem',
                background: isSubmitting ? COLORS.text.light : COLORS.accent,
                color: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem', fontWeight: '700',
              }}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
