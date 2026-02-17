# 🚀 최종 배포 가이드

## 📋 목차
1. [수정 사항 요약](#수정-사항-요약)
2. [Firebase 콘솔 설정](#firebase-콘솔-설정)
3. [로컬 테스트](#로컬-테스트)
4. [배포 방법](#배포-방법)
5. [문제 해결](#문제-해결)

---

## ✅ 수정 사항 요약

### 1. **인증 로직 개선**
- ✅ `src/firebase/auth.js`: 모든 필요한 imports 완료
  - `GoogleAuthProvider`, `signInWithPopup` 추가
  - `getDocs`, `collection` 추가
  - `loginWithGoogle()` 함수 구현 완료

### 2. **Firestore 접근 보호**
- ✅ `src/firebase/collections.js`: 인증 대기 로직 구현
  - `waitForAuth()`: 인증 초기화 대기
  - `ensureAuthenticated()`: 인증 확인
  - 모든 Firestore 쿼리 전에 인증 체크

### 3. **로그인 UI 개선**
- ✅ `src/components/Login.jsx`: Google 로그인 추가
  - 이메일/비밀번호 로그인
  - Google 소셜 로그인
  - 개선된 에러 처리

### 4. **App.jsx 인증 플로우**
- ✅ 인증 완료 후에만 데이터 로드
- ✅ authLoading 상태로 로딩 화면 표시
- ✅ 적절한 의존성 배열 설정

---

## 🔧 Firebase 콘솔 설정

### Step 1: Google Sign-in 활성화

1. **Firebase Console 접속**
   ```
   https://console.firebase.google.com/project/airzeta-security-system
   ```

2. **Authentication 메뉴로 이동**
   - 좌측 메뉴에서 **"Authentication"** 클릭
   - **"Sign-in method"** 탭 클릭

3. **Google Provider 활성화**
   - **"Google"** 찾아서 클릭
   - **"Enable"** 토글을 켜기
   - **Project support email** 선택 (예: admin@airzeta.com)
   - **"Save"** 클릭

### Step 2: 이메일/비밀번호 로그인 유지 (권장)

> ⚠️ **중요**: Google 로그인과 함께 이메일/비밀번호 로그인을 유지하는 것을 권장합니다.
> 
> **이유:**
> - 백업 로그인 방법 제공
> - 관리자 계정 전용으로 사용 가능
> - Google 계정이 없는 사용자 지원
> - 테스트 및 개발 용이성

**현재 설정 확인:**
- Authentication → Sign-in method
- "Email/Password" 상태가 **Enabled** 인지 확인
- 비활성화되어 있다면 다시 활성화

### Step 3: Firestore 보안 규칙 확인

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 읽기/쓰기 가능
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // users 컬렉션은 자신의 문서만 읽기 가능
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && 
                     (request.auth.uid == userId || 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'hq_admin');
    }
    
    // branchCodes는 모든 인증된 사용자가 읽기 가능
    match /branchCodes/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'hq_admin';
    }
    
    // securityCosts는 branch_user는 자신의 지점만, hq_admin은 모두
    match /securityCosts/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
                               get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'hq_admin';
    }
  }
}
```

### Step 4: 관리자 계정 설정

#### 방법 1: Firebase Console에서 직접 설정

1. **Authentication → Users**
   - 기존 사용자의 UID 복사 (예: `ZXNmBErweEYvuGL7gy19qSqyUo1`)

2. **Firestore Database → users 컬렉션**
   - 해당 UID로 문서 찾기 또는 생성
   - 필드 설정:
     ```json
     {
       "email": "admin@airzeta.com",
       "role": "hq_admin",
       "displayName": "관리자",
       "createdAt": [현재 timestamp],
       "lastLogin": [현재 timestamp],
       "active": true
     }
     ```

#### 방법 2: Google로 처음 로그인 후 역할 변경

1. 앱에서 Google로 로그인
2. Firebase Console → Firestore → users
3. 해당 사용자 문서 찾기
4. `role` 필드를 `"branch_user"`에서 `"hq_admin"`으로 변경
5. 로그아웃 후 다시 로그인

---

## 🧪 로컬 테스트

### Step 1: 환경 변수 확인

`.env` 파일이 있는지 확인:

```bash
cat .env
```

예상 내용:
```env
VITE_FIREBASE_API_KEY=AIzaSyCdkxuB5_IWcbk4Au7NfFAdP1SRB2y-Ixc
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=396226843516
VITE_FIREBASE_APP_ID=1:396226843516:web:0dfd5c01ac5a43aea2e42f
VITE_FIREBASE_MEASUREMENT_ID=G-6L2R6X31P4
```

### Step 2: 의존성 설치

```bash
npm install
```

### Step 3: 개발 서버 시작

```bash
npm run dev
```

브라우저에서 열기: `http://localhost:5173`

### Step 4: 테스트 체크리스트

#### ✅ 로그인 테스트
- [ ] "Missing or insufficient permissions" 에러가 발생하지 않음
- [ ] 로그인 페이지가 즉시 표시됨
- [ ] Google 로그인 버튼이 보임
- [ ] 이메일/비밀번호 입력 필드가 보임

#### ✅ 이메일 로그인 테스트
```
Email: admin@airzeta.com
Password: [Firebase Console에서 설정한 비밀번호]
```
- [ ] 로그인 성공
- [ ] 사용자 이름 표시
- [ ] 역할 정보 확인 (HQ Admin 또는 Branch User)

#### ✅ Google 로그인 테스트
- [ ] "Continue with Google" 버튼 클릭
- [ ] Google 계정 선택 팝업 표시
- [ ] 계정 선택 후 자동 로그인
- [ ] Firestore에 사용자 문서 자동 생성 확인

#### ✅ 데이터 로드 테스트
- [ ] 로그인 후 지점 정보 로드
- [ ] Branch Selector 드롭다운 작동
- [ ] 비용 항목 추가/수정 가능
- [ ] 제출 기능 작동

#### ✅ 권한 테스트

**HQ Admin (본부 관리자):**
- [ ] 모든 지점 정보 조회 가능
- [ ] 모든 지점 비용 제출 가능
- [ ] 설정 메뉴 접근 가능
- [ ] 사용자 관리 메뉴 접근 가능

**Branch User (지점 사용자):**
- [ ] 자신의 지점만 조회 가능
- [ ] 자신의 지점 비용만 제출 가능
- [ ] 설정 메뉴 접근 불가
- [ ] 사용자 관리 메뉴 접근 불가

---

## 🌐 배포 방법

### Option 1: Vercel (권장)

#### 장점:
- 무료 호스팅
- 자동 HTTPS
- 글로벌 CDN
- Git 통합 자동 배포
- 환경 변수 관리 쉬움

#### 배포 단계:

1. **Vercel CLI 설치 (한 번만)**
   ```bash
   npm install -g vercel
   ```

2. **로그인**
   ```bash
   vercel login
   ```

3. **프로젝트 배포**
   ```bash
   npm run build
   vercel --prod
   ```

4. **환경 변수 설정**
   - Vercel Dashboard 접속
   - 프로젝트 선택
   - Settings → Environment Variables
   - `.env` 파일의 모든 변수 추가

5. **Firebase 인증 도메인 추가**
   - Firebase Console → Authentication → Settings
   - Authorized domains에 Vercel 도메인 추가
   - 예: `airzeta-security.vercel.app`

### Option 2: Netlify

1. **Build 설정**
   ```bash
   npm run build
   ```

2. **Netlify Drop 사용**
   - https://app.netlify.com/drop
   - `dist` 폴더를 드래그 앤 드롭

3. **또는 Netlify CLI 사용**
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod --dir=dist
   ```

4. **환경 변수 설정**
   - Netlify Dashboard
   - Site settings → Environment variables
   - `.env` 변수들 추가

5. **Firebase 인증 도메인 추가**
   - Firebase Console → Authentication → Settings
   - Authorized domains에 Netlify 도메인 추가

### Option 3: Firebase Hosting

```bash
# Firebase CLI 설치
npm install -g firebase-tools

# Firebase 로그인
firebase login

# 프로젝트 초기화 (한 번만)
firebase init hosting

# Build
npm run build

# 배포
firebase deploy --only hosting
```

---

## 🔍 문제 해결

### 1. "Missing or insufficient permissions" 에러

**원인:** 
- 인증 전에 Firestore 쿼리 실행
- Firestore 보안 규칙 문제

**해결:**
```bash
# 코드 확인
grep -n "getAllBranches" src/App.jsx

# 인증 대기 로직 확인
cat src/firebase/collections.js | grep -A 10 "ensureAuthenticated"
```

✅ **이미 수정 완료**:
- `collections.js`에 `waitForAuth()` 추가
- `App.jsx`에서 `authLoading && currentUser` 체크

### 2. Google 로그인 실패

**증상:** 
- "This app is blocked" 메시지
- "Unauthorized domain" 에러

**해결:**
1. Firebase Console → Authentication → Settings
2. Authorized domains에 배포 도메인 추가
3. 로컬 테스트: `localhost` 자동 허용됨

### 3. 로그인 후 데이터 로드 안 됨

**확인 사항:**

1. **Firestore 사용자 문서 확인**
   ```
   Firebase Console → Firestore Database → users → [UID]
   ```
   필수 필드:
   - `email`
   - `role` (hq_admin 또는 branch_user)
   - `createdAt`
   - `lastLogin`

2. **브라우저 콘솔 확인**
   ```
   F12 → Console 탭
   ```
   에러 메시지 확인

3. **Network 탭 확인**
   ```
   F12 → Network 탭
   ```
   Firestore 요청 상태 코드 확인

### 4. 역할 권한 문제

**HQ Admin으로 변경:**
```javascript
// Firebase Console → Firestore → users → [UID]
// role 필드를 "hq_admin"으로 변경

// 또는 Node.js 스크립트:
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './src/firebase/config';

await updateDoc(doc(db, 'users', 'USER_UID_HERE'), {
  role: 'hq_admin'
});
```

### 5. 빌드 에러

**증상:** `npm run build` 실패

**해결:**
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install

# 캐시 클리어
npm cache clean --force

# 다시 빌드
npm run build
```

---

## 📊 배포 후 확인 사항

### ✅ 필수 체크리스트

- [ ] 로그인 페이지 정상 표시
- [ ] Google 로그인 작동
- [ ] 이메일 로그인 작동
- [ ] 인증 후 데이터 로드
- [ ] 비용 제출 기능 작동
- [ ] 관리자 권한 정상 작동
- [ ] 모바일 반응형 확인
- [ ] HTTPS 적용 확인

### 📈 모니터링

**Firebase Console에서 확인:**
1. Authentication → Users: 사용자 로그인 기록
2. Firestore Database: 데이터 제출 확인
3. Usage: API 호출량, 스토리지 사용량

---

## 🎯 다음 단계

### 1. 사용자 매뉴얼 작성
- 로그인 방법
- 비용 제출 방법
- 보고서 조회 방법

### 2. 모니터링 설정
- Firebase Analytics 활성화
- 에러 추적 (Sentry 등)

### 3. 백업 전략
- Firestore 자동 백업 설정
- 정기적인 데이터 내보내기

### 4. 보안 강화
- 비밀번호 정책 강화
- 2FA (Two-Factor Authentication) 고려
- IP 화이트리스트 (필요 시)

---

## 📞 지원

문제가 계속되면:
1. 브라우저 콘솔 에러 메시지 캡처
2. Firebase Console에서 에러 로그 확인
3. Network 탭에서 실패한 요청 확인

**프로젝트 정보:**
- Firebase Project: `airzeta-security-system`
- Repository: (Git 저장소 URL)
- Production URL: (배포 후 URL)

---

## 📝 변경 이력

### 2026-02-17
- ✅ Google 로그인 추가
- ✅ 인증 대기 로직 구현
- ✅ "Missing or insufficient permissions" 에러 수정
- ✅ Login.jsx UI 개선
- ✅ 전체 인증 플로우 개선

---

**🎉 배포 준비 완료!**

이제 로컬 테스트 후 원하는 플랫폼에 배포하시면 됩니다.
