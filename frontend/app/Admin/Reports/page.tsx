  // app/Admin/Reports/page.tsx
  "use client";

  import "@/app/Admin/style/reports.css";

  import React, { useEffect, useState, useCallback, useRef } from "react";
  import { useRouter } from "next/navigation";
  import { useUser } from "@clerk/nextjs";
  import { createPortal } from "react-dom";
  import { useNotifications } from "@/app/context/notification";

  const defaultImg = "/default.jpg";

  const API_BASE =
    (process.env.NEXT_PUBLIC_API_BASE &&
      process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

  const CLOUDINARY_CLOUD_NAME =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";

  /* ── Types ── */
  type Comment = {
    text?: string; comment?: string; at?: string; by?: string; imageUrl?: string;
  };
  type HistoryEntry = {
    status: string; at: string; by?: string; note?: string;
  };
  type Report = {
    _id: string; reportId?: string; email?: string; userType?: string;
    heading?: string; description?: string; concern?: string;
    subConcern?: string; otherConcern?: string; building?: string;
    otherBuilding?: string; college?: string; floor?: string;
    room?: string; otherRoom?: string; image?: string; ImageFile?: string;
    status?: string; createdAt?: string; updatedAt?: string;
    comments?: Comment[]; history?: HistoryEntry[];
  };
  type ExistingTask  = { _id: string; name: string; status?: string; priority?: string; };
  type MetaStatus    = { id: string; name: string; color: string; };
  type MetaPriority  = { id: string; name: string; color: string; notifyInterval?: string; };
  type ChecklistItem = { id: string; text: string; done: boolean; };
  type ViewMode      = "card" | "list";
  type DateFilter    = "all" | "today" | "week" | "month" | "custom";

  /* ── Helpers ── */
  const formatConcern = (r: Report) => {
    const base = r.concern || "Unspecified";
    const sub  = r.subConcern || r.otherConcern;
    return sub ? `${base} : ${sub}` : base;
  };
  const getBaseConcern = (r: Report) => (r.concern || "Unspecified").trim() || "Unspecified";
  const formatBuilding = (r: Report) => {
    const raw   = r.building || "Unspecified";
    const label = raw.toLowerCase() === "other" && r.otherBuilding ? r.otherBuilding : raw;
    const room  = r.room || r.otherRoom;
    return room ? `${label} : ${room}` : label;
  };
  function getRelativeTime(d?: string) {
    if (!d) return "";
    const date = new Date(d); if (Number.isNaN(date.getTime())) return "";
    const now = new Date(); let diff = now.getTime() - date.getTime(); if (diff < 0) diff = 0;
    const s = Math.floor(diff / 1000); if (s < 60) return "just now";
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24); if (days < 30) return `${days}d ago`;
    const mo = Math.floor(days / 30); if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(mo / 12)}y ago`;
  }
  function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function isWithinDateRange(ds: string|undefined, f: DateFilter, from: string, to: string): boolean {
    if (!ds || f === "all") return true;
    const date = new Date(ds); const now = new Date();
    if (f === "today")  return date >= startOfDay(now);
    if (f === "week")   { const w = new Date(now); w.setDate(now.getDate()-7); return date >= w; }
    if (f === "month")  { const mo = new Date(now); mo.setMonth(now.getMonth()-1); return date >= mo; }
    if (f === "custom") {
      const a = from ? new Date(from) : null;
      const b = to   ? new Date(to + "T23:59:59") : null;
      if (a && date < a) return false;
      if (b && date > b) return false;
      return true;
    }
    return true;
  }
  const getGroupKey = (r: Report) => {
    const b  = (r.building   || "").trim();
    const c  = (r.concern    || "").trim();
    const sc = (r.subConcern || r.otherConcern || "").trim();
    const rm = (r.room       || r.otherRoom    || "").trim();
    return rm ? `${b}|${c}|${sc}|${rm}` : `${b}|${c}|${sc}`;
  };
  const resolveImg = (raw?: string) => {
    if (!raw) return defaultImg;
    const src = raw.trim(); if (!src) return defaultImg;
    if (src.startsWith("http://") || src.startsWith("https://")) return src;
    if (CLOUDINARY_CLOUD_NAME) return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${src.replace(/^\/+/, "")}`;
    if (!API_BASE) return defaultImg;
    return src.startsWith("/") ? `${API_BASE}${src}` : `${API_BASE}/${src}`;
  };
  function buildTimeline(r: Report): HistoryEntry[] {
    if (r.history?.length) return [...r.history].sort((a,b) => new Date(a.at).getTime()-new Date(b.at).getTime());
    const entries: HistoryEntry[] = [];
    if (r.createdAt) entries.push({ status:"Submitted", at:r.createdAt, by:r.email||"Reporter", note:"Report submitted." });
    (r.comments||[]).forEach(c => { if (c.at) entries.push({ status:"Comment", at:c.at, by:c.by||"Admin", note:c.text||c.comment||"" }); });
    if (r.status && r.status !== "Pending" && r.updatedAt) entries.push({ status:r.status, at:r.updatedAt, by:"Admin" });
    return entries.sort((a,b) => new Date(a.at).getTime()-new Date(b.at).getTime());
  }
  function buildStatusFlow(ms: MetaStatus[]) { return ms.filter(s => s.name.toLowerCase() !== "archived"); }
  function getStepState(stepName: string, current: string|undefined, ms: MetaStatus[]): "completed"|"active"|"pending" {
    const flow = buildStatusFlow(ms);
    const ci   = flow.findIndex(s => s.name === (current || "Pending"));
    const si   = flow.findIndex(s => s.name === stepName);
    if (si < ci) return "completed"; if (si === ci) return "active"; return "pending";
  }
  const getStatusClassKey = (s?: string) => {
    const v = (s||"Pending").toLowerCase().replace(/\s+/g,"");
    if (v === "pendinginspect")      return "pendinginspect";
    if (v === "waitingformaterials") return "waiting";
    if (v === "inprogress")          return "inprogress";
    if (v === "resolved")            return "completed";
    if (v === "archived")            return "archived";
    return "pending";
  };

  /* ── Fallbacks ── */
  const FALLBACK_STATUSES: MetaStatus[] = [
    { id:"1", name:"Pending",         color:"#FFA500" },
    { id:"2", name:"Pending Inspect", color:"#FFD700" },
    { id:"3", name:"In Progress",     color:"#4169E1" },
    { id:"4", name:"Resolved",        color:"#28A745" },
    { id:"5", name:"Archived",        color:"#6C757D" },
  ];
  const FALLBACK_PRIORITIES: MetaPriority[] = [
    { id:"1", name:"Low",    color:"#28A745" },
    { id:"2", name:"Medium", color:"#FFC107" },
    { id:"3", name:"High",   color:"#ce4f01" },
    { id:"4", name:"Urgent", color:"#a40010" },
  ];
  const REPORTS_PER_PAGE = 12;

  /* ── Toast ── */
  type ToastType = "success"|"error"|"info";
  type Toast     = { id:number; message:string; type:ToastType };
  let toastId    = 0;
  function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const show = useCallback((message: string, type: ToastType = "success") => {
      const id = ++toastId;
      setToasts(p => [...p, { id, message, type }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    }, []);
    const dismiss = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);
    return { toasts, show, dismiss };
  }
  function useEscapeKey(handler: () => void, active: boolean) {
    useEffect(() => {
      if (!active) return;
      const l = (e: KeyboardEvent) => { if (e.key === "Escape") handler(); };
      window.addEventListener("keydown", l);
      return () => window.removeEventListener("keydown", l);
    }, [handler, active]);
  }

  /* ══════════════════════════════════════════════════════════════
    MAIN COMPONENT
  ══════════════════════════════════════════════════════════════ */
  export default function ReportPage() {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();
    const { addNotification } = useNotifications();
    const prevReportCountRef = useRef<number>(0);

    const [canView,   setCanView]   = useState(false);
    const [reports,   setReports]   = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState("");

    /* ── Meta ── */
    const [metaStatuses,   setMetaStatuses]   = useState<MetaStatus[]>(FALLBACK_STATUSES);
    const [metaPriorities, setMetaPriorities] = useState<MetaPriority[]>(FALLBACK_PRIORITIES);
    const [metaStaff,      setMetaStaff]      = useState<{ name:string; disciplines:string[] }[]>([]);

    /* ── Tasks map ── */
    const [existingTasks, setExistingTasks] = useState<Record<string, ExistingTask>>({});

    /* ── View ── */
    const [viewMode,      setViewMode]      = useState<ViewMode>("card");
    const [selectedGroup, setSelectedGroup] = useState<string|null>(null);
    const [currentPage,   setCurrentPage]   = useState(1);

    /* ── Filters ── */
    const [buildingFilter, setBuildingFilter] = useState("All Buildings");
    const [concernFilter,  setConcernFilter]  = useState("All Concerns");
    const [collegeFilter,  setCollegeFilter]  = useState("All Colleges");
    const [statusFilter,   setStatusFilter]   = useState("All Statuses");
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [searchQuery,    setSearchQuery]    = useState("");
    const [userTypeFilter, setUserTypeFilter] = useState("All");
    const [dateFilter,     setDateFilter]     = useState<DateFilter>("all");
    const [customDateFrom, setCustomDateFrom] = useState("");
    const [customDateTo,   setCustomDateTo]   = useState("");

    /* ── Report modal ── */
    const [selectedReport,  setSelectedReport]  = useState<Report|null>(null);
    const [statusValue,     setStatusValue]     = useState("Pending");
    const [commentText,     setCommentText]     = useState("");
    const [saving,          setSaving]          = useState(false);
    const [editingIndex,    setEditingIndex]    = useState<number|null>(null);
    const [editingText,     setEditingText]     = useState("");
    const [isImageExpanded, setIsImageExpanded] = useState(false);

    /* ── Progress modal ── */
    const [progressReport, setProgressReport] = useState<Report|null>(null);
    const [showProgress,   setShowProgress]   = useState(false);

    /* ── Create Task modal ── */
    const [showTaskModal,  setShowTaskModal]  = useState(false);
    const [taskReport,     setTaskReport]     = useState<Report|null>(null);
    const [taskName,       setTaskName]       = useState("");
    const [taskStaff,      setTaskStaff]      = useState<string[]>([]);
    const [taskStaffInput, setTaskStaffInput] = useState("");
    const [taskPriority,   setTaskPriority]   = useState("");
    const [taskChecklist,  setTaskChecklist]  = useState<ChecklistItem[]>([]);
    const [taskCheckInput, setTaskCheckInput] = useState("");
    const [taskNotes,      setTaskNotes]      = useState("");
    const [taskSaving,     setTaskSaving]     = useState(false);

    /* ── Confirm ── */
    const confirmCallbackRef = useRef<(()=>void|Promise<void>)|null>(null);
    const [confirmDialog, setConfirmDialog] = useState({ open:false, message:"" });

    const { toasts, show: showToast, dismiss: dismissToast } = useToast();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    /* ── Body scroll lock ── */
    useEffect(() => {
      document.body.style.overflow = (selectedReport || showTaskModal || showProgress) ? "hidden" : "";
      return () => { document.body.style.overflow = ""; };
    }, [selectedReport, showTaskModal, showProgress]);

    useEscapeKey(useCallback(() => {
      if (isImageExpanded) { setIsImageExpanded(false); return; }
      if (showProgress)    { setShowProgress(false); setProgressReport(null); return; }
      if (showTaskModal)   { setShowTaskModal(false); return; }
      if (selectedReport)  closeDetails();
    }, [isImageExpanded, showProgress, showTaskModal, selectedReport]),
      !!(selectedReport || isImageExpanded || showTaskModal || showProgress)
    );

    /* ── Auth guard ── */
    useEffect(() => {
      if (!isLoaded) return;
      if (!isSignedIn || !user) { router.replace("/"); return; }
      const rawRole = (user.publicMetadata as any)?.role;
      let role = "student";
      if (Array.isArray(rawRole) && rawRole.length > 0) role = String(rawRole[0]).toLowerCase();
      else if (typeof rawRole === "string") role = rawRole.toLowerCase();
      if (role !== "admin") { router.replace("/Student"); return; }
      setCanView(true);
    }, [isLoaded, isSignedIn, user, router]);

    /* ── Fetch meta + staff ── */
    useEffect(() => {
      fetch(`${API_BASE}/api/meta?ts=${Date.now()}`, { cache:"no-store" })
        .then(r => r.json()).catch(() => null)
        .then(data => {
          if (data?.statuses?.length   > 0) setMetaStatuses(data.statuses);
          if (data?.priorities?.length > 0) setMetaPriorities(data.priorities);
        });
      fetch(`${API_BASE}/api/staff`, { cache:"no-store" })
        .then(r => r.json()).catch(() => null)
        .then(data => {
          const raw = Array.isArray(data) ? data : Array.isArray(data?.staff) ? data.staff : [];
          const list = raw.map((s: any) => ({ name:String(s?.name||s?.email||"").trim(), disciplines:Array.isArray(s?.disciplines)?s.disciplines:[] })).filter((s: any) => s.name);
          if (list.length) setMetaStaff(list);
        });
    }, []);

    /* ── Fetch tasks map ── */
    const fetchTasks = useCallback(async () => {
      try {
        const res  = await fetch(`${API_BASE}/api/tasks?ts=${Date.now()}`, { cache:"no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) return;
        const list: any[] = Array.isArray(data) ? data : Array.isArray(data.tasks) ? data.tasks : Array.isArray(data.data) ? data.data : [];
        const map: Record<string, ExistingTask> = {};
        list.forEach(t => {
          const task: ExistingTask = { _id:t._id, name:t.name, status:t.status, priority:t.priority };
          if (t.reportId) map[String(t.reportId)] = task;
          map[String(t._id)] = task;
        });
        setExistingTasks(map);
      } catch {}
    }, []);

    /* ── Fetch reports ── */
    const fetchReports = useCallback(async () => {
      try {
        setIsLoading(true); setLoadError("");
        const res  = await fetch(`${API_BASE}/api/reports`, { cache:"no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) { setLoadError(data?.message || "Could not load reports."); setReports([]); return; }
        let list: Report[] = [];
        if      (Array.isArray(data))         list = data;
        else if (Array.isArray(data.reports)) list = data.reports;
        else if (Array.isArray(data.data))    list = data.data;
        else { setLoadError("Unexpected server response."); setReports([]); return; }
        setReports(list); setCurrentPage(1);
        if (prevReportCountRef.current > 0 && list.length > prevReportCountRef.current) {
          const n = list.length - prevReportCountRef.current;
          addNotification(`${n} new report${n > 1 ? "s" : ""} submitted.`, "followup" as any);
        }
        prevReportCountRef.current = list.length;
      } catch { setLoadError("Network error."); setReports([]); }
      finally  { setIsLoading(false); }
    }, [addNotification]);

    useEffect(() => { if (canView) { fetchReports(); fetchTasks(); } }, [canView]);

    /* ── Helpers ── */
    const getStatusColor = useCallback((name?: string) =>
      metaStatuses.find(s => s.name === (name || "Pending"))?.color || "#6C757D", [metaStatuses]);

    const renderStatusPill = useCallback((statusRaw?: string) => {
  const status = statusRaw || "Pending";
  const color = getStatusColor(status);
  
  return (
    <span 
      className="status-pill" 
      style={{ 
        backgroundColor: color, 
        color: "#fff", 
        textShadow: "0 1px 2px rgba(0,0,0,0.2)",
        padding: "4px 8px",
        borderRadius: "12px",
        fontSize: "0.75rem",
        fontWeight: "500",
        display: "inline-block",
        lineHeight: "1"
      }}
    >
      {status}
    </span>
  );
}, [getStatusColor]);

    const statusMatchesFilter = useCallback((rs: string|undefined, filter: string) => {
      const current      = rs || "Pending";
      const archivedName = metaStatuses.find(s => s.name.toLowerCase() === "archived")?.name || "Archived";
      const resolvedName = metaStatuses.find(s => s.name.toLowerCase() === "resolved")?.name  || "Resolved";
      if (filter === "All Statuses") return current !== archivedName && current !== resolvedName;
      return current === filter;
    }, [metaStatuses]);

    const getExistingTask = useCallback((r: Report): ExistingTask|null => {
      const rid = r.reportId || r._id;
      return existingTasks[rid] || existingTasks[r._id] || null;
    }, [existingTasks]);

    /* ── Duplicates ── */
    const duplicateCounts: Record<string,number> = {};
    reports.forEach(r => { const k = getGroupKey(r); duplicateCounts[k] = (duplicateCounts[k]||0)+1; });
    const filterUnique = (arr: Report[]) => {
      const seen = new Set<string>();
      return arr.filter(r => { const k = getGroupKey(r); if (seen.has(k)) return false; seen.add(k); return true; });
    };
    const reportsToDisplay  = showDuplicates ? reports : filterUnique(reports);
    const getReportsByGroup = (key: string) => reports.filter(r => getGroupKey(r) === key);

    /* ── Filter options ── */
    const buildingOptions = ["All Buildings", ...new Set(reports.filter(r =>
      (concernFilter  === "All Concerns"  || r.concern  === concernFilter) &&
      (collegeFilter  === "All Colleges"  || (r.college || "Unspecified") === collegeFilter) &&
      statusMatchesFilter(r.status, statusFilter)
    ).map(r => r.building).filter((v): v is string => Boolean(v)))];

    const concernOptions = ["All Concerns", ...new Set(reports.filter(r =>
      (buildingFilter === "All Buildings" || r.building === buildingFilter) &&
      (collegeFilter  === "All Colleges"  || (r.college || "Unspecified") === collegeFilter) &&
      statusMatchesFilter(r.status, statusFilter)
    ).map(r => r.concern).filter((v): v is string => Boolean(v)))];

    const collegeOptions = ["All Colleges", ...new Set(reports.filter(r =>
      (buildingFilter === "All Buildings" || r.building === buildingFilter) &&
      (concernFilter  === "All Concerns"  || r.concern  === concernFilter) &&
      statusMatchesFilter(r.status, statusFilter)
    ).map(r => r.college || "Unspecified"))];

    const statusOptions = ["All Statuses", ...metaStatuses.map(s => s.name)];

    /* ── Auto-correct invalid filter combos ── */
    useEffect(() => {
      const valid = new Set(reports.filter(r =>
        (buildingFilter === "All Buildings" || r.building === buildingFilter) &&
        (collegeFilter  === "All Colleges"  || (r.college || "Unspecified") === collegeFilter) &&
        statusMatchesFilter(r.status, statusFilter)
      ).map(r => r.concern));
      if (concernFilter !== "All Concerns" && !valid.has(concernFilter)) setConcernFilter("All Concerns");
    }, [buildingFilter, collegeFilter, statusFilter, reports, concernFilter]);

    useEffect(() => {
      const valid = new Set(reports.filter(r =>
        (concernFilter  === "All Concerns"  || r.concern  === concernFilter) &&
        (collegeFilter  === "All Colleges"  || (r.college || "Unspecified") === collegeFilter) &&
        statusMatchesFilter(r.status, statusFilter)
      ).map(r => r.building));
      if (buildingFilter !== "All Buildings" && !valid.has(buildingFilter)) setBuildingFilter("All Buildings");
    }, [concernFilter, collegeFilter, statusFilter, reports, buildingFilter]);

    /* ── Filtered reports ── */
    const filteredReports = reportsToDisplay.filter(r => {
      const bm = buildingFilter === "All Buildings" || r.building === buildingFilter;
      const cm = concernFilter  === "All Concerns"  || r.concern  === concernFilter;
      const lm = collegeFilter  === "All Colleges"  || (r.college || "Unspecified") === collegeFilter;
      const sm = statusMatchesFilter(r.status, statusFilter);
      const qm = !searchQuery.trim() ||
        (r.reportId    || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.heading     || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const um = userTypeFilter === "All" || (r.userType || "") === userTypeFilter;
      const dm = isWithinDateRange(r.createdAt, dateFilter, customDateFrom, customDateTo);
      return bm && cm && lm && sm && qm && um && dm;
    });

    useEffect(() => { setCurrentPage(1); },
      [buildingFilter, concernFilter, collegeFilter, statusFilter, showDuplicates, searchQuery, userTypeFilter, dateFilter, customDateFrom, customDateTo]);

    const totalPages       = Math.max(1, Math.ceil(filteredReports.length / REPORTS_PER_PAGE));
    const startIndex       = (currentPage - 1) * REPORTS_PER_PAGE;
    const paginatedReports = filteredReports.slice(startIndex, startIndex + REPORTS_PER_PAGE);

    /* ── Modal helpers ── */
    const handleCardClick = (r: Report) => {
      setSelectedReport(r); setStatusValue(r.status || "Pending");
      setCommentText(""); setEditingIndex(null); setEditingText(""); setIsImageExpanded(false);
    };
    const closeDetails = useCallback(() => {
      setSelectedReport(null); setStatusValue("Pending"); setCommentText("");
      setEditingIndex(null); setEditingText(""); setIsImageExpanded(false);
    }, []);
    const handleClearFilters = () => {
      setBuildingFilter("All Buildings"); setConcernFilter("All Concerns");
      setCollegeFilter("All Colleges");   setStatusFilter("All Statuses");
      setShowDuplicates(false);           setCurrentPage(1);
      setSearchQuery("");                 setUserTypeFilter("All");
      setDateFilter("all");               setCustomDateFrom(""); setCustomDateTo("");
    };
    const showConfirm = (msg: string, fn: ()=>void|Promise<void>) => {
      confirmCallbackRef.current = fn; setConfirmDialog({ open:true, message:msg });
    };
    const closeConfirm = () => setConfirmDialog(d => ({ ...d, open:false }));
    const runConfirm   = async () => {
      closeConfirm();
      const action = confirmCallbackRef.current; if (!action) return;
      confirmCallbackRef.current = null;
      try { await Promise.resolve(action()); }
      catch { showToast("Action failed.", "error"); }
    };

    /* ── Comments ── */
    const syncComments = async (updated: Comment[]) => {
      if (!selectedReport) return;
      try {
        setSaving(true);
        const res  = await fetch(`${API_BASE}/api/reports/${selectedReport._id}`, {
          method:"PUT", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ status:selectedReport.status||"Pending", comments:updated, overwriteComments:true }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
        const up = data.report as Report;
        setReports(p => p.map(r => r._id === up._id ? up : r));
        setSelectedReport(up); setEditingIndex(null); setEditingText("");
        showToast("Comment updated.", "success");
      } catch (e: any) { showToast(e.message || "Failed.", "error"); }
      finally { setSaving(false); }
    };

    const handleSaveChanges = async () => {
      if (!selectedReport) return;
      try {
        setSaving(true);
        const trimmed = commentText.trim();
        const group   = reports.filter(r => getGroupKey(r) === getGroupKey(selectedReport));
        const updated = await Promise.all(group.map(async r => {
          const res  = await fetch(`${API_BASE}/api/reports/${r._id}`, {
            method:"PUT", headers:{"Content-Type":"application/json"},
            body:JSON.stringify({ status:statusValue, ...(trimmed ? { comment:trimmed } : {}) }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
          return data.report as Report;
        }));
        if (trimmed) {
          const cr   = await fetch(`${API_BASE}/api/reports/${selectedReport._id}/comments`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body:JSON.stringify({ text:trimmed, by:"Admin", skipEmail:true }),
          });
          const cd = await cr.json().catch(() => null);
          if (cr.ok && cd?.success) { const idx = updated.findIndex(u => u._id === selectedReport._id); if (idx !== -1) updated[idx] = cd.report; }
        }
        setReports(p => p.map(r => updated.find(u => u._id === r._id) || r));
        const us = updated.find(u => u._id === selectedReport._id) || updated[0];
        setSelectedReport(us); setStatusValue(us.status || "Pending"); setCommentText("");
        showToast(`Status updated to "${statusValue}".`, "success");
      } catch (e: any) { showToast(e.message || "Failed.", "error"); }
      finally { setSaving(false); }
    };

    const handleArchive = async () => {
      if (!selectedReport) return;
      showConfirm("Archive this report? This will notify the reporter.", async () => {
        try {
          setSaving(true);
          const group   = reports.filter(r => getGroupKey(r) === getGroupKey(selectedReport));
          const updated = await Promise.all(group.map(async r => {
            const res  = await fetch(`${API_BASE}/api/reports/${r._id}`, {
              method:"PUT", headers:{"Content-Type":"application/json"},
              body:JSON.stringify({ status:"Archived", sendEmail:true }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) throw new Error();
            return data.report as Report;
          }));
          setReports(p => p.map(r => updated.find(u => u._id === r._id) || r));
          const us = updated.find(u => u._id === selectedReport._id) || updated[0];
          setSelectedReport(us); setStatusValue("Archived");
          showToast("Report archived.", "success");
        } catch { showToast("Failed to archive.", "error"); }
        finally { setSaving(false); }
      });
    };

    const addIndividualComment = async () => {
      if (!selectedReport) return;
      const trimmed = commentText.trim();
      if (!trimmed) { showToast("Please enter a comment.", "error"); return; }
      try {
        setSaving(true);
        const res  = await fetch(`${API_BASE}/api/reports/${selectedReport._id}/comments`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ text:trimmed, by:"Admin" }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
        const up = data.report as Report;
        setReports(p => p.map(r => r._id === up._id ? up : r));
        setSelectedReport(up); setCommentText("");
        showToast("Comment added.", "success");
      } catch (e: any) { showToast(e.message || "Failed.", "error"); }
      finally { setSaving(false); }
    };

    const startEditComment  = (i: number) => { if (!selectedReport?.comments) return; const c = selectedReport.comments[i]; if (!c) return; setEditingIndex(i); setEditingText(c.text || c.comment || ""); };
    const cancelEditComment = () => { setEditingIndex(null); setEditingText(""); };
    const saveEditedComment = async (i: number) => {
      if (!selectedReport?.comments) return;
      const trimmed = editingText.trim();
      if (!trimmed) { showToast("Comment cannot be empty.", "error"); return; }
      await syncComments(selectedReport.comments.map((c, idx) => idx !== i ? c : { ...c, text:trimmed, comment:trimmed, at:new Date().toISOString() }));
    };
    const deleteComment = async (i: number) => {
      if (!selectedReport?.comments) return;
      showConfirm("Delete this comment?", async () => { await syncComments(selectedReport.comments!.filter((_, idx) => idx !== i)); });
    };

    /* ── Progress ── */
    const openProgress = (r: Report, e?: React.MouseEvent) => { e?.stopPropagation(); setProgressReport(r); setShowProgress(true); };

    /* ── Task helpers ── */
    const viewExistingTask = (task: ExistingTask, e?: React.MouseEvent) => {
      e?.stopPropagation();
      router.push(`/Admin/Task?highlight=${task._id}`);
    };
    const openCreateTask = (r: Report) => {
      setTaskReport(r); setTaskName(r.heading || "");
      setTaskStaff([]); setTaskStaffInput(""); setTaskPriority(metaPriorities[0]?.id || "");
      setTaskChecklist([]); setTaskCheckInput(""); setTaskNotes("");
      setShowTaskModal(true);
    };
    const closeTaskModal = () => { setShowTaskModal(false); setTaskReport(null); };
    const addTaskStaff     = () => { const v = taskStaffInput.trim(); if (v && !taskStaff.includes(v)) setTaskStaff(p => [...p,v]); setTaskStaffInput(""); };
    const removeTaskStaff  = (n: string) => setTaskStaff(p => p.filter(s => s !== n));
    const addChecklistItem = () => { const v = taskCheckInput.trim(); if (!v) return; setTaskChecklist(p => [...p, { id:`${Date.now()}-${Math.random().toString(36).slice(2,6)}`, text:v, done:false }]); setTaskCheckInput(""); };
    const toggleCheckItem  = (id: string) => setTaskChecklist(p => p.map(i => i.id === id ? { ...i, done:!i.done } : i));
    const removeCheckItem  = (id: string) => setTaskChecklist(p => p.filter(i => i.id !== id));

    const handleCreateTask = async () => {
      if (!taskReport || !taskName.trim()) { showToast("Task name is required.", "error"); return; }
      try {
        setTaskSaving(true);
        const finalStaff = taskStaffInput.trim() && !taskStaff.includes(taskStaffInput.trim())
          ? [...taskStaff, taskStaffInput.trim()] : taskStaff;
        const selectedP  = metaPriorities.find(p => p.id === taskPriority);
        const res  = await fetch(`${API_BASE}/api/tasks`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            userId:user?.id||"admin", name:taskName.trim(),
            concernType:taskReport.concern||"Other",
            reportId:taskReport.reportId||taskReport._id,
            status:"Pending", assignedStaff:finalStaff,
            priority:selectedP?.name||"",
            checklist:taskChecklist, notes:taskNotes.trim(),
            createdBy:user?.fullName||"Admin",
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
        showToast(`Task "${taskName}" created.`, "success");
        await fetchTasks(); closeTaskModal();
      } catch (e: any) { showToast(e.message || "Failed.", "error"); }
      finally { setTaskSaving(false); }
    };

    /* ── Task button ── */
    const renderTaskButton = (report: Report, variant: "modal"|"card"|"list") => {
      const existing = getExistingTask(report);
      if (existing) {
        const pColor = metaPriorities.find(p => p.name === existing.priority)?.color || "#6b7280";
        if (variant === "modal") return (
          <button type="button" className="modal-view-task-btn" onClick={() => viewExistingTask(existing)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            View Task
          </button>
        );
        if (variant === "card") return (
          <button type="button" className="card-view-task-btn" onClick={e => { e.stopPropagation(); viewExistingTask(existing, e); }} style={{ borderColor:pColor+"60", color:pColor }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/></svg>
            Task Exists
          </button>
        );
        return <button type="button" className="list-view-task-btn" onClick={e => { e.stopPropagation(); viewExistingTask(existing, e); }} style={{ color:pColor }}>✓ Task</button>;
      }
      if (variant === "modal") return (
        <button type="button" className="modal-create-task-btn" onClick={() => { closeDetails(); openCreateTask(report); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Task
        </button>
      );
      if (variant === "card") return (
        <button type="button" className="card-create-task-btn" onClick={e => { e.stopPropagation(); openCreateTask(report); }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          + Task
        </button>
      );
      return <button type="button" className="list-create-task-btn" onClick={e => { e.stopPropagation(); openCreateTask(report); }}>+ Task</button>;
    };

    /* ── Print ── */
    const handlePrint = useCallback(() => {
      if (typeof window === "undefined") return;
      const printedDate = new Date().toLocaleString();
      const cBase = new Map<string,number>(); const cFull = new Map<string,number>(); const bMap = new Map<string,number>();
      filteredReports.forEach(r => {
        const base = getBaseConcern(r)||"Unspecified"; cBase.set(base,(cBase.get(base)||0)+1);
        const full = formatConcern(r); cFull.set(full,(cFull.get(full)||0)+1);
        const bk   = (r.building||"Unspecified").trim()||"Unspecified"; bMap.set(bk,(bMap.get(bk)||0)+1);
      });
      const safe = (v?: string) => v ? String(v) : "";
      const rows = filteredReports.map((r,idx) => {
        const created = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";
        return `<tr><td>${idx+1}</td><td>${safe(r.reportId)}</td><td>${created}</td><td>${safe(r.status)}</td><td>${safe(r.building)}</td><td>${safe(formatConcern(r))}</td><td>${safe(r.college)}</td><td>${safe(r.floor)}</td><td>${safe(r.room)}</td><td>${safe(r.email)}</td><td>${safe(r.userType)}</td></tr>`;
      }).join("");
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFMO Reports</title><style>body{font-family:system-ui,sans-serif;font-size:8px;color:#111827;padding:10px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #d1d5db;padding:4px 6px;text-align:left}thead{background:#f3f4f6}h1{font-size:18px;margin:16px 0 4px}h2{font-size:15px;margin-top:16px;margin-bottom:4px}h3{font-size:13px;margin-top:10px;margin-bottom:4px}.meta{font-size:11px;color:#374151;margin-bottom:12px}ul{margin:4px 0 8px 16px;padding:0}li{margin:2px 0}.title{font-size:14px;font-weight:700;color:#fff;background:#029006;padding:8px}.sig-row{display:flex;justify-content:space-around;gap:24px;flex-wrap:wrap;margin-top:48px}.sig-block{flex:1;min-width:140px;max-width:200px;text-align:center}.sig-line{border-top:1px solid #111827;margin-bottom:4px;margin-top:40px}.sig-name{font-size:9px;font-weight:700}.sig-role{font-size:8px;color:#6b7280;margin-top:2px}@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}</style></head><body>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px"><tr><td rowspan="4" style="width:90px;text-align:center"><img src="/logo-dlsud.png" style="width:64px;height:64px;object-fit:contain;padding-top:12px"/></td><td colspan="2" class="title">Building Facilities Maintenance Office : Facility Reports</td></tr><tr><td><strong>Document Reference:</strong> BFMO Report System</td><td><strong>Printed Date:</strong> ${printedDate}</td></tr><tr><td><strong>Confidentiality Level:</strong> Research Purpose</td><td></td></tr><tr><td><strong>Review Cycle:</strong> Monthly</td><td></td></tr></table>
      <h1>BFMO Reports - Tabular Report</h1><div class="meta">Records shown: ${filteredReports.length}</div>
      <h2>Summary Statistics</h2><h3>By Concern (Base)</h3><ul>${[...cBase.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<li>${n}: ${c}</li>`).join("")||"<li>No data.</li>"}</ul><h3>By Concern (Detailed)</h3><ul>${[...cFull.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<li>${n}: ${c}</li>`).join("")||"<li>No data.</li>"}</ul><h3>By Building</h3><ul>${[...bMap.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<li>${n}: ${c}</li>`).join("")||"<li>No data.</li>"}</ul>
      <h2>Detailed Report</h2><table><thead><tr><th>#</th><th>Report ID</th><th>Date Created</th><th>Status</th><th>Building</th><th>Concern</th><th>College</th><th>Floor</th><th>Room</th><th>Email</th><th>Reporter Type</th></tr></thead><tbody>${rows||'<tr><td colspan="11">No data.</td></tr>'}</tbody></table>
      <div class="sig-row"><div class="sig-block"><div class="sig-line"></div><div class="sig-name">Signature over Printed Name</div><div class="sig-role">Prepared by</div></div><div class="sig-block"><div class="sig-line"></div><div class="sig-name">Signature over Printed Name</div><div class="sig-role">Reviewed by</div></div><div class="sig-block"><div class="sig-line"></div><div class="sig-name">Signature over Printed Name</div><div class="sig-role">Approved by</div></div></div>
      </body></html>`;
      const w = window.open("","_blank"); if (!w) return;
      w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print();
    }, [filteredReports]);

    /* ── Guard ── */
    if (!isLoaded || !canView) {
      return <div className="report-wrapper"><div className="loading-shimmer-wrapper">{[...Array(6)].map((_,i)=><div key={i} className="shimmer-card"/>)}</div></div>;
    }

    const commentsToShow = selectedReport?.comments || [];

    /* ══════════════════════════════════════════════════════════
      PROGRESS MODAL
    ══════════════════════════════════════════════════════════ */
    const progressModalContent = showProgress && progressReport ? (
      <div className="progress-backdrop" onClick={() => { setShowProgress(false); setProgressReport(null); }}>
        <div className="progress-modal" onClick={e => e.stopPropagation()}>
          <div className="progress-modal-header">
            <div>
              <h2 className="progress-modal-title">Report Progress</h2>
              {progressReport.reportId && <p className="progress-modal-sub">#{progressReport.reportId} · {progressReport.heading}</p>}
            </div>
            <button type="button" className="progress-modal-close" onClick={() => { setShowProgress(false); setProgressReport(null); }}>✕</button>
          </div>
          <div className="progress-modal-body">
            <div className="progress-stepper-section">
              <h3 className="progress-section-title">Status Flow</h3>
              <div className="stepper-box">
                {buildStatusFlow(metaStatuses).map((step, idx, arr) => {
                  const state      = getStepState(step.name, progressReport.status, metaStatuses);
                  const isLast     = idx === arr.length - 1;
                  const stateClass = state === "completed" ? "stepper-completed" : state === "active" ? "stepper-active" : "stepper-pending";
                  return (
                    <div key={step.id} className={`stepper-step ${stateClass}`}>
                      {!isLast && <div className="stepper-line"/>}
                      <div className="stepper-circle" style={state==="completed"?{backgroundColor:step.color,borderColor:step.color}:state==="active"?{borderColor:step.color,color:step.color}:{}}>
                        {state==="completed"?(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>)
                        :state==="active"?(<svg width="10" height="10" viewBox="0 0 24 24" fill={step.color}><circle cx="12" cy="12" r="8"/></svg>)
                        :(<svg width="8" height="8" viewBox="0 0 24 24" fill="#cbd5e1"><circle cx="12" cy="12" r="8"/></svg>)}
                      </div>
                      <div className="stepper-content">
                        <div className="stepper-title">{step.name}</div>
                        <span className="stepper-status" style={state !== "pending" ? { backgroundColor: step.color + "22", color: step.color } : {}}>
  {state === "completed" ? "Completed" : state === "active" ? "Current" : "Pending"}
</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="progress-history-section">
              <h3 className="progress-section-title">History</h3>
              {(() => {
                const timeline = buildTimeline(progressReport);
                if (!timeline.length) return <p className="progress-empty">No history yet.</p>;
                return (
                  <div className="progress-timeline">
                    {timeline.map((entry, idx) => {
                      const color  = metaStatuses.find(s => s.name === entry.status)?.color || "#6b7280";
                      const isLast = idx === timeline.length - 1;
                      return (
                        <div key={idx} className="progress-timeline-item">
                          <div className="progress-timeline-left">
                            <div className="progress-timeline-dot" style={{ backgroundColor:color, boxShadow:`0 0 0 3px ${color}30` }}/>
                            {!isLast && <div className="progress-timeline-line"/>}
                          </div>
                          <div className="progress-timeline-content">
                            <div className="progress-timeline-top">
<span className="progress-timeline-status" style={{ color: color, backgroundColor: color + "18", border: `1px solid ${color}40` }}>
  {entry.status}
</span>                              <span className="progress-timeline-time">{getRelativeTime(entry.at)}</span>
                            </div>
                            {entry.note && <p className="progress-timeline-note">{entry.note}</p>}
                            <div className="progress-timeline-meta">
                              {entry.by && <span>by {entry.by}</span>}
                              <span>{entry.at ? new Date(entry.at).toLocaleString() : ""}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    ) : null;

    /* ══════════════════════════════════════════════════════════
      REPORT DETAIL MODAL
    ══════════════════════════════════════════════════════════ */
    const modalContent = selectedReport ? (
      <div className="report-modal-backdrop" onClick={closeDetails} role="dialog" aria-modal="true">
        <div className="report-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-header-main">
              <h2>{selectedReport.heading || "Report details"}</h2>
              {selectedReport.reportId && <span className="modal-report-id-badge">#{selectedReport.reportId}</span>}
            </div>
            <div className="modal-header-actions">
              <button type="button" className="modal-progress-btn" onClick={() => openProgress(selectedReport)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Progress
              </button>
              {renderTaskButton(selectedReport, "modal")}
              <button className="modal-close-btn" onClick={closeDetails} type="button">✕</button>
            </div>
          </div>
          <div className="modal-content">
            <div className="modal-img-wrapper">
              <img src={resolveImg(selectedReport.ImageFile || selectedReport.image)} alt="Report"
                className="report-img report-img-clickable" onClick={() => setIsImageExpanded(true)}
                onError={e => { (e.target as HTMLImageElement).src = defaultImg; }}/>
              <div className="modal-img-hint">Click to enlarge</div>
            </div>
            <div className="modal-thumb-mobile">
              <img src={resolveImg(selectedReport.ImageFile || selectedReport.image)} alt="Report"
                className="report-img report-img-clickable" onClick={() => setIsImageExpanded(true)}
                onError={e => { (e.target as HTMLImageElement).src = defaultImg; }}/>
            </div>
            <div className="modal-info">
              <p className="modal-description">{selectedReport.description || "No description provided."}</p>
              <div className="modal-meta-grid">
                <p><strong>Building:</strong> {formatBuilding(selectedReport)}</p>
                <p><strong>Concern:</strong>  {formatConcern(selectedReport)}</p>
                <p><strong>College:</strong>  {selectedReport.college || "Unspecified"}</p>
                <p><strong>Reporter:</strong> {selectedReport.userType || "Unspecified"}</p>
                <p><strong>Email:</strong>    {selectedReport.email || "Unspecified"}</p>
                <p><strong>Submitted:</strong>{" "}{selectedReport.createdAt && new Date(selectedReport.createdAt).toLocaleString()}{" "}{selectedReport.createdAt && `(${getRelativeTime(selectedReport.createdAt)})`}</p>
              </div>
              <div className="status-panel" style={{ borderLeft: `3px solid ${getStatusColor(statusValue)}` }}>
  <div className="status-panel-header">
    <span className="status-panel-title">Status</span>
    {renderStatusPill(statusValue)}
  </div>
  <div className="status-row status-row-inline">
    <label htmlFor="status-select" className="status-row-label">Update</label>
    <select id="status-select" className="status-select" value={statusValue}
      onChange={e => setStatusValue(e.target.value)} disabled={selectedReport.status === "Archived"}>
      {metaStatuses.filter(s => s.name.toLowerCase() !== "archived")
        .map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
    </select>
  </div>
</div>
              <div className="comments-section">
                <h3>Comments {commentsToShow.length > 0 && <span className="comments-count">{commentsToShow.length}</span>}</h3>
                {commentsToShow.length > 0 ? (
                  <ul className="comments-list">
                    {commentsToShow.map((c, idx) => (
                      <li key={idx} className="comment-item">
                        {editingIndex === idx ? (
                          <>
                            <textarea className="comment-edit-input" rows={2} value={editingText} onChange={e => setEditingText(e.target.value)} autoFocus/>
                            <div className="comment-actions-row">
                              <button type="button" className="comment-btn-save"   onClick={() => saveEditedComment(idx)} disabled={saving}>Save</button>
                              <button type="button" className="comment-btn-cancel" onClick={cancelEditComment}            disabled={saving}>Cancel</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="comment-text">{c.text || c.comment || String(c)}</p>
                            {c.imageUrl && <img src={c.imageUrl} alt="attachment" className="comment-image" onError={e => { (e.target as HTMLImageElement).style.display="none"; }}/>}
                            <div className="comment-footer">
                              <div>
                                {c.at && <span className="comment-date">{new Date(c.at).toLocaleString()}&nbsp;</span>}
                                {c.by && <span className="comment-date">by {c.by}</span>}
                              </div>
                              <div className="comment-actions">
                                <button type="button" className="comment-btn-edit"   onClick={() => startEditComment(idx)} disabled={saving}>Edit</button>
                                <button type="button" className="comment-btn-delete" onClick={() => deleteComment(idx)}    disabled={saving}>Delete</button>
                              </div>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : <p className="no-comments">No comments yet.</p>}
                <textarea className="comment-input" rows={3} value={commentText}
                  onChange={e => setCommentText(e.target.value)} placeholder="Type your comment here…"/>
                <div className="modal-actions">
                  <button className="add-comment-btn"  onClick={addIndividualComment}  disabled={saving || !commentText.trim()} type="button">{saving ? "Adding…"   : "Add Comment"}</button>
                  {selectedReport.status !== "Archived" && (
                    <button className="archive-btn"    onClick={handleArchive}          disabled={saving}                       type="button">Archive report</button>
                  )}
                  <button className="save-comment-btn" onClick={handleSaveChanges}      disabled={saving || selectedReport.status === "Archived"} type="button">{saving ? "Updating…" : "Update Status"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {isImageExpanded && (
          <div className="image-fullscreen-backdrop" onClick={() => setIsImageExpanded(false)}>
            <img src={resolveImg(selectedReport.ImageFile || selectedReport.image)} alt="Report full view"
              className="image-fullscreen-img" onClick={e => e.stopPropagation()}
              onError={e => { (e.target as HTMLImageElement).src = defaultImg; }}/>
            <button className="image-fullscreen-close" onClick={() => setIsImageExpanded(false)} type="button">✕</button>
          </div>
        )}
      </div>
    ) : null;

    /* ══════════════════════════════════════════════════════════
      CREATE TASK MODAL
    ══════════════════════════════════════════════════════════ */
    const taskModalContent = showTaskModal && taskReport ? (
      <div className="report-modal-backdrop" onClick={closeTaskModal} role="dialog" aria-modal="true">
        <div className="task-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-header-main">
              <h2>Create Task</h2>
              {taskReport.reportId && <span className="modal-report-id-badge">#{taskReport.reportId}</span>}
            </div>
            <button className="modal-close-btn" onClick={closeTaskModal} type="button">✕</button>
          </div>
          <div className="task-modal-body">
            <div className="task-modal-left">
              <div className="task-field-group">
                <label className="task-label">Task Name <span className="task-required">*</span></label>
                <input type="text" className="task-input" value={taskName} placeholder="Describe the task…" onChange={e => setTaskName(e.target.value)}/>
              </div>
              <div className="task-report-info">
                <span className="task-report-info-label">Linked Report</span>
                <span className="task-report-info-val">{formatBuilding(taskReport)}</span>
                <span className="task-report-info-sep">·</span>
                <span className="task-report-info-val">{formatConcern(taskReport)}</span>
              </div>
              <div className="task-field-group">
                <label className="task-label">Priority Level</label>
                <div className="task-priority-grid">
                  {metaPriorities.map(p => (
                    <button key={p.id} type="button"
                      className={`task-priority-btn${taskPriority===p.id?" task-priority-btn--active":""}`}
                      style={{ borderColor:taskPriority===p.id?p.color:"transparent", backgroundColor:taskPriority===p.id?p.color+"18":"#f9fafb", color:taskPriority===p.id?p.color:"#374151" }}
                      onClick={() => setTaskPriority(p.id)}>
                      <span className="task-priority-dot" style={{ backgroundColor:p.color }}/>{p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="task-field-group">
                <label className="task-label">Notes</label>
                <textarea className="task-input task-textarea" rows={3} value={taskNotes} placeholder="Additional notes…" onChange={e => setTaskNotes(e.target.value)}/>
              </div>
            </div>
            <div className="task-modal-right">
              <div className="task-field-group">
                <label className="task-label">Assign Staff</label>
                {taskStaff.length > 0 && (
                  <div className="task-staff-tags">
                    {taskStaff.map(name => (
                      <span key={name} className="task-staff-tag">
                        <span className="task-staff-avatar">{name.charAt(0).toUpperCase()}</span>
                        {name}
                        <button type="button" className="task-staff-remove" onClick={() => removeTaskStaff(name)}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="task-staff-input-row">
                  {metaStaff.length > 0 ? (
                    <select className="task-input" value={taskStaffInput} onChange={e => setTaskStaffInput(e.target.value)}>
                      <option value="">-- Select staff --</option>
                      {metaStaff.filter(s => !taskStaff.includes(s.name) && (
                        s.disciplines.length === 0 || s.disciplines.some(d => d.toLowerCase() === (taskReport?.concern||"").toLowerCase())
                      )).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  ) : (
                    <input type="text" className="task-input" value={taskStaffInput} placeholder="Staff name or email…"
                      onChange={e => setTaskStaffInput(e.target.value)}
                      onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); addTaskStaff(); } }}/>
                  )}
                  <button type="button" className="task-add-btn" onClick={addTaskStaff} disabled={!taskStaffInput.trim()}>Add</button>
                </div>
              </div>
              <div className="task-field-group">
                <label className="task-label">
                  Progress Checklist
                  {taskChecklist.length > 0 && <span className="task-checklist-count">{taskChecklist.filter(i=>i.done).length}/{taskChecklist.length}</span>}
                </label>
                {taskChecklist.length > 0 && (
                  <div className="task-progress-bar-wrap">
                    <div className="task-progress-bar-fill" style={{ width:`${Math.round((taskChecklist.filter(i=>i.done).length/taskChecklist.length)*100)}%` }}/>
                  </div>
                )}
                <div className="task-checklist-list">
                  {taskChecklist.map(item => (
                    <div key={item.id} className="task-checklist-item">
                      <button type="button" className={`task-check-btn${item.done?" task-check-btn--done":""}`} onClick={() => toggleCheckItem(item.id)}>
                        {item.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                      <span className={`task-checklist-text${item.done?" task-checklist-text--done":""}`}>{item.text}</span>
                      <button type="button" className="task-checklist-remove" onClick={() => removeCheckItem(item.id)}>✕</button>
                    </div>
                  ))}
                  {taskChecklist.length === 0 && <p className="task-checklist-empty">No items yet.</p>}
                </div>
                <div className="task-staff-input-row">
                  <input type="text" className="task-input" value={taskCheckInput} placeholder="Add a checklist step…"
                    onChange={e => setTaskCheckInput(e.target.value)}
                    onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); addChecklistItem(); } }}/>
                  <button type="button" className="task-add-btn" onClick={addChecklistItem} disabled={!taskCheckInput.trim()}>Add</button>
                </div>
              </div>
            </div>
          </div>
          <div className="task-modal-footer">
            <button type="button" className="task-cancel-btn" onClick={closeTaskModal} disabled={taskSaving}>Cancel</button>
            <button type="button" className="task-submit-btn" onClick={handleCreateTask} disabled={taskSaving || !taskName.trim()}>
              {taskSaving ? "Creating…" : "Create Task"}
            </button>
          </div>
        </div>
      </div>
    ) : null;

    /* ══════════════════════════════════════════════════════════
      CARD + ROW RENDERERS
    ══════════════════════════════════════════════════════════ */
    const renderReportCard = (report: Report, showDupLink = false) => {
  const key = getGroupKey(report);
  const duplicates = showDupLink ? (duplicateCounts[key] || 1) - 1 : 0;
  const existing = getExistingTask(report);
  const statusColor = getStatusColor(report.status);
  
  return (
    <div key={report._id} className="report" onClick={() => handleCardClick(report)}>
      {existing && <div style={{ height: 3, background: metaPriorities.find(p => p.name === existing.priority)?.color || "#22c55e" }} />}
      <div className="report-img-container">
        <img src={resolveImg(report.image || report.ImageFile)} alt="Report" className="report-img"
          onError={e => { (e.target as HTMLImageElement).src = defaultImg; }} />
      </div>
      <div className="report-body">
        <div className="report-header-row">
          {report.reportId && <p className="report-id-badge">#{report.reportId}</p>}
          <h3>{report.heading || "Untitled report"}</h3>
        </div>
        {/* Use inline style for dynamic color */}
        <div className="status-focus-row" style={{ 
          backgroundColor: `${statusColor}10`, 
          borderLeft: `3px solid ${statusColor}`,
          padding: "6px 8px",
          borderRadius: "4px",
          marginBottom: "8px"
        }}>
          <span className="status-focus-label">Status</span>
          {renderStatusPill(report.status)}
        </div>
        <p className="report-description">{report.description || "No description provided."}</p>
        <div className="report-info">
          <p><strong>Building:</strong> {formatBuilding(report)}</p>
          <p><strong>Concern:</strong> {formatConcern(report)}</p>
          <p><strong>College:</strong> {report.college || "Unspecified"}</p>
        </div>
        <p className="submitted-date">
          {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ""}
          {report.createdAt && ` (${getRelativeTime(report.createdAt)})`}
        </p>
        {showDupLink && !showDuplicates && duplicates > 0 && (
          <p className="duplicate-msg" onClick={e => { e.stopPropagation(); setSelectedGroup(key); }}>
            +{duplicates} similar {duplicates === 1 ? "report" : "reports"}
          </p>
        )}
        <div className="report-card-actions" onClick={e => e.stopPropagation()}>
          <button type="button" className="card-progress-btn" onClick={e => openProgress(report, e)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Progress
          </button>
          {renderTaskButton(report, "card")}
        </div>
      </div>
    </div>
  );
};

    const renderReportRow = (report: Report) => {
      const sColor   = getStatusColor(report.status);
      const existing = getExistingTask(report);
      return (
        <div key={report._id} className="report-list-row" onClick={() => handleCardClick(report)}>
          {existing && <span className="report-list-task-bar" style={{ backgroundColor:metaPriorities.find(p=>p.name===existing.priority)?.color || "#22c55e" }}/>}
          <div className="report-list-title-cell">
            {report.reportId && <span className="report-id-badge" style={{ marginLeft:0, marginRight:6 }}>#{report.reportId}</span>}
            <span className="report-list-heading">{report.heading || "Untitled report"}</span>
          </div>
          <span><span className="status-pill" style={{ backgroundColor:sColor, color:"#fff", textShadow:"0 1px 2px rgba(0,0,0,0.2)" }}>{report.status||"Pending"}</span></span>
          <span className="report-list-cell">{formatBuilding(report)}</span>
          <span className="report-list-cell">{formatConcern(report)}</span>
          <span className="report-list-cell">{report.college || "—"}</span>
          <span className="report-list-time">
            {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "—"}
            {report.createdAt && <span style={{ display:"block", fontSize:"0.68rem", opacity:0.6 }}>{getRelativeTime(report.createdAt)}</span>}
          </span>
          <div className="report-list-actions" onClick={e => e.stopPropagation()}>
            <button type="button" className="card-progress-btn" style={{ fontSize:"0.68rem" }} onClick={e => openProgress(report, e)}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </button>
            {renderTaskButton(report, "list")}
          </div>
        </div>
      );
    };

    /* ══════════════════════════════════════════════════════════
      MAIN RENDER
    ══════════════════════════════════════════════════════════ */
    return (
      <>
        <div className="report-wrapper">
          <div className="header">
            <div>
              <h1>Reports</h1>
              <p className="header-subtitle">Review, update, and archive facility reports in one place.</p>
            </div>
            <div className="header-actions">
              <div className="view-toggle-group">
                <button type="button" className={`view-toggle-btn${viewMode==="card"?" view-toggle-btn--active":""}`} onClick={() => setViewMode("card")} title="Card view">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                </button>
                <button type="button" className={`view-toggle-btn${viewMode==="list"?" view-toggle-btn--active":""}`} onClick={() => setViewMode("list")} title="List view">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
              </div>
              <button className="refresh-btn" type="button" onClick={() => { fetchReports(); fetchTasks(); }} disabled={isLoading} title="Refresh">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </button>
              <button className="printreports-btn" onClick={handlePrint} type="button">Print Analytic Reports</button>
            </div>
          </div>

          {loadError && <div className="load-error-banner">{loadError} <button type="button" onClick={fetchReports}>Retry</button></div>}

          {/* ── Filters ── */}
          <div className="filters-card">
            <div className="filters-header-row">
              <span className="filters-title">Filters</span>
              <div className="filters-header-right">
                <div className="user-type-toggle">
                  {["All","Student","Staff","Faculty"].map(type => (
                    <button key={type} type="button" className={`user-type-btn ${userTypeFilter===type?"active":""}`} onClick={() => setUserTypeFilter(type)}>{type}</button>
                  ))}
                </div>
                <button className="clear-filters-btn" type="button" onClick={handleClearFilters}>Clear filters</button>
              </div>
            </div>
            <div className="filters">
              <div className="filter-field"><label htmlFor="building-filter">Building</label><select id="building-filter" value={buildingFilter} onChange={e => setBuildingFilter(e.target.value)}>{buildingOptions.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
              <div className="filter-field"><label htmlFor="concern-filter">Concern</label><select id="concern-filter" value={concernFilter} onChange={e => setConcernFilter(e.target.value)}>{concernOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="filter-field"><label htmlFor="college-filter">College</label><select id="college-filter" value={collegeFilter} onChange={e => setCollegeFilter(e.target.value)}>{collegeOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="filter-field"><label htmlFor="status-filter">Status</label><select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>{statusOptions.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <label className="duplicate-toggle"><input type="checkbox" checked={showDuplicates} onChange={() => setShowDuplicates(p => !p)}/> Show duplicates</label>
            </div>
            {/* ── Date filter ── */}
            <div className="date-filter-row">
              <span className="date-filter-label">Date</span>
              <div className="date-filter-tabs">
                {(["all","today","week","month","custom"] as DateFilter[]).map(f => (
                  <button key={f} type="button" className={`date-filter-tab${dateFilter===f?" date-filter-tab--active":""}`} onClick={() => setDateFilter(f)}>
                    {f==="all"?"All time":f==="today"?"Today":f==="week"?"Last 7 days":f==="month"?"Last 30 days":"Custom"}
                  </button>
                ))}
              </div>
              {dateFilter === "custom" && (
                <div className="date-custom-inputs">
                  <input type="date" className="date-custom-input" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)}/>
                  <span style={{ color:"#9ca3af", fontSize:13 }}>to</span>
                  <input type="date" className="date-custom-input" value={customDateTo}   onChange={e => setCustomDateTo(e.target.value)}/>
                </div>
              )}
            </div>
          </div>

          {/* ── Search ── */}
          <div className="group">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon">
              <g><path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z"/></g>
            </svg>
            <input id="report-id-search" className="search" type="text" placeholder="Search by report ID, title, or description…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
            {searchQuery && <button className="search-clear-btn" type="button" onClick={() => setSearchQuery("")}>✕</button>}
          </div>

          {isLoading && <div className="loading-shimmer-wrapper">{[...Array(6)].map((_,i)=><div key={i} className="shimmer-card"/>)}</div>}

          {!isLoading && filteredReports.length === 0 && !loadError && (
            <div className="empty-state">
              <svg viewBox="0 0 64 64" fill="none" width="48" height="48"><circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" opacity="0.2"/><path d="M20 32h24M32 20v24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/></svg>
              <p>No reports found for the current filters.</p>
              <button type="button" onClick={handleClearFilters} className="clear-filters-btn">Clear all filters</button>
            </div>
          )}

          {!isLoading && filteredReports.length > 0 && (
            <>
              {selectedGroup ? (
                <div className={viewMode==="list"?"reports-list-view":"reports-list"}>
                  <div className="group-header" style={{ gridColumn:"1 / -1" }}>
                    <h2>Similar reports for <em>{selectedGroup.replace(/\|/g," › ")}</em></h2>
                    <button onClick={() => setSelectedGroup(null)} className="back-btn" type="button">← Back</button>
                  </div>
                  {viewMode === "list" ? (
                    <><div className="report-list-header"><span>Report</span><span>Status</span><span>Building</span><span>Concern</span><span>College</span><span>Date</span><span>Actions</span></div>{getReportsByGroup(selectedGroup).map(r => renderReportRow(r))}</>
                  ) : getReportsByGroup(selectedGroup).map(r => renderReportCard(r, false))}
                </div>
              ) : (
                <>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                    <span style={{ fontSize:"0.8rem", color:"#6b7280" }}>
                      {filteredReports.length} report{filteredReports.length!==1?"s":""}
                      {dateFilter!=="all" && ` · ${dateFilter==="today"?"Today":dateFilter==="week"?"Last 7 days":dateFilter==="month"?"Last 30 days":"Custom range"}`}
                    </span>
                  </div>
                  {viewMode === "list" ? (
                    <div className="reports-list-view">
                      <div className="report-list-header"><span>Report</span><span>Status</span><span>Building</span><span>Concern</span><span>College</span><span>Date</span><span>Actions</span></div>
                      {paginatedReports.map(r => renderReportRow(r))}
                    </div>
                  ) : (
                    <div className="reports-list">{paginatedReports.map(r => renderReportCard(r, true))}</div>
                  )}
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button type="button" onClick={() => setCurrentPage(1)}                               disabled={currentPage===1}>«</button>
                      <button type="button" onClick={() => setCurrentPage(p => Math.max(1,p-1))}            disabled={currentPage===1}>‹</button>
                      {Array.from({ length:totalPages }, (_,i) => i+1)
                        .filter(p => p===1 || p===totalPages || Math.abs(p-currentPage) <= 1)
                        .reduce<(number|"…")[]>((acc,p,i,arr) => { if (i>0 && p-(arr[i-1] as number)>1) acc.push("…"); acc.push(p); return acc; }, [])
                        .map((p,i) => p==="…"
                          ? <span key={`e-${i}`} style={{ minWidth:28, textAlign:"center", fontSize:"0.875rem", color:"#6b7280" }}>…</span>
                          : <button key={p} type="button" className={p===currentPage?"active":""} onClick={() => setCurrentPage(p as number)}>{p}</button>
                        )}
                      <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages}>›</button>
                      <button type="button" onClick={() => setCurrentPage(totalPages)}                     disabled={currentPage===totalPages}>»</button>
                      <span style={{ marginLeft:8, fontSize:"0.8rem", color:"#9ca3af", whiteSpace:"nowrap" }}>{startIndex+1}–{Math.min(startIndex+REPORTS_PER_PAGE,filteredReports.length)} of {filteredReports.length}</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {mounted && modalContent         && createPortal(modalContent,         document.body)}
        {mounted && taskModalContent     && createPortal(taskModalContent,     document.body)}
        {mounted && progressModalContent && createPortal(progressModalContent, document.body)}

        {mounted && createPortal(
          <div className="toast-container" aria-live="polite">
            {toasts.map(t => (
              <div key={t.id} className={`toast toast-${t.type}`}>
                <span>{t.message}</span>
                <button type="button" onClick={() => dismissToast(t.id)} className="toast-dismiss">✕</button>
              </div>
            ))}
          </div>, document.body
        )}

        {mounted && confirmDialog.open && createPortal(
          <div className="confirm-backdrop" onClick={closeConfirm}>
            <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
              <p>{confirmDialog.message}</p>
              <div className="confirm-actions">
                <button type="button" className="confirm-cancel-btn" onClick={closeConfirm}>Cancel</button>
                <button type="button" className="confirm-ok-btn"     onClick={runConfirm}>Confirm</button>
              </div>
            </div>
          </div>, document.body
        )}
      </>
    );
  }