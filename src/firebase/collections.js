import { db } from './config';
import { auth } from './config';
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query, 
  where,
  serverTimestamp
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

// 전체 Security Costs 조회 (관리자 대시보드용)
export const getAllSecurityCosts = async () => {
  try {
    await ensureAuthenticated();
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.SECURITY_COSTS));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching all security costs:', error);
    throw error;
  }
};

// 특정 브랜치의 연도별 Security Costs 조회 (복합 인덱스 필요 없는 방식)
export const getSecurityCostsByBranchYear = async (branch, year) => {
  try {
    await ensureAuthenticated();
    
    // 복합 인덱스 문제를 피하기 위해 branchName만으로 쿼리 후 클라이언트에서 필터링
    const q = query(
      collection(db, COLLECTIONS.SECURITY_COSTS),
      where('branchName', '==', branch)
    );
    const querySnapshot = await getDocs(q);
    const allDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // 클라이언트 사이드에서 연도 필터링
    const filtered = allDocs.filter(d => {
      if (!d.targetMonth) return false;
      return d.targetMonth.startsWith(year);
    });
    
    console.log(`[getSecurityCostsByBranchYear] branch=${branch}, year=${year}, total=${allDocs.length}, filtered=${filtered.length}`);
    return filtered;
  } catch (error) {
    console.error('Error fetching branch year costs:', error);
    throw error;
  }
};

// 특정 브랜치+월의 Security Costs 전체 삭제 (관리자 전용)
export const deleteSecurityCostsByBranchMonth = async (branch, month) => {
  try {
    await ensureAuthenticated();
    
    console.log(`[Delete] ${branch} - ${month} 비용 데이터 삭제 시작...`);
    
    const q = query(
      collection(db, COLLECTIONS.SECURITY_COSTS),
      where('branchName', '==', branch),
      where('targetMonth', '==', month)
    );
    
    const querySnapshot = await getDocs(q);
    const deleteCount = querySnapshot.docs.length;
    
    if (deleteCount === 0) {
      console.log(`[Delete] ${branch} - ${month}: 삭제할 문서 없음`);
      return 0;
    }
    
    // 모든 문서 삭제
    const deletePromises = querySnapshot.docs.map(d => 
      deleteDoc(doc(db, COLLECTIONS.SECURITY_COSTS, d.id))
    );
    await Promise.all(deletePromises);
    
    console.log(`[Delete] ${branch} - ${month}: ${deleteCount}건 삭제 완료`);
    return deleteCount;
  } catch (error) {
    console.error('[Delete] 비용 데이터 삭제 에러:', error);
    throw error;
  }
};

// 브랜치 매니저 이름 업데이트 (제출 시 동기화)
export const updateBranchManager = async (branchName, newManager) => {
  try {
    await ensureAuthenticated();
    
    const branchRef = doc(db, COLLECTIONS.BRANCH_CODES, branchName);
    const branchDoc = await getDoc(branchRef);
    
    if (branchDoc.exists()) {
      await updateDoc(branchRef, {
        manager: newManager,
        updatedAt: serverTimestamp()
      });
      console.log(`[Settings] 브랜치 매니저 업데이트: ${branchName} → ${newManager}`);
      return true;
    } else {
      console.warn(`[Settings] 브랜치 문서 없음: ${branchName}`);
      return false;
    }
  } catch (error) {
    console.error('[Settings] 매니저 업데이트 에러:', error);
    return false;
  }
};

// ============================================================
// Settings 저장/로드 함수 (Firestore 연동)
// ============================================================

// Firestore 'settings' 컬렉션에 앱 설정 저장
const SETTINGS_DOC_ID = 'appSettings';

/**
 * Settings를 Firestore에 저장
 * branches → branchCodes 컬렉션 (개별 문서)
 * costItems, currencies, paymentMethods → settings/appSettings 문서
 */
export const saveSettingsToFirestore = async (settings) => {
  try {
    await ensureAuthenticated();
    
    console.log('[Settings] Firestore 저장 시작...');
    
    // 1. branches → branchCodes 컬렉션에 저장 (기존 구조 유지)
    await saveBranchesToFirestore(settings.branches || []);
    
    // 2. costItems, currencies, paymentMethods → settings 문서에 저장
    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(settingsRef, {
      costItems: settings.costItems || [],
      currencies: settings.currencies || [],
      paymentMethods: settings.paymentMethods || [],
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('[Settings] Firestore 저장 완료');
    return { success: true };
  } catch (error) {
    console.error('[Settings] Firestore 저장 에러:', error);
    throw error;
  }
};

/**
 * branches 배열을 branchCodes 컬렉션에 동기화
 * - 새 브랜치: 추가
 * - 기존 브랜치: 업데이트 (manager, currency, paymentMethod 포함)
 * - 삭제된 브랜치: 삭제
 */
const saveBranchesToFirestore = async (branches) => {
  // 기존 branchCodes 가져오기
  const existingSnapshot = await getDocs(collection(db, COLLECTIONS.BRANCH_CODES));
  const existingBranches = {};
  existingSnapshot.docs.forEach(d => {
    existingBranches[d.id] = d.data();
  });
  
  // UI에서 온 브랜치 이름 목록
  const uiBranchNames = new Set(branches.map(b => b.name).filter(Boolean));
  
  // 새 브랜치 추가 / 기존 브랜치 업데이트
  for (const branch of branches) {
    if (!branch.name) continue;
    
    const branchRef = doc(db, COLLECTIONS.BRANCH_CODES, branch.name);
    const existingData = existingBranches[branch.name];
    
    if (existingData) {
      // 기존 브랜치 업데이트
      await updateDoc(branchRef, {
        branchName: branch.name,
        manager: branch.manager || '',
        currency: branch.currency || 'USD',
        paymentMethod: branch.paymentMethod || '',
        active: true,
        updatedAt: serverTimestamp()
      });
      console.log(`[Settings] 브랜치 업데이트: ${branch.name}`);
    } else {
      // 새 브랜치 추가
      await setDoc(branchRef, {
        branchName: branch.name,
        branchCode: branch.branchCode || '',
        manager: branch.manager || '',
        currency: branch.currency || 'USD',
        paymentMethod: branch.paymentMethod || '',
        active: true,
        createdAt: serverTimestamp()
      });
      console.log(`[Settings] 새 브랜치 추가: ${branch.name}`);
    }
  }
  
  // 삭제된 브랜치 처리 (UI에 없는 기존 브랜치)
  for (const existingName of Object.keys(existingBranches)) {
    if (!uiBranchNames.has(existingName)) {
      await deleteDoc(doc(db, COLLECTIONS.BRANCH_CODES, existingName));
      console.log(`[Settings] 브랜치 삭제: ${existingName}`);
    }
  }
};

// ============================================================
// Exchange Rate 관련 함수 (월별 환율 테이블)
// ============================================================

/**
 * 특정 월의 환율 데이터를 Firestore에 저장 (기존 데이터 덮어쓰기)
 * @param {string} yearMonth - '2026-01' 형태
 * @param {Array} rates - [{currency, rate, ratio}] 형태의 환율 배열
 * @param {string} fileName - 업로드한 파일명
 */
export const saveExchangeRates = async (rates, fileName, yearMonth) => {
  try {
    await ensureAuthenticated();
    const ratesRef = doc(db, 'exchangeRates', yearMonth);
    await setDoc(ratesRef, {
      rates,
      fileName,
      yearMonth,
      uploadedAt: serverTimestamp()
    });
    console.log(`[ExchangeRate] ${yearMonth}: ${rates.length}건 환율 저장 완료 (${fileName})`);
    return { success: true };
  } catch (error) {
    console.error('[ExchangeRate] 저장 에러:', error);
    throw error;
  }
};

/**
 * 특정 연도의 모든 월별 환율 데이터 로드
 * @param {string} year - '2026' 형태
 * @returns {Object} { '2026-01': { rates, fileName, ... }, '2026-02': {...}, ... }
 */
export const loadExchangeRatesByYear = async (year) => {
  try {
    await ensureAuthenticated();
    const snapshot = await getDocs(collection(db, 'exchangeRates'));
    const result = {};
    snapshot.docs.forEach(d => {
      const data = d.data();
      if (d.id.startsWith(year)) {
        result[d.id] = data;
      }
    });
    console.log(`[ExchangeRate] ${year}년 환율 로드: ${Object.keys(result).length}개월`);
    return result;
  } catch (error) {
    console.error('[ExchangeRate] 로드 에러:', error);
    return {};
  }
};

/**
 * Firestore에서 단일 환율 데이터 로드 (하위 호환)
 */
export const loadExchangeRates = async () => {
  try {
    await ensureAuthenticated();
    const ratesRef = doc(db, 'settings', 'exchangeRates');
    const ratesDoc = await getDoc(ratesRef);
    if (ratesDoc.exists()) {
      return ratesDoc.data();
    }
    return null;
  } catch (error) {
    console.error('[ExchangeRate] 로드 에러:', error);
    return null;
  }
};

/**
 * Firestore에서 Settings 로드
 * branchCodes 컬렉션 + settings/appSettings 문서를 합쳐서 반환
 */
export const loadSettingsFromFirestore = async () => {
  try {
    await ensureAuthenticated();
    
    console.log('[Settings] Firestore에서 로드 시작...');
    
    // 1. branches 로드 (branchCodes 컬렉션)
    const branchesSnapshot = await getDocs(collection(db, COLLECTIONS.BRANCH_CODES));
    const branches = branchesSnapshot.docs.map(d => {
      const data = d.data();
      // name 필드: 문서 ID를 우선 사용 (Settings UI에서 저장할 때 문서 ID = branch name)
      // 기존 데이터에서 branchName이 "Atlanta" 등 다른 이름일 수 있으므로
      // 문서 ID를 기본 name으로 사용
      return {
        ...data,
        name: d.id,  // 문서 ID가 곧 branch name
        manager: data.manager || '',
        currency: data.currency || 'USD',
        paymentMethod: data.paymentMethod || '',
        branchCode: data.branchCode || '',
        id: d.id
      };
    });
    
    // 2. settings 문서 로드
    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const settingsDoc = await getDoc(settingsRef);
    
    let costItems = [];
    let currencies = [];
    let paymentMethods = [];
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      costItems = data.costItems || [];
      currencies = data.currencies || [];
      paymentMethods = data.paymentMethods || [];
    }
    
    const result = {
      branches,
      costItems,
      currencies,
      paymentMethods
    };
    
    console.log('[Settings] Firestore 로드 완료:', {
      branches: branches.length,
      costItems: costItems.length,
      currencies: currencies.length,
      paymentMethods: paymentMethods.length
    });
    
    return result;
  } catch (error) {
    console.error('[Settings] Firestore 로드 에러:', error);
    throw error;
  }
};
