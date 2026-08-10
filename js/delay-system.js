/**
 * Extension Request & Approval System Module
 */

function getDelayStatus(item) {
  if (!item) return "";
  for (let key in item) {
    const k = key.toLowerCase().trim();
    if (k === "status" || k.includes("สถานะ")) {
      const val = String(item[key]).trim();
      if (val) return val;
    }
  }
  return String(item.Status || item.status || "").trim();
}

function getDelayFields(item) {
  if (!item) {
    return { department: "ไม่ระบุส่วนงาน", requestor: "ไม่ระบุผู้ขอ", email: "", supervisor: "ไม่ระบุหัวหน้างาน", status: "รอพิจารณา" };
  }

  let department = item.Department || item.department || item["ส่วนงาน"] || item["หน่วยงาน"] || "";
  let requestor = item.Requestor || item.requestor || item["ผู้ขอ"] || item.Name || item.name || "";
  let email = item.Email || item.email || item["อีเมล"] || "";
  let supervisor = item["Supervisor Name"] || item.supervisorName || item["หัวหน้างาน"] || "";
  let status = getDelayStatus(item);

  // Fix field swap edge cases: if department is "Team 2" / "Pui" and requestor is "กองพัฒนานักศึกษา" / "คณะเกษตรศาสตร์"
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
      const supName = String(item["Supervisor Name"] || item.supervisorName || "").toLowerCase();
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
      let status = getDelayStatus(item);
      if (!status) {
        for (let k in item) {
          const val = String(item[k]);
          if (val.includes("รอพิจารณา") || val.includes("รออนุมัติ")) {
            status = val;
            break;
          }
        }
      }

      if (status.includes("รออนุมัติ") || status.includes("ผู้อำนวยการ") || status.includes("ผอ.")) {
        directorCount++;
      } else if (status.includes("รอพิจารณา") || status.includes("หัวหน้า") || !status || status === "รอพิจารณา") {
        supervisorCount++;
      } else {
        const lower = status.toLowerCase();
        if (!lower.includes("อนุมัติแล้ว") && !lower.includes("ตีกลับ") && !lower.includes("ยกเลิก") && !lower.includes("ไม้อนุมัติ")) {
          supervisorCount++;
        }
      }
    });
  }

  return {
    supervisorCount,
    directorCount
  };
}
