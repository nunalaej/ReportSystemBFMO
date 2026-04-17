"use client";

import React, { useEffect, useState, useCallback } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "")) || "";

type Notification = {
  _id: string;
  type: string;
  title: string;
  message: string;
  taskId?: string;
  taskName?: string;
  reportId?: string;
  changedBy?: string;
  changedByRole?: string;
  fromValue?: string;
  toValue?: string;
  affectedStaff?: string[];
  read: boolean;
  emailSent?: boolean;
  emailCount?: number;
  createdAt: string;
};

const TYPE_META: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  task_created:        { bg: "#dcfce7", color: "#166534", label: "Created",   icon: "➕" },
  task_updated:        { bg: "#dbeafe", color: "#1e40af", label: "Updated",   icon: "✏️" },
  task_status_changed: { bg: "#f3e8ff", color: "#6b21a8", label: "Status",    icon: "🔄" },
  task_deleted:        { bg: "#fee2e2", color: "#991b1b", label: "Deleted",   icon: "🗑️" },
  task_assigned:       { bg: "#fef3c7", color: "#92400e", label: "Assigned",  icon: "👤" },
  task_escalated:      { bg: "#ffedd5", color: "#9a3412", label: "Escalated", icon: "⚠️" },
  task_completed:      { bg: "#d1fae5", color: "#065f46", label: "Done",      icon: "✅" },
  report_updated:      { bg: "#e0f2fe", color: "#0369a1", label: "Report",    icon: "📋" },
  report_archived:     { bg: "#f1f5f9", color: "#475569", label: "Archived",  icon: "📦" },
  comment_added:       { bg: "#fce7f3", color: "#9d174d", label: "Comment",   icon: "💬" },
  system:              { bg: "#f1f5f9", color: "#334155", label: "System",    icon: "⚙️" },
};

const ROLE_COLORS: Record<string, string> = {
  admin: "#6366f1", staff: "#0ea5e9", system: "#94a3b8",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationPageInner() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [typeFilter,    setTypeFilter]    = useState("all");
  const [unreadOnly,    setUnreadOnly]    = useState(false);
  const [expanded,      setExpanded]      = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: "100" });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (unreadOnly)           params.set("unread", "true");
      const res  = await fetch(`${API_BASE}/api/notifications?${params}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
    finally { setLoading(false); }
  }, [typeFilter, unreadOnly]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markRead = async (id: string) => {
    await fetch(`${API_BASE}/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications(p => p.map(n => n._id === id ? { ...n, read: true } : n));
    setUnreadCount(p => Math.max(0, p - 1));
  };

  const markAllRead = async () => {
    await fetch(`${API_BASE}/api/notifications/mark-all-read`, { method: "PATCH" });
    setNotifications(p => p.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearAll = async () => {
    if (!confirm("Clear all notifications? This cannot be undone.")) return;
    await fetch(`${API_BASE}/api/notifications/clear-all`, { method: "DELETE" });
    setNotifications([]); setUnreadCount(0);
  };

  const TYPE_FILTERS = [
    { value: "all",                label: "All" },
    { value: "task_status_changed", label: "Status" },
    { value: "task_created",        label: "Created" },
    { value: "task_updated",        label: "Updated" },
    { value: "task_assigned",       label: "Assigned" },
    { value: "task_escalated",      label: "Escalated" },
    { value: "task_deleted",        label: "Deleted" },
    { value: "system",              label: "System" },
  ];

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 20px" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>
            Activity Log
            {unreadCount > 0 && (
              <span style={{ marginLeft: 10, background: "#ef4444", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                {unreadCount} new
              </span>
            )}
          </h1>
          <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: "4px 0 0" }}>
            {notifications.length} total · {unreadCount} unread — auto-refreshes every 30s
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setUnreadOnly(v => !v)}
            style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${unreadOnly ? "#6366f1" : "#e5e7eb"}`, background: unreadOnly ? "#eef2ff" : "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: unreadOnly ? "#6366f1" : "#374151" }}>
            {unreadOnly ? "● Unread only" : "All"}
          </button>
          <button onClick={fetchNotifications}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: "0.78rem", cursor: "pointer", color: "#374151" }}>
            ↻ Refresh
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: "#374151" }}>
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: "#dc2626" }}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Type filter tabs ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {TYPE_FILTERS.map(f => (
          <button key={f.value} onClick={() => setTypeFilter(f.value)}
            style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${typeFilter === f.value ? "#6366f1" : "#e5e7eb"}`, background: typeFilter === f.value ? "#eef2ff" : "#fff", fontSize: "0.75rem", fontWeight: typeFilter === f.value ? 700 : 400, cursor: "pointer", color: typeFilter === f.value ? "#6366f1" : "#6b7280" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Loading…</div>
      )}

      {/* ── Empty ── */}
      {!loading && notifications.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#d1d5db" }}>
          <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#9ca3af" }}>No activity yet</p>
          <span style={{ fontSize: "0.78rem" }}>Task changes, status updates, and email notifications will appear here</span>
        </div>
      )}

      {/* ── List ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notifications.map(n => {
          const meta       = TYPE_META[n.type] || TYPE_META.system;
          const isExpanded = expanded === n._id;
          const roleColor  = ROLE_COLORS[n.changedByRole || "system"] || "#94a3b8";

          return (
            <div key={n._id}
              onClick={() => { if (!n.read) markRead(n._id); setExpanded(isExpanded ? null : n._id); }}
              style={{
                background:   n.read ? "#fff" : "#f0f9ff",
                border:       `1.5px solid ${n.read ? "#e5e7eb" : "#bae6fd"}`,
                borderRadius: 12, cursor: "pointer",
                boxShadow:    n.read ? "none" : "0 2px 8px rgba(14,165,233,0.08)",
                overflow:     "hidden",
                transition:   "border-color 0.15s",
              }}>

              {/* ── Main row ── */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px" }}>

                {/* Icon */}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
                  {meta.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", backgroundColor: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                    {n.changedBy && (
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: roleColor, background: roleColor + "15", padding: "1px 7px", borderRadius: 999 }}>
                        {n.changedBy}
                      </span>
                    )}
                    {n.emailSent && (
                      <span style={{ fontSize: "0.65rem", color: "#0ea5e9", background: "#e0f2fe", padding: "1px 6px", borderRadius: 999 }}>
                        📧 {n.emailCount} email{(n.emailCount || 0) > 1 ? "s" : ""} sent
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <p style={{ fontSize: "0.84rem", color: "#0f172a", margin: "0 0 3px", fontWeight: n.read ? 500 : 700, lineHeight: 1.4 }}>
                    {n.title}
                  </p>

                  {/* Message preview */}
                  <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0 0 6px", lineHeight: 1.45 }}>
                    {n.message}
                  </p>

                  {/* Footer meta */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                      🕐 {timeAgo(n.createdAt)}
                    </span>
                    <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                    {n.taskName && (
                      <span style={{ fontSize: "0.68rem", color: "#6366f1", background: "#eef2ff", padding: "1px 6px", borderRadius: 4 }}>
                        📋 {n.taskName}
                      </span>
                    )}
                    {n.reportId && (
                      <span style={{ fontSize: "0.68rem", color: "#0ea5e9", background: "#e0f2fe", padding: "1px 6px", borderRadius: 4 }}>
                        #{n.reportId}
                      </span>
                    )}
                    <span style={{ fontSize: "0.68rem", color: "#9ca3af", marginLeft: "auto" }}>
                      {isExpanded ? "▲ less" : "▼ more"}
                    </span>
                  </div>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#3b82f6", flexShrink: 0, marginTop: 4 }} />
                )}
              </div>

              {/* ── Expanded detail ── */}
              {isExpanded && (
                <div style={{ borderTop: "1px solid #f1f5f9", padding: "12px 16px 14px", background: "#f8fafc", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px 24px" }}>

                  {n.fromValue && n.toValue && (
                    <div>
                      <p style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", margin: "0 0 3px" }}>Change</p>
                      <p style={{ fontSize: "0.8rem", color: "#0f172a", margin: 0 }}>
                        <span style={{ color: "#ef4444" }}>{n.fromValue}</span>
                        <span style={{ color: "#9ca3af", margin: "0 6px" }}>→</span>
                        <span style={{ color: "#22c55e" }}>{n.toValue}</span>
                      </p>
                    </div>
                  )}

                  {n.changedBy && (
                    <div>
                      <p style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", margin: "0 0 3px" }}>Changed by</p>
                      <p style={{ fontSize: "0.8rem", color: "#0f172a", margin: 0 }}>
                        {n.changedBy}
                        {n.changedByRole && <span style={{ fontSize: "0.7rem", color: roleColor, marginLeft: 6 }}>({n.changedByRole})</span>}
                      </p>
                    </div>
                  )}

                  {(n.affectedStaff?.length || 0) > 0 && (
                    <div>
                      <p style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", margin: "0 0 3px" }}>Staff involved</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {n.affectedStaff!.map(s => (
                          <span key={s} style={{ fontSize: "0.72rem", background: "#dbeafe", color: "#1e40af", padding: "1px 7px", borderRadius: 999 }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", margin: "0 0 3px" }}>Exact time</p>
                    <p style={{ fontSize: "0.8rem", color: "#0f172a", margin: 0 }}>
                      {new Date(n.createdAt).toLocaleString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </p>
                  </div>

                  {n.emailSent && (
                    <div>
                      <p style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", margin: "0 0 3px" }}>Email</p>
                      <p style={{ fontSize: "0.8rem", color: "#0ea5e9", margin: 0 }}>
                        ✓ Sent to {n.emailCount} staff member{(n.emailCount || 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}