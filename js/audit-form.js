/**
 * Audit Form Module: Audit Data Entry & Master List Sync
 */

function createInitialAuditFormState() {
  return {
    "ส่วนงาน": "",
    "ปีงบประมาณ": "2570",
    "ทีม": "1",
    "วันที่มอบหมายงาน": "",
    "วันที่แจ้งเข้าตรวจ": "",
    "วันที่อนุมัติแผน": "",
    "วันที่เริ่มตรวจสอบ": "",
    "วันที่สิ้นสุดการตรวจสอบ": "",
    "วันที่ปิดตรวจ": "",
    "วันที่เสนออธิการบดี_รายงาน": "",
    "วันที่แจ้งหน่วยรับตรวจ_รายงาน": "",
    "วันที่เสนอ_คตส": "",
    "ครั้งที่ประชุม_คตส": "",
    "วันที่หน่วยรับตรวจชี้แจง": "",
    "วันที่เสนออธิการบดี_ชี้แจง": "",
    "วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์": "",
    "nonAuditDays": []
  };
}

function populateAuditFormFromRow(row, existingNonAuditList = []) {
  const form = createInitialAuditFormState();
  Object.keys(form).forEach(key => {
    if (key !== "nonAuditDays" && row[key]) {
      form[key] = formatDateDMY(row[key]);
    }
  });
  form["ส่วนงาน"] = row["ส่วนงาน"] || "";
  form["ปีงบประมาณ"] = row["ปีงบประมาณ"] || "2570";
  form["ทีม"] = String(row["ทีม"] || "1");
  form["ครั้งที่ประชุม_คตส"] = row["ครั้งที่ประชุม_คตส"] || "";

  // Load existing non-audit days for this unit
  if (Array.isArray(existingNonAuditList) && form["ส่วนงาน"]) {
    const deptClean = String(form["ส่วนงาน"]).trim().toLowerCase();
    form.nonAuditDays = existingNonAuditList.filter(item => {
      const itemDept = String(item["ส่วนงาน"] || item.department || "").trim().toLowerCase();
      return itemDept === deptClean;
    }).map(item => ({
      date: formatDateDMY(item["วันที่"] || item.date),
      reason: item["ประเภท"] || item["สาเหตุ/หมายเหตุ"] || item.reason || "",
      details: item["รายละเอียด"] || item.details || ""
    }));
  }

  return form;
}
