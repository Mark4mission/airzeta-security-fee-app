# 🚀 5분 안에 배포하기

## 옵션 1: Netlify Drop (가장 쉬움) ⭐ 추천

### 단계:
1. **브라우저에서 접속**: https://app.netlify.com/drop
   - 로그인 필요 (GitHub/GitLab/Email 계정)

2. **dist 폴더 준비**:
   - 프리뷰 URL에서 확인: https://8080-iwo2ct1nieql1y4fcme0v-5c13a017.sandbox.novita.ai
   - 샌드박스의 `/home/user/webapp/dist` 폴더를 로컬로 다운로드하거나
   - 압축 파일 `branch-security-costs-dist.tar.gz` (73 KB)를 다운로드 후 압축 해제

3. **드래그 앤 드롭**:
   - `dist` 폴더를 Netlify Drop 페이지로 드래그
   - 자동으로 배포 시작

4. **배포 완료!**
   - 즉시 사용 가능한 URL 획득 (예: `https://random-name-123.netlify.app`)
   - 나중에 커스텀 도메인 설정 가능

---

## 옵션 2: Vercel (GitHub 연동)

### 전제조건:
- GitHub 계정 필요
- Git 저장소 생성 필요

### 단계:
1. **GitHub에 코드 푸시**:
   ```bash
   cd /home/user/webapp
   git remote add origin https://github.com/YOUR_USERNAME/branch-security-costs.git
   git push -u origin main
   ```

2. **Vercel에서 배포**:
   - https://vercel.com 로그인
   - "New Project" 클릭
   - GitHub 저장소 선택: `branch-security-costs`
   - 배포 설정:
     - Framework Preset: **Vite**
     - Build Command: `npm run build`
     - Output Directory: `dist`
   - "Deploy" 클릭

3. **배포 완료!**
   - URL: `https://branch-security-costs.vercel.app`

---

## 옵션 3: GitHub Pages

### 단계:
1. **gh-pages 설치**:
   ```bash
   cd /home/user/webapp
   npm install --save-dev gh-pages
   ```

2. **package.json에 스크립트 추가**:
   ```json
   "scripts": {
     "deploy": "npm run build && gh-pages -d dist"
   }
   ```

3. **배포 실행**:
   ```bash
   npm run deploy
   ```

4. **GitHub Pages 설정**:
   - GitHub 저장소 → Settings → Pages
   - Source: `gh-pages` 브랜치 선택

5. **배포 완료!**
   - URL: `https://YOUR_USERNAME.github.io/branch-security-costs/`

---

## 현재 사용 가능한 URL

### 개발 서버 (Hot Reload):
- https://5174-iwo2ct1nieql1y4fcme0v-5c13a017.sandbox.novita.ai

### 프로덕션 미리보기:
- https://8080-iwo2ct1nieql1y4fcme0v-5c13a017.sandbox.novita.ai

### API 테스트 페이지:
- https://5174-iwo2ct1nieql1y4fcme0v-5c13a017.sandbox.novita.ai/test-api.html
- https://8080-iwo2ct1nieql1y4fcme0v-5c13a017.sandbox.novita.ai/test-api.html

---

## 배포 후 확인사항

✅ **기능 체크리스트**:
- [ ] 지점명 드롭다운 작동
- [ ] 지점코드 입력 및 인증
- [ ] 비용 항목 추가/삭제
- [ ] 파일 업로드 (PDF)
- [ ] 데이터 제출 → Google Sheets 반영
- [ ] 이전 데이터 불러오기 (Load Previous Data)
- [ ] Settings 관리 (지점명, 항목명, 통화, 결제수단)

✅ **Google Sheets 확인**:
- Submissions 시트에 데이터가 정상적으로 입력되는지 확인
- BranchCodes 시트에 모든 지점 코드가 등록되어 있는지 확인

✅ **사용자 교육**:
- 각 지점에 고유 지점코드 배포
- 사용 가이드 공유
- 문의 채널 안내

---

## 문제 발생 시

### Google Sheets 데이터 전송 실패:
1. Apps Script 로그 확인
2. 배포된 Web App URL이 `src/App.jsx`의 `API_URL`과 일치하는지 확인
3. BranchCodes 시트에 지점명/코드가 정확히 입력되어 있는지 확인

### CORS 에러:
- Apps Script가 "모든 사용자" 접근 권한으로 배포되었는지 확인

### 파일 업로드 실패:
- PDF 파일만 업로드 가능
- 파일 크기 제한 확인 (일반적으로 50MB 이하 권장)

---

## 지원

문제가 발생하면 다음을 확인하세요:
- README.md
- DEPLOYMENT.md
- VERCEL_DEPLOY_GUIDE.md
- google-apps-script.js

