// Google Apps Script for Branch Security Cost Submission System
// This script should be deployed as a Web App

// Configuration
const SHEET_NAME = 'Submissions'; // Change this to your sheet name
const BRANCH_CODES_SHEET = 'BranchCodes'; // Sheet for branch code verification

function doGet(e) {
  // Handle GET requests (for loading previous data)
  try {
    // Check if parameter exists
    if (!e || !e.parameter) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: 'error',
          message: 'No parameters provided'
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    const params = e.parameter;
    const action = params.action;
    
    if (action === 'load') {
      return handleLoadRequest(params);
    }
    
    // Return API information
    return ContentService.createTextOutput(
      JSON.stringify({
        status: 'success',
        message: 'Branch Security Cost API is running',
        timestamp: new Date().toISOString(),
        endpoints: {
          POST: 'Submit new data',
          GET: 'Load previous data (action=load&branchName=xxx&branchCode=xxx&targetMonth=xxx)'
        }
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('doGet Error: ' + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({
        status: 'error',
        message: 'doGet error: ' + error.toString()
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  // Set CORS headers for response
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    // Check if postData exists
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log('Error: No postData received');
      return output.setContent(JSON.stringify({
        status: 'error',
        message: 'No data received in request'
      }));
    }
    
    // Log received data for debugging
    Logger.log('Received POST request');
    Logger.log('Post data: ' + e.postData.contents);
    
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    
    // Validate required fields
    if (!data.header || !data.costItems) {
      throw new Error('Missing required fields: header or costItems');
    }
    
    // Verify branch code
    const isValidCode = verifyBranchCode(data.header.branchName, data.header.branchCode);
    if (!isValidCode) {
      Logger.log('Invalid branch code for: ' + data.header.branchName);
      return output.setContent(JSON.stringify({
        status: 'error',
        message: 'Invalid branch code'
      }));
    }
    
    // Get or create the spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      // Add headers in English
      sheet.appendRow([
        'Timestamp',
        'Branch Name',
        'Branch Code',
        'Manager Name',
        'Target Month',
        'Item Name',
        'Unit Price',
        'Currency',
        'Quantity',
        'Estimated Cost',
        'Actual Cost',
        'Basis',
        'Payment Method',
        'Contract File Name',
        'Note',
        'Submission ID'
      ]);
      Logger.log('Created new Submissions sheet with headers');
    }
    
    // Generate submission ID
    const submissionId = Utilities.getUuid();
    
    // Add each cost item as a separate row
    let rowsAdded = 0;
    data.costItems.forEach((item, index) => {
      const row = [
        data.timestamp || new Date().toISOString(),
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
    
    Logger.log('Data successfully written to sheet');
    Logger.log('Rows added: ' + rowsAdded);
    
    // Return success response
    return output.setContent(JSON.stringify({
      status: 'success',
      message: 'Data submitted successfully',
      submissionId: submissionId,
      rowsAdded: rowsAdded,
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    
    return output.setContent(JSON.stringify({
      status: 'error',
      message: error.toString(),
      timestamp: new Date().toISOString()
    }));
  }
}

function handleLoadRequest(params) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    // Check if parameters exist
    if (!params) {
      return output.setContent(JSON.stringify({
        status: 'error',
        message: 'No parameters provided'
      }));
    }
    
    const branchName = params.branchName;
    const branchCode = params.branchCode;
    const targetMonth = params.targetMonth;
    
    // Validate parameters
    if (!branchName || !branchCode || !targetMonth) {
      return output.setContent(JSON.stringify({
        status: 'error',
        message: 'Missing required parameters: branchName, branchCode, or targetMonth'
      }));
    }
    
    Logger.log('Loading data for: ' + branchName + ', Month: ' + targetMonth);
    
    // Verify branch code
    const isValidCode = verifyBranchCode(branchName, branchCode);
    if (!isValidCode) {
      Logger.log('Invalid branch code for load request');
      return output.setContent(JSON.stringify({
        status: 'error',
        message: 'Invalid branch code'
      }));
    }
    
    // Get the spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return output.setContent(JSON.stringify({
        status: 'error',
        message: 'No data sheet found'
      }));
    }
    
    // Get all data
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return output.setContent(JSON.stringify({
        status: 'success',
        message: 'No previous data found',
        data: null
      }));
    }
    
    const headers = data[0];
    
    // Find column indices
    const colBranchName = headers.indexOf('Branch Name');
    const colBranchCode = headers.indexOf('Branch Code');
    const colTargetMonth = headers.indexOf('Target Month');
    const colManagerName = headers.indexOf('Manager Name');
    const colTimestamp = headers.indexOf('Timestamp');
    const colSubmissionId = headers.indexOf('Submission ID');
    
    // Find matching rows
    const matchingRows = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[colBranchName] === branchName && 
          row[colBranchCode] === branchCode && 
          row[colTargetMonth] === targetMonth) {
        matchingRows.push(row);
      }
    }
    
    if (matchingRows.length === 0) {
      return output.setContent(JSON.stringify({
        status: 'success',
        message: 'No previous data found',
        data: null
      }));
    }
    
    Logger.log('Found ' + matchingRows.length + ' matching rows');
    
    // Get the most recent submission (by timestamp)
    matchingRows.sort((a, b) => {
      const dateA = new Date(a[colTimestamp]);
      const dateB = new Date(b[colTimestamp]);
      return dateB - dateA; // Most recent first
    });
    
    // Group by submission ID (use the most recent)
    const submissionId = matchingRows[0][colSubmissionId];
    const submissionRows = matchingRows.filter(row => row[colSubmissionId] === submissionId);
    
    // Build cost items array
    const costItems = submissionRows.map(row => ({
      itemName: row[5] || '',        // Item Name
      unitPrice: row[6] || 0,         // Unit Price
      currency: row[7] || 'KRW',      // Currency
      quantity: row[8] || 0,          // Quantity
      estimatedCost: row[9] || 0,     // Estimated Cost
      actualCost: row[10] || 0,       // Actual Cost
      basis: row[11] || '',           // Basis
      paymentMethod: row[12] || '',   // Payment Method
      contractFileName: row[13] || '', // Contract File Name
      note: row[14] || ''             // Note
    }));
    
    const responseData = {
      header: {
        branchName: submissionRows[0][colBranchName],
        managerName: submissionRows[0][colManagerName],
        targetMonth: submissionRows[0][colTargetMonth]
      },
      costItems: costItems,
      timestamp: submissionRows[0][colTimestamp]
    };
    
    Logger.log('Returning data with ' + costItems.length + ' items');
    
    return output.setContent(JSON.stringify({
      status: 'success',
      message: 'Data loaded successfully',
      data: responseData
    }));
    
  } catch (error) {
    Logger.log('Load error: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    
    return output.setContent(JSON.stringify({
      status: 'error',
      message: error.toString()
    }));
  }
}

function verifyBranchCode(branchName, branchCode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let codesSheet = ss.getSheetByName(BRANCH_CODES_SHEET);
    
    // Create codes sheet if it doesn't exist
    if (!codesSheet) {
      codesSheet = ss.insertSheet(BRANCH_CODES_SHEET);
      codesSheet.appendRow(['Branch Name', 'Branch Code']);
      // Add sample data
      codesSheet.appendRow(['Seoul Branch', 'SEOUL2024']);
      codesSheet.appendRow(['Tokyo Branch', 'TOKYO2024']);
      codesSheet.appendRow(['New York Branch', 'NYC2024']);
      codesSheet.appendRow(['London Branch', 'LONDON2024']);
      codesSheet.appendRow(['Singapore Branch', 'SING2024']);
      Logger.log('Created BranchCodes sheet with sample data');
    }
    
    // Get all codes
    const data = codesSheet.getDataRange().getValues();
    
    // Check if branch code matches
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === branchName && data[i][1] === branchCode) {
        Logger.log('Branch code verified for: ' + branchName);
        return true;
      }
    }
    
    Logger.log('Branch code verification failed for: ' + branchName);
    return false;
  } catch (error) {
    Logger.log('Verification error: ' + error.toString());
    // If verification fails, allow (for testing)
    return true;
  }
}

// Test function - run this in Apps Script editor to test
function testDoPost() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        header: {
          branchName: "Seoul Branch",
          branchCode: "SEOUL2024",
          managerName: "Test Manager",
          targetMonth: "2026-01"
        },
        costItems: [{
          itemName: "Labor Cost",
          unitPrice: 1000,
          currency: "KRW",
          quantity: 22,
          estimatedCost: 22000,
          actualCost: 22000,
          basis: "Test basis",
          paymentMethod: "Wire Transfer",
          contractFileName: "",
          note: "Test"
        }],
        timestamp: new Date().toISOString()
      })
    }
  };
  
  const result = doPost(testData);
  Logger.log(result.getContent());
}

function testDoGet() {
  const testData = {
    parameter: {
      action: 'load',
      branchName: 'Seoul Branch',
      branchCode: 'SEOUL2024',
      targetMonth: '2026-01'
    }
  };
  
  const result = doGet(testData);
  Logger.log(result.getContent());
}
