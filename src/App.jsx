import React, { useState, useEffect } from 'react';
import { Shield, DollarSign, Calendar, User, Settings as SettingsIcon, LogOut, Plus, Trash2 } from 'lucide-react';
import './App.css';
import { serverTimestamp } from 'firebase/firestore';
import { 
  getAllBranches, 
  getSecurityCostsByBranch, 
  submitSecurityCost,
  loadSettingsFromFirestore 
} from './firebase/collections';
import { 
  listenToAuthChanges, 
  logoutUser, 
  isAdmin,
  updateUserPreferences 
} from './firebase/auth';
import Settings from './components/Settings';
import Login from './components/Login';
import BranchSelection from './components/BranchSelection';

// 색상 상수
const COLORS = {
  primary: '#1B3A7D',
  secondary: '#E94560',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  background: '#f3f4f6',
  surface: '#ffffff',
  text: {
    primary: '#1f2937',
    secondary: '#6b7280',
    light: '#9ca3af'
  }
};

// 통화 기호 매핑
const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  KRW: '₩',
  JPY: '¥',
  SGD: 'S$',
  HKD: 'HK$',
  THB: '฿',
  GBP: '£',
  CNY: 'CN¥'
};

// 숫자 3자리 쉼표 포맷 유틸리티
const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const formatNumberInt = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Math.round(Number(num)).toLocaleString('en-US');
};

// 입력 필드용 포맷: 값이 있으면 쉼표 포맷, 없으면 빈 문자열
const formatInputDisplay = (val, decimals = 2) => {
  if (val === '' || val === null || val === undefined) return '';
  const num = parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
};

// 입력에서 쉼표 제거하고 숫자 추출
const stripCommas = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  return String(val).replace(/,/g, '');
};

// 기본 설정값
const DEFAULT_SETTINGS = {
  branches: [
    { name: 'Seoul Branch', address: '123 Gangnam-gu, Seoul', manager: 'Kim Min-soo', phone: '+82-2-1234-5678', currency: 'KRW' },
    { name: 'Tokyo Branch', address: '456 Shibuya, Tokyo', manager: 'Tanaka Yuki', phone: '+81-3-1234-5678', currency: 'JPY' },
    { name: 'Singapore Branch', address: '789 Marina Bay, Singapore', manager: 'Lee Wei Ming', phone: '+65-1234-5678', currency: 'SGD' },
    { name: 'Hong Kong Branch', address: '321 Central, Hong Kong', manager: 'Wong Ka Fai', phone: '+852-1234-5678', currency: 'HKD' },
    { name: 'Bangkok Branch', address: '654 Sukhumvit, Bangkok', manager: 'Somchai Prasert', phone: '+66-2-1234-5678', currency: 'THB' }
  ],
  costItems: [
    { name: 'Security Personnel Wages', category: 'Labor', description: 'Monthly wages for security staff' },
    { name: 'Equipment Maintenance', category: 'Equipment', description: 'CCTV, sensors, alarm systems' },
    { name: 'Uniforms & Supplies', category: 'Supplies', description: 'Security uniforms and gear' },
    { name: 'Training & Certification', category: 'Training', description: 'Staff training programs' },
    { name: 'Insurance Premiums', category: 'Insurance', description: 'Liability insurance' }
  ],
  currencies: ['USD', 'EUR', 'KRW', 'JPY', 'SGD', 'HKD', 'THB'],
  paymentMethods: ['Bank Transfer', 'Credit Card', 'Cash', 'Check', 'Online Payment']
};

function App() {
  // 인증 관련 상태
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 폼 데이터 상태 (🔥 branchCode 제거)
  const [branchName, setBranchName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [krwExchangeRate, setKrwExchangeRate] = useState('');
  const [managerName, setManagerName] = useState('');
  const [targetMonth, setTargetMonth] = useState('');
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState('');
  const [costItems, setCostItems] = useState([
    { item: '', unitPrice: '', quantity: '', estimatedCost: '', actualCost: '', currency: 'USD', paymentMethod: '', notes: '' }
  ]);

  // 설정 상태
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('securityAppSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // UI 상태
  const [showSettings, setShowSettings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 인증 상태 리스너
  useEffect(() => {
    const unsubscribe = listenToAuthChanges((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Branch 데이터 로드 (인증 후에만 실행) - Firestore에서 전체 Settings 로드
  useEffect(() => {
    const loadSettings = async () => {
      // 인증이 완료되고 사용자가 있을 때만 실행
      if (!authLoading && currentUser) {
        try {
          console.log('[App] Firestore에서 Settings 로드 시작...');
          const firestoreSettings = await loadSettingsFromFirestore();
          
          // Firestore에 데이터가 있으면 사용, 없으면 기본값/localStorage 유지
          const merged = { ...settings };
          
          if (firestoreSettings.branches && firestoreSettings.branches.length > 0) {
            merged.branches = firestoreSettings.branches;
          }
          if (firestoreSettings.costItems && firestoreSettings.costItems.length > 0) {
            merged.costItems = firestoreSettings.costItems;
          }
          if (firestoreSettings.currencies && firestoreSettings.currencies.length > 0) {
            merged.currencies = firestoreSettings.currencies;
          }
          if (firestoreSettings.paymentMethods && firestoreSettings.paymentMethods.length > 0) {
            merged.paymentMethods = firestoreSettings.paymentMethods;
          }
          
          setSettings(merged);
          console.log('[App] Settings 로드 완료:', {
            branches: merged.branches.length,
            costItems: merged.costItems.length
          });
        } catch (error) {
          console.error('[App] Firestore Settings 로드 실패, localStorage 사용:', error);
        }
      }
    };
    loadSettings();
  }, [authLoading, currentUser]); // 의존성 배열 추가

  // Settings 변경사항을 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('securityAppSettings', JSON.stringify(settings));
  }, [settings]);

  // 메시지 자동 제거
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // 기본 월 설정
  useEffect(() => {
    if (!targetMonth) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      setTargetMonth(`${year}-${month}`);
    }
  }, [targetMonth]);

  // branch_user 자동 지점 설정
  useEffect(() => {
    if (currentUser && currentUser.role === 'branch_user' && currentUser.branchName) {
      console.log('[App] branch_user 자동 설정:', currentUser.branchName);
      console.log('[App] settings.branches:', settings.branches.map(b => b.name));
      
      setBranchName(currentUser.branchName);
      // name 또는 id(문서 ID)로 매칭 시도
      const branch = settings.branches.find(
        b => b.name === currentUser.branchName || b.id === currentUser.branchName
      );
      if (branch) {
        // 사용자 선호값이 있으면 우선 사용, 없으면 브랜치 기본값
        const userCurrency = currentUser.preferredCurrency || branch.currency || 'USD';
        const userPayment = currentUser.preferredPaymentMethod || branch.paymentMethod || '';
        setCurrency(userCurrency);
        setManagerName(branch.manager || '');
        setDefaultPaymentMethod(userPayment);
        console.log('[App] 브랜치 매칭 성공:', branch.name, '매니저:', branch.manager, '통화:', userCurrency, '결제:', userPayment);
      } else {
        console.warn('[App] 브랜치 매칭 실패. branchName:', currentUser.branchName);
      }
    }
  }, [currentUser, settings.branches]);

  // Manager Name & Currency & PaymentMethod 자동 채우기
  useEffect(() => {
    if (branchName && currentUser?.role === 'hq_admin') {
      const branch = settings.branches.find(b => b.name === branchName);
      if (branch) {
        setManagerName(branch.manager || '');
        // 관리자도 선호값 우선, 없으면 브랜치 기본값
        const userCurrency = currentUser.preferredCurrency || branch.currency || 'USD';
        const userPayment = currentUser.preferredPaymentMethod || branch.paymentMethod || '';
        setCurrency(userCurrency);
        setDefaultPaymentMethod(userPayment);
      }
    }
  }, [branchName, settings.branches, currentUser]);

  // 로그아웃
  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setMessage({ type: 'success', text: 'Successfully logged out' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Logout failed' });
    }
  };

  // Branch Name 변경
  const handleBranchChange = (selectedBranchName) => {
    setBranchName(selectedBranchName);
    const branch = settings.branches.find(b => b.name === selectedBranchName);
    if (branch) {
      setCurrency(branch.currency || 'USD');
      setManagerName(branch.manager || '');
      setDefaultPaymentMethod(branch.paymentMethod || '');
    } else {
      setCurrency('USD');
      setDefaultPaymentMethod('');
    }
  };

  // Settings 저장
  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    setShowSettings(false);
    setMessage({ type: 'success', text: 'Settings saved successfully!' });
  };

  // Currency 변경 핸들러 (사용자 선호 저장)
  const handleCurrencyChange = (index, value) => {
    const newItems = [...costItems];
    newItems[index].currency = value;
    setCostItems(newItems);
    // 사용자가 수동으로 변경 시 Firestore에 선호값 저장
    if (currentUser?.uid) {
      updateUserPreferences(currentUser.uid, { preferredCurrency: value }).catch(err =>
        console.error('[App] Currency 선호 저장 실패:', err)
      );
    }
  };

  // PaymentMethod 변경 핸들러 (사용자 선호 저장)
  const handlePaymentMethodChange = (index, value) => {
    const newItems = [...costItems];
    newItems[index].paymentMethod = value;
    setCostItems(newItems);
    setDefaultPaymentMethod(value);
    // 사용자가 수동으로 변경 시 Firestore에 선호값 저장
    if (currentUser?.uid) {
      updateUserPreferences(currentUser.uid, { preferredPaymentMethod: value }).catch(err =>
        console.error('[App] PaymentMethod 선호 저장 실패:', err)
      );
    }
  };

  // 입력 변경 (unitPrice/quantity → estimatedCost 자동 계산 포함)
  const handleInputChange = (index, field, value) => {
    const newItems = [...costItems];
    newItems[index][field] = value;

    // unitPrice 또는 quantity 변경 시 estimatedCost 자동 계산
    if (field === 'unitPrice' || field === 'quantity') {
      const price = parseFloat(newItems[index].unitPrice) || 0;
      const qty = parseFloat(newItems[index].quantity) || 0;
      newItems[index].estimatedCost = (price * qty) > 0 ? (price * qty).toString() : '';
    }

    setCostItems(newItems);
  };

  // 비용 항목 변경
  const handleItemChange = async (index, itemName) => {
    const newItems = [...costItems];
    newItems[index].item = itemName;

    // defaultRate 제거됨 - 이전 데이터에서만 unitPrice 자동 채움

    if (branchName && targetMonth) {
      try {
        const previousData = await getSecurityCostsByBranch(branchName, targetMonth);
        if (previousData.length > 0) {
          const matchingItem = previousData[0].items?.find(i => i.item === itemName);
          if (matchingItem) {
            // 이전 데이터에 unitPrice/quantity가 있으면 사용, 없으면 estimatedCost 사용
            if (matchingItem.unitPrice) {
              newItems[index].unitPrice = matchingItem.unitPrice?.toString() || newItems[index].unitPrice;
              newItems[index].quantity = matchingItem.quantity?.toString() || '';
              const price = parseFloat(newItems[index].unitPrice) || 0;
              const qty = parseFloat(newItems[index].quantity) || 0;
              newItems[index].estimatedCost = (price * qty) > 0 ? (price * qty).toString() : '';
            } else if (matchingItem.estimatedCost) {
              newItems[index].estimatedCost = matchingItem.estimatedCost?.toString() || '';
            }
            newItems[index].paymentMethod = matchingItem.paymentMethod || '';
          }
        }
      } catch (error) {
        console.error('Error loading previous data:', error);
      }
    }

    setCostItems(newItems);
  };

  // 비용 항목 추가
  const handleAddItem = () => {
    setCostItems([...costItems, { 
      item: '', 
      unitPrice: '',
      quantity: '',
      estimatedCost: '', 
      actualCost: '', 
      currency: currency, 
      paymentMethod: defaultPaymentMethod, 
      notes: '' 
    }]);
  };

  // 비용 항목 제거
  const handleRemoveItem = (index) => {
    if (costItems.length > 1) {
      setCostItems(costItems.filter((_, i) => i !== index));
    }
  };

  // 이전 데이터 로드
  const handleLoadPreviousData = async () => {
    if (!branchName || !targetMonth) {
      setMessage({ type: 'warning', text: 'Please select branch and month first' });
      return;
    }

    try {
      const previousData = await getSecurityCostsByBranch(branchName, targetMonth);
      if (previousData.length > 0) {
        const latestData = previousData[0];
        if (latestData.items && latestData.items.length > 0) {
          setCostItems(latestData.items.map(item => ({
            ...item,
            unitPrice: item.unitPrice?.toString() || '',
            quantity: item.quantity?.toString() || '',
            estimatedCost: item.estimatedCost?.toString() || '',
            actualCost: '',
            currency: item.currency || currency
          })));
          setMessage({ type: 'success', text: 'Previous data loaded successfully!' });
        }
      } else {
        setMessage({ type: 'info', text: 'No previous data found for this branch and month' });
      }
    } catch (error) {
      console.error('Error loading previous data:', error);
      setMessage({ type: 'error', text: 'Failed to load previous data' });
    }
  };

  // 날짜 기반 입력 제한
  const canEditEstimatedCost = () => {
    if (!targetMonth) return true;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const [targetYear, targetMonthNum] = targetMonth.split('-').map(Number);
    
    if (targetYear > currentYear) return false;
    if (targetYear === currentYear && targetMonthNum > currentMonth) return false;
    
    return true;
  };

  const canEditActualCost = () => {
    if (!targetMonth) return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    
    const [targetYear, targetMonthNum] = targetMonth.split('-').map(Number);
    
    if (targetYear < currentYear) return true;
    if (targetYear === currentYear && targetMonthNum < currentMonth) return true;
    
    if (targetYear === currentYear && targetMonthNum === currentMonth) {
      return currentDay >= 28;
    }
    
    return false;
  };

  // 환율 변환
  const convertToKRW = (amount, itemCurrency) => {
    if (!krwExchangeRate || !amount) return null;
    const rate = parseFloat(krwExchangeRate);
    const amt = parseFloat(amount);
    if (isNaN(rate) || isNaN(amt)) return null;
    
    if (itemCurrency === 'KRW') return amt;
    
    return amt * rate;
  };

  // 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canEditEstimatedCost()) {
      setMessage({ 
        type: 'error', 
        text: 'Estimated Cost can only be entered for current or past months' 
      });
      // 🔥 메시지 위치로 스크롤
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (costItems.some(item => item.actualCost && !canEditActualCost())) {
      setMessage({ 
        type: 'error', 
        text: 'Actual Cost can only be entered after the 28th of the month' 
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!branchName || !managerName || !targetMonth) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const validItems = costItems.filter(item => 
      item.item && (item.estimatedCost || item.actualCost || (item.unitPrice && item.quantity))
    );

    if (validItems.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one cost item' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    try {
      // 🔥 branchCode 제거
      const submissionData = {
        branchName,
        managerName,
        targetMonth,
        currency,
        krwExchangeRate: krwExchangeRate ? parseFloat(krwExchangeRate) : null,
        items: validItems.map(item => ({
          item: item.item,
          unitPrice: parseFloat(item.unitPrice) || 0,
          quantity: parseFloat(item.quantity) || 0,
          estimatedCost: parseFloat(item.estimatedCost) || 0,
          actualCost: parseFloat(item.actualCost) || 0,
          currency: item.currency || currency,
          paymentMethod: item.paymentMethod,
          notes: item.notes
        })),
        totalEstimated: calculateTotalEstimated(),
        totalActual: calculateTotalActual(),
        submittedAt: serverTimestamp(),
        submittedBy: currentUser?.email || 'unknown'
      };

      await submitSecurityCost(submissionData);

      setMessage({ type: 'success', text: 'Security cost submitted successfully!' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // 폼 초기화
      if (currentUser?.role === 'hq_admin') {
        setBranchName('');
        setManagerName('');
      }
      setCostItems([{ 
        item: '', 
        unitPrice: '',
        quantity: '',
        estimatedCost: '', 
        actualCost: '', 
        currency: currency, 
        paymentMethod: defaultPaymentMethod, 
        notes: '' 
      }]);

    } catch (error) {
      console.error('Submission error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to submit data' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 총 예상 비용
  const calculateTotalEstimated = () => {
    return costItems.reduce((sum, item) => {
      const cost = parseFloat(item.estimatedCost) || 0;
      return sum + cost;
    }, 0);
  };

  // 총 실제 비용
  const calculateTotalActual = () => {
    return costItems.reduce((sum, item) => {
      const cost = parseFloat(item.actualCost) || 0;
      return sum + cost;
    }, 0);
  };

  // 로딩 중
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${COLORS.primary} 0%, #0f2557 100%)`
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid rgba(255,255,255,0.3)',
          borderTop: '5px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  // 로그인되지 않은 경우
  if (!currentUser) {
    return <Login />;
  }

  // 브랜치 미선택 사용자 → BranchSelection 화면
  // hq_admin은 브랜치 선택 없이 바로 메인 화면으로
  const needsBranchSelection = currentUser.role !== 'hq_admin' && !currentUser.branchName;

  if (needsBranchSelection) {
    return (
      <BranchSelection
        currentUser={currentUser}
        onBranchSelected={(selectedBranch) => {
          // currentUser 갱신 → 메인 화면으로 전환
          setCurrentUser(prev => ({
            ...prev,
            branchName: selectedBranch
          }));
        }}
      />
    );
  }

  // 메인 앱 UI
  return (
    <div style={{ minHeight: '100vh', background: COLORS.background }}>
      {/* 헤더 */}
      <header style={{
        background: `linear-gradient(135deg, ${COLORS.primary} 0%, #0f2557 100%)`,
        color: 'white',
        padding: '1rem 2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* 🔥 Shield 아이콘 로고 */}
          <div style={{
            width: '50px',
            height: '50px',
            background: 'linear-gradient(135deg, #E94560 0%, #d63d54 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            <Shield size={28} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, lineHeight: 1.2 }}>
              Branch Security Cost Submission
            </h1>
            <p style={{ fontSize: '0.75rem', opacity: 0.9, margin: '0.25rem 0 0 0' }}>
              {currentUser.email} | {currentUser.role === 'hq_admin' ? '🔑 Administrator' : '👤 User'}
              {currentUser.role === 'branch_user' && ` | ${branchName}`}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          {isAdmin(currentUser) && (
            <button
              onClick={() => setShowSettings(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.3)'}
              onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
            >
              <SettingsIcon size={18} />
              Settings
            </button>
          )}
          
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: COLORS.secondary,
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.target.style.background = '#d63d54'}
            onMouseLeave={e => e.target.style.background = COLORS.secondary}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>

      {/* 🔥 메시지 배너 - Sticky */}
      {message.text && (
        <div style={{
          padding: '1rem',
          margin: '0',
          background: message.type === 'success' ? COLORS.success :
                     message.type === 'error' ? COLORS.error :
                     message.type === 'warning' ? COLORS.warning :
                     COLORS.info,
          color: 'white',
          animation: 'slideDown 0.3s ease-out',
          position: 'sticky',
          top: '70px',
          zIndex: 99,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
            {message.text}
          </div>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit}>
          {/* 기본 정보 섹션 */}
          <section style={{
            background: COLORS.surface,
            padding: '2rem',
            borderRadius: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '2rem'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: COLORS.text.primary,
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Shield size={24} color={COLORS.primary} />
              Basic Information
            </h2>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: currentUser.role === 'hq_admin' ? 'repeat(auto-fit, minmax(250px, 1fr))' : 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem'
            }}>
              {/* 🔥 관리자만 Branch 선택 표시 */}
              {currentUser.role === 'hq_admin' && (
                <div>
                  <label style={{ 
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: COLORS.text.primary
                  }}>
                    Branch Name *
                  </label>
                  <select
                    value={branchName}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${COLORS.text.light}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select Branch</option>
                    {settings.branches.map((branch, idx) => (
                      <option key={idx} value={branch.name}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Manager Name */}
              <div>
                <label style={{ 
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  color: COLORS.text.primary
                }}>
                  Manager Name *
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={20} style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: COLORS.text.light
                  }} />
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    required
                    placeholder="Enter manager name"
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                      border: `1px solid ${COLORS.text.light}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              {/* Target Month */}
              <div>
                <label style={{ 
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  color: COLORS.text.primary
                }}>
                  Target Month *
                </label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={20} style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: COLORS.text.light
                  }} />
                  <input
                    type="month"
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                      border: `1px solid ${COLORS.text.light}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              {/* 🔥 관리자만 KRW 환율 입력 */}
              {currentUser.role === 'hq_admin' && (
                <div>
                  <label style={{ 
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: COLORS.text.primary
                  }}>
                    KRW Exchange Rate
                  </label>
                  <div>
                    <input
                      type="number"
                      value={krwExchangeRate}
                      onChange={(e) => setKrwExchangeRate(e.target.value)}
                      placeholder="e.g., 1460"
                      step="0.01"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${COLORS.text.light}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <p style={{ 
                    fontSize: '0.75rem', 
                    color: COLORS.text.secondary, 
                    marginTop: '0.25rem' 
                  }}>
                    Enter the {currency} to KRW exchange rate
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 비용 항목 섹션 */}
          <section style={{
            background: COLORS.surface,
            padding: '2rem',
            borderRadius: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '2rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                color: COLORS.text.primary,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <DollarSign size={24} color={COLORS.primary} />
                Cost Items
              </h2>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleLoadPreviousData}
                  style={{
                    padding: '0.5rem 1rem',
                    background: COLORS.info,
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Load Previous Data
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: COLORS.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  <Plus size={18} />
                  Add Item
                </button>
              </div>
            </div>

            {!canEditEstimatedCost() && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                background: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '0.5rem',
                color: '#92400e',
                fontSize: '0.875rem'
              }}>
                ⚠️ Estimated Cost can only be entered for the current month or earlier
              </div>
            )}
            {!canEditActualCost() && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                background: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '0.5rem',
                color: '#92400e',
                fontSize: '0.875rem'
              }}>
                ⚠️ Actual Cost can only be entered after the 28th of the month
              </div>
            )}

            {/* 비용 항목 카드 리스트 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {costItems.map((item, index) => {
                const itemCurrency = item.currency || currency;
                const sym = CURRENCY_SYMBOLS[itemCurrency] || itemCurrency;
                const estCost = parseFloat(item.estimatedCost) || 0;
                const actCost = parseFloat(item.actualCost) || 0;

                return (
                  <div key={index} style={{
                    border: `1px solid #e5e7eb`,
                    borderRadius: '0.625rem',
                    background: '#fafbfc',
                    overflow: 'hidden'
                  }}>
                    {/* 카드 헤더: 항목번호 + 삭제 */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.4rem 0.75rem',
                      background: '#f1f5f9',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: '700', color: COLORS.primary, letterSpacing: '0.04em' }}>
                        ITEM #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        disabled={costItems.length === 1}
                        style={{
                          padding: '0.2rem 0.4rem',
                          background: 'none',
                          color: costItems.length === 1 ? '#d1d5db' : COLORS.error,
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: costItems.length === 1 ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: '0.25rem',
                          fontSize: '0.7rem', fontWeight: '500'
                        }}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>

                    {/* Row 1: Cost Item | Currency | Unit Price | Qty | Payment Method */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      alignItems: 'end'
                    }}>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.2rem' }}>Cost Item</label>
                        <select
                          value={item.item}
                          onChange={(e) => handleItemChange(index, e.target.value)}
                          required
                          style={{
                            width: '100%', padding: '0.4rem',
                            border: `1px solid #d1d5db`, borderRadius: '0.375rem',
                            fontSize: '0.8rem', background: 'white'
                          }}
                        >
                          <option value="">Select Item</option>
                          {settings.costItems.map(costItem => (
                            <option key={costItem.name} value={costItem.name}>{costItem.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.2rem' }}>Currency</label>
                        <select
                          value={itemCurrency}
                          onChange={(e) => handleCurrencyChange(index, e.target.value)}
                          style={{
                            width: '100%', padding: '0.4rem',
                            border: `1px solid #d1d5db`, borderRadius: '0.375rem',
                            fontSize: '0.8rem', background: 'white'
                          }}
                        >
                          {settings.currencies.map(curr => (
                            <option key={curr} value={curr}>{curr} ({CURRENCY_SYMBOLS[curr] || ''})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.2rem' }}>Unit Price</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item._unitPriceFocused ? stripCommas(item.unitPrice) : formatInputDisplay(item.unitPrice)}
                          onChange={(e) => handleInputChange(index, 'unitPrice', stripCommas(e.target.value))}
                          onFocus={() => { const n = [...costItems]; n[index]._unitPriceFocused = true; setCostItems(n); }}
                          onBlur={() => { const n = [...costItems]; n[index]._unitPriceFocused = false; setCostItems(n); }}
                          disabled={!canEditEstimatedCost()}
                          placeholder="0"
                          style={{
                            width: '100%', padding: '0.4rem',
                            border: `1px solid #d1d5db`, borderRadius: '0.375rem',
                            fontSize: '0.8rem', textAlign: 'right',
                            background: !canEditEstimatedCost() ? '#f9fafb' : 'white'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.2rem' }}>Qty</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item._qtyFocused ? stripCommas(item.quantity) : formatInputDisplay(item.quantity, 0)}
                          onChange={(e) => handleInputChange(index, 'quantity', stripCommas(e.target.value))}
                          onFocus={() => { const n = [...costItems]; n[index]._qtyFocused = true; setCostItems(n); }}
                          onBlur={() => { const n = [...costItems]; n[index]._qtyFocused = false; setCostItems(n); }}
                          disabled={!canEditEstimatedCost()}
                          placeholder="0"
                          style={{
                            width: '100%', padding: '0.4rem',
                            border: `1px solid #d1d5db`, borderRadius: '0.375rem',
                            fontSize: '0.8rem', textAlign: 'right',
                            background: !canEditEstimatedCost() ? '#f9fafb' : 'white'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.2rem' }}>Payment</label>
                        <select
                          value={item.paymentMethod}
                          onChange={(e) => handlePaymentMethodChange(index, e.target.value)}
                          style={{
                            width: '100%', padding: '0.4rem',
                            border: `1px solid #d1d5db`, borderRadius: '0.375rem',
                            fontSize: '0.8rem', background: 'white'
                          }}
                        >
                          <option value="">Select</option>
                          {settings.paymentMethods.map(method => (
                            <option key={method} value={method}>{method}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Estimated Cost | Actual Cost | Notes */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1.5fr',
                      gap: '0.5rem',
                      padding: '0.35rem 0.75rem 0.5rem',
                      borderTop: '1px dashed #e5e7eb'
                    }}>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: '600', color: COLORS.primary, display: 'block', marginBottom: '0.2rem' }}>
                          Est. Cost {estCost > 0 && <span style={{ fontWeight: '400', color: COLORS.text.light }}>({sym})</span>}
                        </label>
                        <div style={{
                          padding: '0.4rem 0.5rem',
                          background: estCost > 0 ? '#eef2ff' : '#f9fafb',
                          border: `1px solid ${estCost > 0 ? '#c7d2fe' : '#e5e7eb'}`,
                          borderRadius: '0.375rem',
                          fontSize: '0.85rem',
                          fontWeight: '700',
                          color: estCost > 0 ? COLORS.primary : COLORS.text.light,
                          textAlign: 'right',
                          minHeight: '1.6rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end'
                        }}>
                          {estCost > 0 ? `${sym}${formatNumber(estCost)}` : '\u2014'}
                        </div>
                        {estCost > 0 && krwExchangeRate && (
                          <div style={{ fontSize: '0.6rem', color: COLORS.text.secondary, textAlign: 'right', marginTop: '0.1rem' }}>
                            \u2248 \u20A9{formatNumberInt(convertToKRW(estCost, itemCurrency))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.2rem' }}>Actual Cost</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item._actualCostFocused ? stripCommas(item.actualCost) : formatInputDisplay(item.actualCost)}
                          onChange={(e) => handleInputChange(index, 'actualCost', stripCommas(e.target.value))}
                          onFocus={() => { const n = [...costItems]; n[index]._actualCostFocused = true; setCostItems(n); }}
                          onBlur={() => { const n = [...costItems]; n[index]._actualCostFocused = false; setCostItems(n); }}
                          disabled={!canEditActualCost()}
                          placeholder={canEditActualCost() ? "Enter amount" : "After 28th"}
                          style={{
                            width: '100%', padding: '0.4rem',
                            border: `1px solid #d1d5db`, borderRadius: '0.375rem',
                            fontSize: '0.8rem', textAlign: 'right',
                            background: !canEditActualCost() ? '#f9fafb' : 'white'
                          }}
                        />
                        {actCost > 0 && krwExchangeRate && (
                          <div style={{ fontSize: '0.6rem', color: COLORS.text.secondary, textAlign: 'right', marginTop: '0.1rem' }}>
                            \u2248 \u20A9{formatNumberInt(convertToKRW(actCost, itemCurrency))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.2rem' }}>Notes</label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => handleInputChange(index, 'notes', e.target.value)}
                          placeholder="Optional notes"
                          style={{
                            width: '100%', padding: '0.4rem',
                            border: `1px solid #d1d5db`, borderRadius: '0.375rem',
                            fontSize: '0.8rem'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 합계 */}
            <div style={{
              marginTop: '2rem',
              padding: '1.5rem',
              background: '#f9fafb',
              borderRadius: '0.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                  Total Estimated Cost
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.primary }}>
                  {CURRENCY_SYMBOLS[currency]}{formatNumber(calculateTotalEstimated())}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                  Total Actual Cost
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.secondary }}>
                  {CURRENCY_SYMBOLS[currency]}{formatNumber(calculateTotalActual())}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                  Variance
                </p>
                <p style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold', 
                  color: calculateTotalActual() > calculateTotalEstimated() ? COLORS.error : COLORS.success 
                }}>
                  {CURRENCY_SYMBOLS[currency]}{formatNumber(calculateTotalActual() - calculateTotalEstimated())}
                </p>
              </div>
            </div>
          </section>

          {/* 제출 버튼 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '1rem 2rem',
                background: isSubmitting ? COLORS.text.light : COLORS.primary,
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {isSubmitting ? (
                <>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '3px solid rgba(255,255,255,0.3)',
                    borderTop: '3px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Submitting...
                </>
              ) : (
                'Submit Security Cost'
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Settings 모달 */}
      {showSettings && (
        <Settings
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
