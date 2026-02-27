import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, arrayUnion, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import { useReactToPrint } from 'react-to-print';
import 'react-quill-new/dist/quill.snow.css';
import { ArrowLeft, Printer, CheckCircle, Paperclip, Download, MessageSquare, Send, Users, AlertCircle, Edit, Trash2, Languages, Loader, ChevronDown, X, Columns, AlignJustify } from 'lucide-react';

const COLORS = {
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F',
  accent: '#E94560',
  blue: '#3B82F6',
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

// Detect primary language of text (heuristic)
function detectLanguage(text) {
  if (!text) return 'en';
  const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  const koreanChars = (clean.match(/[\uAC00-\uD7A3]/g) || []).length;
  const cjkChars = (clean.match(/[\u4E00-\u9FFF]/g) || []).length;
  const jpChars = (clean.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
  const total = clean.length || 1;
  if (koreanChars / total > 0.2) return 'ko';
  if (jpChars / total > 0.1) return 'ja';
  if (cjkChars / total > 0.2) return 'zh';
  return 'en';
}

// Suggest target language based on source + user locale
function suggestTargetLang(sourceLang) {
  if (sourceLang === 'ko' || sourceLang === 'en') {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz.includes('Asia/Seoul') || tz.includes('Asia/Tokyo')) return sourceLang === 'ko' ? 'en' : 'ko';
      if (tz.includes('Asia/Shanghai') || tz.includes('Asia/Hong_Kong')) return 'zh';
      if (tz.includes('Europe/Berlin') || tz.includes('Europe/Vienna')) return 'de';
      if (tz.includes('Europe/Paris')) return 'fr';
      if (tz.includes('Europe/Madrid')) return 'es';
      if (tz.includes('Asia/Bangkok')) return 'th';
      if (tz.includes('Asia/Ho_Chi_Minh') || tz.includes('Asia/Saigon')) return 'vi';
      if (tz.includes('Asia/Riyadh') || tz.includes('Asia/Dubai')) return 'ar';
    } catch {}
    return sourceLang === 'ko' ? 'en' : 'ko';
  }
  return 'ko'; // Non-Korean/English posts default to Korean
}

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [allBranches, setAllBranches] = useState([]);
  // Translation state
  const [translatedContent, setTranslatedContent] = useState('');
  const [translatedTitle, setTranslatedTitle] = useState('');
  const [translating, setTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [targetLang, setTargetLang] = useState('ko');
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [translationLayout, setTranslationLayout] = useState('sideBySide'); // 'sideBySide' | 'inline'

  const printRef = useRef(null);

  const branchName = currentUser?.branchName || currentUser?.displayName || '';
  const userRole = currentUser?.role || 'branch_user';

  useEffect(() => {
    const fetchPost = async () => {
      const docSnap = await getDoc(doc(db, 'bulletinPosts', id));
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setPost(data);
        // Auto-suggest target language based on content
        const detected = detectLanguage(data.content);
        setTargetLang(suggestTargetLang(detected));
      } else navigate('/bulletin');
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

  // ---- Utility: convert plain text to clean HTML paragraphs ----
  // Handles real newlines, literal \n strings, and mixed content
  const textToHTML = (text) => {
    if (!text) return '';
    // First, normalize: replace literal escaped '\n' strings with real newlines
    let normalized = text.replace(/\\n/g, '\n');
    // Also handle escaped underscores from AI: \\_  → _
    normalized = normalized.replace(/\\_/g, '_');
    // Split into paragraphs on double-newline boundaries
    const paragraphs = normalized.split(/\n\s*\n/).filter(p => p.trim());
    return paragraphs
      .map(p => {
        const inner = p.trim().replace(/\n/g, '<br>');
        return `<p>${inner}</p>`;
      })
      .join('');
  };

  // ---- Utility: robustly extract translated text from AI response ----
  // Handles: raw JSON, code-fenced JSON, code-fenced text, plain text,
  //          and deeply nested/malformed responses
  const parseTranslationResponse = (responseText) => {
    if (!responseText) return { title: '', contentHTML: '' };
    let raw = responseText.trim();

    // 1. Strip ALL markdown code fences (```json ... ``` or ``` ... ```)
    //    Use a greedy regex that handles multiline fences
    raw = raw.replace(/^```[\w]*\s*\n?/gm, '').replace(/\n?\s*```\s*$/gm, '').trim();

    // 2. Try to extract JSON with title+content
    const tryParseJSON = (str) => {
      try {
        const parsed = JSON.parse(str);
        if (parsed && typeof parsed === 'object') {
          const title = parsed.title || parsed.Title || '';
          const content = parsed.content || parsed.Content || parsed.translation || '';
          if (content) return { title, content };
        }
      } catch {}
      return null;
    };

    // 2a. Direct JSON parse
    let jsonResult = tryParseJSON(raw);
    if (jsonResult) {
      return { title: jsonResult.title, contentHTML: textToHTML(jsonResult.content) };
    }

    // 2b. Find JSON object anywhere in the text
    const jsonPattern = /\{[\s\S]*?"(?:title|content|translation)"[\s\S]*?\}/g;
    const jsonMatches = raw.match(jsonPattern);
    if (jsonMatches) {
      for (const match of jsonMatches) {
        jsonResult = tryParseJSON(match);
        if (jsonResult) {
          return { title: jsonResult.title, contentHTML: textToHTML(jsonResult.content) };
        }
      }
    }

    // 3. Not JSON — treat as plain translated text
    //    Remove any leading labels the AI might add like "Translation:" or "번역:"
    raw = raw.replace(/^(?:Translation|Translated text|번역|翻訳)\s*:\s*/i, '').trim();

    return { title: '', contentHTML: textToHTML(raw) };
  };

  // ---- AI Translation for view mode ----
  const handleTranslate = async () => {
    if (!post?.content) return;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return;

    setTranslating(true);
    setShowTranslation(true);

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const plainText = post.content
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

TASK: Translate both the TITLE and the CONTENT below into ${targetLabel}.

RULES:
- Preserve the original paragraph structure exactly. Keep blank lines between paragraphs.
- Keep acronyms (ICAO, TSA, IATA, ETD, K9, CSD, DG, ACC3) unchanged.
- Use aviation cargo security domain terminology.
- If already in ${targetLabel}, polish grammar instead.

OUTPUT FORMAT:
- First line: the translated title only
- Second line: exactly "---"
- Remaining lines: the translated content, preserving all paragraph breaks as blank lines
- Do NOT wrap in JSON, code fences, or any markup.

TITLE: ${post.title}

CONTENT:
${plainText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
      });

      const responseText = response.text;

      // First try the structured "title\n---\ncontent" format
      let title = '';
      let contentHTML = '';
      const separatorIdx = responseText.indexOf('\n---\n');
      if (separatorIdx !== -1) {
        title = responseText.substring(0, separatorIdx).trim();
        const bodyText = responseText.substring(separatorIdx + 5).trim();
        contentHTML = textToHTML(bodyText);
      } else {
        // Fallback to the robust parser (handles JSON, fences, etc.)
        const parsed = parseTranslationResponse(responseText);
        title = parsed.title;
        contentHTML = parsed.contentHTML;
      }

      // Clean up title: strip any remaining fences or JSON artifacts
      title = title.replace(/^```[\w]*\s*/g, '').replace(/```\s*$/g, '').replace(/^["']|["']$/g, '').trim();

      setTranslatedTitle(title);
      setTranslatedContent(contentHTML || '<p>Translation completed but no content was returned.</p>');
    } catch (err) {
      console.error('[Translation]', err);
      if (err.message?.includes('403') || err.message?.includes('blocked')) {
        setTranslatedContent('<p style="color:#F87171;">Translation failed: API key lacks permission. Create a Gemini key at aistudio.google.com/apikey</p>');
      } else {
        setTranslatedContent(`<p style="color:#F87171;">Translation failed: ${err.message || 'Unknown error'}</p>`);
      }
    } finally {
      setTranslating(false);
    }
  };

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

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteDoc(doc(db, `bulletinPosts/${id}/comments`, commentId));
    } catch (err) {
      console.error('[PostDetail] Delete comment error:', err);
      alert('Failed to delete comment: ' + err.message);
    }
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

  const isSideBySide = translationLayout === 'sideBySide' && showTranslation && translatedContent;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '3rem' }}>
      {/* Action bar */}
      <div className="print:hidden" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: COLORS.surface, padding: '0.75rem 1rem', borderRadius: '0.75rem',
        border: `1px solid ${COLORS.border}`, flexWrap: 'wrap', gap: '0.5rem',
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
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: COLORS.text.primary, marginBottom: '0.3rem', lineHeight: '1.3' }}>
                {post.title}
              </h1>
              {/* Show translated title if available */}
              {showTranslation && translatedTitle && (
                <p style={{
                  fontSize: '1rem', fontWeight: '500', color: '#34D399', margin: '0 0 0.5rem',
                  opacity: 0.9, lineHeight: '1.4',
                }}>
                  {LANGUAGE_OPTIONS.find(l => l.code === targetLang)?.flag} {translatedTitle}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: COLORS.surface, padding: '0.3rem 0.7rem', borderRadius: '0.375rem', border: `1px solid ${COLORS.border}`, color: COLORS.text.secondary }}>
              From: {post.authorName}
            </span>
            <span style={{ background: COLORS.surface, padding: '0.3rem 0.7rem', borderRadius: '0.375rem', border: `1px solid ${COLORS.border}`, color: COLORS.text.secondary }}>
              Date: {post.createdAt?.toDate().toLocaleDateString()}
            </span>
            {/* Translation controls */}
            <div className="print:hidden" style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              {/* Layout toggle (side-by-side vs inline) - only when translation is shown */}
              {showTranslation && translatedContent && (
                <button
                  onClick={() => setTranslationLayout(prev => prev === 'sideBySide' ? 'inline' : 'sideBySide')}
                  title={translationLayout === 'sideBySide' ? 'Switch to inline view' : 'Switch to side-by-side view'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.2rem',
                    padding: '0.25rem 0.45rem', background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`, borderRadius: '0.35rem',
                    color: COLORS.text.secondary, fontSize: '0.68rem', cursor: 'pointer',
                  }}>
                  {translationLayout === 'sideBySide' ? <AlignJustify size={11} /> : <Columns size={11} />}
                </button>
              )}
              {/* Language selector */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowLangDropdown(!showLangDropdown)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.2rem',
                  padding: '0.25rem 0.5rem', background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`, borderRadius: '0.35rem',
                  color: COLORS.text.secondary, fontSize: '0.68rem', cursor: 'pointer',
                }}>
                  {LANGUAGE_OPTIONS.find(l => l.code === targetLang)?.flag}{' '}
                  {LANGUAGE_OPTIONS.find(l => l.code === targetLang)?.label}
                  <ChevronDown size={10} />
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
              <button onClick={handleTranslate} disabled={translating}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.25rem 0.55rem', background: translating ? COLORS.surface : 'rgba(59,130,246,0.12)',
                  border: `1px solid ${translating ? COLORS.border : 'rgba(59,130,246,0.3)'}`,
                  borderRadius: '0.35rem', color: translating ? COLORS.text.light : COLORS.blue,
                  fontSize: '0.7rem', fontWeight: '600', cursor: translating ? 'not-allowed' : 'pointer',
                }}>
                {translating ? <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Languages size={11} />}
                {translating ? 'Translating...' : 'Translate'}
              </button>
            </div>
          </div>
        </div>

        {/* Body - original + translation */}
        <div style={{
          padding: '1.5rem', minHeight: '250px',
          display: isSideBySide ? 'flex' : 'block',
          gap: '1rem',
        }}>
          {/* Original content */}
          <div style={{
            flex: isSideBySide ? '1 1 50%' : '1 1 100%',
            minWidth: 0,
          }}>
            {showTranslation && translatedContent && (
              <div style={{
                fontSize: '0.65rem', fontWeight: '600', color: COLORS.blue,
                marginBottom: '0.5rem', padding: '0.2rem 0.5rem',
                background: 'rgba(59,130,246,0.08)', borderRadius: '0.25rem',
                display: 'inline-block',
              }}>Original</div>
            )}
            <div
              className="ql-editor bulletin-content"
              style={{ color: COLORS.text.primary, lineHeight: '1.7', padding: 0 }}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>

          {/* Translation panel */}
          {showTranslation && translatedContent && (
            <div style={{
              flex: isSideBySide ? '1 1 50%' : '1 1 100%',
              minWidth: 0,
              borderLeft: isSideBySide ? `1px solid ${COLORS.border}` : 'none',
              paddingLeft: isSideBySide ? '1rem' : 0,
              borderTop: !isSideBySide ? `1px solid ${COLORS.border}` : 'none',
              paddingTop: !isSideBySide ? '1rem' : 0,
              marginTop: !isSideBySide ? '1rem' : 0,
            }}>
              <div style={{
                fontSize: '0.65rem', fontWeight: '600', color: '#34D399',
                marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{
                  padding: '0.2rem 0.5rem', background: 'rgba(16,185,129,0.08)',
                  borderRadius: '0.25rem', display: 'inline-block',
                }}>
                  {LANGUAGE_OPTIONS.find(l => l.code === targetLang)?.flag}{' '}
                  AI Translation ({LANGUAGE_OPTIONS.find(l => l.code === targetLang)?.label})
                </span>
                <button onClick={() => { setShowTranslation(false); setTranslatedContent(''); setTranslatedTitle(''); }}
                  className="print:hidden"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.text.light, padding: '0.1rem', display: 'flex' }}>
                  <X size={13} />
                </button>
              </div>
              <div
                className="ql-editor bulletin-content"
                style={{ color: COLORS.text.primary, lineHeight: '1.7', padding: 0 }}
                dangerouslySetInnerHTML={{ __html: translatedContent }}
              />
            </div>
          )}
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
              {comments.map((comment) => {
                const canDeleteComment = isAdmin || currentUser?.uid === comment.authorId;
                return (
                <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', alignItems: comment.authorRole === 'hq_admin' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', borderRadius: '0.75rem', padding: '0.7rem 1rem',
                    background: comment.authorRole === 'hq_admin' ? '#E0F2FE' : COLORS.surfaceLight,
                    color: comment.authorRole === 'hq_admin' ? '#1a1a1a' : COLORS.text.primary,
                    borderTopRightRadius: comment.authorRole === 'hq_admin' ? '0.15rem' : '0.75rem',
                    borderTopLeftRadius: comment.authorRole !== 'hq_admin' ? '0.15rem' : '0.75rem',
                    position: 'relative',
                  }}>
                    {canDeleteComment && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        title="Delete comment"
                        style={{
                          position: 'absolute', top: '0.35rem', right: '0.35rem',
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: comment.authorRole === 'hq_admin' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.25)',
                          padding: '0.1rem', display: 'flex', borderRadius: '50%',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
                        onMouseLeave={e => e.currentTarget.style.color = comment.authorRole === 'hq_admin' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.25)'}
                      >
                        <X size={13} />
                      </button>
                    )}
                    <div style={{
                      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem',
                      marginBottom: '0.3rem', paddingBottom: '0.3rem',
                      borderBottom: `1px solid ${comment.authorRole === 'hq_admin' ? 'rgba(0,0,0,0.1)' : COLORS.border}`,
                      paddingRight: canDeleteComment ? '1.2rem' : 0,
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
              )})}
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
