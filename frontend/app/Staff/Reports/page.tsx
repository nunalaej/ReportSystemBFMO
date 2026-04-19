// app/Staff/Reports/page.tsx
"use client";

import "@/app/Admin/style/reports.css";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";
import { useStaffPerms } from "../hooks/useStaffPerms";

const defaultImg = "/default.jpg";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";

/* ── Types ── */
type Comment = {
  text?: string; comment?: string;
  at?: string; by?: string; imageUrl?: string;
};

type Report = {
  _id: string; reportId?: string; email?: string; userType?: string;
  heading?: string; description?: string; concern?: string;
  subConcern?: string; otherConcern?: string; building?: string;
  otherBuilding?: string; college?: string; floor?: string;
  room?: string; otherRoom?: string; image?: string;
  ImageFile?: string; status?: string; createdAt?: string;
  comments?: Comment[];
};

/* ── Helpers ── */
const formatConcern = (r: Report) => {
  const base = r.concern || "Unspecified";
  const sub  = r.subConcern || r.otherConcern;
  return sub ? `${base} : ${sub}` : base;
};

const formatBuilding = (r: Report) => {
  const raw   = r.building || "Unspecified";
  const label = raw.toLowerCase() === "other" && r.otherBuilding ? r.otherBuilding : raw;
  const room  = r.room || r.otherRoom;
  return room ? `${label} : ${room}` : label;
};

function getRelativeTime(d?: string) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  let diff = now.getTime() - date.getTime();
  if (diff < 0) diff = 0;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

const getGroupKey = (r: Report) => {
  const b   = (r.building    || "").trim();
  const c   = (r.concern     || "").trim();
  const sc  = (r.subConcern  || r.otherConcern || "").trim();
  const rm  = (r.room        || r.otherRoom    || "").trim();
  return rm ? `${b}|${c}|${sc}|${rm}` : `${b}|${c}|${sc}`;
};

const resolveImage = (raw?: string) => {
  if (!raw) return defaultImg;
  const src = raw.trim();
  if (!src) return defaultImg;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (CLOUDINARY_CLOUD_NAME) return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${src.replace(/^\/+/, "")}`;
  if (!API_BASE) return defaultImg;
  return src.startsWith("/") ? `${API_BASE}${src}` : `${API_BASE}/${src}`;
};

const getStatusClassKey = (s?: string) => {
  const v = s || "Pending";
  if (v === "Waiting for Materials") return "waiting";
  if (v === "In Progress") return "inprogress";
  if (v === "Resolved")    return "completed";
  if (v === "Archived")    return "archived";
  return "pending";
};

const REPORTS_PER_PAGE = 12;

/* ── Toast ── */
type ToastType = "success" | "error" | "info";
type Toast     = { id: number; message: string; type: ToastType };
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

/* ══════════════════════════════════════════════════════════ */
export default function StaffReportsPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  /* ── Permission hook — loads from DB ── */
  const { staffRecord, perms, loaded: permsLoaded, getRoleBadgeStyle, permSummary } = useStaffPerms(user?.id);
  const rb = getRoleBadgeStyle();

  const [canView,  setCanView]  = useState(false);
  const [reports,  setReports]  = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  /* ── Status options from DB meta ── */
  const [metaStatuses, setMetaStatuses] = useState<{ id: string; name: string; color: string }[]>([
    { id: "1", name: "Pending",         color: "#FFA500" },
    { id: "2", name: "Pending Inspect", color: "#FFD700" },
    { id: "3", name: "In Progress",     color: "#4169E1" },
    { id: "4", name: "Resolved",        color: "#28A745" },
    { id: "5", name: "Archived",        color: "#6C757D" },
  ]);

  /* ── Filters ── */
  const [buildingFilter,  setBuildingFilter]  = useState("All Buildings");
  const [concernFilter,   setConcernFilter]   = useState("All Concerns");
  const [collegeFilter,   setCollegeFilter]   = useState("All Colleges");
  const [statusFilter,    setStatusFilter]    = useState("All Statuses");
  const [showDuplicates,  setShowDuplicates]  = useState(false);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [userTypeFilter,  setUserTypeFilter]  = useState("All");
  const [currentPage,     setCurrentPage]     = useState(1);
  const [selectedGroup,   setSelectedGroup]   = useState<string | null>(null);

  /* ── Modal ── */
  const [selectedReport,  setSelectedReport]  = useState<Report | null>(null);
  const [statusValue,     setStatusValue]     = useState("Pending");
  const [commentText,     setCommentText]     = useState("");
  const [saving,          setSaving]          = useState(false);
  const [editingIndex,    setEditingIndex]    = useState<number | null>(null);
  const [editingText,     setEditingText]     = useState("");
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  /* ── Confirm ── */
  const confirmCallbackRef = useRef<(() => void | Promise<void>) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, message: "" });

  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { router.replace("/"); return; }
    const rawRole = (user.publicMetadata as any)?.role;
    const role = Array.isArray(rawRole) ? String(rawRole[0]).toLowerCase()
               : typeof rawRole === "string" ? rawRole.toLowerCase() : "";
    if (role !== "staff") { router.replace("/"); return; }
    setCanView(true);
  }, [isLoaded, isSignedIn, user, router]);

  /* ── Fetch meta statuses ── */
  useEffect(() => {
    fetch(`${API_BASE}/api/meta?ts=${Date.now()}`, { cache: "no-store" })
      .then(r => r.json()).catch(() => null)
      .then(data => {
        if (data?.statuses?.length > 0) setMetaStatuses(data.statuses);
      });
  }, []);

  /* ── Fetch reports ── */
  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true); setLoadError("");
      const res  = await fetch(`${API_BASE}/api/reports`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) { setLoadError(data?.message || "Could not load reports."); setReports([]); return; }
      let list: Report[] = [];
      if      (Array.isArray(data))          list = data;
      else if (Array.isArray(data.reports))  list = data.reports;
      else if (Array.isArray(data.data))     list = data.data;
      else { setLoadError("Unexpected data format."); setReports([]); return; }
      setReports(list); setCurrentPage(1);
    } catch { setLoadError("Network error."); setReports([]); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { if (canView) fetchReports(); }, [canView]);

  /* ── Lock body scroll ── */
  useEffect(() => {
    document.body.style.overflow = selectedReport ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedReport]);

  useEscapeKey(
    useCallback(() => {
      if (isImageExpanded) { setIsImageExpanded(false); return; }
      if (selectedReport) closeDetails();
    }, [isImageExpanded, selectedReport]),
    !!(selectedReport || isImageExpanded)
  );

  /* ── Helpers ── */
  const getStatusColor = (name?: string) =>
    metaStatuses.find(s => s.name === (name || "Pending"))?.color || "#6C757D";

  const statusMatchesFilter = (reportStatus: string | undefined, filter: string) => {
    const current     = reportStatus || "Pending";
    const archivedName = metaStatuses.find(s => s.name.toLowerCase() === "archived")?.name || "Archived";
    const resolvedName = metaStatuses.find(s => s.name.toLowerCase() === "resolved")?.name  || "Resolved";
    if (filter === "All Statuses") return current !== archivedName && current !== resolvedName;
    return current === filter;
  };

  const renderStatusPill = (statusRaw?: string) => {
    const status = statusRaw || "Pending";
    const color  = getStatusColor(status);
    return (
      <span className="status-pill" style={{ backgroundColor: color, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
        {status}
      </span>
    );
  };

  /* ── Duplicates ── */
  const duplicateCounts: Record<string, number> = {};
  reports.forEach(r => { const k = getGroupKey(r); duplicateCounts[k] = (duplicateCounts[k] || 0) + 1; });

  const filterUnique = (arr: Report[]) => {
    const seen = new Set<string>();
    return arr.filter(r => { const k = getGroupKey(r); if (seen.has(k)) return false; seen.add(k); return true; });
  };

  const reportsToDisplay = showDuplicates ? reports : filterUnique(reports);
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

  /* ── Filtered reports ── */
  const filteredReports = reportsToDisplay.filter(report => {
    const bm = buildingFilter === "All Buildings" || report.building  === buildingFilter;
    const cm = concernFilter  === "All Concerns"  || report.concern   === concernFilter;
    const lm = collegeFilter  === "All Colleges"  || (report.college  || "Unspecified") === collegeFilter;
    const sm = statusMatchesFilter(report.status, statusFilter);
    const qm = !searchQuery.trim() ||
      (report.reportId    || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (report.heading     || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (report.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    const um = userTypeFilter === "All" || (report.userType || "") === userTypeFilter;
    return bm && cm && lm && sm && qm && um;
  });

  useEffect(() => { setCurrentPage(1); }, [buildingFilter, concernFilter, collegeFilter, statusFilter, showDuplicates, searchQuery, userTypeFilter]);

  const totalPages       = Math.max(1, Math.ceil(filteredReports.length / REPORTS_PER_PAGE));
  const startIndex       = (currentPage - 1) * REPORTS_PER_PAGE;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + REPORTS_PER_PAGE);

  /* ── Modal handlers ── */
  const handleCardClick = (report: Report) => {
    setSelectedReport(report); setStatusValue(report.status || "Pending");
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
  };

  const showConfirm = (message: string, onConfirm: () => void | Promise<void>) => {
    confirmCallbackRef.current = onConfirm;
    setConfirmDialog({ open: true, message });
  };
  const closeConfirm = () => setConfirmDialog(d => ({ ...d, open: false }));
  const runConfirm   = async () => {
    closeConfirm();
    const action = confirmCallbackRef.current;
    if (!action) return;
    confirmCallbackRef.current = null;
    try { await Promise.resolve(action()); }
    catch { showToast("Action failed.", "error"); }
  };

  /* ── Comments sync ── */
  const syncComments = async (updatedComments: Comment[]) => {
    if (!selectedReport) return;
    try {
      setSaving(true);
      const res  = await fetch(`${API_BASE}/api/reports/${selectedReport._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedReport.status || "Pending", comments: updatedComments, overwriteComments: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      const updated = data.report as Report;
      setReports(p => p.map(r => r._id === updated._id ? updated : r));
      setSelectedReport(updated); setEditingIndex(null); setEditingText("");
      showToast("Comment updated.", "success");
    } catch (err: any) { showToast(err.message || "Failed.", "error"); }
    finally { setSaving(false); }
  };

  /* ── Save status + comment ── */
  const handleSaveChanges = async () => {
    if (!selectedReport) return;
    if (!perms.canUpdateReport) { showToast("Your role cannot update report status.", "error"); return; }
    try {
      setSaving(true);
      const trimmedComment = commentText.trim();
      const groupReports   = reports.filter(r => getGroupKey(r) === getGroupKey(selectedReport));
      const updatedReports = await Promise.all(groupReports.map(async r => {
        const res  = await fetch(`${API_BASE}/api/reports/${r._id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusValue, ...(trimmedComment ? { comment: trimmedComment } : {}) }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
        return data.report as Report;
      }));
      if (trimmedComment) {
        const cRes  = await fetch(`${API_BASE}/api/reports/${selectedReport._id}/comments`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmedComment, by: staffRecord?.name || "BFMO Staff", skipEmail: true }),
        });
        const cData = await cRes.json().catch(() => null);
        if (cRes.ok && cData?.success) {
          const idx = updatedReports.findIndex(u => u._id === selectedReport._id);
          if (idx !== -1) updatedReports[idx] = cData.report as Report;
        }
      }
      setReports(p => p.map(r => updatedReports.find(u => u._id === r._id) || r));
      const updatedSelected = updatedReports.find(u => u._id === selectedReport._id) || updatedReports[0];
      setSelectedReport(updatedSelected); setStatusValue(updatedSelected.status || "Pending"); setCommentText("");
      showToast(`Status updated to "${statusValue}".`, "success");
    } catch (err: any) { showToast(err.message || "Failed.", "error"); }
    finally { setSaving(false); }
  };

  /* ── Archive ── */
  const handleArchive = async () => {
    if (!selectedReport) return;
    if (!perms.canArchive) { showToast("Your role cannot archive reports.", "error"); return; }
    showConfirm("Archive this report? This will notify the reporter.", async () => {
      try {
        setSaving(true);
        const groupReports   = reports.filter(r => getGroupKey(r) === getGroupKey(selectedReport));
        const updatedReports = await Promise.all(groupReports.map(async r => {
          const res  = await fetch(`${API_BASE}/api/reports/${r._id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Archived", sendEmail: true }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
          return data.report as Report;
        }));
        setReports(p => p.map(r => updatedReports.find(u => u._id === r._id) || r));
        const updatedSelected = updatedReports.find(u => u._id === selectedReport._id) || updatedReports[0];
        setSelectedReport(updatedSelected); setStatusValue("Archived");
        showToast("Report archived.", "success");
      } catch { showToast("Failed to archive.", "error"); }
      finally { setSaving(false); }
    });
  };

  /* ── Add comment ── */
  const addIndividualComment = async () => {
    if (!selectedReport) return;
    if (!perms.canComment) { showToast("Your role cannot add comments.", "error"); return; }
    const trimmed = commentText.trim();
    if (!trimmed) { showToast("Please enter a comment.", "error"); return; }
    try {
      setSaving(true);
      const res  = await fetch(`${API_BASE}/api/reports/${selectedReport._id}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, by: staffRecord?.name || "BFMO Staff" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      const updated = data.report as Report;
      setReports(p => p.map(r => r._id === updated._id ? updated : r));
      setSelectedReport(updated); setCommentText("");
      showToast("Comment added.", "success");
    } catch (err: any) { showToast(err.message || "Failed.", "error"); }
    finally { setSaving(false); }
  };

  const startEditComment  = (index: number) => {
    if (!selectedReport?.comments || !perms.canComment) return;
    const c = selectedReport.comments[index]; if (!c) return;
    setEditingIndex(index); setEditingText(c.text || c.comment || "");
  };
  const cancelEditComment = () => { setEditingIndex(null); setEditingText(""); };
  const saveEditedComment = async (index: number) => {
    if (!selectedReport?.comments) return;
    const trimmed = editingText.trim();
    if (!trimmed) { showToast("Comment cannot be empty.", "error"); return; }
    await syncComments(selectedReport.comments.map((c, i) =>
      i !== index ? c : { ...c, text: trimmed, comment: trimmed, at: new Date().toISOString() }
    ));
  };
  const deleteComment = async (index: number) => {
    if (!selectedReport?.comments || !perms.canComment) return;
    showConfirm("Delete this comment?", async () => {
      await syncComments(selectedReport.comments!.filter((_, i) => i !== index));
    });
  };

  /* ── Print ── */
  const handlePrint = useCallback(() => {
    if (typeof window === "undefined") return;
    const cBase = new Map<string, number>(); const cFull = new Map<string, number>(); const bMap = new Map<string, number>();
    filteredReports.forEach(r => {
      const base = (r.concern || "Unspecified").trim(); cBase.set(base,(cBase.get(base)||0)+1);
      const full = formatConcern(r); cFull.set(full,(cFull.get(full)||0)+1);
      const bk   = (r.building || "Unspecified").trim(); bMap.set(bk,(bMap.get(bk)||0)+1);
    });
    const safe = (v?: string) => v ? String(v) : "";
    const printedDate = new Date().toLocaleString();
    const rowsHtml = filteredReports.map((r, idx) => {
      const created = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";
      return `<tr><td>${idx+1}</td><td>${safe(r.reportId)}</td><td>${created}</td><td>${safe(r.status)}</td><td>${safe(r.building)}</td><td>${safe(formatConcern(r))}</td><td>${safe(r.college)}</td><td>${safe(r.floor)}</td><td>${safe(r.room)}</td><td>${safe(r.userType)}</td></tr>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFMO Staff Reports</title><style>body{font-family:system-ui,sans-serif;font-size:8px;padding:10px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #d1d5db;padding:4px 6px;text-align:left}thead{background:#f3f4f6}h1{font-size:18px;margin:16px 0 4px}h2{font-size:14px;margin-top:14px}ul{margin:4px 0 8px 16px}li{margin:2px 0}.title{font-size:13px;font-weight:700;color:#fff;background:#029006;padding:8px}@media print{*{-webkit-print-color-adjust:exact!important}}</style></head><body>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px"><tr><td rowspan="3" style="width:90px;text-align:center"><img src="/logo-dlsud.png" style="width:64px;height:64px;object-fit:contain;padding-top:12px"/></td><td colspan="2" class="title">Building Facilities Maintenance Office : Staff Reports</td></tr><tr><td><strong>Printed:</strong> ${printedDate}</td><td><strong>Staff:</strong> ${staffRecord?.name || "BFMO Staff"}</td></tr></table>
    <h1>BFMO Reports</h1><div style="font-size:11px;margin-bottom:12px">Records: ${filteredReports.length}</div>
    <h2>By Concern</h2><ul>${[...cBase.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<li>${n}: ${c}</li>`).join("")}</ul>
    <h2>By Building</h2><ul>${[...bMap.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<li>${n}: ${c}</li>`).join("")}</ul>
    <h2>Detailed Report</h2><table><thead><tr><th>#</th><th>Report ID</th><th>Date Created</th><th>Status</th><th>Building</th><th>Concern</th><th>College</th><th>Floor</th><th>Room</th><th>Reporter Type</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`;
    const w = window.open("", "_blank"); if (!w) return;
    w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print();
  }, [filteredReports, staffRecord]);

  /* ── Guards ── */
  if (!isLoaded || !canView) {
    return <div className="report-wrapper"><div className="loading-shimmer-wrapper">{[...Array(6)].map((_,i)=><div key={i} className="shimmer-card"/>)}</div></div>;
  }

  const commentsToShow: Comment[] = selectedReport?.comments || [];

  /* ══════════════════════════════════════════════════════════
     MODAL
  ══════════════════════════════════════════════════════════ */
  const modalContent = selectedReport ? (
    <div className="report-modal-backdrop" onClick={closeDetails} role="dialog" aria-modal="true">
      <div className="report-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-main">
            <h2>{selectedReport.heading || "Report details"}</h2>
            {selectedReport.reportId && <span className="modal-report-id-badge">#{selectedReport.reportId}</span>}
            {/* Role badge */}
            {staffRecord && (
              <span style={{ fontSize:"0.62rem", fontWeight:700, padding:"2px 8px", borderRadius:999, background: rb.bg, color: rb.color, textTransform:"uppercase", letterSpacing:"0.05em", marginLeft:4 }}>
                {staffRecord.position}
              </span>
            )}
          </div>
          <button className="modal-close-btn" onClick={closeDetails} type="button" aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className="modal-content">
          <div className="modal-img-wrapper">
            <img src={resolveImage(selectedReport.ImageFile || selectedReport.image)} alt="Report"
              className="report-img report-img-clickable"
              onClick={() => setIsImageExpanded(true)}
              onError={e => { (e.target as HTMLImageElement).src = defaultImg; }} />
            <div className="modal-img-hint">Click to enlarge</div>
          </div>

          <div className="modal-info">
            <p className="modal-description">{selectedReport.description || "No description provided."}</p>
            <div className="modal-meta-grid">
              <p><strong>Building:</strong> {formatBuilding(selectedReport)}</p>
              <p><strong>Concern:</strong>  {formatConcern(selectedReport)}</p>
              <p><strong>College:</strong>  {selectedReport.college || "Unspecified"}</p>
              <p><strong>Reporter:</strong> {selectedReport.userType || "Unspecified"}</p>
              <p><strong>Email:</strong>    {selectedReport.email || "Unspecified"}</p>
              <p>
                <strong>Submitted:</strong>{" "}
                {selectedReport.createdAt && new Date(selectedReport.createdAt).toLocaleString()}{" "}
                {selectedReport.createdAt && `(${getRelativeTime(selectedReport.createdAt)})`}
              </p>
            </div>

            {/* ── STATUS PANEL ── */}
            <div className="status-panel" style={{ borderLeft: `3px solid ${getStatusColor(statusValue)}` }}>
              <div className="status-panel-header">
                <span className="status-panel-title">Status</span>
                {renderStatusPill(statusValue)}
              </div>

              {/* Only show update controls if canUpdateReport */}
              {perms.canUpdateReport ? (
                <div className="status-row status-row-inline">
                  <label htmlFor="status-select" className="status-row-label">Update</label>
                  <select id="status-select" className="status-select"
                    value={statusValue}
                    onChange={e => setStatusValue(e.target.value)}
                    disabled={selectedReport.status === "Archived"}>
                    {metaStatuses.filter(s => s.name.toLowerCase() !== "archived")
                      .map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              ) : (
                <p style={{ fontSize:"0.72rem", color:"var(--tasks-text-4,#b8c4ce)", marginTop:6 }}>
                  Your role ({staffRecord?.position}) cannot update status.
                </p>
              )}
            </div>

            {/* ── COMMENTS ── */}
            <div className="comments-section">
              <h3>
                Comments
                {commentsToShow.length > 0 && <span className="comments-count">{commentsToShow.length}</span>}
              </h3>

              {commentsToShow.length > 0 ? (
                <ul className="comments-list">
                  {commentsToShow.map((c, idx) => (
                    <li key={idx} className="comment-item">
                      {editingIndex === idx ? (
                        <>
                          <textarea className="comment-edit-input" rows={2} value={editingText}
                            onChange={e => setEditingText(e.target.value)} autoFocus />
                          <div className="comment-actions-row">
                            <button type="button" className="comment-btn-save"   onClick={() => saveEditedComment(idx)} disabled={saving}>Save</button>
                            <button type="button" className="comment-btn-cancel" onClick={cancelEditComment}            disabled={saving}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="comment-text">{c.text || c.comment || String(c)}</p>
                          {c.imageUrl && <img src={c.imageUrl} alt="attachment" className="comment-image" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                          <div className="comment-footer">
                            <div>
                              {c.at && <span className="comment-date">{new Date(c.at).toLocaleString()}&nbsp;</span>}
                              {c.by && <span className="comment-date">by {c.by}</span>}
                            </div>
                            {/* Edit/delete comment only if canComment */}
                            {perms.canComment && (
                              <div className="comment-actions">
                                <button type="button" className="comment-btn-edit"   onClick={() => startEditComment(idx)} disabled={saving}>Edit</button>
                                <button type="button" className="comment-btn-delete" onClick={() => deleteComment(idx)}    disabled={saving}>Delete</button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="no-comments">No comments yet.</p>}

              {/* Add comment — only if canComment */}
              {perms.canComment ? (
                <>
                  <textarea className="comment-input" rows={3} value={commentText}
                    onChange={e => setCommentText(e.target.value)} placeholder="Type your comment here…" />
                  <div className="modal-actions">
                    <button className="add-comment-btn" onClick={addIndividualComment}
                      disabled={saving || !commentText.trim()} type="button">
                      {saving ? "Adding…" : "Add Comment"}
                    </button>

                    {/* Archive — only if canArchive */}
                    {perms.canArchive && selectedReport.status !== "Archived" && (
                      <button className="archive-btn" onClick={handleArchive} disabled={saving} type="button">
                        Archive report
                      </button>
                    )}

                    {/* Update status — only if canUpdateReport */}
                    {perms.canUpdateReport && (
                      <button className="save-comment-btn" onClick={handleSaveChanges}
                        disabled={saving || selectedReport.status === "Archived"} type="button">
                        {saving ? "Updating…" : "Update Status"}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ marginTop:10, padding:"10px 14px", background:"rgba(0,0,0,0.03)", borderRadius:8, border:"1px solid var(--border,#e8ecf0)" }}>
                  <p style={{ fontSize:"0.78rem", color:"var(--tasks-text-4,#b8c4ce)", margin:0 }}>
                    💬 Comments are read-only for your role ({staffRecord?.position}).
                  </p>
                  {/* Still show Update Status / Archive if those perms exist */}
                  {(perms.canUpdateReport || perms.canArchive) && (
                    <div className="modal-actions" style={{ marginTop:10 }}>
                      {perms.canArchive && selectedReport.status !== "Archived" && (
                        <button className="archive-btn" onClick={handleArchive} disabled={saving} type="button">
                          Archive report
                        </button>
                      )}
                      {perms.canUpdateReport && (
                        <button className="save-comment-btn" onClick={handleSaveChanges}
                          disabled={saving || selectedReport.status === "Archived"} type="button">
                          {saving ? "Updating…" : "Update Status"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen image */}
      {isImageExpanded && (
        <div className="image-fullscreen-backdrop" onClick={() => setIsImageExpanded(false)}>
          <img src={resolveImage(selectedReport.ImageFile || selectedReport.image)}
            alt="Report full view" className="image-fullscreen-img"
            onClick={e => e.stopPropagation()}
            onError={e => { (e.target as HTMLImageElement).src = defaultImg; }} />
          <button className="image-fullscreen-close" onClick={() => setIsImageExpanded(false)} type="button">✕</button>
        </div>
      )}
    </div>
  ) : null;

  /* ══════════════════════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="report-wrapper">
        {/* Header */}
        <div className="header">
          <div>
            <h1>Reports</h1>
            <p className="header-subtitle" style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              Review facility reports.
              {staffRecord && (
                <>
                  <span style={{ background: rb.bg, color: rb.color, fontSize:"0.68rem", fontWeight:700, padding:"2px 8px", borderRadius:999 }}>
                    {staffRecord.position}
                  </span>
                  {permsLoaded && (
                    <span style={{ fontSize:"0.65rem", color:"var(--tasks-text-4,#b8c4ce)", fontStyle:"italic" }}>
                      {permSummary()}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="header-actions">
            <button className="refresh-btn" type="button" onClick={fetchReports} disabled={isLoading} title="Refresh">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <button className="printreports-btn" onClick={handlePrint} type="button">Print Reports</button>
          </div>
        </div>

        {loadError && <div className="load-error-banner">{loadError} <button type="button" onClick={fetchReports}>Retry</button></div>}

        {/* Filters */}
        <div className="filters-card">
          <div className="filters-header-row">
            <span className="filters-title">Filters</span>
            <div className="filters-header-right">
              <div className="user-type-toggle">
                {["All", "Student", "Staff", "Faculty"].map(type => (
                  <button key={type} type="button"
                    className={`user-type-btn ${userTypeFilter === type ? "active" : ""}`}
                    onClick={() => setUserTypeFilter(type)}>{type}</button>
                ))}
              </div>
              <button className="clear-filters-btn" type="button" onClick={handleClearFilters}>Clear filters</button>
            </div>
          </div>
          <div className="filters">
            <div className="filter-field">
              <label htmlFor="building-filter">Building</label>
              <select id="building-filter" value={buildingFilter} onChange={e => setBuildingFilter(e.target.value)}>
                {buildingOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="concern-filter">Concern</label>
              <select id="concern-filter" value={concernFilter} onChange={e => setConcernFilter(e.target.value)}>
                {concernOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="college-filter">College</label>
              <select id="college-filter" value={collegeFilter} onChange={e => setCollegeFilter(e.target.value)}>
                {collegeOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="status-filter">Status</label>
              <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <label className="duplicate-toggle">
              <input type="checkbox" checked={showDuplicates} onChange={() => setShowDuplicates(p => !p)} />
              Show duplicates
            </label>
          </div>
        </div>

        {/* Search */}
        <div className="group">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon">
            <g><path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z"/></g>
          </svg>
          <input id="report-id-search" className="search" type="text"
            placeholder="Search by report ID, title, or description…"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchQuery && <button className="search-clear-btn" type="button" onClick={() => setSearchQuery("")}>✕</button>}
        </div>

        {isLoading && <div className="loading-shimmer-wrapper">{[...Array(6)].map((_,i)=><div key={i} className="shimmer-card"/>)}</div>}

        {!isLoading && filteredReports.length === 0 && !loadError && (
          <div className="empty-state">
            <svg viewBox="0 0 64 64" fill="none" width="48" height="48">
              <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
              <path d="M20 32h24M32 20v24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
            </svg>
            <p>No reports found for the current filters.</p>
            <button type="button" onClick={handleClearFilters} className="clear-filters-btn">Clear all filters</button>
          </div>
        )}

        {!isLoading && filteredReports.length > 0 && (
          <>
            {selectedGroup ? (
              <div className="reports-list">
                <div className="group-header" style={{ gridColumn:"1 / -1" }}>
                  <h2>Similar reports for <em>{selectedGroup.replace(/\|/g, " › ")}</em></h2>
                  <button onClick={() => setSelectedGroup(null)} className="back-btn" type="button">← Back</button>
                </div>
                {getReportsByGroup(selectedGroup).map(report => (
                  <div key={report._id} className="report" onClick={() => handleCardClick(report)}>
                    <div className="report-img-container">
                      <img src={resolveImage(report.image || report.ImageFile)} alt="Report" className="report-img"
                        onError={e => { (e.target as HTMLImageElement).src = defaultImg; }} />
                    </div>
                    <div className="report-body">
                      {report.reportId && <p className="report-id-badge">#{report.reportId}</p>}
                      <h3>{report.heading || "Untitled report"}</h3>
                      <div className={`status-focus-row status-focus-${getStatusClassKey(report.status)}`}>
                        <span className="status-focus-label">Status</span>
                        {renderStatusPill(report.status)}
                      </div>
                      <p className="report-description">{report.description || "No description."}</p>
                      <div className="report-info">
                        <p><strong>Building:</strong> {formatBuilding(report)}</p>
                        <p><strong>Concern:</strong>  {formatConcern(report)}</p>
                        <p><strong>College:</strong>  {report.college || "Unspecified"}</p>
                      </div>
                      <p className="submitted-date">
                        {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ""}
                        {report.createdAt && ` (${getRelativeTime(report.createdAt)})`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <span style={{ fontSize:"0.8rem", color:"#6b7280" }}>
                    {filteredReports.length} report{filteredReports.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="reports-list">
                  {paginatedReports.map(report => {
                    const key        = getGroupKey(report);
                    const duplicates = (duplicateCounts[key] || 1) - 1;
                    return (
                      <div key={report._id} className="report" onClick={() => handleCardClick(report)}>
                        <div className="report-img-container">
                          <img src={resolveImage(report.image || report.ImageFile)} alt="Report" className="report-img"
                            onError={e => { (e.target as HTMLImageElement).src = defaultImg; }} />
                        </div>
                        <div className="report-body">
                          <div className="report-header-row">
                            {report.reportId && <p className="report-id-badge">#{report.reportId}</p>}
                            <h3>{report.heading || "Untitled report"}</h3>
                          </div>
                          <div className={`status-focus-row status-focus-${getStatusClassKey(report.status)}`}>
                            <span className="status-focus-label">Status</span>
                            {renderStatusPill(report.status)}
                          </div>
                          <p className="report-description">{report.description || "No description."}</p>
                          <div className="report-info">
                            <p><strong>Building:</strong> {formatBuilding(report)}</p>
                            <p><strong>Concern:</strong>  {formatConcern(report)}</p>
                            <p><strong>College:</strong>  {report.college || "Unspecified"}</p>
                          </div>
                          <p className="submitted-date">
                            {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ""}
                            {report.createdAt && ` (${getRelativeTime(report.createdAt)})`}
                          </p>
                          {!showDuplicates && duplicates > 0 && (
                            <p className="duplicate-msg" onClick={e => { e.stopPropagation(); setSelectedGroup(key); }}>
                              +{duplicates} similar {duplicates === 1 ? "report" : "reports"}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button type="button" onClick={() => setCurrentPage(1)}                                disabled={currentPage === 1}>«</button>
                    <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}          disabled={currentPage === 1}>‹</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce<(number | "…")[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                        acc.push(p); return acc;
                      }, [])
                      .map((p, i) => p === "…"
                        ? <span key={`e-${i}`} style={{ minWidth:28, textAlign:"center", fontSize:"0.875rem", color:"#6b7280" }}>…</span>
                        : <button key={p} type="button" className={p === currentPage ? "active" : ""} onClick={() => setCurrentPage(p as number)}>{p}</button>
                      )}
                    <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
                    <button type="button" onClick={() => setCurrentPage(totalPages)}                       disabled={currentPage === totalPages}>»</button>
                    <span style={{ marginLeft:8, fontSize:"0.8rem", color:"#9ca3af", whiteSpace:"nowrap" }}>
                      {startIndex + 1}–{Math.min(startIndex + REPORTS_PER_PAGE, filteredReports.length)} of {filteredReports.length}
                    </span>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {mounted && modalContent && createPortal(modalContent, document.body)}

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
              <button type="button" className="confirm-ok-btn" onClick={runConfirm}>Confirm</button>
            </div>
          </div>
        </div>, document.body
      )}
    </>
  );
}