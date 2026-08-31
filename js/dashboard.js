/**
 * Dashboard Logic, Phase Calculations, Status Determination, and Chart Rendering
 */

const PHASE_STRUCTURE = {
  "1.1": [
    { code: "D", title: "มอบหมายงาน", col: "วันที่มอบหมายงาน" },
    { code: "E", title: "แจ้งเข้าตรวจ", col: "วันที่แจ้งเข้าตรวจ" },
    { code: "F", title: "อนุมัติแผน", col: "วันที่อนุมัติแผน" }
  ],
  "1.2": [
    { code: "G", title: "เปิดตรวจ/เริ่มตรวจสอบ", col: "วันที่เริ่มตรวจสอบ" },
    { code: "H", title: "สิ้นสุดตรวจสอบ", col: "วันที่สิ้นสุดการตรวจสอบ" },
    { code: "J", title: "ประชุมปิดตรวจ", col: "วันที่ปิดตรวจ" }
  ],
  "1.3": [
    { code: "K", title: "เสนออธิการบดี", col: "วันที่เสนออธิการบดี_รายงาน" },
    { code: "M", title: "แจ้งหน่วยรับตรวจ", col: "วันที่แจ้งหน่วยรับตรวจ_รายงาน" },
    { code: "N", title: "เสนอ คตส.", col: "วันที่เสนอ_คตส" }
  ],
  "1.4": [
    { code: "Q", title: "หน่วยรับตรวจชี้แจง", col: "วันที่หน่วยรับตรวจชี้แจง" },
    { code: "R", title: "เสนออธิการบดี (ชี้แจง)", col: "วันที่เสนออธิการบดี_ชี้แจง" },
    { code: "S", title: "เสร็จสมบูรณ์ (แจ้งชี้แจงหน่วยรับตรวจแล้ว)", col: "วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์" }
  ]
};

// Sequence for right-to-left status resolution: S -> R -> Q -> N -> M -> K -> J -> H -> G -> F -> E -> D
const STATUS_PRIORITY_ORDER = [
  { phase: "1.4", sub: "วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์", colIdx: 19, title: "เสร็จสมบูรณ์ (แจ้งชี้แจงหน่วยรับตรวจแล้ว)", isComplete: true },
  { phase: "1.4", sub: "วันที่เสนออธิการบดี_ชี้แจง", colIdx: 18, title: "ชี้แจงผล:เสนออธิการบดี" },
  { phase: "1.4", sub: "วันที่หน่วยรับตรวจชี้แจง", colIdx: 17, title: "ชี้แจงผล:หน่วยรับตรวจชี้แจง" },
  { phase: "1.3", sub: "วันที่เสนอ_คตส", colIdx: 14, title: "รายงานผล:เสนอ คตส." },
  { phase: "1.3", sub: "วันที่แจ้งหน่วยรับตรวจ_รายงาน", colIdx: 13, title: "รายงานผล:แจ้งหน่วยรับตรวจ" },
  { phase: "1.3", sub: "วันที่เสนออธิการบดี_รายงาน", colIdx: 11, title: "รายงานผล:เสนออธิการบดี" },
  { phase: "1.2", sub: "วันที่ปิดตรวจ", colIdx: 10, title: "ระหว่างตรวจสอบ:ประชุมปิดตรวจ" },
  { phase: "1.2", sub: "วันที่สิ้นสุดการตรวจสอบ", colIdx: 7, title: "ระหว่างตรวจสอบ:สิ้นสุดการตรวจสอบ" },
  { phase: "1.2", sub: "วันที่เริ่มตรวจสอบ", colIdx: 6, title: "ระหว่างตรวจสอบ:เปิดตรวจ/เริ่มตรวจสอบ" },
  { phase: "1.1", sub: "วันที่อนุมัติแผน", colIdx: 5, title: "ก่อนเข้าตรวจ:อนุมัติแผน" },
  { phase: "1.1", sub: "วันที่แจ้งเข้าตรวจ", colIdx: 4, title: "ก่อนเข้าตรวจ:แจ้งเข้าตรวจ" },
  { phase: "1.1", sub: "วันที่มอบหมายงาน", colIdx: 3, title: "ก่อนเข้าตรวจ:มอบหมายงาน" }
];

// Helper to safely get field value from row trying key names, column indices, and normalized keys
function getRowDateVal(row, subKey, colIdx) {
  if (!row) return "";
  if (row[subKey] && String(row[subKey]).trim() !== "" && row[subKey] !== "-") return String(row[subKey]).trim();
  if (colIdx !== undefined) {
    if (row[`_col${colIdx}`] && String(row[`_col${colIdx}`]).trim() !== "" && row[`_col${colIdx}`] !== "-") return String(row[`_col${colIdx}`]).trim();
    if (row[`col_${colIdx}`] && String(row[`col_${colIdx}`]).trim() !== "" && row[`col_${colIdx}`] !== "-") return String(row[`col_${colIdx}`]).trim();
  }

  // Robust matching for completed column (Col T: วันที่แจ้งหน่วยรับตรวจ (เสร็จสมบูรณ์))
  if (subKey.includes("เสร็จสมบูรณ์") || subKey.includes("แจ้งหน่วยรับตรวจ")) {
    for (const k of Object.keys(row)) {
      if (k.includes("เสร็จสมบูรณ์") || (k.includes("แจ้ง") && (k.includes("ชี้แจง") || k.includes("เสร็จ")))) {
        const v = row[k];
        if (v && String(v).trim() !== "" && v !== "-") return String(v).trim();
      }
    }
  }

  const cleanTarget = subKey.replace(/[\s_()（）]/g, "").toLowerCase();
  for (const k of Object.keys(row)) {
    const cleanK = k.replace(/[\s_()（）]/g, "").toLowerCase();
    if (cleanK === cleanTarget || cleanK.includes(cleanTarget) || cleanTarget.includes(cleanK)) {
      const v = row[k];
      if (v && String(v).trim() !== "" && v !== "-") return String(v).trim();
    }
  }
  return "";
}

function processDashboardData(rawAuditList, holidaysList, nonAuditDaysList, delayList = []) {
  let completedCount = 0;

  // Build department extension days and latest extension end dates from Delay requests
  const deptExtensionDaysMap = {};
  const deptExtensionEndDateMap = {};

  if (Array.isArray(delayList)) {
    delayList.forEach(item => {
      const itemDept = String(item.Department || item.department || item["ส่วนงาน"] || item._col3 || "").trim();
      if (!itemDept) return;

      const deanStatus = String(item.DeanStatus || item.status || item.Status || item._col11 || "").trim();
      const leaderStatus = String(item.LeaderStatus || item._col9 || item._col8 || "").trim();
      
      const isApproved = deanStatus.includes("อนุมัติ") || deanStatus.includes("อนุมัติแล้ว") || 
        ((deanStatus === "-" || !deanStatus) && (leaderStatus.includes("อนุมัติ") || leaderStatus.includes("ผ่านพิจารณา")));

      if (isApproved) {
        const days = parseInt(item["Total number of days"] || item.totalDays || item["จำนวนวันรวมที่ขอขยาย"] || item._col6 || 0) || 0;
        const deptNorm = normalizeDeptString(itemDept);
        deptExtensionDaysMap[deptNorm] = (deptExtensionDaysMap[deptNorm] || 0) + days;

        const endDate = item["End Date"] || item.endDate || item["วันที่สิ้นสุด"] || item._col5;
        if (endDate) {
          const parsedEnd = parseDate(endDate);
          if (parsedEnd) {
            if (!deptExtensionEndDateMap[deptNorm] || parsedEnd > deptExtensionEndDateMap[deptNorm]) {
              deptExtensionEndDateMap[deptNorm] = parsedEnd;
            }
          }
        }
      }
    });
  }

  // Deduplicate rawAuditList by (deptClean, fiscalYear) - if duplicates exist, merge and prioritize most complete row
  const deduplicatedRowsMap = {};
  rawAuditList.forEach((row, idx) => {
    const deptName = String(row["ส่วนงาน"] || row._col0 || `ส่วนงาน ${idx + 1}`).trim();
    const deptClean = deptName.toLowerCase();
    const fiscalYear = String(row["ปีงบประมาณ"] || row["ปี"] || row._col1 || "2570").trim();
    const key = `${deptClean}_${fiscalYear}`;

    if (!deduplicatedRowsMap[key]) {
      deduplicatedRowsMap[key] = { ...row, _rowIndex: row._rowIndex || idx + 2, _deptName: deptName, _fiscalYear: fiscalYear };
    } else {
      // Merge non-empty fields into the existing object so no entered data is lost
      const existing = deduplicatedRowsMap[key];
      Object.keys(row).forEach(k => {
        if (row[k] && String(row[k]).trim() !== "" && row[k] !== "-" && (!existing[k] || existing[k] === "" || existing[k] === "-")) {
          existing[k] = row[k];
        }
      });
      // Preserve the row index of the most complete/latest record
      if (row._rowIndex) existing._rowIndex = row._rowIndex;
    }
  });

  const uniqueRows = Object.values(deduplicatedRowsMap);

  const processedUnits = [];
  uniqueRows.forEach((row, idx) => {
    const deptName = row._deptName || row["ส่วนงาน"] || `ส่วนงาน ${idx + 1}`;
    const deptClean = String(deptName).trim().toLowerCase();
    const fiscalYear = row._fiscalYear || String(row["ปีงบประมาณ"] || row["ปี"] || row._col1 || "2570").trim();
    const team = String(row["ทีม"] || row._col2 || "").replace(/^ทีม\s*/, "").trim();

    // 1. Determine Latest Status by checking right-to-left
    let latestStatusObj = null;
    let latestDateVal = "";
    let latestPhase = "1.1";
    let isCompleted = false;

    for (let item of STATUS_PRIORITY_ORDER) {
      const val = getRowDateVal(row, item.sub, item.colIdx);
      if (val && val !== "-" && String(val).trim() !== "") {
        latestStatusObj = item;
        latestDateVal = formatThaiDateShort(val);
        latestPhase = item.phase;
        if (item.isComplete) {
          isCompleted = true;
          completedCount++;
        }
        break;
      }
    }

    // If row has NO recorded dates in any audit steps, it has not started yet (handled in unstartedUnits)
    if (!latestStatusObj) {
      return;
    }

    // 2.3 Dynamic Calculation: Planned Audit Days (Col I) and Actual Audit Days (Col J = Col I + Approved Extension Days)
    const startDateG = getRowDateVal(row, "วันที่เริ่มตรวจสอบ", 6);
    const endDateH = getRowDateVal(row, "วันที่สิ้นสุดการตรวจสอบ", 7);

    // Find approved extension days and maximum extended end date for this department
    let approvedExtensionDays = 0;
    let maxDelayEndDate = null;

    Object.keys(deptExtensionDaysMap).forEach(kDept => {
      if (typeof isSameDepartment === "function" ? isSameDepartment(kDept, deptName) : (kDept === deptClean || kDept.includes(deptClean) || deptClean.includes(kDept))) {
        approvedExtensionDays += deptExtensionDaysMap[kDept];
      }
    });

    Object.keys(deptExtensionEndDateMap).forEach(kDept => {
      if (typeof isSameDepartment === "function" ? isSameDepartment(kDept, deptName) : (kDept === deptClean || kDept.includes(deptClean) || deptClean.includes(kDept))) {
        const dEnd = deptExtensionEndDateMap[kDept];
        if (!maxDelayEndDate || dEnd > maxDelayEndDate) {
          maxDelayEndDate = dEnd;
        }
      }
    });

    // If extension exists in Delay sheet, the overall audit period extends to cover the delay period as well
    let effectiveEndDate = endDateH;
    if (maxDelayEndDate) {
      const parsedEndH = parseDate(endDateH);
      if (!parsedEndH || maxDelayEndDate > parsedEndH) {
        effectiveEndDate = maxDelayEndDate;
      }
    }
    
    const auditCalc = calculateActualAuditDays(
      startDateG,
      effectiveEndDate,
      deptName,
      holidaysList,
      nonAuditDaysList
    );

    // Dynamic planned days (Col I): Always recalculate from dates, holidays, and non-audit days
    let plannedDays = 0;
    if (startDateG && endDateH && auditCalc && auditCalc.actualDays >= 0) {
      plannedDays = auditCalc.actualDays;
    } else {
      const savedPlanned = (row["ระยะเวลาตรวจสอบตามแผน"] !== undefined && row["ระยะเวลาตรวจสอบตามแผน"] !== "") ? parseInt(row["ระยะเวลาตรวจสอบตามแผน"]) : 0;
      plannedDays = !isNaN(savedPlanned) ? savedPlanned : 0;
    }

    // Dynamic actual audit days (Col J): Col I + Approved Extension Days
    const totalActualAuditDays = Math.max(plannedDays + approvedExtensionDays, 0);

    // 2.4 Calculate Duration: Closed Audit (Col K) -> Report to President (Col L)
    const dateJ = getRowDateVal(row, "วันที่ปิดตรวจ", 10);
    const dateK = getRowDateVal(row, "วันที่เสนออธิการบดี_รายงาน", 11);
    const aeDuration = dateDiffInDays(dateJ, dateK);

    // 2.5 Calculate Duration: Closed Audit (Col K) -> Report to Audit Committee (Col O)
    const dateN = getRowDateVal(row, "วันที่เสนอ_คตส", 14);
    let ctsDuration = dateDiffInDays(dateJ, dateN);
    const ctsCycle = formatCtsCycle(row["ครั้งที่ประชุม_คตส"] || row["รอบประชุม_คตส"] || row._col16 || "");

    // 2.6 Warning calculation: if CTS submission is >= 50 days (or pending & today - dateJ >= 50)
    let isWarning = false;
    if (ctsDuration !== null && ctsDuration >= 50) {
      isWarning = true;
    } else if (!dateN && dateJ) {
      const daysSinceJ = dateDiffInDays(dateJ, new Date());
      if (daysSinceJ !== null && daysSinceJ >= 50) {
        ctsDuration = daysSinceJ; // Dynamic elapsed days
        isWarning = true;
      }
    }

    processedUnits.push({
      id: row._rowIndex || idx + 1,
      name: deptName,
      fiscalYear: fiscalYear,
      team: String(team),
      latestPhase: latestPhase,
      latestSubCol: latestStatusObj ? latestStatusObj.sub : "วันที่มอบหมายงาน",
      latestStatusTitle: latestStatusObj.title,
      latestDate: latestDateVal,
      statusFormatted: `${latestStatusObj.title} (${latestDateVal})`,
      isCompleted: isCompleted,
      plannedDays: plannedDays,
      extensionDays: approvedExtensionDays,
      actualAuditDays: totalActualAuditDays,
      weekendDays: auditCalc.weekendDays,
      holidayDays: auditCalc.holidayDays,
      interruptedDays: auditCalc.nonAuditDays,
      aeDuration: aeDuration,
      ctsDuration: ctsDuration,
      ctsCycle: ctsCycle,
      isWarning: isWarning,
      raw: row
    });
  });

  return {
    units: processedUnits,
    completedCount: completedCount
  };
}

let phaseChartInstance = null;

function renderPhaseChart(canvasId, phaseStats) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (phaseChartInstance) {
    phaseChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  
  const labels = phaseStats.map(s => s.name);
  const dataCounts = phaseStats.map(s => s.count);
  const colors = phaseStats.map(s => s.color);

  phaseChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'จำนวนส่วนงาน',
        data: dataCounts,
        backgroundColor: colors,
        borderRadius: 8,
        barThickness: 32
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.raw} ส่วนงาน`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: '#f1f5f9' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}
