// app/Staff/hooks/useStaffPerms.ts
// Shared hook: loads position permissions from DB + staff record

import { useState, useEffect, useCallback, useMemo } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

export type Perms = {
  canCreate:        boolean; // Create tasks
  canEdit:          boolean; // Edit tasks
  canAssign:        boolean; // Assign staff
  canStatus:        boolean; // Update status
  canComment:       boolean; // Comment
  canDeleteTasks:   boolean; // Delete tasks
  canViewReports:   boolean; // View reports
  canArchive:       boolean; // Archive report (maps to "Update status" or explicit)
  canUpdateReport:  boolean; // Update report status
  isViewOnly:       boolean; // View only — no mutations at all
};

export const EMPTY_PERMS: Perms = {
  canCreate: false, canEdit: false, canAssign: false,
  canStatus: false, canComment: false, canDeleteTasks: false,
  canViewReports: false, canArchive: false, canUpdateReport: false,
  isViewOnly: true,
};

export function buildPerms(permList: string[]): Perms {
  const set = new Set(permList.map(p => p.toLowerCase().trim()));
  const viewOnly = set.has("view only") && permList.length === 1;
  return {
    canCreate:       set.has("create tasks"),
    canEdit:         set.has("edit tasks"),
    canAssign:       set.has("assign staff"),
    canStatus:       set.has("update status"),
    canComment:      set.has("comment"),
    canDeleteTasks:  set.has("delete tasks"),
    canViewReports:  set.has("view reports") || set.has("view only") || set.has("update status") || set.has("comment"),
    canArchive:      set.has("update status"), // archive = status change
    canUpdateReport: set.has("update status"),
    isViewOnly:      viewOnly,
  };
}

export type StaffRecord = {
  _id: string;
  name: string;
  email: string;
  disciplines: string[];
  position: string;
  clerkId?: string;
};

export function useStaffPerms(clerkUserId?: string) {
  const [staffRecord,   setStaffRecord]   = useState<StaffRecord | null>(null);
  const [positionPerms, setPositionPerms] = useState<Record<string, string[]>>({});
  const [loaded,        setLoaded]        = useState(false);

  const fetchAll = useCallback(async () => {
    if (!clerkUserId) return;
    try {
      const [staffRes, metaRes] = await Promise.all([
        fetch(`${API_BASE}/api/staff/by-clerk/${clerkUserId}`, { cache: "no-store" }),
        fetch(`${API_BASE}/api/meta?ts=${Date.now()}`,         { cache: "no-store" }),
      ]);
      const [staffData, metaData] = await Promise.all([
        staffRes.json().catch(() => null),
        metaRes.json().catch(() => null),
      ]);
      if (staffData?.staff) setStaffRecord(staffData.staff);
      if (metaData?.positionPerms && typeof metaData.positionPerms === "object") {
        setPositionPerms(metaData.positionPerms);
      }
    } catch {}
    finally { setLoaded(true); }
  }, [clerkUserId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const perms: Perms = useMemo(() => {
    if (!loaded || !staffRecord?.position) return EMPTY_PERMS;
    const pos = staffRecord.position;
    const permList =
      positionPerms[pos] ??
      Object.entries(positionPerms).find(
        ([k]) => k.toLowerCase() === pos.toLowerCase()
      )?.[1] ??
      [];
    return buildPerms(permList);
  }, [positionPerms, staffRecord, loaded]);

  const getRoleBadgeStyle = () => {
    const pos = (staffRecord?.position || "").toLowerCase();
    if (pos.includes("head"))       return { bg: "#fef3c7", color: "#92400e" };
    if (pos.includes("staff"))      return { bg: "#dbeafe", color: "#1e40af" };
    if (pos.includes("super"))      return { bg: "#f3e8ff", color: "#6b21a8" };
    if (pos.includes("technician")) return { bg: "#dcfce7", color: "#166534" };
    return { bg: "#f1f5f9", color: "#475569" };
  };

  const permSummary = () => {
    if (!loaded) return "Loading permissions…";
    const pos = staffRecord?.position || "";
    const list = positionPerms[pos] ??
      Object.entries(positionPerms).find(([k]) => k.toLowerCase() === pos.toLowerCase())?.[1] ?? [];
    if (!list.length) return "View only";
    return list.join(" · ");
  };

  return {
    staffRecord,
    perms,
    loaded,
    positionPerms,
    getRoleBadgeStyle,
    permSummary,
    refetch: fetchAll,
  };
}