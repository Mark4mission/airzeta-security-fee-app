# 📊 Google Sheets Integration Setup Guide

## ✅ **완료된 작업**

### 1. **프론트엔드 (App.jsx) ✅**
- Branch Codes 자동 매칭 기능 추가
- Settings Google Sheets 연동
- Branch Name 선택 시 자동으로 Branch Code 매칭

### 2. **백엔드 (Google Apps Script) ✅**
- `google-apps-script-updated.js` 파일 생성
- 새로운 API 엔드포인트:
  - `GET ?action=getBranchCodes` - Branch Codes 로드
  - `GET ?action=getSettings` - Settings 로드
  - `POST action=saveSettings` - Settings 저장

### 3. **프로덕션 배포 ✅**
- GitHub Pages 배포 완료
- URL: https://mark4mission.github.io/airzeta-security-fee-app/

---

## 🚀 **Google Apps Script 배포 단계**

### **Step 1: Google Sheets 생성**

1. Google Drive에서 새 Google Sheets 생성
2. 파일명: **"Branch Security Cost System"** (또는 원하는 이름)

---

### **Step 2: Google Apps Script 열기**

1. Google Sheets에서 **확장 프로그램 > Apps Script** 클릭
2. 새 프로젝트 생성 (자동)

---

### **Step 3: 코드 복사**

1. `Code.gs` 파일에 다음 코드 전체 복사:
   - 파일 위치: `/home/user/webapp/google-apps-script-updated.js`
   - 또는 GitHub: https://github.com/Mark4mission/airzeta-security-fee-app/blob/main/google-apps-script-updated.js

2. 전체 코드를 복사하여 `Code.gs`에 붙여넣기

---

### **Step 4: 웹 앱 배포**

1. Apps Script 편집기에서 **배포 > 새 배포** 클릭
2. 설정:
   - **유형**: 웹 앱
   - **Execute as**: 나 (본인 계정)
   - **Who has access**: **Anyone** (누구나)
3. **배포** 버튼 클릭
4. **권한 부여** 팝업에서 본인 계정 선택
5. **고급 > (프로젝트명) (안전하지 않음)으로 이동** 클릭
6. **허용** 클릭

---

### **Step 5: 웹 앱 URL 복사**

배포 완료 후 **웹 앱 URL**이 표시됩니다:
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

이 URL을 복사하세요!

---

### **Step 6: 프론트엔드에 API URL 업데이트**

#### **방법 A: GitHub에서 직접 수정 (권장)**

1. https://github.com/Mark4mission/airzeta-security-fee-app/blob/main/src/App.jsx 접속
2. **연필 아이콘 (Edit)** 클릭
3. 19번째 줄 찾기:
   ```javascript
   const API_URL = 'https://script.google.com/macros/s/AKfycbzq7I4yROJqWqRAQA0PlF_GbCUdyhvNHy3ybD8V5rtYc4Vdt4a-D5LKR1HxLZjGiOO-1g/exec';
   ```

4. **YOUR_DEPLOYMENT_ID**로 교체:
   ```javascript
   const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   ```

5. **Commit changes** 클릭

#### **방법 B: 로컬에서 수정**

터미널에서:
```bash
cd /home/user/webapp
# src/App.jsx 19번째 줄 수정
npm run build
npm run deploy
```

---

### **Step 7: Google Sheets 시트 구조**

배포 후 첫 실행 시 자동으로 생성되는 시트들:

#### **1. BranchCodes 시트** (자동 생성)
| Branch Name | Branch Code |
|-------------|-------------|
| Seoul Branch | SEOUL2024 |
| Tokyo Branch | TOKYO2024 |
| New York Branch | NYC2024 |
| London Branch | LONDON2024 |
| Singapore Branch | SING2024 |

**사용자 정의:**
- 이 시트에서 지점명과 코드를 수정하세요
- 앱에서 자동으로 매칭됩니다

#### **2. Settings 시트** (자동 생성)
| Setting Key | Setting Value |
|-------------|---------------|
| branchNames | ["Seoul Branch", "Tokyo Branch", ...] |
| itemNames | ["Labor Cost", "Maintenance", ...] |
| currencies | ["KRW", "USD", "EUR", ...] |
| paymentMethods | ["Wire Transfer", "ICH", ...] |

**사용자 정의:**
- 앱의 Settings 모달에서 수정 가능
- 모든 PC/브라우저에서 동일하게 로드됨

#### **3. Submissions 시트** (자동 생성)
제출된 데이터가 저장되는 시트입니다.

---

## 🧪 **테스트 방법**

### **1. Branch Codes 테스트**

1. Google Sheets의 `BranchCodes` 시트 열기
2. Branch Code 수정 (예: `SEOUL2024` → `SEOUL2025`)
3. 앱 새로고침: https://mark4mission.github.io/airzeta-security-fee-app/
4. Branch Name 드롭다운에서 "Seoul Branch" 선택
5. **Branch Code가 자동으로 채워지는지 확인** ✅

### **2. Settings 테스트**

1. 앱에서 **Settings** 버튼 클릭
2. Branch Names, Item Names 등 수정
3. **Save Settings** 클릭
4. Google Sheets의 `Settings` 시트에서 데이터 확인 ✅
5. 다른 브라우저나 PC에서 앱 열어서 동일한 Settings 로드되는지 확인 ✅

### **3. Submission 테스트**

1. 앱에서 폼 작성
2. **Submit** 클릭
3. Google Sheets의 `Submissions` 시트에서 데이터 확인 ✅

---

## 📋 **API 엔드포인트 정리**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `?action=getBranchCodes` | Branch Name ↔ Branch Code 매핑 로드 |
| GET | `?action=getSettings` | Settings 데이터 로드 |
| POST | `action=saveSettings` | Settings 데이터 저장 |
| GET | `?action=load&branchName=xxx&branchCode=xxx&targetMonth=xxx` | 과거 제출 데이터 로드 |
| POST | `action=submit` | 새 데이터 제출 |
| GET | `?action=getHistory&branchName=xxx&targetMonth=xxx` | 제출 이력 조회 |

---

## 🔧 **트러블슈팅**

### **문제 1: CORS 에러**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**해결:**
- Apps Script 배포 시 **"Who has access"**를 **"Anyone"**으로 설정했는지 확인
- 웹 앱을 **재배포**하여 새 버전 생성

### **문제 2: Branch Code 자동 매칭 안됨**
**확인 사항:**
- Google Sheets의 `BranchCodes` 시트에 데이터가 있는지 확인
- Branch Name이 정확히 일치하는지 확인 (대소문자 구분)
- 브라우저 콘솔에서 `loadBranchCodesFromServer` 로그 확인

### **문제 3: Settings 저장 안됨**
**확인 사항:**
- Apps Script가 정상 배포되었는지 확인
- `saveSettings` API 응답 확인 (브라우저 콘솔)
- Google Sheets `Settings` 시트 권한 확인

---

## ✅ **다음 단계**

### **필수 작업:**
1. ✅ **Google Apps Script 배포** (위 Step 1-6 따라하기)
2. ✅ **API URL 업데이트** (Step 6)
3. ✅ **테스트** (위 테스트 방법 참고)

### **선택 작업:**
1. **BranchCodes 커스터마이징**
   - Google Sheets에서 실제 지점명/코드로 수정

2. **Settings 커스터마이징**
   - 앱 Settings 모달에서 필요한 항목 추가/수정

3. **3-Block 레이아웃 복원** (원하시면)
   - 이전에 작업한 3-Block UI를 다시 적용

---

## 📞 **지원**

문제가 발생하면:
1. 브라우저 콘솔 (F12) 확인
2. Google Apps Script 로그 확인 (Apps Script 편집기 > 실행 로그)
3. 스크린샷과 함께 문의

---

**작성일:** 2026-01-27
**작성자:** Claude AI Assistant
**프로젝트:** Branch Security Cost Submission System
