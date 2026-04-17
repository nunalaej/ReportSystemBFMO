"use client";

import "../style/task.css";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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

/* ── Debounce hook ── */
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

/* ── Date range presets ── */
type DatePreset = "all" | "today" | "week" | "month" | "quarter" | "custom";

function getPresetRange(preset: DatePreset): { from: string; to: string } | null {
  if (preset === "all" || preset === "custom") return null;
  const now  = new Date();
  const to   = now.toISOString().slice(0, 10);
  const from = new Date(now);
  if (preset === "today")   { from.setHours(0,0,0,0); }
  if (preset === "week")    { from.setDate(now.getDate() - 7); }
  if (preset === "month")   { from.setMonth(now.getMonth() - 1); }
  if (preset === "quarter") { from.setMonth(now.getMonth() - 3); }
  return { from: from.toISOString().slice(0, 10), to };
}

/* ── Print helper ── */
function printTasks(tasks: Task[], filters: Record<string, string>, metaStatuses: MetaStatus[], metaPriorities: MetaPriority[]) {
  const getPColor = (name?: string) => metaPriorities.find(p => p.name === name)?.color || "#6C757D";
  const getSColor = (name?: string) => metaStatuses.find(s => s.name === name)?.color || "#6C757D";

  const activeFilters = Object.entries(filters)
    .filter(([, v]) => v && v !== "All" && v !== "all" && v !== "")
    .map(([k, v]) => `${k}: <strong>${v}</strong>`)
    .join(" &nbsp;·&nbsp; ");

  const rows = tasks.map(t => {
    const pColor = getPColor(t.priority);
    const sColor = getSColor(t.status);
    const prog   = calcProgress(t.checklist);
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
          <div style="font-weight:600;font-size:13px;color:#0f172a;margin-bottom:2px;">${t.name}</div>
          ${t.reportId ? `<div style="font-size:11px;color:#94a3b8;">#${t.reportId}${t.concernType ? ` · ${t.concernType}` : ""}</div>` : ""}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
          <span style="background:${sColor}20;color:${sColor};border:1px solid ${sColor}40;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap;">
            ${t.status || "Pending"}
          </span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
          ${t.priority ? `<span style="background:${pColor}20;color:${pColor};border:1px solid ${pColor}40;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;">${t.priority}</span>` : '<span style="color:#d1d5db;">—</span>'}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">
          ${t.assignedStaff?.join(", ") || "—"}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">
          ${t.concernType || "—"}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
          ${prog !== null ? `
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="flex:1;height:5px;background:#e5e7eb;border-radius:999px;overflow:hidden;min-width:50px;">
                <div style="height:100%;width:${prog}%;background:${prog===100?"#22c55e":pColor};border-radius:999px;"></div>
              </div>
              <span style="font-size:11px;color:#94a3b8;white-space:nowrap;">${prog}%</span>
            </div>` : '<span style="color:#d1d5db;font-size:12px;">—</span>'}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#94a3b8;white-space:nowrap;">
          ${t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" }) : "—"}
        </td>
      </tr>`;
  }).join("");

  // Analytics summary for print
  const total    = tasks.length;
  const resolved = tasks.filter(t => (t.status||"").toLowerCase() === "resolved").length;
  const rate     = total > 0 ? Math.round((resolved/total)*100) : 0;
  const byStatus = metaStatuses.map(s => ({
    ...s, count: tasks.filter(t => (t.status||"Pending") === s.name).length,
  }));
  const byPriority = metaPriorities.map(p => ({
    ...p, count: tasks.filter(t => (t.priority||"") === p.name).length,
  }));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Tasks Report — BFMO</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; background: #fff; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; }
    .title { font-size: 22px; font-weight: 700; color: #0f172a; }
    .subtitle { font-size: 12px; color: #6b7280; margin-top: 3px; }
    .meta { text-align: right; font-size: 11px; color: #9ca3af; }
    .filters-row { font-size: 12px; color: #475569; margin-bottom: 20px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e5e7eb; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .summary-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; text-align: center; }
    .summary-num { font-size: 24px; font-weight: 700; }
    .summary-lbl { font-size: 11px; color: #6b7280; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
    .section-title { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 10px; margin-top: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
    .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; }
    .bar-label { font-size: 12px; width: 110px; flex-shrink: 0; font-weight: 500; }
    .bar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
    .bar-fill  { height: 100%; border-radius: 999px; }
    .bar-count { font-size: 12px; color: #6b7280; width: 40px; text-align: right; flex-shrink: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    thead tr { background: #f8fafc; }
    th { padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; border-bottom: 1px solid #e5e7eb; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
  </head><body>
  <div class="header">
    <div>
      <div class="title">Tasks Report</div>
      <div class="subtitle">BFMO Facility Management System</div>
    </div>
    <div class="meta">
      <div>Printed: ${new Date().toLocaleString("en-PH", { dateStyle:"long", timeStyle:"short" })}</div>
      <div style="margin-top:3px;">${total} task${total !== 1 ? "s" : ""} shown</div>
    </div>
  </div>

  ${activeFilters ? `<div class="filters-row">Active filters: ${activeFilters}</div>` : ""}

  <div class="summary-grid">
    <div class="summary-card" style="border-top:3px solid #2563eb;">
      <div class="summary-num" style="color:#2563eb;">${total}</div>
      <div class="summary-lbl">Total Tasks</div>
    </div>
    <div class="summary-card" style="border-top:3px solid #28A745;">
      <div class="summary-num" style="color:#28A745;">${resolved}</div>
      <div class="summary-lbl">Resolved</div>
    </div>
    <div class="summary-card" style="border-top:3px solid #FFA500;">
      <div class="summary-num" style="color:#FFA500;">${tasks.filter(t=>(t.status||"Pending")==="Pending").length}</div>
      <div class="summary-lbl">Pending</div>
    </div>
    <div class="summary-card" style="border-top:3px solid #22c55e;">
      <div class="summary-num" style="color:#22c55e;">${rate}%</div>
      <div class="summary-lbl">Completion Rate</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
    <div>
      <div class="section-title">By Status</div>
      ${byStatus.map(s => `
        <div class="bar-row">
          <span class="bar-label" style="color:${s.color};">${s.name}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${total>0?Math.round((s.count/total)*100):0}%;background:${s.color};"></div></div>
          <span class="bar-count">${s.count}</span>
        </div>`).join("")}
    </div>
    <div>
      <div class="section-title">By Priority</div>
      ${byPriority.map(p => `
        <div class="bar-row">
          <span class="bar-label" style="color:${p.color};">${p.name}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${total>0?Math.round((p.count/total)*100):0}%;background:${p.color};"></div></div>
          <span class="bar-count">${p.count}</span>
        </div>`).join("")}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Task</th><th>Status</th><th>Priority</th><th>Assigned Staff</th>
        <th>Discipline</th><th>Progress</th><th>Created</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <span>BFMO Report System — Auto-generated</span>
    <span>Total: ${total} tasks</span>
  </div>

  <script>window.onload = () => { window.print(); }<\/script>
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
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

  /* ── Search (debounced) ── */
  const [searchInput,    setSearchInput]    = useState("");
  const searchQuery = useDebounce(searchInput, 200);
  const isTyping    = searchInput !== searchQuery;

  /* ── Filters ── */
  const [statusFilter,     setStatusFilter]     = useState("All");
  const [priorityFilter,   setPriorityFilter]   = useState("All");
  const [disciplineFilter, setDisciplineFilter] = useState("All");
  const [staffFilter,      setStaffFilter]      = useState("All");

  /* ── Date filter ── */
  const [datePreset,  setDatePreset]  = useState<DatePreset>("all");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  /* ── View mode ── */
  const [viewMode, setViewMode] = useState<"board" | "list" | "analytics">("board");

  /* ── Task detail modal ── */
  const [selectedTask,   setSelectedTask]   = useState<Task | null>(null);
  const [editDraft,      setEditDraft]      = useState<Task | null>(null);
  const [isEditing,      setIsEditing]      = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [checkInput,     setCheckInput]     = useState("");
  const [staffInput,     setStaffInput]     = useState("");

  const { addNotification } = useNotifications();

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

  /* ── Fetch ── */
  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true); setLoadError("");
      const res  = await fetch(`${API_BASE}/api/tasks?userId=${user?.id || "admin"}&ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) { setLoadError(data?.message || "Could not load tasks."); setTasks([]); return; }
      const list: Task[] = Array.isArray(data) ? data : Array.isArray(data.tasks) ? data.tasks : Array.isArray(data.data) ? data.data : [];
      setTasks(list);
    } catch { setLoadError("Network error."); setTasks([]); }
    finally { setIsLoading(false); }
  }, [user?.id]);

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
        : Array.isArray(data?.staff) ? data.staff.map((s: any) => String(s?.name || s?.email || s || "")).filter(Boolean) : [];
      if (list.length > 0) setMetaStaff(list);
    } catch {}
  }, []);

  useEffect(() => {
    if (!canView) return;
    fetchTasks(); fetchMeta();
  }, [canView, fetchTasks, fetchMeta]);

  /* ── Color helpers ── */
  const getPriorityColor = useCallback((name?: string) =>
    metaPriorities.find(p => p.name === name)?.color || "#6C757D", [metaPriorities]);
  const getStatusColor = useCallback((name?: string) =>
    metaStatuses.find(s => s.name === name)?.color || "#6C757D", [metaStatuses]);

  /* ── Derived filter options ── */
  const disciplineOptions = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach(t => { if (t.concernType) s.add(t.concernType); });
    return Array.from(s).sort();
  }, [tasks]);

  const staffOptions = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach(t => (t.assignedStaff || []).forEach(n => s.add(n)));
    metaStaff.forEach(n => s.add(n));
    return Array.from(s).sort();
  }, [tasks, metaStaff]);

  /* ── Effective date range ── */
  const effectiveDateRange = useMemo(() => {
    if (datePreset === "custom") return dateFrom || dateTo ? { from: dateFrom, to: dateTo } : null;
    return getPresetRange(datePreset);
  }, [datePreset, dateFrom, dateTo]);

  /* ── Priority counts (all tasks, pre-filter) ── */
  const priorityCounts = useMemo(() => tasks.reduce<Record<string, number>>((acc, t) => {
    const k = t.priority || "";
    if (k) acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {}), [tasks]);

  /* ── Filtered tasks ── */
  const filteredTasks = useMemo(() => tasks.filter(t => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q ||
      (t.name || "").toLowerCase().includes(q) ||
      (t.reportId || "").toLowerCase().includes(q) ||
      (t.concernType || "").toLowerCase().includes(q) ||
      (t.createdBy || "").toLowerCase().includes(q) ||
      (t.assignedStaff || []).some(s => s.toLowerCase().includes(q));

    const matchStatus     = statusFilter     === "All" || (t.status || "Pending") === statusFilter;
    const matchPriority   = priorityFilter   === "All" ? true
      : priorityFilter === "__none__" ? !t.priority
      : (t.priority || "") === priorityFilter;
    const matchDiscipline = disciplineFilter === "All" || (t.concernType || "") === disciplineFilter;
    const matchStaff      = staffFilter      === "All" || (t.assignedStaff || []).includes(staffFilter);

    let matchDate = true;
    if (effectiveDateRange) {
      const created = t.createdAt ? new Date(t.createdAt) : null;
      if (created) {
        if (effectiveDateRange.from) matchDate = matchDate && created >= new Date(effectiveDateRange.from + "T00:00:00");
        if (effectiveDateRange.to)   matchDate = matchDate && created <= new Date(effectiveDateRange.to   + "T23:59:59");
      } else {
        matchDate = false;
      }
    }

    return matchSearch && matchStatus && matchPriority && matchDiscipline && matchStaff && matchDate;
  }), [tasks, searchQuery, statusFilter, priorityFilter, disciplineFilter, staffFilter, effectiveDateRange]);

  const hasActiveFilters =
    statusFilter !== "All" || priorityFilter !== "All" ||
    disciplineFilter !== "All" || staffFilter !== "All" ||
    datePreset !== "all" || !!searchInput.trim();

  const clearAllFilters = () => {
    setSearchInput(""); setStatusFilter("All"); setPriorityFilter("All");
    setDisciplineFilter("All"); setStaffFilter("All");
    setDatePreset("all"); setDateFrom(""); setDateTo("");
  };

  /* ── Board columns ── */
  const boardColumns = metaStatuses
    .filter(s => s.name.toLowerCase() !== "archived")
    .map(s => ({ ...s, tasks: filteredTasks.filter(t => (t.status || "Pending") === s.name) }));

  /* ── Analytics ── */
  const analytics = useMemo(() => {
    const total      = filteredTasks.length;
    const resolved   = filteredTasks.filter(t => (t.status || "").toLowerCase() === "resolved").length;
    const pending    = filteredTasks.filter(t => (t.status || "Pending").toLowerCase() === "pending").length;
    const inProgress = filteredTasks.filter(t => (t.status || "").toLowerCase() === "in progress").length;
    const rate       = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const byDisc: Record<string, number> = {};
    filteredTasks.forEach(t => { const d = t.concernType || "Other"; byDisc[d] = (byDisc[d] || 0) + 1; });
    const byPriority: Record<string, number> = {};
    filteredTasks.forEach(t => { const p = t.priority || "None"; byPriority[p] = (byPriority[p] || 0) + 1; });
    const byStaff: Record<string, number> = {};
    filteredTasks.forEach(t => (t.assignedStaff || []).forEach(s => { byStaff[s] = (byStaff[s] || 0) + 1; }));
    const avgProgress = total > 0
      ? Math.round(filteredTasks.reduce((sum, t) => sum + (calcProgress(t.checklist) ?? 0), 0) / total)
      : 0;
    return { total, resolved, pending, inProgress, rate, byDisc, byPriority, byStaff, avgProgress };
  }, [filteredTasks]);

  /* ── Task detail ── */
  const openTask  = (task: Task) => { setSelectedTask(task); setIsEditing(false); setEditDraft(null); setCheckInput(""); setStaffInput(""); };
  const closeTask = () => { setSelectedTask(null); setIsEditing(false); setEditDraft(null); };

  /* ── Edit ── */
  const startEdit  = () => {
    if (!selectedTask) return;
    setEditDraft({ ...selectedTask, checklist: (selectedTask.checklist || []).map(i => ({ ...i })), assignedStaff: [...(selectedTask.assignedStaff || [])] });
    setIsEditing(true);
  };
  const cancelEdit = () => { setIsEditing(false); setEditDraft(null); };

  const saveEdit = async () => {
    if (!editDraft || !selectedTask) return;
    try {
      setSaving(true);
      const res  = await fetch(`${API_BASE}/api/tasks/${selectedTask._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editDraft, updatedBy: user?.fullName || "Admin" }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      const updated = data.task as Task;
      setTasks(p => p.map(t => t._id === updated._id ? updated : t));
      setSelectedTask(updated); setIsEditing(false); setEditDraft(null);
      showToast("Task updated.", "success");
    } catch (err: any) { showToast(err.message || "Failed.", "error"); }
    finally { setSaving(false); }
  };

  const updateTaskStatus = async (task: Task, newStatus: string) => {
    try {
      const res  = await fetch(`${API_BASE}/api/tasks/${task._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus, updatedBy: user?.fullName || "Admin" }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      const updated = data.task as Task;
      setTasks(p => p.map(t => t._id === updated._id ? updated : t));
      if (selectedTask?._id === updated._id) setSelectedTask(updated);
      addNotification(`Status of "${task.name}" changed to "${newStatus}".`, "status");
      showToast(`Status moved to "${newStatus}".`, "success");
    } catch (err: any) { showToast(err.message || "Failed.", "error"); }
  };

  const toggleChecklist = async (task: Task, itemId: string) => {
    const updated = { ...task, checklist: (task.checklist || []).map(i => (i.id === itemId || i._id === itemId) ? { ...i, done: !i.done } : i) };
    try {
      const res  = await fetch(`${API_BASE}/api/tasks/${task._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checklist: updated.checklist, updatedBy: user?.fullName || "Admin" }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      const t = data.task as Task;
      setTasks(p => p.map(x => x._id === t._id ? t : x));
      if (selectedTask?._id === t._id) setSelectedTask(t);
    } catch { showToast("Failed to update checklist.", "error"); }
  };

  const deleteTask = (task: Task) => {
    confirmCallbackRef.current = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tasks/${task._id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        setTasks(p => p.filter(t => t._id !== task._id));
        if (selectedTask?._id === task._id) closeTask();
        showToast("Task deleted.", "success");
      } catch { showToast("Failed.", "error"); }
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

  const editAddStaff = () => {
    if (!editDraft) return;
    const v = staffInput.trim();
    if (v && !(editDraft.assignedStaff || []).includes(v)) setEditDraft(d => d ? { ...d, assignedStaff: [...(d.assignedStaff || []), v] } : d);
    setStaffInput("");
  };
  const editRemoveStaff      = (name: string) => setEditDraft(d => d ? { ...d, assignedStaff: (d.assignedStaff || []).filter(s => s !== name) } : d);
  const editAddChecklist     = () => { if (!editDraft) return; const v = checkInput.trim(); if (!v) return; setEditDraft(d => d ? { ...d, checklist: [...(d.checklist || []), { id: uid(), text: v, done: false }] } : d); setCheckInput(""); };
  const editToggleChecklist  = (id: string) => setEditDraft(d => d ? { ...d, checklist: (d.checklist || []).map(i => (i.id === id || i._id === id) ? { ...i, done: !i.done } : i) } : d);
  const editRemoveChecklist  = (id: string) => setEditDraft(d => d ? { ...d, checklist: (d.checklist || []).filter(i => i.id !== id && i._id !== id) } : d);

  /* ── Print handler ── */
  const handlePrint = () => {
    const activeFiltersMap: Record<string, string> = {};
    if (searchQuery)           activeFiltersMap["Search"]     = searchQuery;
    if (statusFilter !== "All")   activeFiltersMap["Status"]     = statusFilter;
    if (priorityFilter !== "All") activeFiltersMap["Priority"]   = priorityFilter === "__none__" ? "No Priority" : priorityFilter;
    if (disciplineFilter !== "All") activeFiltersMap["Discipline"] = disciplineFilter;
    if (staffFilter !== "All")    activeFiltersMap["Staff"]       = staffFilter;
    if (datePreset !== "all") {
      if (effectiveDateRange?.from || effectiveDateRange?.to) {
        activeFiltersMap["Date"] = `${effectiveDateRange?.from || "…"} → ${effectiveDateRange?.to || "…"}`;
      }
    }
    printTasks(filteredTasks, activeFiltersMap, metaStatuses, metaPriorities);
  };

  /* ── Guards ── */
  if (!isLoaded || !canView) {
    return (
      <div className="tasks-wrapper">
        <div className="tasks-inner">
          <div className="tasks-shimmer-grid">{[...Array(6)].map((_, i) => <div key={i} className="tasks-shimmer-card" />)}</div>
        </div>
      </div>
    );
  }

  const activeTask    = isEditing ? editDraft : selectedTask;
  const progress      = calcProgress(activeTask?.checklist);
  const priorityColor = getPriorityColor(activeTask?.priority);
  const statusColor   = getStatusColor(activeTask?.status);

  const DATE_PRESETS: { value: DatePreset; label: string }[] = [
    { value: "all",     label: "All time"      },
    { value: "today",   label: "Today"         },
    { value: "week",    label: "Last 7 days"   },
    { value: "month",   label: "Last 30 days"  },
    { value: "quarter", label: "Last 3 months" },
    { value: "custom",  label: "Custom range"  },
  ];

  /* ══════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="tasks-wrapper">
        <div className="tasks-inner">

          {/* ── Page header ── */}
          <div className="tasks-page-header">
            <div>
              <h1 className="tasks-page-title">Tasks &amp; Lists</h1>
              <p className="tasks-page-subtitle">Track all maintenance tasks created from facility reports.</p>
            </div>
            <div className="tasks-header-actions">
              {/* View toggles */}
              {(["board","list","analytics"] as const).map(mode => (
                <button key={mode} type="button"
                  className={`tasks-view-btn${viewMode === mode ? " tasks-view-btn--active" : ""}`}
                  onClick={() => setViewMode(mode)} title={`${mode.charAt(0).toUpperCase()+mode.slice(1)} view`}>
                  {mode === "board" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>}
                  {mode === "list"  && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                  {mode === "analytics" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
                </button>
              ))}

              {/* Print button */}
              <button type="button" className="tasks-view-btn" onClick={handlePrint} title="Print report"
                style={{ gap: 5, paddingInline: 10, width: "auto", fontSize: "0.75rem", fontWeight: 600 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
              </div>
              <div className="tasks-stat-info">
                <span className="tasks-stat-num">{tasks.length}</span>
                <span className="tasks-stat-lbl">Total</span>
              </div>
            </div>
            {metaStatuses.filter(s => s.name.toLowerCase() !== "archived").map(s => (
              <div key={s.id} className="tasks-stat">
                <div className="tasks-stat-icon" style={{ background: s.color + "18", color: s.color }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/></svg>
                </div>
                <div className="tasks-stat-info">
                  <span className="tasks-stat-num" style={{ color: s.color }}>{tasks.filter(t => (t.status||"Pending")===s.name).length}</span>
                  <span className="tasks-stat-lbl">{s.name}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Priority chips ── */}
          <div className="tasks-priority-bar">
            <button type="button"
              className={`tasks-priority-chip${priorityFilter === "All" ? " tasks-priority-chip--all-active" : ""}`}
              style={{ "--chip-color": "#2563eb" } as React.CSSProperties}
              onClick={() => setPriorityFilter("All")}>
              All Tasks <span className="tasks-priority-chip-count">{tasks.length}</span>
            </button>
            {metaPriorities.map(p => {
              const count    = priorityCounts[p.name] || 0;
              const isActive = priorityFilter === p.name;
              return (
                <button key={p.id} type="button"
                  className={`tasks-priority-chip${isActive ? " tasks-priority-chip--active" : ""}`}
                  style={{ "--chip-color": p.color } as React.CSSProperties}
                  onClick={() => setPriorityFilter(isActive ? "All" : p.name)}>
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
                  onClick={() => setPriorityFilter(isActive ? "All" : "__none__")}>
                  <span className="tasks-priority-chip-dot" style={{ backgroundColor: "#6b7280" }} />
                  No Priority <span className="tasks-priority-chip-count">{noneCount}</span>
                </button>
              ) : null;
            })()}
          </div>

          {/* ── Filters row ── */}
          <div className="tasks-filters">

            {/* Debounced search */}
            <div className="tasks-search-wrap">
              {isTyping ? (
                <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", display:"flex", gap:2, alignItems:"center" }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width:4, height:4, borderRadius:"50%", backgroundColor:"var(--tasks-accent,#2563eb)", animation:`tasks-bounce 0.8s ease-in-out ${i*0.15}s infinite` }} />
                  ))}
                </span>
              ) : (
                <svg viewBox="0 0 24 24" className="tasks-search-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              )}
              <input type="text" className="tasks-search"
                placeholder="Search tasks, staff, report ID…"
                value={searchInput} onChange={e => setSearchInput(e.target.value)} />
              {searchInput && <button type="button" className="tasks-search-clear" onClick={() => setSearchInput("")}>✕</button>}
            </div>

            <div className="tasks-filters-divider" />

            {/* Status */}
            <select className="tasks-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              {metaStatuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>

            {/* Priority */}
            <select className="tasks-filter-select" value={priorityFilter === "__none__" ? "__none__" : priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="All">All Priorities</option>
              {metaPriorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              <option value="__none__">No Priority</option>
            </select>

            {/* Discipline */}
            {disciplineOptions.length > 0 && (
              <select className="tasks-filter-select" value={disciplineFilter} onChange={e => setDisciplineFilter(e.target.value)}>
                <option value="All">All Disciplines</option>
                {disciplineOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}

            {/* Staff */}
            {staffOptions.length > 0 && (
              <select className="tasks-filter-select" value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
                <option value="All">All Staff</option>
                {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}

            {/* ── Date filter ── */}
            <div style={{ position: "relative" }}>
              <button type="button"
                onClick={() => setShowDatePicker(v => !v)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 12px",
                  border: `1px solid ${datePreset !== "all" ? "var(--tasks-accent,#2563eb)" : "var(--tasks-border,#e8ecf0)"}`,
                  borderRadius: "var(--tasks-radius-md,10px)",
                  background: datePreset !== "all" ? "var(--tasks-accent-bg,rgba(37,99,235,0.08))" : "var(--tasks-surface-2,#f8fafc)",
                  color: datePreset !== "all" ? "var(--tasks-accent,#2563eb)" : "var(--tasks-text-2,#4a5568)",
                  fontSize: "0.81rem", fontWeight: datePreset !== "all" ? 600 : 400,
                  cursor: "pointer", whiteSpace: "nowrap",
                  fontFamily: "var(--tasks-font,inherit)",
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {datePreset === "all"    ? "Date range" :
                 datePreset === "custom" ? (dateFrom || dateTo ? `${dateFrom||"…"} → ${dateTo||"…"}` : "Custom") :
                 DATE_PRESETS.find(p => p.value === datePreset)?.label}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showDatePicker && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
                  background: "var(--tasks-surface,#fff)", border: "1px solid var(--tasks-border-2,#d1d9e0)",
                  borderRadius: 12, boxShadow: "var(--tasks-shadow-lg)", padding: 14, minWidth: 240,
                }}>
                  {/* Preset pills */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {DATE_PRESETS.filter(p => p.value !== "custom").map(p => (
                      <button key={p.value} type="button"
                        onClick={() => { setDatePreset(p.value as DatePreset); if (p.value !== "custom") { setDateFrom(""); setDateTo(""); setShowDatePicker(false); } }}
                        style={{
                          padding: "4px 11px", borderRadius: 999,
                          border: `1.5px solid ${datePreset === p.value ? "var(--tasks-accent,#2563eb)" : "var(--tasks-border,#e8ecf0)"}`,
                          background: datePreset === p.value ? "var(--tasks-accent-bg,rgba(37,99,235,0.08))" : "transparent",
                          color: datePreset === p.value ? "var(--tasks-accent,#2563eb)" : "var(--tasks-text-2,#4a5568)",
                          fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                          fontFamily: "var(--tasks-font,inherit)",
                        }}>
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom range inputs */}
                  <div style={{ borderTop: "1px solid var(--tasks-border,#e8ecf0)", paddingTop: 10 }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--tasks-text-3,#8a97a8)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                      Custom Range
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDatePreset("custom"); }}
                        style={{ flex: 1, padding: "6px 8px", border: "1px solid var(--tasks-border,#e8ecf0)", borderRadius: 7, fontSize: "0.78rem", background: "var(--tasks-surface-2,#f8fafc)", color: "var(--tasks-text-1,#0d1b2a)", outline: "none", fontFamily: "inherit" }} />
                      <span style={{ color: "var(--tasks-text-3,#8a97a8)", fontSize: "0.75rem" }}>to</span>
                      <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDatePreset("custom"); }}
                        style={{ flex: 1, padding: "6px 8px", border: "1px solid var(--tasks-border,#e8ecf0)", borderRadius: 7, fontSize: "0.78rem", background: "var(--tasks-surface-2,#f8fafc)", color: "var(--tasks-text-1,#0d1b2a)", outline: "none", fontFamily: "inherit" }} />
                    </div>
                    {(dateFrom || dateTo) && (
                      <button type="button"
                        onClick={() => { setDatePreset("custom"); setShowDatePicker(false); }}
                        style={{ marginTop: 8, width: "100%", padding: "6px", borderRadius: 7, border: "none", background: "var(--tasks-accent,#2563eb)", color: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Apply
                      </button>
                    )}
                  </div>

                  {datePreset !== "all" && (
                    <button type="button"
                      onClick={() => { setDatePreset("all"); setDateFrom(""); setDateTo(""); setShowDatePicker(false); }}
                      style={{ marginTop: 8, width: "100%", padding: "5px", borderRadius: 7, border: "1px solid var(--tasks-border,#e8ecf0)", background: "transparent", color: "var(--tasks-text-3,#8a97a8)", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}>
                      Clear date filter
                    </button>
                  )}
                </div>
              )}
            </div>

            {hasActiveFilters && (
              <button type="button" className="tasks-clear-filters" onClick={clearAllFilters}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Clear all
              </button>
            )}
          </div>

          {/* ── Active filter badges ── */}
          {(disciplineFilter !== "All" || staffFilter !== "All" || datePreset !== "all") && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {disciplineFilter !== "All" && (
                <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:"0.73rem", fontWeight:600, color:"#7c3aed", background:"rgba(124,58,237,0.08)", border:"1px solid rgba(124,58,237,0.25)", borderRadius:999, padding:"3px 10px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  {disciplineFilter}
                  <button type="button" onClick={() => setDisciplineFilter("All")} style={{ background:"none", border:"none", cursor:"pointer", color:"#7c3aed", fontSize:11, padding:0, lineHeight:1 }}>✕</button>
                </span>
              )}
              {staffFilter !== "All" && (
                <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:"0.73rem", fontWeight:600, color:"#0369a1", background:"rgba(3,105,161,0.08)", border:"1px solid rgba(3,105,161,0.25)", borderRadius:999, padding:"3px 10px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  {staffFilter}
                  <button type="button" onClick={() => setStaffFilter("All")} style={{ background:"none", border:"none", cursor:"pointer", color:"#0369a1", fontSize:11, padding:0, lineHeight:1 }}>✕</button>
                </span>
              )}
              {datePreset !== "all" && (
                <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:"0.73rem", fontWeight:600, color:"#0f766e", background:"rgba(15,118,110,0.08)", border:"1px solid rgba(15,118,110,0.25)", borderRadius:999, padding:"3px 10px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {datePreset === "custom" ? `${dateFrom||"…"} → ${dateTo||"…"}` : DATE_PRESETS.find(p=>p.value===datePreset)?.label}
                  <button type="button" onClick={() => { setDatePreset("all"); setDateFrom(""); setDateTo(""); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#0f766e", fontSize:11, padding:0, lineHeight:1 }}>✕</button>
                </span>
              )}
            </div>
          )}

          {loadError && <div className="tasks-error-banner">{loadError} <button type="button" onClick={fetchTasks}>Retry</button></div>}
          {isLoading  && <div className="tasks-shimmer-grid">{[...Array(6)].map((_, i) => <div key={i} className="tasks-shimmer-card" />)}</div>}

          {!isLoading && filteredTasks.length === 0 && !loadError && viewMode !== "analytics" && (
            <div className="tasks-empty">
              <div className="tasks-empty-icon">
                <svg viewBox="0 0 64 64" fill="none" width="28" height="28"><rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="2"/><path d="M22 32h20M32 22v20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <p>No tasks found.</p>
              <span>{hasActiveFilters ? "Try adjusting your filters." : "Tasks created from reports will appear here."}</span>
            </div>
          )}

          {/* ══ ANALYTICS VIEW ══ */}
          {viewMode === "analytics" && (
            <div style={{ paddingTop: 8 }}>
              {/* Summary cards */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:20 }}>
                {[
                  { label:"Total Tasks",     value:analytics.total,             color:"#2563eb" },
                  { label:"Resolved",        value:analytics.resolved,          color:"#28A745" },
                  { label:"In Progress",     value:analytics.inProgress,        color:"#4169E1" },
                  { label:"Pending",         value:analytics.pending,           color:"#FFA500" },
                  { label:"Completion Rate", value:`${analytics.rate}%`,        color:"#22c55e" },
                  { label:"Avg. Progress",   value:`${analytics.avgProgress}%`, color:"#8b5cf6" },
                ].map(card => (
                  <div key={card.label} style={{ background:"var(--tasks-surface)", borderRadius:12, padding:"16px", boxShadow:"var(--tasks-shadow-sm)", textAlign:"center", borderTop:`3px solid ${card.color}`, border:"1px solid var(--tasks-border)" }}>
                    <div style={{ fontSize:26, fontWeight:700, color:card.color }}>{card.value}</div>
                    <div style={{ fontSize:11, color:"var(--tasks-text-3)", marginTop:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>{card.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                {/* By Priority */}
                <div style={{ background:"var(--tasks-surface)", borderRadius:12, padding:18, boxShadow:"var(--tasks-shadow-sm)", border:"1px solid var(--tasks-border)" }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:14, color:"var(--tasks-text-1)", textTransform:"uppercase", letterSpacing:"0.05em" }}>By Priority</div>
                  {metaPriorities.map(p => {
                    const count = analytics.byPriority[p.name] || 0;
                    const pct   = analytics.total > 0 ? Math.round((count/analytics.total)*100) : 0;
                    return (
                      <div key={p.id} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                          <span style={{ color:p.color, fontWeight:600 }}>{p.name}</span>
                          <span style={{ fontWeight:600, color:"var(--tasks-text-2)" }}>{count} <span style={{ color:"var(--tasks-text-4)", fontWeight:400 }}>({pct}%)</span></span>
                        </div>
                        <div style={{ height:7, background:"var(--tasks-border)", borderRadius:999, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:p.color, borderRadius:999, transition:"width 0.4s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* By Status */}
                <div style={{ background:"var(--tasks-surface)", borderRadius:12, padding:18, boxShadow:"var(--tasks-shadow-sm)", border:"1px solid var(--tasks-border)" }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:14, color:"var(--tasks-text-1)", textTransform:"uppercase", letterSpacing:"0.05em" }}>By Status</div>
                  {metaStatuses.filter(s=>s.name.toLowerCase()!=="archived").map(s => {
                    const count = filteredTasks.filter(t=>(t.status||"Pending")===s.name).length;
                    const pct   = analytics.total > 0 ? Math.round((count/analytics.total)*100) : 0;
                    return (
                      <div key={s.id} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                          <span style={{ color:s.color, fontWeight:600 }}>{s.name}</span>
                          <span style={{ fontWeight:600, color:"var(--tasks-text-2)" }}>{count} <span style={{ color:"var(--tasks-text-4)", fontWeight:400 }}>({pct}%)</span></span>
                        </div>
                        <div style={{ height:7, background:"var(--tasks-border)", borderRadius:999, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:s.color, borderRadius:999, transition:"width 0.4s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                {/* By Discipline */}
                <div style={{ background:"var(--tasks-surface)", borderRadius:12, padding:18, boxShadow:"var(--tasks-shadow-sm)", border:"1px solid var(--tasks-border)" }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:14, color:"var(--tasks-text-1)", textTransform:"uppercase", letterSpacing:"0.05em" }}>By Discipline</div>
                  {Object.entries(analytics.byDisc).length === 0 && <p style={{ color:"var(--tasks-text-4)", fontSize:13 }}>No data yet.</p>}
                  {Object.entries(analytics.byDisc).sort(([,a],[,b])=>b-a).map(([disc, count]) => (
                    <div key={disc} style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                        <span style={{ color:"var(--tasks-text-2)", fontWeight:500 }}>{disc}</span>
                        <span style={{ fontWeight:600, color:"var(--tasks-text-2)" }}>{count}</span>
                      </div>
                      <div style={{ height:7, background:"var(--tasks-border)", borderRadius:999, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${analytics.total>0?Math.round((count/analytics.total)*100):0}%`, background:"#7c3aed", borderRadius:999 }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* By Staff (top 8) */}
                <div style={{ background:"var(--tasks-surface)", borderRadius:12, padding:18, boxShadow:"var(--tasks-shadow-sm)", border:"1px solid var(--tasks-border)" }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:14, color:"var(--tasks-text-1)", textTransform:"uppercase", letterSpacing:"0.05em" }}>By Staff</div>
                  {Object.entries(analytics.byStaff).length === 0 && <p style={{ color:"var(--tasks-text-4)", fontSize:13 }}>No data yet.</p>}
                  {Object.entries(analytics.byStaff).sort(([,a],[,b])=>b-a).slice(0,8).map(([name, count]) => (
                    <div key={name} style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                        <span style={{ color:"var(--tasks-text-2)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"70%" }}>{name}</span>
                        <span style={{ fontWeight:600, color:"var(--tasks-text-2)" }}>{count}</span>
                      </div>
                      <div style={{ height:7, background:"var(--tasks-border)", borderRadius:999, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${analytics.total>0?Math.round((count/analytics.total)*100):0}%`, background:"#0369a1", borderRadius:999 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Completion rate bar */}
              <div style={{ background:"var(--tasks-surface)", borderRadius:12, padding:18, boxShadow:"var(--tasks-shadow-sm)", border:"1px solid var(--tasks-border)", marginTop:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <span style={{ fontWeight:700, fontSize:13, color:"var(--tasks-text-1)" }}>Overall Completion Rate</span>
                  <span style={{ fontWeight:700, color:"#22c55e" }}>{analytics.rate}%</span>
                </div>
                <div style={{ height:12, background:"var(--tasks-border)", borderRadius:999, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${analytics.rate}%`, background:"#22c55e", borderRadius:999, transition:"width 0.5s" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                  <span style={{ fontSize:11, color:"var(--tasks-text-3)" }}>{analytics.resolved} resolved of {analytics.total} total</span>
                  <span style={{ fontSize:11, color:"var(--tasks-text-3)" }}>Avg. checklist: {analytics.avgProgress}%</span>
                </div>
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
                              {task.priority && <span className="tasks-card-priority" style={{ color:pColor, backgroundColor:pColor+"18", border:`1px solid ${pColor}40` }}>{task.priority}</span>}
                            </div>
                            {task.reportId && <p className="tasks-card-report-id"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>#{task.reportId}</p>}
                            {task.concernType && <p className="tasks-card-concern">{task.concernType}</p>}
                            {task.assignedStaff && task.assignedStaff.length > 0 && (
                              <div className="tasks-card-staff">
                                {task.assignedStaff.slice(0,3).map(s => <span key={s} className="tasks-card-avatar" title={s}>{s.charAt(0).toUpperCase()}</span>)}
                                {task.assignedStaff.length > 3 && <span className="tasks-card-avatar tasks-card-avatar--more">+{task.assignedStaff.length-3}</span>}
                              </div>
                            )}
                            {prog !== null && (
                              <div className="tasks-card-progress">
                                <div className="tasks-card-progress-bar"><div className="tasks-card-progress-fill" style={{ width:`${prog}%`, backgroundColor:prog===100?"#22c55e":pColor }} /></div>
                                <span className="tasks-card-progress-pct">{prog}%</span>
                              </div>
                            )}
                            <div className="tasks-card-footer">
                              <span className="tasks-card-time">{getRelativeTime(task.createdAt)}</span>
                              <div className="tasks-card-actions" onClick={e => e.stopPropagation()}>
                                {metaStatuses.filter(s=>s.name!==col.name&&s.name.toLowerCase()!=="archived").slice(0,2).map(s => (
                                  <button key={s.id} type="button" className="tasks-card-move-btn" style={{ color:s.color, borderColor:s.color+"40" }} onClick={() => updateTaskStatus(task, s.name)}>→ {s.name.split(" ")[0]}</button>
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

          {/* ══ LIST VIEW ══ */}
          {!isLoading && filteredTasks.length > 0 && viewMode === "list" && (
            <div className="tasks-list-view">
              <div className="tasks-list-header-row">
                <span>Task</span><span>Status</span><span>Priority</span>
                <span>Progress</span><span>Staff</span><span>Created</span><span></span>
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
                        {task.reportId && <p className="tasks-list-sub">#{task.reportId} · {task.concernType||""}</p>}
                      </div>
                    </div>
                    <span><span className="tasks-status-pill" style={{ backgroundColor:sColor+"20", color:sColor, border:`1px solid ${sColor}40` }}>{task.status||"Pending"}</span></span>
                    <span>{task.priority ? <span className="tasks-status-pill" style={{ backgroundColor:pColor+"20", color:pColor, border:`1px solid ${pColor}40` }}>{task.priority}</span> : <span className="tasks-list-na">—</span>}</span>
                    <span>{prog !== null ? <div className="tasks-list-progress"><div className="tasks-list-progress-bar"><div className="tasks-list-progress-fill" style={{ width:`${prog}%`, backgroundColor:prog===100?"#22c55e":pColor }} /></div><span className="tasks-list-progress-pct">{prog}%</span></div> : <span className="tasks-list-na">—</span>}</span>
                    <span>{task.assignedStaff && task.assignedStaff.length > 0 ? <div className="tasks-card-staff">{task.assignedStaff.slice(0,3).map(s=><span key={s} className="tasks-card-avatar" title={s}>{s.charAt(0).toUpperCase()}</span>)}{task.assignedStaff.length>3&&<span className="tasks-card-avatar tasks-card-avatar--more">+{task.assignedStaff.length-3}</span>}</div> : <span className="tasks-list-na">—</span>}</span>
                    <span className="tasks-list-time">{getRelativeTime(task.createdAt)}</span>
                    <span onClick={e=>e.stopPropagation()}>
                      <button type="button" className="tasks-list-delete-btn" onClick={() => deleteTask(task)} title="Delete">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* ══ TASK DETAIL MODAL ══ */}
      {mounted && selectedTask && createPortal(
        <div className="tasks-modal-backdrop" onClick={closeTask} role="dialog" aria-modal="true">
          <div className="tasks-modal" onClick={e => e.stopPropagation()}>
            <div className="tasks-modal-header" style={{ borderTop:`4px solid ${priorityColor}` }}>
              <div className="tasks-modal-header-left">
                {isEditing
                  ? <input type="text" className="tasks-modal-title-input" value={editDraft?.name||""} onChange={e=>setEditDraft(d=>d?{...d,name:e.target.value}:d)}/>
                  : <h2 className="tasks-modal-title">{selectedTask.name}</h2>}
                {selectedTask.reportId && <span className="tasks-modal-report-badge">#{selectedTask.reportId}</span>}
              </div>
              <div className="tasks-modal-header-right">
                {!isEditing && <button type="button" className="tasks-modal-edit-btn" onClick={startEdit}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit</button>}
                {!isEditing && <button type="button" className="tasks-modal-delete-btn" onClick={()=>deleteTask(selectedTask)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>}
                <button type="button" className="tasks-modal-close" onClick={closeTask}>✕</button>
              </div>
            </div>
            <div className="tasks-modal-body">
              <div className="tasks-modal-left">
                <div className="tasks-modal-meta-row">
                  {isEditing ? (
                    <>
                      <div className="tasks-modal-field"><label className="tasks-modal-label">Status</label><select className="tasks-modal-select" value={editDraft?.status||"Pending"} onChange={e=>setEditDraft(d=>d?{...d,status:e.target.value}:d)}>{metaStatuses.filter(s=>s.name.toLowerCase()!=="archived").map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                      <div className="tasks-modal-field"><label className="tasks-modal-label">Priority</label><select className="tasks-modal-select" value={editDraft?.priority||""} onChange={e=>setEditDraft(d=>d?{...d,priority:e.target.value}:d)}><option value="">None</option>{metaPriorities.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
                    </>
                  ) : (
                    <>
                      <span className="tasks-meta-pill" style={{ backgroundColor:statusColor+"20", color:statusColor, border:`1px solid ${statusColor}40` }}>{selectedTask.status||"Pending"}</span>
                      {selectedTask.priority && <span className="tasks-meta-pill" style={{ backgroundColor:priorityColor+"20", color:priorityColor, border:`1px solid ${priorityColor}40` }}>{selectedTask.priority}</span>}
                      {selectedTask.concernType && <span className="tasks-meta-pill tasks-meta-pill--neutral">{selectedTask.concernType}</span>}
                    </>
                  )}
                </div>
                {isEditing && <div className="tasks-modal-field"><label className="tasks-modal-label">Concern Type</label><select className="tasks-modal-select" value={editDraft?.concernType||"Other"} onChange={e=>setEditDraft(d=>d?{...d,concernType:e.target.value}:d)}>{["Mechanical","Civil","Electrical","Safety Hazard","Other"].map(v=><option key={v} value={v}>{v}</option>)}</select></div>}
                {progress !== null && <div className="tasks-modal-progress-section"><div className="tasks-modal-progress-header"><span className="tasks-modal-label">Progress</span><span className="tasks-modal-progress-pct" style={{ color:progress===100?"#22c55e":priorityColor }}>{progress}%</span></div><div className="tasks-modal-progress-bar"><div className="tasks-modal-progress-fill" style={{ width:`${progress}%`, backgroundColor:progress===100?"#22c55e":priorityColor }} /></div></div>}
                <div className="tasks-modal-section">
                  <div className="tasks-modal-section-header"><span className="tasks-modal-label">Checklist{(activeTask?.checklist?.length||0)>0&&<span className="tasks-modal-checklist-count">{(activeTask?.checklist||[]).filter(i=>i.done).length}/{activeTask?.checklist?.length}</span>}</span></div>
                  <div className="tasks-modal-checklist">
                    {(activeTask?.checklist||[]).length===0&&<p className="tasks-modal-empty-hint">No checklist items yet.</p>}
                    {(activeTask?.checklist||[]).map(item=>{const itemId=item.id||item._id||"";return(<div key={itemId} className="tasks-modal-check-item"><button type="button" className={`tasks-check-btn${item.done?" tasks-check-btn--done":""}`} style={item.done?{backgroundColor:priorityColor,borderColor:priorityColor}:{}} onClick={()=>isEditing?editToggleChecklist(itemId):toggleChecklist(selectedTask,itemId)}>{item.done&&<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}</button><span className={`tasks-check-text${item.done?" tasks-check-text--done":""}`}>{item.text}</span>{isEditing&&<button type="button" className="tasks-check-remove" onClick={()=>editRemoveChecklist(itemId)}>✕</button>}</div>);})}
                  </div>
                  {isEditing&&<div className="tasks-modal-input-row"><input type="text" className="tasks-modal-input" value={checkInput} placeholder="Add a step…" onChange={e=>setCheckInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();editAddChecklist();}}}/><button type="button" className="tasks-modal-add-btn" onClick={editAddChecklist} disabled={!checkInput.trim()}>Add</button></div>}
                </div>
                <div className="tasks-modal-section">
                  <span className="tasks-modal-label">Notes</span>
                  {isEditing?<textarea className="tasks-modal-input tasks-modal-textarea" rows={3} value={editDraft?.notes||""} placeholder="Additional notes…" onChange={e=>setEditDraft(d=>d?{...d,notes:e.target.value}:d)}/>:<p className="tasks-modal-notes">{selectedTask.notes||<span className="tasks-modal-empty-hint">No notes.</span>}</p>}
                </div>
              </div>
              <div className="tasks-modal-right">
                <div className="tasks-modal-section">
                  <span className="tasks-modal-label">Assigned Staff</span>
                  <div className="tasks-modal-staff-list">
                    {(activeTask?.assignedStaff||[]).length===0&&<p className="tasks-modal-empty-hint">No staff assigned.</p>}
                    {(activeTask?.assignedStaff||[]).map(name=><div key={name} className="tasks-modal-staff-row"><span className="tasks-modal-staff-avatar" style={{ backgroundColor:priorityColor }}>{name.charAt(0).toUpperCase()}</span><span className="tasks-modal-staff-name">{name}</span>{isEditing&&<button type="button" className="tasks-check-remove" onClick={()=>editRemoveStaff(name)}>✕</button>}</div>)}
                  </div>
                  {isEditing&&<div className="tasks-modal-input-row">{metaStaff.length>0?<select className="tasks-modal-input" value={staffInput} onChange={e=>setStaffInput(e.target.value)}><option value="">-- Select staff --</option>{metaStaff.filter(s=>!(editDraft?.assignedStaff||[]).includes(s)).map(s=><option key={s} value={s}>{s}</option>)}</select>:<input type="text" className="tasks-modal-input" value={staffInput} placeholder="Staff name…" onChange={e=>setStaffInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();editAddStaff();}}}/>}<button type="button" className="tasks-modal-add-btn" onClick={editAddStaff} disabled={!staffInput.trim()}>Add</button></div>}
                </div>
                <div className="tasks-modal-section tasks-modal-info-box">
                  <span className="tasks-modal-label">Task Info</span>
                  <div className="tasks-modal-info-grid">
                    <span className="tasks-info-key">Created by</span><span className="tasks-info-val">{selectedTask.createdBy||"Admin"}</span>
                    <span className="tasks-info-key">Created</span><span className="tasks-info-val">{selectedTask.createdAt?new Date(selectedTask.createdAt).toLocaleString():"—"}</span>
                    <span className="tasks-info-key">Updated</span><span className="tasks-info-val">{selectedTask.updatedAt?new Date(selectedTask.updatedAt).toLocaleString():"—"}</span>
                    {selectedTask.reportId&&<><span className="tasks-info-key">Report</span><span className="tasks-info-val">#{selectedTask.reportId}</span></>}
                  </div>
                </div>
                {!isEditing&&<div className="tasks-modal-section"><span className="tasks-modal-label">Move to</span><div className="tasks-modal-status-grid">{metaStatuses.filter(s=>s.name!==(selectedTask.status||"Pending")&&s.name.toLowerCase()!=="archived").map(s=><button key={s.id} type="button" className="tasks-modal-status-btn" style={{ borderColor:s.color+"60", color:s.color, backgroundColor:s.color+"10" }} onClick={()=>updateTaskStatus(selectedTask,s.name)}>{s.name}</button>)}</div></div>}
              </div>
            </div>
            {isEditing&&<div className="tasks-modal-footer"><button type="button" className="tasks-modal-cancel-btn" onClick={cancelEdit} disabled={saving}>Cancel</button><button type="button" className="tasks-modal-save-btn" onClick={saveEdit} disabled={saving||!editDraft?.name?.trim()} style={{ backgroundColor:priorityColor }}>{saving?"Saving…":"Save Changes"}</button></div>}
          </div>
        </div>, document.body
      )}

      {/* Toasts */}
      {mounted && createPortal(
        <div className="toast-container" aria-live="polite">
          {toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}><span>{t.message}</span><button type="button" onClick={()=>dismissToast(t.id)} className="toast-dismiss">✕</button></div>)}
        </div>, document.body
      )}

      {/* Confirm */}
      {mounted && confirmDialog.open && createPortal(
        <div className="confirm-backdrop" onClick={closeConfirm}>
          <div className="confirm-dialog" onClick={e=>e.stopPropagation()}>
            <p>{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button type="button" className="confirm-cancel-btn" onClick={closeConfirm}>Cancel</button>
              <button type="button" className="confirm-ok-btn" onClick={runConfirm}>Confirm</button>
            </div>
          </div>
        </div>, document.body
      )}

      <style>{`
        @keyframes tasks-bounce {
          0%,100%{transform:translateY(0);opacity:0.4;}
          50%{transform:translateY(-3px);opacity:1;}
        }
      `}</style>
    </>
  );
}