import { db } from './config';
import { auth } from './config';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where
} from 'firebase/firestore';

export { db };

export const COLLECTIONS = {
  BRANCH_CODES: 'branchCodes',
  SECURITY_COSTS: 'securityCosts',
  USERS: 'users',
  REPORTS: 'reports'
};

/**
 * Wait for authentication to initialize
 * @returns {Promise<User|null>} The authenticated user or null
 */
const waitForAuth = () => {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

/**
 * Check if user is authenticated
 * @throws {Error} If user is not authenticated
 */
const ensureAuthenticated = async () => {
  const user = await waitForAuth();
  if (!user) {
    throw new Error('User must be authenticated to access this resource');
  }
  return user;
};

// Branches 조회 (인증 대기 로직 추가)
export const getAllBranches = async () => {
  try {
    // 인증 대기
    await ensureAuthenticated();
    
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.BRANCH_CODES));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching branches:', error);
    throw error;
  }
};

// 지점별 Security Costs 조회 (인증 대기 로직 추가)
export const getSecurityCostsByBranch = async (branch, month) => {
  try {
    // 인증 대기
    await ensureAuthenticated();
    
    console.log('Fetching data for:', { branch, month });
    
    const q = query(
      collection(db, COLLECTIONS.SECURITY_COSTS),
      where('branchName', '==', branch),
      where('targetMonth', '==', month)
    );
    
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log('Found documents:', results.length);
    
    return results.sort((a, b) => {
      const aTime = a.submittedAt?.seconds || 0;
      const bTime = b.submittedAt?.seconds || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error fetching security costs:', error);
    throw error;
  }
};

// Security Cost 제출 (인증 대기 로직 추가)
export const submitSecurityCost = async (data) => {
  try {
    // 인증 대기
    await ensureAuthenticated();
    
    await addDoc(collection(db, COLLECTIONS.SECURITY_COSTS), data);
  } catch (error) {
    console.error('Error submitting security cost:', error);
    throw error;
  }
};
