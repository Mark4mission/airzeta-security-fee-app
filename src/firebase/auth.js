import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
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

// 🆕 Google 로그인 함수
//
// [auth/unauthorized-domain 에러 해결]
//
// 이 에러는 현재 앱이 실행되는 도메인이 Firebase Console의
// "승인된 도메인" 목록에 등록되지 않았을 때 발생합니다.
//
// Firebase Console > Authentication > 설정 > 승인된 도메인에서
// 앱이 배포된 도메인(예: your-app.vercel.app)을 추가해야 합니다.
//
export const loginWithGoogle = async () => {
  const currentDomain = window.location.hostname;
  
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    console.log('[Google Login] signInWithPopup 시도...');
    console.log('[Google Login] 현재 도메인:', currentDomain);
    console.log('[Google Login] Auth 도메인:', auth.config?.authDomain);
    
    const result = await signInWithPopup(auth, provider);
    return await handleGoogleUserProfile(result.user);
    
  } catch (error) {
    console.error('[Google Login] 에러:', error.code, error.message);
    
    // 사용자가 팝업을 닫은 경우
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Google 로그인이 취소되었습니다.');
    }
    
    // 다른 팝업이 이미 열려있는 경우
    if (error.code === 'auth/cancelled-popup-request') {
      throw new Error('다른 로그인 팝업이 이미 열려 있습니다. 닫고 다시 시도해주세요.');
    }
    
    // 🔑 핵심: auth/unauthorized-domain 에러 처리
    if (error.code === 'auth/unauthorized-domain') {
      console.error(
        `[Google Login] 도메인 미승인 에러!\n` +
        `현재 도메인 "${currentDomain}"이 Firebase 승인 도메인에 등록되지 않았습니다.\n` +
        `Firebase Console > Authentication > 설정 > 승인된 도메인에 추가하세요.`
      );
      
      throw new Error(
        `현재 도메인 "${currentDomain}"이 승인되지 않았습니다.\n\n` +
        `해결 방법:\n` +
        `1. Firebase Console 접속\n` +
        `2. "airzeta-security-system" 프로젝트 선택\n` +
        `3. Authentication > 설정 > 승인된 도메인\n` +
        `4. "도메인 추가" 버튼 클릭\n` +
        `5. "${currentDomain}" 입력 후 추가\n` +
        `6. 페이지 새로고침 후 다시 시도`
      );
    }
    
    // auth/invalid-continue-uri 에러도 동일 원인
    if (error.code === 'auth/invalid-continue-uri') {
      throw new Error(
        `현재 도메인 "${currentDomain}"이 승인되지 않았습니다.\n\n` +
        `Firebase Console > Authentication > 설정 > 승인된 도메인에\n` +
        `"${currentDomain}"을 추가해주세요.`
      );
    }
    
    // 팝업 차단 시 redirect 폴백
    if (error.code === 'auth/popup-blocked') {
      console.warn('[Google Login] 팝업 차단됨, redirect 방식으로 전환...');
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithRedirect(auth, provider);
        return null;
      } catch (redirectError) {
        throw new Error(
          'Google 로그인 팝업이 차단되었습니다.\n' +
          '브라우저 설정에서 이 사이트의 팝업을 허용해주세요.'
        );
      }
    }
    
    // 기타 에러
    throw new Error(
      `Google 로그인 실패: ${error.message}\n` +
      `(에러 코드: ${error.code || 'unknown'})`
    );
  }
};

// Google Redirect 결과 처리
export const initGoogleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      console.log('[Google Login] Redirect 로그인 성공:', result.user.email);
      return await handleGoogleUserProfile(result.user);
    }
    return null;
  } catch (error) {
    console.error('[Google Login] Redirect 결과 에러:', error.code, error.message);
    return null;
  }
};
