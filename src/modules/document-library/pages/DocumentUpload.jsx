import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import { ArrowLeft, UploadCloud, AlertCircle, X, Paperclip, Pin, Lock, Users, ChevronDown } from 'lucide-react';

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

export default function DocumentUpload() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [iataCode, setIataCode] = useState('');
  const [downloadPermission, setDownloadPermission] = useState('all_branches');
  const [pinned, setPinned] = useState(false);
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [allBranches, setAllBranches] = useState([]);
  const [showIataDropdown, setShowIataDropdown] = useState(false);

  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  const branchName = currentUser?.branchName || currentUser?.displayName || 'HQ';

  // Extract IATA code from branch name (first 3 chars)
  useEffect(() => {
    if (branchName && branchName.length >= 3 && !isAdmin) {
      setIataCode(branchName.substring(0, 3).toUpperCase());
    }
  }, [branchName, isAdmin]);

  // Load branches for admin IATA selector
  useEffect(() => {
    if (isAdmin) {
      getDocs(collection(db, 'branchCodes')).then(snap => {
        const branches = snap.docs.map(d => d.id);
        setAllBranches(branches);
        if (branches.length > 0 && !iataCode) {
          setIataCode(branches[0].substring(0, 3).toUpperCase());
        }
      });
    }
  }, [isAdmin]);

  const handleFileChange = (e) => {
    setError('');
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(file => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => setFiles(files.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      return setError('Title is required.');
    }
    if (files.length === 0) {
      return setError('Please attach at least one file.');
    }

    setIsSubmitting(true);
    setError('');
    const uploadedAttachments = [];

    try {
      if (storage) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const storageRef = ref(storage, `document_library/${Date.now()}_${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);

          await new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
              (snapshot) => setUploadProgress(((i + (snapshot.bytesTransferred / snapshot.totalBytes)) / files.length) * 100),
              (err) => reject(err),
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                uploadedAttachments.push({
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  url: downloadURL,
                });
                resolve();
              }
            );
          });
        }
      }

      await addDoc(collection(db, 'documentLibrary'), {
        title: title.trim(),
        description: description.trim(),
        category,
        iataCode: iataCode.toUpperCase(),
        downloadPermission,
        pinned: isAdmin ? pinned : false,
        attachments: uploadedAttachments,
        uploaderId: currentUser?.uid || 'unknown',
        uploaderEmail: currentUser?.email || '',
        uploaderBranch: branchName,
        uploaderRole: currentUser?.role || 'branch_user',
        downloadCount: 0,
        downloadLog: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      navigate('/document-library');
    } catch (err) {
      console.error('[DocUpload]', err);
      setError('Failed to upload document: ' + err.message);
      setIsSubmitting(false);
    }
  };

  // Unique IATA codes from branches
  const iataOptions = [...new Set(allBranches.map(b => b.substring(0, 3).toUpperCase()))].sort();

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/document-library')} style={{
          padding: '0.5rem', background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
          borderRadius: '0.5rem', cursor: 'pointer', color: COLORS.text.secondary, display: 'flex',
        }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
          Upload Document
        </h1>
      </div>

      {/* Form */}
      <div style={{
        background: COLORS.surface, borderRadius: '0.75rem',
        border: `1px solid ${COLORS.border}`, overflow: 'hidden',
      }}>
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
            {/* IATA Code Selector */}
            <div style={{ flex: '0 0 120px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>
                IATA Code
              </label>
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
                      {/* Manual input */}
                      <div style={{ padding: '0.3rem 0.5rem', borderBottom: `1px solid ${COLORS.border}` }}>
                        <input
                          type="text" maxLength={3} placeholder="Type code..."
                          value={iataCode}
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
                <input
                  type="text" maxLength={3} value={iataCode}
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

            {/* Category */}
            <div style={{ flex: '0 0 150px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%', padding: '0.7rem 0.75rem',
                  background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                  borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.9rem', outline: 'none',
                }}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Title */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>
                Document Title
              </label>
              <input
                type="text" required value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
                autoComplete="off"
                style={{
                  width: '100%', padding: '0.7rem 1rem',
                  background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                  borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.9rem', outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Title preview */}
          {(iataCode || title) && (
            <div style={{
              padding: '0.5rem 0.75rem', background: 'rgba(59,130,246,0.05)',
              border: `1px solid rgba(59,130,246,0.1)`, borderRadius: '0.4rem',
              fontSize: '0.78rem', color: COLORS.text.secondary,
            }}>
              Preview: <strong style={{ color: COLORS.blue }}>[{iataCode || '???'}]</strong>{' '}
              <span style={{ color: COLORS.text.light }}>({category})</span>{' '}
              <span style={{ color: COLORS.text.primary }}>{title || '...'}</span>
            </div>
          )}

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the document..."
              rows="3"
              style={{
                width: '100%', padding: '0.7rem 1rem', resize: 'vertical',
                background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.85rem', outline: 'none',
                lineHeight: '1.5',
              }}
            />
          </div>

          {/* Permission & Pin Options */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Download Permission */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.5rem' }}>
                Download Permission
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                  padding: '0.5rem 0.75rem', borderRadius: '0.4rem',
                  background: downloadPermission === 'admin_only' ? 'rgba(239,68,68,0.08)' : 'transparent',
                  border: `1px solid ${downloadPermission === 'admin_only' ? 'rgba(239,68,68,0.2)' : COLORS.border}`,
                }}>
                  <input type="radio" name="permission" value="admin_only"
                    checked={downloadPermission === 'admin_only'}
                    onChange={() => setDownloadPermission('admin_only')}
                    style={{ accentColor: '#F87171' }}
                  />
                  <Lock size={14} color="#F87171" />
                  <span style={{ fontSize: '0.8rem', color: downloadPermission === 'admin_only' ? '#F87171' : COLORS.text.secondary }}>
                    Admin Only
                  </span>
                </label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                  padding: '0.5rem 0.75rem', borderRadius: '0.4rem',
                  background: downloadPermission === 'all_branches' ? 'rgba(16,185,129,0.08)' : 'transparent',
                  border: `1px solid ${downloadPermission === 'all_branches' ? 'rgba(16,185,129,0.2)' : COLORS.border}`,
                }}>
                  <input type="radio" name="permission" value="all_branches"
                    checked={downloadPermission === 'all_branches'}
                    onChange={() => setDownloadPermission('all_branches')}
                    style={{ accentColor: '#34D399' }}
                  />
                  <Users size={14} color="#34D399" />
                  <span style={{ fontSize: '0.8rem', color: downloadPermission === 'all_branches' ? '#34D399' : COLORS.text.secondary }}>
                    All Branches
                  </span>
                </label>
              </div>
              <p style={{ fontSize: '0.68rem', color: COLORS.text.light, marginTop: '0.3rem', marginLeft: '0.25rem' }}>
                Uploader's branch ({branchName}) always has access.
              </p>
            </div>

            {/* Pin to Top (Admin only) */}
            {isAdmin && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.5rem' }}>
                  Display Option
                </label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                  padding: '0.5rem 0.75rem', borderRadius: '0.4rem',
                  background: pinned ? 'rgba(245,158,11,0.08)' : 'transparent',
                  border: `1px solid ${pinned ? 'rgba(245,158,11,0.2)' : COLORS.border}`,
                }}>
                  <input type="checkbox" checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    style={{ accentColor: '#FBBF24' }}
                  />
                  <Pin size={14} color="#FBBF24" style={{ transform: 'rotate(-45deg)' }} />
                  <span style={{ fontSize: '0.8rem', color: pinned ? '#FBBF24' : COLORS.text.secondary }}>
                    Pin to Top
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>
              Files (Max {MAX_FILE_SIZE_MB}MB each)
            </label>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '1.5rem', border: `2px dashed ${COLORS.border}`, borderRadius: '0.5rem',
              background: COLORS.surfaceLight, cursor: 'pointer', transition: 'border-color 0.2s',
            }}
              onClick={() => document.getElementById('doc-file-input')?.click()}
            >
              <UploadCloud size={36} color={COLORS.text.light} style={{ marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.8rem', color: COLORS.text.secondary, margin: 0 }}>
                Click to browse or drag & drop files here
              </p>
              <p style={{ fontSize: '0.68rem', color: COLORS.text.light, margin: '0.2rem 0 0' }}>
                PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ZIP, images...
              </p>
              <input id="doc-file-input" type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
            {files.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {files.map((file, index) => (
                  <li key={index} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem', background: COLORS.surfaceLight,
                    border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                      <Paperclip size={16} color={COLORS.text.light} />
                      <span style={{ fontSize: '0.8rem', color: COLORS.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                      <span style={{ fontSize: '0.65rem', color: COLORS.text.light, flexShrink: 0 }}>({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                    <button type="button" onClick={() => removeFile(index)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '0.15rem',
                      color: COLORS.text.light, display: 'flex',
                    }}>
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Submit */}
          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '1rem' }}>
            {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                  <span>Uploading...</span><span>{Math.round(uploadProgress)}%</span>
                </div>
                <div style={{ width: '100%', background: COLORS.surfaceLight, borderRadius: '9999px', height: '6px' }}>
                  <div style={{ width: `${uploadProgress}%`, background: COLORS.blue, height: '6px', borderRadius: '9999px', transition: 'width 0.3s' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={() => navigate('/document-library')} disabled={isSubmitting}
                style={{
                  padding: '0.6rem 1.25rem', border: `1px solid ${COLORS.border}`,
                  borderRadius: '0.5rem', background: 'transparent', color: COLORS.text.secondary,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '500',
                }}>
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}
                style={{
                  padding: '0.6rem 1.25rem', border: 'none', borderRadius: '0.5rem',
                  background: isSubmitting ? COLORS.text.light : COLORS.accent,
                  color: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem', fontWeight: '700',
                  boxShadow: '0 2px 8px rgba(233,69,96,0.25)',
                }}>
                {isSubmitting ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
