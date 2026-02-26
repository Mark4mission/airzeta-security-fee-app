import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ArrowLeft, Paperclip, X, UploadCloud, Languages, Loader, ChevronDown, Code, Eye } from 'lucide-react';

const COLORS = {
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F',
  accent: '#E94560',
  blue: '#3B82F6',
  input: { bg: '#1A3A5C', border: '#2A5080', text: '#E8EAED' },
};

const LANGUAGE_OPTIONS = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'th', label: 'ไทย', flag: '🇹🇭' },
];

function detectLanguage(text) {
  if (!text) return 'en';
  const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  const koreanChars = (clean.match(/[\uAC00-\uD7A3]/g) || []).length;
  const total = clean.length || 1;
  if (koreanChars / total > 0.2) return 'ko';
  return 'en';
}

// Custom toolbar handler for horizontal rule
function insertHorizontalRule() {
  const quill = this.quill;
  const range = quill.getSelection(true);
  quill.insertText(range.index, '\n');
  quill.insertEmbed(range.index + 1, 'divider', true, 'user');
  quill.insertText(range.index + 2, '\n');
  quill.setSelection(range.index + 3);
}

function insertTable() {
  const quill = this.quill;
  const range = quill.getSelection(true);
  const tableHTML = '\n<table><thead><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td><td>Cell 3</td></tr><tr><td>Cell 4</td><td>Cell 5</td><td>Cell 6</td></tr></tbody></table>\n';
  quill.clipboard.dangerouslyPasteHTML(range.index, tableHTML, 'user');
}

function registerDividerBlot(Quill) {
  const BlockEmbed = Quill.import('blots/block/embed');
  class DividerBlot extends BlockEmbed {
    static blotName = 'divider';
    static tagName = 'hr';
  }
  Quill.register(DividerBlot, true);
}

export default function PostEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const quillRef = useRef(null);
  const quillRegistered = useRef(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Translation state
  const [translatedContent, setTranslatedContent] = useState('');
  const [translating, setTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [targetLang, setTargetLang] = useState('en');
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  // Markdown state
  const [markdownMode, setMarkdownMode] = useState(false);
  const [markdownSource, setMarkdownSource] = useState('');
  const [markdownPreview, setMarkdownPreview] = useState('');

  // Register custom blots
  if (!quillRegistered.current && typeof window !== 'undefined') {
    try {
      const Quill = ReactQuill.Quill || (typeof window !== 'undefined' && window.Quill);
      if (Quill) {
        registerDividerBlot(Quill);
        quillRegistered.current = true;
      }
    } catch (e) {
      console.warn('Failed to register custom blots:', e);
    }
  }

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'align': [] }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        ['hr-btn', 'table-btn'],
        ['clean']
      ],
      handlers: {
        'hr-btn': insertHorizontalRule,
        'table-btn': insertTable,
      }
    },
  }), []);

  const quillFormats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'list', 'bullet', 'align',
    'blockquote', 'code-block', 'link', 'image', 'divider',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ];

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

  // Markdown toggle
  const handleToggleMarkdown = useCallback(async () => {
    if (!markdownMode) {
      try {
        const TurndownService = (await import('turndown')).default;
        const td = new TurndownService({ headingStyle: 'atx', hr: '---', codeBlockStyle: 'fenced' });
        td.addRule('lineBreaks', { filter: 'br', replacement: () => '\n' });
        const md = td.turndown(content || '');
        setMarkdownSource(md);
        setMarkdownPreview(content);
      } catch {
        setMarkdownSource(content.replace(/<[^>]+>/g, ''));
      }
      setMarkdownMode(true);
    } else {
      try {
        const { marked } = await import('marked');
        marked.setOptions({ breaks: true, gfm: true });
        const html = marked(markdownSource);
        setContent(html);
        setMarkdownPreview('');
      } catch {
        setContent(markdownSource.replace(/\n/g, '<br>'));
      }
      setMarkdownMode(false);
    }
  }, [markdownMode, content, markdownSource]);

  const handleMarkdownChange = useCallback(async (value) => {
    setMarkdownSource(value);
    try {
      const { marked } = await import('marked');
      marked.setOptions({ breaks: true, gfm: true });
      setMarkdownPreview(marked(value));
    } catch {
      setMarkdownPreview(value.replace(/\n/g, '<br>'));
    }
  }, []);

  // ---- AI Translation ----
  const handleTranslate = async () => {
    const sourceText = markdownMode ? markdownSource : content;
    if (!sourceText || sourceText === '<p><br></p>') return;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError('AI Translation requires VITE_GEMINI_API_KEY.');
      return;
    }

    const detectedLang = detectLanguage(sourceText);
    if (detectedLang === targetLang) {
      setTargetLang(detectedLang === 'ko' ? 'en' : 'ko');
    }

    setTranslating(true);
    setShowTranslation(true);
    setError('');

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const plainText = (markdownMode ? markdownSource : content)
        .replace(/<\/p><p>/g, '\n\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      const actualTarget = detectedLang === targetLang
        ? (detectedLang === 'ko' ? 'en' : 'ko')
        : targetLang;
      const targetLabel = LANGUAGE_OPTIONS.find(l => l.code === actualTarget)?.label || 'English';

      const prompt = `You are a professional translator specializing in aviation, cargo logistics, and security domains.

TASK: Translate the following text to ${targetLabel}.

RULES:
- Maintain the original paragraph structure and line breaks exactly.
- Keep proper nouns, acronyms (ICAO, TSA, IATA, ETD, K9, CSD, DG, ACC3) unchanged.
- Use domain-accurate terminology for aviation cargo security.
- If the source text is already in ${targetLabel}, polish the grammar and improve clarity instead.
- Return ONLY the translated text. No explanations, no labels.

SOURCE TEXT:
${plainText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
      });

      const translated = response.text.trim();
      const htmlTranslated = translated
        .split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
      setTranslatedContent(htmlTranslated);
      if (detectedLang === targetLang) setTargetLang(actualTarget);
    } catch (err) {
      console.error('[Translation]', err);
      if (err.message?.includes('403') || err.message?.includes('blocked')) {
        setError('AI Translation failed: API key lacks permission.');
      } else {
        setError('Translation failed: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setTranslating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const finalContent = markdownMode ? markdownPreview || markdownSource : content;
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
      await updateDoc(doc(db, 'bulletinPosts', id), { title, content: finalContent, attachments: uploadedAttachments });
      navigate(`/bulletin/post/${id}`);
    } catch (err) {
      console.error(err);
      setError('Failed to save: ' + err.message);
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div style={{ padding: '3rem', textAlign: 'center', color: COLORS.text.secondary }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
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
          {error && (
            <div style={{
              color: '#F87171', background: 'rgba(239,68,68,0.1)',
              padding: '0.6rem 0.8rem', borderRadius: '0.4rem', fontSize: '0.8rem',
              border: '1px solid rgba(239,68,68,0.2)',
            }}>{error}</div>
          )}

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary, marginBottom: '0.4rem' }}>Title</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
              style={{
                width: '100%', padding: '0.7rem 1rem',
                background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.9rem', outline: 'none',
              }}
            />
          </div>

          {/* Content + Translation */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary }}>Content</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                {/* Markdown toggle */}
                <button type="button" onClick={handleToggleMarkdown}
                  title={markdownMode ? 'Switch to Rich Editor' : 'Switch to Markdown'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.3rem 0.55rem', background: markdownMode ? 'rgba(16,185,129,0.12)' : COLORS.surfaceLight,
                    border: `1px solid ${markdownMode ? 'rgba(16,185,129,0.3)' : COLORS.border}`,
                    borderRadius: '0.35rem', color: markdownMode ? '#34D399' : COLORS.text.secondary,
                    fontSize: '0.68rem', cursor: 'pointer', fontWeight: '600',
                  }}>
                  <Code size={11} />
                  {markdownMode ? 'Markdown ON' : 'Markdown'}
                </button>

                {/* Language selector */}
                <div style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setShowLangDropdown(!showLangDropdown)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.3rem 0.55rem', background: COLORS.surfaceLight,
                      border: `1px solid ${COLORS.border}`, borderRadius: '0.35rem',
                      color: COLORS.text.secondary, fontSize: '0.68rem', cursor: 'pointer',
                    }}>
                    {LANGUAGE_OPTIONS.find(l => l.code === targetLang)?.flag}{' '}
                    {LANGUAGE_OPTIONS.find(l => l.code === targetLang)?.label}
                    <ChevronDown size={11} />
                  </button>
                  {showLangDropdown && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: '0.25rem', zIndex: 50,
                      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                      borderRadius: '0.4rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', minWidth: '140px',
                      maxHeight: '200px', overflowY: 'auto',
                    }}>
                      {LANGUAGE_OPTIONS.map(lang => (
                        <div key={lang.code}
                          onClick={() => { setTargetLang(lang.code); setShowLangDropdown(false); }}
                          style={{
                            padding: '0.4rem 0.65rem', cursor: 'pointer', fontSize: '0.72rem',
                            color: targetLang === lang.code ? COLORS.blue : COLORS.text.primary,
                            background: targetLang === lang.code ? 'rgba(59,130,246,0.1)' : 'transparent',
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = targetLang === lang.code ? 'rgba(59,130,246,0.1)' : 'transparent'}
                        >
                          {lang.flag} {lang.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={handleTranslate}
                  disabled={translating || (!markdownMode && (!content || content === '<p><br></p>')) || (markdownMode && !markdownSource.trim())}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.3rem 0.6rem', background: translating ? COLORS.surfaceLight : 'rgba(59,130,246,0.12)',
                    border: `1px solid ${translating ? COLORS.border : 'rgba(59,130,246,0.3)'}`,
                    borderRadius: '0.35rem', color: translating ? COLORS.text.light : COLORS.blue,
                    fontSize: '0.7rem', fontWeight: '600', cursor: translating ? 'not-allowed' : 'pointer',
                  }}>
                  {translating ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Languages size={12} />}
                  {translating ? 'Translating...' : 'AI Translate'}
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex', gap: '0.75rem',
              flexDirection: showTranslation && translatedContent ? 'row' : 'column',
            }}>
              <div style={{
                flex: showTranslation && translatedContent ? '1 1 50%' : '1 1 100%',
                borderRadius: '0.5rem', overflow: 'hidden', minWidth: 0,
              }}>
                {showTranslation && translatedContent && (
                  <div style={{
                    padding: '0.3rem 0.6rem', background: 'rgba(59,130,246,0.08)',
                    borderBottom: `1px solid ${COLORS.border}`, fontSize: '0.65rem',
                    fontWeight: '600', color: COLORS.blue,
                  }}>Original</div>
                )}

                {markdownMode ? (
                  <div style={{ display: 'flex', gap: '0.5rem', minHeight: '340px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        padding: '0.25rem 0.5rem', background: COLORS.surfaceLight,
                        borderBottom: `1px solid ${COLORS.border}`, fontSize: '0.6rem',
                        fontWeight: '600', color: COLORS.text.light,
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                      }}>
                        <Code size={10} /> Markdown Source
                      </div>
                      <textarea
                        value={markdownSource}
                        onChange={(e) => handleMarkdownChange(e.target.value)}
                        spellCheck={false}
                        style={{
                          flex: 1, padding: '0.75rem', resize: 'none',
                          background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                          borderTop: 'none', color: COLORS.input.text,
                          fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: '1.6',
                          outline: 'none', minHeight: '280px',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: `1px solid ${COLORS.border}`, borderRadius: '0.35rem', overflow: 'hidden' }}>
                      <div style={{
                        padding: '0.25rem 0.5rem', background: 'rgba(16,185,129,0.08)',
                        borderBottom: `1px solid ${COLORS.border}`, fontSize: '0.6rem',
                        fontWeight: '600', color: '#34D399',
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                      }}>
                        <Eye size={10} /> Preview
                      </div>
                      <div
                        className="ql-editor bulletin-content"
                        style={{
                          flex: 1, padding: '0.75rem', color: COLORS.text.primary,
                          fontSize: '0.85rem', lineHeight: '1.7', overflowY: 'auto',
                          background: COLORS.surfaceLight, minHeight: '280px',
                        }}
                        dangerouslySetInnerHTML={{ __html: markdownPreview }}
                      />
                    </div>
                  </div>
                ) : (
                  <ReactQuill ref={quillRef} theme="snow" value={content} onChange={setContent}
                    modules={quillModules} formats={quillFormats}
                    style={{ height: '280px', marginBottom: '3rem' }} />
                )}
              </div>

              {showTranslation && translatedContent && (
                <div style={{
                  flex: '1 1 50%', borderRadius: '0.5rem', overflow: 'hidden', minWidth: 0,
                  border: `1px solid ${COLORS.border}`, background: COLORS.surfaceLight,
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{
                    padding: '0.3rem 0.6rem', background: 'rgba(16,185,129,0.08)',
                    borderBottom: `1px solid ${COLORS.border}`, fontSize: '0.65rem',
                    fontWeight: '600', color: '#34D399',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>
                      {LANGUAGE_OPTIONS.find(l => l.code === targetLang)?.flag}{' '}
                      AI Translation ({LANGUAGE_OPTIONS.find(l => l.code === targetLang)?.label})
                    </span>
                    <button type="button" onClick={() => { setShowTranslation(false); setTranslatedContent(''); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.text.light, padding: '0.1rem', display: 'flex' }}>
                      <X size={13} />
                    </button>
                  </div>
                  <div className="ql-editor bulletin-content"
                    style={{
                      padding: '0.75rem', color: COLORS.text.primary, fontSize: '0.85rem',
                      lineHeight: '1.7', overflowY: 'auto', flex: 1,
                      minHeight: markdownMode ? '280px' : '280px',
                      marginBottom: markdownMode ? 0 : '3rem',
                    }}
                    dangerouslySetInnerHTML={{ __html: translatedContent }} />
                </div>
              )}
            </div>
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
