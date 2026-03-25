import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  collection,
  getDocs
} from 'firebase/firestore';
import { auth, db } from './config';
import { COLLECTIONS } from './collections';
import {
  checkLoginRateLimit,
  recordLoginAttempt,
  logSecurityEvent,
  SECURITY_EVENTS
} from './security';

// ============================================================
// 로그인 / 로그아웃
// ============================================================

export const loginUser = async (email, password) => {
  // Rate limit check (in-memory only)
  const rateCheck = checkLoginRateLimit();
  if (!rateCheck.allowed) {
    if (rateCheck.isLocked) {
      logSecurityEvent(SECURITY_EVENTS.LOGIN_LOCKED, { email });
    }
    const error = new Error(rateCheck.reason);
    error.code = 'auth/rate-limited';
    throw error;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    recordLoginAttempt(true);
    logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, { email: user.email });
    
    // Firestore 프로필 확인
    try {
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
      
      if (userDoc.exists()) {
        try {
          await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
            lastLogin: serverTimestamp()
          });
        } catch (updateErr) {
          console.warn('[Auth] lastLogin update failed (non-critical):', updateErr.message);
        }
        return { uid: user.uid, email: user.email, ...userDoc.data() };
      }
      
      // 프로필 없으면 기본 생성
      const newProfile = {
        email: user.email,
        role: 'branch_user',
        branchName: '',
        displayName: '',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      };
      await setDoc(doc(db, COLLECTIONS.USERS, user.uid), newProfile);
      return { uid: user.uid, ...newProfile };
    } catch (profileErr) {
      // Firestore profile load failed — return minimal profile so login proceeds
      console.warn('[Auth] Firestore profile load failed during login:', profileErr.message);
      return {
        uid: user.uid,
        email: user.email,
        role: 'branch_user',
        branchName: '',
        displayName: user.displayName || '',
        _firestoreUnavailable: true
      };
    }
  } catch (error) {
    if (error.code !== 'auth/rate-limited') {
      recordLoginAttempt(false);
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, { email, errorCode: error.code });
    }
    console.error('Login error:', error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    const user = auth.currentUser;
    logSecurityEvent(SECURITY_EVENTS.LOGOUT, { email: user?.email });
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

// ============================================================
// 회원가입
// ============================================================

export const registerUser = async (email, password, displayName = '') => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const profile = {
      email: user.email,
      role: 'branch_user',
      branchName: '',
      displayName: displayName || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    };
    
    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), profile);
    logSecurityEvent(SECURITY_EVENTS.ACCOUNT_CREATED, { email: user.email });
    console.log('[Auth] 새 이메일 사용자 가입 완료:', email);
    
    return { uid: user.uid, ...profile };
  } catch (error) {
    console.error('Register error:', error);
    throw error;
  }
};

// ============================================================
// 비밀번호 관리
// ============================================================

export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    logSecurityEvent(SECURITY_EVENTS.PASSWORD_RESET_REQUEST, { email });
    console.log('[Auth] 비밀번호 재설정 이메일 발송:', email);
    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};

export const changePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    if (!user.email) throw new Error('User has no email (Google-only account)');
    
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    logSecurityEvent(SECURITY_EVENTS.PASSWORD_CHANGE, { email: user.email });
    console.log('[Auth] 비밀번호 변경 완료');
    return { success: true };
  } catch (error) {
    console.error('Change password error:', error);
    throw error;
  }
};

// ============================================================
// 프로필 / 브랜치 관리
// ============================================================

export const getCurrentUserProfile = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    if (userDoc.exists()) {
      return { uid, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    const isPermErr = error.code === 'permission-denied' || 
                      error.message?.includes('permission') ||
                      error.message?.includes('Missing or insufficient');
    if (isPermErr) {
      console.warn('[Auth] getCurrentUserProfile: Permission denied. Returning null.');
      return null;
    }
    console.error('Get user profile error:', error);
    throw error;
  }
};

export const updateUserBranch = async (uid, branchName) => {
  try {
    const isHQ = branchName === 'HQ' || branchName === 'hq';
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    
    const userDoc = await getDoc(userRef);
    const docExists = userDoc.exists();
    
    if (isHQ) {
      const hqData = {
        branchName: 'HQ',
        role: 'pending_admin',
        pendingAdminRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (docExists) {
        await updateDoc(userRef, hqData);
      } else {
        const user = auth.currentUser;
        await setDoc(userRef, {
          email: user?.email || '',
          displayName: user?.displayName || '',
          role: 'pending_admin',
          branchName: 'HQ',
          pendingAdminRequestedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      console.log('[Auth] HQ 선택 → pending_admin 등록:', uid);
      return { success: true, pendingAdmin: true };
    } else {
      const branchData = {
        branchName,
        updatedAt: serverTimestamp()
      };
      if (docExists) {
        await updateDoc(userRef, branchData);
      } else {
        const user = auth.currentUser;
        await setDoc(userRef, {
          email: user?.email || '',
          displayName: user?.displayName || '',
          role: 'branch_user',
          branchName,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      console.log('[Auth] 브랜치 등록 완료:', uid, '→', branchName);
      return { success: true, pendingAdmin: false };
    }
  } catch (error) {
    const isPermErr = error.code === 'permission-denied' || 
                      error.message?.includes('permission') ||
                      error.message?.includes('Missing or insufficient');
    if (isPermErr) {
      console.warn('[Auth] Branch update failed due to permission error. Using local-only assignment:', branchName);
      const isHQ = branchName === 'HQ' || branchName === 'hq';
      return { success: true, pendingAdmin: isHQ, localOnly: true };
    }
    console.error('Update branch error:', error);
    throw error;
  }
};

export const updateUserPreferences = async (uid, prefs) => {
  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
      ...prefs,
      updatedAt: serverTimestamp()
    });
    console.log('[Auth] 사용자 설정 저장:', uid, prefs);
    return { success: true };
  } catch (error) {
    const isPermErr = error.code === 'permission-denied' || error.message?.includes('Missing or insufficient');
    if (isPermErr) {
      console.warn('[Auth] User preferences update skipped (permission):', uid);
      return { success: false, permissionDenied: true };
    }
    console.warn('[Auth] Update user preferences error:', error.message);
    throw error;
  }
};

// ============================================================
// 인증 상태 리스너
// ============================================================

export const listenToAuthChanges = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('[Auth] onAuthStateChanged: 사용자 감지됨:', user.email);
      try {
        let profile = await getCurrentUserProfile(user.uid);
        
        if (!profile) {
          console.log('[Auth] 프로필 없음, 1초 후 재시도...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          profile = await getCurrentUserProfile(user.uid);
        }
        
        if (!profile) {
          console.log('[Auth] 프로필 없음 - 신규 사용자 Firestore 프로필 생성');
          const newProfile = {
            email: user.email,
            role: 'branch_user',
            branchName: '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
          };
          try {
            await setDoc(doc(db, COLLECTIONS.USERS, user.uid), newProfile);
            console.log('[Auth] 신규 사용자 Firestore 프로필 생성 완료');
          } catch (createErr) {
            console.warn('[Auth] 프로필 생성 실패:', createErr.message);
          }
          profile = { uid: user.uid, ...newProfile };
        }
        
        console.log('[Auth] 프로필 로드:', profile.email, '역할:', profile.role, '브랜치:', profile.branchName || '(미지정)');
        callback(profile);
      } catch (error) {
        console.error('[Auth] 프로필 로드 에러:', error);
        // On permission error, provide minimal profile
        callback({
          uid: user.uid,
          email: user.email,
          role: 'branch_user',
          branchName: '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          _firestoreUnavailable: true
        });
      }
    } else {
      console.log('[Auth] onAuthStateChanged: 로그아웃 상태');
      callback(null);
    }
  });
};

// ============================================================
// 관리자 전용 기능
// ============================================================

export const isAdmin = (user) => user && user.role === 'hq_admin';
export const isPendingAdmin = (user) => user && user.role === 'pending_admin';

/**
 * Permission check with clear scope definitions:
 * 
 * hq_admin: Full access to all modules
 *   - view_all, edit_all, manage_users, manage_settings, view_audit
 * 
 * branch_user: Access to their branch data + global content
 *   - view_own (own branch security fee, SSOP board)
 *   - edit_own (own branch data submission)
 *   - view_global (announcements, news, security policy, security levels, important links)
 */
export const checkPermission = (user, permission) => {
  const permissions = {
    'hq_admin': ['view_all', 'edit_all', 'manage_users', 'manage_settings', 'view_audit', 'view_own', 'edit_own', 'view_global'],
    'branch_user': ['view_own', 'edit_own', 'view_global']
  };
  return user && permissions[user.role]?.includes(permission);
};

export const createUser = async (email, password, userData) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
      email,
      role: userData.role || 'branch_user',
      branchName: userData.branchName || '',
      branchCode: userData.branchCode || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
    
    return { uid: user.uid, email: user.email, ...userData };
  } catch (error) {
    console.error('Create user error:', error);
    throw error;
  }
};

export const getAllUsers = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    return usersSnapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (error) {
    console.error('Get all users error:', error);
    throw error;
  }
};

export const updateUserRole = async (uid, newRole) => {
  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
      role: newRole,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Update user role error:', error);
    throw error;
  }
};

export const toggleUserStatus = async (uid, active) => {
  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, uid), { active, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (error) {
    console.error('Toggle user status error:', error);
    throw error;
  }
};

// ============================================================
// 관리자 승인 관련 기능
// ============================================================

export const getPendingAdmins = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    return usersSnapshot.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.role === 'pending_admin');
  } catch (error) {
    console.error('Get pending admins error:', error);
    throw error;
  }
};

export const approvePendingAdmin = async (uid) => {
  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
      role: 'hq_admin',
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('[Auth] 관리자 승인 완료:', uid);
    return { success: true };
  } catch (error) {
    console.error('Approve pending admin error:', error);
    throw error;
  }
};

export const rejectPendingAdmin = async (uid) => {
  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
      role: 'branch_user',
      branchName: '',
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('[Auth] 관리자 승인 거부:', uid);
    return { success: true };
  } catch (error) {
    console.error('Reject pending admin error:', error);
    throw error;
  }
};

export const deleteUserProfile = async (userId) => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.USERS, userId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }
};

// ============================================================
// Google 로그인
// ============================================================

const handleGoogleUserProfile = async (user) => {
  const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
  
  if (!userDoc.exists()) {
    const newProfile = {
      email: user.email,
      role: 'branch_user',
      branchName: '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    };
    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), newProfile);
    console.log('[Auth] 신규 Google 사용자 프로필 생성 (브랜치 미지정)');
    return { uid: user.uid, ...newProfile };
  } else {
    await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), { lastLogin: serverTimestamp() });
    console.log('[Auth] 기존 Google 사용자 로그인');
    return { uid: user.uid, email: user.email, ...userDoc.data() };
  }
};

export const loginWithGoogle = async () => {
  const currentDomain = window.location.hostname;
  const currentOrigin = window.location.origin;
  
  // Rate limit check
  const rateCheck = checkLoginRateLimit();
  if (!rateCheck.allowed && rateCheck.isLocked) {
    logSecurityEvent(SECURITY_EVENTS.LOGIN_LOCKED, { method: 'google' });
    const error = new Error(rateCheck.reason);
    error.code = 'auth/rate-limited';
    throw error;
  }
  
  console.log('[Google Login] 시작...');
  console.log('[Google Login] 현재 도메인:', currentDomain);
  
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    const result = await signInWithPopup(auth, provider);
    console.log('[Google Login] signInWithPopup 성공!');
    
    recordLoginAttempt(true);
    logSecurityEvent(SECURITY_EVENTS.GOOGLE_LOGIN, { email: result.user.email });
    
    return await handleGoogleUserProfile(result.user);
    
  } catch (popupError) {
    console.warn('[Google Login] signInWithPopup 실패:', popupError.code, popupError.message);
    
    if (popupError.code === 'auth/popup-closed-by-user' || 
        popupError.code === 'auth/cancelled-popup-request') {
      throw new Error('Google login was cancelled.');
    }
    
    if (popupError.code === 'auth/unauthorized-domain' || 
        popupError.code === 'auth/invalid-continue-uri') {
      throw new Error(
        `Google login requires domain authorization.\n\n` +
        `Current domain: ${currentDomain}\n` +
        `Current origin: ${currentOrigin}\n\n` +
        `Please configure BOTH of these:\n\n` +
        `[Step 1] Firebase Console:\n` +
        `  → Authentication > Settings > Authorized domains\n` +
        `  → Add "${currentDomain}"\n\n` +
        `[Step 2] Google Cloud Console:\n` +
        `  1. Go to console.cloud.google.com\n` +
        `  2. Select project "airzeta-security-system"\n` +
        `  3. APIs & Services > Credentials\n` +
        `  4. Edit OAuth 2.0 Client ID (Web client)\n` +
        `  5. Add to "Authorized JavaScript origins":\n` +
        `     ${currentOrigin}\n` +
        `  6. Add to "Authorized redirect URIs":\n` +
        `     https://airzeta-security-system.firebaseapp.com/__/auth/handler\n` +
        `  7. Save and wait 5-10 minutes`
      );
    }
    
    if (popupError.code === 'auth/popup-blocked') {
      throw new Error('Google login popup was blocked.\n\nPlease allow popups for this site and try again.');
    }

    if (popupError.code === 'auth/internal-error' || 
        popupError.code === 'auth/network-request-failed') {
      throw new Error(
        'Network error during Google login.\n\n' +
        'Please check your internet connection and try again.\n' +
        'If the problem persists, try refreshing the page.'
      );
    }
    
    recordLoginAttempt(false);
    logSecurityEvent(SECURITY_EVENTS.GOOGLE_LOGIN_FAILED, {
      errorCode: popupError.code,
      errorMessage: popupError.message
    });
    
    throw new Error(
      `Google login failed: ${popupError.message}\n` +
      `(Error code: ${popupError.code || 'unknown'})`
    );
  }
};

export const initGoogleRedirectResult = async () => null;
