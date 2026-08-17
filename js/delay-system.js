/**
 * Extension Request & Approval System Module
 */

function getDelayStatus(item) {
  if (!item) return "";
  
  const leaderStatus = String(item.LeaderStatus || item.leaderStatus || item["สถานะหัวหน้างาน"] || item._col9 || item.col_9 || "").trim();
  const deanStatus = String(item.DeanStatus || item.deanStatus || item["สถานะผู้อำนวยการ"] || item._col11 || item.col_11 || "").trim();

  if (deanStatus === "อนุมัติ" || deanStatus === "อนุมัติแล้ว") return "อนุมัติแล้ว";
  if (deanStatus === "ไม่อนุมัติ") return "ไม่อนุมัติ";
  if (leaderStatus === "ตีกลับ") return "ตีกลับ";
  if (leaderStatus === "ขอยกเลิก") return "ขอยกเลิก";
  if (deanStatus === "รออนุมัติ" || leaderStatus === "ผ่านพิจารณา") return "รออนุมัติ (ค้างอยู่ที่ผู้อำนวยการ)";
  if (leaderStatus === "รอพิจารณา" || !leaderStatus) return "รอพิจารณา (ค้างอยู่ที่หัวหน้างาน)";

  return deanStatus || leaderStatus || "รอพิจารณา";
}

function getDelayFields(item) {
  if (!item) {
    return { 
      department: "ไม่ระบุส่วนงาน", 
      requestor: "ไม่ระบุผู้ขอ", 
      email: "", 
      startDate: "",
      endDate: "",
      totalDays: 0,
      reason: "",
      supervisor: "ไม่ระบุหัวหน้างาน", 
      leaderStatus: "รอพิจารณา",
      leaderDate: "",
      deanStatus: "-",
      deanDate: "",
      remarks: "",
      status: "รอพิจารณา" 
    };
  }

  let department = item.Department || item.department || item["ส่วนงาน"] || item["หน่วยงาน"] || item._col3 || item.col_3 || "";
  let requestor = item.Requestor || item.requestor || item["ผู้ขอ"] || item.Name || item.name || item._col1 || item.col_1 || "";
  let email = item.Email || item.email || item["อีเมล"] || item._col2 || item.col_2 || "";
  let startDate = item["Start Date"] || item.startDate || item.start_date || item["วันที่เริ่มขอขยาย"] || item._col4 || item.col_4 || "";
  let endDate = item["End Date"] || item.endDate || item.end_date || item["วันที่สิ้นสุดขอขยาย"] || item._col5 || item.col_5 || "";
  let totalDays = item["Total number of days"] || item.totalDays || item["จำนวนวันรวมที่ขอขยาย"] || item._col6 || item.col_6 || 0;
  let reason = item.Reason || item.reason || item["เหตุผล"] || item._col7 || item.col_7 || "";
  let supervisor = item.Leader || item["Supervisor Name"] || item.supervisorName || item["หัวหน้างาน"] || item._col8 || item.col_8 || "";
  let leaderStatus = item.LeaderStatus || item.leaderStatus || item["สถานะหัวหน้างาน"] || item._col9 || item.col_9 || "รอพิจารณา";
  let leaderDate = item.LeaderDate || item.leaderDate || item["วันที่หัวหน้างานพิจารณา"] || item._col10 || item.col_10 || "";
  let deanStatus = item.DeanStatus || item.deanStatus || item["สถานะผู้อำนวยการ"] || item._col11 || item.col_11 || "-";
  let deanDate = item.DeanDate || item.deanDate || item["วันที่ผอ.พิจารณา"] || item._col12 || item.col_12 || "";
  let remarks = item.Remarks || item.remarks || item["หมายเหตุ"] || item._col13 || item.col_13 || "";
  let status = getDelayStatus(item);

  return {
    department: department || "ไม่ระบุส่วนงาน",
    requestor: requestor || "ไม่ระบุผู้ขอ",
    email: email,
    startDate: startDate,
    endDate: endDate,
    supervisor: supervisor || "รอพิจารณา (ค้างอยู่ที่หัวหน้างาน)",
    totalDays: parseInt(totalDays) || 0,
    reason: reason,
    leaderStatus: leaderStatus,
    leaderDate: leaderDate,
    deanStatus: deanStatus,
    deanDate: deanDate,
    remarks: remarks,
    status: status || "รอพิจารณา"
  };
}

function filterDelayListByRole(delayList, currentUser) {
  if (!Array.isArray(delayList)) return [];

  const role = currentUser.role || "User";
  const email = String(currentUser.email || "").toLowerCase();

  if (role === "Admin" || role === "Dean") {
    return delayList;
  }

  if (role === "Leader") {
    return delayList.filter(item => {
      const supName = String(item.Leader || item["Supervisor Name"] || item.supervisorName || "").toLowerCase();
      const itemEmail = String(item.Email || item.email || "").toLowerCase();
      const status = getDelayStatus(item);
      const userMatch = supName.includes(currentUser.name.toLowerCase()) || itemEmail === email;
      return userMatch || currentUser.authorize === "all" || status.includes("รอพิจารณา");
    });
  }

  // General User: see their own requests
  return delayList.filter(item => String(item.Email || item.email || "").toLowerCase() === email);
}

function countPendingRequests(delayList) {
  let supervisorCount = 0;
  let directorCount = 0;

  if (Array.isArray(delayList)) {
    delayList.forEach(item => {
      const fields = getDelayFields(item);
      const status = fields.status;

      if (status.includes('รอพิจารณา') || fields.leaderStatus === 'รอพิจารณา') {
        supervisorCount++;
      } else if (status.includes('รออนุมัติ') || fields.deanStatus === 'รออนุมัติ') {
        directorCount++;
      }
    });
  }

  return { supervisorCount, directorCount };
}
