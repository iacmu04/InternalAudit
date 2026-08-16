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
function calculateActualAuditDays(startDateStr, endDateStr, departmentName, holidaysList, nonAuditDaysList) {
  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);

  if (!start || !end || start > end) return 0;

  const holidayTimeSet = new Set();
  if (Array.isArray(holidaysList)) {
    holidaysList.forEach(h => {
      const hDate = parseDate(h["วันที่"] || h.date || h);
      if (hDate) {
        hDate.setHours(0,0,0,0);
        holidayTimeSet.add(hDate.getTime());
      }
    });
  }

  const nonAuditTimeSet = new Set();
  if (Array.isArray(nonAuditDaysList) && departmentName) {
    const deptClean = String(departmentName).trim().toLowerCase();
    nonAuditDaysList.forEach(item => {
      const itemDept = String(item["ส่วนงาน"] || item.department || "").trim().toLowerCase();
      if (itemDept === deptClean || itemDept === "ทั้งหมด" || !itemDept) {
        const nDate = parseDate(item["วันที่"] || item.date || item);
        if (nDate) {
          nDate.setHours(0,0,0,0);
          nonAuditTimeSet.add(nDate.getTime());
        }
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
  const yearSet = new Set();

  if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) {
    return {
      teams: ["1", "2", "3", "4"],
      ctsCycles: ["1/2569", "2/2569", "3/2569", "4/2569", "5/2569"],
      nonAuditTypes: ["ติดประชุมมหาวิทยาลัย", "อบรม/สัมมนา", "วันหยุดนักขัตฤกษ์", "ติดภารกิจอื่น"],
      departmentsByYear: {},
      years: ["2570", "2569"]
    };
  }

  // Find column headers from the first row object keys
  const firstObj = rawRows[0] || {};
  const allKeys = Object.keys(firstObj).filter(k => k !== "_rowIndex");

  const colAKey = allKeys[0] || "รายชื่อทีม";
  const colBKey = allKeys[1] || "รอบประชุม_คตส";
  const colCKey = allKeys[2] || "ประเภท";

  rawRows.forEach(row => {
    const teamVal = String(row[colAKey] || "").trim();
    if (teamVal) teamSet.add(teamVal);

    const ctsVal = String(row[colBKey] || "").trim();
    if (ctsVal) ctsSet.add(ctsVal);

    const typeVal = String(row[colCKey] || "").trim();
    if (typeVal) nonAuditTypeSet.add(typeVal);
  });

  // Process Col D onwards for Year & Dept pairs
  for (let i = 3; i < allKeys.length; i++) {
    const key = allKeys[i].trim();
    const yearMatch = key.match(/(\d{4})/);
    if (yearMatch) {
      const yearStr = yearMatch[1];
      yearSet.add(yearStr);

      if (!departmentsByYear[yearStr]) {
        departmentsByYear[yearStr] = [];
      }

      const deptKey = allKeys[i];
      const teamKey = (i + 1 < allKeys.length) ? allKeys[i + 1] : null;

      rawRows.forEach(row => {
        const deptName = String(row[deptKey] || "").trim();
        if (deptName) {
          let teamName = "1";
          if (teamKey && row[teamKey] !== undefined) {
            teamName = String(row[teamKey]).replace("ทีม", "").trim() || "1";
          }
          if (!departmentsByYear[yearStr].some(d => d.name === deptName)) {
            departmentsByYear[yearStr].push({
              name: deptName,
              team: teamName,
              year: yearStr
            });
          }
        }
      });

      if (teamKey && (teamKey.toLowerCase().includes("ทีม") || teamKey.match(/ทีม/i))) {
        i++;
      }
    }
  }

  const years = Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  if (!years.includes("2570")) years.unshift("2570");
  if (!years.includes("2569")) years.push("2569");

  return {
    teams: teamSet.size > 0 ? Array.from(teamSet) : ["1", "2", "3", "4"],
    ctsCycles: ctsSet.size > 0 ? Array.from(ctsSet) : ["1/2569", "2/2569", "3/2569", "4/2569", "5/2569"],
    nonAuditTypes: nonAuditTypeSet.size > 0 ? Array.from(nonAuditTypeSet) : ["ติดประชุมมหาวิทยาลัย", "อบรม/สัมมนา", "วันหยุดนักขัตฤกษ์", "ติดภารกิจอื่น"],
    departmentsByYear: departmentsByYear,
    years: years
  };
}
