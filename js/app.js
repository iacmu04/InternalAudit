/**
 * Main Vue 3 Application Controller
 */

const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

const app = createApp({
  setup() {
    // Current User & Auth State (Persisted in localStorage)
    const getStoredUser = () => {
      try {
        const saved = localStorage.getItem("CURRENT_USER");
        if (saved) {
          const u = JSON.parse(saved);
          if (u && u.email) return u;
        }
      } catch (e) {}
      return {
        email: "amornrath.f@gmail.com",
        name: "Pui",
        role: "Admin",
        team: "ทุกทีม",
        authorize: "all"
      };
    };

    const currentUser = ref(getStoredUser());

    // System Datasets
    const rawAuditList = ref([]);
    const delayList = ref([]);
    const userList = ref([]);
    const masterLists = ref([]);
    const holidaysList = ref([]);
    const nonAuditDaysList = ref([]);

    // Main Filters — Default to 2570 as requested
    const selectedFiscalYears = ref(["2570"]);
    const yearButtonList = ["2568", "2569", "2570", "2571", "2572"];

    const toggleYearButton = (yr) => {
      if (yr === "ALL") {
        selectedFiscalYears.value = ["ALL"];
        return;
      }
      let current = Array.isArray(selectedFiscalYears.value) ? selectedFiscalYears.value.filter(y => y !== "ALL") : [];
      if (current.includes(yr)) {
        current = current.filter(y => y !== yr);
      } else {
        current.push(yr);
      }
      if (current.length === 0 || current.length === yearButtonList.length) {
        selectedFiscalYears.value = ["ALL"];
      } else {
        selectedFiscalYears.value = current.sort((a,b) => a.localeCompare(b));
      }
    };

    const isYearSelected = (yr) => {
      if (yr === "ALL") {
        return selectedFiscalYears.value.includes("ALL");
      }
      return selectedFiscalYears.value.includes("ALL") || selectedFiscalYears.value.includes(yr);
    };

    const selectedFiscalYear = computed({
      get: () => selectedFiscalYears.value.includes("ALL") ? "ALL" : (selectedFiscalYears.value[0] || "ALL"),
      set: (val) => {
        if (val === "ALL") selectedFiscalYears.value = ["ALL"];
        else if (Array.isArray(val)) selectedFiscalYears.value = val;
        else selectedFiscalYears.value = [val];
      }
    });

    const selectedYearDisplayLabel = computed(() => {
      const active = selectedFiscalYears.value;
      if (active.includes("ALL") || active.length === 0) return "ทุกปีงบประมาณ";
      if (active.length === 1) return `ปี พ.ศ. ${active[0]}`;
      return `ปี ${active.join(", ")}`;
    });

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
    const showPdfModal = ref(false);

    const pdfExportForm = reactive({
      ctsMeetingNumber: "",
      includeStatusDetails: true
    });

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
        console.log("🔄 loadData: Fetching initial data...");
        console.log("🔄 loadData: API URL =", API.getApiUrl().substring(0, 80) + "...");
        const data = await API.fetchInitialData();
        if (data) {
          rawAuditList.value = data.mainAudit || [];
          delayList.value = data.delay || [];
          userList.value = data.users || [];
          masterLists.value = data.masterLists || [];
          holidaysList.value = data.holidays || [];
          nonAuditDaysList.value = data.nonAuditDays || [];

          console.log("✅ loadData: mainAudit =", rawAuditList.value.length, "rows");
          console.log("✅ loadData: masterLists =", masterLists.value.length, "rows");
          console.log("✅ loadData: users =", userList.value.length, "rows");
          console.log("✅ loadData: delay =", delayList.value.length, "rows");
          if (masterLists.value.length > 0) {
            const r0 = masterLists.value[0];
            console.log("✅ loadData: masterLists[0] _col3 =", r0._col3, "| _col5 =", r0._col5);
          }

          // Sync current user with latest info from Users sheet
          if (userList.value.length > 0 && currentUser.value.email) {
            const matched = userList.value.find(u => (u.Email || "").toLowerCase().trim() === currentUser.value.email.toLowerCase().trim());
            if (matched) {
              currentUser.value = {
                email: matched.Email,
                name: matched.Name || matched.Email,
                role: matched.Role || "User",
                team: matched.Team || "ทุกทีม",
                authorize: matched.Authorize || "all"
              };
            }
          }
        } else {
          console.error("❌ loadData: fetchInitialData returned null/undefined");
        }
      } catch (err) {
        console.error("❌ Error loading data:", err);
      }
    };

    // Parsed Master_Lists schema
    const parsedMasterListsSchema = computed(() => {
      return parseMasterListsSchema(masterLists.value);
    });

    const teamOptions = computed(() => (parsedMasterListsSchema.value && parsedMasterListsSchema.value.teams) || ["1", "2", "3", "4"]);
    const teamList = computed(() => teamOptions.value);

    const ctsCycleOptions = computed(() => {
      const raw = (parsedMasterListsSchema.value && parsedMasterListsSchema.value.ctsCycles) || [];
      const set = new Set();
      raw.forEach(c => {
        const fmt = formatCtsCycle(c);
        if (fmt && fmt.match(/^\d+\/\d{4}$/)) set.add(fmt);
      });
      if (Array.isArray(rawAuditList.value)) {
        rawAuditList.value.forEach(row => {
          const rawCts = row["ครั้งที่ประชุม_คตส"] || row["รอบประชุม_คตส"] || row._col16;
          const fmt = formatCtsCycle(rawCts);
          if (fmt && fmt.match(/^\d+\/\d{4}$/)) set.add(fmt);
        });
      }
      const list = Array.from(set);
      if (list.length > 0) {
        return list.sort((a, b) => {
          const [ca, ya] = a.split('/').map(Number);
          const [cb, yb] = b.split('/').map(Number);
          return (ya || 0) !== (yb || 0) ? (ya || 0) - (yb || 0) : (ca || 0) - (cb || 0);
        });
      }
      return ["1/2569", "2/2569", "3/2569", "4/2569", "5/2569", "1/2570", "2/2570"];
    });
    const nonAuditReasonOptions = computed(() => (parsedMasterListsSchema.value && parsedMasterListsSchema.value.nonAuditTypes) || []);
    const fiscalYearOptions = computed(() => {
      const defaultYears = ["2568", "2569", "2570", "2571", "2572"];
      const set = new Set(defaultYears);
      const list = (parsedMasterListsSchema.value && parsedMasterListsSchema.value.years) || [];
      list.forEach(y => set.add(y));
      if (Array.isArray(rawAuditList.value)) {
        rawAuditList.value.forEach(row => {
          const yr = String(row["ปีงบประมาณ"] || row["ปี"] || row._col1 || "").trim();
          if (yr && yr.match(/^\d{4}$/)) {
            set.add(yr);
          }
        });
      }
      return Array.from(set).sort((a,b) => a.localeCompare(b));
    });

    // Form department options dynamic per year (excluding already recorded depts to prevent duplicates)
    const formDepartmentOptions = computed(() => {
      const selectedYear = auditForm.value['ปีงบประมาณ'] || "2570";
      const schema = parsedMasterListsSchema.value;
      if (schema && schema.departmentsByYear && schema.departmentsByYear[selectedYear]) {
        const deptsForYear = schema.departmentsByYear[selectedYear];
        if (deptsForYear && deptsForYear.length > 0) {
          const currentDeptBeingEdited = editingRowIndex.value ? String(auditForm.value['ส่วนงาน'] || "").trim().toLowerCase() : null;
          
          const existingDeptsInYear = new Set(
            rawAuditList.value
              .filter(r => String(r["ปีงบประมาณ"] || r._col1 || "").trim() === String(selectedYear).trim())
              .map(r => String(r["ส่วนงาน"] || r._col0 || "").trim().toLowerCase())
          );
          
          return deptsForYear
            .map(d => d.name)
            .filter(name => {
              if (currentDeptBeingEdited && name.toLowerCase() === currentDeptBeingEdited) return true;
              return !existingDeptsInYear.has(name.toLowerCase());
            })
            .sort((a,b) => a.localeCompare(b, 'th'));
        }
      }
      return [];
    });

    const departmentOptions = computed(() => formDepartmentOptions.value);

    // Form Change Handlers
    const onFiscalYearChange = () => {
      const selectedYear = auditForm.value['ปีงบประมาณ'] || "2570";
      const availableDepts = formDepartmentOptions.value;
      if (availableDepts.length > 0) {
        if (!availableDepts.includes(auditForm.value['ส่วนงาน'])) {
          auditForm.value['ส่วนงาน'] = availableDepts[0] || "";
        }
      } else {
        auditForm.value['ส่วนงาน'] = "";
      }
      onDepartmentChange();
    };

    const onDepartmentChange = () => {
      const selectedDept = auditForm.value['ส่วนงาน'];
      const selectedYear = auditForm.value['ปีงบประมาณ'] || "2570";
      const schema = parsedMasterListsSchema.value;
      if (schema && schema.departmentsByYear && schema.departmentsByYear[selectedYear] && selectedDept) {
        const deptsForYear = schema.departmentsByYear[selectedYear];
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

      // Only restrict by team if user is a Leader with specific assigned team
      if (currentUser.value.role === "Leader") {
        const userTeam = String(currentUser.value.team).replace(/^ทีม\s*/, "").trim();
        const auth = String(currentUser.value.authorize).trim();
        if (auth !== "all" && userTeam) {
          list = list.filter(u => u.team === userTeam || auth.includes(u.team));
        }
      }

      const activeYears = selectedFiscalYears.value;
      if (!activeYears.includes("ALL") && activeYears.length > 0) {
        list = list.filter(u => {
          const uYr = String(u.fiscalYear || (u.raw ? (u.raw["ปีงบประมาณ"] || u.raw._col1) : "") || "").trim();
          return activeYears.includes(uYr);
        });
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
        const targetCycle = formatCtsCycle(selectedCtsCycle.value);
        list = list.filter(u => {
          const uCycle = formatCtsCycle(u.ctsCycle || (u.raw ? (u.raw["ครั้งที่ประชุม_คตส"] || u.raw["รอบประชุม_คตส"] || u.raw._col16) : ""));
          return uCycle === targetCycle;
        });
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

    // Unstarted Units logic filtered by selected fiscal year and team
    const unstartedUnitsList = computed(() => {
      const activeYears = selectedFiscalYears.value;
      const isAllYears = activeYears.includes("ALL") || activeYears.length === 0;
      const selectedTeamFilter = selectedTeam.value;
      const plannedMap = {};

      const schema = parsedMasterListsSchema.value;
      if (schema && schema.departmentsByYear) {
        if (!isAllYears) {
          activeYears.forEach(yr => {
            const list = schema.departmentsByYear[yr] || [];
            list.forEach(item => {
              const key = `${item.name}_${yr}`;
              if (item.name && !plannedMap[key]) {
                plannedMap[key] = { name: item.name, team: item.team || "1", year: yr };
              }
            });
          });
        } else {
          Object.entries(schema.departmentsByYear).forEach(([yr, list]) => {
            if (Array.isArray(list)) {
              list.forEach(item => {
                const key = `${item.name}_${yr}`;
                if (item.name && !plannedMap[key]) {
                  plannedMap[key] = { name: item.name, team: item.team || "1", year: yr };
                }
              });
            }
          });
        }
      }

      // Check recorded audit units in rawAuditList to exclude ones that have already started/been recorded with actual dates
      const recordedDeptsSet = new Set();
      rawAuditList.value.forEach(r => {
        const dept = String(r["ส่วนงาน"] || r._col0 || "").trim();
        const rYear = String(r["ปีงบประมาณ"] || r["ปี"] || r._col1 || "").trim();
        
        let hasAnyDate = false;
        for (let item of STATUS_PRIORITY_ORDER) {
          const v = getRowDateVal(r, item.sub, item.colIdx);
          if (v && v !== "-" && String(v).trim() !== "") {
            hasAnyDate = true;
            break;
          }
        }

        if (dept && hasAnyDate) {
          if (!isAllYears) {
            if (activeYears.includes(rYear)) {
              recordedDeptsSet.add(`${dept}_${rYear}`);
            }
          } else {
            recordedDeptsSet.add(`${dept}_${rYear}`);
            recordedDeptsSet.add(dept);
          }
        }
      });

      let result = [];
      Object.values(plannedMap).forEach(unit => {
        const checkKey = `${unit.name}_${unit.year}`;
        if (!recordedDeptsSet.has(checkKey) && (!isAllYears || !recordedDeptsSet.has(unit.name))) {
          result.push(unit);
        }
      });

      // Filter by Team if a specific team filter is selected
      if (selectedTeamFilter !== "ALL") {
        const cleanTeamFilter = selectedTeamFilter.replace(/^ทีม\s*/, "").trim();
        result = result.filter(u => u.team === cleanTeamFilter || `ทีม ${u.team}` === selectedTeamFilter);
      }

      return result;
    });

    const team1Unstarted = computed(() => unstartedUnitsList.value.filter(u => u.team === "1"));
    const team2Unstarted = computed(() => unstartedUnitsList.value.filter(u => u.team === "2"));
    const team3Unstarted = computed(() => unstartedUnitsList.value.filter(u => u.team === "3"));
    const team4Unstarted = computed(() => unstartedUnitsList.value.filter(u => u.team === "4" || u.team === "พิเศษ"));

    // Total Planned Units for the selected year filter (from Master_Lists or recorded)
    const totalPlannedUnitsCount = computed(() => {
      const activeYears = selectedFiscalYears.value;
      const isAllYears = activeYears.includes("ALL") || activeYears.length === 0;
      const selectedTeamFilter = selectedTeam.value;
      const schema = parsedMasterListsSchema.value;
      let totalPlanned = 0;

      if (schema && schema.departmentsByYear) {
        if (!isAllYears) {
          activeYears.forEach(yr => {
            let list = schema.departmentsByYear[yr] || [];
            if (selectedTeamFilter !== "ALL") {
              const cleanTeam = selectedTeamFilter.replace(/^ทีม\s*/, "").trim();
              list = list.filter(item => item.team === cleanTeam || `ทีม ${item.team}` === selectedTeamFilter);
            }
            totalPlanned += list.length;
          });
        } else {
          Object.values(schema.departmentsByYear).forEach(list => {
            if (Array.isArray(list)) {
              let subList = list;
              if (selectedTeamFilter !== "ALL") {
                const cleanTeam = selectedTeamFilter.replace(/^ทีม\s*/, "").trim();
                subList = subList.filter(item => item.team === cleanTeam || `ทีม ${item.team}` === selectedTeamFilter);
              }
              totalPlanned += subList.length;
            }
          });
        }
      }

      const currentFilteredCount = filteredUnits.value.length;
      const unstartedCount = unstartedUnitsList.value.length;

      return Math.max(totalPlanned, currentFilteredCount + unstartedCount);
    });

    const completedUnitsCount = computed(() => {
      return filteredUnits.value.filter(u => u.isCompleted || u.latestSubCol === "วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์").length;
    });

    const overallCompletionRate = computed(() => {
      const total = totalPlannedUnitsCount.value;
      if (total <= 0) return 0;
      return Math.round((completedUnitsCount.value / total) * 100);
    });

    const hasActiveFilters = computed(() => {
      return !selectedFiscalYears.value.includes("ALL") ||
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

    // Accessible delay list by current user role, sorted: pending items first (Leader/Dean approval), then newest
    const accessibleDelayList = computed(() => {
      const list = filterDelayListByRole(delayList.value, currentUser.value);
      
      const getPriority = (item) => {
        const s = getDelayStatus(item);
        if (s.includes("รอพิจารณา")) return 1; // Pending leader consideration
        if (s.includes("รออนุมัติ")) return 2;  // Pending director approval
        if (s.includes("ตีกลับ")) return 3;    // Rejected / needs edit
        if (s.includes("ขอยกเลิก")) return 4;
        if (s === "อนุมัติแล้ว") return 5;     // Approved
        if (s === "ไม่อนุมัติ") return 6;     // Disapproved
        return 7;
      };

      return [...list].sort((a, b) => {
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        const rowA = Number(a._rowIndex) || 0;
        const rowB = Number(b._rowIndex) || 0;
        return rowB - rowA;
      });
    });

    // Extension Request Summary Counts (Global & Accessible)
    const pendingCounts = computed(() => {
      const listToCount = delayList.value.length > 0 ? delayList.value : accessibleDelayList.value;
      return countPendingRequests(listToCount);
    });
    const pendingSupervisorCount = computed(() => pendingCounts.value.supervisorCount);
    const pendingDirectorCount = computed(() => pendingCounts.value.directorCount);

    // Robust Flatpickr initializer that triggers Vue v-model updates
    const initFlatpickrDatepickers = () => {
      nextTick(() => {
        if (window.flatpickr) {
          flatpickr(".flatpickr-date", {
            dateFormat: "d/m/Y",
            allowInput: true,
            locale: "th",
            onChange: function(selectedDates, dateStr, instance) {
              if (instance && instance.input) {
                instance.input.value = dateStr;
                instance.input.dispatchEvent(new Event("input", { bubbles: true }));
                instance.input.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          });
        }
      });
    };

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
      initFlatpickrDatepickers();
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

    const addClarificationItem = () => {
      if (!Array.isArray(auditForm.value.clarifications)) {
        auditForm.value.clarifications = [];
      }
      auditForm.value.clarifications.push({
        "วันที่หน่วยรับตรวจชี้แจง": "",
        "วันที่เสนออธิการบดี_ชี้แจง": "",
        "วันที่แจ้งหน่วยรับตรวจ_ชี้แจง": ""
      });
      initFlatpickrDatepickers();
    };

    const removeClarificationItem = (index) => {
      if (Array.isArray(auditForm.value.clarifications) && auditForm.value.clarifications.length > 1) {
        auditForm.value.clarifications.splice(index, 1);
      }
    };

    // Modal Actions
    const openAuditModal = (rowToEdit = null) => {
      if (currentUser.value.role === "User") {
        alert("⚠️ คุณอยู่ในสิทธิ์ผู้ตรวจสอบ (User - ดูข้อมูลได้อย่างเดียว)\nไม่สามารถเพิ่มหรือแก้ไขข้อมูลการตรวจสอบได้ กรุณาเข้าสู่ระบบด้วยบัญชี Google ที่มีสิทธิ์แก้ไข");
        return;
      }

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
      initFlatpickrDatepickers();
    };

    const submitAuditForm = async () => {
      if (currentUser.value.role === "User") {
        alert("⚠️ คุณไม่มีสิทธิ์บันทึกหรือแก้ไขข้อมูล");
        return;
      }

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

      const selectedYr = String(auditForm.value["ปีงบประมาณ"] || "2570").trim();

      // Check duplicate when adding new record
      if (!editingRowIndex.value) {
        const isDuplicate = rawAuditList.value.some(r => 
          String(r["ส่วนงาน"] || r._col0 || "").trim().toLowerCase() === String(deptName).trim().toLowerCase() &&
          String(r["ปีงบประมาณ"] || r._col1 || "").trim() === selectedYr
        );
        if (isDuplicate) {
          alert(`⚠️ ส่วนงาน "${deptName}" มีข้อมูลการตรวจสอบในปีงบประมาณ ${selectedYr} อยู่แล้วในระบบ\n\nไม่อนุญาตให้เพิ่มแถวซ้ำ กรุณาใช้เมนู "จัดการและแก้ไขข้อมูล" เพื่อแก้ไขข้อมูลของส่วนงานนี้`);
          return;
        }
      }

      // Normalize date values to ISO format before posting
      const formDataToSend = { ...auditForm.value };
      Object.keys(formDataToSend).forEach(key => {
        if (key !== "nonAuditDays" && key !== "clarifications" && formDataToSend[key] && key.startsWith("วันที่")) {
          const d = parseDate(formDataToSend[key]);
          if (d) formDataToSend[key] = formatISODate(d);
        }
      });

      // Normalize clarifications array
      if (Array.isArray(auditForm.value.clarifications)) {
        const normClarifications = auditForm.value.clarifications.map(c => {
          const item = { ...c };
          Object.keys(item).forEach(k => {
            if (item[k] && k.startsWith("วันที่")) {
              const d = parseDate(item[k]);
              if (d) item[k] = formatISODate(d);
            }
          });
          return item;
        });

        formDataToSend.clarifications = normClarifications;
        const c0 = normClarifications[0] || {};
        const cLast = normClarifications[normClarifications.length - 1] || {};

        formDataToSend["วันที่หน่วยรับตรวจชี้แจง"] = c0["วันที่หน่วยรับตรวจชี้แจง"] || "";
        formDataToSend["วันที่เสนออธิการบดี_ชี้แจง"] = c0["วันที่เสนออธิการบดี_ชี้แจง"] || "";
        formDataToSend["วันที่แจ้งหน่วยรับตรวจ_เสร็จสมบูรณ์"] = cLast["วันที่แจ้งหน่วยรับตรวจ_ชี้แจง"] || c0["วันที่แจ้งหน่วยรับตรวจ_ชี้แจง"] || "";
        formDataToSend["วันที่แจ้งหน่วยรับตรวจ_ชี้แจง"] = cLast["วันที่แจ้งหน่วยรับตรวจ_ชี้แจง"] || c0["วันที่แจ้งหน่วยรับตรวจ_ชี้แจง"] || "";
      }

      // Normalize nonAuditDays array
      const normalizedNonAuditDays = [];
      if (Array.isArray(auditForm.value.nonAuditDays)) {
        auditForm.value.nonAuditDays.forEach(entry => {
          if (entry && entry.date) {
            let isoDate = entry.date;
            const d = parseDate(entry.date);
            if (d) isoDate = formatISODate(d);

            normalizedNonAuditDays.push({
              "ส่วนงาน": deptName,
              department: deptName,
              "วันที่": isoDate,
              date: isoDate,
              "ประเภท": entry.reason || "ติดประชุมมหาวิทยาลัย",
              reason: entry.reason || "ติดประชุมมหาวิทยาลัย",
              "สาเหตุ/หมายเหตุ": entry.details || entry.reason || "ติดประชุมมหาวิทยาลัย",
              "รายละเอียด": entry.details || ""
            });
          }
        });
      }
      formDataToSend.nonAuditDays = normalizedNonAuditDays;

      // Effective combined list for immediate accurate calculation
      const effectiveNonAuditList = nonAuditDaysList.value
        .filter(item => String(item["ส่วนงาน"] || item.department || "").trim().toLowerCase() !== deptName.trim().toLowerCase())
        .concat(normalizedNonAuditDays);

      // ═══════════════════════════════════════════════════════════
      // Calculate duration fields according to user specifications:
      // 1. ระยะเวลาตรวจสอบตามแผน (Col I): วันที่เริ่ม (G) -> วันที่สิ้นสุด (H) ลบ เสาร์-อาทิตย์, วันหยุด (Thai_Holidays), วันไม่ตรวจ (Non_Audit_Days)
      // 2. ระยะเวลาตรวจจริง (Col J): ผลลัพธ์ Col I + จำนวนวันที่ขอขยายเวลาที่ได้รับอนุมัติในชีท Delay (Col G) จับคู่ตามส่วนงาน
      // 3. ระยะเวลาเสนอรายงาน อธิการบดี (Col M): วันที่ปิดตรวจ (K) -> วันที่เสนออธิการบดี (L)
      // 4. ระยะเวลาเสนอรายงาน คตส. (Col P): วันที่ปิดตรวจ (K) -> วันที่เสนอ คตส. (O)
      // ═══════════════════════════════════════════════════════════
      const auditStartDate = formDataToSend["วันที่เริ่มตรวจสอบ"];
      const auditEndDate = formDataToSend["วันที่สิ้นสุดการตรวจสอบ"];
      const auditCloseDate = formDataToSend["วันที่ปิดตรวจ"];
      const presidentReportDate = formDataToSend["วันที่เสนออธิการบดี_รายงาน"];
      const ctsReportDate = formDataToSend["วันที่เสนอ_คตส"];

      // 1. ระยะเวลาตรวจสอบตามแผน (Col I)
      let plannedDays = 0;
      if (auditStartDate && auditEndDate) {
        const plannedCalc = calculateActualAuditDays(
          auditStartDate, auditEndDate, deptName, 
          holidaysList.value, effectiveNonAuditList
        );
        if (plannedCalc && plannedCalc.actualDays >= 0) {
          plannedDays = plannedCalc.actualDays;
          formDataToSend["ระยะเวลาตรวจสอบตามแผน"] = plannedDays;
          console.log(`📊 1. ระยะเวลาตรวจสอบตามแผน (Col I) = ${plannedDays} วัน (หักเสาร์-อาทิตย์: ${plannedCalc.weekendDays}, วันหยุด: ${plannedCalc.holidayDays}, วันไม่ตรวจ: ${plannedCalc.nonAuditDays})`);
        }
      }

      // 2. ดึงจำนวนวันที่ขอขยายระยะเวลาที่ได้รับอนุมัติในชีท Delay (Col G) สำหรับส่วนงานนี้
      let approvedExtensionDays = 0;
      if (Array.isArray(delayList.value) && deptName) {
        const deptClean = String(deptName).trim().toLowerCase();
        delayList.value.forEach(item => {
          const itemDept = String(item.Department || item.department || item["ส่วนงาน"] || item._col3 || "").trim().toLowerCase();
          const deanStatus = String(item.DeanStatus || item.status || item.Status || item._col11 || "").trim();
          const leaderStatus = String(item.LeaderStatus || item._col9 || "").trim();
          
          if (itemDept === deptClean && (deanStatus.includes("อนุมัติ") || deanStatus.includes("อนุมัติแล้ว") || (deanStatus === "-" && (leaderStatus.includes("อนุมัติ") || leaderStatus.includes("ผ่านพิจารณา"))))) {
            const days = parseInt(item["Total number of days"] || item.totalDays || item["จำนวนวันรวมที่ขอขยาย"] || item._col6 || 0) || 0;
            approvedExtensionDays += days;
          }
        });
      }

      // 2. ระยะเวลาตรวจจริง (Col J) = Col I + วันขอขยายเวลาที่ได้รับอนุมัติ
      if (auditStartDate && auditEndDate) {
        const totalActualDays = plannedDays + approvedExtensionDays;
        formDataToSend["ระยะเวลาตรวจจริง (วัน)"] = totalActualDays;
        formDataToSend["ระยะเวลาตรวจจริง"] = totalActualDays;
        formDataToSend["ระยะเวลาจริงในการตรวจสอบ"] = totalActualDays;
        formDataToSend["ระยะเวลาจริงในการตรวจสอบ (วัน)"] = totalActualDays;
        console.log(`📊 2. ระยะเวลาตรวจจริง (Col J) = Col I (${plannedDays}) + วันขอขยายเวลาที่อนุมัติ (${approvedExtensionDays}) = ${totalActualDays} วัน`);
      }

      // 3. ระยะเวลาเสนออธิการบดี (Col M): ปิดตรวจ (K) -> เสนออธิการบดี (L)
      if (auditCloseDate && presidentReportDate) {
        const durPresident = dateDiffInDays(auditCloseDate, presidentReportDate);
        if (durPresident !== null && durPresident >= 0) {
          formDataToSend["ระยะเวลาเสนออธิการบดี"] = durPresident;
          console.log(`📊 3. ระยะเวลาเสนอรายงาน อธิการบดี (Col M) = ${durPresident} วัน (ปิดตรวจ: ${auditCloseDate} -> เสนออธิการบดี: ${presidentReportDate})`);
        }
      }

      // 4. ระยะเวลาเสนอ คตส. (Col P): ปิดตรวจ (K) -> เสนอ คตส. (O)
      if (auditCloseDate && ctsReportDate) {
        const durCts = dateDiffInDays(auditCloseDate, ctsReportDate);
        if (durCts !== null && durCts >= 0) {
          formDataToSend["ระยะเวลาเสนอ_คตส"] = durCts;
          formDataToSend["ระยะเวลาเสนอ คตส."] = durCts;
          formDataToSend["ระยะเวลาเสนอคตส."] = durCts;
          formDataToSend["ระยะเวลาเสนอรายงานคตส."] = durCts;
          console.log(`📊 4. ระยะเวลาเสนอรายงาน คตส. (Col P) = ${durCts} วัน (ปิดตรวจ: ${auditCloseDate} -> เสนอ คตส.: ${ctsReportDate})`);
        }
      }

      let res;
      if (editingRowIndex.value) {
        res = await API.postAction("updateAuditEntry", { rowIndex: editingRowIndex.value, data: formDataToSend });
      } else {
        res = await API.postAction("saveAuditEntry", { data: formDataToSend });
      }

      if (!handleApiResponse(res)) return;

      // Update local nonAuditDaysList for calculation
      nonAuditDaysList.value = effectiveNonAuditList;

      showAuditModal.value = false;
      await loadData();
      alert(res.message || "บันทึกข้อมูลเรียบร้อยแล้ว");
    };

    // Delay Form Department Options filtered by selected fiscal year in delayForm
    const delayDepartmentOptions = computed(() => {
      const selectedYear = delayForm.value.fiscalYear || "2570";
      const schema = parsedMasterListsSchema.value;
      if (schema && schema.departmentsByYear && schema.departmentsByYear[selectedYear]) {
        const deptsForYear = schema.departmentsByYear[selectedYear];
        if (deptsForYear && deptsForYear.length > 0) {
          return deptsForYear.map(d => d.name).sort((a,b) => a.localeCompare(b, 'th'));
        }
      }
      return [];
    });

    const onDelayFiscalYearChange = () => {
      const available = delayDepartmentOptions.value;
      if (available.length > 0) {
        delayForm.value.department = available[0];
      } else {
        delayForm.value.department = "";
      }
    };

    const openDelayModal = () => {
      isEditingDelay.value = false;
      editingDelayIndex.value = null;
      const currentYr = selectedFiscalYears.value.find(y => y !== "ALL") || "2570";
      delayForm.value = {
        fiscalYear: currentYr,
        department: "",
        startDate: "",
        endDate: "",
        reason: "",
        supervisorName: supervisorOptions.value[0] ? supervisorOptions.value[0].name : ""
      };
      onDelayFiscalYearChange();
      showDelayModal.value = true;
    };

    // Real-time calculation of requested extension days for Delay modal
    const calculatedDelayDays = computed(() => {
      if (!delayForm.value.startDate || !delayForm.value.endDate || !delayForm.value.department) return 0;
      const calc = calculateActualAuditDays(
        delayForm.value.startDate, 
        delayForm.value.endDate, 
        delayForm.value.department, 
        holidaysList.value, 
        nonAuditDaysList.value
      );
      return calc ? (calc.actualDays || 0) : 0;
    });

    const submitDelayForm = async () => {
      // คำนวณจำนวนวันที่ขอขยายเวลา: เริ่มขอขยาย (E) -> สิ้นสุดขอขยาย (F)
      // ลบ เสาร์-อาทิตย์, วันหยุด (Thai_Holidays), วันไม่ตรวจ (Non_Audit_Days)
      const extensionCalc = calculateActualAuditDays(
        delayForm.value.startDate, 
        delayForm.value.endDate, 
        delayForm.value.department, 
        holidaysList.value, 
        nonAuditDaysList.value
      );
      const totalDays = (extensionCalc && extensionCalc.actualDays !== undefined) ? extensionCalc.actualDays : 0;

      const payload = {
        requestorName: currentUser.value.name,
        requestorEmail: currentUser.value.email,
        department: delayForm.value.department,
        startDate: delayForm.value.startDate,
        endDate: delayForm.value.endDate,
        totalDays: totalDays,
        "Total number of days": totalDays,
        "จำนวนวันรวมที่ขอขยาย": totalDays,
        reason: delayForm.value.reason,
        supervisorName: delayForm.value.supervisorName
      };

      console.log(`⏱️ คำนวณจำนวนวันที่ขอขยายเวลา (ชีท Delay Col G) = ${totalDays} วัน (เริ่ม: ${delayForm.value.startDate} -> สิ้นสุด: ${delayForm.value.endDate}, หักเสาร์-อาทิตย์: ${extensionCalc.weekendDays}, วันหยุด: ${extensionCalc.holidayDays}, วันไม่ตรวจ: ${extensionCalc.nonAuditDays})`);

      // Always append as new row for starting new/resubmitted request process per specs
      const res = await API.postAction("submitExtension", { data: payload });

      if (!handleApiResponse(res)) return;

      showDelayModal.value = false;
      await loadData();
      alert(res.message || "เสนอขอขยายเวลาเรียบร้อยแล้ว");
    };

    const exportPdfReportAction = () => {
      pdfExportForm.ctsMeetingNumber = (selectedCtsCycle.value && selectedCtsCycle.value !== "ALL") ? selectedCtsCycle.value : "";
      pdfExportForm.includeStatusDetails = true;
      showPdfModal.value = true;
      nextTick(() => {
        if (window.lucide) lucide.createIcons();
      });
    };

    const confirmGeneratePdf = () => {
      showPdfModal.value = false;
      generatePdfReport({
        masterLists: masterLists.value,
        rawAuditList: rawAuditList.value,
        delayList: delayList.value,
        parsedSchema: parsedMasterListsSchema.value,
        filteredUnits: filteredUnits.value,
        unstartedUnitsList: unstartedUnitsList.value,
        selectedFiscalYears: selectedFiscalYears.value,
        selectedFiscalYear: selectedFiscalYear.value,
        selectedTeam: selectedTeam.value,
        selectedPhase: selectedPhase.value,
        ctsMeetingNumber: pdfExportForm.ctsMeetingNumber.trim(),
        includeStatusDetails: pdfExportForm.includeStatusDetails,
        totalPlannedUnitsCount: totalPlannedUnitsCount.value,
        completedUnitsCount: completedUnitsCount.value,
        overallCompletionRate: overallCompletionRate.value
      });
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
      let approvedDays = "";
      const item = delayList.value.find(d => d._rowIndex === rowIndex);
      
      if (actionStatus === "approved" && (currentUser.value.role === "Dean" || currentUser.value.role === "Admin")) {
        if (item) {
          const fields = getDelayFields(item);
          const sDate = fields.startDate || item["Start Date"] || item.startDate || item._col4 || item.col_4;
          const eDate = fields.endDate || item["End Date"] || item.endDate || item._col5 || item.col_5;
          const dept = fields.department;
          
          const calc = calculateActualAuditDays(
            sDate,
            eDate,
            dept,
            holidaysList.value,
            nonAuditDaysList.value
          );
          approvedDays = (calc && calc.actualDays !== undefined) ? calc.actualDays : 0;
          console.log(`⏱️ ผอ. อนุมัติคำขอแถวที่ ${rowIndex} (${dept}) -> คำนวณบันทึกลง Col G = ${approvedDays} วัน (เริ่ม: ${sDate} -> สิ้นสุด: ${eDate})`);
        }
      }

      const res = await API.postAction("processApproval", {
        id: rowIndex,
        status: actionStatus,
        comment: "",
        approvedDays: approvedDays,
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
          approvedDays: "",
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
      if (currentUser.value.role === "User") {
        alert("⚠️ คุณอยู่ในสิทธิ์ผู้ตรวจสอบ (User - ดูข้อมูลได้อย่างเดียว)\nไม่สามารถจัดการหรือแก้ไขข้อมูลได้ กรุณาเข้าสู่ระบบด้วยบัญชี Google ที่มีสิทธิ์แก้ไข");
        return;
      }
      editSearchQuery.value = "";
      editSelectedYear.value = "ALL";
      editSelectedTeam.value = "ALL";
      showEditManagerModal.value = true;
    };

    const deleteAuditRow = async (rowIndex, deptName) => {
      if (currentUser.value.role === "User") {
        alert("⚠️ คุณไม่มีสิทธิ์ลบข้อมูล");
        return;
      }
      if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรายการของ "${deptName}" ออกจากระบบ?`)) {
        return;
      }
      const res = await API.postAction("deleteAuditEntry", { rowIndex: rowIndex });
      if (!handleApiResponse(res)) return;
      await loadData();
      alert("ลบรายการเรียบร้อยแล้ว");
    };

    const GOOGLE_CLIENT_ID = "1032937309757-qdbtdlmrin42ah85cedoadj1l0td73ls.apps.googleusercontent.com";
    const googleLoginError = ref("");

    const parseJwt = (token) => {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
      } catch (e) {
        return null;
      }
    };

    const handleGoogleCallback = (response) => {
      googleLoginError.value = "";
      if (!response || !response.credential) {
        googleLoginError.value = "ไม่ได้รับข้อมูลยืนยันตัวตนจาก Google";
        return;
      }

      const payload = parseJwt(response.credential);
      if (!payload || !payload.email) {
        googleLoginError.value = "ไม่สามารถอ่านอีเมลจากบัญชี Google ได้";
        return;
      }

      const googleEmail = payload.email.toLowerCase().trim();
      const googleName = payload.name || payload.email;
      console.log("🔐 Google Sign-In verified:", googleEmail, googleName);

      // Match against userList
      const matched = userList.value.find(u => (u.Email || "").toLowerCase().trim() === googleEmail);
      if (matched) {
        currentUser.value = {
          email: matched.Email,
          name: matched.Name || googleName,
          role: matched.Role || "User",
          team: matched.Team || "ทุกทีม",
          authorize: matched.Authorize || "all"
        };
        try {
          localStorage.setItem("CURRENT_USER", JSON.stringify(currentUser.value));
        } catch (e) {}
        showLoginModal.value = false;
        alert(`เข้าสู่ระบบด้วย Google สำเร็จ!\nชื่อ: ${currentUser.value.name}\nสิทธิ์: ${currentUser.value.role}`);
      } else {
        googleLoginError.value = `อีเมล ${googleEmail} ไม่มีสิทธิ์เข้าใช้งานระบบตามที่ระบุในชีท Users กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มอีเมลลงในชีท Users`;
      }
    };

    const renderGoogleBtn = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCallback,
            auto_select: false
          });
          const btnEl = document.getElementById("googleSignInBtn");
          if (btnEl) {
            btnEl.innerHTML = "";
            google.accounts.id.renderButton(btnEl, {
              theme: "outline",
              size: "large",
              text: "signin_with",
              shape: "pill",
              locale: "th"
            });
          }
        } catch (e) {
          console.warn("Google Sign-In init error:", e);
        }
      }
    };

    const openLoginModal = () => {
      googleLoginError.value = "";
      showLoginModal.value = true;
      nextTick(() => {
        renderGoogleBtn();
      });
    };

    watch(showLoginModal, (val) => {
      if (val) {
        nextTick(() => {
          renderGoogleBtn();
        });
      }
    });

    const selectUser = (u) => {
      currentUser.value = {
        email: u.Email,
        name: u.Name || u.Email,
        role: u.Role || "User",
        team: u.Team || "",
        authorize: u.Authorize || ""
      };
      try {
        localStorage.setItem("CURRENT_USER", JSON.stringify(currentUser.value));
        console.log("👤 Switched user to:", currentUser.value.name, `(${currentUser.value.role})`);
      } catch (e) {}
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
      // Only show departments where audit is closed (Col K/10) BUT NOT YET submitted to CTS (Col O/14 วันที่เสนอ_คตส is empty), and elapsed >= 50 days
      return units.filter(u => {
        const raw = u.raw || {};
        const dateN = raw["วันที่เสนอ_คตส"] || raw["วันที่เสนอ คตส."] || raw._col14 || "";
        const hasDateN = dateN && String(dateN).trim() !== "" && dateN !== "-";
        
        // Exclude departments that have already been submitted to CTS
        if (hasDateN) return false;
        
        const dateJ = raw["วันที่ปิดตรวจ"] || raw._col10 || "";
        if (!dateJ || String(dateJ).trim() === "" || dateJ === "-") return false;
        
        const daysSinceClose = dateDiffInDays(dateJ, new Date());
        return daysSinceClose !== null && daysSinceClose >= 50;
      }).map(u => {
        const dateJ = (u.raw && (u.raw["วันที่ปิดตรวจ"] || u.raw._col10)) || "";
        const daysSinceClose = dateDiffInDays(dateJ, new Date()) || 50;
        return {
          name: u.name,
          team: u.team,
          daysSinceClose: daysSinceClose
        };
      });
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

    watch([filteredUnits, showApprovalDrawer, showAuditModal, showDelayModal, showConfigModal, showEditManagerModal, showPdfModal], () => {
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
      addClarificationItem,
      removeClarificationItem,
      supervisorOptions,
      selectedFiscalYear,
      selectedFiscalYears,
      yearButtonList,
      toggleYearButton,
      isYearSelected,
      selectedYearDisplayLabel,
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
      totalPlannedUnitsCount,
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
      showPdfModal,
      pdfExportForm,
      confirmGeneratePdf,
      apiUrlInput,
      isApiConnected,
      openConfigModal,
      saveConfigUrl,
      clearConfigUrl,
      auditForm,
      newDepartmentInput,
      editingRowIndex,
      delayForm,
      calculatedDelayDays,
      googleLoginError,
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
      deleteAuditRow,
      openLoginModal,
      selectUser,
      dateDiffInDays,
      calculateExtensionDays,
      warningDeptsList,
      unstartedUnitsList,
      team1Unstarted,
      team2Unstarted,
      team3Unstarted,
      team4Unstarted,
      fiscalYearOptions,
      formDepartmentOptions,
      delayDepartmentOptions,
      onFiscalYearChange,
      onDelayFiscalYearChange,
      onDepartmentChange,
      exportPdfReportAction,
      formatDateDMY,
      getDelayFields
    };
  }
});

app.mount('#app');
