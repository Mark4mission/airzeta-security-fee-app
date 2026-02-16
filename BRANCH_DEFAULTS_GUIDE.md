# 📊 Google Sheets Integration - Branch Defaults Auto-Save

## ✅ **구현 완료 사항**

### **1. Branch Code = 비밀번호** ✅
- ❌ Branch Name 선택 시 **자동 입력 안됨**
- ✅ 지점 담당자만 **수동으로 입력**
- ✅ 보안 검증용 비밀번호 개념

### **2. Branch Defaults = 지점별 자동 저장** ✅
- ✅ **Manager Name** - 자동 저장/로드
- ✅ **Unit Price** - 자동 저장/로드
- ✅ **Currency** - 자동 저장/로드
- ✅ **Payment Method** - 자동 저장/로드

---

## 🎯 **동작 방식**

### **시나리오 1: 처음 사용하는 지점**

1. **Branch Name 선택**: "Seoul Branch"
2. **Branch Code 입력**: "SEOUL2024" (수동 입력)
3. **Manager Name 입력**: "John Doe" → **자동 저장**
4. **Unit Price 입력**: "50000" → **자동 저장**
5. **Currency 선택**: "KRW" → **자동 저장**
6. **Payment Method 선택**: "Wire Transfer" → **자동 저장**

### **시나리오 2: 이전에 사용한 지점**

1. **Branch Name 선택**: "Seoul Branch"
   - Manager Name: "John Doe" ✅ **자동 입력**
   - Unit Price: "50000" ✅ **자동 입력**
   - Currency: "KRW" ✅ **자동 입력**
   - Payment Method: "Wire Transfer" ✅ **자동 입력**
2. **Branch Code 입력**: "SEOUL2024" (여전히 수동 입력)

### **시나리오 3: 다른 PC에서 사용**

1. **동일한 Google Sheets** 사용
2. **Branch Name 선택**: "Seoul Branch"
3. **모든 기본값 자동 로드** ✅
   - Manager Name, Unit Price, Currency, Payment Method 모두 자동 입력

---

## 📊 **Google Sheets 구조**

### **새로운 시트: BranchDefaults**

| Branch Name | Manager Name | Unit Price | Currency | Payment Method |
|-------------|--------------|------------|----------|----------------|
| Seoul Branch | John Doe | 50000 | KRW | Wire Transfer |
| Tokyo Branch | Yuki Tanaka | 60000 | JPY | ICH |
| New York Branch | Mike Smith | 80 | USD | Credit Card |
| London Branch | James Brown | 70 | GBP | Wire Transfer |
| Singapore Branch | Lee Wei | 90 | SGD | Wire Transfer |

### **기존 시트: BranchCodes** (여전히 사용)

| Branch Name | Branch Code |
|-------------|-------------|
| Seoul Branch | SEOUL2024 |
| Tokyo Branch | TOKYO2024 |
| New York Branch | NYC2024 |
| London Branch | LONDON2024 |
| Singapore Branch | SING2024 |

**용도**: 
- Branch Code 검증용
- 사용자는 **수동으로 입력**해야 함
- 자동 매칭 **안됨**

---

## 🚀 **Google Apps Script 배포**

### **Step 1: Google Sheets 준비**

1. 기존 Google Sheets 열기
2. **확장 프로그램 > Apps Script**

### **Step 2: 코드 업데이트**

1. `Code.gs` 파일 열기
2. **전체 코드 삭제**
3. 새 코드 복사:
   - 파일: `/home/user/webapp/google-apps-script-updated.js`
   - GitHub: https://github.com/Mark4mission/airzeta-security-fee-app/blob/main/google-apps-script-updated.js
4. 붙여넣기

### **Step 3: 재배포**

1. **배포 > 배포 관리**
2. 기존 배포 옆 **연필 아이콘** 클릭
3. **버전: 새 버전**
4. **배포** 클릭

**중요**: 웹 앱 URL은 변경되지 않습니다!

---

## 🧪 **테스트 방법**

### **Test 1: Branch Code 수동 입력 확인**

1. 앱 열기: https://mark4mission.github.io/airzeta-security-fee-app/
2. Branch Name 선택: "Seoul Branch"
3. **Branch Code 필드 확인**: ❌ 자동으로 채워지지 않음
4. **Branch Code 수동 입력**: "SEOUL2024" ✅

### **Test 2: Branch Defaults 자동 저장**

1. Branch Name: "Seoul Branch" 선택
2. Branch Code: "SEOUL2024" 입력
3. Manager Name: "John Doe" 입력 → **탭을 눌러 다음 필드로 이동**
4. Google Sheets `BranchDefaults` 시트 확인
5. **Seoul Branch 행 생성됨** ✅

### **Test 3: Branch Defaults 자동 로드**

1. **페이지 새로고침** (F5)
2. Branch Name: "Seoul Branch" 선택
3. **Manager Name 자동 입력됨**: "John Doe" ✅
4. Unit Price 입력 후 **Currency 드롭다운으로 이동**
5. Google Sheets 확인 → Unit Price 저장됨 ✅

### **Test 4: 다른 PC에서 테스트**

1. **시크릿 모드** 또는 **다른 브라우저** 열기
2. 앱 열기
3. Branch Name: "Seoul Branch" 선택
4. **모든 기본값 자동 로드됨** ✅

---

## 🎨 **UI 변경 사항**

### **Branch Code 필드**
```
Branch Code * (Security verification - known only to branch manager)
[입력란]
```

### **Manager Name 필드**
```
Manager Name * (Auto-saved per branch)
[입력란]
```

### **Cost Items - Unit Price**
```
Unit Price (Auto-saved per branch)
[입력란]
```

### **Cost Items - Currency**
```
Currency (Auto-saved per branch)
[드롭다운]
```

### **Cost Items - Payment Method**
```
Payment Method (Auto-saved per branch)
[드롭다운]
```

---

## 📋 **API 엔드포인트 업데이트**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `?action=getBranchDefaults` | ✅ **NEW** - Branch defaults 로드 |
| POST | `action=saveBranchDefaults` | ✅ **NEW** - Branch defaults 저장 |
| GET | `?action=getBranchCodes` | Branch codes 로드 (검증용) |
| GET | `?action=getSettings` | Settings 로드 |
| POST | `action=saveSettings` | Settings 저장 |
| POST | `action=submit` | 데이터 제출 |

---

## 🔧 **자동 저장 타이밍**

### **Manager Name**
- **트리거**: `onBlur` (필드를 벗어날 때)
- **조건**: Branch Name이 선택되어 있고, Manager Name이 비어있지 않음

### **Unit Price**
- **트리거**: `onBlur` (필드를 벗어날 때)
- **조건**: Branch Name이 선택되어 있고, Unit Price가 비어있지 않음

### **Currency**
- **트리거**: `onChange` (값을 변경할 때 즉시)
- **조건**: Branch Name이 선택되어 있음

### **Payment Method**
- **트리거**: `onChange` (값을 변경할 때 즉시)
- **조건**: Branch Name이 선택되어 있음

---

## ⚠️ **주의사항**

### **1. Branch Code는 절대 자동 입력 안됨**
- 보안을 위해 **수동 입력만 가능**
- Google Sheets `BranchCodes` 시트는 **검증 전용**

### **2. 자동 저장은 지점별로 관리**
- 각 지점마다 **독립적인 기본값**
- Seoul Branch와 Tokyo Branch는 **다른 기본값** 사용

### **3. 실시간 동기화**
- 한 PC에서 저장 → **다른 PC에서 즉시 로드 가능**
- Google Sheets가 **중앙 DB** 역할

### **4. Add Item 버튼**
- 새 Cost Item 추가 시 **현재 Branch Defaults 적용**
- Unit Price, Currency, Payment Method가 **자동으로 채워짐**

---

## 📝 **최종 체크리스트**

### **필수 작업:**
- [ ] Google Apps Script 코드 업데이트 (Step 2)
- [ ] Apps Script 재배포 (Step 3)
- [ ] Test 1~4 모두 수행
- [ ] Google Sheets에 `BranchDefaults` 시트 생성 확인

### **선택 작업:**
- [ ] BranchDefaults 시트에 실제 지점 데이터 입력
- [ ] BranchCodes 시트에 실제 Branch Code 업데이트

---

## 🎉 **완료!**

**프로덕션 URL:**
```
https://mark4mission.github.io/airzeta-security-fee-app/
```

**GitHub Repository:**
```
https://github.com/Mark4mission/airzeta-security-fee-app
```

**최신 커밋:**
```
feat: Implement branch defaults auto-save for Manager Name, Unit Price, Currency, Payment Method
```

---

**작성일:** 2026-01-27
**버전:** 2.0 - Branch Defaults Auto-Save
