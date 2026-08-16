/**
 * PDF Export Module for Internal Audit Tracking System
 * Generates formatted multi-page PDF summary report with explicit 3-section page structure
 * Supports both Single-Year and Multi-Year modes with per-year column breakdown & team categorization
 * Theme color #B889CF, center aligned table headers, 12pt department font size
 */

function generatePdfReport(options) {
  let masterLists = [], rawAuditList = [], delayList = [], filteredUnits = [], unstartedUnitsList = [];
  let selectedFiscalYear = "ALL", selectedTeam = "ALL";
  let totalPlannedUnitsCount = 0, completedUnitsCount = 0, overallCompletionRate = 0;
  let fiscalYearOptions = ["2570", "2569"];

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
    if (options.parsedSchema && options.parsedSchema.years && options.parsedSchema.years.length > 0) {
      fiscalYearOptions = options.parsedSchema.years;
    }
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const parsedSchema = options.parsedSchema || {};

  // Active years for report
  const sortedYearOptions = [...fiscalYearOptions].sort((a,b) => a.localeCompare(b));
  let activeYears = [];
  if (selectedFiscalYear !== "ALL") {
    activeYears = [selectedFiscalYear];
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
      if (u.isCompleted || u.latestSubCol === "วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์") {
        catCompletedYr.push(item);
      } else if (u.latestPhase === "1.3" || u.latestSubCol === "วันที่ปิดตรวจ" || u.latestSubCol.includes("ปิดตรวจ")) {
        catClosingSummaryYr.push(item);
      } else if (u.latestPhase === "1.2" && u.latestSubCol.includes("สิ้นสุด")) {
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
  if (selectedFiscalYear !== "ALL") {
    yearText = `ปีงบประมาณ พ.ศ. ${selectedFiscalYear}`;
  } else {
    if (sortedYearOptions.length >= 2) {
      yearText = `ปีงบประมาณ พ.ศ. ${sortedYearOptions[0]} - ${sortedYearOptions[sortedYearOptions.length - 1]}`;
    } else if (sortedYearOptions.length === 1) {
      yearText = `ปีงบประมาณ พ.ศ. ${sortedYearOptions[0]}`;
    } else {
      yearText = `ปีงบประมาณ พ.ศ. 2569 - 2570`;
    }
  }

  const todayStr = formatDateDMY(new Date());

  // Render Table Header & Body HTML
  let tableHeaderHTML = "";
  let tableBodyHTML = "";

  if (isMultiYear) {
    tableHeaderHTML = `
      <tr style="background-color: #B889CF; color: #ffffff;">
        <th style="padding: 9px 10px; border: 1px solid #a372bb; font-size: 11pt; text-align: left; vertical-align: middle;">สถานะการดำเนินงาน</th>
        ${activeYears.map(yr => `
          <th style="padding: 9px 6px; border: 1px solid #a372bb; text-align: center !important; vertical-align: middle !important; font-size: 10.5pt;">จำนวน ปี ${yr}</th>
          <th style="padding: 9px 6px; border: 1px solid #a372bb; text-align: center !important; vertical-align: middle !important; font-size: 10.5pt;">สัดส่วน (%) ${yr}</th>
        `).join('')}
        <th style="padding: 9px 6px; border: 1px solid #a372bb; text-align: center !important; vertical-align: middle !important; font-size: 10.5pt;">จำนวนรวม (${activeYears.length} ปี)</th>
        <th style="padding: 9px 6px; border: 1px solid #a372bb; text-align: center !important; vertical-align: middle !important; font-size: 10.5pt;">สัดส่วนรวม (%)</th>
      </tr>
    `;

    tableBodyHTML = `
      <tr style="background-color: #f6ecfc;">
        <td style="padding: 9px 10px; border: 1px solid #d4b2e6; font-weight: 800; font-size: 11pt; color: #5e327a;">1. จำนวนหน่วยรับตรวจทั้งหมด ตามแผนการตรวจสอบประจำปี</td>
        ${activeYears.map(yr => `
          <td style="padding: 9px 6px; border: 1px solid #d4b2e6; text-align: center !important; font-weight: 800; color: #5e327a;">${yearStatsMap[yr].totalPlanned}</td>
          <td style="padding: 9px 6px; border: 1px solid #d4b2e6; text-align: center !important; font-weight: 800; color: #6b3e80;">100.0%</td>
        `).join('')}
        <td style="padding: 9px 6px; border: 1px solid #d4b2e6; text-align: center !important; font-weight: 800; color: #5e327a;">${combinedTotalPlanned}</td>
        <td style="padding: 9px 6px; border: 1px solid #d4b2e6; text-align: center !important; font-weight: 800; color: #6b3e80;">100.0%</td>
      </tr>
      <tr style="background-color: #f0fdf4;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #166534;">2. ดำเนินการเสร็จสมบูรณ์</td>
        ${activeYears.map(yr => `
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #166534;">${yearStatsMap[yr].completed.length}</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #166534;">${((yearStatsMap[yr].completed.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #166534;">${combinedCompleted}</td>
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #166534;">${((combinedCompleted / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #f7fee7;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #3f6212;">3. ระหว่างสรุปปิดตรวจ</td>
        ${activeYears.map(yr => `
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #3f6212;">${yearStatsMap[yr].closingSummary.length}</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #3f6212;">${((yearStatsMap[yr].closingSummary.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #3f6212;">${combinedClosingSummary}</td>
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #3f6212;">${((combinedClosingSummary / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #fefce8;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #854d0e;">4. ระหว่างร่างรายงาน</td>
        ${activeYears.map(yr => `
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #854d0e;">${yearStatsMap[yr].draftingReport.length}</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #854d0e;">${((yearStatsMap[yr].draftingReport.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #854d0e;">${combinedDraftingReport}</td>
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #854d0e;">${((combinedDraftingReport / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #fff1f2;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #9f1239;">5. ระหว่างเข้าตรวจ</td>
        ${activeYears.map(yr => `
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #9f1239;">${yearStatsMap[yr].auditing.length}</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #9f1239;">${((yearStatsMap[yr].auditing.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #9f1239;">${combinedAuditing}</td>
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #9f1239;">${((combinedAuditing / combinedTotalPlanned) * 100).toFixed(1)}%</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569;">6. ยังไม่ได้ดำเนินการ</td>
        ${activeYears.map(yr => `
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #475569;">${yearStatsMap[yr].unstarted.length}</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #475569;">${((yearStatsMap[yr].unstarted.length / yearStatsMap[yr].totalPlanned) * 100).toFixed(1)}%</td>
        `).join('')}
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #475569;">${combinedUnstarted}</td>
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #475569;">${((combinedUnstarted / combinedTotalPlanned) * 100).toFixed(1)}%</td>
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
        <td style="padding: 10px 12px; border: 1px solid #d4b2e6; font-weight: 800; font-size: 11pt; color: #5e327a;">1. จำนวนหน่วยรับตรวจทั้งหมด ตามแผนการตรวจสอบประจำปี</td>
        <td style="padding: 10px 12px; border: 1px solid #d4b2e6; text-align: center !important; font-weight: 800; font-size: 12pt; color: #5e327a;">${stats.totalPlanned}</td>
        <td style="padding: 10px 12px; border: 1px solid #d4b2e6; text-align: center !important; font-weight: 800; font-size: 12pt; color: #6b3e80;">100.0%</td>
      </tr>
      <tr style="background-color: #f0fdf4;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: #166534;">2. ดำเนินการเสร็จสมบูรณ์</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #166534; font-size: 12pt;">${stats.completed.length}</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #166534; font-size: 12pt;">${yrPct(stats.completed.length)}</td>
      </tr>
      <tr style="background-color: #f7fee7;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: #3f6212;">3. ระหว่างสรุปปิดตรวจ</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #3f6212; font-size: 12pt;">${stats.closingSummary.length}</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #3f6212; font-size: 12pt;">${yrPct(stats.closingSummary.length)}</td>
      </tr>
      <tr style="background-color: #fefce8;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: #854d0e;">4. ระหว่างร่างรายงาน</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #854d0e; font-size: 12pt;">${stats.draftingReport.length}</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #854d0e; font-size: 12pt;">${yrPct(stats.draftingReport.length)}</td>
      </tr>
      <tr style="background-color: #fff1f2;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: #9f1239;">5. ระหว่างเข้าตรวจ</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #9f1239; font-size: 12pt;">${stats.auditing.length}</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #9f1239; font-size: 12pt;">${yrPct(stats.auditing.length)}</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569;">6. ยังไม่ได้ดำเนินการ</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #475569; font-size: 12pt;">${stats.unstarted.length}</td>
        <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center !important; font-weight: 800; color: #475569; font-size: 12pt;">${yrPct(stats.unstarted.length)}</td>
      </tr>
    `;
  }

  // Render Section 2 (Active Details Grouped by Year)
  const section2HTML = activeYears.map(yr => {
    const stats = yearStatsMap[yr];
    const yrPct = (count) => ((count / stats.totalPlanned) * 100).toFixed(1) + "%";

    return `
      <div style="margin-bottom: 20px; border: 2px solid #B889CF; border-radius: 10px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
        <div style="background-color: #f6ecfc; padding: 10px 14px; font-weight: 800; font-size: 13pt; color: #5e327a; border-bottom: 1px solid #B889CF;">
          📅 รายละเอียดงานตรวจสอบ ปีงบประมาณ พ.ศ. ${yr} (ทั้งหมด ${stats.totalPlanned} ส่วนงาน)
        </div>
        <div style="padding: 12px; background-color: #ffffff;">

          <!-- Cat 2 Detail -->
          <div style="margin-bottom: 12px; border: 1px solid #86E3CE; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
            <div style="background-color: #86E3CE; padding: 8px 12px; font-weight: 800; font-size: 12pt; color: #0E5C4B;">
              2. ดำเนินการเสร็จสมบูรณ์ (${stats.completed.length} ส่วนงาน - ${yrPct(stats.completed.length)})
            </div>
            <div style="padding: 10px; background-color: #EFFCF9;">
              ${renderCategoryListHTML(stats.completed)}
            </div>
          </div>

          <!-- Cat 3 Detail -->
          <div style="margin-bottom: 12px; border: 1px solid #D0E6A5; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
            <div style="background-color: #D0E6A5; padding: 8px 12px; font-weight: 800; font-size: 12pt; color: #3D5A14;">
              3. ระหว่างสรุปปิดตรวจ (${stats.closingSummary.length} ส่วนงาน - ${yrPct(stats.closingSummary.length)})
            </div>
            <div style="padding: 10px; background-color: #F6FBF0;">
              ${renderCategoryListHTML(stats.closingSummary)}
            </div>
          </div>

          <!-- Cat 4 Detail -->
          <div style="margin-bottom: 12px; border: 1px solid #FFDD94; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
            <div style="background-color: #FFDD94; padding: 8px 12px; font-weight: 800; font-size: 12pt; color: #7A5200;">
              4. ระหว่างร่างรายงาน (${stats.draftingReport.length} ส่วนงาน - ${yrPct(stats.draftingReport.length)})
            </div>
            <div style="padding: 10px; background-color: #FFF9EC;">
              ${renderCategoryListHTML(stats.draftingReport)}
            </div>
          </div>

          <!-- Cat 5 Detail -->
          <div style="margin-bottom: 12px; border: 1px solid #FA897B; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
            <div style="background-color: #FA897B; padding: 8px 12px; font-weight: 800; font-size: 12pt; color: #9A2C1E;">
              5. ระหว่างเข้าตรวจ (${stats.auditing.length} ส่วนงาน - ${yrPct(stats.auditing.length)})
            </div>
            <div style="padding: 10px; background-color: #FFF0EE;">
              ${renderCategoryListHTML(stats.auditing)}
            </div>
          </div>

        </div>
      </div>
    `;
  }).join('');

  // Render Section 3 (Unstarted Units Grouped by Year and Workgroup)
  const section3HTML = activeYears.map(yr => {
    const stats = yearStatsMap[yr];
    const yrPct = (count) => ((count / stats.totalPlanned) * 100).toFixed(1) + "%";

    return `
      <div style="margin-bottom: 20px; border: 2px solid #B889CF; border-radius: 10px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
        <div style="background-color: #B889CF; color: #ffffff; padding: 10px 14px; font-weight: 800; font-size: 13pt;">
          📅 รายชื่อส่วนงานที่ยังไม่ได้ดำเนินการ ปีงบประมาณ พ.ศ. ${yr} (รวม ${stats.unstarted.length} ส่วนงาน - ${yrPct(stats.unstarted.length)})
        </div>
        <div style="padding: 12px; background-color: #fdf8ff;">
          ${renderUnstartedByTeamHTML(stats.unstartedByTeam, stats.unstarted.length, yrPct(stats.unstarted.length))}
        </div>
      </div>
    `;
  }).join('');

  // Theme color palette: primary theme #B889CF, headers #5e327a
  const htmlContent = `
    <div style="font-family: 'Sarabun', sans-serif; color: #1e293b; line-height: 1.4; font-size: 11pt; background: #ffffff; width: 100%; box-sizing: border-box;">
      
      <!-- ================= PAGE 1: หน้าสรุปภาพรวม ================= -->
      <div style="padding: 16px 20px; page-break-after: always; break-after: page; box-sizing: border-box;">
        
        <!-- Header Title -->
        <div style="text-align: center; border-bottom: 3px solid #B889CF; padding-bottom: 10px; margin-bottom: 16px;">
          <h1 style="margin: 0; font-size: 18pt; font-weight: 800; color: #5e327a; line-height: 1.3; word-wrap: break-word;">
            รายงานสรุปสถานะการติดตามงานตรวจสอบภายใน
          </h1>
          <div style="margin: 4px 0 0 0; font-size: 12pt; font-weight: 600; color: #6b3e80;">
            สำนักงานการตรวจสอบภายใน | ข้อมูล ณ วันที่ ${todayStr}
          </div>
          <!-- Line 3 Filter Details: Fiscal Year Only -->
          <div style="margin: 6px 0 0 0; font-size: 12pt; font-weight: 700; color: #5e327a; background-color: #f6ecfc; display: inline-block; padding: 4px 18px; border-radius: 8px; border: 1px solid #B889CF;">
            ${yearText}
          </div>
        </div>

        <!-- Section 1 Title -->
        <div style="margin-bottom: 14px;">
          <h2 style="font-size: 16pt; font-weight: 800; color: #5e327a; margin: 0 0 6px 0; padding-bottom: 4px; border-bottom: 2px solid #B889CF;">
            ส่วนที่ 1: หน้าสรุปภาพรวม (Executive Summary)
          </h2>
          <p style="font-size: 11pt; color: #64748b; margin: 0;">
            สรุปสัดส่วนการดำเนินงานจำแนกตามสถานะเปรียบเทียบกับจำนวนหน่วยรับตรวจตามแผนประจำปี ${isMultiYear ? `(เปรียบเทียบแยกตามปีงบประมาณ ${activeYears.join(', ')})` : ''}
          </p>
        </div>

        <!-- Executive Summary Table -->
        ${tableHeaderHTML ? `<table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 10.5pt; margin-bottom: 20px; table-layout: fixed;"><thead>${tableHeaderHTML}</thead><tbody>${tableBodyHTML}</tbody></table>` : ''}

        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: right; font-size: 10pt; color: #64748b;">
          หน้า 1/3 (หน้าสรุปภาพรวม)
        </div>
      </div>


      <!-- ================= PAGE 2: หน้าสถานะที่ดำเนินการและอยู่ระหว่างดำเนินการ ================= -->
      <div style="padding: 16px 20px; page-break-after: always; break-after: page; box-sizing: border-box;">
        
        <h2 style="font-size: 16pt; font-weight: 800; color: #5e327a; margin: 0 0 14px 0; padding-bottom: 4px; border-bottom: 2px solid #B889CF;">
          ส่วนที่ 2: รายละเอียดสถานะงานตรวจสอบที่อยู่ระหว่างดำเนินการและเสร็จสมบูรณ์
        </h2>

        ${section2HTML}

        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: right; font-size: 10pt; color: #64748b;">
          หน้า 2/3 (รายชื่อส่วนงานที่อยู่ระหว่างดำเนินการและเสร็จสมบูรณ์)
        </div>
      </div>


      <!-- ================= PAGE 3: ส่วนงานที่ยังไม่ได้ดำเนินการ (ALWAYS NEW PAGE) ================= -->
      <div style="padding: 16px 20px; box-sizing: border-box;">
        
        <h2 style="font-size: 16pt; font-weight: 800; color: #5e327a; margin: 0 0 14px 0; padding-bottom: 4px; border-bottom: 2px solid #B889CF;">
          ส่วนที่ 3: รายชื่อส่วนงานที่ยังไม่ได้ดำเนินการ (แยกตามงานตรวจสอบ)
        </h2>

        ${section3HTML}

        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: right; font-size: 10pt; color: #64748b;">
          หน้า 3/3 (ส่วนงานที่ยังไม่ได้ดำเนินการ)
        </div>
      </div>

    </div>
  `;

  // Create temporary container
  const element = document.createElement("div");
  element.innerHTML = htmlContent;
  document.body.appendChild(element);

  // Configure html2pdf options (Landscape for Page 1 Multi-Year or Portrait for Single-Year)
  const opt = {
    margin: [8, 8, 8, 8],
    filename: `Internal_Audit_Report_${new Date().toISOString().slice(0,10)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: isMultiYear ? 'landscape' : 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  if (window.html2pdf) {
    window.html2pdf().set(opt).from(element).save().then(() => {
      document.body.removeChild(element);
    }).catch(err => {
      console.error("PDF generation failed:", err);
      document.body.removeChild(element);
    });
  } else {
    // Print fallback
    const printWin = window.open('', '_blank');
    printWin.document.write(`<html><head><title>Audit Report</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet"></head><body>${htmlContent}</body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      document.body.removeChild(element);
    }, 500);
  }
}

function renderCategoryListHTML(items) {
  if (!items || items.length === 0) {
    return `<div style="color: #94a3b8; font-style: italic; font-size: 11pt; padding: 4px 0;">- ไม่มีรายการส่วนงานในหมวดนี้ -</div>`;
  }
  return `
    <ul style="margin: 0; padding-left: 20px; font-size: 11pt; color: #1e293b;">
      ${items.map(item => `
        <li style="margin-bottom: 5px; page-break-inside: avoid; break-inside: avoid;">
          <strong style="color: #5e327a; font-size: 12pt; font-weight: 800; display: inline-block;">${item.name}</strong> 
          ${item.detail ? `<span style="color: #64748b; font-size: 11pt; font-weight: 500; margin-left: 6px;">(${item.detail})</span>` : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

function renderUnstartedByTeamHTML(unstartedByTeam, totalCount, totalPct) {
  const teamKeys = ["1", "2", "3", "4"];
  const teamLabels = {
    "1": "งานตรวจสอบ 1",
    "2": "งานตรวจสอบ 2",
    "3": "งานตรวจสอบ 3",
    "4": "งานตรวจสอบอื่น"
  };

  return `
    <div style="margin-bottom: 14px; border: 1px solid #B889CF; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
      <div style="padding: 10px; background-color: #ffffff;">
        ${teamKeys.map(key => {
          const list = unstartedByTeam[key] || [];
          const headerTitle = key === "4" ? `📌 งานตรวจสอบอื่น` : `📌 ${teamLabels[key]} (${list.length} ส่วนงาน)`;
          return `
            <div style="margin-bottom: 8px; padding: 8px 10px; background-color: #fdf8ff; border: 1px solid #e9d5ff; border-radius: 6px; page-break-inside: avoid; break-inside: avoid;">
              <div style="font-weight: 800; font-size: 11.5pt; color: #5e327a; margin-bottom: 4px; border-bottom: 1px solid #f3e8ff; padding-bottom: 3px;">
                ${headerTitle}
              </div>
              ${list.length === 0 ? `
                <div style="color: #94a3b8; font-style: italic; font-size: 10.5pt;">- ไม่มีรายการ -</div>
              ` : `
                <ul style="margin: 0; padding-left: 18px; font-size: 10.5pt; color: #1e293b;">
                  ${list.map(u => `
                    <li style="margin-bottom: 3px; page-break-inside: avoid; break-inside: avoid;">
                      <strong style="color: #5e327a; font-size: 12pt; font-weight: 800;">${u.name}</strong>
                    </li>
                  `).join('')}
                </ul>
              `}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
