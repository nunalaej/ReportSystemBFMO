// app/Staff/Notification/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useStaffPerms } from "../hooks/useStaffPerms";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

type DbNotification = {
  _id:            string;
  type:           string;
  title:          string;
  message:        string;
  taskId?:        string;
  taskName?:      string;
  reportId?:      string;
  changedBy?:     string;
  fromValue?:     string;
  toValue?:       string;
  affectedStaff?: string[];
  read:           boolean;
  createdAt:      string;
};

/* Staff sees only status-change notifications on their assigned tasks */
const STAFF_VISIBLE_TYPES = new Set(["task_status_changed", "task_escalated"]);

const TYPE_STYLES: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  task_status_changed: { bg: "#fef3c7", color: "#92400e", label: "Status Updated", icon: "🔄" },
  task_escalated:      { bg: "#fee2e2", color: "#991b1b", label: "Escalated",       icon: "⚠️" },
};

function getStyle(type: string) {
  return TYPE_STYLES[type] ?? { bg: "#f1f5f9", color: "#334155", label: type, icon: "📋" };
}

function getRelativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function StaffNotificationPage() {
  const { user } = useUser();

  /* ── Permissions from DB ── */
  const { staffRecord, perms, loaded: permsLoaded, getRoleBadgeStyle, permSummary } = useStaffPerms(user?.id);
  const rb = getRoleBadgeStyle();

  const staffName = staffRecord?.name || "";

  const [notifs,       setNotifs]       = useState<DbNotification[]>([]);
  const [unread,       setUnread]       = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [error,        setError]        = useState("");
  const [serverSkip,   setServerSkip]   = useState(0);
  const [serverTotal,  setServerTotal]  = useState(0);
  const [readFilter,   setReadFilter]   = useState<"all" | "unread" | "read">("all");

  /* ── Filter: only visible types + only assigned to this staff ── */
  const filterMine = useCallback((raw: DbNotification[], name: string): DbNotification[] => {
    if (!name) return [];
    return raw.filter(n =>
      STAFF_VISIBLE_TYPES.has(n.type) &&
      (n.affectedStaff || []).some(s => s.toLowerCase() === name.toLowerCase())
    );
  }, []);

  /* ── Fetch ── */
  const fetchNotifs = useCallback(async (skip = 0, replace = true) => {
    if (!staffName) return;
    try {
      replace ? setLoading(true) : setLoadingMore(true);
      setError("");
      const [r1, r2] = await Promise.all([
        fetch(`${API_BASE}/api/notifications?limit=50&skip=${skip}&type=task_status_changed`, { cache: "no-store" }),
        fetch(`${API_BASE}/api/notifications?limit=50&skip=${skip}&type=task_escalated`,      { cache: "no-store" }),
      ]);
      const [d1, d2] = await Promise.all([r1.json().catch(()=>null), r2.json().catch(()=>null)]);
      const combined: DbNotification[] = [
        ...(d1?.notifications || []),
        ...(d2?.notifications || []),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const total = (d1?.total || 0) + (d2?.total || 0);
      let items = filterMine(combined, staffName);
      if (readFilter === "read")   items = items.filter(n => n.read);
      if (readFilter === "unread") items = items.filter(n => !n.read);
      if (replace) {
        setNotifs(items);
        setUnread(items.filter(n => !n.read).length);
      } else {
        setNotifs(prev => {
          const merged = [...prev, ...items];
          setUnread(merged.filter(n => !n.read).length);
          return merged;
        });
      }
      setServerSkip(skip + combined.length);
      setServerTotal(total);
    } catch { setError("Network error."); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [staffName, readFilter, filterMine]);

  useEffect(() => { if (staffName) fetchNotifs(0, true); }, [staffName, readFilter]);

  const markRead = async (n: DbNotification) => {
    if (n.read) return;
    setNotifs(prev => prev.map(x => x._id === n._id ? { ...x, read: true } : x));
    setUnread(c => Math.max(0, c - 1));
    try { await fetch(`${API_BASE}/api/notifications/${n._id}/read`, { method: "PATCH" }); }
    catch {
      setNotifs(prev => prev.map(x => x._id === n._id ? { ...x, read: false } : x));
      setUnread(c => c + 1);
    }
  };

  const markAllRead = async () => {
    const ids = notifs.filter(n => !n.read).map(n => n._id);
    setNotifs(prev => prev.map(x => ({ ...x, read: true })));
    setUnread(0);
    await Promise.allSettled(ids.map(id =>
      fetch(`${API_BASE}/api/notifications/${id}/read`, { method: "PATCH" })
    ));
  };

  const hasMore = serverSkip < serverTotal;

  /* ─────────────────────────────────────────────────── */
  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 20px 60px", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:"1.5rem", fontWeight:800, margin:"0 0 4px", color:"var(--tasks-text-1, #0d1b2a)", display:"flex", alignItems:"center", gap:10 }}>
            My Notifications
            {unread > 0 && (
              <span style={{ background:"#ef4444", color:"#fff", fontSize:"0.68rem", fontWeight:700, padding:"2px 8px", borderRadius:999 }}>
                {unread}
              </span>
            )}
          </h1>
          <p style={{ fontSize:"0.78rem", color:"var(--tasks-text-3, #8a97a8)", margin:0, display:"flex", alignItems:"center", flexWrap:"wrap", gap:6 }}>
            {loading ? "Loading…" : `${notifs.length} notifications · ${unread} unread`}
            {staffName && <span style={{ opacity:0.6 }}>· {staffName}</span>}
            {/* Role badge */}
            {staffRecord && (
              <span style={{ background: rb.bg, color: rb.color, fontSize:"0.65rem", fontWeight:700, padding:"1px 8px", borderRadius:999 }}>
                {staffRecord.position}
              </span>
            )}
            <span style={{ fontSize:"0.65rem", background:"#f0f9ff", color:"#0369a1", border:"1px solid #bae6fd", borderRadius:999, padding:"1px 8px", fontWeight:600 }}>
              Status updates only
            </span>
          </p>
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <button type="button" onClick={() => fetchNotifs(0, true)}
            style={{ padding:"6px 12px", borderRadius:8, border:"1px solid var(--tasks-border, #e8ecf0)", background:"var(--tasks-surface, #fff)", fontSize:"0.78rem", fontWeight:600, cursor:"pointer", color:"var(--tasks-text-2, #4a5568)", display:"flex", alignItems:"center", gap:5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
          {unread > 0 && (
            <button type="button" onClick={markAllRead}
              style={{ padding:"6px 12px", borderRadius:8, border:"1px solid var(--tasks-border, #e8ecf0)", background:"var(--tasks-surface, #fff)", fontSize:"0.78rem", fontWeight:600, cursor:"pointer", color:"var(--tasks-text-2, #4a5568)" }}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:"flex", gap:4, marginBottom:20, background:"var(--tasks-surface-2, #f8fafc)", borderRadius:10, padding:4, border:"1px solid var(--tasks-border, #e8ecf0)", width:"fit-content" }}>
        {(["all", "unread", "read"] as const).map(v => (
          <button key={v} type="button" onClick={() => setReadFilter(v)}
            style={{
              padding:"5px 16px", borderRadius:7, border:"none",
              background: readFilter === v ? "var(--tasks-surface, #fff)" : "transparent",
              boxShadow: readFilter === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              fontSize:"0.78rem", fontWeight: readFilter === v ? 700 : 500,
              color: readFilter === v ? "var(--tasks-text-1, #0d1b2a)" : "var(--tasks-text-3, #8a97a8)",
              cursor:"pointer", fontFamily:"inherit",
            }}>
            {v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", padding:"10px 14px", borderRadius:8, fontSize:"0.82rem", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>{error}</span>
          <button type="button" onClick={() => fetchNotifs(0, true)} style={{ color:"#dc2626", background:"none", border:"none", cursor:"pointer", textDecoration:"underline", fontSize:"0.82rem" }}>Retry</button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height:72, borderRadius:10, background:"linear-gradient(90deg, var(--tasks-border,#e8ecf0) 25%, var(--tasks-surface-2,#f8fafc) 50%, var(--tasks-border,#e8ecf0) 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite" }}/>
          ))}
          <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && notifs.length === 0 && !error && (
        <div style={{ textAlign:"center", padding:"72px 20px", color:"var(--tasks-text-4, #b8c4ce)" }}>
          <svg viewBox="0 0 64 64" fill="none" width="56" height="56" style={{ margin:"0 auto 14px", display:"block" }}>
            <path d="M32 6C19.85 6 10 15.85 10 28v8L6 42v4h52v-4l-4-6v-8C54 15.85 44.15 6 32 6z" stroke="currentColor" strokeWidth="1.5" opacity="0.25"/>
            <path d="M26 46c0 3.31 2.69 6 6 6s6-2.69 6-6" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
          </svg>
          <p style={{ fontSize:"0.95rem", fontWeight:600, color:"var(--tasks-text-3, #8a97a8)", margin:"0 0 6px" }}>
            {readFilter !== "all" ? "No notifications match your filter." : "No status updates yet"}
          </p>
          <span style={{ fontSize:"0.78rem", color:"var(--tasks-text-4, #b8c4ce)" }}>
            {readFilter !== "all" ? "Try switching to All." : "You'll be notified here when a task assigned to you changes status."}
          </span>
        </div>
      )}

      {/* ── Notification list ── */}
      {!loading && notifs.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {notifs.map(n => {
            const s = getStyle(n.type);
            return (
              <div key={n._id} onClick={() => markRead(n)}
                style={{
                  display:"flex", alignItems:"flex-start", gap:12,
                  padding:"14px 16px",
                  background: n.read ? "var(--tasks-surface, #fff)" : "var(--tasks-accent-bg, rgba(37,99,235,0.05))",
                  border: `1.5px solid ${n.read ? "var(--tasks-border, #e8ecf0)" : "var(--tasks-accent, #2563eb)33"}`,
                  borderLeft: `3px solid ${n.read ? "var(--tasks-border, #e8ecf0)" : s.color}`,
                  borderRadius:10,
                  cursor: n.read ? "default" : "pointer",
                  transition:"background 0.15s",
                  boxShadow: n.read ? "none" : "0 2px 8px rgba(37,99,235,0.06)",
                }}>
                <span style={{ flexShrink:0, padding:"3px 9px", borderRadius:999, fontSize:"0.62rem", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.06em", marginTop:2, backgroundColor:s.bg, color:s.color, whiteSpace:"nowrap" as const }}>
                  {s.icon} {s.label}
                </span>
                <div style={{ flex:1, minWidth:0 }}>
                  {n.taskName && (
                    <p style={{ fontSize:"0.78rem", color:"var(--tasks-text-3, #8a97a8)", margin:"0 0 2px", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, display:"flex", alignItems:"center", gap:4 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      {n.taskName}
                    </p>
                  )}
                  <p style={{ fontSize:"0.85rem", color:"var(--tasks-text-1, #0d1b2a)", margin:"0 0 6px", lineHeight:1.45, fontWeight: n.read ? 400 : 600 }}>
                    {n.message}
                  </p>
                  <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap" as const, gap:"4px 12px" }}>
                    <span style={{ fontSize:"0.68rem", color:"var(--tasks-text-4, #b8c4ce)" }}>{getRelativeTime(n.createdAt)}</span>
                    {n.changedBy && (
                      <span style={{ fontSize:"0.68rem", color:"var(--tasks-text-4, #b8c4ce)", display:"flex", alignItems:"center", gap:3 }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        {n.changedBy}
                      </span>
                    )}
                    {n.fromValue && n.toValue && (
                      <span style={{ fontSize:"0.65rem", fontWeight:700, color:s.color, background:s.bg, padding:"2px 8px", borderRadius:999 }}>
                        {n.fromValue} → {n.toValue}
                      </span>
                    )}
                    {n.reportId && <span style={{ fontSize:"0.68rem", color:"var(--tasks-text-4, #b8c4ce)" }}>#{n.reportId}</span>}
                  </div>
                </div>
                {!n.read && <div style={{ width:8, height:8, borderRadius:"50%", background:"#3b82f6", flexShrink:0, marginTop:5 }}/>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Load more ── */}
      {!loading && hasMore && (
        <div style={{ marginTop:16, textAlign:"center" }}>
          <button type="button" onClick={() => fetchNotifs(serverSkip, false)} disabled={loadingMore}
            style={{ padding:"8px 24px", borderRadius:8, border:"1px solid var(--tasks-border, #e8ecf0)", background:"var(--tasks-surface, #fff)", color:"var(--tasks-text-2, #4a5568)", fontSize:"0.82rem", fontWeight:600, cursor: loadingMore ? "not-allowed" : "pointer", opacity: loadingMore ? 0.6 : 1, fontFamily:"inherit" }}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {!loading && notifs.length > 0 && (
        <p style={{ textAlign:"center", fontSize:"0.72rem", color:"var(--tasks-text-4, #b8c4ce)", marginTop:20 }}>
          Showing {notifs.length} notification{notifs.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}