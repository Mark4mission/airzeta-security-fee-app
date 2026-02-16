# Vercel 배포 방법

샌드박스 환경에서는 브라우저 인증이 제한되므로, 다음 방법들을 사용하실 수 있습니다:

## 방법 1: Vercel 웹사이트에서 직접 배포 (가장 쉬움)

### Step 1: GitHub에 코드 푸시 (선택사항)
```bash
cd /home/user/webapp

# GitHub 저장소 생성 후
git remote add origin https://github.com/YOUR_USERNAME/branch-security-costs.git
git branch -M main
git push -u origin main
```

### Step 2: Vercel 웹사이트에서 배포
1. https://vercel.com 접속
2. GitHub/GitLab/Email로 가입/로그인
3. **"New Project"** 클릭
4. **Import Git Repository** 선택 (또는 "Deploy a template")
5. GitHub 저장소 선택
6. 설정:
   - **Framework Preset**: Vite (자동 감지)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
7. **Deploy** 클릭
8. 완료! URL 받음

---

## 방법 2: Vercel CLI로 배포 (토큰 사용)

로컬 환경에서:

```bash
# Vercel 토큰 생성
# 1. https://vercel.com/account/tokens 접속
# 2. "Create" 클릭
# 3. 토큰 복사

# 토큰으로 로그인
npx vercel login --token YOUR_TOKEN

# 배포
npx vercel --prod
```

---

## 방법 3: Netlify Drop (더 쉬움 - 추천!)

### 지금 바로 배포 가능:

1. **dist 폴더 다운로드**
   - `/home/user/webapp/dist` 폴더 전체를 로컬로 복사

2. **Netlify Drop 사용**
   - https://app.netlify.com/drop 접속
   - dist 폴더를 브라우저에 드래그
   - 즉시 배포 완료!

---

## 방법 4: GitHub Pages (무료)

```bash
cd /home/user/webapp

# gh-pages 설치
npm install -D gh-pages

# package.json에 스크립트 추가 필요
# "deploy": "gh-pages -d dist"

# 배포
npm run deploy
```

---

## 현재 빌드된 파일 정보

```
dist/
├── index.html          - 메인 애플리케이션
├── test-api.html       - API 테스트 페이지
├── vite.svg           - 파비콘
└── assets/
    ├── index-*.css    - 스타일시트
    └── index-*.js     - JavaScript 번들
```

**이 파일들을 어떤 웹 서버에든 업로드하면 작동합니다!**

---

## 추천 배포 순서

### 🥇 1순위: Netlify Drop
- 가장 빠르고 쉬움
- 1분 안에 완료
- dist 폴더만 드래그하면 끝

### 🥈 2순위: Vercel (GitHub 연동)
- GitHub에 푸시 후 Vercel 웹사이트에서 Import
- 자동 재배포 지원
- 프로페셔널한 워크플로우

### 🥉 3순위: GitHub Pages
- GitHub 사용자에게 적합
- 무료 호스팅
- Git 기반 버전 관리

---

## dist 폴더 다운로드 방법

샌드박스에서 로컬로 파일 전송:

```bash
# ZIP 파일로 압축
cd /home/user/webapp
tar -czf dist.tar.gz dist/

# 또는 개별 파일 확인
ls -lh dist/
ls -lh dist/assets/
```

그 다음 샌드박스 파일 관리자에서 다운로드하거나,
로컬 환경에서 직접 빌드:

```bash
# 로컬 PC에서
git clone YOUR_REPO
cd branch-security-costs
npm install
npm run build
# dist 폴더 생성됨
```

---

## 어떤 방법을 선택하시겠습니까?

1. **Netlify Drop** - dist 폴더를 다운로드 받아서 드래그
2. **Vercel (웹)** - GitHub에 푸시 후 Vercel에서 import
3. **GitHub Pages** - Git 기반 배포
4. **기타** - 다른 방법 안내

어떤 방법이 편하신가요?
