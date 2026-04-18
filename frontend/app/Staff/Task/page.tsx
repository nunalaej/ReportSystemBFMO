// app/Staff/Task/page.tsx
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
type Comment       = { text: string; by: string; at: string; };

type Task = {
  _id: string;
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
  position: string;
  clerkId?: string;
};

type MetaStatus   = { id: string; name: string; color: string; };
type MetaPriority = { id: string; name: string; color: string; };

/* ── Permission matrix by position ────────────────────────────
   Head Engineer  → canCreate, canEdit, canAssign, canComment, canStatus
   Staff Engineer → canComment, canStatus
   Supervisor     → view only (canStatus: false for own tasks)
   Technician     → view only
─────────────────────────────────────────────────────────────── */
type Perms = {
  canCreate:  boolean; // can create new tasks
  canEdit:    boolean; // can edit task name/priority/checklist/notes
  canAssign:  boolean; // can change assignedStaff
  canStatus:  boolean; // can update status
  canComment: boolean; // can add comments
};

function getPerms(position: string): Perms {
  const pos = position.toLowerCase();
  if (pos.includes("head engineer"))  return { canCreate: true,  canEdit: true,  canAssign: true,  canStatus: true,  canComment: true  };
  if (pos.includes("staff engineer")) return { canCreate: false, canEdit: false, canAssign: false, canStatus: true,  canComment: true  };
  if (pos.includes("supervisor"))     return { canCreate: false, canEdit: false, canAssign: false, canStatus: false, canComment: false };
  if (pos.includes("technician"))     return { canCreate: false, canEdit: false, canAssign: false, canStatus: false, canComment: false };
  // fallback
  return { canCreate: false, canEdit: false, canAssign: false, canStatus: false, canComment: false };
}

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

function getRelativeTime(d?: string) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-PH", { month:"short", day:"numeric" });
}

function calcProgress(checklist?: ChecklistItem[]) {
  if (!checklist?.length) return null;
  return Math.round((checklist.filter(i => i.done).length / checklist.length) * 100);
}

/* ══════════════════════════════════════════════════════════ */
export default function StaffTasksPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const [staffRecord,    setStaffRecord]    = useState<StaffRecord | null>(null);
  const [canView,        setCanView]        = useState(false);
  const [tasks,          setTasks]          = useState<Task[]>([]);
  const [allStaff,       setAllStaff]       = useState<string[]>([]);
  const [isLoading,      setIsLoading]      = useState(false);
  const [loadError,      setLoadError]      = useState("");

  const [metaStatuses,   setMetaStatuses]   = useState<MetaStatus[]>(FALLBACK_STATUSES);
  const [metaPriorities, setMetaPriorities] = useState<MetaPriority[]>(FALLBACK_PRIORITIES);

  /* ── Filters ── */
  const [searchQuery,    setSearchQuery]    = useState("");
  const [statusFilter,   setStatusFilter]   = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [viewMode,       setViewMode]       = useState<"board" | "list" | "analytics">("board");

  /* ── Modal state ── */
  const [selectedTask,   setSelectedTask]   = useState<Task | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [newComment,     setNewComment]     = useState("");
  const [showNoteEdit,   setShowNoteEdit]   = useState(false);
  const [newNote,        setNewNote]        = useState("");

  /* ── Create task (Head Engineer only) ── */
  const [showCreate,     setShowCreate]     = useState(false);
  const [createDraft,    setCreateDraft]    = useState({ name: "", priority: "", concernType: "", reportId: "", notes: "", assignedStaff: [] as string[], staffInput: "" });

  /* ── Edit task (Head Engineer only) ── */
  const [isEditing,      setIsEditing]      = useState(false);
  const [editDraft,      setEditDraft]      = useState<Task | null>(null);
  const [staffInput,     setStaffInput]     = useState("");
  const [checkInput,     setCheckInput]     = useState("");

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { toasts, show: showToast, dismiss: dismissToast } = useToast();

  /* ── Auth ── */
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { router.replace("/"); return; }
    const rawRole = (user.publicMetadata as any)?.role;
    const role = Array.isArray(rawRole) ? String(rawRole[0]).toLowerCase() : typeof rawRole === "string" ? rawRole.toLowerCase() : "";
    if (role !== "staff") { router.replace("/"); return; }
    setCanView(true);
  }, [isLoaded, isSignedIn, user, router]);

  /* ── Fetch staff record (to get position) ── */
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
    try {
      const res  = await fetch(`${API_BASE}/api/staff`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      const list = Array.isArray(data?.staff) ? data.staff.map((s: any) => s.name).filter(Boolean)
                 : Array.isArray(data)         ? data.map((s: any) => s.name).filter(Boolean) : [];
      if (list.length) setAllStaff(list);
    } catch {}
  }, []);

  /* ── Fetch tasks ── */
  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true); setLoadError("");
      const res  = await fetch(`${API_BASE}/api/tasks?ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) { setLoadError(data?.message || "Could not load tasks."); return; }
      const list: Task[] = Array.isArray(data) ? data : Array.isArray(data.tasks) ? data.tasks : [];
      setTasks(list);
    } catch { setLoadError("Network error."); }
    finally  { setIsLoading(false); }
  }, []);

  useEffect(() => {
    if (!canView) return;
    fetchStaffRecord();
    fetchMeta();
    fetchTasks();
  }, [canView]);

  /* ── Derived ── */
  const staffName        = staffRecord?.name     || "";
  const staffPosition    = staffRecord?.position || "";
  const staffDisciplines = staffRecord?.disciplines || [];
  const perms            = useMemo(() => getPerms(staffPosition), [staffPosition]);

  /* ── My tasks: assigned to me + matching discipline ── */
  const myTasks = useMemo(() => tasks.filter(t => {
    const isAssigned = (t.assignedStaff || []).some(s => s.toLowerCase() === staffName.toLowerCase());
    if (!isAssigned) return false;
    if (staffDisciplines.length > 0 && t.concernType) {
      return staffDisciplines.some(d => d.toLowerCase() === t.concernType!.toLowerCase());
    }
    return true;
  }), [tasks, staffName, staffDisciplines]);

  /* ── Priority counts ── */
  const priorityCounts = useMemo(() => myTasks.reduce<Record<string,number>>((acc, t) => {
    if (t.priority) acc[t.priority] = (acc[t.priority] || 0) + 1;
    return acc;
  }, {}), [myTasks]);

  /* ── Filtered tasks ── */
  const filteredTasks = useMemo(() => myTasks.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchSearch   = !q || (t.name||"").toLowerCase().includes(q) || (t.reportId||"").toLowerCase().includes(q);
    const matchStatus   = statusFilter   === "All" || (t.status   || "Pending") === statusFilter;
    const matchPriority = priorityFilter === "All" || (t.priority || "")        === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  }), [myTasks, searchQuery, statusFilter, priorityFilter]);

  const hasActiveFilters = statusFilter !== "All" || priorityFilter !== "All" || !!searchQuery.trim();

  /* ── Board columns ── */
  const boardColumns = metaStatuses
    .filter(s => s.name.toLowerCase() !== "archived")
    .map(s => ({ ...s, tasks: filteredTasks.filter(t => (t.status || "Pending") === s.name) }));

  /* ── Color helpers ── */
  const getPriorityColor = (name?: string) => metaPriorities.find(p => p.name === name)?.color || "#6C757D";
  const getStatusColor   = (name?: string) => metaStatuses.find(s => s.name === name)?.color   || "#6C757D";

  /* ── Open/close modal ── */
  const openTask = (task: Task) => {
    setSelectedTask(task);
    setIsEditing(false); setEditDraft(null);
    setNewComment(""); setNewNote(task.notes || ""); setShowNoteEdit(false);
    setStaffInput(""); setCheckInput("");
  };
  const closeTask = useCallback(() => {
    setSelectedTask(null); setIsEditing(false); setEditDraft(null);
  }, []);

  useEscapeKey(closeTask, !!selectedTask);

  useEffect(() => {
    document.body.style.overflow = selectedTask ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedTask]);

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
      showToast(`Status → "${status}"`, "success");
    } catch (err: any) { showToast(err.message || "Failed", "error"); }
    finally { setSaving(false); }
  };

  /* ── Add comment ── */
  const addComment = async () => {
    if (!selectedTask || !newComment.trim()) return;
    try {
      setSaving(true);
      const comment: Comment = { text: newComment.trim(), by: staffName, at: new Date().toISOString() };
      const res  = await fetch(`${API_BASE}/api/tasks/${selectedTask._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: [...(selectedTask.comments || []), comment], updatedBy: staffName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      setTasks(p => p.map(t => t._id === data.task._id ? data.task : t));
      setSelectedTask(data.task);
      setNewComment("");
      showToast("Comment added.", "success");
    } catch (err: any) { showToast(err.message || "Failed", "error"); }
    finally { setSaving(false); }
  };

  /* ── Save note (Head Engineer only) ── */
  const saveNote = async () => {
    if (!selectedTask) return;
    try {
      setSaving(true);
      const res  = await fetch(`${API_BASE}/api/tasks/${selectedTask._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: newNote, updatedBy: staffName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setTasks(p => p.map(t => t._id === data.task._id ? data.task : t));
      setSelectedTask(data.task);
      setShowNoteEdit(false);
      showToast("Note saved.", "success");
    } catch { showToast("Failed.", "error"); }
    finally { setSaving(false); }
  };

  /* ── Save full edit (Head Engineer only) ── */
  const saveEdit = async () => {
    if (!editDraft || !selectedTask) return;
    try {
      setSaving(true);
      const res  = await fetch(`${API_BASE}/api/tasks/${selectedTask._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editDraft, updatedBy: staffName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      setTasks(p => p.map(t => t._id === data.task._id ? data.task : t));
      setSelectedTask(data.task);
      setIsEditing(false); setEditDraft(null);
      showToast("Task updated.", "success");
    } catch (err: any) { showToast(err.message || "Failed", "error"); }
    finally { setSaving(false); }
  };

  /* ── Create task (Head Engineer only) ── */
  const createTask = async () => {
    if (!createDraft.name.trim()) { showToast("Task name is required.", "error"); return; }
    try {
      setSaving(true);
      const res  = await fetch(`${API_BASE}/api/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          createDraft.name.trim(),
          concernType:   createDraft.concernType || "Other",
          reportId:      createDraft.reportId || null,
          priority:      createDraft.priority,
          notes:         createDraft.notes,
          assignedStaff: createDraft.assignedStaff,
          status:        "Pending",
          createdBy:     staffName,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      setTasks(p => [data.task, ...p]);
      setShowCreate(false);
      setCreateDraft({ name: "", priority: "", concernType: "", reportId: "", notes: "", assignedStaff: [], staffInput: "" });
      showToast(`Task "${data.task.name}" created.`, "success");
    } catch (err: any) { showToast(err.message || "Failed", "error"); }
    finally { setSaving(false); }
  };

  /* ── Toggle checklist ── */
  const toggleChecklist = async (task: Task, itemId: string) => {
    const updatedChecklist = (task.checklist || []).map(i =>
      (i.id === itemId || i._id === itemId) ? { ...i, done: !i.done } : i
    );
    try {
      const res  = await fetch(`${API_BASE}/api/tasks/${task._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updatedChecklist, updatedBy: staffName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setTasks(p => p.map(t => t._id === data.task._id ? data.task : t));
      if (selectedTask?._id === task._id) setSelectedTask(data.task);
    } catch { showToast("Failed to update checklist.", "error"); }
  };

  /* ── Analytics ── */
  const analytics = useMemo(() => {
    const total    = myTasks.length;
    const resolved = myTasks.filter(t => (t.status||"").toLowerCase() === "resolved").length;
    const rate     = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const byPri: Record<string,number>  = {};
    const byDisc: Record<string,number> = {};
    myTasks.forEach(t => {
      if (t.priority)    byPri[t.priority]         = (byPri[t.priority]         || 0) + 1;
      if (t.concernType) byDisc[t.concernType]      = (byDisc[t.concernType]     || 0) + 1;
    });
    return { total, resolved, rate, byPri, byDisc };
  }, [myTasks]);

  if (!isLoaded || !canView) {
    return <div className="tasks-wrapper"><div className="tasks-inner"><div className="tasks-shimmer-grid">{[...Array(4)].map((_,i)=><div key={i} className="tasks-shimmer-card"/>)}</div></div></div>;
  }

  const priorityColor = getPriorityColor(selectedTask?.priority);
  const statusColor   = getStatusColor(selectedTask?.status);
  const progress      = calcProgress(selectedTask?.checklist);

  /* ── Permission-based role badge ── */
  const roleBadgeColor = () => {
    const pos = staffPosition.toLowerCase();
    if (pos.includes("head"))   return { bg: "#fef3c7", color: "#92400e" };
    if (pos.includes("staff"))  return { bg: "#dbeafe", color: "#1e40af" };
    if (pos.includes("super"))  return { bg: "#f3e8ff", color: "#6b21a8" };
    return { bg: "#dcfce7", color: "#166534" };
  };
  const rb = roleBadgeColor();

  /* ══════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="tasks-wrapper">
        <div className="tasks-inner">

          {/* ── Header ── */}
          <div className="tasks-page-header">
            <div>
              <h1 className="tasks-page-title">My Tasks</h1>
              <p className="tasks-page-subtitle" style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                {staffRecord
                  ? <><span>{staffName}</span>
                    <span style={{ background: rb.bg, color: rb.color, fontSize:"0.68rem", fontWeight:700, padding:"2px 9px", borderRadius:999 }}>{staffPosition}</span>
                    {perms.canCreate  && <span style={{ fontSize:"0.68rem", color:"#16a34a" }}>✓ Can create tasks</span>}
                    {!perms.canEdit && !perms.canCreate && <span style={{ fontSize:"0.68rem", color:"#9ca3af" }}>View &amp; status updates only</span>}
                  </>
                  : "Loading your profile…"}
              </p>
            </div>
            <div className="tasks-header-actions">
              {/* Create task — Head Engineer only */}
              {perms.canCreate && (
                <button type="button"
                  onClick={() => setShowCreate(true)}
                  style={{ padding:"7px 16px", borderRadius:8, border:"none", background:"#2563eb", color:"#fff", fontSize:"0.8rem", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  New Task
                </button>
              )}
              {/* View toggle */}
              {(["board","list","analytics"] as const).map(v => (
                <button key={v} type="button"
                  className={`tasks-view-btn${viewMode === v ? " tasks-view-btn--active" : ""}`}
                  onClick={() => setViewMode(v)} title={v.charAt(0).toUpperCase() + v.slice(1)}>
                  {v === "board"     && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>}
                  {v === "list"      && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                  {v === "analytics" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
                </button>
              ))}
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
              <div className="tasks-stat-icon" style={{ background:"rgba(37,99,235,0.1)", color:"#2563eb" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
              </div>
              <div className="tasks-stat-info"><span className="tasks-stat-num">{myTasks.length}</span><span className="tasks-stat-lbl">Total</span></div>
            </div>
            {metaStatuses.filter(s => s.name.toLowerCase() !== "archived").map(s => (
              <div key={s.id} className="tasks-stat">
                <div className="tasks-stat-icon" style={{ background: s.color+"18", color: s.color }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9"/></svg>
                </div>
                <div className="tasks-stat-info">
                  <span className="tasks-stat-num" style={{ color: s.color }}>{myTasks.filter(t => (t.status||"Pending") === s.name).length}</span>
                  <span className="tasks-stat-lbl">{s.name}</span>
                </div>
              </div>
            ))}
            <div className="tasks-stat">
              <div className="tasks-stat-icon" style={{ background:"rgba(34,197,94,0.1)", color:"#22c55e" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="tasks-stat-info"><span className="tasks-stat-num" style={{ color:"#22c55e" }}>{analytics.rate}%</span><span className="tasks-stat-lbl">Resolved</span></div>
            </div>
          </div>

          {/* ── Priority chips ── */}
          <div className="tasks-priority-bar">
            <button type="button"
              className={`tasks-priority-chip${priorityFilter === "All" ? " tasks-priority-chip--all-active" : ""}`}
              style={{ "--chip-color":"#2563eb" } as React.CSSProperties}
              onClick={() => setPriorityFilter("All")}>
              All Tasks <span className="tasks-priority-chip-count">{myTasks.length}</span>
            </button>
            {metaPriorities.map(p => (
              <button key={p.id} type="button"
                className={`tasks-priority-chip${priorityFilter === p.name ? " tasks-priority-chip--active" : ""}`}
                style={{ "--chip-color": p.color } as React.CSSProperties}
                onClick={() => setPriorityFilter(priorityFilter === p.name ? "All" : p.name)}>
                <span className="tasks-priority-chip-dot" style={{ backgroundColor: p.color }}/>
                {p.name} <span className="tasks-priority-chip-count">{priorityCounts[p.name] || 0}</span>
              </button>
            ))}
          </div>

          {/* ── Filters ── */}
          <div className="tasks-filters">
            <div className="tasks-search-wrap">
              <svg viewBox="0 0 24 24" className="tasks-search-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" className="tasks-search" placeholder="Search tasks…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
              {searchQuery && <button type="button" className="tasks-search-clear" onClick={() => setSearchQuery("")}>✕</button>}
            </div>
            <div className="tasks-filters-divider"/>
            <select className="tasks-filter-select" value={statusFilter}   onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              {metaStatuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select className="tasks-filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="All">All Priorities</option>
              {metaPriorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            {hasActiveFilters && (
              <button type="button" className="tasks-clear-filters" onClick={() => { setStatusFilter("All"); setPriorityFilter("All"); setSearchQuery(""); }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Clear
              </button>
            )}
          </div>

          {loadError && <div className="tasks-error-banner">{loadError} <button type="button" onClick={fetchTasks}>Retry</button></div>}
          {isLoading && <div className="tasks-shimmer-grid">{[...Array(4)].map((_,i)=><div key={i} className="tasks-shimmer-card"/>)}</div>}

          {!isLoading && filteredTasks.length === 0 && !loadError && viewMode !== "analytics" && (
            <div className="tasks-empty">
              <div className="tasks-empty-icon">
                <svg viewBox="0 0 64 64" fill="none" width="28" height="28"><rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="2"/><path d="M22 32h20M32 22v20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <p>{hasActiveFilters ? "No tasks match your filters." : "No tasks assigned to you yet."}</p>
              <span>{hasActiveFilters ? "Try adjusting the filters above." : "Tasks assigned to you will appear here."}</span>
            </div>
          )}

          {/* ══ ANALYTICS ══ */}
          {viewMode === "analytics" && (
            <div style={{ paddingTop: 8, display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14 }}>
                {[
                  { label:"Total Tasks",  value: analytics.total,    color:"#4169E1" },
                  { label:"Resolved",     value: analytics.resolved,  color:"#28A745" },
                  { label:"Completion",   value:`${analytics.rate}%`, color:"#22c55e" },
                ].map(c => (
                  <div key={c.label} style={{ background:"var(--tasks-surface)", borderRadius:12, padding:"16px", textAlign:"center", border:"1px solid var(--tasks-border)", borderTop:`3px solid ${c.color}` }}>
                    <div style={{ fontSize:26, fontWeight:700, color:c.color }}>{c.value}</div>
                    <div style={{ fontSize:12, color:"var(--tasks-text-3)", marginTop:4 }}>{c.label}</div>
                  </div>
                ))}
              </div>
              {/* By priority */}
              <div style={{ background:"var(--tasks-surface)", borderRadius:12, padding:20, border:"1px solid var(--tasks-border)" }}>
                <div style={{ fontWeight:600, fontSize:14, marginBottom:14, color:"var(--tasks-text-1)" }}>Tasks by Priority</div>
                {metaPriorities.map(p => {
                  const count = analytics.byPri[p.name] || 0;
                  const pct   = analytics.total > 0 ? Math.round((count/analytics.total)*100) : 0;
                  return (
                    <div key={p.id} style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                        <span style={{ color:p.color, fontWeight:600 }}>{p.name}</span>
                        <span style={{ fontWeight:600 }}>{count}</span>
                      </div>
                      <div style={{ height:6, background:"var(--tasks-border)", borderRadius:999 }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:p.color, borderRadius:999, transition:"width 0.4s" }}/>
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
                    <span className="tasks-board-col-dot" style={{ backgroundColor: col.color }}/>
                    <span className="tasks-board-col-name">{col.name}</span>
                    <span className="tasks-board-col-count">{col.tasks.length}</span>
                  </div>
                  <div className="tasks-board-col-body">
                    {col.tasks.length === 0 && <div className="tasks-board-empty">No tasks</div>}
                    {col.tasks.map(task => {
                      const prog   = calcProgress(task.checklist);
                      const pColor = getPriorityColor(task.priority);
                      return (
                        <div key={task._id} className="tasks-card" onClick={() => openTask(task)}>
                          <div className="tasks-card-stripe" style={{ backgroundColor: pColor }}/>
                          <div className="tasks-card-body">
                            <div className="tasks-card-top">
                              <h4 className="tasks-card-name">{task.name}</h4>
                              {task.priority && <span className="tasks-card-priority" style={{ color:pColor, backgroundColor:pColor+"18", border:`1px solid ${pColor}40` }}>{task.priority}</span>}
                            </div>
                            {task.reportId && <p className="tasks-card-report-id"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>#{task.reportId}</p>}
                            {task.concernType && <p className="tasks-card-concern">{task.concernType}</p>}
                            {prog !== null && (
                              <div className="tasks-card-progress">
                                <div className="tasks-card-progress-bar"><div className="tasks-card-progress-fill" style={{ width:`${prog}%`, backgroundColor:prog===100?"#22c55e":pColor }}/></div>
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
              <div className="tasks-list-header-row"><span>Task</span><span>Status</span><span>Priority</span><span>Progress</span><span>Discipline</span><span>Created</span></div>
              {filteredTasks.map(task => {
                const prog = calcProgress(task.checklist);
                const pColor = getPriorityColor(task.priority);
                const sColor = getStatusColor(task.status);
                return (
                  <div key={task._id} className="tasks-list-row" onClick={() => openTask(task)}>
                    <div className="tasks-list-name-cell">
                      <span className="tasks-list-stripe" style={{ backgroundColor: pColor }}/>
                      <div><p className="tasks-list-name">{task.name}</p>{task.reportId && <p className="tasks-list-sub">#{task.reportId} · {task.concernType||""}</p>}</div>
                    </div>
                    <span><span className="tasks-status-pill" style={{ backgroundColor:sColor+"20", color:sColor, border:`1px solid ${sColor}40` }}>{task.status||"Pending"}</span></span>
                    <span>{task.priority ? <span className="tasks-status-pill" style={{ backgroundColor:pColor+"20", color:pColor, border:`1px solid ${pColor}40` }}>{task.priority}</span> : <span className="tasks-list-na">—</span>}</span>
                    <span>{prog !== null ? <div className="tasks-list-progress"><div className="tasks-list-progress-bar"><div className="tasks-list-progress-fill" style={{ width:`${prog}%`, backgroundColor:prog===100?"#22c55e":pColor }}/></div><span className="tasks-list-progress-pct">{prog}%</span></div> : <span className="tasks-list-na">—</span>}</span>
                    <span style={{ fontSize:"0.78rem", color:"var(--tasks-text-3)" }}>{task.concernType||"—"}</span>
                    <span className="tasks-list-time">{getRelativeTime(task.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* ══ CREATE TASK MODAL (Head Engineer only) ══ */}
      {mounted && showCreate && perms.canCreate && createPortal(
        <div className="tasks-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="tasks-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="tasks-modal-header" style={{ borderTop: "4px solid #2563eb" }}>
              <h2 className="tasks-modal-title">New Task</h2>
              <button type="button" className="tasks-modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>
              {/* Name */}
              <div>
                <label className="tasks-modal-label">Task Name *</label>
                <input className="tasks-modal-input" style={{ marginTop:6 }} placeholder="e.g. Replace aircon unit"
                  value={createDraft.name} onChange={e => setCreateDraft(d=>({...d,name:e.target.value}))}/>
              </div>
              {/* Priority */}
              <div>
                <label className="tasks-modal-label">Priority</label>
                <div className="tasks-modal-status-grid" style={{ marginTop:6 }}>
                  {metaPriorities.map(p => (
                    <button key={p.id} type="button"
                      className="tasks-modal-status-btn"
                      style={{ borderColor: p.color+"60", color: p.color, backgroundColor: createDraft.priority === p.name ? p.color+"20" : "transparent", fontWeight: createDraft.priority === p.name ? 700 : 500 }}
                      onClick={() => setCreateDraft(d=>({...d,priority:d.priority===p.name?"":p.name}))}>
                      {createDraft.priority === p.name ? "✓ " : ""}{p.name}
                    </button>
                  ))}
                </div>
              </div>
              {/* Assign staff */}
              <div>
                <label className="tasks-modal-label">Assign Staff</label>
                <div style={{ display:"flex", gap:6, marginTop:6 }}>
                  <input list="create-staff-list" className="tasks-modal-input" placeholder="Staff name…" style={{ flex:1 }}
                    value={createDraft.staffInput}
                    onChange={e => setCreateDraft(d=>({...d,staffInput:e.target.value}))}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const v = createDraft.staffInput.trim();
                        if (v && !createDraft.assignedStaff.includes(v))
                          setCreateDraft(d=>({...d,assignedStaff:[...d.assignedStaff,v],staffInput:""}));
                      }
                    }}/>
                  <datalist id="create-staff-list">{allStaff.map(s=><option key={s} value={s}/>)}</datalist>
                  <button type="button" className="tasks-modal-save-btn" style={{ backgroundColor:"#2563eb", padding:"0 14px" }}
                    onClick={() => {
                      const v = createDraft.staffInput.trim();
                      if (v && !createDraft.assignedStaff.includes(v))
                        setCreateDraft(d=>({...d,assignedStaff:[...d.assignedStaff,v],staffInput:""}));
                    }}>Add</button>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:8 }}>
                  {createDraft.assignedStaff.map(s => (
                    <span key={s} style={{ background:"#eff6ff", border:"1px solid #bfdbfe", color:"#1d4ed8", borderRadius:999, padding:"2px 10px", fontSize:"0.75rem", display:"flex", alignItems:"center", gap:4 }}>
                      {s}
                      <button type="button" onClick={() => setCreateDraft(d=>({...d,assignedStaff:d.assignedStaff.filter(x=>x!==s)}))}
                        style={{ border:"none", background:"none", cursor:"pointer", color:"#93c5fd", fontWeight:700 }}>✕</button>
                    </span>
                  ))}
                </div>
              </div>
              {/* Notes */}
              <div>
                <label className="tasks-modal-label">Notes</label>
                <textarea className="tasks-modal-input tasks-modal-textarea" rows={2} style={{ marginTop:6 }}
                  placeholder="Optional notes…"
                  value={createDraft.notes} onChange={e => setCreateDraft(d=>({...d,notes:e.target.value}))}/>
              </div>
              {/* Actions */}
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button type="button" onClick={() => setShowCreate(false)}
                  style={{ padding:"8px 18px", borderRadius:8, border:"1px solid var(--tasks-border,#e8ecf0)", background:"var(--tasks-surface,#fff)", cursor:"pointer", fontSize:"0.82rem" }}>
                  Cancel
                </button>
                <button type="button" className="tasks-modal-save-btn" style={{ backgroundColor:"#2563eb" }}
                  onClick={createTask} disabled={saving || !createDraft.name.trim()}>
                  {saving ? "Creating…" : "Create Task"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══ TASK DETAIL MODAL ══ */}
      {mounted && selectedTask && createPortal(
        <div className="tasks-modal-backdrop" onClick={closeTask} role="dialog" aria-modal="true">
          <div className="tasks-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>

            {/* Header */}
            <div className="tasks-modal-header" style={{ borderTop: `4px solid ${priorityColor}` }}>
              <div className="tasks-modal-header-left">
                <h2 className="tasks-modal-title">{selectedTask.name}</h2>
                {selectedTask.reportId && <span className="tasks-modal-report-badge">#{selectedTask.reportId}</span>}
                {/* Permission badge */}
                <span style={{ fontSize:"0.62rem", fontWeight:700, padding:"2px 8px", borderRadius:999, background: rb.bg, color: rb.color, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                  {staffPosition}
                </span>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                {/* Edit button — Head Engineer only */}
                {perms.canEdit && !isEditing && (
                  <button type="button" onClick={() => { setIsEditing(true); setEditDraft({ ...selectedTask, checklist:(selectedTask.checklist||[]).map(i=>({...i})), assignedStaff:[...(selectedTask.assignedStaff||[])] }); }}
                    style={{ padding:"5px 12px", borderRadius:7, border:"1px solid #e5e7eb", background:"#fff", fontSize:"0.75rem", fontWeight:600, cursor:"pointer" }}>
                    ✏️ Edit
                  </button>
                )}
                {isEditing && (
                  <>
                    <button type="button" onClick={() => { setIsEditing(false); setEditDraft(null); }}
                      style={{ padding:"5px 12px", borderRadius:7, border:"1px solid #e5e7eb", background:"#fff", fontSize:"0.75rem", fontWeight:600, cursor:"pointer" }}>
                      Cancel
                    </button>
                    <button type="button" className="tasks-modal-save-btn" style={{ backgroundColor: priorityColor, padding:"5px 14px" }}
                      onClick={saveEdit} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </>
                )}
                <button type="button" className="tasks-modal-close" onClick={closeTask}>✕</button>
              </div>
            </div>

            {/* Body */}
            <div className="tasks-modal-body">

              {/* LEFT */}
              <div className="tasks-modal-left">

                {/* Status / priority pills */}
                <div className="tasks-modal-meta-row">
                  <span className="tasks-meta-pill" style={{ backgroundColor:statusColor+"20", color:statusColor, border:`1px solid ${statusColor}40` }}>{selectedTask.status||"Pending"}</span>
                  {selectedTask.priority && <span className="tasks-meta-pill" style={{ backgroundColor:priorityColor+"20", color:priorityColor, border:`1px solid ${priorityColor}40` }}>{selectedTask.priority}</span>}
                  {selectedTask.concernType && <span className="tasks-meta-pill tasks-meta-pill--neutral">{selectedTask.concernType}</span>}
                </div>

                {/* ── UPDATE STATUS (Staff Engineer + Head Engineer) ── */}
                {perms.canStatus && !isEditing && (
                  <div className="tasks-modal-section">
                    <span className="tasks-modal-label">Update Status</span>
                    <div className="tasks-modal-status-grid" style={{ marginTop:8 }}>
                      {metaStatuses
                        .filter(s => s.name.toLowerCase() !== "archived" && s.name !== (selectedTask.status||"Pending"))
                        .map(s => (
                          <button key={s.id} type="button" className="tasks-modal-status-btn"
                            style={{ borderColor:s.color+"60", color:s.color, backgroundColor:s.color+"10" }}
                            disabled={saving} onClick={() => updateStatus(selectedTask, s.name)}>
                            → {s.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* ── VIEW-ONLY STATUS (Supervisor / Technician) ── */}
                {!perms.canStatus && (
                  <div className="tasks-modal-section">
                    <span className="tasks-modal-label">Status</span>
                    <span className="tasks-meta-pill" style={{ marginTop:6, display:"inline-block", backgroundColor:statusColor+"20", color:statusColor, border:`1px solid ${statusColor}40` }}>
                      {selectedTask.status||"Pending"}
                    </span>
                    <p style={{ fontSize:"0.72rem", color:"var(--tasks-text-4,#b8c4ce)", marginTop:6 }}>Your role is view-only for status changes.</p>
                  </div>
                )}

                {/* ── EDIT FIELDS (Head Engineer only, when isEditing) ── */}
                {isEditing && editDraft && (
                  <>
                    <div className="tasks-modal-section">
                      <label className="tasks-modal-label">Task Name</label>
                      <input className="tasks-modal-input" style={{ marginTop:6 }} value={editDraft.name}
                        onChange={e => setEditDraft(d => d ? {...d,name:e.target.value} : d)}/>
                    </div>
                    <div className="tasks-modal-section">
                      <label className="tasks-modal-label">Priority</label>
                      <div className="tasks-modal-status-grid" style={{ marginTop:6 }}>
                        {metaPriorities.map(p => (
                          <button key={p.id} type="button" className="tasks-modal-status-btn"
                            style={{ borderColor:p.color+"60", color:p.color, backgroundColor:editDraft.priority===p.name?p.color+"20":"transparent", fontWeight:editDraft.priority===p.name?700:500 }}
                            onClick={() => setEditDraft(d => d ? {...d,priority:p.name} : d)}>
                            {editDraft.priority===p.name ? "✓ " : ""}{p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Assign staff (Head Engineer) */}
                    <div className="tasks-modal-section">
                      <label className="tasks-modal-label">Assigned Staff</label>
                      <div style={{ display:"flex", gap:6, marginTop:6 }}>
                        <input list="edit-staff-list" className="tasks-modal-input" placeholder="Add staff…" style={{ flex:1 }}
                          value={staffInput} onChange={e => setStaffInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              const v = staffInput.trim();
                              if (v && !(editDraft.assignedStaff||[]).includes(v))
                                setEditDraft(d => d ? {...d,assignedStaff:[...(d.assignedStaff||[]),v]} : d);
                              setStaffInput("");
                            }
                          }}/>
                        <datalist id="edit-staff-list">{allStaff.map(s=><option key={s} value={s}/>)}</datalist>
                        <button type="button" style={{ padding:"0 12px", background:"#2563eb", color:"#fff", border:"none", borderRadius:7, cursor:"pointer", fontSize:"0.8rem" }}
                          onClick={() => {
                            const v = staffInput.trim();
                            if (v && !(editDraft.assignedStaff||[]).includes(v))
                              setEditDraft(d => d ? {...d,assignedStaff:[...(d.assignedStaff||[]),v]} : d);
                            setStaffInput("");
                          }}>Add</button>
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                        {(editDraft.assignedStaff||[]).map(s => (
                          <span key={s} style={{ background:"#eff6ff", border:"1px solid #bfdbfe", color:"#1d4ed8", borderRadius:999, padding:"2px 10px", fontSize:"0.75rem", display:"flex", alignItems:"center", gap:4 }}>
                            {s}
                            <button type="button" onClick={() => setEditDraft(d => d ? {...d,assignedStaff:(d.assignedStaff||[]).filter(x=>x!==s)} : d)}
                              style={{ border:"none",background:"none",cursor:"pointer",color:"#93c5fd",fontWeight:700 }}>✕</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Checklist progress */}
                {progress !== null && (
                  <div className="tasks-modal-progress-section">
                    <div className="tasks-modal-progress-header">
                      <span className="tasks-modal-label">Checklist Progress</span>
                      <span className="tasks-modal-progress-pct" style={{ color:progress===100?"#22c55e":priorityColor }}>{progress}%</span>
                    </div>
                    <div className="tasks-modal-progress-bar">
                      <div className="tasks-modal-progress-fill" style={{ width:`${progress}%`, backgroundColor:progress===100?"#22c55e":priorityColor }}/>
                    </div>
                  </div>
                )}

                {/* Checklist items */}
                <div className="tasks-modal-section">
                  <span className="tasks-modal-label">Checklist
                    {(selectedTask.checklist?.length||0) > 0 && (
                      <span className="tasks-modal-checklist-count">{(selectedTask.checklist||[]).filter(i=>i.done).length}/{selectedTask.checklist?.length}</span>
                    )}
                  </span>
                  <div className="tasks-modal-checklist">
                    {!(selectedTask.checklist?.length) && <p className="tasks-modal-empty-hint">No checklist items.</p>}
                    {(selectedTask.checklist||[]).map(item => {
                      const id = item.id || item._id || "";
                      return (
                        <div key={id} className="tasks-modal-check-item">
                          <button type="button"
                            className={`tasks-check-btn${item.done?" tasks-check-btn--done":""}`}
                            style={item.done ? { backgroundColor:priorityColor, borderColor:priorityColor } : {}}
                            onClick={() => toggleChecklist(selectedTask, id)}>
                            {item.done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </button>
                          <span className={`tasks-check-text${item.done?" tasks-check-text--done":""}`}>{item.text}</span>
                        </div>
                      );
                    })}
                    {/* Add checklist item — Head Engineer only */}
                    {isEditing && editDraft && (
                      <div style={{ display:"flex", gap:6, marginTop:8 }}>
                        <input className="tasks-modal-input" placeholder="Add item…" style={{ flex:1 }} value={checkInput} onChange={e => setCheckInput(e.target.value)}
                          onKeyDown={e => { if (e.key==="Enter"&&checkInput.trim()) { setEditDraft(d=>d?{...d,checklist:[...(d.checklist||[]),{id:`${Date.now()}`,text:checkInput.trim(),done:false}]}:d); setCheckInput(""); }}}/>
                        <button type="button" style={{ padding:"0 12px", background:"#2563eb", color:"#fff", border:"none", borderRadius:7, cursor:"pointer", fontSize:"0.8rem" }}
                          onClick={() => { if(checkInput.trim()) { setEditDraft(d=>d?{...d,checklist:[...(d.checklist||[]),{id:`${Date.now()}`,text:checkInput.trim(),done:false}]}:d); setCheckInput(""); }}}>Add</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="tasks-modal-section">
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span className="tasks-modal-label">Notes</span>
                    {perms.canEdit && !isEditing && (
                      <button type="button" style={{ fontSize:"0.75rem", color:"var(--tasks-accent,#2563eb)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}
                        onClick={() => { setShowNoteEdit(!showNoteEdit); setNewNote(selectedTask.notes||""); }}>
                        {showNoteEdit ? "Cancel" : "Edit"}
                      </button>
                    )}
                  </div>
                  {showNoteEdit && perms.canEdit && !isEditing ? (
                    <>
                      <textarea className="tasks-modal-input tasks-modal-textarea" rows={3} style={{ marginTop:8 }} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add notes…"/>
                      <button type="button" className="tasks-modal-save-btn" style={{ backgroundColor:priorityColor, marginTop:8 }} onClick={saveNote} disabled={saving}>{saving?"Saving…":"Save Note"}</button>
                    </>
                  ) : (
                    <p className="tasks-modal-notes" style={{ marginTop:6 }}>
                      {selectedTask.notes || <span className="tasks-modal-empty-hint">{perms.canEdit ? "No notes yet. Click Edit to add one." : "No notes."}</span>}
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
                    <span className="tasks-info-key">Created by</span><span className="tasks-info-val">{selectedTask.createdBy||"Admin"}</span>
                    <span className="tasks-info-key">Created</span><span className="tasks-info-val">{selectedTask.createdAt ? new Date(selectedTask.createdAt).toLocaleString() : "—"}</span>
                    <span className="tasks-info-key">Updated</span><span className="tasks-info-val">{selectedTask.updatedAt ? new Date(selectedTask.updatedAt).toLocaleString() : "—"}</span>
                    {selectedTask.reportId && <><span className="tasks-info-key">Report</span><span className="tasks-info-val">#{selectedTask.reportId}</span></>}
                    <span className="tasks-info-key">Discipline</span><span className="tasks-info-val">{selectedTask.concernType||"—"}</span>
                  </div>
                </div>

                {/* Assigned staff */}
                <div className="tasks-modal-section tasks-modal-info-box">
                  <span className="tasks-modal-label">Assigned Staff</span>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                    {(selectedTask.assignedStaff||[]).length === 0 && <span className="tasks-modal-empty-hint">No staff assigned.</span>}
                    {(selectedTask.assignedStaff||[]).map(s => (
                      <span key={s} style={{ background:"#eff6ff", border:"1px solid #bfdbfe", color:"#1d4ed8", borderRadius:999, padding:"3px 10px", fontSize:"0.75rem" }}>{s}</span>
                    ))}
                  </div>
                </div>

                {/* Comments */}
                <div className="tasks-modal-section">
                  <span className="tasks-modal-label">Comments
                    {(selectedTask.comments?.length||0)>0 && <span className="tasks-modal-checklist-count">{selectedTask.comments!.length}</span>}
                  </span>
                  <div style={{ maxHeight:200, overflowY:"auto", marginTop:8, display:"flex", flexDirection:"column", gap:6 }}>
                    {!(selectedTask.comments?.length) && <p className="tasks-modal-empty-hint">No comments yet.</p>}
                    {(selectedTask.comments||[]).map((c, idx) => (
                      <div key={idx} className="tasks-modal-info-box" style={{ padding:"10px 12px" }}>
                        <p style={{ margin:"0 0 4px", fontSize:"0.82rem", color:"var(--tasks-text-1)" }}>{c.text}</p>
                        <div style={{ color:"var(--tasks-text-4)", fontSize:"0.68rem" }}>by {c.by} · {getRelativeTime(c.at)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Add comment — Staff Engineer + Head Engineer */}
                  {perms.canComment && (
                    <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:6 }}>
                      <textarea className="tasks-modal-input tasks-modal-textarea" rows={2}
                        value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment…"/>
                      <button type="button" className="tasks-modal-save-btn" style={{ backgroundColor:priorityColor }}
                        onClick={addComment} disabled={saving || !newComment.trim()}>
                        {saving ? "Adding…" : "Add Comment"}
                      </button>
                    </div>
                  )}
                  {!perms.canComment && (
                    <p style={{ fontSize:"0.72rem", color:"var(--tasks-text-4,#b8c4ce)", marginTop:8 }}>Comments are read-only for your role.</p>
                  )}
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