// app/context/notification.tsx
"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type NotificationType =
  | "building" | "concern" | "staff" | "status" | "priority"
  | "followup" | "general";

export type Notification = {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  read: boolean;
};

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (message: string, type?: NotificationType) => void;
  // Both naming styles so old callers keep working
  markRead:       (id: string) => void;
  markAsRead:     (id: string) => void;
  markAllRead:    () => void;
  markAllAsRead:  () => void;
  clearAll:       () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((message: string, type: NotificationType = "general") => {
    const n: Notification = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message,
      type,
      timestamp: new Date(),
      read:      false,
    };
    setNotifications(prev => [n, ...prev].slice(0, 100));
  }, []);

  const markRead = useCallback((id: string) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)), []);

  const markAllRead = useCallback(() =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      // canonical names
      markRead,
      markAllRead,
      clearAll,
      // aliases so both naming conventions work
      markAsRead:    markRead,
      markAllAsRead: markAllRead,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

/** Throws if called outside a provider — use in components you know are inside one. */
export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}

/** Returns null instead of throwing — safe for pages that may pre-render outside the provider. */
export function useNotificationsSafe(): NotificationContextValue | null {
  return useContext(NotificationContext);
}