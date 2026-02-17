# 🚀 빠른 시작 가이드 (Quick Start Guide)

## 📦 파일 다운로드 및 적용

### 1. 이 저장소에서 로컬 프로젝트로 파일 복사

```bash
# 로컬 프로젝트 디렉토리로 이동
cd ~/airzeta-security-fee-app/airzeta-security-fee-app

# 백업 생성 (안전을 위해)
cp src/components/Login.jsx src/components/Login.jsx.backup.$(date +%Y%m%d)

# 수정된 파일 복사 (이 저장소의 파일 경로를 실제 경로로 변경)
# Login.jsx만 업데이트하면 됩니다 (나머지는 이미 완벽함)
# 
# Option 1: 수동 복사
# 이 저장소의 src/components/Login.jsx 내용을 복사해서
# 로컬의 src/components/Login.jsx에 붙여넣기
#
# Option 2: 터미널 복사 (경로 수정 필요)
# cp /path/to/this/repo/src/components/Login.jsx ./src/components/
```

### 2. Firebase Console 설정 (필수 - 5분)

```
🔗 URL: https://console.firebase.google.com/project/airzeta-security-system
```

**단계:**
1. 좌측 메뉴 → **Authentication** 클릭
2. 상단 탭 → **Sign-in method** 클릭
3. **Google** 찾아서 클릭
4. **Enable** 토글을 켜기
5. **Project support email** 선택 (예: admin@airzeta.com)
6. **Save** 버튼 클릭

✅ **완료!** 이제 Google 로그인 사용 가능

---

## 🧪 테스트 (5분)

### 개발 서버 시작

```bash
cd ~/airzeta-security-fee-app/airzeta-security-fee-app

# 개발 서버 시작
npm run dev
```

브라우저에서 열기: **http://localhost:5173**

### ✅ 확인 사항

1. **로그인 페이지 즉시 표시** ✅
   - "Missing or insufficient permissions" 에러 없음
   - 로딩 스피너 후 바로 로그인 화면

2. **Google 로그인 버튼 확인** ✅
   - "Continue with Google" 버튼 보임
   - 클릭 시 Google 계정 선택 팝업

3. **이메일 로그인 작동** ✅
   ```
   Email: admin@airzeta.com
   Password: [설정한 비밀번호]
   ```

4. **로그인 후 데이터 로드** ✅
   - 사용자 정보 표시
   - 지점 목록 로드
   - 비용 제출 폼 작동

---

## 👤 관리자 역할 설정 (2분)

### Option 1: Google 로그인 후 역할 변경

1. 앱에서 **Google로 로그인**
2. Firebase Console 열기
   ```
   https://console.firebase.google.com/project/airzeta-security-system/firestore
   ```
3. **Firestore Database** → **users** 컬렉션
4. 본인의 UID 문서 찾기 (방금 생성됨)
5. **role** 필드 클릭 → `"hq_admin"` 으로 변경
6. **Save** 클릭
7. 앱에서 **로그아웃** 후 **다시 로그인**

✅ **완료!** 이제 모든 지점 접근 가능

### Option 2: 이메일 계정에 프로필 추가

1. Firebase Console → **Authentication** → **Users**
2. `admin@airzeta.com` 의 **UID** 복사
   ```
   예: ZXNmBErweEYvuGL7gy19qSqyUo1
   ```
3. **Firestore Database** → **users** 컬렉션
4. **Add document** 클릭
5. **Document ID**: 복사한 UID 붙여넣기
6. 필드 추가:
   - `email` (string): `admin@airzeta.com`
   - `role` (string): `hq_admin`
   - `createdAt` (timestamp): 현재 시간
   - `lastLogin` (timestamp): 현재 시간
7. **Save** 클릭

✅ **완료!** 이메일로 로그인 가능

---

## 🚀 배포 (10분)

### Vercel 배포 (권장)

```bash
cd ~/airzeta-security-fee-app/airzeta-security-fee-app

# 프로젝트 빌드
npm run build

# Vercel CLI 설치 (한 번만)
npm install -g vercel

# 로그인 (한 번만)
vercel login

# 배포
vercel --prod
```

### 환경 변수 설정

1. **Vercel Dashboard** 접속
2. 프로젝트 선택
3. **Settings** → **Environment Variables**
4. 다음 변수들 추가:

```env
VITE_FIREBASE_API_KEY=AIzaSyCdkxuB5_IWcbk4Au7NfFAdP1SRB2y-Ixc
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=396226843516
VITE_FIREBASE_APP_ID=1:396226843516:web:0dfd5c01ac5a43aea2e42f
VITE_FIREBASE_MEASUREMENT_ID=G-6L2R6X31P4
```

### Firebase 인증 도메인 추가

1. Firebase Console → **Authentication** → **Settings**
2. **Authorized domains** 섹션
3. **Add domain** 클릭
4. Vercel 도메인 입력 (예: `airzeta-security.vercel.app`)
5. **Add** 클릭

✅ **완료!** 이제 배포된 앱에서 로그인 가능

---

## 🔍 문제 해결

### 문제 1: "Missing or insufficient permissions"

**원인:** 
- 인증 전에 Firestore 접근 시도

**해결:**
```bash
# 브라우저 캐시 삭제
# Chrome: Cmd+Shift+Delete (Mac) / Ctrl+Shift+Delete (Windows)
# 또는 시크릿 모드로 테스트

# 개발 서버 재시작
npm run dev
```

### 문제 2: Google 로그인 팝업 차단

**원인:**
- 브라우저 팝업 차단

**해결:**
- 브라우저 주소창 오른쪽 팝업 아이콘 클릭
- "Always allow pop-ups from this site" 선택

### 문제 3: 로그인 후 데이터 안 보임

**확인:**
1. Firebase Console → **Firestore** → **users**
2. 본인의 UID 문서 확인
3. `role` 필드 확인 (`hq_admin` 또는 `branch_user`)
4. `branchName` 필드 확인 (branch_user인 경우)

---

## 📝 파일별 변경 사항 요약

### ✅ 수정된 파일 (1개)
- `src/components/Login.jsx` - Google 로그인 버튼 추가

### ✅ 이미 완벽한 파일 (변경 불필요)
- `src/firebase/config.js` - Firebase 초기화
- `src/firebase/auth.js` - 모든 인증 함수 (Google 포함)
- `src/firebase/collections.js` - 인증 대기 로직
- `src/App.jsx` - 인증 플로우

---

## ⏱️ 전체 소요 시간

| 단계 | 소요 시간 |
|------|-----------|
| 파일 복사 | 1분 |
| Firebase Console 설정 | 5분 |
| 로컬 테스트 | 5분 |
| 관리자 역할 설정 | 2분 |
| 배포 | 10분 |
| **총합** | **23분** |

---

## 🎉 완료!

이제 다음이 가능합니다:
- ✅ 이메일/비밀번호 로그인
- ✅ Google 소셜 로그인
- ✅ 안전한 Firestore 접근
- ✅ 역할 기반 권한 관리
- ✅ 프로덕션 배포

---

## 📚 참고 문서

자세한 내용은 다음 문서를 참고하세요:
- `FINAL_DEPLOYMENT_GUIDE_KR.md` - 전체 배포 가이드
- `PROJECT_REVIEW_COMPLETE_KR.md` - 프로젝트 검토 완료 보고서
- `FIREBASE_FIX_SUMMARY.md` - 기술적 변경 사항 요약

---

## ❓ 질문이 있으신가요?

**Q: Login.jsx 말고 다른 파일도 업데이트해야 하나요?**
A: ❌ 아니요! 다른 파일들은 이미 완벽합니다. Login.jsx만 업데이트하면 됩니다.

**Q: 이메일 로그인을 삭제해야 하나요?**
A: ❌ 아니요! 두 가지 방법 모두 유지하는 것이 좋습니다.

**Q: Firebase 인증이 작동하지 않나요?**
A: ❌ 아니요! 정상 작동합니다. Google Provider만 활성화하면 됩니다.

---

**🚀 즐거운 개발 되세요!**
