/**
 * API Bridge for Google Apps Script Backend + Live Google Sheet Data
 * Spreadsheet ID: 1DsRayuheR7DUA-Zd4S8tCffAsl5C_o4s078HcJc0rKw
 */

const SPREADSHEET_ID = "1DsRayuheR7DUA-Zd4S8tCffAsl5C_o4s078HcJc0rKw";
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxbS3-yGUYPS1QkyWXoG_UFh5gxeMXYhX7KUpZjPFGDJz58c5UvRHUXx_Q9F6UuODY/exec";

// Auto-migration: Clear any stale/incorrect URLs from localStorage on startup
// This ensures all users get the correct hardcoded DEFAULT_API_URL
(function() {
  const stored = localStorage.getItem("APPS_SCRIPT_URL");
  if (stored && stored !== DEFAULT_API_URL) {
    console.log("🔄 Cleared stale API URL from localStorage:", stored.substring(0, 60) + "...");
    localStorage.removeItem("APPS_SCRIPT_URL");
  }
})();

function getStoredApiUrl() {
  const stored = localStorage.getItem("APPS_SCRIPT_URL");
  if (stored && stored.includes("/macros/s/") && stored.endsWith("/exec")) {
    return stored.trim();
  }
  return DEFAULT_API_URL;
}

function setStoredApiUrl(url) {
  if (url && url.includes("/macros/s/") && url.trim().endsWith("/exec")) {
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
    
    // Strategy 1: Try fetching via Apps Script Web App (doGet)
    if (apiUrl && !apiUrl.includes("AKfycbz_InternalAudit")) {
      try {
        const url = `${apiUrl}?action=getInitialData&t=${Date.now()}`;
        const res = await fetch(url, { redirect: "follow" });
        const text = await res.text();
        const json = JSON.parse(text);
        if (json && json.status === "success" && json.mainAudit) {
          console.log("✅ Data loaded from Apps Script Web App successfully");
          
          // Always ensure Master_Lists has exact column indices _col0.._col6 for Depts and Teams
          // Col D (idx 3) = 2569 Dept, Col E (idx 4) = 2569 Team, Col F (idx 5) = 2570 Dept, Col G (idx 6) = 2570 Team
          if (!json.masterLists || json.masterLists.length === 0 || json.masterLists[0]._col5 === undefined || json.masterLists[0]._col6 === undefined) {
            console.log("🔄 Fetching live Master_Lists via GViz CSV to get exact team columns (Col E for 2569, Col G for 2570)...");
            const liveMaster = await fetchLiveSheetCSV("Master_Lists");
            if (liveMaster && liveMaster.length > 0) {
              json.masterLists = liveMaster;
            }
          }
          
          return json;
        }
      } catch (err) {
        console.warn("Apps Script Web App GET failed, falling back to GViz CSV:", err.message);
      }
    }

    // Strategy 2: Fallback to direct Google Sheets GViz CSV (public read)
    console.log("Fetching live data directly from Google Sheets via GViz CSV...");
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
    if (!apiUrl || apiUrl.includes("AKfycbz_InternalAudit") || apiUrl.includes("...")) {
      return { 
        status: "need_config", 
        message: "กรุณาเชื่อมต่อ Web App URL ของ Google Apps Script ก่อนส่งข้อมูลลง Google Sheet\n\n(กดปุ่ม ⚙️ ด้านบนขวา แล้ววาง Web App URL เต็มที่คัดลอกจากปุ่ม Copy ใต้หัวข้อ 'Web app > URL' บน Apps Script)" 
      };
    }

    const postBody = JSON.stringify({ action, ...payload });

    try {
      // Google Apps Script Web App POST: use redirect:follow to handle 302 chain
      const res = await fetch(apiUrl, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: postBody
      });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json && json.status) return json;
        return { status: "success", message: "บันทึกข้อมูลลง Google Sheet เรียบร้อยแล้ว" };
      } catch (pErr) {
        // If we get HTML or non-JSON response, it means Apps Script processed but returned non-JSON
        if (res.ok || res.status === 0) {
          return { status: "success", message: "บันทึกข้อมูลลง Google Sheet เรียบร้อยแล้ว" };
        }
        return { status: "error", message: "ได้รับข้อมูลตอบกลับที่ไม่สามารถอ่านได้จาก Google Apps Script: " + text.substring(0, 200) };
      }
    } catch (err) {
      console.error("POST action error:", err);
      return { 
        status: "error", 
        message: "ไม่สามารถส่งข้อมูลไปยัง Google Apps Script Web App ได้ (" + err.message + ")\n\nกรุณาตรวจสอบว่า:\n1. กดปุ่ม Copy ใต้คำว่า 'Web app > URL' (ไม่ใช่จากช่อง Deployment ID ที่มี ...)\n2. วาง URL ลงในเมนู ⚙️ ด้านบนขวาแล้วกดบันทึก\n3. ในหน้า Deploy ตั้งค่า 'Who has access' เป็น 'Anyone' (ทุกคน)" 
      };
    }
  }
}
