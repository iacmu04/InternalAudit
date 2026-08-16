/**
 * API Bridge for Google Apps Script Backend + Live Google Sheet Data
 * Spreadsheet ID: 1DsRayuheR7DUA-Zd4S8tCffAsl5C_o4s078HcJc0rKw
 */

const SPREADSHEET_ID = "1DsRayuheR7DUA-Zd4S8tCffAsl5C_o4s078HcJc0rKw";
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbz_InternalAudit_Web_App/exec";

function getStoredApiUrl() {
  return localStorage.getItem("APPS_SCRIPT_URL") || DEFAULT_API_URL;
}

function setStoredApiUrl(url) {
  if (url) {
    localStorage.setItem("APPS_SCRIPT_URL", url.trim());
  } else {
    localStorage.removeItem("APPS_SCRIPT_URL");
  }
}

function parseCSV(csvText) {
  if (!csvText) return [];
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length < 1) return [];

  function parseRow(line) {
    const row = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    return row;
  }

  const headers = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const obj = { _rowIndex: i + 1, _headers: headers };
    let hasVal = false;
    values.forEach((val, idx) => {
      obj[`_col${idx}`] = val;
    });
    headers.forEach((h, idx) => {
      const val = values[idx] !== undefined ? values[idx] : "";
      if (obj[h] === undefined) {
        obj[h] = val;
      }
      if (val !== "") hasVal = true;
    });
    if (hasVal) rows.push(obj);
  }
  return rows;
}

async function fetchLiveSheetCSV(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const text = await res.text();
    return parseCSV(text);
  } catch (err) {
    console.warn(`Failed to fetch live sheet ${sheetName}:`, err);
    return [];
  }
}

class API {
  static getApiUrl() {
    return getStoredApiUrl();
  }

  static setApiUrl(url) {
    setStoredApiUrl(url);
  }

  static async fetchInitialData() {
    const apiUrl = getStoredApiUrl();
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}?action=getInitialData&t=${Date.now()}`);
        const json = await res.json();
        if (json && json.status === "success") {
          return json;
        }
      } catch (err) {
        console.warn("Backend Web App fetch failed, falling back to direct GViz CSV:", err);
      }
    }

    console.log("Fetching live data directly from Google Sheets...");
    const [mainAudit, masterListsRaw, usersRaw, holidaysRaw, nonAuditRaw, delayRaw] = await Promise.all([
      fetchLiveSheetCSV("Main_Audit"),
      fetchLiveSheetCSV("Master_Lists"),
      fetchLiveSheetCSV("Users"),
      fetchLiveSheetCSV("Thai_Holidays"),
      fetchLiveSheetCSV("Non_Audit_Days"),
      fetchLiveSheetCSV("Delay")
    ]);

    const masterLists = masterListsRaw.map(r => {
      const keys = Object.keys(r).filter(k => k !== "_rowIndex");
      const colDVal = r["ประเภท_เหตุผล_ไม่เข้าตรวจ"] || r["ประเภท/เหตุผล"] || r["เหตุผล_ไม่เข้าตรวจ"] || r["คอลัมน์ D"] || (keys.length >= 4 ? r[keys[3]] : "");
      return {
        ...r,
        "ส่วนงาน": r["รายชื่อส่วนงาน"] || r["ส่วนงาน"] || "",
        "ทีม": r["รายชื่อทีม"] || r["ทีม"] || "",
        "ครั้งที่ประชุม_คตส": r["รอบประชุม_คตส"] || r["ครั้งที่ประชุม_คตส"] || r["ครั้งที่ประชุม คตส."] || "",
        "ประเภท_เหตุผล_ไม่เข้าตรวจ": colDVal
      };
    });

    const users = usersRaw.map(r => {
      const keys = Object.keys(r);
      return {
        "Email": r["Email"] || r[keys.find(k => k.toLowerCase().includes("email"))] || r[keys[0]] || "",
        "Name": r["Name"] || r[keys.find(k => k.toLowerCase().includes("name"))] || r[keys[1]] || "",
        "Role": r["Role"] || r[keys.find(k => k.toLowerCase().includes("role"))] || r[keys[2]] || "User",
        "Team": r["Team"] || r[keys.find(k => k.toLowerCase().includes("team"))] || r[keys[3]] || "",
        "Authorize": r["Authorize"] || r[keys.find(k => k.toLowerCase().includes("authorize"))] || r[keys[4]] || ""
      };
    });

    return {
      status: "success",
      mainAudit: mainAudit,
      masterLists: masterLists,
      users: users,
      holidays: holidaysRaw,
      nonAuditDays: nonAuditRaw,
      delay: delayRaw
    };
  }

  static async postAction(action, payload) {
    const apiUrl = getStoredApiUrl();
    if (!apiUrl) {
      return { 
        status: "need_config", 
        message: "กรุณาเชื่อมต่อ Web App URL ของ Google Apps Script ก่อนส่งข้อมูลลง Google Sheet" 
      };
    }

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, ...payload })
      });
      return await res.json();
    } catch (err) {
      console.error("POST action error:", err);
      return { status: "error", message: err.toString() };
    }
  }
}
