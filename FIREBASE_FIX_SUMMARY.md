# Firebase Authentication Fix Summary

## 문제 진단

### 발생한 에러
```
FirebaseError: Missing or insufficient permissions
```

### 근본 원인
1. **타이밍 문제**: 앱이 로드될 때 Firebase Authentication이 초기화되기 **전에** Firestore에 데이터를 요청
2. **권한 문제**: 인증되지 않은 상태에서 Firestore의 보안 규칙에 의해 접근이 차단됨
3. **비동기 처리 부족**: `auth.currentUser`가 `null`인지만 체크했지만, 인증 초기화를 기다리지 않음

## 해결 방법

### 1. `src/firebase/collections.js` 수정

#### ✅ 추가된 헬퍼 함수들

```javascript
/**
 * Firebase Auth 초기화를 기다리는 함수
 * @returns {Promise<User|null>} 인증된 사용자 또는 null
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
 * 사용자 인증 확인
 * @throws {Error} 사용자가 인증되지 않은 경우
 */
const ensureAuthenticated = async () => {
  const user = await waitForAuth();
  if (!user) {
    throw new Error('User must be authenticated to access this resource');
  }
  return user;
};
```

#### ✅ 수정된 함수들

**getAllBranches()**
```javascript
// ❌ 이전 (즉시 확인)
if (!auth.currentUser) {
  console.warn('User not authenticated, skipping branches fetch');
  return [];
}

// ✅ 수정 후 (인증 대기)
await ensureAuthenticated();
```

**getSecurityCostsByBranch()**
```javascript
// ❌ 이전 (즉시 확인)
if (!auth.currentUser) {
  console.warn('User not authenticated');
  return [];
}

// ✅ 수정 후 (인증 대기)
await ensureAuthenticated();
```

**submitSecurityCost()**
```javascript
// ❌ 이전 (즉시 확인)
if (!auth.currentUser) {
  throw new Error('User must be authenticated');
}

// ✅ 수정 후 (인증 대기)
await ensureAuthenticated();
```

### 2. `src/App.jsx` 수정

#### ✅ Branch 데이터 로드 로직 개선

```javascript
// ❌ 이전 (인증과 무관하게 즉시 실행)
useEffect(() => {
  const loadBranches = async () => {
    try {
      const branchesData = await getAllBranches();
      // ...
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };
  loadBranches();
}, []); // 빈 의존성 배열

// ✅ 수정 후 (인증 완료 후에만 실행)
useEffect(() => {
  const loadBranches = async () => {
    // 인증이 완료되고 사용자가 있을 때만 실행
    if (!authLoading && currentUser) {
      try {
        const branchesData = await getAllBranches();
        if (branchesData.length > 0) {
          setSettings(prev => ({ ...prev, branches: branchesData }));
        }
      } catch (error) {
        console.error('Error loading branches:', error);
      }
    }
  };
  loadBranches();
}, [authLoading, currentUser]); // 인증 상태 의존성 추가
```

## 작동 원리

### Before (문제 발생)
```
1. 앱 시작
2. getAllBranches() 즉시 호출 ❌
3. auth.currentUser는 null (아직 초기화 안됨)
4. Firestore 접근 시도
5. 에러: Missing or insufficient permissions
```

### After (문제 해결)
```
1. 앱 시작
2. Firebase Auth 초기화 대기 ⏳
3. 사용자 로그인
4. authLoading = false, currentUser 설정 ✅
5. useEffect 트리거됨
6. getAllBranches() 호출
7. waitForAuth() → auth.currentUser 확인 ✅
8. Firestore 접근 성공 ✅
```

## 테스트 방법

### 로컬 테스트

```bash
# 1. 프로젝트 디렉토리로 이동
cd ~/airzeta-security-fee-app/airzeta-security-fee-app

# 2. 수정된 파일 복사 (백업본을 다운로드 받은 경우)
# src/firebase/collections.js 교체
# src/App.jsx 교체

# 3. 의존성 설치
npm install

# 4. 개발 서버 실행
npm run dev

# 5. 브라우저에서 테스트
# - 개발자 도구 (F12) → Console 탭 열기
# - 에러 없이 로그인 화면이 표시되어야 함
# - 로그인 후 데이터가 정상적으로 로드되어야 함
```

### 확인 사항

✅ **성공 시**
- 브라우저 콘솔에 "Missing or insufficient permissions" 에러 없음
- 로그인 화면이 즉시 표시됨
- 로그인 후 Branch 데이터가 정상적으로 로드됨
- 비용 제출이 정상적으로 작동함

❌ **실패 시**
- Firebase 설정(.env 파일) 확인
- Firebase Console에서 Authentication 활성화 확인
- Firestore 보안 규칙 확인

## Firestore 보안 규칙

앱이 정상적으로 작동하려면 Firestore 보안 규칙이 다음과 같이 설정되어야 합니다:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 접근 가능
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // 또는 더 세분화된 규칙:
    match /branchCodes/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      request.auth.token.role == 'hq_admin';
    }
    
    match /securityCosts/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
                               request.auth.token.role == 'hq_admin';
    }
    
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      request.auth.token.role == 'hq_admin';
    }
  }
}
```

## 배포 가이드

### Vercel 배포

```bash
# 1. Vercel CLI 설치 (한 번만)
npm install -g vercel

# 2. 로그인
vercel login

# 3. 프로덕션 빌드
npm run build

# 4. 배포
vercel --prod

# 5. 환경 변수 설정
# Vercel Dashboard → Project → Settings → Environment Variables
# .env 파일의 모든 변수를 추가
```

### Netlify 배포

```bash
# 1. Netlify CLI 설치 (한 번만)
npm install -g netlify-cli

# 2. 로그인
netlify login

# 3. 배포
netlify deploy --prod

# 4. 빌드 디렉토리 선택: dist
```

## 추가 개선 사항

### 1. 에러 처리 개선
현재는 에러를 throw하지만, UI에서 사용자 친화적인 메시지를 표시할 수 있습니다:

```javascript
try {
  await getAllBranches();
} catch (error) {
  if (error.message.includes('authenticated')) {
    // 로그인 화면으로 리다이렉트
  } else {
    // 에러 메시지 표시
  }
}
```

### 2. 로딩 인디케이터
데이터 로딩 중 사용자에게 피드백 제공:

```javascript
const [loading, setLoading] = useState(false);

const loadBranches = async () => {
  setLoading(true);
  try {
    const branchesData = await getAllBranches();
    // ...
  } finally {
    setLoading(false);
  }
};
```

### 3. 재시도 로직
네트워크 오류 시 자동 재시도:

```javascript
const retryOperation = async (operation, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

## 문제 해결

### Q: 여전히 권한 오류가 발생합니다
**A**: 
1. Firebase Console → Authentication → 사용자가 생성되었는지 확인
2. Firestore → Rules → 보안 규칙 확인
3. 브라우저 캐시 및 localStorage 삭제
4. 개발자 도구 → Application → Local Storage 확인

### Q: 로그인 후에도 데이터가 로드되지 않습니다
**A**:
1. Console에서 `auth.currentUser` 확인
2. Firestore에 데이터가 실제로 있는지 확인
3. 네트워크 탭에서 Firestore 요청 확인

### Q: 빌드는 성공하지만 배포 후 에러가 발생합니다
**A**:
1. 환경 변수가 배포 플랫폼에 설정되었는지 확인
2. `.env` 변수가 `VITE_` 접두사로 시작하는지 확인
3. 빌드 후 `dist` 폴더에 환경 변수가 포함되었는지 확인

## 결론

이 수정으로 Firebase Authentication과 Firestore 간의 타이밍 문제가 해결되어, 앱 시작 시 "Missing or insufficient permissions" 에러가 더 이상 발생하지 않습니다.

**핵심 개선 사항:**
1. ✅ 인증 초기화 대기 로직 추가
2. ✅ Firestore 접근 전 인증 확인
3. ✅ React 컴포넌트에서 인증 상태 의존성 관리

**다음 단계:**
1. 로컬에서 테스트
2. 프로덕션 빌드 생성
3. Vercel 또는 Netlify에 배포
4. 배포된 앱 테스트

---
**수정 날짜**: 2026-02-16  
**작성자**: AI Assistant  
**버전**: 1.0
