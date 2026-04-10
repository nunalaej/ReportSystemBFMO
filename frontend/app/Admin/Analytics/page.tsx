// Frontend/app/Admin/Analytics.tsx - FULLY MERGED
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

interface Comment {
  text?: string;
  comment?: string;
  at?: string;
  by?: string;
}

interface Report {
  _id?: string;
  reportId?: string;
  userType?: string;
  email?: string;
  heading?: string;
  description?: string;
  concern?: string;
  subConcern?: string;
  otherConcern?: string;
  building?: string;
  otherBuilding?: string;
  college?: string;
  floor?: string;
  room?: string;
  otherRoom?: string;
  image?: string;
  status?: string;
  createdAt?: string;
  comments?: Comment[];
}

interface Task {
  _id?: string;
  id: string;
  text: string;
  done: boolean;
}

interface Assignment {
  _id?: string;
  id?: string;
  name: string;
  concernType: "Mechanical" | "Civil" | "Electrical" | "Safety Hazard" | "Other";
  reportId?: string;
  assignedStaff: string[];
  status: "Pending" | "Waiting for Materials" | "In Progress" | "Resolved";
  checklist: Task[];
  createdAt?: string;
}

type StatusKey = "pending" | "waiting" | "progress" | "resolved" | "archived";

interface ConcernChartDatum {
  name: string;
  base: string;
  fullLabel: string;
  value: number;
}

interface TimeSeriesPoint {
  label: string;
  value: number;
}

type TimeMode = "day" | "week" | "month" | "year";

const BUILDING_COLORS = ["#3b82f6","#22c55e","#fbbf24","#ef4444","#8b5cf6","#14b8a6","#f97316","#64748b"];
const getBuildingColor = (name: string, index: number) => BUILDING_COLORS[index % BUILDING_COLORS.length];

const COLLEGE_COLORS = ["#3b82f6","#22c55e","#fbbf24","#ef4444","#8b5cf6","#14b8a6","#f97316","#64748b"];
const getCollegeColor = (name: string, index: number) => COLLEGE_COLORS[index % COLLEGE_COLORS.length];

const getConcernBaseFromLabel = (fullLabel: string): { base: string; sub: string } => {
  const [baseRaw, subRaw] = fullLabel.split(" : ");
  return { base: (baseRaw || "Unspecified").trim(), sub: (subRaw || baseRaw || "Unspecified").trim() };
};

const getConcernColorFromBase = (base: string): string => {
  const b = base.toLowerCase();
  if (b === "civil") return "#3b82f6";
  if (b === "mechanical") return "#22c55e";
  if (b === "electrical") return "#fbbf24";
  if (b === "safety hazard" || b === "safety") return "#ef4444";
  if (b === "other" || b === "others") return "#f97316";
  return "#9ca3af";
};

const formatConcernLabel = (report: Report) => {
  const base = report.concern || "Unspecified";
  const sub = report.subConcern || report.otherConcern;
  return sub ? `${base} : ${sub}` : base;
};

const STATUSES: string[] = ["Pending","Waiting for Materials","In Progress","Resolved","Archived"];
const DEFAULT_STATUS_SET = new Set<string>(["Pending","Waiting for Materials","In Progress","Resolved"]);

const STATUS_LABELS: Record<StatusKey, string> = {
  pending: "Pending", waiting: "Waiting", progress: "In Progress", resolved: "Resolved", archived: "Archived",
};
const STATUS_TO_FILTER_LABEL: Record<StatusKey, string> = {
  pending: "Pending", waiting: "Waiting for Materials", progress: "In Progress", resolved: "Resolved", archived: "Archived",
};
const STATUS_COLORS: Record<StatusKey, string> = {
  pending: "#f97316", waiting: "#0ea5e9", progress: "#8b5cf6", resolved: "#10b981", archived: "#6b7280",
};

const getBaseConcernFromReport = (r: Report): string => (r.concern || "Unspecified").trim() || "Unspecified";

const normalizeStatusFilterLabel = (raw?: string): string | null => {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return null;
  if (s === "pending") return "Pending";
  if (s === "waiting for materials" || s === "waiting") return "Waiting for Materials";
  if (s === "in progress") return "In Progress";
  if (s === "resolved") return "Resolved";
  if (s === "archived") return "Archived";
  return null;
};

/* ===== STATUS BADGE HELPER ===== */
const getStatusBadgeStyle = (status: string): React.CSSProperties => {
  const s = status.toLowerCase();
  const map: Record<string, string> = {
    "pending": "#f97316",
    "waiting for materials": "#0ea5e9",
    "in progress": "#8b5cf6",
    "resolved": "#10b981",
  };
  const color = map[s] || "#6b7280";
  return {
    display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 10,
    fontWeight: 600, color: "#fff", background: color,
  };
};

/* ===================================================================
   MAIN COMPONENT
=================================================================== */
const Analytics: FC = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [canView, setCanView] = useState(false);

  /* AUTH GUARD */
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

  /* =========================================================
    REPORTS DATA
  ========================================================= */
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadErr, setLoadErr] = useState<string>("");

  const fetchReports = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoadErr(""); setLoading(true);
      const res = await fetch(`${API_BASE}/api/reports`, {
        cache: "no-store", signal,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      const list: Report[] = Array.isArray(data) ? data : Array.isArray(data.reports) ? data.reports : [];
      setReports(list);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      console.error(e);
      setLoadErr("Could not load reports, using demo data");
      const now = new Date().toISOString();
      setReports([
        { reportId: "010426001", userType: "Student", status: "Pending", building: "Building A", concern: "Electrical", subConcern: "Lights", college: "CIT", createdAt: now },
        { reportId: "010426002", userType: "Staff/Faculty", status: "In Progress", building: "Building B", concern: "Plumbing", college: "COE", createdAt: now },
        { reportId: "010426003", userType: "Student", status: "Resolved", building: "Building A", concern: "HVAC", college: "CIT", createdAt: now },
        { reportId: "010426004", userType: "Staff/Faculty", status: "Pending", building: "Building C", concern: "Electrical", subConcern: "Outlets", college: "COE", createdAt: now },
        { reportId: "010426005", userType: "Student", status: "Resolved", building: "Building B", concern: "Carpentry", college: "CLA", createdAt: now },
        { reportId: "010426006", userType: "Staff/Faculty", status: "In Progress", building: "Building C", concern: "HVAC", college: "CBA", createdAt: now },
      ]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!canView) return;
    const ctrl = new AbortController();
    fetchReports(ctrl.signal);
    return () => ctrl.abort();
  }, [canView, fetchReports]);

  useEffect(() => {
    if (!canView) return;
    const onFocus = () => { const ctrl = new AbortController(); fetchReports(ctrl.signal); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [canView, fetchReports]);

  /* =========================================================
    FILTERS
  ========================================================= */
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    () => new Set(["Pending", "Waiting for Materials", "In Progress", "Resolved"]),
  );
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(() => new Set());
  const [selectedConcerns, setSelectedConcerns] = useState<Set<string>>(() => new Set());
  const [selectedColleges, setSelectedColleges] = useState<Set<string>>(() => new Set());
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const FILTERS_OPEN_KEY = "analytics_filters_open_v1";
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(FILTERS_OPEN_KEY) === "1";
  });

  const toggleFiltersOpen = () => {
    setFiltersOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(FILTERS_OPEN_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (value: string) => {
    setter((prev) => { const n = new Set(prev); n.has(value) ? n.delete(value) : n.add(value); return n; });
  };

  const clearAllFilters = () => {
    setSelectedStatuses(new Set(DEFAULT_STATUS_SET));
    setSelectedBuildings(new Set()); setSelectedConcerns(new Set());
    setSelectedColleges(new Set()); setDateFrom(""); setDateTo("");
  };

  const setLastDays = (days: number) => {
    const today = new Date(); const from = new Date();
    from.setDate(today.getDate() - days + 1);
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(today.toISOString().slice(0, 10));
  };

  const filtered = useMemo(() => {
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;
    return reports.filter((r) => {
      const st = normalizeStatusFilterLabel(r.status);
      if (!st || !selectedStatuses.has(st)) return false;
      if (selectedBuildings.size && !selectedBuildings.has(r.building || "")) return false;
      const baseConcern = getBaseConcernFromReport(r);
      if (selectedConcerns.size && !selectedConcerns.has(baseConcern)) return false;
      if (selectedColleges.size && !selectedColleges.has(r.college || "")) return false;
      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return false;
        if (toTS && ts > toTS) return false;
      }
      return true;
    });
  }, [reports, selectedStatuses, selectedBuildings, selectedConcerns, selectedColleges, dateFrom, dateTo]);

  const availableStatusFilters = useMemo(() => {
    const s = new Set<string>();
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;
    reports.forEach((r) => {
      const stLabel = normalizeStatusFilterLabel(r.status);
      if (!stLabel) return;
      if (selectedBuildings.size && !selectedBuildings.has(r.building || "")) return;
      if (selectedConcerns.size && !selectedConcerns.has(getBaseConcernFromReport(r))) return;
      if (selectedColleges.size && !selectedColleges.has(r.college || "")) return;
      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return;
        if (toTS && ts > toTS) return;
      }
      s.add(stLabel);
    });
    return STATUSES.filter((st) => s.has(st));
  }, [reports, selectedBuildings, selectedConcerns, selectedColleges, dateFrom, dateTo]);

  const availableBuildings = useMemo(() => {
    const s = new Set<string>();
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;
    reports.forEach((r) => {
      if (!r.building) return;
      const stLabel = normalizeStatusFilterLabel(r.status);
      if (stLabel && selectedStatuses.size && !selectedStatuses.has(stLabel)) return;
      if (selectedConcerns.size && !selectedConcerns.has(getBaseConcernFromReport(r))) return;
      if (selectedColleges.size && !selectedColleges.has(r.college || "")) return;
      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return;
        if (toTS && ts > toTS) return;
      }
      s.add(r.building);
    });
    return [...s].sort();
  }, [reports, selectedStatuses, selectedConcerns, selectedColleges, dateFrom, dateTo]);

  const availableConcerns = useMemo(() => {
    const s = new Set<string>();
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;
    reports.forEach((r) => {
      const baseConcern = getBaseConcernFromReport(r);
      if (!baseConcern) return;
      const stLabel = normalizeStatusFilterLabel(r.status);
      if (stLabel && selectedStatuses.size && !selectedStatuses.has(stLabel)) return;
      if (selectedBuildings.size && !selectedBuildings.has(r.building || "")) return;
      if (selectedColleges.size && !selectedColleges.has(r.college || "")) return;
      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return;
        if (toTS && ts > toTS) return;
      }
      s.add(baseConcern);
    });
    const CONCERN_PRIORITY: Record<string, number> = { Civil: 1, Mechanical: 2, Electrical: 3 };
    return [...s].sort((a, b) => {
      const aPri = CONCERN_PRIORITY[a] ?? 999, bPri = CONCERN_PRIORITY[b] ?? 999;
      return aPri !== bPri ? aPri - bPri : a.localeCompare(b);
    });
  }, [reports, selectedStatuses, selectedBuildings, selectedColleges, dateFrom, dateTo]);

  const availableColleges = useMemo(() => {
    const s = new Set<string>();
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;
    reports.forEach((r) => {
      if (!(r.college || "").trim()) return;
      const stLabel = normalizeStatusFilterLabel(r.status);
      if (stLabel && selectedStatuses.size && !selectedStatuses.has(stLabel)) return;
      if (selectedBuildings.size && !selectedBuildings.has(r.building || "")) return;
      if (selectedConcerns.size && !selectedConcerns.has(getBaseConcernFromReport(r))) return;
      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return;
        if (toTS && ts > toTS) return;
      }
      s.add(r.college as string);
    });
    return [...s].sort();
  }, [reports, selectedStatuses, selectedBuildings, selectedConcerns, dateFrom, dateTo]);

  const sortedStatusFilters = useMemo(() =>
    [...availableStatusFilters].sort((a, b) => {
      const aSel = selectedStatuses.has(a), bSel = selectedStatuses.has(b);
      return aSel !== bSel ? (aSel ? -1 : 1) : a.localeCompare(b);
    }), [availableStatusFilters, selectedStatuses]);

  const sortedBuildings = useMemo(() =>
    [...availableBuildings].sort((a, b) => {
      const aSel = selectedBuildings.has(a), bSel = selectedBuildings.has(b);
      return aSel !== bSel ? (aSel ? -1 : 1) : a.localeCompare(b);
    }), [availableBuildings, selectedBuildings]);

  const sortedConcerns = useMemo(() =>
    [...availableConcerns].sort((a, b) => {
      const aSel = selectedConcerns.has(a), bSel = selectedConcerns.has(b);
      return aSel !== bSel ? (aSel ? -1 : 1) : a.localeCompare(b);
    }), [availableConcerns, selectedConcerns]);

  const sortedColleges = useMemo(() =>
    [...availableColleges].sort((a, b) => {
      const aSel = selectedColleges.has(a), bSel = selectedColleges.has(b);
      return aSel !== bSel ? (aSel ? -1 : 1) : a.localeCompare(b);
    }), [availableColleges, selectedColleges]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    const statusesChanged = selectedStatuses.size !== DEFAULT_STATUS_SET.size ||
      [...DEFAULT_STATUS_SET].some((s) => !selectedStatuses.has(s));
    if (statusesChanged) c++;
    if (selectedBuildings.size) c++;
    if (selectedConcerns.size) c++;
    if (selectedColleges.size) c++;
    if (dateFrom || dateTo) c++;
    return c;
  }, [selectedStatuses, selectedBuildings, selectedConcerns, selectedColleges, dateFrom, dateTo]);

  /* =========================================================
    CHART AGGREGATES
  ========================================================= */
  const statusCounts = useMemo(() => {
    const map: Record<StatusKey, number> = { pending: 0, waiting: 0, progress: 0, resolved: 0, archived: 0 };
    filtered.forEach((r) => {
      const s = (r.status || "").trim().toLowerCase();
      if (s === "pending") map.pending++;
      else if (s === "waiting for materials" || s === "waiting") map.waiting++;
      else if (s === "in progress") map.progress++;
      else if (s === "resolved") map.resolved++;
      else if (s === "archived") map.archived++;
    });
    return map;
  }, [filtered]);

  const statusPieData = useMemo(() => {
    const total = (Object.keys(statusCounts) as StatusKey[])
      .filter((key) => selectedStatuses.has(STATUS_TO_FILTER_LABEL[key]))
      .reduce((sum, key) => sum + statusCounts[key], 0);
    return (Object.keys(statusCounts) as StatusKey[])
      .filter((key) => selectedStatuses.has(STATUS_TO_FILTER_LABEL[key]))
      .map((key) => ({
        name: STATUS_LABELS[key], value: statusCounts[key],
        color: STATUS_COLORS[key],
        percent: total > 0 ? Math.round((statusCounts[key] / total) * 100) : 0,
      }))
      .filter((entry) => entry.value > 0);
  }, [statusCounts, selectedStatuses]);

  const agg = useCallback((arr: Report[], keyOrFn: keyof Report | ((r: Report) => string)) => {
    const getKey = typeof keyOrFn === "function" ? keyOrFn : (r: Report) => (r[keyOrFn] as string) || "Unspecified";
    const m = new Map<string, number>();
    arr.forEach((r) => { const k = getKey(r) || "Unspecified"; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, []);

  const buildingData = useMemo(() => agg(filtered, "building"), [filtered, agg]);

  const concernData = useMemo<ConcernChartDatum[]>(() => {
    const m = new Map<string, ConcernChartDatum>();
    filtered.forEach((r) => {
      const full = formatConcernLabel(r);
      if (!full) return;
      const { base, sub } = getConcernBaseFromLabel(full);
      const key = `${base}||${sub}`;
      const existing = m.get(key);
      if (existing) existing.value += 1;
      else m.set(key, { name: sub, base, fullLabel: full, value: 1 });
    });
    const BASE_PRIORITY: Record<string, number> = { Civil: 1, Mechanical: 2, Electrical: 3 };
    return [...m.values()].sort((a, b) => {
      const aPri = BASE_PRIORITY[a.base] ?? 999, bPri = BASE_PRIORITY[b.base] ?? 999;
      return aPri !== bPri ? aPri - bPri : a.name.localeCompare(b.name);
    });
  }, [filtered]);

  const collegeData = useMemo(() => agg(filtered, "college"), [filtered, agg]);

  /* =========================================================
    TIME SERIES
  ========================================================= */
  const [timeMode, setTimeMode] = useState<TimeMode>("month");

  const timeSeriesData: TimeSeriesPoint[] = useMemo(() => {
    if (!filtered.length) return [];
    const now = new Date();
    const map = new Map<string, { label: string; value: number; sortKey: number }>();
    const makeDayKey = (d: Date) => d.toISOString().slice(0, 10);
    const getThreshold = (): Date => {
      const d = new Date(now);
      if (timeMode === "day") d.setDate(d.getDate() - 29);
      else if (timeMode === "week") d.setDate(d.getDate() - 7 * 11);
      else if (timeMode === "month") d.setMonth(d.getMonth() - 11);
      else d.setFullYear(d.getFullYear() - 4);
      return d;
    };
    const threshold = getThreshold();
    filtered.forEach((r) => {
      if (!r.createdAt) return;
      const dt = new Date(r.createdAt);
      if (Number.isNaN(dt.getTime()) || dt < threshold) return;
      let key: string, label: string, sortKey: number;
      const year = dt.getFullYear(), month = dt.getMonth(), day = dt.getDate();
      if (timeMode === "day") {
        key = makeDayKey(dt); label = `${month + 1}/${day}`; sortKey = dt.getTime();
      } else if (timeMode === "week") {
        const tmp = new Date(dt); const dayOfWeek = tmp.getDay() || 7;
        tmp.setDate(tmp.getDate() - (dayOfWeek - 1));
        key = `W${tmp.getFullYear()}-${makeDayKey(tmp)}`;
        label = `Wk ${tmp.getFullYear().toString().slice(2)}-${tmp.getMonth() + 1}`;
        sortKey = tmp.getTime();
      } else if (timeMode === "month") {
        key = `${year}-${month + 1}`;
        const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        label = `${mn[month]} ${year.toString().slice(2)}`; sortKey = year * 12 + month;
      } else { key = `${year}`; label = `${year}`; sortKey = year; }
      const existing = map.get(key);
      if (existing) existing.value += 1; else map.set(key, { label, value: 1, sortKey });
    });
    return [...map.values()].sort((a, b) => a.sortKey - b.sortKey).map((v) => ({ label: v.label, value: v.value }));
  }, [filtered, timeMode]);

  /* =========================================================
    PRINT
  ========================================================= */
  const handlePrint = useCallback(() => {
    if (typeof window === "undefined") return;
    const concernBaseCounts = new Map<string, number>();
    const concernCounts = new Map<string, number>();
    const buildingCounts = new Map<string, number>();
    filtered.forEach((r) => {
      const baseConcern = getBaseConcernFromReport(r) || "Unspecified";
      concernBaseCounts.set(baseConcern, (concernBaseCounts.get(baseConcern) || 0) + 1);
      const concernKey = formatConcernLabel(r) || "Unspecified";
      concernCounts.set(concernKey, (concernCounts.get(concernKey) || 0) + 1);
      const buildingKey = (r.building || "Unspecified").trim() || "Unspecified";
      buildingCounts.set(buildingKey, (buildingCounts.get(buildingKey) || 0) + 1);
    });
    const concernBaseStatsHtml = [...concernBaseCounts.entries()].sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `<li>${n}: ${c}</li>`).join("") || "<li>No concerns.</li>";
    const concernStatsHtml = [...concernCounts.entries()].sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `<li>${n}: ${c}</li>`).join("") || "<li>No detailed concerns.</li>";
    const buildingStatsHtml = [...buildingCounts.entries()].sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `<li>${n}: ${c}</li>`).join("") || "<li>No buildings.</li>";
    const total = filtered.length;
    const statusSummaryHtml = (
      [["Pending", statusCounts.pending],["Waiting for Materials", statusCounts.waiting],
       ["In Progress", statusCounts.progress],["Resolved", statusCounts.resolved],["Archived", statusCounts.archived]] as [string, number][]
    ).filter(([, c]) => c > 0)
      .map(([label, count]) => `<li>${label}: ${count} (${total > 0 ? Math.round((count / total) * 100) : 0}%)</li>`)
      .join("") || "<li>No status data.</li>";
    const safe = (v?: string) => v ? String(v) : "";
    const rowsHtml = filtered.map((r, idx) => `
      <tr>
        <td>${idx + 1}</td><td>${safe(r.reportId)}</td>
        <td>${r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</td>
        <td>${safe(r.status)}</td><td>${safe(r.building)}</td>
        <td>${safe(formatConcernLabel(r))}</td><td>${safe(r.college)}</td>
        <td>${safe(r.floor)}</td><td>${safe(r.room)}</td>
        <td>${safe(r.email)}</td><td>${safe(r.userType)}</td>
      </tr>`).join("");
    const printedDate = new Date().toLocaleString();
    const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>BFMO Analytics Report</title>
<style>
body{font-family:system-ui,sans-serif;font-size:8px;color:#111827;padding:10px}
.doc-header{margin-bottom:20px}.doc-table{width:100%;border-collapse:collapse}
.logo-cell{width:90px;text-align:center}.logo-cell img{width:64px;height:64px;padding-top:12px;object-fit:contain}
.title{font-size:14px;font-weight:700;color:#fff;background:#029006;border-bottom:1px solid #000;padding:8px}
.row-line{border-bottom:1px solid #000;padding-bottom:4px}.label{font-weight:600}
h1{font-size:18px;margin:16px 0 4px}h2{font-size:15px;margin-top:16px;margin-bottom:4px}
h3{font-size:13px;margin-top:10px;margin-bottom:4px}.meta{font-size:11px;color:#374151;margin-bottom:12px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border:1px solid #d1d5db;padding:4px 6px;text-align:left;vertical-align:top}
thead{background:#f3f4f6}ul{margin:4px 0 8px 16px;padding:0}li{margin:2px 0}
.signatories{margin-top:48px;page-break-inside:avoid}
.signatories h2{font-size:13px;margin-bottom:32px;border-bottom:1px solid #d1d5db;padding-bottom:6px}
.sig-row{display:flex;justify-content:space-around;gap:24px;flex-wrap:wrap}
.sig-block{flex:1;min-width:140px;max-width:200px;text-align:center}
.sig-line{border-top:1px solid #111827;margin-bottom:4px;margin-top:40px}
.sig-name{font-size:9px;font-weight:700;color:#111827}.sig-role{font-size:8px;color:#6b7280;margin-top:2px}
@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style></head><body>
<div class="doc-header"><table class="doc-table">
<tr><td class="logo-cell" rowspan="5"><img src="/logo-dlsud.png" alt="BFMO Logo"/></td>
<td colspan="2" class="title">Building Facilities Maintenance Office : Report Analytics</td></tr>
<tr><td class="row-line"><span class="label">Document Reference:</span> BFMO Report System</td>
<td class="row-line"><span class="label">Printed Date:</span> ${printedDate}</td></tr>
<tr><td class="row-line"><span class="label">Confidentiality Level:</span> Research Purpose</td>
<td class="row-line"><span class="label">Approval Date:</span></td></tr>
<tr><td class="row-line"><span class="label">Review Cycle:</span> Monthly</td>
<td class="row-line"><span class="label">Effectivity Date:</span></td></tr>
</table></div>
<h1>BFMO Analytics - Tabular Report</h1>
<div class="meta">Records shown: ${filtered.length}</div>
<h2>Status Summary</h2><ul>${statusSummaryHtml}</ul>
<h2>Summary Statistics</h2>
<h3>By Concern (Base)</h3><ul>${concernBaseStatsHtml}</ul>
<h3>By Concern (Detailed)</h3><ul>${concernStatsHtml}</ul>
<h3>By Building</h3><ul>${buildingStatsHtml}</ul>
<h2>Detailed Report</h2>
<table><thead><tr><th>#</th><th>Report ID</th><th>Date Created</th><th>Status</th><th>Building</th>
<th>Concern</th><th>College</th><th>Floor</th><th>Room</th><th>Email</th><th>Reporter Type</th></tr></thead>
<tbody>${rowsHtml || '<tr><td colspan="11">No data.</td></tr>'}</tbody></table>
<div class="signatories"><h2>Signatories</h2><div class="sig-row">
<div class="sig-block"><div class="sig-line"></div><div class="sig-name">Signature over Printed Name</div><div class="sig-role">Prepared by</div></div>
<div class="sig-block"><div class="sig-line"></div><div class="sig-name">Signature over Printed Name</div><div class="sig-role">Reviewed by</div></div>
<div class="sig-block"><div class="sig-line"></div><div class="sig-name">Signature over Printed Name</div><div class="sig-role">Approved by</div></div>
</div></div></body></html>`;
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    printWin.document.open(); printWin.document.write(html);
    printWin.document.close(); printWin.focus(); printWin.print();
  }, [filtered, statusCounts]);

  /* =========================================================
    TASKS STATE
  ========================================================= */
  const [listsOpen, setListsOpen] = useState<boolean>(false);
  const [listSaveStatus, setListSaveStatus] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [serverTasks, setServerTasks] = useState<Assignment[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  // Track the in-progress text for adding a new checklist item per task
  const [newChecklistText, setNewChecklistText] = useState<Record<string, string>>({});

  const uid = useCallback(() => Date.now().toString(36) + Math.random().toString(36).slice(2, 8), []);

  const [newAssignment, setNewAssignment] = useState<Assignment>({
    name: "", concernType: "Mechanical", reportId: "",
    assignedStaff: [], status: "Pending", checklist: [],
  });

  /* =========================================================
    SERVER TASKS CRUD
  ========================================================= */
  const loadTasksFromServer = useCallback(async () => {
    if (!user?.id) return;
    setLoadingTasks(true);
    try {
      const res = await fetch(`${API_BASE}/api/liststask?userId=${encodeURIComponent(user.id)}`, {
        cache: "no-store", headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      const tasks: Assignment[] = Array.isArray(data) ? data : (data.tasks ?? data.liststask ?? []);
      setServerTasks(tasks);
    } catch (e: any) {
      setListSaveStatus(`❌ Load failed`);
    } finally {
      setLoadingTasks(false);
      setTimeout(() => setListSaveStatus(""), 3000);
    }
  }, [user?.id]);

  const createAssignment = useCallback(async (assignment: Assignment) => {
    if (!user?.id) { setListSaveStatus("❌ Not signed in"); return; }
    setListSaveStatus("Saving…");
    try {
      const res = await fetch(`${API_BASE}/api/liststask`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id, name: assignment.name, concernType: assignment.concernType,
          reportId: assignment.reportId || null, assignedStaff: assignment.assignedStaff,
          status: assignment.status, checklist: assignment.checklist,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      setListSaveStatus("✅ Task created!");
      loadTasksFromServer();
    } catch (e: any) {
      setListSaveStatus(`❌ ${e?.message || "Save failed"}`);
    } finally { setTimeout(() => setListSaveStatus(""), 3000); }
  }, [user?.id, loadTasksFromServer]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Assignment>) => {
    if (!user?.id) return;
    setListSaveStatus("Updating…");
    try {
      const res = await fetch(`${API_BASE}/api/liststask/${taskId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update task");
      setServerTasks((prev) => prev.map((t) => t._id === taskId ? { ...t, ...updates } : t));
      setListSaveStatus("✅ Updated!");
      setEditingTaskId(null);
    } catch (e: any) {
      setListSaveStatus(`❌ ${e?.message || "Update failed"}`);
    } finally { setTimeout(() => setListSaveStatus(""), 3000); }
  }, [user?.id]);

  const deleteServerTask = useCallback(async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/liststask/${taskId}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to delete");
      setServerTasks((prev) => prev.filter((t) => t._id !== taskId));
      setListSaveStatus("✅ Task deleted!");
      setTimeout(() => setListSaveStatus(""), 2000);
    } catch { setListSaveStatus("❌ Delete failed"); }
  }, [user?.id]);

  /* ---------------------------------------------------------
    FIX: toggleChecklistItem
    - Uses the item's _id if present, otherwise falls back to id.
    - Does NOT revert optimistic update on success.
    - Only reverts if the server call actually fails.
  --------------------------------------------------------- */
  const getItemKey = (item: Task): string => item._id || item.id;

  const toggleChecklistItem = useCallback(async (taskId: string, item: Task, done: boolean) => {
    if (!user?.id) return;
    const itemKey = getItemKey(item);

    // Optimistic update
    setServerTasks((prev) =>
      prev.map((t) =>
        t._id === taskId
          ? { ...t, checklist: t.checklist.map((c) => getItemKey(c) === itemKey ? { ...c, done } : c) }
          : t
      )
    );

    try {
      const res = await fetch(`${API_BASE}/api/liststask/${taskId}/checklist/${itemKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      if (!res.ok) throw new Error("Server rejected checklist update");
    } catch (e) {
      // Revert only on failure
      setServerTasks((prev) =>
        prev.map((t) =>
          t._id === taskId
            ? { ...t, checklist: t.checklist.map((c) => getItemKey(c) === itemKey ? { ...c, done: !done } : c) }
            : t
        )
      );
      console.error("Error toggling checklist:", e);
    }
  }, [user?.id]);

  /* ---------------------------------------------------------
    ADD checklist item to existing server task
  --------------------------------------------------------- */
  const addChecklistItem = useCallback(async (taskId: string, text: string) => {
    if (!text.trim() || !user?.id) return;
    const newItem: Task = { id: uid(), text: text.trim(), done: false };

    // Optimistic update
    setServerTasks((prev) =>
      prev.map((t) =>
        t._id === taskId ? { ...t, checklist: [...t.checklist, newItem] } : t
      )
    );
    setNewChecklistText((prev) => ({ ...prev, [taskId]: "" }));

    try {
      const task = serverTasks.find((t) => t._id === taskId);
      if (!task) return;
      const updatedChecklist = [...task.checklist, newItem];
      const res = await fetch(`${API_BASE}/api/liststask/${taskId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updatedChecklist }),
      });
      if (!res.ok) throw new Error("Failed to add checklist item");
    } catch (e) {
      // Revert
      setServerTasks((prev) =>
        prev.map((t) =>
          t._id === taskId
            ? { ...t, checklist: t.checklist.filter((c) => getItemKey(c) !== newItem.id) }
            : t
        )
      );
      console.error("Error adding checklist item:", e);
    }
  }, [user?.id, uid, serverTasks]);

  /* ---------------------------------------------------------
    REMOVE checklist item from existing server task
  --------------------------------------------------------- */
  const removeChecklistItem = useCallback(async (taskId: string, item: Task) => {
    if (!user?.id) return;
    const itemKey = getItemKey(item);

    // Optimistic update
    setServerTasks((prev) =>
      prev.map((t) =>
        t._id === taskId
          ? { ...t, checklist: t.checklist.filter((c) => getItemKey(c) !== itemKey) }
          : t
      )
    );

    try {
      const task = serverTasks.find((t) => t._id === taskId);
      if (!task) return;
      const updatedChecklist = task.checklist.filter((c) => getItemKey(c) !== itemKey);
      const res = await fetch(`${API_BASE}/api/liststask/${taskId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updatedChecklist }),
      });
      if (!res.ok) throw new Error("Failed to remove checklist item");
    } catch (e) {
      // Revert — add the item back
      setServerTasks((prev) =>
        prev.map((t) =>
          t._id === taskId ? { ...t, checklist: [...t.checklist, item] } : t
        )
      );
      console.error("Error removing checklist item:", e);
    }
  }, [user?.id, serverTasks]);

  useEffect(() => {
    if (user?.id && listsOpen) loadTasksFromServer();
  }, [user?.id, listsOpen, loadTasksFromServer]);

  /* =========================================================
    RENDER
  ========================================================= */
  if (!isLoaded || !canView) {
    return <div className="analytics-wrapper"><div className="analytics-container"><p className="note">Checking your permissions...</p></div></div>;
  }

  return (
    <div className="analytics-wrapper">
      <div className="analytics-container">

        {/* ── HEADER ── */}
        <header className="analytics-header">
          <div>
            <div className="analytics-title">
              <h1>Analytics Dashboard</h1>
              <p className="subtitle">Insights from BFMO Report System</p>
              {loadErr ? <div className="note">{loadErr}</div> : null}
              {!loading && <span className="note">Showing {filtered.length} of {reports.length} reports</span>}
            </div>
          </div>
          <div className="header-actions">
            <button className="pa-btn" onClick={toggleFiltersOpen} aria-expanded={filtersOpen} aria-controls="filters-panel">
              {filtersOpen ? "Hide Filters" : "Show Filters"}
              {activeFilterCount > 0 && <span className="badge" style={{ marginLeft: 8 }}>{activeFilterCount}</span>}
            </button>
            <button className="pa-btn" type="button" onClick={() => setListsOpen(true)}>Open Tasks Panel</button>
            <button className="printreports-btn" onClick={handlePrint}>Print Analytics</button>
            <button className="pa-btn" type="button" onClick={() => fetchReports()}>Refresh Data</button>
          </div>
        </header>

        {/* ── FILTERS ── */}
        {filtersOpen && (
          <section id="filters-panel" className="filters card" aria-label="Filters">
            <div className="filters-row">
              <div className="filter-block">
                <h4>Status</h4>
                <div className="chips">
                  {sortedStatusFilters.map((s) => (
                    <label key={s} className={`chip ${selectedStatuses.has(s) ? "is-on" : ""}`}>
                      <input type="checkbox" checked={selectedStatuses.has(s)} onChange={() => toggleSet(setSelectedStatuses)(s)} />{s}
                    </label>
                  ))}
                </div>
              </div>
              <div className="filter-block">
                <h4>Building</h4>
                <div className="chips scroll">
                  {sortedBuildings.map((b) => (
                    <label key={b} className={`chip ${selectedBuildings.has(b) ? "is-on" : ""}`}>
                      <input type="checkbox" checked={selectedBuildings.has(b)} onChange={() => toggleSet(setSelectedBuildings)(b)} />{b}
                    </label>
                  ))}
                </div>
              </div>
              <div className="filter-block">
                <h4>Concern</h4>
                <div className="chips scroll">
                  {sortedConcerns.map((c) => (
                    <label key={c} className={`chip ${selectedConcerns.has(c) ? "is-on" : ""}`}>
                      <input type="checkbox" checked={selectedConcerns.has(c)} onChange={() => toggleSet(setSelectedConcerns)(c)} />{c}
                    </label>
                  ))}
                </div>
              </div>
              <div className="filter-block">
                <h4>College</h4>
                <div className="chips scroll">
                  {sortedColleges.map((col) => (
                    <label key={col} className={`chip ${selectedColleges.has(col) ? "is-on" : ""}`}>
                      <input type="checkbox" checked={selectedColleges.has(col)} onChange={() => toggleSet(setSelectedColleges)(col)} />{col}
                    </label>
                  ))}
                </div>
              </div>
              <div className="filter-block">
                <h4>Date</h4>
                <div className="dates">
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <span>to</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div className="quick-dates">
                  <button type="button" className="quick-date-btn" onClick={() => setLastDays(7)}>Last 7 days</button>
                  <button type="button" className="quick-date-btn" onClick={() => setLastDays(30)}>Last 30 days</button>
                  <button type="button" className="quick-date-btn" onClick={() => { setDateFrom(""); setDateTo(""); }}>All time</button>
                </div>
              </div>
            </div>
            <div className="filters-actions">
              <button className="pa-btn" onClick={clearAllFilters}>Clear filters</button>
            </div>
          </section>
        )}

        {/* ── CHARTS GRID ── */}
        <div className="analytics-grid">

          {/* Status Overview */}
          <div className="card analytics-card">
            <div className="header-stats-total">
              <h3>Status Overview</h3>
              <div className="stat-chip-total"><span>Total</span><strong>{reports.length}</strong></div>
            </div>
            <div className="chart-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" outerRadius="80%" labelLine={false} label={false} dataKey="value">
                    {statusPieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e5e7eb", color: "#000000" }}
                    labelStyle={{ color: "#000000" }} itemStyle={{ color: "#000000" }}
                    formatter={(value, name, props) => {
                      const pct = props?.payload?.percent ?? 0;
                      return [`${value} (${pct}%)`, name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="header-stats">
              {(() => {
                const total = statusPieData.reduce((sum, e) => sum + e.value, 0);
                return ([
                  { color: "#10b981", label: "Resolved", key: "resolved" as StatusKey },
                  { color: "#f97316", label: "Pending", key: "pending" as StatusKey },
                  { color: "#0ea5e9", label: "Waiting", key: "waiting" as StatusKey },
                  { color: "#8b5cf6", label: "In Progress", key: "progress" as StatusKey },
                  { color: "#6b7280", label: "Archived", key: "archived" as StatusKey },
                ]).map(({ color, label, key }) => {
                  const count = statusCounts[key];
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div className="stat-chip" key={key}>
                      <span className="stat-dot" style={{ background: color }} />
                      <span>{label}</span>
                      <strong>{count}</strong>
                      {count > 0 && <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 2 }}>({pct}%)</span>}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Reports by Building */}
          <div className="card analytics-card">
            <h3>Reports by Building</h3>
            <div className="bar-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buildingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={false} axisLine={false} />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e5e7eb", color: "#000000" }} labelStyle={{ color: "#000000" }} itemStyle={{ color: "#000000" }} />
                  <Legend content={() => (
                    <div style={{ justifyContent: "center", display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, fontSize: 12 }}>
                      {buildingData.map((b, idx) => (
                        <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: getBuildingColor(b.name, idx) }} />{b.name}
                        </div>
                      ))}
                    </div>
                  )} />
                  <Bar dataKey="value">{buildingData.map((entry, index) => <Cell key={entry.name} fill={getBuildingColor(entry.name, index)} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reports by Concern */}
          <div className="card analytics-card">
            <h3>Reports by Concern</h3>
            <div className="chart-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={concernData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={false} axisLine={false} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e5e7eb", color: "#000000" }}
                    labelStyle={{ color: "#000000" }} itemStyle={{ color: "#000000" }}
                    labelFormatter={(_, payload) => {
                      const p = (payload && payload[0]?.payload) as ConcernChartDatum | undefined;
                      return p ? `${p.name}` : "";
                    }}
                    formatter={(value) => [`${value}`, "Reports"]}
                  />
                  <Legend content={() => {
                    const bases = ["Civil", "Mechanical", "Electrical", "Safety Hazard", "Other"];
                    return (
                      <div style={{ justifyContent: "center", alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                        {bases.filter((base) => concernData.some((d) => d.base === base)).map((base) => (
                          <div key={base} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: getConcernColorFromBase(base) }} />
                            <span>{base}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }} />
                  <Bar dataKey="value">
                    {concernData.map((entry) => <Cell key={`${entry.base}-${entry.name}`} fill={getConcernColorFromBase(entry.base)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reports by College */}
          <div className="card analytics-card">
            <h3>Reports by College</h3>
            <div className="chart-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collegeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={false} axisLine={false} />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e5e7eb", color: "#000000" }} labelStyle={{ color: "#000000" }} itemStyle={{ color: "#000000" }} />
                  <Legend content={() => (
                    <div style={{ justifyContent: "center", display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, fontSize: 12 }}>
                      {collegeData.map((col, idx) => (
                        <div key={col.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: getCollegeColor(col.name, idx) }} />{col.name}
                        </div>
                      ))}
                    </div>
                  )} />
                  <Bar dataKey="value">{collegeData.map((entry, index) => <Cell key={entry.name} fill={getCollegeColor(entry.name, index)} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reports Over Time */}
          <div className="card analytics-card analytics-card-full">
            <div className="time-header">
              <h3>Reports Over Time</h3>
              <div className="time-mode-toggle">
                {(["day", "week", "month", "year"] as TimeMode[]).map((m) => (
                  <button key={m} type="button" className={`time-mode-btn ${timeMode === m ? "is-active" : ""}`} onClick={() => setTimeMode(m)}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}s
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="reportsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="60%" stopColor="#0ea5e9" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" /><YAxis allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e5e7eb", color: "#000000" }} labelStyle={{ color: "#000000" }} itemStyle={{ color: "#000000" }} formatter={(value) => [`${value}`, "Reports"]} />
                  <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#reportsGradient)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>{/* end analytics-grid */}
      </div>{/* end analytics-container */}

      {/* ================================================================
          TASKS MODAL
      ================================================================ */}
      {listsOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
          onClick={() => setListsOpen(false)}
        >
          <div
            style={{
              background: "#0f172a", border: "1px solid #1e293b", borderRadius: 20,
              width: "100%", maxWidth: 960, maxHeight: "90vh",
              display: "flex", flexDirection: "column", overflow: "hidden",
              boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1.25rem 1.5rem", borderBottom: "1px solid #1e293b", flexShrink: 0, flexWrap: "wrap", gap: 8,
            }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#f9fafb", fontWeight: 700 }}>Tasks & Lists</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <button className="pa-btn" onClick={() => {
                  setNewAssignment({ name: "", concernType: "Mechanical", reportId: "", assignedStaff: [], status: "Pending", checklist: [] });
                  setShowModal(true);
                }}>+ Create Task</button>

                <button className="pa-btn" onClick={loadTasksFromServer} disabled={!user?.id}>
                  Refresh Tasks
                </button>

                {listSaveStatus && (
                  <span style={{
                    fontSize: 12, padding: "4px 10px", borderRadius: 6,
                    background: listSaveStatus.startsWith("✅") ? "#dcfce7" : listSaveStatus.startsWith("❌") ? "#fee2e2" : "#1e293b",
                    color: listSaveStatus.startsWith("✅") ? "#166534" : listSaveStatus.startsWith("❌") ? "#991b1b" : "#94a3b8",
                  }}>
                    {listSaveStatus}
                  </span>
                )}

                <button onClick={() => setListsOpen(false)} aria-label="Close" style={{
                  background: "none", border: "1px solid #374151", borderRadius: 8, color: "#9ca3af",
                  fontSize: 18, cursor: "pointer", width: 32, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>×</button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ overflowY: "auto", flex: 1, padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* ── SERVER TASKS ── */}
              <section>
                <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  Server Tasks {serverTasks.length > 0 && `(${serverTasks.length})`}
                </h4>
                {loadingTasks && <p style={{ color: "#9ca3af", fontSize: 12 }}>Loading tasks…</p>}
                {!loadingTasks && serverTasks.length === 0 && (
                  <p style={{ color: "#6b7280", fontSize: 13 }}>No tasks yet. Create one to get started.</p>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
                  {serverTasks.map((task) => {
                    const checklistDone = task.checklist.filter((c) => c.done).length;
                    const checklistTotal = task.checklist.length;
                    const taskPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
                    const isEditing = editingTaskId === task._id;

                    return (
                      <div key={task._id} style={{
                        background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "0.875rem",
                      }}>
                        {isEditing ? (
                          /* Edit mode */
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <input
                              type="text" value={task.name}
                              onChange={(e) => setServerTasks((prev) =>
                                prev.map((t) => t._id === task._id ? { ...t, name: e.target.value } : t)
                              )}
                              style={{ padding: "6px", borderRadius: 4, border: "1px solid #334155", background: "#0f172a", color: "#f9fafb", fontSize: 13 }}
                            />
                            <select value={task.status}
                              onChange={(e) => setServerTasks((prev) =>
                                prev.map((t) => t._id === task._id ? { ...t, status: e.target.value as Assignment["status"] } : t)
                              )}
                              style={{ padding: "6px", borderRadius: 4, border: "1px solid #334155", background: "#0f172a", color: "#f9fafb", fontSize: 13 }}
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Waiting for Materials">Waiting for Materials</option>
                              <option value="Resolved">Resolved</option>
                            </select>
                            <textarea placeholder="Assigned staff (comma separated)"
                              defaultValue={task.assignedStaff.join(", ")}
                              onBlur={(e) => setServerTasks((prev) =>
                                prev.map((t) => t._id === task._id
                                  ? { ...t, assignedStaff: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }
                                  : t)
                              )}
                              style={{ padding: "6px", borderRadius: 4, border: "1px solid #334155", background: "#0f172a", color: "#f9fafb", fontSize: 12, minHeight: 50, fontFamily: "inherit" }}
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => updateTask(task._id!, { name: task.name, status: task.status, assignedStaff: task.assignedStaff })}
                                style={{ flex: 1, padding: "6px", fontSize: 11, background: "#10b981", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                                Save
                              </button>
                              <button onClick={() => setEditingTaskId(null)}
                                style={{ flex: 1, padding: "6px", fontSize: 11, background: "#6b7280", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* View mode */
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                              <div style={{ flex: 1 }}>
                                <h5 style={{ margin: "0 0 3px 0", fontSize: 13, color: "#f9fafb", fontWeight: 600 }}>{task.name}</h5>
                                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{task.concernType}</p>
                              </div>
                              <button onClick={() => setEditingTaskId(task._id!)}
                                style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 14, padding: "2px 4px" }}
                                title="Edit">✏️</button>
                            </div>

                            <span style={getStatusBadgeStyle(task.status)}>{task.status}</span>

                            {task.assignedStaff.length > 0 && (
                              <p style={{ margin: "6px 0 0 0", fontSize: 11, color: "#cbd5e1" }}>
                                👤 {task.assignedStaff.join(", ")}
                              </p>
                            )}

                            {task.reportId && (
                              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#64748b" }}>
                                🔗 {task.reportId}
                              </p>
                            )}

                            {/* Checklist */}
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #334155" }}>
                              {checklistTotal > 0 && (
                                <>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 11, color: "#9ca3af" }}>Checklist</span>
                                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{checklistDone}/{checklistTotal} · {taskPct}%</span>
                                  </div>
                                  <div style={{ height: 4, background: "#0f172a", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                                    <div style={{ height: "100%", background: "#8b5cf6", width: `${taskPct}%`, transition: "width 0.2s" }} />
                                  </div>
                                  {task.checklist.map((item) => (
                                    <div key={getItemKey(item)} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 12 }}>
                                      <input
                                        type="checkbox"
                                        checked={!!item.done}
                                        onChange={(e) => toggleChecklistItem(task._id!, item, e.target.checked)}
                                      />
                                      <span style={{ flex: 1, textDecoration: item.done ? "line-through" : "none", color: "#cbd5e1", opacity: item.done ? 0.6 : 1 }}>
                                        {item.text}
                                      </span>
                                      <button
                                        onClick={() => removeChecklistItem(task._id!, item)}
                                        title="Remove item"
                                        style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                                      >×</button>
                                    </div>
                                  ))}
                                </>
                              )}

                              {/* Add new checklist item inline */}
                              <div style={{ display: "flex", gap: 4, marginTop: checklistTotal > 0 ? 6 : 0 }}>
                                <input
                                  type="text"
                                  placeholder="Add item…"
                                  value={newChecklistText[task._id!] || ""}
                                  onChange={(e) => setNewChecklistText((prev) => ({ ...prev, [task._id!]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      addChecklistItem(task._id!, newChecklistText[task._id!] || "");
                                    }
                                  }}
                                  style={{
                                    flex: 1, padding: "4px 6px", fontSize: 11, borderRadius: 4,
                                    border: "1px solid #334155", background: "#0f172a", color: "#f9fafb",
                                  }}
                                />
                                <button
                                  onClick={() => addChecklistItem(task._id!, newChecklistText[task._id!] || "")}
                                  style={{ padding: "4px 8px", fontSize: 11, background: "#334155", color: "#f9fafb", border: "none", borderRadius: 4, cursor: "pointer", flexShrink: 0 }}
                                >+</button>
                              </div>
                            </div>

                            <button onClick={() => deleteServerTask(task._id!)}
                              style={{ marginTop: 8, width: "100%", padding: "4px", fontSize: 11, background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

            </div>{/* end modal body */}
          </div>
        </div>
      )}{/* ================================================================
          TASKS MODAL
      ================================================================ */}
      {listsOpen && (
        <div
          className="tasks-modal-backdrop"
          onClick={() => setListsOpen(false)}
        >
          <div
            className="tasks-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="tasks-modal-header">
              <h2 className="tasks-modal-title">Tasks &amp; Lists</h2>
              <div className="tasks-modal-header-actions">
                <button className="pa-btn" onClick={(e) => {
                  e.stopPropagation();
                  setNewAssignment({ name: "", concernType: "Mechanical", reportId: "", assignedStaff: [], status: "Pending", checklist: [] });
                  setShowModal(true);
                }}>+ Create Task</button>

                <button className="pa-btn" onClick={loadTasksFromServer} disabled={!user?.id}>
                  Refresh Tasks
                </button>

                {listSaveStatus && (
                  <span className={`tasks-save-status ${listSaveStatus.startsWith("✅") ? "is-ok" : listSaveStatus.startsWith("❌") ? "is-err" : "is-info"}`}>
                    {listSaveStatus}
                  </span>
                )}

                <button onClick={() => setListsOpen(false)} aria-label="Close" className="tasks-modal-close">×</button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="tasks-modal-body">
              <section>
                <h4 className="tasks-section-label">
                  Server Tasks {serverTasks.length > 0 && `(${serverTasks.length})`}
                </h4>
                {loadingTasks && <p className="tasks-empty">Loading tasks…</p>}
                {!loadingTasks && serverTasks.length === 0 && (
                  <p className="tasks-empty">No tasks yet. Create one to get started.</p>
                )}
                <div className="tasks-grid">
                  {serverTasks.map((task) => {
                    const checklistDone = task.checklist.filter((c) => c.done).length;
                    const checklistTotal = task.checklist.length;
                    const taskPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
                    const isEditing = editingTaskId === task._id;

                    return (
                      <div key={task._id} className="task-card">
                        {isEditing ? (
                          <div className="task-edit-form">
                            <input
                              type="text"
                              value={task.name}
                              onChange={(e) => setServerTasks((prev) =>
                                prev.map((t) => t._id === task._id ? { ...t, name: e.target.value } : t)
                              )}
                              className="task-edit-input"
                            />
                            <select
                              value={task.status}
                              onChange={(e) => setServerTasks((prev) =>
                                prev.map((t) => t._id === task._id ? { ...t, status: e.target.value as Assignment["status"] } : t)
                              )}
                              className="task-edit-input"
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Waiting for Materials">Waiting for Materials</option>
                              <option value="Resolved">Resolved</option>
                            </select>
                            <textarea
                              placeholder="Assigned staff (comma separated)"
                              defaultValue={task.assignedStaff.join(", ")}
                              onBlur={(e) => setServerTasks((prev) =>
                                prev.map((t) => t._id === task._id
                                  ? { ...t, assignedStaff: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }
                                  : t)
                              )}
                              className="task-edit-textarea"
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => updateTask(task._id!, { name: task.name, status: task.status, assignedStaff: task.assignedStaff })}
                                className="task-edit-save"
                              >Save</button>
                              <button onClick={() => setEditingTaskId(null)} className="task-edit-cancel">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="task-card-top">
                              <div style={{ flex: 1 }}>
                                <h5 className="task-card-name">{task.name}</h5>
                                <p className="task-card-concern">{task.concernType}</p>
                              </div>
                              <button
                                onClick={() => setEditingTaskId(task._id!)}
                                className="task-card-edit-btn"
                                title="Edit"
                              >✏️</button>
                            </div>

                            <span style={getStatusBadgeStyle(task.status)}>{task.status}</span>

                            {task.assignedStaff.length > 0 && (
                              <p className="task-card-staff">👤 {task.assignedStaff.join(", ")}</p>
                            )}

                            {task.reportId && (
                              <p className="task-card-report">🔗 {task.reportId}</p>
                            )}

                            <div className="task-checklist-wrap">
                              {checklistTotal > 0 && (
                                <>
                                  <div className="task-checklist-header">
                                    <span className="task-checklist-label">Checklist</span>
                                    <span className="task-checklist-count">{checklistDone}/{checklistTotal} · {taskPct}%</span>
                                  </div>
                                  <div className="task-checklist-bar-bg">
                                    <div className="task-checklist-bar-fill" style={{ width: `${taskPct}%` }} />
                                  </div>
                                  {task.checklist.map((item) => (
                                    <div key={getItemKey(item)} className="task-checklist-item">
                                      <input
                                        type="checkbox"
                                        checked={!!item.done}
                                        onChange={(e) => toggleChecklistItem(task._id!, item, e.target.checked)}
                                      />
                                      <span className="task-checklist-item-text" style={{
                                        textDecoration: item.done ? "line-through" : "none",
                                        opacity: item.done ? 0.6 : 1,
                                      }}>
                                        {item.text}
                                      </span>
                                      <button
                                        onClick={() => removeChecklistItem(task._id!, item)}
                                        className="task-checklist-remove"
                                        title="Remove item"
                                      >×</button>
                                    </div>
                                  ))}
                                </>
                              )}
                              <div className="task-checklist-add-row">
                                <input
                                  type="text"
                                  placeholder="Add item…"
                                  value={newChecklistText[task._id!] || ""}
                                  onChange={(e) => setNewChecklistText((prev) => ({ ...prev, [task._id!]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") addChecklistItem(task._id!, newChecklistText[task._id!] || "");
                                  }}
                                  className="task-checklist-add-input"
                                />
                                <button
                                  onClick={() => addChecklistItem(task._id!, newChecklistText[task._id!] || "")}
                                  className="task-checklist-add-btn"
                                >+</button>
                              </div>
                            </div>

                            <button onClick={() => deleteServerTask(task._id!)} className="task-delete-btn">
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE TASK MODAL ──
          IMPORTANT: Rendered OUTSIDE the Tasks modal so it is never
          clipped by overflow:hidden or blocked by a lower z-index backdrop. */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 600,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="create-task-modal"
            style={{
              borderRadius: 16,
              padding: "1.5rem",
              width: "100%",
              maxWidth: 500,
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="create-task-modal__title" style={{ margin: 0, fontSize: "1rem" }}>
              Create Task
            </h3>

            <input
              className="dropdown"
              placeholder="Task name"
              value={newAssignment.name}
              onChange={(e) => setNewAssignment({ ...newAssignment, name: e.target.value })}
            />

            <select
              className="dropdown"
              value={newAssignment.concernType}
              onChange={(e) =>
                setNewAssignment({ ...newAssignment, concernType: e.target.value as Assignment["concernType"] })
              }
            >
              <option value="Mechanical">Mechanical</option>
              <option value="Civil">Civil</option>
              <option value="Electrical">Electrical</option>
              <option value="Safety Hazard">Safety Hazard</option>
              <option value="Other">Other</option>
            </select>

            <select
              className="dropdown"
              value={newAssignment.reportId || ""}
              onChange={(e) => setNewAssignment({ ...newAssignment, reportId: e.target.value })}
            >
              <option value="">— Link to Report (optional) —</option>
              {reports.map((r) => (
                <option key={r._id} value={r.reportId}>
                  {r.reportId} – {r.concern}
                </option>
              ))}
            </select>

            <input
              className="dropdown"
              placeholder="Assigned staff (comma separated)"
              defaultValue={newAssignment.assignedStaff.join(", ")}
              onBlur={(e) =>
                setNewAssignment({
                  ...newAssignment,
                  assignedStaff: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />

            <select
              className="dropdown"
              value={newAssignment.status}
              onChange={(e) =>
                setNewAssignment({ ...newAssignment, status: e.target.value as Assignment["status"] })
              }
            >
              <option value="Pending">Pending</option>
              <option value="Waiting for Materials">Waiting for Materials</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>

            <div>
              <p className="create-task-modal__hint" style={{ fontSize: 12, marginBottom: 6 }}>
                Checklist — press Enter to add
              </p>
              <input
                className="dropdown"
                placeholder="Add checklist item…"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const val = e.currentTarget.value.trim();
                  if (!val) return;
                  setNewAssignment((prev) => ({
                    ...prev,
                    checklist: [...prev.checklist, { id: uid(), text: val, done: false }],
                  }));
                  e.currentTarget.value = "";
                }}
              />
              {newAssignment.checklist.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {newAssignment.checklist.map((item) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() =>
                          setNewAssignment((prev) => ({
                            ...prev,
                            checklist: prev.checklist.map((c) =>
                              c.id === item.id ? { ...c, done: !c.done } : c
                            ),
                          }))
                        }
                      />
                      <span
                        className="create-task-modal__checklist-text"
                        style={{
                          fontSize: 13,
                          flex: 1,
                          textDecoration: item.done ? "line-through" : "none",
                          opacity: item.done ? 0.5 : 1,
                        }}
                      >
                        {item.text}
                      </span>
                      <button
                        className="small-btn"
                        onClick={() =>
                          setNewAssignment((prev) => ({
                            ...prev,
                            checklist: prev.checklist.filter((c) => c.id !== item.id),
                          }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                className="pa-btn"
                style={{ flex: 1 }}
                onClick={() => {
                  if (!newAssignment.name.trim()) {
                    alert("Please enter a task name.");
                    return;
                  }
                  createAssignment(newAssignment);
                  setNewAssignment({
                    name: "",
                    concernType: "Mechanical",
                    reportId: "",
                    assignedStaff: [],
                    status: "Pending",
                    checklist: [],
                  });
                  setShowModal(false);
                }}
              >
                Save Task
              </button>
              <button
                className="pa-btn"
                style={{ background: "linear-gradient(to right,#374151,#4b5563)" }}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Analytics;