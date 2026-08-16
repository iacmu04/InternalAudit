/**
 * PDF Export Module for Internal Audit Tracking System
 * Uses html2pdf.js to generate formatted summary report
 */

function generatePdfReport(masterLists, mainAudit, delayList) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // 1. Total planned units from Master_Lists Column A
  const plannedDeptsSet = new Set();
  if (Array.isArray(masterLists)) {
    masterLists.forEach(item => {
      const name = item["รายชื่อส่วนงาน"] || item["ส่วนงาน"] || item["คอลัมน์ A"];
      if (name && String(name).trim() !== "") {
        plannedDeptsSet.add(String(name).trim());
      }
    });
  }

  // Fallback / include any in mainAudit
  if (Array.isArray(mainAudit)) {
    mainAudit.forEach(item => {
      if (item["ส่วนงาน"] && String(item["ส่วนงาน"]).trim() !== "") {
        plannedDeptsSet.add(String(item["ส่วนงาน"]).trim());
      }
    });
  }

  const allPlannedDepts = Array.from(plannedDeptsSet);
  const totalPlannedCount = allPlannedDepts.length || 1;

  // Map mainAudit by Department
  const auditMap = {};
  if (Array.isArray(mainAudit)) {
    mainAudit.forEach(row => {
      const dept = String(row["ส่วนงาน"] || "").trim();
      if (dept) auditMap[dept] = row;
    });
  }

  // Map Delay last extension date by Department
  const delayMap = {};
  if (Array.isArray(delayList)) {
    delayList.forEach(d => {
      const dept = String(d.Department || d.department || d["ส่วนงาน"] || "").trim();
      const status = String(d.DeanStatus || d.Status || d.status || "");
      if (dept && (status.includes("อนุมัติ") || status.includes("รอ"))) {
        const endDateStr = d["End Date"] || d.endDate;
        const endDate = parseDate(endDateStr);
        if (endDate && (!delayMap[dept] || endDate > delayMap[dept])) {
          delayMap[dept] = endDate;
        }
      }
    });
  }

  // Categories
  const catCompleted = [];
  const catClosingSummary = [];
  const catDraftingReport = [];
  const catAuditing = [];
  const catNotStarted = [];

  allPlannedDepts.forEach(dept => {
    const row = auditMap[dept];
    if (!row) {
      catNotStarted.push({ name: dept, detail: "ยังไม่ได้บันทึกข้อมูลในแผน" });
      return;
    }

    const startDateG = parseDate(row["วันที่เริ่มตรวจสอบ"]);
    const endDateH = parseDate(row["วันที่สิ้นสุดการตรวจสอบ"]);
    const lastExtensionF = delayMap[dept];
    const effectiveEndDate = (lastExtensionF && lastExtensionF > endDateH) ? lastExtensionF : endDateH;

    const dateK_Closed = parseDate(row["วันที่ปิดตรวจ"]);
    const dateT_Completed = parseDate(row["วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์"]);

    // Categorization logic per specs:
    // 2. ดำเนินการเสร็จสมบูรณ์ (Col T date present)
    if (dateT_Completed) {
      catCompleted.push({ name: dept, detail: `เสร็จสมบูรณ์ (${formatDateDMY(dateT_Completed)})` });
    }
    // 3. ระหว่างสรุปปิดตรวจ (Col K date present)
    else if (dateK_Closed) {
      catClosingSummary.push({ name: dept, detail: `ประชุมปิดตรวจเมื่อ (${formatDateDMY(dateK_Closed)})` });
    }
    // 4. ระหว่างร่างรายงาน (Past End Date / last extension date & NO Col K closing date)
    else if (effectiveEndDate && now > effectiveEndDate) {
      const extStr = lastExtensionF ? ` (ขยายถึง ${formatDateDMY(lastExtensionF)})` : "";
      catDraftingReport.push({ name: dept, detail: `สิ้นสุดการตรวจเมื่อ ${formatDateDMY(effectiveEndDate)}${extStr}` });
    }
    // 5. ระหว่างเข้าตรวจ (Current date between Start Date G & End Date H / extension date)
    else if (startDateG && effectiveEndDate && now >= startDateG && now <= effectiveEndDate) {
      catAuditing.push({ name: dept, detail: `ระยะเวลาตรวจ ${formatDateDMY(startDateG)} - ${formatDateDMY(effectiveEndDate)}` });
    }
    // 6. ยังไม่ได้ดำเนินการ (Current date before Start Date G)
    else if (startDateG && now < startDateG) {
      catNotStarted.push({ name: dept, detail: `กำหนดเริ่มตรวจ ${formatDateDMY(startDateG)}` });
    } else {
      catNotStarted.push({ name: dept, detail: "รอดำเนินการตามแผน" });
    }
  });

  // Calculate percentages
  const calcPct = (count) => ((count / totalPlannedCount) * 100).toFixed(1) + "%";

  const todayStr = formatDateDMY(new Date());

  // Build HTML document for PDF render
  const htmlContent = `
    <div style="font-family: 'Sarabun', sans-serif; padding: 25px; color: #1e293b; line-height: 1.5; font-size: 13px;">
      
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #ccabd8; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #4c1d95;">รายงานสรุปสถานะการติดตามงานตรวจสอบภายใน</h2>
        <h4 style="margin: 5px 0 0 0; font-size: 14px; font-weight: 600; color: #64748b;">สำนักงานการตรวจสอบภายใน | ข้อมูล ณ วันที่ ${todayStr}</h4>
      </div>

      <!-- Executive Summary Table -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 15px; font-weight: 800; color: #4c1d95; margin-bottom: 10px;">📊 สรุปภาพรวมการดำเนินงานตามแผนการตรวจสอบ</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
          <thead>
            <tr style="background-color: #f3e8ff; color: #4c1d95;">
              <th style="padding: 10px; border: 1px solid #e9d5ff;">สถานะการดำเนินงาน</th>
              <th style="padding: 10px; border: 1px solid #e9d5ff; text-align: center; width: 120px;">จำนวน (ส่วนงาน)</th>
              <th style="padding: 10px; border: 1px solid #e9d5ff; text-align: center; width: 100px;">สัดส่วน (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700;">1. จำนวนหน่วยรับตรวจทั้งหมด ตามแผนการตรวจสอบประจำปี</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800;">${totalPlannedCount}</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #4c1d95;">100.0%</td>
            </tr>
            <tr style="background-color: #f0fdfa;">
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #0f766e;">2. ดำเนินการเสร็จสมบูรณ์</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #0f766e;">${catCompleted.length}</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #0f766e;">${calcPct(catCompleted.length)}</td>
            </tr>
            <tr style="background-color: #f9fdf5;">
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #3f6212;">3. ระหว่างสรุปปิดตรวจ</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #3f6212;">${catClosingSummary.length}</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #3f6212;">${calcPct(catClosingSummary.length)}</td>
            </tr>
            <tr style="background-color: #fffdf5;">
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #854d0e;">4. ระหว่างร่างรายงาน</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #854d0e;">${catDraftingReport.length}</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #854d0e;">${calcPct(catDraftingReport.length)}</td>
            </tr>
            <tr style="background-color: #fff5f3;">
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #991b1b;">5. ระหว่างเข้าตรวจ</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #991b1b;">${catAuditing.length}</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #991b1b;">${calcPct(catAuditing.length)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #475569;">6. ยังไม่ได้ดำเนินการ</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #475569;">${catNotStarted.length}</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #475569;">${calcPct(catNotStarted.length)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Detail Category Sections -->
      <div style="space-y: 15px;">
        
        <!-- Category 2 Detail -->
        <div style="margin-bottom: 15px; border: 1px solid #ADF0E2; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #86E3CE; padding: 8px 12px; font-weight: 800; color: #0E5C4B;">
            2. ดำเนินการเสร็จสมบูรณ์ (${catCompleted.length} ส่วนงาน - ${calcPct(catCompleted.length)})
          </div>
          <div style="padding: 10px; background-color: #EFFCF9;">
            ${renderCategoryListHTML(catCompleted)}
          </div>
        </div>

        <!-- Category 3 Detail -->
        <div style="margin-bottom: 15px; border: 1px solid #E1F0C2; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #D0E6A5; padding: 8px 12px; font-weight: 800; color: #3D5A14;">
            3. ระหว่างสรุปปิดตรวจ (${catClosingSummary.length} ส่วนงาน - ${calcPct(catClosingSummary.length)})
          </div>
          <div style="padding: 10px; background-color: #F6FBF0;">
            ${renderCategoryListHTML(catClosingSummary)}
          </div>
        </div>

        <!-- Category 4 Detail -->
        <div style="margin-bottom: 15px; border: 1px solid #FFE8B3; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #FFDD94; padding: 8px 12px; font-weight: 800; color: #7A5200;">
            4. ระหว่างร่างรายงาน (${catDraftingReport.length} ส่วนงาน - ${calcPct(catDraftingReport.length)})
          </div>
          <div style="padding: 10px; background-color: #FFF9EC;">
            ${renderCategoryListHTML(catDraftingReport)}
          </div>
        </div>

        <!-- Category 5 Detail -->
        <div style="margin-bottom: 15px; border: 1px solid #FCA598; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #FA897B; padding: 8px 12px; font-weight: 800; color: #9A2C1E;">
            5. ระหว่างเข้าตรวจ (${catAuditing.length} ส่วนงาน - ${calcPct(catAuditing.length)})
          </div>
          <div style="padding: 10px; background-color: #FFF0EE;">
            ${renderCategoryListHTML(catAuditing)}
          </div>
        </div>

        <!-- Category 6 Detail -->
        <div style="margin-bottom: 15px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #e2e8f0; padding: 8px 12px; font-weight: 800; color: #334155;">
            6. ยังไม่ได้ดำเนินการ (${catNotStarted.length} ส่วนงาน - ${calcPct(catNotStarted.length)})
          </div>
          <div style="padding: 10px; background-color: #f8fafc;">
            ${renderCategoryListHTML(catNotStarted)}
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; pt: 10px; text-align: right; font-size: 11px; color: #94a3b8;">
        ออกโดยระบบติดตามงานตรวจสอบและขอขยายระยะเวลา | สำนักงานการตรวจสอบภายใน
      </div>
    </div>
  `;

  // Create temporary container
  const element = document.createElement("div");
  element.innerHTML = htmlContent;
  document.body.appendChild(element);

  // Configure html2pdf options
  const opt = {
    margin: [10, 10, 10, 10],
    filename: `Internal_Audit_Report_${new Date().toISOString().slice(0,10)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
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
    return `<div style="color: #94a3b8; font-style: italic; font-size: 11px;">- ไม่มีรายการส่วนงานในหมวดนี้ -</div>`;
  }
  return `
    <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #1e293b;">
      ${items.map(item => `
        <li style="margin-bottom: 4px;">
          <strong style="color: #4c1d95;">${item.name}</strong> 
          ${item.detail ? `<span style="color: #64748b; font-size: 11px;">(${item.detail})</span>` : ''}
        </li>
      `).join('')}
    </ul>
  `;
}
