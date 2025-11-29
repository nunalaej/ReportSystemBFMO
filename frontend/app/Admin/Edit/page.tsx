"use client";

import "@/app/Admin/style/analytics.css";

import React, {
  FC,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
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

const getConcernBaseFromLabel = (
  fullLabel: string
): { base: string; sub: string } => {
  const [baseRaw, subRaw] = fullLabel.split(" : ");
  const base = (baseRaw || "Unspecified").trim();
  const sub = (subRaw || base).trim(); // if no sub, just reuse base
  return { base, sub };
};

const getConcernColorFromBase = (base: string): string => {
  const b = base.toLowerCase();
  if (b === "civil") return "#3b82f6"; // blue
  if (b === "mechanical") return "#22c55e"; // green
  if (b === "electrical") return "#fbbf24"; // yellow
  return "#9ca3af"; // gray for others
};

/* Helpers */

const formatConcernLabel = (report: Report) => {
  const base = report.concern || "Unspecified";
  const sub = report.subConcern || report.otherConcern;
  return sub ? `${base} : ${sub}` : base;
};

// Match the statuses used in Reports page and backend
const STATUSES: string[] = [
  "Pending",
  "Waiting for Materials",
  "In Progress",
  "Resolved",
  "Archived",
];

// Labels shown in chart/legend per internal key
const STATUS_LABELS: Record<StatusKey, string> = {
  pending: "Pending",
  waiting: "Waiting",
  progress: "In Progress",
  resolved: "Resolved",
  archived: "Archived",
};

// Labels used in the Status filter chips per internal key
const STATUS_TO_FILTER_LABEL: Record<StatusKey, string> = {
  pending: "Pending",
  waiting: "Waiting for Materials",
  progress: "In Progress",
  resolved: "Resolved",
  archived: "Archived",
};

// Colors for light and dark friendly palette
const STATUS_COLORS: Record<StatusKey, string> = {
  pending: "#fbbf24", // amber
  waiting: "#60a5fa", // sky
  progress: "#6366f1", // indigo
  resolved: "#22c55e", // green
  archived: "#9ca3af", // gray
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

  // only true if user is loaded AND role is admin
  const [canView, setCanView] = useState(false);

  /* AUTH GUARD: only admins can view this page */

  useEffect(() => {
    if (!isLoaded) return;

    // Not signed in -> go to landing
    if (!isSignedIn || !user) {
      router.replace("/");
      return;
    }

    // role could be "admin" OR ["admin"]
    const rawRole = (user.publicMetadata as any)?.role;
    let role = "student";

    if (Array.isArray(rawRole) && rawRole.length > 0) {
      role = String(rawRole[0]).toLowerCase();
    } else if (typeof rawRole === "string") {
      role = rawRole.toLowerCase();
    }

    if (role !== "admin") {
      // Non admin -> send to student dashboard
      router.replace("/Student/Dashboard");
      return;
    }

    // User is admin -> allow rendering and data fetch
    setCanView(true);
  }, [isLoaded, isSignedIn, user, router]);

  const handleReports = () => {
    router.push("/Admin/Reports");
  };

  /* =========================================================
    DATA
  ========================================================= */
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadErr, setLoadErr] = useState<string>("");

  // fetch from API, fallback to tiny demo when API is down
  useEffect(() => {
    if (!canView) return;

    let alive = true;
    (async () => {
      try {
        setLoadErr("");
        const res = await fetch(`${API_BASE}/api/reports`);
        if (!res.ok) throw new Error("Failed to fetch reports");
        const data = await res.json();

        if (!alive) return;

        const list: Report[] = Array.isArray(data)
          ? data
          : Array.isArray(data.reports)
          ? data.reports
          : [];
        setReports(list);
      } catch (e) {
        console.error(e);
        if (!alive) return;
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
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [canView]);

  /* =========================================================
    FILTERS
  ========================================================= */

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    () => new Set(STATUSES)
  );
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedConcerns, setSelectedConcerns] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedColleges, setSelectedColleges] = useState<Set<string>>(
    () => new Set()
  );
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const FILTERS_OPEN_KEY = "analytics_filters_open_v1";
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem(FILTERS_OPEN_KEY);
    return saved === null ? true : saved === "1";
  });

  const toggleFiltersOpen = () => {
    setFiltersOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(FILTERS_OPEN_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
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
    setSelectedStatuses(new Set(STATUSES));
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

  // Main filtered array (applies all filters)
  const filtered = useMemo(() => {
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;

    return reports.filter((r) => {
      const st = (r.status || "").trim();
      if (!selectedStatuses.has(st)) return false;

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

  // Available options for each filter, depending on the other filters
  // If an option is not connected to any report, it disappears

  const availableStatusFilters = useMemo(() => {
    const s = new Set<string>();
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS = dateTo ? new Date(dateTo).getTime() + 86399999 : null;

    reports.forEach((r) => {
      const stLabel = normalizeStatusFilterLabel(r.status);
      if (!stLabel) return;

      // apply building, concern, college, date filters, but ignore status filter
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

    // Custom sort so Civil, Mechanical, Electrical stay grouped in this order
    const CONCERN_PRIORITY: Record<string, number> = {
      Civil: 1,
      Mechanical: 2,
      Electrical: 3,
    };

    return [...s].sort((a, b) => {
      const aPri = CONCERN_PRIORITY[a] ?? 999;
      const bPri = CONCERN_PRIORITY[b] ?? 999;

      if (aPri !== bPri) {
        return aPri - bPri;
      }

      // Same base concern - sort alphabetically
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

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (selectedStatuses.size !== STATUSES.length) c++;
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
      else if (s === "waiting for materials" || s === "waiting")
        map.waiting++;
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
    [statusCounts, selectedStatuses]
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
    []
  );

  const buildingData = useMemo(
    () => agg(filtered, "building"),
    [filtered, agg]
  );

  const concernData = useMemo<ConcernChartDatum[]>(() => {
    // Map key: "base||sub"
    const m = new Map<string, ConcernChartDatum>();

    filtered.forEach((r) => {
      const full = formatConcernLabel(r); // example "Civil : Lights"
      if (!full) return;

      const { base, sub } = getConcernBaseFromLabel(full);
      const key = `${base}||${sub}`;

      const existing = m.get(key);
      if (existing) {
        existing.value += 1;
      } else {
        m.set(key, {
          name: sub, // this will be the x axis label
          base, // used for color and legend
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

      // same base, sort by sub name
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  const collegeData = useMemo(
    () => agg(filtered, "college"),
    [filtered, agg]
  );

  const total = filtered.length;

  /* =========================================================
    PRINT AS TABLE (with statistics)
  ========================================================= */

  const handlePrint = useCallback(() => {
    if (typeof window === "undefined") return;

    // statistics based on current filters
    const concernBaseCounts = new Map<string, number>();
    const concernCounts = new Map<string, number>();
    const buildingCounts = new Map<string, number>();

    filtered.forEach((r) => {
      // base concern
      const baseConcern = getBaseConcernFromReport(r) || "Unspecified";
      concernBaseCounts.set(
        baseConcern,
        (concernBaseCounts.get(baseConcern) || 0) + 1
      );

      // detailed concern (with subConcern)
      const concernLabel = formatConcernLabel(r);
      const concernKey = concernLabel || "Unspecified";
      concernCounts.set(
        concernKey,
        (concernCounts.get(concernKey) || 0) + 1
      );

      // building
      const buildingKey =
        (r.building || "Unspecified").trim() || "Unspecified";
      buildingCounts.set(
        buildingKey,
        (buildingCounts.get(buildingKey) || 0) + 1
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

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>BFMO Analytics Report</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              font-size: 12px;
              color: #111827;
              padding: 16px;
            }
            h1 {
              font-size: 20px;
              margin-bottom: 4px;
            }
            h2 {
              font-size: 16px;
              margin-top: 16px;
              margin-bottom: 4px;
            }
            h3 {
              font-size: 14px;
              margin-top: 8px;
              margin-bottom: 4px;
            }
            .meta {
              font-size: 12px;
              color: #4b5563;
              margin-bottom: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 4px 8px;
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
          </style>
        </head>
        <body>
          <h1>BFMO Analytics - Tabular Report</h1>
          <div class="meta">
            Generated at: ${new Date().toLocaleString()}<br />
            Records shown: ${filtered.length}
          </div>

          <h2>Summary Statistics</h2>

          <h3>By Concern (Base)</h3>
          <ul>
            ${concernBaseStatsHtml}
          </ul>

          <h3>By Concern (Detailed)</h3>
          <ul>
            ${concernStatsHtml}
          </ul>

          <h3>By Building</h3>
          <ul>
            ${buildingStatsHtml}
          </ul>

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
              ${
                rowsHtml ||
                '<tr><td colspan="9">No data for current filters.</td></tr>'
              }
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
    []
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
    () => loadLocal() || defaultLists()
  );

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    } catch {
      // ignore
    }
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
        l.id === listId ? { ...l, collapsed: !l.collapsed } : l
      )
    );

  const addTask = (listId: string, text: string) => {
    if (!text) return;
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              tasks: [...l.tasks, { id: uid(), text: text.trim(), done: false }],
            }
          : l
      )
    );
  };

  const toggleTask = (listId: string, taskId: string) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              tasks: l.tasks.map((t) =>
                t.id === taskId ? { ...t, done: !t.done } : t
              ),
            }
          : l
      )
    );
  };

  const deleteTask = (listId: string, taskId: string) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, tasks: l.tasks.filter((t) => t.id !== taskId) }
          : l
      )
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
        {/* Top bar */}
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

            <button className="analytics-btn" onClick={handleReports}>
              To Reports
            </button>

            <button className="printreports-btn" onClick={handlePrint}>
              Print Analytics
            </button>
          </div>
        </header>

        {/* Filters */}
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
                  {availableStatusFilters.map((s) => (
                    <label
                      key={s}
                      className={`chip ${
                        selectedStatuses.has(s) ? "is-on" : ""
                      }`}
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
                  {availableBuildings.map((b) => (
                    <label
                      key={b}
                      className={`chip ${
                        selectedBuildings.has(b) ? "is-on" : ""
                      }`}
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
                  {availableConcerns.map((c) => (
                    <label
                      key={c}
                      className={`chip ${
                        selectedConcerns.has(c) ? "is-on" : ""
                      }`}
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
                  {availableColleges.map((col) => (
                    <label
                      key={col}
                      className={`chip ${
                        selectedColleges.has(col) ? "is-on" : ""
                      }`}
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

        {/* 2x2 Grid of resizable charts */}
        <div className="analytics-grid">
          {/* Status Overview */}
          <div className="card analytics-card">
            <h3>Status Overview</h3>
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
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="header-stats">
              <div className="stat-chip">
                <span
                  className="stat-dot"
                  style={{ background: "#0ea5e9" }}
                />
                <span>Total</span>
                <strong>{reports.length}</strong>
              </div>

              <div className="stat-chip">
                <span
                  className="stat-dot"
                  style={{ background: "#22c55e" }}
                />
                <span>Resolved</span>
                <strong>{statusCounts.resolved}</strong>
              </div>

              <div className="stat-chip">
                <span
                  className="stat-dot"
                  style={{ background: "#fbbf24" }}
                />
                <span>Pending</span>
                <strong>{statusCounts.pending}</strong>
              </div>

              <div className="stat-chip">
                <span
                  className="stat-dot"
                  style={{ background: "#60a5fa" }}
                />
                <span>Waiting</span>
                <strong>{statusCounts.waiting}</strong>
              </div>

              <div className="stat-chip">
                <span
                  className="stat-dot"
                  style={{ background: "#6366f1" }}
                />
                <span>In Progress</span>
                <strong>{statusCounts.progress}</strong>
              </div>

              <div className="stat-chip">
                <span
                  className="stat-dot"
                  style={{ background: "#9ca3af" }}
                />
                <span>Archived</span>
                <strong>{statusCounts.archived}</strong>
              </div>
            </div>
          </div>

          {/* Reports by Building */}
          <div className="card analytics-card">
            <h3>Reports by Building</h3>
            <div className="chart-wrap resizable">
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
                  <Legend />
                  <Bar dataKey="value" fill="#22c55e" />
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
                  {/* bottom label now shows only subconcern, for example "Lights" */}
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
                    // show base and sub nicely in the tooltip
                    labelFormatter={(_, payload) => {
                      const p = (payload &&
                        payload[0]?.payload) as ConcernChartDatum | undefined;
                      if (!p) return "";
                      // Example: "Civil - Lights"
                      return `${p.name}`;
                    }}
                    formatter={(value) => [`${value}`, "Reports"]}
                  />
                  {/* custom legend that shows base concerns with their colors */}
                  <Legend
                    content={() => {
                      const bases = ["Civil", "Mechanical", "Electrical"];
                      return (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginTop: 8,
                          }}
                        >
                          {bases
                            .filter((base) =>
                              concernData.some((d) => d.base === base)
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

          {/* Reports by College */}
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
                  <Legend />
                  <Bar dataKey="value" fill="#fbbf24" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Side Panel: Lists with Progress */}
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
                          if (confirm("Delete this list?"))
                            deleteList(list.id);
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
                              const v =
                                (e.currentTarget.value || "").trim();
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
                            const input =
                              e.currentTarget
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
                                onChange={() =>
                                  toggleTask(list.id, task.id)
                                }
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
