// Configuration
const SHEET_NAME = 'Submissions';
const BRANCH_CODES_SHEET = 'BranchCodes';

function doGet(e) {
  const lock = LockService.getScriptLock();
  
  if (!lock.tryLock(30000)) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Server is busy. Please try again.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const action = e.parameter.action;
    const submissionId = e.parameter.submissionId;
    
    if (action !== 'load' && !submissionId) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Missing Submission ID'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions');
    if (!sheet) throw new Error("'Submissions' sheet not found");

    if (action === 'load') {
      const branchName = e.parameter.branchName;
      const targetMonth = e.parameter.targetMonth; // 예: "2026-02"
      
      const data = sheet.getDataRange().getValues();
      
      // [수정된 부분] 강력한 비교 로직 적용
      const matchingRows = data.slice(1).filter(row => {
        // 1. 지점명 비교 (공백 제거 후 비교)
        const sheetBranch = String(row[1]).trim();
        const inputBranch = String(branchName).trim();

        // 2. 날짜 비교 (Date 객체일 경우와 문자열일 경우 모두 처리)
        let sheetMonth = row[4]; // E열
        
        // 만약 시트의 데이터가 날짜(Date) 객체라면 "yyyy-MM" 문자로 변환
        if (sheetMonth instanceof Date) {
          try {
            // 시간대 문제 방지를 위해 간단한 포맷팅 사용
            const year = sheetMonth.getFullYear();
            const month = String(sheetMonth.getMonth() + 1).padStart(2, '0');
            sheetMonth = `${year}-${month}`;
          } catch (err) {
            // 변환 실패 시 원본 유지
          }
        }
        
        // 문자열로 확실히 변환 후 공백 제거
        const sheetMonthStr = String(sheetMonth).trim();
        const inputMonthStr = String(targetMonth).trim();

        // 로그 확인용 (디버깅 필요시 주석 해제)
        // console.log(`Comp: ${sheetBranch} vs ${inputBranch}, ${sheetMonthStr} vs ${inputMonthStr}`);

        return sheetBranch === inputBranch && sheetMonthStr === inputMonthStr;
      });

      if (matchingRows.length === 0) {
        return createSuccessResponse(null);
      }

      const firstRow = matchingRows[0];
      const headerInfo = {
        branchName: firstRow[1],
        branchCode: firstRow[2],
        managerName: firstRow[3],
        targetMonth: targetMonth // 입력받은 값 그대로 반환 (포맷 일관성 유지)
      };

      const costItems = matchingRows.map((row, index) => ({
        id: Date.now() + index,
        itemName: row[5],
        unitPrice: row[6],
        currency: row[7],
        quantity: row[8],
        estimatedCost: row[9],
        actualCost: row[10],
        basis: row[11],
        paymentMethod: row[12],
        contractFileName: row[13],
        note: row[14] || ''
      }));
      
      return createSuccessResponse({
        header: headerInfo,
        costItems: costItems
      });
    }

    return createSuccessResponse({ message: "Action completed" });

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Server Error: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function createSuccessResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    data: data
  })).setMimeType(ContentService.MimeType.JSON);
}

// 헬퍼 함수
function createSuccessResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    data: data
  })).setMimeType(ContentService.MimeType.JSON);
}

// 헬퍼 함수
function createSuccessResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    data: data
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    if (!e || !e.postData) return output.setContent(JSON.stringify({ status: 'error', message: 'No data' }));
    
    const data = JSON.parse(e.postData.contents);
    
    // [수정] 브랜치 코드 검증 로직 강화
    // 검증 실패 시 즉시 return으로 함수를 종료시켜서 "성공" 메시지가 나가지 않도록 함
    if (!verifyBranchCode(data.header.branchName, data.header.branchCode)) {
      return output.setContent(JSON.stringify({
        status: 'error',
        message: 'Invalid Branch Code: 지점명과 코드가 일치하지 않습니다.'
      }));
    }

    // 시트 저장 로직
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['Timestamp', 'Branch Name', 'Branch Code', 'Manager Name', 'Target Month', 'Item Name', 'Unit Price', 'Currency', 'Quantity', 'Estimated Cost', 'Actual Cost', 'Basis', 'Payment Method', 'Contract File Name', 'Note', 'Submission ID']);
    }

    const submissionId = data.submissionId || Utilities.getUuid(); // 기존 ID가 있으면(수정 시) 유지, 없으면 생성
    const timestamp = new Date().toISOString();

    // 기존 데이터 수정인 경우, 이전 데이터를 찾아서 지우거나 덮어쓰는 로직이 복잡하므로
    // 여기서는 간단히 "새로운 행 추가"로 처리합니다. (실제 운영 시에는 기존 ID 행 삭제 로직 추가 권장)
    
    let rowsAdded = 0;
    data.costItems.forEach((item) => {
      const row = [
        timestamp,
        data.header.branchName,
        data.header.branchCode,
        data.header.managerName,
        data.header.targetMonth,
        item.itemName || '',
        item.unitPrice || 0,
        item.currency || 'KRW',
        item.quantity || 0,
        item.estimatedCost || 0,
        item.actualCost || 0,
        item.basis || '',
        item.paymentMethod || '',
        item.contractFileName || '',
        item.note || '',
        submissionId
      ];
      sheet.appendRow(row);
      rowsAdded++;
    });

    return output.setContent(JSON.stringify({
      status: 'success',
      message: 'Data submitted successfully',
      submissionId: submissionId
    }));

  } catch (error) {
    return output.setContent(JSON.stringify({ status: 'error', message: error.toString() }));
  }
}

// [신규 기능] 해당 지점의 제출 내역 리스트 반환
function handleGetList(params) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  const branchName = params.branchName;
  const branchCode = params.branchCode;

  // 1. 코드 검증
  if (!verifyBranchCode(branchName, branchCode)) {
    return output.setContent(JSON.stringify({ status: 'error', message: 'Invalid Branch Code' }));
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return output.setContent(JSON.stringify({ status: 'success', data: [] }));

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colBranchName = headers.indexOf('Branch Name');
  const colTargetMonth = headers.indexOf('Target Month');
  const colSubmissionId = headers.indexOf('Submission ID');
  const colTimestamp = headers.indexOf('Timestamp');

  // 중복 제거를 위한 Set (하나의 제출건에 여러 품목이 있으므로 ID로 그룹화)
  const submissionSet = new Set();
  const list = [];

  // 최신순으로 순회하기 위해 뒤에서부터 탐색
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    if (String(row[colBranchName]) === String(branchName)) {
      const subId = row[colSubmissionId];
      
      // 이미 리스트에 넣은 ID면 패스
      if (!submissionSet.has(subId)) {
        submissionSet.add(subId);
        list.push({
          submissionId: subId,
          targetMonth: row[colTargetMonth],
          timestamp: row[colTimestamp],
          displayDate: new Date(row[colTimestamp]).toLocaleDateString() + " (" + row[colTargetMonth] + ")"
        });
      }
    }
  }

  return output.setContent(JSON.stringify({
    status: 'success',
    data: list
  }));
}

// [수정 기능] ID로 정확하게 데이터 불러오기
function handleLoadRequest(params) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  const submissionId = params.submissionId; // 이제 ID로 찾습니다

  if (action !== 'load' && !submissionId) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Missing Submission ID'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colSubmissionId = headers.indexOf('Submission ID');

  // ID가 일치하는 모든 행(품목들)을 찾음
  const matchingRows = data.filter((row, index) => index > 0 && row[colSubmissionId] === submissionId);

  if (matchingRows.length === 0) {
    return output.setContent(JSON.stringify({ status: 'error', message: 'Data not found' }));
  }

  // 데이터 조립 (헤더 정보는 첫 번째 행에서 가져옴)
  const firstRow = matchingRows[0];
  const costItems = matchingRows.map(row => ({
    itemName: row[5],
    unitPrice: row[6],
    currency: row[7],
    quantity: row[8],
    estimatedCost: row[9],
    actualCost: row[10],
    basis: row[11],
    paymentMethod: row[12],
    contractFileName: row[13],
    note: row[14]
  }));

  const responseData = {
    header: {
      branchName: firstRow[1],
      branchCode: firstRow[2], // 보안상 마스킹할 수도 있음
      managerName: firstRow[3],
      targetMonth: firstRow[4]
    },
    costItems: costItems,
    timestamp: firstRow[0],
    submissionId: submissionId
  };

  return output.setContent(JSON.stringify({
    status: 'success',
    data: responseData
  }));
}

// [검증 함수] - 문자열/숫자 자동 변환 및 공백 제거 적용
function verifyBranchCode(branchName, branchCode) {
  if (!branchName || !branchCode) return false;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let codesSheet = ss.getSheetByName(BRANCH_CODES_SHEET);
    if (!codesSheet) {
      codesSheet = ss.insertSheet(BRANCH_CODES_SHEET);
      codesSheet.appendRow(['Branch Name', 'Branch Code']);
    }
    
    const data = codesSheet.getDataRange().getValues();
    const inputName = String(branchName).trim();
    const inputCode = String(branchCode).trim();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === inputName && String(data[i][1]).trim() === inputCode) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}