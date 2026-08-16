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
    { code: "S", title: "เสร็จสมบูรณ์", col: "วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์" }
  ]
};

// Sequence for right-to-left status resolution: S -> R -> Q -> N -> M -> K -> J -> H -> G -> F -> E -> D
const STATUS_PRIORITY_ORDER = [
  { phase: "1.4", sub: "แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์", title: "เสร็จสมบูรณ์", isComplete: true },
  { phase: "1.4", sub: "วันที่เสนออธิการบดี_ชี้แจง", title: "ชี้แจงผล:เสนออธิการบดี" },
  { phase: "1.4", sub: "วันที่หน่วยรับตรวจชี้แจง", title: "ชี้แจงผล:หน่วยรับตรวจชี้แจง" },
  { phase: "1.3", sub: "วันที่เสนอ_คตส", title: "รายงานผล:เสนอ คตส." },
  { phase: "1.3", sub: "วันที่แจ้งหน่วยรับตรวจ_รายงาน", title: "รายงานผล:แจ้งหน่วยรับตรวจ" },
  { phase: "1.3", sub: "วันที่เสนออธิการบดี_รายงาน", title: "รายงานผล:เสนออธิการบดี" },
  { phase: "1.2", sub: "วันที่ปิดตรวจ", title: "ระหว่างตรวจสอบ:ประชุมปิดตรวจ" },
  { phase: "1.2", sub: "วันที่สิ้นสุดการตรวจสอบ", title: "ระหว่างตรวจสอบ:สิ้นสุดการตรวจสอบ" },
  { phase: "1.2", sub: "วันที่เริ่มตรวจสอบ", title: "ระหว่างตรวจสอบ:เปิดตรวจ/เริ่มตรวจสอบ" },
  { phase: "1.1", sub: "วันที่อนุมัติแผน", title: "ก่อนเข้าตรวจ:อนุมัติแผน" },
  { phase: "1.1", sub: "วันที่แจ้งเข้าตรวจ", title: "ก่อนเข้าตรวจ:แจ้งเข้าตรวจ" },
  { phase: "1.1", sub: "วันที่มอบหมายงาน", title: "ก่อนเข้าตรวจ:มอบหมายงาน" }
];

function processDashboardData(rawAuditList, holidaysList, nonAuditDaysList, delayList = []) {
  let completedCount = 0;

  // Build department extension days map from approved Delay requests
  const deptExtensionDaysMap = {};
  if (Array.isArray(delayList)) {
    delayList.forEach(item => {
      const dept = String(item.Department || item.department || item["ส่วนงาน"] || "").trim().toLowerCase();
      const status = String(item.DeanStatus || item.Status || item.status || "");
      if (dept && (status.includes("อนุมัติ") || status.includes("อนุมัติแล้ว"))) {
        const days = parseInt(item["Total number of days"] || item.totalDays || item["จำนวนวันรวมที่ขอขยาย"] || 0) || 0;
        deptExtensionDaysMap[dept] = (deptExtensionDaysMap[dept] || 0) + days;
      }
    });
  }

  const processedUnits = rawAuditList.map((row, idx) => {
    const deptName = row["ส่วนงาน"] || `ส่วนงาน ${idx + 1}`;
    const deptClean = String(deptName).trim().toLowerCase();
    const fiscalYear = row["ปีงบประมาณ"] || "";
    const team = row["ทีม"] || "";

    // 1. Determine Latest Status by checking right-to-left
    let latestStatusObj = null;
    let latestDateVal = "";
    let latestPhase = "1.1";
    let isCompleted = false;

    for (let item of STATUS_PRIORITY_ORDER) {
      const val = row[item.sub];
      if (val && String(val).trim() !== "") {
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

    if (!latestStatusObj) {
      latestStatusObj = { phase: "1.1", title: "ก่อนเข้าตรวจ:มอบหมายงาน" };
      latestDateVal = "-";
    }

    // 2.3 Calculate Planned Audit Days (G to H minus weekends and holidays)
    const startDateG = row["วันที่เริ่มตรวจสอบ"];
    const endDateH = row["วันที่สิ้นสุดการตรวจสอบ"];
    
    const auditCalc = calculateActualAuditDays(
      startDateG,
      endDateH,
      deptName,
      holidaysList,
      nonAuditDaysList
    );

    const plannedDays = auditCalc.actualDays + auditCalc.nonAuditDays; // Planned working days before deductions
    const approvedExtensionDays = deptExtensionDaysMap[deptClean] || 0;
    const totalActualAuditDays = Math.max(plannedDays + approvedExtensionDays - auditCalc.nonAuditDays, 0);

    // 2.4 Calculate Duration: Closed Audit (J) -> Report to President (K)
    const dateJ = row["วันที่ปิดตรวจ"];
    const dateK = row["วันที่เสนออธิการบดี_รายงาน"];
    const aeDuration = dateDiffInDays(dateJ, dateK);

    // 2.5 Calculate Duration: Closed Audit (J) -> Report to Audit Committee (N)
    const dateN = row["วันที่เสนอ_คตส"];
    let ctsDuration = dateDiffInDays(dateJ, dateN);
    const ctsCycle = row["ครั้งที่ประชุม_คตส"] || "";

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

    return {
      id: row._rowIndex || idx + 1,
      name: deptName,
      fiscalYear: fiscalYear,
      team: String(team),
      latestPhase: latestPhase,
      latestSubCol: latestStatusObj ? latestStatusObj.sub : "",
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
    };
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
