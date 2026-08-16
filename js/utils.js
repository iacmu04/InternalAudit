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

  // Debug: Log first row structure
  const firstRow = rawRows[0];
  console.log("📋 First row keys:", Object.keys(firstRow));
  console.log("📋 First row _col0:", firstRow._col0, "| _col1:", firstRow._col1, "| _col3:", firstRow._col3, "| _col5:", firstRow._col5);
  console.log("📋 First row _headers:", firstRow._headers);

  // Iterate over raw rows directly — they should already have _col0.._colN from readSheetData or parseCSV
  rawRows.forEach(row => {
    // 1. Col A (Index 0): Team Options
    const colA = String(row._col0 !== undefined ? row._col0 : "").trim();
    if (colA && !colA.startsWith("รายชื่อ") && colA !== "ทีม") {
      const cleanT = colA.replace(/^ทีม\s*/, "").trim();
      if (cleanT && cleanT.length <= 10 && !cleanT.match(/(คณะ|กอง|ศูนย์|สถาบัน|สำนักงาน|วิทยาลัย|ส่วนงาน|ภาควิชา)/i)) {
        teamSet.add(cleanT);
      }
    }

    // 2. Col B (Index 1): CTS Cycle Options
    const colB = String(row._col1 !== undefined ? row._col1 : "").trim();
    if (colB && !colB.startsWith("รอบ") && !colB.startsWith("ครั้ง")) {
      const cleanC = colB.replace(/^ครั้งที่\s*/, "").replace(/^รอบที่\s*/, "").trim();
      if (cleanC && cleanC.match(/^\d+\/\d{4}$/)) {
        ctsSet.add(cleanC);
      }
    }

    // 3. Col C (Index 2): Non-Audit Day Reasons / Types
    const colC = String(row._col2 !== undefined ? row._col2 : "").trim();
    if (colC && !colC.startsWith("ประเภท") && colC.length > 1 && !colC.match(/^\d/)) {
      nonAuditTypeSet.add(colC);
    }
  });

  // Determine year pairs starting from Index 3 (Col D)
  // Col D (index 3) = Dept for 2569, Col E (index 4) = Team for 2569
  // Col F (index 5) = Dept for 2570, Col G (index 6) = Team for 2570
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
      const rawVal = row[`_col${pair.deptIdx}`];
      const deptName = String(rawVal !== undefined ? rawVal : "").trim();
      
      // Dept Name Validation: Must be non-empty, not a year, not a date, not a pure number, and at least 3 chars
      if (deptName && 
          deptName.length > 2 &&
          !deptName.match(/^\d{4}$/) && 
          !deptName.match(/^\d{4}-\d{2}-\d{2}$/) && 
          !deptName.match(/^\d+$/)) {

        const rawTeam = row[`_col${pair.teamIdx}`];
        const teamName = String(rawTeam !== undefined ? rawTeam : "1").replace(/^ทีม\s*/, "").trim() || "1";

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
      console.log(`📋 Year ${yearStr}: Found ${count} departments from _col${pair.deptIdx}`);
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
    teams: result.teams.length, 
    ctsCycles: result.ctsCycles.length, 
    nonAuditTypes: result.nonAuditTypes.length,
    deptYears: Object.keys(result.departmentsByYear).map(y => `${y}: ${result.departmentsByYear[y].length} depts`),
    years: result.years 
  });

  return result;
}
