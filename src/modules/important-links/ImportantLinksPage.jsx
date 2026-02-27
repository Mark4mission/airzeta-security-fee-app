import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../core/AuthContext';
import { Link2, Plus, Trash2, Edit, ExternalLink, Globe2, X, Save, Loader } from 'lucide-react';

const COLORS = {
  surface: '#132F4C', surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F', accent: '#E94560', blue: '#3B82F6',
  input: { bg: '#1A3A5C', border: '#2A5080', text: '#E8EAED' },
};

// Generate AI description using Gemini
async function generateLinkDescription(url, title) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return { en: 'Visit this resource for more information.', ko: '자세한 정보는 이 리소스를 방문하세요.' };

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a helpful assistant. Given this URL and title, write a brief 2-line description in English AND Korean. The site is likely related to aviation security, logistics, or regulatory compliance.

URL: ${url}
Title: ${title || url}

Return ONLY a JSON object (no code fences):
{"en": "English description (2 lines max)", "ko": "Korean description (2 lines max)"}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });

    let text = response.text.trim().replace(/^```[\w]*\s*\n?/gm, '').replace(/\n?\s*```\s*$/gm, '').trim();
    try {
      const parsed = JSON.parse(text);
      return { en: parsed.en || '', ko: parsed.ko || '' };
    } catch {
      return { en: text.substring(0, 150), ko: '' };
    }
  } catch (err) {
    console.error('[Links] AI error:', err);
    return { en: 'Visit this resource for more information.', ko: '자세한 정보는 이 리소스를 방문하세요.' };
  }
}

// Get favicon from Google's service
function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return null;
  }
}

export default function ImportantLinksPage() {
  const { isAdmin } = useAuth();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formUrl, setFormUrl] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescEn, setFormDescEn] = useState('');
  const [formDescKo, setFormDescKo] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const categories = [
    { value: 'regulatory', label: 'Regulatory', color: '#ef4444' },
    { value: 'training', label: 'Training', color: '#f59e0b' },
    { value: 'industry', label: 'Industry', color: '#3b82f6' },
    { value: 'tools', label: 'Tools', color: '#10b981' },
    { value: 'general', label: 'General', color: '#8b5cf6' },
  ];

  const loadLinks = async () => {
    try {
      const snap = await getDocs(collection(db, 'importantLinks'));
      setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) {
      console.error('[Links] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLinks(); }, []);

  const handleGenerateAI = async () => {
    if (!formUrl) return;
    setGenerating(true);
    const desc = await generateLinkDescription(formUrl, formTitle);
    setFormDescEn(desc.en);
    setFormDescKo(desc.ko);
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!formUrl.trim() || !formTitle.trim()) return;
    setSaving(true);
    try {
      const data = {
        url: formUrl.trim(),
        title: formTitle.trim(),
        descriptionEn: formDescEn.trim(),
        descriptionKo: formDescKo.trim(),
        category: formCategory,
        favicon: getFaviconUrl(formUrl),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'importantLinks', editingId), data);
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'importantLinks'), data);
      }
      resetForm();
      await loadLinks();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this link?')) return;
    await deleteDoc(doc(db, 'importantLinks', id));
    await loadLinks();
  };

  const handleEdit = (link) => {
    setEditingId(link.id);
    setFormUrl(link.url);
    setFormTitle(link.title);
    setFormDescEn(link.descriptionEn || '');
    setFormDescKo(link.descriptionKo || '');
    setFormCategory(link.category || 'general');
    setShowAddForm(true);
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormUrl(''); setFormTitle(''); setFormDescEn(''); setFormDescKo('');
    setFormCategory('general');
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: COLORS.text.secondary }}>Loading links...</div>;
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceLight} 100%)`,
        borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Link2 size={22} color="#8b5cf6" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>Important Links</h1>
            <p style={{ fontSize: '0.72rem', color: COLORS.text.secondary, margin: 0 }}>Curated resources for aviation cargo security professionals</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => { resetForm(); setShowAddForm(true); }} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem',
            background: 'rgba(59,130,246,0.12)', border: `1px solid rgba(59,130,246,0.3)`,
            borderRadius: '0.4rem', color: COLORS.blue, fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
          }}>
            <Plus size={14} /> Add Link
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div style={{
          background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.blue}`,
          padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
              {editingId ? 'Edit Link' : 'Add New Link'}
            </h3>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.text.light }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <input value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="URL (https://...)"
              style={{ padding: '0.5rem 0.7rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.4rem', color: COLORS.input.text, fontSize: '0.82rem' }} />
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Link Title"
              style={{ padding: '0.5rem 0.7rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.4rem', color: COLORS.input.text, fontSize: '0.82rem' }} />
          </div>
          <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.4rem', color: COLORS.input.text, fontSize: '0.78rem', width: 'fit-content' }}>
            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <textarea value={formDescEn} onChange={e => setFormDescEn(e.target.value)} placeholder="English description (2-3 lines)" rows={2}
              style={{ padding: '0.5rem 0.7rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.4rem', color: COLORS.input.text, fontSize: '0.78rem', resize: 'vertical' }} />
            <textarea value={formDescKo} onChange={e => setFormDescKo(e.target.value)} placeholder="Korean description (2-3 lines)" rows={2}
              style={{ padding: '0.5rem 0.7rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.4rem', color: COLORS.input.text, fontSize: '0.78rem', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button onClick={handleGenerateAI} disabled={generating || !formUrl} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.7rem',
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '0.35rem', color: '#34D399', fontSize: '0.72rem', fontWeight: '600',
              cursor: generating ? 'not-allowed' : 'pointer',
            }}>
              {generating ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Globe2 size={12} />}
              {generating ? 'Generating...' : 'AI Generate'}
            </button>
            <button onClick={handleSave} disabled={saving || !formUrl || !formTitle} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.7rem',
              background: COLORS.accent, border: 'none', borderRadius: '0.35rem',
              color: 'white', fontSize: '0.72rem', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer',
            }}>
              <Save size={12} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Links Grid */}
      {links.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: COLORS.text.light }}>
          <Link2 size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.2 }} />
          <p style={{ fontSize: '0.85rem' }}>No links added yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
          {links.map(link => {
            const cat = categories.find(c => c.value === link.category) || categories[4];
            return (
              <div key={link.id} style={{
                background: COLORS.surface, borderRadius: '0.75rem',
                border: `1px solid ${COLORS.border}`, overflow: 'hidden',
                transition: 'border-color 0.2s, transform 0.2s',
                cursor: 'pointer',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = 'none'; }}
              >
                {/* Category bar */}
                <div style={{ height: '3px', background: cat.color }} />
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                    {link.favicon && (
                      <img src={link.favicon} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#fff', flexShrink: 0 }}
                        onError={e => e.target.style.display = 'none'} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            fontSize: '0.9rem', fontWeight: '700', color: COLORS.text.primary,
                            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem',
                          }}>
                          {link.title} <ExternalLink size={12} color={COLORS.text.light} />
                        </a>
                        <span style={{
                          padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.55rem',
                          fontWeight: '700', background: `${cat.color}18`, color: cat.color,
                          border: `1px solid ${cat.color}35`, flexShrink: 0,
                        }}>{cat.label}</span>
                      </div>
                      {link.descriptionEn && (
                        <p style={{ fontSize: '0.75rem', color: COLORS.text.secondary, lineHeight: '1.5', margin: '0.35rem 0 0' }}>
                          {link.descriptionEn}
                        </p>
                      )}
                      {link.descriptionKo && (
                        <p style={{ fontSize: '0.72rem', color: COLORS.text.light, lineHeight: '1.5', margin: '0.15rem 0 0' }}>
                          {link.descriptionKo}
                        </p>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.5rem', borderTop: `1px solid ${COLORS.border}`, paddingTop: '0.4rem' }}>
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(link); }} style={{
                        display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'none', border: 'none',
                        color: COLORS.blue, fontSize: '0.65rem', cursor: 'pointer', padding: '0.15rem 0.3rem',
                      }}><Edit size={11} /> Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(link.id); }} style={{
                        display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'none', border: 'none',
                        color: '#F87171', fontSize: '0.65rem', cursor: 'pointer', padding: '0.15rem 0.3rem',
                      }}><Trash2 size={11} /> Delete</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
