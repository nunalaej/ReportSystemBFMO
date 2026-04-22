// Frontend/app/Admin/Analytics.tsx — with dynamic StatCards
"use client";

import "@/app/Admin/style/analytics.css";

import React, { FC, useState, useEffect, useMemo, useCallback } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { redirect, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) ||
  "http://localhost:5000";

/* =====================================================================
   TYPES
   ===================================================================== */
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
interface TimeSeriesPoint { label: string; value: number; }
type TimeMode = "day" | "week" | "month" | "year";

/* =====================================================================
   CONSTANTS & HELPERS
   ===================================================================== */
const BUILDING_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#ef4444", "#a78bfa", "#34d399", "#fb7185", "#64748b"];
const COLLEGE_COLORS  = ["#6366f1", "#22d3ee", "#f59e0b", "#ef4444", "#a78bfa", "#34d399", "#fb7185", "#64748b"];

const getBuildingColor = (_: string, i: number) => BUILDING_COLORS[i % BUILDING_COLORS.length];
const getCollegeColor  = (_: string, i: number) => COLLEGE_COLORS[i  % COLLEGE_COLORS.length];

const getConcernBaseFromLabel = (fullLabel: string): { base: string; sub: string } => {
  const [baseRaw, subRaw] = fullLabel.split(" : ");
  return {
    base: (baseRaw || "Unspecified").trim(),
    sub:  (subRaw  || baseRaw || "Unspecified").trim(),
  };
};

const getConcernColorFromBase = (base: string): string => {
  const b = base.toLowerCase();
  if (b === "civil")                             return "#6366f1";
  if (b === "mechanical")                        return "#22d3ee";
  if (b === "electrical")                        return "#f59e0b";
  if (b === "safety hazard" || b === "safety")   return "#ef4444";
  if (b === "other" || b === "others")           return "#fb923c";
  return "#94a3b8";
};

const formatConcernLabel = (report: Report) => {
  const base = report.concern || "Unspecified";
  const sub  = report.subConcern || report.otherConcern;
  return sub ? `${base} : ${sub}` : base;
};

const DEFAULT_STATUSES: MetaStatus[] = [
  { id: "pending",    name: "Pending",     color: "#f59e0b" },
  { id: "inspecting", name: "Inspecting",  color: "#0083db" },
  { id: "progress",   name: "In Progress", color: "#a78bfa" },
  { id: "resolved",   name: "Resolved",    color: "#10a373" },
  { id: "unfinished", name: "Unfinished",  color: "#a20303" },
  { id: "archived",   name: "Archived",    color: "#64748b" },
];

const DEFAULT_PRIORITIES: MetaPriority[] = [
  { id: "low",      name: "Low",      color: "#34d399" },
  { id: "medium",   name: "Medium",   color: "#f59e0b" },
  { id: "high",     name: "High",     color: "#ef4444" },
  { id: "critical", name: "Critical", color: "#a855f7" },
];

const normalizeStatus = (status: string | undefined, statuses: MetaStatus[]) => {
  const s = (status || "Pending").trim().toLowerCase();
  const match = statuses.find(st => st.name.toLowerCase() === s || st.id.toLowerCase() === s);
  if (match) return match.name;

  // Fuzzy matching for common variations
  if (s.includes("inspecting")) {
    const hit = statuses.find(st => /inspecting/i.test(st.name));
    if (hit) return hit.name;
  }
  if (s.includes("in progress") || s.includes("inprogress")) {
    const hit = statuses.find(st => /progress/i.test(st.name));
    if (hit) return hit.name;
  }
  if (s.includes("unfinished")) {
    const hit = statuses.find(st => /unfinished/i.test(st.name));
    if (hit) return hit.name;
  }
  if (s.includes("closed")) {
    const hit = statuses.find(st => /closed/i.test(st.name));
    if (hit) return hit.name;
  }
  if (s.includes("archived")) {
    const hit = statuses.find(st => /archived/i.test(st.name));
    if (hit) return hit.name;
  }
  return "Pending";
};

const getBaseConcernFromReport = (r: Report): string =>
  (r.concern || "Unspecified").trim() || "Unspecified";

const getItemKey = (item: ChecklistItem): string => item._id || item.id;
const makeUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* =====================================================================
   RECHARTS CUSTOM TOOLTIP
   ===================================================================== */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--surface-raise)",
        border: "1px solid var(--card-border-2)",
        borderRadius: 12,
        padding: "10px 14px",
        boxShadow: "var(--shadow-lg)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {label && (
        <p style={{
          margin: "0 0 4px",
          fontSize: 11,
          color: "var(--muted)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          {label}
        </p>
      )}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{
          margin: 0,
          fontSize: 13,
          color: "var(--text)",
          fontWeight: 600,
          fontFamily: "var(--font-mono)",
        }}>
          <span style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 2,
            background: p.color,
            marginRight: 8,
            verticalAlign: "middle",
          }}/>
          {p.value}
          <span style={{
            color: "var(--muted)",
            fontWeight: 400,
            marginLeft: 6,
            fontFamily: "var(--font-sans)",
          }}>
            {p.name !== "value" ? p.name : "reports"}
          </span>
        </p>
      ))}
    </div>
  );
};

/* =====================================================================
   STAT CARD — Dynamic, uses CSS tokens for automatic dark/light parity
   ===================================================================== */
const StatCard: FC<{
  label: string;
  value: string | number;
  color: string;
  icon: React.ReactNode;
  sub?: string;
}> = ({ label, value, color, icon, sub }) => (
  <div className="stat-card-v2">
    <div className="stat-card-v2__accent" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
    <div
      className="stat-card-v2__icon"
      style={{
        background: `${color}18`,
        border: `1px solid ${color}35`,
        color,
      }}
    >
      {icon}
    </div>
    <div className="stat-card-v2__value">{value}</div>
    <div className="stat-card-v2__label">{label}</div>
    {sub && <div className="stat-card-v2__sub" style={{ color }}>{sub}</div>}
  </div>
);

/* =====================================================================
   MAIN COMPONENT
   ===================================================================== */
const Analytics: FC = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [canView, setCanView] = useState(false);
  const [statuses, setStatuses] = useState<MetaStatus[]>(DEFAULT_STATUSES);
  const [hiddenStudentStatuses, setHiddenStudentStatuses] = useState<string[]>([]);

  /* ────── AUTH ────── */
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

  /* ────── TASKS ────── */
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

  useEffect(() => {
    if (!canView) return;
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    window.addEventListener("focus", fetchTasks);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", fetchTasks);
    };
  }, [canView, fetchTasks]);

  /* ────── META ────── */
  const FALLBACK_CONCERN_TYPES = ["Electrical", "Civil", "Mechanical", "Safety Hazard", "Other"];

  const [metaStatuses,    setMetaStatuses]    = useState<MetaStatus[]>(DEFAULT_STATUSES);
  const [metaPriorities,  setMetaPriorities]  = useState<MetaPriority[]>(DEFAULT_PRIORITIES);
  const [metaConcernTypes, setMetaConcernTypes] = useState<string[]>(FALLBACK_CONCERN_TYPES);
  const [allStaff, setAllStaff] = useState<string[]>([]);

  useEffect(() => {
    const loadAnalyticsMeta = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/meta?ts=${Date.now()}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (data) {
          if (data.statuses?.length > 0)   { setStatuses(data.statuses); setMetaStatuses(data.statuses); }
          if (data.priorities?.length > 0) setMetaPriorities(data.priorities);
          if (data.concerns?.length > 0)   setMetaConcernTypes([...data.concerns.map((c: any) => c.label), "Other"]);
          if (Array.isArray(data.signatories) && data.signatories.length) setSignatories(data.signatories);
          if (Array.isArray(data.hiddenStudentStatuses)) {
            setHiddenStudentStatuses(data.hiddenStudentStatuses);
          }
        }
      } catch (err) {
        console.warn("[Analytics] Meta fetch failed, using defaults:", err);
      }
    };
    void loadAnalyticsMeta();
  }, []);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/staff`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const list = Array.isArray(data?.staff) ? data.staff.map((s: any) => s.name).filter(Boolean)
                   : Array.isArray(data)        ? data.map((s: any) => s.name).filter(Boolean)
                   : [];
        if (list.length) setAllStaff(list);
      } catch {}
    };
    if (canView) void fetchStaff();
  }, [canView]);

  /* ────── DERIVED META ────── */
  const STATUSES = useMemo(() => statuses.map(s => s.name), [statuses]);

  const STATUS_COLORS_MAP = useMemo(() => {
    const map: Record<string, string> = {};
    statuses.forEach(s => { map[s.name] = s.color; });
    return map;
  }, [statuses]);

  const DEFAULT_STATUS_SET = useMemo(
    () => new Set(statuses.filter(s => !/archiv/i.test(s.name)).map(s => s.name)),
    [statuses]
  );

  /* ────── REPORTS ────── */
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadErr, setLoadErr] = useState<string>("");

  const fetchReports = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoadErr(""); setLoading(true);
      const res = await fetch(`${API_BASE}/api/reports`, {
        cache: "no-store",
        signal,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      const list: Report[] = Array.isArray(data) ? data : Array.isArray(data.reports) ? data.reports : [];
      setReports(list);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setLoadErr("Failed to load reports from server");
      console.error("[Analytics] Reports fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    const ctrl = new AbortController();
    fetchReports(ctrl.signal);
    return () => ctrl.abort();
  }, [canView, fetchReports]);

  /* ────── FILTERS ────── */
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(() => DEFAULT_STATUS_SET);
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(() => new Set());
  const [selectedConcerns,  setSelectedConcerns]  = useState<Set<string>>(() => new Set());
  const [selectedColleges,  setSelectedColleges]  = useState<Set<string>>(() => new Set());
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo,   setDateTo]   = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (value: string) => {
    setter(prev => {
      const n = new Set(prev);
      n.has(value) ? n.delete(value) : n.add(value);
      return n;
    });
  };

  const clearAllFilters = () => {
    setSelectedStatuses(new Set(DEFAULT_STATUS_SET));
    setSelectedBuildings(new Set());
    setSelectedConcerns(new Set());
    setSelectedColleges(new Set());
    setDateFrom(""); setDateTo("");
  };

  const setLastDays = (days: number) => {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - days + 1);
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(today.toISOString().slice(0, 10));
  };

  // Admins see ALL reports regardless of hiddenStudentStatuses
  const filtered = useMemo(() => {
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS   = dateTo   ? new Date(dateTo).getTime() + 86399999 : null;
    return reports.filter(r => {
      const normalizedStatus = normalizeStatus(r.status, statuses);
      if (!normalizedStatus || !selectedStatuses.has(normalizedStatus)) return false;
      if (selectedBuildings.size && !selectedBuildings.has(r.building || "")) return false;
      if (selectedConcerns.size  && !selectedConcerns.has(getBaseConcernFromReport(r))) return false;
      if (selectedColleges.size  && !selectedColleges.has(r.college || "")) return false;
      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return false;
        if (toTS   && ts > toTS)   return false;
      }
      return true;
    });
  }, [reports, selectedStatuses, selectedBuildings, selectedConcerns, selectedColleges, dateFrom, dateTo, statuses]);

  const reportsMatchingStatus = useMemo(() => {
    return reports.filter(r => {
      const normalizedStatus = normalizeStatus(r.status, statuses);
      return !!normalizedStatus && selectedStatuses.has(normalizedStatus);
    });
  }, [reports, selectedStatuses, statuses]);

  const availableStatuses = useMemo(() => STATUSES, [STATUSES]);
  const availableBuildings = useMemo(() => {
    const s = new Set<string>();
    reportsMatchingStatus.forEach(r => { if (r.building) s.add(r.building); });
    selectedBuildings.forEach(v => s.add(v));
    return [...s].sort();
  }, [reportsMatchingStatus, selectedBuildings]);
  const availableConcerns = useMemo(() => {
    const s = new Set<string>();
    reportsMatchingStatus.forEach(r => {
      const b = getBaseConcernFromReport(r);
      if (b) s.add(b);
    });
    selectedConcerns.forEach(v => s.add(v));
    return [...s].sort();
  }, [reportsMatchingStatus, selectedConcerns]);
  const availableColleges = useMemo(() => {
    const s = new Set<string>();
    reportsMatchingStatus.forEach(r => {
      if ((r.college || "").trim()) s.add(r.college as string);
    });
    selectedColleges.forEach(v => s.add(v));
    return [...s].sort();
  }, [reportsMatchingStatus, selectedColleges]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    const changed =
      selectedStatuses.size !== DEFAULT_STATUS_SET.size ||
      [...DEFAULT_STATUS_SET].some(s => !selectedStatuses.has(s));
    if (changed) c++;
    if (selectedBuildings.size) c++;
    if (selectedConcerns.size)  c++;
    if (selectedColleges.size)  c++;
    if (dateFrom || dateTo)     c++;
    return c;
  }, [selectedStatuses, selectedBuildings, selectedConcerns, selectedColleges, dateFrom, dateTo, DEFAULT_STATUS_SET]);

  /* ────── DYNAMIC STATUS COUNTS ────── */
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    statuses.forEach(s => { map[s.name] = 0; });
    filtered.forEach(r => {
      const normalizedStatus = normalizeStatus(r.status || "Pending", statuses);
      if (normalizedStatus && map[normalizedStatus] !== undefined) {
        map[normalizedStatus]++;
      }
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
    const total = Object.entries(statusCounts)
      .filter(([name]) => selectedStatuses.has(name))
      .reduce((sum, [, count]) => sum + count, 0);

    return Object.entries(statusCounts)
      .filter(([name]) => selectedStatuses.has(name) && (statusCounts[name] > 0))
      .map(([name, value]) => ({
        name,
        value,
        color: STATUS_COLORS_MAP[name] || "#6C757D",
        percent: total > 0 ? Math.round((value / total) * 100) : 0,
      }));
  }, [statusCounts, selectedStatuses, STATUS_COLORS_MAP]);

  const agg = useCallback((arr: Report[], keyOrFn: keyof Report | ((r: Report) => string)) => {
    const getKey = typeof keyOrFn === "function" ? keyOrFn : (r: Report) => (r[keyOrFn] as string) || "Unspecified";
    const m = new Map<string, number>();
    arr.forEach(r => { const k = getKey(r) || "Unspecified"; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, []);

  const buildingData = useMemo(() => agg(filtered, "building"), [filtered, agg]);
  const collegeData  = useMemo(() => agg(filtered, "college"),  [filtered, agg]);

  const concernData = useMemo<ConcernChartDatum[]>(() => {
    const m = new Map<string, ConcernChartDatum>();
    filtered.forEach(r => {
      const full = formatConcernLabel(r);
      if (!full) return;
      const { base, sub } = getConcernBaseFromLabel(full);
      const key = `${base}||${sub}`;
      const ex = m.get(key);
      if (ex) ex.value++;
      else m.set(key, { name: sub, base, fullLabel: full, value: 1 });
    });
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [filtered]);

  /* ────── TIME SERIES ────── */
  const [timeMode, setTimeMode] = useState<TimeMode>("month");
  const timeSeriesData: TimeSeriesPoint[] = useMemo(() => {
    if (!filtered.length) return [];
    const now = new Date();
    const map = new Map<string, { label: string; value: number; sortKey: number }>();
    const makeDayKey = (d: Date) => d.toISOString().slice(0, 10);
    const getThreshold = (): Date => {
      const d = new Date(now);
      if      (timeMode === "day")   d.setDate(d.getDate() - 29);
      else if (timeMode === "week")  d.setDate(d.getDate() - 7 * 11);
      else if (timeMode === "month") d.setMonth(d.getMonth() - 11);
      else                            d.setFullYear(d.getFullYear() - 4);
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
        key = makeDayKey(dt); label = `${month + 1}/${day}`; sortKey = dt.getTime();
      } else if (timeMode === "week") {
        const tmp = new Date(dt); const dow = tmp.getDay() || 7;
        tmp.setDate(tmp.getDate() - (dow - 1));
        key = `W${tmp.getFullYear()}-${makeDayKey(tmp)}`;
        label = `Wk ${tmp.getFullYear().toString().slice(2)}-${tmp.getMonth() + 1}`;
        sortKey = tmp.getTime();
      } else if (timeMode === "month") {
        key = `${year}-${month + 1}`;
        const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        label = `${mn[month]} ${year.toString().slice(2)}`;
        sortKey = year * 12 + month;
      } else {
        key = `${year}`; label = `${year}`; sortKey = year;
      }
      const ex = map.get(key);
      if (ex) ex.value++;
      else map.set(key, { label, value: 1, sortKey });
    });
    return [...map.values()].sort((a, b) => a.sortKey - b.sortKey).map(v => ({ label: v.label, value: v.value }));
  }, [filtered, timeMode]);

  /* ────── SIGNATORIES + PRINT ────── */
  const DEFAULT_SIGNATORIES: Signatory[] = [
    { name: "", role: "Prepared by" },
    { name: "", role: "Reviewed by" },
    { name: "", role: "Approved by" },
  ];
  const [signatories,    setSignatories]    = useState<Signatory[]>(DEFAULT_SIGNATORIES);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const executePrint = useCallback((sigs: Signatory[]) => {
    if (typeof window === "undefined") return;
    const concernCounts = new Map<string, number>();
    const buildingCounts = new Map<string, number>();
    filtered.forEach(r => {
      const ck = formatConcernLabel(r) || "Unspecified";
      concernCounts.set(ck, (concernCounts.get(ck) || 0) + 1);
      const bk = (r.building || "Unspecified").trim() || "Unspecified";
      buildingCounts.set(bk, (buildingCounts.get(bk) || 0) + 1);
    });
    const total = filtered.length;
    const statusSummaryHtml = Object.entries(statusCounts)
      .filter(([, c]) => c > 0)
      .map(([l, c]) => `<li>${l}: ${c} (${total > 0 ? Math.round((c / total) * 100) : 0}%)</li>`)
      .join("") || "<li>No data.</li>";

    const safe = (v?: string) => v ? String(v) : "";
    const rowsHtml = filtered.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${safe(r.reportId)}</td><td>${r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</td><td>${safe(r.status)}</td><td>${safe(r.building)}</td><td>${safe(formatConcernLabel(r))}</td><td>${safe(r.college)}</td><td>${safe(r.floor)}</td><td>${safe(r.room)}</td><td>${safe(r.email)}</td><td>${safe(r.userType)}</td></tr>`
    ).join("");

    const printedDate = new Date().toLocaleString();
    const sigBlocksHtml = sigs.map(s => `
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${s.name ? s.name : "Signature over Printed Name"}</div>
        <div class="sig-role">${s.role}</div>
      </div>`).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFMO Analytics</title><style>body{font-family:system-ui,sans-serif;font-size:8px;color:#111827;padding:10px}.doc-table{width:100%;border-collapse:collapse}.logo-cell{width:90px;text-align:center}.logo-cell img{width:64px;height:64px;padding-top:12px;object-fit:contain}.title{font-size:14px;font-weight:700;color:#fff;background:#029006;padding:8px}.row-line{border-bottom:1px solid #000;padding-bottom:4px}.label{font-weight:600}h1{font-size:18px;margin:16px 0 4px}h2{font-size:15px;margin-top:16px;margin-bottom:4px}h3{font-size:13px;margin-top:10px;margin-bottom:4px}.meta{font-size:11px;color:#374151;margin-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #d1d5db;padding:4px 6px;text-align:left}thead{background:#f3f4f6}ul{margin:4px 0 8px 16px;padding:0}li{margin:2px 0}.sig-row{display:flex;justify-content:space-around;gap:24px;flex-wrap:wrap;margin-top:48px}.sig-block{flex:1;min-width:140px;max-width:200px;text-align:center}.sig-line{border-top:1px solid #111827;margin-top:40px;margin-bottom:4px}.sig-name{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em}.sig-role{font-size:8px;color:#6b7280;margin-top:2px}@media print{*{-webkit-print-color-adjust:exact!important}}</style></head><body>
    <table class="doc-table"><tr><td class="logo-cell" rowspan="4"><img src="/logo-dlsud.png"/><tr><td colspan="2" class="title">Building Facilities Maintenance Office : Report Analytics</td></tr>
    <tr><td class="row-line"><span class="label">Printed:</span> ${printedDate}</td><td class="row-line"><span class="label">Confidentiality:</span> Research Purpose</td></tr>
    <tr><td class="row-line"><span class="label">Review Cycle:</span> Monthly</td><td class="row-line"><span class="label">Effectivity Date:</span></td></tr></table>
    <h1>BFMO Analytics — Tabular Report</h1><div class="meta">Records: ${total}</div>
    <h2>Status Summary</h2><ul>${statusSummaryHtml}</ul>
    <h2>By Concern</h2><ul>${[...concernCounts.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `<li>${n}: ${c}</li>`).join("") || "<li>None.</li>"}</ul>
    <h2>By Building</h2><ul>${[...buildingCounts.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `<li>${n}: ${c}</li>`).join("") || "<li>None.</li>"}</ul>
    <h2>Detailed Report</h2><table><thead><tr><th>#</th><th>Report ID</th><th>Date</th><th>Status</th><th>Building</th><th>Concern</th><th>College</th><th>Floor</th><th>Room</th><th>Email</th><th>Type</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="11">No data.</td></tr>'}</tbody></table>
    <div class="sig-row">${sigBlocksHtml}</div>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
  }, [filtered, statusCounts]);

  /* ────── TASKS PANEL STATE ────── */
  const [listsOpen,        setListsOpen]        = useState(false);
  const [taskSaveStatus,   setTaskSaveStatus]   = useState("");
  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [serverTasks,      setServerTasks]      = useState<Task[]>([]);
  const [editingTaskId,    setEditingTaskId]    = useState<string | null>(null);
  const [newChecklistText, setNewChecklistText] = useState<Record<string, string>>({});
  const EMPTY_DRAFT: Omit<Task, "_id" | "createdAt" | "updatedAt"> = {
    name: "", concernType: "Other", reportId: "", assignedStaff: [],
    status: "Pending", priority: "", checklist: [], notes: "",
  };
  const [createDraft, setCreateDraft] = useState<Omit<Task, "_id" | "createdAt" | "updatedAt">>(EMPTY_DRAFT);
  const [staffInput, setStaffInput] = useState("");
  const [checkInput, setCheckInput] = useState("");

  const showStatus = (msg: string) => {
    setTaskSaveStatus(msg);
    setTimeout(() => setTaskSaveStatus(""), 3500);
  };

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks?ts=${Date.now()}`, { cache: "no-store" });
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
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createDraft.name.trim(),
          concernType: createDraft.concernType || "Other",
          reportId: createDraft.reportId || null,
          priority: createDraft.priority || undefined,
          notes: createDraft.notes || "",
          assignedStaff: createDraft.assignedStaff || [],
          status: "Pending",
          createdBy: "Admin",
          checklist: (createDraft.checklist || []),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed.");
      setServerTasks(prev => [data.task, ...prev]);
      setCreateDraft(EMPTY_DRAFT); setStaffInput(""); setCheckInput("");
      setShowCreateModal(false);
      showStatus("✅ Task created!");
    } catch (e: any) { showStatus(`❌ ${e?.message || "Save failed"}`); }
  }, [createDraft]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updates, updatedBy: "Admin" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed.");
      setServerTasks(prev => prev.map(t => t._id === taskId ? data.task : t));
      setEditingTaskId(null);
      showStatus("✅ Updated!");
    } catch (e: any) { showStatus(`❌ ${e?.message || "Update failed"}`); }
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed.");
      setServerTasks(prev => prev.filter(t => t._id !== taskId));
      if (editingTaskId === taskId) setEditingTaskId(null);
      showStatus("✅ Deleted!");
    } catch { showStatus("❌ Delete failed"); }
  }, [editingTaskId]);

  const toggleChecklistItem = useCallback(async (task: Task, item: ChecklistItem, done: boolean) => {
    const itemKey = getItemKey(item);
    const optimistic = (task.checklist || []).map(c => getItemKey(c) === itemKey ? { ...c, done } : c);
    setServerTasks(prev => prev.map(t => t._id === task._id ? { ...t, checklist: optimistic } : t));
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${task._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: optimistic, updatedBy: "Admin" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setServerTasks(prev => prev.map(t => t._id === data.task._id ? data.task : t));
    } catch {
      setServerTasks(prev => prev.map(t => t._id === task._id ? { ...t, checklist: task.checklist } : t));
      showStatus("❌ Checklist update failed");
    }
  }, []);

  const addChecklistItem = useCallback(async (task: Task, text: string) => {
    if (!text.trim()) return;
    const newItem: ChecklistItem = { id: makeUid(), text: text.trim(), done: false };
    const updated = [...(task.checklist || []), newItem];
    setServerTasks(prev => prev.map(t => t._id === task._id ? { ...t, checklist: updated } : t));
    setNewChecklistText(prev => ({ ...prev, [task._id!]: "" }));
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${task._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updated, updatedBy: "Admin" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setServerTasks(prev => prev.map(t => t._id === data.task._id ? data.task : t));
    } catch {
      setServerTasks(prev => prev.map(t => t._id === task._id ? { ...t, checklist: task.checklist } : t));
    }
  }, []);

  const removeChecklistItem = useCallback(async (task: Task, item: ChecklistItem) => {
    const itemKey = getItemKey(item);
    const updated = (task.checklist || []).filter(c => getItemKey(c) !== itemKey);
    setServerTasks(prev => prev.map(t => t._id === task._id ? { ...t, checklist: updated } : t));
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${task._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updated, updatedBy: "Admin" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setServerTasks(prev => prev.map(t => t._id === data.task._id ? data.task : t));
    } catch {
      setServerTasks(prev => prev.map(t => t._id === task._id ? { ...t, checklist: task.checklist } : t));
    }
  }, []);

  const getPriorityColor = (name?: string) => metaPriorities.find(p => p.name === name)?.color || "#64748b";
  const getStatusColor   = (name?: string) => metaStatuses.find(s => s.name === name)?.color   || "#64748b";

  const resolvedPct = useMemo(
    () => filtered.length > 0 ? Math.round(((statusCounts["Resolved"] || 0) / filtered.length) * 100) : 0,
    [filtered, statusCounts]
  );

  /* ────── DYNAMIC STAT CARD ICONS ────── */
  const getStatusIcon = (statusName: string): React.ReactNode => {
    const lower = statusName.toLowerCase();
    if (lower.includes("pending")) {
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
    }
    if (lower.includes("inspect")) {
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    }
    if (lower.includes("progress")) {
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>;
    }
    if (lower.includes("resolved")) {
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>;
    }
    if (lower.includes("unfinished")) {
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
    }
    if (lower.includes("closed")) {
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>;
    }
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/></svg>;
  };

  /* ────── AUTH GUARD ────── */
  if (!isLoaded || !canView) {
    return (
      <div className="analytics-wrapper" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div className="analytics-spinner" />
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 14 }}>Checking permissions…</p>
        </div>
      </div>
    );
  }

  /* =====================================================================
     RENDER
     ===================================================================== */
  return (
    <div className="analytics-wrapper page">
      <div className="analytics-container">

        {/* HEADER */}
        <div className="analytics-header">
          <div className="analytics-title">
            <h1>Analytics Overview</h1>
            <p className="subtitle">
              BFMO · Facility Management
              <span className="subtitle-sep"> · </span>
              {loading ? "Loading…" : <><strong>{filtered.length}</strong> of <strong>{reports.length}</strong> reports</>}
              {loadErr && <span className="subtitle-warning"> ⚠ {loadErr}</span>}
              {hiddenStudentStatuses.length > 0 && (
                <span className="subtitle-info" style={{ marginLeft: 8, fontSize: 10, opacity: 0.7 }}>
                  ℹ️ Hidden from students: {hiddenStudentStatuses.join(", ")}
                </span>
              )}
            </p>
          </div>
          <div className="header-actions">
            <button className="small-btn" onClick={() => setFiltersOpen(v => !v)}>
              <IconFilter /> Filters {activeFilterCount > 0 && <span className="badge">{activeFilterCount}</span>}
            </button>
            <button 
  className="small-btn" 
  onClick={() => redirect('/Admin/Task')}
>
  <IconTasks /> Tasks
</button>
            <button className="analytics-btn" onClick={() => fetchReports()}>
              <IconRefresh /> Refresh
            </button>
            <button className="printreports-btn" onClick={() => executePrint(signatories)}>
              <IconPrint /> Print Report
            </button>
          </div>
        </div>

        {/* STAT CHIPS (quick status overview) */}
        <div className="header-stats">
          {Object.entries(statusCounts)
            .filter(([name]) => !name.toLowerCase().includes("archived"))
            .map(([name, count]) => (
              <span key={name} className="stat-chip">
                <span className="stat-dot" style={{ background: STATUS_COLORS_MAP[name] || "#6C757D" }} />
                {name}
                <strong>{count}</strong>
              </span>
          ))}
          <span className="stat-chip-total">Total <strong>{filtered.length}</strong></span>
        </div>

        {/* FILTERS PANEL */}
        {filtersOpen && (
          <div className="card filters" style={{ marginBottom: 20 }}>
            <div className="filters-row">
              <div className="filter-block">
                <h4>Status</h4>
                <div className="chips">{availableStatuses.map(s => (<button key={s} className={`chip${selectedStatuses.has(s) ? " is-on" : ""}`} onClick={() => toggleSet(setSelectedStatuses)(s)}>{s}</button>))}</div>
              </div>
              <div className="filter-block">
                <h4>Building</h4>
                <div className="chips scroll">{availableBuildings.map(b => (<button key={b} className={`chip${selectedBuildings.has(b) ? " is-on" : ""}`} onClick={() => toggleSet(setSelectedBuildings)(b)}>{b}</button>))}</div>
              </div>
              <div className="filter-block">
                <h4>Concern</h4>
                <div className="chips">{availableConcerns.map(c => (<button key={c} className={`chip${selectedConcerns.has(c) ? " is-on" : ""}`} onClick={() => toggleSet(setSelectedConcerns)(c)}>{c}</button>))}</div>
              </div>
              <div className="filter-block">
                <h4>College</h4>
                <div className="chips scroll">{availableColleges.map(c => (<button key={c} className={`chip${selectedColleges.has(c) ? " is-on" : ""}`} onClick={() => toggleSet(setSelectedColleges)(c)}>{c}</button>))}</div>
              </div>
              <div className="filter-block">
                <h4>Date range</h4>
                <div className="dates"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
                <div className="quick-dates"><button className="quick-date-btn" onClick={() => setLastDays(7)}>7d</button><button className="quick-date-btn" onClick={() => setLastDays(30)}>30d</button><button className="quick-date-btn" onClick={() => setLastDays(90)}>90d</button><button className="quick-date-btn" onClick={() => { setDateFrom(""); setDateTo(""); }}>All</button></div>
              </div>
            </div>
            <div className="filters-actions"><span className="muted">Showing <strong>{filtered.length}</strong> filtered reports</span><button className="small-btn" onClick={clearAllFilters}>Clear all filters</button></div>
          </div>
        )}

        {/* DYNAMIC KPI STAT CARDS - rendered from statuses */}
        <div className="stat-grid">
          <StatCard
            label="Total Reports" value={reports.length} color="#6366f1"
            sub={`${filtered.length} filtered`}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
          />
          {Object.entries(statusCounts)
            .filter(([name]) => !name.toLowerCase().includes("archived"))
            .map(([name, count]) => (
              <StatCard
                key={name}
                label={name}
                value={count}
                color={STATUS_COLORS_MAP[name] || "#6C757D"}
                sub={name.toLowerCase().includes("pending") ? "Needs attention" : 
                      name.toLowerCase().includes("resolved") ? `${Math.round((count / filtered.length) * 100)}% of total` : 
                      name.toLowerCase().includes("closed") ? "Completed & closed" : ""}
                icon={getStatusIcon(name)}
              />
            ))}
          <StatCard
            label="Resolution Rate" value={`${resolvedPct}%`} color="#22d3ee"
            sub={`${statusCounts["Resolved"] || 0}/${filtered.length} total`}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>}
          />
        </div>

        {/* MAIN CHARTS GRID */}
        <div className="analytics-grid">

          {/* Status Donut */}
          <div className="card">
            <h3>Reports by Status</h3>
            <div className="chart-wrap" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%" cy="50%"
                    innerRadius="58%" outerRadius="85%"
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusPieData.map(e => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="legend-grid">
              {statusPieData.map(e => (
                <div key={e.name} className="legend-item">
                  <span className="legend-label">
                    <span className="legend-swatch" style={{ background: e.color }} />
                    {e.name}
                  </span>
                  <span className="legend-val">{e.value} <span className="legend-pct">· {e.percent}%</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* Building Bar */}
          <div className="card">
            <h3>Reports by Building</h3>
            <div className="bar-wrap" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buildingData} barSize={22} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {buildingData.map((e, i) => <Cell key={e.name} fill={getBuildingColor(e.name, i)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Concern Bar */}
          <div className="card">
            <h3>Reports by Concern Type</h3>
            <div className="bar-wrap" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={concernData} barSize={20} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "rgba(148,163,184,0.06)" }}
                    labelFormatter={(_, p) => {
                      const pl = (p && p[0]?.payload) as ConcernChartDatum | undefined;
                      return pl ? pl.name : "";
                    }}
                    formatter={(v: any) => [`${v}`, "Reports"]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {concernData.map(e => <Cell key={`${e.base}-${e.name}`} fill={getConcernColorFromBase(e.base)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="legend-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
              {["Civil", "Mechanical", "Electrical", "Safety Hazard", "Other"]
                .filter(b => concernData.some(d => d.base === b))
                .map(b => (
                  <div key={b} className="legend-item">
                    <span className="legend-label">
                      <span className="legend-swatch" style={{ background: getConcernColorFromBase(b) }} />
                      {b}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* College horizontal bar */}
          <div className="card">
            <h3>Reports by College</h3>
            <div className="bar-wrap" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collegeData} layout="vertical" barSize={14} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {collegeData.map((e, i) => <Cell key={e.name} fill={getCollegeColor(e.name, i)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reports Over Time */}
          <div className="card analytics-card-full">
            <div className="time-header">
              <h3 style={{ margin: 0 }}>Reports Over Time</h3>
              <div className="time-mode-toggle">
                {(["day", "week", "month", "year"] as TimeMode[]).map(m => (
                  <button key={m} className={`time-mode-btn${timeMode === m ? " is-active" : ""}`} onClick={() => setTimeMode(m)}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-wrap" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10a373" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10a373" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(148,163,184,0.3)", strokeDasharray: "3 3" }} />
                  <Area type="monotone" dataKey="value" stroke="#10a373" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} activeDot={{ r: 5, fill: "#10a373", stroke: "var(--bg)", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overall Resolution Rate */}
          <div className="card analytics-card-full">
            <div className="resolution-head">
              <div>
                <h3 style={{ margin: 0 }}>Overall Resolution Rate</h3>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {statusCounts["Resolved"] || 0} resolved of {filtered.length} total
                </p>
              </div>
              <span className="resolution-pct">{resolvedPct}%</span>
            </div>
            <div className="progress-bar small" style={{ height: 10, marginTop: 16 }}>
              <div className="progress-fill" style={{ transform: `scaleX(${resolvedPct / 100})`, background: `linear-gradient(90deg, ${STATUS_COLORS_MAP["Resolved"] || "#10a373"}, #22d3ee)` }} />
            </div>
            <div className="status-breakdown">
              {Object.entries(statusCounts).map(([name, count]) => (
                <div key={name} className="status-breakdown__item">
                  <div className="status-breakdown__value" style={{ color: STATUS_COLORS_MAP[name] || "#6C757D" }}>
                    {count}
                  </div>
                  <div className="status-breakdown__label">{name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* ═══════════════ PRE-PRINT SIGNATORIES MODAL ═══════════════ */}
      {showPrintModal && (
        <div className="create-task-backdrop" onClick={() => setShowPrintModal(false)}>
          <div className="create-task-modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 className="create-task-modal__title" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Configure Signatories</h3>
                <p className="create-task-modal__hint" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  Names will appear at the bottom of the printed report
                </p>
              </div>
              <button 
                className="sidepanel-close" 
                onClick={() => setShowPrintModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: "var(--text-2)",
                  padding: "4px 8px",
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "50vh", overflowY: "auto", paddingRight: 4 }}>
              {signatories.map((sig, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  <div className="admin-edit__field-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", marginBottom: 4, display: "block" }}>
                      Signatory {idx + 1} — Name
                    </label>
                    <input
                      className="dropdown"
                      placeholder="e.g. Juan dela Cruz"
                      value={sig.name}
                      onChange={e => setSignatories(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        fontSize: 13,
                        fontFamily: "inherit"
                      }}
                    />
                  </div>
                  <div className="admin-edit__field-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", marginBottom: 4, display: "block" }}>
                      Role / Designation
                    </label>
                    <input
                      className="dropdown"
                      placeholder="e.g. Head Engineer"
                      value={sig.role}
                      onChange={e => setSignatories(prev => prev.map((s, i) => i === idx ? { ...s, role: e.target.value } : s))}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        fontSize: 13,
                        fontFamily: "inherit"
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSignatories(prev => prev.filter((_, i) => i !== idx))}
                    title="Remove signatory"
                    className="task-delete-btn"
                    style={{
                      marginTop: 0,
                      width: 40,
                      padding: "8px 0",
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "var(--text-2)",
                      fontSize: 16,
                      transition: "all 0.14s"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "#fee2e2";
                      e.currentTarget.style.borderColor = "#fecaca";
                      e.currentTarget.style.color = "#dc2626";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "none";
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.color = "var(--text-2)";
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {signatories.length > 0 && (
              <div className="signatory-preview" style={{ marginTop: 20, padding: "16px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12 }}>
                <p className="form-label" style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Preview
                </p>
                <div style={{ display: "flex", gap: 16, justifyContent: "space-around", flexWrap: "wrap" }}>
                  {signatories.map((sig, idx) => (
                    <div key={idx} style={{ textAlign: "center", minWidth: 100, flex: 1 }}>
                      <div style={{ height: 30, borderBottom: "2px solid #0369a1", marginBottom: 8 }} />
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0c4a6e" }}>
                        {sig.name ? sig.name : <span style={{ fontStyle: "italic", color: "#64748b", fontWeight: 400 }}>Signature over Printed Name</span>}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 10, color: "#475569" }}>
                        {sig.role || <span style={{ fontStyle: "italic" }}>Role</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setSignatories(prev => [...prev, { name: "", role: "" }])}
                className="add-signatory-btn"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  background: "none",
                  border: "1px dashed var(--brand)",
                  borderRadius: 8,
                  cursor: "pointer",
                  color: "var(--brand)",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  transition: "all 0.14s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(99, 102, 241, 0.08)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "none";
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Signatory
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button 
                className="small-btn" 
                style={{ 
                  flex: 1, 
                  justifyContent: "center", 
                  display: "flex",
                  padding: "9px 12px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  color: "var(--text-2)",
                  transition: "all 0.14s"
                }}
                onClick={() => setSignatories(DEFAULT_SIGNATORIES)}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "var(--surface-3)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "var(--surface-2)";
                }}
              >
                Reset to Defaults
              </button>
              <button
                className="printreports-btn" 
                style={{ 
                  flex: 2, 
                  justifyContent: "center",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 12px",
                  background: "#10a373",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  color: "#fff",
                  transition: "all 0.14s"
                }}
                onClick={() => { 
                  setShowPrintModal(false); 
                  executePrint(signatories); 
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "#0d8a5c";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "#10a373";
                }}
              >
                <IconPrint /> Confirm & Print
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

/* =====================================================================
   ICONS
   ===================================================================== */
const IconFilter = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>);
const IconTasks = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" /><rect x="14" y="3" width="7" height="18" /></svg>);
const IconRefresh = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>);
const IconPrint = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>);

export default Analytics;