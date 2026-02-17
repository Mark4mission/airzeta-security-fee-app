import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential
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

// 🔑 로그인 함수
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Firestore에서 사용자 정보 가져오기
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
    
    if (!userDoc.exists()) {
      throw new Error('User profile not found');
    }
    
    // lastLogin 업데이트
    await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
      lastLogin: serverTimestamp()
    });
    
    return {
      uid: user.uid,
      email: user.email,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// 🚪 로그아웃 함수
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

// 👤 현재 사용자 정보 가져오기
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

// 👂 인증 상태 리스너
export const listenToAuthChanges = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const profile = await getCurrentUserProfile(user.uid);
      callback(profile);
    } else {
      callback(null);
    }
  });
};

// 🆕 새 사용자 생성 (관리자 전용)
export const createUser = async (email, password, userData) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Firestore에 사용자 프로필 생성
    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
      email,
      role: userData.role || 'branch_user',
      branchName: userData.branchName || '',
      branchCode: userData.branchCode || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
    
    return {
      uid: user.uid,
      email: user.email,
      ...userData
    };
  } catch (error) {
    console.error('Create user error:', error);
    throw error;
  }
};

// 🔐 관리자 권한 확인
export const isAdmin = (user) => {
  return user && user.role === 'hq_admin';
};

// 📝 역할별 권한 체크
export const checkPermission = (user, permission) => {
  const permissions = {
    'hq_admin': ['view_all', 'edit_all', 'manage_users', 'manage_settings'],
    'branch_user': ['view_own', 'edit_own']
  };
  
  return user && permissions[user.role]?.includes(permission);
};

// 🆕 관리자 전용: 모든 사용자 목록 가져오기
export const getAllUsers = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    return usersSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Get all users error:', error);
    throw error;
  }
};

// 🆕 관리자 전용: 사용자 역할 변경
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

// 🆕 관리자 전용: 사용자 활성화/비활성화
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

// 🔥 사용자 프로필 삭제 (Firestore만)
export const deleteUserProfile = async (userId) => {
  try {
    await deleteDoc(doc(db, 'users', userId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }
};

// Google 로그인 - Firestore 프로필 처리 (공통 로직)
const handleGoogleUserProfile = async (user) => {
  const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
  
  if (!userDoc.exists()) {
    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
      email: user.email,
      role: 'branch_user',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
    
    console.log('New Google user profile created');
    
    return {
      uid: user.uid,
      email: user.email,
      role: 'branch_user',
      displayName: user.displayName,
      photoURL: user.photoURL
    };
  } else {
    await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
      lastLogin: serverTimestamp()
    });
    
    console.log('Existing Google user logged in');
    
    return {
      uid: user.uid,
      email: user.email,
      ...userDoc.data()
    };
  }
};

// 🆕 Google 로그인 함수 (Google Identity Services 방식)
//
// signInWithPopup/signInWithRedirect 대신 Google Identity Services(GIS)를 사용합니다.
// GIS는 Google에서 직접 ID 토큰을 받아 signInWithCredential로 Firebase에 로그인합니다.
// 이 방식은 Firebase의 도메인 검증(auth/unauthorized-domain)을 우회합니다.
//
// Firebase Console 승인된 도메인에 추가할 필요 없이 작동합니다.
// 대신 Google Cloud Console > APIs & Services > Credentials에서
// OAuth 2.0 클라이언트 ID의 "승인된 JavaScript 출처"에 도메인을 추가해야 합니다.
//
export const loginWithGoogle = async () => {
  const currentDomain = window.location.hostname;
  
  console.log('[Google Login] GIS 방식 시도...');
  console.log('[Google Login] 현재 도메인:', currentDomain);
  
  // 먼저 signInWithPopup 시도 (가장 간단한 방식)
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    console.log('[Google Login] signInWithPopup 시도...');
    const result = await signInWithPopup(auth, provider);
    console.log('[Google Login] signInWithPopup 성공!');
    return await handleGoogleUserProfile(result.user);
    
  } catch (popupError) {
    console.warn('[Google Login] signInWithPopup 실패:', popupError.code);
    
    // 사용자가 취소한 경우
    if (popupError.code === 'auth/popup-closed-by-user' || 
        popupError.code === 'auth/cancelled-popup-request') {
      throw new Error('Google 로그인이 취소되었습니다.');
    }
    
    // unauthorized-domain인 경우 GIS 폴백
    if (popupError.code === 'auth/unauthorized-domain' || 
        popupError.code === 'auth/invalid-continue-uri') {
      console.log('[Google Login] 도메인 미승인 → GIS 방식으로 폴백...');
      return await loginWithGoogleGIS();
    }
    
    // 팝업 차단인 경우도 GIS 폴백
    if (popupError.code === 'auth/popup-blocked') {
      console.log('[Google Login] 팝업 차단 → GIS 방식으로 폴백...');
      return await loginWithGoogleGIS();
    }
    
    throw popupError;
  }
};

// Google Identity Services를 사용한 로그인 (폴백)
const loginWithGoogleGIS = () => {
  return new Promise((resolve, reject) => {
    // GIS 라이브러리 로드 확인
    if (!window.google?.accounts?.id) {
      reject(new Error(
        'Google 로그인 라이브러리가 로드되지 않았습니다.\n' +
        '페이지를 새로고침 후 다시 시도해주세요.'
      ));
      return;
    }
    
    console.log('[Google Login] GIS One Tap / 버튼 방식 사용');
    
    // Firebase 프로젝트의 Web Client ID
    // Firebase가 자동 생성하는 OAuth Client ID 형식: {PROJECT_NUMBER}-{HASH}.apps.googleusercontent.com
    // Firebase config의 apiKey에서 가져올 수도 있지만, 여기서는 직접 지정
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      // Client ID가 없으면 안내 메시지
      reject(new Error(
        'Google 로그인 설정이 필요합니다.\n\n' +
        '현재 도메인이 Firebase 승인 도메인에 등록되지 않아\n' +
        '대체 로그인 방식(GIS)을 사용하려 했으나,\n' +
        'Google OAuth Client ID가 설정되지 않았습니다.\n\n' +
        '해결 방법 (택 1):\n\n' +
        '방법 A - Firebase 승인 도메인 추가 (권장):\n' +
        `1. Firebase Console 접속\n` +
        `2. "airzeta-security-system" 프로젝트 선택\n` +
        `3. Authentication > 설정 > 승인된 도메인\n` +
        `4. "${window.location.hostname}" 추가\n` +
        `5. ⚠️ 중요: Google Cloud Console 확인\n` +
        `   → APIs & Services > Credentials\n` +
        `   → OAuth 2.0 Client ID 선택\n` +
        `   → 승인된 JavaScript 출처에\n` +
        `     "${window.location.origin}" 추가\n` +
        `   → 승인된 리디렉션 URI에\n` +
        `     "https://airzeta-security-system.firebaseapp.com/__/auth/handler" 확인\n` +
        `6. 5~10분 대기 후 페이지 새로고침`
      ));
      return;
    }
    
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          console.log('[Google Login] GIS 토큰 수신 완료');
          const credential = GoogleAuthProvider.credential(response.credential);
          const result = await signInWithCredential(auth, credential);
          const profile = await handleGoogleUserProfile(result.user);
          resolve(profile);
        } catch (err) {
          console.error('[Google Login] GIS credential 에러:', err);
          reject(new Error(`Google 로그인 처리 실패: ${err.message}`));
        }
      },
      auto_select: false,
      cancel_on_tap_outside: false
    });
    
    // 프롬프트 표시
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        console.warn('[Google Login] GIS 프롬프트가 표시되지 않음:', notification.getNotDisplayedReason());
        reject(new Error(
          'Google 로그인 팝업을 표시할 수 없습니다.\n' +
          '브라우저 설정에서 서드파티 쿠키를 허용하거나,\n' +
          '시크릿 모드를 사용하지 않는 상태에서 시도해주세요.'
        ));
      }
      if (notification.isSkippedMoment()) {
        console.warn('[Google Login] GIS 프롬프트 건너뜀:', notification.getSkippedReason());
        reject(new Error('Google 로그인이 취소되었습니다.'));
      }
    });
  });
};

// Google Redirect 결과 처리 (더 이상 사용하지 않지만 호환성 유지)
export const initGoogleRedirectResult = async () => {
  // GIS 방식에서는 redirect 결과 처리가 필요 없음
  return null;
};
