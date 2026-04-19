// app/Staff/Analytics/page.tsx  (Analytics.tsx → moved to Staff folder)
"use client";

import "@/app/Admin/style/analytics.css";

import React, { FC, useState, useEffect, useMemo, useCallback } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useStaffPerms } from "../hooks/useStaffPerms";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) ||
  "http://localhost:5000";

/* ── Types ── */
interface Report {
  _id?: string; reportId?: string; userType?: string; email?: string;
  heading?: string; description?: string; concern?: string;
  subConcern?: string; otherConcern?: string; building?: string;
  otherBuilding?: string; college?: string; floor?: string;
  room?: string; otherRoom?: string; image?: string;
  status?: string; createdAt?: string;
}

type StatusKey = "pending" | "waiting" | "progress" | "resolved" | "archived";
type TimeMode  = "day" | "week" | "month" | "year";

interface ConcernChartDatum { name: string; base: string; fullLabel: string; value: number; }
interface TimeSeriesPoint   { label: string; value: number; }

const BUILDING_COLORS = ["#3b82f6","#22c55e","#fbbf24","#ef4444","#8b5cf6","#14b8a6","#f97316","#64748b"];
const COLLEGE_COLORS  = ["#3b82f6","#22c55e","#fbbf24","#ef4444","#8b5cf6","#14b8a6","#f97316","#64748b"];

const STATUS_LABELS: Record<StatusKey, string> = {
  pending:"Pending", waiting:"Waiting", progress:"In Progress", resolved:"Resolved", archived:"Archived",
};
const STATUS_TO_FILTER: Record<StatusKey, string> = {
  pending:"Pending", waiting:"Waiting for Materials", progress:"In Progress", resolved:"Resolved", archived:"Archived",
};
const STATUS_COLORS: Record<StatusKey, string> = {
  pending:"#f97316", waiting:"#0ea5e9", progress:"#8b5cf6", resolved:"#10b981", archived:"#6b7280",
};
const STATUSES = ["Pending","Waiting for Materials","In Progress","Resolved","Archived"];
const DEFAULT_STATUS_SET = new Set<string>(["Pending","Waiting for Materials","In Progress","Resolved"]);

const normalizeStatus = (raw?: string): string | null => {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return null;
  if (s === "pending") return "Pending";
  if (s === "waiting for materials" || s === "waiting") return "Waiting for Materials";
  if (s === "in progress") return "In Progress";
  if (s === "resolved") return "Resolved";
  if (s === "archived") return "Archived";
  return null;
};

const getBaseConcern = (r: Report) => (r.concern || "Unspecified").trim() || "Unspecified";
const getConcernLabel = (r: Report) => {
  const base = r.concern || "Unspecified";
  const sub  = r.subConcern || r.otherConcern;
  return sub ? `${base} : ${sub}` : base;
};
const getConcernColor = (base: string) => {
  const b = base.toLowerCase();
  if (b === "civil")       return "#3b82f6";
  if (b === "mechanical")  return "#22c55e";
  if (b === "electrical")  return "#fbbf24";
  return "#9ca3af";
};

/* ══════════════════════════════════════════════════════════ */
const StaffAnalytics: FC = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [canView, setCanView] = useState(false);

  /* ── Permission hook ── */
  const { staffRecord, perms, loaded: permsLoaded, getRoleBadgeStyle, permSummary } = useStaffPerms(user?.id);
  const rb = getRoleBadgeStyle();

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

  /* ── Reports data ── */
  const [reports,  setReports]  = useState<Report[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState("");

  const fetchReports = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoadErr(""); setLoading(true);
      const res  = await fetch(`${API_BASE}/api/reports`, { cache:"no-store", signal });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const list: Report[] = Array.isArray(data) ? data : Array.isArray(data.reports) ? data.reports : [];
      setReports(list);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setLoadErr("Could not load reports.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!canView) return;
    const ctrl = new AbortController();
    fetchReports(ctrl.signal);
    return () => ctrl.abort();
  }, [canView, fetchReports]);

  /* ── Filters ── */
  const [selectedStatuses,  setSelectedStatuses]  = useState<Set<string>>(() => new Set(DEFAULT_STATUS_SET));
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(() => new Set());
  const [selectedConcerns,  setSelectedConcerns]  = useState<Set<string>>(() => new Set());
  const [selectedColleges,  setSelectedColleges]  = useState<Set<string>>(() => new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [timeMode,    setTimeMode]    = useState<TimeMode>("month");

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (v: string) =>
    setter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });

  const clearFilters = () => {
    setSelectedStatuses(new Set(DEFAULT_STATUS_SET));
    setSelectedBuildings(new Set()); setSelectedConcerns(new Set());
    setSelectedColleges(new Set()); setDateFrom(""); setDateTo("");
  };

  const setLastDays = (days: number) => {
    const today = new Date(); const from = new Date();
    from.setDate(today.getDate() - days + 1);
    setDateFrom(from.toISOString().slice(0,10));
    setDateTo(today.toISOString().slice(0,10));
  };

  /* ── Filtered reports ── */
  const filtered = useMemo(() => {
    const fromTS = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTS   = dateTo   ? new Date(dateTo).getTime()  + 86399999 : null;
    return reports.filter(r => {
      const st = normalizeStatus(r.status);
      if (!st || !selectedStatuses.has(st)) return false;
      if (selectedBuildings.size && !selectedBuildings.has(r.building || "")) return false;
      if (selectedConcerns.size  && !selectedConcerns.has(getBaseConcern(r)))   return false;
      if (selectedColleges.size  && !selectedColleges.has(r.college  || ""))    return false;
      if ((fromTS || toTS) && r.createdAt) {
        const ts = new Date(r.createdAt).getTime();
        if (fromTS && ts < fromTS) return false;
        if (toTS   && ts > toTS)   return false;
      }
      return true;
    });
  }, [reports, selectedStatuses, selectedBuildings, selectedConcerns, selectedColleges, dateFrom, dateTo]);

  /* ── Aggregates ── */
  const statusCounts = useMemo(() => {
    const map: Record<StatusKey, number> = { pending:0, waiting:0, progress:0, resolved:0, archived:0 };
    filtered.forEach(r => {
      const s = (r.status||"").toLowerCase();
      if (s === "pending") map.pending++;
      else if (s === "waiting for materials" || s === "waiting") map.waiting++;
      else if (s === "in progress") map.progress++;
      else if (s === "resolved") map.resolved++;
      else if (s === "archived") map.archived++;
    });
    return map;
  }, [filtered]);

  const agg = (arr: Report[], keyFn: (r: Report) => string) => {
    const m = new Map<string, number>();
    arr.forEach(r => { const k = keyFn(r)||"Unspecified"; m.set(k,(m.get(k)||0)+1); });
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a,b) => b.value-a.value);
  };

  const buildingData = useMemo(() => agg(filtered, r => r.building||"Unspecified"), [filtered]);
  const collegeData  = useMemo(() => agg(filtered, r => r.college||"Unspecified"),  [filtered]);

  const concernData = useMemo<ConcernChartDatum[]>(() => {
    const m = new Map<string, ConcernChartDatum>();
    filtered.forEach(r => {
      const full = getConcernLabel(r);
      const base = getBaseConcern(r);
      const key  = `${base}||${full}`;
      const ex   = m.get(key);
      if (ex) ex.value += 1;
      else m.set(key, { name: full.includes(":") ? full.split(":")[1].trim() : full, base, fullLabel: full, value: 1 });
    });
    return [...m.values()].sort((a,b) => b.value-a.value);
  }, [filtered]);

  const statusPieData = useMemo(() => {
    const total = (Object.keys(statusCounts) as StatusKey[])
      .filter(k => selectedStatuses.has(STATUS_TO_FILTER[k]))
      .reduce((sum, k) => sum + statusCounts[k], 0);
    return (Object.keys(statusCounts) as StatusKey[])
      .filter(k => selectedStatuses.has(STATUS_TO_FILTER[k]))
      .map(k => ({
        name: STATUS_LABELS[k], value: statusCounts[k], color: STATUS_COLORS[k],
        percent: total > 0 ? Math.round((statusCounts[k]/total)*100) : 0,
      }))
      .filter(e => e.value > 0);
  }, [statusCounts, selectedStatuses]);

  /* ── Time series ── */
  const timeSeriesData: TimeSeriesPoint[] = useMemo(() => {
    if (!filtered.length) return [];
    const now = new Date();
    const map = new Map<string, { label: string; value: number; sortKey: number }>();
    const threshold = new Date(now);
    if (timeMode === "day")     threshold.setDate(now.getDate() - 29);
    else if (timeMode === "week")  threshold.setDate(now.getDate() - 7*11);
    else if (timeMode === "month") threshold.setMonth(now.getMonth() - 11);
    else threshold.setFullYear(now.getFullYear() - 4);
    filtered.forEach(r => {
      if (!r.createdAt) return;
      const dt = new Date(r.createdAt);
      if (Number.isNaN(dt.getTime()) || dt < threshold) return;
      const y = dt.getFullYear(), mo = dt.getMonth(), d = dt.getDate();
      let key: string, label: string, sortKey: number;
      if (timeMode === "day") {
        key = dt.toISOString().slice(0,10); label = `${mo+1}/${d}`; sortKey = dt.getTime();
      } else if (timeMode === "week") {
        const tmp = new Date(dt); const dow = tmp.getDay()||7; tmp.setDate(tmp.getDate()-(dow-1));
        key = tmp.toISOString().slice(0,10); label = `Wk${tmp.getMonth()+1}`; sortKey = tmp.getTime();
      } else if (timeMode === "month") {
        const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        key = `${y}-${mo+1}`; label = `${mn[mo]} ${String(y).slice(2)}`; sortKey = y*12+mo;
      } else {
        key = `${y}`; label = `${y}`; sortKey = y;
      }
      const ex = map.get(key);
      if (ex) ex.value += 1; else map.set(key, { label, value:1, sortKey });
    });
    return [...map.values()].sort((a,b) => a.sortKey-b.sortKey).map(v => ({ label:v.label, value:v.value }));
  }, [filtered, timeMode]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    const changed = selectedStatuses.size !== DEFAULT_STATUS_SET.size || [...DEFAULT_STATUS_SET].some(s => !selectedStatuses.has(s));
    if (changed) c++;
    if (selectedBuildings.size) c++;
    if (selectedConcerns.size)  c++;
    if (selectedColleges.size)  c++;
    if (dateFrom || dateTo) c++;
    return c;
  }, [selectedStatuses, selectedBuildings, selectedConcerns, selectedColleges, dateFrom, dateTo]);

  /* ── Print ── */
  const handlePrint = useCallback(() => {
    if (typeof window === "undefined") return;
    const printedDate = new Date().toLocaleString();
    const safe = (v?: string) => v ? String(v) : "";
    const rowsHtml = filtered.map((r, idx) => `<tr><td>${idx+1}</td><td>${safe(r.reportId)}</td><td>${r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</td><td>${safe(r.status)}</td><td>${safe(r.building)}</td><td>${safe(getConcernLabel(r))}</td><td>${safe(r.college)}</td><td>${safe(r.floor)}</td><td>${safe(r.room)}</td><td>${safe(r.email)}</td><td>${safe(r.userType)}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFMO Staff Analytics</title><style>body{font-family:system-ui,sans-serif;font-size:8px;padding:10px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #d1d5db;padding:4px 6px;text-align:left}thead{background:#f3f4f6}h1{font-size:18px;margin:16px 0 4px}.title{font-size:13px;font-weight:700;color:#fff;background:#029006;padding:8px}@media print{*{-webkit-print-color-adjust:exact!important}}</style></head><body>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px"><tr><td rowspan="2" style="width:90px;text-align:center"><img src="/logo-dlsud.png" style="width:64px;height:64px;object-fit:contain;padding-top:12px"/></td><td colspan="2" class="title">Building Facilities Maintenance Office : Staff Analytics</td></tr><tr><td><strong>Printed:</strong> ${printedDate}</td><td><strong>Staff:</strong> ${staffRecord?.name || "BFMO Staff"} — ${staffRecord?.position || ""}</td></tr></table>
    <h1>Analytics Report</h1><div style="font-size:11px;margin-bottom:12px">Records: ${filtered.length}</div>
    <table><thead><tr><th>#</th><th>Report ID</th><th>Date Created</th><th>Status</th><th>Building</th><th>Concern</th><th>College</th><th>Floor</th><th>Room</th><th>Email</th><th>Reporter Type</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`;
    const w = window.open("", "_blank"); if (!w) return;
    w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print();
  }, [filtered, staffRecord]);

  /* ── Available filter options ── */
  const availableBuildings = useMemo(() => {
    const s = new Set<string>();
    reports.forEach(r => { if (r.building) s.add(r.building); });
    return [...s].sort();
  }, [reports]);

  const availableConcerns = useMemo(() => {
    const s = new Set<string>();
    reports.forEach(r => { const b = getBaseConcern(r); if (b) s.add(b); });
    return [...s].sort();
  }, [reports]);

  const availableColleges = useMemo(() => {
    const s = new Set<string>();
    reports.forEach(r => { if ((r.college||"").trim()) s.add(r.college as string); });
    return [...s].sort();
  }, [reports]);

  if (!isLoaded || !canView) {
    return <div className="analytics-wrapper"><div className="analytics-container"><p className="note">Checking permissions…</p></div></div>;
  }

  /* ══════════════════════════════════════════════════════════ */
  return (
    <div className="analytics-wrapper">
      <div className="analytics-container">

        {/* ── Header ── */}
        <header className="analytics-header">
          <div>
            <div className="analytics-title">
              <h1>Analytics Dashboard</h1>
              <p className="subtitle" style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                Insights from BFMO Report System
                {staffRecord && (
                  <span style={{ background:rb.bg, color:rb.color, fontSize:"0.68rem", fontWeight:700, padding:"2px 8px", borderRadius:999 }}>
                    {staffRecord.position}
                  </span>
                )}
              </p>
              {loadErr && <div className="note" style={{ color:"#ef4444" }}>{loadErr}</div>}
              {!loading && <span className="note">Showing {filtered.length} of {reports.length} reports</span>}
            </div>
          </div>
          <div className="header-actions">
            <button className="pa-btn" onClick={() => setFiltersOpen(v => !v)}>
              {filtersOpen ? "Hide Filters" : "Show Filters"}
              {activeFilterCount > 0 && <span className="badge" style={{ marginLeft:8 }}>{activeFilterCount}</span>}
            </button>
            <button className="printreports-btn" onClick={handlePrint}>Print Analytics</button>
            <button className="pa-btn" type="button" onClick={() => fetchReports()}>Refresh</button>
          </div>
        </header>

        {/* ── Filters ── */}
        {filtersOpen && (
          <section className="filters card">
            <div className="filters-row">
              <div className="filter-block">
                <h4>Status</h4>
                <div className="chips">
                  {STATUSES.map(s => (
                    <label key={s} className={`chip ${selectedStatuses.has(s) ? "is-on" : ""}`}>
                      <input type="checkbox" checked={selectedStatuses.has(s)} onChange={() => toggleSet(setSelectedStatuses)(s)} />{s}
                    </label>
                  ))}
                </div>
              </div>
              <div className="filter-block">
                <h4>Building</h4>
                <div className="chips scroll">
                  {availableBuildings.map(b => (
                    <label key={b} className={`chip ${selectedBuildings.has(b) ? "is-on" : ""}`}>
                      <input type="checkbox" checked={selectedBuildings.has(b)} onChange={() => toggleSet(setSelectedBuildings)(b)} />{b}
                    </label>
                  ))}
                </div>
              </div>
              <div className="filter-block">
                <h4>Concern</h4>
                <div className="chips scroll">
                  {availableConcerns.map(c => (
                    <label key={c} className={`chip ${selectedConcerns.has(c) ? "is-on" : ""}`}>
                      <input type="checkbox" checked={selectedConcerns.has(c)} onChange={() => toggleSet(setSelectedConcerns)(c)} />{c}
                    </label>
                  ))}
                </div>
              </div>
              <div className="filter-block">
                <h4>College</h4>
                <div className="chips scroll">
                  {availableColleges.map(col => (
                    <label key={col} className={`chip ${selectedColleges.has(col) ? "is-on" : ""}`}>
                      <input type="checkbox" checked={selectedColleges.has(col)} onChange={() => toggleSet(setSelectedColleges)(col)} />{col}
                    </label>
                  ))}
                </div>
              </div>
              <div className="filter-block">
                <h4>Date</h4>
                <div className="dates">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  <span>to</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                <div className="quick-dates">
                  <button type="button" className="quick-date-btn" onClick={() => setLastDays(7)}>Last 7 days</button>
                  <button type="button" className="quick-date-btn" onClick={() => setLastDays(30)}>Last 30 days</button>
                  <button type="button" className="quick-date-btn" onClick={() => { setDateFrom(""); setDateTo(""); }}>All time</button>
                </div>
              </div>
            </div>
            <div className="filters-actions">
              <button className="pa-btn" onClick={clearFilters}>Clear filters</button>
            </div>
          </section>
        )}

        {/* ── Charts grid ── */}
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
                    {statusPieData.map(e => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor:"#ffffff", borderRadius:8, border:"1px solid #e5e7eb", color:"#000" }}
                    formatter={(value, name, props) => [`${value} (${props?.payload?.percent ?? 0}%)`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="header-stats">
              {(() => {
                const total = statusPieData.reduce((s,e)=>s+e.value,0);
                return ([
                  { color:"#10b981", label:"Resolved",    key:"resolved"  as StatusKey },
                  { color:"#f97316", label:"Pending",     key:"pending"   as StatusKey },
                  { color:"#0ea5e9", label:"Waiting",     key:"waiting"   as StatusKey },
                  { color:"#8b5cf6", label:"In Progress", key:"progress"  as StatusKey },
                  { color:"#6b7280", label:"Archived",    key:"archived"  as StatusKey },
                ]).map(({ color, label, key }) => {
                  const count = statusCounts[key];
                  const pct   = total > 0 ? Math.round((count/total)*100) : 0;
                  return (
                    <div className="stat-chip" key={key}>
                      <span className="stat-dot" style={{ background:color }}/>
                      <span>{label}</span><strong>{count}</strong>
                      {count > 0 && <span style={{ fontSize:11, color:"#6b7280", marginLeft:2 }}>({pct}%)</span>}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* By Building */}
          <div className="card analytics-card">
            <h3>Reports by Building</h3>
            <div className="bar-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buildingData}>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="name" tick={false} axisLine={false}/>
                  <YAxis allowDecimals={false}/>
                  <Tooltip contentStyle={{ backgroundColor:"#fff", borderRadius:8, border:"1px solid #e5e7eb", color:"#000" }}/>
                  <Legend content={() => (
                    <div style={{ justifyContent:"center", display:"flex", flexWrap:"wrap", gap:10, marginTop:8, fontSize:12 }}>
                      {buildingData.map((b,i) => (
                        <div key={b.name} style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ width:10, height:10, borderRadius:999, backgroundColor:BUILDING_COLORS[i%BUILDING_COLORS.length] }}/>{b.name}
                        </div>
                      ))}
                    </div>
                  )}/>
                  <Bar dataKey="value">{buildingData.map((_, i) => <Cell key={i} fill={BUILDING_COLORS[i%BUILDING_COLORS.length]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* By Concern */}
          <div className="card analytics-card">
            <h3>Reports by Concern</h3>
            <div className="chart-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={concernData}>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="name" tick={false} axisLine={false}/>
                  <YAxis allowDecimals={false}/>
                  <Tooltip contentStyle={{ backgroundColor:"#fff", borderRadius:8, border:"1px solid #e5e7eb", color:"#000" }}
                    formatter={(value) => [`${value}`, "Reports"]}/>
                  <Bar dataKey="value">{concernData.map((e) => <Cell key={`${e.base}-${e.name}`} fill={getConcernColor(e.base)}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* By College */}
          <div className="card analytics-card">
            <h3>Reports by College</h3>
            <div className="chart-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collegeData}>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="name" tick={false} axisLine={false}/>
                  <YAxis allowDecimals={false}/>
                  <Tooltip contentStyle={{ backgroundColor:"#fff", borderRadius:8, border:"1px solid #e5e7eb", color:"#000" }}/>
                  <Legend content={() => (
                    <div style={{ justifyContent:"center", display:"flex", flexWrap:"wrap", gap:10, marginTop:8, fontSize:12 }}>
                      {collegeData.map((c,i) => (
                        <div key={c.name} style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ width:10, height:10, borderRadius:999, backgroundColor:COLLEGE_COLORS[i%COLLEGE_COLORS.length] }}/>{c.name}
                        </div>
                      ))}
                    </div>
                  )}/>
                  <Bar dataKey="value">{collegeData.map((_,i) => <Cell key={i} fill={COLLEGE_COLORS[i%COLLEGE_COLORS.length]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reports over time */}
          <div className="card analytics-card analytics-card-full">
            <div className="time-header">
              <h3>Reports Over Time</h3>
              <div className="time-mode-toggle">
                {(["day","week","month","year"] as TimeMode[]).map(m => (
                  <button key={m} type="button" className={`time-mode-btn ${timeMode===m?"is-active":""}`} onClick={() => setTimeMode(m)}>
                    {m.charAt(0).toUpperCase()+m.slice(1)}s
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-wrap resizable">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="60%" stopColor="#0ea5e9" stopOpacity={0.6}/>
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="label"/><YAxis allowDecimals={false}/>
                  <Tooltip contentStyle={{ backgroundColor:"#fff", borderRadius:8, border:"1px solid #e5e7eb", color:"#000" }} formatter={(v) => [`${v}`, "Reports"]}/>
                  <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#grad)" strokeWidth={2} dot={{ r:3 }} activeDot={{ r:5 }}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StaffAnalytics;