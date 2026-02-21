import React, { useState, useEffect } from 'react';
import { Shield, Building2, Loader, LogOut, CheckCircle } from 'lucide-react';
import { getAllBranches } from '../firebase/collections';
import { updateUserBranch, logoutUser } from '../firebase/auth';

const COLORS = {
  primary: '#1B3A7D',
  secondary: '#E94560',
  success: '#10b981',
  error: '#ef4444',
  background: '#f3f4f6',
  surface: '#ffffff',
  text: {
    primary: '#1f2937',
    secondary: '#6b7280',
    light: '#9ca3af'
  }
};

function BranchSelection({ currentUser, onBranchSelected }) {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Firestore에서 branchCodes 컬렉션 로드
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const branchList = await getAllBranches();
        // active 필터링 (active 필드가 없거나 true인 것만)
        const activeBranches = branchList.filter(b => b.active !== false);
        setBranches(activeBranches);
        console.log('[BranchSelection] 브랜치 목록 로드:', activeBranches.length, '개');
      } catch (err) {
        console.error('[BranchSelection] 브랜치 로드 실패:', err);
        setError('Failed to load branch list. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadBranches();
  }, []);

  // 브랜치 선택 확정
  const handleConfirm = async () => {
    if (!selectedBranch) {
      setError('Please select a branch.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await updateUserBranch(currentUser.uid, selectedBranch);
      console.log('[BranchSelection] 브랜치 등록 완료:', selectedBranch);
      
      // 부모(App.jsx)에 알림 → currentUser 갱신
      onBranchSelected(selectedBranch);
    } catch (err) {
      console.error('[BranchSelection] 브랜치 등록 실패:', err);
      setError('Failed to save branch selection. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

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
        padding: '3rem',
        borderRadius: '1rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '550px',
        width: '100%'
      }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 1rem auto',
            background: `linear-gradient(135deg, ${COLORS.primary} 0%, #0f2557 100%)`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(27, 58, 125, 0.3)'
          }}>
            <Building2 size={40} color="white" strokeWidth={2} />
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: COLORS.text.primary,
            marginBottom: '0.5rem'
          }}>
            Select Your Branch
          </h1>
          <p style={{ color: COLORS.text.secondary, fontSize: '0.875rem', lineHeight: '1.5' }}>
            Welcome, <strong>{currentUser.displayName || currentUser.email}</strong>
            <br />
            Please select the branch you belong to.
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#fee2e2',
            border: `1px solid ${COLORS.error}`,
            borderRadius: '0.5rem',
            color: '#991b1b',
            fontSize: '0.85rem'
          }}>
            {error}
          </div>
        )}

        {/* 로딩 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <Loader size={40} style={{ color: COLORS.primary, animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '1rem', color: COLORS.text.secondary }}>Loading branches...</p>
          </div>
        ) : branches.length === 0 ? (
          /* 브랜치 없을 때 */
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            background: '#fef3c7',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            <p style={{ color: '#92400e', fontSize: '0.9rem', margin: 0 }}>
              No branches are configured yet.
              <br />
              Please contact your administrator to set up branches.
            </p>
          </div>
        ) : (
          /* 브랜치 선택 UI */
          <>
            <div style={{
              display: 'grid',
              gap: '0.75rem',
              marginBottom: '2rem',
              maxHeight: '300px',
              overflowY: 'auto',
              paddingRight: '0.5rem'
            }}>
              {branches.map((branch) => {
                const isSelected = selectedBranch === branch.name;
                return (
                  <button
                    key={branch.id || branch.name}
                    onClick={() => { setSelectedBranch(branch.name); setError(''); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem 1.25rem',
                      background: isSelected ? `${COLORS.primary}10` : COLORS.surface,
                      border: `2px solid ${isSelected ? COLORS.primary : '#e5e7eb'}`,
                      borderRadius: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    {/* 체크 아이콘 */}
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? COLORS.primary : '#d1d5db'}`,
                      background: isSelected ? COLORS.primary : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.2s'
                    }}>
                      {isSelected && <CheckCircle size={16} color="white" />}
                    </div>

                    {/* 브랜치 정보 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: '600',
                        color: isSelected ? COLORS.primary : COLORS.text.primary,
                        fontSize: '1rem'
                      }}>
                        {branch.name}
                      </div>
                      {branch.manager && (
                        <div style={{
                          fontSize: '0.8rem',
                          color: COLORS.text.secondary,
                          marginTop: '0.15rem'
                        }}>
                          Manager: {branch.manager}
                        </div>
                      )}
                    </div>

                    {/* 통화 뱃지 */}
                    {branch.currency && (
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        background: isSelected ? COLORS.primary : '#f3f4f6',
                        color: isSelected ? 'white' : COLORS.text.secondary,
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        flexShrink: 0
                      }}>
                        {branch.currency}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 확인 버튼 */}
            <button
              onClick={handleConfirm}
              disabled={submitting || !selectedBranch}
              style={{
                width: '100%',
                padding: '1rem',
                background: submitting || !selectedBranch ? '#9ca3af' : COLORS.success,
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: submitting || !selectedBranch ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'background 0.2s'
              }}
            >
              {submitting ? (
                <><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
              ) : (
                <><CheckCircle size={20} /> Confirm Branch Selection</>
              )}
            </button>
          </>
        )}

        {/* 로그아웃 / 다른 계정 */}
        <div style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.text.secondary,
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <LogOut size={16} />
            Sign out or use a different account
          </button>
        </div>
      </div>
    </div>
  );
}

export default BranchSelection;
