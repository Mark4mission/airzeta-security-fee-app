# 🚀 GitHub + Vercel 배포 가이드

## 📋 목차
1. [사전 준비](#사전-준비)
2. [GitHub 설정](#github-설정)
3. [Vercel 배포](#vercel-배포)
4. [지속적인 개발 워크플로우](#지속적인-개발-워크플로우)
5. [API 연결 문제 해결](#api-연결-문제-해결)

---

## 🔧 사전 준비

### 필요한 것들:
- ✅ GitHub 계정 (https://github.com)
- ✅ Vercel 계정 (https://vercel.com - GitHub로 가입 권장)
- ✅ Git 설치 (로컬 PC)
- ✅ 이 프로젝트의 코드

### 현재 상태:
- ✅ **GitHub 저장소**: `https://github.com/Mark4mission/airzeta-security-fee-app`
- ✅ **로컬 빌드**: `/home/user/webapp/dist` (73 KB)
- ⚠️ **API 연결**: Google Apps Script 설정 확인 필요

---

## 📦 GitHub 설정

### Option A: 로컬 PC에서 푸시 (권장)

#### 1. 프로젝트 다운로드
샌드박스의 프로젝트를 로컬 PC로 다운로드합니다:

```bash
# 압축 파일 다운로드
# 파일 위치: /home/user/webapp/branch-security-costs-dist.tar.gz (73 KB)

# 로컬 PC에서 압축 해제
tar -xzf branch-security-costs-dist.tar.gz
```

또는 전체 프로젝트를 ZIP으로 다운로드합니다.

#### 2. GitHub 저장소 클론 (로컬 PC)

```bash
# 로컬 PC 터미널에서:
git clone https://github.com/Mark4mission/airzeta-security-fee-app.git
cd airzeta-security-fee-app
```

#### 3. 프로젝트 파일 복사

샌드박스에서 다운로드한 파일들을 클론한 저장소로 복사합니다:

```bash
# 중요 파일들:
# - src/
# - public/
# - dist/
# - package.json
# - vite.config.js
# - README.md
# - google-apps-script.js
# - 등등...
```

#### 4. Git 커밋 및 푸시

```bash
# 로컬 PC에서:
git add .
git commit -m "feat: Complete branch security cost submission system"
git push origin main
```

### Option B: GitHub Desktop 사용 (초보자 친화적)

1. **GitHub Desktop 다운로드**: https://desktop.github.com
2. **저장소 클론**: File → Clone Repository → `Mark4mission/airzeta-security-fee-app`
3. **파일 복사**: 다운로드한 파일들을 저장소 폴더로 복사
4. **커밋**: 좌측에서 변경사항 확인 → Summary 입력 → "Commit to main"
5. **푸시**: 상단의 "Push origin" 버튼 클릭

### Option C: GitHub 웹 인터페이스에서 직접 업로드

1. https://github.com/Mark4mission/airzeta-security-fee-app 접속
2. "Add file" → "Upload files" 클릭
3. 파일들을 드래그 앤 드롭
4. Commit message 입력 후 "Commit changes"

⚠️ **주의**: dist 폴더는 .gitignore에 포함되어 있습니다. Vercel이 자동으로 빌드하므로 괜찮습니다.

---

## 🎯 Vercel 배포

### 1. Vercel 계정 생성

1. https://vercel.com 접속
2. **"Continue with GitHub"** 클릭 (권장)
3. GitHub 계정으로 로그인 및 권한 승인

### 2. 프로젝트 Import

#### Step 1: New Project
- Vercel 대시보드에서 **"New Project"** 또는 **"Add New..."** → **"Project"** 클릭

#### Step 2: Import Repository
- "Import Git Repository" 섹션에서 검색창에 `airzeta-security-fee-app` 입력
- 또는 리스트에서 `Mark4mission/airzeta-security-fee-app` 찾기
- **"Import"** 버튼 클릭

#### Step 3: 프로젝트 설정

**Framework Preset**: Vite (자동 감지됨)

**Build and Output Settings**:
```
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

**Root Directory**: `./` (기본값)

**Environment Variables**: 없음 (필요 시 나중에 추가)

#### Step 4: 배포 시작

- **"Deploy"** 버튼 클릭
- 빌드 진행 상황 확인 (약 1-2분 소요)

### 3. 배포 완료! 🎉

배포가 완료되면:
- ✅ **Production URL**: `https://airzeta-security-fee-app.vercel.app`
- ✅ **Preview URL**: 각 커밋마다 자동 생성
- ✅ **자동 HTTPS**: SSL 인증서 자동 적용

---

## 🔄 지속적인 개발 워크플로우

### 일상적인 개발 프로세스

#### 1. 로컬에서 개발

```bash
# 샌드박스 또는 로컬 PC에서:
cd /path/to/airzeta-security-fee-app

# 개발 서버 시작
npm run dev

# 브라우저에서 http://localhost:5173 접속
```

#### 2. 코드 수정

- `src/App.jsx` 수정
- UI 컴포넌트 추가
- API 엔드포인트 변경
- 등등...

#### 3. 로컬 테스트

```bash
# 빌드 테스트
npm run build

# 프로덕션 미리보기
npm run preview
```

#### 4. GitHub에 푸시

```bash
git add .
git commit -m "feat: Add new feature"
git push origin main
```

#### 5. 자동 배포 🚀

- Vercel이 자동으로 새 커밋을 감지
- 자동으로 빌드 및 배포
- 배포 완료 알림 (이메일 또는 Slack)
- 새 버전이 즉시 프로덕션에 반영

### 브랜치 전략 (선택사항)

#### 개발 브랜치 사용:

```bash
# 새 기능 개발
git checkout -b feature/new-feature
# ... 코드 수정 ...
git add .
git commit -m "feat: Implement new feature"
git push origin feature/new-feature

# GitHub에서 Pull Request 생성
# Vercel이 자동으로 Preview 환경 생성
# 리뷰 후 main 브랜치에 병합
# 자동으로 프로덕션 배포
```

---

## 🔧 API 연결 문제 해결

### 현재 API 상태

**API URL**: 
```
https://script.google.com/macros/s/AKfycbzq7I4yROJqWqRAQA0PlF_GbCUdyhvNHy3ybD8V5rtYc4Vdt4a-D5LKR1HxLZjGiOO-1g/exec
```

### 문제 진단 도구

#### 1. 고급 디버거 사용

배포된 앱에서 접속:
- 개발 서버: `http://localhost:5173/debug-api.html`
- 프로덕션: `https://airzeta-security-fee-app.vercel.app/debug-api.html`

이 도구로 확인 가능:
- ✅ API 연결 상태
- ✅ CORS 설정
- ✅ 데이터 전송 성공 여부
- ✅ 에러 메시지 및 해결 방법

#### 2. Google Apps Script 재확인

##### A. 배포 상태 확인

1. Apps Script 편집기 열기
2. **"배포"** → **"배포 관리"** 클릭
3. 확인 사항:
   - ✅ 유형: "웹 앱"
   - ✅ 실행 계정: "나"
   - ✅ 액세스 권한: **"모든 사용자"**

##### B. 테스트 함수 실행

Apps Script 편집기에서 다음 함수 추가 및 실행:

```javascript
function testSubmission() {
  // Submissions 시트가 있는지 확인
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Submissions');
  
  if (!sheet) {
    Logger.log('❌ Submissions 시트가 없습니다!');
    return;
  }
  
  Logger.log('✅ Submissions 시트 존재');
  Logger.log('현재 행 수: ' + sheet.getLastRow());
  
  // 테스트 데이터 추가
  sheet.appendRow([
    new Date(),
    'Seoul Branch',
    'SEOUL2024',
    'Test Manager',
    '2024-01',
    'Labor Cost',
    1000,
    'KRW',
    10,
    10000,
    9500,
    'Test basis',
    'Wire Transfer',
    '',
    'Test note',
    'TEST-' + new Date().getTime()
  ]);
  
  Logger.log('✅ 테스트 데이터 추가 완료');
}

function testBranchCodes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BranchCodes');
  
  if (!sheet) {
    Logger.log('❌ BranchCodes 시트가 없습니다!');
    return;
  }
  
  Logger.log('✅ BranchCodes 시트 존재');
  
  const data = sheet.getDataRange().getValues();
  Logger.log('등록된 지점 수: ' + (data.length - 1)); // 헤더 제외
  
  data.forEach((row, index) => {
    if (index > 0) { // 헤더 스킵
      Logger.log(`${index}. ${row[0]} - ${row[1]}`);
    }
  });
}
```

**실행 방법**:
1. 함수 선택 (testSubmission 또는 testBranchCodes)
2. "실행" 버튼 클릭
3. "실행 로그" 확인

##### C. CORS 헤더 추가 (중요!)

`google-apps-script.js` 파일의 `doPost`와 `doGet` 함수가 다음을 반환하는지 확인:

```javascript
return ContentService
  .createTextOutput(JSON.stringify(result))
  .setMimeType(ContentService.MimeType.JSON);
```

**절대 사용하지 말 것**:
```javascript
// ❌ 이렇게 하면 CORS 에러 발생
return JSON.stringify(result);
```

##### D. 새 배포 버전 생성

코드를 수정한 경우 반드시 새 버전으로 재배포:

1. "배포" → "배포 관리"
2. 기존 배포 옆 "✏️ 편집" 클릭
3. "버전" → "새 버전" 선택
4. "배포" 클릭

**중요**: URL은 변경되지 않으므로 프론트엔드 코드 수정 불필요

### API URL 변경 시 (필요한 경우)

만약 새로운 Apps Script를 만들거나 URL이 변경된 경우:

#### 1. `src/App.jsx` 수정

```javascript
// 19번째 줄 근처:
const API_URL = 'YOUR_NEW_WEB_APP_URL_HERE';
```

#### 2. `public/debug-api.html` 수정

```html
<!-- 약 200번째 줄 근처 -->
<input type="text" id="apiUrl" value="YOUR_NEW_WEB_APP_URL_HERE">
```

#### 3. `public/test-api.html` 수정 (있는 경우)

```html
<input type="text" id="apiUrl" value="YOUR_NEW_WEB_APP_URL_HERE">
```

#### 4. 커밋 및 푸시

```bash
git add src/App.jsx public/debug-api.html
git commit -m "fix: Update API URL"
git push origin main
```

Vercel이 자동으로 재배포합니다.

---

## 📊 체크리스트

### 배포 전 체크리스트

- [ ] Google Apps Script 코드가 올바르게 작성됨
- [ ] Web App으로 배포됨 (모든 사용자 접근)
- [ ] BranchCodes 시트에 지점 코드 등록
- [ ] testSubmission() 함수 실행 성공
- [ ] debug-api.html에서 테스트 성공
- [ ] dist 빌드가 정상적으로 생성됨

### 배포 후 체크리스트

- [ ] Vercel 배포 성공 확인
- [ ] 프로덕션 URL 접속 가능
- [ ] 메인 폼이 정상적으로 표시됨
- [ ] Settings 모달 작동
- [ ] 데이터 제출 테스트 성공
- [ ] Google Sheets에 데이터 반영 확인
- [ ] Load Previous Data 기능 테스트
- [ ] 모바일/태블릿 반응형 확인

---

## 🎯 빠른 명령어 참조

### 로컬 개발

```bash
npm install          # 의존성 설치
npm run dev          # 개발 서버 시작
npm run build        # 프로덕션 빌드
npm run preview      # 빌드 미리보기
```

### Git 작업

```bash
git status           # 변경사항 확인
git add .            # 모든 변경사항 스테이징
git commit -m "msg"  # 커밋
git push             # 푸시 (자동 배포 트리거)
git pull             # 최신 코드 받기
```

### 유용한 링크

- 🔗 **GitHub 저장소**: https://github.com/Mark4mission/airzeta-security-fee-app
- 🔗 **Vercel 대시보드**: https://vercel.com/dashboard
- 🔗 **Vercel 배포 URL**: https://airzeta-security-fee-app.vercel.app (배포 후)
- 🔗 **API 디버거**: `/debug-api.html`
- 🔗 **Apps Script**: Google Drive → 해당 스프레드시트

---

## 🆘 문제 해결

### "배포는 성공했는데 데이터가 안 들어가요"

1. `debug-api.html` 접속
2. "Test Submit Data" 클릭
3. 에러 메시지 확인
4. Apps Script 실행 로그 확인
5. BranchCodes 시트 확인

### "Vercel 빌드가 실패해요"

1. Vercel 대시보드 → 프로젝트 → "Deployments" 탭
2. 실패한 배포 클릭 → 빌드 로그 확인
3. 일반적인 원인:
   - package.json 의존성 문제
   - 빌드 명령어 오류
   - Node.js 버전 불일치

### "GitHub 푸시가 안 돼요"

로컬 PC에서:

```bash
# 1. GitHub Personal Access Token 생성
# GitHub → Settings → Developer settings → Personal access tokens → Generate new token

# 2. Git credential 설정
git config --global credential.helper store

# 3. 푸시 시 토큰 사용
git push
# Username: Mark4mission
# Password: <생성한_토큰>
```

---

## 🎉 완료!

축하합니다! 이제 다음이 가능합니다:

✅ **자동 배포**: 코드를 푸시하면 자동으로 배포됨  
✅ **무료 호스팅**: Vercel 무료 플랜 사용  
✅ **HTTPS**: 자동 SSL 인증서  
✅ **지속적인 개발**: 언제든지 코드 수정 및 배포  
✅ **Preview 환경**: PR마다 별도 미리보기 URL  

**프로덕션 URL을 각 지점에 공유하세요!**

예시:
```
📧 해외 지점 담당자님께,

비용 제출 시스템이 준비되었습니다:
🔗 URL: https://airzeta-security-fee-app.vercel.app

귀하의 지점 코드: SEOUL2024

사용 방법:
1. URL 접속
2. 지점 선택 및 코드 입력
3. 비용 정보 입력
4. 제출

문의사항은 회신 부탁드립니다.
```

---

**마지막 업데이트**: 2024-01-22  
**작성자**: AI Assistant  
**문의**: Mark4mission
