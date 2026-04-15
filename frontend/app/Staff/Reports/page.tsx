"use client";

import "@/app/Admin/style/reports.css";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";

const defaultImg = "/default.jpg";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";

type Comment = {
  text?: string;
  comment?: string;
  at?: string;
  by?: string;
  imageUrl?: string;
};

type Report = {
  _id: string;
  reportId?: string;
  email?: string;
  userType?: string;
  heading?: string;
  description?: string;
  concern?: string;
  subConcern?: string;
  otherConcern?: string;
  building?: string;
  otherBuilding?: string;
  college?: string;
  floor?: string;
  room?: string;
  otherRoom?: string;
  image?: string;
  ImageFile?: string;
  status?: string;
  createdAt?: string;
  comments?: Comment[];
};

const formatConcern = (report: Report) => {
  const base = report.concern || "Unspecified";
  const sub = report.subConcern || report.otherConcern;
  return sub ? `${base} : ${sub}` : base;
};

const getBaseConcernFromReport = (r: Report) => {
  const base = (r.concern || "Unspecified").trim();
  return base || "Unspecified";
};

const formatBuilding = (report: Report) => {
  const rawBuilding = report.building || "Unspecified";
  const isOther = rawBuilding && rawBuilding.toLowerCase() === "other";
  const buildingLabel =
    isOther && report.otherBuilding ? report.otherBuilding : rawBuilding;
  const roomOrSpot = report.room || report.otherRoom;
  return roomOrSpot ? `${buildingLabel} : ${roomOrSpot}` : buildingLabel;
};

function getRelativeTime(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  let diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) diffMs = 0;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}

const getStatusClassKey = (statusRaw?: string) => {
  const status = statusRaw || "Pending";
  if (status === "Waiting for Materials") return "waiting";
  if (status === "In Progress") return "inprogress";
  if (status === "Resolved") return "completed";
  if (status === "Archived") return "archived";
  return "pending";
};

const statusMatchesFilter = (
  reportStatus: string | undefined,
  filter: string
) => {
  const currentStatus = reportStatus || "Pending";
  if (filter === "Archived") return currentStatus === "Archived";
  if (filter === "Resolved") return currentStatus === "Resolved";
  if (filter === "All Statuses") {
    return currentStatus !== "Archived" && currentStatus !== "Resolved";
  }
  return currentStatus === filter;
};

const REPORTS_PER_PAGE = 12;

const getGroupKey = (r: Report) => {
  const building = (r.building || "").trim();
  const concern = (r.concern || "").trim();
  const subConcern = (r.subConcern || r.otherConcern || "").trim();
  const room = (r.room || r.otherRoom || "").trim();
  if (room) return `${building}|${concern}|${subConcern}|${room}`;
  return `${building}|${concern}|${subConcern}`;
};

const resolveImageFile = (raw?: string) => {
  if (!raw) return defaultImg;
  const src = raw.trim();
  if (!src) return defaultImg;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (CLOUDINARY_CLOUD_NAME) {
    const publicId = src.replace(/^\/+/, "");
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}`;
  }
  if (!API_BASE) return defaultImg;
  if (src.startsWith("/")) return `${API_BASE}${src}`;
  return `${API_BASE}/${src}`;
};

// ── Toast notification system ──────────────────────────────────────────────
type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType };

let toastId = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  return { toasts, show, dismiss };
}

// ── Keyboard shortcut: Escape closes modal ─────────────────────────────────
function useEscapeKey(handler: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handler, active]);
}

export default function ReportPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const firstName = user?.firstName || "";

  const [canView, setCanView] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [buildingFilter, setBuildingFilter] = useState("All Buildings");
  const [concernFilter, setConcernFilter] = useState("All Concerns");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("All");

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [statusValue, setStatusValue] = useState("Pending");
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  // Confirmation dialog state
const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    open: false,
    message: "",
    onConfirm: () => {},
  });

  const { toasts, show: showToast, dismiss: dismissToast } = useToast();

  // ── Portal mount safety (SSR) ─────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Cleanup on unmount (fixes "modal persists after navigation") ──────────
  useEffect(() => {
    return () => {
      setSelectedReport(null);
      setStatusValue("Pending");
      setCommentText("");
      setEditingIndex(null);
      setEditingText("");
      setIsImageExpanded(false);
    };
  }, []);

  // ── Lock body scroll when modal is open ──────────────────────────────────
  useEffect(() => {
    if (selectedReport) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [selectedReport]);

  // ── Escape key closes modal ───────────────────────────────────────────────
  useEscapeKey(
    useCallback(() => {
      if (isImageExpanded) { setIsImageExpanded(false); return; }
      if (selectedReport) closeDetails();
    }, [isImageExpanded, selectedReport]),
    !!(selectedReport || isImageExpanded)
  );

  /* AUTH GUARD */
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { router.replace("/"); return; }
    const rawRole = (user.publicMetadata as any)?.role;
    let role = "student";
    if (Array.isArray(rawRole) && rawRole.length > 0) {
      role = String(rawRole[0]).toLowerCase();
    } else if (typeof rawRole === "string") {
      role = rawRole.toLowerCase();
    }
    if (role !== "staff") { router.replace("/Student"); return; }
    setCanView(true);
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (!canView) return;
    fetchReports();
  }, [canView]);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      setLoadError("");
      const res = await fetch(`${API_BASE}/api/reports`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setLoadError(data?.message || "Could not load reports. Check the server response.");
        setReports([]);
        return;
      }
      let list: Report[] = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.reports)) list = data.reports;
      else if (Array.isArray(data.data)) list = data.data;
      else {
        setLoadError("Could not load reports. Check the server response.");
        setReports([]);
        return;
      }
      setReports(list);
      setCurrentPage(1);
    } catch (err) {
      console.error("Error fetching reports:", err);
      setLoadError("Network error while loading reports.");
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  /* DUPLICATES */
  const getDuplicateCounts = (reportsArr: Report[]) => {
    const counts: Record<string, number> = {};
    reportsArr.forEach((report) => {
      const key = getGroupKey(report);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  };

  const duplicateCounts = getDuplicateCounts(reports);

  const filterUniqueReports = (reportsArr: Report[]) => {
    const seen = new Set<string>();
    return reportsArr.filter((report) => {
      const key = getGroupKey(report);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const reportsToDisplay = showDuplicates ? reports : filterUniqueReports(reports);
  const getReportsByGroup = (groupKey: string) =>
    reports.filter((r) => getGroupKey(r) === groupKey);

  /* FILTER OPTIONS */
  const buildingOptions = [
    "All Buildings",
    ...new Set(
      reports
        .filter((r) =>
          (concernFilter === "All Concerns" || r.concern === concernFilter) &&
          (collegeFilter === "All Colleges" || (r.college || "Unspecified") === collegeFilter) &&
          statusMatchesFilter(r.status, statusFilter)
        )
        .map((r) => r.building)
        .filter((v): v is string => Boolean(v))
    ),
  ];

  const concernOptions = [
    "All Concerns",
    ...new Set(
      reports
        .filter((r) =>
          (buildingFilter === "All Buildings" || r.building === buildingFilter) &&
          (collegeFilter === "All Colleges" || (r.college || "Unspecified") === collegeFilter) &&
          statusMatchesFilter(r.status, statusFilter)
        )
        .map((r) => r.concern)
        .filter((v): v is string => Boolean(v))
    ),
  ];

  const collegeOptions = [
    "All Colleges",
    ...new Set(
      reports
        .filter((r) =>
          (buildingFilter === "All Buildings" || r.building === buildingFilter) &&
          (concernFilter === "All Concerns" || r.concern === concernFilter) &&
          statusMatchesFilter(r.status, statusFilter)
        )
        .map((r) => r.college || "Unspecified")
    ),
  ];

  const statusOptions = [
    "All Statuses", "Pending", "Waiting for Materials",
    "In Progress", "Resolved", "Archived",
  ];

  /* KEEP FILTERS VALID */
  useEffect(() => {
    const validConcerns = new Set(
      reports
        .filter((r) =>
          (buildingFilter === "All Buildings" || r.building === buildingFilter) &&
          (collegeFilter === "All Colleges" || (r.college || "Unspecified") === collegeFilter) &&
          statusMatchesFilter(r.status, statusFilter)
        )
        .map((r) => r.concern)
    );
    if (concernFilter !== "All Concerns" && !validConcerns.has(concernFilter)) {
      setConcernFilter("All Concerns");
    }
  }, [buildingFilter, collegeFilter, statusFilter, reports, concernFilter]);

  useEffect(() => {
    const validBuildings = new Set(
      reports
        .filter((r) =>
          (concernFilter === "All Concerns" || r.concern === concernFilter) &&
          (collegeFilter === "All Colleges" || (r.college || "Unspecified") === collegeFilter) &&
          statusMatchesFilter(r.status, statusFilter)
        )
        .map((r) => r.building)
    );
    if (buildingFilter !== "All Buildings" && !validBuildings.has(buildingFilter)) {
      setBuildingFilter("All Buildings");
    }
  }, [concernFilter, collegeFilter, statusFilter, reports, buildingFilter]);

  /* FILTERED REPORTS */
  const filteredReports = reportsToDisplay.filter((report) => {
    const buildingMatch = buildingFilter === "All Buildings" || report.building === buildingFilter;
    const concernMatch = concernFilter === "All Concerns" || report.concern === concernFilter;
    const collegeMatch = collegeFilter === "All Colleges" || (report.college || "Unspecified") === collegeFilter;
    const statusMatch = statusMatchesFilter(report.status, statusFilter);
    const searchMatch =
      !searchQuery.trim() ||
      (report.reportId || "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      (report.heading || "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      (report.description || "").toLowerCase().includes(searchQuery.trim().toLowerCase());
    const userTypeMatch = userTypeFilter === "All" || (report.userType || "") === userTypeFilter;
    return buildingMatch && concernMatch && collegeMatch && statusMatch && searchMatch && userTypeMatch;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [buildingFilter, concernFilter, collegeFilter, statusFilter, showDuplicates, searchQuery, userTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / REPORTS_PER_PAGE));
  const startIndex = (currentPage - 1) * REPORTS_PER_PAGE;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + REPORTS_PER_PAGE);

  // ── Quick stats for header ────────────────────────────────────────────────
  const stats = {
    total: filteredReports.length,
    pending: filteredReports.filter((r) => (r.status || "Pending") === "Pending").length,
    inProgress: filteredReports.filter((r) => r.status === "In Progress" || r.status === "Waiting for Materials").length,
    resolved: filteredReports.filter((r) => r.status === "Resolved").length,
  };

  /* CARD & MODAL HANDLERS */
  const handleCardClick = (report: Report) => {
    setSelectedReport(report);
    setStatusValue(report.status || "Pending");
    setCommentText("");
    setEditingIndex(null);
    setEditingText("");
    setIsImageExpanded(false);
  };

  const closeDetails = useCallback(() => {
    setSelectedReport(null);
    setStatusValue("Pending");
    setCommentText("");
    setEditingIndex(null);
    setEditingText("");
    setIsImageExpanded(false);
  }, []);

  const handleClearFilters = () => {
    setBuildingFilter("All Buildings");
    setConcernFilter("All Concerns");
    setCollegeFilter("All Colleges");
    setStatusFilter("All Statuses");
    setShowDuplicates(false);
    setCurrentPage(1);
    setSearchQuery("");
    setUserTypeFilter("All");
  };

const showConfirm = (
  message: string,
  onConfirm: () => void | Promise<void>
) => {
  setConfirmDialog({ open: true, message, onConfirm });
};
  const syncComments = async (updatedComments: Comment[]) => {
    if (!selectedReport) return;
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE}/api/reports/${selectedReport._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selectedReport.status || "Pending",
          comments: updatedComments,
          overwriteComments: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to update comments");
      const updated = data.report as Report;
      setReports((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
      setSelectedReport(updated);
      setEditingIndex(null);
      setEditingText("");
      showToast("Comment updated.", "success");
    } catch (err: any) {
      showToast(err.message || "There was a problem updating the comments.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedReport) return;
    try {
      setSaving(true);
      const trimmedComment = commentText.trim();
      const groupKey = getGroupKey(selectedReport);
      const groupReports = reports.filter((r) => getGroupKey(r) === groupKey);

      const updatedReports = await Promise.all(
        groupReports.map(async (r) => {
          const body: Record<string, any> = {
            status: statusValue,
            ...(trimmedComment ? { comment: trimmedComment } : {}),
          };
          const res = await fetch(`${API_BASE}/api/reports/${r._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to update report");
          return data.report as Report;
        })
      );

      if (trimmedComment) {
        const commentRes = await fetch(
          `${API_BASE}/api/reports/${selectedReport._id}/comments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: trimmedComment, by: "BFMO Staff", skipEmail: true }),
          }
        );
        const commentData = await commentRes.json().catch(() => null);
        if (commentRes.ok && commentData?.success) {
          const updatedWithComment = commentData.report as Report;
          const idx = updatedReports.findIndex((u) => u._id === selectedReport._id);
          if (idx !== -1) updatedReports[idx] = updatedWithComment;
        }
      }

      setReports((prev) =>
        prev.map((r) => {
          const match = updatedReports.find((u) => u._id === r._id);
          return match || r;
        })
      );

      const updatedSelected =
        updatedReports.find((u) => u._id === selectedReport._id) || updatedReports[0];

      setSelectedReport(updatedSelected);
      setStatusValue(updatedSelected.status || "Pending");
      setCommentText("");
      showToast(`Status updated to "${statusValue}" — email sent success`, "success");
    } catch (err: any) {
      showToast(err.message || "There was a problem saving the changes.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedReport) return;
    showConfirm("Archive this report? This will notify the reporter.", async () => {
      try {
        setSaving(true);
        const groupKey = getGroupKey(selectedReport);
        const groupReports = reports.filter((r) => getGroupKey(r) === groupKey);

        const updatedReports = await Promise.all(
          groupReports.map(async (r) => {
            const res = await fetch(`${API_BASE}/api/reports/${r._id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "Archived", sendEmail: true }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to archive report");
            return data.report as Report;
          })
        );

        setReports((prev) =>
          prev.map((r) => {
            const match = updatedReports.find((u) => u._id === r._id);
            return match || r;
          })
        );

        const updatedSelected =
          updatedReports.find((u) => u._id === selectedReport._id) || updatedReports[0];

        setSelectedReport(updatedSelected);
        setStatusValue("Archived");
        showToast(`Report archived — email sent success`, "success");
      } catch (err: any) {
        showToast("There was a problem archiving the report(s).", "error");
      } finally {
        setSaving(false);
      }
    });
  };

  const renderStatusPill = (statusRaw?: string) => {
    const classKey = getStatusClassKey(statusRaw);
    const status = statusRaw || "Pending";
    return <span className={`status-pill status-${classKey}`}>{status}</span>;
  };

  const startEditComment = (index: number) => {
    if (!selectedReport?.comments) return;
    const c = selectedReport.comments[index];
    if (!c) return;
    setEditingIndex(index);
    setEditingText(c.text || c.comment || "");
  };

  const cancelEditComment = () => {
    setEditingIndex(null);
    setEditingText("");
  };

  const saveEditedComment = async (index: number) => {
    if (!selectedReport || !selectedReport.comments) return;
    const trimmed = editingText.trim();
    if (!trimmed) { showToast("Comment cannot be empty.", "error"); return; }
    const updatedComments = selectedReport.comments.map((c, i) => {
      if (i !== index) return c;
      return { ...c, text: trimmed, comment: trimmed, at: new Date().toISOString() };
    });
    await syncComments(updatedComments);
  };

  const deleteComment = async (index: number) => {
    if (!selectedReport || !selectedReport.comments) return;
    showConfirm("Delete this comment?", async () => {
      const updatedComments = selectedReport.comments!.filter((_c, i) => i !== index);
      await syncComments(updatedComments);
    });
  };

  const addIndividualComment = async () => {
    if (!selectedReport) return;
    const trimmed = commentText.trim();
    if (!trimmed) { showToast("Please enter a comment.", "error"); return; }
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE}/api/reports/${selectedReport._id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, by: "BFMO Staff" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to add comment");
      const updated = data.report as Report;
      setReports((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
      setSelectedReport(updated);
      setCommentText("");
      showToast(`Comment added — email sent success`, "success");
    } catch (err: any) {
      showToast(err.message || "There was a problem adding the comment.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* PRINT ANALYTICS */
  const handlePrint = useCallback(() => {
    if (typeof window === "undefined") return;

    const printedDate = new Date().toLocaleString();
    const concernBaseCounts = new Map<string, number>();
    const concernCounts = new Map<string, number>();
    const buildingCounts = new Map<string, number>();

    filteredReports.forEach((r) => {
      const baseConcern = getBaseConcernFromReport(r) || "Unspecified";
      concernBaseCounts.set(baseConcern, (concernBaseCounts.get(baseConcern) || 0) + 1);
      const concernLabel = formatConcern(r);
      concernCounts.set(concernLabel, (concernCounts.get(concernLabel) || 0) + 1);
      const buildingKey = (r.building || "Unspecified").trim() || "Unspecified";
      buildingCounts.set(buildingKey, (buildingCounts.get(buildingKey) || 0) + 1);
    });

    const concernBaseStatsHtml =
      [...concernBaseCounts.entries()].sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<li>${name}: ${count}</li>`).join("") ||
      "<li>No concerns for current filters.</li>";

    const concernStatsHtml =
      [...concernCounts.entries()].sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<li>${name}: ${count}</li>`).join("") ||
      "<li>No detailed concerns for current filters.</li>";

    const buildingStatsHtml =
      [...buildingCounts.entries()].sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<li>${name}: ${count}</li>`).join("") ||
      "<li>No buildings for current filters.</li>";

    const safe = (v?: string) => (v ? String(v) : "");

    const rowsHtml = filteredReports
      .map((r, idx) => {
        const concernLabel = formatConcern(r);
        const created = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";
        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${safe(r.reportId)}</td>
            <td>${created}</td>
            <td>${safe(r.status)}</td>
            <td>${safe(r.building)}</td>
            <td>${safe(concernLabel)}</td>
            <td>${safe(r.college)}</td>
            <td>${safe(r.floor)}</td>
            <td>${safe(r.room)}</td>
            <td>${safe(r.userType)}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>BFMO Reports</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 8px; color: #111827; padding: 10px; }
      .doc-header { margin-bottom: 20px; }
      .doc-table { width: 100%; margin: 0 auto; border-collapse: collapse; }
      .logo-cell { width: 90px; text-align: center; }
      .logo-cell img { width: 64px; height: 64px; padding-top: 12px; object-fit: contain; }
      .title { font-size: 14px; font-weight: 700; color: #ffffff; background: #029006; border-bottom: 1px solid #000; padding: 8px; }
      .row-line { border-bottom: 1px solid #000; padding-bottom: 4px; }
      .label { font-weight: 600; }
      h1 { font-size: 18px; margin: 16px 0 4px; }
      h2 { font-size: 15px; margin-top: 16px; margin-bottom: 4px; }
      h3 { font-size: 13px; margin-top: 10px; margin-bottom: 4px; }
      .meta { font-size: 11px; color: #374151; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; vertical-align: top; }
      thead { background: #f3f4f6; }
      ul { margin: 4px 0 8px 16px; padding: 0; }
      li { margin: 2px 0; }
      .signatories { margin-top: 48px; page-break-inside: avoid; }
      .signatories h2 { font-size: 13px; margin-bottom: 32px; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; }
      .sig-row { display: flex; justify-content: space-around; gap: 24px; flex-wrap: wrap; }
      .sig-block { flex: 1; min-width: 140px; max-width: 200px; text-align: center; }
      .sig-line { border-top: 1px solid #111827; margin-bottom: 4px; margin-top: 40px; }
      .sig-name { font-size: 9px; font-weight: 700; color: #111827; }
      .sig-role { font-size: 8px; color: #6b7280; margin-top: 2px; }
      @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
    </style>
  </head>
  <body>
    <div class="doc-header">
      <table class="doc-table">
        <tr>
          <td class="logo-cell" rowspan="5"><img src="/logo-dlsud.png" alt="BFMO Logo" /></td>
          <td colspan="2" class="title">Building Facilities Maintenance Office : Facility Reports</td>
        </tr>
        <tr>
          <td class="row-line"><span class="label">Document Reference:</span> BFMO Report System</td>
          <td class="row-line"><span class="label">Printed Date:</span> ${printedDate}</td>
        </tr>
        <tr>
          <td class="row-line"><span class="label">Confidentiality Level:</span> Research Purpose</td>
          <td class="row-line"><span class="label">Approval Date:</span></td>
        </tr>
        <tr>
          <td class="row-line"><span class="label">Review Cycle:</span> Monthly</td>
          <td class="row-line"><span class="label">Effectivity Date:</span></td>
        </tr>
      </table>
    </div>
    <h1>BFMO Reports - Tabular Report</h1>
    <div class="meta">Records shown: ${filteredReports.length}</div>
    <h2>Summary Statistics</h2>
    <h3>By Concern (Base)</h3><ul>${concernBaseStatsHtml}</ul>
    <h3>By Concern (Detailed)</h3><ul>${concernStatsHtml}</ul>
    <h3>By Building</h3><ul>${buildingStatsHtml}</ul>
    <h2>Detailed Report</h2>
    <table>
      <thead>
        <tr><th>#</th><th>Report ID</th><th>Date Created</th><th>Status</th><th>Building</th><th>Concern</th><th>College</th><th>Floor</th><th>Room</th><th>Reporter Type</th></tr>
      </thead>
      <tbody>${rowsHtml || '<tr><td colspan="11">No data for current filters.</td></tr>'}</tbody>
    </table>
    <div class="signatories">
      <h2>Signatories</h2>
      <div class="sig-row">
        <div class="sig-block"><div class="sig-line"></div><div class="sig-name">Signature over Printed Name</div><div class="sig-role">Prepared by</div></div>
        <div class="sig-block"><div class="sig-line"></div><div class="sig-name">Signature over Printed Name</div><div class="sig-role">Reviewed by</div></div>
        <div class="sig-block"><div class="sig-line"></div><div class="sig-name">Signature over Printed Name</div><div class="sig-role">Approved by</div></div>
      </div>
    </div>
  </body>
</html>`;

    const printWin = window.open("", "_blank");
    if (!printWin) return;
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    printWin.print();
  }, [filteredReports, firstName]);

  /* RENDER */
  if (!isLoaded || !canView) {
    return (
      <div className="report-wrapper">
        <div className="loading-shimmer-wrapper">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="shimmer-card" />
          ))}
        </div>
      </div>
    );
  }

  const commentsToShow: Comment[] = selectedReport?.comments || [];

  const modalContent = selectedReport ? (
    <div
      className="report-modal-backdrop"
      onClick={closeDetails}
      role="dialog"
      aria-modal="true"
      aria-label="Report details"
    >
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-main">
            <h2>{selectedReport.heading || "Report details"}</h2>
            {selectedReport.reportId && (
              <span className="modal-report-id-badge">#{selectedReport.reportId}</span>
            )}
          </div>
          <button
            className="modal-close-btn"
            onClick={closeDetails}
            type="button"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-content">
          {/* Desktop image */}
          <div className="modal-img-wrapper">
            <img
              src={resolveImageFile(selectedReport.ImageFile || selectedReport.image)}
              alt="Report"
              className="report-img report-img-clickable"
              onClick={() => setIsImageExpanded(true)}
              onError={(e) => { (e.target as HTMLImageElement).src = defaultImg; }}
            />
            <div className="modal-img-hint">Click to enlarge</div>
          </div>


          {/* Mobile thumbnail */}
          <div className="modal-thumb-mobile">
            <img
              src={resolveImageFile(selectedReport.ImageFile || selectedReport.image)}
              alt="Report"
              className="report-img report-img-clickable"
              onClick={() => setIsImageExpanded(true)}
              onError={(e) => { (e.target as HTMLImageElement).src = defaultImg; }}
            />
          </div>


          {/* Info column */}
          <div className="modal-info">
            <p className="modal-description">
              {selectedReport.description || "No description provided."}
            </p>

            <div className="modal-meta-grid">
              <p><strong>Building:</strong> {formatBuilding(selectedReport)}</p>
              <p><strong>Concern:</strong> {formatConcern(selectedReport)}</p>
              <p><strong>College:</strong> {selectedReport.college || "Unspecified"}</p>
              <p><strong>Reporter:</strong> {selectedReport.userType || "Unspecified"}</p>              <p>
                <strong>Submitted:</strong>{" "}
                {selectedReport.createdAt && new Date(selectedReport.createdAt).toLocaleString()}{" "}
                {selectedReport.createdAt && `(${getRelativeTime(selectedReport.createdAt)})`}
              </p>
            </div>

            {/* Status panel */}
            <div className={`status-panel status-focus-${getStatusClassKey(statusValue)}`}>
              <div className="status-panel-header">
                <span className="status-panel-title">Status</span>
                {renderStatusPill(statusValue)}
              </div>
              <div className="status-row status-row-inline">
                <label htmlFor="status-select" className="status-row-label">Update</label>
                <select
                  id="status-select"
                  className="status-select"
                  value={statusValue}
                  onChange={(e) => setStatusValue(e.target.value)}
                  disabled={selectedReport.status === "Archived"}
                >
                  <option value="Pending">Pending</option>
                  <option value="Waiting for Materials">Waiting for Materials</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            </div>

            {/* Comments */}
            <div className="comments-section">
              <h3>
                Comments
                {commentsToShow.length > 0 && (
                  <span className="comments-count">{commentsToShow.length}</span>
                )}
              </h3>

              {commentsToShow.length > 0 ? (
                <ul className="comments-list">
                  {commentsToShow.map((c, idx) => (
                    <li key={idx} className="comment-item">
                      {editingIndex === idx ? (
                        <>
                          <textarea
                            className="comment-edit-input"
                            rows={2}
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            autoFocus
                          />
                          <div className="comment-actions-row">
                            <button type="button" className="comment-btn-save" onClick={() => saveEditedComment(idx)} disabled={saving}>Save</button>
                            <button type="button" className="comment-btn-cancel" onClick={cancelEditComment} disabled={saving}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="comment-text">{c.text || c.comment || String(c)}</p>
                          {c.imageUrl && (
                            <img
                              src={c.imageUrl}
                              alt="Comment attachment"
                              className="comment-image"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <div className="comment-footer">
                            <div>
                              {c.at && <span className="comment-date">{new Date(c.at).toLocaleString()}&nbsp;</span>}
                              {c.by && <span className="comment-date">by {c.by}</span>}
                            </div>
                            <div className="comment-actions">
                              <button type="button" className="comment-btn-edit" onClick={() => startEditComment(idx)} disabled={saving}>Edit</button>
                              <button type="button" className="comment-btn-delete" onClick={() => deleteComment(idx)} disabled={saving}>Delete</button>
                            </div>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-comments">No comments yet.</p>
              )}

              <textarea
                className="comment-input"
                rows={3}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Type your comment here…"
              />

              <div className="modal-actions">
                <button
                  className="add-comment-btn"
                  onClick={addIndividualComment}
                  disabled={saving || !commentText.trim()}
                  type="button"
                >
                  {saving ? "Adding…" : "Add Comment"}
                </button>

                {selectedReport.status !== "Archived" && (
                  <button
                    className="archive-btn"
                    onClick={handleArchive}
                    disabled={saving}
                    type="button"
                  >
                    Archive report
                  </button>
                )}

                <button
                  className="save-comment-btn"
                  onClick={handleSaveChanges}
                  disabled={saving || selectedReport.status === "Archived"}
                  type="button"
                >
                  {saving ? "Updating…" : "Update Status"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen image */}
      {isImageExpanded && (
        <div
          className="image-fullscreen-backdrop"
          onClick={() => setIsImageExpanded(false)}
        >
          <img
            src={resolveImageFile(selectedReport.ImageFile || selectedReport.image)}
            alt="Report full view"
            className="image-fullscreen-img"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => { (e.target as HTMLImageElement).src = defaultImg; }}
          />
          <button
            className="image-fullscreen-close"
            onClick={() => setIsImageExpanded(false)}
            type="button"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <div className="report-wrapper">
        {/* Header */}
        <div className="header">
          <div>
            <h1>Reports</h1>
            <p className="header-subtitle">
              Review, update, and archive facility reports in one place.
            </p>
          </div>
          <div className="header-actions">
            <button className="refresh-btn" type="button" onClick={fetchReports} disabled={isLoading} title="Refresh reports">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <button className="printreports-btn" onClick={handlePrint} type="button">
              Print Analytic Reports
            </button>
          </div>
        </div>

        {loadError && (
          <div className="load-error-banner">
            {loadError}{" "}
            <button type="button" onClick={fetchReports}>Retry</button>
          </div>
        )}

        {/* Filters */}
        <div className="filters-card">
          <div className="filters-header-row">
            <span className="filters-title">Filters</span>
            <div className="filters-header-right">
              <div className="user-type-toggle">
                {["All", "Student", "Staff/Faculty"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`user-type-btn ${userTypeFilter === type ? "active" : ""}`}
                    onClick={() => setUserTypeFilter(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button className="clear-filters-btn" type="button" onClick={handleClearFilters}>
                Clear filters
              </button>
            </div>
          </div>

          <div className="filters">
            <div className="filter-field">
              <label htmlFor="building-filter">Building</label>
              <select id="building-filter" value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
                {buildingOptions.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="concern-filter">Concern</label>
              <select id="concern-filter" value={concernFilter} onChange={(e) => setConcernFilter(e.target.value)}>
                {concernOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="college-filter">College</label>
              <select id="college-filter" value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
                {collegeOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="status-filter">Status</label>
              <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <label className="duplicate-toggle">
              <input
                type="checkbox"
                checked={showDuplicates}
                onChange={() => setShowDuplicates((prev) => !prev)}
              />
              Show duplicates
            </label>
          </div>
        </div>

        {/* Search */}
        <div className="group">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon">
            <g>
              <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z" />
            </g>
          </svg>
          <input
            id="report-id-search"
            className="search"
            type="text"
            placeholder="Search by report ID, title, or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" type="button" onClick={() => setSearchQuery("")} aria-label="Clear search">✕</button>
          )}
        </div>

        {/* Loading shimmer */}
        {isLoading && (
          <div className="loading-shimmer-wrapper">
            {[...Array(6)].map((_, i) => <div key={i} className="shimmer-card" />)}
          </div>
        )}

        {!isLoading && filteredReports.length === 0 && !loadError && (
          <div className="empty-state">
            <svg viewBox="0 0 64 64" fill="none" width="48" height="48">
              <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
              <path d="M20 32h24M32 20v24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
            </svg>
            <p>No reports found for the current filters.</p>
            <button type="button" onClick={handleClearFilters} className="clear-filters-btn">Clear all filters</button>
          </div>
        )}

        {!isLoading && filteredReports.length > 0 && (
          <>
            {selectedGroup ? (
              <div className="reports-list">
                <div className="group-header">
                  <h2>Similar reports for <em>{selectedGroup.replace(/\|/g, " › ")}</em></h2>
                  <button onClick={() => setSelectedGroup(null)} className="back-btn" type="button">
                    ← Back
                  </button>
                </div>
                {getReportsByGroup(selectedGroup).map((report) => {
                  const statusKey = getStatusClassKey(report.status);
                  const imageSrc = resolveImageFile(report.image || report.ImageFile);
                  return (
                    <div key={report._id} className="report" onClick={() => handleCardClick(report)}>
                      <div className="report-img-container">
                        <img src={imageSrc} alt="Report" className="report-img" onError={(e) => { (e.target as HTMLImageElement).src = defaultImg; }} />
                      </div>
                      <div className="report-body">
                        <div className="report-header-row">
                          {report.reportId && <p className="report-id-badge">#{report.reportId}</p>}
                          <h3>{report.heading || "Untitled report"}</h3>
                        </div>
                        <div className={`status-focus-row status-focus-${statusKey}`}>
                          <span className="status-focus-label">Status</span>
                          {renderStatusPill(report.status)}
                        </div>
                        <p className="report-description">{report.description || "No description provided."}</p>
                        <div className="report-info">
                          <p><strong>Building:</strong> {formatBuilding(report)}</p>
                          <p><strong>Concern:</strong> {formatConcern(report)}</p>
                          <p><strong>College:</strong> {report.college || "Unspecified"}</p>
                        </div>
                        <p className="submitted-date">
                          {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ""}
                          {report.createdAt && ` (${getRelativeTime(report.createdAt)})`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="reports-list">
                  {paginatedReports.map((report) => {
                    const key = getGroupKey(report);
                    const duplicates = (duplicateCounts[key] || 1) - 1;
                    const statusKey = getStatusClassKey(report.status);
                    const imageSrc = resolveImageFile(report.image || report.ImageFile);
                    return (
                      <div key={report._id} className="report" onClick={() => handleCardClick(report)}>
                        <div className="report-img-container">
                          <img src={imageSrc} alt="Report" className="report-img" onError={(e) => { (e.target as HTMLImageElement).src = defaultImg; }} />
                        </div>
                        <div className="report-body">
                          <div className="report-header-row">
                            {report.reportId && <p className="report-id-badge">#{report.reportId}</p>}
                            <h3>{report.heading || "Untitled report"}</h3>
                          </div>
                          <div className={`status-focus-row status-focus-${statusKey}`}>
                            <span className="status-focus-label">Status</span>
                            {renderStatusPill(report.status)}
                          </div>
                          <p className="report-description">{report.description || "No description provided."}</p>
                          <div className="report-info">
                            <p><strong>Building:</strong> {formatBuilding(report)}</p>
                            <p><strong>Concern:</strong> {formatConcern(report)}</p>
                            <p><strong>College:</strong> {report.college || "Unspecified"}</p>
                          </div>
                          <p className="submitted-date">
                            {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ""}
                            {report.createdAt && ` (${getRelativeTime(report.createdAt)})`}
                          </p>
                          {!showDuplicates && duplicates > 0 && (
                            <p
                              className="duplicate-msg"
                              onClick={(e) => { e.stopPropagation(); setSelectedGroup(key); }}
                            >
                              +{duplicates} similar {duplicates === 1 ? "report" : "reports"}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</button>
                    <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce<(number | "…")[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === "…" ? (
                          <span key={`ellipsis-${i}`} style={{ minWidth: 28, textAlign: "center", fontSize: "0.875rem", color: "#6b7280" }}>…</span>
                        ) : (
                          <button key={p} type="button" className={p === currentPage ? "active" : ""} onClick={() => setCurrentPage(p as number)}>{p}</button>
                        )
                      )}
                    <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
                    <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»</button>
                    <span style={{ marginLeft: 8, fontSize: "0.8rem", color: "#9ca3af", whiteSpace: "nowrap" }}>
                      {startIndex + 1}–{Math.min(startIndex + REPORTS_PER_PAGE, filteredReports.length)} of {filteredReports.length}
                    </span>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Portal: modal lives OUTSIDE report-wrapper ── */}
      {mounted && modalContent && createPortal(modalContent, document.body)}

      {/* ── Portal: Toast notifications ── */}
      {mounted && createPortal(
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <span>{t.message}</span>
              <button type="button" onClick={() => dismissToast(t.id)} className="toast-dismiss">✕</button>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* ── Portal: Confirm dialog ── */}
      {mounted && confirmDialog.open && createPortal(
        <div className="confirm-backdrop" onClick={() => setConfirmDialog((d) => ({ ...d, open: false }))}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel-btn"
                onClick={() => setConfirmDialog((d) => ({ ...d, open: false }))}
              >
                Cancel
              </button>
             <button
  type="button"
  className="confirm-ok-btn"
  onClick={async () => {
    const action = confirmDialog.onConfirm;
    setConfirmDialog((d) => ({ ...d, open: false }));

    try {
      await Promise.resolve(action());
    } catch (error) {
      console.error("Confirm action failed:", error);
      showToast("Action failed. Please try again.", "error");
    }
  }}
>
  Confirm
</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}