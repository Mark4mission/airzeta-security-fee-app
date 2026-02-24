import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, DollarSign, Calendar, User, Settings as SettingsIcon, LogOut, Plus, Trash2, Upload, Eye, Trash, Paperclip, X } from 'lucide-react';
import readXlsxFile from 'read-excel-file';
import './App.css';
import { serverTimestamp } from 'firebase/firestore';
import { 
  getAllBranches, 
  getSecurityCostsByBranch, 
  submitSecurityCost,
  loadSettingsFromFirestore,
  updateBranchManager,
  deleteSecurityCostsByBranchMonth,
  saveExchangeRates,
  loadExchangeRatesByYear,
  saveContractFile,
  loadContractFile,
  deleteContractFile,
  saveAttachment,
  loadAttachments,
  loadAttachmentData,
  deleteAttachment
} from './firebase/collections';
import { 
  listenToAuthChanges, 
  logoutUser, 
  isAdmin,
  isPendingAdmin,
  updateUserPreferences 
} from './firebase/auth';
import Settings from './components/Settings';
import Login from './components/Login';
import BranchSelection from './components/BranchSelection';
import AdminDashboard from './components/AdminDashboard';
import BranchCostHistory from './components/BranchCostHistory';

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
    { name: 'Seoul Station', address: '123 Gangnam-gu, Seoul', manager: 'Kim Min-soo', phone: '+82-2-1234-5678', currency: 'KRW' },
    { name: 'Tokyo Station', address: '456 Shibuya, Tokyo', manager: 'Tanaka Yuki', phone: '+81-3-1234-5678', currency: 'JPY' },
    { name: 'Singapore Station', address: '789 Marina Bay, Singapore', manager: 'Lee Wei Ming', phone: '+65-1234-5678', currency: 'SGD' },
    { name: 'Hong Kong Station', address: '321 Central, Hong Kong', manager: 'Wong Ka Fai', phone: '+852-1234-5678', currency: 'HKD' },
    { name: 'Bangkok Station', address: '654 Sukhumvit, Bangkok', manager: 'Somchai Prasert', phone: '+66-2-1234-5678', currency: 'THB' }
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

  const [managerName, setManagerName] = useState('');
  const [targetMonth, setTargetMonth] = useState('');
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState('');
  const [costItems, setCostItems] = useState([
    { item: '', unitPrice: '', quantity: '', qtyUnit: '', estimatedCost: '', actualCost: '', currency: 'USD', paymentMethod: '', notes: '' }
  ]);

  // 월별 환율 테이블 상태: { '2026-01': { rates, fileName, ... }, ... }
  const [monthlyExchangeRates, setMonthlyExchangeRates] = useState({});
  const [exchangeRateYear, setExchangeRateYear] = useState(new Date().getFullYear().toString());

  // 계약서 파일 상태
  const [contractYear, setContractYear] = useState(new Date().getFullYear().toString());
  const [contractFile, setContractFile] = useState(null); // { fileName, fileType, fileSize, uploadedAt }
  const [contractLoading, setContractLoading] = useState(false);
  const contractInputRef = useRef(null);

  // 월별 첨부파일 상태
  const [attachments, setAttachments] = useState([]); // [{id, fileName, fileType, fileSize, uploadedAt}]
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const attachmentInputRef = useRef(null);

  // 설정 상태
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('securityAppSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // UI 상태
  const [showSettings, setShowSettings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [autoLoadMessage, setAutoLoadMessage] = useState(''); // 관리자 자동로드 메시지
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0); // BranchCostHistory 강제 리프레시용
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0); // AdminDashboard 강제 리프레시용

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

  // 월별 환율 데이터 로드 (선택된 연도 기준)
  useEffect(() => {
    const loadRates = async () => {
      if (!authLoading && currentUser && exchangeRateYear) {
        try {
          const ratesData = await loadExchangeRatesByYear(exchangeRateYear);
          if (ratesData && Object.keys(ratesData).length > 0) {
            setMonthlyExchangeRates(prev => {
              // 기존 다른 연도 데이터는 유지하면서 현재 연도 데이터 업데이트
              const merged = { ...prev };
              Object.keys(ratesData).forEach(k => { merged[k] = ratesData[k]; });
              return merged;
            });
            console.log('[App] Monthly exchange rates loaded for', exchangeRateYear, ':', Object.keys(ratesData).length, 'months');
          }
        } catch (error) {
          console.error('[App] Exchange rates load failed:', error);
        }
      }
    };
    loadRates();
  }, [authLoading, currentUser, exchangeRateYear]);

  // 계약서 파일 로드 (branchName + contractYear 변경 시)
  useEffect(() => {
    const loadContract = async () => {
      if (!authLoading && currentUser && branchName && contractYear) {
        setContractLoading(true);
        try {
          const data = await loadContractFile(branchName, contractYear);
          if (data) {
            setContractFile({ fileName: data.fileName, fileType: data.fileType, fileSize: data.fileSize, uploadedAt: data.uploadedAt });
          } else {
            setContractFile(null);
          }
        } catch (error) {
          console.error('[App] Contract file load failed:', error);
          setContractFile(null);
        } finally {
          setContractLoading(false);
        }
      } else {
        setContractFile(null);
      }
    };
    loadContract();
  }, [authLoading, currentUser, branchName, contractYear]);

  // 월별 첨부파일 로드 (branchName + targetMonth 변경 시)
  useEffect(() => {
    const loadFiles = async () => {
      if (!authLoading && currentUser && branchName && targetMonth) {
        setAttachmentsLoading(true);
        try {
          const files = await loadAttachments(branchName, targetMonth);
          setAttachments(files);
        } catch (error) {
          console.error('[App] Attachments load failed:', error);
          setAttachments([]);
        } finally {
          setAttachmentsLoading(false);
        }
      } else {
        setAttachments([]);
      }
    };
    loadFiles();
  }, [authLoading, currentUser, branchName, targetMonth]);

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
        // 브랜치 기본 통화를 우선 사용 (환율 계산/표시에 정확한 통화가 필요)
        const branchCurrency = branch.currency || 'USD';
        const userPayment = currentUser.preferredPaymentMethod || branch.paymentMethod || '';
        setCurrency(branchCurrency);
        setManagerName(branch.manager || '');
        setDefaultPaymentMethod(userPayment);
        console.log('[App] 브랜치 매칭 성공:', branch.name, '매니저:', branch.manager, '통화:', branchCurrency, '결제:', userPayment);
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
        // 관리자: 브랜치 기본 통화를 우선 사용 (환율 계산에 정확한 통화가 필요)
        const branchCurrency = branch.currency || 'USD';
        const userPayment = currentUser.preferredPaymentMethod || branch.paymentMethod || '';
        setCurrency(branchCurrency);
        setDefaultPaymentMethod(userPayment);
      }
    }
  }, [branchName, settings.branches, currentUser]);

  // 관리자: 브랜치 또는 월 변경 시 기존 데이터 자동 로드
  const autoLoadCostData = useCallback(async (branch, month) => {
    if (!branch || !month) return;
    setAutoLoadMessage('');
    try {
      const previousData = await getSecurityCostsByBranch(branch, month);
      if (previousData.length > 0) {
        const latestData = previousData[0];
        if (latestData.items && latestData.items.length > 0) {
          const cleanItems = latestData.items.map(item => ({
            item: item.item || '',
            unitPrice: item.unitPrice?.toString() || '',
            quantity: item.quantity?.toString() || '',
            qtyUnit: item.qtyUnit || '',
            estimatedCost: item.estimatedCost?.toString() || '',
            actualCost: item.actualCost?.toString() || '',
            currency: item.currency || currency,
            paymentMethod: item.paymentMethod || '',
            notes: item.notes || ''
          }));
          console.log('[AutoLoad] Loaded items:', cleanItems.length, cleanItems.map(i => ({ item: i.item, payment: i.paymentMethod })));
          setCostItems(cleanItems);
          setAutoLoadMessage(`Loaded data for ${branch} - ${month}`);
          setTimeout(() => setAutoLoadMessage(''), 4000);
        } else {
          resetCostItems();
          setAutoLoadMessage('No input available to load for this station/month.');
        }
      } else {
        resetCostItems();
        setAutoLoadMessage('No input available to load for this station/month.');
      }
    } catch (error) {
      console.error('[AutoLoad] Error:', error);
      setAutoLoadMessage('Failed to load data.');
    }
  }, [currency, defaultPaymentMethod]);

  const resetCostItems = () => {
    setCostItems([{
      item: '', unitPrice: '', quantity: '', qtyUnit: '', estimatedCost: '', actualCost: '',
      currency: currency, paymentMethod: defaultPaymentMethod, notes: ''
    }]);
  };

  // 브랜치 또는 월 변경 시 기존 데이터 자동 로드 (관리자 + 지점 사용자 모두)
  useEffect(() => {
    if (currentUser && branchName && targetMonth) {
      autoLoadCostData(branchName, targetMonth);
    }
  }, [branchName, targetMonth, currentUser?.uid]);

  // 로그아웃 - 모든 상태 초기화
  const handleLogout = async () => {
    try {
      await logoutUser();
      // 전체 상태 초기화
      setCurrentUser(null);
      setBranchName('');
      setManagerName('');
      setCurrency('USD');
      setDefaultPaymentMethod('');
      setTargetMonth('');
      setCostItems([{ item: '', unitPrice: '', quantity: '', qtyUnit: '', estimatedCost: '', actualCost: '', currency: 'USD', paymentMethod: '', notes: '' }]);
      setAutoLoadMessage('');
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
              newItems[index].qtyUnit = matchingItem.qtyUnit || '';
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
      qtyUnit: '',
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
      const newItems = costItems.filter((_, i) => i !== index);
      console.log('[App] Item removed, remaining:', newItems.length, newItems.map(it => it.item));
      setCostItems(newItems);
    }
  };

  // (Load Previous Data 기능 제거됨 - autoLoad가 브랜치/월 변경 시 자동으로 데이터 로드)

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

  // 월별 업로드 환율을 이용한 KRW 변환 (targetMonth 기준)
  const convertToKRW = useCallback((amount, itemCurrency) => {
    if (!amount || !targetMonth) return null;
    const amt = parseFloat(amount);
    if (isNaN(amt)) return null;
    if (itemCurrency === 'KRW') return amt;
    
    const monthData = monthlyExchangeRates?.[targetMonth];
    if (!monthData?.rates) return null;
    const entry = monthData.rates.find(r => r.currency === itemCurrency);
    if (!entry) return null;
    const ratio = entry.ratio || 1;
    const ratePerUnit = entry.rate / ratio;
    return amt * ratePerUnit;
  }, [monthlyExchangeRates, targetMonth]);

  // 현재 targetMonth에 환율 데이터가 있는지 여부
  const hasMonthlyRate = !!(monthlyExchangeRates?.[targetMonth]?.rates);

  // XLSX 파일 업로드 처리 (월별)
  const handleExchangeRateUpload = async (e, yearMonth) => {
    const file = e.target.files[0];
    if (!file || !yearMonth) return;
    
    try {
      const rows = await readXlsxFile(file);
      
      // Skip header row, parse currency data
      const rates = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 5) continue;
        const ratio = parseFloat(row[0]) || 1;
        const currency = String(row[1]).trim();
        const targetCurrency = String(row[3]).trim();
        const rateStr = String(row[4]).replace(/,/g, '').trim();
        const rate = parseFloat(rateStr);
        
        if (currency && targetCurrency === 'KRW' && !isNaN(rate)) {
          rates.push({ currency, rate, ratio });
        }
      }
      
      if (rates.length === 0) {
        setMessage({ type: 'error', text: 'No valid exchange rate data found in the file.' });
        return;
      }
      
      await saveExchangeRates(rates, file.name, yearMonth);
      setMonthlyExchangeRates(prev => ({
        ...prev,
        [yearMonth]: { rates, fileName: file.name, yearMonth, uploadedAt: new Date() }
      }));
      const monthLabel = yearMonth.slice(5, 7);
      setMessage({ type: 'success', text: `Exchange rates for ${yearMonth} uploaded: ${rates.length} currencies from ${file.name}` });
      // Refresh dashboard
      setDashboardRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('[ExchangeRate] Upload error:', error);
      setMessage({ type: 'error', text: 'Failed to parse exchange rate file: ' + error.message });
    }
    // Reset file input
    e.target.value = '';
  };

  // 계약서 파일 업로드 처리
  const handleContractUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !branchName || !contractYear) {
      if (!branchName) setMessage({ type: 'error', text: 'Please select a station first.' });
      return;
    }
    
    // 파일 크기 제한 (1MB - Firestore 문서 크기 제한)
    if (file.size > 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be under 1MB. Please compress the file.' });
      e.target.value = '';
      return;
    }
    
    try {
      setContractLoading(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const base64 = ev.target.result.split(',')[1]; // Remove data:...;base64, prefix
          await saveContractFile(branchName, contractYear, file.name, base64, file.type, file.size);
          setContractFile({ fileName: file.name, fileType: file.type, fileSize: file.size, uploadedAt: new Date() });
          setMessage({ type: 'success', text: `Contract file uploaded: ${file.name} (${branchName} / ${contractYear})` });
        } catch (error) {
          console.error('[Contract] Upload error:', error);
          setMessage({ type: 'error', text: 'Failed to upload contract file: ' + error.message });
        } finally {
          setContractLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[Contract] Upload error:', error);
      setMessage({ type: 'error', text: 'Failed to read file.' });
      setContractLoading(false);
    }
    e.target.value = '';
  };

  // 계약서 파일 보기
  const handleViewContract = async () => {
    if (!branchName || !contractYear) return;
    try {
      setContractLoading(true);
      const data = await loadContractFile(branchName, contractYear);
      if (data?.fileBase64) {
        const byteCharacters = atob(data.fileBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.fileType });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        setMessage({ type: 'warning', text: 'No contract file found.' });
      }
    } catch (error) {
      console.error('[Contract] View error:', error);
      setMessage({ type: 'error', text: 'Failed to load contract file.' });
    } finally {
      setContractLoading(false);
    }
  };

  // 계약서 파일 삭제
  const handleDeleteContract = async () => {
    if (!branchName || !contractYear) return;
    if (!window.confirm(`Delete contract file for ${branchName} (${contractYear})?`)) return;
    try {
      setContractLoading(true);
      await deleteContractFile(branchName, contractYear);
      setContractFile(null);
      setMessage({ type: 'success', text: `Contract file deleted: ${branchName} / ${contractYear}` });
    } catch (error) {
      console.error('[Contract] Delete error:', error);
      setMessage({ type: 'error', text: 'Failed to delete contract file.' });
    } finally {
      setContractLoading(false);
    }
  };

  // 월별 첨부파일 업로드 처리 (멀티 파일)
  const handleAttachmentUpload = async (files) => {
    if (!branchName || !targetMonth) {
      setMessage({ type: 'error', text: 'Please select a station and target month first.' });
      return;
    }
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    // 개별 파일 크기 제한 (1MB)
    const oversized = fileList.filter(f => f.size > 1024 * 1024);
    if (oversized.length > 0) {
      setMessage({ type: 'error', text: `File(s) too large (max 1MB each): ${oversized.map(f => f.name).join(', ')}` });
      return;
    }

    setAttachmentUploading(true);
    let uploaded = 0;
    try {
      for (const file of fileList) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await saveAttachment(branchName, targetMonth, file.name, base64, file.type, file.size);
        uploaded++;
      }
      // 목록 리프레시
      const refreshed = await loadAttachments(branchName, targetMonth);
      setAttachments(refreshed);
      setMessage({ type: 'success', text: `${uploaded} file(s) uploaded for ${branchName} — ${targetMonth}` });
    } catch (error) {
      console.error('[Attachment] Upload error:', error);
      setMessage({ type: 'error', text: `Uploaded ${uploaded}/${fileList.length} file(s). Error: ${error.message}` });
      // 부분 성공 시에도 목록 리프레시
      const refreshed = await loadAttachments(branchName, targetMonth);
      setAttachments(refreshed);
    } finally {
      setAttachmentUploading(false);
    }
  };

  // 첨부파일 미리보기
  const handleViewAttachment = async (docId) => {
    try {
      const data = await loadAttachmentData(docId);
      if (data?.fileBase64) {
        const byteCharacters = atob(data.fileBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.fileType });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        setMessage({ type: 'warning', text: 'File data not found.' });
      }
    } catch (error) {
      console.error('[Attachment] View error:', error);
      setMessage({ type: 'error', text: 'Failed to open file.' });
    }
  };

  // 첨부파일 삭제
  const handleDeleteAttachment = async (docId, fileName) => {
    if (!window.confirm(`Delete "${fileName}"?`)) return;
    try {
      await deleteAttachment(docId);
      setAttachments(prev => prev.filter(a => a.id !== docId));
      setMessage({ type: 'success', text: `Deleted: ${fileName}` });
    } catch (error) {
      console.error('[Attachment] Delete error:', error);
      setMessage({ type: 'error', text: 'Failed to delete file.' });
    }
  };

  // 드래그앤드롭 핸들러
  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleAttachmentUpload(e.dataTransfer.files);
    }
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

    if (costItems.some(item => parseFloat(item.actualCost) > 0 && !canEditActualCost())) {
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

    // 유효한 항목만 필터: item명이 있고, 비용 데이터가 있는 것
    const validItems = costItems.filter(item => {
      const hasItem = item.item && item.item.trim() !== '';
      const hasCost = parseFloat(item.estimatedCost) > 0 || parseFloat(item.actualCost) > 0 || (parseFloat(item.unitPrice) > 0 && parseFloat(item.quantity) > 0);
      return hasItem && hasCost;
    });

    console.log('[Submit] costItems:', costItems.length, 'validItems:', validItems.length);

    if (validItems.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one cost item with a name and cost value' });
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
        krwExchangeRate: null, // deprecated: now using monthly exchange rates
        items: validItems.map(item => ({
          item: item.item,
          unitPrice: parseFloat(item.unitPrice) || 0,
          quantity: parseFloat(item.quantity) || 0,
          qtyUnit: item.qtyUnit || '',
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

      // 매니저 이름 변경 시 Settings(branchCodes)에 동기화
      const currentBranch = settings.branches.find(b => b.name === branchName);
      if (currentBranch && currentBranch.manager !== managerName) {
        console.log(`[Submit] 매니저 변경 감지: ${currentBranch.manager} → ${managerName}`);
        const updated = await updateBranchManager(branchName, managerName);
        if (updated) {
          // 로컬 settings 상태도 동기화 (다음 브랜치 선택 시 반영)
          setSettings(prev => ({
            ...prev,
            branches: prev.branches.map(b => 
              b.name === branchName ? { ...b, manager: managerName } : b
            )
          }));
          console.log('[Submit] 로컬 settings 매니저 동기화 완료');
        }
      }

      setMessage({ type: 'success', text: 'Security cost submitted successfully!' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // BranchCostHistory 그래프 강제 리프레시
      setHistoryRefreshKey(prev => prev + 1);
      
      // AdminDashboard 대시보드 강제 리프레시 (관리자)
      if (currentUser?.role === 'hq_admin') {
        setDashboardRefreshKey(prev => prev + 1);
      }
      
      // 폼 초기화 후 방금 제출한 데이터 다시 로드
      if (currentUser?.role === 'hq_admin') {
        // 관리자: 브랜치/매니저 초기화 → 새 브랜치 선택 유도
        setBranchName('');
        setManagerName('');
        setCostItems([{ 
          item: '', unitPrice: '', quantity: '', qtyUnit: '', estimatedCost: '', actualCost: '', 
          currency: currency, paymentMethod: defaultPaymentMethod, notes: '' 
        }]);
      } else {
        // 지점 사용자: 제출한 데이터를 그대로 유지 (화면 초기화 방지)
        // 1초 후 Firestore에서 최신 데이터 다시 로드 (서버 타임스탬프 반영 대기)
        setTimeout(() => {
          autoLoadCostData(branchName, targetMonth);
        }, 1500);
      }

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
  const needsBranchSelection = currentUser.role !== 'hq_admin' && currentUser.role !== 'pending_admin' && !currentUser.branchName;

  // pending_admin 상태인 경우 승인 대기 화면 표시
  if (isPendingAdmin(currentUser)) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${COLORS.primary} 0%, #0f2557 100%)`,
        padding: '2rem'
      }}>
        <div style={{
          background: COLORS.surface,
          padding: '2.5rem',
          borderRadius: '1rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 1.5rem auto',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(245, 158, 11, 0.3)'
          }}>
            <Shield size={40} color="white" strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: COLORS.text.primary, marginBottom: '0.5rem' }}>
            Admin Approval Pending
          </h2>
          <p style={{ color: COLORS.text.secondary, fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            Your request for HQ administrator access is being reviewed.<br/>
            An existing administrator must approve your request.<br/>
            <strong>Email:</strong> {currentUser.email}
          </p>
          <div style={{
            padding: '1rem',
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '0.5rem',
            color: '#92400e',
            fontSize: '0.85rem',
            marginBottom: '1.5rem'
          }}>
            Please contact your HQ administrator to approve your access.
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.9rem',
              background: COLORS.secondary,
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <Shield size={18} /> Sign Out
          </button>
        </div>
      </div>
    );
  }

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
              Station Security Cost Submission
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
        {/* 관리자 대시보드 */}
        {isAdmin(currentUser) && (
          <AdminDashboard
            key={`dashboard-${dashboardRefreshKey}`}
            branches={settings.branches.filter(b => b.name !== 'HQ' && b.name !== 'hq')}
            monthlyExchangeRates={monthlyExchangeRates}
            isAdmin={isAdmin(currentUser)}
            onExchangeRateUpload={handleExchangeRateUpload}
            onYearChange={(year) => setExchangeRateYear(year)}
            onCellClick={(branch, month) => {
              console.log('[App] Dashboard cell clicked:', branch, month);
              handleBranchChange(branch);
              setTargetMonth(month);
              // Scroll to Basic Information section
              setTimeout(() => {
                const basicInfoSection = document.getElementById('basic-info-section');
                if (basicInfoSection) {
                  basicInfoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 100);
            }}
          />
        )}

        <form onSubmit={handleSubmit}>
          {/* 기본 정보 섹션 */}
          <section id="basic-info-section" style={{
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
              {/* 🔥 관리자만 Station 선택 표시 */}
              {currentUser.role === 'hq_admin' && (
                <div>
                  <label style={{ 
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: COLORS.text.primary
                  }}>
                    Station Name *
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
                    <option value="">Select Station</option>
                    {settings.branches
                      .filter(branch => branch.name !== 'HQ' && branch.name !== 'hq')
                      .map((branch, idx) => (
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

              {/* 계약서 파일 업로드 (연도별) - 관리자 및 지점 사용자 모두 */}
              {(currentUser.role === 'hq_admin' || currentUser.role === 'branch_user') && (
                <div>
                  <label style={{ 
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: COLORS.text.primary
                  }}>
                    Contract File
                  </label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 0.6rem',
                    border: `1px solid ${COLORS.text.light}`,
                    borderRadius: '0.5rem',
                    background: '#fafbfc',
                    minHeight: '2.6rem'
                  }}>
                    {/* 연도 선택 */}
                    <select
                      value={contractYear}
                      onChange={(e) => setContractYear(e.target.value)}
                      style={{
                        padding: '0.3rem 0.4rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.8rem',
                        background: 'white',
                        cursor: 'pointer',
                        minWidth: '70px',
                        flexShrink: 0
                      }}
                    >
                      {[...Array(5)].map((_, i) => {
                        const y = (new Date().getFullYear() - 2 + i).toString();
                        return <option key={y} value={y}>{y}</option>;
                      })}
                    </select>

                    {/* 파일 업로드 (숨김) */}
                    <input
                      ref={contractInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      onChange={handleContractUpload}
                      style={{ display: 'none' }}
                    />

                    {/* 파일 상태 표시 */}
                    {contractLoading ? (
                      <span style={{ fontSize: '0.7rem', color: COLORS.text.light, flex: 1 }}>Loading...</span>
                    ) : contractFile ? (
                      <span style={{
                        fontSize: '0.7rem', color: COLORS.primary, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: '500'
                      }} title={contractFile.fileName}>
                        {contractFile.fileName}
                      </span>
                    ) : (
                      <span
                        onClick={() => branchName ? contractInputRef.current?.click() : setMessage({ type: 'error', text: 'Please select a station first.' })}
                        style={{
                          fontSize: '0.7rem', color: COLORS.text.light, flex: 1,
                          cursor: 'pointer', fontStyle: 'italic'
                        }}
                      >
                        No file — click to upload
                      </span>
                    )}

                    {/* 아이콘 버튼 그룹 */}
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      {/* 업로드 버튼 */}
                      <button
                        type="button"
                        onClick={() => branchName ? contractInputRef.current?.click() : setMessage({ type: 'error', text: 'Please select a station first.' })}
                        disabled={contractLoading}
                        title={`Upload contract for ${branchName || '(select station)'} / ${contractYear}`}
                        style={{
                          background: 'none', border: 'none', cursor: contractLoading ? 'not-allowed' : 'pointer',
                          padding: '3px', borderRadius: '0.25rem', display: 'flex', alignItems: 'center',
                          color: COLORS.primary, opacity: contractLoading ? 0.4 : 1
                        }}
                      >
                        <Upload size={14} />
                      </button>
                      {/* 보기 버튼 */}
                      {contractFile && (
                        <button
                          type="button"
                          onClick={handleViewContract}
                          disabled={contractLoading}
                          title={`View ${contractFile.fileName}`}
                          style={{
                            background: 'none', border: 'none', cursor: contractLoading ? 'not-allowed' : 'pointer',
                            padding: '3px', borderRadius: '0.25rem', display: 'flex', alignItems: 'center',
                            color: COLORS.info, opacity: contractLoading ? 0.4 : 1
                          }}
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      {/* 삭제 버튼 */}
                      {contractFile && (
                        <button
                          type="button"
                          onClick={handleDeleteContract}
                          disabled={contractLoading}
                          title={`Delete contract for ${branchName} / ${contractYear}`}
                          style={{
                            background: 'none', border: 'none', cursor: contractLoading ? 'not-allowed' : 'pointer',
                            padding: '3px', borderRadius: '0.25rem', display: 'flex', alignItems: 'center',
                            color: COLORS.error, opacity: contractLoading ? 0.4 : 1
                          }}
                        >
                          <Trash size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p style={{ 
                    fontSize: '0.7rem', 
                    color: COLORS.text.secondary, 
                    marginTop: '0.2rem' 
                  }}>
                    {branchName ? `${branchName} / ${contractYear}` : 'Select a station first'} · Max 1MB
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
                {/* 관리자 전용: 현재 브랜치+월 데이터 Firestore에서 삭제 */}
                {isAdmin(currentUser) && branchName && targetMonth && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`Delete all cost data for ${branchName} - ${targetMonth}?\n\nThis will permanently remove the records from the database.`)) return;
                      try {
                        setIsSubmitting(true);
                        const deleted = await deleteSecurityCostsByBranchMonth(branchName, targetMonth);
                        resetCostItems();
                        // 대시보드 + 히스토리 그래프 리프레시
                        setDashboardRefreshKey(prev => prev + 1);
                        setHistoryRefreshKey(prev => prev + 1);
                        setMessage({ 
                          type: 'success', 
                          text: deleted > 0 
                            ? `${deleted} record(s) deleted for ${branchName} - ${targetMonth}.` 
                            : `No records found for ${branchName} - ${targetMonth}.`
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      } catch (error) {
                        console.error('[ClearData] Error:', error);
                        setMessage({ type: 'error', text: 'Failed to delete data: ' + error.message });
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: 'white',
                      color: COLORS.error,
                      border: `1px solid ${COLORS.error}`,
                      borderRadius: '0.5rem',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      opacity: isSubmitting ? 0.6 : 1
                    }}
                  >
                    <Trash2 size={16} />
                    Clear Data
                  </button>
                )}
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

            {/* 관리자 자동 로드 메시지 */}
            {autoLoadMessage && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                background: autoLoadMessage.includes('No input') || autoLoadMessage.includes('Failed')
                  ? '#fef3c7' : '#d1fae5',
                border: `1px solid ${autoLoadMessage.includes('No input') || autoLoadMessage.includes('Failed')
                  ? '#fbbf24' : '#6ee7b7'}`,
                borderRadius: '0.5rem',
                color: autoLoadMessage.includes('No input') || autoLoadMessage.includes('Failed')
                  ? '#92400e' : '#065f46',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                {autoLoadMessage.includes('No input') || autoLoadMessage.includes('Failed') ? '⚠️' : '✅'} {autoLoadMessage}
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

                    {/* Row 1: Cost Item | Currency | Unit Price | Qty | Unit | Payment Method */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.6fr 1fr',
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
                          {/* Show the loaded item value even if it's not in settings */}
                          {item.item && !settings.costItems.some(ci => ci.name === item.item) && (
                            <option value={item.item}>{item.item} (custom)</option>
                          )}
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
                        <label style={{ fontSize: '0.65rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.2rem' }}>Unit</label>
                        <input
                          type="text"
                          value={item.qtyUnit || ''}
                          onChange={(e) => handleInputChange(index, 'qtyUnit', e.target.value)}
                          placeholder="kg, hr..."
                          style={{
                            width: '100%', padding: '0.4rem',
                            border: `1px solid #d1d5db`, borderRadius: '0.375rem',
                            fontSize: '0.75rem', background: 'white',
                            textAlign: 'center'
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
                          {/* Show the loaded payment method even if it's not in settings */}
                          {item.paymentMethod && !settings.paymentMethods.includes(item.paymentMethod) && (
                            <option value={item.paymentMethod}>{item.paymentMethod} (custom)</option>
                          )}
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
                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: COLORS.primary, display: 'block', marginBottom: '0.2rem', letterSpacing: '0.02em' }}>
                          Est. Cost {estCost > 0 && <span style={{ fontWeight: '400', color: COLORS.text.light }}>({sym})</span>}
                        </label>
                        <div style={{
                          padding: '0.5rem 0.6rem',
                          background: estCost > 0 ? '#eef2ff' : '#f9fafb',
                          border: `2px solid ${estCost > 0 ? '#818cf8' : '#e5e7eb'}`,
                          borderRadius: '0.375rem',
                          fontSize: '0.95rem',
                          fontWeight: '800',
                          color: estCost > 0 ? COLORS.primary : COLORS.text.light,
                          textAlign: 'right',
                          minHeight: '1.8rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                          boxShadow: estCost > 0 ? '0 1px 4px rgba(27,58,125,0.12)' : 'none'
                        }}>
                          {estCost > 0 ? `${sym}${formatNumber(estCost)}` : '\u2014'}
                        </div>
                        {estCost > 0 && hasMonthlyRate && convertToKRW(estCost, itemCurrency) !== null && (
                          <div style={{ fontSize: '0.6rem', color: COLORS.text.secondary, textAlign: 'right', marginTop: '0.1rem' }}>
                            {`\u2248 \u20A9${formatNumberInt(convertToKRW(estCost, itemCurrency))}`}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: COLORS.secondary, display: 'block', marginBottom: '0.2rem', letterSpacing: '0.02em' }}>Actual Cost</label>
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
                            width: '100%', padding: '0.5rem 0.4rem',
                            border: `2px solid ${actCost > 0 ? COLORS.secondary : '#d1d5db'}`,
                            borderRadius: '0.375rem',
                            fontSize: '0.95rem', fontWeight: actCost > 0 ? '800' : '400',
                            textAlign: 'right',
                            color: actCost > 0 ? COLORS.secondary : COLORS.text.primary,
                            background: !canEditActualCost() ? '#f9fafb' : actCost > 0 ? '#fff1f2' : 'white',
                            boxShadow: actCost > 0 ? '0 1px 4px rgba(233,69,96,0.12)' : 'none'
                          }}
                        />
                        {actCost > 0 && hasMonthlyRate && convertToKRW(actCost, itemCurrency) !== null && (
                          <div style={{ fontSize: '0.6rem', color: COLORS.text.secondary, textAlign: 'right', marginTop: '0.1rem' }}>
                            {`\u2248 \u20A9${formatNumberInt(convertToKRW(actCost, itemCurrency))}`}
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
              <div style={{
                padding: '1rem',
                background: '#eef2ff',
                borderRadius: '0.5rem',
                borderLeft: `4px solid ${COLORS.primary}`,
                boxShadow: '0 1px 4px rgba(27,58,125,0.10)'
              }}>
                <p style={{ fontSize: '0.8rem', color: COLORS.primary, marginBottom: '0.25rem', fontWeight: '600', letterSpacing: '0.03em' }}>
                  Total Estimated Cost
                </p>
                <p style={{ fontSize: '1.6rem', fontWeight: '900', color: COLORS.primary }}>
                  {CURRENCY_SYMBOLS[currency]}{formatNumber(calculateTotalEstimated())}
                </p>
              </div>
              <div style={{
                padding: '1rem',
                background: '#fff1f2',
                borderRadius: '0.5rem',
                borderLeft: `4px solid ${COLORS.secondary}`,
                boxShadow: '0 1px 4px rgba(233,69,96,0.10)'
              }}>
                <p style={{ fontSize: '0.8rem', color: COLORS.secondary, marginBottom: '0.25rem', fontWeight: '600', letterSpacing: '0.03em' }}>
                  Total Actual Cost
                </p>
                <p style={{ fontSize: '1.6rem', fontWeight: '900', color: COLORS.secondary }}>
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

        {/* 월별 첨부파일 섹션 */}
        {branchName && targetMonth && (
          <section style={{
            background: COLORS.surface,
            padding: '1.5rem 2rem',
            borderRadius: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginTop: '2rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: COLORS.text.primary,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: 0
              }}>
                <Paperclip size={22} color={COLORS.primary} />
                Attachments
                <span style={{ fontSize: '0.75rem', fontWeight: '400', color: COLORS.text.secondary }}>
                  — {branchName} / {targetMonth}
                </span>
              </h2>
              {attachments.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: COLORS.text.light }}>
                  {attachments.length} file{attachments.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* 드래그 앤 드롭 / 파일 선택 영역 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => attachmentInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragOver ? COLORS.primary : '#d1d5db'}`,
                borderRadius: '0.75rem',
                padding: '1.25rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragOver ? '#eef2ff' : '#fafbfc',
                transition: 'all 0.2s ease',
                marginBottom: attachments.length > 0 ? '1rem' : 0
              }}
            >
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv,.zip"
                onChange={(e) => {
                  handleAttachmentUpload(e.target.files);
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
              {attachmentUploading ? (
                <div style={{ color: COLORS.primary, fontSize: '0.85rem', fontWeight: '500' }}>
                  <div style={{
                    width: '20px', height: '20px',
                    border: `3px solid ${COLORS.text.light}`,
                    borderTop: `3px solid ${COLORS.primary}`,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    display: 'inline-block', verticalAlign: 'middle', marginRight: '0.5rem'
                  }} />
                  Uploading...
                </div>
              ) : (
                <>
                  <Upload size={24} color={isDragOver ? COLORS.primary : COLORS.text.light} style={{ marginBottom: '0.4rem' }} />
                  <p style={{ fontSize: '0.85rem', color: isDragOver ? COLORS.primary : COLORS.text.secondary, margin: '0 0 0.2rem 0', fontWeight: '500' }}>
                    {isDragOver ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: COLORS.text.light, margin: 0 }}>
                    PDF, DOC, XLS, JPG, PNG, ZIP, etc. · Max 1MB per file
                  </p>
                </>
              )}
            </div>

            {/* 첨부파일 목록 */}
            {attachmentsLoading ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: COLORS.text.light, fontSize: '0.8rem' }}>
                Loading files...
              </div>
            ) : attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {attachments.map(att => {
                  const sizeKB = att.fileSize ? (att.fileSize / 1024).toFixed(1) : '?';
                  const isImage = att.fileType?.startsWith('image/');
                  const isPdf = att.fileType === 'application/pdf';
                  return (
                    <div key={att.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem'
                    }}>
                      {/* 파일 아이콘 */}
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '0.25rem',
                        background: isImage ? '#dbeafe' : isPdf ? '#fee2e2' : '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Paperclip size={14} color={isImage ? COLORS.info : isPdf ? COLORS.error : COLORS.text.secondary} />
                      </div>
                      {/* 파일명 */}
                      <span style={{
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: COLORS.text.primary, fontWeight: '500'
                      }} title={att.fileName}>
                        {att.fileName}
                      </span>
                      {/* 크기 */}
                      <span style={{ fontSize: '0.65rem', color: COLORS.text.light, flexShrink: 0 }}>
                        {sizeKB}KB
                      </span>
                      {/* 보기 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleViewAttachment(att.id)}
                        title="View file"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '3px', display: 'flex', alignItems: 'center',
                          color: COLORS.info, borderRadius: '0.25rem'
                        }}
                      >
                        <Eye size={15} />
                      </button>
                      {/* 삭제 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id, att.fileName)}
                        title="Delete file"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '3px', display: 'flex', alignItems: 'center',
                          color: COLORS.error, borderRadius: '0.25rem'
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 비용 히스토리 - 관리자(브랜치 선택 시) 및 지점 사용자 모두 표시 */}
        {branchName && (
          <BranchCostHistory key={`${branchName}-${historyRefreshKey}`} branchName={branchName} currency={currency} />
        )}
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
