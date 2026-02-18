# Aviation Security Hub - 개발 환경 구성 가이드

## 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [확정된 기술 스택](#2-확정된-기술-스택)
3. [프로젝트 초기 설정 체크리스트](#3-프로젝트-초기-설정-체크리스트)
4. [Firebase 설정 (시행착오 방지)](#4-firebase-설정-시행착오-방지)
5. [Google 로그인 설정 (완전 가이드)](#5-google-로그인-설정-완전-가이드)
6. [Vercel 배포 설정](#6-vercel-배포-설정)
7. [프로젝트 구조 (모듈 방식)](#7-프로젝트-구조-모듈-방식)
8. [GenSpark AI 개발자 작업 시 주의사항](#8-genspark-ai-개발자-작업-시-주의사항)
9. [시행착오 방지 체크리스트](#9-시행착오-방지-체크리스트)
10. [모듈 확장 계획](#10-모듈-확장-계획)

---

## 1. 프로젝트 개요

**Aviation Security Hub**: 항공 보안 업무를 위한 통합 웹 플랫폼
- 기존 Security Fee App을 핵심 모듈로 포함
- 모듈 방식으로 기능을 확장
- Google 로그인 기반 역할별 접근 제어 (Admin / Branch User)

---

## 2. 확정된 기술 스택

### Frontend (검증 완료)
| 기술 | 버전 | 역할 | 비고 |
|------|------|------|------|
| **React** | 19.x | UI 프레임워크 | 안정적 동작 확인됨 |
| **Vite** | 7.x | 빌드 도구 | 빌드 7초, HMR 빠름 |
| **Tailwind CSS** | 4.x | 스타일링 | postcss 플러그인 방식 |
| **Lucide React** | 0.56x | 아이콘 | 경량, 다양한 아이콘 |
| **React Router** | 7.x (추가 필요) | 라우팅 | 모듈 페이지 전환용 |

### Backend / Database (검증 완료)
| 기술 | 역할 | 비고 |
|------|------|------|
| **Firebase Auth** | 인증 | Google 로그인 + Email/Password |
| **Cloud Firestore** | 데이터베이스 | NoSQL, 실시간 동기화 |
| **Firebase Hosting** (선택) | 호스팅 | Vercel 대안 |

### 배포 (검증 완료)
| 기술 | 역할 | 비고 |
|------|------|------|
| **Vercel** | 호스팅/배포 | GitHub 연동 자동 배포 |
| **GitHub** | 소스 관리 | main 브랜치 보호 |

### 개발 도구
| 도구 | 역할 |
|------|------|
| **GenSpark AI Developer** | AI 코딩 어시스턴트 |
| **Chrome DevTools** | 디버깅 (Brave 아닌 Chrome 사용!) |
| **Firebase Console** | DB/인증 관리 |
| **Google Cloud Console** | OAuth 설정 |

---

## 3. 프로젝트 초기 설정 체크리스트

### 3-1. 새 프로젝트 생성
```bash
# 1. Vite + React 프로젝트 생성
npm create vite@latest aviation-security-hub -- --template react
cd aviation-security-hub

# 2. 핵심 의존성 설치
npm install firebase lucide-react react-router-dom

# 3. 개발 의존성 (Tailwind CSS v4)
npm install -D @tailwindcss/postcss autoprefixer postcss

# 4. Git 초기화
git init
git remote add origin https://github.com/[USER]/aviation-security-hub.git
```

### 3-2. 필수 설정 파일

#### `.env` (절대 커밋하지 않음!)
```env
# Firebase Configuration
# Project: [프로젝트명] (프로젝트 번호: [번호])
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=[project-id].firebaseapp.com
VITE_FIREBASE_PROJECT_ID=[project-id]
VITE_FIREBASE_STORAGE_BUCKET=[project-id].firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=[project-number]
VITE_FIREBASE_APP_ID=1:[project-number]:web:[app-hash]
```

#### `.gitignore` (처음부터 완벽하게)
```gitignore
# Dependencies
node_modules/

# Build output
dist/
dist-ssr/

# Environment variables (절대 커밋 금지!)
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.sw?

# OS
.DS_Store
._*

# Firebase
.firebase/
*-debug.log

# Deployment
.vercel/

# Backup/temp (AI 개발자가 생성할 수 있는 파일들)
*.backup
*.broken
*.before-*
*.bak
*.tar.gz
.vite/
```

#### `vite.config.js`
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 중요: Vercel 배포 시 반드시 '/' (GitHub Pages가 아님!)
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  }
})
```

#### `vercel.json`
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 4. Firebase 설정 (시행착오 방지)

### 교훈: 프로젝트 혼동 방지

**핵심 원칙: 하나의 Firebase 프로젝트만 사용**

1. Firebase Console에서 프로젝트 생성 (또는 기존 프로젝트 사용)
2. **프로젝트 번호를 반드시 기록**: 설정 > 프로젝트 설정 > 프로젝트 번호
3. **웹앱 등록** 후 config 값을 `.env`에 복사
4. **검증**: `.env`의 `MESSAGING_SENDER_ID`와 프로젝트 번호가 **일치**하는지 확인

```
⚠️ 시행착오 교훈:
프로젝트를 삭제 후 재생성하면 같은 projectId라도 프로젝트 번호가 달라짐.
이전 config 값이 .env에 남아있으면 auth/invalid-api-key 에러 발생.
→ 반드시 Firebase Console에서 직접 복사한 최신 값 사용!
```

### Firestore 보안 규칙 (초기 개발용)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 읽기/쓰기
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Firestore 컬렉션 구조 (Hub용 확장)
```
aviation-security-hub/
├── users/                    # 사용자 프로필
│   └── {uid}: { email, role, branchName, active, ... }
├── branches/                 # 지점 정보 (branchCodes → branches로 변경 권장)
│   └── {branchId}: { name, manager, currency, ... }
├── settings/                 # 앱 설정
│   └── appSettings: { costItems, currencies, paymentMethods, ... }
├── securityCosts/            # 보안 비용 데이터
│   └── {docId}: { branchName, targetMonth, items, ... }
├── modules/                  # 모듈 설정 (확장용)
│   └── {moduleId}: { name, enabled, permissions, ... }
└── auditLog/                 # 감사 로그 (확장용)
    └── {logId}: { action, userId, timestamp, ... }
```

---

## 5. Google 로그인 설정 (완전 가이드)

### 교훈: Firebase + GCP 둘 다 설정해야 함

**Google 로그인이 작동하려면 3곳 모두 설정 필요:**

### Step 1: Firebase Console
1. **Authentication > 로그인 방법 > Google** 사용 설정
2. **Authentication > 설정 > 승인된 도메인** 추가:
   - `localhost` (개발)
   - `[project-id].firebaseapp.com` (기본)
   - `[project-id].web.app` (기본)
   - `[app-name].vercel.app` (프로덕션) ← **반드시 추가!**

### Step 2: Google Cloud Console (가장 많이 놓치는 부분!)
1. https://console.cloud.google.com 접속
2. **프로젝트 선택** → Firebase와 같은 프로젝트인지 확인!
3. **APIs & Services > OAuth 동의 화면**:
   - 앱 이름 입력
   - 지원 이메일 입력
   - 저장
4. **APIs & Services > 사용자 인증 정보**:
   - "Web client (auto created by Google Service)" 클릭
   - **승인된 JavaScript 출처** 추가:
     ```
     http://localhost
     http://localhost:5173
     https://[app-name].vercel.app
     ```
   - **승인된 리디렉션 URI** 확인:
     ```
     https://[project-id].firebaseapp.com/__/auth/handler
     ```
5. **저장 후 5~10분 대기** (전파 시간)

### Step 3: Vercel 환경변수
- Vercel Dashboard > Settings > Environment Variables
- `.env`의 모든 `VITE_FIREBASE_*` 변수 추가
- **Production + Preview + Development** 모두 체크

```
⚠️ 시행착오 교훈:
- Firebase 승인 도메인만 추가하고 GCP OAuth 설정을 안 하면 auth/unauthorized-domain 에러
- GCP Console에서 프로젝트 번호가 Firebase와 다르면 다른 프로젝트를 보고 있는 것
- 설정 후 최소 5분 대기 필요 (즉시 반영 안 됨)
- Brave 브라우저는 signInWithPopup을 차단함 → Chrome으로 테스트!
```

---

## 6. Vercel 배포 설정

### 초기 연동
1. https://vercel.com > Import Git Repository
2. Framework: Vite 선택
3. **Environment Variables** 전부 추가 (Step 3 참고)
4. Deploy

### 교훈: base path 문제
```
⚠️ vite.config.js의 base는 반드시 '/'
GitHub Pages용 base: '/repo-name/' 은 Vercel에서 404 발생!
```

### 자동 배포 흐름
```
코드 수정 → git push → Vercel 자동 빌드 (1~2분) → 배포 완료
```

---

## 7. 프로젝트 구조 (모듈 방식)

### 권장 디렉토리 구조
```
aviation-security-hub/
├── public/
│   ├── manifest.json
│   └── favicon.svg
├── src/
│   ├── main.jsx                    # 앱 진입점
│   ├── App.jsx                     # 라우터 + 레이아웃
│   ├── index.css                   # 글로벌 스타일
│   │
│   ├── core/                       # 공통 핵심 모듈
│   │   ├── firebase/
│   │   │   ├── config.js           # Firebase 초기화 (하나만!)
│   │   │   ├── auth.js             # 인증 함수
│   │   │   └── firestore.js        # Firestore 공통 유틸
│   │   ├── components/
│   │   │   ├── Layout.jsx          # 공통 레이아웃 (헤더, 사이드바)
│   │   │   ├── ProtectedRoute.jsx  # 인증 가드
│   │   │   ├── RoleGuard.jsx       # 역할별 접근 제어
│   │   │   └── LoadingSpinner.jsx  # 공통 로딩
│   │   ├── hooks/
│   │   │   ├── useAuth.js          # 인증 상태 훅
│   │   │   └── useFirestore.js     # Firestore 데이터 훅
│   │   └── utils/
│   │       ├── constants.js        # 상수 정의
│   │       └── helpers.js          # 유틸 함수
│   │
│   ├── modules/                    # 기능 모듈 (독립적)
│   │   ├── security-costs/         # 보안 비용 모듈 (현재 앱)
│   │   │   ├── SecurityCostsPage.jsx
│   │   │   ├── components/
│   │   │   │   ├── CostForm.jsx
│   │   │   │   └── CostTable.jsx
│   │   │   └── services/
│   │   │       └── costService.js
│   │   │
│   │   ├── dashboard/              # 대시보드 모듈
│   │   │   ├── DashboardPage.jsx
│   │   │   └── components/
│   │   │       ├── StatCards.jsx
│   │   │       └── Charts.jsx
│   │   │
│   │   ├── reports/                # 보고서 모듈
│   │   │   ├── ReportsPage.jsx
│   │   │   └── components/
│   │   │
│   │   ├── compliance/             # 규정 준수 모듈
│   │   │   └── CompliancePage.jsx
│   │   │
│   │   └── admin/                  # 관리자 모듈
│   │       ├── SettingsPage.jsx
│   │       ├── UserManagement.jsx
│   │       └── BranchManagement.jsx
│   │
│   └── pages/                      # 페이지 레벨 컴포넌트
│       ├── LoginPage.jsx
│       ├── HomePage.jsx            # 모듈 허브 (메인)
│       └── NotFoundPage.jsx
│
├── .env                            # 환경변수 (커밋 안 함)
├── .gitignore
├── vercel.json
├── vite.config.js
├── package.json
└── CLAUDE.md / GEMINI.md           # AI 개발자 지시 파일 (선택)
```

### 모듈 등록 방식 (App.jsx)
```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './core/components/Layout';
import ProtectedRoute from './core/components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';

// 모듈 페이지 (lazy loading)
const SecurityCosts = lazy(() => import('./modules/security-costs/SecurityCostsPage'));
const Dashboard = lazy(() => import('./modules/dashboard/DashboardPage'));
const Reports = lazy(() => import('./modules/reports/ReportsPage'));
const Admin = lazy(() => import('./modules/admin/SettingsPage'));

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<HomePage />} />
          <Route path="/security-costs" element={<SecurityCosts />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/admin/*" element={<RoleGuard role="hq_admin"><Admin /></RoleGuard>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 8. GenSpark AI 개발자 작업 시 주의사항

### 교훈에서 도출된 AI 개발 규칙

#### 규칙 1: .env 파일 절대 커밋 금지
```
AI가 .env 값을 코드에 하드코딩하거나 커밋하지 않도록 주의.
항상 import.meta.env.VITE_* 방식으로 참조.
```

#### 규칙 2: 백업/임시 파일 생성 금지
```
AI가 *.backup, *.broken, *.before-* 파일을 만들지 않도록 요청.
변경 전 원본이 필요하면 git으로 복원 가능.
```

#### 규칙 3: base path 변경 금지
```
vite.config.js의 base: '/' 를 절대 변경하지 않음.
GitHub Pages 배포 코드 (base: '/repo-name/') 를 추가하면 Vercel 404 발생.
```

#### 규칙 4: Firebase config 수정 시 반드시 확인
```
Firebase config 값을 수정할 때:
1. messagingSenderId와 appId의 프로젝트 번호가 일치하는지 확인
2. Firebase Console에서 직접 복사한 최신 값인지 확인
3. Vercel 환경변수도 함께 업데이트
```

#### 규칙 5: 새 컬렉션/문서 생성 시 Firestore 규칙 확인
```
새로운 Firestore 컬렉션을 사용할 때:
1. 보안 규칙에서 해당 컬렉션의 읽기/쓰기 허용 여부 확인
2. 인증 필수 규칙이 적용되어 있는지 확인
```

#### 규칙 6: localStorage와 Firestore 동기화
```
데이터를 localStorage에만 저장하면 다른 기기에서 접근 불가.
Settings 등 공유 데이터는 반드시 Firestore에 저장.
localStorage는 캐시/오프라인 용도로만 사용.
```

---

## 9. 시행착오 방지 체크리스트

### 새 프로젝트 시작 시 (한 번만)
- [ ] Firebase 프로젝트 하나만 생성/사용 (프로젝트 번호 기록)
- [ ] Firebase Console에서 웹앱 config 복사 → .env 저장
- [ ] Firebase Authentication > Google 로그인 활성화
- [ ] Firebase Authentication > 승인된 도메인에 Vercel URL 추가
- [ ] GCP Console > OAuth 동의 화면 설정
- [ ] GCP Console > OAuth 클라이언트 > JavaScript 출처 + 리디렉션 URI 설정
- [ ] Vercel 프로젝트 생성 > 환경변수 7개 설정
- [ ] vite.config.js base: '/' 확인
- [ ] vercel.json rewrites 설정 확인
- [ ] .gitignore에 .env 포함 확인

### 새 기능 개발 시 (매번)
- [ ] 기능 브랜치 생성 (genspark_ai_developer)
- [ ] 코드 변경 후 npm run build 성공 확인
- [ ] Firestore에 새 컬렉션 사용 시 보안 규칙 확인
- [ ] 환경변수 추가 시 Vercel에도 추가
- [ ] Chrome (시크릿 모드)에서 테스트 (Brave X)
- [ ] PR 생성 → 머지 → Vercel 자동 배포 확인

### 배포 후 확인 (매번)
- [ ] 배포 URL 접속 → 빈 화면이 아닌지 확인
- [ ] 콘솔에 auth/invalid-api-key 없는지 확인
- [ ] Google 로그인 → auth/unauthorized-domain 없는지 확인
- [ ] 로그인 성공 후 화면 전환 정상인지 확인
- [ ] Firestore 데이터 읽기/쓰기 정상인지 확인

---

## 10. 모듈 확장 계획

### Phase 1: 기반 정비 (현재 → Hub 전환)
- [ ] React Router 추가 → 페이지 라우팅
- [ ] 공통 Layout 컴포넌트 (사이드바 네비게이션)
- [ ] 현재 Security Cost App → 모듈로 분리
- [ ] ProtectedRoute / RoleGuard 컴포넌트

### Phase 2: 핵심 모듈 추가
- [ ] **Dashboard**: 통계 카드 + 차트 (지점별 비용 현황)
- [ ] **Reports**: 월간/분기별 보고서 생성 + PDF 내보내기
- [ ] **Notifications**: 제출 마감 알림, 승인 요청

### Phase 3: 고급 기능
- [ ] **Compliance**: 규정 준수 체크리스트 + 만료일 추적
- [ ] **Audit Log**: 모든 변경사항 추적
- [ ] **File Manager**: 문서/증빙자료 업로드 (Firebase Storage)
- [ ] **Multi-language**: 한국어/영어 전환

### 추가 고려 패키지
```bash
# Phase 1
npm install react-router-dom           # 라우팅

# Phase 2
npm install recharts                    # 차트
npm install @react-pdf/renderer         # PDF 생성
npm install date-fns                    # 날짜 처리

# Phase 3
npm install react-i18next i18next       # 다국어
npm install react-dropzone              # 파일 업로드
```

---

## 부록: 현재 프로젝트 참조 정보

### Firebase 프로젝트
- **Project ID**: airzeta-security-system
- **Project Number**: 803391050005
- **OAuth Client ID**: 803391050005-r8g7qs3bta4ul9p06dfkl88smg749ll.apps.googleusercontent.com

### Vercel
- **App URL**: https://airzeta-security-fee-app.vercel.app
- **GitHub Repo**: https://github.com/Mark4mission/airzeta-security-fee-app

### Firestore 컬렉션 (현재)
- `branchCodes` - 지점 정보
- `securityCosts` - 보안 비용 데이터
- `users` - 사용자 프로필
- `settings/appSettings` - 앱 설정

### PR 이력 (교훈 참조용)
| PR | 내용 | 교훈 |
|----|------|------|
| #2 | Vite base path 수정 | GitHub Pages ≠ Vercel |
| #3 | 불필요한 파일 정리 | .gitignore 초기 설정 중요 |
| #4 | GIS 폴백 추가 | 불필요한 복잡성 추가 |
| #5 | GIS 폴백 제거, OAuth 안내 | GCP 설정이 근본 해결책 |
| #6 | Race condition 수정 | onAuthStateChanged 타이밍 |
| #7 | Firestore 저장 연동 | localStorage만으로 불충분 |
| #8 | User Management 개선 | Google 사용자 워크플로우 |
