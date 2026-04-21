/**
 * AirZeta Security Portal - Security Audit Schedule Firestore Helpers (v2)
 * 
 * Manages Firestore collections for the Security Audit Schedule module:
 * - securityAuditSchedules: Audit schedule entries (station, dates, auditors, status, etc.)
 * - securityAuditSettings: Audit-related settings (audit types, frequencies, default auditors)
 * - auditScheduleFiles: File attachments per schedule (chunk-based storage)
 * 
 * v2 Changes:
 * - Multi-auditor support (auditors array instead of single auditor string)
 * - Station categories (overseas, domestic, partner, internal)
 * - File attachments per individual schedule (upload/download)
 * - Enhanced statistics for analytics dashboard
 * 
 * All operations require authentication.
 */

import { db, auth, appCheckReady } from './config';
import {
  collection, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, limit, serverTimestamp
} from 'firebase/firestore';

// ============================================================
// Collection Names
// ============================================================

const AUDIT_SCHEDULES_COLLECTION = 'securityAuditSchedules';
const AUDIT_SETTINGS_DOC = 'auditScheduleSettings';
const SETTINGS_COLLECTION = 'settings';
const AUDIT_FILES_COLLECTION = 'auditScheduleFiles';

// ============================================================
// Authentication Helper
// ============================================================

const ensureAuth = async () => {
  try { await appCheckReady; } catch (_) { /* non-fatal */ }
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Auth timeout')), 10000);
    const unsubscribe = auth.onAuthStateChanged((user) => {
      clearTimeout(timeout);
      unsubscribe();
      if (user) resolve(user);
      else reject(new Error('User must be authenticated'));
    });
  });
};

// ============================================================
// Audit Schedule CRUD Operations
// ============================================================

/**
 * Get all audit schedules (optionally filtered by year)
 * Normalizes legacy data: converts single `auditor` string to `auditors` array
 */
export const getAuditSchedules = async (year = null) => {
  try {
    await ensureAuth();
    const snapshot = await getDocs(collection(db, AUDIT_SCHEDULES_COLLECTION));
    let schedules = snapshot.docs.map(d => {
      const data = { id: d.id, ...d.data() };
      // Normalize: ensure auditors is always an array
      if (!data.auditors && data.auditor) {
        data.auditors = data.auditor.split(',').map(a => a.trim()).filter(Boolean);
      }
      if (!data.auditors) data.auditors = [];
      return data;
    });

    if (year) {
      schedules = schedules.filter(s => {
        const startDate = s.startDate || s.auditDate || '';
        return startDate.startsWith(year);
      });
    }

    schedules.sort((a, b) => {
      const aDate = a.startDate || a.auditDate || '';
      const bDate = b.startDate || b.auditDate || '';
      return bDate.localeCompare(aDate);
    });

    return schedules;
  } catch (error) {
    console.error('[AuditSchedule] Get schedules error:', error);
    throw error;
  }
};

/**
 * Get audit schedules for a specific station/branch
 */
export const getAuditSchedulesByBranch = async (branchName) => {
  try {
    await ensureAuth();
    const q = query(
      collection(db, AUDIT_SCHEDULES_COLLECTION),
      where('branchName', '==', branchName)
    );
    const snapshot = await getDocs(q);
    const schedules = snapshot.docs.map(d => {
      const data = { id: d.id, ...d.data() };
      if (!data.auditors && data.auditor) {
        data.auditors = data.auditor.split(',').map(a => a.trim()).filter(Boolean);
      }
      if (!data.auditors) data.auditors = [];
      return data;
    });
    schedules.sort((a, b) => {
      const aDate = a.startDate || a.auditDate || '';
      const bDate = b.startDate || b.auditDate || '';
      return bDate.localeCompare(aDate);
    });
    return schedules;
  } catch (error) {
    console.error('[AuditSchedule] Get by station error:', error);
    throw error;
  }
};

/**
 * Create a new audit schedule entry
 * @param {Object} scheduleData - includes auditors (array), stationCategory, etc.
 */
export const createAuditSchedule = async (scheduleData) => {
  try {
    const user = await ensureAuth();
    // Normalize: store both auditors array and auditor string for backward compat
    const auditors = scheduleData.auditors || [];
    const entry = {
      ...scheduleData,
      auditors,
      auditor: auditors.join(', '), // backward compatibility
      createdBy: user.email,
      createdByUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: scheduleData.status || 'scheduled'
    };
    const docRef = await addDoc(collection(db, AUDIT_SCHEDULES_COLLECTION), entry);
    console.log('[AuditSchedule] Created:', docRef.id);
    return { id: docRef.id, ...entry };
  } catch (error) {
    console.error('[AuditSchedule] Create error:', error);
    throw error;
  }
};

/**
 * Update an existing audit schedule entry
 */
export const updateAuditSchedule = async (scheduleId, updates) => {
  try {
    const user = await ensureAuth();
    const docRef = doc(db, AUDIT_SCHEDULES_COLLECTION, scheduleId);
    // Normalize auditors
    if (updates.auditors) {
      updates.auditor = updates.auditors.join(', ');
    }
    await updateDoc(docRef, {
      ...updates,
      updatedBy: user.email,
      updatedAt: serverTimestamp()
    });
    console.log('[AuditSchedule] Updated:', scheduleId);
  } catch (error) {
    console.error('[AuditSchedule] Update error:', error);
    throw error;
  }
};

/**
 * Delete an audit schedule entry (and its file attachments)
 */
export const deleteAuditSchedule = async (scheduleId) => {
  try {
    await ensureAuth();
    // Delete associated files
    try {
      const files = await getAuditScheduleFiles(scheduleId);
      for (const file of files) {
        await deleteAuditScheduleFile(file.id);
      }
    } catch (e) {
      console.warn('[AuditSchedule] File cleanup warning:', e.message);
    }
    await deleteDoc(doc(db, AUDIT_SCHEDULES_COLLECTION, scheduleId));
    console.log('[AuditSchedule] Deleted:', scheduleId);
  } catch (error) {
    console.error('[AuditSchedule] Delete error:', error);
    throw error;
  }
};

/**
 * Get a single audit schedule by ID
 */
export const getAuditScheduleById = async (scheduleId) => {
  try {
    await ensureAuth();
    const docSnap = await getDoc(doc(db, AUDIT_SCHEDULES_COLLECTION, scheduleId));
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };
      if (!data.auditors && data.auditor) {
        data.auditors = data.auditor.split(',').map(a => a.trim()).filter(Boolean);
      }
      if (!data.auditors) data.auditors = [];
      return data;
    }
    return null;
  } catch (error) {
    console.error('[AuditSchedule] Get by ID error:', error);
    throw error;
  }
};

// ============================================================
// File Attachments per Schedule (chunk-based)
// ============================================================

const CHUNK_SIZE = 700 * 1024; // 700KB per chunk

/**
 * Upload a file attachment for a specific audit schedule
 */
export const uploadAuditScheduleFile = async (scheduleId, fileName, fileBase64, fileType, fileSize) => {
  try {
    await ensureAuth();
    const totalChunks = Math.ceil(fileBase64.length / CHUNK_SIZE);
    const docRef = await addDoc(collection(db, AUDIT_FILES_COLLECTION), {
      scheduleId,
      fileName,
      fileType,
      fileSize,
      totalChunks,
      uploadedAt: serverTimestamp()
    });

    for (let i = 0; i < totalChunks; i++) {
      const chunk = fileBase64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await setDoc(doc(db, AUDIT_FILES_COLLECTION, docRef.id, 'chunks', String(i)), { data: chunk });
    }

    console.log(`[AuditSchedule] File uploaded: ${fileName} (${totalChunks} chunks) for schedule ${scheduleId}`);
    return { success: true, id: docRef.id, fileName, fileType, fileSize };
  } catch (error) {
    console.error('[AuditSchedule] File upload error:', error);
    throw error;
  }
};

/**
 * Get file list for a specific audit schedule (metadata only)
 */
export const getAuditScheduleFiles = async (scheduleId) => {
  try {
    await ensureAuth();
    const q = query(
      collection(db, AUDIT_FILES_COLLECTION),
      where('scheduleId', '==', scheduleId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('[AuditSchedule] Get files error:', error);
    return [];
  }
};

/**
 * Download a file attachment (reassemble chunks)
 */
export const downloadAuditScheduleFile = async (fileId) => {
  try {
    await ensureAuth();
    const docSnap = await getDoc(doc(db, AUDIT_FILES_COLLECTION, fileId));
    if (!docSnap.exists()) return null;
    const meta = docSnap.data();

    const chunksSnap = await getDocs(collection(db, AUDIT_FILES_COLLECTION, fileId, 'chunks'));
    const chunks = chunksSnap.docs
      .sort((a, b) => parseInt(a.id) - parseInt(b.id))
      .map(d => d.data().data);
    const fileBase64 = chunks.join('');

    return { ...meta, fileBase64 };
  } catch (error) {
    console.error('[AuditSchedule] File download error:', error);
    return null;
  }
};

/**
 * Delete a file attachment (with chunks)
 */
export const deleteAuditScheduleFile = async (fileId) => {
  try {
    await ensureAuth();
    const chunksSnap = await getDocs(collection(db, AUDIT_FILES_COLLECTION, fileId, 'chunks'));
    for (const d of chunksSnap.docs) {
      await deleteDoc(doc(db, AUDIT_FILES_COLLECTION, fileId, 'chunks', d.id));
    }
    await deleteDoc(doc(db, AUDIT_FILES_COLLECTION, fileId));
    console.log('[AuditSchedule] File deleted:', fileId);
  } catch (error) {
    console.error('[AuditSchedule] File delete error:', error);
    throw error;
  }
};

// ============================================================
// Audit Schedule Statistics (enhanced)
// ============================================================

export const getAuditStatistics = async (year = null) => {
  try {
    const schedules = await getAuditSchedules(year);
    const now = new Date().toISOString().split('T')[0];

    const stats = {
      total: schedules.length,
      scheduled: schedules.filter(s => s.status === 'scheduled').length,
      inProgress: schedules.filter(s => s.status === 'in_progress').length,
      completed: schedules.filter(s => s.status === 'completed').length,
      cancelled: schedules.filter(s => s.status === 'cancelled').length,
      postponed: schedules.filter(s => s.status === 'postponed').length,
      overdue: schedules.filter(s => {
        const endDate = s.endDate || s.auditDate || '';
        return s.status === 'scheduled' && endDate < now;
      }).length,
      upcoming: schedules.filter(s => {
        const startDate = s.startDate || s.auditDate || '';
        return s.status === 'scheduled' && startDate >= now;
      }).length,
      byBranch: {},
      byAuditType: {},
      byMonth: {},
      byAuditor: {},
      byCategory: {},
      byStatus: {}
    };

    // Count by status
    Object.keys(stats).forEach(key => {
      if (['scheduled', 'inProgress', 'completed', 'cancelled', 'postponed'].includes(key)) {
        const statusKey = key === 'inProgress' ? 'in_progress' : key;
        stats.byStatus[statusKey] = stats[key];
      }
    });

    schedules.forEach(s => {
      const branch = s.branchName || 'Unknown';
      stats.byBranch[branch] = (stats.byBranch[branch] || 0) + 1;

      const auditType = s.auditType || 'General';
      stats.byAuditType[auditType] = (stats.byAuditType[auditType] || 0) + 1;

      const month = (s.startDate || s.auditDate || '').substring(0, 7);
      if (month) {
        stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
      }

      // Count by auditor
      const auditors = s.auditors || (s.auditor ? [s.auditor] : []);
      auditors.forEach(a => {
        const name = a.trim();
        if (name) stats.byAuditor[name] = (stats.byAuditor[name] || 0) + 1;
      });

      // Count by category
      const cat = s.stationCategory || 'overseas';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('[AuditSchedule] Statistics error:', error);
    return { total: 0, scheduled: 0, inProgress: 0, completed: 0, cancelled: 0, postponed: 0, overdue: 0, upcoming: 0, byBranch: {}, byAuditType: {}, byMonth: {}, byAuditor: {}, byCategory: {}, byStatus: {} };
  }
};

// ============================================================
// Audit Schedule Settings (with station categories)
// ============================================================

export const DEFAULT_AUDIT_SETTINGS = {
  auditTypes: [
    'Regular Security Audit',
    'Special Inspection',
    'Compliance Check',
    'Emergency Audit',
    'Follow-up Audit',
    'Annual Review'
  ],
  auditFrequencies: [
    'Monthly',
    'Quarterly',
    'Semi-Annual',
    'Annual',
    'Ad-hoc'
  ],
  defaultAuditors: [],
  statusOptions: ['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'],
  notificationEnabled: true,
  notificationDaysBefore: 7,
  autoReminderEnabled: true,
  defaultAuditDuration: 3,
  // Station categories: allows admin to manage custom station lists
  // beyond the overseas branches synced from branchCodes
  stationCategories: {
    partner: { label: '협력업체', stations: [] },
    domestic: { label: '국내지점', stations: [] },
    internal: { label: '사내점검', stations: [] }
  }
};

export const loadAuditSettings = async () => {
  try {
    await ensureAuth();
    const settingsRef = doc(db, SETTINGS_COLLECTION, AUDIT_SETTINGS_DOC);
    const settingsDoc = await getDoc(settingsRef);

    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      return {
        ...DEFAULT_AUDIT_SETTINGS,
        ...data,
        stationCategories: {
          ...DEFAULT_AUDIT_SETTINGS.stationCategories,
          ...(data.stationCategories || {})
        }
      };
    }
    return { ...DEFAULT_AUDIT_SETTINGS };
  } catch (error) {
    console.error('[AuditSchedule] Load settings error:', error);
    return { ...DEFAULT_AUDIT_SETTINGS };
  }
};

export const saveAuditSettings = async (settings) => {
  try {
    await ensureAuth();
    const settingsRef = doc(db, SETTINGS_COLLECTION, AUDIT_SETTINGS_DOC);
    await setDoc(settingsRef, {
      ...settings,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('[AuditSchedule] Settings saved');
    return { success: true };
  } catch (error) {
    console.error('[AuditSchedule] Save settings error:', error);
    throw error;
  }
};

/**
 * Get upcoming audit schedules for the current and next month
 * Used by the HomePage dashboard card
 */
export const getUpcomingAudits = async () => {
  try {
    await ensureAuth();
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const snapshot = await getDocs(collection(db, AUDIT_SCHEDULES_COLLECTION));
    const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const upcoming = all.filter(s => {
      const startDate = s.startDate || s.auditDate || '';
      const monthKey = startDate.substring(0, 7);
      return (monthKey === thisMonth || monthKey === nextMonth) && s.status !== 'cancelled';
    });

    upcoming.sort((a, b) => {
      const aDate = a.startDate || a.auditDate || '';
      const bDate = b.startDate || b.auditDate || '';
      return aDate.localeCompare(bDate);
    });

    return upcoming;
  } catch (error) {
    console.error('[AuditSchedule] Get upcoming error:', error);
    return [];
  }
};
