import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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