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
  SECURITY_EVENTS,
  updateLoginSecurityMeta,
  getDeviceFingerprint
} from './security';

// ============================================================
// 로그인 / 로그아웃
// ============================================================

// 🔑 이메일 로그인 (보안 강화: rate limiting + audit logging)
export const loginUser = async (email, password) => {
  // Rate limit check
  const rateCheck = checkLoginRateLimit();
  if (!rateCheck.allowed) {
    if (rateCheck.isLocked) {
      logSecurityEvent(SECURITY_EVENTS.LOGIN_LOCKED, { email, waitSeconds: rateCheck.waitSeconds });
    }
    const error = new Error(rateCheck.reason);
    error.code = 'auth/rate-limited';
    throw error;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Record successful login
    recordLoginAttempt(true);
    
    // Security audit log
    logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, {
      email: user.email,
      deviceFingerprint: getDeviceFingerprint()
    });
    
    // Update security metadata
    updateLoginSecurityMeta(user.uid, true, email);
    
    // Firestore 프로필 확인
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
    
    if (userDoc.exists()) {
      await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
        lastLogin: serverTimestamp()
      });
      return { uid: user.uid, email: user.email, ...userDoc.data() };
    }
    
    // 프로필 없으면 기본 생성 (branchName 없이)
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
  } catch (error) {
    // Record failed attempt (unless it's a rate limit error we threw)
    if (error.code !== 'auth/rate-limited') {
      recordLoginAttempt(false);
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, {
        email,
        errorCode: error.code,
        deviceFingerprint: getDeviceFingerprint()
      });
      // Note: Do NOT call updateLoginSecurityMeta here because the user
      // is not authenticated (login failed), so Firestore writes would be
      // rejected by security rules. Client-side rate limiting handles this.
    }
    console.error('Login error:', error);
    throw error;
  }
};

// 🚪 로그아웃 (보안 강화: audit logging)
export const logoutUser = async () => {
  try {
    const user = auth.currentUser;
    logSecurityEvent(SECURITY_EVENTS.LOGOUT, {
      email: user?.email
    });
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

// ============================================================
// 회원가입 (셀프 등록)
// ============================================================

// 🆕 이메일 회원가입 — 계정 생성 + Firestore 프로필 (branchName 미지정) + 보안 로깅
export const registerUser = async (email, password, displayName = '') => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const profile = {
      email: user.email,
      role: 'branch_user',
      branchName: '',  // 가입 직후에는 비어 있음 → BranchSelection에서 선택
      displayName: displayName || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    };
    
    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), profile);
    
    // Security audit log
    logSecurityEvent(SECURITY_EVENTS.ACCOUNT_CREATED, {
      email: user.email,
      method: 'email',
      deviceFingerprint: getDeviceFingerprint()
    });
    
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

// 📧 비밀번호 재설정 이메일 발송 (보안 강화: audit logging)
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

// 🔒 비밀번호 변경 (로그인 상태에서)
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    if (!user.email) throw new Error('User has no email (Google-only account)');
    
    // 기존 비밀번호로 재인증
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // 새 비밀번호 설정
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

// 👤 현재 사용자 프로필 가져오기
export const getCurrentUserProfile = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    if (userDoc.exists()) {
      return { uid, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Get user profile error:', error);
    throw error;
  }
};

// 🏢 사용자 브랜치 등록/변경
// HQ 선택 시 → pending_admin 상태로 설정 (기존 admin의 승인 필요)
export const updateUserBranch = async (uid, branchName) => {
  try {
    const isHQ = branchName === 'HQ' || branchName === 'hq';
    
    if (isHQ) {
      // HQ 선택 → 관리자 승인 대기 상태로 설정
      await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
        branchName: 'HQ',
        role: 'pending_admin',
        pendingAdminRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('[Auth] HQ 선택 → pending_admin 등록:', uid);
      return { success: true, pendingAdmin: true };
    } else {
      await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
        branchName,
        updatedAt: serverTimestamp()
      });
      console.log('[Auth] 브랜치 등록 완료:', uid, '→', branchName);
      return { success: true, pendingAdmin: false };
    }
  } catch (error) {
    console.error('Update branch error:', error);
    throw error;
  }
};

// 💾 사용자 선호 설정 저장 (currency, paymentMethod 등)
export const updateUserPreferences = async (uid, prefs) => {
  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
      ...prefs,
      updatedAt: serverTimestamp()
    });
    console.log('[Auth] 사용자 설정 저장:', uid, prefs);
    return { success: true };
  } catch (error) {
    console.error('Update user preferences error:', error);
    throw error;
  }
};

// ============================================================
// 인증 상태 리스너
// ============================================================

// 👂 인증 상태 변경 감지
// callback(profile | null)
// profile에는 반드시 branchName 포함 (비어있을 수 있음)
export const listenToAuthChanges = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('[Auth] onAuthStateChanged: 사용자 감지됨:', user.email);
      try {
        let profile = await getCurrentUserProfile(user.uid);
        
        // 프로필이 아직 없으면 (Google 로그인 직후 race condition)
        if (!profile) {
          console.log('[Auth] 프로필 없음, 1초 후 재시도...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          profile = await getCurrentUserProfile(user.uid);
        }
        
        // 그래도 없으면 최소 프로필 반환 (Firestore 쓰기 없이)
        if (!profile) {
          console.log('[Auth] 프로필 없음 - 신규 사용자 대기 상태');
          profile = {
            uid: user.uid,
            email: user.email,
            role: 'branch_user',
            branchName: '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            _isNewUser: true  // 아직 Firestore에 저장되지 않은 사용자
          };
        }
        
        console.log('[Auth] 프로필 로드:', profile.email, '역할:', profile.role, '브랜치:', profile.branchName || '(미지정)');
        callback(profile);
      } catch (error) {
        console.error('[Auth] 프로필 로드 에러:', error);
        callback({
          uid: user.uid,
          email: user.email,
          role: 'branch_user',
          branchName: '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || ''
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

// 🔐 관리자 권한 확인
export const isAdmin = (user) => {
  return user && user.role === 'hq_admin';
};

// 🕐 관리자 승인 대기 상태 확인
export const isPendingAdmin = (user) => {
  return user && user.role === 'pending_admin';
};

// 📝 역할별 권한 체크
export const checkPermission = (user, permission) => {
  const permissions = {
    'hq_admin': ['view_all', 'edit_all', 'manage_users', 'manage_settings'],
    'branch_user': ['view_own', 'edit_own']
  };
  return user && permissions[user.role]?.includes(permission);
};

// 🆕 관리자 전용: 새 사용자 생성 (관리자가 직접)
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

// 📋 관리자 전용: 모든 사용자 목록
export const getAllUsers = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    return usersSnapshot.docs.map(d => ({
      uid: d.id,
      ...d.data()
    }));
  } catch (error) {
    console.error('Get all users error:', error);
    throw error;
  }
};

// 🔄 관리자 전용: 사용자 역할 변경
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

// ⚡ 관리자 전용: 사용자 활성화/비활성화
export const toggleUserStatus = async (uid, active) => {
  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
      active,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Toggle user status error:', error);
    throw error;
  }
};

// ============================================================
// 관리자 승인 관련 기능 (pending_admin)
// ============================================================

// 📋 승인 대기 중인 관리자 목록 조회
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

// ✅ 관리자 승인 (pending_admin → hq_admin)
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

// ❌ 관리자 승인 거부 (pending_admin → branch_user, branchName 초기화)
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

// 🗑️ 사용자 프로필 삭제 (Firestore만)
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

// Google 로그인 후 Firestore 프로필 처리
const handleGoogleUserProfile = async (user) => {
  const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
  
  if (!userDoc.exists()) {
    // 신규 Google 사용자 → branchName 비워둠 (BranchSelection에서 선택)
    const newProfile = {
      email: user.email,
      role: 'branch_user',
      branchName: '',  // 비어있음 → BranchSelection 화면으로 이동
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    };
    
    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), newProfile);
    console.log('[Auth] 신규 Google 사용자 프로필 생성 (브랜치 미지정)');
    
    return { uid: user.uid, ...newProfile };
  } else {
    // 기존 사용자 → lastLogin 업데이트
    await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
      lastLogin: serverTimestamp()
    });
    console.log('[Auth] 기존 Google 사용자 로그인');
    
    return { uid: user.uid, email: user.email, ...userDoc.data() };
  }
};

// 🆕 Google 로그인 함수 (보안 강화: rate limiting + audit logging)
export const loginWithGoogle = async () => {
  const currentDomain = window.location.hostname;
  const currentOrigin = window.location.origin;
  
  // Rate limit check (applies to Google login too)
  const rateCheck = checkLoginRateLimit();
  if (!rateCheck.allowed && rateCheck.isLocked) {
    logSecurityEvent(SECURITY_EVENTS.LOGIN_LOCKED, { method: 'google' });
    const error = new Error(rateCheck.reason);
    error.code = 'auth/rate-limited';
    throw error;
  }
  
  console.log('[Google Login] 시작...');
  console.log('[Google Login] 현재 도메인:', currentDomain);
  console.log('[Google Login] 현재 Origin:', currentOrigin);
  
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    const result = await signInWithPopup(auth, provider);
    console.log('[Google Login] signInWithPopup 성공!');
    
    // Record successful login
    recordLoginAttempt(true);
    logSecurityEvent(SECURITY_EVENTS.GOOGLE_LOGIN, {
      email: result.user.email,
      deviceFingerprint: getDeviceFingerprint()
    });
    updateLoginSecurityMeta(result.user.uid, true, result.user.email);
    
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
      throw new Error(
        'Google login popup was blocked.\n\n' +
        'Please allow popups for this site and try again.'
      );
    }

    if (popupError.code === 'auth/internal-error' || 
        popupError.code === 'auth/network-request-failed') {
      throw new Error(
        'Network error during Google login.\n\n' +
        'Please check your internet connection and try again.\n' +
        'If the problem persists, try refreshing the page.'
      );
    }
    
    // Record failed Google login attempt (client-side rate limiting only)
    recordLoginAttempt(false);
    logSecurityEvent(SECURITY_EVENTS.GOOGLE_LOGIN_FAILED, {
      errorCode: popupError.code,
      errorMessage: popupError.message,
      deviceFingerprint: getDeviceFingerprint()
    });
    
    throw new Error(
      `Google login failed: ${popupError.message}\n` +
      `(Error code: ${popupError.code || 'unknown'})`
    );
  }
};

// Google Redirect 결과 처리 (호환성 유지)
export const initGoogleRedirectResult = async () => {
  return null;
};
