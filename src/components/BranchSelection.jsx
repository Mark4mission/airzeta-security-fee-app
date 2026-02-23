import React, { useState, useEffect } from 'react';
import { Building2, Loader, LogOut, CheckCircle, Search, AlertTriangle, ShieldAlert, Clock } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pendingAdminResult, setPendingAdminResult] = useState(false); // HQ 선택 후 승인 대기 상태

  // Firestore에서 branchCodes 컬렉션 로드
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const branchList = await getAllBranches();
        // active 필터링 + 브랜치명 추출 (문서 ID 또는 branchName 필드)
        const activeBranches = branchList
          .filter(b => b.active !== false)
          .map(b => {
            // 문서 ID가 브랜치명 (예: ALASU, SFOSF, HQ)
            const fullName = b.id || b.branchName || '';
            return {
              name: fullName,
              // 왼쪽 최대 3자리로 간결한 표시명 생성
              displayName: fullName.slice(0, 3).toUpperCase(),
              id: b.id
            };
          })
          .filter(b => b.name) // 이름 없는 것 제외
          .sort((a, b) => a.name.localeCompare(b.name)); // 알파벳 순 정렬

        setBranches(activeBranches);
        console.log('[BranchSelection] 브랜치 목록 로드:', activeBranches.length, '개');
      } catch (err) {
        console.error('[BranchSelection] 브랜치 로드 실패:', err);
        setError('Failed to load station list. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadBranches();
  }, []);

  // 검색 필터링 (full name과 displayName 모두 대상)
  const filteredBranches = branches.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // HQ 선택 여부 확인
  const isHQSelected = selectedBranch === 'HQ' || selectedBranch === 'hq';

  // 브랜치 선택 확정
  const handleConfirm = async () => {
    if (!selectedBranch) {
      setError('Please select a station.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await updateUserBranch(currentUser.uid, selectedBranch);
      console.log('[BranchSelection] 브랜치 등록 완료:', selectedBranch, 'pendingAdmin:', result.pendingAdmin);
      
      if (result.pendingAdmin) {
        // HQ 선택 → 승인 대기 상태 표시
        setPendingAdminResult(true);
      } else {
        onBranchSelected(selectedBranch);
      }
    } catch (err) {
      console.error('[BranchSelection] 브랜치 등록 실패:', err);
      setError('Failed to save station selection. Please try again.');
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
        padding: '2.5rem',
        borderRadius: '1rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '480px',
        width: '100%'
      }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '72px',
            height: '72px',
            margin: '0 auto 1rem auto',
            background: `linear-gradient(135deg, ${COLORS.primary} 0%, #0f2557 100%)`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(27, 58, 125, 0.3)'
          }}>
            <Building2 size={36} color="white" strokeWidth={2} />
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: COLORS.text.primary,
            marginBottom: '0.5rem'
          }}>
            Select Your Station
          </h1>
          <p style={{ color: COLORS.text.secondary, fontSize: '0.875rem', lineHeight: '1.5' }}>
            Welcome, <strong>{currentUser.displayName || currentUser.email}</strong>
            <br />
            Please select the station you belong to.
          </p>
        </div>

        {/* 승인 대기 화면 */}
        {pendingAdminResult && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 1.5rem auto',
              background: `linear-gradient(135deg, ${COLORS.warning || '#f59e0b'} 0%, #d97706 100%)`,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(245, 158, 11, 0.3)'
            }}>
              <Clock size={40} color="white" strokeWidth={2} />
            </div>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: COLORS.text.primary,
              marginBottom: '0.75rem'
            }}>
              Admin Approval Pending
            </h2>
            <div style={{
              padding: '1.25rem',
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <ShieldAlert size={24} color="#92400e" style={{ marginBottom: '0.5rem' }} />
              <p style={{ color: '#92400e', fontSize: '0.9rem', margin: '0 0 0.5rem 0', fontWeight: '600' }}>
                Your HQ administrator access request has been submitted.
              </p>
              <p style={{ color: '#a16207', fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>
                An existing HQ administrator must approve your request before you can access admin features.
                You will be able to log in after approval.
              </p>
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '0.9rem',
                background: COLORS.text.secondary || '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <LogOut size={18} /> OK, Sign Out
            </button>
          </div>
        )}

        {/* 에러 메시지 */}
        {!pendingAdminResult && error && (
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

        {/* HQ 선택 경고 메시지 */}
        {!pendingAdminResult && isHQSelected && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem'
          }}>
            <AlertTriangle size={18} color="#92400e" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <p style={{ color: '#92400e', fontSize: '0.85rem', margin: '0 0 0.25rem 0', fontWeight: '600' }}>
                HQ is for administrators only
              </p>
              <p style={{ color: '#a16207', fontSize: '0.75rem', margin: 0, lineHeight: '1.4' }}>
                Selecting HQ will require approval from an existing admin.
                You won't be able to access the app until approved.
              </p>
            </div>
          </div>
        )}

        {/* 로딩 */}
        {!pendingAdminResult && loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <Loader size={40} style={{ color: COLORS.primary, animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '1rem', color: COLORS.text.secondary }}>Loading stations...</p>
          </div>
        ) : !pendingAdminResult && branches.length === 0 ? (
          /* 브랜치 없을 때 */
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            background: '#fef3c7',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            <p style={{ color: '#92400e', fontSize: '0.9rem', margin: 0 }}>
              No stations are configured yet.
              <br />
              Please contact your administrator to set up stations.
            </p>
          </div>
        ) : !pendingAdminResult ? (
          <>
            {/* 검색 바 (브랜치 8개 이상일 때만 표시) */}
            {branches.length >= 8 && (
              <div style={{
                position: 'relative',
                marginBottom: '1rem'
              }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: COLORS.text.light
                  }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stations..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: COLORS.text.primary,
                    background: '#f9fafb',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = COLORS.primary}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
            )}

            {/* 브랜치 버튼 그리드 */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '1.75rem',
              maxHeight: '280px',
              overflowY: 'auto',
              padding: '0.25rem',
              justifyContent: 'flex-start'
            }}>
              {filteredBranches.map((branch) => {
                const isSelected = selectedBranch === branch.name;
                return (
                  <button
                    key={branch.id}
                    onClick={() => { setSelectedBranch(branch.name); setError(''); }}
                    style={{
                      padding: '0.35rem 0.85rem',
                      background: isSelected
                        ? COLORS.primary
                        : '#f8f9fb',
                      color: isSelected ? '#ffffff' : COLORS.text.primary,
                      border: `1.5px solid ${isSelected ? COLORS.primary : '#d1d5db'}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? '700' : '600',
                      letterSpacing: '0.025em',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                      boxShadow: isSelected
                        ? '0 2px 8px rgba(27, 58, 125, 0.35)'
                        : '0 1px 2px rgba(0,0,0,0.04)',
                      transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                      fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = COLORS.primary;
                        e.currentTarget.style.background = '#eef2f9';
                        e.currentTarget.style.color = COLORS.primary;
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.background = '#f8f9fb';
                        e.currentTarget.style.color = COLORS.text.primary;
                      }
                    }}
                  >
                    {branch.displayName}
                  </button>
                );
              })}

              {/* 검색 결과 없음 */}
              {filteredBranches.length === 0 && searchQuery && (
                <p style={{
                  width: '100%',
                  textAlign: 'center',
                  color: COLORS.text.light,
                  fontSize: '0.85rem',
                  padding: '1.5rem 0',
                  margin: 0
                }}>
                  No stations matching "{searchQuery}"
                </p>
              )}
            </div>

            {/* 선택된 브랜치 표시 */}
            {selectedBranch && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1rem',
                marginBottom: '1rem',
                background: '#eef7f1',
                border: '1px solid #a7f3d0',
                borderRadius: '0.5rem'
              }}>
                <CheckCircle size={16} color={COLORS.success} />
                <span style={{
                  fontSize: '0.85rem',
                  color: '#065f46',
                  fontWeight: '600'
                }}>
                  Selected: {selectedBranch.slice(0, 3).toUpperCase()} ({selectedBranch})
                </span>
              </div>
            )}

            {/* 확인 버튼 */}
            <button
              onClick={handleConfirm}
              disabled={submitting || !selectedBranch}
              style={{
                width: '100%',
                padding: '0.9rem',
                background: submitting || !selectedBranch
                  ? '#9ca3af'
                  : isHQSelected ? '#f59e0b' : COLORS.success,
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: submitting || !selectedBranch ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'background 0.2s',
                boxShadow: submitting || !selectedBranch ? 'none' : isHQSelected ? '0 2px 8px rgba(245, 158, 11, 0.3)' : '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              {submitting ? (
                <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
              ) : isHQSelected ? (
                <><ShieldAlert size={18} /> Request Admin Access</>
              ) : (
                <><CheckCircle size={18} /> Confirm Station Selection</>
              )}
            </button>
          </>
        ) : null}

        {/* 로그아웃 */}
        <div style={{
          textAlign: 'center',
          marginTop: '1.25rem',
          paddingTop: '1.25rem',
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
