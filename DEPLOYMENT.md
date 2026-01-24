# 웹앱 배포 가이드

빌드가 완료되었습니다! `dist` 폴더에 프로덕션 파일이 생성되었습니다.

## 📦 배포 방법

### 옵션 1: Vercel (권장 - 무료, 빠름, 자동 HTTPS)

#### 1. Vercel 계정 생성
- [vercel.com](https://vercel.com) 접속
- GitHub, GitLab, 또는 이메일로 가입

#### 2. Vercel CLI 설치 및 배포
```bash
cd /home/user/webapp
npm install -g vercel
vercel login
vercel --prod
```

#### 3. 설정
- Project name: `branch-security-costs`
- Framework: `Vite` (자동 감지)
- 배포 완료 후 URL 받음 (예: `https://branch-security-costs.vercel.app`)

#### 장점:
✅ 무료
✅ 자동 HTTPS
✅ 글로벌 CDN
✅ Git 푸시만으로 자동 재배포
✅ 커스텀 도메인 지원

---

### 옵션 2: Netlify (무료, 드래그 앤 드롭)

#### 1. Netlify 계정 생성
- [netlify.com](https://netlify.com) 접속
- GitHub 또는 이메일로 가입

#### 2-A. 드래그 앤 드롭 배포 (가장 쉬움)
1. [app.netlify.com/drop](https://app.netlify.com/drop) 접속
2. `dist` 폴더를 브라우저 창에 드래그
3. 즉시 배포 완료!

#### 2-B. Netlify CLI 배포
```bash
cd /home/user/webapp
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=dist
```

#### 장점:
✅ 무료
✅ 드래그 앤 드롭으로 초간단 배포
✅ 자동 HTTPS
✅ 폼 제출 기능 내장
✅ 커스텀 도메인 지원

---

### 옵션 3: GitHub Pages (무료, GitHub 사용자용)

#### 1. GitHub 저장소 생성
```bash
cd /home/user/webapp
git remote add origin https://github.com/YOUR_USERNAME/branch-security-costs.git
git push -u origin main
```

#### 2. GitHub Pages 설정
1. GitHub 저장소 페이지 → **Settings**
2. 좌측 메뉴 → **Pages**
3. Source: **Deploy from a branch**
4. Branch: **gh-pages** (곧 생성됨)
5. Save

#### 3. gh-pages 패키지 설치 및 배포
```bash
npm install -D gh-pages

# package.json에 추가
# "homepage": "https://YOUR_USERNAME.github.io/branch-security-costs",
# "scripts": {
#   "predeploy": "npm run build",
#   "deploy": "gh-pages -d dist"
# }

npm run deploy
```

#### 장점:
✅ 완전 무료
✅ GitHub과 통합
✅ 자동 HTTPS
✅ 버전 관리 용이

---

### 옵션 4: Cloudflare Pages (무료, 빠른 속도)

#### 1. Cloudflare 계정
- [pages.cloudflare.com](https://pages.cloudflare.com) 접속
- 계정 생성

#### 2. Git 연동 배포
1. **Create a project** 클릭
2. GitHub 저장소 연결
3. 빌드 설정:
   - Build command: `npm run build`
   - Build output: `dist`
4. **Deploy** 클릭

#### 3. CLI 배포 (대안)
```bash
npm install -g wrangler
wrangler login
wrangler pages deploy dist
```

#### 장점:
✅ 무료
✅ 매우 빠른 속도 (Cloudflare CDN)
✅ 무제한 대역폭
✅ 자동 HTTPS

---

### 옵션 5: 자체 서버 (Docker)

#### Dockerfile 생성
```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 빌드 및 실행
```bash
docker build -t branch-security-costs .
docker run -d -p 80:80 branch-security-costs
```

#### 장점:
✅ 완전한 제어
✅ 자체 인프라
✅ 커스터마이징 가능

---

## 🚀 빠른 배포 (추천 순서)

### 1순위: Vercel (가장 간단하고 강력)
```bash
npm install -g vercel
vercel login
vercel --prod
```
→ 1분 안에 배포 완료!

### 2순위: Netlify Drop
1. https://app.netlify.com/drop 접속
2. `dist` 폴더 드래그
3. 완료!

### 3순위: GitHub Pages
- GitHub 사용자라면 무료로 호스팅

---

## 📝 배포 후 확인사항

### 1. HTTPS 작동 확인
- 모든 플랫폼이 자동 HTTPS 제공
- 브라우저 주소창에 자물쇠 아이콘 확인

### 2. Google Apps Script CORS 설정
- 웹앱 URL이 변경되었으므로 CORS 에러 발생 가능
- Apps Script는 모든 도메인 허용 (이미 설정됨)

### 3. 설정 저장 확인
- 브라우저 localStorage 사용
- 각 사용자별로 설정 저장
- 시크릿 모드에서는 설정 저장 안됨

### 4. 모바일 반응형 확인
- 스마트폰에서 접속 테스트
- Tailwind CSS로 반응형 구현됨

---

## 🔧 배포 후 업데이트 방법

### Vercel
```bash
cd /home/user/webapp
# 코드 수정 후
git push origin main
# Vercel이 자동으로 재배포
```

또는
```bash
vercel --prod
```

### Netlify
```bash
npm run build
netlify deploy --prod --dir=dist
```

### GitHub Pages
```bash
npm run deploy
```

---

## 🌐 커스텀 도메인 연결

### Vercel
1. Vercel 대시보드 → Project → Settings → Domains
2. 도메인 입력 (예: `security.yourcompany.com`)
3. DNS 레코드 추가 (Vercel이 안내)

### Netlify
1. Netlify 대시보드 → Domain settings
2. Add custom domain
3. DNS 설정 (Netlify가 안내)

### Cloudflare Pages
1. Pages 대시보드 → Custom domains
2. 도메인 추가
3. DNS 자동 설정 (Cloudflare DNS 사용 시)

---

## 📊 현재 빌드 정보

```
✓ dist/index.html           0.45 kB │ gzip:  0.29 kB
✓ dist/assets/index-*.css  17.78 kB │ gzip:  4.26 kB
✓ dist/assets/index-*.js  218.21 kB │ gzip: 66.78 kB
```

**총 크기**: ~236 KB (gzip: ~71 KB)
- 매우 가벼운 애플리케이션
- 빠른 로딩 속도
- 모바일에서도 빠름

---

## 🎯 지금 바로 배포하기

### 가장 빠른 방법 (Vercel)

1. **Vercel CLI 설치**
```bash
npm install -g vercel
```

2. **로그인**
```bash
vercel login
```
(브라우저에서 인증)

3. **배포**
```bash
vercel --prod
```

4. **완료!**
```
✅ Production: https://branch-security-costs-xxx.vercel.app
```

---

## 💡 팁

### 환경 변수 설정
만약 API URL을 환경 변수로 관리하고 싶다면:

1. `.env.production` 파일 생성:
```
VITE_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

2. `src/App.jsx` 수정:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'https://script.google.com/...';
```

3. Vercel/Netlify 대시보드에서 환경 변수 설정

### Analytics 추가
Vercel/Netlify는 기본 analytics 제공
- 방문자 수
- 페이지 뷰
- 로딩 속도

### 보안
- 모든 플랫폼이 자동 HTTPS
- 지점코드는 Google Sheets에서 관리
- 브라우저 localStorage는 도메인별 격리

---

## ❓ FAQ

**Q: 무료인가요?**
A: Vercel, Netlify, GitHub Pages, Cloudflare Pages 모두 무료 티어 제공

**Q: 트래픽 제한이 있나요?**
A: 
- Vercel: 100GB/월 (무료)
- Netlify: 100GB/월 (무료)
- Cloudflare: 무제한 (무료)
- GitHub Pages: 100GB/월 (무료)

**Q: 도메인 비용은?**
A: 
- 제공된 도메인 무료 (예: `*.vercel.app`)
- 커스텀 도메인은 별도 구매 필요 (연 $10-20)

**Q: SSL 인증서 비용은?**
A: 모든 플랫폼이 무료 SSL 제공 (Let's Encrypt)

**Q: 업데이트는 어떻게?**
A: 코드 수정 → 빌드 → 배포 (1-2분)

---

## 🎉 추천 배포 플랫폼

**1위: Vercel** ⭐⭐⭐⭐⭐
- CLI 한 줄로 배포
- Git 푸시로 자동 재배포
- 빠른 속도

**2위: Netlify** ⭐⭐⭐⭐⭐
- 드래그 앤 드롭 배포
- 직관적인 대시보드

**3위: Cloudflare Pages** ⭐⭐⭐⭐
- 가장 빠른 속도
- 무제한 대역폭

---

어떤 플랫폼으로 배포하시겠습니까? 도움이 필요하면 말씀해주세요! 🚀
