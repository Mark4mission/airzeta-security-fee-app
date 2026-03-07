/**
 * AirZeta Security Portal - Security Audit Schedule Firestore Helpers
 * 
 * Manages Firestore collections for the Security Audit Schedule module:
 * - securityAuditSchedules: Audit schedule entries (branch, dates, auditor, status, etc.)
 * - securityAuditSettings: Audit-related settings (audit types, frequencies, default auditors)
 * 
 * All operations require authentication.
 */

import { db, auth } from './config';
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

// ============================================================
// Authentication Helper
// ============================================================

const ensureAuth = async () => {
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
 * @param {string} [year] - Optional year filter (e.g., '2026')
 * @returns {Promise<Array>} List of audit schedule entries
 */
export const getAuditSchedules = async (year = null) => {
  try {
    await ensureAuth();
    const snapshot = await getDocs(collection(db, AUDIT_SCHEDULES_COLLECTION));
    let schedules = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (year) {
      schedules = schedules.filter(s => {
        const startDate = s.startDate || s.auditDate || '';
        return startDate.startsWith(year);
      });
    }

    // Sort by startDate descending
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
 * Get audit schedules for a specific branch
 * @param {string} branchName - Branch name
 * @returns {Promise<Array>}
 */
export const getAuditSchedulesByBranch = async (branchName) => {
  try {
    await ensureAuth();
    const q = query(
      collection(db, AUDIT_SCHEDULES_COLLECTION),
      where('branchName', '==', branchName)
    );
    const snapshot = await getDocs(q);
    const schedules = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    schedules.sort((a, b) => {
      const aDate = a.startDate || a.auditDate || '';
      const bDate = b.startDate || b.auditDate || '';
      return bDate.localeCompare(aDate);
    });
    return schedules;
  } catch (error) {
    console.error('[AuditSchedule] Get by branch error:', error);
    throw error;
  }
};

/**
 * Create a new audit schedule entry
 * @param {Object} scheduleData - Audit schedule data
 * @returns {Promise<Object>} Created document reference
 */
export const createAuditSchedule = async (scheduleData) => {
  try {
    const user = await ensureAuth();
    const entry = {
      ...scheduleData,
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
 * @param {string} scheduleId - Document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updateAuditSchedule = async (scheduleId, updates) => {
  try {
    const user = await ensureAuth();
    const docRef = doc(db, AUDIT_SCHEDULES_COLLECTION, scheduleId);
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
 * Delete an audit schedule entry
 * @param {string} scheduleId - Document ID
 * @returns {Promise<void>}
 */
export const deleteAuditSchedule = async (scheduleId) => {
  try {
    await ensureAuth();
    await deleteDoc(doc(db, AUDIT_SCHEDULES_COLLECTION, scheduleId));
    console.log('[AuditSchedule] Deleted:', scheduleId);
  } catch (error) {
    console.error('[AuditSchedule] Delete error:', error);
    throw error;
  }
};

/**
 * Get a single audit schedule by ID
 * @param {string} scheduleId - Document ID
 * @returns {Promise<Object|null>}
 */
export const getAuditScheduleById = async (scheduleId) => {
  try {
    await ensureAuth();
    const docSnap = await getDoc(doc(db, AUDIT_SCHEDULES_COLLECTION, scheduleId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('[AuditSchedule] Get by ID error:', error);
    throw error;
  }
};

// ============================================================
// Audit Schedule Statistics
// ============================================================

/**
 * Get audit schedule statistics for dashboard display
 * @param {string} [year] - Optional year filter
 * @returns {Promise<Object>} Statistics summary
 */
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
      byMonth: {}
    };

    // Group by branch
    schedules.forEach(s => {
      const branch = s.branchName || 'Unknown';
      stats.byBranch[branch] = (stats.byBranch[branch] || 0) + 1;

      const auditType = s.auditType || 'General';
      stats.byAuditType[auditType] = (stats.byAuditType[auditType] || 0) + 1;

      const month = (s.startDate || s.auditDate || '').substring(0, 7);
      if (month) {
        stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
      }
    });

    return stats;
  } catch (error) {
    console.error('[AuditSchedule] Statistics error:', error);
    return { total: 0, scheduled: 0, inProgress: 0, completed: 0, cancelled: 0, overdue: 0, upcoming: 0, byBranch: {}, byAuditType: {}, byMonth: {} };
  }
};

// ============================================================
// Audit Schedule Settings (persisted in Firestore)
// ============================================================

/**
 * Default audit schedule settings
 */
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
  defaultAuditDuration: 3 // days
};

/**
 * Load audit schedule settings from Firestore
 * @returns {Promise<Object>} Audit settings
 */
export const loadAuditSettings = async () => {
  try {
    await ensureAuth();
    const settingsRef = doc(db, SETTINGS_COLLECTION, AUDIT_SETTINGS_DOC);
    const settingsDoc = await getDoc(settingsRef);

    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      return { ...DEFAULT_AUDIT_SETTINGS, ...data };
    }
    return { ...DEFAULT_AUDIT_SETTINGS };
  } catch (error) {
    console.error('[AuditSchedule] Load settings error:', error);
    return { ...DEFAULT_AUDIT_SETTINGS };
  }
};

/**
 * Save audit schedule settings to Firestore
 * @param {Object} settings - Settings to save
 * @returns {Promise<Object>}
 */
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
