// app/Staff/Notification/page.tsx
"use client";

import { useNotifications } from "@/app/context/notification";

const TYPE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  building: { bg: "#dbeafe", color: "#1e40af", label: "Building"  },
  concern:  { bg: "#f3e8ff", color: "#6b21a8", label: "Concern"   },
  staff:    { bg: "#dcfce7", color: "#166534", label: "Staff"     },
  status:   { bg: "#fef3c7", color: "#92400e", label: "Status"    },
  priority: { bg: "#fee2e2", color: "#991b1b", label: "Priority"  },
  followup: { bg: "#e0f2fe", color: "#0369a1", label: "Follow-up" },
  general:  { bg: "#f1f5f9", color: "#334155", label: "System"    },
};

function getRelativeTime(d: Date) {
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StaffNotificationPage() {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>
            Notifications
            {unreadCount > 0 && (
              <span style={{ marginLeft: 10, background: "#ef4444", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                {unreadCount}
              </span>
            )}
          </h1>
          <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: "4px 0 0" }}>
            {notifications.length} total · {unreadCount} unread
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: "#374151" }}>
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: "#dc2626" }}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#d1d5db" }}>
          <svg viewBox="0 0 64 64" fill="none" width="52" height="52" style={{ margin: "0 auto 12px", display: "block" }}>
            <path d="M32 6C19.85 6 10 15.85 10 28v8L6 42v4h52v-4l-4-6v-8C54 15.85 44.15 6 32 6z" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
            <path d="M26 46c0 3.31 2.69 6 6 6s6-2.69 6-6" stroke="currentColor" strokeWidth="2" opacity="0.15"/>
          </svg>
          <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#9ca3af", margin: 0 }}>No notifications yet</p>
          <span style={{ fontSize: "0.78rem", color: "#d1d5db" }}>Task assignments and updates will appear here</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notifications.map(n => {
          const style = TYPE_COLORS[n.type] || TYPE_COLORS.general;
          return (
            <div key={n.id} onClick={() => markRead(n.id)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 16px",
                background: n.read ? "#fff" : "#f0f9ff",
                border: `1.5px solid ${n.read ? "#e5e7eb" : "#bae6fd"}`,
                borderRadius: 12, cursor: "pointer",
                transition: "background 0.15s, border-color 0.15s",
                boxShadow: n.read ? "none" : "0 2px 8px rgba(14,165,233,0.08)",
              }}>
              <span style={{ flexShrink: 0, padding: "3px 10px", borderRadius: 999, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", backgroundColor: style.bg, color: style.color, marginTop: 2 }}>
                {style.label}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "0.84rem", color: "#0f172a", margin: "0 0 4px", lineHeight: 1.45, fontWeight: n.read ? 400 : 600 }}>
                  {n.message}
                </p>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{getRelativeTime(n.timestamp)}</span>
              </div>
              {!n.read && (
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", flexShrink: 0, marginTop: 5 }}/>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}