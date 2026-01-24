import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Building2,
  FileText,
  Upload,
  Settings,
  X,
  Save,
  Download,
} from 'lucide-react';

// API Constant
const API_URL = 'https://script.google.com/macros/s/AKfycbzq7I4yROJqWqRAQA0PlF_GbCUdyhvNHy3ybD8V5rtYc4Vdt4a-D5LKR1HxLZjGiOO-1g/exec';

// Default settings
const DEFAULT_SETTINGS = {
  branchNames: ['Seoul Branch', 'Tokyo Branch', 'New York Branch', 'London Branch', 'Singapore Branch'],
  itemNames: ['Labor Cost', 'Maintenance', 'Equipment', 'Software License', 'Other'],
  currencies: ['KRW', 'USD', 'EUR', 'JPY', 'CNY'],
  paymentMethods: ['Wire Transfer', 'ICH', 'Credit Card', 'Cash'],
};

function App() {
  // Settings state
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempSettings, setTempSettings] = useState(DEFAULT_SETTINGS);

  // Header information state
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [managerName, setManagerName] = useState('');
  const [targetMonth, setTargetMonth] = useState('');

  // Cost items list state
  const [costItems, setCostItems] = useState([
    {
      id: Date.now(),
      itemName: DEFAULT_SETTINGS.itemNames[0],
      unitPrice: '',
      currency: DEFAULT_SETTINGS.currencies[0],
      quantity: '',
      estimatedCost: 0,
      actualCost: '',
      basis: '',
      paymentMethod: DEFAULT_SETTINGS.paymentMethods[0],
      contract: null,
      contractBase64: '',
      contractFileName: '',
      note: '',
    },
  ]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('branchSecuritySettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        setTempSettings(parsed);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  // Save settings
  const saveSettings = () => {
    setSettings(tempSettings);
    localStorage.setItem('branchSecuritySettings', JSON.stringify(tempSettings));
    setShowSettingsModal(false);
  };

  // Update temp settings
  const updateTempSetting = (key, index, value) => {
    const currentArray = tempSettings?.[key] || [];
    setTempSettings((prev) => ({
      ...prev,
      [key]: currentArray.map((item, i) => (i === index ? value : item)),
    }));
  };

  const addTempSettingItem = (key) => {
    setTempSettings((prev) => ({
      ...prev,
      [key]: [...prev[key], ''],
    }));
  };

  const removeTempSettingItem = (key, index) => {
    const currentArray = tempSettings?.[key] || [];
    if (currentArray.length > 1) {
      setTempSettings((prev) => ({
        ...prev,
        [key]: currentArray.filter((_, i) => i !== index),
      }));
    }
  };

  // Load previous data
  const loadPreviousData = async () => {
    if (!branchName || !branchCode || !targetMonth) {
      alert('Please enter Branch Name, Branch Code, and Target Month to load previous data.');
      return;
    }

    setIsLoading(true);

    try {
      const url = `${API_URL}?action=load&branchName=${encodeURIComponent(branchName)}&branchCode=${encodeURIComponent(branchCode)}&targetMonth=${encodeURIComponent(targetMonth)}`;
      
      console.log('Loading data from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
      });

      console.log('Load response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Load response data:', result);

        if (result.status === 'success' && result.data) {
          // Populate form with loaded data
          setManagerName(result.data.header.managerName);
          
          // Map loaded items to form structure
          const loadedItems = result.data.costItems.map((item, index) => ({
            id: Date.now() + index,
            itemName: item.itemName,
            unitPrice: item.unitPrice.toString(),
            currency: item.currency,
            quantity: item.quantity.toString(),
            estimatedCost: item.estimatedCost,
            actualCost: item.actualCost.toString(),
            basis: item.basis,
            paymentMethod: item.paymentMethod,
            contract: null,
            contractBase64: '',
            contractFileName: item.contractFileName,
            note: item.note,
          }));
          
          setCostItems(loadedItems);
          alert('Previous data loaded successfully!');
        } else if (result.status === 'error') {
          if (result.message.includes('Invalid branch code')) {
            alert('Invalid branch code. Please check your credentials.');
          } else {
            alert(`Error: ${result.message}`);
          }
        } else {
          alert('No previous data found for this branch and month.');
        }
      } else {
        throw new Error(`Failed to load data: ${response.status}`);
      }
    } catch (error) {
      console.error('Load error:', error);
      alert('Failed to load previous data. The feature may require CORS support from Google Apps Script.\n\nPlease ensure:\n1. The script is deployed as a web app\n2. Access is set to "Anyone"\n3. The doGet function is implemented');
    } finally {
      setIsLoading(false);
    }
  };

  // Add cost item
  const addCostItem = () => {
    setCostItems([
      ...costItems,
      {
        id: Date.now(),
        itemName: (settings?.itemNames || DEFAULT_SETTINGS.itemNames)[0],
        unitPrice: '',
        currency: (settings?.currencies || DEFAULT_SETTINGS.currencies)[0],
        quantity: '',
        estimatedCost: 0,
        actualCost: '',
        basis: '',
        paymentMethod: (settings?.paymentMethods || DEFAULT_SETTINGS.paymentMethods)[0],
        contract: null,
        contractBase64: '',
        contractFileName: '',
        note: '',
      },
    ]);
  };

  // Remove cost item
  const removeCostItem = (id) => {
    if (costItems.length > 1) {
      setCostItems(costItems.filter((item) => item.id !== id));
    }
  };

  // Update cost item
  const updateCostItem = (id, field, value) => {
    setCostItems(
      costItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };

          // Auto-calculate estimated cost
          if (field === 'unitPrice' || field === 'quantity') {
            const unitPrice = parseFloat(field === 'unitPrice' ? value : item.unitPrice) || 0;
            const quantity = parseFloat(field === 'quantity' ? value : item.quantity) || 0;
            updatedItem.estimatedCost = unitPrice * quantity;
          }

          return updatedItem;
        }
        return item;
      })
    );
  };

  // File upload handler (Base64 conversion)
  const handleFileUpload = (id, file) => {
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setCostItems(
          costItems.map((item) => {
            if (item.id === id) {
              return {
                ...item,
                contract: file,
                contractBase64: base64String,
                contractFileName: file.name,
              };
            }
            return item;
          })
        );
      };
      reader.readAsDataURL(file);
    } else {
      alert('Only PDF files can be uploaded.');
    }
  };

  // Validation: actual cost > estimated cost
  const isActualCostExceeded = (item) => {
    const actualCost = parseFloat(item.actualCost) || 0;
    return actualCost > item.estimatedCost && item.estimatedCost > 0;
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!branchName || !branchCode || !managerName || !targetMonth) {
      alert('Please fill in all required fields.');
      return;
    }

    // Prepare data
    const formData = {
      header: {
        branchName,
        branchCode,
        managerName,
        targetMonth,
      },
      costItems: costItems.map((item) => ({
        itemName: item.itemName,
        unitPrice: parseFloat(item.unitPrice) || 0,
        currency: item.currency,
        quantity: parseFloat(item.quantity) || 0,
        estimatedCost: item.estimatedCost,
        actualCost: parseFloat(item.actualCost) || 0,
        basis: item.basis,
        paymentMethod: item.paymentMethod,
        contractBase64: item.contractBase64,
        contractFileName: item.contractFileName,
        note: item.note,
      })),
      timestamp: new Date().toISOString(),
    };

    setIsSubmitting(true);

    try {
      console.log('Submitting data:', formData);
      
      // Try with CORS mode first
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        mode: 'cors',
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Response data:', result);
        
        if (result.status === 'success') {
          setShowSuccessModal(true);
          resetForm();
        } else if (result.status === 'error') {
          if (result.message.includes('Invalid branch code')) {
            alert('Invalid branch code. Please check your credentials.');
          } else {
            alert(`Submission error: ${result.message}`);
          }
        }
      } else {
        throw new Error(`Server responded with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Submission error:', error);
      
      // Fallback to no-cors mode
      try {
        await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: JSON.stringify(formData),
          mode: 'no-cors',
        });
        
        // In no-cors mode, we can't read the response
        setShowSuccessModal(true);
        alert('Data sent in no-cors mode. Please verify submission in Google Sheets.');
        resetForm();
      } catch (fallbackError) {
        console.error('Fallback submission error:', fallbackError);
        alert('Failed to submit data. Please check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setBranchName('');
    setBranchCode('');
    setManagerName('');
    setTargetMonth('');
    setCostItems([
      {
        id: Date.now(),
        itemName: (settings?.itemNames || DEFAULT_SETTINGS.itemNames)[0],
        unitPrice: '',
        currency: (settings?.currencies || DEFAULT_SETTINGS.currencies)[0],
        quantity: '',
        estimatedCost: 0,
        actualCost: '',
        basis: '',
        paymentMethod: (settings?.paymentMethods || DEFAULT_SETTINGS.paymentMethods)[0],
        contract: null,
        contractBase64: '',
        contractFileName: '',
        note: '',
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Building2 className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Branch Security Cost Submission System</h1>
            </div>
            <button
              onClick={() => {
                setTempSettings(settings);
                setShowSettingsModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header information card */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Basic Information
              </h2>
              <button
                type="button"
                onClick={loadPreviousData}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Load Previous Data</span>
                  </>
                )}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  required
                >
                  <option value="">Select Branch</option>
                  {(settings?.branchNames || DEFAULT_SETTINGS.branchNames).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your branch code"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manager Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Month <span className="text-red-500">*</span>
                </label>
                <input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Cost items list */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Cost Items
              </h2>
              <button
                type="button"
                onClick={addCostItem}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-6">
              {costItems.map((item, index) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative"
                >
                  {/* Item header */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-700">
                      Item #{index + 1}
                    </h3>
                    {costItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCostItem(item.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Item fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Item name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item Name
                      </label>
                      <select
                        value={item.itemName}
                        onChange={(e) =>
                          updateCostItem(item.id, 'itemName', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {(settings?.itemNames || DEFAULT_SETTINGS.itemNames).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Unit price */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Price
                      </label>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateCostItem(item.id, 'unitPrice', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    {/* Currency */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Currency
                      </label>
                      <select
                        value={item.currency}
                        onChange={(e) =>
                          updateCostItem(item.id, 'currency', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {(settings?.currencies || DEFAULT_SETTINGS.currencies).map((curr) => (
                          <option key={curr} value={curr}>
                            {curr}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity per month */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity/Month
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateCostItem(item.id, 'quantity', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    {/* Estimated cost (auto-calculated) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Estimated Cost
                      </label>
                      <input
                        type="text"
                        value={item.estimatedCost.toLocaleString()}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                        disabled
                      />
                    </div>

                    {/* Actual cost */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Actual Cost
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.actualCost}
                          onChange={(e) =>
                            updateCostItem(item.id, 'actualCost', e.target.value)
                          }
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            isActualCostExceeded(item)
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300'
                          }`}
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                        {isActualCostExceeded(item) && (
                          <AlertTriangle className="absolute right-3 top-2.5 w-5 h-5 text-red-500" />
                        )}
                      </div>
                    </div>

                    {/* Calculation basis */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Calculation Basis
                      </label>
                      <input
                        type="text"
                        value={item.basis}
                        onChange={(e) =>
                          updateCostItem(item.id, 'basis', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Based on 22 working days per month"
                      />
                    </div>

                    {/* Payment method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Method
                      </label>
                      <select
                        value={item.paymentMethod}
                        onChange={(e) =>
                          updateCostItem(item.id, 'paymentMethod', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {(settings?.paymentMethods || DEFAULT_SETTINGS.paymentMethods).map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Contract upload */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contract (PDF)
                      </label>
                      <div className="flex items-center space-x-2">
                        <label className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                          <Upload className="w-4 h-4 mr-2 text-gray-600" />
                          <span className="text-sm text-gray-600">
                            {item.contractFileName || 'Select PDF file'}
                          </span>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) =>
                              handleFileUpload(item.id, e.target.files[0])
                            }
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Note */}
                    <div className="lg:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Note
                      </label>
                      <textarea
                        value={item.note}
                        onChange={(e) =>
                          updateCostItem(item.id, 'note', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Additional notes"
                        rows="2"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit button */}
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center space-x-2 px-8 py-3 rounded-md text-white font-medium transition-colors ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Submit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-900">System Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Branch Names */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Branch Names
                </label>
                <div className="space-y-2">
                  {(tempSettings?.branchNames || []).map((name, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) =>
                          updateTempSetting('branchNames', index, e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Branch name"
                      />
                      <button
                        type="button"
                        onClick={() => removeTempSettingItem('branchNames', index)}
                        className="p-2 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addTempSettingItem('branchNames')}
                    className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Branch</span>
                  </button>
                </div>
              </div>

              {/* Item Names */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Cost Item Names
                </label>
                <div className="space-y-2">
                  {(tempSettings?.itemNames || []).map((name, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) =>
                          updateTempSetting('itemNames', index, e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Item name"
                      />
                      <button
                        type="button"
                        onClick={() => removeTempSettingItem('itemNames', index)}
                        className="p-2 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addTempSettingItem('itemNames')}
                    className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              {/* Currencies */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Currencies
                </label>
                <div className="space-y-2">
                  {(tempSettings?.currencies || []).map((curr, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={curr}
                        onChange={(e) =>
                          updateTempSetting('currencies', index, e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Currency code"
                      />
                      <button
                        type="button"
                        onClick={() => removeTempSettingItem('currencies', index)}
                        className="p-2 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addTempSettingItem('currencies')}
                    className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Currency</span>
                  </button>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Payment Methods
                </label>
                <div className="space-y-2">
                  {(tempSettings?.paymentMethods || []).map((method, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={method}
                        onChange={(e) =>
                          updateTempSetting('paymentMethods', index, e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Payment method"
                      />
                      <button
                        type="button"
                        onClick={() => removeTempSettingItem('paymentMethods', index)}
                        className="p-2 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addTempSettingItem('paymentMethods')}
                    className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Method</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Save className="w-5 h-5" />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Submission Complete!
              </h3>
              <p className="text-gray-600 mb-6">
                Your data has been successfully submitted.
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

export default App;
