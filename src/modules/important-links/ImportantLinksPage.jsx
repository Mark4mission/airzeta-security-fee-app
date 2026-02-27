import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../core/AuthContext';
import { Link2, Plus, Trash2, Edit, ExternalLink, Globe2, X, Save, Loader, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';

const COLORS = {
  surface: '#132F4C', surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F', accent: '#E94560', blue: '#3B82F6',
  input: { bg: '#1A3A5C', border: '#2A5080', text: '#E8EAED' },
};

const CATEGORIES = [
  { value: 'regulatory', label: 'Regulatory & Compliance', color: '#ef4444', icon: '📋' },
  { value: 'training', label: 'Training & Education', color: '#f59e0b', icon: '🎓' },
  { value: 'industry', label: 'Industry & News', color: '#3b82f6', icon: '🌐' },
  { value: 'tools', label: 'Tools & Resources', color: '#10b981', icon: '🔧' },
  { value: 'general', label: 'General', color: '#8b5cf6', icon: '📌' },
];

// Enhanced AI: generates title, category, and descriptions from URL alone
async function generateLinkMetadata(url, existingTitle) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const categoryList = CATEGORIES.map(c => c.value).join(', ');
    const prompt = `You are an expert in aviation security and cargo logistics. Analyze the following URL and generate metadata for it.

URL: ${url}
${existingTitle ? `Current Title: ${existingTitle}` : ''}

Based on the URL structure, domain name, and your knowledge, generate:
1. A concise title (max 60 chars) if no title is provided
2. The best category from: ${categoryList}
3. A brief 2-sentence English description
4. A brief 2-sentence Korean description

Return ONLY a JSON object (no code fences, no extra text):
{"title": "Short descriptive title", "category": "one_of_categories", "en": "English description", "ko": "Korean description"}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });

    let text = response.text.trim().replace(/^```[\w]*\s*\n?/gm, '').replace(/\n?\s*```\s*$/gm, '').trim();
    try {
      const parsed = JSON.parse(text);
      return {
        title: parsed.title || '',
        category: CATEGORIES.some(c => c.value === parsed.category) ? parsed.category : 'general',
        en: parsed.en || '',
        ko: parsed.ko || '',
      };
    } catch {
      return null;
    }
  } catch (err) {
    console.error('[Links] AI error:', err);
    return null;
  }
}

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
  const [collapsedCategories, setCollapsedCategories] = useState({});

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

  // Group links by category
  const groupedLinks = useMemo(() => {
    const groups = {};
    CATEGORIES.forEach(cat => { groups[cat.value] = []; });
    links.forEach(link => {
      const cat = link.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(link);
    });
    // Return only non-empty groups, in category order
    return CATEGORIES.filter(cat => groups[cat.value].length > 0)
      .map(cat => ({ ...cat, links: groups[cat.value] }));
  }, [links]);

  // Enhanced AI generation: URL only → title + category + descriptions
  const handleGenerateAI = async () => {
    if (!formUrl) return;
    setGenerating(true);
    try {
      const result = await generateLinkMetadata(formUrl, formTitle);
      if (result) {
        if (!formTitle.trim() && result.title) setFormTitle(result.title);
        if (result.category) setFormCategory(result.category);
        if (result.en) setFormDescEn(result.en);
        if (result.ko) setFormDescKo(result.ko);
      }
    } catch (err) {
      console.error('[Links] AI generate error:', err);
    } finally {
      setGenerating(false);
    }
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

  const toggleCategory = (catValue) => {
    setCollapsedCategories(prev => ({ ...prev, [catValue]: !prev[catValue] }));
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
            <p style={{ fontSize: '0.72rem', color: COLORS.text.secondary, margin: 0 }}>
              Curated resources for aviation cargo security professionals — {links.length} link{links.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => { resetForm(); setShowAddForm(true); }} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem',
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
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

          {/* URL + AI Generate row */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="Paste URL here (https://...)"
              style={{ flex: 1, padding: '0.5rem 0.7rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.4rem', color: COLORS.input.text, fontSize: '0.82rem' }} />
            <button onClick={handleGenerateAI} disabled={generating || !formUrl}
              title="AI will auto-fill title, category, and descriptions from the URL"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.8rem',
                background: generating ? COLORS.surfaceLight : 'rgba(16,185,129,0.12)',
                border: `1px solid ${generating ? COLORS.border : 'rgba(16,185,129,0.3)'}`,
                borderRadius: '0.4rem', color: generating ? COLORS.text.light : '#34D399',
                fontSize: '0.75rem', fontWeight: '700', cursor: generating ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}>
              {generating ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
              {generating ? 'Analyzing...' : 'AI Auto-Fill'}
            </button>
          </div>
          <div style={{ fontSize: '0.6rem', color: COLORS.text.light, marginTop: '-0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Sparkles size={9} /> Paste a URL and click "AI Auto-Fill" — title, category, and descriptions are generated automatically
          </div>

          {/* Title + Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Link Title"
              style={{ padding: '0.5rem 0.7rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.4rem', color: COLORS.input.text, fontSize: '0.82rem' }} />
            <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.4rem', color: COLORS.input.text, fontSize: '0.78rem' }}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
          </div>

          {/* Descriptions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <textarea value={formDescEn} onChange={e => setFormDescEn(e.target.value)} placeholder="English description (2-3 sentences)" rows={2}
              style={{ padding: '0.5rem 0.7rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.4rem', color: COLORS.input.text, fontSize: '0.78rem', resize: 'vertical' }} />
            <textarea value={formDescKo} onChange={e => setFormDescKo(e.target.value)} placeholder="Korean description (2-3 sentences)" rows={2}
              style={{ padding: '0.5rem 0.7rem', background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`, borderRadius: '0.4rem', color: COLORS.input.text, fontSize: '0.78rem', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button onClick={resetForm} style={{
              padding: '0.35rem 0.7rem', background: 'transparent', border: `1px solid ${COLORS.border}`,
              borderRadius: '0.35rem', color: COLORS.text.secondary, fontSize: '0.72rem', cursor: 'pointer',
            }}>Cancel</button>
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

      {/* Links grouped by category */}
      {links.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: COLORS.text.light }}>
          <Link2 size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.2 }} />
          <p style={{ fontSize: '0.85rem' }}>No links added yet.</p>
          {isAdmin && <p style={{ fontSize: '0.72rem', color: COLORS.text.light }}>Click "Add Link" to get started.</p>}
        </div>
      ) : (
        groupedLinks.map(group => {
          const isCollapsed = collapsedCategories[group.value];
          return (
            <div key={group.value}>
              {/* Category header */}
              <button
                onClick={() => toggleCategory(group.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                  padding: '0.6rem 0.75rem', marginBottom: isCollapsed ? 0 : '0.6rem',
                  background: `${group.color}10`, border: `1px solid ${group.color}30`,
                  borderRadius: isCollapsed ? '0.5rem' : '0.5rem 0.5rem 0 0',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {isCollapsed ? <ChevronRight size={14} color={group.color} /> : <ChevronDown size={14} color={group.color} />}
                <span style={{ fontSize: '0.72rem', marginRight: '0.15rem' }}>{group.icon}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: group.color }}>{group.label}</span>
                <span style={{
                  padding: '0.1rem 0.4rem', borderRadius: '9999px', fontSize: '0.6rem',
                  fontWeight: '700', background: `${group.color}20`, color: group.color,
                  marginLeft: '0.25rem',
                }}>{group.links.length}</span>
              </button>

              {/* Link cards in this category */}
              {!isCollapsed && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  {group.links.map(link => (
                    <div key={link.id}
                      onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                      style={{
                        background: COLORS.surface, borderRadius: '0.5rem',
                        border: `1px solid ${COLORS.border}`, overflow: 'hidden',
                        transition: 'border-color 0.2s, transform 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = group.color; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = 'none'; }}
                    >
                      <div style={{ height: '2px', background: group.color }} />
                      <div style={{ padding: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          {link.favicon && (
                            <img src={link.favicon} alt="" style={{ width: '28px', height: '28px', borderRadius: '5px', background: '#fff', flexShrink: 0, marginTop: '1px' }}
                              onError={e => e.target.style.display = 'none'} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.85rem', fontWeight: '700', color: COLORS.text.primary,
                              display: 'flex', alignItems: 'center', gap: '0.3rem', lineHeight: '1.3',
                            }}>
                              {link.title} <ExternalLink size={11} color={COLORS.text.light} style={{ flexShrink: 0 }} />
                            </div>
                            {link.descriptionEn && (
                              <p style={{ fontSize: '0.72rem', color: COLORS.text.secondary, lineHeight: '1.5', margin: '0.3rem 0 0' }}>
                                {link.descriptionEn}
                              </p>
                            )}
                            {link.descriptionKo && (
                              <p style={{ fontSize: '0.7rem', color: '#9CA3AF', lineHeight: '1.5', margin: '0.2rem 0 0' }}>
                                {link.descriptionKo}
                              </p>
                            )}
                          </div>
                        </div>
                        {isAdmin && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.4rem', borderTop: `1px solid ${COLORS.border}`, paddingTop: '0.35rem' }}>
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(link); }} style={{
                              display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'none', border: 'none',
                              color: COLORS.blue, fontSize: '0.62rem', cursor: 'pointer', padding: '0.1rem 0.25rem',
                            }}><Edit size={10} /> Edit</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(link.id); }} style={{
                              display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'none', border: 'none',
                              color: '#F87171', fontSize: '0.62rem', cursor: 'pointer', padding: '0.1rem 0.25rem',
                            }}><Trash2 size={10} /> Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
