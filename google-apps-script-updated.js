// Google Apps Script for Branch Security Cost Submission System
// This script should be deployed as a Web App

// Configuration
const SHEET_NAME = 'Submissions';
const BRANCH_CODES_SHEET = 'BranchCodes';
const SETTINGS_SHEET = 'Settings';

function doGet(e) {
  try {
    if (!e || !e.parameter) {
      return createJsonResponse({
        status: 'error',
        message: 'No parameters provided'
      });
    }
    
    const params = e.parameter;
    const action = params.action;
    
    // Route to appropriate handler
    switch (action) {
      case 'load':
        return handleLoadRequest(params);
      case 'getSettings':
        return handleGetSettings();
      case 'getBranchCodes':
        return handleGetBranchCodes();
      case 'getHistory':
        return handleGetHistory(params);
      default:
        return createJsonResponse({
          status: 'success',
          message: 'Branch Security Cost API is running',
          timestamp: new Date().toISOString(),
          endpoints: {
            POST: 'Submit new data',
            'GET action=load': 'Load previous data',
            'GET action=getSettings': 'Get settings',
            'GET action=getBranchCodes': 'Get branch codes',
            'GET action=getHistory': 'Get submission history'
          }
        });
    }
  } catch (error) {
    Logger.log('doGet Error: ' + error.toString());
    return createJsonResponse({
      status: 'error',
      message: 'doGet error: ' + error.toString()
    });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        status: 'error',
        message: 'No data received in request'
      });
    }
    
    Logger.log('Received POST request');
    Logger.log('Post data: ' + e.postData.contents);
    
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    // Route to appropriate handler
    switch (action) {
      case 'submit':
        return handleSubmit(data);
      case 'saveSettings':
        return handleSaveSettings(data);
      default:
        return handleSubmit(data); // Default to submit for backward compatibility
    }
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    
    return createJsonResponse({
      status: 'error',
      message: error.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

// Helper function to create JSON response
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// BRANCH CODES HANDLERS
// ========================================

function handleGetBranchCodes() {
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
    
    // Get all branch codes
    const data = codesSheet.getDataRange().getValues();
    const headers = data[0];
    const branchCodes = [];
    
    for (let i = 1; i < data.length; i++) {
      branchCodes.push({
        branchName: data[i][0],
        branchCode: data[i][1]
      });
    }
    
    Logger.log('Returning ' + branchCodes.length + ' branch codes');
    
    return createJsonResponse({
      status: 'success',
      data: branchCodes
    });
  } catch (error) {
    Logger.log('GetBranchCodes error: ' + error.toString());
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

function verifyBranchCode(branchName, branchCode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let codesSheet = ss.getSheetByName(BRANCH_CODES_SHEET);
    
    if (!codesSheet) {
      return true; // Allow if sheet doesn't exist
    }
    
    const data = codesSheet.getDataRange().getValues();
    
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
    return true; // Allow if verification fails
  }
}

// ========================================
// SETTINGS HANDLERS
// ========================================

function handleGetSettings() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
    
    // Create settings sheet if it doesn't exist
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet(SETTINGS_SHEET);
      settingsSheet.appendRow(['Setting Key', 'Setting Value']);
      
      // Add default settings
      const defaultSettings = {
        branchNames: ['Seoul Branch', 'Tokyo Branch', 'New York Branch', 'London Branch', 'Singapore Branch'],
        itemNames: ['Labor Cost', 'Maintenance', 'Equipment', 'Software License', 'Other'],
        currencies: ['KRW', 'USD', 'EUR', 'JPY', 'CNY'],
        paymentMethods: ['Wire Transfer', 'ICH', 'Credit Card', 'Cash']
      };
      
      settingsSheet.appendRow(['branchNames', JSON.stringify(defaultSettings.branchNames)]);
      settingsSheet.appendRow(['itemNames', JSON.stringify(defaultSettings.itemNames)]);
      settingsSheet.appendRow(['currencies', JSON.stringify(defaultSettings.currencies)]);
      settingsSheet.appendRow(['paymentMethods', JSON.stringify(defaultSettings.paymentMethods)]);
      
      Logger.log('Created Settings sheet with default data');
    }
    
    // Read settings
    const data = settingsSheet.getDataRange().getValues();
    const settings = {};
    
    for (let i = 1; i < data.length; i++) {
      const key = data[i][0];
      const value = data[i][1];
      
      try {
        settings[key] = JSON.parse(value);
      } catch (e) {
        settings[key] = value;
      }
    }
    
    Logger.log('Loaded settings: ' + JSON.stringify(settings));
    
    return createJsonResponse({
      status: 'success',
      data: settings
    });
  } catch (error) {
    Logger.log('GetSettings error: ' + error.toString());
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

function handleSaveSettings(data) {
  try {
    if (!data.settings) {
      throw new Error('Missing settings data');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
    
    // Create sheet if doesn't exist
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet(SETTINGS_SHEET);
      settingsSheet.appendRow(['Setting Key', 'Setting Value']);
    }
    
    // Clear existing data (except header)
    if (settingsSheet.getLastRow() > 1) {
      settingsSheet.deleteRows(2, settingsSheet.getLastRow() - 1);
    }
    
    // Write new settings
    const settings = data.settings;
    Object.keys(settings).forEach(key => {
      const value = typeof settings[key] === 'object' 
        ? JSON.stringify(settings[key]) 
        : settings[key];
      settingsSheet.appendRow([key, value]);
    });
    
    Logger.log('Settings saved successfully');
    
    return createJsonResponse({
      status: 'success',
      message: 'Settings saved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('SaveSettings error: ' + error.toString());
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

// ========================================
// SUBMISSION HANDLERS
// ========================================

function handleSubmit(data) {
  try {
    // Validate required fields
    if (!data.header || !data.costItems) {
      throw new Error('Missing required fields: header or costItems');
    }
    
    // Verify branch code
    const isValidCode = verifyBranchCode(data.header.branchName, data.header.branchCode);
    if (!isValidCode) {
      Logger.log('Invalid branch code for: ' + data.header.branchName);
      return createJsonResponse({
        status: 'error',
        message: 'Invalid branch code'
      });
    }
    
    // Get or create the spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
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
    
    return createJsonResponse({
      status: 'success',
      message: 'Data submitted successfully',
      submissionId: submissionId,
      rowsAdded: rowsAdded,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Submit error: ' + error.toString());
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

function handleLoadRequest(params) {
  try {
    const branchName = params.branchName;
    const branchCode = params.branchCode;
    const targetMonth = params.targetMonth;
    
    if (!branchName || !branchCode || !targetMonth) {
      return createJsonResponse({
        status: 'error',
        message: 'Missing required parameters: branchName, branchCode, or targetMonth'
      });
    }
    
    Logger.log('Loading data for: ' + branchName + ', Month: ' + targetMonth);
    
    // Verify branch code
    const isValidCode = verifyBranchCode(branchName, branchCode);
    if (!isValidCode) {
      return createJsonResponse({
        status: 'error',
        message: 'Invalid branch code'
      });
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return createJsonResponse({
        status: 'error',
        message: 'No data sheet found'
      });
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createJsonResponse({
        status: 'success',
        message: 'No previous data found',
        data: null
      });
    }
    
    const headers = data[0];
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
      return createJsonResponse({
        status: 'success',
        message: 'No previous data found',
        data: null
      });
    }
    
    // Get most recent submission
    matchingRows.sort((a, b) => {
      const dateA = new Date(a[colTimestamp]);
      const dateB = new Date(b[colTimestamp]);
      return dateB - dateA;
    });
    
    const submissionId = matchingRows[0][colSubmissionId];
    const submissionRows = matchingRows.filter(row => row[colSubmissionId] === submissionId);
    
    const costItems = submissionRows.map(row => ({
      itemName: row[5] || '',
      unitPrice: row[6] || 0,
      currency: row[7] || 'KRW',
      quantity: row[8] || 0,
      estimatedCost: row[9] || 0,
      actualCost: row[10] || 0,
      basis: row[11] || '',
      paymentMethod: row[12] || '',
      contractFileName: row[13] || '',
      note: row[14] || ''
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
    
    return createJsonResponse({
      status: 'success',
      message: 'Data loaded successfully',
      data: responseData
    });
  } catch (error) {
    Logger.log('Load error: ' + error.toString());
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

function handleGetHistory(params) {
  try {
    const branchName = params.branchName;
    const targetMonth = params.targetMonth;
    
    if (!branchName || !targetMonth) {
      return createJsonResponse({
        status: 'error',
        message: 'Missing required parameters: branchName or targetMonth'
      });
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return createJsonResponse({
        status: 'success',
        data: []
      });
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createJsonResponse({
        status: 'success',
        data: []
      });
    }
    
    const headers = data[0];
    const colBranchName = headers.indexOf('Branch Name');
    const colTargetMonth = headers.indexOf('Target Month');
    const colTimestamp = headers.indexOf('Timestamp');
    const colSubmissionId = headers.indexOf('Submission ID');
    
    // Find all matching submissions
    const submissions = new Map();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[colBranchName] === branchName && row[colTargetMonth] === targetMonth) {
        const submissionId = row[colSubmissionId];
        if (!submissions.has(submissionId)) {
          submissions.set(submissionId, {
            submissionId: submissionId,
            timestamp: row[colTimestamp],
            itemCount: 0
          });
        }
        submissions.get(submissionId).itemCount++;
      }
    }
    
    const historyList = Array.from(submissions.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return createJsonResponse({
      status: 'success',
      data: historyList
    });
  } catch (error) {
    Logger.log('GetHistory error: ' + error.toString());
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

// ========================================
// TEST FUNCTIONS
// ========================================

function testGetBranchCodes() {
  const result = handleGetBranchCodes();
  Logger.log(result.getContent());
}

function testGetSettings() {
  const result = handleGetSettings();
  Logger.log(result.getContent());
}

function testSaveSettings() {
  const testData = {
    action: 'saveSettings',
    settings: {
      branchNames: ['Seoul Branch', 'Tokyo Branch', 'New York Branch'],
      itemNames: ['Labor Cost', 'Maintenance', 'Equipment'],
      currencies: ['KRW', 'USD', 'EUR'],
      paymentMethods: ['Wire Transfer', 'Credit Card']
    }
  };
  
  const result = handleSaveSettings(testData);
  Logger.log(result.getContent());
}
