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
 * Parse any date string (Thai date "31 ตุลาคม 2569", ISO "2026-10-31", etc.) into a JS Date object
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
 * Format a Date object to Thai display string e.g. "31 ต.ค. 69"
 */
function formatThaiDateShort(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return dateStr || "-";
  const day = d.getDate();
  const monthStr = THAI_MONTHS_SHORT[d.getMonth()];
  const yearBE = (d.getFullYear() + 543) % 100;
  return `${day} ${monthStr} ${yearBE}`;
}

/**
 * Format a Date object to YYYY-MM-DD for input fields
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
 * Calculate actual audit days between startDate and endDate (Requirement 2.3)
 * Formula:
 * 1. Count calendar days from startDate to endDate inclusive
 * 2. Deduct weekends (Saturdays & Sundays)
 * 3. Deduct national holidays (from Thai_Holidays sheet Column A)
 * 4. Deduct non-audit days for this specific department (from Non_Audit_Days sheet filtered by department)
 */
function calculateActualAuditDays(startDateStr, endDateStr, departmentName, holidaysList, nonAuditDaysList) {
  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);

  if (!start || !end || start > end) return 0;

  // Standardize holiday dates to set of time strings (midnight)
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

  // Filter non-audit days by department name (Column C in Non_Audit_Days)
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
