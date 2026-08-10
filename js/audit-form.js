/**
 * Audit Form Module: Audit Data Entry & Master List Sync
 */

function createInitialAuditFormState() {
  return {
    "ส่วนงาน": "",
    "ปีงบประมาณ": "2569",
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
    "วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์": ""
  };
}

function populateAuditFormFromRow(row) {
  const form = createInitialAuditFormState();
  Object.keys(form).forEach(key => {
    if (row[key]) {
      form[key] = formatISODate(row[key]);
    }
  });
  form["ส่วนงาน"] = row["ส่วนงาน"] || "";
  form["ปีงบประมาณ"] = row["ปีงบประมาณ"] || "2569";
  form["ทีม"] = String(row["ทีม"] || "1");
  form["ครั้งที่ประชุม_คตส"] = row["ครั้งที่ประชุม_คตส"] || "";
  return form;
}
