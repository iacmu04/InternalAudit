/**
 * Main Vue 3 Application Controller
 */

const { createApp, ref, computed, onMounted, watch, nextTick } = Vue;

const app = createApp({
  setup() {
    // Current User & Auth State (Default to Admin user for demo)
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

    // Main Filters
    const selectedFiscalYear = ref("ALL");
    const selectedTeam = ref("ALL");
    const selectedPhase = ref("ALL");
    const selectedCtsCycle = ref("ALL");
    const searchQuery = ref("");

    // Manager Modal Filters
    const editSearchQuery = ref("");
    const editSelectedYear = ref("ALL");
    const editSelectedTeam = ref("ALL");

    // Modals & Drawers Visibility
    const showAuditModal = ref(false);
    const showDelayModal = ref(false);
    const showApprovalDrawer = ref(false);
    const showLoginModal = ref(false);
    const showEditManagerModal = ref(false);
    const showConfigModal = ref(false);

    // Google Apps Script API Connection
    const apiUrlInput = ref(API.getApiUrl());
    const isApiConnected = computed(() => !!API.getApiUrl());

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

          if (userList.value.length > 0 && !currentUser.value.email) {
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

    // Parsed Master_Lists schema
    const parsedMasterListsSchema = computed(() => {
      return parseMasterListsSchema(masterLists.value);
    });

    const teamOptions = computed(() => parsedMasterListsSchema.value.teams);
    const teamList = computed(() => teamOptions.value);

    const ctsCycleOptions = computed(() => parsedMasterListsSchema.value.ctsCycles);
    const nonAuditReasonOptions = computed(() => parsedMasterListsSchema.value.nonAuditTypes);
    const fiscalYearOptions = computed(() => parsedMasterListsSchema.value.years);

    // Form department options dynamic per year (Col D for 2569, Col F for 2570, etc.)
    const formDepartmentOptions = computed(() => {
      const selectedYear = auditForm.value['ปีงบประมาณ'] || "2570";
      const deptsForYear = parsedMasterListsSchema.value.departmentsByYear[selectedYear];
      if (deptsForYear && deptsForYear.length > 0) {
        return deptsForYear.map(d => d.name).sort((a,b) => a.localeCompare(b, 'th'));
      }
      // Fallback to all departments across years
      const set = new Set();
      Object.values(parsedMasterListsSchema.value.departmentsByYear).forEach(list => {
        list.forEach(d => set.add(d.name));
      });
      masterLists.value.forEach(item => {
        const val = item["รายชื่อส่วนงาน"] || item["ส่วนงาน"];
        if (val && String(val).trim() !== "") set.add(String(val).trim());
      });
      return Array.from(set).sort((a,b) => a.localeCompare(b, 'th'));
    });

    const departmentOptions = computed(() => formDepartmentOptions.value);

    // Form Change Handlers
    const onFiscalYearChange = () => {
      const selectedYear = auditForm.value['ปีงบประมาณ'] || "2570";
      const deptsForYear = parsedMasterListsSchema.value.departmentsByYear[selectedYear];
      if (deptsForYear && deptsForYear.length > 0) {
        const deptNames = deptsForYear.map(d => d.name);
        if (!deptNames.includes(auditForm.value['ส่วนงาน'])) {
          auditForm.value['ส่วนงาน'] = deptNames[0] || "";
        }
      }
      onDepartmentChange();
    };

    const onDepartmentChange = () => {
      const selectedDept = auditForm.value['ส่วนงาน'];
      const selectedYear = auditForm.value['ปีงบประมาณ'] || "2570";
      const deptsForYear = parsedMasterListsSchema.value.departmentsByYear[selectedYear];
      if (deptsForYear && selectedDept) {
        const found = deptsForYear.find(d => d.name === selectedDept);
        if (found && found.team) {
          auditForm.value['ทีม'] = found.team;
        }
      }
    };

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
      return processDashboardData(rawAuditList.value, holidaysList.value, nonAuditDaysList.value, delayList.value);
    });

    const filteredUnits = computed(() => {
      let list = dashboardResult.value.units;

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

      if (selectedCtsCycle.value !== "ALL") {
        list = list.filter(u => u.raw["ครั้งที่ประชุม_คตส"] === selectedCtsCycle.value || u.raw["รอบประชุม_คตส"] === selectedCtsCycle.value || String(u.ctsCycle) === selectedCtsCycle.value);
      }

      if (searchQuery.value.trim() !== "") {
        const q = searchQuery.value.toLowerCase().trim();
        list = list.filter(u => u.name.toLowerCase().includes(q) || u.team.includes(q));
      }

      return list;
    });

    // Filtered Manager Modal Units
    const filteredManagerUnits = computed(() => {
      let list = rawAuditList.value;

      if (editSelectedYear.value !== "ALL") {
        list = list.filter(u => String(u["ปีงบประมาณ"]) === editSelectedYear.value);
      }

      if (editSelectedTeam.value !== "ALL") {
        list = list.filter(u => String(u["ทีม"]) === editSelectedTeam.value || `ทีม ${u["ทีม"]}` === editSelectedTeam.value);
      }

      if (editSearchQuery.value.trim() !== "") {
        const q = editSearchQuery.value.toLowerCase().trim();
        list = list.filter(u => String(u["ส่วนงาน"] || "").toLowerCase().includes(q));
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
             selectedCtsCycle.value !== "ALL" ||
             searchQuery.value !== "";
    });

    const resetFilters = () => {
      selectedFiscalYear.value = "ALL";
      selectedTeam.value = "ALL";
      selectedPhase.value = "ALL";
      selectedCtsCycle.value = "ALL";
      searchQuery.value = "";
    };

    // Unstarted Units logic by Teams
    const unstartedUnitsList = computed(() => {
      const plannedMap = {};

      // Gather departments across all years from parsedMasterListsSchema
      Object.values(parsedMasterListsSchema.value.departmentsByYear).forEach(list => {
        list.forEach(item => {
          if (item.name && !plannedMap[item.name]) {
            plannedMap[item.name] = { name: item.name, team: item.team || "1" };
          }
        });
      });

      // Fallback from masterLists Col A if any
      masterLists.value.forEach(item => {
        const name = String(item["รายชื่อส่วนงาน"] || item["ส่วนงาน"] || "").trim();
        const team = String(item["รายชื่อทีม"] || item["ทีม"] || "1").replace("ทีม", "").trim() || "1";
        if (name && !plannedMap[name]) plannedMap[name] = { name: name, team: team };
      });

      const recordedDeptsSet = new Set();
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      rawAuditList.value.forEach(r => {
        const dept = String(r["ส่วนงาน"] || "").trim();
        if (dept) {
          const startDateG = parseDate(r["วันที่เริ่มตรวจสอบ"]);
          if (startDateG && now >= startDateG) {
            recordedDeptsSet.add(dept);
          }
        }
      });

      const result = [];
      Object.values(plannedMap).forEach(unit => {
        if (!recordedDeptsSet.has(unit.name)) {
          result.push(unit);
        }
      });
      return result;
    });

    const team1Unstarted = computed(() => unstartedUnitsList.value.filter(u => u.team === "1"));
    const team2Unstarted = computed(() => unstartedUnitsList.value.filter(u => u.team === "2"));
    const team3Unstarted = computed(() => unstartedUnitsList.value.filter(u => u.team === "3"));
    const team4Unstarted = computed(() => unstartedUnitsList.value.filter(u => u.team === "4" || u.team === "พิเศษ"));

    // Phase Status Groups for Section 1
    const getUnitsByStatus = (subCol) => {
      return filteredUnits.value.filter(u => u.latestSubCol === subCol);
    };

    const getPhaseCount = (phaseKey) => {
      const count = filteredUnits.value.filter(u => u.latestPhase === phaseKey).length;
      if (phaseKey === "1.1") {
        return count + unstartedUnitsList.value.length;
      }
      return count;
    };

    // Chart Stats with User-Specified Palette Colors
    const phaseChartStats = computed(() => {
      return [
        { key: "1.1", name: "1.1 ก่อนเข้าตรวจ (รวมยังไม่ดำเนินการ)", color: "#FA897B", count: getPhaseCount("1.1") },
        { key: "1.2", name: "1.2 ระหว่างการตรวจสอบ", color: "#FFDD94", count: getPhaseCount("1.2") },
        { key: "1.3", name: "1.3 รายงานผลการตรวจสอบ", color: "#D0E6A5", count: getPhaseCount("1.3") },
        { key: "1.4", name: "1.4 ชี้แจงผลการดำเนินงาน", color: "#86E3CE", count: getPhaseCount("1.4") }
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
        avgCtsDays: t.ctsCount > 0 ? t.sumCtsDays / t.count : 0
      })).sort((a,b) => a.teamName.localeCompare(b.teamName));
    });

    // Accessible delay list by current user role
    const accessibleDelayList = computed(() => {
      return filterDelayListByRole(delayList.value, currentUser.value);
    });

    // Extension Request Summary Counts (Global & Accessible)
    const pendingCounts = computed(() => {
      const listToCount = delayList.value.length > 0 ? delayList.value : accessibleDelayList.value;
      return countPendingRequests(listToCount);
    });
    const pendingSupervisorCount = computed(() => pendingCounts.value.supervisorCount);
    const pendingDirectorCount = computed(() => pendingCounts.value.directorCount);

    // Dynamic Non_Audit_Days functions inside Audit Form
    const addNonAuditDateRow = () => {
      if (!auditForm.value.nonAuditDays) {
        auditForm.value.nonAuditDays = [];
      }
      auditForm.value.nonAuditDays.push({
        date: "",
        reason: nonAuditReasonOptions.value[0] || "ติดประชุมมหาวิทยาลัย",
        details: ""
      });
      nextTick(() => {
        if (window.flatpickr) {
          flatpickr(".flatpickr-date", {
            dateFormat: "d/m/Y",
            allowInput: true,
            locale: "th"
          });
        }
      });
    };

    const removeNonAuditDateRow = (index) => {
      if (auditForm.value.nonAuditDays && auditForm.value.nonAuditDays.length > index) {
        auditForm.value.nonAuditDays.splice(index, 1);
      }
    };

    // Config Modal Actions
    const openConfigModal = () => {
      apiUrlInput.value = API.getApiUrl();
      showConfigModal.value = true;
    };

    const saveConfigUrl = async () => {
      if (!apiUrlInput.value.trim()) {
        alert("กรุณากรอก Web App URL");
        return;
      }
      API.setApiUrl(apiUrlInput.value);
      showConfigModal.value = false;
      await loadData();
      alert("เชื่อมต่อ Google Apps Script เรียบร้อยแล้ว!");
    };

    const clearConfigUrl = async () => {
      API.setApiUrl("");
      apiUrlInput.value = "";
      showConfigModal.value = false;
      await loadData();
      alert("ยกเลิกการเชื่อมต่อเรียบร้อยแล้ว");
    };

    // Helper for checking write response
    const handleApiResponse = (res) => {
      if (res && res.status === "need_config") {
        alert("กรุณาเชื่อมต่อ Web App URL จาก Google Apps Script เพื่อบันทึกลง Google Sheet จริง");
        openConfigModal();
        return false;
      }
      if (res && res.status === "error") {
        alert("เกิดข้อผิดพลาดในการบันทึก: " + res.message);
        return false;
      }
      return true;
    };

    // Modal Actions
    const openAuditModal = (rowToEdit = null) => {
      if (rowToEdit) {
        editingRowIndex.value = rowToEdit._rowIndex;
        auditForm.value = populateAuditFormFromRow(rowToEdit, nonAuditDaysList.value);
      } else {
        editingRowIndex.value = null;
        auditForm.value = createInitialAuditFormState();
        onFiscalYearChange();
      }
      newDepartmentInput.value = "";
      showAuditModal.value = true;
      nextTick(() => {
        if (window.flatpickr) {
          flatpickr(".flatpickr-date", {
            dateFormat: "d/m/Y",
            allowInput: true,
            locale: "th"
          });
        }
      });
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

      // Normalize date values to ISO format before posting
      const formDataToSend = { ...auditForm.value };
      Object.keys(formDataToSend).forEach(key => {
        if (key !== "nonAuditDays" && formDataToSend[key] && key.startsWith("วันที่")) {
          const d = parseDate(formDataToSend[key]);
          if (d) formDataToSend[key] = formatISODate(d);
        }
      });

      let res;
      if (editingRowIndex.value) {
        res = await API.postAction("updateAuditEntry", { rowIndex: editingRowIndex.value, data: formDataToSend });
      } else {
        res = await API.postAction("saveAuditEntry", { data: formDataToSend });
      }

      if (!handleApiResponse(res)) return;

      // Update local nonAuditDaysList for calculation
      if (Array.isArray(auditForm.value.nonAuditDays)) {
        // Filter out existing entries for this department
        const updatedList = nonAuditDaysList.value.filter(item => String(item["ส่วนงาน"] || item.department || "").trim().toLowerCase() !== deptName.trim().toLowerCase());
        auditForm.value.nonAuditDays.forEach(entry => {
          if (entry.date) {
            updatedList.push({
              "ส่วนงาน": deptName,
              "วันที่": entry.date,
              "ประเภท": entry.reason,
              "สาเหตุ/หมายเหตุ": entry.reason,
              "รายละเอียด": entry.details
            });
          }
        });
        nonAuditDaysList.value = updatedList;
      }

      showAuditModal.value = false;
      await loadData();
      alert(res.message || "บันทึกข้อมูลเรียบร้อยแล้ว");
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
      const extensionCalc = calculateActualAuditDays(
        delayForm.value.startDate, 
        delayForm.value.endDate, 
        delayForm.value.department, 
        holidaysList.value, 
        nonAuditDaysList.value
      );
      const totalDays = extensionCalc.actualDays || 0;

      const payload = {
        requestorName: currentUser.value.name,
        requestorEmail: currentUser.value.email,
        department: delayForm.value.department,
        startDate: delayForm.value.startDate,
        endDate: delayForm.value.endDate,
        totalDays: totalDays,
        reason: delayForm.value.reason,
        supervisorName: delayForm.value.supervisorName
      };

      // Always append as new row for starting new/resubmitted request process per specs
      const res = await API.postAction("submitExtension", { data: payload });

      if (!handleApiResponse(res)) return;

      showDelayModal.value = false;
      await loadData();
      alert(res.message || "เสนอขอขยายเวลาเรียบร้อยแล้ว");
    };

    const exportPdfReportAction = () => {
      generatePdfReport(masterLists.value, rawAuditList.value, delayList.value);
    };

    const editAndResubmitDelay = (item) => {
      isEditingDelay.value = true;
      editingDelayIndex.value = item._rowIndex;
      delayForm.value = {
        department: item.Department || item.department || "",
        startDate: formatISODate(item["Start Date"] || item.startDate),
        endDate: formatISODate(item["End Date"] || item.endDate),
        reason: item.Reason || item.reason || "",
        supervisorName: item["Supervisor Name"] || item.supervisorName || ""
      };
      showApprovalDrawer.value = false;
      showDelayModal.value = true;
    };

    const cancelDelayRequest = async (rowIndex) => {
      if (confirm("คุณต้องการยกเลิกคำขอขยายเวลานี้ใช่หรือไม่?")) {
        const res = await API.postAction("cancelExtension", { id: rowIndex, userEmail: currentUser.value.email });
        if (!handleApiResponse(res)) return;
        await loadData();
      }
    };

    const processApproval = async (rowIndex, actionStatus) => {
      const res = await API.postAction("processApproval", {
        id: rowIndex,
        status: actionStatus,
        comment: "",
        userEmail: currentUser.value.email,
        userRole: currentUser.value.role
      });
      if (!handleApiResponse(res)) return;
      await loadData();
      alert(res.message || "ดำเนินการเรียบร้อยแล้ว");
    };

    const promptReject = async (rowIndex) => {
      const reason = prompt("กรุณาระบุเหตุผลการตีกลับ / ไม่อนุมัติ:");
      if (reason !== null) {
        const res = await API.postAction("processApproval", {
          id: rowIndex,
          status: "rejected",
          comment: reason,
          userEmail: currentUser.value.email,
          userRole: currentUser.value.role
        });
        if (!handleApiResponse(res)) return;
        await loadData();
        alert(res.message || "ดำเนินการตีกลับเรียบร้อยแล้ว");
      }
    };

    const openApprovalDrawer = () => {
      showApprovalDrawer.value = true;
    };

    const openEditManagerModal = () => {
      editSearchQuery.value = "";
      editSelectedYear.value = "ALL";
      editSelectedTeam.value = "ALL";
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

    const calculateExtensionDays = (item) => {
      const startDate = item['Start Date'] || item.startDate;
      const endDate = item['End Date'] || item.endDate;
      if (!startDate || !endDate) return null;
      
      const dept = getDelayFields(item).department;
      const result = calculateActualAuditDays(startDate, endDate, dept, holidaysList.value, nonAuditDaysList.value);
      return result;
    };

    const warningDeptsList = computed(() => {
      const units = dashboardResult.value.units || [];
      return units.filter(u => u.isWarning || (u.ctsDuration !== null && u.ctsDuration >= 50)).map(u => ({
        name: u.name,
        team: u.team,
        daysSinceClose: u.ctsDuration !== null ? u.ctsDuration : (dateDiffInDays(u.raw['วันที่ปิดตรวจ'], new Date()) || 50)
      }));
    });

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

    watch([filteredUnits, showApprovalDrawer, showAuditModal, showDelayModal, showConfigModal, showEditManagerModal], () => {
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
      nonAuditReasonOptions,
      ctsCycleOptions,
      supervisorOptions,
      selectedFiscalYear,
      selectedTeam,
      selectedPhase,
      selectedCtsCycle,
      searchQuery,
      editSearchQuery,
      editSelectedYear,
      editSelectedTeam,
      filteredUnits,
      filteredManagerUnits,
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
      showConfigModal,
      apiUrlInput,
      isApiConnected,
      openConfigModal,
      saveConfigUrl,
      clearConfigUrl,
      auditForm,
      newDepartmentInput,
      editingRowIndex,
      delayForm,
      isEditingDelay,
      addNonAuditDateRow,
      removeNonAuditDateRow,
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
      selectUser,
      dateDiffInDays,
      calculateExtensionDays,
      warningDeptsList,
      unstartedUnitsList,
      team1Unstarted,
      team2Unstarted,
      team3Unstarted,
      fiscalYearOptions,
      formDepartmentOptions,
      onFiscalYearChange,
      onDepartmentChange,
      exportPdfReportAction,
      formatDateDMY,
      getDelayFields
    };
  }
});

app.mount('#app');
