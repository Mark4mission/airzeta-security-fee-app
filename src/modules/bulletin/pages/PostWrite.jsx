import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ArrowLeft, Paperclip, X, UploadCloud, AlertCircle, Languages, Loader, ChevronDown, Minus, Table, Code, Eye, EyeOff } from 'lucide-react';

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
  { code: 'ko', label: '\uD55C\uAD6D\uC5B4', flag: '\uD83C\uDDF0\uD83C\uDDF7' },
  { code: 'en', label: 'English', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
  { code: 'ja', label: '\u65E5\u672C\u8A9E', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
  { code: 'zh', label: '\u4E2D\u6587', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
  { code: 'de', label: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
  { code: 'fr', label: 'Fran\u00E7ais', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { code: 'es', label: 'Espa\u00F1ol', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
  { code: 'ar', label: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', flag: '\uD83C\uDDF8\uD83C\uDDE6' },
  { code: 'th', label: '\u0E44\u0E17\u0E22', flag: '\uD83C\uDDF9\uD83C\uDDED' },
  { code: 'vi', label: 'Ti\u1EBFng Vi\u1EC7t', flag: '\uD83C\uDDFB\uD83C\uDDF3' },
];

// Detect primary language of text
function detectLanguage(text) {
  if (!text) return 'en';
  const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  const koreanChars = (clean.match(/[\uAC00-\uD7A3]/g) || []).length;
  const total = clean.length || 1;
  if (koreanChars / total > 0.2) return 'ko';
  return 'en';
}

export default function PostWrite() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  // Translation state
  const [translatedContent, setTranslatedContent] = useState('');
  const [translating, setTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [targetLang, setTargetLang] = useState('en');
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  // Markdown state
  const [markdownMode, setMarkdownMode] = useState(false);
  const [markdownText, setMarkdownText] = useState('');
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  // Table insert dialog
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const quillRef = useRef(null);

  const MAX_FILE_SIZE_MB = isAdmin ? 100 : 50;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  // Auto-detect language and suggest target
  useEffect(() => {
    if (!content || content === '<p><br></p>') return;
    const detected = detectLanguage(content);
    if (detected === 'ko' && targetLang === 'ko') setTargetLang('en');
    else if (detected === 'en' && targetLang === 'en') setTargetLang('ko');
  }, [content]);

  // ---- Custom toolbar handlers ----
  const insertHorizontalRule = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = quill.getSelection(true);
    quill.insertText(range.index, '\n');
    quill.insertEmbed(range.index + 1, 'divider', true);
    quill.insertText(range.index + 2, '\n');
    quill.setSelection(range.index + 3, 0);
  }, []);

  const insertTable = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = quill.getSelection(true);
    // Build HTML table
    let tableHTML = '<table><thead><tr>';
    for (let c = 0; c < tableCols; c++) tableHTML += `<th>Header ${c + 1}</th>`;
    tableHTML += '</tr></thead><tbody>';
    for (let r = 0; r < tableRows; r++) {
      tableHTML += '<tr>';
      for (let c = 0; c < tableCols; c++) tableHTML += '<td>&nbsp;</td>';
      tableHTML += '</tr>';
    }
    tableHTML += '</tbody></table>';
    quill.clipboard.dangerouslyPasteHTML(range.index, tableHTML);
    setShowTableDialog(false);
  }, [tableRows, tableCols]);

  // ---- Quill modules with custom handlers ----
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
        ['divider'],
        ['clean']
      ],
      handlers: {
        'divider': function() {
          // Will be overridden after mount
        }
      }
    },
    clipboard: {
      matchVisual: false,  // Preserve line breaks on paste
    },
  }), []);

  // Register custom Quill blot for divider
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    // Override the divider handler
    const toolbar = quill.getModule('toolbar');
    if (toolbar) {
      toolbar.addHandler('divider', () => {
        const range = quill.getSelection(true);
        if (range) {
          quill.insertText(range.index, '\n');
          quill.clipboard.dangerouslyPasteHTML(range.index + 1, '<hr>');
          quill.setSelection(range.index + 2, 0);
        }
      });
    }

    // Style the custom divider button in toolbar
    const toolbarEl = quill.container?.previousSibling;
    if (toolbarEl) {
      const dividerBtn = toolbarEl.querySelector('.ql-divider');
      if (dividerBtn) {
        dividerBtn.innerHTML = '<svg viewBox="0 0 18 18" style="width:18px;height:18px;"><line x1="1" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="2"/></svg>';
        dividerBtn.title = 'Horizontal Rule';
      }
    }
  }, []);

  const quillFormats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'list', 'bullet', 'align',
    'blockquote', 'code-block', 'link', 'image',
    'table', 'divider',
  ];

  // ---- Markdown conversion ----
  const convertMarkdownToHTML = useCallback(async (md) => {
    try {
      const { marked } = await import('marked');
      marked.setOptions({
        breaks: true,
        gfm: true,
      });
      return marked.parse(md);
    } catch {
      return md.replace(/\n/g, '<br>');
    }
  }, []);

  const convertHTMLToMarkdown = useCallback(async (html) => {
    try {
      const TurndownService = (await import('turndown')).default;
      const td = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
      });
      // Preserve tables
      td.addRule('table', {
        filter: ['table'],
        replacement: function(content, node) {
          return '\n' + node.outerHTML + '\n';
        }
      });
      return td.turndown(html);
    } catch {
      return html.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '');
    }
  }, []);

  const handleToggleMarkdown = useCallback(async () => {
    if (!markdownMode) {
      // Switching TO markdown mode - convert HTML to markdown
      const md = await convertHTMLToMarkdown(content);
      setMarkdownText(md);
    } else {
      // Switching BACK to rich text - convert markdown to HTML
      const html = await convertMarkdownToHTML(markdownText);
      setContent(html);
    }
    setMarkdownMode(!markdownMode);
    setShowMarkdownPreview(false);
  }, [markdownMode, content, markdownText, convertHTMLToMarkdown, convertMarkdownToHTML]);

  // ---- AI Translation ----
  const handleTranslate = async () => {
    const textToTranslate = markdownMode ? markdownText : content;
    if (!textToTranslate || textToTranslate === '<p><br></p>') return;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError('AI Translation requires VITE_GEMINI_API_KEY. Please configure it in environment variables.');
      return;
    }

    setTranslating(true);
    setShowTranslation(true);
    setError('');

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      // Strip HTML for translation but keep structure
      const plainText = markdownMode ? markdownText : content
        .replace(/<\/p><p>/g, '\n\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      const targetLabel = LANGUAGE_OPTIONS.find(l => l.code === targetLang)?.label || 'English';

      const prompt = `You are a professional translator specializing in aviation, cargo logistics, and security domains.

TASK: Translate the following text to ${targetLabel}.

RULES:
- Maintain the original paragraph structure exactly. Keep blank lines between paragraphs.
- Keep proper nouns, acronyms (ICAO, TSA, IATA, ETD, K9, CSD, DG, ACC3) unchanged.
- Use domain-accurate terminology for aviation cargo security.
- If the source text is already in ${targetLabel}, polish the grammar and improve clarity instead.
- Return ONLY the translated text, preserving all paragraph breaks as blank lines.
- Do NOT wrap the output in JSON, code fences, or any markup.

SOURCE TEXT:
${plainText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
      });

      let translated = response.text.trim();

      // ---- Robust parsing: handle any AI response format ----
      // 1. Strip ALL markdown code fences (```json, ```, etc.)
      translated = translated.replace(/^```[\w]*\s*\n?/gm, '').replace(/\n?\s*```\s*$/gm, '').trim();

      // 2. Try to extract from JSON if AI returned JSON despite instructions
      try {
        const parsed = JSON.parse(translated);
        if (parsed && typeof parsed === 'object') {
          translated = parsed.content || parsed.translation || parsed.text || JSON.stringify(parsed);
        }
      } catch {}

      // 3. Also try to find JSON embedded in the response
      if (translated.includes('"content"')) {
        const jsonMatch = translated.match(/\{[\s\S]*?"content"\s*:\s*"([\s\S]*?)"[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.content) translated = parsed.content;
          } catch {}
        }
      }

      // 4. Normalize: replace literal escaped \n strings with real newlines
      translated = translated.replace(/\\n/g, '\n');
      // Fix escaped underscores
      translated = translated.replace(/\\_/g, '_');
      // Remove leading labels like "Translation:" or "번역:"
      translated = translated.replace(/^(?:Translation|Translated text|번역|翻訳)\s*:\s*/i, '').trim();

      // 5. Convert plain text with newlines to HTML paragraphs
      const htmlTranslated = translated
        .split(/\n\s*\n/)
        .filter(p => p.trim())
        .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
        .join('');
      setTranslatedContent(htmlTranslated);
    } catch (err) {
      console.error('[Translation]', err);
      if (err.message?.includes('403') || err.message?.includes('blocked')) {
        setError('AI Translation failed: API key lacks permission. Create a Gemini key at aistudio.google.com/apikey');
      } else {
        setError('Translation failed: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setTranslating(false);
    }
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

    // Determine final content
    let finalContent = content;
    if (markdownMode) {
      finalContent = await convertMarkdownToHTML(markdownText);
    }

    if (!title.trim() || !finalContent.trim() || finalContent === '<p><br></p>') {
      return setError('Title and content are required.');
    }

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
        content: finalContent,
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

  // ---- Markdown preview rendering ----
  const [markdownPreviewHTML, setMarkdownPreviewHTML] = useState('');
  useEffect(() => {
    if (showMarkdownPreview && markdownMode && markdownText) {
      convertMarkdownToHTML(markdownText).then(setMarkdownPreviewHTML);
    }
  }, [showMarkdownPreview, markdownText, markdownMode, convertMarkdownToHTML]);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
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
              autoComplete="off"
              style={{
                width: '100%', padding: '0.7rem 1rem',
                background: COLORS.input.bg, border: `1px solid ${COLORS.input.border}`,
                borderRadius: '0.5rem', color: COLORS.input.text, fontSize: '0.9rem', outline: 'none',
              }}
            />
          </div>

          {/* Content editor area */}
          <div>
            {/* Editor toolbar row */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem',
              flexWrap: 'wrap', gap: '0.4rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: COLORS.text.secondary }}>
                  Content & Details
                </label>
                {/* Custom action buttons */}
                {!markdownMode && (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {/* Insert HR button */}
                    <button type="button" title="Insert Horizontal Rule"
                      onClick={() => {
                        const quill = quillRef.current?.getEditor();
                        if (quill) {
                          const range = quill.getSelection(true);
                          quill.clipboard.dangerouslyPasteHTML(range.index, '<hr>');
                          quill.setSelection(range.index + 1, 0);
                        }
                      }}
                      style={{
                        padding: '0.2rem 0.4rem', background: COLORS.surfaceLight,
                        border: `1px solid ${COLORS.border}`, borderRadius: '0.25rem',
                        color: COLORS.text.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center',
                      }}>
                      <Minus size={14} />
                    </button>
                    {/* Insert Table button */}
                    <div style={{ position: 'relative' }}>
                      <button type="button" title="Insert Table"
                        onClick={() => setShowTableDialog(!showTableDialog)}
                        style={{
                          padding: '0.2rem 0.4rem', background: COLORS.surfaceLight,
                          border: `1px solid ${COLORS.border}`, borderRadius: '0.25rem',
                          color: COLORS.text.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center',
                        }}>
                        <Table size={14} />
                      </button>
                      {showTableDialog && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, marginTop: '0.25rem', zIndex: 50,
                          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                          borderRadius: '0.5rem', padding: '0.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                          minWidth: '180px',
                        }}>
                          <p style={{ fontSize: '0.7rem', fontWeight: '600', color: COLORS.text.secondary, margin: '0 0 0.5rem' }}>
                            Insert Table
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.68rem', color: COLORS.text.secondary }}>Rows</label>
                            <input type="number" min="1" max="20" value={tableRows}
                              onChange={e => setTableRows(Math.min(20, Math.max(1, +e.target.value)))}
                              style={{
                                width: '3rem', padding: '0.2rem 0.3rem', background: COLORS.input.bg,
                                border: `1px solid ${COLORS.input.border}`, borderRadius: '0.25rem',
                                color: COLORS.input.text, fontSize: '0.75rem', textAlign: 'center',
                              }}
                            />
                            <label style={{ fontSize: '0.68rem', color: COLORS.text.secondary }}>Cols</label>
                            <input type="number" min="1" max="10" value={tableCols}
                              onChange={e => setTableCols(Math.min(10, Math.max(1, +e.target.value)))}
                              style={{
                                width: '3rem', padding: '0.2rem 0.3rem', background: COLORS.input.bg,
                                border: `1px solid ${COLORS.input.border}`, borderRadius: '0.25rem',
                                color: COLORS.input.text, fontSize: '0.75rem', textAlign: 'center',
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button type="button" onClick={insertTable}
                              style={{
                                padding: '0.25rem 0.6rem', background: COLORS.blue, color: '#fff',
                                border: 'none', borderRadius: '0.25rem', fontSize: '0.7rem',
                                fontWeight: '600', cursor: 'pointer',
                              }}>Insert</button>
                            <button type="button" onClick={() => setShowTableDialog(false)}
                              style={{
                                padding: '0.25rem 0.6rem', background: 'transparent',
                                color: COLORS.text.secondary, border: `1px solid ${COLORS.border}`,
                                borderRadius: '0.25rem', fontSize: '0.7rem', cursor: 'pointer',
                              }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right side: Markdown toggle + Translation controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {/* Markdown toggle */}
                <button type="button" onClick={handleToggleMarkdown}
                  title={markdownMode ? 'Switch to Rich Text' : 'Switch to Markdown'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.3rem 0.55rem',
                    background: markdownMode ? 'rgba(16,185,129,0.12)' : COLORS.surfaceLight,
                    border: `1px solid ${markdownMode ? 'rgba(16,185,129,0.3)' : COLORS.border}`,
                    borderRadius: '0.35rem',
                    color: markdownMode ? '#34D399' : COLORS.text.secondary,
                    fontSize: '0.68rem', fontWeight: '600', cursor: 'pointer',
                  }}>
                  <Code size={12} />
                  {markdownMode ? 'MD ON' : 'MD'}
                </button>

                {/* Markdown preview toggle */}
                {markdownMode && (
                  <button type="button" onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
                    title={showMarkdownPreview ? 'Hide Preview' : 'Show Preview'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.2rem',
                      padding: '0.3rem 0.45rem', background: COLORS.surfaceLight,
                      border: `1px solid ${COLORS.border}`, borderRadius: '0.35rem',
                      color: COLORS.text.secondary, fontSize: '0.68rem', cursor: 'pointer',
                    }}>
                    {showMarkdownPreview ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                )}

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

                {/* Translate button */}
                <button type="button" onClick={handleTranslate}
                  disabled={translating || (!content && !markdownText) || content === '<p><br></p>'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.3rem 0.6rem',
                    background: translating ? COLORS.surfaceLight : 'rgba(59,130,246,0.12)',
                    border: `1px solid ${translating ? COLORS.border : 'rgba(59,130,246,0.3)'}`,
                    borderRadius: '0.35rem', color: translating ? COLORS.text.light : COLORS.blue,
                    fontSize: '0.7rem', fontWeight: '600', cursor: translating ? 'not-allowed' : 'pointer',
                  }}>
                  {translating ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Languages size={12} />}
                  {translating ? 'Translating...' : 'AI Translate'}
                </button>
              </div>
            </div>

            {/* Editor area - side by side when translation is shown */}
            <div style={{
              display: 'flex', gap: '0.75rem',
              flexDirection: showTranslation && translatedContent ? 'row' : 'column',
              alignItems: showTranslation && translatedContent ? 'stretch' : undefined,
              minHeight: showTranslation && translatedContent ? '400px' : undefined,
            }}>
              {/* Original editor */}
              <div style={{
                flex: showTranslation && translatedContent ? '1 1 50%' : '1 1 100%',
                borderRadius: '0.5rem', overflow: 'hidden', minWidth: 0,
                display: 'flex', flexDirection: 'column',
              }}>
                {showTranslation && translatedContent && (
                  <div style={{
                    padding: '0.3rem 0.6rem', background: 'rgba(59,130,246,0.08)',
                    borderBottom: `1px solid ${COLORS.border}`, fontSize: '0.65rem',
                    fontWeight: '600', color: COLORS.blue,
                  }}>Original</div>
                )}

                {markdownMode ? (
                  /* Markdown editor */
                  <div style={{ display: 'flex', gap: '0', height: '340px' }}>
                    <textarea
                      value={markdownText}
                      onChange={e => setMarkdownText(e.target.value)}
                      placeholder="Write in Markdown format...\n\n# Heading\n**Bold** *Italic*\n- List item\n| Col1 | Col2 |\n|------|------|\n| A    | B    |"
                      style={{
                        flex: showMarkdownPreview ? '1 1 50%' : '1 1 100%',
                        padding: '0.75rem', background: COLORS.input.bg,
                        border: `1px solid ${COLORS.input.border}`, borderRadius: '0.5rem',
                        color: COLORS.input.text, fontSize: '0.85rem', lineHeight: '1.6',
                        fontFamily: "'Fira Code', 'Consolas', monospace",
                        resize: 'none', outline: 'none',
                        borderRight: showMarkdownPreview ? 'none' : undefined,
                        borderTopRightRadius: showMarkdownPreview ? 0 : undefined,
                        borderBottomRightRadius: showMarkdownPreview ? 0 : undefined,
                      }}
                    />
                    {showMarkdownPreview && (
                      <div
                        className="ql-editor bulletin-content markdown-preview"
                        style={{
                          flex: '1 1 50%', padding: '0.75rem',
                          background: COLORS.surfaceLight,
                          border: `1px solid ${COLORS.input.border}`,
                          borderLeft: `1px solid ${COLORS.border}`,
                          borderRadius: '0 0.5rem 0.5rem 0',
                          color: COLORS.text.primary, fontSize: '0.85rem', lineHeight: '1.7',
                          overflowY: 'auto',
                        }}
                        dangerouslySetInnerHTML={{ __html: markdownPreviewHTML }}
                      />
                    )}
                  </div>
                ) : (
                  /* Rich text editor */
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={content}
                    onChange={setContent}
                    modules={quillModules}
                    formats={quillFormats}
                    style={{ flex: 1, minHeight: '280px', marginBottom: showTranslation && translatedContent ? 0 : '3rem', display: 'flex', flexDirection: 'column' }}
                    placeholder="Write your directive content here..."
                  />
                )}
              </div>

              {/* Translation panel */}
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
                    }}
                    dangerouslySetInnerHTML={{ __html: translatedContent }}
                  />
                </div>
              )}
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
