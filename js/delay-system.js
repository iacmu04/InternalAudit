/**
 * Extension Request & Approval System Module
 */

function filterDelayListByRole(delayList, currentUser) {
  if (!Array.isArray(delayList)) return [];

  const role = currentUser.role || "User";
  const email = String(currentUser.email || "").toLowerCase();

  if (role === "Admin") {
    return delayList;
  }

  if (role === "Dean") {
    // Director sees requests pending director approval + all requests
    return delayList;
  }

  if (role === "Leader") {
    // Leader sees requests assigned to them as supervisor or in their authorized team
    return delayList.filter(item => {
      const supName = String(item["Supervisor Name"] || item.supervisorName || "").toLowerCase();
      const userMatch = supName.includes(currentUser.name.toLowerCase()) || String(item.Email).toLowerCase() === email;
      return userMatch || currentUser.authorize === "all" || item.Status.includes("รอพิจารณา");
    });
  }

  // General User: see counts for all, but details ONLY for their own requests
  return delayList.filter(item => String(item.Email || "").toLowerCase() === email);
}

function countPendingRequests(delayList) {
  let supervisorCount = 0;
  let directorCount = 0;

  if (Array.isArray(delayList)) {
    delayList.forEach(item => {
      const status = item.Status || "";
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
