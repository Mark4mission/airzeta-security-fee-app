import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Building2, DollarSign, Globe, CreditCard, Users, Edit2, Shield, UserPlus, Clock, CheckCircle, XCircle } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import { COLLECTIONS, saveSettingsToFirestore } from '../firebase/collections';
import { deleteUserProfile, approvePendingAdmin, rejectPendingAdmin } from '../firebase/auth';

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

function Settings({ settings, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState('branches');
  const [localSettings, setLocalSettings] = useState(settings);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [newCurrency, setNewCurrency] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('');

  // User Management State
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [addUserMode, setAddUserMode] = useState('existing'); // 'existing' or 'new'
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    branchName: '',
    role: 'branch_user'
  });
  const [pendingAdmins, setPendingAdmins] = useState([]);

  useEffect(() => {
    console.log('Settings received:', settings);
    console.log('LocalSettings branches:', localSettings.branches);
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
      const userList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Loaded users:', userList);
      setUsers(userList);
      // pending_admin 사용자 분리
      setPendingAdmins(userList.filter(u => u.role === 'pending_admin'));
    } catch (error) {
      console.error('Error loading users:', error);
      setMessage({ type: 'error', text: 'Failed to load users' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (addUserMode === 'existing') {
      // 기존 Google 로그인 사용자의 브랜치/역할 배정
      if (!newUser.email || !newUser.branchName) {
        setMessage({ type: 'error', text: 'Please fill email and branch fields' });
        return;
      }
      
      try {
        // Firestore에서 해당 이메일의 사용자 문서 찾기
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
        const existingUser = querySnapshot.docs.find(d => d.data().email === newUser.email);
        
        if (existingUser) {
          // 기존 사용자 업데이트
          await updateDoc(doc(db, COLLECTIONS.USERS, existingUser.id), {
            branchName: newUser.branchName,
            role: newUser.role,
            active: true,
            updatedAt: new Date()
          });
          setMessage({ type: 'success', text: `User ${newUser.email} updated with branch ${newUser.branchName}` });
        } else {
          setMessage({ type: 'error', text: `User ${newUser.email} not found. They need to login with Google first.` });
          return;
        }
        
        setShowAddUser(false);
        setNewUser({ email: '', password: '', branchName: '', role: 'branch_user' });
        loadUsers();
      } catch (error) {
        console.error('Error updating user:', error);
        setMessage({ type: 'error', text: error.message });
      }
    } else {
      // 새 이메일/비밀번호 사용자 생성 (기존 방식)
      if (!newUser.email || !newUser.password || !newUser.branchName) {
        setMessage({ type: 'error', text: 'Please fill all fields' });
        return;
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          newUser.email,
          newUser.password
        );

        await addDoc(collection(db, COLLECTIONS.USERS), {
          uid: userCredential.user.uid,
          email: newUser.email,
          branchName: newUser.branchName,
          role: newUser.role,
          active: true,
          createdAt: new Date()
        });

        setMessage({ type: 'success', text: 'User added successfully' });
        setShowAddUser(false);
        setNewUser({ email: '', password: '', branchName: '', role: 'branch_user' });
        loadUsers();
      } catch (error) {
        console.error('Error adding user:', error);
        setMessage({ type: 'error', text: error.message });
      }
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const userRef = doc(db, COLLECTIONS.USERS, editingUser.id);
      await updateDoc(userRef, {
        branchName: editingUser.branchName,
        role: editingUser.role,
        updatedAt: new Date()
      });

      setMessage({ type: 'success', text: 'User updated successfully' });
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleToggleRole = async (user) => {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, user.id);
      const newRole = user.role === 'hq_admin' ? 'branch_user' : 'hq_admin';
      await updateDoc(userRef, { role: newRole, updatedAt: new Date() });
      setMessage({ type: 'success', text: `Role changed to ${newRole}` });
      loadUsers();
    } catch (error) {
      console.error('Error toggling role:', error);
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await deleteUserProfile(userId);
      setMessage({ type: 'success', text: 'User deleted successfully' });
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      setMessage({ type: 'error', text: error.message });
    }
  };

  // pending_admin 승인/거부 핸들러
  const handleApprovePendingAdmin = async (uid) => {
    if (!window.confirm('Approve this user as HQ Administrator?')) return;
    try {
      await approvePendingAdmin(uid);
      setMessage({ type: 'success', text: 'Admin approved successfully!' });
      loadUsers();
    } catch (error) {
      console.error('Error approving admin:', error);
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleRejectPendingAdmin = async (uid) => {
    if (!window.confirm('Reject this admin request? The user will need to re-select a branch.')) return;
    try {
      await rejectPendingAdmin(uid);
      setMessage({ type: 'success', text: 'Admin request rejected.' });
      loadUsers();
    } catch (error) {
      console.error('Error rejecting admin:', error);
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleAddBranch = () => {
    setLocalSettings({
      ...localSettings,
      branches: [...localSettings.branches, {
        name: '',
        manager: '',
        currency: 'USD',
        paymentMethod: 'Bank Transfer'
      }]
    });
  };

  const handleRemoveBranch = (index) => {
    setLocalSettings({
      ...localSettings,
      branches: localSettings.branches.filter((_, i) => i !== index)
    });
  };

  const handleBranchChange = (index, field, value) => {
    const newBranches = [...localSettings.branches];
    newBranches[index][field] = value;
    setLocalSettings({ ...localSettings, branches: newBranches });
  };

  const handleAddCostItem = () => {
    setLocalSettings({
      ...localSettings,
      costItems: [...localSettings.costItems, {
        name: '',
        description: ''
      }]
    });
  };

  const handleRemoveCostItem = (index) => {
    setLocalSettings({
      ...localSettings,
      costItems: localSettings.costItems.filter((_, i) => i !== index)
    });
  };

  const handleCostItemChange = (index, field, value) => {
    const newItems = [...localSettings.costItems];
    newItems[index][field] = value;
    setLocalSettings({ ...localSettings, costItems: newItems });
  };

  const handleAddCurrency = () => {
    if (!newCurrency.trim()) return;
    setLocalSettings({
      ...localSettings,
      currencies: [...localSettings.currencies, newCurrency.toUpperCase()]
    });
    setNewCurrency('');
  };

  const handleRemoveCurrency = (index) => {
    setLocalSettings({
      ...localSettings,
      currencies: localSettings.currencies.filter((_, i) => i !== index)
    });
  };

  const handleAddPaymentMethod = () => {
    if (!newPaymentMethod.trim()) return;
    setLocalSettings({
      ...localSettings,
      paymentMethods: [...localSettings.paymentMethods, newPaymentMethod]
    });
    setNewPaymentMethod('');
  };

  const handleRemovePaymentMethod = (index) => {
    setLocalSettings({
      ...localSettings,
      paymentMethods: localSettings.paymentMethods.filter((_, i) => i !== index)
    });
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      // 1. Firestore에 저장
      await saveSettingsToFirestore(localSettings);
      
      // 2. 부모 컴포넌트에 전달 (로컬 state + localStorage 업데이트)
      onSave(localSettings);
      
      setMessage({ type: 'success', text: 'Settings saved to Firestore successfully!' });
      console.log('[Settings] 저장 완료 (Firestore + localStorage)');
    } catch (error) {
      console.error('[Settings] 저장 실패:', error);
      setMessage({ type: 'error', text: `Failed to save settings: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'branches', label: 'Branches', icon: Building2 },
    { id: 'costItems', label: 'Cost Items', icon: DollarSign },
    { id: 'currencies', label: 'Currencies', icon: Globe },
    { id: 'paymentMethods', label: 'Payment Methods', icon: CreditCard },
    { id: 'users', label: 'User Management', icon: Users }
  ];

  console.log('Rendering branches:', localSettings.branches);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: COLORS.surface,
        borderRadius: '1rem',
        width: '90%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: `1px solid ${COLORS.background}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, #0f2557 100%)`
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
            System Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: 'white'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Message */}
        {message.text && (
          <div style={{
            padding: '1rem',
            background: message.type === 'success' ? COLORS.success : COLORS.error,
            color: 'white',
            textAlign: 'center'
          }}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: `2px solid ${COLORS.background}`,
          background: COLORS.background
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '1rem',
                  border: 'none',
                  background: activeTab === tab.id ? COLORS.surface : 'transparent',
                  borderBottom: activeTab === tab.id ? `3px solid ${COLORS.primary}` : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  color: activeTab === tab.id ? COLORS.primary : COLORS.text.secondary,
                  fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '2rem'
        }}>
          {/* Branches Tab */}
          {activeTab === 'branches' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: COLORS.text.primary }}>Branch Management</h3>
                <button
                  onClick={handleAddBranch}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    background: COLORS.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  <Plus size={20} />
                  Add Branch
                </button>
              </div>
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                {localSettings.branches && localSettings.branches.length > 0 ? (
                  localSettings.branches.map((branch, index) => (
                    <div key={index} style={{
                      padding: '1.5rem',
                      background: COLORS.background,
                      borderRadius: '0.5rem',
                      border: `1px solid ${COLORS.text.light}`
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'center' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                            Branch Name
                          </label>
                          <input
                            type="text"
                            value={branch.name || ''}
                            onChange={(e) => handleBranchChange(index, 'name', e.target.value)}
                            placeholder="e.g., Seoul Branch"
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: `1px solid ${COLORS.text.light}`,
                              borderRadius: '0.375rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                            Manager
                          </label>
                          <input
                            type="text"
                            value={branch.manager || ''}
                            onChange={(e) => handleBranchChange(index, 'manager', e.target.value)}
                            placeholder="Manager name"
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: `1px solid ${COLORS.text.light}`,
                              borderRadius: '0.375rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                            Currency
                          </label>
                          <select
                            value={branch.currency || 'USD'}
                            onChange={(e) => handleBranchChange(index, 'currency', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: `1px solid ${COLORS.text.light}`,
                              borderRadius: '0.375rem'
                            }}
                          >
                            {localSettings.currencies.map(curr => (
                              <option key={curr} value={curr}>{curr}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                            Payment Method
                          </label>
                          <select
                            value={branch.paymentMethod || 'Bank Transfer'}
                            onChange={(e) => handleBranchChange(index, 'paymentMethod', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: `1px solid ${COLORS.text.light}`,
                              borderRadius: '0.375rem'
                            }}
                          >
                            {localSettings.paymentMethods.map(method => (
                              <option key={method} value={method}>{method}</option>
                            ))}
                          </select>
                        </div>

                        <button
                          onClick={() => handleRemoveBranch(index)}
                          style={{
                            padding: '0.5rem',
                            background: COLORS.error,
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: COLORS.text.secondary, textAlign: 'center', padding: '2rem' }}>
                    No branches found. Click "Add Branch" to create one.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cost Items Tab */}
          {activeTab === 'costItems' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: COLORS.text.primary }}>Cost Item Management</h3>
                <button
                  onClick={handleAddCostItem}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    background: COLORS.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  <Plus size={20} />
                  Add Cost Item
                </button>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                {localSettings.costItems.map((item, index) => (
                  <div key={index} style={{
                    padding: '1.5rem',
                    background: COLORS.background,
                    borderRadius: '0.5rem',
                    border: `1px solid ${COLORS.text.light}`
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '1rem', alignItems: 'center' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                          Item Name
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleCostItemChange(index, 'name', e.target.value)}
                          placeholder="e.g., Security Personnel"
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: `1px solid ${COLORS.text.light}`,
                            borderRadius: '0.375rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                          Description
                        </label>
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => handleCostItemChange(index, 'description', e.target.value)}
                          placeholder="Item description"
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: `1px solid ${COLORS.text.light}`,
                            borderRadius: '0.375rem'
                          }}
                        />
                      </div>

                      <button
                        onClick={() => handleRemoveCostItem(index)}
                        style={{
                          padding: '0.5rem',
                          background: COLORS.error,
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Currencies Tab */}
          {activeTab === 'currencies' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: COLORS.text.primary }}>Currency Management</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    placeholder="e.g., JPY"
                    style={{
                      padding: '0.75rem',
                      border: `1px solid ${COLORS.text.light}`,
                      borderRadius: '0.5rem',
                      width: '150px'
                    }}
                  />
                  <button
                    onClick={handleAddCurrency}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      background: COLORS.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    <Plus size={20} />
                    Add
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {localSettings.currencies.map((currency, index) => (
                  <div key={index} style={{
                    padding: '1rem',
                    background: COLORS.background,
                    borderRadius: '0.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 'bold', color: COLORS.text.primary }}>{currency}</span>
                    <button
                      onClick={() => handleRemoveCurrency(index)}
                      style={{
                        padding: '0.25rem',
                        background: COLORS.error,
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Methods Tab */}
          {activeTab === 'paymentMethods' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: COLORS.text.primary }}>Payment Method Management</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                    placeholder="e.g., Wire Transfer"
                    style={{
                      padding: '0.75rem',
                      border: `1px solid ${COLORS.text.light}`,
                      borderRadius: '0.5rem',
                      width: '200px'
                    }}
                  />
                  <button
                    onClick={handleAddPaymentMethod}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      background: COLORS.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    <Plus size={20} />
                    Add
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                {localSettings.paymentMethods.map((method, index) => (
                  <div key={index} style={{
                    padding: '1rem',
                    background: COLORS.background,
                    borderRadius: '0.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: COLORS.text.primary }}>{method}</span>
                    <button
                      onClick={() => handleRemovePaymentMethod(index)}
                      style={{
                        padding: '0.25rem',
                        background: COLORS.error,
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Management Tab */}
          {activeTab === 'users' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: COLORS.text.primary }}>User Management</h3>
                {!showAddUser && !editingUser && (
                  <button
                    onClick={() => { loadUsers(); setShowAddUser(true); setAddUserMode('existing'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      background: COLORS.success,
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    <UserPlus size={20} />
                    Add New User
                  </button>
                )}
              </div>

              {/* Pending Admin Approvals Section */}
              {pendingAdmins.length > 0 && !showAddUser && !editingUser && (
                <div style={{
                  padding: '1.5rem',
                  background: '#fef3c7',
                  border: '2px solid #fbbf24',
                  borderRadius: '0.75rem',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Clock size={20} color="#92400e" />
                    <h4 style={{ margin: 0, color: '#92400e', fontSize: '1rem' }}>
                      Pending Admin Approvals ({pendingAdmins.length})
                    </h4>
                  </div>
                  <p style={{ color: '#a16207', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                    These users have requested HQ administrator access. Please review and approve or reject.
                  </p>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {pendingAdmins.map(user => (
                      <div key={user.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        background: 'white',
                        borderRadius: '0.5rem',
                        border: '1px solid #fbbf24'
                      }}>
                        <div>
                          <div style={{ fontWeight: '600', color: COLORS.text.primary, fontSize: '0.9rem' }}>
                            {user.email}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: COLORS.text.secondary }}>
                            {user.displayName && `${user.displayName} | `}
                            Requested: {user.pendingAdminRequestedAt?.seconds
                              ? new Date(user.pendingAdminRequestedAt.seconds * 1000).toLocaleDateString()
                              : 'Unknown'
                            }
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleApprovePendingAdmin(user.id)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: COLORS.success,
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.8rem'
                            }}
                          >
                            <CheckCircle size={16} /> Approve
                          </button>
                          <button
                            onClick={() => handleRejectPendingAdmin(user.id)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: COLORS.error,
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.8rem'
                            }}
                          >
                            <XCircle size={16} /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add User Form */}
              {showAddUser && (
                <div style={{
                  padding: '2rem',
                  background: COLORS.background,
                  borderRadius: '0.5rem',
                  marginBottom: '1.5rem'
                }}>
                  {/* Mode Toggle */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setAddUserMode('existing')}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: addUserMode === 'existing' ? COLORS.primary : 'white',
                        color: addUserMode === 'existing' ? 'white' : COLORS.text.primary,
                        border: `2px solid ${addUserMode === 'existing' ? COLORS.primary : COLORS.text.light}`,
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.875rem'
                      }}
                    >
                      Assign Google User to Branch
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddUserMode('new')}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: addUserMode === 'new' ? COLORS.primary : 'white',
                        color: addUserMode === 'new' ? 'white' : COLORS.text.primary,
                        border: `2px solid ${addUserMode === 'new' ? COLORS.primary : COLORS.text.light}`,
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.875rem'
                      }}
                    >
                      Create Email/Password User
                    </button>
                  </div>

                  <h4 style={{ marginTop: 0, color: COLORS.text.primary }}>
                    {addUserMode === 'existing' 
                      ? 'Assign Google User to Branch' 
                      : 'Create New Email/Password User'}
                  </h4>
                  
                  {addUserMode === 'existing' && (
                    <p style={{ fontSize: '0.8rem', color: COLORS.text.secondary, marginBottom: '1rem' }}>
                      Google로 이미 로그인한 사용자의 이메일을 입력하고, 브랜치와 역할을 지정하세요.
                    </p>
                  )}
                  
                  <form onSubmit={handleAddUser}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                          Email *
                        </label>
                        {addUserMode === 'existing' ? (
                          <select
                            required
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: `1px solid ${COLORS.text.light}`,
                              borderRadius: '0.375rem'
                            }}
                          >
                            <option value="">Select existing user</option>
                            {users.filter(u => !u.branchName).map(u => (
                              <option key={u.id} value={u.email}>{u.email} ({u.role})</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="email"
                            required
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: `1px solid ${COLORS.text.light}`,
                              borderRadius: '0.375rem'
                            }}
                          />
                        )}
                      </div>
                      {addUserMode === 'new' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                            Password *
                          </label>
                          <input
                            type="password"
                            required={addUserMode === 'new'}
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: `1px solid ${COLORS.text.light}`,
                              borderRadius: '0.375rem'
                            }}
                          />
                        </div>
                      )}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                          Branch *
                        </label>
                        <select
                          required
                          value={newUser.branchName}
                          onChange={(e) => setNewUser({ ...newUser, branchName: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: `1px solid ${COLORS.text.light}`,
                            borderRadius: '0.375rem'
                          }}
                        >
                          <option value="">Select Branch</option>
                          {localSettings.branches && localSettings.branches.length > 0 ? (
                            localSettings.branches.map((branch, idx) => (
                              <option key={idx} value={branch.name}>
                                {branch.name}
                              </option>
                            ))
                          ) : (
                            <option value="" disabled>No branches available</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                          Role *
                        </label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: `1px solid ${COLORS.text.light}`,
                            borderRadius: '0.375rem'
                          }}
                        >
                          <option value="branch_user">Branch User</option>
                          <option value="hq_admin">HQ Admin</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button
                        type="submit"
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: COLORS.success,
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        {addUserMode === 'existing' ? 'Assign Branch' : 'Create User'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddUser(false);
                          setNewUser({ email: '', password: '', branchName: '', role: 'branch_user' });
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: COLORS.text.secondary,
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Edit User Form */}
              {editingUser && (
                <div style={{
                  padding: '2rem',
                  background: COLORS.background,
                  borderRadius: '0.5rem',
                  marginBottom: '1.5rem'
                }}>
                  <h4 style={{ marginTop: 0, color: COLORS.text.primary }}>Edit User</h4>
                  <form onSubmit={handleUpdateUser}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                          Email (read-only)
                        </label>
                        <input
                          type="email"
                          value={editingUser.email}
                          disabled
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: `1px solid ${COLORS.text.light}`,
                            borderRadius: '0.375rem',
                            background: '#f5f5f5'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                          Branch *
                        </label>
                        <select
                          required
                          value={editingUser.branchName}
                          onChange={(e) => setEditingUser({ ...editingUser, branchName: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: `1px solid ${COLORS.text.light}`,
                            borderRadius: '0.375rem'
                          }}
                        >
                          <option value="">Select Branch</option>
                          {localSettings.branches && localSettings.branches.length > 0 ? (
                            localSettings.branches.map((branch, idx) => (
                              <option key={idx} value={branch.name}>
                                {branch.name}
                              </option>
                            ))
                          ) : (
                            <option value="" disabled>No branches available</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: COLORS.text.secondary, marginBottom: '0.25rem' }}>
                          Role *
                        </label>
                        <select
                          value={editingUser.role}
                          onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: `1px solid ${COLORS.text.light}`,
                            borderRadius: '0.375rem'
                          }}
                        >
                          <option value="branch_user">Branch User</option>
                          <option value="hq_admin">HQ Admin</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button
                        type="submit"
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: COLORS.info,
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        Update User
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingUser(null)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: COLORS.text.secondary,
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* User List */}
              {!showAddUser && !editingUser && (
                <div style={{ overflowX: 'auto' }}>
                  {loadingUsers ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>Loading users...</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: COLORS.background }}>
                          <th style={{ padding: '1rem', textAlign: 'left', color: COLORS.text.primary }}>Email</th>
                          <th style={{ padding: '1rem', textAlign: 'left', color: COLORS.text.primary }}>Branch</th>
                          <th style={{ padding: '1rem', textAlign: 'left', color: COLORS.text.primary }}>Role</th>
                          <th style={{ padding: '1rem', textAlign: 'left', color: COLORS.text.primary }}>Status</th>
                          <th style={{ padding: '1rem', textAlign: 'center', color: COLORS.text.primary }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} style={{ borderBottom: `1px solid ${COLORS.background}` }}>
                            <td style={{ padding: '1rem' }}>{user.email}</td>
                            <td style={{ padding: '1rem' }}>
                              {user.branchName ? (
                                user.branchName
                              ) : (
                                <span style={{
                                  padding: '0.2rem 0.6rem',
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.8rem'
                                }}>
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.875rem',
                                background: user.role === 'hq_admin' ? COLORS.secondary : user.role === 'pending_admin' ? COLORS.warning : COLORS.info,
                                color: 'white'
                              }}>
                                {user.role === 'hq_admin' ? '🔑 Admin' : user.role === 'pending_admin' ? '⏳ Pending' : '👤 User'}
                              </span>
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.875rem',
                                background: user.active !== false ? COLORS.success : COLORS.error,
                                color: 'white'
                              }}>
                                {user.active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                <button
                                  onClick={() => setEditingUser(user)}
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}
                                  title="Edit user"
                                >
                                  <Edit2 size={16} />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleToggleRole(user)}
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    background: COLORS.warning,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}
                                  title={user.role === 'hq_admin' ? 'Demote to user' : 'Promote to admin'}
                                >
                                  <Shield size={16} />
                                  {user.role === 'hq_admin' ? 'Demote' : 'Promote'}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    background: COLORS.error,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}
                                  title="Delete user"
                                >
                                  <Trash2 size={16} />
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem',
          borderTop: `1px solid ${COLORS.background}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '1rem',
          background: COLORS.background
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              background: COLORS.text.secondary,
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              background: saving ? COLORS.text.light : COLORS.success,
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
