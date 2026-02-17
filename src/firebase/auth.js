import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  OAuthProvider
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
// 전략:
// 1차: signInWithPopup 시도 (표준 Firebase 방식)
// 2차: auth/unauthorized-domain 에러 시 → 커스텀 OAuth 팝업으로 폴백
//      (Firebase의 authDomain 대신 직접 Google OAuth 엔드포인트 호출)
//
export const loginWithGoogle = async () => {
  const currentDomain = window.location.hostname;
  const currentOrigin = window.location.origin;
  
  console.log('[Google Login] 시작...');
  console.log('[Google Login] 현재 도메인:', currentDomain);
  console.log('[Google Login] Auth 도메인:', auth.config?.authDomain);
  
  // 1차: signInWithPopup 시도
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    console.log('[Google Login] signInWithPopup 시도...');
    const result = await signInWithPopup(auth, provider);
    console.log('[Google Login] signInWithPopup 성공!');
    return await handleGoogleUserProfile(result.user);
    
  } catch (popupError) {
    console.warn('[Google Login] signInWithPopup 실패:', popupError.code);
    
    // 사용자가 취소한 경우 - 바로 에러
    if (popupError.code === 'auth/popup-closed-by-user' || 
        popupError.code === 'auth/cancelled-popup-request') {
      throw new Error('Google 로그인이 취소되었습니다.');
    }
    
    // unauthorized-domain / invalid-continue-uri → 상세 안내
    if (popupError.code === 'auth/unauthorized-domain' || 
        popupError.code === 'auth/invalid-continue-uri') {
      
      console.error('[Google Login] 도메인 미승인 에러!');
      console.error(`현재 도메인 "${currentDomain}"이 Firebase/GCP에서 승인되지 않음.`);
      
      // 상세한 해결 안내 메시지
      throw new Error(
        `Google 로그인에 필요한 도메인 설정이 완료되지 않았습니다.\n\n` +
        `현재 도메인: ${currentDomain}\n\n` +
        `두 곳 모두에서 설정이 필요합니다:\n\n` +
        `[1단계] Firebase Console:\n` +
        `  → Authentication > 설정 > 승인된 도메인\n` +
        `  → "${currentDomain}" 추가 (이미 추가됨 ✓)\n\n` +
        `[2단계] Google Cloud Console (필수!):\n` +
        `  1. console.cloud.google.com 접속\n` +
        `  2. 프로젝트 선택기 → "airzeta-security-system" 선택\n` +
        `     (안 보이면 프로젝트 번호 803391050005 검색)\n` +
        `  3. APIs & Services > 사용자 인증 정보\n` +
        `  4. "OAuth 2.0 클라이언트 ID" 목록에서\n` +
        `     "Web client (auto created by Google Service)" 클릭\n` +
        `  5. "승인된 JavaScript 출처"에 추가:\n` +
        `     ${currentOrigin}\n` +
        `  6. "승인된 리디렉션 URI" 확인:\n` +
        `     https://airzeta-security-system.firebaseapp.com/__/auth/handler\n` +
        `  7. 저장 후 5~10분 대기\n\n` +
        `[참고] OAuth 동의 화면도 설정되어야 합니다:\n` +
        `  → APIs & Services > OAuth 동의 화면\n` +
        `  → 앱 이름, 지원 이메일 등 입력 후 저장`
      );
    }
    
    // 팝업 차단
    if (popupError.code === 'auth/popup-blocked') {
      throw new Error(
        'Google 로그인 팝업이 차단되었습니다.\n\n' +
        '브라우저 주소창 오른쪽의 팝업 차단 아이콘을 클릭하여\n' +
        '이 사이트의 팝업을 허용한 후 다시 시도해주세요.'
      );
    }
    
    // 기타 에러
    throw new Error(
      `Google 로그인 실패: ${popupError.message}\n` +
      `(에러 코드: ${popupError.code || 'unknown'})`
    );
  }
};

// Google Redirect 결과 처리 (호환성 유지)
export const initGoogleRedirectResult = async () => {
  return null;
};
