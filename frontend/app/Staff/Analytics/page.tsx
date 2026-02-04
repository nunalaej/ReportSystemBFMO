"use client";

import "@/app/Admin/style/analytics.css";

import React, { FC, useState, useEffect, useMemo, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) ||
  "http://localhost:3000";

/* ===== Types ===== */

interface Comment {
  text?: string;
  comment?: string;
  at?: string;
  by?: string;
}

interface Report {
  _id?: string;
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
  id: string;
  text: string;
  done: boolean;
}

interface List {
  id: string;
  title: string;
  tasks: Task[];
  collapsed: boolean;
}

type StatusKey = "pending" | "waiting" | "progress" | "resolved" | "archived";

interface ConcernChartDatum {
  name: string; // subconcern, for example "Lights"
  base: string; // base concern, for example "Civil"
  fullLabel: string; // original "Civil : Lights"
  value: number;
}

interface TimeSeriesPoint {
  label: string;
  value: number;
}

type TimeMode = "day" | "week" | "month" | "year";

const BUILDING_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#fbbf24",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

const getBuildingColor = (name: string, index: number) => {
  return BUILDING_COLORS[index % BUILDING_COLORS.length];
};

const COLLEGE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#fbbf24",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

const getCollegeColor = (name: string, index: number) => {
  return COLLEGE_COLORS[index % COLLEGE_COLORS.length];
};

const getConcernBaseFromLabel = (
  fullLabel: string,
): { base: string; sub: string } => {
  const [baseRaw, subRaw] = fullLabel.split(" : ");
  const base = (baseRaw || "Unspecified").trim();
  const sub = (subRaw || base).trim();
  return { base, sub };
};

const getConcernColorFromBase = (base: string): string => {
  const b = base.toLowerCase();
  if (b === "civil") return "#3b82f6";
  if (b === "mechanical") return "#22c55e";
  if (b === "electrical") return "#fbbf24";
  return "#9ca3af";
};

/* Helpers */

const formatConcernLabel = (report: Report) => {
  const base = report.concern || "Unspecified";
  const sub = report.subConcern || report.otherConcern;
  return sub ? `${base} : ${sub}` : base;
};

const STATUSES: string[] = [
  "Pending",
  "Waiting for Materials",
  "In Progress",
  "Resolved",
  "Archived",
];

const DEFAULT_STATUS_SET = new Set<string>([
  "Pending",
  "Waiting for Materials",
  "In Progress",
  "Resolved",
]);

const STATUS_LABELS: Record<StatusKey, string> = {
  pending: "Pending",
  waiting: "Waiting",
  progress: "In Progress",
  resolved: "Resolved",
  archived: "Archived",
};

const STATUS_TO_FILTER_LABEL: Record<StatusKey, string> = {
  pending: "Pending",
  waiting: "Waiting for Materials",
  progress: "In Progress",
  resolved: "Resolved",
  archived: "Archived",
};

const STATUS_COLORS: Record<StatusKey, string> = {
  pending: "#fbbf24",
  waiting: "#60a5fa",
  progress: "#6366f1",
  resolved: "#22c55e",
  archived: "#9ca3af",
};

const getBaseConcernFromReport = (r: Report): string => {
  const base = (r.concern || "Unspecified").trim();
  return base || "Unspecified";
};

const normalizeStatusFilterLabel = (raw?: string): string | null => {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return null;
  if (s === "pending") return "Pending";
  if (s === "waiting for materials" || s === "waiting")
    return "Waiting for Materials";
  if (s === "in progress") return "In Progress";
  if (s === "resolved") return "Resolved";
  if (s === "archived") return "Archived";
  return null;
};

const Analytics: FC = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const [canView, setCanView] = useState(false);

  /* AUTH GUARD */

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !user) {
      router.replace("/");
      return;
    }

    const rawRole = (user.publicMetadata as any)?.role;
    let role = "student";

    if (Array.isArray(rawRole) && rawRole.length > 0) {
      role = String(rawRole[0]).toLowerCase();
    } else if (typeof rawRole === "string") {
      role = rawRole.toLowerCase();
    }

    if (role !== "staff") {
      router.replace("/Student");
      return;
    }

    setCanView(true);
  }, [isLoaded, isSignedIn, user, router]);

  /* =========================================================
    DATA
  ========================================================= */
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadErr, setLoadErr] = useState<string>("");

  const fetchReports = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoadErr("");
      setLoading(true);

      // Force fresh data (no cache)
      const res = await fetch(`${API_BASE}/api/reports`, {
        cache: "no-store",
        signal,
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();

      const list: Report[] = Array.isArray(data)
        ? data
        : Array.isArray(data.reports)
          ? data.reports
          : [];

      setReports(list);
    } catch (e: any) {
      if (e?.name === "AbortError") return;

      console.error(e);
      setLoadErr("Could not load reports, using demo data");

      const now = new Date().toISOString();
      setReports([
        {
          status: "Pending",
          building: "Building A",
          concern: "Electrical",
          subConcern: "Lights",
          college: "CIT",
          createdAt: now,
        },
        {
          status: "In Progress",
          building: "Building B",
          concern: "Plumbing",
          college: "COE",
          createdAt: now,
        },
        {
          status: "Resolved",
          building: "Building A",
          concern: "HVAC",
          college: "CIT",
          createdAt: now,
        },
        {
          status: "Pending",
          building: "Building C",
          concern: "Electrical",
          subConcern: "Outlets",
          college: "COE",
          createdAt: now,
        },
        {
          status: "Resolved",
          building: "Building B",
          concern: "Carpentry",
          college: "CLA",
          createdAt: now,
        },
        {
          status: "In Progress",
          building: "Building C",
          concern: "HVAC",
          college: "CBA",
          createdAt: now,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh on page load
  useEffect(() => {
    if (!canView) return;
    const ctrl = new AbortController();
    fetchReports(ctrl.signal);
    return () => ctrl.abort();
  }, [canView, fetchReports]);

  // Optional: refresh when tab becomes active again
  useEffect(() => {
    if (!canView) return;

    const onFocus = () => {
      const ctrl = new AbortController();
      fetchReports(ctrl.signal);
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [canView, fetchReports]);

  /* =========================================================
    FILTERS
  ========================================================= */

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    () =>
      new Set(["Pending", "Waiting for Materials", "In Progress", "Resolved"]),
  );

  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedConcerns, setSelectedConcerns] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedColleges, setSelectedColleges] = useState<Set<string>>(
    () => new Set(),
  );
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const FILTERS_OPEN_KEY = "analytics_filters_open_v1";
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem(FILTERS_OPEN_KEY);
    return saved === null ? false : saved === "1";
  });

  const toggleFiltersOpen = () => {
    setFiltersOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(FILTERS_OPEN_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const toggleSet =
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
    (value: string) => {
      setter((prev) => {
        const n = new Set(prev);
        if (n.has(value)) n.delete(value);
        else n.add(value);
        return n;
      });
    };

  const clearAllFilters = () => {
    setSelectedStatuses(new Set(DEFAULT_STATUS_SET));
    setSelectedBuildings(new Set());
    setSelectedConcerns(new Set());
    setSelectedColleges(new Set());
    setDateFrom("");
    setDateTo("");
  };

  const setLastDays = (days: number) => {
    const today = new Date();
    const from = new Date();
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

      if (selectedBuildings.size && !selectedBuildings.has(r.building || "")) {
        return false;
      }

      const baseConcern = getBaseConcernFromReport(r);
      if (selectedConcerns.size && !selectedConcerns.has(baseConcern)) {
        return false;
      }

      if (selectedColleges.size && !selectedColleges.has(r.college || "")) {
        return false;
      }

      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return false;
        if (toTS && ts > toTS) return false;
      }
      return true;
    });
  }, [
    reports,
    selectedStatuses,
    selectedBuildings,
    selectedConcerns,
    selectedColleges,
    dateFrom,
    dateTo,
  ]);

  const availableStatusFilters = useMemo(() => {
    const s = new Set<string>();
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;

    reports.forEach((r) => {
      const stLabel = normalizeStatusFilterLabel(r.status);
      if (!stLabel) return;

      if (selectedBuildings.size && !selectedBuildings.has(r.building || "")) {
        return;
      }

      const baseConcern = getBaseConcernFromReport(r);
      if (selectedConcerns.size && !selectedConcerns.has(baseConcern)) {
        return;
      }

      if (selectedColleges.size && !selectedColleges.has(r.college || "")) {
        return;
      }

      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return;
        if (toTS && ts > toTS) return;
      }

      s.add(stLabel);
    });

    return STATUSES.filter((st) => s.has(st));
  }, [
    reports,
    selectedBuildings,
    selectedConcerns,
    selectedColleges,
    dateFrom,
    dateTo,
  ]);

  const availableBuildings = useMemo(() => {
    const s = new Set<string>();
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;

    reports.forEach((r) => {
      if (!r.building) return;

      const stLabel = normalizeStatusFilterLabel(r.status);
      if (stLabel && selectedStatuses.size && !selectedStatuses.has(stLabel)) {
        return;
      }

      const baseConcern = getBaseConcernFromReport(r);
      if (selectedConcerns.size && !selectedConcerns.has(baseConcern)) {
        return;
      }

      if (selectedColleges.size && !selectedColleges.has(r.college || "")) {
        return;
      }

      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return;
        if (toTS && ts > toTS) return;
      }

      s.add(r.building);
    });

    return [...s].sort();
  }, [
    reports,
    selectedStatuses,
    selectedConcerns,
    selectedColleges,
    dateFrom,
    dateTo,
  ]);

  const availableConcerns = useMemo(() => {
    const s = new Set<string>();
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;

    reports.forEach((r) => {
      const baseConcern = getBaseConcernFromReport(r);
      if (!baseConcern) return;

      const stLabel = normalizeStatusFilterLabel(r.status);
      if (stLabel && selectedStatuses.size && !selectedStatuses.has(stLabel)) {
        return;
      }

      if (selectedBuildings.size && !selectedBuildings.has(r.building || "")) {
        return;
      }

      if (selectedColleges.size && !selectedColleges.has(r.college || "")) {
        return;
      }

      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return;
        if (toTS && ts > toTS) return;
      }

      s.add(baseConcern);
    });

    const CONCERN_PRIORITY: Record<string, number> = {
      Civil: 1,
      Mechanical: 2,
      Electrical: 3,
    };

    return [...s].sort((a, b) => {
      const aPri = CONCERN_PRIORITY[a] ?? 999;
      const bPri = CONCERN_PRIORITY[b] ?? 999;
      if (aPri !== bPri) return aPri - bPri;
      return a.localeCompare(b);
    });
  }, [
    reports,
    selectedStatuses,
    selectedBuildings,
    selectedColleges,
    dateFrom,
    dateTo,
  ]);

  const availableColleges = useMemo(() => {
    const s = new Set<string>();
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;

    reports.forEach((r) => {
      if (!(r.college || "").trim()) return;

      const stLabel = normalizeStatusFilterLabel(r.status);
      if (stLabel && selectedStatuses.size && !selectedStatuses.has(stLabel)) {
        return;
      }

      if (selectedBuildings.size && !selectedBuildings.has(r.building || "")) {
        return;
      }

      const baseConcern = getBaseConcernFromReport(r);
      if (selectedConcerns.size && !selectedConcerns.has(baseConcern)) {
        return;
      }

      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return;
        if (toTS && ts > toTS) return;
      }

      s.add(r.college as string);
    });

    return [...s].sort();
  }, [
    reports,
    selectedStatuses,
    selectedBuildings,
    selectedConcerns,
    dateFrom,
    dateTo,
  ]);

  const sortedStatusFilters = useMemo(
    () =>
      [...availableStatusFilters].sort((a, b) => {
        const aSel = selectedStatuses.has(a);
        const bSel = selectedStatuses.has(b);
        if (aSel !== bSel) return aSel ? -1 : 1;
        return a.localeCompare(b);
      }),
    [availableStatusFilters, selectedStatuses],
  );

  const sortedBuildings = useMemo(
    () =>
      [...availableBuildings].sort((a, b) => {
        const aSel = selectedBuildings.has(a);
        const bSel = selectedBuildings.has(b);
        if (aSel !== bSel) return aSel ? -1 : 1;
        return a.localeCompare(b);
      }),
    [availableBuildings, selectedBuildings],
  );

  const sortedConcerns = useMemo(
    () =>
      [...availableConcerns].sort((a, b) => {
        const aSel = selectedConcerns.has(a);
        const bSel = selectedConcerns.has(b);
        if (aSel !== bSel) return aSel ? -1 : 1;
        return a.localeCompare(b);
      }),
    [availableConcerns, selectedConcerns],
  );

  const sortedColleges = useMemo(
    () =>
      [...availableColleges].sort((a, b) => {
        const aSel = selectedColleges.has(a);
        const bSel = selectedColleges.has(b);
        if (aSel !== bSel) return aSel ? -1 : 1;
        return a.localeCompare(b);
      }),
    [availableColleges, selectedColleges],
  );

  const activeFilterCount = useMemo(() => {
    let c = 0;
    const statusesChanged =
      selectedStatuses.size !== DEFAULT_STATUS_SET.size ||
      [...DEFAULT_STATUS_SET].some((s) => !selectedStatuses.has(s));
    if (statusesChanged) c++;
    if (selectedBuildings.size) c++;
    if (selectedConcerns.size) c++;
    if (selectedColleges.size) c++;
    if (dateFrom || dateTo) c++;
    return c;
  }, [
    selectedStatuses,
    selectedBuildings,
    selectedConcerns,
    selectedColleges,
    dateFrom,
    dateTo,
  ]);

  /* =========================================================
    AGGREGATES FOR CHARTS
  ========================================================= */
  const statusCounts = useMemo(() => {
    const map: Record<StatusKey, number> = {
      pending: 0,
      waiting: 0,
      progress: 0,
      resolved: 0,
      archived: 0,
    };
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

  const statusPieData = useMemo(
    () =>
      (Object.keys(statusCounts) as StatusKey[])
        .filter((key) => {
          const filterLabel = STATUS_TO_FILTER_LABEL[key];
          return selectedStatuses.has(filterLabel);
        })
        .map((key) => ({
          name: STATUS_LABELS[key],
          value: statusCounts[key],
          color: STATUS_COLORS[key],
        }))
        .filter((entry) => entry.value > 0),
    [statusCounts, selectedStatuses],
  );

  const agg = useCallback(
    (arr: Report[], keyOrFn: keyof Report | ((r: Report) => string)) => {
      const getKey =
        typeof keyOrFn === "function"
          ? keyOrFn
          : (r: Report) => (r[keyOrFn] as string) || "Unspecified";

      const m = new Map<string, number>();
      arr.forEach((r) => {
        const raw = getKey(r);
        const k = raw || "Unspecified";
        m.set(k, (m.get(k) || 0) + 1);
      });
      return [...m.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    },
    [],
  );

  const buildingData = useMemo(
    () => agg(filtered, "building"),
    [filtered, agg],
  );

  const concernData = useMemo<ConcernChartDatum[]>(() => {
    const m = new Map<string, ConcernChartDatum>();

    filtered.forEach((r) => {
      const full = formatConcernLabel(r);
      if (!full) return;

      const { base, sub } = getConcernBaseFromLabel(full);
      const key = `${base}||${sub}`;

      const existing = m.get(key);
      if (existing) existing.value += 1;
      else {
        m.set(key, {
          name: sub,
          base,
          fullLabel: full,
          value: 1,
        });
      }
    });

    const BASE_PRIORITY: Record<string, number> = {
      Civil: 1,
      Mechanical: 2,
      Electrical: 3,
    };

    return [...m.values()].sort((a, b) => {
      const aPri = BASE_PRIORITY[a.base] ?? 999;
      const bPri = BASE_PRIORITY[b.base] ?? 999;
      if (aPri !== bPri) return aPri - bPri;
      return a.name.localeCompare(b.name);
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

    const map = new Map<
      string,
      { label: string; value: number; sortKey: number }
    >();

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
      if (Number.isNaN(dt.getTime())) return;
      if (dt < threshold) return;

      let key: string;
      let label: string;
      let sortKey: number;

      const year = dt.getFullYear();
      const month = dt.getMonth();
      const day = dt.getDate();

      if (timeMode === "day") {
        key = makeDayKey(dt);
        label = `${month + 1}/${day}`;
        sortKey = dt.getTime();
      } else if (timeMode === "week") {
        const tmp = new Date(dt);
        const dayOfWeek = tmp.getDay() || 7;
        tmp.setDate(tmp.getDate() - (dayOfWeek - 1));
        key = `W${tmp.getFullYear()}-${makeDayKey(tmp)}`;
        label = `Wk ${tmp.getFullYear().toString().slice(2)}-${
          tmp.getMonth() + 1
        }`;
        sortKey = tmp.getTime();
      } else if (timeMode === "month") {
        key = `${year}-${month + 1}`;
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        label = `${monthNames[month]} ${year.toString().slice(2)}`;
        sortKey = year * 12 + month;
      } else {
        key = `${year}`;
        label = `${year}`;
        sortKey = year;
      }

      const existing = map.get(key);
      if (existing) existing.value += 1;
      else map.set(key, { label, value: 1, sortKey });
    });

    return [...map.values()]
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((v) => ({ label: v.label, value: v.value }));
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
      concernBaseCounts.set(
        baseConcern,
        (concernBaseCounts.get(baseConcern) || 0) + 1,
      );

      const concernLabel = formatConcernLabel(r);
      const concernKey = concernLabel || "Unspecified";
      concernCounts.set(concernKey, (concernCounts.get(concernKey) || 0) + 1);

      const buildingKey = (r.building || "Unspecified").trim() || "Unspecified";
      buildingCounts.set(
        buildingKey,
        (buildingCounts.get(buildingKey) || 0) + 1,
      );
    });

    const concernBaseStatsHtml =
      [...concernBaseCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<li>${name}: ${count}</li>`)
        .join("") || "<li>No concerns for current filters.</li>";

    const concernStatsHtml =
      [...concernCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<li>${name}: ${count}</li>`)
        .join("") || "<li>No detailed concerns for current filters.</li>";

    const buildingStatsHtml =
      [...buildingCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<li>${name}: ${count}</li>`)
        .join("") || "<li>No buildings for current filters.</li>";

    const rowsHtml = filtered
      .map((r, idx) => {
        const concernLabel = formatConcernLabel(r);
        const created = r.createdAt
          ? new Date(r.createdAt).toLocaleString()
          : "";
        const safe = (v?: string) => (v ? String(v) : "");
        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${created}</td>
            <td>${safe(r.status)}</td>
            <td>${safe(r.building)}</td>
            <td>${safe(concernLabel)}</td>
            <td>${safe(r.college)}</td>
            <td>${safe(r.floor)}</td>
            <td>${safe(r.room)}</td>
            <td>${safe(r.email)}</td>
          </tr>
        `;
      })
      .join("");

    const printedDate = new Date().toLocaleString();

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>BFMO Analytics Report</title>
    <style>
      body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 8px;
    color: #111827;
    padding: 10px;
  }

  .doc-header {
  margin-bottom: 20px;
}

/* CENTER TABLE */
.doc-table {
  width: 100%;
  margin: 0 auto; /* ✅ centers table */
  border-collapse: collapse;
}

/* LOGO CELL */
.logo-cell {
  width: 90px;
  text-align: center;
}

.logo-cell img {
  width: 64px;
  height: 64px;
  padding-top: 12px;
  object-fit: contain;
}

/* HEADER TITLE ROW */
.title {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;               /* ✅ white text */
  background: #029006;          /* ✅ light green */
  border-bottom: 1px solid #000;
  padding: 8px;
}

/* DATA ROWS */
.row-line {
  border-bottom: 1px solid #000; /* ✅ underline only */
  padding-bottom: 4px;
}

.label {
  font-weight: 600;
}

      h1 {
        font-size: 18px;
        margin: 16px 0 4px;
      }

      h2 {
        font-size: 15px;
        margin-top: 16px;
        margin-bottom: 4px;
      }

      h3 {
        font-size: 13px;
        margin-top: 10px;
        margin-bottom: 4px;
      }

      .meta {
        font-size: 11px;
        color: #374151;
        margin-bottom: 12px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }

      th, td {
        border: 1px solid #d1d5db;
        padding: 4px 6px;
        text-align: left;
        vertical-align: top;
      }

      thead {
        background: #f3f4f6;
      }

      ul {
        margin: 4px 0 8px 16px;
        padding: 0;
      }

      li {
        margin: 2px 0;
      }

      @media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}

    </style>
  </head>

  <body>

    <!-- DOCUMENT HEADER -->
    <div class="doc-header">
  <table class="doc-table">

    <tr>
      <td class="logo-cell" rowspan="5">
        <img src="/logo-dlsud.png" alt="BFMO Logo" />
      </td>
      <td colspan="2" class="title">
        Building Facilities Maintenance Office : Report Analytics
      </td>
    </tr>

    <tr>
      <td class="row-line">
        <span class="label">Document Reference:</span>
        BFMO Report System
      </td>
      <td class="row-line">
        <span class="label">Printed Date:</span>
        ${printedDate}
      </td>
    </tr>

    <tr>
      <td class="row-line">
        <span class="label">Confidentiality Level:</span>
        Research Purpose
      </td>
      <td class="row-line">
        <span class="label">Approval Date:</span>
      </td>
    </tr>

    <tr>
      <td class="row-line">
        <span class="label">Review Cycle:</span>
        Monthly
      </td>
      <td class="row-line">
        <span class="label">Effectivity Date:</span>
      </td>
    </tr>

  </table>
</div>



    <h1>BFMO Analytics - Tabular Report</h1>

    <div class="meta">
      Records shown: ${filtered.length}
    </div>

    <h2>Summary Statistics</h2>

    <h3>By Concern (Base)</h3>
    <ul>${concernBaseStatsHtml}</ul>

    <h3>By Concern (Detailed)</h3>
    <ul>${concernStatsHtml}</ul>

    <h3>By Building</h3>
    <ul>${buildingStatsHtml}</ul>

    <h2>Detailed Report</h2>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Date Created</th>
          <th>Status</th>
          <th>Building</th>
          <th>Concern</th>
          <th>College</th>
          <th>Floor</th>
          <th>Room</th>
          <th>Email</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="9">No data for current filters.</td></tr>'}
      </tbody>
    </table>

  </body>
</html>
`;

    const printWin = window.open("", "_blank");
    if (!printWin) return;
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    printWin.print();
  }, [filtered]);

  /* =========================================================
    LISTS WITH PROGRESS SIDE PANEL
  ========================================================= */
  const [listsOpen, setListsOpen] = useState<boolean>(false);

  const STORAGE_KEY = "todoLists_v1";
  const uid = useCallback(
    () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    [],
  );

  const defaultLists = useCallback((): List[] => {
    return [
      {
        id: uid(),
        title: "Sample BFMO Checklist",
        tasks: [
          { id: uid(), text: "Review unresolved reports", done: false },
          { id: uid(), text: "Coordinate with maintenance team", done: false },
          { id: uid(), text: "Prepare weekly summary", done: false },
        ],
        collapsed: false,
      },
    ];
  }, [uid]);

  const loadLocal = useCallback((): List[] | null => {
    try {
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as List[];
    } catch {
      return null;
    }
  }, []);

  const [lists, setLists] = useState<List[]>(
    () => loadLocal() || defaultLists(),
  );

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    } catch {}
  }, [lists]);

  const computeProgress = useCallback((list: List) => {
    if (!list.tasks || list.tasks.length === 0) return 0;
    const done = list.tasks.filter((t) => t.done).length;
    return Math.round((done / list.tasks.length) * 100);
  }, []);

  const createList = (title: string) =>
    setLists((prev) => [
      { id: uid(), title: title || "Untitled", tasks: [], collapsed: false },
      ...prev,
    ]);

  const deleteList = (listId: string) =>
    setLists((prev) => prev.filter((l) => l.id !== listId));

  const toggleCollapse = (listId: string) =>
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId ? { ...l, collapsed: !l.collapsed } : l,
      ),
    );

  const addTask = (listId: string, text: string) => {
    if (!text) return;
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              tasks: [
                ...l.tasks,
                { id: uid(), text: text.trim(), done: false },
              ],
            }
          : l,
      ),
    );
  };

  const toggleTask = (listId: string, taskId: string) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              tasks: l.tasks.map((t) =>
                t.id === taskId ? { ...t, done: !t.done } : t,
              ),
            }
          : l,
      ),
    );
  };

  const deleteTask = (listId: string, taskId: string) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, tasks: l.tasks.filter((t) => t.id !== taskId) }
          : l,
      ),
    );
  };

  const saveToServer = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/lists/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lists }),
      });
      if (!res.ok) throw new Error("Sync failed");
      alert("Lists saved to server");
    } catch (e) {
      console.error(e);
      alert("Failed to save lists to server");
    }
  }, [lists]);

  const loadFromServer = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/lists`);
      if (!res.ok) throw new Error("Load failed");
      const data = await res.json();
      if (Array.isArray(data) && data.length) setLists(data as List[]);
      else alert("No lists found on server");
    } catch (e) {
      console.error(e);
      alert("Failed to load lists from server");
    }
  }, []);

  /* RENDER */

  if (!isLoaded || !canView) {
    return (
      <div className="analytics-wrapper">
        <div className="analytics-container">
          <p className="note">Checking your permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-wrapper">
      <div className="analytics-container">
        <header className="analytics-header">
          <div>
            <div className="analytics-title">
              <h1>Analytics Dashboard</h1>
              <p className="subtitle">Insights from BFMO Report System</p>
              {loadErr ? <div className="note">{loadErr}</div> : null}
              {!loading && (
                <span className="note">
                  Showing {filtered.length} of {reports.length} reports
                </span>
              )}
            </div>
          </div>

          <div className="header-actions">
            <button
              className="pa-btn"
              onClick={toggleFiltersOpen}
              aria-expanded={filtersOpen}
              aria-controls="filters-panel"
              title={filtersOpen ? "Hide filters" : "Show filters"}
            >
              {filtersOpen ? "Hide Filters" : "Show Filters"}
              {activeFilterCount > 0 && (
                <span className="badge" style={{ marginLeft: 8 }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              className="pa-btn"
              type="button"
              onClick={() => setListsOpen(true)}
            >
              Open Lists Panel
            </button>

            <button className="printreports-btn" onClick={handlePrint}>
              Print Analytics
            </button>

            {/* Optional manual refresh (keeps your layout) */}
            <button
              className="pa-btn"
              type="button"
              onClick={() => fetchReports()}
            >
              Refresh Data
            </button>
          </div>
        </header>

        {filtersOpen && (
          <section
            id="filters-panel"
            className="filters card"
            aria-label="Filters"
          >
            <div className="filters-row">
              <div className="filter-block">
                <h4>Status</h4>
                <div className="chips">
                  {sortedStatusFilters.map((s) => (
                    <label
                      key={s}
                      className={`chip ${selectedStatuses.has(s) ? "is-on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStatuses.has(s)}
                        onChange={() => toggleSet(setSelectedStatuses)(s)}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-block">
                <h4>Building</h4>
                <div className="chips scroll">
                  {sortedBuildings.map((b) => (
                    <label
                      key={b}
                      className={`chip ${selectedBuildings.has(b) ? "is-on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBuildings.has(b)}
                        onChange={() => toggleSet(setSelectedBuildings)(b)}
                      />
                      {b}
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-block">
                <h4>Concern</h4>
                <div className="chips scroll">
                  {sortedConcerns.map((c) => (
                    <label
                      key={c}
                      className={`chip ${selectedConcerns.has(c) ? "is-on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedConcerns.has(c)}
                        onChange={() => toggleSet(setSelectedConcerns)(c)}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-block">
                <h4>College</h4>
                <div className="chips scroll">
                  {sortedColleges.map((col) => (
                    <label
                      key={col}
                      className={`chip ${selectedColleges.has(col) ? "is-on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedColleges.has(col)}
                        onChange={() => toggleSet(setSelectedColleges)(col)}
                      />
                      {col}
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-block">
                <h4>Date</h4>
                <div className="dates">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>

                <div className="quick-dates">
                  <button
                    type="button"
                    className="quick-date-btn"
                    onClick={() => setLastDays(7)}
                  >
                    Last 7 days
                  </button>
                  <button
                    type="button"
                    className="quick-date-btn"
                    onClick={() => setLastDays(30)}
                  >
                    Last 30 days
                  </button>
                  <button
                    type="button"
                    className="quick-date-btn"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    All time
                  </button>
                </div>
              </div>
            </div>

            <div className="filters-actions">
              <button className="pa-btn" onClick={clearAllFilters}>
                Clear filters
              </button>
            </div>
          </section>
        )}

        <div className="analytics-grid">
          <div className="card analytics-card">
            <div className="header-stats-total">
              <h3>Status Overview</h3>
              <div className="stat-chip-total">
                <span>Total</span>
                <strong>{reports.length}</strong>
              </div>
            </div>

            <div className="chart-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius="80%"
                    labelLine={false}
                    label={false}
                    dataKey="value"
                  >
                    {statusPieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      color: "#000000",
                    }}
                    labelStyle={{ color: "#000000" }}
                    itemStyle={{ color: "#000000" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="header-stats">
              <div className="stat-chip">
                <span className="stat-dot" style={{ background: "#22c55e" }} />
                <span>Resolved</span>
                <strong>{statusCounts.resolved}</strong>
              </div>

              <div className="stat-chip">
                <span className="stat-dot" style={{ background: "#fbbf24" }} />
                <span>Pending</span>
                <strong>{statusCounts.pending}</strong>
              </div>

              <div className="stat-chip">
                <span className="stat-dot" style={{ background: "#60a5fa" }} />
                <span>Waiting</span>
                <strong>{statusCounts.waiting}</strong>
              </div>

              <div className="stat-chip">
                <span className="stat-dot" style={{ background: "#6366f1" }} />
                <span>In Progress</span>
                <strong>{statusCounts.progress}</strong>
              </div>

              <div className="stat-chip">
                <span className="stat-dot" style={{ background: "#9ca3af" }} />
                <span>Archived</span>
                <strong>{statusCounts.archived}</strong>
              </div>
            </div>
          </div>

          <div className="card analytics-card">
            <h3>Reports by Building</h3>
            <div className="bar-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buildingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={false} axisLine={false} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      color: "#000000",
                    }}
                    labelStyle={{ color: "#000000" }}
                    itemStyle={{ color: "#000000" }}
                  />
                  <Legend
                    content={() => (
                      <div
                        style={{
                          justifyContent: "center",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          marginTop: 8,
                          fontSize: 12,
                        }}
                      >
                        {buildingData.map((b, idx) => (
                          <div
                            key={b.name}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                backgroundColor: getBuildingColor(b.name, idx),
                              }}
                            />
                            {b.name}
                          </div>
                        ))}
                      </div>
                    )}
                  />
                  <Bar dataKey="value">
                    {buildingData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={getBuildingColor(entry.name, index)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card analytics-card">
            <h3>Reports by Concern</h3>
            <div className="chart-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={concernData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={false} axisLine={false} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      color: "#000000",
                    }}
                    labelStyle={{ color: "#000000" }}
                    itemStyle={{ color: "#000000" }}
                    labelFormatter={(_, payload) => {
                      const p = (payload && payload[0]?.payload) as
                        | ConcernChartDatum
                        | undefined;
                      if (!p) return "";
                      return `${p.name}`;
                    }}
                    formatter={(value) => [`${value}`, "Reports"]}
                  />
                  <Legend
                    content={() => {
                      const bases = ["Civil", "Mechanical", "Electrical"];
                      return (
                        <div
                          style={{
                            justifyContent: "center",
                            alignItems: "center",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginTop: 8,
                          }}
                        >
                          {bases
                            .filter((base) =>
                              concernData.some((d) => d.base === base),
                            )
                            .map((base) => (
                              <div
                                key={base}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  fontSize: 12,
                                }}
                              >
                                <span
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 999,
                                    backgroundColor:
                                      getConcernColorFromBase(base),
                                  }}
                                />
                                <span>{base}</span>
                              </div>
                            ))}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value">
                    {concernData.map((entry) => (
                      <Cell
                        key={`${entry.base}-${entry.name}`}
                        fill={getConcernColorFromBase(entry.base)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card analytics-card">
            <h3>Reports by College</h3>
            <div className="chart-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collegeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={false} axisLine={false} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      color: "#000000",
                    }}
                    labelStyle={{ color: "#000000" }}
                    itemStyle={{ color: "#000000" }}
                  />
                  <Legend
                    content={() => (
                      <div
                        style={{
                          justifyContent: "center",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          marginTop: 8,
                          fontSize: 12,
                        }}
                      >
                        {collegeData.map((col, idx) => (
                          <div
                            key={col.name}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                backgroundColor: getCollegeColor(col.name, idx),
                              }}
                            />
                            {col.name}
                          </div>
                        ))}
                      </div>
                    )}
                  />
                  <Bar dataKey="value">
                    {collegeData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={getCollegeColor(entry.name, index)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card analytics-card analytics-card-full">
            <div className="time-header">
              <h3>Reports Over Time</h3>
              <div className="time-mode-toggle">
                <button
                  type="button"
                  className={`time-mode-btn ${timeMode === "day" ? "is-active" : ""}`}
                  onClick={() => setTimeMode("day")}
                >
                  Days
                </button>
                <button
                  type="button"
                  className={`time-mode-btn ${timeMode === "week" ? "is-active" : ""}`}
                  onClick={() => setTimeMode("week")}
                >
                  Weeks
                </button>
                <button
                  type="button"
                  className={`time-mode-btn ${timeMode === "month" ? "is-active" : ""}`}
                  onClick={() => setTimeMode("month")}
                >
                  Months
                </button>
                <button
                  type="button"
                  className={`time-mode-btn ${timeMode === "year" ? "is-active" : ""}`}
                  onClick={() => setTimeMode("year")}
                >
                  Years
                </button>
              </div>
            </div>

            <div className="chart-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient
                      id="reportsGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                      <stop
                        offset="60%"
                        stopColor="#0ea5e9"
                        stopOpacity={0.6}
                      />
                      <stop
                        offset="100%"
                        stopColor="#6366f1"
                        stopOpacity={0.2}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      color: "#000000",
                    }}
                    labelStyle={{ color: "#000000" }}
                    itemStyle={{ color: "#000000" }}
                    formatter={(value) => [`${value}`, "Reports"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#22c55e"
                    fill="url(#reportsGradient)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`sidepanel ${listsOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Lists with Progress"
      >
        <div className="sidepanel-head">
          <h3>Lists with Progress</h3>
          <button
            className="sidepanel-close"
            onClick={() => setListsOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="lists-controls sticky">
          <button
            className="pa-btn"
            onClick={() => {
              const title = prompt("List title:");
              if (title && title.trim()) createList(title.trim());
            }}
          >
            + Add List
          </button>
          <button className="pa-btn" onClick={saveToServer}>
            Save to Server
          </button>
          <button className="pa-btn" onClick={loadFromServer}>
            Load from Server
          </button>
        </div>

        <div className="lists-grid panel">
          {lists.map((list) => {
            const pct = computeProgress(list);
            return (
              <section key={list.id} className="pa-card list-panel">
                <div className="pa-card__glow" />
                <div className="pa-card__base" />
                <div className="pa-card__content">
                  <div className="list-header">
                    <div className="list-left">
                      <div className="list-title-row">
                        <h3 className="list-title">{list.title}</h3>
                        <button
                          className="small-btn collapse"
                          onClick={() => toggleCollapse(list.id)}
                        >
                          {list.collapsed ? "Expand" : "Panel"}
                        </button>
                      </div>

                      <div className="progress-wrap">
                        <div className="muted">{pct}%</div>
                        <div className="progress-bar small">
                          <div
                            className="progress-fill"
                            style={{ transform: `scaleX(${pct / 100})` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="list-actions">
                      <button
                        className="small-btn"
                        onClick={() => {
                          const text = prompt("Task name:");
                          if (text && text.trim())
                            addTask(list.id, text.trim());
                        }}
                      >
                        + Task
                      </button>
                      <button
                        className="small-btn"
                        onClick={() => {
                          if (confirm("Delete this list?")) deleteList(list.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {!list.collapsed && (
                    <div className="list-body">
                      <div className="add-inline">
                        <input
                          className="input"
                          placeholder="New task name"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const v = (e.currentTarget.value || "").trim();
                              if (v) {
                                addTask(list.id, v);
                                (e.currentTarget as HTMLInputElement).value =
                                  "";
                              }
                            }
                          }}
                        />
                        <button
                          className="small-btn"
                          onClick={(e) => {
                            const input = e.currentTarget
                              .previousElementSibling as HTMLInputElement | null;
                            if (input && input.value.trim()) {
                              addTask(list.id, input.value.trim());
                              input.value = "";
                            }
                          }}
                        >
                          Add
                        </button>
                      </div>

                      <div className="tasks-wrap">
                        {!list.tasks || list.tasks.length === 0 ? (
                          <div className="muted">No tasks yet.</div>
                        ) : (
                          list.tasks.map((task) => (
                            <div key={task.id} className="task-row">
                              <input
                                type="checkbox"
                                checked={!!task.done}
                                onChange={() => toggleTask(list.id, task.id)}
                              />
                              <label
                                style={{
                                  textDecoration: task.done
                                    ? "line-through"
                                    : "none",
                                }}
                              >
                                {task.text}
                              </label>
                              <button
                                className="small-btn"
                                title="Delete task"
                                onClick={() => {
                                  if (confirm("Delete task?"))
                                    deleteTask(list.id, task.id);
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {listsOpen && (
        <div
          className="sidepanel-backdrop"
          onClick={() => setListsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default Analytics;
