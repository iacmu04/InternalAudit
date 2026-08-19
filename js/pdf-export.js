/**
 * PDF Export Module for Internal Audit Tracking System
 * Generates formatted multi-page PDF summary report with explicit 3-section page structure
 * Supports both Single-Year and Multi-Year modes with per-year column breakdown & team categorization
 * Page break optimizations: Clean top alignment, black department names, configurable status details
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

  // Build per-year statistics map
  const yearStatsMap = {};

  activeYears.forEach(yr => {
    const plannedForYr = parsedSchema.departmentsByYear && parsedSchema.departmentsByYear[yr]
      ? parsedSchema.departmentsByYear[yr]
      : [];

    const activeForYr = filteredUnits.filter(u => String(u.fiscalYear) === String(yr));

    const catCompletedYr = [];
    const catClosingSummaryYr = [];
    const catDraftingReportYr = [];
    const catAuditingYr = [];

    activeForYr.forEach(u => {
      const item = {
        name: u.name,
        team: u.team,
        detail: u.statusFormatted || u.latestStatusTitle || ""
      };
      if (u.isCompleted || (u.latestSubCol && u.latestSubCol.includes("เสร็จสมบูรณ์"))) {
        catCompletedYr.push(item);
      } else if (u.latestPhase === "1.3" || (u.latestSubCol && (u.latestSubCol === "วันที่ปิดตรวจ" || u.latestSubCol.includes("ปิดตรวจ")))) {
        catClosingSummaryYr.push(item);
      } else if (u.latestPhase === "1.2" && u.latestSubCol && u.latestSubCol.includes("สิ้นสุด")) {
        catDraftingReportYr.push(item);
      } else {
        catAuditingYr.push(item);
      }
    });

    const unstartedForYr = unstartedUnitsList.filter(u => !u.year || String(u.year) === String(yr));

    const totalPlannedYr = Math.max(plannedForYr.length, activeForYr.length + unstartedForYr.length) || 1;

    yearStatsMap[yr] = {
      year: yr,
      totalPlanned: totalPlannedYr,
      completed: catCompletedYr,
      closingSummary: catClosingSummaryYr,
      draftingReport: catDraftingReportYr,
      auditing: catAuditingYr,
      unstarted: unstartedForYr,
      unstartedByTeam: {
        "1": unstartedForYr.filter(u => String(u.team).replace(/^ทีม\s*/, "") === "1"),
        "2": unstartedForYr.filter(u => String(u.team).replace(/^ทีม\s*/, "") === "2"),
        "3": unstartedForYr.filter(u => String(u.team).replace(/^ทีม\s*/, "") === "3"),
        "4": unstartedForYr.filter(u => !["1", "2", "3"].includes(String(u.team).replace(/^ทีม\s*/, "")))
      }
    };
  });

  // Combined totals across active years
  const combinedTotalPlanned = activeYears.reduce((sum, yr) => sum + yearStatsMap[yr].totalPlanned, 0) || 1;
  const combinedCompleted = activeYears.reduce((sum, yr) => sum + yearStatsMap[yr].completed.length, 0);
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
        <th style="padding: 8px 10px; border: 1px solid #a372bb; font-size: 10.5pt; text-align: left; vertical-align: middle; width: 34%;">สถานะการดำเนินงาน</th>
        ${activeYears.map(yr => `
          <th style="padding: 8px 4px; border: 1px solid #a372bb; text-align: center !important; vertical-align: middle !important; font-size: 10pt; line-height: 1.25; width: 11%;">จำนวนส่วนงาน<br>${yr}</th>
          <th style="padding: 8px 4px; border: 1px solid #a372bb; text-align: center !important; vertical-align: middle !important; font-size: 10pt; line-height: 1.25; width: 11%;">สัดส่วน (%)<br>${yr}</th>
        `).join('')}
        <th style="padding: 8px 4px; border: 1px solid #a372bb; text-align: center !important; vertical-align: middle !important; font-size: 10pt; line-height: 1.25; width: 11%;">จำนวนรวม<br>(${activeYears.length} ปี)</th>
        <th style="padding: 8px 4px; border: 1px solid #a372bb; text-align: center !important; vertical-align: middle !important; font-size: 10pt; line-height: 1.25; width: 11%;">สัดส่วนรวม<br>(%)</th>
      </tr>
    `;

    tableBodyHTML = `
      <tr style="background-color: #f6ecfc;">
        <td style="padding: 9px 10px; border: 1px solid #d4b2e6; font-weight: 800; font-size: 10.5pt; color: #5e327a; line-height: 1.3; word-break: break-word;">1. จำนวนหน่วยรับตรวจทั้งหมด ตามแผนการตรวจสอบประจำปี</td>
        ${activeYears.map(yr => `
          <td style="padding: 9px 4px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #5e327a;">${yearStatsMap[yr].totalPlanned}</td>
          <td style="padding: 9px 4px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #6b3e80;">100.0%</td>
        `).join('')}
        <td style="padding: 9px 4px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #5e327a;">${combinedTotalPlanned}</td>
        <td style="padding: 9px 4px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #6b3e80;">100.0%</td>
      </tr>
      <tr style="background-color: #f0fdf4;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #166534; line-height: 1.3;">2. ดำเนินการเสร็จสมบูรณ์</td>
        ${activeYears.map(yr => `
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #166534;">${yearStatsMap[yr].completed.length}</td>
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #166534;">${((yearStatsMap[yr].completed.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #166534;">${combinedCompleted}</td>
        <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #166534;">${((combinedCompleted / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #f7fee7;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #3f6212; line-height: 1.3;">3. ระหว่างสรุปปิดตรวจ</td>
        ${activeYears.map(yr => `
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #3f6212;">${yearStatsMap[yr].closingSummary.length}</td>
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #3f6212;">${((yearStatsMap[yr].closingSummary.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #3f6212;">${combinedClosingSummary}</td>
        <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #3f6212;">${((combinedClosingSummary / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #fefce8;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #854d0e; line-height: 1.3;">4. ระหว่างร่างรายงาน</td>
        ${activeYears.map(yr => `
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #854d0e;">${yearStatsMap[yr].draftingReport.length}</td>
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #854d0e;">${((yearStatsMap[yr].draftingReport.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #854d0e;">${combinedDraftingReport}</td>
        <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #854d0e;">${((combinedDraftingReport / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #fff1f2;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #9f1239; line-height: 1.3;">5. ระหว่างเข้าตรวจ</td>
        ${activeYears.map(yr => `
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #9f1239;">${yearStatsMap[yr].auditing.length}</td>
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #9f1239;">${((yearStatsMap[yr].auditing.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #9f1239;">${combinedAuditing}</td>
        <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #9f1239;">${((combinedAuditing / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; line-height: 1.3;">6. ยังไม่ได้ดำเนินการ</td>
        ${activeYears.map(yr => `
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #475569;">${yearStatsMap[yr].unstarted.length}</td>
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #475569;">${((yearStatsMap[yr].unstarted.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #475569;">${combinedUnstarted}</td>
        <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #475569;">${((combinedUnstarted / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
    `;
  } else {
    // Single Year Table
    const yr = activeYears[0] || "2570";
    const stats = yearStatsMap[yr] || {
      totalPlanned: combinedTotalPlanned,
      completed: [], closingSummary: [], draftingReport: [], auditing: [], unstarted: []
    };
    const yrPct = (count) => ((count / stats.totalPlanned) * 100).toFixed(1) + "%";

    tableHeaderHTML = `
      <tr style="background-color: #B889CF; color: #ffffff;">
        <th style="padding: 10px 12px; border: 1px solid #a372bb; font-size: 12pt; text-align: left; vertical-align: middle;">สถานะการดำเนินงาน</th>
        <th style="padding: 10px 12px; border: 1px solid #a372bb; text-align: center !important; vertical-align: middle !important; width: 150px; font-size: 12pt;">จำนวน (ส่วนงาน)</th>
        <th style="padding: 10px 12px; border: 1px solid #a372bb; text-align: center !important; vertical-align: middle !important; width: 120px; font-size: 12pt;">สัดส่วน (%)</th>
      </tr>
    `;

    tableBodyHTML = `
      <tr style="background-color: #f6ecfc;">
        <td style="padding: 10px 12px; border: 1px solid #d4b2e6; font-weight: 800; font-size: 11pt; color: #5e327a; line-height: 1.3;">1. จำนวนหน่วยรับตรวจทั้งหมด ตามแผนการตรวจสอบประจำปี</td>
        <td style="padding: 10px 12px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: 800; font-size: 12pt; color: #5e327a;">${stats.totalPlanned}</td>
        <td style="padding: 10px 12px; border: 1px solid #d4b2e6; text-align: center !important; vertical-align: middle !important; font-weight: 800; font-size: 12pt; color: #6b3e80;">100.0%</td>
      </tr>
      <tr style="background-color: #f0fdf4;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: #166534; line-height: 1.3;">2. ดำเนินการเสร็จสมบูรณ์</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #166534; font-size: 12pt;">${stats.completed.length}</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #166534; font-size: 12pt;">${yrPct(stats.completed.length)}</td>
      </tr>
      <tr style="background-color: #f7fee7;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: #3f6212; line-height: 1.3;">3. ระหว่างสรุปปิดตรวจ</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #3f6212; font-size: 12pt;">${stats.closingSummary.length}</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #3f6212; font-size: 12pt;">${yrPct(stats.closingSummary.length)}</td>
      </tr>
      <tr style="background-color: #fefce8;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: #854d0e; line-height: 1.3;">4. ระหว่างร่างรายงาน</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #854d0e; font-size: 12pt;">${stats.draftingReport.length}</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #854d0e; font-size: 12pt;">${yrPct(stats.draftingReport.length)}</td>
      </tr>
      <tr style="background-color: #fff1f2;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: #9f1239; line-height: 1.3;">5. ระหว่างเข้าตรวจ</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #9f1239; font-size: 12pt;">${stats.auditing.length}</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #9f1239; font-size: 12pt;">${yrPct(stats.auditing.length)}</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; line-height: 1.3;">6. ยังไม่ได้ดำเนินการ</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #475569; font-size: 12pt;">${stats.unstarted.length}</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; vertical-align: middle !important; font-weight: 800; color: #475569; font-size: 12pt;">${yrPct(stats.unstarted.length)}</td>
      </tr>
    `;
  }

  // Helper to chunk arrays
  const chunkArray = (arr, size) => {
    const res = [];
    for (let i = 0; i < arr.length; i += size) {
      res.push(arr.slice(i, i + size));
    }
    return res;
  };

  // Build Section 2 Page Blocks
  const section2PageBlocks = [];
  activeYears.forEach(yr => {
    const stats = yearStatsMap[yr];
    const yrPct = (count) => ((count / stats.totalPlanned) * 100).toFixed(1) + "%";

    const totalActiveItems = stats.completed.length + stats.closingSummary.length + stats.draftingReport.length + stats.auditing.length;

    // Check if completed category itself is very large (> 14 items)
    if (stats.completed.length > 14) {
      const completedChunks = chunkArray(stats.completed, 14);
      completedChunks.forEach((chunk, cIdx) => {
        section2PageBlocks.push(`
          <div style="margin-bottom: 16px; border: 2px solid #B889CF; border-radius: 10px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
            <div style="background-color: #f6ecfc; padding: 10px 14px; font-weight: 800; font-size: 12.5pt; color: #5e327a; border-bottom: 1px solid #B889CF;">
              📅 รายละเอียดงานตรวจสอบ ปีงบประมาณ พ.ศ. ${yr} (ทั้งหมด ${stats.totalPlanned} ส่วนงาน)${cIdx > 0 ? ' (ต่อ)' : ''}
            </div>
            <div style="padding: 12px; background-color: #ffffff;">
              <div style="margin-bottom: 12px; border: 1px solid #86E3CE; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
                <div style="background-color: #86E3CE; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #0E5C4B;">
                  2. ดำเนินการเสร็จสมบูรณ์ (${stats.completed.length} ส่วนงาน - ${yrPct(stats.completed.length)})${cIdx > 0 ? ' (ต่อ)' : ''}
                </div>
                <div style="padding: 10px; background-color: #EFFCF9;">
                  ${renderCategoryListHTML(chunk, includeStatusDetails)}
                </div>
              </div>
              ${cIdx === completedChunks.length - 1 ? `
                <!-- Cat 3 Detail -->
                <div style="margin-bottom: 12px; border: 1px solid #D0E6A5; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
                  <div style="background-color: #D0E6A5; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #3D5A14;">
                    3. ระหว่างสรุปปิดตรวจ (${stats.closingSummary.length} ส่วนงาน - ${yrPct(stats.closingSummary.length)})
                  </div>
                  <div style="padding: 10px; background-color: #F6FBF0;">
                    ${renderCategoryListHTML(stats.closingSummary, includeStatusDetails)}
                  </div>
                </div>
                <!-- Cat 4 Detail -->
                <div style="margin-bottom: 12px; border: 1px solid #FFDD94; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
                  <div style="background-color: #FFDD94; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #7A5200;">
                    4. ระหว่างร่างรายงาน (${stats.draftingReport.length} ส่วนงาน - ${yrPct(stats.draftingReport.length)})
                  </div>
                  <div style="padding: 10px; background-color: #FFF9EC;">
                    ${renderCategoryListHTML(stats.draftingReport, includeStatusDetails)}
                  </div>
                </div>
                <!-- Cat 5 Detail -->
                <div style="margin-bottom: 12px; border: 1px solid #FA897B; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
                  <div style="background-color: #FA897B; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #9A2C1E;">
                    5. ระหว่างเข้าตรวจ (${stats.auditing.length} ส่วนงาน - ${yrPct(stats.auditing.length)})
                  </div>
                  <div style="padding: 10px; background-color: #FFF0EE;">
                    ${renderCategoryListHTML(stats.auditing, includeStatusDetails)}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `);
      });
    } else if (totalActiveItems > 18) {
      // Split between (Cat 2 & 3) and (Cat 4 & 5)
      section2PageBlocks.push(`
        <div style="margin-bottom: 16px; border: 2px solid #B889CF; border-radius: 10px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #f6ecfc; padding: 10px 14px; font-weight: 800; font-size: 12.5pt; color: #5e327a; border-bottom: 1px solid #B889CF;">
            📅 รายละเอียดงานตรวจสอบ ปีงบประมาณ พ.ศ. ${yr} (ทั้งหมด ${stats.totalPlanned} ส่วนงาน)
          </div>
          <div style="padding: 12px; background-color: #ffffff;">
            <!-- Cat 2 Detail -->
            <div style="margin-bottom: 12px; border: 1px solid #86E3CE; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
              <div style="background-color: #86E3CE; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #0E5C4B;">
                2. ดำเนินการเสร็จสมบูรณ์ (${stats.completed.length} ส่วนงาน - ${yrPct(stats.completed.length)})
              </div>
              <div style="padding: 10px; background-color: #EFFCF9;">
                ${renderCategoryListHTML(stats.completed, includeStatusDetails)}
              </div>
            </div>
            <!-- Cat 3 Detail -->
            <div style="margin-bottom: 12px; border: 1px solid #D0E6A5; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
              <div style="background-color: #D0E6A5; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #3D5A14;">
                3. ระหว่างสรุปปิดตรวจ (${stats.closingSummary.length} ส่วนงาน - ${yrPct(stats.closingSummary.length)})
              </div>
              <div style="padding: 10px; background-color: #F6FBF0;">
                ${renderCategoryListHTML(stats.closingSummary, includeStatusDetails)}
              </div>
            </div>
          </div>
        </div>
      `);

      section2PageBlocks.push(`
        <div style="margin-bottom: 16px; border: 2px solid #B889CF; border-radius: 10px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #f6ecfc; padding: 10px 14px; font-weight: 800; font-size: 12.5pt; color: #5e327a; border-bottom: 1px solid #B889CF;">
            📅 รายละเอียดงานตรวจสอบ ปีงบประมาณ พ.ศ. ${yr} (ทั้งหมด ${stats.totalPlanned} ส่วนงาน) (ต่อ)
          </div>
          <div style="padding: 12px; background-color: #ffffff;">
            <!-- Cat 4 Detail -->
            <div style="margin-bottom: 12px; border: 1px solid #FFDD94; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
              <div style="background-color: #FFDD94; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #7A5200;">
                4. ระหว่างร่างรายงาน (${stats.draftingReport.length} ส่วนงาน - ${yrPct(stats.draftingReport.length)})
              </div>
              <div style="padding: 10px; background-color: #FFF9EC;">
                ${renderCategoryListHTML(stats.draftingReport, includeStatusDetails)}
              </div>
            </div>
            <!-- Cat 5 Detail -->
            <div style="margin-bottom: 12px; border: 1px solid #FA897B; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
              <div style="background-color: #FA897B; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #9A2C1E;">
                5. ระหว่างเข้าตรวจ (${stats.auditing.length} ส่วนงาน - ${yrPct(stats.auditing.length)})
              </div>
              <div style="padding: 10px; background-color: #FFF0EE;">
                ${renderCategoryListHTML(stats.auditing, includeStatusDetails)}
              </div>
            </div>
          </div>
        </div>
      `);
    } else {
      // Normal single page for Section 2
      section2PageBlocks.push(`
        <div style="margin-bottom: 16px; border: 2px solid #B889CF; border-radius: 10px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #f6ecfc; padding: 10px 14px; font-weight: 800; font-size: 12.5pt; color: #5e327a; border-bottom: 1px solid #B889CF;">
            📅 รายละเอียดงานตรวจสอบ ปีงบประมาณ พ.ศ. ${yr} (ทั้งหมด ${stats.totalPlanned} ส่วนงาน)
          </div>
          <div style="padding: 12px; background-color: #ffffff;">
            <!-- Cat 2 Detail -->
            <div style="margin-bottom: 12px; border: 1px solid #86E3CE; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
              <div style="background-color: #86E3CE; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #0E5C4B;">
                2. ดำเนินการเสร็จสมบูรณ์ (${stats.completed.length} ส่วนงาน - ${yrPct(stats.completed.length)})
              </div>
              <div style="padding: 10px; background-color: #EFFCF9;">
                ${renderCategoryListHTML(stats.completed, includeStatusDetails)}
              </div>
            </div>

            <!-- Cat 3 Detail -->
            <div style="margin-bottom: 12px; border: 1px solid #D0E6A5; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
              <div style="background-color: #D0E6A5; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #3D5A14;">
                3. ระหว่างสรุปปิดตรวจ (${stats.closingSummary.length} ส่วนงาน - ${yrPct(stats.closingSummary.length)})
              </div>
              <div style="padding: 10px; background-color: #F6FBF0;">
                ${renderCategoryListHTML(stats.closingSummary, includeStatusDetails)}
              </div>
            </div>

            <!-- Cat 4 Detail -->
            <div style="margin-bottom: 12px; border: 1px solid #FFDD94; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
              <div style="background-color: #FFDD94; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #7A5200;">
                4. ระหว่างร่างรายงาน (${stats.draftingReport.length} ส่วนงาน - ${yrPct(stats.draftingReport.length)})
              </div>
              <div style="padding: 10px; background-color: #FFF9EC;">
                ${renderCategoryListHTML(stats.draftingReport, includeStatusDetails)}
              </div>
            </div>

            <!-- Cat 5 Detail -->
            <div style="margin-bottom: 12px; border: 1px solid #FA897B; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
              <div style="background-color: #FA897B; padding: 8px 12px; font-weight: 800; font-size: 11.5pt; color: #9A2C1E;">
                5. ระหว่างเข้าตรวจ (${stats.auditing.length} ส่วนงาน - ${yrPct(stats.auditing.length)})
              </div>
              <div style="padding: 10px; background-color: #FFF0EE;">
                ${renderCategoryListHTML(stats.auditing, includeStatusDetails)}
              </div>
            </div>
          </div>
        </div>
      `);
    }
  });

  // Build Section 3 Page Blocks (Unstarted Units with Automatic Team Splitting & Repeated Purple Header on Continuation)
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

    if (totalCount > 20) {
      // Split into 2 clean pages:
      // Page 1: Team 1 and Team 2
      section3PageBlocks.push(`
        <div style="margin-bottom: 16px; border: 2px solid #B889CF; border-radius: 10px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #B889CF; color: #ffffff; padding: 10px 14px; font-weight: 800; font-size: 12.5pt;">
            ${headerTitle}
          </div>
          <div style="padding: 12px; background-color: #fdf8ff;">
            ${renderTeamsListHTML({ "1": t1, "2": t2 })}
          </div>
        </div>
      `);

      // Page 2: Team 3 and Team 4 (with repeated purple header + (ต่อ))
      section3PageBlocks.push(`
        <div style="margin-bottom: 16px; border: 2px solid #B889CF; border-radius: 10px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #B889CF; color: #ffffff; padding: 10px 14px; font-weight: 800; font-size: 12.5pt;">
            ${headerTitle} (ต่อ)
          </div>
          <div style="padding: 12px; background-color: #fdf8ff;">
            ${renderTeamsListHTML({ "3": t3, "4": t4 })}
          </div>
        </div>
      `);
    } else {
      // Fits in single page
      section3PageBlocks.push(`
        <div style="margin-bottom: 16px; border: 2px solid #B889CF; border-radius: 10px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #B889CF; color: #ffffff; padding: 10px 14px; font-weight: 800; font-size: 12.5pt;">
            ${headerTitle}
          </div>
          <div style="padding: 12px; background-color: #fdf8ff;">
            ${renderTeamsListHTML({ "1": t1, "2": t2, "3": t3, "4": t4 })}
          </div>
        </div>
      `);
    }
  });

  // CTS Meeting text (User Input on Export)
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

  // Page 1: Executive Summary
  pagesHTML += `
    <div style="padding: 14px 18px 18px 18px; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid;">
      <!-- Header Title -->
      <div style="text-align: center; border-bottom: 3px solid #B889CF; padding-bottom: 10px; margin-bottom: 16px;">
        <h1 style="margin: 0; font-size: 18pt; font-weight: 700; color: #5e327a; line-height: 1.5; letter-spacing: 0px; word-wrap: break-word;">
          สรุปผลการปฏิบัติงานตามแผนการตรวจสอบ
        </h1>
        <div style="margin: 4px 0 0 0; font-size: 12pt; font-weight: 600; color: #6b3e80; line-height: 1.4;">
          สำนักงานการตรวจสอบภายใน | ข้อมูล ณ วันที่ ${todayStr}
        </div>
        <div style="margin: 6px 0 0 0; font-size: 12pt; font-weight: 700; color: #5e327a; background-color: #f6ecfc; display: inline-block; padding: 4px 18px; border-radius: 8px; border: 1px solid #B889CF; line-height: 1.4;">
          ${yearText}
        </div>
        <div style="margin: 6px 0 0 0; font-size: 11.5pt; font-weight: 700; color: #5e327a; line-height: 1.4;">
          ${ctsText}
        </div>
      </div>

      <!-- Section 1 Title -->
      <div style="margin-bottom: 14px;">
        <h2 style="font-size: 15pt; font-weight: 700; color: #5e327a; margin: 0 0 6px 0; padding-bottom: 4px; border-bottom: 2px solid #B889CF; line-height: 1.5;">
          ส่วนที่ 1: หน้าสรุปภาพรวม (Executive Summary)
        </h2>
        <p style="font-size: 11pt; color: #64748b; margin: 0; line-height: 1.4;">
          สรุปสัดส่วนการดำเนินงานจำแนกตามสถานะเปรียบเทียบกับจำนวนหน่วยรับตรวจตามแผนประจำปี ${isMultiYear ? `(เปรียบเทียบแยกตามปีงบประมาณ ${activeYears.join(', ')})` : ''}
        </p>
      </div>

      <!-- Executive Summary Table -->
      ${tableHeaderHTML ? `<table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 10.5pt; margin-bottom: 16px; table-layout: fixed;"><thead>${tableHeaderHTML}</thead><tbody>${tableBodyHTML}</tbody></table>` : ''}

      <div style="margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 6px; text-align: right; font-size: 9.5pt; color: #64748b;">
        หน้า ${pageCounter++}/${totalExactPages} (หน้าสรุปภาพรวม)
      </div>
    </div>
  `;

  // Section 2 Pages (Explicit page-break-before on every Section 2 block, header without (ต่อ))
  section2PageBlocks.forEach((blockHTML, bIdx) => {
    pagesHTML += `
      <div style="padding: 14px 18px 18px 18px; page-break-before: always; break-before: page; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid;">
        <h2 style="font-size: 15pt; font-weight: 700; color: #5e327a; margin: 0 0 14px 0; padding-bottom: 4px; border-bottom: 2px solid #B889CF; line-height: 1.5;">
          ส่วนที่ 2: รายละเอียดสถานะงานตรวจสอบที่อยู่ระหว่างดำเนินการและเสร็จสมบูรณ์
        </h2>
        
        ${blockHTML}

        <div style="margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 6px; text-align: right; font-size: 9.5pt; color: #64748b;">
          หน้า ${pageCounter++}/${totalExactPages} (รายชื่อส่วนงานที่อยู่ระหว่างดำเนินการและเสร็จสมบูรณ์${bIdx > 0 ? ' - ต่อ' : ''})
        </div>
      </div>
    `;
  });

  // Section 3 Pages (Explicit page-break-before on every Section 3 block, header without (ต่อ))
  section3PageBlocks.forEach((blockHTML, bIdx) => {
    pagesHTML += `
      <div style="padding: 14px 18px 18px 18px; page-break-before: always; break-before: page; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid;">
        <h2 style="font-size: 15pt; font-weight: 700; color: #5e327a; margin: 0 0 14px 0; padding-bottom: 4px; border-bottom: 2px solid #B889CF; line-height: 1.5;">
          ส่วนที่ 3: รายชื่อส่วนงานที่ยังไม่ได้ดำเนินการ (แยกตามงานตรวจสอบ)
        </h2>
        
        ${blockHTML}

        <div style="margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 6px; text-align: right; font-size: 9.5pt; color: #64748b;">
          หน้า ${pageCounter++}/${totalExactPages} (ส่วนงานที่ยังไม่ได้ดำเนินการ${bIdx > 0 ? ' - ต่อ' : ''})
        </div>
      </div>
    `;
  });

  const htmlContent = `
    <div style="font-family: 'Tahoma', 'Sarabun', sans-serif; color: #1e293b; line-height: 1.5; font-size: 10pt; background: #ffffff; width: 100%; box-sizing: border-box;">
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
    jsPDF: { unit: 'mm', format: 'a4', orientation: isMultiYear ? 'landscape' : 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
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

function renderCategoryListHTML(items, includeStatusDetails = true) {
  if (!items || items.length === 0) {
    return `<div style="color: #94a3b8; font-style: italic; font-size: 10.5pt; padding: 4px 0;">- ไม่มีรายการส่วนงานในหมวดนี้ -</div>`;
  }
  return `
    <ul style="margin: 0; padding-left: 20px; font-size: 11pt; color: #000000; list-style-type: disc;">
      ${items.map(item => `
        <li style="margin-bottom: 5px; line-height: 1.5; page-break-inside: avoid; break-inside: avoid;">
          <strong style="color: #000000; font-size: 11.5pt; font-weight: 800;">${item.name}</strong>
          ${(includeStatusDetails && item.detail) ? `<span style="color: #64748b; font-size: 10pt; font-weight: 500; margin-left: 6px;">(${item.detail})</span>` : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

function renderTeamsListHTML(teamsMap) {
  const teamLabels = {
    "1": "งานตรวจสอบ 1",
    "2": "งานตรวจสอบ 2",
    "3": "งานตรวจสอบ 3",
    "4": "งานตรวจสอบอื่น"
  };

  return Object.keys(teamsMap).map(key => {
    const list = teamsMap[key] || [];
    const headerTitle = key === "4" ? `📌 งานตรวจสอบอื่น` : `📌 ${teamLabels[key]} (${list.length} ส่วนงาน)`;
    return `
      <div style="margin-bottom: 10px; padding: 8px 10px; background-color: #fdf8ff; border: 1px solid #e9d5ff; border-radius: 6px; page-break-inside: avoid; break-inside: avoid;">
        <div style="font-weight: 800; font-size: 11.5pt; color: #5e327a; margin-bottom: 4px; border-bottom: 1px solid #f3e8ff; padding-bottom: 3px;">
          ${headerTitle}
        </div>
        ${list.length === 0 ? `
          <div style="color: #94a3b8; font-style: italic; font-size: 10.5pt;">- ไม่มีรายการ -</div>
        ` : `
          <ul style="margin: 0; padding-left: 18px; font-size: 10.5pt; color: #000000; list-style-type: disc;">
            ${list.map(u => `
              <li style="margin-bottom: 4px; line-height: 1.5; page-break-inside: avoid; break-inside: avoid;">
                <strong style="color: #000000; font-size: 11.5pt; font-weight: 800;">${u.name}</strong>
              </li>
            `).join('')}
          </ul>
        `}
      </div>
    `;
  }).join('');
}
