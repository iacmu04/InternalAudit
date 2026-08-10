/**
 * Google Apps Script Backend for Internal Audit Tracking & Extension System
 * Spreadsheet ID: 1DsRayuheR7DUA-Zd4S8tCffAsl5C_o4s078HcJc0rKw
 */

const SPREADSHEET_ID = "1DsRayuheR7DUA-Zd4S8tCffAsl5C_o4s078HcJc0rKw";

function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  const action = e.parameter.action || "getData";
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
    responseData = { status: "error", message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let responseData = {};
  
  try {
    const ss = getSpreadsheet();
    let contents;
    
    if (e.postData && e.postData.contents) {
      contents = JSON.parse(e.postData.contents);
    } else {
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
      responseData = processApproval(ss, contents.id, contents.status, contents.comment, contents.userEmail, contents.userRole);
    } else if (action === "cancelExtension") {
      responseData = cancelExtension(ss, contents.id, contents.userEmail);
    } else if (action === "resubmitExtension") {
      responseData = resubmitExtension(ss, contents.id, contents.data);
    } else if (action === "addDepartment") {
      responseData = addDepartmentToMaster(ss, contents.departmentName);
    } else {
      responseData = { status: "error", message: "Unknown action" };
    }
  } catch (err) {
    responseData = { status: "error", message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAllData(ss) {
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
    const rowObj = { _rowIndex: i + 1 };
    let hasVal = false;
    for (let j = 0; j < headers.length; j++) {
      let val = values[i][j];
      if (val instanceof Date) {
        val = formatDate(val);
      }
      rowObj[headers[j] || `col_${j}`] = val;
      if (val !== "" && val !== null && val !== undefined) hasVal = true;
    }
    if (hasVal) rows.push(rowObj);
  }
  return rows;
}

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function checkUserPermission(ss, email) {
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
  const sheet = ss.getSheetByName("Main_Audit");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const row = headers.map(h => data[h] || "");
  sheet.appendRow(row);

  if (data["ส่วนงาน"]) {
    addDepartmentToMaster(ss, data["ส่วนงาน"]);
  }

  return { status: "success", message: "บันทึกข้อมูลเรียบร้อยแล้ว" };
}

function updateAuditEntry(ss, rowIndex, data) {
  const sheet = ss.getSheetByName("Main_Audit");
  if (!rowIndex || rowIndex < 2) return { status: "error", message: "Invalid row index" };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowValues = headers.map(h => data[h] !== undefined ? data[h] : "");
  
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);

  return { status: "success", message: "แก้ไขข้อมูลเรียบร้อยแล้ว" };
}

function addDepartmentToMaster(ss, deptName) {
  if (!deptName) return { status: "ignored" };
  const masterSheet = ss.getSheetByName("Master_Lists");
  if (!masterSheet) return { status: "ignored" };

  const values = masterSheet.getRange(2, 1, Math.max(masterSheet.getLastRow() - 1, 1), 1).getValues();
  const existing = values.map(r => String(r[0]).trim().toLowerCase());
  
  if (!existing.includes(String(deptName).trim().toLowerCase())) {
    masterSheet.appendRow([deptName]);
  }
  return { status: "success" };
}

function submitExtension(ss, data) {
  const sheet = ss.getSheetByName("Delay");
  const nowStr = formatDate(new Date());
  
  const newRow = [
    nowStr,
    data.requestorName || "",
    data.requestorEmail || "",
    data.department || "",
    data.startDate || "",
    data.endDate || "",
    data.reason || "",
    data.supervisorName || "",
    "รอพิจารณา (ค้างอยู่ที่หัวหน้างาน)",
    "", // Supervisor Action Date
    "", // Director Action Date
    ""  // Remarks
  ];

  sheet.appendRow(newRow);
  return { status: "success", message: "ส่งคำขอขยายเวลาเรียบร้อยแล้ว" };
}

function processApproval(ss, id, status, comment, userEmail, userRole) {
  const sheet = ss.getSheetByName("Delay");
  const values = sheet.getDataRange().getValues();
  const nowStr = formatDate(new Date());

  let targetRow = -1;
  if (typeof id === 'number' && id >= 2) {
    targetRow = id;
  } else {
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id || (values[i][2] === userEmail && values[i][3] === comment)) {
        targetRow = i + 1;
        break;
      }
    }
  }

  if (targetRow === -1) return { status: "error", message: "ไม่พบรายการคำขอ" };

  let newStatus = "";
  if (userRole === "Leader" || userRole === "Admin") {
    if (status === "approved") {
      newStatus = "รออนุมัติ (ค้างอยู่ที่ผู้อำนวยการ)";
    } else if (status === "rejected") {
      newStatus = "ตีกลับ";
    }
    sheet.getRange(targetRow, 9).setValue(newStatus);
    sheet.getRange(targetRow, 10).setValue(nowStr);
  } 
  
  if (userRole === "Dean" || (userRole === "Admin" && newStatus === "")) {
    if (status === "approved") {
      newStatus = "อนุมัติแล้ว";
    } else if (status === "rejected") {
      newStatus = "ไม้อนุมัติ";
    }
    sheet.getRange(targetRow, 9).setValue(newStatus);
    sheet.getRange(targetRow, 11).setValue(nowStr);
  }

  if (comment) {
    const oldRemark = sheet.getRange(targetRow, 12).getValue();
    const newRemark = oldRemark ? `${oldRemark} | ${userRole}: ${comment}` : `${userRole}: ${comment}`;
    sheet.getRange(targetRow, 12).setValue(newRemark);
  }

  return { status: "success", message: `ดำเนินการ ${newStatus} เรียบร้อยแล้ว` };
}

function cancelExtension(ss, rowIndex) {
  const sheet = ss.getSheetByName("Delay");
  if (!rowIndex || rowIndex < 2) return { status: "error", message: "Invalid row" };

  sheet.getRange(rowIndex, 9).setValue("ขอยกเลิก");
  return { status: "success", message: "ยกเลิกคำขอขยายเวลาเรียบร้อยแล้ว" };
}

function resubmitExtension(ss, rowIndex, data) {
  const sheet = ss.getSheetByName("Delay");
  if (!rowIndex || rowIndex < 2) return { status: "error", message: "Invalid row" };

  sheet.getRange(rowIndex, 5).setValue(data.startDate);
  sheet.getRange(rowIndex, 6).setValue(data.endDate);
  sheet.getRange(rowIndex, 7).setValue(data.reason);
  sheet.getRange(rowIndex, 8).setValue(data.supervisorName);
  sheet.getRange(rowIndex, 9).setValue("รอพิจารณา (ค้างอยู่ที่หัวหน้างาน)");
  sheet.getRange(rowIndex, 10).setValue("");

  return { status: "success", message: "ส่งคำขอแก้ไขให้หัวหน้างานพิจารณาใหม่เรียบร้อยแล้ว" };
}

function ensureSheets(ss) {
  const required = ["Main_Audit", "Delay", "Users", "Master_Lists", "Thai_Holidays", "Non_Audit_Days"];
  required.forEach(name => {
    if (!ss.getSheetByName(name)) {
      const sheet = ss.insertSheet(name);
      if (name === "Master_Lists") {
        sheet.appendRow(["ส่วนงาน", "ทีม", "ครั้งที่ประชุม_คตส"]);
      } else if (name === "Thai_Holidays") {
        sheet.appendRow(["วันที่", "รายละเอียดวันหยุด"]);
      } else if (name === "Non_Audit_Days") {
        sheet.appendRow(["วันที่", "ประเภท", "ส่วนงาน", "สาเหตุ/หมายเหตุ"]);
      } else if (name === "Delay") {
        sheet.appendRow(["Timestamp", "Requestor", "Email", "Department", "Start Date", "End Date", "Reason", "Supervisor Name", "Status", "Supervisor Action Date", "Director Action Date", "Remarks"]);
      }
    }
  });
}
