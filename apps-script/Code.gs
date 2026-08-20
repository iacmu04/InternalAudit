/**
 * Google Apps Script Backend for Internal Audit Tracking & Extension System
 * Spreadsheet ID: 1DsRayuheR7DUA-Zd4S8tCffAsl5C_o4s078HcJc0rKw
 */

const SPREADSHEET_ID = "1DsRayuheR7DUA-Zd4S8tCffAsl5C_o4s078HcJc0rKw";

function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {
    // Fallback if standalone
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// Helper test function to run directly in Apps Script Editor for granting permissions
function testRunAuthorization() {
  const ss = getSpreadsheet();
  Logger.log("Successfully connected to sheet: " + ss.getName());
  return getAllData(ss);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getInitialData";
  let responseData = {};

  try {
    const ss = getSpreadsheet();
    
    if (action === "getInitialData") {
      responseData = getAllData(ss);
    } else if (action === "getUserRole") {
      const email = e.parameter.email || Session.getActiveUser().getEmail();
      responseData = checkUserPermission(ss, email);
    } else {
      responseData = getAllData(ss);
    }
  } catch (err) {
    responseData = { 
      status: "error", 
      message: err.toString(),
      hint: "หากพบข้อผิดพลาดสิทธิ์สเปรดชีต ให้เลือกฟังก์ชัน testRunAuthorization แล้วกด Run ใน Apps Script Editor เพื่ออนุมัติสิทธิ์ (Grant Access)"
    };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let responseData = {};
  
  try {
    const ss = getSpreadsheet();
    let contents = {};
    
    if (e && e.postData && e.postData.contents) {
      try {
        contents = JSON.parse(e.postData.contents);
      } catch (pErr) {
        contents = e.parameter || {};
      }
    } else if (e && e.parameter) {
      contents = e.parameter;
    }

    const action = contents.action;

    if (action === "saveAuditEntry") {
      responseData = saveAuditEntry(ss, contents.data);
    } else if (action === "updateAuditEntry") {
      responseData = updateAuditEntry(ss, contents.rowIndex, contents.data);
    } else if (action === "submitExtension") {
      responseData = submitExtension(ss, contents.data);
    } else if (action === "processApproval") {
      responseData = processApproval(ss, contents.id, contents.status, contents.comment, contents.userEmail, contents.userRole, contents.approvedDays);
    } else if (action === "cancelExtension") {
      responseData = cancelExtension(ss, contents.id, contents.userEmail);
    } else if (action === "resubmitExtension") {
      responseData = resubmitExtension(ss, contents.id, contents.data);
    } else if (action === "addDepartment") {
      responseData = addDepartmentToMaster(ss, contents.departmentName);
    } else if (action === "deleteAuditEntry") {
      responseData = deleteAuditEntry(ss, contents.rowIndex);
    } else if (action === "saveNonAuditDays") {
      saveNonAuditDaysForDept(ss, contents.departmentName || contents.data && contents.data["ส่วนงาน"], contents.nonAuditDays || contents.data && contents.data.nonAuditDays);
      responseData = { status: "success", message: "บันทึกวันที่ไม่ได้ปฏิบัติงานเรียบร้อยแล้ว" };
    } else {
      responseData = { status: "error", message: "Unknown action: " + action };
    }
  } catch (err) {
    responseData = { 
      status: "error", 
      message: err.toString(),
      hint: "หากพบข้อผิดพลาดสิทธิ์สเปรดชีต ให้เลือกฟังก์ชัน testRunAuthorization แล้วกด Run ใน Apps Script Editor เพื่ออนุมัติสิทธิ์ (Grant Access)"
    };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAllData(ss) {
  if (!ss) ss = getSpreadsheet();
  ensureSheets(ss);
  
  const mainAuditSheet = ss.getSheetByName("Main_Audit");
  const delaySheet = ss.getSheetByName("Delay");
  const usersSheet = ss.getSheetByName("Users");
  const masterSheet = ss.getSheetByName("Master_Lists");
  const holidaysSheet = ss.getSheetByName("Thai_Holidays") || ss.getSheetByName("Holidays");
  const nonAuditSheet = ss.getSheetByName("Non_Audit_Days");

  return {
    status: "success",
    mainAudit: readSheetData(mainAuditSheet),
    delay: readSheetData(delaySheet),
    users: readSheetData(usersSheet),
    masterLists: readSheetData(masterSheet),
    holidays: holidaysSheet ? readSheetData(holidaysSheet) : [],
    nonAuditDays: readSheetData(nonAuditSheet)
  };
}

function readSheetData(sheet) {
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h).trim());
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const rowObj = { _rowIndex: i + 1, _headers: headers };
    let hasVal = false;
    for (let j = 0; j < headers.length; j++) {
      let val = values[i][j];
      if (val instanceof Date) {
        val = formatDate(val);
      }
      rowObj[`_col${j}`] = val;
      const keyName = headers[j] || `col_${j}`;
      if (rowObj[keyName] === undefined) {
        rowObj[keyName] = val;
      }
      if (val !== "") hasVal = true;
    }
    if (hasVal) rows.push(rowObj);
  }
  return rows;
}

function formatDate(date) {
  if (!date) return "";
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const str = String(date).trim();
  if (!str) return "";

  // Check if already YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    let y = parseInt(isoMatch[1]);
    if (y > 2400) y -= 543; // Convert BE to CE
    const m = String(isoMatch[2]).padStart(2, "0");
    const d = String(isoMatch[3]).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Check if DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, "0");
    const m = String(dmyMatch[2]).padStart(2, "0");
    let y = parseInt(dmyMatch[3]);
    if (y > 2400) y -= 543;
    return `${y}-${m}-${d}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return str;
}

function checkUserPermission(ss, email) {
  if (!ss) ss = getSpreadsheet();
  const users = readSheetData(ss.getSheetByName("Users"));
  const user = users.find(u => String(u["Email"] || u["Email amornrath.f@gmail.com"] || u.email || "").toLowerCase().trim() === String(email).toLowerCase().trim());
  
  if (!user) {
    return { status: "denied", message: "อีเมลของคุณไม่มีสิทธิ์เข้าใช้งานระบบ กรุณาติดต่อผู้ดูแลระบบ" };
  }

  return {
    status: "granted",
    user: {
      email: email,
      name: user["Name"] || user["Name Pui"] || user.name || email,
      role: user["Role"] || user["Role Admin"] || user.role || "User",
      team: user["Team"] || user["Team ทุกทีม"] || user.team || "",
      authorize: user["Authorize"] || user["Authorize all"] || user.authorize || ""
    }
  };
}

function saveAuditEntry(ss, data) {
  if (!ss) ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Main_Audit");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  
  // Prevent duplicate rows for the same department and fiscal year
  const existingRows = readSheetData(sheet);
  const deptTarget = String(data["ส่วนงาน"] || "").trim().toLowerCase();
  const yearTarget = String(data["ปีงบประมาณ"] || "").trim();
  
  const existingRow = existingRows.find(r => 
    String(r["ส่วนงาน"] || "").trim().toLowerCase() === deptTarget &&
    String(r["ปีงบประมาณ"] || "").trim() === yearTarget
  );

  if (existingRow && existingRow._rowIndex) {
    return updateAuditEntry(ss, existingRow._rowIndex, data);
  }

  const approvedExtDays = getApprovedExtensionDaysForDept(ss, data["ส่วนงาน"]);

  let plannedDays = -1;
  if (data["ระยะเวลาตรวจสอบตามแผน"] !== undefined && data["ระยะเวลาตรวจสอบตามแผน"] !== "") {
    plannedDays = Number(data["ระยะเวลาตรวจสอบตามแผน"]);
  } else {
    plannedDays = calculateDaysDiff(data["วันที่เริ่มตรวจสอบ"], data["วันที่สิ้นสุดการตรวจสอบ"]);
  }

  let actualDays = -1;
  if (data["ระยะเวลาตรวจจริง (วัน)"] !== undefined && data["ระยะเวลาตรวจจริง (วัน)"] !== "") {
    actualDays = Number(data["ระยะเวลาตรวจจริง (วัน)"]);
  } else if (data["ระยะเวลาตรวจจริง"] !== undefined && data["ระยะเวลาตรวจจริง"] !== "") {
    actualDays = Number(data["ระยะเวลาตรวจจริง"]);
  } else if (plannedDays >= 0) {
    actualDays = Math.max(plannedDays + approvedExtDays, 0);
  }

  let durPresident = -1;
  if (data["ระยะเวลาเสนออธิการบดี"] !== undefined && data["ระยะเวลาเสนออธิการบดี"] !== "") {
    durPresident = Number(data["ระยะเวลาเสนออธิการบดี"]);
  } else {
    durPresident = calculateDaysDiff(data["วันที่ปิดตรวจ"], data["วันที่เสนออธิการบดี_รายงาน"]);
  }

  let durCts = -1;
  if (data["ระยะเวลาเสนอ_คตส"] !== undefined && data["ระยะเวลาเสนอ_คตส"] !== "") {
    durCts = Number(data["ระยะเวลาเสนอ_คตส"]);
  } else if (data["ระยะเวลาเสนอ คตส."] !== undefined && data["ระยะเวลาเสนอ คตส."] !== "") {
    durCts = Number(data["ระยะเวลาเสนอ คตส."]);
  } else {
    durCts = calculateDaysDiff(data["วันที่ปิดตรวจ"], data["วันที่เสนอ_คตส"]);
  }

  if (plannedDays >= 0) {
    data["ระยะเวลาตรวจสอบตามแผน"] = plannedDays;
  }
  if (actualDays >= 0) {
    data["ระยะเวลาจริงในการตรวจสอบ"] = actualDays;
    data["ระยะเวลาตรวจจริง"] = actualDays;
    data["ระยะเวลาตรวจจริง (วัน)"] = actualDays;
    data["ระยะเวลาจริงในการตรวจสอบ (วัน)"] = actualDays;
  }
  if (durPresident >= 0) {
    data["ระยะเวลาเสนออธิการบดี"] = durPresident;
  }
  if (durCts >= 0) {
    data["ระยะเวลาเสนอ_คตส"] = durCts;
    data["ระยะเวลาเสนอ คตส."] = durCts;
    data["ระยะเวลาเสนอคตส."] = durCts;
    data["ระยะเวลาเสนอรายงานคตส."] = durCts;
  }

  const row = headers.map(h => data[h] !== undefined ? data[h] : "");
  sheet.appendRow(row);

  if (data["ส่วนงาน"]) {
    addDepartmentToMaster(ss, data["ส่วนงาน"]);
  }

  // Save non-audit days if provided
  if (data.nonAuditDays !== undefined && data["ส่วนงาน"]) {
    saveNonAuditDaysForDept(ss, data["ส่วนงาน"], data.nonAuditDays);
  }

  return { status: "success", message: "บันทึกข้อมูลลง Google Sheet เรียบร้อยแล้ว" };
}

function updateAuditEntry(ss, rowIndex, data) {
  if (!ss) ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Main_Audit");
  if (!rowIndex || rowIndex < 2) return { status: "error", message: "Invalid row index" };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());

  const approvedExtDays = getApprovedExtensionDaysForDept(ss, data["ส่วนงาน"]);

  let plannedDays = -1;
  if (data["ระยะเวลาตรวจสอบตามแผน"] !== undefined && data["ระยะเวลาตรวจสอบตามแผน"] !== "") {
    plannedDays = Number(data["ระยะเวลาตรวจสอบตามแผน"]);
  } else {
    plannedDays = calculateDaysDiff(data["วันที่เริ่มตรวจสอบ"], data["วันที่สิ้นสุดการตรวจสอบ"]);
  }

  let actualDays = -1;
  if (data["ระยะเวลาตรวจจริง (วัน)"] !== undefined && data["ระยะเวลาตรวจจริง (วัน)"] !== "") {
    actualDays = Number(data["ระยะเวลาตรวจจริง (วัน)"]);
  } else if (data["ระยะเวลาตรวจจริง"] !== undefined && data["ระยะเวลาตรวจจริง"] !== "") {
    actualDays = Number(data["ระยะเวลาตรวจจริง"]);
  } else if (plannedDays >= 0) {
    actualDays = Math.max(plannedDays + approvedExtDays, 0);
  }

  let durPresident = -1;
  if (data["ระยะเวลาเสนออธิการบดี"] !== undefined && data["ระยะเวลาเสนออธิการบดี"] !== "") {
    durPresident = Number(data["ระยะเวลาเสนออธิการบดี"]);
  } else {
    durPresident = calculateDaysDiff(data["วันที่ปิดตรวจ"], data["วันที่เสนออธิการบดี_รายงาน"]);
  }

  let durCts = -1;
  if (data["ระยะเวลาเสนอ_คตส"] !== undefined && data["ระยะเวลาเสนอ_คตส"] !== "") {
    durCts = Number(data["ระยะเวลาเสนอ_คตส"]);
  } else if (data["ระยะเวลาเสนอ คตส."] !== undefined && data["ระยะเวลาเสนอ คตส."] !== "") {
    durCts = Number(data["ระยะเวลาเสนอ คตส."]);
  } else {
    durCts = calculateDaysDiff(data["วันที่ปิดตรวจ"], data["วันที่เสนอ_คตส"]);
  }

  if (plannedDays >= 0) {
    data["ระยะเวลาตรวจสอบตามแผน"] = plannedDays;
  }
  if (actualDays >= 0) {
    data["ระยะเวลาจริงในการตรวจสอบ"] = actualDays;
    data["ระยะเวลาตรวจจริง"] = actualDays;
    data["ระยะเวลาตรวจจริง (วัน)"] = actualDays;
    data["ระยะเวลาจริงในการตรวจสอบ (วัน)"] = actualDays;
  }
  if (durPresident >= 0) {
    data["ระยะเวลาเสนออธิการบดี"] = durPresident;
  }
  if (durCts >= 0) {
    data["ระยะเวลาเสนอ_คตส"] = durCts;
    data["ระยะเวลาเสนอ คตส."] = durCts;
    data["ระยะเวลาเสนอคตส."] = durCts;
    data["ระยะเวลาเสนอรายงานคตส."] = durCts;
  }

  const rowValues = headers.map(h => data[h] !== undefined ? data[h] : "");
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);

  // Save non-audit days if provided
  if (data.nonAuditDays !== undefined && data["ส่วนงาน"]) {
    saveNonAuditDaysForDept(ss, data["ส่วนงาน"], data.nonAuditDays);
  }

  return { status: "success", message: "แก้ไขข้อมูลใน Google Sheet เรียบร้อยแล้ว" };
}

function deleteAuditEntry(ss, rowIndex) {
  if (!ss) ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Main_Audit");
  const row = parseInt(rowIndex);
  if (row >= 2 && row <= sheet.getLastRow()) {
    const deptName = sheet.getRange(row, 1).getValue(); // Col A: ส่วนงาน
    sheet.deleteRow(row);
    if (deptName) {
      saveNonAuditDaysForDept(ss, deptName, []);
    }
    return { status: "success", message: "ลบรายการออกจาก Google Sheet เรียบร้อยแล้ว" };
  }
  return { status: "error", message: "ไม่พบตำแหน่งแถวที่ต้องการลบ" };
}

function saveNonAuditDaysForDept(ss, deptName, nonAuditDays) {
  if (!ss) ss = getSpreadsheet();
  if (!deptName) return;
  
  ensureSheets(ss);
  let sheet = ss.getSheetByName("Non_Audit_Days");
  if (!sheet) {
    sheet = ss.insertSheet("Non_Audit_Days");
    sheet.appendRow(["วันที่", "ประเภท", "ส่วนงาน", "สาเหตุ/หมายเหตุ"]);
  }

  // If passed as string, parse it
  if (typeof nonAuditDays === "string") {
    try {
      nonAuditDays = JSON.parse(nonAuditDays);
    } catch(e) {}
  }

  const deptTarget = String(deptName).trim().toLowerCase();
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 4);

  // Read existing headers or initialize
  let headers = [];
  if (lastRow >= 1) {
    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  }
  if (headers.length === 0 || !headers.some(h => h.includes("ส่วนงาน") || h.toLowerCase().includes("department"))) {
    headers = ["วันที่", "ประเภท", "ส่วนงาน", "สาเหตุ/หมายเหตุ"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // Find column index of "ส่วนงาน" (0-indexed)
  let deptColIdx = headers.findIndex(h => h.includes("ส่วนงาน") || h.toLowerCase().includes("department"));
  if (deptColIdx === -1) deptColIdx = 2;

  // 1. Delete existing rows for this department (from bottom to top)
  if (lastRow >= 2) {
    const dataVals = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (let i = dataVals.length - 1; i >= 0; i--) {
      const rDept = String(dataVals[i][deptColIdx] || dataVals[i][2] || dataVals[i][0] || "").trim().toLowerCase();
      if (rDept === deptTarget) {
        sheet.deleteRow(i + 2);
      }
    }
  }

  // 2. Append new rows
  if (Array.isArray(nonAuditDays) && nonAuditDays.length > 0) {
    nonAuditDays.forEach(entry => {
      if (!entry) return;
      const rawDate = entry.date || entry["วันที่"] || "";
      if (!rawDate) return;
      
      const dateStr = formatDate(rawDate) || String(rawDate);
      const reason = entry.reason || entry["ประเภท"] || entry["สาเหตุ/หมายเหตุ"] || "ติดประชุมมหาวิทยาลัย";
      const details = entry.details || entry["รายละเอียด"] || entry["สาเหตุ/หมายเหตุ"] || reason;

      const rowValues = headers.map(h => {
        const hNorm = h.toLowerCase().trim();
        if (hNorm.includes("วันที่") || hNorm === "date") return dateStr;
        if (hNorm.includes("ส่วนงาน") || hNorm === "department") return deptName;
        if (hNorm.includes("ประเภท") || hNorm === "type") return reason;
        if (hNorm.includes("สาเหตุ") || hNorm.includes("หมายเหตุ") || hNorm.includes("รายละเอียด") || hNorm === "reason" || hNorm === "details") return details;
        return "";
      });

      sheet.appendRow(rowValues);
    });
  }
}

function getApprovedExtensionDaysForDept(ss, deptName) {
  if (!deptName) return 0;
  const delaySheet = ss.getSheetByName("Delay");
  if (!delaySheet) return 0;

  const values = delaySheet.getDataRange().getValues();
  if (values.length < 2) return 0;

  const deptClean = String(deptName).trim().toLowerCase();
  let sum = 0;

  for (let i = 1; i < values.length; i++) {
    const rDept = String(values[i][3] || "").trim().toLowerCase(); // Col D: Department
    const deanStatus = String(values[i][11] || values[i][8] || "").trim(); // Col L / Col I: DeanStatus/Status
    if (rDept === deptClean && (deanStatus === "อนุมัติ" || deanStatus === "อนุมัติแล้ว")) {
      const days = parseInt(values[i][6]) || 0; // Col G: Total number of days
      sum += days;
    }
  }
  return sum;
}

function countNonAuditDaysForDept(ss, deptName) {
  if (!deptName) return 0;
  const nonAuditSheet = ss.getSheetByName("Non_Audit_Days");
  if (!nonAuditSheet) return 0;

  const values = nonAuditSheet.getDataRange().getValues();
  if (values.length < 2) return 0;

  const deptClean = String(deptName).trim().toLowerCase();
  let count = 0;

  for (let i = 1; i < values.length; i++) {
    const rDept = String(values[i][2] || "").trim().toLowerCase(); // Col C: ส่วนงาน
    if (rDept === deptClean || rDept === "ทั้งหมด") {
      count++;
    }
  }
  return count;
}

function calculateDaysDiff(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return -1;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start) || isNaN(end) || start > end) return -1;
  const ms = 1000 * 60 * 60 * 24;
  return Math.round((end - start) / ms);
}

function addDepartmentToMaster(ss, deptName) {
  if (!ss) ss = getSpreadsheet();
  if (!deptName) return { status: "ignored" };
  const masterSheet = ss.getSheetByName("Master_Lists");
  if (!masterSheet) return { status: "ignored" };

  const values = masterSheet.getRange(2, 1, Math.max(masterSheet.getLastRow() - 1, 1), 1).getValues();
  const existing = values.map(r => String(r[0]).trim().toLowerCase());
  
  if (!existing.includes(String(deptName).trim().toLowerCase())) {
    masterSheet.appendRow([deptName, "", ""]);
  }
  return { status: "success" };
}

function submitExtension(ss, data) {
  if (!ss) ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Delay");
  const nowStr = formatDate(new Date());
  
  // Columns A-N schema:
  // A: Timestamp (1), B: Requestor (2), C: Email (3), D: Department (4), E: Start Date (5), F: End Date (6),
  // G: Total number of days (7) -> Initially blank (""), calculated and saved ONLY when Dean approves
  // H: Reason (8), I: Leader (9), J: LeaderStatus (10), K: LeaderDate (11),
  // L: DeanStatus (12), M: DeanDate (13), N: Remarks (14)
  const newRow = [
    nowStr,
    data.requestorName || "",
    data.requestorEmail || "",
    data.department || "",
    data.startDate || "",
    data.endDate || "",
    "", // Col G: Leave empty on submit, only filled when Dean approves
    data.reason || "",
    data.supervisorName || "",
    "รอพิจารณา",
    "",
    "-",
    "",
    ""
  ];

  sheet.appendRow(newRow);
  return { status: "success", message: "ส่งคำขอขยายเวลาลง Google Sheet เรียบร้อยแล้ว" };
}

function processApproval(ss, id, status, comment, userEmail, userRole, approvedDays) {
  if (!ss) ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Delay");
  const values = sheet.getDataRange().getValues();
  const nowStr = formatDate(new Date());

  let targetRow = -1;
  if (typeof id === 'number' && id >= 2) {
    targetRow = id;
  } else {
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id || (values[i][2] === userEmail && values[i][7] === comment)) {
        targetRow = i + 1;
        break;
      }
    }
  }

  if (targetRow === -1) return { status: "error", message: "ไม่พบรายการคำขอ" };

  let actionResult = "";
  if (userRole === "Leader" || userRole === "Admin") {
    if (status === "approved") {
      sheet.getRange(targetRow, 10).setValue("ผ่านพิจารณา"); // Col J: LeaderStatus
      sheet.getRange(targetRow, 11).setValue(nowStr);       // Col K: LeaderDate
      sheet.getRange(targetRow, 12).setValue("รออนุมัติ");  // Col L: DeanStatus
      actionResult = "ผ่านพิจารณาเสนอ ผอ.";
    } else if (status === "rejected") {
      sheet.getRange(targetRow, 10).setValue("ตีกลับ");      // Col J: LeaderStatus
      sheet.getRange(targetRow, 11).setValue(nowStr);       // Col K: LeaderDate
      sheet.getRange(targetRow, 12).setValue("-");          // Col L: DeanStatus
      actionResult = "ตีกลับคำขอ";
    }
  } 
  
  if (userRole === "Dean" || (userRole === "Admin" && (status === "approved" || status === "rejected") && (sheet.getRange(targetRow, 12).getValue() === "รออนุมัติ" || userRole === "Dean"))) {
    if (status === "approved") {
      sheet.getRange(targetRow, 12).setValue("อนุมัติ");     // Col L: DeanStatus
      sheet.getRange(targetRow, 13).setValue(nowStr);       // Col M: DeanDate
      
      // Calculate and save the approved days into Col G
      let daysVal = (approvedDays !== undefined && approvedDays !== null && !isNaN(approvedDays) && approvedDays !== "") ? Number(approvedDays) : null;
      if (daysVal === null) {
        const startDateStr = values[targetRow - 1][4]; // Col E: Start Date
        const endDateStr = values[targetRow - 1][5];   // Col F: End Date
        const dept = values[targetRow - 1][3];         // Col D: Department
        daysVal = calculateApprovedExtensionDays(ss, startDateStr, endDateStr, dept);
      }
      sheet.getRange(targetRow, 7).setValue(daysVal);       // Col G: Total number of days
      
      // Auto-update Main_Audit Col J (ระยะเวลาตรวจจริง) = Col I + Approved Extension Days
      try {
        const dept = values[targetRow - 1][3];
        updateMainAuditActualDaysForDept(ss, dept);
      } catch (syncErr) {
        console.warn("Sync Main_Audit Col J error:", syncErr);
      }

      actionResult = `อนุมัติเรียบร้อย (บันทึก ${daysVal} วันลงคอลัมน์ G และอัปเดต Main_Audit คอลัมน์ J อัตโนมัติ)`;
    } else if (status === "rejected") {
      sheet.getRange(targetRow, 12).setValue("ไม่อนุมัติ");  // Col L: DeanStatus
      sheet.getRange(targetRow, 13).setValue(nowStr);       // Col M: DeanDate
      sheet.getRange(targetRow, 7).setValue("");            // Col G: Clear if rejected
      
      try {
        const dept = values[targetRow - 1][3];
        updateMainAuditActualDaysForDept(ss, dept);
      } catch (syncErr) {}

      actionResult = "ไม่อนุมัติ";
    }
  }

  if (comment) {
    const oldRemark = sheet.getRange(targetRow, 14).getValue();
    const newRemark = oldRemark ? `${oldRemark} | ${userRole}: ${comment}` : `${userRole}: ${comment}`;
    sheet.getRange(targetRow, 14).setValue(newRemark); // Col N: Remarks
  }

  return { status: "success", message: `ดำเนินการ ${actionResult} ใน Google Sheet เรียบร้อยแล้ว` };
}

function updateMainAuditActualDaysForDept(ss, deptName) {
  if (!ss) ss = getSpreadsheet();
  const mainSheet = ss.getSheetByName("Main_Audit");
  if (!mainSheet) return;

  const mainValues = mainSheet.getDataRange().getValues();
  if (mainValues.length < 2) return;

  const deptClean = String(deptName || "").trim().toLowerCase();
  const approvedExtDays = getApprovedExtensionDaysForDept(ss, deptName);

  for (let i = 1; i < mainValues.length; i++) {
    const rowDept = String(mainValues[i][0] || "").trim().toLowerCase(); // Col A: ส่วนงาน
    if (rowDept === deptClean) {
      const plannedDays = parseInt(mainValues[i][8]) || 0; // Col I: ระยะเวลาตรวจสอบตามแผน
      const totalActual = plannedDays + approvedExtDays;
      mainSheet.getRange(i + 1, 10).setValue(totalActual); // Col J: ระยะเวลาตรวจจริง (วัน)
    }
  }
}

function calculateApprovedExtensionDays(ss, startDateStr, endDateStr, deptName) {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start) || isNaN(end) || start > end) return 0;

  // Load holidays
  const holidaysSheet = ss.getSheetByName("Thai_Holidays") || ss.getSheetByName("Holidays");
  const holidaySet = new Set();
  if (holidaysSheet && holidaysSheet.getLastRow() >= 2) {
    const hVals = holidaysSheet.getRange(2, 1, holidaysSheet.getLastRow() - 1, 1).getValues();
    hVals.forEach(r => {
      if (r[0]) {
        const d = new Date(r[0]);
        if (!isNaN(d)) {
          holidaySet.add(formatDate(d));
        }
      }
    });
  }

  // Load non-audit days for dept
  const nonAuditSheet = ss.getSheetByName("Non_Audit_Days");
  const nonAuditSet = new Set();
  if (nonAuditSheet && nonAuditSheet.getLastRow() >= 2) {
    const nVals = nonAuditSheet.getRange(2, 1, nonAuditSheet.getLastRow() - 1, 3).getValues();
    const deptClean = String(deptName || "").trim().toLowerCase();
    nVals.forEach(r => {
      const nDate = r[0];
      const nDept = String(r[2] || "").trim().toLowerCase();
      if (nDept === deptClean || nDept === "ทั้งหมด" || !nDept) {
        if (nDate) {
          const d = new Date(nDate);
          if (!isNaN(d)) {
            nonAuditSet.add(formatDate(d));
          }
        }
      }
    });
  }

  let count = 0;
  let curr = new Date(start);
  curr.setHours(0,0,0,0);
  const endLimit = new Date(end);
  endLimit.setHours(0,0,0,0);

  while (curr <= endLimit) {
    const dayOfWeek = curr.getDay(); // 0 = Sun, 6 = Sat
    const dateStr = formatDate(curr);

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr) && !nonAuditSet.has(dateStr)) {
      count++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  return count;
}

function cancelExtension(ss, rowIndex) {
  if (!ss) ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Delay");
  if (!rowIndex || rowIndex < 2) return { status: "error", message: "Invalid row" };

  sheet.getRange(rowIndex, 10).setValue("ขอยกเลิก"); // Col J: LeaderStatus
  return { status: "success", message: "ยกเลิกคำขอขยายเวลาใน Google Sheet เรียบร้อยแล้ว" };
}

function resubmitExtension(ss, rowIndex, data) {
  // Appends new row for resubmitted request
  return submitExtension(ss, data);
}

function ensureSheets(ss) {
  if (!ss) ss = getSpreadsheet();
  const required = ["Main_Audit", "Delay", "Users", "Master_Lists", "Thai_Holidays", "Non_Audit_Days"];
  required.forEach(name => {
    if (!ss.getSheetByName(name)) {
      const sheet = ss.insertSheet(name);
      if (name === "Master_Lists") {
        sheet.appendRow(["รายชื่อส่วนงาน", "รายชื่อทีม", "รอบประชุม_คตส"]);
      } else if (name === "Thai_Holidays") {
        sheet.appendRow(["วันที่", "รายการ"]);
      } else if (name === "Non_Audit_Days") {
        sheet.appendRow(["วันที่", "ประเภท", "ส่วนงาน", "สาเหตุ/หมายเหตุ"]);
      } else if (name === "Delay") {
        sheet.appendRow(["Timestamp", "Requestor", "Email", "Department", "Start Date", "End Date", "Total number of days", "Reason", "Leader", "LeaderStatus", "LeaderDate", "DeanStatus", "DeanDate", "Remarks"]);
      }
    }
  });
}
