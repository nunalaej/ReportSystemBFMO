"use client";

import "@/app/style/notif.css";

import React, { useState, useMemo } from "react";
import { useNotifications, Notification } from "../context/notification";

/* ── Type meta ── */
interface TypeMetaItem {
  label: string;
  icon: React.ReactNode;
  accent: string;
}

const TYPE_META: Record<Notification["type"], TypeMetaItem> = {
  building: {
    label: "Building",
    accent: "#3b82f6",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  concern: {
    label: "Concern",
    accent: "#f59e0b",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  staff: {
    label: "Staff",
    accent: "#8b5cf6",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  status: {
    label: "Status",
    accent: "#10b981",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  priority: {
    label: "Priority",
    accent: "#ef4444",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
};

/* ── Relative time ── */
function relativeTime(date: string | Date): string {
  const diff: number = Date.now() - new Date(date).getTime();
  if (diff < 0) return "just now";
  const m: number = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h: number = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d: number = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ── Filter tabs ── */
type FilterTab = "all" | Notification["type"];

interface FilterTabItem {
  key: FilterTab;
  label: string;
}

const FILTER_TABS: FilterTabItem[] = [
  { key: "all",      label: "All" },
  { key: "building", label: "Building" },
  { key: "concern",  label: "Concern" },
  { key: "staff",    label: "Staff" },
  { key: "status",   label: "Status" },
  { key: "priority", label: "Priority" },
];

/* ══════════════════════════════════════════════════════════ */
export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, clearAll, unreadCount } =
    useNotifications();

  const [activeTab,   setActiveTab]   = useState<FilterTab>("all");
  const [showUnread,  setShowUnread]  = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  /* ── Filtered list ── */
  const filtered: Notification[] = useMemo(() => {
    let list: Notification[] = notifications;
    if (activeTab !== "all")   list = list.filter(n => n.type === activeTab);
    if (showUnread)            list = list.filter(n => !n.read);
    return list;
  }, [notifications, activeTab, showUnread]);

  /* ── Count per tab ── */
  const countFor = (key: FilterTab): number => {
    if (key === "all") return notifications.length;
    return notifications.filter((n: { type: any; }) => n.type === key).length;
  };

  const unreadFor = (key: FilterTab): number => {
    if (key === "all") return unreadCount;
    return notifications.filter((n: { type: any; read: boolean }) => n.type === key && !n.read).length;
  };

  /* ── Animate-out then mark read on click ── */
  const handleClick = (n: Notification): void => {
    if (!n.read) markAsRead(n.id);
  };

  const handleDelete = (id: string): void => {
    setDeletingId(id);
    // The CSS animation plays; after 300ms we can ignore (clearAll/filter handles real removal)
    setTimeout(() => setDeletingId(null), 300);
  };

  /* ══════════════════════════════════════════════════════════ */
  return (
    <div className="notif-wrapper">

      {/* ── Noise grain overlay ── */}
      <div className="notif-grain" aria-hidden="true" />

      {/* ── Header ── */}
      <header className="notif-header">
        <div className="notif-header-left">
          <div className="notif-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="notif-header-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
            )}
          </div>
          <div>
            <h1 className="notif-title">Notifications</h1>
            <p className="notif-subtitle">
              {unreadCount > 0
                ? `${unreadCount} unread message${unreadCount !== 1 ? "s" : ""}`
                : "You're all caught up"}
            </p>
          </div>
        </div>

        <div className="notif-header-actions">
          <button
            type="button"
            className={`notif-pill-btn${showUnread ? " notif-pill-btn--active" : ""}`}
            onClick={() => setShowUnread(v => !v)}
          >
            <span className={`notif-pill-dot${showUnread ? " notif-pill-dot--on" : ""}`} />
            Unread only
          </button>

          {unreadCount > 0 && (
            <button type="button" className="notif-ghost-btn" onClick={markAllAsRead}>
              Mark all read
            </button>
          )}

          {notifications.length > 0 && (
            <button type="button" className="notif-ghost-btn notif-ghost-btn--danger" onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
      </header>

      {/* ── Filter tabs ── */}
      <nav className="notif-tabs" aria-label="Filter notifications">
        {FILTER_TABS.map((tab: FilterTabItem) => {
          const total: number  = countFor(tab.key);
          const unread: number = unreadFor(tab.key);
          const accent: string = tab.key !== "all" ? TYPE_META[tab.key as Notification["type"]].accent : "#6366f1";
          return (
            <button
              key={tab.key}
              type="button"
              className={`notif-tab${activeTab === tab.key ? " notif-tab--active" : ""}`}
              style={activeTab === tab.key ? { "--tab-accent": accent } as React.CSSProperties : {}}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.key !== "all" && (
                <span
                  className="notif-tab-dot"
                  style={{ backgroundColor: TYPE_META[tab.key as Notification["type"]].accent }}
                />
              )}
              {tab.label}
              {total > 0 && (
                <span
                  className={`notif-tab-count${unread > 0 ? " notif-tab-count--unread" : ""}`}
                  style={unread > 0 ? { backgroundColor: accent + "22", color: accent } : {}}
                >
                  {total}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── List ── */}
      <main className="notif-list-wrap">
        {filtered.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            </div>
            <p className="notif-empty-title">
              {showUnread ? "No unread notifications" : "Nothing here yet"}
            </p>
            <p className="notif-empty-sub">
              {showUnread
                ? "Toggle off Unread only to see everything."
                : "Notifications from facility reports will appear here."}
            </p>
          </div>
        ) : (
          <ul className="notif-list" role="list">
            {filtered.map((n: Notification, idx: number): React.ReactNode => {
              const meta: TypeMetaItem = TYPE_META[n.type];
              const isNew: boolean     = !n.read;
              const leaving: boolean   = deletingId === n.id;
              return (
                <li
                  key={n.id}
                  className={[
                    "notif-item",
                    isNew   ? "notif-item--unread"  : "",
                    leaving ? "notif-item--leaving" : "",
                  ].join(" ")}
                  style={{ "--item-accent": meta.accent, "--item-delay": `${idx * 30}ms` } as React.CSSProperties}
                  onClick={() => handleClick(n)}
                >
                  {/* Unread indicator bar */}
                  <span className="notif-item-bar" style={{ backgroundColor: isNew ? meta.accent : "transparent" }} />

                  {/* Icon */}
                  <span
                    className="notif-item-icon"
                    style={{
                      color:           meta.accent,
                      backgroundColor: meta.accent + "15",
                      border:          `1px solid ${meta.accent}30`,
                    }}
                  >
                    {meta.icon}
                  </span>

                  {/* Content */}
                  <div className="notif-item-body">
                    <div className="notif-item-top">
                      <span
                        className="notif-item-type"
                        style={{ color: meta.accent, backgroundColor: meta.accent + "12" }}
                      >
                        {meta.label}
                      </span>
                      {isNew && <span className="notif-item-new-dot" style={{ backgroundColor: meta.accent }} />}
                    </div>
                    <p className="notif-item-message">{n.message}</p>
                    <span className="notif-item-time">{relativeTime(n.timestamp)}</span>
                  </div>

                  {/* Actions */}
                  <div className="notif-item-actions" onClick={e => e.stopPropagation()}>
                    {isNew && (
                      <button
                        type="button"
                        className="notif-action-btn"
                        title="Mark as read"
                        onClick={() => markAsRead(n.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* ── Footer summary ── */}
      {notifications.length > 0 && (
        <footer className="notif-footer">
          <span>{notifications.length} total · {unreadCount} unread</span>
          <span className="notif-footer-dot" />
          <span>
            {notifications.length - unreadCount} read
          </span>
        </footer>
      )}
    </div>
  );
}