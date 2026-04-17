"use client";

import "@/app/Admin/style/task.css";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

/* ── Types ── */
type ChecklistItem = { id: string; text: string; done: boolean; _id?: string; };
type Comment = { text: string; by: string; at: string; };

type Task = {
  _id: string;
  userId?: string;
  name: string;
  concernType?: string;
  reportId?: string;
  status?: string;
  assignedStaff?: string[];
  priority?: string;
  checklist?: ChecklistItem[];
  notes?: string;
  comments?: Comment[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

type StaffRecord = {
  _id: string;
  name: string;
  email: string;
  disciplines: string[];
  clerkId?: string;
  clerkUsername?: string;
  position?: string;
};

type MetaStatus   = { id: string; name: string; color: string; };
type MetaPriority = { id: string; name: string; color: string; };

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

const FALLBACK_STATUSES: MetaStatus[] = [
  { id: "1", name: "Pending",         color: "#FFA500" },
  { id: "2", name: "Pending Inspect", color: "#FFD700" },
  { id: "3", name: "In Progress",     color: "#4169E1" },
  { id: "4", name: "Resolved",        color: "#28A745" },
  { id: "5", name: "Archived",        color: "#6C757D" },
];
const FALLBACK_PRIORITIES: MetaPriority[] = [
  { id: "1", name: "Low",    color: "#28A745" },
  { id: "2", name: "Medium", color: "#FFC107" },
  { id: "3", name: "High",   color: "#ce4f01" },
  { id: "4", name: "Urgent", color: "#a40010" },
];

function getRelativeTime(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function calcProgress(checklist?: ChecklistItem[]) {
  if (!checklist || checklist.length === 0) return null;
  return Math.round((checklist.filter(i => i.done).length / checklist.length) * 100);
}

/* ══════════════════════════════════════════════════════════ */
export default function StaffTasksPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const [staffRecord,    setStaffRecord]    = useState<StaffRecord | null>(null);
  const [canView,        setCanView]        = useState(false);
  const [tasks,          setTasks]          = useState<Task[]>([]);
  const [isLoading,      setIsLoading]      = useState(false);
  const [loadError,      setLoadError]      = useState("");

  const [metaStatuses,   setMetaStatuses]   = useState<MetaStatus[]>(FALLBACK_STATUSES);
  const [metaPriorities, setMetaPriorities] = useState<MetaPriority[]>(FALLBACK_PRIORITIES);

  /* ── Filters ── */
  const [searchQuery,    setSearchQuery]    = useState("");
  const [statusFilter,   setStatusFilter]   = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [discFilter,     setDiscFilter]     = useState("All");
  const [viewMode,       setViewMode]       = useState<"board" | "list" | "analytics">("board");

  /* ── Task detail modal ── */
  const [selectedTask,   setSelectedTask]   = useState<Task | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [newNote,        setNewNote]        = useState("");
  const [newComment,     setNewComment]     = useState("");
  const [showNoteEdit,   setShowNoteEdit]   = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { toasts, show: showToast, dismiss: dismissToast } = useToast();

  useEscapeKey(useCallback(() => setSelectedTask(null), []), !!selectedTask);

  useEffect(() => {
    document.body.style.overflow = selectedTask ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedTask]);

  /* ── Auth ── */
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { router.replace("/"); return; }
    const rawRole = (user.publicMetadata as any)?.role;
    const role = Array.isArray(rawRole) ? String(rawRole[0]).toLowerCase()
               : typeof rawRole === "string" ? rawRole.toLowerCase() : "";
    if (role !== "staff") { router.replace("/"); return; }
    setCanView(true);
  }, [isLoaded, isSignedIn, user, router]);

  /* ── Fetch staff record ── */
  const fetchStaffRecord = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res  = await fetch(`${API_BASE}/api/staff/by-clerk/${user.id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.staff) setStaffRecord(data.staff);
    } catch {}
  }, [user?.id]);

  /* ── Fetch meta ── */
  const fetchMeta = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/meta?ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.statuses?.length   > 0) setMetaStatuses(data.statuses);
      if (data?.priorities?.length > 0) setMetaPriorities(data.priorities);
    } catch {}
  }, []);

  /* ── Fetch tasks ── */
  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true); setLoadError("");
      const res  = await fetch(`${API_BASE}/api/tasks?ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) { setLoadError(data?.message || "Could not load tasks."); setTasks([]); return; }
      const list: Task[] = Array.isArray(data) ? data
        : Array.isArray(data.tasks) ? data.tasks
        : Array.isArray(data.data)  ? data.data : [];
      setTasks(list);
    } catch { setLoadError("Network error."); setTasks([]); }
    finally   { setIsLoading(false); }
  }, []);

  useEffect(() => {
    if (!canView) return;
    fetchStaffRecord();
    fetchMeta();
    fetchTasks();
  }, [canView, fetchStaffRecord, fetchMeta, fetchTasks]);

  /* ── Color helpers ── */
  const getPriorityColor = useCallback((name?: string) =>
    metaPriorities.find(p => p.name === name)?.color || "#6C757D", [metaPriorities]);
  const getStatusColor = useCallback((name?: string) =>
    metaStatuses.find(s => s.name === name)?.color || "#6C757D", [metaStatuses]);

  /* ── My tasks (filtered by assignment + discipline) ── */
  const staffName        = staffRecord?.name || "";
  const staffDisciplines = staffRecord?.disciplines || [];

  const myTasks = useMemo(() => tasks.filter(t => {
    const isAssigned = (t.assignedStaff || []).some(
      s => s.toLowerCase() === staffName.toLowerCase()
    );
    if (!isAssigned) return false;
    if (staffDisciplines.length > 0 && t.concernType) {
      return staffDisciplines.some(d => d.toLowerCase() === t.concernType!.toLowerCase());
    }
    return true;
  }), [tasks, staffName, staffDisciplines]);

  /* ── Priority counts (from myTasks, not filtered) ── */
  const priorityCounts = useMemo(() => myTasks.reduce<Record<string, number>>((acc, t) => {
    const key = t.priority || "";
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [myTasks]);

  /* ── Filtered tasks ── */
  const filteredTasks = useMemo(() => myTasks.filter(t => {
    const matchSearch   = !searchQuery.trim() ||
      (t.name        || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.reportId    || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.concernType || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus   = statusFilter   === "All" || (t.status   || "Pending") === statusFilter;
    const matchPriority = priorityFilter === "All" || priorityFilter === "__none__"
      ? priorityFilter === "__none__" ? !(t.priority) : true
      : (t.priority || "") === priorityFilter;
    const matchDisc     = discFilter     === "All" || (t.concernType || "")     === discFilter;
    return matchSearch && matchStatus && matchPriority && matchDisc;
  }), [myTasks, searchQuery, statusFilter, priorityFilter, discFilter]);

  const hasActiveFilters = statusFilter !== "All" || priorityFilter !== "All" || discFilter !== "All" || !!searchQuery.trim();

  /* ── Board columns ── */
  const boardColumns = metaStatuses
    .filter(s => s.name.toLowerCase() !== "archived")
    .map(s => ({ ...s, tasks: filteredTasks.filter(t => (t.status || "Pending") === s.name) }));

  const disciplineOptions = staffDisciplines;

  /* ── Open / close task ── */
  const openTask = (task: Task) => {
    setSelectedTask(task);
    setNewNote(task.notes || "");
    setNewComment("");
    setShowNoteEdit(false);
  };
  const closeTask = () => setSelectedTask(null);

  /* ── Update status ── */
  const updateStatus = async (task: Task, status: string) => {
    try {
      setSaving(true);
      const res  = await fetch(`${API_BASE}/api/tasks/${task._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, updatedBy: staffName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      const updated = data.task as Task;
      setTasks(p => p.map(t => t._id === updated._id ? updated : t));
      setSelectedTask(updated);
      showToast(`Status updated to "${status}".`, "success");
    } catch (err: any) { showToast(err.message || "Failed.", "error"); }
    finally { setSaving(false); }
  };

  /* ── Save note ── */
  const saveNote = async () => {
    if (!selectedTask) return;
    try {
      setSaving(true);
      const res  = await fetch(`${API_BASE}/api/tasks/${selectedTask._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: newNote, updatedBy: staffName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      const updated = data.task as Task;
      setTasks(p => p.map(t => t._id === updated._id ? updated : t));
      setSelectedTask(updated);
      setShowNoteEdit(false);
      showToast("Note saved.", "success");
    } catch (err: any) { showToast(err.message || "Failed.", "error"); }
    finally { setSaving(false); }
  };

  /* ── Add comment ── */
  const addComment = async () => {
    if (!selectedTask || !newComment.trim()) return;
    try {
      setSaving(true);
      const comment: Comment = { text: newComment.trim(), by: staffName, at: new Date().toISOString() };
      const existing = selectedTask.comments || [];
      const res  = await fetch(`${API_BASE}/api/tasks/${selectedTask._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: [...existing, comment], updatedBy: staffName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      const updated = data.task as Task;
      setTasks(p => p.map(t => t._id === updated._id ? updated : t));
      setSelectedTask(updated);
      setNewComment("");
      showToast("Comment added.", "success");
    } catch (err: any) { showToast(err.message || "Failed.", "error"); }
    finally { setSaving(false); }
  };

  /* ── Toggle checklist ── */
  const toggleChecklist = async (task: Task, itemId: string) => {
    const updated = {
      ...task,
      checklist: (task.checklist || []).map(i =>
        (i.id === itemId || i._id === itemId) ? { ...i, done: !i.done } : i
      ),
    };
    try {
      const res  = await fetch(`${API_BASE}/api/tasks/${task._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updated.checklist, updatedBy: staffName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      const t = data.task as Task;
      setTasks(p => p.map(x => x._id === t._id ? t : x));
      if (selectedTask?._id === t._id) setSelectedTask(t);
    } catch { showToast("Failed to update checklist.", "error"); }
  };

  /* ── Analytics ── */
  const analytics = useMemo(() => {
    const total      = myTasks.length;
    const resolved   = myTasks.filter(t => (t.status || "").toLowerCase() === "resolved").length;
    const pending    = myTasks.filter(t => (t.status || "Pending").toLowerCase() === "pending").length;
    const inProgress = myTasks.filter(t => (t.status || "").toLowerCase() === "in progress").length;
    const rate       = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const byDisc: Record<string, number> = {};
    myTasks.forEach(t => { const d = t.concernType || "Other"; byDisc[d] = (byDisc[d] || 0) + 1; });
    const byPriority: Record<string, number> = {};
    myTasks.forEach(t => { const p = t.priority || "None"; byPriority[p] = (byPriority[p] || 0) + 1; });
    const avgProgress = myTasks.length > 0
      ? Math.round(myTasks.reduce((sum, t) => sum + (calcProgress(t.checklist) ?? 0), 0) / myTasks.length)
      : 0;
    return { total, resolved, pending, inProgress, rate, byDisc, byPriority, avgProgress };
  }, [myTasks]);

  /* ── Guards ── */
  if (!isLoaded || !canView) {
    return (
      <div className="tasks-wrapper">
        <div className="tasks-inner">
          <div className="tasks-shimmer-grid">
            {[...Array(6)].map((_, i) => <div key={i} className="tasks-shimmer-card" />)}
          </div>
        </div>
      </div>
    );
  }

  const priorityColor = getPriorityColor(selectedTask?.priority);
  const statusColor   = getStatusColor(selectedTask?.status);
  const progress      = calcProgress(selectedTask?.checklist);

  /* ══════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="tasks-wrapper">
        {/* ✅ Centered inner container */}
        <div className="tasks-inner">

          {/* ── Header ── */}
          <div className="tasks-page-header">
            <div>
              <h1 className="tasks-page-title">My Tasks</h1>
              <p className="tasks-page-subtitle">
                {staffRecord
                  ? `${staffName} · ${staffDisciplines.join(", ") || "No disciplines"}`
                  : "Loading your profile…"}
              </p>
            </div>
            <div className="tasks-header-actions">
              <button type="button"
                className={`tasks-view-btn${viewMode === "board" ? " tasks-view-btn--active" : ""}`}
                onClick={() => setViewMode("board")} title="Board view">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/>
                </svg>
              </button>
              <button type="button"
                className={`tasks-view-btn${viewMode === "list" ? " tasks-view-btn--active" : ""}`}
                onClick={() => setViewMode("list")} title="List view">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6"  x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6"  x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
              <button type="button"
                className={`tasks-view-btn${viewMode === "analytics" ? " tasks-view-btn--active" : ""}`}
                onClick={() => setViewMode("analytics")} title="Analytics">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6"  y1="20" x2="6"  y2="14"/>
                </svg>
              </button>
              <button type="button" className="tasks-refresh-btn" onClick={fetchTasks} disabled={isLoading} title="Refresh">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div className="tasks-stats-bar">
            <div className="tasks-stat">
              <div className="tasks-stat-icon" style={{ background: "rgba(37,99,235,0.1)", color: "#2563eb" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/>
                </svg>
              </div>
              <div className="tasks-stat-info">
                <span className="tasks-stat-num">{myTasks.length}</span>
                <span className="tasks-stat-lbl">My Tasks</span>
              </div>
            </div>
            {metaStatuses.filter(s => s.name.toLowerCase() !== "archived").map(s => (
              <div key={s.id} className="tasks-stat">
                <div className="tasks-stat-icon" style={{ background: s.color + "18", color: s.color }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                  </svg>
                </div>
                <div className="tasks-stat-info">
                  <span className="tasks-stat-num" style={{ color: s.color }}>
                    {myTasks.filter(t => (t.status || "Pending") === s.name).length}
                  </span>
                  <span className="tasks-stat-lbl">{s.name}</span>
                </div>
              </div>
            ))}
            {/* Completion rate stat */}
            <div className="tasks-stat">
              <div className="tasks-stat-icon" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="tasks-stat-info">
                <span className="tasks-stat-num" style={{ color: "#22c55e" }}>{analytics.rate}%</span>
                <span className="tasks-stat-lbl">Resolved</span>
              </div>
            </div>
          </div>

          {/* ── Priority filter chips ── */}
          <div className="tasks-priority-bar">
            {/* All chip */}
            <button
              type="button"
              className={`tasks-priority-chip${priorityFilter === "All" ? " tasks-priority-chip--all-active" : ""}`}
              style={{ "--chip-color": "#2563eb" } as React.CSSProperties}
              onClick={() => setPriorityFilter("All")}
            >
              All Tasks
              <span className="tasks-priority-chip-count">{myTasks.length}</span>
            </button>

            {/* Per-priority chips */}
            {metaPriorities.map(p => {
              const count    = priorityCounts[p.name] || 0;
              const isActive = priorityFilter === p.name;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`tasks-priority-chip${isActive ? " tasks-priority-chip--active" : ""}`}
                  style={{ "--chip-color": p.color } as React.CSSProperties}
                  onClick={() => setPriorityFilter(isActive ? "All" : p.name)}
                >
                  <span className="tasks-priority-chip-dot" style={{ backgroundColor: p.color }} />
                  {p.name}
                  <span className="tasks-priority-chip-count">{count}</span>
                </button>
              );
            })}

            {/* "No priority" chip */}
            {(() => {
              const noneCount = myTasks.filter(t => !t.priority).length;
              const isActive  = priorityFilter === "__none__";
              return noneCount > 0 ? (
                <button
                  type="button"
                  className={`tasks-priority-chip${isActive ? " tasks-priority-chip--active" : ""}`}
                  style={{ "--chip-color": "#6b7280" } as React.CSSProperties}
                  onClick={() => setPriorityFilter(isActive ? "All" : "__none__")}
                >
                  <span className="tasks-priority-chip-dot" style={{ backgroundColor: "#6b7280" }} />
                  No Priority
                  <span className="tasks-priority-chip-count">{noneCount}</span>
                </button>
              ) : null;
            })()}
          </div>

          {/* ── Filters row ── */}
          <div className="tasks-filters">
            <div className="tasks-search-wrap">
              <svg viewBox="0 0 24 24" className="tasks-search-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" className="tasks-search" placeholder="Search tasks…"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              {searchQuery && (
                <button type="button" className="tasks-search-clear" onClick={() => setSearchQuery("")}>✕</button>
              )}
            </div>

            <div className="tasks-filters-divider" />

            <select className="tasks-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              {metaStatuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>

            <select
              className="tasks-filter-select"
              value={priorityFilter === "__none__" ? "__none__" : priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
            >
              <option value="All">All Priorities</option>
              {metaPriorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              <option value="__none__">No Priority</option>
            </select>

            {disciplineOptions.length > 1 && (
              <select className="tasks-filter-select" value={discFilter} onChange={e => setDiscFilter(e.target.value)}>
                <option value="All">All Disciplines</option>
                {disciplineOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}

            {hasActiveFilters && (
              <button type="button" className="tasks-clear-filters"
                onClick={() => { setStatusFilter("All"); setPriorityFilter("All"); setDiscFilter("All"); setSearchQuery(""); }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Clear
              </button>
            )}
          </div>

          {loadError && (
            <div className="tasks-error-banner">
              {loadError} <button type="button" onClick={fetchTasks}>Retry</button>
            </div>
          )}

          {isLoading && (
            <div className="tasks-shimmer-grid">
              {[...Array(6)].map((_, i) => <div key={i} className="tasks-shimmer-card" />)}
            </div>
          )}

          {/* ── Empty state ── */}
          {!isLoading && filteredTasks.length === 0 && !loadError && viewMode !== "analytics" && (
            <div className="tasks-empty">
              <div className="tasks-empty-icon">
                <svg viewBox="0 0 64 64" fill="none" width="28" height="28">
                  <rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M22 32h20M32 22v20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p>{hasActiveFilters ? "No tasks match your filters." : "No tasks assigned to you."}</p>
              <span>
                {hasActiveFilters
                  ? "Try adjusting your filters above."
                  : "Tasks assigned to you matching your disciplines will appear here."}
              </span>
            </div>
          )}

          {/* ══ ANALYTICS VIEW ══ */}
          {viewMode === "analytics" && (
            <div style={{ paddingTop: 8 }}>
              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
                {[
                  { label: "Total Tasks",     value: analytics.total,             color: "#4169E1" },
                  { label: "Resolved",        value: analytics.resolved,          color: "#28A745" },
                  { label: "In Progress",     value: analytics.inProgress,        color: "#4169E1" },
                  { label: "Pending",         value: analytics.pending,           color: "#FFA500" },
                  { label: "Completion Rate", value: `${analytics.rate}%`,        color: "#22c55e" },
                  { label: "Avg. Progress",   value: `${analytics.avgProgress}%`, color: "#8b5cf6" },
                ].map(card => (
                  <div key={card.label} style={{
                    background: "var(--tasks-surface)", borderRadius: 12, padding: "18px 16px",
                    boxShadow: "var(--tasks-shadow-sm)", textAlign: "center",
                    borderTop: `3px solid ${card.color}`,
                    border: "1px solid var(--tasks-border)",
                  }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: card.color }}>{card.value}</div>
                    <div style={{ fontSize: 12, color: "var(--tasks-text-3)", marginTop: 4 }}>{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Priority breakdown */}
              <div style={{
                background: "var(--tasks-surface)", borderRadius: 12, padding: 20,
                boxShadow: "var(--tasks-shadow-sm)", marginBottom: 14,
                border: "1px solid var(--tasks-border)",
              }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: "var(--tasks-text-1)" }}>Tasks by Priority</div>
                {Object.keys(analytics.byPriority).length === 0 && (
                  <p style={{ color: "var(--tasks-text-4)", fontSize: 13 }}>No data yet.</p>
                )}
                {metaPriorities.map(p => {
                  const count = analytics.byPriority[p.name] || 0;
                  const pct   = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                  return (
                    <div key={p.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                        <span style={{ color: p.color, fontWeight: 600 }}>{p.name}</span>
                        <span style={{ fontWeight: 600, color: "var(--tasks-text-2)" }}>{count} <span style={{ color: "var(--tasks-text-4)", fontWeight: 400 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: 7, background: "var(--tasks-border)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: p.color, borderRadius: 999, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Completion rate */}
              <div style={{
                background: "var(--tasks-surface)", borderRadius: 12, padding: 20,
                boxShadow: "var(--tasks-shadow-sm)", marginBottom: 14,
                border: "1px solid var(--tasks-border)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--tasks-text-1)" }}>Overall Completion Rate</span>
                  <span style={{ fontWeight: 700, color: "#22c55e" }}>{analytics.rate}%</span>
                </div>
                <div style={{ height: 10, background: "var(--tasks-border)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${analytics.rate}%`, background: "#22c55e", borderRadius: 999, transition: "width 0.5s" }} />
                </div>
              </div>

              {/* Tasks by discipline */}
              <div style={{
                background: "var(--tasks-surface)", borderRadius: 12, padding: 20,
                boxShadow: "var(--tasks-shadow-sm)", marginBottom: 14,
                border: "1px solid var(--tasks-border)",
              }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: "var(--tasks-text-1)" }}>Tasks by Discipline</div>
                {Object.entries(analytics.byDisc).length === 0 && (
                  <p style={{ color: "var(--tasks-text-4)", fontSize: 13 }}>No data yet.</p>
                )}
                {Object.entries(analytics.byDisc).map(([disc, count]) => (
                  <div key={disc} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                      <span style={{ color: "var(--tasks-text-2)" }}>{disc}</span>
                      <span style={{ fontWeight: 600, color: "var(--tasks-text-2)" }}>{count}</span>
                    </div>
                    <div style={{ height: 7, background: "var(--tasks-border)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0}%`, background: "#4169E1", borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Status breakdown */}
              <div style={{
                background: "var(--tasks-surface)", borderRadius: 12, padding: 20,
                boxShadow: "var(--tasks-shadow-sm)",
                border: "1px solid var(--tasks-border)",
              }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: "var(--tasks-text-1)" }}>Status Breakdown</div>
                {metaStatuses.filter(s => s.name.toLowerCase() !== "archived").map(s => {
                  const count = myTasks.filter(t => (t.status || "Pending") === s.name).length;
                  const pct   = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                  return (
                    <div key={s.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                        <span style={{ color: s.color, fontWeight: 600 }}>{s.name}</span>
                        <span style={{ fontWeight: 600, color: "var(--tasks-text-2)" }}>{count} <span style={{ color: "var(--tasks-text-4)", fontWeight: 400 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: 7, background: "var(--tasks-border)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: s.color, borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ BOARD VIEW ══ */}
          {!isLoading && filteredTasks.length > 0 && viewMode === "board" && (
            <div className="tasks-board">
              {boardColumns.map(col => (
                <div key={col.id} className="tasks-board-col">
                  <div className="tasks-board-col-header">
                    <span className="tasks-board-col-dot" style={{ backgroundColor: col.color }} />
                    <span className="tasks-board-col-name">{col.name}</span>
                    <span className="tasks-board-col-count">{col.tasks.length}</span>
                  </div>
                  <div className="tasks-board-col-body">
                    {col.tasks.length === 0 && <div className="tasks-board-empty">No tasks here</div>}
                    {col.tasks.map(task => {
                      const prog   = calcProgress(task.checklist);
                      const pColor = getPriorityColor(task.priority);
                      return (
                        <div key={task._id} className="tasks-card" onClick={() => openTask(task)}>
                          <div className="tasks-card-stripe" style={{ backgroundColor: pColor }} />
                          <div className="tasks-card-body">
                            <div className="tasks-card-top">
                              <h4 className="tasks-card-name">{task.name}</h4>
                              {task.priority && (
                                <span className="tasks-card-priority" style={{ color: pColor, backgroundColor: pColor + "18", border: `1px solid ${pColor}40` }}>
                                  {task.priority}
                                </span>
                              )}
                            </div>
                            {task.reportId && (
                              <p className="tasks-card-report-id">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                </svg>
                                #{task.reportId}
                              </p>
                            )}
                            {task.concernType && <p className="tasks-card-concern">{task.concernType}</p>}
                            {prog !== null && (
                              <div className="tasks-card-progress">
                                <div className="tasks-card-progress-bar">
                                  <div className="tasks-card-progress-fill" style={{ width: `${prog}%`, backgroundColor: prog === 100 ? "#22c55e" : pColor }} />
                                </div>
                                <span className="tasks-card-progress-pct">{prog}%</span>
                              </div>
                            )}
                            <div className="tasks-card-footer">
                              <span className="tasks-card-time">{getRelativeTime(task.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ LIST VIEW ══ */}
          {!isLoading && filteredTasks.length > 0 && viewMode === "list" && (
            <div className="tasks-list-view">
              <div className="tasks-list-header-row">
                <span>Task</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Progress</span>
                <span>Discipline</span>
                <span>Created</span>
              </div>
              {filteredTasks.map(task => {
                const prog   = calcProgress(task.checklist);
                const pColor = getPriorityColor(task.priority);
                const sColor = getStatusColor(task.status);
                return (
                  <div key={task._id} className="tasks-list-row" onClick={() => openTask(task)}>
                    <div className="tasks-list-name-cell">
                      <span className="tasks-list-stripe" style={{ backgroundColor: pColor }} />
                      <div>
                        <p className="tasks-list-name">{task.name}</p>
                        {task.reportId && <p className="tasks-list-sub">#{task.reportId} · {task.concernType || ""}</p>}
                      </div>
                    </div>
                    <span>
                      <span className="tasks-status-pill" style={{ backgroundColor: sColor + "20", color: sColor, border: `1px solid ${sColor}40` }}>
                        {task.status || "Pending"}
                      </span>
                    </span>
                    <span>
                      {task.priority
                        ? <span className="tasks-status-pill" style={{ backgroundColor: pColor + "20", color: pColor, border: `1px solid ${pColor}40` }}>{task.priority}</span>
                        : <span className="tasks-list-na">—</span>}
                    </span>
                    <span>
                      {prog !== null ? (
                        <div className="tasks-list-progress">
                          <div className="tasks-list-progress-bar">
                            <div className="tasks-list-progress-fill" style={{ width: `${prog}%`, backgroundColor: prog === 100 ? "#22c55e" : pColor }} />
                          </div>
                          <span className="tasks-list-progress-pct">{prog}%</span>
                        </div>
                      ) : <span className="tasks-list-na">—</span>}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "var(--tasks-text-3)" }}>{task.concernType || "—"}</span>
                    <span className="tasks-list-time">{getRelativeTime(task.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}

        </div>{/* end .tasks-inner */}
      </div>

      {/* ══ TASK DETAIL MODAL ══ */}
      {mounted && selectedTask && createPortal(
        <div className="tasks-modal-backdrop" onClick={closeTask} role="dialog" aria-modal="true">
          <div className="tasks-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>

            {/* Header */}
            <div className="tasks-modal-header" style={{ borderTop: `4px solid ${priorityColor}` }}>
              <div className="tasks-modal-header-left">
                <h2 className="tasks-modal-title">{selectedTask.name}</h2>
                {selectedTask.reportId && (
                  <span className="tasks-modal-report-badge">#{selectedTask.reportId}</span>
                )}
              </div>
              <button type="button" className="tasks-modal-close" onClick={closeTask}>✕</button>
            </div>

            {/* Body */}
            <div className="tasks-modal-body">

              {/* LEFT */}
              <div className="tasks-modal-left">

                {/* Status / priority pills */}
                <div className="tasks-modal-meta-row">
                  <span className="tasks-meta-pill" style={{ backgroundColor: statusColor + "20", color: statusColor, border: `1px solid ${statusColor}40` }}>
                    {selectedTask.status || "Pending"}
                  </span>
                  {selectedTask.priority && (
                    <span className="tasks-meta-pill" style={{ backgroundColor: priorityColor + "20", color: priorityColor, border: `1px solid ${priorityColor}40` }}>
                      {selectedTask.priority}
                    </span>
                  )}
                  {selectedTask.concernType && (
                    <span className="tasks-meta-pill tasks-meta-pill--neutral">{selectedTask.concernType}</span>
                  )}
                </div>

                {/* Update status */}
                <div className="tasks-modal-section">
                  <span className="tasks-modal-label">Update Status</span>
                  <div className="tasks-modal-status-grid" style={{ marginTop: 8 }}>
                    {metaStatuses
                      .filter(s => s.name.toLowerCase() !== "archived" && s.name !== (selectedTask.status || "Pending"))
                      .map(s => (
                        <button key={s.id} type="button"
                          className="tasks-modal-status-btn"
                          style={{ borderColor: s.color + "60", color: s.color, backgroundColor: s.color + "10" }}
                          disabled={saving}
                          onClick={() => updateStatus(selectedTask, s.name)}>
                          → {s.name}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Progress */}
                {progress !== null && (
                  <div className="tasks-modal-progress-section">
                    <div className="tasks-modal-progress-header">
                      <span className="tasks-modal-label">Checklist Progress</span>
                      <span className="tasks-modal-progress-pct" style={{ color: progress === 100 ? "#22c55e" : priorityColor }}>
                        {progress}%
                      </span>
                    </div>
                    <div className="tasks-modal-progress-bar">
                      <div className="tasks-modal-progress-fill"
                        style={{ width: `${progress}%`, backgroundColor: progress === 100 ? "#22c55e" : priorityColor }} />
                    </div>
                  </div>
                )}

                {/* Checklist */}
                <div className="tasks-modal-section">
                  <span className="tasks-modal-label">
                    Checklist
                    {(selectedTask.checklist?.length || 0) > 0 && (
                      <span className="tasks-modal-checklist-count">
                        {(selectedTask.checklist || []).filter(i => i.done).length}/{selectedTask.checklist?.length}
                      </span>
                    )}
                  </span>
                  <div className="tasks-modal-checklist">
                    {(selectedTask.checklist || []).length === 0 && (
                      <p className="tasks-modal-empty-hint">No checklist items.</p>
                    )}
                    {(selectedTask.checklist || []).map(item => {
                      const itemId = item.id || item._id || "";
                      return (
                        <div key={itemId} className="tasks-modal-check-item">
                          <button type="button"
                            className={`tasks-check-btn${item.done ? " tasks-check-btn--done" : ""}`}
                            style={item.done ? { backgroundColor: priorityColor, borderColor: priorityColor } : {}}
                            onClick={() => toggleChecklist(selectedTask, itemId)}>
                            {item.done && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </button>
                          <span className={`tasks-check-text${item.done ? " tasks-check-text--done" : ""}`}>{item.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div className="tasks-modal-section">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="tasks-modal-label">Notes</span>
                    <button type="button"
                      style={{ fontSize: "0.75rem", color: "var(--tasks-accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                      onClick={() => { setShowNoteEdit(!showNoteEdit); setNewNote(selectedTask.notes || ""); }}>
                      {showNoteEdit ? "Cancel" : "Edit"}
                    </button>
                  </div>
                  {showNoteEdit ? (
                    <>
                      <textarea className="tasks-modal-input tasks-modal-textarea" rows={3}
                        style={{ marginTop: 8 }}
                        value={newNote}
                        placeholder="Add notes about this task…"
                        onChange={e => setNewNote(e.target.value)} />
                      <button type="button" className="tasks-modal-save-btn"
                        style={{ backgroundColor: priorityColor, marginTop: 8 }}
                        onClick={saveNote} disabled={saving}>
                        {saving ? "Saving…" : "Save Note"}
                      </button>
                    </>
                  ) : (
                    <p className="tasks-modal-notes" style={{ marginTop: 6 }}>
                      {selectedTask.notes || <span className="tasks-modal-empty-hint">No notes yet. Click Edit to add one.</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* RIGHT */}
              <div className="tasks-modal-right">

                {/* Task info */}
                <div className="tasks-modal-section tasks-modal-info-box">
                  <span className="tasks-modal-label">Task Info</span>
                  <div className="tasks-modal-info-grid">
                    <span className="tasks-info-key">Created by</span>
                    <span className="tasks-info-val">{selectedTask.createdBy || "Admin"}</span>
                    <span className="tasks-info-key">Created</span>
                    <span className="tasks-info-val">{selectedTask.createdAt ? new Date(selectedTask.createdAt).toLocaleString() : "—"}</span>
                    <span className="tasks-info-key">Updated</span>
                    <span className="tasks-info-val">{selectedTask.updatedAt ? new Date(selectedTask.updatedAt).toLocaleString() : "—"}</span>
                    {selectedTask.reportId && <>
                      <span className="tasks-info-key">Report</span>
                      <span className="tasks-info-val">#{selectedTask.reportId}</span>
                    </>}
                    <span className="tasks-info-key">Discipline</span>
                    <span className="tasks-info-val">{selectedTask.concernType || "—"}</span>
                  </div>
                </div>

                {/* Comments */}
                <div className="tasks-modal-section">
                  <span className="tasks-modal-label">
                    Comments
                    {(selectedTask.comments?.length || 0) > 0 && (
                      <span className="tasks-modal-checklist-count">{selectedTask.comments!.length}</span>
                    )}
                  </span>

                  <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    {(selectedTask.comments || []).length === 0 && (
                      <p className="tasks-modal-empty-hint">No comments yet.</p>
                    )}
                    {(selectedTask.comments || []).map((c, idx) => (
                      <div key={idx} className="tasks-modal-info-box" style={{ padding: "10px 12px" }}>
                        <p style={{ margin: "0 0 4px", fontSize: "0.82rem", color: "var(--tasks-text-1)" }}>{c.text}</p>
                        <div style={{ color: "var(--tasks-text-4)", fontSize: "0.68rem" }}>
                          by {c.by} · {getRelativeTime(c.at)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <textarea className="tasks-modal-input tasks-modal-textarea" rows={2}
                      value={newComment}
                      placeholder="Add a comment…"
                      onChange={e => setNewComment(e.target.value)}
                    />
                    <button type="button" className="tasks-modal-save-btn"
                      style={{ backgroundColor: priorityColor }}
                      onClick={addComment}
                      disabled={saving || !newComment.trim()}>
                      {saving ? "Adding…" : "Add Comment"}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toasts */}
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
    </>
  );
}