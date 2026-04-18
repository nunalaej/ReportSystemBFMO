// app/Staff/Notification/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

/* ── Backend notification shape ── */
type DbNotification = {
  _id:            string;
  type:           string;
  title:          string;
  message:        string;
  taskId?:        string;
  taskName?:      string;
  reportId?:      string;
  changedBy?:     string;
  changedByRole?: string;
  fromValue?:     string;
  toValue?:       string;
  affectedStaff?: string[];
  read:           boolean;
  createdAt:      string;
};

/* ── Type → visual style ── */
const TYPE_STYLES: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  task_status_changed: { bg: "#fef3c7", color: "#92400e", label: "Status",   icon: "🔄" },
  task_created:        { bg: "#dcfce7", color: "#166534", label: "Created",  icon: "✅" },
  task_updated:        { bg: "#e0f2fe", color: "#0369a1", label: "Updated",  icon: "✏️" },
  task_deleted:        { bg: "#fee2e2", color: "#991b1b", label: "Deleted",  icon: "🗑️" },
  task_assigned:       { bg: "#f3e8ff", color: "#6b21a8", label: "Assigned", icon: "👤" },
  task_escalated:      { bg: "#fff7ed", color: "#9a3412", label: "Escalated",icon: "⚠️" },
  task_completed:      { bg: "#dcfce7", color: "#166534", label: "Done",     icon: "🎉" },
  report_updated:      { bg: "#dbeafe", color: "#1e40af", label: "Report",   icon: "📋" },
  system:              { bg: "#f1f5f9", color: "#334155", label: "System",   icon: "⚙️" },
};

function getStyle(type: string) {
  return TYPE_STYLES[type] || TYPE_STYLES.system;
}

function getRelativeTime(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  return new Date(dateString).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

const PAGE_SIZE = 20;

export default function StaffNotificationPage() {
  const { user } = useUser();

  const [staffName,     setStaffName]     = useState("");
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [total,         setTotal]         = useState(0);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [error,         setError]         = useState("");
  const [skip,          setSkip]          = useState(0);
  const [readFilter,    setReadFilter]    = useState<"all" | "unread" | "read">("all");

  /* ── Fetch staff name from backend ── */
  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API_BASE}/api/staff/by-clerk/${user.id}`, { cache: "no-store" })
      .then(r => r.json())
      .catch(() => null)
      .then(data => { if (data?.staff?.name) setStaffName(data.staff.name); });
  }, [user?.id]);

  /* ── Fetch notifications filtered by affectedStaff ── */
  const fetchNotifications = useCallback(async (newSkip = 0, replace = true) => {
    try {
      replace ? setLoading(true) : setLoadingMore(true);
      setError("");

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        skip:  String(newSkip),
      });
      if (readFilter === "unread") params.set("unread", "true");

      const res  = await fetch(`${API_BASE}/api/notifications?${params}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(data?.message || "Failed to load notifications.");
        return;
      }

      // Filter to only notifications relevant to this staff member:
      // either they are in affectedStaff OR they made the change (changedBy)
      const name = staffName || user?.fullName || "";
      let items: DbNotification[] = (data.notifications || []).filter((n: DbNotification) => {
        if (!name) return true; // show all if name not resolved yet
        const inAffected = (n.affectedStaff || []).some(
          s => s.toLowerCase() === name.toLowerCase()
        );
        const isChanger  = (n.changedBy || "").toLowerCase() === name.toLowerCase();
        return inAffected || isChanger;
      });

      // client-side read filter
      if (readFilter === "read")   items = items.filter(n => n.read);
      if (readFilter === "unread") items = items.filter(n => !n.read);

      const unread = items.filter(n => !n.read).length;

      if (replace) {
        setNotifications(items);
        setUnreadCount(unread);
        setTotal(items.length); // total after staff filter
      } else {
        setNotifications(prev => {
          const merged = [...prev, ...items];
          setUnreadCount(merged.filter(n => !n.read).length);
          setTotal(merged.length);
          return merged;
        });
      }

      setSkip(newSkip + (data.notifications?.length || 0));
      // whether there are more pages from the server
      setTotal(data.total ?? items.length);
    } catch {
      setError("Network error loading notifications.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [staffName, readFilter, user?.fullName]);

  useEffect(() => {
    fetchNotifications(0, true);
  }, [fetchNotifications]);

  /* ── Mark one as read ── */
  const markAsRead = async (n: DbNotification) => {
    if (n.read) return;
    setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, read: true } : x));
    setUnreadCount(c => Math.max(0, c - 1));
    try {
      await fetch(`${API_BASE}/api/notifications/${n._id}/read`, { method: "PATCH" });
    } catch {
      setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, read: false } : x));
      setUnreadCount(c => c + 1);
    }
  };

  /* ── Mark all as read (local only — only marks staff's own) ── */
  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n._id);
    setNotifications(prev => prev.map(x => ({ ...x, read: true })));
    setUnreadCount(0);
    // Patch each one individually (backend mark-all-read affects ALL notifications)
    await Promise.allSettled(
      unreadIds.map(id => fetch(`${API_BASE}/api/notifications/${id}/read`, { method: "PATCH" }))
    );
  };

  const hasMore = skip < total;

  /* ══════════════════════════════════════════════════════════ */
  return (
    <div style={{
      maxWidth: 780,
      margin: "0 auto",
      padding: "32px 20px 60px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{
            fontSize: "1.5rem", fontWeight: 800, margin: "0 0 4px",
            color: "var(--tasks-text-1, #0d1b2a)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            My Notifications
            {unreadCount > 0 && (
              <span style={{ background: "#ef4444", color: "#fff", fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, lineHeight: 1.5 }}>
                {unreadCount}
              </span>
            )}
          </h1>
          <p style={{ fontSize: "0.78rem", color: "var(--tasks-text-3, #8a97a8)", margin: 0 }}>
            {loading ? "Loading…" : `${notifications.length} notifications · ${unreadCount} unread`}
            {staffName && <span style={{ marginLeft: 8, opacity: 0.6 }}>· {staffName}</span>}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => fetchNotifications(0, true)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--tasks-border, #e8ecf0)", background: "var(--tasks-surface, #fff)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: "var(--tasks-text-2, #4a5568)", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
          {unreadCount > 0 && (
            <button type="button" onClick={markAllAsRead}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--tasks-border, #e8ecf0)", background: "var(--tasks-surface, #fff)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: "var(--tasks-text-2, #4a5568)" }}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* ── Read filter tabs ── */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 20,
        background: "var(--tasks-surface-2, #f8fafc)",
        borderRadius: 10, padding: 4,
        border: "1px solid var(--tasks-border, #e8ecf0)",
        width: "fit-content",
      }}>
        {(["all", "unread", "read"] as const).map(v => (
          <button key={v} type="button" onClick={() => setReadFilter(v)}
            style={{
              padding: "5px 16px", borderRadius: 7, border: "none",
              background: readFilter === v ? "var(--tasks-surface, #fff)" : "transparent",
              boxShadow: readFilter === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              fontSize: "0.78rem", fontWeight: readFilter === v ? 700 : 500,
              color: readFilter === v ? "var(--tasks-text-1, #0d1b2a)" : "var(--tasks-text-3, #8a97a8)",
              cursor: "pointer", transition: "all 0.12s", textTransform: "capitalize",
              fontFamily: "inherit",
            }}>
            {v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: "0.82rem", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button type="button" onClick={() => fetchNotifications(0, true)} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: "0.82rem", textDecoration: "underline" }}>Retry</button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              height: 72, borderRadius: 10,
              background: "linear-gradient(90deg, var(--tasks-border,#e8ecf0) 25%, var(--tasks-surface-2,#f8fafc) 50%, var(--tasks-border,#e8ecf0) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.4s infinite",
            }} />
          ))}
          <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && notifications.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "72px 20px", color: "var(--tasks-text-4, #b8c4ce)" }}>
          <svg viewBox="0 0 64 64" fill="none" width="56" height="56" style={{ margin: "0 auto 14px", display: "block" }}>
            <path d="M32 6C19.85 6 10 15.85 10 28v8L6 42v4h52v-4l-4-6v-8C54 15.85 44.15 6 32 6z" stroke="currentColor" strokeWidth="1.5" opacity="0.25"/>
            <path d="M26 46c0 3.31 2.69 6 6 6s6-2.69 6-6" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
          </svg>
          <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--tasks-text-3, #8a97a8)", margin: "0 0 6px" }}>
            {readFilter !== "all" ? "No notifications match your filter." : "No notifications yet"}
          </p>
          <span style={{ fontSize: "0.78rem", color: "var(--tasks-text-4, #b8c4ce)" }}>
            {readFilter !== "all" ? "Try switching to All." : "Task assignments and status updates will appear here."}
          </span>
        </div>
      )}

      {/* ── Notification list ── */}
      {!loading && notifications.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map(n => {
            const s = getStyle(n.type);
            return (
              <div key={n._id} onClick={() => markAsRead(n)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "14px 16px",
                  background: n.read
                    ? "var(--tasks-surface, #fff)"
                    : "var(--tasks-accent-bg, rgba(37,99,235,0.05))",
                  border: `1.5px solid ${n.read ? "var(--tasks-border, #e8ecf0)" : "var(--tasks-accent, #2563eb)33"}`,
                  borderLeft: `3px solid ${n.read ? "var(--tasks-border, #e8ecf0)" : s.color}`,
                  borderRadius: 10,
                  cursor: n.read ? "default" : "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                  boxShadow: n.read ? "none" : "0 2px 8px rgba(37,99,235,0.06)",
                }}
              >
                {/* Type badge */}
                <span style={{
                  flexShrink: 0, padding: "3px 9px", borderRadius: 999,
                  fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.06em", marginTop: 2,
                  backgroundColor: s.bg, color: s.color,
                  whiteSpace: "nowrap",
                }}>
                  {s.icon} {s.label}
                </span>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: "0.78rem", color: "var(--tasks-text-3, #8a97a8)",
                    margin: "0 0 2px", fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {n.title}
                  </p>
                  <p style={{
                    fontSize: "0.85rem", color: "var(--tasks-text-1, #0d1b2a)",
                    margin: "0 0 6px", lineHeight: 1.45,
                    fontWeight: n.read ? 400 : 600,
                  }}>
                    {n.message}
                  </p>

                  {/* Meta */}
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 12px" }}>
                    <span style={{ fontSize: "0.68rem", color: "var(--tasks-text-4, #b8c4ce)" }}>
                      {getRelativeTime(n.createdAt)}
                    </span>
                    {n.taskName && (
                      <span style={{ fontSize: "0.68rem", color: "var(--tasks-text-4, #b8c4ce)", display: "flex", alignItems: "center", gap: 3 }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        {n.taskName}
                      </span>
                    )}
                    {n.reportId && (
                      <span style={{ fontSize: "0.68rem", color: "var(--tasks-text-4, #b8c4ce)" }}>
                        #{n.reportId}
                      </span>
                    )}
                    {n.fromValue && n.toValue && (
                      <span style={{
                        fontSize: "0.65rem", fontWeight: 600,
                        color: s.color, background: s.bg,
                        padding: "1px 7px", borderRadius: 999,
                      }}>
                        {n.fromValue} → {n.toValue}
                      </span>
                    )}
                  </div>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", flexShrink: 0, marginTop: 5 }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Load more ── */}
      {!loading && hasMore && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button type="button"
            onClick={() => fetchNotifications(skip, false)}
            disabled={loadingMore}
            style={{
              padding: "8px 24px", borderRadius: 8,
              border: "1px solid var(--tasks-border, #e8ecf0)",
              background: "var(--tasks-surface, #fff)",
              color: "var(--tasks-text-2, #4a5568)",
              fontSize: "0.82rem", fontWeight: 600,
              cursor: loadingMore ? "not-allowed" : "pointer",
              opacity: loadingMore ? 0.6 : 1,
              fontFamily: "inherit",
            }}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <p style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--tasks-text-4, #b8c4ce)", marginTop: 20 }}>
          Showing {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}