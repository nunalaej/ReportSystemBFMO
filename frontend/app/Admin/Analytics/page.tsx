// Frontend/app/Admin/Analytics.tsx — Redesigned with premium UI
"use client";

import "@/app/Admin/style/analytics.css";

import React, { FC, useState, useEffect, useMemo, useCallback } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) ||
  "http://localhost:5000";

/* ===== Types ===== */
interface Comment { text?: string; comment?: string; at?: string; by?: string; }
interface Report {
  _id?: string; reportId?: string; userType?: string; email?: string;
  heading?: string; description?: string; concern?: string; subConcern?: string;
  otherConcern?: string; building?: string; otherBuilding?: string; college?: string;
  floor?: string; room?: string; otherRoom?: string; image?: string; status?: string;
  createdAt?: string; comments?: Comment[];
}
interface ChecklistItem { id: string; text: string; done: boolean; _id?: string; }
interface TaskComment { text: string; by: string; at: string; }
interface Task {
  _id?: string; name: string; concernType?: string; reportId?: string;
  status?: string; assignedStaff?: string[]; priority?: string;
  checklist?: ChecklistItem[]; notes?: string; comments?: TaskComment[];
  createdBy?: string; createdAt?: string; updatedAt?: string;
}
interface MetaStatus   { id: string; name: string; color: string; }
interface MetaPriority { id: string; name: string; color: string; }
interface Signatory    { name: string; role: string; }
type StatusKey = "Pending" | "Inspecting" | "Unfinished" | "In Progress" | "Resolved" | "Archived";interface TimeSeriesPoint { label: string; value: number; }
type TimeMode = "day" | "week" | "month" | "year";

/* ===== Colors & Helpers ===== */
const BUILDING_COLORS = ["#6366f1","#22d3ee","#f59e0b","#ef4444","#a78bfa","#34d399","#fb7185","#64748b"];
const COLLEGE_COLORS  = ["#6366f1","#22d3ee","#f59e0b","#ef4444","#a78bfa","#34d399","#fb7185","#64748b"];
const getBuildingColor = (_: string, i: number) => BUILDING_COLORS[i % BUILDING_COLORS.length];
const getCollegeColor  = (_: string, i: number) => COLLEGE_COLORS[i  % COLLEGE_COLORS.length];
const getConcernBaseFromLabel = (fullLabel: string): { base: string; sub: string } => {
  const [baseRaw, subRaw] = fullLabel.split(" : ");
  return { base: (baseRaw || "Unspecified").trim(), sub: (subRaw || baseRaw || "Unspecified").trim() };
};

const getConcernColorFromBase = (base: string): string => {
  const b = base.toLowerCase();
  if (b === "civil")                           return "#6366f1";
  if (b === "mechanical")                      return "#22d3ee";
  if (b === "electrical")                      return "#f59e0b";
  if (b === "safety hazard" || b === "safety") return "#ef4444";
  if (b === "other" || b === "others")         return "#f97316";
  return "#94a3b8";
};
const formatConcernLabel = (report: Report) => {
  const base = report.concern || "Unspecified";
  const sub  = report.subConcern || report.otherConcern;
  return sub ? `${base} : ${sub}` : base;
};
const DEFAULT_STATUSES: MetaStatus[] = [
  { id: "pending",  name: "Pending",               color: "#f59e0b" },
  { id: "Unfinished",  name: "Unfinished", color: "#510000" },
  { id: "inspecting", name: "Inspecting",           color: "#0083db" },
  { id: "progress", name: "In Progress",           color: "#a78bfa" },
  { id: "resolved", name: "Resolved",              color: "#34d399" },
  { id: "archived", name: "Archived",              color: "#64748b" },
];

const DEFAULT_PRIORITIES: MetaPriority[] = [
  { id: "low",      name: "Low",      color: "#34d399" },
  { id: "medium",   name: "Medium",   color: "#f59e0b" },
  { id: "high",     name: "High",     color: "#ef4444" },
  { id: "critical", name: "Critical", color: "#a855f7" },
];

const normalizeStatusFilterLabel = (
  raw?: string,
  statuses: MetaStatus[] = DEFAULT_STATUSES
): string | null => {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return null;

  const hit = statuses.find(
    st => st.name.toLowerCase() === s || st.id.toLowerCase() === s
  );
  if (hit) return hit.name;
  if (s === "Unfinished") {
    return statuses.find(st => /Unfinished/i.test(st.name))?.name ?? null;
  }
  if (s === "in-progress" || s === "inprogress") {
    return statuses.find(st => /progress/i.test(st.name))?.name ?? null;
  }
  return null;
};


const normalizeStatus = (status: string | undefined, statuses: MetaStatus[]) => {
  const s = (status || "Pending").trim().toLowerCase(); // Default to "Pending"
  
  // Check if report status matches any current status
  const match = statuses.find(st => st.name.toLowerCase() === s || st.id.toLowerCase() === s);
  if (match) return match.name;
  
  // Special handling for "Inspecting"
  if (s.includes("inspecting")) {
    const inspectingStatus = statuses.find(st => /inspecting/i.test(st.name));
    if (inspectingStatus) return inspectingStatus.name;
  }
  
  // Special handling for "Waiting for Materials" or similar
  if (s.includes("unfinished")) {
    const unfinishedStatus = statuses.find(st => /unfinished/i.test(st.name));
    if (unfinishedStatus) return unfinishedStatus.name;
  }
  if (s.includes("in progress") || s.includes("inprogress")) {
    const progressStatus = statuses.find(st => /progress/i.test(st.name));
    if (progressStatus) return progressStatus.name;
  }
  
  // Default fallback to "Pending"
  return "Pending";
};

const getBaseConcernFromReport = (r: Report): string => (r.concern || "Unspecified").trim() || "Unspecified";
const getItemKey = (item: ChecklistItem): string => item._id || item.id;
const makeUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ===== Custom Tooltip ===== */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15,23,42,0.95)", border: "1px solid rgba(99,102,241,0.3)",
      borderRadius: 10, padding: "10px 14px", backdropFilter: "blur(12px)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      {label && <p style={{ margin: "0 0 4px", fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ margin: 0, fontSize: 13, color: p.color || "#f1f5f9", fontWeight: 700 }}>
          {p.value} <span style={{ color: "#64748b", fontWeight: 400 }}>{p.name !== "value" ? p.name : "reports"}</span>
        </p>
      ))}
    </div>
  );
};

/* ===== Stat Card Component ===== */
const StatCard: FC<{ label: string; value: string | number; color: string; icon: React.ReactNode; trend?: string; sub?: string }> = ({ label, value, color, icon, sub }) => (
  <div style={{
    background: "rgba(15,23,42,0.6)", border: `1px solid rgba(255,255,255,0.06)`,
    borderRadius: 16, padding: "1.25rem 1.5rem", position: "relative", overflow: "hidden",
    backdropFilter: "blur(12px)", transition: "transform 0.2s, box-shadow 0.2s",
  }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 40px ${color}22`; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
  >
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}00)` }} />
    <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `${color}10`, filter: "blur(20px)" }} />
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
        {icon}
      </div>
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, fontWeight: 500 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: color, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
  </div>
);

/* ===== Section Header ===== */
const SectionHeader: FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
    <div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.01em" }}>{title}</h3>
      {subtitle && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#475569" }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

/* ===== Glass Card ===== */
const GlassCard: FC<{ children: React.ReactNode; style?: React.CSSProperties; className?: string }> = ({ children, style, className }) => (
  <div className={className} style={{
    background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 20, padding: "1.5rem", backdropFilter: "blur(12px)",
    ...style,
  }}>
    {children}
  </div>
);

/* ===================================================================
   MAIN COMPONENT
=================================================================== */
const Analytics: FC = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [canView, setCanView] = useState(false);
  const [viewMode, setViewMode] = useState<"reports" | "tasks" | "both">("both"); // New view toggle
  const [statuses, setStatuses] = useState<MetaStatus[]>(DEFAULT_STATUSES);

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

  /* ── TASK FETCHING ── */
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!canView) return;
    try {
      setLoadingTasks(true);
      const res = await fetch(`${API_BASE}/api/tasks?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      const list: Task[] = Array.isArray(data) ? data : Array.isArray(data.tasks) ? data.tasks : [];
      setTasks(list);
    } catch {
      console.warn("[Analytics] Tasks fetch failed");
    } finally {
      setLoadingTasks(false);
    }
  }, [canView]);

  // Auto-refresh tasks every 30s + on focus
  useEffect(() => {
    if (!canView) return;
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000); // 30s poll
    window.addEventListener("focus", fetchTasks);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", fetchTasks);
    };
  }, [canView, fetchTasks]);

  /* ── META ── */
  useEffect(() => {
    let cancelled = false;

    const loadAnalyticsMeta = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/meta?ts=${Date.now()}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (data) {
      if (data.statuses?.length > 0) setStatuses(data.statuses);
      if (data.priorities?.length > 0) setMetaPriorities(data.priorities);
      if (data.concerns?.length > 0) setMetaConcernTypes([...data.concerns.map((c: any) => c.label), "Other"]);
    }
  } catch (err) {
    console.warn("[Analytics] Meta fetch failed, using defaults:", err);
  }
};

    void loadAnalyticsMeta();
    return () => { cancelled = true; };
  }, []);

const STATUSES = useMemo(() => statuses.map(s => s.name), [statuses]);
const STATUS_LABELS = useMemo(() => {
  const labels: Record<StatusKey, string> = {
    "Pending": "Pending",
    "Inspecting": "Inspecting",
    "Unfinished": "Unfinished",
    "In Progress": "In Progress",
    "Resolved": "Resolved",
    "Archived": "Archived"
  };
  
  // Override with actual status names if they exist in statuses
  statuses.forEach(s => {
    const key = s.name as StatusKey;
    if (labels[key]) {
      labels[key] = s.name;
    }
  });
  
  return labels;
}, [statuses]);


  const STATUS_TO_FILTER_LABEL = STATUS_LABELS;

  const STATUS_COLORS = useMemo(() => {
  const getColor = (name: string, fallback: string) =>
    statuses.find(status => status.name === name)?.color ?? fallback;

  return {
    "Pending": getColor("Pending", "#f59e0b"),
    "Inspecting": getColor("Inspecting", "#0083db"), // Blue-ish color
    "In Progress": getColor("In Progress", "#a78bfa"),
    "Resolved": getColor("Resolved", "#34d399"),
    "Unfinished": getColor("Unfinished", "#a20303"),
    "Archived": getColor("Archived", "#64748b"),
  };
}, [statuses]);

const DEFAULT_STATUS_SET = useMemo(
  () => new Set(statuses.filter(status => !/archiv/i.test(status.name)).map(status => status.name)),
  [statuses]
);

  // NEW: Task status aggregation (like Task page boardColumns)
  const taskStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(task => {
      const status = task.status || "Pending";
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  const taskPieData = useMemo(() => {
    const activeStatuses = statuses.filter(s => !/archiv/i.test(s.name));
    return activeStatuses.map(s => ({
      name: s.name,
      value: taskStatusCounts[s.name] || 0,
      color: s.color,
      percent: tasks.length > 0 ? Math.round(((taskStatusCounts[s.name] || 0) / tasks.length) * 100) : 0
    })).filter(d => d.value > 0);
  }, [taskStatusCounts, tasks.length, statuses]);

  // NEW: Task stats for StatCards
  const totalTasks = tasks.length;
  const resolvedTasks = tasks.filter(t => (t.status || "").toLowerCase() === "resolved").length;
  const taskResolvedPct = totalTasks > 0 ? Math.round((resolvedTasks / totalTasks) * 100) : 0;
  const pendingTasks = tasks.filter(t => (t.status || "Pending").toLowerCase() === "pending").length;

  const FALLBACK_STATUSES: MetaStatus[] = [
    { id:"1", name:"Pending",         color:"#f59e0b" },
    { id:"2", name:"Inspecting", color:"#0083db" },
    { id:"3", name:"In Progress",     color:"#a78bfa" },
    { id:"4", name:"Resolved",        color:"#34d399" },
    { id:"5", name:"Archived",        color:"#64748b" },
  ];
  const FALLBACK_PRIORITIES: MetaPriority[] = [
    { id:"1", name:"Low",    color:"#34d399" },
    { id:"2", name:"Medium", color:"#f59e0b" },
    { id:"3", name:"High",   color:"#f97316" },
    { id:"4", name:"Urgent", color:"#ef4444" },
  ];
  const FALLBACK_CONCERN_TYPES = ["Electrical","Civil","Mechanical","Safety Hazard","Other"];

  // Remove these lines - they're duplicates:
const [metaStatuses,    setMetaStatuses]    = useState<MetaStatus[]>(FALLBACK_STATUSES);
const [metaPriorities,  setMetaPriorities]  = useState<MetaPriority[]>(FALLBACK_PRIORITIES);
const [metaConcernTypes,setMetaConcernTypes]= useState<string[]>(FALLBACK_CONCERN_TYPES);
  const [allStaff,        setAllStaff]        = useState<string[]>([]);

  const fetchMeta = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/meta?ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.statuses?.length   > 0) setMetaStatuses(data.statuses);
      if (data?.priorities?.length > 0) setMetaPriorities(data.priorities);
      if (data?.concerns?.length   > 0) setMetaConcernTypes([...data.concerns.map((c: any) => c.label), "Other"]);
    } catch {}
    try {
      const res  = await fetch(`${API_BASE}/api/staff`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      const list = Array.isArray(data?.staff) ? data.staff.map((s: any) => s.name).filter(Boolean)
                 : Array.isArray(data)         ? data.map((s: any) => s.name).filter(Boolean) : [];
      if (list.length) setAllStaff(list);
    } catch {}
  }, []);

  useEffect(() => { if (canView) fetchMeta(); }, [canView, fetchMeta]);

  /* ── REPORTS ── */
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadErr, setLoadErr] = useState<string>("");

  const fetchReports = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoadErr(""); setLoading(true);
      const res = await fetch(`${API_BASE}/api/reports`, { cache: "no-store", signal, headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      const list: Report[] = Array.isArray(data) ? data : Array.isArray(data.reports) ? data.reports : [];
      setReports(list);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setLoadErr("Using demo data");
      const now = new Date().toISOString();
      setReports([
        { reportId:"010426001", userType:"Student",       status:"Pending",     building:"Building A", concern:"Electrical", subConcern:"Lights",  college:"CIT", createdAt:now },
        { reportId:"010426002", userType:"Staff/Faculty",  status:"In Progress", building:"Building B", concern:"Plumbing",   college:"COE",         createdAt:now },
        { reportId:"010426003", userType:"Student",       status:"Resolved",    building:"Building A", concern:"HVAC",       college:"CIT",         createdAt:now },
        { reportId:"010426004", userType:"Staff/Faculty",  status:"Pending",     building:"Building C", concern:"Electrical", subConcern:"Outlets",  college:"COE", createdAt:now },
        { reportId:"010426005", userType:"Student",       status:"Resolved",    building:"Building B", concern:"Carpentry",  college:"CLA",         createdAt:now },
        { reportId:"010426006", userType:"Staff/Faculty",  status:"In Progress", building:"Building C", concern:"HVAC",       college:"CBA",         createdAt:now },
      ]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!canView) return;
    const ctrl = new AbortController();
    fetchReports(ctrl.signal);
    return () => ctrl.abort();
  }, [canView, fetchReports]);

  /* ── FILTERS ── */
const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(() => new Set(["Pending", "Unfinished", "In Progress", "Resolved", "Inspecting"]));  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(() => new Set());
  const [selectedConcerns,  setSelectedConcerns]  = useState<Set<string>>(() => new Set());
  const [selectedColleges,  setSelectedColleges]  = useState<Set<string>>(() => new Set());
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo,   setDateTo]   = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (value: string) => {
    setter(prev => { const n = new Set(prev); n.has(value) ? n.delete(value) : n.add(value); return n; });
  };
  const clearAllFilters = () => {
    setSelectedStatuses(new Set(DEFAULT_STATUS_SET)); setSelectedBuildings(new Set());
    setSelectedConcerns(new Set()); setSelectedColleges(new Set()); setDateFrom(""); setDateTo("");
  };
  const setLastDays = (days: number) => {
    const today = new Date(); const from = new Date(); from.setDate(today.getDate() - days + 1);
    setDateFrom(from.toISOString().slice(0, 10)); setDateTo(today.toISOString().slice(0, 10));
  };

  

  const filtered = useMemo(() => {
  const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
  const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;
  return reports.filter(r => {
    const status = r.status || "Pending";
const normalizedStatus = normalizeStatus(r.status, statuses);
    if (!normalizedStatus || !selectedStatuses.has(normalizedStatus)) return false;
    if (selectedBuildings.size && !selectedBuildings.has(r.building || "")) return false;
    if (selectedConcerns.size && !selectedConcerns.has(getBaseConcernFromReport(r))) return false;
    if (selectedColleges.size && !selectedColleges.has(r.college || "")) return false;
    if ((fromTS || toTS) && r.createdAt) {
      const ts = new Date(r.createdAt).getTime();
      if (fromTS && ts < fromTS) return false;
      if (toTS && ts > toTS) return false;
    }
    return true;
  });
}, [reports, selectedStatuses, selectedBuildings, selectedConcerns, selectedColleges, dateFrom, dateTo, statuses]);

  const availableBuildings = useMemo(() => { const s = new Set<string>(); reports.forEach(r => { if (r.building) s.add(r.building); }); return [...s].sort(); }, [reports]);
  const availableConcerns  = useMemo(() => { const s = new Set<string>(); reports.forEach(r => { const b = getBaseConcernFromReport(r); if (b) s.add(b); }); return [...s].sort(); }, [reports]);
  const availableColleges  = useMemo(() => { const s = new Set<string>(); reports.forEach(r => { if ((r.college||"").trim()) s.add(r.college as string); }); return [...s].sort(); }, [reports]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    const changed = selectedStatuses.size !== DEFAULT_STATUS_SET.size || [...DEFAULT_STATUS_SET].some(s => !selectedStatuses.has(s));
    if (changed) c++; if (selectedBuildings.size) c++; if (selectedConcerns.size) c++; if (selectedColleges.size) c++; if (dateFrom || dateTo) c++;
    return c;
  }, [selectedStatuses, selectedBuildings, selectedConcerns, selectedColleges, dateFrom, dateTo, DEFAULT_STATUS_SET]);

  /* ── AGGREGATES ── */
  const statusCounts = useMemo(() => {
  const map: Record<StatusKey, number> = {
    "Pending": 0,
    "Inspecting": 0,
    "Unfinished": 0,
    "In Progress": 0,
    "Resolved": 0,
    "Archived": 0
  };
  
  filtered.forEach(r => {
    // Handle undefined status before calling normalizeStatus
    const status = r.status || "Pending";
    const normalizedStatus = normalizeStatus(status, statuses);
    
    if (!normalizedStatus) return;
    
    if (normalizedStatus === "Pending") map["Pending"]++;
    else if (normalizedStatus === "Inspecting") map["Inspecting"]++;
    else if (normalizedStatus === "Unfinished") map["Unfinished"]++;
    else if (normalizedStatus === "In Progress") map["In Progress"]++;
    else if (normalizedStatus === "Resolved") map["Resolved"]++;
    else if (normalizedStatus === "Archived") map["Archived"]++;
  });
  
  return map;
}, [filtered, statuses]);

interface ConcernChartDatum {
  name: string;
  base: string;
  fullLabel: string;
  value: number;
}

  const statusPieData = useMemo(() => {
  const total = (Object.keys(statusCounts) as StatusKey[])
    .filter(k => selectedStatuses.has(STATUS_LABELS[k]))
    .reduce((s, k) => s + statusCounts[k], 0);
  
  return (Object.keys(statusCounts) as StatusKey[])
    .filter(k => selectedStatuses.has(STATUS_LABELS[k]))
    .map(k => ({
      name: STATUS_LABELS[k],
      value: statusCounts[k],
      color: STATUS_COLORS[k],
      percent: total > 0 ? Math.round((statusCounts[k] / total) * 100) : 0
    }))
    .filter(e => e.value > 0);
}, [statusCounts, selectedStatuses, STATUS_LABELS, STATUS_COLORS]);

  const agg = useCallback((arr: Report[], keyOrFn: keyof Report | ((r: Report) => string)) => {
    const getKey = typeof keyOrFn === "function" ? keyOrFn : (r: Report) => (r[keyOrFn] as string) || "Unspecified";
    const m = new Map<string,number>();
    arr.forEach(r => { const k = getKey(r) || "Unspecified"; m.set(k, (m.get(k)||0)+1); });
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, []);


  
  const buildingData = useMemo(() => agg(filtered, "building"), [filtered, agg]);
  const collegeData  = useMemo(() => agg(filtered, "college"),  [filtered, agg]);

  const concernData = useMemo<ConcernChartDatum[]>(() => {
    const m = new Map<string,ConcernChartDatum>();
    filtered.forEach(r => {
      const full = formatConcernLabel(r); if (!full) return;
      const { base, sub } = getConcernBaseFromLabel(full); const key = `${base}||${sub}`;
      const ex = m.get(key);
      if (ex) ex.value++; else m.set(key, { name:sub, base, fullLabel:full, value:1 });
    });
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [filtered]);

  /* ── TIME SERIES ── */
  const [timeMode, setTimeMode] = useState<TimeMode>("month");
  const timeSeriesData: TimeSeriesPoint[] = useMemo(() => {
    if (!filtered.length) return [];
    const now = new Date();
    const map = new Map<string,{ label:string; value:number; sortKey:number }>();
    const makeDayKey = (d: Date) => d.toISOString().slice(0, 10);
    const getThreshold = (): Date => {
      const d = new Date(now);
      if (timeMode === "day") d.setDate(d.getDate() - 29);
      else if (timeMode === "week") d.setDate(d.getDate() - 7*11);
      else if (timeMode === "month") d.setMonth(d.getMonth() - 11);
      else d.setFullYear(d.getFullYear() - 4);
      return d;
    };
    const threshold = getThreshold();
    filtered.forEach(r => {
      if (!r.createdAt) return;
      const dt = new Date(r.createdAt);
      if (Number.isNaN(dt.getTime()) || dt < threshold) return;
      let key: string, label: string, sortKey: number;
      const year = dt.getFullYear(), month = dt.getMonth(), day = dt.getDate();
      if (timeMode === "day") {
        key = makeDayKey(dt); label = `${month+1}/${day}`; sortKey = dt.getTime();
      } else if (timeMode === "week") {
        const tmp = new Date(dt); const dow = tmp.getDay() || 7; tmp.setDate(tmp.getDate() - (dow-1));
        key = `W${tmp.getFullYear()}-${makeDayKey(tmp)}`; label = `Wk ${tmp.getFullYear().toString().slice(2)}-${tmp.getMonth()+1}`; sortKey = tmp.getTime();
      } else if (timeMode === "month") {
        key = `${year}-${month+1}`;
        const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        label = `${mn[month]} ${year.toString().slice(2)}`; sortKey = year*12+month;
      } else { key = `${year}`; label = `${year}`; sortKey = year; }
      const ex = map.get(key);
      if (ex) ex.value++; else map.set(key, { label, value:1, sortKey });
    });
    return [...map.values()].sort((a, b) => a.sortKey - b.sortKey).map(v => ({ label:v.label, value:v.value }));
  }, [filtered, timeMode]);

  /* ── SIGNATORIES ── */
  const DEFAULT_SIGNATORIES: Signatory[] = [
    { name: "", role: "Prepared by"  },
    { name: "", role: "Reviewed by"  },
    { name: "", role: "Approved by"  },
  ];
  const [signatories,      setSignatories]      = useState<Signatory[]>(DEFAULT_SIGNATORIES);
  const [showPrintModal,   setShowPrintModal]   = useState(false);

  /* ── PRINT (called from modal's Confirm button) ── */
  const executePrint = useCallback((sigs: Signatory[]) => {
    if (typeof window === "undefined") return;
    const concernBaseCounts = new Map<string,number>(), concernCounts = new Map<string,number>(), buildingCounts = new Map<string,number>();
    filtered.forEach(r => {
      const bc = getBaseConcernFromReport(r)||"Unspecified"; concernBaseCounts.set(bc,(concernBaseCounts.get(bc)||0)+1);
      const ck = formatConcernLabel(r)||"Unspecified"; concernCounts.set(ck,(concernCounts.get(ck)||0)+1);
      const bk = (r.building||"Unspecified").trim()||"Unspecified"; buildingCounts.set(bk,(buildingCounts.get(bk)||0)+1);
    });
    const total = filtered.length;
const statusSummaryHtml = ([["Pending",statusCounts["Pending"]],["Inspecting",statusCounts["Inspecting"]],["Unfinished",statusCounts["Unfinished"]],["In Progress",statusCounts["In Progress"]],["Resolved",statusCounts["Resolved"]],["Archived",statusCounts["Archived"]]] as [string,number][])      
  .filter(([,c])=>c>0).map(([l,c])=>`<li>${l}: ${c} (${total>0?Math.round((c/total)*100):0}%)</li>`).join("")||"<li>No data.</li>";
      const safe = (v?: string) => v ? String(v) : "";
    const rowsHtml = filtered.map((r,i)=>`<tr><td>${i+1}</td><td>${safe(r.reportId)}</td><td>${r.createdAt?new Date(r.createdAt).toLocaleString():""}</td><td>${safe(r.status)}</td><td>${safe(r.building)}</td><td>${safe(formatConcernLabel(r))}</td><td>${safe(r.college)}</td><td>${safe(r.floor)}</td><td>${safe(r.room)}</td><td>${safe(r.email)}</td><td>${safe(r.userType)}</td></tr>`).join("");
    const printedDate = new Date().toLocaleString();
    const sigBlocksHtml = sigs.map(s => `
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${s.name ? s.name : "Signature over Printed Name"}</div>
        <div class="sig-role">${s.role}</div>
      </div>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFMO Analytics</title><style>body{font-family:system-ui,sans-serif;font-size:8px;color:#111827;padding:10px}.doc-table{width:100%;border-collapse:collapse}.logo-cell{width:90px;text-align:center}.logo-cell img{width:64px;height:64px;padding-top:12px;object-fit:contain}.title{font-size:14px;font-weight:700;color:#fff;background:#029006;padding:8px}.row-line{border-bottom:1px solid #000;padding-bottom:4px}.label{font-weight:600}h1{font-size:18px;margin:16px 0 4px}h2{font-size:15px;margin-top:16px;margin-bottom:4px}h3{font-size:13px;margin-top:10px;margin-bottom:4px}.meta{font-size:11px;color:#374151;margin-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #d1d5db;padding:4px 6px;text-align:left}thead{background:#f3f4f6}ul{margin:4px 0 8px 16px;padding:0}li{margin:2px 0}.sig-row{display:flex;justify-content:space-around;gap:24px;flex-wrap:wrap;margin-top:48px}.sig-block{flex:1;min-width:140px;max-width:200px;text-align:center}.sig-line{border-top:1px solid #111827;margin-top:40px;margin-bottom:4px}.sig-name{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em}.sig-role{font-size:8px;color:#6b7280;margin-top:2px}@media print{*{-webkit-print-color-adjust:exact!important}}</style></head><body>
    <table class="doc-table"><tr><td class="logo-cell" rowspan="4"><img src="/logo-dlsud.png"/></td><td colspan="2" class="title">Building Facilities Maintenance Office : Report Analytics</td></tr><tr><td class="row-line"><span class="label">Printed:</span> ${printedDate}</td><td class="row-line"><span class="label">Confidentiality:</span> Research Purpose</td></tr><tr><td class="row-line"><span class="label">Review Cycle:</span> Monthly</td><td class="row-line"><span class="label">Effectivity Date:</span></td></tr></table>
    <h1>BFMO Analytics — Tabular Report</h1><div class="meta">Records: ${total}</div>
    <h2>Status Summary</h2><ul>${statusSummaryHtml}</ul>
    <h2>By Concern</h2><ul>${[...concernCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<li>${n}: ${c}</li>`).join("")||"<li>None.</li>"}</ul>
    <h2>By Building</h2><ul>${[...buildingCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<li>${n}: ${c}</li>`).join("")||"<li>None.</li>"}</ul>
    <h2>Detailed Report</h2><table><thead><tr><th>#</th><th>Report ID</th><th>Date</th><th>Status</th><th>Building</th><th>Concern</th><th>College</th><th>Floor</th><th>Room</th><th>Email</th><th>Type</th></tr></thead><tbody>${rowsHtml||'<tr><td colspan="11">No data.</td></tr>'}</tbody></table>
    <div class="sig-row">${sigBlocksHtml}</div>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`;
    const w = window.open("","_blank"); if(!w)return;
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
  }, [filtered, statusCounts]);

  /* ── Open the pre-print signatory modal ── */
  const handlePrint = useCallback(() => {
    setShowPrintModal(true);
  }, []);

  /* ── TASKS STATE ── */
  const [listsOpen,        setListsOpen]        = useState(false);
  const [taskSaveStatus,   setTaskSaveStatus]   = useState("");
  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [serverTasks,      setServerTasks]      = useState<Task[]>([]);
  const [editingTaskId,    setEditingTaskId]    = useState<string|null>(null);
  const [newChecklistText, setNewChecklistText] = useState<Record<string,string>>({});
  const EMPTY_DRAFT: Omit<Task,"_id"|"createdAt"|"updatedAt"> = { name:"", concernType:"Other", reportId:"", assignedStaff:[], status:"Pending", priority:"", checklist:[], notes:"" };
  const [createDraft, setCreateDraft] = useState<Omit<Task,"_id"|"createdAt"|"updatedAt">>(EMPTY_DRAFT);
  const [staffInput,  setStaffInput]  = useState("");
  const [checkInput,  setCheckInput]  = useState("");

  const showStatus = (msg: string) => { setTaskSaveStatus(msg); setTimeout(() => setTaskSaveStatus(""), 3500); };

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res  = await fetch(`${API_BASE}/api/tasks?ts=${Date.now()}`, { cache:"no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error("Failed.");
      const list: Task[] = Array.isArray(data) ? data : Array.isArray(data.tasks) ? data.tasks : [];
      setServerTasks(list);
    } catch { showStatus("❌ Load failed"); }
    finally { setLoadingTasks(false); }
  }, []);

  useEffect(() => { if (canView && listsOpen) loadTasks(); }, [canView, listsOpen, loadTasks]);

  const createTask = useCallback(async () => {
    if (!createDraft.name.trim()) { showStatus("❌ Task name required."); return; }
    showStatus("Saving…");
    try {
      const res  = await fetch(`${API_BASE}/api/tasks`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ name:createDraft.name.trim(), concernType:createDraft.concernType||"Other", reportId:createDraft.reportId||null, priority:createDraft.priority||undefined, notes:createDraft.notes||"", assignedStaff:createDraft.assignedStaff||[], status:"Pending", createdBy:"Admin", checklist:(createDraft.checklist||[]) }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed.");
      setServerTasks(prev => [data.task, ...prev]);
      setCreateDraft(EMPTY_DRAFT); setStaffInput(""); setCheckInput(""); setShowCreateModal(false); showStatus("✅ Task created!");
    } catch (e: any) { showStatus(`❌ ${e?.message||"Save failed"}`); }
  }, [createDraft]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      const res  = await fetch(`${API_BASE}/api/tasks/${taskId}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ...updates, updatedBy:"Admin" }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed.");
      setServerTasks(prev => prev.map(t => t._id === taskId ? data.task : t));
      setEditingTaskId(null); showStatus("✅ Updated!");
    } catch (e: any) { showStatus(`❌ ${e?.message||"Update failed"}`); }
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, { method:"DELETE" });
      if (!res.ok) throw new Error("Failed.");
      setServerTasks(prev => prev.filter(t => t._id !== taskId));
      if (editingTaskId === taskId) setEditingTaskId(null); showStatus("✅ Deleted!");
    } catch { showStatus("❌ Delete failed"); }
  }, [editingTaskId]);

  const toggleChecklistItem = useCallback(async (task: Task, item: ChecklistItem, done: boolean) => {
    const itemKey = getItemKey(item);
    const optimistic = (task.checklist||[]).map(c => getItemKey(c) === itemKey ? {...c, done} : c);
    setServerTasks(prev => prev.map(t => t._id === task._id ? {...t, checklist: optimistic} : t));
    try {
      const res  = await fetch(`${API_BASE}/api/tasks/${task._id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ checklist: optimistic, updatedBy:"Admin" }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setServerTasks(prev => prev.map(t => t._id === data.task._id ? data.task : t));
    } catch {
      setServerTasks(prev => prev.map(t => t._id === task._id ? {...t, checklist: task.checklist} : t));
      showStatus("❌ Checklist update failed");
    }
  }, []);

  const addChecklistItem = useCallback(async (task: Task, text: string) => {
    if (!text.trim()) return;
    const newItem: ChecklistItem = { id: makeUid(), text: text.trim(), done: false };
    const updated = [...(task.checklist||[]), newItem];
    setServerTasks(prev => prev.map(t => t._id === task._id ? {...t, checklist: updated} : t));
    setNewChecklistText(prev => ({...prev, [task._id!]: ""}));
    try {
      const res  = await fetch(`${API_BASE}/api/tasks/${task._id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ checklist: updated, updatedBy:"Admin" }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setServerTasks(prev => prev.map(t => t._id === data.task._id ? data.task : t));
    } catch { setServerTasks(prev => prev.map(t => t._id === task._id ? {...t, checklist: task.checklist} : t)); }
  }, []);

  const removeChecklistItem = useCallback(async (task: Task, item: ChecklistItem) => {
    const itemKey = getItemKey(item);
    const updated = (task.checklist||[]).filter(c => getItemKey(c) !== itemKey);
    setServerTasks(prev => prev.map(t => t._id === task._id ? {...t, checklist: updated} : t));
    try {
      const res  = await fetch(`${API_BASE}/api/tasks/${task._id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ checklist: updated, updatedBy:"Admin" }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setServerTasks(prev => prev.map(t => t._id === data.task._id ? data.task : t));
    } catch { setServerTasks(prev => prev.map(t => t._id === task._id ? {...t, checklist: task.checklist} : t)); }
  }, []);

  const getPriorityColor = (name?: string) => metaPriorities.find(p => p.name === name)?.color || "#64748b";
  const getStatusColor   = (name?: string) => metaStatuses.find(s => s.name === name)?.color   || "#64748b";

const resolvedPct = useMemo(() => filtered.length > 0 ? Math.round((statusCounts["Resolved"]/filtered.length)*100) : 0, [filtered, statusCounts]);
  /* ── GUARD ── */
  if (!isLoaded || !canView) {
    return (
      <div style={{ minHeight:"100vh", background:"#020817", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:48, height:48, border:"3px solid rgba(99,102,241,0.2)", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }}/>
          <p style={{ color:"#64748b", fontSize:14 }}>Checking permissions…</p>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  return (
    <div style={{
      minHeight: "100vh",
      background: "#020817",
      backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15) 0%, transparent 60%)",
      fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
      color: "#f1f5f9",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%,100% { opacity:0.4; } 50% { opacity:0.8; } }
        .a-card { animation: fadeUp 0.4s ease both; }
        .a-card:nth-child(1) { animation-delay: 0.05s; }
        .a-card:nth-child(2) { animation-delay: 0.10s; }
        .a-card:nth-child(3) { animation-delay: 0.15s; }
        .a-card:nth-child(4) { animation-delay: 0.20s; }
        .chip-filter { cursor:pointer; padding:5px 13px; border-radius:999px; font-size:12px; font-weight:500; transition:all 0.15s; border:1px solid rgba(255,255,255,0.08); background:transparent; color:#64748b; }
        .chip-filter:hover { border-color:rgba(99,102,241,0.4); color:#a5b4fc; background:rgba(99,102,241,0.08); }
        .chip-filter.on { border-color:rgba(99,102,241,0.6); color:#a5b4fc; background:rgba(99,102,241,0.15); }
        .time-btn { padding:5px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid rgba(255,255,255,0.08); background:transparent; color:#64748b; transition:all 0.15s; font-family:inherit; }
        .time-btn:hover { color:#f1f5f9; }
        .time-btn.active { background:rgba(99,102,241,0.2); border-color:rgba(99,102,241,0.5); color:#a5b4fc; }
        .action-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:inherit; }
        .action-btn-primary { background:linear-gradient(135deg,#6366f1,#8b5cf6); border:none; color:#fff; box-shadow:0 4px 15px rgba(99,102,241,0.3); }
        .action-btn-primary:hover { box-shadow:0 6px 25px rgba(99,102,241,0.5); transform:translateY(-1px); }
        .action-btn-ghost { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:#94a3b8; }
        .action-btn-ghost:hover { background:rgba(255,255,255,0.08); color:#f1f5f9; border-color:rgba(255,255,255,0.15); }
        .scroll-x::-webkit-scrollbar { height:3px; } .scroll-x::-webkit-scrollbar-track { background:transparent; } .scroll-x::-webkit-scrollbar-thumb { background:#1e293b; border-radius:2px; }
        .task-card { background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:1rem; transition:all 0.2s; }
        .task-card:hover { border-color:rgba(99,102,241,0.25); box-shadow:0 0 20px rgba(99,102,241,0.1); }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor:pointer; }
        .modal-input { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:8px 12px; color:#f1f5f9; font-size:13px; width:100%; outline:none; font-family:inherit; transition:border-color 0.15s; }
        .modal-input:focus { border-color:rgba(99,102,241,0.5); background:rgba(99,102,241,0.04); }
        select.modal-input option { background:#0f172a; color:#f1f5f9; }
      `}</style>

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"2rem", flexWrap:"wrap", gap:16, animation:"fadeUp 0.4s ease" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <h1 style={{ margin:0, fontSize:"1.5rem", fontWeight:800, letterSpacing:"-0.03em", background:"linear-gradient(135deg,#f1f5f9,#94a3b8)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                Analytics
              </h1>
            </div>
            <p style={{ margin:0, fontSize:13, color:"#475569" }}>
              BFMO Facility Management · {loading ? "Loading…" : `${filtered.length} of ${reports.length} reports`}
              {loadErr && <span style={{ marginLeft:8, color:"#f59e0b", fontSize:11 }}>⚠ {loadErr}</span>}
            </p>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button className="action-btn action-btn-ghost" onClick={() => setFiltersOpen(v => !v)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Filters {activeFilterCount > 0 && <span style={{ background:"#6366f1", color:"#fff", borderRadius:"50%", width:18, height:18, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700 }}>{activeFilterCount}</span>}
            </button>
            <button className="action-btn action-btn-ghost" onClick={() => setListsOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
              Tasks
            </button>
            <button className="action-btn action-btn-ghost" onClick={() => fetchReports()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Refresh
            </button>
            <button className="action-btn action-btn-primary" onClick={handlePrint}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Report
            </button>
          </div>
        </div>

        {/* ═══ FILTERS PANEL ═══ */}
        {filtersOpen && (
          <div style={{ background:"rgba(15,23,42,0.7)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"1.25rem 1.5rem", marginBottom:"1.5rem", backdropFilter:"blur(12px)", animation:"fadeUp 0.25s ease" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:20 }}>
              {/* Status */}
              <div>
                <p style={{ margin:"0 0 10px", fontSize:11, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em" }}>Status</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {STATUSES.map(s => (
  <button key={s} className={`chip-filter${selectedStatuses.has(s)?" on":""}`} onClick={() => toggleSet(setSelectedStatuses)(s)}>
    {s}
  </button>
))}
                </div>
              </div>
              {/* Building */}
              <div>
                <p style={{ margin:"0 0 10px", fontSize:11, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em" }}>Building</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {availableBuildings.map(b => (
                    <button key={b} className={`chip-filter${selectedBuildings.has(b)?" on":""}`} onClick={() => toggleSet(setSelectedBuildings)(b)}>{b}</button>
                  ))}
                </div>
              </div>
              {/* Concern */}
              <div>
                <p style={{ margin:"0 0 10px", fontSize:11, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em" }}>Concern</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {availableConcerns.map(c => (
                    <button key={c} className={`chip-filter${selectedConcerns.has(c)?" on":""}`} onClick={() => toggleSet(setSelectedConcerns)(c)}>{c}</button>
                  ))}
                </div>
              </div>
              {/* College */}
              <div>
                <p style={{ margin:"0 0 10px", fontSize:11, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em" }}>College</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {availableColleges.map(c => (
                    <button key={c} className={`chip-filter${selectedColleges.has(c)?" on":""}`} onClick={() => toggleSet(setSelectedColleges)(c)}>{c}</button>
                  ))}
                </div>
              </div>
              {/* Date */}
              <div>
                <p style={{ margin:"0 0 10px", fontSize:11, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em" }}>Date Range</p>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="modal-input" style={{ fontSize:12 }}/>
                  <input type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   className="modal-input" style={{ fontSize:12 }}/>
                  <div style={{ display:"flex", gap:5 }}>
                    <button className="chip-filter" onClick={()=>setLastDays(7)}>7d</button>
                    <button className="chip-filter" onClick={()=>setLastDays(30)}>30d</button>
                    <button className="chip-filter" onClick={()=>{setDateFrom("");setDateTo("");}}>All</button>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop:14, borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:14, display:"flex", justifyContent:"flex-end" }}>
              <button className="action-btn action-btn-ghost" onClick={clearAllFilters} style={{ fontSize:12 }}>Clear all filters</button>
            </div>
          </div>
        )}

        {/* ═══ KPI STAT CARDS ═══ */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:"1.5rem" }}>
          <div className="a-card">
            <StatCard label="Total Reports" value={reports.length} color="#6366f1"
              sub={`${filtered.length} filtered`}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            />
          </div>

          <div className="a-card">
<StatCard label="Pending" value={statusCounts["Pending"]} color="#f59e0b"
              sub="Needs attention"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            />
          </div>
          
          <div className="a-card">
  <StatCard label="Inspecting" value={statusCounts["Inspecting"]} color="#0083db"
    sub="Under review"
    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 discussion 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/></svg>}
  />
</div>


          <div className="a-card">
<StatCard label="In Progress" value={statusCounts["In Progress"]} color="#a78bfa"
              sub="Active"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>}
            />
          </div>
          
          
          <div className="a-card">
<StatCard label="Resolved" value={statusCounts["Resolved"]} color="#34d399"
                    sub={`${resolvedPct}% completion`}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            />
          </div>



          <div className="a-card">
<StatCard label="Unfinished" value={statusCounts["Unfinished"]} color="#a20303" 
              sub="Not yet completed"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            />
          </div>
          <div className="a-card">
            <StatCard label="Resolution Rate" value={`${resolvedPct}%`} color="#34d399"
              sub={`${statusCounts["Resolved"]}/${filtered.length} total`}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>}
            />
          </div>
        </div>
        

        {/* ═══ MAIN CHARTS GRID ═══ */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1.6fr", gap:12, marginBottom:12 }}>

          {/* Status Donut */}
          <GlassCard className="a-card" style={{ animationDelay:"0.1s" }}>
            <SectionHeader title="Status Overview" subtitle={`${filtered.length} reports`} />
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius="55%" outerRadius="82%" paddingAngle={3} dataKey="value">
  {statusPieData.map(e => <Cell key={e.name} fill={e.color} stroke="transparent"/>)}
</Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:4 }}>
              {statusPieData.map(e => (
                <div key={e.name} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:e.color, flexShrink:0 }}/>
                  <span style={{ color:"#94a3b8" }}>{e.name}</span>
                  <span style={{ color:"#f1f5f9", fontWeight:700 }}>{e.value}</span>
                  <span style={{ color:"#475569" }}>({e.percent}%)</span>
                </div>
              ))}
            </div>
          </GlassCard>



          {/* Building Bar */}
          <GlassCard className="a-card" style={{ animationDelay:"0.15s" }}>
            <SectionHeader title="Reports by Building" />
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buildingData} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                  <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false}/>
                  <YAxis allowDecimals={false} tick={{ fill:"#475569", fontSize:11 }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip />} cursor={{ fill:"rgba(255,255,255,0.03)" }}/>
                  <Legend content={() => (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:10, justifyContent:"center" }}>
                      {buildingData.map((b,i) => (
                        <div key={b.name} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11 }}>
                          <span style={{ width:8, height:8, borderRadius:2, background:getBuildingColor(b.name,i) }}/>
                          <span style={{ color:"#64748b" }}>{b.name}</span>
                        </div>
                      ))}
                    </div>
                  )}/>
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {buildingData.map((e,i) => <Cell key={e.name} fill={getBuildingColor(e.name,i)}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:12, marginBottom:12 }}>

          {/* Concern Bar */}
          <GlassCard className="a-card" style={{ animationDelay:"0.2s" }}>
            <SectionHeader title="Reports by Concern Type" />
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={concernData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                  <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false}/>
                  <YAxis allowDecimals={false} tick={{ fill:"#475569", fontSize:11 }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip />} cursor={{ fill:"rgba(255,255,255,0.03)" }}
                    labelFormatter={(_,p) => { const pl = (p&&p[0]?.payload) as ConcernChartDatum|undefined; return pl?pl.name:""; }}
                    formatter={(v:any) => [`${v}`,"Reports"]}/>
                  <Legend content={() => {
                    const bases = ["Civil","Mechanical","Electrical","Safety Hazard","Other"];
                    return (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:10, justifyContent:"center" }}>
                        {bases.filter(b => concernData.some(d => d.base===b)).map(b => (
                          <div key={b} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11 }}>
                            <span style={{ width:8, height:8, borderRadius:2, background:getConcernColorFromBase(b) }}/>
                            <span style={{ color:"#64748b" }}>{b}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}/>
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {concernData.map(e => <Cell key={`${e.base}-${e.name}`} fill={getConcernColorFromBase(e.base)}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* College Pie */}
          <GlassCard className="a-card" style={{ animationDelay:"0.25s" }}>
            <SectionHeader title="By College" />
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collegeData} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false}/>
                  <XAxis type="number" allowDecimals={false} tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="name" tick={{ fill:"#94a3b8", fontSize:11 }} axisLine={false} tickLine={false} width={50}/>
                  <Tooltip content={<CustomTooltip />} cursor={{ fill:"rgba(255,255,255,0.03)" }}/>
                  <Bar dataKey="value" radius={[0,4,4,0]}>
                    {collegeData.map((e,i) => <Cell key={e.name} fill={getCollegeColor(e.name,i)}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* ═══ TIME SERIES ═══ */}
        <GlassCard className="a-card" style={{ animationDelay:"0.3s", marginBottom:12 }}>
          <SectionHeader
            title="Reports Over Time"
            subtitle={`Grouped by ${timeMode}`}
            action={
              <div style={{ display:"flex", gap:4, background:"rgba(255,255,255,0.04)", borderRadius:10, padding:4, border:"1px solid rgba(255,255,255,0.06)" }}>
                {(["day","week","month","year"] as TimeMode[]).map(m => (
                  <button key={m} className={`time-btn${timeMode===m?" active":""}`} onClick={()=>setTimeMode(m)}>
                    {m.charAt(0).toUpperCase()+m.slice(1)}s
                  </button>
                ))}
              </div>
            }
          />
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="label" tick={{ fill:"#475569", fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis allowDecimals={false} tick={{ fill:"#475569", fontSize:11 }} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip />} cursor={{ stroke:"rgba(99,102,241,0.3)", strokeWidth:1 }}/>
                <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#areaGrad)" strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:"#6366f1", stroke:"#020817", strokeWidth:2 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* ═══ RESOLUTION PROGRESS BAR ═══ */}
        <GlassCard className="a-card" style={{ animationDelay:"0.35s" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div>
              <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#f1f5f9" }}>Overall Resolution Rate</p>
<p style={{ margin:"3px 0 0", fontSize:12, color:"#475569" }}>{statusCounts["Resolved"]} resolved of {filtered.length} total</p>            </div>
            <span style={{ fontSize:28, fontWeight:800, color:"#34d399", letterSpacing:"-0.02em" }}>{resolvedPct}%</span>
          </div>
          <div style={{ height:10, background:"rgba(255,255,255,0.06)", borderRadius:999, overflow:"hidden", position:"relative" }}>
            <div style={{ position:"absolute", top:0, left:0, height:"100%", width:`${resolvedPct}%`, background:"linear-gradient(90deg,#34d399,#22d3ee)", borderRadius:999, transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)", boxShadow:"0 0 12px rgba(52,211,153,0.4)" }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, flexWrap:"wrap", gap:8 }}>
            {(Object.keys(statusCounts) as StatusKey[]).map(k => (
              <div key={k} style={{ textAlign:"center" }}>
                <div style={{ fontSize:16, fontWeight:800, color:STATUS_COLORS[k] }}>{statusCounts[k]}</div>
                <div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", letterSpacing:"0.06em" }}>{STATUS_LABELS[k]}</div>
              </div>
            ))}
          </div>
        </GlassCard>

      </div>

      {/* ═══════════════════════════════════════
          TASKS PANEL MODAL
      ═══════════════════════════════════════ */}
      {listsOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(2,8,23,0.85)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={() => setListsOpen(false)}>
          <div style={{ background:"#0a1628", border:"1px solid rgba(255,255,255,0.08)", borderRadius:24, width:"100%", maxWidth:980, maxHeight:"92vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.15)" }}
            onClick={e => e.stopPropagation()}>

            {/* Panel Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1.25rem 1.5rem", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(99,102,241,0.06)", flexWrap:"wrap", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
                </div>
                <div>
                  <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:"#f1f5f9" }}>Tasks Panel</h2>
                  <p style={{ margin:0, fontSize:11, color:"#475569" }}>{serverTasks.length} tasks total</p>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                {taskSaveStatus && (
                  <span style={{ fontSize:12, padding:"5px 12px", borderRadius:8, background:taskSaveStatus.startsWith("✅")?"rgba(52,211,153,0.12)":taskSaveStatus.startsWith("❌")?"rgba(239,68,68,0.12)":"rgba(255,255,255,0.06)", color:taskSaveStatus.startsWith("✅")?"#34d399":taskSaveStatus.startsWith("❌")?"#f87171":"#94a3b8", border:`1px solid ${taskSaveStatus.startsWith("✅")?"rgba(52,211,153,0.25)":taskSaveStatus.startsWith("❌")?"rgba(239,68,68,0.25)":"rgba(255,255,255,0.08)"}` }}>
                    {taskSaveStatus}
                  </span>
                )}
                <button className="action-btn action-btn-primary" style={{ fontSize:12, padding:"7px 14px" }} onClick={() => { setCreateDraft(EMPTY_DRAFT); setStaffInput(""); setCheckInput(""); setShowCreateModal(true); }}>
                  + New Task
                </button>
                <button className="action-btn action-btn-ghost" style={{ fontSize:12, padding:"7px 12px" }} onClick={loadTasks}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
                <button onClick={() => setListsOpen(false)} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#64748b", fontSize:16, cursor:"pointer", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>×</button>
              </div>
            </div>

            {/* Panel Body */}
            <div style={{ overflowY:"auto", flex:1, padding:"1.25rem 1.5rem" }}>
              {loadingTasks && <p style={{ color:"#64748b", fontSize:13, textAlign:"center", padding:"2rem 0" }}>Loading tasks…</p>}
              {!loadingTasks && serverTasks.length === 0 && (
                <div style={{ textAlign:"center", padding:"3rem 0", color:"#475569" }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                  <p style={{ margin:0, fontSize:14, fontWeight:600, color:"#64748b" }}>No tasks yet</p>
                  <p style={{ margin:"6px 0 0", fontSize:12 }}>Create one to get started.</p>
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
                {serverTasks.map(task => {
                  const checklist   = task.checklist || [];
                  const done        = checklist.filter(c => c.done).length;
                  const total       = checklist.length;
                  const pct         = total > 0 ? Math.round((done/total)*100) : 0;
                  const isEd        = editingTaskId === task._id;
                  const priColor    = getPriorityColor(task.priority);
                  const sColor      = getStatusColor(task.status);
                  return (
                    <div key={task._id} className="task-card" style={{ borderTop:`2px solid ${priColor}` }}>
                      {isEd ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                          <input type="text" value={task.name} className="modal-input"
                            onChange={e => setServerTasks(p => p.map(t => t._id===task._id?{...t,name:e.target.value}:t))}/>
                          <select value={task.status||"Pending"} className="modal-input"
                            onChange={e => setServerTasks(p => p.map(t => t._id===task._id?{...t,status:e.target.value}:t))}>
                            {metaStatuses.filter(s=>s.name.toLowerCase()!=="archived").map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                          </select>
                          <select value={task.priority||""} className="modal-input"
                            onChange={e => setServerTasks(p => p.map(t => t._id===task._id?{...t,priority:e.target.value}:t))}>
                            <option value="">— No priority —</option>
                            {metaPriorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                          </select>
                          <textarea placeholder="Assigned staff (comma separated)" defaultValue={(task.assignedStaff||[]).join(", ")} className="modal-input"
                            onBlur={e => setServerTasks(p => p.map(t => t._id===task._id?{...t,assignedStaff:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)}:t))}
                            style={{ minHeight:36, resize:"none" }}/>
                          <div style={{ display:"flex", gap:6 }}>
                            <button onClick={()=>updateTask(task._id!,{name:task.name,status:task.status,priority:task.priority,assignedStaff:task.assignedStaff})}
                              style={{ flex:1, padding:"6px 0", fontSize:12, fontWeight:600, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:7, cursor:"pointer", fontFamily:"inherit" }}>Save</button>
                            <button onClick={()=>setEditingTaskId(null)}
                              style={{ flex:1, padding:"6px 0", fontSize:12, fontWeight:600, background:"rgba(255,255,255,0.06)", color:"#94a3b8", border:"1px solid rgba(255,255,255,0.08)", borderRadius:7, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                            <div style={{ flex:1, marginRight:8 }}>
                              <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#f1f5f9", lineHeight:1.3 }}>{task.name}</p>
                              {task.concernType && <p style={{ margin:"3px 0 0", fontSize:11, color:"#475569" }}>{task.concernType}</p>}
                            </div>
                            <button onClick={()=>setEditingTaskId(task._id!)}
                              style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:13, padding:"2px", lineHeight:1, borderRadius:4, transition:"color 0.15s" }}>✏️</button>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                            <span style={{ padding:"2px 9px", borderRadius:999, fontSize:10, fontWeight:700, background:`${sColor}18`, color:sColor, border:`1px solid ${sColor}35` }}>{task.status||"Pending"}</span>
                            {task.priority && <span style={{ padding:"2px 9px", borderRadius:999, fontSize:10, fontWeight:700, background:`${priColor}18`, color:priColor, border:`1px solid ${priColor}35` }}>{task.priority}</span>}
                          </div>
                          {(task.assignedStaff||[]).length > 0 && (
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                              <div style={{ display:"flex" }}>
                                {task.assignedStaff!.slice(0,3).map((s,i) => (
                                  <div key={s} title={s} style={{ width:22, height:22, borderRadius:"50%", background:`hsl(${s.charCodeAt(0)*15},60%,50%)`, border:"2px solid #0a1628", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"#fff", marginLeft:i>0?-6:0 }}>
                                    {s.charAt(0).toUpperCase()}
                                  </div>
                                ))}
                              </div>
                              <span style={{ fontSize:11, color:"#64748b" }}>{task.assignedStaff!.join(", ")}</span>
                            </div>
                          )}
                          {task.reportId && <p style={{ margin:"0 0 8px", fontSize:11, color:"#475569" }}>🔗 #{task.reportId}</p>}

                          {/* Checklist */}
                          <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:10, marginTop:4 }}>
                            {total > 0 && (
                              <>
                                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                                  <span style={{ fontSize:11, color:"#475569", fontWeight:500 }}>Checklist</span>
                                  <span style={{ fontSize:11, color:pct===100?"#34d399":"#64748b", fontWeight:600 }}>{done}/{total} · {pct}%</span>
                                </div>
                                <div style={{ height:3, background:"rgba(255,255,255,0.06)", borderRadius:999, overflow:"hidden", marginBottom:8 }}>
                                  <div style={{ height:"100%", background:pct===100?"#34d399":priColor, width:`${pct}%`, transition:"width 0.3s", borderRadius:999 }}/>
                                </div>
                                <div style={{ maxHeight:100, overflowY:"auto", marginBottom:6 }}>
                                  {checklist.map(item => (
                                    <div key={getItemKey(item)} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5, fontSize:12 }}>
                                      <input type="checkbox" checked={!!item.done} onChange={e=>toggleChecklistItem(task,item,e.target.checked)} style={{ accentColor:priColor, cursor:"pointer" }}/>
                                      <span style={{ flex:1, textDecoration:item.done?"line-through":"none", color:item.done?"#475569":"#94a3b8" }}>{item.text}</span>
                                      <button onClick={()=>removeChecklistItem(task,item)} style={{ background:"none", border:"none", color:"#374151", cursor:"pointer", fontSize:13, padding:"0 2px", lineHeight:1 }}>×</button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                            <div style={{ display:"flex", gap:5 }}>
                              <input type="text" placeholder="Add item…" value={newChecklistText[task._id!]||""} className="modal-input"
                                style={{ fontSize:11, padding:"5px 8px" }}
                                onChange={e=>setNewChecklistText(p=>({...p,[task._id!]:e.target.value}))}
                                onKeyDown={e=>{if(e.key==="Enter")addChecklistItem(task,newChecklistText[task._id!]||"");}}/>
                              <button onClick={()=>addChecklistItem(task,newChecklistText[task._id!]||"")}
                                style={{ padding:"5px 10px", fontSize:13, fontWeight:700, background:"rgba(99,102,241,0.15)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.25)", borderRadius:7, cursor:"pointer" }}>+</button>
                            </div>
                          </div>
                          <button onClick={()=>deleteTask(task._id!)}
                            style={{ marginTop:10, width:"100%", padding:"5px", fontSize:11, fontWeight:600, background:"rgba(239,68,68,0.08)", color:"#f87171", border:"1px solid rgba(239,68,68,0.2)", borderRadius:7, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>
                            Delete Task
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          CREATE TASK MODAL
      ═══════════════════════════════════════ */}
      {showCreateModal && (
        <div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(2,8,23,0.9)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={()=>setShowCreateModal(false)}>
          <div style={{ background:"#0a1628", border:"1px solid rgba(99,102,241,0.2)", borderRadius:20, padding:"1.5rem", width:"100%", maxWidth:500, display:"flex", flexDirection:"column", gap:"1rem", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px rgba(0,0,0,0.7)" }}
            onClick={e=>e.stopPropagation()}>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:"#f1f5f9" }}>New Task</h3>
                <p style={{ margin:"3px 0 0", fontSize:11, color:"#475569" }}>Add a maintenance task</p>
              </div>
              <button onClick={()=>setShowCreateModal(false)} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#64748b", fontSize:16, cursor:"pointer", width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>

            <div>
              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Task Name *</label>
              <input className="modal-input" placeholder="e.g. Replace aircon unit" value={createDraft.name} onChange={e=>setCreateDraft(d=>({...d,name:e.target.value}))}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Concern Type</label>
                <select className="modal-input" value={createDraft.concernType||"Other"} onChange={e=>setCreateDraft(d=>({...d,concernType:e.target.value}))}>
                  {metaConcernTypes.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Link to Report</label>
                <select className="modal-input" value={createDraft.reportId||""} onChange={e=>setCreateDraft(d=>({...d,reportId:e.target.value}))}>
                  <option value="">— None —</option>
                  {reports.map(r=><option key={r._id} value={r.reportId}>{r.reportId} – {r.concern}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Priority</label>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {metaPriorities.map(p=>(
                  <button key={p.id} type="button"
                    onClick={()=>setCreateDraft(d=>({...d,priority:d.priority===p.name?"":p.name}))}
                    style={{ padding:"5px 14px", borderRadius:999, fontSize:12, fontWeight:700, border:`1px solid ${p.color}50`, background:createDraft.priority===p.name?p.color:"transparent", color:createDraft.priority===p.name?"#fff":p.color, cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit" }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Assign Staff</label>
              <div style={{ display:"flex", gap:6 }}>
                <input list="create-staff-list" className="modal-input" placeholder="Staff name…" value={staffInput} onChange={e=>setStaffInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"){const v=staffInput.trim();if(v&&!(createDraft.assignedStaff||[]).includes(v)){setCreateDraft(d=>({...d,assignedStaff:[...(d.assignedStaff||[]),v]}));setStaffInput("");}}}}/>
                <datalist id="create-staff-list">{allStaff.map(s=><option key={s} value={s}/>)}</datalist>
                <button type="button" onClick={()=>{const v=staffInput.trim();if(v&&!(createDraft.assignedStaff||[]).includes(v)){setCreateDraft(d=>({...d,assignedStaff:[...(d.assignedStaff||[]),v]}));setStaffInput("");}}}
                  style={{ padding:"8px 14px", fontSize:12, fontWeight:600, background:"rgba(99,102,241,0.15)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.25)", borderRadius:8, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit" }}>Add</button>
              </div>
              {(createDraft.assignedStaff||[]).length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:8 }}>
                  {(createDraft.assignedStaff||[]).map(s=>(
                    <span key={s} style={{ background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.25)", color:"#a5b4fc", borderRadius:999, padding:"3px 10px", fontSize:12, display:"flex", alignItems:"center", gap:5 }}>
                      {s}<button type="button" onClick={()=>setCreateDraft(d=>({...d,assignedStaff:(d.assignedStaff||[]).filter(x=>x!==s)}))} style={{ border:"none", background:"none", cursor:"pointer", color:"#6366f1", fontWeight:700, fontSize:13, lineHeight:1, padding:0 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Notes</label>
              <textarea className="modal-input" rows={2} placeholder="Optional notes…" value={createDraft.notes||""} onChange={e=>setCreateDraft(d=>({...d,notes:e.target.value}))} style={{ resize:"none" }}/>
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Checklist <span style={{ color:"#334155", fontWeight:400, textTransform:"none", letterSpacing:"0" }}>— press Enter to add</span></label>
              <input className="modal-input" placeholder="Add item…" value={checkInput} onChange={e=>setCheckInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&checkInput.trim()){setCreateDraft(d=>({...d,checklist:[...(d.checklist||[]),{id:makeUid(),text:checkInput.trim(),done:false}]}));setCheckInput("");}}}/>
              {(createDraft.checklist||[]).length > 0 && (
                <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:5 }}>
                  {(createDraft.checklist||[]).map(item=>(
                    <div key={item.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <input type="checkbox" checked={item.done} style={{ accentColor:"#6366f1", cursor:"pointer" }}
                        onChange={()=>setCreateDraft(d=>({...d,checklist:(d.checklist||[]).map(c=>c.id===item.id?{...c,done:!c.done}:c)}))}/>
                      <span style={{ flex:1, fontSize:12, color:"#94a3b8", textDecoration:item.done?"line-through":"none", opacity:item.done?0.5:1 }}>{item.text}</span>
                      <button type="button" onClick={()=>setCreateDraft(d=>({...d,checklist:(d.checklist||[]).filter(c=>c.id!==item.id)}))}
                        style={{ border:"none", background:"none", cursor:"pointer", fontSize:14, color:"#374151", lineHeight:1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:8, paddingTop:4 }}>
              <button className="action-btn action-btn-primary" style={{ flex:1, justifyContent:"center", padding:"10px 0" }} onClick={createTask}>
                Save Task
              </button>
              <button className="action-btn action-btn-ghost" style={{ flex:1, justifyContent:"center", padding:"10px 0" }} onClick={()=>setShowCreateModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          PRE-PRINT SIGNATORIES MODAL
      ═══════════════════════════════════════ */}
      {showPrintModal && (
        <div
          style={{ position:"fixed", inset:0, zIndex:700, background:"rgba(2,8,23,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}
          onClick={() => setShowPrintModal(false)}
        >
          <div
            style={{ background:"#0a1628", border:"1px solid rgba(99,102,241,0.25)", borderRadius:22, width:"100%", maxWidth:580, boxShadow:"0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1)", overflow:"hidden" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1.25rem 1.5rem", background:"rgba(99,102,241,0.07)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {/* printer icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:"#f1f5f9" }}>Configure Signatories</h3>
                  <p style={{ margin:"3px 0 0", fontSize:11, color:"#475569" }}>Names will appear at the bottom of the printed report</p>
                </div>
              </div>
              <button onClick={() => setShowPrintModal(false)} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#64748b", fontSize:18, cursor:"pointer", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>

            {/* Signatory rows */}
            <div style={{ padding:"1.5rem" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:24 }}>
                {signatories.map((sig, idx) => (
                  <div key={idx} style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:10, alignItems:"end" }}>
                    {/* Name field */}
                    <div>
                      <label style={{ display:"block", fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>
                        Signatory {idx + 1} — Name
                      </label>
                      <input
                        className="modal-input"
                        placeholder="e.g. Juan dela Cruz"
                        value={sig.name}
                        onChange={e => setSignatories(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                      />
                    </div>
                    {/* Role field */}
                    <div>
                      <label style={{ display:"block", fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>
                        Role / Designation
                      </label>
                      <input
                        className="modal-input"
                        placeholder="e.g. Head Engineer"
                        value={sig.role}
                        onChange={e => setSignatories(prev => prev.map((s, i) => i === idx ? { ...s, role: e.target.value } : s))}
                      />
                    </div>
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => setSignatories(prev => prev.filter((_, i) => i !== idx))}
                      title="Remove signatory"
                      style={{ padding:"8px 10px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:8, color:"#f87171", cursor:"pointer", fontSize:15, lineHeight:1, height:38, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Preview strip */}
              {signatories.length > 0 && (
                <div style={{ marginBottom:24, padding:"12px 16px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12 }}>
                  <p style={{ margin:"0 0 10px", fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em" }}>Preview</p>
                  <div style={{ display:"flex", gap:16, justifyContent:"space-around", flexWrap:"wrap" }}>
                    {signatories.map((sig, idx) => (
                      <div key={idx} style={{ textAlign:"center", minWidth:100, flex:1 }}>
                        <div style={{ height:28, borderBottom:"1px solid rgba(255,255,255,0.2)", marginBottom:6 }}/>
                        <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#f1f5f9", textTransform:"uppercase", letterSpacing:"0.04em" }}>
                          {sig.name || <span style={{ fontStyle:"italic", color:"#475569", fontWeight:400 }}>Signature over Printed Name</span>}
                        </p>
                        <p style={{ margin:"3px 0 0", fontSize:10, color:"#64748b" }}>{sig.role || <span style={{ fontStyle:"italic" }}>Role</span>}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add signatory */}
              <button
                type="button"
                onClick={() => setSignatories(prev => [...prev, { name:"", role:"" }])}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", background:"rgba(99,102,241,0.08)", border:"1px dashed rgba(99,102,241,0.3)", borderRadius:9, color:"#a5b4fc", cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit", marginBottom:20, width:"100%", justifyContent:"center" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Signatory
              </button>

              {/* Action buttons */}
              <div style={{ display:"flex", gap:8 }}>
                <button
                  className="action-btn action-btn-ghost"
                  style={{ flex:1, justifyContent:"center", padding:"11px 0" }}
                  onClick={() => { setSignatories(DEFAULT_SIGNATORIES); }}>
                  Reset to Defaults
                </button>
                <button
                  className="action-btn action-btn-primary"
                  style={{ flex:2, justifyContent:"center", padding:"11px 0", gap:8 }}
                  onClick={() => { setShowPrintModal(false); executePrint(signatories); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  Confirm &amp; Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
