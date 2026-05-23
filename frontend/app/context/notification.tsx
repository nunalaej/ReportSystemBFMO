// app/context/notification.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type NotificationType =
  | "building" | "concern" | "staff"
  | "status"   | "priority" | "followup" | "general";

export type Notification = {
  id:        string;
  message:   string;
  type:      NotificationType;
  timestamp: Date;
  read:      boolean;
};

type NotificationContextValue = {
  notifications:        Notification[];
  unreadCount:          number;
  addNotification:      (message: string, type?: NotificationType) => void;
  markAsRead:           (id: string) => void;
  markAllAsRead:        () => void;
  clearAll:             () => void;
  notifyAdminAndStaff:  (
    message:  string,
    type:     NotificationType,
    meta?:    NotifyMeta
  ) => Promise<void>;
};

export type NotifyMeta = {
  reportId?:   string;
  reportName?: string;
  triggeredBy?: string;         // e.g. student email
  affectedStaff?: string[];     // staff names to target (optional)
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY = "bfmo_notifications";
const MAX_STORED  = 100;

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

function loadFromStorage(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map(n => ({
      ...n,
      timestamp: new Date(n.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveToStorage(notifications: Notification[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_STORED)));
  } catch {}
}

/* ── Provider ── */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hydrated,      setHydrated]      = useState(false);

  /* Hydrate from localStorage once on mount */
  useEffect(() => {
    setNotifications(loadFromStorage());
    setHydrated(true);
  }, []);

  /* Persist whenever notifications change (skip before hydration) */
  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(notifications);
  }, [notifications, hydrated]);

  /* ── In-app only (sidebar bell) ── */
  const addNotification = useCallback((message: string, type: NotificationType = "general") => {
    const n: Notification = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      type,
      timestamp: new Date(),
      read:      false,
    };
    setNotifications(prev => [n, ...prev].slice(0, MAX_STORED));
  }, []);

  /* ── Persist to DB so Admin + Staff notification pages see it ── */
  const notifyAdminAndStaff = useCallback(async (
    message:  string,
    type:     NotificationType,
    meta:     NotifyMeta = {}
  ) => {
    /* 1 — Add to local bell as well */
    addNotification(message, type);

    /* 2 — POST to the database notifications endpoint */
    try {
      await fetch(`${API_BASE}/api/notifications`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:          `student_${type}`,   // e.g. "student_followup"
          title:         getTitleForType(type),
          message,
          reportId:      meta.reportId,
          taskName:      meta.reportName,
          changedBy:     meta.triggeredBy,
          affectedStaff: meta.affectedStaff ?? [],  // empty = visible to ALL admin+staff
          read:          false,
        }),
      });
    } catch (err) {
      // Non-fatal — in-app bell still worked
      console.warn("[notifyAdminAndStaff] DB persist failed:", err);
    }
  }, [addNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        notifyAdminAndStaff,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

/* ── useNotifications ── throws if used outside provider ── */
export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}

/* ── useNotificationsSafe ── returns null if no provider ── */
export function useNotificationsSafe(): NotificationContextValue | null {
  return useContext(NotificationContext);
}

/* ── Helpers ── */
function getTitleForType(type: NotificationType): string {
  const map: Partial<Record<NotificationType, string>> = {
    followup: "Student Follow-Up",
    status:   "Status Update",
    general:  "Notification",
    staff:    "Staff Notice",
    building: "Building Report",
    concern:  "Concern Raised",
    priority: "Priority Change",
  };
  return map[type] ?? "Notification";
}