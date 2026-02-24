import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ArrowLeft, Paperclip, X, UploadCloud, AlertCircle } from 'lucide-react';

const COLORS = {
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F',
  accent: '#E94560',
  blue: '#3B82F6',
  input: { bg: '#1A3A5C', border: '#2A5080', text: '#E8EAED' },
};

export default function PostWrite() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  const MAX_FILE_SIZE_MB = isAdmin ? 100 : 50;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  };

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

  const removeFile = (indexToRemove) => setFiles(files.filter((_, index) => index !== indexToRemove));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return setError('Title and content are required.');
    setIsSubmitting(true);
    setError('');
    const uploadedAttachments = [];

    try {
      if (storage) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const storageRef = ref(storage, `bulletin_attachments/${Date.now()}_${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);

          await new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
              (snapshot) => setUploadProgress(((i + (snapshot.bytesTransferred / snapshot.totalBytes)) / files.length) * 100),
              (err) => reject(err),
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                uploadedAttachments.push({ name: file.name, size: file.size, type: file.type, url: downloadURL });
                resolve();
              }
            );
          });
        }
      }

      const branchName = currentUser?.branchName || currentUser?.displayName || currentUser?.email || 'Unknown';
      const role = currentUser?.role || 'branch_user';

      await addDoc(collection(db, 'bulletinPosts'), {
        title: title.trim(),
        content: content,
        authorId: currentUser?.uid || 'unknown',
        authorName: branchName,
        authorRole: role,
        attachments: uploadedAttachments,
        acknowledgedBy: [],
        createdAt: serverTimestamp(),
      });
      navigate('/bulletin');
    } catch (err) {
      console.error(err);
      setError('Failed to post the directive: ' + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/bulletin')} style={{
          padding: '0.5rem', background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
          borderRadius: '0.5rem', cursor: 'pointer', color: COLORS.text.secondary, display: 'flex',
        }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
          New Security Directive
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

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>
              Directive Title
            </label>
            <input
              type="text" required value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
              style={{
                width: '100%', padding: '0.7rem 1rem',
                background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.9rem', outline: 'none',
              }}
            />
          </div>

          {/* Content */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>
              Content & Details
            </label>
            <div style={{ borderRadius: '0.5rem', overflow: 'hidden' }}>
              <ReactQuill theme="snow" value={content} onChange={setContent} modules={quillModules} style={{ height: '280px', marginBottom: '3rem' }} />
            </div>
          </div>

          {/* File upload */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>
              Attachments (Max {MAX_FILE_SIZE_MB}MB each)
            </label>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '1.5rem', border: `2px dashed ${COLORS.border}`, borderRadius: '0.5rem',
              background: COLORS.surfaceLight, cursor: 'pointer', transition: 'border-color 0.2s',
            }}
              onClick={() => document.getElementById('bulletin-file-input')?.click()}
            >
              <UploadCloud size={36} color={COLORS.text.light} style={{ marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.8rem', color: COLORS.text.secondary, margin: 0 }}>Drag & drop files here, or click to browse</p>
              <input id="bulletin-file-input" type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
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
              <button type="button" onClick={() => navigate('/bulletin')} disabled={isSubmitting}
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
                {isSubmitting ? 'Publishing...' : 'Publish Directive'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
