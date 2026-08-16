/**
 * Extension Request & Approval System Module
 */

function getDelayStatus(item) {
  if (!item) return "";
  
  const leaderStatus = item.LeaderStatus || item.leaderStatus || item["สถานะหัวหน้างาน"] || "";
  const deanStatus = item.DeanStatus || item.deanStatus || item["สถานะผู้อำนวยการ"] || "";

  if (deanStatus === "อนุมัติ" || deanStatus === "อนุมัติแล้ว") return "อนุมัติแล้ว";
  if (deanStatus === "ไม่อนุมัติ") return "ไม่อนุมัติ";
  if (leaderStatus === "ตีกลับ") return "ตีกลับ";
  if (deanStatus === "รออนุมัติ" || leaderStatus === "ผ่านพิจารณา") return "รออนุมัติ (ค้างอยู่ที่ผู้อำนวยการ)";
  if (leaderStatus === "รอพิจารณา" || !leaderStatus) return "รอพิจารณา (ค้างอยู่ที่หัวหน้างาน)";

  for (let key in item) {
    const k = key.toLowerCase().trim();
    if (k === "status" || k.includes("สถานะ")) {
      const val = String(item[key]).trim();
      if (val) return val;
    }
  }
  return String(item.Status || item.status || "รอพิจารณา").trim();
}

function getDelayFields(item) {
  if (!item) {
    return { 
      department: "ไม่ระบุส่วนงาน", 
      requestor: "ไม่ระบุผู้ขอ", 
      email: "", 
      supervisor: "ไม่ระบุหัวหน้างาน", 
      totalDays: 0,
      leaderStatus: "รอพิจารณา",
      deanStatus: "-",
      status: "รอพิจารณา" 
    };
  }

  let department = item.Department || item.department || item["ส่วนงาน"] || item["หน่วยงาน"] || "";
  let requestor = item.Requestor || item.requestor || item["ผู้ขอ"] || item.Name || item.name || "";
  let email = item.Email || item.email || item["อีเมล"] || "";
  let supervisor = item.Leader || item["Supervisor Name"] || item.supervisorName || item["หัวหน้างาน"] || "";
  let totalDays = item["Total number of days"] || item.totalDays || item["จำนวนวันรวมที่ขอขยาย"] || 0;
  let leaderStatus = item.LeaderStatus || item.leaderStatus || "รอพิจารณา";
  let deanStatus = item.DeanStatus || item.deanStatus || "-";
  let status = getDelayStatus(item);

  // Fix field swap edge cases
  if (department && (department.toLowerCase().startsWith("team") || department === "Pui") && requestor && !requestor.toLowerCase().startsWith("team")) {
    const temp = department;
    department = requestor;
    requestor = temp;
  }

  return {
    department: department || "ไม่ระบุส่วนงาน",
    requestor: requestor || "ไม่ระบุผู้ขอ",
    email: email,
    supervisor: supervisor || "รอพิจารณา (ค้างอยู่ที่หัวหน้างาน)",
    totalDays: parseInt(totalDays) || 0,
    leaderStatus: leaderStatus,
    deanStatus: deanStatus,
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
