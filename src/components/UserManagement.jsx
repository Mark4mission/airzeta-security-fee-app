import React, { useState, useEffect } from 'react';
import { Users, Shield, UserX, UserCheck, Trash2, Loader, Edit2 } from 'lucide-react';
import { 
  getAllUsers, 
  updateUserRole, 
  toggleUserStatus, 
  createUser 
} from '../firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const COLORS = {
  primary: '#1B3A7D',
  secondary: '#E94560',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  textLight: '#6b7280'
};

function UserManagement({ branches }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'branch_user',
    branchName: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const userList = await getAllUsers();
      setUsers(userList);
    } catch (error) {
      showMessage('error', `Failed to load users: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleRoleChange = async (uid, currentRole) => {
    const newRole = currentRole === 'hq_admin' ? 'branch_user' : 'hq_admin';
    try {
      await updateUserRole(uid, newRole);
      showMessage('success', `✅ User role changed to ${newRole}`);
      loadUsers();
    } catch (error) {
      showMessage('error', `❌ Failed to change role: ${error.message}`);
    }
  };

  const handleToggleStatus = async (uid, currentStatus) => {
    try {
      await toggleUserStatus(uid, !currentStatus);
      showMessage('success', `✅ User ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadUsers();
    } catch (error) {
      showMessage('error', `❌ Failed to toggle status: ${error.message}`);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setNewUser({
      email: user.email,
      password: '',
      role: user.role,
      branchName: user.branchName || ''
    });
    setShowAddUser(true);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createUser(newUser.email, newUser.password, {
        role: newUser.role,
        branchName: newUser.branchName
      });
      showMessage('success', '✅ User created successfully!');
      setShowAddUser(false);
      setNewUser({ email: '', password: '', role: 'branch_user', branchName: '' });
      loadUsers();
    } catch (error) {
      showMessage('error', `❌ Failed to create user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        role: newUser.role,
        branchName: newUser.branchName,
        updatedAt: serverTimestamp()
      });
      
      showMessage('success', '✅ User updated successfully!');
      setShowAddUser(false);
      setEditingUser(null);
      setNewUser({ email: '', password: '', role: 'branch_user', branchName: '' });
      loadUsers();
    } catch (error) {
      showMessage('error', `❌ Failed to update user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setShowAddUser(false);
    setEditingUser(null);
    setNewUser({ email: '', password: '', role: 'branch_user', branchName: '' });
  };

  if (loading && users.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Loader size={48} style={{ color: COLORS.primary, animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '1rem', color: COLORS.textLight }}>Loading users...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      {/* Message Banner */}
      {message.text && (
        <div style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          borderRadius: '0.5rem',
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b'
        }}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.primary }}>
            👥 User Management
          </h2>
          <p style={{ fontSize: '0.875rem', color: COLORS.textLight }}>
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <button
          onClick={() => setShowAddUser(!showAddUser)}
          style={{
            padding: '0.75rem 1.5rem',
            background: COLORS.primary,
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Users size={20} />
          {showAddUser ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {/* Add/Edit User Form */}
      {showAddUser && (
        <form onSubmit={editingUser ? handleUpdateUser : handleAddUser} style={{
          background: '#f9fafb',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          marginBottom: '2rem',
          border: `2px solid ${COLORS.primary}`
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
            {editingUser ? '✏️ Edit User' : '➕ Create New User'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input
              type="email"
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              required
              disabled={!!editingUser}
              style={{ 
                padding: '0.75rem', 
                border: '1px solid #d1d5db', 
                borderRadius: '0.5rem',
                background: editingUser ? '#f3f4f6' : 'white'
              }}
            />
            <input
              type="password"
              placeholder={editingUser ? "Password (leave blank to keep)" : "Password (min 6 chars)"}
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              required={!editingUser}
              minLength={editingUser ? 0 : 6}
              style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
            >
              <option value="branch_user">Branch User</option>
              <option value="hq_admin">HQ Admin</option>
            </select>
            <select
              value={newUser.branchName}
              onChange={(e) => setNewUser({ ...newUser, branchName: e.target.value })}
              required={newUser.role === 'branch_user'}
              style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
            >
              <option value="">Select Branch</option>
              {branches && branches.map(branch => (
                <option key={branch.branchName} value={branch.branchName}>
                  {branch.branchName}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? '#9ca3af' : COLORS.success,
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              {loading ? 'Processing...' : editingUser ? 'Update User' : 'Create User'}
            </button>
            {editingUser && (
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: COLORS.textLight,
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      )}

      {/* User Table */}
      <div style={{
        background: 'white',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: COLORS.primary, color: 'white' }}>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Role</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Branch</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={user.uid} style={{
                borderBottom: '1px solid #e5e7eb',
                background: index % 2 === 0 ? 'white' : '#f9fafb'
              }}>
                <td style={{ padding: '1rem' }}>{user.email}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    background: user.role === 'hq_admin' ? '#dbeafe' : '#f3f4f6',
                    color: user.role === 'hq_admin' ? '#1e40af' : '#374151'
                  }}>
                    {user.role === 'hq_admin' ? '🔑 Admin' : '👤 User'}
                  </span>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                  {user.branchName || '-'}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    background: user.active !== false ? '#d1fae5' : '#fee2e2',
                    color: user.active !== false ? '#065f46' : '#991b1b'
                  }}>
                    {user.active !== false ? '✓ Active' : '✗ Inactive'}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleEditUser(user)}
                      title="Edit User"
                      style={{
                        padding: '0.5rem',
                        background: COLORS.info,
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleRoleChange(user.uid, user.role)}
                      title={user.role === 'hq_admin' ? 'Demote to User' : 'Promote to Admin'}
                      style={{
                        padding: '0.5rem',
                        background: COLORS.warning,
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Shield size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(user.uid, user.active !== false)}
                      title={user.active !== false ? 'Deactivate' : 'Activate'}
                      style={{
                        padding: '0.5rem',
                        background: user.active !== false ? COLORS.error : COLORS.success,
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer'
                      }}
                    >
                      {user.active !== false ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UserManagement;