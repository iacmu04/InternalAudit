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
    { code: "G", title: "ระหว่างการตรวจสอบ", col: "วันที่เริ่มตรวจสอบ" },
    { code: "H", title: "ระหว่างร่างรายงาน", col: "วันที่สิ้นสุดการตรวจสอบ" },
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
  { phase: "1.2", sub: "วันที่สิ้นสุดการตรวจสอบ", colIdx: 7, title: "ระหว่างร่างรายงาน" },
  { phase: "1.2", sub: "วันที่เริ่มตรวจสอบ", colIdx: 6, title: "ระหว่างการตรวจสอบ" },
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

    // Check if row has "ไม่มีข้อเสนอแนะ" in Col R, Col S, or Col T
    const dateR = getRowDateVal(row, "วันที่หน่วยรับตรวจชี้แจง", 17);
    const dateS = getRowDateVal(row, "วันที่เสนออธิการบดี_ชี้แจง", 18);
    const dateT = getRowDateVal(row, "วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์", 19) || getRowDateVal(row, "วันที่แจ้งหน่วยรับตรวจ_ชี้แจง", 19);

    const hasNoRecommendation = (dateR && String(dateR).includes("ไม่มีข้อเสนอแนะ")) ||
                               (dateS && String(dateS).includes("ไม่มีข้อเสนอแนะ")) ||
                               (dateT && String(dateT).includes("ไม่มีข้อเสนอแนะ"));

    if (hasNoRecommendation) {
      latestStatusObj = {
        phase: "1.4",
        sub: "วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์",
        colIdx: 19,
        title: "เสร็จสมบูรณ์ (ไม่มีข้อเสนอแนะ)",
        isComplete: true
      };
      latestDateVal = "ไม่มีข้อเสนอแนะ";
      latestPhase = "1.4";
      isCompleted = true;
      completedCount++;
    } else {
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
    }

    // If row has NO recorded dates in any audit steps, it has not started yet (handled in unstartedUnits)
    if (!latestStatusObj) {
      return;
    }

    // 2.3 Dynamic Calculation: Planned Audit Days (Col I) and Actual Audit Days (Col J = Col I + Approved Extension Days)
    const startDateG = getRowDateVal(row, "วันที่เริ่มตรวจสอบ", 6);
    const endDateH = getRowDateVal(row, "วันที่สิ้นสุดการตรวจสอบ", 7);

    // 1. Calculate Planned Audit Days (Col I) = Base working days between Col G and Col H (excluding weekends and holidays)
    const auditPlanCalc = calculateActualAuditDays(
      startDateG,
      endDateH,
      deptName,
      holidaysList,
      []
    );

    let plannedDays = 0;
    if (startDateG && endDateH && auditPlanCalc && auditPlanCalc.actualDays >= 0) {
      plannedDays = auditPlanCalc.actualDays;
    } else {
      const savedPlanned = (row["ระยะเวลาตรวจสอบตามแผน"] !== undefined && row["ระยะเวลาตรวจสอบตามแผน"] !== "") ? parseInt(row["ระยะเวลาตรวจสอบตามแผน"]) : 0;
      plannedDays = !isNaN(savedPlanned) ? savedPlanned : 0;
    }

    // 2. Count non-audit days for this department
    const nonAuditCount = typeof countNonAuditDaysForDepartment === "function" 
      ? countNonAuditDaysForDepartment(deptName, nonAuditDaysList) 
      : 0;

    // 3. Find approved extension days from Delay sheet
    let approvedExtensionDays = 0;
    Object.keys(deptExtensionDaysMap).forEach(kDept => {
      if (typeof isSameDepartment === "function" ? isSameDepartment(kDept, deptName) : (kDept === deptClean)) {
        approvedExtensionDays += deptExtensionDaysMap[kDept];
      }
    });

    // 4. Exact Formula: Actual Audit Days (Col J) = Planned (Col I) + Extension (Delay) - Non-Audit Days
    const totalActualAuditDays = Math.max(plannedDays + approvedExtensionDays - nonAuditCount, 0);

    // 2.4 Calculate Duration: Closed Audit (Col K) -> Report to President (Col L)
    const dateJ = getRowDateVal(row, "วันที่ปิดตรวจ", 10);
    const dateK = getRowDateVal(row, "วันที่เสนออธิการบดี_รายงาน", 11);
    const aeDuration = dateDiffInDays(dateJ, dateK);

    // 2.5 Calculate Duration: Closed Audit (Col K) -> Report to Audit Committee (Col O)
    const dateN = getRowDateVal(row, "วันที่เสนอ_คตส", 14);
    let ctsDuration = dateDiffInDays(dateJ, dateN);
    const ctsCycle = formatCtsCycle(row["ครั้งที่ประชุม_คตส"] || row["รอบประชุม_คตส"] || row._col16 || "");

    // 2.6 Warning calculation: Only warn if pending submission (!dateN) AND elapsed >= 50 days
    let hasSubmittedToCts = false;
    let isWarning = false;
    if (dateN && String(dateN).trim() !== "" && dateN !== "-") {
      hasSubmittedToCts = true;
      isWarning = false;
    } else if (dateJ) {
      const daysSinceJ = dateDiffInDays(dateJ, new Date());
      if (daysSinceJ !== null) {
        ctsDuration = daysSinceJ; // Dynamic elapsed days
        if (daysSinceJ >= 50) {
          isWarning = true;
        }
      }
    }

    // 2.7 Clarification Due Date (Col U: 30 days from Col N วันที่แจ้งหน่วยรับตรวจ_รายงาน)
    // and Clarification Alert (if elapsed >= 20 days and Col R วันที่หน่วยรับตรวจชี้แจง is empty)
    const reportDateToUnit = getRowDateVal(row, "วันที่แจ้งหน่วยรับตรวจ_รายงาน", 13);
    const clarifyDateFromUnit = getRowDateVal(row, "วันที่หน่วยรับตรวจชี้แจง", 17);
    
    let clarifyDueDateFormatted = "-";
    let clarifyDueDateObj = null;
    let daysSinceReport = null;
    let isClarifyWarning = false; // >= 20 days without clarification
    let isClarifyOverdue = false; // > 30 days without clarification
    let isClarified = false;      // Unit has submitted clarification
    let isNoRecommendation = false;

    if (hasNoRecommendation || (clarifyDateFromUnit && String(clarifyDateFromUnit).includes("ไม่มีข้อเสนอแนะ"))) {
      isClarified = true;
      isNoRecommendation = true;
      clarifyDueDateFormatted = "-";
    } else if (reportDateToUnit) {
      const pReportDate = parseDate(reportDateToUnit);
      if (pReportDate) {
        clarifyDueDateObj = new Date(pReportDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        clarifyDueDateFormatted = formatThaiDateShort(clarifyDueDateObj);

        const pClarifyDate = clarifyDateFromUnit ? parseDate(clarifyDateFromUnit) : null;
        var clarifyDuration = null;
        var isClarifiedOverdue = false;

        if (pClarifyDate) {
          isClarified = true;
          clarifyDuration = dateDiffInDays(reportDateToUnit, clarifyDateFromUnit);
          if (clarifyDuration !== null && clarifyDuration > 30) {
            isClarifiedOverdue = true;
          }
        } else {
          const now = new Date();
          now.setHours(0,0,0,0);
          const rDate = new Date(pReportDate);
          rDate.setHours(0,0,0,0);
          daysSinceReport = Math.floor((now - rDate) / (24 * 60 * 60 * 1000));
          
          if (daysSinceReport >= 20) {
            isClarifyWarning = true;
          }
          if (daysSinceReport > 30) {
            isClarifyOverdue = true;
          }
        }
      }
    }

    // 2.8 Calculate Duration: ระยะเวลาร่างรายงาน (Col W)
    // Sourced from latest date between Col H (วันที่สิ้นสุดการตรวจสอบ) and Delay Sheet Col F (End Date) -> to Col K (วันที่ปิดตรวจ)
    const dateH = getRowDateVal(row, "วันที่สิ้นสุดการตรวจสอบ", 7);
    const approvedDelayEndDate = deptExtensionEndDateMap[normalizeDeptString(deptName)] || null;

    let effectiveEndDate = null;
    let effectiveEndDateStr = "";

    const parsedDateH = parseDate(dateH);
    if (parsedDateH && approvedDelayEndDate) {
      if (approvedDelayEndDate > parsedDateH) {
        effectiveEndDate = approvedDelayEndDate;
        effectiveEndDateStr = formatISODate(approvedDelayEndDate);
      } else {
        effectiveEndDate = parsedDateH;
        effectiveEndDateStr = dateH;
      }
    } else if (parsedDateH) {
      effectiveEndDate = parsedDateH;
      effectiveEndDateStr = dateH;
    } else if (approvedDelayEndDate) {
      effectiveEndDate = approvedDelayEndDate;
      effectiveEndDateStr = formatISODate(approvedDelayEndDate);
    }

    let draftDuration = null;
    let isDraftWarning = false;
    let draftDaysElapsed = null;

    if (effectiveEndDateStr && dateJ) {
      // dateJ is วันที่ปิดตรวจ (Col K / Index 10)
      draftDuration = dateDiffInDays(effectiveEndDateStr, dateJ);
      if (draftDuration !== null && draftDuration > 20) {
        isDraftWarning = true;
      }
    } else if (effectiveEndDate) {
      const now = new Date();
      now.setHours(0,0,0,0);
      const eDate = new Date(effectiveEndDate);
      eDate.setHours(0,0,0,0);
      if (now > eDate) {
        draftDaysElapsed = Math.floor((now - eDate) / (24 * 60 * 60 * 1000));
        if (draftDaysElapsed > 20) {
          isDraftWarning = true;
        }
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
      weekendDays: auditPlanCalc.weekendDays,
      holidayDays: auditPlanCalc.holidayDays,
      interruptedDays: nonAuditCount,
      aeDuration: aeDuration,
      ctsDuration: ctsDuration,
      ctsCycle: ctsCycle,
      isWarning: isWarning,
      draftDuration: draftDuration,
      isDraftWarning: isDraftWarning,
      draftDaysElapsed: draftDaysElapsed,
      clarifyDueDate: clarifyDueDateFormatted,
      clarifyDueDateObj: clarifyDueDateObj,
      reportDateToUnit: reportDateToUnit,
      clarifyDateFromUnit: clarifyDateFromUnit,
      clarifyDuration: clarifyDuration,
      isClarifiedOverdue: isClarifiedOverdue,
      daysSinceReport: daysSinceReport,
      isClarifyWarning: isClarifyWarning,
      isClarifyOverdue: isClarifyOverdue,
      isClarified: isClarified,
      isNoRecommendation: isNoRecommendation,
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
  
  // Format labels into multiline arrays for clean word-wrapping without tilting
  const labels = phaseStats.map(s => {
    const name = String(s.name || "").trim();
    if (name.includes("ก่อนเข้าตรวจ")) {
      return ["ก่อนเข้าตรวจ", "(รวมยังไม่ดำเนินการ)"];
    }
    if (name.includes("ระหว่างการตรวจสอบ")) {
      return ["ระหว่าง", "การตรวจสอบ"];
    }
    if (name.includes("ระหว่างร่างรายงาน")) {
      return ["ระหว่าง", "ร่างรายงาน"];
    }
    if (name.includes("รายงานผลการตรวจสอบ")) {
      return ["รายงานผล", "การตรวจสอบ"];
    }
    if (name.includes("ชี้แจงผลการดำเนินงาน") || name.includes("ชี้แจง")) {
      return ["ชี้แจงผล", "การดำเนินงาน"];
    }
    return [name];
  });

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
        barThickness: 'flex',
        maxBarThickness: 45
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 12
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function(tooltipItems) {
              const item = tooltipItems[0];
              const stat = phaseStats[item.dataIndex];
              return stat ? stat.name : '';
            },
            label: function(context) {
              return ` ${context.raw} ส่วนงาน`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { 
            precision: 0,
            font: {
              size: 11,
              weight: 'bold',
              family: "'Prompt', 'Sarabun', sans-serif"
            }
          },
          grid: { color: '#f1f5f9' }
        },
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            minRotation: 0,
            autoSkip: false,
            color: '#334155',
            font: function(context) {
              const width = context.chart.width;
              return {
                size: width < 480 ? 9.5 : (width < 768 ? 10.5 : 11.5),
                weight: 'bold',
                family: "'Prompt', 'Sarabun', sans-serif",
                lineHeight: 1.3
              };
            },
            padding: 6
          }
        }
      }
    }
  });
}
