/**
 * seed-test-data.mjs
 * 
 * 테스트 사용자 8명 + 브랜치 6개 + 1~5개월 Security Cost 데이터 생성
 * 
 * 실행: node scripts/seed-test-data.mjs
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  Timestamp
} from 'firebase/firestore';

// ============================================================
// Firebase Config (from deployed bundle)
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo",
  authDomain: "airzeta-security-system.firebaseapp.com",
  projectId: "airzeta-security-system",
  storageBucket: "airzeta-security-system.firebasestorage.app",
  messagingSenderId: "803391050005",
  appId: "1:803391050005:web:b79b059aad13ddeaf5591c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================
// Constants
// ============================================================
const TEST_PASSWORD = 'Test1234!';

const BRANCHES = [
  { name: 'ALASU', manager: 'Park Joonhyuk', currency: 'USD', paymentMethod: 'Bank Transfer' },
  { name: 'TYOSU', manager: 'Yamamoto Kenji', currency: 'JPY', paymentMethod: 'Bank Transfer' },
  { name: 'SINSU', manager: 'Lim Wei Ling', currency: 'SGD', paymentMethod: 'Bank Transfer' },
  { name: 'HKGSU', manager: 'Chan Siu Ming', currency: 'HKD', paymentMethod: 'Bank Transfer' },
  { name: 'BKKSU', manager: 'Pimchanok Srisai', currency: 'THB', paymentMethod: 'Cash' },
  { name: 'SFOSF', manager: 'David Kim', currency: 'USD', paymentMethod: 'Credit Card' }
];

const COST_ITEMS = [
  'Security Personnel Wages',
  'Equipment Maintenance',
  'Uniforms & Supplies',
  'Training & Certification',
  'Insurance Premiums',
  'Access Control Systems',
  'CCTV Monitoring',
  'Emergency Response Kit'
];

const PAYMENT_METHODS = ['Bank Transfer', 'Credit Card', 'Cash', 'Check', 'Online Payment'];

const CURRENCIES_BY_BRANCH = {
  'ALASU': 'USD',
  'TYOSU': 'JPY',
  'SINSU': 'SGD',
  'HKGSU': 'HKD',
  'BKKSU': 'THB',
  'SFOSF': 'USD'
};

// 통화별 현실적 단가 범위
const PRICE_RANGES = {
  USD: { min: 200, max: 15000 },
  JPY: { min: 30000, max: 2000000 },
  SGD: { min: 300, max: 20000 },
  HKD: { min: 1500, max: 120000 },
  THB: { min: 8000, max: 500000 }
};

// ============================================================
// Test Users (8명, 6개 브랜치에 무작위 배정)
// ============================================================
const TEST_USERS = [
  { email: 'test_atlanta@airzeta.com',    displayName: 'Test Atlanta User',     branch: 'ALASU', role: 'branch_user' },
  { email: 'test_tokyo@airzeta.com',      displayName: 'Test Tokyo User',       branch: 'TYOSU', role: 'branch_user' },
  { email: 'test_singapore@airzeta.com',  displayName: 'Test Singapore User',   branch: 'SINSU', role: 'branch_user' },
  { email: 'test_hongkong@airzeta.com',   displayName: 'Test HongKong User',    branch: 'HKGSU', role: 'branch_user' },
  { email: 'test_bangkok@airzeta.com',    displayName: 'Test Bangkok User',     branch: 'BKKSU', role: 'branch_user' },
  { email: 'test_sanfran@airzeta.com',    displayName: 'Test SanFrancisco User',branch: 'SFOSF', role: 'branch_user' },
  { email: 'test_multi01@airzeta.com',    displayName: 'Test Multi User 1',     branch: 'TYOSU', role: 'branch_user' },
  { email: 'test_admin01@airzeta.com',    displayName: 'Test Admin User',       branch: 'HQ',    role: 'hq_admin'   }
];

// ============================================================
// Helpers
// ============================================================
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset(arr, minCount, maxCount) {
  const count = randomInt(minCount, maxCount);
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/** 과거 N개월의 YYYY-MM 배열 반환 (현재 월 포함) */
function getRecentMonths(count) {
  const result = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    result.push(`${y}-${m}`);
  }
  return result;
}

/** 주어진 월의 랜덤 날짜에 대한 Firestore Timestamp 생성 */
function randomTimestampInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const day = randomInt(1, daysInMonth);
  const hour = randomInt(8, 20);     // 업무 시간대
  const minute = randomInt(0, 59);
  const second = randomInt(0, 59);
  return Timestamp.fromDate(new Date(y, m - 1, day, hour, minute, second));
}

/** 통화별 현실적 단가 생성 */
function generateUnitPrice(currency) {
  const range = PRICE_RANGES[currency] || PRICE_RANGES.USD;
  // 항목마다 다양한 범위 사용
  const tier = randomChoice(['low', 'mid', 'high']);
  switch (tier) {
    case 'low':  return randomFloat(range.min, range.min + (range.max - range.min) * 0.2);
    case 'mid':  return randomFloat(range.min + (range.max - range.min) * 0.2, range.min + (range.max - range.min) * 0.6);
    case 'high': return randomFloat(range.min + (range.max - range.min) * 0.6, range.max);
    default:     return randomFloat(range.min, range.max);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Step 1: 테스트 사용자 생성
// ============================================================
async function createTestUsers() {
  console.log('\n========================================');
  console.log('  Step 1: Creating Test Users (8)');
  console.log('========================================\n');

  const createdUsers = [];

  for (const userData of TEST_USERS) {
    try {
      // Firebase Auth에 사용자 생성
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, userData.email, TEST_PASSWORD);
        console.log(`  ✅ Created Auth user: ${userData.email}`);
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          console.log(`  ⏭️  Already exists: ${userData.email} (signing in...)`);
          userCredential = await signInWithEmailAndPassword(auth, userData.email, TEST_PASSWORD);
        } else {
          throw err;
        }
      }

      const uid = userCredential.user.uid;

      // Firestore 프로필 생성/업데이트
      const profile = {
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        branchName: userData.branch,
        active: true,
        createdAt: Timestamp.fromDate(new Date(2025, randomInt(0, 11), randomInt(1, 28))),
        lastLogin: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await setDoc(doc(db, 'users', uid), profile, { merge: true });
      console.log(`     📝 Profile: ${userData.displayName} → ${userData.branch} (${userData.role})`);

      createdUsers.push({ uid, ...userData });

      // Auth 세션 정리 (다음 유저 생성을 위해)
      await signOut(auth);
      await sleep(500); // rate limit 방지
    } catch (error) {
      console.error(`  ❌ Error for ${userData.email}:`, error.message);
    }
  }

  console.log(`\n  Total users created/updated: ${createdUsers.length}\n`);
  return createdUsers;
}

// ============================================================
// Step 2: 브랜치별 Security Cost 데이터 생성
// ============================================================
async function createSecurityCostData() {
  console.log('\n========================================');
  console.log('  Step 2: Creating Security Cost Data');
  console.log('========================================\n');

  // 관리자로 로그인 (Firestore 쓰기 권한)
  try {
    await signInWithEmailAndPassword(auth, 'test_admin01@airzeta.com', TEST_PASSWORD);
    console.log('  🔑 Signed in as test_admin01 for data seeding\n');
  } catch (e) {
    console.log('  ⚠️  Could not sign in as test_admin. Trying with first created user...');
    try {
      await signInWithEmailAndPassword(auth, TEST_USERS[0].email, TEST_PASSWORD);
    } catch (e2) {
      console.error('  ❌ Cannot authenticate for seeding:', e2.message);
      return;
    }
  }

  let totalDocs = 0;

  for (const branch of BRANCHES) {
    // 각 브랜치에 1~5개월 데이터
    const monthCount = randomInt(1, 5);
    const months = getRecentMonths(monthCount);
    const currency = CURRENCIES_BY_BRANCH[branch.name];
    
    console.log(`  🏢 ${branch.name} (${currency}) — ${monthCount} months`);

    for (const month of months) {
      // 한 달에 3~6개 비용 항목
      const selectedItems = randomSubset(COST_ITEMS, 3, 6);
      
      const items = selectedItems.map(itemName => {
        const unitPrice = generateUnitPrice(currency);
        const quantity = randomInt(1, 20);
        const estimatedCost = parseFloat((unitPrice * quantity).toFixed(2));
        
        // 과거 월은 actual cost도 있을 확률 높음
        const isPastMonth = month < getRecentMonths(1)[0];
        const hasActualCost = isPastMonth ? Math.random() < 0.85 : Math.random() < 0.3;
        
        // 실제 비용은 예상 대비 ±25% 변동
        let actualCost = 0;
        if (hasActualCost) {
          const variance = randomFloat(-0.25, 0.25);
          actualCost = parseFloat((estimatedCost * (1 + variance)).toFixed(2));
          // 가끔 0이 되지 않도록
          if (actualCost < 0) actualCost = estimatedCost * 0.8;
        }

        // 결제 방식 다양화
        const paymentMethod = randomChoice(PAYMENT_METHODS);

        return {
          item: itemName,
          unitPrice,
          quantity,
          estimatedCost,
          actualCost,
          currency,
          paymentMethod,
          notes: generateNote(itemName, hasActualCost)
        };
      });

      const totalEstimated = parseFloat(items.reduce((s, i) => s + i.estimatedCost, 0).toFixed(2));
      const totalActual = parseFloat(items.reduce((s, i) => s + i.actualCost, 0).toFixed(2));

      // submittedAt: 해당 월 내의 랜덤 날짜
      const submittedAt = randomTimestampInMonth(month);

      // submittedBy: 해당 브랜치의 테스트 유저
      const branchUser = TEST_USERS.find(u => u.branch === branch.name);
      const submittedBy = branchUser ? branchUser.email : 'test_admin01@airzeta.com';

      const submissionData = {
        branchName: branch.name,
        managerName: branch.manager,
        targetMonth: month,
        currency,
        krwExchangeRate: currency === 'USD' ? randomFloat(1350, 1480) :
                         currency === 'JPY' ? randomFloat(9.0, 10.5) :
                         currency === 'SGD' ? randomFloat(1020, 1120) :
                         currency === 'HKD' ? randomFloat(170, 195) :
                         currency === 'THB' ? randomFloat(38, 44) : null,
        items,
        totalEstimated,
        totalActual,
        submittedAt,
        submittedBy
      };

      try {
        await addDoc(collection(db, 'securityCosts'), submissionData);
        totalDocs++;
        const actLabel = totalActual > 0 
          ? `Act:${totalActual.toLocaleString()}`
          : 'Act:—';
        console.log(`     📊 ${month}  |  ${items.length} items  |  Est:${totalEstimated.toLocaleString()}  ${actLabel}  |  by ${submittedBy.split('@')[0]}`);
      } catch (err) {
        console.error(`     ❌ Error writing ${branch.name} ${month}:`, err.message);
      }

      await sleep(300); // rate limit
    }
    console.log('');
  }

  // 일부 브랜치에 동일 월 중복 제출 (overwrite 테스트)
  console.log('  🔄 Adding duplicate submissions for testing...');
  const dupBranch = randomChoice(BRANCHES);
  const dupMonth = getRecentMonths(2)[1]; // 지난 달
  const dupCurrency = CURRENCIES_BY_BRANCH[dupBranch.name];
  const dupItems = randomSubset(COST_ITEMS, 2, 4).map(itemName => {
    const unitPrice = generateUnitPrice(dupCurrency);
    const quantity = randomInt(1, 10);
    return {
      item: itemName,
      unitPrice,
      quantity,
      estimatedCost: parseFloat((unitPrice * quantity).toFixed(2)),
      actualCost: parseFloat((unitPrice * quantity * randomFloat(0.9, 1.15)).toFixed(2)),
      currency: dupCurrency,
      paymentMethod: randomChoice(PAYMENT_METHODS),
      notes: 'Revised submission'
    };
  });
  const dupTotalEst = parseFloat(dupItems.reduce((s, i) => s + i.estimatedCost, 0).toFixed(2));
  const dupTotalAct = parseFloat(dupItems.reduce((s, i) => s + i.actualCost, 0).toFixed(2));
  
  await addDoc(collection(db, 'securityCosts'), {
    branchName: dupBranch.name,
    managerName: dupBranch.manager,
    targetMonth: dupMonth,
    currency: dupCurrency,
    krwExchangeRate: null,
    items: dupItems,
    totalEstimated: dupTotalEst,
    totalActual: dupTotalAct,
    submittedAt: Timestamp.now(), // 최신 타임스탬프
    submittedBy: 'test_admin01@airzeta.com'
  });
  totalDocs++;
  console.log(`     📊 Duplicate: ${dupBranch.name} ${dupMonth} (${dupItems.length} items, newer timestamp)`);

  console.log(`\n  Total cost documents created: ${totalDocs}\n`);
  await signOut(auth);
}

/** 항목별 다양한 노트 생성 */
function generateNote(itemName, hasActual) {
  const notes = {
    'Security Personnel Wages': [
      'Includes overtime for 3 guards',
      'Night shift premium included',
      '2 new hires this month',
      'Holiday overtime included',
      ''
    ],
    'Equipment Maintenance': [
      'CCTV system quarterly maintenance',
      'Replaced 2 damaged sensors',
      'Annual calibration',
      'Firmware update required',
      ''
    ],
    'Uniforms & Supplies': [
      'Winter uniform order',
      'Replaced worn items for 5 staff',
      'New badge holders',
      '',
      ''
    ],
    'Training & Certification': [
      'Aviation security recertification',
      'First aid training - 8 staff',
      'New hire orientation program',
      'Online training platform license',
      ''
    ],
    'Insurance Premiums': [
      'Annual premium renewal',
      'Coverage increased per HQ directive',
      'Quarterly installment',
      '',
      ''
    ],
    'Access Control Systems': [
      'Card reader replacement',
      'Biometric scanner maintenance',
      'Software license renewal',
      '',
      ''
    ],
    'CCTV Monitoring': [
      'Cloud storage expansion',
      'Added 3 new camera positions',
      'Night vision upgrade',
      '',
      ''
    ],
    'Emergency Response Kit': [
      'Restocked first aid supplies',
      'Replaced expired items',
      'Added defibrillator maintenance',
      '',
      ''
    ]
  };
  
  const options = notes[itemName] || ['', '', 'Standard monthly cost'];
  const note = randomChoice(options);
  
  if (hasActual && note && Math.random() < 0.4) {
    return note + ' (adjusted after review)';
  }
  return note;
}

// ============================================================
// Step 3: 결과 확인
// ============================================================
async function verifySeedData() {
  console.log('\n========================================');
  console.log('  Step 3: Verification');
  console.log('========================================\n');

  // 아무 유저로 로그인
  try {
    await signInWithEmailAndPassword(auth, TEST_USERS[0].email, TEST_PASSWORD);
  } catch (e) {
    console.log('  ⚠️  Verification skipped (cannot sign in)');
    return;
  }

  // Users
  const usersSnap = await getDocs(collection(db, 'users'));
  const testUsers = usersSnap.docs.filter(d => d.data().email?.startsWith('test_'));
  console.log(`  👤 Test users in Firestore: ${testUsers.length}`);
  testUsers.forEach(d => {
    const data = d.data();
    console.log(`     ${data.email} → ${data.branchName} (${data.role})`);
  });

  // Security Costs
  const costsSnap = await getDocs(collection(db, 'securityCosts'));
  const allCosts = costsSnap.docs.map(d => d.data());
  const testCosts = allCosts.filter(c => c.submittedBy?.startsWith('test_'));
  
  console.log(`\n  📊 Total securityCosts docs: ${allCosts.length}`);
  console.log(`     From test users: ${testCosts.length}`);
  
  // 브랜치별 요약
  const branchSummary = {};
  testCosts.forEach(c => {
    if (!branchSummary[c.branchName]) {
      branchSummary[c.branchName] = { months: new Set(), totalEst: 0, totalAct: 0, docs: 0 };
    }
    branchSummary[c.branchName].months.add(c.targetMonth);
    branchSummary[c.branchName].totalEst += c.totalEstimated || 0;
    branchSummary[c.branchName].totalAct += c.totalActual || 0;
    branchSummary[c.branchName].docs++;
  });

  console.log('\n  Branch Summary:');
  console.log('  ─────────────────────────────────────────────────');
  Object.entries(branchSummary).sort().forEach(([name, data]) => {
    const monthList = [...data.months].sort().join(', ');
    console.log(`  ${name.padEnd(8)} | ${data.docs} docs | ${data.months.size} months | Est: ${data.totalEst.toLocaleString()} | Act: ${data.totalAct.toLocaleString()}`);
    console.log(`  ${' '.repeat(8)} | Months: ${monthList}`);
  });

  await signOut(auth);
  console.log('\n  ✅ Verification complete!\n');
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   AIRZETA Security App - Test Data Seed  ║');
  console.log('║   Date: 2026-02-21                       ║');
  console.log('╚══════════════════════════════════════════╝');

  try {
    await createTestUsers();
    await createSecurityCostData();
    await verifySeedData();

    console.log('╔══════════════════════════════════════════╗');
    console.log('║   🎉 Seed Complete!                      ║');
    console.log('║                                          ║');
    console.log('║   Test Login Credentials:                ║');
    console.log('║   Password: Test1234!                    ║');
    console.log('║                                          ║');
    TEST_USERS.forEach(u => {
      const line = `║   ${u.email.padEnd(38)}║`;
      console.log(line);
    });
    console.log('╚══════════════════════════════════════════╝');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }

  process.exit(0);
}

main();
