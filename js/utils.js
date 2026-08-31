/**
 * Utility functions for Internal Audit Tracking System
 */

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

/**
 * Parse any date string into a JS Date object
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr) ? null : dateStr;

  const str = String(dateStr).trim();
  if (!str) return null;

  // Check YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('T')[0].split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  // Check Thai date format e.g. "31/10/2569" or "31/10/2026"
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const parts = str.split('/');
    let yr = parseInt(parts[2]);
    if (yr > 2400) yr -= 543;
    return new Date(yr, parseInt(parts[1]) - 1, parseInt(parts[0]));
  }

  // Check Thai date format e.g. "31 ตุลาคม 2569" or "31 ต.ค. 2569"
  let day = null, month = null, year = null;
  
  for (let i = 0; i < THAI_MONTHS_FULL.length; i++) {
    if (str.includes(THAI_MONTHS_FULL[i])) {
      month = i;
      break;
    }
  }
  if (month === null) {
    for (let i = 0; i < THAI_MONTHS_SHORT.length; i++) {
      if (str.includes(THAI_MONTHS_SHORT[i])) {
        month = i;
        break;
      }
    }
  }

  const numbers = str.match(/\d+/g);
  if (numbers && numbers.length >= 2) {
    day = parseInt(numbers[0]);
    let yr = parseInt(numbers[1]);
    if (yr > 2400) yr -= 543; // convert BE to AD
    year = yr;
  } else if (numbers && numbers.length === 1 && month !== null) {
    day = parseInt(numbers[0]);
    year = new Date().getFullYear();
  }

  if (day !== null && month !== null && year !== null) {
    return new Date(year, month, day);
  }

  const jsParsed = new Date(str);
  return isNaN(jsParsed) ? null : jsParsed;
}

/**
 * Format a Date object to Thai display string e.g. "31/10/2569" (วัน/เดือน/ปี พ.ศ.)
 */
function formatDateDMY(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return dateStr || "-";
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const yearBE = d.getFullYear() + 543;
  return `${day}/${month}/${yearBE}`;
}

/**
 * Format a Date object to Thai short text e.g. "31 ต.ค. 69"
 */
function formatThaiDateShort(dateStr) {
  return formatDateDMY(dateStr);
}

/**
 * Format a Date object to YYYY-MM-DD for HTML input fields
 */
function formatISODate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return "";
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

/**
 * Calculate actual audit days between startDate and endDate
 */
/**
 * Universal extractor for Non_Audit_Days row: handles any column ordering or missing header labels
 */
function extractNonAuditRow(item) {
  if (!item) return { date: null, department: "", reason: "", details: "" };

  let dateVal = null;
  let deptVal = "";
  let reasonVal = "";
  let detailsVal = "";

  const knownReasons = [
    "ลาป่วย", "ลากิจ", "ลาพักร้อน", "ลาป่วย/กิจ/พักร้อน", "ลาป่วย/ลากิจ/ลาพักผ่อน",
    "ติดประชุมมหาวิทยาลัย", "ติดประชุม", "ประชุม", "อบรม", "สัมมนา", "อบรม/สัมมนา",
    "วันหยุดนักขัตฤกษ์", "วันหยุด", "ติดภารกิจ", "ติดภารกิจอื่น"
  ];

  // 1. Check known keys first
  if (item["วันที่"] || item.date) {
    dateVal = parseDate(item["วันที่"] || item.date);
  }
  if (item["ส่วนงาน"] || item.department) {
    deptVal = String(item["ส่วนงาน"] || item.department).trim();
  }
  if (item["ประเภท"] || item.reason) {
    reasonVal = String(item["ประเภท"] || item.reason).trim();
  }
  if (item["สาเหตุ/หมายเหตุ"] || item["รายละเอียด"] || item.details) {
    detailsVal = String(item["สาเหตุ/หมายเหตุ"] || item["รายละเอียด"] || item.details).trim();
  }

  // 2. Scan all column keys (_col0, _col1, etc. or header strings) to extract missing values
  const allKeys = Object.keys(item).filter(k => !k.startsWith("_row") && !k.startsWith("_headers"));
  for (const k of allKeys) {
    const val = String(item[k] !== undefined ? item[k] : "").trim();
    if (!val) continue;

    // Check if valid date
    if (!dateVal) {
      const pDate = parseDate(val);
      if (pDate && !isNaN(pDate.getTime())) {
        dateVal = pDate;
        continue;
      }
    }

    // Check if known reason
    if (!reasonVal && (k.includes("ประเภท") || k.includes("เหตุผล") || knownReasons.some(r => val.includes(r)))) {
      reasonVal = val;
      continue;
    }

    // Check if department (longer text, not a date, not a standard reason)
    if (!deptVal && (k.includes("ส่วนงาน") || k.toLowerCase().includes("dept") || (!knownReasons.some(r => val.includes(r)) && !parseDate(val) && val.length >= 3))) {
      deptVal = val;
      continue;
    }
  }

  // 3. Last fallback
  if (!deptVal) deptVal = String(item._col3 || item._col2 || item._col1 || item._col0 || "").trim();
  if (!dateVal) dateVal = parseDate(item._col1 || item._col0 || item._col2);
  if (!reasonVal) reasonVal = String(item._col2 || item._col1 || "ติดประชุมมหาวิทยาลัย").trim();

  return {
    date: dateVal,
    department: deptVal,
    reason: reasonVal,
    details: detailsVal || reasonVal
  };
}

function normalizeDeptString(str) {
  if (!str) return "";
  return String(str)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isSameDepartment(d1, d2) {
  if (!d1 || !d2) return false;
  const n1 = normalizeDeptString(d1);
  const n2 = normalizeDeptString(d2);
  if (n1 === n2 || n1 === "ทั้งหมด" || n2 === "ทั้งหมด") return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  const c1 = n1.replace(/[\s\-_–—]/g, '');
  const c2 = n2.replace(/[\s\-_–—]/g, '');
  return c1 === c2 || c1.includes(c2) || c2.includes(c1);
}

/**
 * Calculate actual audit days between startDate and endDate
 */
function calculateActualAuditDays(startDateStr, endDateStr, departmentName, holidaysList, nonAuditDaysList) {
  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);

  if (!start || !end || start > end) {
    return { actualDays: 0, weekendDays: 0, holidayDays: 0, nonAuditDays: 0 };
  }

  const holidayTimeSet = new Set();
  if (Array.isArray(holidaysList)) {
    holidaysList.forEach(h => {
      const hDate = parseDate(h["วันที่"] || h.date || h._col0 || h);
      if (hDate) {
        hDate.setHours(0,0,0,0);
        holidayTimeSet.add(hDate.getTime());
      }
    });
  }

  const nonAuditTimeSet = new Set();
  if (Array.isArray(nonAuditDaysList) && departmentName) {
    nonAuditDaysList.forEach(item => {
      const extracted = extractNonAuditRow(item);
      if (!extracted || !extracted.date) return;

      if (isSameDepartment(extracted.department, departmentName)) {
        const nDate = new Date(extracted.date);
        nDate.setHours(0,0,0,0);
        nonAuditTimeSet.add(nDate.getTime());
      }
    });
  }

  let count = 0;
  let curr = new Date(start);
  curr.setHours(0,0,0,0);
  
  const endLimit = new Date(end);
  endLimit.setHours(0,0,0,0);

  let weekendDeductions = 0;
  let holidayDeductions = 0;
  let nonAuditDeductions = 0;

  while (curr <= endLimit) {
    const dayOfWeek = curr.getDay(); // 0 = Sun, 6 = Sat
    const timeVal = curr.getTime();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDeductions++;
    } else if (holidayTimeSet.has(timeVal)) {
      holidayDeductions++;
    } else if (nonAuditTimeSet.has(timeVal)) {
      nonAuditDeductions++;
    } else {
      count++;
    }

    curr.setDate(curr.getDate() + 1);
  }

  return {
    actualDays: count,
    weekendDays: weekendDeductions,
    holidayDays: holidayDeductions,
    nonAuditDays: nonAuditDeductions
  };
}

/**
 * Format & normalize CTS cycle value to "ครั้ง/ปี" e.g. "5/2569", "1/2570"
 * Handles date conversion anomalies caused by Google Sheets automatic date formatting
 */
function formatCtsCycle(val) {
  if (!val) return "";
  let str = String(val).trim();
  if (!str || str === "-" || str === "ALL") return "";

  // Strip prefix "ครั้งที่ " or "รอบที่ "
  str = str.replace(/^(ครั้งที่|รอบที่|ครั้ง|รอบ)\s*/i, "").trim();

  // If already standard "5/2569" or "1/2570"
  if (/^\d+\/\d{4}$/.test(str)) {
    return str;
  }

  // Handle GViz Date format: "Date(2026,4,1)" or "Date(2569,4,1)"
  const gvizMatch = str.match(/Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)/);
  if (gvizMatch) {
    let yr = parseInt(gvizMatch[1]);
    let mo = parseInt(gvizMatch[2]) + 1; // 0-indexed
    let dy = parseInt(gvizMatch[3]);
    if (yr < 2400) yr += 543;
    const cycleNum = dy === 1 ? mo : (mo === 1 ? dy : mo);
    return `${cycleNum}/${yr}`;
  }

  // Handle ISO date format: "2569-05-01" or "2026-05-01"
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    let yr = parseInt(isoMatch[1]);
    let mo = parseInt(isoMatch[2]);
    let dy = parseInt(isoMatch[3]);
    if (yr < 2400) yr += 543;
    const cycleNum = dy === 1 ? mo : (mo === 1 ? dy : mo);
    return `${cycleNum}/${yr}`;
  }

  // Handle slash date format: "01/05/2569" or "5/1/2569"
  const slashDateMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashDateMatch) {
    let p1 = parseInt(slashDateMatch[1]);
    let p2 = parseInt(slashDateMatch[2]);
    let yr = parseInt(slashDateMatch[3]);
    if (yr < 2400) yr += 543;
    const cycleNum = p1 === 1 ? p2 : p1;
    return `${cycleNum}/${yr}`;
  }

  return str;
}

/**
 * Calculate difference in days between two dates
 */
function dateDiffInDays(startDateStr, endDateStr) {
  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);

  if (!start || !end) return null;

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffTime = end.getTime() - start.getTime();
  return Math.round(diffTime / msPerDay);
}

/**
 * Parse Master_Lists sheet structure according to user specifications:
 * Col A (Index 0): Team List
 * Col B (Index 1): CTS Meeting Cycles
 * Col C (Index 2): Non-Audit Day Reasons / Types
 * Col D onwards (Index 3, 4...): Year Column (Col 2N) -> Dept Names, Next Col (Col 2N+1) -> Responsible Team
 */
function parseMasterListsSchema(rawRows) {
  const teamSet = new Set();
  const ctsSet = new Set();
  const nonAuditTypeSet = new Set();
  const departmentsByYear = {};
  const yearSet = new Set(["2570", "2569"]);

  console.log("📋 parseMasterListsSchema called with", rawRows ? rawRows.length : 0, "rows");

  if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) {
    console.warn("⚠️ Master_Lists is empty, using fallback defaults");
    return {
      teams: ["1", "2", "3", "4", "พิเศษ"],
      ctsCycles: ["1/2569", "2/2569", "3/2569", "4/2569", "5/2569", "1/2570", "2/2570"],
      nonAuditTypes: ["ติดประชุมมหาวิทยาลัย", "อบรม/สัมมนา", "วันหยุดนักขัตฤกษ์", "ติดภารกิจอื่น"],
      departmentsByYear: {},
      years: ["2570", "2569"]
    };
  }

  // Helper: get value from row trying multiple possible key names
  function getVal(row, colIdx, ...altKeys) {
    // Try _col{N} first (GViz CSV / new Code.gs format)
    if (row[`_col${colIdx}`] !== undefined && row[`_col${colIdx}`] !== "") return row[`_col${colIdx}`];
    // Try col_{N} (deployed Web App format for empty-header columns)
    if (row[`col_${colIdx}`] !== undefined && row[`col_${colIdx}`] !== "") return row[`col_${colIdx}`];
    // Try alternative named keys
    for (const k of altKeys) {
      if (k && row[k] !== undefined && row[k] !== "") return row[k];
    }
    return "";
  }

  // Debug first row
  const firstRow = rawRows[0];
  console.log("📋 First row keys:", Object.keys(firstRow));
  console.log("📋 Resolved first row: col_A=", getVal(firstRow, 0), "| col_B=", getVal(firstRow, 1), "| col_D=", getVal(firstRow, 3, "2569"), "| col_F=", getVal(firstRow, 5, "2570"));

  rawRows.forEach(row => {
    // 1. Col A (Index 0): Team Options
    const colA = String(getVal(row, 0)).trim();
    if (colA && !colA.startsWith("รายชื่อ") && colA !== "ทีม") {
      const cleanT = colA.replace(/^ทีม\s*/, "").trim();
      if (cleanT && cleanT.length <= 10 && !cleanT.match(/(คณะ|กอง|ศูนย์|สถาบัน|สำนักงาน|วิทยาลัย|ส่วนงาน|ภาควิชา)/i)) {
        teamSet.add(cleanT);
      }
    }

    // 2. Col B (Index 1): CTS Cycle Options
    const colB = String(getVal(row, 1)).trim();
    if (colB && !colB.startsWith("รอบ") && !colB.startsWith("ครั้ง")) {
      const cleanC = formatCtsCycle(colB);
      if (cleanC && cleanC.match(/^\d+\/\d{4}$/)) {
        ctsSet.add(cleanC);
      }
    }

    // 3. Col C (Index 2): Non-Audit Day Reasons / Types
    const colC = String(getVal(row, 2, "ประเภทไม่ได้ออกตรวจ", "ประเภท/เหตุผล")).trim();
    if (colC && !colC.startsWith("ประเภท") && colC.length > 1 && !colC.match(/^\d/)) {
      nonAuditTypeSet.add(colC);
    }
  });

  // Year-Department pairs
  // Master_Lists structure:
  //   Col D (idx 3) = Dept names for 2569,  Col E (idx 4) = Team for 2569
  //   Col F (idx 5) = Dept names for 2570,  Col G (idx 6) = Team for 2570
  //   Col H (idx 7) = Dept names for 2571,  Col I (idx 8) = Team for 2571
  const allColIndices = [
    { year: "2569", deptIdx: 3, teamIdx: 4 },
    { year: "2570", deptIdx: 5, teamIdx: 6 },
    { year: "2571", deptIdx: 7, teamIdx: 8 },
    { year: "2572", deptIdx: 9, teamIdx: 10 }
  ];

  allColIndices.forEach(pair => {
    let yearStr = pair.year;
    let count = 0;

    rawRows.forEach(row => {
      // Get dept name: try _col{N}, col_{N}, then year as key name (e.g., "2569", "2570")
      const rawVal = getVal(row, pair.deptIdx, pair.year);
      const deptName = String(rawVal).trim();
      
      // Validation: non-empty, at least 3 chars, not a pure year/number/date
      if (deptName && 
          deptName.length > 2 &&
          !deptName.match(/^\d{4}$/) && 
          !deptName.match(/^\d{4}-\d{2}-\d{2}$/) && 
          !deptName.match(/^\d+$/)) {

        // Get team: try _col{N}, col_{N}
        const rawTeam = getVal(row, pair.teamIdx);
        const teamName = String(rawTeam || "1").replace(/^ทีม\s*/, "").trim() || "1";

        if (!departmentsByYear[yearStr]) {
          departmentsByYear[yearStr] = [];
        }
        if (!departmentsByYear[yearStr].some(d => d.name === deptName)) {
          departmentsByYear[yearStr].push({
            name: deptName,
            team: teamName,
            year: yearStr
          });
          count++;
        }
      }
    });

    if (count > 0) {
      yearSet.add(yearStr);
      console.log(`✅ Year ${yearStr}: Found ${count} departments (sample:`, departmentsByYear[yearStr].slice(0, 3), `)`);
    }
  });

  const years = Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  const validTeams = Array.from(teamSet).filter(t => t && t !== "ทีม");
  const validCts = Array.from(ctsSet);

  const result = {
    teams: validTeams.length > 0 ? validTeams : ["1", "2", "3", "4", "พิเศษ"],
    ctsCycles: validCts.length > 0 ? validCts : ["1/2569", "2/2569", "3/2569", "4/2569", "5/2569", "1/2570", "2/2570"],
    nonAuditTypes: nonAuditTypeSet.size > 0 ? Array.from(nonAuditTypeSet) : ["ติดประชุมมหาวิทยาลัย", "อบรม/สัมมนา", "วันหยุดนักขัตฤกษ์", "ติดภารกิจอื่น"],
    departmentsByYear: departmentsByYear,
    years: years
  };

  console.log("📋 parseMasterListsSchema result:", { 
    teams: result.teams, 
    ctsCycles: result.ctsCycles.length,
    deptYears: Object.keys(result.departmentsByYear).map(y => `${y}: ${result.departmentsByYear[y].length} depts`),
    years: result.years 
  });

  return result;
}
