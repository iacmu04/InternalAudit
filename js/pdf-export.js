/**
 * PDF Export Module for Internal Audit Tracking System
 * Generates formatted multi-page PDF summary report with explicit 3-section page structure
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
    if (dateT_Completed) {
      catCompleted.push({ name: dept, detail: `เสร็จสมบูรณ์ (${formatDateDMY(dateT_Completed)})` });
    } else if (dateK_Closed) {
      catClosingSummary.push({ name: dept, detail: `ประชุมปิดตรวจเมื่อ (${formatDateDMY(dateK_Closed)})` });
    } else if (effectiveEndDate && now > effectiveEndDate) {
      const extStr = lastExtensionF ? ` (ขยายถึง ${formatDateDMY(lastExtensionF)})` : "";
      catDraftingReport.push({ name: dept, detail: `สิ้นสุดการตรวจเมื่อ ${formatDateDMY(effectiveEndDate)}${extStr}` });
    } else if (startDateG && effectiveEndDate && now >= startDateG && now <= effectiveEndDate) {
      catAuditing.push({ name: dept, detail: `ระยะเวลาตรวจ ${formatDateDMY(startDateG)} - ${formatDateDMY(effectiveEndDate)}` });
    } else if (startDateG && now < startDateG) {
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
    <div style="font-family: 'Sarabun', sans-serif; color: #1e293b; line-height: 1.5; font-size: 13pt; background: #ffffff;">
      
      <!-- ================= PAGE 1: หน้าสรุปภาพรวม ================= -->
      <div style="padding: 20px; page-break-after: always; break-after: page;">
        
        <!-- Header Title -->
        <div style="text-align: center; border-bottom: 3px solid #7e22ce; padding-bottom: 12px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 20pt; font-weight: 800; color: #3b0764; line-height: 1.3;">
            รายงานสรุปสถานะการติดตามงานตรวจสอบภายใน
          </h1>
          <h3 style="margin: 6px 0 0 0; font-size: 14pt; font-weight: 600; color: #581c87;">
            สำนักงานการตรวจสอบภายใน | ข้อมูล ณ วันที่ ${todayStr}
          </h3>
        </div>

        <!-- Section 1 Title -->
        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 18pt; font-weight: 800; color: #3b0764; margin: 0 0 8px 0; padding-bottom: 6px; border-bottom: 2px solid #e9d5ff;">
            ส่วนที่ 1: หน้าสรุปภาพรวม (Executive Summary)
          </h2>
          <p style="font-size: 12pt; color: #64748b; margin: 0;">
            สรุปสัดส่วนการดำเนินงานจำแนกตามสถานะเปรียบเทียบกับจำนวนหน่วยรับตรวจตามแผนประจำปี
          </p>
        </div>

        <!-- Executive Summary Table -->
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13pt; margin-bottom: 25px;">
          <thead>
            <tr style="background-color: #6b21a8; color: #ffffff;">
              <th style="padding: 12px 14px; border: 1px solid #581c87; font-size: 14pt;">สถานะการดำเนินงาน</th>
              <th style="padding: 12px 14px; border: 1px solid #581c87; text-align: center; width: 140px; font-size: 14pt;">จำนวน (ส่วนงาน)</th>
              <th style="padding: 12px 14px; border: 1px solid #581c87; text-align: center; width: 120px; font-size: 14pt;">สัดส่วน (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #f3e8ff;">
              <td style="padding: 10px 14px; border: 1px solid #d8b4fe; font-weight: 800; font-size: 13pt; color: #3b0764;">
                1. จำนวนหน่วยรับตรวจทั้งหมด ตามแผนการตรวจสอบประจำปี
              </td>
              <td style="padding: 10px 14px; border: 1px solid #d8b4fe; text-align: center; font-weight: 800; font-size: 14pt; color: #3b0764;">
                ${totalPlannedCount}
              </td>
              <td style="padding: 10px 14px; border: 1px solid #d8b4fe; text-align: center; font-weight: 800; font-size: 14pt; color: #6b21a8;">
                100.0%
              </td>
            </tr>
            <tr style="background-color: #f0fdf4;">
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; font-weight: 700; color: #166534;">2. ดำเนินการเสร็จสมบูรณ์</td>
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #166534; font-size: 14pt;">${catCompleted.length}</td>
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #166534; font-size: 14pt;">${calcPct(catCompleted.length)}</td>
            </tr>
            <tr style="background-color: #f7fee7;">
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; font-weight: 700; color: #3f6212;">3. ระหว่างสรุปปิดตรวจ</td>
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #3f6212; font-size: 14pt;">${catClosingSummary.length}</td>
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #3f6212; font-size: 14pt;">${calcPct(catClosingSummary.length)}</td>
            </tr>
            <tr style="background-color: #fefce8;">
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; font-weight: 700; color: #854d0e;">4. ระหว่างร่างรายงาน</td>
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #854d0e; font-size: 14pt;">${catDraftingReport.length}</td>
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #854d0e; font-size: 14pt;">${calcPct(catDraftingReport.length)}</td>
            </tr>
            <tr style="background-color: #fff1f2;">
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; font-weight: 700; color: #9f1239;">5. ระหว่างเข้าตรวจ</td>
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #9f1239; font-size: 14pt;">${catAuditing.length}</td>
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #9f1239; font-size: 14pt;">${calcPct(catAuditing.length)}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <td style="padding: 10px 14px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569;">6. ยังไม่ได้ดำเนินการ</td>
              <td style="padding: 8px 14px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #475569; font-size: 14pt;">${catNotStarted.length}</td>
              <td style="padding: 8px 14px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #475569; font-size: 14pt;">${calcPct(catNotStarted.length)}</td>
            </tr>
          </tbody>
        </table>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: right; font-size: 11pt; color: #64748b;">
          หน้า 1/3 (หน้าสรุปภาพรวม)
        </div>
      </div>


      <!-- ================= PAGE 2: หน้าสถานะที่ดำเนินการและอยู่ระหว่างดำเนินการ ================= -->
      <div style="padding: 20px; page-break-after: always; break-after: page;">
        
        <h2 style="font-size: 18pt; font-weight: 800; color: #3b0764; margin: 0 0 16px 0; padding-bottom: 6px; border-bottom: 2px solid #e9d5ff;">
          ส่วนที่ 2: รายละเอียดสถานะงานตรวจสอบที่อยู่ระหว่างดำเนินการและเสร็จสมบูรณ์
        </h2>

        <!-- Category 2 Detail -->
        <div style="margin-bottom: 16px; border: 1px solid #86E3CE; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #86E3CE; padding: 10px 14px; font-weight: 800; font-size: 15pt; color: #0E5C4B;">
            2. ดำเนินการเสร็จสมบูรณ์ (${catCompleted.length} ส่วนงาน - ${calcPct(catCompleted.length)})
          </div>
          <div style="padding: 12px; background-color: #EFFCF9;">
            ${renderCategoryListHTML(catCompleted)}
          </div>
        </div>

        <!-- Category 3 Detail -->
        <div style="margin-bottom: 16px; border: 1px solid #D0E6A5; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #D0E6A5; padding: 10px 14px; font-weight: 800; font-size: 15pt; color: #3D5A14;">
            3. ระหว่างสรุปปิดตรวจ (${catClosingSummary.length} ส่วนงาน - ${calcPct(catClosingSummary.length)})
          </div>
          <div style="padding: 12px; background-color: #F6FBF0;">
            ${renderCategoryListHTML(catClosingSummary)}
          </div>
        </div>

        <!-- Category 4 Detail -->
        <div style="margin-bottom: 16px; border: 1px solid #FFDD94; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #FFDD94; padding: 10px 14px; font-weight: 800; font-size: 15pt; color: #7A5200;">
            4. ระหว่างร่างรายงาน (${catDraftingReport.length} ส่วนงาน - ${calcPct(catDraftingReport.length)})
          </div>
          <div style="padding: 12px; background-color: #FFF9EC;">
            ${renderCategoryListHTML(catDraftingReport)}
          </div>
        </div>

        <!-- Category 5 Detail -->
        <div style="margin-bottom: 16px; border: 1px solid #FA897B; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
          <div style="background-color: #FA897B; padding: 10px 14px; font-weight: 800; font-size: 15pt; color: #9A2C1E;">
            5. ระหว่างเข้าตรวจ (${catAuditing.length} ส่วนงาน - ${calcPct(catAuditing.length)})
          </div>
          <div style="padding: 12px; background-color: #FFF0EE;">
            ${renderCategoryListHTML(catAuditing)}
          </div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: right; font-size: 11pt; color: #64748b;">
          หน้า 2/3 (รายชื่อส่วนงานที่อยู่ระหว่างดำเนินการและเสร็จสมบูรณ์)
        </div>
      </div>


      <!-- ================= PAGE 3: ส่วนงานที่ยังไม่ได้ดำเนินการ (ALWAYS NEW PAGE) ================= -->
      <div style="padding: 20px;">
        
        <h2 style="font-size: 18pt; font-weight: 800; color: #3b0764; margin: 0 0 16px 0; padding-bottom: 6px; border-bottom: 2px solid #e9d5ff;">
          ส่วนที่ 3: รายชื่อส่วนงานที่ยังไม่ได้ดำเนินการ
        </h2>

        <!-- Category 6 Detail -->
        <div style="margin-bottom: 20px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #e2e8f0; padding: 10px 14px; font-weight: 800; font-size: 15pt; color: #1e293b;">
            6. ยังไม่ได้ดำเนินการ (${catNotStarted.length} ส่วนงาน - ${calcPct(catNotStarted.length)})
          </div>
          <div style="padding: 14px; background-color: #f8fafc;">
            ${renderCategoryListHTML(catNotStarted)}
          </div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: right; font-size: 11pt; color: #64748b;">
          หน้า 3/3 (ส่วนงานที่ยังไม่ได้ดำเนินการ)
        </div>
      </div>

    </div>
  `;

  // Create temporary container
  const element = document.createElement("div");
  element.innerHTML = htmlContent;
  document.body.appendChild(element);

  // Configure html2pdf options with text slice protection
  const opt = {
    margin: [8, 8, 8, 8],
    filename: `Internal_Audit_Report_${new Date().toISOString().slice(0,10)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
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
    return `<div style="color: #94a3b8; font-style: italic; font-size: 12pt; padding: 6px 0;">- ไม่มีรายการส่วนงานในหมวดนี้ -</div>`;
  }
  return `
    <ul style="margin: 0; padding-left: 24px; font-size: 13pt; color: #1e293b; space-y: 6px;">
      ${items.map(item => `
        <li style="margin-bottom: 8px; page-break-inside: avoid; break-inside: avoid;">
          <strong style="color: #3b0764; font-size: 16pt; font-weight: 800; display: inline-block;">${item.name}</strong> 
          ${item.detail ? `<span style="color: #64748b; font-size: 12pt; font-weight: 500; margin-left: 6px;">(${item.detail})</span>` : ''}
        </li>
      `).join('')}
    </ul>
  `;
}
