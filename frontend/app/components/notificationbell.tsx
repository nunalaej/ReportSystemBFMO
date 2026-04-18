// app/components/NotificationBell.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import "@/app/style/notification-bell.css";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

/* ── DB notification shape ── */
type DbNotif = {
  _id:            string;
  type:           string;
  title:          string;
  message:        string;
  taskId?:        string;
  taskName?:      string;
  reportId?:      string;
  fromValue?:     string;
  toValue?:       string;
  affectedStaff?: string[];
  read:           boolean;
  createdAt:      string;
};

/* ── Icons ── */
const IconX = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconCheckAll = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 12 9 19 21 7"/>
    <polyline points="3 6 9 13 21 1"/>
  </svg>
);

/* ── Type → color/label mapping ── */
const TYPE_META: Record<string, { color: string; label: string }> = {
  task_status_changed: { color: "#F97316", label: "Status"   },
  task_created:        { color: "#10B981", label: "Created"  },
  task_updated:        { color: "#0EA5E9", label: "Updated"  },
  task_deleted:        { color: "#EF4444", label: "Deleted"  },
  task_assigned:       { color: "#8B5CF6", label: "Assigned" },
  task_escalated:      { color: "#EF4444", label: "⚠️ Urgent" },
  task_completed:      { color: "#10B981", label: "Done"     },
  report_updated:      { color: "#3B82F6", label: "Report"   },
  system:              { color: "#6B7280", label: "System"   },
  // legacy context types
  building:            { color: "#3B82F6", label: "Building" },
  concern:             { color: "#8B5CF6", label: "Concern"  },
  staff:               { color: "#10B981", label: "Staff"    },
  status:              { color: "#F97316", label: "Status"   },
  priority:            { color: "#EF4444", label: "Priority" },
  followup:            { color: "#0EA5E9", label: "Follow-up"},
  general:             { color: "#6B7280", label: "System"   },
};

function getColor(type: string) { return (TYPE_META[type] || TYPE_META.general).color; }
function getLabel(type: string) { return (TYPE_META[type] || TYPE_META.general).label; }

function formatTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ══════════════════════════════════════════════════════════ */
export function NotificationBell() {
  const [isOpen,       setIsOpen]       = useState(false);
  const [notifications, setNotifications] = useState<DbNotif[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* ── Poll backend for unread count (every 30s) ── */
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/notifications?limit=1&skip=0`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.unreadCount !== undefined) setUnreadCount(data.unreadCount);
    } catch {}
  }, []);

  /* ── Fetch recent notifications for dropdown ── */
  const fetchNotifications = useCallback(async () => {
    if (loading) return;
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/api/notifications?limit=15&skip=0`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {}
    finally { setLoading(false); }
  }, [loading]);

  /* Poll unread count every 30 seconds */
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  /* Fetch full list when dropdown opens */
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen]);

  /* Close on outside click */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Mark one as read ── */
  const markAsRead = async (n: DbNotif) => {
    if (n.read) return;
    setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, read: true } : x));
    setUnreadCount(c => Math.max(0, c - 1));
    try { await fetch(`${API_BASE}/api/notifications/${n._id}/read`, { method: "PATCH" }); }
    catch { /* revert */ setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, read: false } : x)); setUnreadCount(c => c + 1); }
  };

  /* ── Mark all as read ── */
  const markAllAsRead = async () => {
    const ids = notifications.filter(n => !n.read).map(n => n._id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try { await fetch(`${API_BASE}/api/notifications/mark-all-read`, { method: "PATCH" }); }
    catch { fetchNotifications(); }
  };

  const hasUnread = unreadCount > 0;

  return (
    <div className="nb-root" ref={ref}>

      {/* ── Bell button ── */}
      <button
        type="button"
        className={`nb-bell-btn${hasUnread ? " nb-bell-btn--active" : ""}`}
        onClick={() => setIsOpen(v => !v)}
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
      >
        <label className="nb-container" onClick={e => e.preventDefault()}>
          <input type="checkbox" readOnly checked={hasUnread}/>
          <svg fill="currentColor" viewBox="0 0 448 512" className="bell-regular">
            <path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"/>
          </svg>
          <svg fill="currentColor" viewBox="0 0 448 512" className="bell-solid">
            <path d="M224 0c-17.7 0-32 14.3-32 32V51.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.9 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z"/>
          </svg>
        </label>
        {hasUnread && (
          <span className="nb-badge" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {isOpen && (
        <div className="nb-dropdown" role="dialog" aria-label="Notifications panel">

          {/* Header */}
          <div className="nb-header">
            <div className="nb-header-left">
              <h3 className="nb-title">Notifications</h3>
              {hasUnread && <span className="nb-subtitle">{unreadCount} unread</span>}
            </div>
            <div className="nb-header-actions">
              {hasUnread && (
                <button type="button" className="nb-action-btn nb-action-btn--blue"
                  onClick={markAllAsRead} title="Mark all as read">
                  <IconCheckAll/>
                </button>
              )}
              <button type="button" className="nb-action-btn nb-action-btn--gray"
                onClick={() => setIsOpen(false)} title="Close">
                <IconX/>
              </button>
            </div>
          </div>

          {/* List */}
          <div className="nb-list" role="list">
            {loading && notifications.length === 0 ? (
              <div className="nb-empty">
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {[...Array(3)].map((_,i) => (
                    <div key={i} style={{
                      height: 52, borderRadius: 8,
                      background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.4s infinite",
                    }}/>
                  ))}
                </div>
                <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
              </div>
            ) : notifications.length === 0 ? (
              <div className="nb-empty">
                <svg viewBox="0 0 448 512" width="36" height="36" fill="currentColor" opacity="0.2">
                  <path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"/>
                </svg>
                <p>All caught up</p>
                <span>Task and report activity will appear here</span>
              </div>
            ) : (
              notifications.map(n => {
                const color = getColor(n.type);
                return (
                  <div
                    key={n._id}
                    role="listitem"
                    className={`nb-item${!n.read ? " nb-item--unread" : ""}`}
                    onClick={() => markAsRead(n)}
                  >
                    <div className="nb-item-stripe" style={{ backgroundColor: color }}/>
                    <div className="nb-item-body">
                      <div className="nb-item-top">
                        <span className="nb-type-badge" style={{ backgroundColor: color + "20", color }}>
                          {getLabel(n.type)}
                        </span>
                        {!n.read && <span className="nb-dot" style={{ backgroundColor: color }}/>}
                        <span className="nb-time">{formatTime(n.createdAt)}</span>
                      </div>
                      {/* Show task name if available */}
                      {n.taskName && (
                        <p style={{ fontSize:"0.68rem", color:"#9ca3af", margin:"0 0 2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {n.taskName}
                        </p>
                      )}
                      <p className="nb-msg">{n.message}</p>
                      {/* From→To pill for status changes */}
                      {n.fromValue && n.toValue && (
                        <span style={{
                          display:"inline-block", marginTop:3,
                          fontSize:"0.62rem", fontWeight:700,
                          color, background: color+"18",
                          padding:"1px 7px", borderRadius:999,
                        }}>
                          {n.fromValue} → {n.toValue}
                        </span>
                      )}
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        className="nb-read-btn"
                        title="Mark as read"
                        onClick={e => { e.stopPropagation(); markAsRead(n); }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="nb-footer">
              <span className="nb-footer-count">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}