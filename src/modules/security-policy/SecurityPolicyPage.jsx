import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { useAuth } from '../../core/AuthContext';
import { FileText, Save, Edit, Download, Upload, CheckCircle, Printer, Eye } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

const COLORS = {
  surface: '#132F4C', surfaceLight: '#1A3A5C',
  text: { primary: '#E8EAED', secondary: '#8B99A8', light: '#5F6B7A' },
  border: '#1E3A5F', accent: '#E94560', blue: '#3B82F6',
  input: { bg: '#1A3A5C', border: '#2A5080', text: '#E8EAED' },
};

const DEFAULT_POLICY = `AIRZETA AVIATION CARGO SECURITY POLICY

Version: 1.0
Effective Date: [Date]

1. PURPOSE
This Security Policy establishes the security standards and procedures that AIRZETA and all its station partners must follow to ensure the safety and integrity of aviation cargo operations in compliance with international regulations.

2. SCOPE
This policy applies to all employees, contractors, and partners involved in aviation cargo handling, screening, and transportation at all AIRZETA stations worldwide.

3. REGULATORY COMPLIANCE
All operations shall comply with:
- ICAO Annex 17 (Aviation Security)
- National civil aviation security programs
- EU ACC3/RA3 regulations (where applicable)
- TSA regulations (for US-bound cargo)
- Local aviation authority requirements

4. CARGO SCREENING REQUIREMENTS
- 100% of cargo must be screened before loading onto aircraft
- Approved screening methods: X-ray, ETD, physical inspection, K9 screening
- Screening equipment must be maintained and calibrated per manufacturer specifications

5. ACCESS CONTROL
- All personnel must possess valid security clearances
- Access to secure cargo areas restricted to authorized personnel only
- Visitor access requires escort and proper identification

6. TRAINING
- All staff must complete initial security awareness training
- Annual recurrent security training is mandatory
- Specialized training for screening operators

7. INCIDENT REPORTING
- All security incidents must be reported immediately
- Use the Security Bulletin Board for communications
- Maintain incident logs and investigation records

8. REVIEW AND UPDATES
This policy will be reviewed annually and updated as needed to reflect changes in regulations and best practices.`;

export default function SecurityPolicyPage() {
  const { isAdmin } = useAuth();
  const [policy, setPolicy] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfName, setPdfName] = useState('');
  const printRef = React.useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'systemConfig', 'securityPolicy'));
        if (snap.exists()) {
          const data = snap.data();
          setPolicy(data.content || DEFAULT_POLICY);
          setPdfUrl(data.pdfUrl || '');
          setPdfName(data.pdfName || '');
        } else {
          setPolicy(DEFAULT_POLICY);
        }
      } catch (err) {
        console.error('[SecurityPolicy] Load error:', err);
        setPolicy(DEFAULT_POLICY);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'systemConfig', 'securityPolicy'), {
        content: editText,
        pdfUrl, pdfName,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setPolicy(editText);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('Max 50MB'); return; }
    setUploadingPdf(true);
    try {
      const storageRef = ref(storage, `security_policy/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);
      await new Promise((resolve, reject) => {
        task.on('state_changed', null, reject, async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setPdfUrl(url);
          setPdfName(file.name);
          await setDoc(doc(db, 'systemConfig', 'securityPolicy'), {
            pdfUrl: url, pdfName: file.name, updatedAt: serverTimestamp(),
          }, { merge: true });
          resolve();
        });
      });
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: 'AIRZETA_Security_Policy' });

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: COLORS.text.secondary }}>Loading policy...</div>;
  }

  // Render policy text with formatting
  const renderPolicyContent = (text) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;

      // Title (all caps, long)
      if (/^[A-Z\s]{10,}$/.test(trimmed) && !trimmed.startsWith('-')) {
        return <h1 key={i} style={{ fontSize: '1.3rem', fontWeight: '800', color: COLORS.text.primary, margin: '1.5rem 0 0.5rem', borderBottom: `2px solid ${COLORS.accent}`, paddingBottom: '0.5rem' }}>{trimmed}</h1>;
      }
      // Section headers (numbered like "1. PURPOSE")
      if (/^\d+\.\s+[A-Z]/.test(trimmed)) {
        return <h2 key={i} style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.blue, margin: '1.25rem 0 0.4rem' }}>{trimmed}</h2>;
      }
      // Bullet points
      if (trimmed.startsWith('- ')) {
        return <li key={i} style={{ fontSize: '0.85rem', color: COLORS.text.primary, lineHeight: '1.7', marginLeft: '1.5rem', marginBottom: '0.2rem' }}>{trimmed.substring(2)}</li>;
      }
      // Metadata lines
      if (/^(Version|Effective Date):/.test(trimmed)) {
        return <p key={i} style={{ fontSize: '0.82rem', color: COLORS.text.secondary, fontStyle: 'italic', margin: '0.15rem 0' }}>{trimmed}</p>;
      }
      // Regular paragraph
      return <p key={i} style={{ fontSize: '0.85rem', color: COLORS.text.primary, lineHeight: '1.7', margin: '0.2rem 0' }}>{trimmed}</p>;
    });
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceLight} 100%)`,
        borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: 'rgba(233,69,96,0.12)', border: '1px solid rgba(233,69,96,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={22} color={COLORS.accent} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>Security Policy</h1>
            <p style={{ fontSize: '0.72rem', color: COLORS.text.secondary, margin: 0 }}>AIRZETA Aviation Cargo Security Standards</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isAdmin && !editing && (
            <button onClick={() => { setEditText(policy); setEditing(true); }} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem',
              background: 'rgba(59,130,246,0.12)', border: `1px solid rgba(59,130,246,0.3)`,
              borderRadius: '0.4rem', color: COLORS.blue, fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
            }}>
              <Edit size={14} /> Edit Policy
            </button>
          )}
          <button onClick={handlePrint} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem',
            background: COLORS.accent, color: 'white', border: 'none',
            borderRadius: '0.4rem', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
          }}>
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* PDF Document */}
      <div style={{ background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`, padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: COLORS.text.primary, margin: 0 }}>
            Official Policy Document (PDF)
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '0.35rem', color: '#34D399', fontSize: '0.72rem', fontWeight: '600',
                textDecoration: 'none',
              }}>
                <Download size={13} /> {pdfName || 'Download PDF'}
              </a>
            )}
            {isAdmin && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem',
                background: COLORS.surfaceLight, border: `1px solid ${COLORS.border}`,
                borderRadius: '0.35rem', color: COLORS.text.secondary, fontSize: '0.72rem',
                fontWeight: '600', cursor: 'pointer',
              }}>
                <Upload size={13} /> {uploadingPdf ? 'Uploading...' : 'Upload PDF'}
                <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handlePdfUpload} disabled={uploadingPdf} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Policy Content */}
      <div ref={printRef} style={{
        background: COLORS.surface, borderRadius: '0.75rem', border: `1px solid ${COLORS.border}`,
        padding: '2rem', minHeight: '400px',
      }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={30}
              style={{
                width: '100%', padding: '1rem', background: COLORS.input.bg,
                border: `1px solid ${COLORS.input.border}`, borderRadius: '0.5rem',
                color: COLORS.input.text, fontSize: '0.85rem', lineHeight: '1.7',
                fontFamily: "'Fira Code', monospace", resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setEditing(false)} style={{
                padding: '0.5rem 1rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.4rem',
                background: 'transparent', color: COLORS.text.secondary, cursor: 'pointer', fontSize: '0.82rem',
              }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.5rem 1.2rem', border: 'none', borderRadius: '0.4rem',
                background: saved ? '#22c55e' : COLORS.accent, color: 'white',
                fontSize: '0.82rem', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saved ? <><CheckCircle size={14} /> Saved!</> : <><Save size={14} /> Save Policy</>}
              </button>
            </div>
          </div>
        ) : (
          <div>{renderPolicyContent(policy)}</div>
        )}
      </div>
    </div>
  );
}
