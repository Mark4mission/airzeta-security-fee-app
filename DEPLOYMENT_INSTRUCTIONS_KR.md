# 🚀 배포 가이드 - AirZeta Security Fee App

## ✅ 완료된 작업

### 1. Firebase 인증 문제 해결 ✅
- **문제**: 앱 시작 시 "Missing or insufficient permissions" 에러 발생
- **원인**: Firebase Auth 초기화 전에 Firestore 접근 시도
- **해결**:
  - `waitForAuth()` 함수로 인증 초기화 대기
  - `ensureAuthenticated()` 함수로 인증 확인
  - App.jsx에서 인증 완료 후에만 데이터 로드

### 2. 수정된 파일
- ✅ `src/firebase/collections.js` - 인증 대기 로직 추가
- ✅ `src/App.jsx` - Branch 로딩 useEffect 수정

### 3. Git 커밋 완료 ✅
```bash
commit 7940cb7
fix: Firebase authentication flow improvements
```

## 📋 다음 단계 (로컬에서 진행)

### Step 1: 수정된 파일 다운로드

아래 파일을 다운로드해서 로컬 프로젝트에 복사하세요:

**다운로드한 파일:** `airzeta-firebase-fixed.tar.gz`

```bash
# 1. 다운로드한 파일 압축 해제
cd ~/Downloads
tar -xzf airzeta-firebase-fixed.tar.gz -C ~/airzeta-security-fee-app/airzeta-security-fee-app/

# 또는 수동으로:
# - src/firebase/collections.js 파일 교체
# - src/App.jsx 파일 교체
# - FIREBASE_FIX_SUMMARY.md 참고
```

### Step 2: 로컬에서 테스트

```bash
# 프로젝트 디렉토리로 이동
cd ~/airzeta-security-fee-app/airzeta-security-fee-app

# 의존성 설치 (처음 한 번만)
npm install

# 개발 서버 실행
npm run dev

# 브라우저에서 http://localhost:5173 접속
# F12 → Console 탭에서 에러 확인
```

**✅ 테스트 체크리스트:**
- [ ] 로그인 화면이 즉시 표시됨 (에러 없음)
- [ ] Console에 "Missing or insufficient permissions" 에러 없음
- [ ] 로그인 성공 후 Branch 데이터가 로드됨
- [ ] 비용 제출이 정상 작동함

### Step 3: 프로덕션 빌드

```bash
# 프로덕션 빌드 생성
npm run build

# 빌드 결과 확인
ls -la dist/

# 로컬에서 프로덕션 빌드 테스트
npm run preview
```

### Step 4: Vercel에 배포 (추천)

```bash
# 1. Vercel CLI 설치 (한 번만)
npm install -g vercel

# 2. Vercel 로그인
vercel login

# 3. 배포
vercel --prod

# 4. 환경 변수 설정
# Vercel Dashboard에 접속
# Project Settings → Environment Variables
# .env 파일의 모든 변수 추가:
```

**환경 변수 설정:**
```
VITE_FIREBASE_API_KEY=AIzaSyCdkxuB5_IWcbk4Au7NfFAdP1SRB2y-Ixc
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=396226843516
VITE_FIREBASE_APP_ID=1:396226843516:web:0dfd5c01ac5a43aea2e42f
VITE_FIREBASE_MEASUREMENT_ID=G-6L2R6X31P4
```

### Step 5: Netlify에 배포 (대안)

```bash
# 1. Netlify CLI 설치 (한 번만)
npm install -g netlify-cli

# 2. Netlify 로그인
netlify login

# 3. 배포
netlify deploy --prod

# Build directory 선택: dist

# 4. 환경 변수 설정
# Netlify Dashboard → Site Settings → Environment Variables
# 위의 환경 변수 모두 추가
```

## 🔥 Firebase 설정 확인

### Firebase Console 체크리스트:

1. **Authentication 활성화**
   - Firebase Console → Authentication → Sign-in method
   - Email/Password 활성화 확인
   - 사용자 계정 생성 확인

2. **Firestore 보안 규칙**
   - Firebase Console → Firestore Database → Rules
   
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

3. **Firestore 데이터 구조**
   - `branchCodes` 컬렉션 생성
   - `securityCosts` 컬렉션 생성
   - `users` 컬렉션 생성

## 📝 주요 변경 사항

### Before (문제 발생) ❌
```javascript
// 즉시 확인만 하고 대기하지 않음
if (!auth.currentUser) {
  return [];
}
```

### After (문제 해결) ✅
```javascript
// 인증 초기화를 기다림
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

await ensureAuthenticated();
```

## 🐛 문제 해결

### 로그인 화면에서 계속 에러가 발생
**해결방법:**
1. Firebase Console → Authentication → Users에 사용자가 있는지 확인
2. `.env` 파일의 Firebase 설정이 올바른지 확인
3. 브라우저 캐시 및 localStorage 삭제

### 배포 후 하얀 화면만 표시됨
**해결방법:**
1. 환경 변수가 배포 플랫폼에 설정되었는지 확인
2. 빌드 로그에서 에러 확인
3. 브라우저 Console에서 에러 확인

### Firestore 접근 권한 에러
**해결방법:**
1. Firebase Console → Firestore → Rules 확인
2. 테스트 모드로 변경 (개발 중에만):
   ```javascript
   allow read, write: if true;
   ```
3. 프로덕션에서는 반드시 인증 규칙 적용:
   ```javascript
   allow read, write: if request.auth != null;
   ```

## 📞 지원

문제가 발생하면:
1. `FIREBASE_FIX_SUMMARY.md` 파일 참고
2. 브라우저 Console 에러 확인
3. Firebase Console에서 로그 확인
4. Network 탭에서 API 요청 확인

## 🎉 완료!

모든 단계를 완료하면:
- ✅ Firebase 인증 문제 해결됨
- ✅ 앱이 안정적으로 실행됨
- ✅ 프로덕션 환경에 배포됨
- ✅ 사용자들이 접근 가능함

---
**작성일**: 2026-02-16  
**버전**: 1.0  
**상태**: 수정 완료, 배포 대기
