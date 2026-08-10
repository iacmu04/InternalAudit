/**
 * Main Vue 3 Application Controller
 */

const { createApp, ref, computed, onMounted, watch, nextTick } = Vue;

const app = createApp({
  setup() {
    // Current User & Auth State (Default to Admin user for quick demo)
    const currentUser = ref({
      email: "amornrath.f@gmail.com",
      name: "Pui",
      role: "Admin",
      team: "ทุกทีม",
      authorize: "all"
    });

    // System Datasets
    const rawAuditList = ref([]);
    const delayList = ref([]);
    const userList = ref([]);
    const masterLists = ref([]);
    const holidaysList = ref([]);
    const nonAuditDaysList = ref([]);

    // Filters
    const selectedFiscalYear = ref("ALL");
    const selectedTeam = ref("ALL");
    const selectedPhase = ref("ALL");
    const searchQuery = ref("");

    // Modals & Drawers Visibility
    const showAuditModal = ref(false);
    const showDelayModal = ref(false);
    const showApprovalDrawer = ref(false);
    const showLoginModal = ref(false);
    const showEditManagerModal = ref(false);

    // Form States
    const auditForm = ref(createInitialAuditFormState());
    const newDepartmentInput = ref("");
    const editingRowIndex = ref(null);

    const delayForm = ref({
      department: "",
      startDate: "",
      endDate: "",
      reason: "",
      supervisorName: ""
    });
    const isEditingDelay = ref(false);
    const editingDelayIndex = ref(null);

    const phaseStructure = PHASE_STRUCTURE;

    // Load initial data from API / Google Sheets
    const loadData = async () => {
      try {
        const data = await API.fetchInitialData();
        if (data) {
          rawAuditList.value = data.mainAudit || [];
          delayList.value = data.delay || [];
          userList.value = data.users || [];
          masterLists.value = data.masterLists || [];
          holidaysList.value = data.holidays || [];
          nonAuditDaysList.value = data.nonAuditDays || [];

          // If current logged-in user is default, match with Users sheet if available
          if (userList.value.length > 0) {
            const adminUser = userList.value.find(u => (u.Role || "").toLowerCase() === "admin") || userList.value[0];
            if (adminUser && adminUser.Email) {
              currentUser.value = {
                email: adminUser.Email,
                name: adminUser.Name || adminUser.Email,
                role: adminUser.Role || "Admin",
                team: adminUser.Team || "ทุกทีม",
                authorize: adminUser.Authorize || "all"
              };
            }
          }
        }
      } catch (err) {
        console.error("Error loading data:", err);
      }
    };

    // Filter Options Dropdowns (from Master_Lists sheet)
    const departmentOptions = computed(() => {
      const set = new Set();
      masterLists.value.forEach(item => {
        const val = item["รายชื่อส่วนงาน"] || item["ส่วนงาน"] || item["คอลัมน์ A"];
        if (val && String(val).trim() !== "") set.add(String(val).trim());
      });
      rawAuditList.value.forEach(item => {
        if (item["ส่วนงาน"]) set.add(String(item["ส่วนงาน"]).trim());
      });
      return Array.from(set).sort((a,b) => a.localeCompare(b, 'th'));
    });

    const teamOptions = computed(() => {
      const set = new Set();
      masterLists.value.forEach(item => {
        const val = item["รายชื่อทีม"] || item["ทีม"];
        if (val && String(val).trim() !== "") set.add(String(val).trim());
      });
      rawAuditList.value.forEach(item => {
        if (item["ทีม"]) set.add(String(item["ทีม"]).trim());
      });
      if (set.size === 0) ["ทีม 1", "ทีม 2", "ทีม 3", "ทีม 4", "ทีมพิเศษ"].forEach(t => set.add(t));
      return Array.from(set).sort();
    });

    const teamList = computed(() => teamOptions.value);

    const ctsCycleOptions = computed(() => {
      const set = new Set();
      masterLists.value.forEach(item => {
        const val = item["รอบประชุม_คตส"] || item["ครั้งที่ประชุม_คตส"] || item["ครั้งที่ประชุม คตส."];
        if (val && String(val).trim() !== "") set.add(String(val).trim());
      });
      if (set.size === 0) ["1/2569", "2/2569", "3/2569", "4/2569", "5/2569"].forEach(c => set.add(c));
      return Array.from(set).sort();
    });

    const supervisorOptions = computed(() => {
      return userList.value.filter(u => {
        const r = String(u.Role || "").toLowerCase();
        return r === "leader" || r === "admin" || r === "dean";
      }).map(u => ({
        name: u.Name || u.Email,
        email: u.Email
      }));
    });

    // Filtered Audit Data
    const dashboardResult = computed(() => {
      return processDashboardData(rawAuditList.value, holidaysList.value, nonAuditDaysList.value);
    });

    const filteredUnits = computed(() => {
      let list = dashboardResult.value.units;

      // Role-based access filtering
      if (currentUser.value.role !== "Admin" && currentUser.value.role !== "Dean") {
        const userTeam = String(currentUser.value.team);
        const auth = String(currentUser.value.authorize);
        if (auth !== "all") {
          list = list.filter(u => u.team === userTeam || auth.includes(u.team));
        }
      }

      if (selectedFiscalYear.value !== "ALL") {
        list = list.filter(u => u.fiscalYear === selectedFiscalYear.value);
      }

      if (selectedTeam.value !== "ALL") {
        list = list.filter(u => u.team === selectedTeam.value || `ทีม ${u.team}` === selectedTeam.value);
      }

      if (selectedPhase.value !== "ALL") {
        if (selectedPhase.value === "COMPLETED") {
          list = list.filter(u => u.isCompleted);
        } else {
          list = list.filter(u => u.latestPhase === selectedPhase.value);
        }
      }

      if (searchQuery.value.trim() !== "") {
        const q = searchQuery.value.toLowerCase().trim();
        list = list.filter(u => u.name.toLowerCase().includes(q) || u.team.includes(q));
      }

      return list;
    });

    const overallCompletionRate = computed(() => {
      if (filteredUnits.value.length === 0) return 0;
      const count = filteredUnits.value.filter(u => u.isCompleted).length;
      return Math.round((count / filteredUnits.value.length) * 100);
    });

    const completedUnitsCount = computed(() => {
      return filteredUnits.value.filter(u => u.isCompleted).length;
    });

    const hasActiveFilters = computed(() => {
      return selectedFiscalYear.value !== "ALL" ||
             selectedTeam.value !== "ALL" ||
             selectedPhase.value !== "ALL" ||
             searchQuery.value !== "";
    });

    const resetFilters = () => {
      selectedFiscalYear.value = "ALL";
      selectedTeam.value = "ALL";
      selectedPhase.value = "ALL";
      searchQuery.value = "";
    };

    // Phase Status Groups for Section 1
    const getUnitsByStatus = (subCol) => {
      return filteredUnits.value.filter(u => u.latestSubCol === subCol);
    };

    const getPhaseCount = (phaseKey) => {
      return filteredUnits.value.filter(u => u.latestPhase === phaseKey).length;
    };

    // Chart Stats & Bottlenecks
    const phaseChartStats = computed(() => {
      return [
        { key: "1.1", name: "1.1 ก่อนเข้าตรวจ", color: "#5167D7", count: getPhaseCount("1.1") },
        { key: "1.2", name: "1.2 ระหว่างการตรวจสอบ", color: "#B086DF", count: getPhaseCount("1.2") },
        { key: "1.3", name: "1.3 รายงานผลการตรวจสอบ", color: "#E2DCF5", count: getPhaseCount("1.3") },
        { key: "1.4", name: "1.4 ชี้แจงผลการดำเนินงาน", color: "#839B77", count: getPhaseCount("1.4") }
      ];
    });

    // Team Metrics for Section 3 & 4
    const teamMetrics = computed(() => {
      const teamsMap = {};

      filteredUnits.value.forEach(u => {
        const t = u.team || "ไม่ระบุ";
        if (!teamsMap[t]) {
          teamsMap[t] = { teamName: t, count: 0, sumAuditDays: 0, sumCtsDays: 0, ctsCount: 0 };
        }
        teamsMap[t].count++;
        teamsMap[t].sumAuditDays += u.actualAuditDays || 0;

        if (u.ctsDuration !== null) {
          teamsMap[t].sumCtsDays += u.ctsDuration;
          teamsMap[t].ctsCount++;
        }
      });

      return Object.values(teamsMap).map(t => ({
        teamName: t.teamName,
        count: t.count,
        avgAuditDays: t.count > 0 ? t.sumAuditDays / t.count : 0,
        avgCtsDays: t.ctsCount > 0 ? t.sumCtsDays / t.ctsCount : 0
      })).sort((a,b) => a.teamName.localeCompare(b.teamName));
    });

    // Extension Request Summary Counts (Global)
    const pendingCounts = computed(() => countPendingRequests(delayList.value));
    const pendingSupervisorCount = computed(() => pendingCounts.value.supervisorCount);
    const pendingDirectorCount = computed(() => pendingCounts.value.directorCount);

    const accessibleDelayList = computed(() => {
      return filterDelayListByRole(delayList.value, currentUser.value);
    });

    // Modal Actions
    const openAuditModal = (rowToEdit = null) => {
      if (rowToEdit) {
        editingRowIndex.value = rowToEdit._rowIndex;
        auditForm.value = populateAuditFormFromRow(rowToEdit);
      } else {
        editingRowIndex.value = null;
        auditForm.value = createInitialAuditFormState();
      }
      newDepartmentInput.value = "";
      showAuditModal.value = true;
    };

    const submitAuditForm = async () => {
      let deptName = auditForm.value["ส่วนงาน"];
      if (deptName === "__NEW__") {
        if (!newDepartmentInput.value.trim()) {
          alert("กรุณากรอกชื่อส่วนงานใหม่");
          return;
        }
        deptName = newDepartmentInput.value.trim();
        auditForm.value["ส่วนงาน"] = deptName;
      }

      if (!deptName) {
        alert("กรุณาเลือกหรือกรอกส่วนงาน");
        return;
      }

      if (editingRowIndex.value) {
        await API.postAction("updateAuditEntry", { rowIndex: editingRowIndex.value, data: auditForm.value });
      } else {
        await API.postAction("saveAuditEntry", { data: auditForm.value });
      }

      showAuditModal.value = false;
      await loadData();
      alert("บันทึกข้อมูลเรียบร้อยแล้ว");
    };

    const openDelayModal = () => {
      isEditingDelay.value = false;
      editingDelayIndex.value = null;
      delayForm.value = {
        department: departmentOptions.value[0] || "",
        startDate: "",
        endDate: "",
        reason: "",
        supervisorName: supervisorOptions.value[0] ? supervisorOptions.value[0].name : ""
      };
      showDelayModal.value = true;
    };

    const submitDelayForm = async () => {
      const payload = {
        requestorName: currentUser.value.name,
        requestorEmail: currentUser.value.email,
        department: delayForm.value.department,
        startDate: delayForm.value.startDate,
        endDate: delayForm.value.endDate,
        reason: delayForm.value.reason,
        supervisorName: delayForm.value.supervisorName
      };

      if (isEditingDelay.value && editingDelayIndex.value) {
        await API.postAction("resubmitExtension", { id: editingDelayIndex.value, data: payload });
      } else {
        await API.postAction("submitExtension", { data: payload });
      }

      showDelayModal.value = false;
      await loadData();
      alert("เสนอขอขยายเวลาเรียบร้อยแล้ว");
    };

    const editAndResubmitDelay = (item) => {
      isEditingDelay.value = true;
      editingDelayIndex.value = item._rowIndex;
      delayForm.value = {
        department: item.Department || "",
        startDate: formatISODate(item["Start Date"]),
        endDate: formatISODate(item["End Date"]),
        reason: item.Reason || "",
        supervisorName: item["Supervisor Name"] || ""
      };
      showApprovalDrawer.value = false;
      showDelayModal.value = true;
    };

    const cancelDelayRequest = async (rowIndex) => {
      if (confirm("คุณต้องการยกเลิกคำขอขยายเวลานี้ใช่หรือไม่?")) {
        await API.postAction("cancelExtension", { id: rowIndex, userEmail: currentUser.value.email });
        await loadData();
      }
    };

    const processApproval = async (rowIndex, actionStatus) => {
      await API.postAction("processApproval", {
        id: rowIndex,
        status: actionStatus,
        comment: "",
        userEmail: currentUser.value.email,
        userRole: currentUser.value.role
      });
      await loadData();
      alert("ดำเนินการเรียบร้อยแล้ว");
    };

    const promptReject = async (rowIndex) => {
      const reason = prompt("กรุณาระบุเหตุผลการตีกลับ / ไม้อนุมัติ:");
      if (reason !== null) {
        await API.postAction("processApproval", {
          id: rowIndex,
          status: "rejected",
          comment: reason,
          userEmail: currentUser.value.email,
          userRole: currentUser.value.role
        });
        await loadData();
        alert("ดำเนินการตีกลับเรียบร้อยแล้ว");
      }
    };

    const openApprovalDrawer = () => {
      showApprovalDrawer.value = true;
    };

    const openEditManagerModal = () => {
      showEditManagerModal.value = true;
    };

    const openLoginModal = () => {
      showLoginModal.value = true;
    };

    const selectUser = (u) => {
      currentUser.value = {
        email: u.Email,
        name: u.Name || u.Email,
        role: u.Role || "User",
        team: u.Team || "",
        authorize: u.Authorize || ""
      };
      showLoginModal.value = false;
    };

    const allAuditUnits = computed(() => rawAuditList.value);

    // Watchers to trigger Chart re-render
    watch(phaseChartStats, (newStats) => {
      nextTick(() => {
        renderPhaseChart("phaseStatusChart", newStats);
      });
    }, { deep: true, immediate: true });

    onMounted(async () => {
      await loadData();
      nextTick(() => {
        if (window.lucide) lucide.createIcons();
        renderPhaseChart("phaseStatusChart", phaseChartStats.value);
      });
    });

    watch([filteredUnits, showApprovalDrawer, showAuditModal, showDelayModal], () => {
      nextTick(() => {
        if (window.lucide) lucide.createIcons();
      });
    });

    return {
      currentUser,
      rawAuditList,
      delayList,
      userList,
      masterLists,
      departmentOptions,
      teamOptions,
      teamList,
      ctsCycleOptions,
      supervisorOptions,
      selectedFiscalYear,
      selectedTeam,
      selectedPhase,
      searchQuery,
      filteredUnits,
      allAuditUnits,
      overallCompletionRate,
      completedUnitsCount,
      hasActiveFilters,
      resetFilters,
      phaseStructure,
      getUnitsByStatus,
      getPhaseCount,
      phaseChartStats,
      teamMetrics,
      pendingSupervisorCount,
      pendingDirectorCount,
      accessibleDelayList,
      showAuditModal,
      showDelayModal,
      showApprovalDrawer,
      showLoginModal,
      showEditManagerModal,
      auditForm,
      newDepartmentInput,
      editingRowIndex,
      delayForm,
      isEditingDelay,
      openAuditModal,
      submitAuditForm,
      openDelayModal,
      submitDelayForm,
      editAndResubmitDelay,
      cancelDelayRequest,
      processApproval,
      promptReject,
      openApprovalDrawer,
      openEditManagerModal,
      openLoginModal,
      selectUser
    };
  }
});

app.mount('#app');
