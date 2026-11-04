/**
 * Audit Form Module: Audit Data Entry & Master List Sync
 */

function createInitialAuditFormState() {
  return {
    "ส่วนงาน": "",
    "ปีงบประมาณ": "2570",
    "ทีม": "",
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
    "nonAuditDays": [],
    "nonAuditDays70": [
      { days: "", reason: "" }
    ]
  };
}

function populateAuditFormFromRow(row, existingNonAuditList = [], existingNonAudit70List = []) {
  const form = createInitialAuditFormState();
  Object.keys(form).forEach(key => {
    if (key !== "nonAuditDays" && key !== "nonAuditDays70" && key !== "clarifications" && key !== "ครั้งที่ประชุม_คตส" && key !== "ปีงบประมาณ" && key !== "ทีม" && key !== "ส่วนงาน" && row[key]) {
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

  // Load existing non-audit days for 2569 and previous years (Non_Audit_Days)
  if (Array.isArray(existingNonAuditList) && form["ส่วนงาน"]) {
    form.nonAuditDays = existingNonAuditList.map(item => extractNonAuditRow(item))
      .filter(item => {
        if (!item || !item.date) return false;
        return isSameDepartment(item.department, form["ส่วนงาน"]);
      })
      .map(item => ({
        date: formatDateDMY(item.date),
        reason: item.reason || "ติดประชุมมหาวิทยาลัย",
        details: item.details || ""
      }));
  }

  // Load existing non-audit days for 2570 (Non_Audit_Days 70)
  if (Array.isArray(existingNonAudit70List) && form["ส่วนงาน"]) {
    const list70 = existingNonAudit70List.map(item => typeof extractNonAudit70Row === "function" ? extractNonAudit70Row(item) : item)
      .filter(item => {
        if (!item) return false;
        return isSameDepartment(item.department, form["ส่วนงาน"]);
      });

    if (list70.length > 0) {
      form.nonAuditDays70 = list70.map(item => ({
        days: item.days !== undefined ? item.days : (item["จำนวนวัน"] || 0),
        reason: item.reason || item["เหตุผล"] || ""
      }));
    } else {
      form.nonAuditDays70 = [{ days: "", reason: "" }];
    }
  } else {
    form.nonAuditDays70 = [{ days: "", reason: "" }];
  }

  return form;
}
