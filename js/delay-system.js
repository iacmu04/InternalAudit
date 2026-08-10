/**
 * Extension Request & Approval System Module
 */

function getDelayStatus(item) {
  if (!item) return "";
  for (let key in item) {
    if (key.toLowerCase().trim() === "status" || key.includes("สถานะ")) {
      return String(item[key]).trim();
    }
  }
  return String(item.Status || item.status || "").trim();
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
      const status = getDelayStatus(item);
      if (status.includes("รอพิจารณา")) {
        supervisorCount++;
      } else if (status.includes("รออนุมัติ")) {
        directorCount++;
      }
    });
  }

  return {
    supervisorCount,
    directorCount
  };
}
