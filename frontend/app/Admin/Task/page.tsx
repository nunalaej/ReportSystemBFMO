"use client";

import "../style/task.css";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";
import { useNotifications } from "@/app/context/notification";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

/* ── Types ── */
type ChecklistItem = { id: string; text: string; done: boolean; _id?: string; };

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
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

type MetaStatus   = { id: string; name: string; color: string; };
type MetaPriority = { id: string; name: string; color: string; notifyInterval?: string; };

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

/* ── Debounce hook — fires `value` only after `delay` ms of silence ── */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ── Fallbacks ── */
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

/* ── Helpers ── */
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

let _uidCounter = 0;
function uid() {
  return `${Date.now()}-${++_uidCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ══════════════════════════════════════════════════════════ */
export default function TasksPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const [canView,        setCanView]        = useState(false);
  const [tasks,          setTasks]          = useState<Task[]>([]);
  const [isLoading,      setIsLoading]      = useState(false);
  const [loadError,      setLoadError]      = useState("");

  /* ── Meta ── */
  const [metaStatuses,   setMetaStatuses]   = useState<MetaStatus[]>(FALLBACK_STATUSES);
  const [metaPriorities, setMetaPriorities] = useState<MetaPriority[]>(FALLBACK_PRIORITIES);
  const [metaStaff,      setMetaStaff]      = useState<string[]>([]);

  /* ── Raw search input (updates instantly for responsive UI) ── */
  const [searchInput,    setSearchInput]    = useState("");
  /* ── Debounced search query (used for actual filtering, 200 ms delay) ── */
  const searchQuery = useDebounce(searchInput, 200);
  /* Track whether user is actively typing (show spinner) */
  const isTyping = searchInput !== searchQuery;

  /* ── Filters ── */
  const [statusFilter,      setStatusFilter]      = useState("All");
  const [priorityFilter,    setPriorityFilter]    = useState("All");
  const [disciplineFilter,  setDisciplineFilter]  = useState("All");
  const [staffFilter,       setStaffFilter]       = useState("All");
  const [viewMode,          setViewMode]          = useState<"board" | "list">("board");

  /* ── Selected task (detail modal) ── */
  const [selectedTask,   setSelectedTask]   = useState<Task | null>(null);
  const [editDraft,      setEditDraft]      = useState<Task | null>(null);
  const [isEditing,      setIsEditing]      = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [checkInput,     setCheckInput]     = useState("");
  const [staffInput,     setStaffInput]     = useState("");

  const { addNotification } = useNotifications();

  /* ── Confirm dialog ── */
  const confirmCallbackRef = React.useRef<(() => void | Promise<void>) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; message: string; }>({ open: false, message: "" });

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { toasts, show: showToast, dismiss: dismissToast } = useToast();

  useEffect(() => {
    document.body.style.overflow = selectedTask ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedTask]);

  const escapeHandler = useCallback(() => {
    if (isEditing) { setIsEditing(false); setEditDraft(null); return; }
    setSelectedTask(null);
  }, [isEditing]);
  useEscapeKey(escapeHandler, !!selectedTask);

  /* ── Auth ── */
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

  /* ── Fetch tasks ── */
  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true); setLoadError("");
      const res  = await fetch(`${API_BASE}/api/tasks?userId=${user?.id || "admin"}&ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) { setLoadError(data?.message || "Could not load tasks."); setTasks([]); return; }
      const list: Task[] = Array.isArray(data) ? data
        : Array.isArray(data.tasks) ? data.tasks
        : Array.isArray(data.data)  ? data.data
        : [];
      setTasks(list);
    } catch {
      setLoadError("Network error while loading tasks.");
      setTasks([]);
    } finally { setIsLoading(false); }
  }, [user?.id]);

  /* ── Fetch meta ── */
  const fetchMeta = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/meta?ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.statuses?.length   > 0) setMetaStatuses(data.statuses);
      if (data?.priorities?.length > 0) setMetaPriorities(data.priorities);
    } catch {}
    try {
      const res  = await fetch(`${API_BASE}/api/staff`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      const list: string[] = Array.isArray(data)
        ? data.map((s: any) => String(s?.name || s?.email || s || "")).filter(Boolean)
        : Array.isArray(data?.staff)
        ? data.staff.map((s: any) => String(s?.name || s?.email || s || "")).filter(Boolean)
        : [];
      if (list.length > 0) setMetaStaff(list);
    } catch {}
  }, []);

  useEffect(() => {
    if (!canView) return;
    fetchTasks();
    fetchMeta();
  }, [canView, fetchTasks, fetchMeta]);

  /* ── Color helpers ── */
  const getPriorityColor = useCallback((name?: string) => {
    if (!name) return "#6C757D";
    return metaPriorities.find(p => p.name === name)?.color || "#6C757D";
  }, [metaPriorities]);

  const getStatusColor = useCallback((name?: string) => {
    if (!name) return "#6C757D";
    return metaStatuses.find(s => s.name === name)?.color || "#6C757D";
  }, [metaStatuses]);

  /* ── Derived filter options (computed from actual task data) ── */
  const disciplineOptions = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => { if (t.concernType) set.add(t.concernType); });
    return Array.from(set).sort();
  }, [tasks]);

  const staffOptions = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => (t.assignedStaff || []).forEach(s => set.add(s)));
    // also include meta staff so even unassigned staff appear
    metaStaff.forEach(s => set.add(s));
    return Array.from(set).sort();
  }, [tasks, metaStaff]);

  /* ── Priority counts (from ALL tasks, not filtered) ── */
  const priorityCounts = useMemo(() => tasks.reduce<Record<string, number>>((acc, t) => {
    const key = t.priority || "";
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [tasks]);

  /* ── Filtered tasks ── */
  const filteredTasks = useMemo(() => tasks.filter(t => {
    // Debounced search — checks name, reportId, concernType, createdBy, AND assigned staff names
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q ||
      (t.name        || "").toLowerCase().includes(q) ||
      (t.reportId    || "").toLowerCase().includes(q) ||
      (t.concernType || "").toLowerCase().includes(q) ||
      (t.createdBy   || "").toLowerCase().includes(q) ||
      (t.assignedStaff || []).some(s => s.toLowerCase().includes(q));

    const matchStatus     = statusFilter     === "All" || (t.status   || "Pending") === statusFilter;
    const matchPriority   = priorityFilter   === "All"
      ? true
      : priorityFilter === "__none__"
      ? !(t.priority)
      : (t.priority || "") === priorityFilter;
    const matchDiscipline = disciplineFilter === "All" || (t.concernType || "") === disciplineFilter;
    const matchStaff      = staffFilter      === "All" ||
      (t.assignedStaff || []).some(s => s === staffFilter);

    return matchSearch && matchStatus && matchPriority && matchDiscipline && matchStaff;
  }), [tasks, searchQuery, statusFilter, priorityFilter, disciplineFilter, staffFilter]);

  const hasActiveFilters =
    statusFilter !== "All" || priorityFilter !== "All" ||
    disciplineFilter !== "All" || staffFilter !== "All" ||
    !!searchInput.trim();

  const clearAllFilters = () => {
    setSearchInput("");
    setStatusFilter("All");
    setPriorityFilter("All");
    setDisciplineFilter("All");
    setStaffFilter("All");
  };

  /* ── Board columns ── */
  const boardColumns = metaStatuses
    .filter(s => s.name.toLowerCase() !== "archived")
    .map(s => ({
      ...s,
      tasks: filteredTasks.filter(t => (t.status || "Pending") === s.name),
    }));

  /* ── Task detail ── */
  const openTask = (task: Task) => {
    setSelectedTask(task);
    setIsEditing(false);
    setEditDraft(null);
    setCheckInput("");
    setStaffInput("");
  };
  const closeTask = () => { setSelectedTask(null); setIsEditing(false); setEditDraft(null); };

  /* ── Edit ── */
  const startEdit = () => {
    if (!selectedTask) return;
    setEditDraft({
      ...selectedTask,
      checklist:     (selectedTask.checklist     || []).map(i => ({ ...i })),
      assignedStaff: [...(selectedTask.assignedStaff || [])],
    });
    setIsEditing(true);
  };
  const cancelEdit = () => { setIsEditing(false); setEditDraft(null); };

  const saveEdit = async () => {
    if (!editDraft || !selectedTask) return;
    try {
      setSaving(true);
      const res  = await fetch(`${API_BASE}/api/tasks/${selectedTask._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editDraft, updatedBy: user?.fullName || "Admin" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to save task");
      const updated = data.task as Task;
      setTasks(p => p.map(t => t._id === updated._id ? updated : t));
      setSelectedTask(updated);
      setIsEditing(false); setEditDraft(null);
      showToast("Task updated successfully.", "success");
    } catch (err: any) { showToast(err.message || "Failed to save.", "error"); }
    finally { setSaving(false); }
  };

  /* ── Status update from board ── */
  const updateTaskStatus = async (task: Task, newStatus: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${task._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, updatedBy: user?.fullName || "Admin" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to update status");
      const updated = data.task as Task;
      setTasks(p => p.map(t => t._id === updated._id ? updated : t));
      if (selectedTask?._id === updated._id) setSelectedTask(updated);
      addNotification(`Status of "${task.name}" changed to "${newStatus}".`, "status");
      showToast(`Status moved to "${newStatus}".`, "success");
    } catch (err: any) { showToast(err.message || "Failed.", "error"); }
  };

  /* ── Toggle checklist item ── */
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
        body: JSON.stringify({ checklist: updated.checklist, updatedBy: user?.fullName || "Admin" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      const t = data.task as Task;
      setTasks(p => p.map(x => x._id === t._id ? t : x));
      if (selectedTask?._id === t._id) setSelectedTask(t);
    } catch { showToast("Failed to update checklist.", "error"); }
  };

  /* ── Delete task ── */
  const deleteTask = (task: Task) => {
    confirmCallbackRef.current = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tasks/${task._id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        setTasks(p => p.filter(t => t._id !== task._id));
        if (selectedTask?._id === task._id) closeTask();
        showToast("Task deleted.", "success");
      } catch { showToast("Failed to delete task.", "error"); }
    };
    setConfirmDialog({ open: true, message: `Delete task "${task.name}"? This cannot be undone.` });
  };

  const closeConfirm = () => setConfirmDialog(d => ({ ...d, open: false }));
  const runConfirm = async () => {
    closeConfirm();
    const action = confirmCallbackRef.current;
    if (!action) return;
    confirmCallbackRef.current = null;
    try { await Promise.resolve(action()); }
    catch { showToast("Action failed.", "error"); }
  };

  /* ── Edit draft helpers ── */
  const editAddStaff = () => {
    if (!editDraft) return;
    const v = staffInput.trim();
    if (v && !(editDraft.assignedStaff || []).includes(v)) {
      setEditDraft(d => d ? { ...d, assignedStaff: [...(d.assignedStaff || []), v] } : d);
    }
    setStaffInput("");
  };
  const editRemoveStaff = (name: string) =>
    setEditDraft(d => d ? { ...d, assignedStaff: (d.assignedStaff || []).filter(s => s !== name) } : d);

  const editAddChecklist = () => {
    if (!editDraft) return;
    const v = checkInput.trim(); if (!v) return;
    const newItem: ChecklistItem = { id: uid(), text: v, done: false };
    setEditDraft(d => d ? { ...d, checklist: [...(d.checklist || []), newItem] } : d);
    setCheckInput("");
  };
  const editToggleChecklist = (id: string) =>
    setEditDraft(d => d ? { ...d, checklist: (d.checklist || []).map(i => (i.id === id || i._id === id) ? { ...i, done: !i.done } : i) } : d);
  const editRemoveChecklist = (id: string) =>
    setEditDraft(d => d ? { ...d, checklist: (d.checklist || []).filter(i => i.id !== id && i._id !== id) } : d);

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

  const activeTask    = isEditing ? editDraft : selectedTask;
  const progress      = calcProgress(activeTask?.checklist);
  const priorityColor = getPriorityColor(activeTask?.priority);
  const statusColor   = getStatusColor(activeTask?.status);

  /* ══════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="tasks-wrapper">
        <div className="tasks-inner">

          {/* ── Page header ── */}
          <div className="tasks-page-header">
            <div>
              <h1 className="tasks-page-title">Tasks &amp; Lists</h1>
              <p className="tasks-page-subtitle">
                Track all maintenance tasks created from facility reports.
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
                <span className="tasks-stat-num">{tasks.length}</span>
                <span className="tasks-stat-lbl">Total</span>
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
                    {tasks.filter(t => (t.status || "Pending") === s.name).length}
                  </span>
                  <span className="tasks-stat-lbl">{s.name}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Priority filter chips ── */}
          <div className="tasks-priority-bar">
            <button
              type="button"
              className={`tasks-priority-chip${priorityFilter === "All" ? " tasks-priority-chip--all-active" : ""}`}
              style={{ "--chip-color": "#2563eb" } as React.CSSProperties}
              onClick={() => setPriorityFilter("All")}
            >
              All Tasks
              <span className="tasks-priority-chip-count">{tasks.length}</span>
            </button>
            {metaPriorities.map(p => {
              const count    = priorityCounts[p.name] || 0;
              const isActive = priorityFilter === p.name;
              return (
                <button key={p.id} type="button"
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
            {(() => {
              const noneCount = tasks.filter(t => !t.priority).length;
              const isActive  = priorityFilter === "__none__";
              return noneCount > 0 ? (
                <button type="button"
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

            {/* Search with debounce indicator */}
            <div className="tasks-search-wrap">
              {isTyping ? (
                /* Spinning dots while debounce is pending */
                <span style={{
                  position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                  display: "flex", gap: 2, alignItems: "center",
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 4, height: 4, borderRadius: "50%",
                      backgroundColor: "var(--tasks-accent, #2563eb)",
                      animation: `tasks-bounce 0.8s ease-in-out ${i * 0.15}s infinite`,
                    }} />
                  ))}
                </span>
              ) : (
                <svg viewBox="0 0 24 24" className="tasks-search-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              )}
              <input
                type="text"
                className="tasks-search"
                placeholder="Search tasks, staff, report ID…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button type="button" className="tasks-search-clear" onClick={() => setSearchInput("")}>✕</button>
              )}
            </div>

            <div className="tasks-filters-divider" />

            {/* Status filter */}
            <select className="tasks-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              {metaStatuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>

            {/* Priority filter (synced with chips) */}
            <select
              className="tasks-filter-select"
              value={priorityFilter === "__none__" ? "__none__" : priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
            >
              <option value="All">All Priorities</option>
              {metaPriorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              <option value="__none__">No Priority</option>
            </select>

            {/* ✅ Discipline / concern-type filter */}
            {disciplineOptions.length > 0 && (
              <select className="tasks-filter-select" value={disciplineFilter} onChange={e => setDisciplineFilter(e.target.value)}>
                <option value="All">All Disciplines</option>
                {disciplineOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}

            {/* ✅ Staff filter */}
            {staffOptions.length > 0 && (
              <select className="tasks-filter-select" value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
                <option value="All">All Staff</option>
                {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}

            {hasActiveFilters && (
              <button type="button" className="tasks-clear-filters" onClick={clearAllFilters}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Clear
              </button>
            )}
          </div>

          {/* ── Active filter badges ── */}
          {(disciplineFilter !== "All" || staffFilter !== "All") && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {disciplineFilter !== "All" && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: "0.73rem", fontWeight: 600,
                  color: "#7c3aed", background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  borderRadius: 999, padding: "3px 10px",
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                  {disciplineFilter}
                  <button type="button" onClick={() => setDisciplineFilter("All")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
              {staffFilter !== "All" && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: "0.73rem", fontWeight: 600,
                  color: "#0369a1", background: "rgba(3,105,161,0.08)",
                  border: "1px solid rgba(3,105,161,0.25)",
                  borderRadius: 999, padding: "3px 10px",
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  {staffFilter}
                  <button type="button" onClick={() => setStaffFilter("All")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#0369a1", fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
            </div>
          )}

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

          {!isLoading && filteredTasks.length === 0 && !loadError && (
            <div className="tasks-empty">
              <div className="tasks-empty-icon">
                <svg viewBox="0 0 64 64" fill="none" width="28" height="28">
                  <rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M22 32h20M32 22v20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p>No tasks found.</p>
              <span>{hasActiveFilters ? "Try adjusting your filters." : "Tasks created from reports will appear here."}</span>
            </div>
          )}

          {/* ── BOARD VIEW ── */}
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
                            {task.assignedStaff && task.assignedStaff.length > 0 && (
                              <div className="tasks-card-staff">
                                {task.assignedStaff.slice(0, 3).map(s => (
                                  <span key={s} className="tasks-card-avatar" title={s}>{s.charAt(0).toUpperCase()}</span>
                                ))}
                                {task.assignedStaff.length > 3 && (
                                  <span className="tasks-card-avatar tasks-card-avatar--more">+{task.assignedStaff.length - 3}</span>
                                )}
                              </div>
                            )}
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
                              <div className="tasks-card-actions" onClick={e => e.stopPropagation()}>
                                {metaStatuses
                                  .filter(s => s.name !== col.name && s.name.toLowerCase() !== "archived")
                                  .slice(0, 2)
                                  .map(s => (
                                    <button key={s.id} type="button" className="tasks-card-move-btn"
                                      style={{ color: s.color, borderColor: s.color + "40" }}
                                      title={`Move to ${s.name}`}
                                      onClick={() => updateTaskStatus(task, s.name)}>
                                      → {s.name.split(" ")[0]}
                                    </button>
                                  ))}
                              </div>
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

          {/* ── LIST VIEW ── */}
          {!isLoading && filteredTasks.length > 0 && viewMode === "list" && (
            <div className="tasks-list-view">
              <div className="tasks-list-header-row">
                <span>Task</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Progress</span>
                <span>Staff</span>
                <span>Created</span>
                <span></span>
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
                    <span>
                      {task.assignedStaff && task.assignedStaff.length > 0 ? (
                        <div className="tasks-card-staff">
                          {task.assignedStaff.slice(0, 3).map(s => (
                            <span key={s} className="tasks-card-avatar" title={s}>{s.charAt(0).toUpperCase()}</span>
                          ))}
                          {task.assignedStaff.length > 3 && (
                            <span className="tasks-card-avatar tasks-card-avatar--more">+{task.assignedStaff.length - 3}</span>
                          )}
                        </div>
                      ) : <span className="tasks-list-na">—</span>}
                    </span>
                    <span className="tasks-list-time">{getRelativeTime(task.createdAt)}</span>
                    <span onClick={e => e.stopPropagation()}>
                      <button type="button" className="tasks-list-delete-btn" onClick={() => deleteTask(task)} title="Delete task">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

        </div>{/* end .tasks-inner */}
      </div>

      {/* ══════════════ TASK DETAIL MODAL ══════════════ */}
      {mounted && selectedTask && createPortal(
        <div className="tasks-modal-backdrop" onClick={closeTask} role="dialog" aria-modal="true">
          <div className="tasks-modal" onClick={e => e.stopPropagation()}>
            <div className="tasks-modal-header" style={{ borderTop: `4px solid ${priorityColor}` }}>
              <div className="tasks-modal-header-left">
                {isEditing ? (
                  <input type="text" className="tasks-modal-title-input"
                    value={editDraft?.name || ""}
                    onChange={e => setEditDraft(d => d ? { ...d, name: e.target.value } : d)} />
                ) : (
                  <h2 className="tasks-modal-title">{selectedTask.name}</h2>
                )}
                {selectedTask.reportId && (
                  <span className="tasks-modal-report-badge">#{selectedTask.reportId}</span>
                )}
              </div>
              <div className="tasks-modal-header-right">
                {!isEditing && (
                  <button type="button" className="tasks-modal-edit-btn" onClick={startEdit}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                  </button>
                )}
                {!isEditing && (
                  <button type="button" className="tasks-modal-delete-btn" onClick={() => deleteTask(selectedTask)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                )}
                <button type="button" className="tasks-modal-close" onClick={closeTask}>✕</button>
              </div>
            </div>

            <div className="tasks-modal-body">
              <div className="tasks-modal-left">
                <div className="tasks-modal-meta-row">
                  {isEditing ? (
                    <>
                      <div className="tasks-modal-field">
                        <label className="tasks-modal-label">Status</label>
                        <select className="tasks-modal-select"
                          value={editDraft?.status || "Pending"}
                          onChange={e => setEditDraft(d => d ? { ...d, status: e.target.value } : d)}>
                          {metaStatuses.filter(s => s.name.toLowerCase() !== "archived").map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="tasks-modal-field">
                        <label className="tasks-modal-label">Priority</label>
                        <select className="tasks-modal-select"
                          value={editDraft?.priority || ""}
                          onChange={e => setEditDraft(d => d ? { ...d, priority: e.target.value } : d)}>
                          <option value="">None</option>
                          {metaPriorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                {isEditing && (
                  <div className="tasks-modal-field">
                    <label className="tasks-modal-label">Concern Type</label>
                    <select className="tasks-modal-select"
                      value={editDraft?.concernType || "Other"}
                      onChange={e => setEditDraft(d => d ? { ...d, concernType: e.target.value } : d)}>
                      {["Mechanical","Civil","Electrical","Safety Hazard","Other"].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}

                {progress !== null && (
                  <div className="tasks-modal-progress-section">
                    <div className="tasks-modal-progress-header">
                      <span className="tasks-modal-label">Progress</span>
                      <span className="tasks-modal-progress-pct" style={{ color: progress === 100 ? "#22c55e" : priorityColor }}>{progress}%</span>
                    </div>
                    <div className="tasks-modal-progress-bar">
                      <div className="tasks-modal-progress-fill" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? "#22c55e" : priorityColor }} />
                    </div>
                  </div>
                )}

                <div className="tasks-modal-section">
                  <div className="tasks-modal-section-header">
                    <span className="tasks-modal-label">
                      Checklist
                      {(activeTask?.checklist?.length || 0) > 0 && (
                        <span className="tasks-modal-checklist-count">
                          {(activeTask?.checklist || []).filter(i => i.done).length}/{activeTask?.checklist?.length}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="tasks-modal-checklist">
                    {(activeTask?.checklist || []).length === 0 && <p className="tasks-modal-empty-hint">No checklist items yet.</p>}
                    {(activeTask?.checklist || []).map(item => {
                      const itemId = item.id || item._id || "";
                      return (
                        <div key={itemId} className="tasks-modal-check-item">
                          <button type="button"
                            className={`tasks-check-btn${item.done ? " tasks-check-btn--done" : ""}`}
                            style={item.done ? { backgroundColor: priorityColor, borderColor: priorityColor } : {}}
                            onClick={() => isEditing ? editToggleChecklist(itemId) : toggleChecklist(selectedTask, itemId)}>
                            {item.done && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </button>
                          <span className={`tasks-check-text${item.done ? " tasks-check-text--done" : ""}`}>{item.text}</span>
                          {isEditing && (
                            <button type="button" className="tasks-check-remove" onClick={() => editRemoveChecklist(itemId)}>✕</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {isEditing && (
                    <div className="tasks-modal-input-row">
                      <input type="text" className="tasks-modal-input" value={checkInput}
                        placeholder="Add a step…"
                        onChange={e => setCheckInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); editAddChecklist(); } }} />
                      <button type="button" className="tasks-modal-add-btn" onClick={editAddChecklist} disabled={!checkInput.trim()}>Add</button>
                    </div>
                  )}
                </div>

                <div className="tasks-modal-section">
                  <span className="tasks-modal-label">Notes</span>
                  {isEditing ? (
                    <textarea className="tasks-modal-input tasks-modal-textarea" rows={3}
                      value={editDraft?.notes || ""}
                      placeholder="Additional notes…"
                      onChange={e => setEditDraft(d => d ? { ...d, notes: e.target.value } : d)} />
                  ) : (
                    <p className="tasks-modal-notes">{selectedTask.notes || <span className="tasks-modal-empty-hint">No notes.</span>}</p>
                  )}
                </div>
              </div>

              <div className="tasks-modal-right">
                <div className="tasks-modal-section">
                  <span className="tasks-modal-label">Assigned Staff</span>
                  <div className="tasks-modal-staff-list">
                    {(activeTask?.assignedStaff || []).length === 0 && <p className="tasks-modal-empty-hint">No staff assigned.</p>}
                    {(activeTask?.assignedStaff || []).map(name => (
                      <div key={name} className="tasks-modal-staff-row">
                        <span className="tasks-modal-staff-avatar" style={{ backgroundColor: priorityColor }}>
                          {name.charAt(0).toUpperCase()}
                        </span>
                        <span className="tasks-modal-staff-name">{name}</span>
                        {isEditing && (
                          <button type="button" className="tasks-check-remove" onClick={() => editRemoveStaff(name)}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                  {isEditing && (
                    <div className="tasks-modal-input-row">
                      {metaStaff.length > 0 ? (
                        <select className="tasks-modal-input" value={staffInput} onChange={e => setStaffInput(e.target.value)}>
                          <option value="">-- Select staff --</option>
                          {metaStaff.filter(s => !(editDraft?.assignedStaff || []).includes(s)).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" className="tasks-modal-input" value={staffInput}
                          placeholder="Staff name or email…"
                          onChange={e => setStaffInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); editAddStaff(); } }} />
                      )}
                      <button type="button" className="tasks-modal-add-btn" onClick={editAddStaff} disabled={!staffInput.trim()}>Add</button>
                    </div>
                  )}
                </div>

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
                  </div>
                </div>

                {!isEditing && (
                  <div className="tasks-modal-section">
                    <span className="tasks-modal-label">Move to</span>
                    <div className="tasks-modal-status-grid">
                      {metaStatuses
                        .filter(s => s.name !== (selectedTask.status || "Pending") && s.name.toLowerCase() !== "archived")
                        .map(s => (
                          <button key={s.id} type="button" className="tasks-modal-status-btn"
                            style={{ borderColor: s.color + "60", color: s.color, backgroundColor: s.color + "10" }}
                            onClick={() => updateTaskStatus(selectedTask, s.name)}>
                            {s.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="tasks-modal-footer">
                <button type="button" className="tasks-modal-cancel-btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
                <button type="button" className="tasks-modal-save-btn" onClick={saveEdit}
                  disabled={saving || !editDraft?.name?.trim()}
                  style={{ backgroundColor: priorityColor }}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Toasts ── */}
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

      {/* ── Confirm dialog ── */}
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

      {/* ── Bounce animation for debounce indicator ── */}
      <style>{`
        @keyframes tasks-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50%       { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </>
  );
}