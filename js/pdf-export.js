/**
 * PDF Export Module for Internal Audit Tracking System
 * Generates formatted multi-page PDF summary report with explicit 3-section page structure
 * Supports both Single-Year and Multi-Year modes with per-year column breakdown & team categorization
 * Page break optimizations: Clean 2-column flow, continuous page packing, solid borders, no cutoffs
 */

function generatePdfReport(options) {
  let masterLists = [], rawAuditList = [], delayList = [], filteredUnits = [], unstartedUnitsList = [];
  let selectedFiscalYear = "ALL", selectedTeam = "ALL";
  let totalPlannedUnitsCount = 0, completedUnitsCount = 0, overallCompletionRate = 0;
  let fiscalYearOptions = ["2570", "2569"];
  let includeStatusDetails = true;

  if (options && typeof options === 'object' && !Array.isArray(options)) {
    masterLists = options.masterLists || [];
    rawAuditList = options.rawAuditList || [];
    delayList = options.delayList || [];
    filteredUnits = options.filteredUnits || [];
    unstartedUnitsList = options.unstartedUnitsList || [];
    selectedFiscalYear = options.selectedFiscalYear || "ALL";
    selectedTeam = options.selectedTeam || "ALL";
    totalPlannedUnitsCount = options.totalPlannedUnitsCount || 0;
    completedUnitsCount = options.completedUnitsCount || 0;
    overallCompletionRate = options.overallCompletionRate || 0;
    includeStatusDetails = options.includeStatusDetails !== undefined ? options.includeStatusDetails : true;
    if (options.parsedSchema && options.parsedSchema.years && options.parsedSchema.years.length > 0) {
      fiscalYearOptions = options.parsedSchema.years;
    }
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const parsedSchema = options.parsedSchema || {};

  // Determine list of active years for report
  const sortedYearOptions = [...fiscalYearOptions].sort((a,b) => a.localeCompare(b));
  let activeYears = [];
  
  const selectedYears = options.selectedFiscalYears || (options.selectedFiscalYear ? [options.selectedFiscalYear] : ["ALL"]);

  if (Array.isArray(selectedYears) && !selectedYears.includes("ALL") && selectedYears.length > 0) {
    activeYears = [...selectedYears].sort((a,b) => a.localeCompare(b));
  } else if (typeof selectedYears === "string" && selectedYears !== "ALL") {
    activeYears = [selectedYears];
  } else {
    activeYears = sortedYearOptions.length > 0 ? sortedYearOptions : ["2569", "2570"];
  }

  const isMultiYear = activeYears.length > 1;
  const orientation = (options && options.orientation) ? options.orientation : "landscape";

  // Helper to extract date value from raw row
  const getUnitDate = (u, colKey, colIdx) => {
    if (!u) return "";
    if (u.raw) {
      if (u.raw[colKey] && String(u.raw[colKey]).trim() !== "" && u.raw[colKey] !== "-") return String(u.raw[colKey]).trim();
      if (colIdx !== undefined) {
        if (u.raw[`_col${colIdx}`] && String(u.raw[`_col${colIdx}`]).trim() !== "" && u.raw[`_col${colIdx}`] !== "-") return String(u.raw[`_col${colIdx}`]).trim();
        if (u.raw[`col_${colIdx}`] && String(u.raw[`col_${colIdx}`]).trim() !== "" && u.raw[`col_${colIdx}`] !== "-") return String(u.raw[`col_${colIdx}`]).trim();
      }
    }
    return "";
  };

  // Build per-year statistics map
  const yearStatsMap = {};

  activeYears.forEach(yr => {
    const plannedForYr = parsedSchema.departmentsByYear && parsedSchema.departmentsByYear[yr]
      ? parsedSchema.departmentsByYear[yr]
      : [];

    const activeForYr = filteredUnits.filter(u => String(u.fiscalYear) === String(yr));

    const catCompletedYr = [];          // 2. ดำเนินการเสร็จสมบูรณ์
    const catReportedPresidentYr = [];   // 3. รายงานผลการตรวจสอบต่ออธิการบดีแล้ว
    const catClosingSummaryYr = [];     // 4. ระหว่างสรุปปิดตรวจ
    const catDraftingReportYr = [];     // 5. ระหว่างร่างรายงาน
    const catAuditingYr = [];           // 6. ระหว่างเข้าตรวจ
    const catBeforeAuditYr = [];        // 7. ยังไม่ได้ดำเนินการ (ส่วนก่อนเข้าตรวจ 1.1)

    activeForYr.forEach(u => {
      const item = {
        name: u.name,
        team: u.team,
        detail: u.statusFormatted || u.latestStatusTitle || ""
      };

      const dateG = getUnitDate(u, "วันที่เริ่มตรวจสอบ", 6);
      const dateH = getUnitDate(u, "วันที่สิ้นสุดการตรวจสอบ", 7);
      const dateK = getUnitDate(u, "วันที่ปิดตรวจ", 10);
      const dateL = getUnitDate(u, "วันที่เสนออธิการบดี_รายงาน", 11);
      const dateN = getUnitDate(u, "วันที่แจ้งหน่วยรับตรวจ_รายงาน", 13);
      const dateO = getUnitDate(u, "วันที่เสนอ_คตส", 14);
      const isNoRec = u.isNoRecommendation || String(u.clarifyDateFromUnit).includes("ไม่มีข้อเสนอแนะ");

      // Check if audit end date H has passed relative to today
      const pDateH = parseDate(dateH);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let isAuditEnded = false;
      if (pDateH) {
        const dH = new Date(pDateH);
        dH.setHours(0, 0, 0, 0);
        if (today >= dH) {
          isAuditEnded = true;
        }
      }

      if (u.isCompleted || isNoRec || u.latestPhase === "1.4" || (u.latestSubCol && u.latestSubCol.includes("เสร็จสมบูรณ์"))) {
        // 2. ดำเนินการเสร็จสมบูรณ์
        catCompletedYr.push(item);
      } else if (u.latestPhase === "1.3" || dateL || dateN || dateO) {
        // 3. รายงานผลการตรวจสอบต่ออธิการบดีแล้ว (มีวันที่ใน Col L, N, O)
        catReportedPresidentYr.push(item);
      } else if (dateK || (u.latestSubCol && (u.latestSubCol === "วันที่ปิดตรวจ" || u.latestSubCol.includes("ปิดตรวจ")))) {
        // 4. ระหว่างสรุปปิดตรวจ (มีวันที่ใน Col K)
        catClosingSummaryYr.push(item);
      } else if (dateH && isAuditEnded) {
        // 5. ระหว่างร่างรายงาน (มีวันที่สิ้นสุดการตรวจ Col H และถึง/เลยวันสิ้นสุดแล้ว)
        catDraftingReportYr.push(item);
      } else if (dateG || (dateH && !isAuditEnded) || (u.latestSubCol && (u.latestSubCol.includes("เริ่มตรวจสอบ") || u.latestSubCol.includes("ระหว่างการตรวจสอบ")))) {
        // 6. ระหว่างเข้าตรวจ (มีวันที่เริ่มตรวจ Col G หรือวันสิ้นสุดยังไม่ถึงวันปัจจุบัน)
        catAuditingYr.push(item);
      } else {
        // 7. ยังไม่ได้ดำเนินการ (Phase 1.1 มอบหมายงาน / แจ้งเข้าตรวจ / อนุมัติแผน)
        catBeforeAuditYr.push({
          name: u.name,
          team: u.team,
          year: yr
        });
      }
    });

    const unstartedForYr = unstartedUnitsList.filter(u => !u.year || String(u.year) === String(yr));
    const allUnstartedForYr = [...catBeforeAuditYr, ...unstartedForYr];

    const totalPlannedYr = Math.max(plannedForYr.length, activeForYr.length + unstartedForYr.length) || 1;

    yearStatsMap[yr] = {
      year: yr,
      totalPlanned: totalPlannedYr,
      completed: catCompletedYr,
      reportedPresident: catReportedPresidentYr,
      closingSummary: catClosingSummaryYr,
      draftingReport: catDraftingReportYr,
      auditing: catAuditingYr,
      unstarted: allUnstartedForYr,
      unstartedByTeam: {
        "1": allUnstartedForYr.filter(u => String(u.team).replace(/^ทีม\s*/, "") === "1"),
        "2": allUnstartedForYr.filter(u => String(u.team).replace(/^ทีม\s*/, "") === "2"),
        "3": allUnstartedForYr.filter(u => String(u.team).replace(/^ทีม\s*/, "") === "3"),
        "4": allUnstartedForYr.filter(u => !["1", "2", "3"].includes(String(u.team).replace(/^ทีม\s*/, "")))
      }
    };
  });

  // Combined totals across active years
  const combinedTotalPlanned = activeYears.reduce((sum, yr) => sum + yearStatsMap[yr].totalPlanned, 0) || 1;
  const combinedCompleted = activeYears.reduce((sum, yr) => sum + yearStatsMap[yr].completed.length, 0);
  const combinedReportedPresident = activeYears.reduce((sum, yr) => sum + yearStatsMap[yr].reportedPresident.length, 0);
  const combinedClosingSummary = activeYears.reduce((sum, yr) => sum + yearStatsMap[yr].closingSummary.length, 0);
  const combinedDraftingReport = activeYears.reduce((sum, yr) => sum + yearStatsMap[yr].draftingReport.length, 0);
  const combinedAuditing = activeYears.reduce((sum, yr) => sum + yearStatsMap[yr].auditing.length, 0);
  const combinedUnstarted = activeYears.reduce((sum, yr) => sum + yearStatsMap[yr].unstarted.length, 0);

  // Line 3 Header Fiscal Year Text
  let yearText = "";
  if (!isMultiYear) {
    yearText = `ปีงบประมาณ พ.ศ. ${activeYears[0]}`;
  } else {
    yearText = `ปีงบประมาณ พ.ศ. ${activeYears.join(' - ')}`;
  }

  const todayStr = formatDateDMY(new Date());

  // Render Table Header & Body HTML
  let tableHeaderHTML = "";
  let tableBodyHTML = "";

  if (isMultiYear) {
    tableHeaderHTML = `
      <tr style="background-color: #B889CF; color: #ffffff;">
        <th style="padding: 8px 10px; border: 1px solid #a372bb; background-color: #B889CF !important; color: #ffffff !important; font-size: 10.5pt; text-align: left; vertical-align: middle; width: 34%; font-weight: bold;">สถานะการดำเนินงาน</th>
        ${activeYears.map(yr => `
          <th style="padding: 8px 4px; border: 1px solid #a372bb; background-color: #B889CF !important; color: #ffffff !important; text-align: center !important; vertical-align: middle !important; font-size: 10pt; line-height: 1.25; width: 11%; font-weight: bold;">จำนวนส่วนงาน<br>${yr}</th>
          <th style="padding: 8px 4px; border: 1px solid #a372bb; background-color: #B889CF !important; color: #ffffff !important; text-align: center !important; vertical-align: middle !important; font-size: 10pt; line-height: 1.25; width: 11%; font-weight: bold;">สัดส่วน (%)<br>${yr}</th>
        `).join('')}
        <th style="padding: 8px 4px; border: 1px solid #a372bb; background-color: #B889CF !important; color: #ffffff !important; text-align: center !important; vertical-align: middle !important; font-size: 10pt; line-height: 1.25; width: 11%; font-weight: bold;">จำนวนรวม<br>(${activeYears.length} ปี)</th>
        <th style="padding: 8px 4px; border: 1px solid #a372bb; background-color: #B889CF !important; color: #ffffff !important; text-align: center !important; vertical-align: middle !important; font-size: 10pt; line-height: 1.25; width: 11%; font-weight: bold;">สัดส่วนรวม<br>(%)</th>
      </tr>
    `;

    tableBodyHTML = `
      <tr style="background-color: #f6ecfc;">
        <td style="padding: 8px 10px; border: 1px solid #d4b2e6; font-weight: 800; font-size: 10.5pt; color: #5e327a; line-height: 1.3; word-break: break-word;">1. จำนวนหน่วยรับตรวจทั้งหมด ตามแผนการตรวจสอบประจำปี</td>
        ${activeYears.map(yr => `
          <td style="padding: 8px 4px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #5e327a;">${yearStatsMap[yr].totalPlanned}</td>
          <td style="padding: 8px 4px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #6b3e80;">100.0%</td>
        `).join('')}
        <td style="padding: 8px 4px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #5e327a;">${combinedTotalPlanned}</td>
        <td style="padding: 8px 4px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #6b3e80;">100.0%</td>
      </tr>
      <tr style="background-color: #f0fdf4;">
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #166534; line-height: 1.3;">2. ดำเนินการเสร็จสมบูรณ์ (ชี้แจงผลการดำเนินงานตามข้อเสนอแนะแล้ว)</td>
        ${activeYears.map(yr => `
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #166534;">${yearStatsMap[yr].completed.length}</td>
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #166534;">${((yearStatsMap[yr].completed.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #166534;">${combinedCompleted}</td>
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #166534;">${((combinedCompleted / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #f0fdf9;">
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #065f46; line-height: 1.3;">3. รายงานผลการตรวจสอบต่ออธิการบดีแล้ว</td>
        ${activeYears.map(yr => `
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #065f46;">${yearStatsMap[yr].reportedPresident.length}</td>
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #065f46;">${((yearStatsMap[yr].reportedPresident.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #065f46;">${combinedReportedPresident}</td>
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #065f46;">${((combinedReportedPresident / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #f7fee7;">
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #3f6212; line-height: 1.3;">4. ระหว่างสรุปปิดตรวจ</td>
        ${activeYears.map(yr => `
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #3f6212;">${yearStatsMap[yr].closingSummary.length}</td>
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #3f6212;">${((yearStatsMap[yr].closingSummary.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #3f6212;">${combinedClosingSummary}</td>
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #3f6212;">${((combinedClosingSummary / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #fefce8;">
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #854d0e; line-height: 1.3;">5. ระหว่างร่างรายงาน</td>
        ${activeYears.map(yr => `
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #854d0e;">${yearStatsMap[yr].draftingReport.length}</td>
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #854d0e;">${((yearStatsMap[yr].draftingReport.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #854d0e;">${combinedDraftingReport}</td>
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #854d0e;">${((combinedDraftingReport / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #fff1f2;">
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #9f1239; line-height: 1.3;">6. ระหว่างเข้าตรวจ</td>
        ${activeYears.map(yr => `
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #9f1239;">${yearStatsMap[yr].auditing.length}</td>
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #9f1239;">${((yearStatsMap[yr].auditing.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #9f1239;">${combinedAuditing}</td>
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #9f1239;">${((combinedAuditing / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; line-height: 1.3;">7. ยังไม่ได้ดำเนินการ</td>
        ${activeYears.map(yr => `
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #475569;">${yearStatsMap[yr].unstarted.length}</td>
          <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #475569;">${((yearStatsMap[yr].unstarted.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #475569;">${combinedUnstarted}</td>
        <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #475569;">${((combinedUnstarted / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
    `;
  } else {
    // Single Year Table
    const yr = activeYears[0] || "2570";
    const stats = yearStatsMap[yr] || {
      totalPlanned: combinedTotalPlanned,
      completed: [], reportedPresident: [], closingSummary: [], draftingReport: [], auditing: [], unstarted: []
    };
    const yrPct = (count) => ((count / stats.totalPlanned) * 100).toFixed(1) + "%";

    tableHeaderHTML = `
      <tr style="background-color: #B889CF; color: #ffffff;">
        <th style="padding: 9px 14px; border: 1px solid #a372bb; background-color: #B889CF !important; color: #ffffff !important; font-size: 11pt; text-align: left; vertical-align: middle; font-weight: bold;">สถานะการดำเนินงาน</th>
        <th style="padding: 9px 8px; border: 1px solid #a372bb; background-color: #B889CF !important; color: #ffffff !important; text-align: center !important; vertical-align: middle !important; width: 160px; font-size: 11pt; white-space: nowrap; font-weight: bold;">
          <div style="text-align: center; margin: 0 auto; width: 100%;">จำนวน (ส่วนงาน)</div>
        </th>
        <th style="padding: 9px 8px; border: 1px solid #a372bb; background-color: #B889CF !important; color: #ffffff !important; text-align: center !important; vertical-align: middle !important; width: 130px; font-size: 11pt; white-space: nowrap; font-weight: bold;">
          <div style="text-align: center; margin: 0 auto; width: 100%;">สัดส่วน (%)</div>
        </th>
      </tr>
    `;

    tableBodyHTML = `
      <tr style="background-color: #f6ecfc;">
        <td style="padding: 8px 14px; border: 1px solid #d4b2e6; font-weight: bold; font-size: 10.5pt; color: #5e327a; line-height: 1.3;">1. จำนวนหน่วยรับตรวจทั้งหมด ตามแผนการตรวจสอบประจำปี</td>
        <td style="padding: 8px 8px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: bold; font-size: 11pt; color: #5e327a;">${stats.totalPlanned}</td>
        <td style="padding: 8px 8px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: bold; font-size: 11pt; color: #6b3e80;">100.0%</td>
      </tr>
      <tr style="background-color: #f0fdf4;">
        <td style="padding: 7px 14px; border: 1px solid #cbd5e1; font-weight: bold; color: #166534; line-height: 1.3; font-size: 10.5pt;">2. ดำเนินการเสร็จสมบูรณ์ (ชี้แจงผลการดำเนินงานตามข้อเสนอแนะแล้ว)</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #166534; font-size: 11pt;">${stats.completed.length}</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #166534; font-size: 11pt;">${yrPct(stats.completed.length)}</td>
      </tr>
      <tr style="background-color: #f0fdf9;">
        <td style="padding: 7px 14px; border: 1px solid #cbd5e1; font-weight: bold; color: #065f46; line-height: 1.3; font-size: 10.5pt;">3. รายงานผลการตรวจสอบต่ออธิการบดีแล้ว</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #065f46; font-size: 11pt;">${stats.reportedPresident.length}</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #065f46; font-size: 11pt;">${yrPct(stats.reportedPresident.length)}</td>
      </tr>
      <tr style="background-color: #f7fee7;">
        <td style="padding: 7px 14px; border: 1px solid #cbd5e1; font-weight: bold; color: #3f6212; line-height: 1.3; font-size: 10.5pt;">4. ระหว่างสรุปปิดตรวจ</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #3f6212; font-size: 11pt;">${stats.closingSummary.length}</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #3f6212; font-size: 11pt;">${yrPct(stats.closingSummary.length)}</td>
      </tr>
      <tr style="background-color: #fefce8;">
        <td style="padding: 7px 14px; border: 1px solid #cbd5e1; font-weight: bold; color: #854d0e; line-height: 1.3; font-size: 10.5pt;">5. ระหว่างร่างรายงาน</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #854d0e; font-size: 11pt;">${stats.draftingReport.length}</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #854d0e; font-size: 11pt;">${yrPct(stats.draftingReport.length)}</td>
      </tr>
      <tr style="background-color: #fff1f2;">
        <td style="padding: 7px 14px; border: 1px solid #cbd5e1; font-weight: bold; color: #9f1239; line-height: 1.3; font-size: 10.5pt;">6. ระหว่างเข้าตรวจ</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #9f1239; font-size: 11pt;">${stats.auditing.length}</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #9f1239; font-size: 11pt;">${yrPct(stats.auditing.length)}</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 7px 14px; border: 1px solid #cbd5e1; font-weight: bold; color: #475569; line-height: 1.3; font-size: 10.5pt;">7. ยังไม่ได้ดำเนินการ</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #475569; font-size: 11pt;">${stats.unstarted.length}</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: bold; color: #475569; font-size: 11pt;">${yrPct(stats.unstarted.length)}</td>
      </tr>
    `;
  }

  // Build Section 2 Page Blocks with Continuous Dynamic Packing
  const buildSection2Pages = (yr, stats) => {
    const yrPct = (count) => ((count / stats.totalPlanned) * 100).toFixed(1) + "%";

    const allCategories = [
      {
        num: 2,
        title: `2. ดำเนินการเสร็จสมบูรณ์ (ชี้แจงผลการดำเนินงานตามข้อเสนอแนะแล้ว) (${stats.completed.length} ส่วนงาน - ${yrPct(stats.completed.length)})`,
        headerBg: "#86E3CE",
        headerColor: "#0E5C4B",
        bodyBg: "#EFFCF9",
        borderColor: "#86E3CE",
        items: stats.completed
      },
      {
        num: 3,
        title: `3. รายงานผลการตรวจสอบต่ออธิการบดีแล้ว (${stats.reportedPresident.length} ส่วนงาน - ${yrPct(stats.reportedPresident.length)})`,
        headerBg: "#A7F3D0",
        headerColor: "#065F46",
        bodyBg: "#F0FDF4",
        borderColor: "#6EE7B7",
        items: stats.reportedPresident
      },
      {
        num: 4,
        title: `4. ระหว่างสรุปปิดตรวจ (${stats.closingSummary.length} ส่วนงาน - ${yrPct(stats.closingSummary.length)})`,
        headerBg: "#D0E6A5",
        headerColor: "#3D5A14",
        bodyBg: "#F6FBF0",
        borderColor: "#D0E6A5",
        items: stats.closingSummary
      },
      {
        num: 5,
        title: `5. ระหว่างร่างรายงาน (${stats.draftingReport.length} ส่วนงาน - ${yrPct(stats.draftingReport.length)})`,
        headerBg: "#FFDD94",
        headerColor: "#7A5200",
        bodyBg: "#FFF9EC",
        borderColor: "#FFDD94",
        items: stats.draftingReport
      },
      {
        num: 6,
        title: `6. ระหว่างเข้าตรวจ (${stats.auditing.length} ส่วนงาน - ${yrPct(stats.auditing.length)})`,
        headerBg: "#FA897B",
        headerColor: "#9A2C1E",
        bodyBg: "#FFF0EE",
        borderColor: "#FA897B",
        items: stats.auditing
      }
    ];

    const renderCardHTML = (cat, items, isContinuation = false) => {
      const cardTitle = isContinuation ? `${cat.title} (ต่อ)` : cat.title;
      const isLandscape = orientation === 'landscape';
      const compactHeaderPadding = !includeStatusDetails ? (isLandscape ? '3px 8px' : '4px 8px') : '5px 10px';
      const compactHeaderFontSize = !includeStatusDetails ? (isLandscape ? '8.5pt' : '9.5pt') : '10pt';
      const compactBodyPadding = !includeStatusDetails ? (isLandscape ? '2px 5px' : '4px 6px') : '6px 8px';
      const cardMarginBottom = !includeStatusDetails ? (isLandscape ? '4px' : '6px') : '8px';

      return `
        <div style="margin-bottom: ${cardMarginBottom}; border: 1.5px solid ${cat.borderColor}; border-radius: 5px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: ${cat.headerBg}; padding: ${compactHeaderPadding}; font-weight: 800; font-size: ${compactHeaderFontSize}; color: ${cat.headerColor}; border-bottom: 1px solid ${cat.borderColor}; font-family: 'Sarabun', sans-serif;">
            ${cardTitle}
          </div>
          <div style="padding: ${compactBodyPadding}; background-color: ${cat.bodyBg};">
            ${renderCategoryListHTML(items, includeStatusDetails, orientation)}
          </div>
        </div>
      `;
    };

    if (!includeStatusDetails) {
      // Single Page Mode for Section 2 when no status details: All active categories in 1 page!
      const activeCards = allCategories
        .filter(cat => cat.items && cat.items.length > 0)
        .map(cat => renderCardHTML(cat, cat.items));

      const isLandscape = orientation === 'landscape';
      return [`
        <div style="margin-bottom: ${isLandscape ? '6px' : '10px'}; border: 2px solid #B889CF; border-radius: 6px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #f6ecfc; padding: ${isLandscape ? '4px 10px' : '6px 12px'}; font-weight: 800; font-size: ${isLandscape ? '10pt' : '11pt'}; color: #5e327a; border-bottom: 1px solid #B889CF; font-family: 'Sarabun', sans-serif;">
            📅 รายละเอียดงานตรวจสอบ ปีงบประมาณ พ.ศ. ${yr} (ทั้งหมด ${stats.totalPlanned} ส่วนงาน)
          </div>
          <div style="padding: ${isLandscape ? '4px 6px' : '6px 8px'}; background-color: #ffffff;">
            ${activeCards.join('')}
          </div>
        </div>
      `];
    }

    let MAX_PAGE_ROWS = 12;
    let colsForPaging = 2;

    if (includeStatusDetails) {
      if (orientation === 'landscape') {
        MAX_PAGE_ROWS = 8;   // 8 rows * 3 cols = 24 items per page
        colsForPaging = 3;
      } else {
        MAX_PAGE_ROWS = 12;  // 12 rows * 2 cols = 24 items per page (safely fits inside A4 Portrait without row splitting)
        colsForPaging = 2;
      }
    } else {
      if (orientation === 'landscape') {
        MAX_PAGE_ROWS = 16;  // 16 rows * 5 cols = 80 items
        colsForPaging = 5;
      } else {
        MAX_PAGE_ROWS = 22;  // 22 rows * 3 cols = 66 items
        colsForPaging = 3;
      }
    }

    const pages = [];
    let currentPageCards = [];
    let currentRows = 0;

    allCategories.forEach(cat => {
      if (!cat.items || cat.items.length === 0) return;

      let remainingItems = [...cat.items];
      let isFirstChunk = true;

      while (remainingItems.length > 0) {
        const itemRows = Math.ceil(remainingItems.length / colsForPaging);
        const cardRows = itemRows + 2;

        if (currentRows + cardRows <= MAX_PAGE_ROWS || currentRows === 0) {
          currentPageCards.push(renderCardHTML(cat, remainingItems, !isFirstChunk));
          currentRows += cardRows;
          remainingItems = [];
        } else {
          const availableItemRows = Math.max(MAX_PAGE_ROWS - currentRows - 2, 0);
          const availableItems = availableItemRows * colsForPaging;

          if (availableItems >= 4 && remainingItems.length > availableItems) {
            const chunk = remainingItems.slice(0, availableItems);
            remainingItems = remainingItems.slice(availableItems);
            currentPageCards.push(renderCardHTML(cat, chunk, !isFirstChunk));
            isFirstChunk = false;

            pages.push(currentPageCards);
            currentPageCards = [];
            currentRows = 0;
          } else {
            if (currentPageCards.length > 0) {
              pages.push(currentPageCards);
              currentPageCards = [];
              currentRows = 0;
            }
            const freshMaxItemRows = Math.max(MAX_PAGE_ROWS - 2, 2);
            const freshMaxItems = freshMaxItemRows * colsForPaging;
            if (remainingItems.length > freshMaxItems) {
              const chunk = remainingItems.slice(0, freshMaxItems);
              remainingItems = remainingItems.slice(freshMaxItems);
              currentPageCards.push(renderCardHTML(cat, chunk, !isFirstChunk));
              isFirstChunk = false;
              pages.push(currentPageCards);
              currentPageCards = [];
              currentRows = 0;
            } else {
              currentPageCards.push(renderCardHTML(cat, remainingItems, !isFirstChunk));
              currentRows += Math.ceil(remainingItems.length / colsForPaging) + 2;
              remainingItems = [];
            }
          }
        }
      }
    });

    if (currentPageCards.length > 0) {
      pages.push(currentPageCards);
    }

    return pages.map((cardsHTML, pIdx) => `
      <div style="margin-bottom: 10px; border: 2px solid #B889CF; border-radius: 6px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
        <div style="background-color: #f6ecfc; padding: 5px 10px; font-weight: 800; font-size: 10.5pt; color: #5e327a; border-bottom: 1px solid #B889CF; font-family: 'Sarabun', sans-serif;">
          📅 รายละเอียดงานตรวจสอบ ปีงบประมาณ พ.ศ. ${yr} (ทั้งหมด ${stats.totalPlanned} ส่วนงาน)${pIdx > 0 ? ' (ต่อ)' : ''}
        </div>
        <div style="padding: 6px 8px; background-color: #ffffff;">
          ${cardsHTML.join('')}
        </div>
      </div>
    `);
  };

  const section2PageBlocks = [];
  activeYears.forEach(yr => {
    const stats = yearStatsMap[yr];
    const yrBlocks = buildSection2Pages(yr, stats);
    yrBlocks.forEach(b => section2PageBlocks.push(b));
  });

  // Build Section 3 Page Blocks (Unstarted Units with Clean Multi-column Flow & Solid Borders)
  const section3PageBlocks = [];
  activeYears.forEach(yr => {
    const stats = yearStatsMap[yr];
    const yrPct = (count) => ((count / stats.totalPlanned) * 100).toFixed(1) + "%";
    const headerTitle = `📅 รายชื่อส่วนงานที่ยังไม่ได้ดำเนินการ ปีงบประมาณ พ.ศ. ${yr} (รวม ${stats.unstarted.length} ส่วนงาน - ${yrPct(stats.unstarted.length)})`;

    const t1 = stats.unstartedByTeam["1"] || [];
    const t2 = stats.unstartedByTeam["2"] || [];
    const t3 = stats.unstartedByTeam["3"] || [];
    const t4 = stats.unstartedByTeam["4"] || [];
    const totalCount = t1.length + t2.length + t3.length + t4.length;
    const splitThreshold = orientation === 'landscape' ? 48 : 28;

    if (totalCount > splitThreshold) {
      // Split into 2 clean pages:
      section3PageBlocks.push(`
        <div style="margin-bottom: 10px; border: 2px solid #B889CF; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #B889CF; color: #ffffff; padding: 6px 12px; font-weight: 800; font-size: 11pt; font-family: 'Sarabun', sans-serif;">
            ${headerTitle}
          </div>
          <div style="padding: 8px; background-color: #fdf8ff;">
            ${renderTeamsListHTML({ "1": t1, "2": t2 }, orientation)}
          </div>
        </div>
      `);

      section3PageBlocks.push(`
        <div style="margin-bottom: 10px; border: 2px solid #B889CF; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #B889CF; color: #ffffff; padding: 6px 12px; font-weight: 800; font-size: 11pt; font-family: 'Sarabun', sans-serif;">
            ${headerTitle} (ต่อ)
          </div>
          <div style="padding: 8px; background-color: #fdf8ff;">
            ${renderTeamsListHTML({ "3": t3, "4": t4 }, orientation)}
          </div>
        </div>
      `);
    } else {
      section3PageBlocks.push(`
        <div style="margin-bottom: 10px; border: 2px solid #B889CF; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #B889CF; color: #ffffff; padding: 6px 12px; font-weight: 800; font-size: 11pt; font-family: 'Sarabun', sans-serif;">
            ${headerTitle}
          </div>
          <div style="padding: 8px; background-color: #fdf8ff;">
            ${renderTeamsListHTML({ "1": t1, "2": t2, "3": t3, "4": t4 }, orientation)}
          </div>
        </div>
      `);
    }
  });

  // CTS Meeting text
  let ctsText = "";
  const meetingNum = (options.ctsMeetingNumber !== undefined && options.ctsMeetingNumber !== null) 
    ? String(options.ctsMeetingNumber).trim() 
    : "";

  if (meetingNum) {
    const cleanNum = meetingNum.includes("ครั้งที่") ? meetingNum : `ครั้งที่ ${meetingNum}`;
    ctsText = `การประชุมคณะกรรมการตรวจสอบ มหาวิทยาลัยเชียงใหม่ ${cleanNum}`;
  } else {
    ctsText = `การประชุมคณะกรรมการตรวจสอบ มหาวิทยาลัยเชียงใหม่`;
  }

  // Calculate Total Exact Pages in Document
  const totalExactPages = 1 + section2PageBlocks.length + section3PageBlocks.length;
  let pageCounter = 1;

  // Build Full HTML Document with clean page-break-before structure
  let pagesHTML = '';

  const pageWrapperPadding = orientation === 'landscape' ? '10px 14px 10px 14px' : '12px 16px 14px 16px';
  const sectionTitleFontSize = orientation === 'landscape' ? '12pt' : '13pt';
  const sectionTitleMargin = orientation === 'landscape' ? '0 0 8px 0' : '0 0 10px 0';

  // Page 1: Executive Summary
  pagesHTML += `
    <div style="padding: ${pageWrapperPadding}; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; font-family: 'Tahoma', 'Sarabun', sans-serif;">
      <!-- Header Title -->
      <div style="text-align: center; border-bottom: 3px solid #B889CF; padding-bottom: ${orientation === 'landscape' ? '6px' : '8px'}; margin-bottom: ${orientation === 'landscape' ? '10px' : '14px'};">
        <div style="margin: 0; font-size: ${orientation === 'landscape' ? '14pt' : '15pt'}; font-weight: bold; color: #5e327a; line-height: 1.35; font-family: 'Tahoma', 'Sarabun', sans-serif !important;">
          สรุปผลการปฏิบัติงานตามแผนการตรวจสอบ
        </div>
        <div style="margin: 3px 0 0 0; font-size: 10.5pt; font-weight: bold; color: #6b3e80; line-height: 1.35; font-family: 'Tahoma', 'Sarabun', sans-serif !important;">
          สำนักงานการตรวจสอบภายใน | ข้อมูล ณ วันที่ ${todayStr}
        </div>
        <div style="margin: 4px 0 0 0; font-size: 10.5pt; font-weight: bold; color: #5e327a; background-color: #f6ecfc; display: inline-block; padding: 3px 16px; border-radius: 6px; border: 1px solid #B889CF; line-height: 1.35; font-family: 'Tahoma', 'Sarabun', sans-serif !important;">
          ${yearText}
        </div>
        <div style="margin: 4px 0 0 0; font-size: 10.5pt; font-weight: bold; color: #5e327a; line-height: 1.35; font-family: 'Tahoma', 'Sarabun', sans-serif !important;">
          ${ctsText}
        </div>
      </div>

      <!-- Section 1 Title -->
      <div style="margin-bottom: ${orientation === 'landscape' ? '8px' : '12px'};">
        <div style="font-size: ${sectionTitleFontSize}; font-weight: bold; color: #5e327a; margin: 0 0 4px 0; padding-bottom: 3px; border-bottom: 2px solid #B889CF; line-height: 1.35; font-family: 'Tahoma', 'Sarabun', sans-serif !important;">
          ส่วนที่ 1: หน้าสรุปภาพรวม (Executive Summary)
        </div>
        <p style="font-size: 10pt; color: #64748b; margin: 0; line-height: 1.35; font-family: 'Tahoma', 'Sarabun', sans-serif !important;">
          สรุปสัดส่วนการดำเนินงานจำแนกตามสถานะเปรียบเทียบกับจำนวนหน่วยรับตรวจตามแผนประจำปี ${isMultiYear ? `(เปรียบเทียบแยกตามปีงบประมาณ ${activeYears.join(', ')})` : ''}
        </p>
      </div>

      <!-- Executive Summary Table -->
      ${tableHeaderHTML ? `<table style="width: 100%; border-collapse: collapse; text-align: left; font-size: ${orientation === 'landscape' ? '9.5pt' : '10pt'}; margin-bottom: 12px; table-layout: fixed; font-family: 'Tahoma', 'Sarabun', sans-serif !important;"><thead>${tableHeaderHTML}</thead><tbody>${tableBodyHTML}</tbody></table>` : ''}

      <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 4px; text-align: right; font-size: 8.5pt; color: #64748b; font-family: 'Tahoma', 'Sarabun', sans-serif !important;">
        หน้า ${pageCounter++}/${totalExactPages} (หน้าสรุปภาพรวม)
      </div>
    </div>
  `;

  // Section 2 Pages (Explicit page-break-before on every Section 2 block)
  section2PageBlocks.forEach((blockHTML, bIdx) => {
    pagesHTML += `
      <div style="padding: ${pageWrapperPadding}; page-break-before: always; break-before: page; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; font-family: 'Tahoma', 'Sarabun', sans-serif;">
        <div style="font-size: ${sectionTitleFontSize}; font-weight: bold; color: #5e327a; margin: ${sectionTitleMargin}; padding-bottom: 3px; border-bottom: 2px solid #B889CF; line-height: 1.35; font-family: 'Tahoma', 'Sarabun', sans-serif !important;">
          ส่วนที่ 2: รายละเอียดสถานะงานตรวจสอบที่อยู่ระหว่างดำเนินการและเสร็จสมบูรณ์
        </div>
        
        ${blockHTML}

        <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 4px; text-align: right; font-size: 8.5pt; color: #64748b; font-family: 'Tahoma', 'Sarabun', sans-serif !important;">
          หน้า ${pageCounter++}/${totalExactPages} (รายชื่อส่วนงานที่อยู่ระหว่างดำเนินการและเสร็จสมบูรณ์${bIdx > 0 ? ' - ต่อ' : ''})
        </div>
      </div>
    `;
  });

  // Section 3 Pages (Explicit page-break-before on every Section 3 block)
  section3PageBlocks.forEach((blockHTML, bIdx) => {
    pagesHTML += `
      <div style="padding: ${pageWrapperPadding}; page-break-before: always; break-before: page; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; font-family: 'Tahoma', 'Sarabun', sans-serif;">
        <div style="font-size: ${sectionTitleFontSize}; font-weight: bold; color: #5e327a; margin: ${sectionTitleMargin}; padding-bottom: 3px; border-bottom: 2px solid #B889CF; line-height: 1.35; font-family: 'Tahoma', 'Sarabun', sans-serif !important;">
          ส่วนที่ 3: รายชื่อส่วนงานที่ยังไม่ได้ดำเนินการ (แยกตามงานตรวจสอบ)
        </div>
        
        ${blockHTML}

        <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 4px; text-align: right; font-size: 8.5pt; color: #64748b; font-family: 'Tahoma', 'Sarabun', sans-serif !important;">
          หน้า ${pageCounter++}/${totalExactPages} (ส่วนงานที่ยังไม่ได้ดำเนินการ${bIdx > 0 ? ' - ต่อ' : ''})
        </div>
      </div>
    `;
  });

  const htmlContent = `
    <style>
      .pdf-export-container, .pdf-export-container * {
        font-family: 'Sarabun', 'TH Sarabun New', sans-serif !important;
        box-sizing: border-box;
      }
      tr, td, table, .page-block {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    </style>
    <div class="pdf-export-container" style="font-family: 'Sarabun', 'TH Sarabun New', sans-serif !important; color: #1e293b; line-height: 1.45; font-size: 10.5pt; background: #ffffff; width: 100%; box-sizing: border-box;">
      ${pagesHTML}
    </div>
  `;

  // Create temporary container
  const element = document.createElement("div");
  element.innerHTML = htmlContent;
  document.body.appendChild(element);

  // Configure html2pdf options
  const opt = {
    margin: [6, 6, 6, 6],
    filename: `Internal_Audit_Report_${new Date().toISOString().slice(0,10)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      scrollY: 0,
      logging: false
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: orientation },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'td', 'table', 'div'] }
  };

  if (window.html2pdf) {
    window.html2pdf().set(opt).from(element).save().then(() => {
      if (element.parentNode) document.body.removeChild(element);
    }).catch(err => {
      console.error("PDF generation failed:", err);
      if (element.parentNode) document.body.removeChild(element);
    });
  } else {
    // Print fallback
    const printWin = window.open('', '_blank');
    printWin.document.write(`<html><head><title>Audit Report</title></head><body style="font-family: 'Tahoma', sans-serif;">${htmlContent}</body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      if (element.parentNode) document.body.removeChild(element);
    }, 500);
  }
}

// Smart Thai word segmentation helper to prevent html2canvas line-wrap collisions
function formatDeptNameForPdf(name) {
  if (!name) return "";
  let str = String(name).trim();

  // Explicit line-broken mappings for compound CMU departments
  const knownMappings = {
    "ศูนย์บริการวิชาการและถ่ายทอดเทคโนโลยีการเกษตร คณะเกษตรศาสตร์": "ศูนย์บริการวิชาการ<br>และถ่ายทอดเทคโนโลยีการเกษตร<br>คณะเกษตรศาสตร์",
    "ศูนย์บริการวิทยาศาสตร์และเทคโนโลยี คณะวิทยาศาสตร์": "ศูนย์บริการวิทยาศาสตร์<br>และเทคโนโลยี คณะวิทยาศาสตร์",
    "สำนักงานมหาวิทยาลัย - ศูนย์บริหารจัดการเมืองเพื่อความยั่งยืน": "สำนักงานมหาวิทยาลัย -<br>ศูนย์บริหารจัดการเมืองเพื่อความยั่งยืน",
    "สำนักงานมหาวิทยาลัย-ศูนย์บริหารจัดการเมืองเพื่อความยั่งยืน": "สำนักงานมหาวิทยาลัย -<br>ศูนย์บริหารจัดการเมืองเพื่อความยั่งยืน",
    "ศูนย์บริหารจัดการเมืองเพื่อความยั่งยืน": "ศูนย์บริหารจัดการ<br>เมืองเพื่อความยั่งยืน",
    "สำนักงานบริหารและจัดการทรัพย์สิน": "สำนักงานบริหาร<br>และจัดการทรัพย์สิน",
    "สถาบันวิจัยวิทยาศาสตร์สุขภาพ": "สถาบันวิจัย<br>วิทยาศาสตร์สุขภาพ",
    "ศูนย์ส่งเสริมพฤฒพลังผู้สูงอายุ มช.": "ศูนย์ส่งเสริมพฤฒพลัง<br>ผู้สูงอายุ มช.",
    "ศูนย์นวัตกรรมและการจัดการความรู้ วิทยาลัยศิลปะ สื่อ และเทคโนโลยี": "ศูนย์นวัตกรรมและการจัดการความรู้<br>วิทยาลัยศิลปะ สื่อ และเทคโนโลยี",
    "ศูนย์วิจัยและบริการวิชาการนานาชาติ วิทยาลัยนานาชาตินวัตกรรมดิจิทัล": "ศูนย์วิจัยและบริการวิชาการนานาชาติ<br>วิทยาลัยนานาชาตินวัตกรรมดิจิทัล",
    "ศูนย์นวัตกรรมอาหารและบรรจุภัณฑ์": "ศูนย์นวัตกรรมอาหาร<br>และบรรจุภัณฑ์",
    "ศูนย์บริการเทคนิคการแพทย์คลินิก คณะเทคนิคการแพทย์": "ศูนย์บริการเทคนิคการแพทย์คลินิก<br>คณะเทคนิคการแพทย์",
    "อุทยานวิทยาศาสตร์และเทคโนโลยี": "อุทยานวิทยาศาสตร์<br>และเทคโนโลยี",
    "สถาบันวิศวกรรมชีวการแพทย์": "สถาบันวิศวกรรม<br>ชีวการแพทย์",
    "ศูนย์นวัตกรรมการจัดการ คณะบริหารธุรกิจ": "ศูนย์นวัตกรรมการจัดการ<br>คณะบริหารธุรกิจ",
    "ศูนย์ปฏิบัติการเภสัชชุมชน คณะเภสัชศาสตร์": "ศูนย์ปฏิบัติการเภสัชชุมชน<br>คณะเภสัชศาสตร์",
    "ศูนย์บริการพยาบาล คณะพยาบาลศาสตร์": "ศูนย์บริการพยาบาล<br>คณะพยาบาลศาสตร์",
    "หอพักพยาบาล คณะพยาบาลศาสตร์": "หอพักพยาบาล<br>คณะพยาบาลศาสตร์",
    "วิทยาลัยการศึกษาตลอดชีวิต": "วิทยาลัยการศึกษาตลอดชีวิต",
    "สำนักบริการเทคโนโลยีสารสนเทศ": "สำนักบริการ<br>เทคโนโลยีสารสนเทศ"
  };

  if (knownMappings[str]) {
    return knownMappings[str];
  }

  // General regex for other possible names (ensuring มหาวิทยาลัย is never split)
  str = str.replace(/([^ มหา])(คณะ|วิทยาลัย|สำนัก|สถาบัน|ศูนย์|โรงเรียน|กอง|หอพัก|สถานี|อุทยาน)/g, '$1 $2');
  str = str.replace(/([^ ])(และถ่ายทอด|และบริการ|และการจัดการ|และจัดการ|และเทคโนโลยี|และบำรุง|และพัฒนา|เพื่อความยั่งยืน|คลินิก)/g, '$1 $2');
  str = str.replace(/\s+/g, ' ').trim();
  return str;
}

function renderCategoryListHTML(items, includeStatusDetails = true, orientation = 'landscape') {
  if (!items || items.length === 0) {
    return `<div style="color: #94a3b8; font-style: italic; font-size: 8.5pt; padding: 2px 0; font-family: 'Sarabun', sans-serif;">- ไม่มีรายการส่วนงานในหมวดนี้ -</div>`;
  }

  // Determine column count based on orientation & details flag
  // In landscape: 5 columns without status details (fits all statuses in 1 page), 3 columns with status details
  // In portrait: 3 columns without status details, 2 columns with status details
  let cols = 3;
  if (orientation === 'landscape') {
    cols = includeStatusDetails ? 3 : 5;
  } else {
    cols = includeStatusDetails ? 2 : 3;
  }

  let colWidthPct = '33.33%';
  let numCellWidth = '20px';
  let numFontSize = '8pt';
  let textFontSize = '8.5pt';
  let textLineHeight = '1.35';
  let cellPadding = '2px 3px';

  if (cols === 5) {
    colWidthPct = '20%';
    numCellWidth = '16px';
    numFontSize = '7.5pt';
    textFontSize = '8pt';
    textLineHeight = '1.3';
    cellPadding = '1px 3px';
  } else if (cols === 4) {
    colWidthPct = '25%';
    numCellWidth = '18px';
    numFontSize = '8pt';
    textFontSize = '8.5pt';
    textLineHeight = '1.35';
    cellPadding = '2px 4px';
  } else if (cols === 3) {
    colWidthPct = '33.33%';
    numCellWidth = '20px';
    numFontSize = '8.5pt';
    textFontSize = '9pt';
    textLineHeight = '1.4';
    cellPadding = '3px 4px';
  } else if (cols === 2) {
    colWidthPct = '50%';
    numCellWidth = '22px';
    numFontSize = '8.5pt';
    textFontSize = '9.5pt';
    textLineHeight = '1.45';
    cellPadding = '4px 6px';
  }

  let rowsHTML = "";

  for (let i = 0; i < items.length; i += cols) {
    let cellsHTML = "";
    for (let c = 0; c < cols; c++) {
      const idx = i + c;
      const item = items[idx];
      if (item) {
        cellsHTML += `
          <td style="width: ${colWidthPct}; vertical-align: top; padding: ${cellPadding}; border-bottom: 1px dashed rgba(0, 0, 0, 0.08); box-sizing: border-box; font-family: 'Sarabun', sans-serif;">
            <div style="display: table; width: 100%;">
              <div style="display: table-cell; width: ${numCellWidth}; vertical-align: top; color: #64748b; font-weight: 800; font-size: ${numFontSize}; line-height: ${textLineHeight};">
                ${idx + 1}.
              </div>
              <div style="display: table-cell; vertical-align: top; font-size: ${textFontSize}; line-height: ${textLineHeight}; color: #0f172a; word-break: normal; overflow-wrap: normal;">
                <strong style="font-weight: 700; color: #0f172a;">${formatDeptNameForPdf(item.name)}</strong>
                ${(includeStatusDetails && item.detail) ? `
                  <div style="color: #475569; font-size: 7.5pt; font-weight: 500; line-height: 1.25; margin-top: 1px;">
                    (${item.detail})
                  </div>
                ` : ''}
              </div>
            </div>
          </td>
        `;
      } else {
        cellsHTML += `<td style="width: ${colWidthPct}; border-bottom: 1px dashed rgba(0, 0, 0, 0.08);"></td>`;
      }
    }
    rowsHTML += `<tr>${cellsHTML}</tr>`;
  }

  return `
    <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; padding: 0;">
      <tbody>
        ${rowsHTML}
      </tbody>
    </table>
  `;
}

function renderTeamsListHTML(teamsMap, orientation = 'landscape') {
  const teamLabels = {
    "1": "งานตรวจสอบ 1",
    "2": "งานตรวจสอบ 2",
    "3": "งานตรวจสอบ 3",
    "4": "งานตรวจสอบอื่น"
  };

  const isLandscape = orientation === 'landscape';
  const cols = isLandscape ? 4 : 2;
  const colWidthPct = cols === 4 ? '25%' : (cols === 3 ? '33.33%' : '50%');
  const numCellWidth = cols === 4 ? '18px' : '20px';
  const numFontSize = cols === 4 ? '8pt' : '8.5pt';
  const textFontSize = cols === 4 ? '8.5pt' : '9.5pt';
  const cellPadding = cols === 4 ? '2px 4px' : '3px 6px';

  return Object.keys(teamsMap).map(key => {
    const list = teamsMap[key] || [];
    const headerTitle = key === "4" ? `📌 งานตรวจสอบอื่น (${list.length} ส่วนงาน)` : `📌 ${teamLabels[key]} (${list.length} ส่วนงาน)`;
    
    let rowsHTML = "";
    for (let i = 0; i < list.length; i += cols) {
      let cellsHTML = "";
      for (let c = 0; c < cols; c++) {
        const idx = i + c;
        const u = list[idx];
        if (u) {
          cellsHTML += `
            <td style="width: ${colWidthPct}; vertical-align: top; padding: ${cellPadding}; border-bottom: 1px dashed rgba(0, 0, 0, 0.08); box-sizing: border-box; font-family: 'Sarabun', sans-serif;">
              <div style="display: table; width: 100%;">
                <div style="display: table-cell; width: ${numCellWidth}; vertical-align: top; color: #64748b; font-weight: 800; font-size: ${numFontSize}; line-height: 1.35;">
                  ${idx + 1}.
                </div>
                <div style="display: table-cell; vertical-align: top; font-size: ${textFontSize}; line-height: 1.35; color: #0f172a; word-break: break-word;">
                  <strong style="font-weight: 700; color: #0f172a;">${formatDeptNameForPdf(u.name)}</strong>
                </div>
              </div>
            </td>
          `;
        } else {
          cellsHTML += `<td style="width: ${colWidthPct}; border-bottom: 1px dashed rgba(0, 0, 0, 0.08);"></td>`;
        }
      }
      rowsHTML += `<tr>${cellsHTML}</tr>`;
    }

    return `
      <div style="margin-bottom: 6px; border: 1.5px solid #e9d5ff; border-radius: 6px; overflow: hidden; background-color: #fdf8ff; page-break-inside: avoid; break-inside: avoid;">
        <div style="font-weight: 800; font-size: 9.5pt; color: #5e327a; background-color: #f3e8ff; padding: 4px 10px; border-bottom: 1px solid #e9d5ff; font-family: 'Sarabun', sans-serif;">
          ${headerTitle}
        </div>
        <div style="padding: 3px 6px;">
          ${list.length === 0 ? `
            <div style="color: #94a3b8; font-style: italic; font-size: 8.5pt; font-family: 'Sarabun', sans-serif;">- ไม่มีรายการ -</div>
          ` : `
            <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; padding: 0;">
              <tbody>
                ${rowsHTML}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }).join('');
}
