import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, DollarSign, Calendar, User, Plus, Trash2, Upload, Eye, Trash, Paperclip, X } from 'lucide-react';
import readXlsxFile from 'read-excel-file';
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
  loadContractFileData,
  deleteContractFile,
  saveAttachment,
  loadAttachments,
  loadAttachmentData,
  deleteAttachment
} from '../../firebase/collections';
import { isAdmin, updateUserPreferences } from '../../firebase/auth';
import { useAuth } from '../../core/AuthContext';
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
  background: '#0F2030',
  surface: '#132F4C',
  surfaceLight: '#1A3A5C',
  text: {
    primary: '#E8EAED',
    secondary: '#8B99A8',
    light: '#5F6B7A'
  },
  border: '#1E3A5F',
};

// 통화 기호 매핑
const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '\u20AC', KRW: '\u20A9', JPY: '\u00A5', SGD: 'S$',
  HKD: 'HK$', THB: '\u0E3F', GBP: '\u00A3', CNY: 'CN\u00A5'
};

// 숫자 포맷
const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const formatNumberInt = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Math.round(Number(num)).toLocaleString('en-US');
};
const formatInputDisplay = (val, decimals = 2) => {
  if (val === '' || val === null || val === undefined) return '';
  const num = parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
};
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

function SecurityFeePage() {
  const { currentUser, setCurrentUser } = useAuth();

  const [branchName, setBranchName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [managerName, setManagerName] = useState('');
  const [targetMonth, setTargetMonth] = useState('');
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState('');
  const [costItems, setCostItems] = useState([
    { item: '', unitPrice: '', quantity: '', qtyUnit: '', estimatedCost: '', actualCost: '', currency: 'USD', paymentMethod: '', notes: '' }
  ]);

  const [monthlyExchangeRates, setMonthlyExchangeRates] = useState({});
  const [exchangeRateYear, setExchangeRateYear] = useState(new Date().getFullYear().toString());

  const [contractYear, setContractYear] = useState(new Date().getFullYear().toString());
  const [contractFile, setContractFile] = useState(null);
  const [contractLoading, setContractLoading] = useState(false);
  const contractInputRef = useRef(null);

  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const attachmentInputRef = useRef(null);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('securityAppSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [autoLoadMessage, setAutoLoadMessage] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  // Load settings from Firestore
  useEffect(() => {
    const loadSettings = async () => {
      if (currentUser) {
        try {
          const firestoreSettings = await loadSettingsFromFirestore();
          const merged = { ...settings };
          if (firestoreSettings.branches?.length > 0) merged.branches = firestoreSettings.branches;
          if (firestoreSettings.costItems?.length > 0) merged.costItems = firestoreSettings.costItems;
          if (firestoreSettings.currencies?.length > 0) merged.currencies = firestoreSettings.currencies;
          if (firestoreSettings.paymentMethods?.length > 0) merged.paymentMethods = firestoreSettings.paymentMethods;
          setSettings(merged);
        } catch (error) {
          console.error('[SecurityFee] Settings load failed:', error);
        }
      }
    };
    loadSettings();
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('securityAppSettings', JSON.stringify(settings));
  }, [settings]);

  // Load exchange rates
  useEffect(() => {
    const loadRates = async () => {
      if (currentUser && exchangeRateYear) {
        try {
          const ratesData = await loadExchangeRatesByYear(exchangeRateYear);
          if (ratesData && Object.keys(ratesData).length > 0) {
            setMonthlyExchangeRates(prev => {
              const merged = { ...prev };
              Object.keys(ratesData).forEach(k => { merged[k] = ratesData[k]; });
              return merged;
            });
          }
        } catch (error) {
          console.error('[SecurityFee] Exchange rates load failed:', error);
        }
      }
    };
    loadRates();
  }, [currentUser, exchangeRateYear]);

  // Load contract file
  useEffect(() => {
    const loadContract = async () => {
      if (currentUser && branchName && contractYear) {
        setContractLoading(true);
        try {
          const data = await loadContractFile(branchName, contractYear);
          setContractFile(data ? { fileName: data.fileName, fileType: data.fileType, fileSize: data.fileSize, uploadedAt: data.uploadedAt } : null);
        } catch (error) {
          setContractFile(null);
        } finally {
          setContractLoading(false);
        }
      } else {
        setContractFile(null);
      }
    };
    loadContract();
  }, [currentUser, branchName, contractYear]);

  // Load attachments
  useEffect(() => {
    const loadFiles = async () => {
      if (currentUser && branchName && targetMonth) {
        setAttachmentsLoading(true);
        try {
          const files = await loadAttachments(branchName, targetMonth);
          setAttachments(files);
        } catch (error) {
          setAttachments([]);
        } finally {
          setAttachmentsLoading(false);
        }
      } else {
        setAttachments([]);
      }
    };
    loadFiles();
  }, [currentUser, branchName, targetMonth]);

  // Auto-dismiss messages
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Default month
  useEffect(() => {
    if (!targetMonth) {
      const now = new Date();
      setTargetMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }
  }, [targetMonth]);

  // branch_user auto-select
  useEffect(() => {
    if (currentUser?.role === 'branch_user' && currentUser.branchName) {
      setBranchName(currentUser.branchName);
      const branch = settings.branches.find(b => b.name === currentUser.branchName || b.id === currentUser.branchName);
      if (branch) {
        setCurrency(branch.currency || 'USD');
        setManagerName(branch.manager || '');
        setDefaultPaymentMethod(currentUser.preferredPaymentMethod || branch.paymentMethod || '');
      }
    }
  }, [currentUser, settings.branches]);

  // Admin branch change auto-fill
  useEffect(() => {
    if (branchName && currentUser?.role === 'hq_admin') {
      const branch = settings.branches.find(b => b.name === branchName);
      if (branch) {
        setManagerName(branch.manager || '');
        setCurrency(branch.currency || 'USD');
        setDefaultPaymentMethod(currentUser.preferredPaymentMethod || branch.paymentMethod || '');
      }
    }
  }, [branchName, settings.branches, currentUser]);

  // Auto-load cost data
  const autoLoadCostData = useCallback(async (branch, month) => {
    if (!branch || !month) return;
    setAutoLoadMessage('');
    try {
      const previousData = await getSecurityCostsByBranch(branch, month);
      if (previousData.length > 0 && previousData[0].items?.length > 0) {
        const cleanItems = previousData[0].items.map(item => ({
          item: item.item || '', unitPrice: item.unitPrice?.toString() || '', quantity: item.quantity?.toString() || '',
          qtyUnit: item.qtyUnit || '', estimatedCost: item.estimatedCost?.toString() || '', actualCost: item.actualCost?.toString() || '',
          currency: item.currency || currency, paymentMethod: item.paymentMethod || '', notes: item.notes || ''
        }));
        setCostItems(cleanItems);
        setAutoLoadMessage(`Loaded data for ${branch} - ${month}`);
        setTimeout(() => setAutoLoadMessage(''), 4000);
      } else {
        resetCostItems();
        setAutoLoadMessage('No input available to load for this station/month.');
      }
    } catch (error) {
      setAutoLoadMessage('Failed to load data.');
    }
  }, [currency, defaultPaymentMethod]);

  const resetCostItems = () => {
    setCostItems([{
      item: '', unitPrice: '', quantity: '', qtyUnit: '', estimatedCost: '', actualCost: '',
      currency: currency, paymentMethod: defaultPaymentMethod, notes: ''
    }]);
  };

  useEffect(() => {
    if (currentUser && branchName && targetMonth) {
      autoLoadCostData(branchName, targetMonth);
    }
  }, [branchName, targetMonth, currentUser?.uid]);

  // Handlers
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

  const handleCurrencyChange = (index, value) => {
    const newItems = [...costItems];
    newItems[index].currency = value;
    setCostItems(newItems);
    if (currentUser?.uid) {
      updateUserPreferences(currentUser.uid, { preferredCurrency: value }).catch(console.error);
    }
  };

  const handlePaymentMethodChange = (index, value) => {
    const newItems = [...costItems];
    newItems[index].paymentMethod = value;
    setCostItems(newItems);
    setDefaultPaymentMethod(value);
    if (currentUser?.uid) {
      updateUserPreferences(currentUser.uid, { preferredPaymentMethod: value }).catch(console.error);
    }
  };

  const handleInputChange = (index, field, value) => {
    const newItems = [...costItems];
    newItems[index][field] = value;
    if (field === 'unitPrice' || field === 'quantity') {
      const price = parseFloat(newItems[index].unitPrice) || 0;
      const qty = parseFloat(newItems[index].quantity) || 0;
      newItems[index].estimatedCost = (price * qty) > 0 ? (price * qty).toString() : '';
    }
    setCostItems(newItems);
  };

  const handleItemChange = async (index, itemName) => {
    const newItems = [...costItems];
    newItems[index].item = itemName;
    if (branchName && targetMonth) {
      try {
        const previousData = await getSecurityCostsByBranch(branchName, targetMonth);
        if (previousData.length > 0) {
          const matchingItem = previousData[0].items?.find(i => i.item === itemName);
          if (matchingItem) {
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
      } catch (error) { /* ignore */ }
    }
    setCostItems(newItems);
  };

  const handleAddItem = () => {
    setCostItems([...costItems, { item: '', unitPrice: '', quantity: '', qtyUnit: '', estimatedCost: '', actualCost: '', currency: currency, paymentMethod: defaultPaymentMethod, notes: '' }]);
  };

  const handleRemoveItem = (index) => {
    if (costItems.length > 1) setCostItems(costItems.filter((_, i) => i !== index));
  };

  const canEditEstimatedCost = () => {
    if (!targetMonth) return true;
    const now = new Date();
    const [ty, tm] = targetMonth.split('-').map(Number);
    if (ty > now.getFullYear()) return false;
    if (ty === now.getFullYear() && tm > now.getMonth() + 1) return false;
    return true;
  };

  const canEditActualCost = () => {
    if (!targetMonth) return false;
    const now = new Date();
    const [ty, tm] = targetMonth.split('-').map(Number);
    if (ty < now.getFullYear()) return true;
    if (ty === now.getFullYear() && tm < now.getMonth() + 1) return true;
    if (ty === now.getFullYear() && tm === now.getMonth() + 1) return now.getDate() >= 28;
    return false;
  };

  const convertToKRW = useCallback((amount, itemCurrency) => {
    if (!amount || !targetMonth) return null;
    const amt = parseFloat(amount);
    if (isNaN(amt)) return null;
    if (itemCurrency === 'KRW') return amt;
    const monthData = monthlyExchangeRates?.[targetMonth];
    if (!monthData?.rates) return null;
    const entry = monthData.rates.find(r => r.currency === itemCurrency);
    if (!entry) return null;
    return amt * (entry.rate / (entry.ratio || 1));
  }, [monthlyExchangeRates, targetMonth]);

  const hasMonthlyRate = !!(monthlyExchangeRates?.[targetMonth]?.rates);

  const handleExchangeRateUpload = async (e, yearMonth) => {
    const file = e.target.files[0];
    if (!file || !yearMonth) return;
    try {
      const rows = await readXlsxFile(file);
      const rates = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 5) continue;
        const ratio = parseFloat(row[0]) || 1;
        const curr = String(row[1]).trim();
        const target = String(row[3]).trim();
        const rate = parseFloat(String(row[4]).replace(/,/g, '').trim());
        if (curr && target === 'KRW' && !isNaN(rate)) rates.push({ currency: curr, rate, ratio });
      }
      if (rates.length === 0) { setMessage({ type: 'error', text: 'No valid exchange rate data found.' }); return; }
      await saveExchangeRates(rates, file.name, yearMonth);
      setMonthlyExchangeRates(prev => ({ ...prev, [yearMonth]: { rates, fileName: file.name, yearMonth, uploadedAt: new Date() } }));
      setMessage({ type: 'success', text: `Exchange rates for ${yearMonth} uploaded: ${rates.length} currencies` });
      setDashboardRefreshKey(prev => prev + 1);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to parse exchange rate file: ' + error.message });
    }
    e.target.value = '';
  };

  // Contract handlers
  const handleContractUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !branchName || !contractYear) { if (!branchName) setMessage({ type: 'error', text: 'Please select a station first.' }); return; }
    if (file.size > 50 * 1024 * 1024) { setMessage({ type: 'error', text: 'File size must be under 50MB.' }); e.target.value = ''; return; }
    try {
      setContractLoading(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const base64 = ev.target.result.split(',')[1];
          await saveContractFile(branchName, contractYear, file.name, base64, file.type, file.size);
          setContractFile({ fileName: file.name, fileType: file.type, fileSize: file.size, uploadedAt: new Date() });
          setMessage({ type: 'success', text: `Contract file uploaded: ${file.name}` });
        } catch (error) { setMessage({ type: 'error', text: 'Failed to upload contract file.' }); }
        finally { setContractLoading(false); }
      };
      reader.readAsDataURL(file);
    } catch (error) { setMessage({ type: 'error', text: 'Failed to read file.' }); setContractLoading(false); }
    e.target.value = '';
  };

  const handleViewContract = async () => {
    if (!branchName || !contractYear) return;
    try {
      setContractLoading(true);
      const data = await loadContractFileData(branchName, contractYear);
      if (data?.fileBase64) {
        const byteArray = new Uint8Array([...atob(data.fileBase64)].map(c => c.charCodeAt(0)));
        const blob = new Blob([byteArray], { type: data.fileType });
        window.open(URL.createObjectURL(blob), '_blank');
      } else { setMessage({ type: 'warning', text: 'No contract file found.' }); }
    } catch (error) { setMessage({ type: 'error', text: 'Failed to load contract file.' }); }
    finally { setContractLoading(false); }
  };

  const handleDeleteContract = async () => {
    if (!branchName || !contractYear || !window.confirm(`Delete contract file for ${branchName} (${contractYear})?`)) return;
    try {
      setContractLoading(true);
      await deleteContractFile(branchName, contractYear);
      setContractFile(null);
      setMessage({ type: 'success', text: `Contract file deleted.` });
    } catch (error) { setMessage({ type: 'error', text: 'Failed to delete contract file.' }); }
    finally { setContractLoading(false); }
  };

  // Attachment handlers
  const handleAttachmentUpload = async (files) => {
    if (!branchName || !targetMonth) { setMessage({ type: 'error', text: 'Please select a station and target month first.' }); return; }
    const fileList = Array.from(files);
    if (fileList.length === 0) return;
    const oversized = fileList.filter(f => f.size > 50 * 1024 * 1024);
    if (oversized.length > 0) { setMessage({ type: 'error', text: `File(s) too large (max 50MB): ${oversized.map(f => f.name).join(', ')}` }); return; }
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
      const refreshed = await loadAttachments(branchName, targetMonth);
      setAttachments(refreshed);
      setMessage({ type: 'success', text: `${uploaded} file(s) uploaded` });
    } catch (error) {
      setMessage({ type: 'error', text: `Uploaded ${uploaded}/${fileList.length} file(s). Error: ${error.message}` });
      const refreshed = await loadAttachments(branchName, targetMonth);
      setAttachments(refreshed);
    } finally { setAttachmentUploading(false); }
  };

  const handleViewAttachment = async (docId) => {
    try {
      const data = await loadAttachmentData(docId);
      if (data?.fileBase64) {
        const byteArray = new Uint8Array([...atob(data.fileBase64)].map(c => c.charCodeAt(0)));
        window.open(URL.createObjectURL(new Blob([byteArray], { type: data.fileType })), '_blank');
      } else { setMessage({ type: 'warning', text: 'File data not found.' }); }
    } catch (error) { setMessage({ type: 'error', text: 'Failed to open file.' }); }
  };

  const handleDeleteAttachment = async (docId, fileName) => {
    if (!window.confirm(`Delete "${fileName}"?`)) return;
    try {
      await deleteAttachment(docId);
      setAttachments(prev => prev.filter(a => a.id !== docId));
      setMessage({ type: 'success', text: `Deleted: ${fileName}` });
    } catch (error) { setMessage({ type: 'error', text: 'Failed to delete file.' }); }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) handleAttachmentUpload(e.dataTransfer.files);
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEditEstimatedCost()) { setMessage({ type: 'error', text: 'Estimated Cost can only be entered for current or past months' }); return; }
    if (costItems.some(item => parseFloat(item.actualCost) > 0 && !canEditActualCost())) { setMessage({ type: 'error', text: 'Actual Cost can only be entered after the 28th of the month' }); return; }
    if (!branchName || !managerName || !targetMonth) { setMessage({ type: 'error', text: 'Please fill in all required fields' }); return; }

    const validItems = costItems.filter(item => {
      const hasItem = item.item?.trim();
      const hasCost = parseFloat(item.estimatedCost) > 0 || parseFloat(item.actualCost) > 0 || (parseFloat(item.unitPrice) > 0 && parseFloat(item.quantity) > 0);
      return hasItem && hasCost;
    });
    if (validItems.length === 0) { setMessage({ type: 'error', text: 'Please add at least one cost item' }); return; }

    setIsSubmitting(true);
    try {
      const submissionData = {
        branchName, managerName, targetMonth, currency, krwExchangeRate: null,
        items: validItems.map(item => ({
          item: item.item, unitPrice: parseFloat(item.unitPrice) || 0, quantity: parseFloat(item.quantity) || 0,
          qtyUnit: item.qtyUnit || '', estimatedCost: parseFloat(item.estimatedCost) || 0, actualCost: parseFloat(item.actualCost) || 0,
          currency: item.currency || currency, paymentMethod: item.paymentMethod, notes: item.notes
        })),
        totalEstimated: calculateTotalEstimated(), totalActual: calculateTotalActual(),
        submittedAt: serverTimestamp(), submittedBy: currentUser?.email || 'unknown'
      };
      await submitSecurityCost(submissionData);

      const currentBranch = settings.branches.find(b => b.name === branchName);
      if (currentBranch && currentBranch.manager !== managerName) {
        const updated = await updateBranchManager(branchName, managerName);
        if (updated) {
          setSettings(prev => ({ ...prev, branches: prev.branches.map(b => b.name === branchName ? { ...b, manager: managerName } : b) }));
        }
      }

      setMessage({ type: 'success', text: 'Security cost submitted successfully!' });
      setHistoryRefreshKey(prev => prev + 1);
      if (currentUser?.role === 'hq_admin') {
        setDashboardRefreshKey(prev => prev + 1);
        setBranchName(''); setManagerName('');
        setCostItems([{ item: '', unitPrice: '', quantity: '', qtyUnit: '', estimatedCost: '', actualCost: '', currency, paymentMethod: defaultPaymentMethod, notes: '' }]);
      } else {
        setTimeout(() => autoLoadCostData(branchName, targetMonth), 1500);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to submit data' });
    } finally { setIsSubmitting(false); }
  };

  const calculateTotalEstimated = () => costItems.reduce((s, i) => s + (parseFloat(i.estimatedCost) || 0), 0);
  const calculateTotalActual = () => costItems.reduce((s, i) => s + (parseFloat(i.actualCost) || 0), 0);

  const isAdminUser = isAdmin(currentUser);

  // --- RENDER ---
  return (
    <div>
      {/* Message banner */}
      {message.text && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: '0.5rem',
          background: message.type === 'success' ? 'rgba(16,185,129,0.15)' : message.type === 'error' ? 'rgba(239,68,68,0.15)' : message.type === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
          color: message.type === 'success' ? '#34D399' : message.type === 'error' ? '#F87171' : message.type === 'warning' ? '#FBBF24' : '#60A5FA',
          border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.3)' : message.type === 'error' ? 'rgba(239,68,68,0.3)' : message.type === 'warning' ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)'}`,
          fontSize: '0.85rem', fontWeight: '500',
        }}>
          {message.text}
        </div>
      )}

      {/* Admin Dashboard */}
      {isAdminUser && (
        <AdminDashboard
          key={`dashboard-${dashboardRefreshKey}`}
          branches={settings.branches.filter(b => b.name !== 'HQ' && b.name !== 'hq')}
          monthlyExchangeRates={monthlyExchangeRates}
          isAdmin={isAdminUser}
          onExchangeRateUpload={handleExchangeRateUpload}
          onYearChange={(year) => setExchangeRateYear(year)}
          onCellClick={(branch, month) => {
            handleBranchChange(branch);
            setTargetMonth(month);
            setTimeout(() => {
              document.getElementById('basic-info-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }}
        />
      )}

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <section id="basic-info-section" style={{
          background: COLORS.surface, padding: '1.5rem', borderRadius: '0.875rem',
          border: `1px solid ${COLORS.border}`, marginBottom: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: COLORS.text.primary, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={20} color={COLORS.secondary} /> Basic Information
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {/* Station Name (admin only) */}
            {currentUser?.role === 'hq_admin' && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', color: COLORS.text.secondary, fontSize: '0.78rem' }}>Station Name *</label>
                <select value={branchName} onChange={(e) => handleBranchChange(e.target.value)} required
                  style={{ width: '100%', padding: '0.6rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', fontSize: '0.85rem', background: COLORS.surfaceLight, color: COLORS.text.primary, cursor: 'pointer' }}>
                  <option value="">Select Station</option>
                  {settings.branches.filter(b => b.name !== 'HQ' && b.name !== 'hq').map((b, i) => (
                    <option key={i} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Manager Name */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', color: COLORS.text.secondary, fontSize: '0.78rem' }}>Manager Name *</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: COLORS.text.light }} />
                <input type="text" value={managerName} onChange={(e) => setManagerName(e.target.value)} required placeholder="Enter manager name"
                  style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.2rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', fontSize: '0.85rem', background: COLORS.surfaceLight, color: COLORS.text.primary }} />
              </div>
            </div>

            {/* Target Month */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', color: COLORS.text.secondary, fontSize: '0.78rem' }}>Target Month *</label>
              <div style={{ position: 'relative' }}>
                <Calendar size={16} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: COLORS.text.light }} />
                <input type="month" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} required
                  style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.2rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', fontSize: '0.85rem', background: COLORS.surfaceLight, color: COLORS.text.primary }} />
              </div>
            </div>

            {/* Contract File */}
            {(currentUser?.role === 'hq_admin' || currentUser?.role === 'branch_user') && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', color: COLORS.text.secondary, fontSize: '0.78rem' }}>Contract File</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.5rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', background: COLORS.surfaceLight, minHeight: '2.4rem' }}>
                  <select value={contractYear} onChange={(e) => setContractYear(e.target.value)}
                    style={{ padding: '0.2rem 0.3rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.375rem', fontSize: '0.75rem', background: COLORS.surface, color: COLORS.text.primary, cursor: 'pointer', minWidth: '65px', flexShrink: 0 }}>
                    {[...Array(5)].map((_, i) => { const y = (new Date().getFullYear() - 2 + i).toString(); return <option key={y} value={y}>{y}</option>; })}
                  </select>
                  <input ref={contractInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={handleContractUpload} style={{ display: 'none' }} />
                  {contractLoading ? (
                    <span style={{ fontSize: '0.68rem', color: COLORS.text.light, flex: 1 }}>Loading...</span>
                  ) : contractFile ? (
                    <span style={{ fontSize: '0.68rem', color: '#60A5FA', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }} title={contractFile.fileName}>{contractFile.fileName}</span>
                  ) : (
                    <span onClick={() => branchName ? contractInputRef.current?.click() : setMessage({ type: 'error', text: 'Please select a station first.' })}
                      style={{ fontSize: '0.68rem', color: COLORS.text.light, flex: 1, cursor: 'pointer', fontStyle: 'italic' }}>No file</span>
                  )}
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button type="button" onClick={() => branchName ? contractInputRef.current?.click() : setMessage({ type: 'error', text: 'Please select a station first.' })} disabled={contractLoading}
                      style={{ background: 'none', border: 'none', cursor: contractLoading ? 'not-allowed' : 'pointer', padding: '2px', borderRadius: '0.25rem', display: 'flex', color: '#60A5FA', opacity: contractLoading ? 0.4 : 1 }}>
                      <Upload size={13} />
                    </button>
                    {contractFile && (
                      <>
                        <button type="button" onClick={handleViewContract} disabled={contractLoading}
                          style={{ background: 'none', border: 'none', cursor: contractLoading ? 'not-allowed' : 'pointer', padding: '2px', borderRadius: '0.25rem', display: 'flex', color: '#34D399', opacity: contractLoading ? 0.4 : 1 }}>
                          <Eye size={13} />
                        </button>
                        <button type="button" onClick={handleDeleteContract} disabled={contractLoading}
                          style={{ background: 'none', border: 'none', cursor: contractLoading ? 'not-allowed' : 'pointer', padding: '2px', borderRadius: '0.25rem', display: 'flex', color: '#F87171', opacity: contractLoading ? 0.4 : 1 }}>
                          <Trash size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '0.65rem', color: COLORS.text.light, marginTop: '0.15rem' }}>
                  {branchName ? `${branchName} / ${contractYear}` : 'Select a station first'} · Max 50MB
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Cost Items */}
        <section style={{ background: COLORS.surface, padding: '1.5rem', borderRadius: '0.875rem', border: `1px solid ${COLORS.border}`, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: COLORS.text.primary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={20} color={COLORS.secondary} /> Cost Items
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={handleAddItem}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}>
                <Plus size={16} /> Add Item
              </button>
              {isAdminUser && branchName && targetMonth && (
                <button type="button" onClick={async () => {
                  if (!window.confirm(`Delete all cost data for ${branchName} - ${targetMonth}?`)) return;
                  try {
                    setIsSubmitting(true);
                    const deleted = await deleteSecurityCostsByBranchMonth(branchName, targetMonth);
                    resetCostItems();
                    setDashboardRefreshKey(prev => prev + 1); setHistoryRefreshKey(prev => prev + 1);
                    setMessage({ type: 'success', text: deleted > 0 ? `${deleted} record(s) deleted.` : 'No records found.' });
                  } catch (error) { setMessage({ type: 'error', text: 'Failed to delete: ' + error.message }); }
                  finally { setIsSubmitting(false); }
                }} disabled={isSubmitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: 'transparent', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontWeight: '600', opacity: isSubmitting ? 0.6 : 1 }}>
                  <Trash2 size={14} /> Clear Data
                </button>
              )}
            </div>
          </div>

          {/* Warnings */}
          {!canEditEstimatedCost() && (
            <div style={{ padding: '0.6rem', marginBottom: '0.75rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '0.5rem', color: '#FBBF24', fontSize: '0.8rem' }}>
              Estimated Cost can only be entered for the current month or earlier
            </div>
          )}
          {!canEditActualCost() && (
            <div style={{ padding: '0.6rem', marginBottom: '0.75rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '0.5rem', color: '#FBBF24', fontSize: '0.8rem' }}>
              Actual Cost can only be entered after the 28th of the month
            </div>
          )}
          {autoLoadMessage && (
            <div style={{ padding: '0.6rem', marginBottom: '0.75rem', background: autoLoadMessage.includes('No input') || autoLoadMessage.includes('Failed') ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${autoLoadMessage.includes('No input') || autoLoadMessage.includes('Failed') ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: '0.5rem', color: autoLoadMessage.includes('No input') || autoLoadMessage.includes('Failed') ? '#FBBF24' : '#34D399', fontSize: '0.8rem' }}>
              {autoLoadMessage}
            </div>
          )}

          {/* Cost item cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {costItems.map((item, index) => {
              const itemCurrency = item.currency || currency;
              const sym = CURRENCY_SYMBOLS[itemCurrency] || itemCurrency;
              const estCost = parseFloat(item.estimatedCost) || 0;
              const actCost = parseFloat(item.actualCost) || 0;
              return (
                <div key={index} style={{ border: `1px solid ${COLORS.border}`, borderRadius: '0.625rem', background: COLORS.surfaceLight, overflow: 'hidden' }}>
                  {/* Card header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0.65rem', background: 'rgba(0,0,0,0.15)', borderBottom: `1px solid ${COLORS.border}` }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', color: COLORS.secondary, letterSpacing: '0.04em' }}>ITEM #{index + 1}</span>
                    <button type="button" onClick={() => handleRemoveItem(index)} disabled={costItems.length === 1}
                      style={{ padding: '0.15rem 0.3rem', background: 'none', color: costItems.length === 1 ? COLORS.text.light : '#F87171', border: 'none', borderRadius: '0.25rem', cursor: costItems.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', fontWeight: '500' }}>
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>

                  {/* Row 1 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.6fr 1fr', gap: '0.4rem', padding: '0.4rem 0.65rem', alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.15rem' }}>Cost Item</label>
                      <select value={item.item} onChange={(e) => handleItemChange(index, e.target.value)} required
                        style={{ width: '100%', padding: '0.35rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.375rem', fontSize: '0.75rem', background: COLORS.surface, color: COLORS.text.primary }}>
                        <option value="">Select Item</option>
                        {settings.costItems.map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)}
                        {item.item && !settings.costItems.some(ci => ci.name === item.item) && <option value={item.item}>{item.item} (custom)</option>}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.15rem' }}>Currency</label>
                      <select value={itemCurrency} onChange={(e) => handleCurrencyChange(index, e.target.value)}
                        style={{ width: '100%', padding: '0.35rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.375rem', fontSize: '0.75rem', background: COLORS.surface, color: COLORS.text.primary }}>
                        {settings.currencies.map(c => <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c] || ''})</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.15rem' }}>Unit Price</label>
                      <input type="text" inputMode="decimal" value={item._unitPriceFocused ? stripCommas(item.unitPrice) : formatInputDisplay(item.unitPrice)}
                        onChange={(e) => handleInputChange(index, 'unitPrice', stripCommas(e.target.value))}
                        onFocus={() => { const n = [...costItems]; n[index]._unitPriceFocused = true; setCostItems(n); }}
                        onBlur={() => { const n = [...costItems]; n[index]._unitPriceFocused = false; setCostItems(n); }}
                        disabled={!canEditEstimatedCost()} placeholder="0"
                        style={{ width: '100%', padding: '0.35rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.375rem', fontSize: '0.75rem', textAlign: 'right', background: !canEditEstimatedCost() ? 'rgba(0,0,0,0.1)' : COLORS.surface, color: COLORS.text.primary }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.15rem' }}>Qty</label>
                      <input type="text" inputMode="numeric" value={item._qtyFocused ? stripCommas(item.quantity) : formatInputDisplay(item.quantity, 0)}
                        onChange={(e) => handleInputChange(index, 'quantity', stripCommas(e.target.value))}
                        onFocus={() => { const n = [...costItems]; n[index]._qtyFocused = true; setCostItems(n); }}
                        onBlur={() => { const n = [...costItems]; n[index]._qtyFocused = false; setCostItems(n); }}
                        disabled={!canEditEstimatedCost()} placeholder="0"
                        style={{ width: '100%', padding: '0.35rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.375rem', fontSize: '0.75rem', textAlign: 'right', background: !canEditEstimatedCost() ? 'rgba(0,0,0,0.1)' : COLORS.surface, color: COLORS.text.primary }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.15rem' }}>Unit</label>
                      <input type="text" value={item.qtyUnit || ''} onChange={(e) => handleInputChange(index, 'qtyUnit', e.target.value)} placeholder="kg, hr..."
                        style={{ width: '100%', padding: '0.35rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.375rem', fontSize: '0.7rem', background: COLORS.surface, color: COLORS.text.primary, textAlign: 'center' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.15rem' }}>Payment</label>
                      <select value={item.paymentMethod} onChange={(e) => handlePaymentMethodChange(index, e.target.value)}
                        style={{ width: '100%', padding: '0.35rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.375rem', fontSize: '0.75rem', background: COLORS.surface, color: COLORS.text.primary }}>
                        <option value="">Select</option>
                        {settings.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                        {item.paymentMethod && !settings.paymentMethods.includes(item.paymentMethod) && <option value={item.paymentMethod}>{item.paymentMethod} (custom)</option>}
                      </select>
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '0.4rem', padding: '0.3rem 0.65rem 0.4rem', borderTop: `1px dashed ${COLORS.border}` }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#60A5FA', display: 'block', marginBottom: '0.15rem' }}>
                        Est. Cost {estCost > 0 && <span style={{ fontWeight: '400', color: COLORS.text.light }}>({sym})</span>}
                      </label>
                      <div style={{ padding: '0.4rem 0.5rem', background: estCost > 0 ? 'rgba(96,165,250,0.1)' : 'rgba(0,0,0,0.1)', border: `2px solid ${estCost > 0 ? 'rgba(96,165,250,0.3)' : COLORS.border}`, borderRadius: '0.375rem', fontSize: '0.9rem', fontWeight: '800', color: estCost > 0 ? '#60A5FA' : COLORS.text.light, textAlign: 'right', minHeight: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {estCost > 0 ? `${sym}${formatNumber(estCost)}` : '\u2014'}
                      </div>
                      {estCost > 0 && hasMonthlyRate && convertToKRW(estCost, itemCurrency) !== null && (
                        <div style={{ fontSize: '0.58rem', color: COLORS.text.secondary, textAlign: 'right', marginTop: '0.08rem' }}>
                          {`\u2248 \u20A9${formatNumberInt(convertToKRW(estCost, itemCurrency))}`}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: '700', color: COLORS.secondary, display: 'block', marginBottom: '0.15rem' }}>Actual Cost</label>
                      <input type="text" inputMode="decimal" value={item._actualCostFocused ? stripCommas(item.actualCost) : formatInputDisplay(item.actualCost)}
                        onChange={(e) => handleInputChange(index, 'actualCost', stripCommas(e.target.value))}
                        onFocus={() => { const n = [...costItems]; n[index]._actualCostFocused = true; setCostItems(n); }}
                        onBlur={() => { const n = [...costItems]; n[index]._actualCostFocused = false; setCostItems(n); }}
                        disabled={!canEditActualCost()} placeholder={canEditActualCost() ? "Enter amount" : "After 28th"}
                        style={{ width: '100%', padding: '0.4rem', border: `2px solid ${actCost > 0 ? 'rgba(233,69,96,0.4)' : COLORS.border}`, borderRadius: '0.375rem', fontSize: '0.9rem', fontWeight: actCost > 0 ? '800' : '400', textAlign: 'right', color: actCost > 0 ? COLORS.secondary : COLORS.text.primary, background: !canEditActualCost() ? 'rgba(0,0,0,0.1)' : actCost > 0 ? 'rgba(233,69,96,0.05)' : COLORS.surface }} />
                      {actCost > 0 && hasMonthlyRate && convertToKRW(actCost, itemCurrency) !== null && (
                        <div style={{ fontSize: '0.58rem', color: COLORS.text.secondary, textAlign: 'right', marginTop: '0.08rem' }}>
                          {`\u2248 \u20A9${formatNumberInt(convertToKRW(actCost, itemCurrency))}`}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '600', color: COLORS.text.secondary, display: 'block', marginBottom: '0.15rem' }}>Notes</label>
                      <input type="text" value={item.notes} onChange={(e) => handleInputChange(index, 'notes', e.target.value)} placeholder="Optional notes"
                        style={{ width: '100%', padding: '0.35rem', border: `1px solid ${COLORS.border}`, borderRadius: '0.375rem', fontSize: '0.75rem', background: COLORS.surface, color: COLORS.text.primary }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.15)', borderRadius: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(96,165,250,0.08)', borderRadius: '0.5rem', borderLeft: '3px solid #60A5FA' }}>
              <p style={{ fontSize: '0.7rem', color: '#60A5FA', marginBottom: '0.2rem', fontWeight: '600' }}>Total Estimated Cost</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '900', color: '#60A5FA' }}>{CURRENCY_SYMBOLS[currency]}{formatNumber(calculateTotalEstimated())}</p>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(233,69,96,0.08)', borderRadius: '0.5rem', borderLeft: `3px solid ${COLORS.secondary}` }}>
              <p style={{ fontSize: '0.7rem', color: COLORS.secondary, marginBottom: '0.2rem', fontWeight: '600' }}>Total Actual Cost</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '900', color: COLORS.secondary }}>{CURRENCY_SYMBOLS[currency]}{formatNumber(calculateTotalActual())}</p>
            </div>
            <div style={{ padding: '0.75rem' }}>
              <p style={{ fontSize: '0.7rem', color: COLORS.text.secondary, marginBottom: '0.2rem' }}>Variance</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '900', color: calculateTotalActual() > calculateTotalEstimated() ? '#F87171' : '#34D399' }}>
                {CURRENCY_SYMBOLS[currency]}{formatNumber(calculateTotalActual() - calculateTotalEstimated())}
              </p>
            </div>
          </div>
        </section>

        {/* Submit button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <button type="submit" disabled={isSubmitting}
            style={{ padding: '0.8rem 1.8rem', background: isSubmitting ? COLORS.text.light : COLORS.secondary, color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.9rem', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: isSubmitting ? 'none' : '0 2px 12px rgba(233,69,96,0.3)' }}>
            {isSubmitting ? (
              <><div style={{ width: '18px', height: '18px', border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Submitting...</>
            ) : 'Submit Security Cost'}
          </button>
        </div>
      </form>

      {/* Attachments */}
      {branchName && targetMonth && (
        <section style={{ background: COLORS.surface, padding: '1.25rem 1.5rem', borderRadius: '0.875rem', border: `1px solid ${COLORS.border}`, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: COLORS.text.primary, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Paperclip size={18} color={COLORS.secondary} /> Attachments
              <span style={{ fontSize: '0.7rem', fontWeight: '400', color: COLORS.text.secondary }}>— {branchName} / {targetMonth}</span>
            </h2>
            {attachments.length > 0 && <span style={{ fontSize: '0.65rem', color: COLORS.text.light }}>{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>}
          </div>

          {/* Drop zone */}
          <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => attachmentInputRef.current?.click()}
            style={{ border: `2px dashed ${isDragOver ? '#60A5FA' : COLORS.border}`, borderRadius: '0.75rem', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: isDragOver ? 'rgba(96,165,250,0.05)' : 'rgba(0,0,0,0.1)', transition: 'all 0.2s', marginBottom: attachments.length > 0 ? '0.75rem' : 0 }}>
            <input ref={attachmentInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv,.zip"
              onChange={(e) => { handleAttachmentUpload(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
            {attachmentUploading ? (
              <div style={{ color: '#60A5FA', fontSize: '0.8rem', fontWeight: '500' }}>
                <div style={{ width: '18px', height: '18px', border: `3px solid ${COLORS.text.light}`, borderTop: '3px solid #60A5FA', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: '0.4rem' }} />
                Uploading...
              </div>
            ) : (
              <>
                <Upload size={20} color={isDragOver ? '#60A5FA' : COLORS.text.light} style={{ marginBottom: '0.3rem' }} />
                <p style={{ fontSize: '0.8rem', color: isDragOver ? '#60A5FA' : COLORS.text.secondary, margin: '0 0 0.15rem 0', fontWeight: '500' }}>
                  {isDragOver ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
                </p>
                <p style={{ fontSize: '0.65rem', color: COLORS.text.light, margin: 0 }}>PDF, DOC, XLS, JPG, PNG, ZIP, etc. · Max 50MB per file</p>
              </>
            )}
          </div>

          {/* File list */}
          {attachmentsLoading ? (
            <div style={{ textAlign: 'center', padding: '0.75rem', color: COLORS.text.light, fontSize: '0.75rem' }}>Loading files...</div>
          ) : attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {attachments.map(att => {
                const sizeKB = att.fileSize ? (att.fileSize / 1024).toFixed(1) : '?';
                const isImage = att.fileType?.startsWith('image/');
                const isPdf = att.fileType === 'application/pdf';
                return (
                  <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.15)', border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', fontSize: '0.75rem' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '0.25rem', background: isImage ? 'rgba(96,165,250,0.1)' : isPdf ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Paperclip size={12} color={isImage ? '#60A5FA' : isPdf ? '#F87171' : COLORS.text.secondary} />
                    </div>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.text.primary, fontWeight: '500' }} title={att.fileName}>{att.fileName}</span>
                    <span style={{ fontSize: '0.6rem', color: COLORS.text.light, flexShrink: 0 }}>{sizeKB}KB</span>
                    <button type="button" onClick={() => handleViewAttachment(att.id)} title="View" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: '#34D399', borderRadius: '0.25rem' }}><Eye size={14} /></button>
                    <button type="button" onClick={() => handleDeleteAttachment(att.id, att.fileName)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: '#F87171', borderRadius: '0.25rem' }}><X size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Cost History */}
      {branchName && (
        <BranchCostHistory key={`${branchName}-${historyRefreshKey}`} branchName={branchName} currency={currency} />
      )}
    </div>
  );
}

export default SecurityFeePage;
