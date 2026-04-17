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
  notifications:   Notification[];
  unreadCount:     number;
  addNotification: (message: string, type?: NotificationType) => void;
  markAsRead:      (id: string) => void;
  markAllAsRead:   () => void;
  clearAll:        () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY = "bfmo_notifications";
const MAX_STORED  = 100;

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

  // Hydrate from localStorage once on mount
  useEffect(() => {
    setNotifications(loadFromStorage());
    setHydrated(true);
  }, []);

  // Persist whenever notifications change (skip before hydration)
  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(notifications);
  }, [notifications, hydrated]);

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
      value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

/* ── useNotifications — throws if used outside provider (for pages that require it) ── */
export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}

/* ── useNotificationsSafe — returns null if no provider (for optional components like the bell) ── */
export function useNotificationsSafe(): NotificationContextValue | null {
  return useContext(NotificationContext);
}