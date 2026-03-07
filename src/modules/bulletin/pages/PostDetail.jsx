import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, arrayUnion, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, increment } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../core/AuthContext';
import DOMPurify from 'dompurify';
import { useReactToPrint } from 'react-to-print';
import 'react-quill-new/dist/quill.snow.css';
import { ArrowLeft, Printer, CheckCircle, Paperclip, Download, MessageSquare, Send, Users, AlertCircle, Edit, Trash2, Languages, Loader, ChevronDown, X, Columns, AlignJustify, Eye, Smile } from 'lucide-react';

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

// Quick translate buttons for comments
const QUICK_TRANSLATE = [
  { code: 'ko', label: 'KOR', flag: '\uD83C\uDDF0\uD83C\uDDF7' },
  { code: 'en', label: 'ENG', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
];

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
  return 'ko';
}

// Detect user's local language from timezone
function getLocalLangOption() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Asia/Tokyo')) return { code: 'ja', label: 'JPN', flag: '\uD83C\uDDEF\uD83C\uDDF5' };
    if (tz.includes('Asia/Shanghai') || tz.includes('Asia/Hong_Kong')) return { code: 'zh', label: 'CHN', flag: '\uD83C\uDDE8\uD83C\uDDF3' };
    if (tz.includes('Europe/Berlin') || tz.includes('Europe/Vienna')) return { code: 'de', label: 'DEU', flag: '\uD83C\uDDE9\uD83C\uDDEA' };
    if (tz.includes('Europe/Paris')) return { code: 'fr', label: 'FRA', flag: '\uD83C\uDDEB\uD83C\uDDF7' };
    if (tz.includes('Europe/Madrid')) return { code: 'es', label: 'ESP', flag: '\uD83C\uDDEA\uD83C\uDDF8' };
    if (tz.includes('Asia/Bangkok')) return { code: 'th', label: 'THA', flag: '\uD83C\uDDF9\uD83C\uDDED' };
    if (tz.includes('Asia/Ho_Chi_Minh') || tz.includes('Asia/Saigon')) return { code: 'vi', label: 'VIE', flag: '\uD83C\uDDFB\uD83C\uDDF3' };
    if (tz.includes('Asia/Riyadh') || tz.includes('Asia/Dubai')) return { code: 'ar', label: 'ARA', flag: '\uD83C\uDDF8\uD83C\uDDE6' };
  } catch {}
  return null;
}

export default function PostDetail({ boardType = 'directive' }) {
  const isComm = boardType === 'communication';
  const collectionName = isComm ? 'communicationPosts' : 'bulletinPosts';
  const basePath = isComm ? '/communication' : '/bulletin';
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allBranches, setAllBranches] = useState([]);
  // Post translation state
  const [translatedContent, setTranslatedContent] = useState('');
  const [translatedTitle, setTranslatedTitle] = useState('');
  const [translating, setTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [targetLang, setTargetLang] = useState('ko');
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [translationLayout, setTranslationLayout] = useState('sideBySide');
  // Comment translation state
  const [commentTranslations, setCommentTranslations] = useState({});
  const [commentTranslating, setCommentTranslating] = useState({});

  const printRef = useRef(null);

  const branchName = currentUser?.branchName || currentUser?.displayName || '';
  const userRole = currentUser?.role || 'branch_user';

  // Build quick translate buttons (KOR, ENG, + local if different)
  const localLangOpt = getLocalLangOption();
  const commentTranslateButtons = [...QUICK_TRANSLATE];
  if (localLangOpt && !commentTranslateButtons.some(b => b.code === localLangOpt.code)) {
    commentTranslateButtons.push(localLangOpt);
  }

  useEffect(() => {
    const fetchPost = async () => {
      const docSnap = await getDoc(doc(db, collectionName, id));
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setPost(data);
        const detected = detectLanguage(data.content);
        setTargetLang(suggestTargetLang(detected));

        // Increment view count
        try {
          await updateDoc(doc(db, collectionName, id), { viewCount: increment(1) });
        } catch (e) {
          // viewCount field may not exist yet, that's ok
          console.debug('[PostDetail] viewCount increment:', e.message);
        }
      } else navigate(basePath);
      setLoading(false);
    };
    fetchPost();

    const q = query(collection(db, `${collectionName}/${id}/comments`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

    if (isAdmin) {
      getDocs(collection(db, 'branchCodes')).then(snap => setAllBranches(snap.docs.map(d => d.id)));
    }
    return () => unsubscribe();
  }, [id, navigate, isAdmin]);

  // Utility: convert plain text to HTML paragraphs
  const textToHTML = (text) => {
    if (!text) return '';
    let normalized = text.replace(/\\n/g, '\n');
    normalized = normalized.replace(/\\_/g, '_');
    const paragraphs = normalized.split(/\n\s*\n/).filter(p => p.trim());
    return paragraphs
      .map(p => {
        const inner = p.trim().replace(/\n/g, '<br>');
        return `<p>${inner}</p>`;
      })
      .join('');
  };

  // Robust AI response parser
  const parseTranslationResponse = (responseText) => {
    if (!responseText) return { title: '', contentHTML: '' };
    let raw = responseText.trim();
    raw = raw.replace(/^```[\w]*\s*\n?/gm, '').replace(/\n?\s*```\s*$/gm, '').trim();

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

    let jsonResult = tryParseJSON(raw);
    if (jsonResult) {
      return { title: jsonResult.title, contentHTML: textToHTML(jsonResult.content) };
    }

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

    raw = raw.replace(/^(?:Translation|Translated text|번역|翻訳)\s*:\s*/i, '').trim();
    return { title: '', contentHTML: textToHTML(raw) };
  };

  // AI Translation for post
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
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const responseText = response.text;
      let title = '';
      let contentHTML = '';
      const separatorIdx = responseText.indexOf('\n---\n');
      if (separatorIdx !== -1) {
        title = responseText.substring(0, separatorIdx).trim();
        const bodyText = responseText.substring(separatorIdx + 5).trim();
        contentHTML = textToHTML(bodyText);
      } else {
        const parsed = parseTranslationResponse(responseText);
        title = parsed.title;
        contentHTML = parsed.contentHTML;
      }

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

  // AI Translation for individual comment
  const handleTranslateComment = async (commentId, commentText, targetCode) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || !commentText) return;

    const translatingKey = `${commentId}_${targetCode}`;
    setCommentTranslating(prev => ({ ...prev, [translatingKey]: true }));

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const targetLabel = LANGUAGE_OPTIONS.find(l => l.code === targetCode)?.label || 'English';

      const prompt = `Translate the following comment to ${targetLabel}. Keep aviation/security acronyms unchanged. Return ONLY the translated text, no markup or labels.

"${commentText}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let translated = response.text.trim();
      translated = translated.replace(/^```[\w]*\s*\n?/gm, '').replace(/\n?\s*```\s*$/gm, '').trim();
      translated = translated.replace(/^["']|["']$/g, '');
      translated = translated.replace(/^(?:Translation|번역|翻訳)\s*:\s*/i, '').trim();

      setCommentTranslations(prev => ({
        ...prev,
        [commentId]: { text: translated, lang: targetCode },
      }));
    } catch (err) {
      console.error('[Comment Translation]', err);
      setCommentTranslations(prev => ({
        ...prev,
        [commentId]: { text: `(Translation failed: ${err.message})`, lang: targetCode, error: true },
      }));
    } finally {
      setCommentTranslating(prev => ({ ...prev, [translatingKey]: false }));
    }
  };

  const handleAcknowledge = async () => {
    if (!branchName || post.acknowledgedBy?.includes(branchName)) return;
    await updateDoc(doc(db, collectionName, id), { acknowledgedBy: arrayUnion(branchName) });
    setPost(prev => ({ ...prev, acknowledgedBy: [...(prev.acknowledgedBy || []), branchName] }));
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await addDoc(collection(db, `${collectionName}/${id}/comments`), {
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
      await deleteDoc(doc(db, `${collectionName}/${id}/comments`, commentId));
      // Also clear any translation for this comment
      setCommentTranslations(prev => {
        const updated = { ...prev };
        delete updated[commentId];
        return updated;
      });
    } catch (err) {
      console.error('[PostDetail] Delete comment error:', err);
      alert('Failed to delete comment: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this directive?")) {
      await deleteDoc(doc(db, collectionName, id));
      navigate(basePath);
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

  // Commonly used emojis for quick insert
  const EMOJI_LIST = [
    '\u{1F44D}','\u{1F44E}','\u{2705}','\u{274C}','\u{26A0}','\u{1F6A8}','\u{1F4DD}','\u{1F4E2}','\u{2708}','\u{1F30D}',
    '\u{1F64F}','\u{1F44B}','\u{1F389}','\u{1F4A1}','\u{2757}','\u{2753}','\u{1F4E6}','\u{1F512}','\u{1F513}','\u{1F55C}',
    '\u{2764}','\u{1F525}','\u{1F4CA}','\u{1F4C5}','\u{1F4CB}','\u{1F527}','\u{1F4E7}','\u{1F4F1}','\u{1F4BB}','\u{1F44C}',
  ];
  const insertEmoji = (emoji) => {
    setNewComment(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '3rem' }}>
      {/* Action bar */}
      <div className="print:hidden" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: COLORS.surface, padding: '0.75rem 1rem', borderRadius: '0.75rem',
        border: `1px solid ${COLORS.border}`, flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <button onClick={() => navigate(basePath)} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none',
          color: COLORS.text.secondary, cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500',
        }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isAuthorOrAdmin && (
            <>
              <button onClick={() => navigate(`${basePath}/edit/${id}`)} style={{
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
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: COLORS.text.primary, marginBottom: '0.3rem', lineHeight: '1.3', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(() => {
                  // No TA prefix on directive board
                  const rawPrefix = post.siteCode || (post.authorRole === 'hq_admin' ? 'TA' : (post.authorName?.match(/^([A-Z]{2,4})/) || ['',''])[1]);
                  const prefix = (boardType === 'directive' && post.authorRole === 'hq_admin') ? '' : rawPrefix.substring(0, 3);
                  return prefix ? (
                    <span style={{
                      display: 'inline-block', width: '2.6em', textAlign: 'center',
                      padding: '0.15rem 0', borderRadius: '5px', fontSize: '0.72rem', fontWeight: '700',
                      background: post.authorRole === 'hq_admin' ? 'rgba(233,69,96,0.15)' : 'rgba(96,165,250,0.15)',
                      color: post.authorRole === 'hq_admin' ? '#E94560' : '#60A5FA',
                      border: `1px solid ${post.authorRole === 'hq_admin' ? 'rgba(233,69,96,0.3)' : 'rgba(96,165,250,0.3)'}`,
                      letterSpacing: '0.04em', flexShrink: 0,
                    }}>{prefix}</span>
                  ) : null;
                })()}
                {post.title}
              </h1>
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
            {/* View count */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: COLORS.surface, padding: '0.3rem 0.7rem', borderRadius: '0.375rem', border: `1px solid ${COLORS.border}`, color: COLORS.text.light, fontSize: '0.75rem' }}>
              <Eye size={12} /> {post.viewCount || 0}
            </span>

            {/* Translation controls */}
            <div className="print:hidden" style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
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

        {/* Body */}
        <div style={{
          padding: '1.5rem', minHeight: '250px',
          display: isSideBySide ? 'flex' : 'block',
          gap: '1rem',
        }}>
          <div style={{ flex: isSideBySide ? '1 1 50%' : '1 1 100%', minWidth: 0 }}>
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
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
            />
          </div>

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
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(translatedContent) }}
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
                const translation = commentTranslations[comment.id];
                return (
                <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', alignItems: comment.authorRole === 'hq_admin' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', borderRadius: '0.75rem', padding: '0.7rem 1rem',
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
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                      marginBottom: '0.3rem', paddingBottom: '0.3rem',
                      borderBottom: `1px solid ${comment.authorRole === 'hq_admin' ? 'rgba(0,0,0,0.1)' : COLORS.border}`,
                      paddingRight: canDeleteComment ? '1.2rem' : 0,
                    }}>
                      <span style={{ fontWeight: '700', fontSize: '0.75rem' }}>
                        {comment.authorBranch} {comment.authorRole === 'hq_admin' ? '(HQ Admin)' : ''}
                      </span>
                      {/* Comment translate buttons */}
                      <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', flexShrink: 0 }}>
                        {commentTranslateButtons.map(btn => {
                          const tKey = `${comment.id}_${btn.code}`;
                          const isTranslating = commentTranslating[tKey];
                          return (
                            <button
                              key={btn.code}
                              onClick={(e) => { e.stopPropagation(); handleTranslateComment(comment.id, comment.text, btn.code); }}
                              disabled={isTranslating}
                              title={`Translate to ${btn.label}`}
                              style={{
                                padding: '0.1rem 0.3rem', borderRadius: '3px', border: 'none',
                                background: translation?.lang === btn.code ? 'rgba(59,130,246,0.2)' : (comment.authorRole === 'hq_admin' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'),
                                color: translation?.lang === btn.code ? '#3B82F6' : (comment.authorRole === 'hq_admin' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)'),
                                cursor: isTranslating ? 'wait' : 'pointer',
                                fontSize: '0.55rem', fontWeight: '700', letterSpacing: '0.03em',
                                transition: 'all 0.15s',
                                lineHeight: 1,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; e.currentTarget.style.color = '#3B82F6'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = translation?.lang === btn.code ? 'rgba(59,130,246,0.2)' : (comment.authorRole === 'hq_admin' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'); e.currentTarget.style.color = translation?.lang === btn.code ? '#3B82F6' : (comment.authorRole === 'hq_admin' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)'); }}
                            >
                              {isTranslating ? '...' : btn.label}
                            </button>
                          );
                        })}
                        <span style={{ fontSize: '0.6rem', opacity: 0.5, marginLeft: '0.25rem' }}>
                          {comment.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', lineHeight: '1.5', margin: 0 }}>{comment.text}</p>
                    {/* Translated comment */}
                    {translation && (
                      <div style={{
                        marginTop: '0.4rem', paddingTop: '0.35rem',
                        borderTop: `1px dashed ${comment.authorRole === 'hq_admin' ? 'rgba(0,0,0,0.1)' : COLORS.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.15rem' }}>
                          <Languages size={9} color={translation.error ? '#F87171' : '#3B82F6'} />
                          <span style={{ fontSize: '0.55rem', fontWeight: '600', color: translation.error ? '#F87171' : '#3B82F6' }}>
                            {LANGUAGE_OPTIONS.find(l => l.code === translation.lang)?.flag} {LANGUAGE_OPTIONS.find(l => l.code === translation.lang)?.label}
                          </span>
                          <button onClick={() => setCommentTranslations(prev => { const u = { ...prev }; delete u[comment.id]; return u; })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: comment.authorRole === 'hq_admin' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)', padding: 0, display: 'flex', marginLeft: 'auto' }}>
                            <X size={10} />
                          </button>
                        </div>
                        <p style={{
                          whiteSpace: 'pre-wrap', fontSize: '0.78rem', lineHeight: '1.45', margin: 0,
                          color: translation.error ? '#F87171' : (comment.authorRole === 'hq_admin' ? '#1a4a7a' : '#93c5fd'),
                          fontStyle: 'italic',
                        }}>{translation.text}</p>
                      </div>
                    )}
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
          <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ask a question or leave a comment..."
                rows="1"
                style={{
                  width: '100%', padding: '0.6rem 0.8rem', paddingRight: '2.2rem', resize: 'none', height: '2.8rem',
                  background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
                  borderRadius: '0.5rem', color: COLORS.text.primary, fontSize: '0.8rem', outline: 'none',
                }}
              />
              {/* Emoji toggle */}
              <div style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)' }}>
                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Insert emoji"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem',
                    color: showEmojiPicker ? COLORS.blue : COLORS.text.light, display: 'flex', fontSize: '1rem',
                  }}>
                  <Smile size={16} />
                </button>
              </div>
              {/* Emoji picker dropdown */}
              {showEmojiPicker && (
                <div style={{
                  position: 'absolute', bottom: '100%', right: 0, marginBottom: '0.35rem',
                  background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                  borderRadius: '0.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  padding: '0.5rem', width: '220px', zIndex: 50,
                  display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '0.15rem',
                }}>
                  {EMOJI_LIST.map((emoji, i) => (
                    <button key={i} type="button" onClick={() => insertEmoji(emoji)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '1.1rem', padding: '0.15rem', borderRadius: '4px',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >{emoji}</button>
                  ))}
                </div>
              )}
            </div>
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
