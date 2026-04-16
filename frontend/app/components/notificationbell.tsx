// app/components/NotificationBell.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useNotificationsSafe } from "@/app/context/notification";
import "@/app/style/notification-bell.css";

/* ── Icons ── */
const IconX = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconCheck = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconCheckAll = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 12 9 19 21 7"/>
    <polyline points="3 6 9 13 21 1"/>
  </svg>
);

/* ── Type styles ── */
const TYPE_META: Record<string, { color: string; label: string }> = {
  building: { color: "#3B82F6", label: "Building"  },
  concern:  { color: "#8B5CF6", label: "Concern"   },
  staff:    { color: "#10B981", label: "Staff"     },
  status:   { color: "#F97316", label: "Status"    },
  priority: { color: "#EF4444", label: "Priority"  },
  followup: { color: "#0EA5E9", label: "Follow-up" },
  general:  { color: "#6B7280", label: "System"    },
};

function getColor(type: string)  { return (TYPE_META[type] || TYPE_META.general).color; }
function getLabel(type: string)  { return (TYPE_META[type] || TYPE_META.general).label; }

function formatTime(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ══════════════════════════════════════════════════════════ */
export function NotificationBell() {
  const ctx = useNotificationsSafe();  // safe — never throws
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  // If there's no provider in the tree, render a disabled bell
  if (!ctx) {
    return (
      <div className="nb-root">
        <button className="nb-bell-btn" disabled aria-label="Notifications" type="button">
          <span className="nb-bell-icon nb-bell-icon--outline"/>
        </button>
      </div>
    );
  }

  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = ctx;
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

          {/* Outline bell */}
          <svg fill="currentColor" viewBox="0 0 448 512" className="bell-regular">
            <path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"/>
          </svg>

          {/* Solid bell (shown when unread) */}
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
              {notifications.length > 0 && (
                <button type="button" className="nb-action-btn nb-action-btn--gray"
                  onClick={() => { clearAll(); setIsOpen(false); }} title="Clear all">
                  <IconX size={15}/>
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
            {notifications.length === 0 ? (
              <div className="nb-empty">
                <svg viewBox="0 0 448 512" width="36" height="36" fill="currentColor" opacity="0.2">
                  <path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"/>
                </svg>
                <p>All caught up</p>
                <span>New notifications will appear here</span>
              </div>
            ) : (
              notifications.map(n => {
                const color = getColor(n.type);
                return (
                  <div
                    key={n.id}
                    role="listitem"
                    className={`nb-item${!n.read ? " nb-item--unread" : ""}`}
                    onClick={() => markAsRead(n.id)}
                  >
                    {/* Left color stripe */}
                    <div className="nb-item-stripe" style={{ backgroundColor: color }}/>

                    <div className="nb-item-body">
                      <div className="nb-item-top">
                        <span className="nb-type-badge" style={{ backgroundColor: color + "20", color }}>
                          {getLabel(n.type)}
                        </span>
                        {!n.read && <span className="nb-dot" style={{ backgroundColor: color }}/>}
                        <span className="nb-time">{formatTime(n.timestamp)}</span>
                      </div>
                      <p className="nb-msg">{n.message}</p>
                    </div>

                    {!n.read && (
                      <button
                        type="button"
                        className="nb-read-btn"
                        title="Mark as read"
                        onClick={e => { e.stopPropagation(); markAsRead(n.id); }}
                      >
                        <IconCheck/>
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
              <span className="nb-footer-count">{notifications.length} notification{notifications.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}