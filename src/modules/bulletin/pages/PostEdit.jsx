import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ArrowLeft, Paperclip, X, UploadCloud } from 'lucide-react';

const COLORS = {
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F',
  accent: '#E94560',
  blue: '#3B82F6',
  input: { bg: '#1A3A5C', border: '#2A5080', text: '#E8EAED' },
};

export default function PostEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  };

  useEffect(() => {
    getDoc(doc(db, 'bulletinPosts', id)).then(snap => {
      if (snap.exists()) {
        setTitle(snap.data().title);
        setContent(snap.data().content);
        setExistingAttachments(snap.data().attachments || []);
      } else navigate('/bulletin');
      setIsLoading(false);
    });
  }, [id, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const uploadedAttachments = [...existingAttachments];
    try {
      if (newFiles.length > 0 && storage) {
        for (let file of newFiles) {
          const storageRef = ref(storage, `bulletin_attachments/${Date.now()}_${file.name}`);
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
      await updateDoc(doc(db, 'bulletinPosts', id), { title, content, attachments: uploadedAttachments });
      navigate(`/bulletin/post/${id}`);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div style={{ padding: '3rem', textAlign: 'center', color: COLORS.text.secondary }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(`/bulletin/post/${id}`)} style={{
          padding: '0.5rem', background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
          borderRadius: '0.5rem', cursor: 'pointer', color: COLORS.text.secondary, display: 'flex',
        }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
          Edit Directive
        </h1>
      </div>

      {/* Form */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.5rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>Title</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%', padding: '0.7rem 1rem',
                background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.9rem', outline: 'none',
              }}
            />
          </div>

          {/* Content */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>Content</label>
            <ReactQuill theme="snow" value={content} onChange={setContent} modules={quillModules} style={{ height: '280px', marginBottom: '3rem' }} />
          </div>

          {/* Attachments */}
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
                </div>
                <button type="button" onClick={() => setNewFiles(newFiles.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', display: 'flex', padding: '0.15rem' }}>
                  <X size={16} />
                </button>
              </div>
            ))}
            <div style={{ marginTop: '0.5rem' }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.8rem', background: COLORS.surfaceLight,
                border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem',
                cursor: 'pointer', fontSize: '0.8rem', color: COLORS.text.secondary, fontWeight: '500',
              }}>
                <UploadCloud size={14} /> Add Files
                <input type="file" multiple style={{ display: 'none' }} onChange={(e) => setNewFiles([...newFiles, ...Array.from(e.target.files)])} />
              </label>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: `1px solid ${COLORS.border}` }}>
            <button type="button" onClick={() => navigate(`/bulletin/post/${id}`)}
              style={{
                padding: '0.6rem 1.25rem', border: `1px solid ${COLORS.border}`,
                borderRadius: '0.5rem', background: 'transparent', color: COLORS.text.secondary,
                cursor: 'pointer', fontSize: '0.85rem',
              }}>
              Cancel
            </button>
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
