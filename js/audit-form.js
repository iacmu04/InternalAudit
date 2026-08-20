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
    "clarifications": [
      {
        "วันที่หน่วยรับตรวจชี้แจง": "",
        "วันที่เสนออธิการบดี_ชี้แจง": "",
        "วันที่แจ้งหน่วยรับตรวจ_ชี้แจง": ""
      }
    ],
    "nonAuditDays": []
  };
}

function populateAuditFormFromRow(row, existingNonAuditList = []) {
  const form = createInitialAuditFormState();
  Object.keys(form).forEach(key => {
    if (key !== "nonAuditDays" && key !== "clarifications" && key !== "ครั้งที่ประชุม_คตส" && key !== "ปีงบประมาณ" && key !== "ทีม" && key !== "ส่วนงาน" && row[key]) {
      form[key] = formatDateDMY(row[key]);
    }
  });
  form["ส่วนงาน"] = row["ส่วนงาน"] || "";
  form["ปีงบประมาณ"] = row["ปีงบประมาณ"] || "2570";
  form["ทีม"] = String(row["ทีม"] || "1");
  form["ครั้งที่ประชุม_คตส"] = formatCtsCycle(row["ครั้งที่ประชุม_คตส"] || row["รอบประชุม_คตส"] || row._col16 || "");

  // Load clarifications array or single fields
  if (Array.isArray(row.clarifications) && row.clarifications.length > 0) {
    form.clarifications = row.clarifications.map(c => ({
      "วันที่หน่วยรับตรวจชี้แจง": formatDateDMY(c["วันที่หน่วยรับตรวจชี้แจง"]),
      "วันที่เสนออธิการบดี_ชี้แจง": formatDateDMY(c["วันที่เสนออธิการบดี_ชี้แจง"]),
      "วันที่แจ้งหน่วยรับตรวจ_ชี้แจง": formatDateDMY(c["วันที่แจ้งหน่วยรับตรวจ_ชี้แจง"] || c["วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์"])
    }));
  } else {
    form.clarifications = [
      {
        "วันที่หน่วยรับตรวจชี้แจง": formatDateDMY(row["วันที่หน่วยรับตรวจชี้แจง"]),
        "วันที่เสนออธิการบดี_ชี้แจง": formatDateDMY(row["วันที่เสนออธิการบดี_ชี้แจง"]),
        "วันที่แจ้งหน่วยรับตรวจ_ชี้แจง": formatDateDMY(row["วันที่แจ้งหน่วยรับตรวจ_ชี้แจง"] || row["วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์"])
      }
    ];
  }

  // Load existing non-audit days for this unit
  if (Array.isArray(existingNonAuditList) && form["ส่วนงาน"]) {
    const deptClean = String(form["ส่วนงาน"]).trim().toLowerCase();
    form.nonAuditDays = existingNonAuditList.filter(item => {
      const itemDept = String(item["ส่วนงาน"] || item.department || item._col2 || item._col1 || "").trim().toLowerCase();
      return itemDept === deptClean;
    }).map(item => ({
      date: formatDateDMY(item["วันที่"] || item.date || item._col0),
      reason: item["ประเภท"] || item.reason || item["สาเหตุ/หมายเหตุ"] || item._col1 || "ติดประชุมมหาวิทยาลัย",
      details: item["รายละเอียด"] || item.details || item["สาเหตุ/หมายเหตุ"] || item._col3 || ""
    }));
  }

  return form;
}
