"use client";

import "@/app/Admin/style/reports.css";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const defaultImg = "/default.jpg";

// Backend base URL (Render)
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) ||
  "";

type Comment = {
  text?: string;
  comment?: string;
  at?: string;
  by?: string;
};

type Report = {
  _id: string;
  email?: string;
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

// base concern only, for example "Civil", "Electrical", etc.
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
  if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  }

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

  // When filter is "Archived", only show archived
  if (filter === "Archived") return currentStatus === "Archived";

  // When filter is "Resolved", only show resolved
  if (filter === "Resolved") return currentStatus === "Resolved";

  // "All Statuses" = active only (hide Resolved and Archived)
  if (filter === "All Statuses") {
    return currentStatus !== "Archived" && currentStatus !== "Resolved";
  }

  // For other specific filters (Pending, Waiting for Materials, In Progress)
  return currentStatus === filter;
};

const REPORTS_PER_PAGE = 12;

// helper to compute the "similar group" key
const getGroupKey = (r: Report) =>
  `${(r.building || "").trim()}-${(r.concern || "").trim()}`;

export default function ReportPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const firstName = user?.firstName || "";

  // only true if user is loaded AND role is admin
  const [canView, setCanView] = useState(false);

  const [reports, setReports] = useState<Report[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const [buildingFilter, setBuildingFilter] = useState("All Buildings");
  const [concernFilter, setConcernFilter] = useState("All Concerns");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [showDuplicates, setShowDuplicates] = useState(false);

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [statusValue, setStatusValue] = useState("Pending");
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);

  const [loadError, setLoadError] = useState("");

  // edit/delete state for comments
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  /* AUTH GUARD: only admins can view this page */

  useEffect(() => {
    if (!isLoaded) return;

    // Not signed in -> go to landing
    if (!isSignedIn || !user) {
      router.replace("/");
      return;
    }

    // role could be "admin" OR ["admin"]
    const rawRole = (user.publicMetadata as any)?.role;
    let role = "student";

    if (Array.isArray(rawRole) && rawRole.length > 0) {
      role = String(rawRole[0]).toLowerCase();
    } else if (typeof rawRole === "string") {
      role = rawRole.toLowerCase();
    }

    if (role !== "admin") {
      // Non admin -> send to student dashboard
      router.replace("/Student/Dashboard");
      return;
    }

    // User is admin -> allow rendering and data fetch
    setCanView(true);
  }, [isLoaded, isSignedIn, user, router]);

  /* FETCH REPORTS (only after auth says canView = true) */

  useEffect(() => {
    if (!canView) return;
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const fetchReports = async () => {
    try {
      setLoadError("");

      const res = await fetch(`${API_BASE}/api/reports`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        console.warn("Failed /api/reports:", data);
        setLoadError(
          data?.message || "Could not load reports. Check the server response."
        );
        setReports([]);
        return;
      }

      let list: Report[] = [];

      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data.reports)) {
        list = data.reports;
      } else if (Array.isArray(data.data)) {
        list = data.data;
      } else {
        console.warn("Unexpected /api/reports payload:", data);
        setLoadError("Could not load reports. Check the server response.");
        setReports([]);
        return;
      }

      setReports(list);
      setCurrentPage(1); // reset page on new data
    } catch (err) {
      console.error("Error fetching reports:", err);
      setLoadError("Network error while loading reports.");
      setReports([]);
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
        .filter(
          (r) =>
            (concernFilter === "All Concerns" || r.concern === concernFilter) &&
            (collegeFilter === "All Colleges" ||
              (r.college || "Unspecified") === collegeFilter) &&
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
        .filter(
          (r) =>
            (buildingFilter === "All Buildings" ||
              r.building === buildingFilter) &&
            (collegeFilter === "All Colleges" ||
              (r.college || "Unspecified") === collegeFilter) &&
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
        .filter(
          (r) =>
            (buildingFilter === "All Buildings" ||
              r.building === buildingFilter) &&
            (concernFilter === "All Concerns" || r.concern === concernFilter) &&
            statusMatchesFilter(r.status, statusFilter)
        )
        .map((r) => r.college || "Unspecified")
    ),
  ];

  const statusOptions = [
    "All Statuses",
    "Pending",
    "Waiting for Materials",
    "In Progress",
    "Resolved",
    "Archived",
  ];

  /* KEEP FILTERS VALID */

  useEffect(() => {
    const validConcerns = new Set(
      reports
        .filter(
          (r) =>
            (buildingFilter === "All Buildings" ||
              r.building === buildingFilter) &&
            (collegeFilter === "All Colleges" ||
              (r.college || "Unspecified") === collegeFilter) &&
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
        .filter(
          (r) =>
            (concernFilter === "All Concerns" || r.concern === concernFilter) &&
            (collegeFilter === "All Colleges" ||
              (r.college || "Unspecified") === collegeFilter) &&
            statusMatchesFilter(r.status, statusFilter)
        )
        .map((r) => r.building)
    );

    if (
      buildingFilter !== "All Buildings" &&
      !validBuildings.has(buildingFilter)
    ) {
      setBuildingFilter("All Buildings");
    }
  }, [concernFilter, collegeFilter, statusFilter, reports, buildingFilter]);

  /* FILTERED REPORTS */

  const filteredReports = reportsToDisplay.filter((report) => {
    const buildingMatch =
      buildingFilter === "All Buildings" || report.building === buildingFilter;

    const concernMatch =
      concernFilter === "All Concerns" || report.concern === concernFilter;

    const collegeMatch =
      collegeFilter === "All Colleges" ||
      (report.college || "Unspecified") === collegeFilter;

    const statusMatch = statusMatchesFilter(report.status, statusFilter);

    return buildingMatch && concernMatch && collegeMatch && statusMatch;
  });

  // Reset to first page whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    buildingFilter,
    concernFilter,
    collegeFilter,
    statusFilter,
    showDuplicates,
  ]);

  // Pagination calculations
  const totalPages = Math.max(
    1,
    Math.ceil(filteredReports.length / REPORTS_PER_PAGE)
  );
  const startIndex = (currentPage - 1) * REPORTS_PER_PAGE;
  const paginatedReports = filteredReports.slice(
    startIndex,
    startIndex + REPORTS_PER_PAGE
  );

  /* CARD & MODAL HANDLERS */

  const handleCardClick = (report: Report) => {
    setSelectedReport(report);
    setStatusValue(report.status || "Pending");
    setCommentText("");
    setEditingIndex(null);
    setEditingText("");
  };

  const closeDetails = () => {
    setSelectedReport(null);
    setStatusValue("Pending");
    setCommentText("");
    setEditingIndex(null);
    setEditingText("");
  };

  const handleClearFilters = () => {
    setBuildingFilter("All Buildings");
    setConcernFilter("All Concerns");
    setCollegeFilter("All Colleges");
    setStatusFilter("All Statuses");
    setShowDuplicates(false);
    setCurrentPage(1);
  };

  const resolveImageFile = (path?: string) => {
    if (!path) return defaultImg;

    // already a full URL (Cloudinary, etc.)
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    // relative path served by your backend
    return `${API_BASE}${path}`;
  };

  // helper: send the full updated comments array for THIS report to the backend
  const syncComments = async (updatedComments: Comment[]) => {
  if (!selectedReport) return;

  try {
    setSaving(true);

    const res = await fetch(`${API_BASE}/api/reports/${selectedReport._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // keep current status
        status: selectedReport.status || "Pending",
        // replace the comments with the updated list
        comments: updatedComments,
        overwriteComments: true,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Failed to update comments");
    }

    const updated = data.report as Report;

    // update list in state
    setReports((prev) =>
      prev.map((r) => (r._id === updated._id ? updated : r))
    );

    // update modal
    setSelectedReport(updated);
    setEditingIndex(null);
    setEditingText("");
  } catch (err: any) {
    console.error("Error syncing comments:", err);
    alert(err.message || "There was a problem updating the comments.");
  } finally {
    setSaving(false);
  }
};


  /* UPDATE STATUS / COMMENTS
     when saving, update ALL reports with same building + concern
  */

  const handleSaveChanges = async () => {
    if (!selectedReport) return;

    const trimmed = commentText.trim();

    const payload: {
      status: string;
      comment?: string;
      by?: string;
    } = {
      status: statusValue,
    };

    if (trimmed) {
      payload.comment = trimmed;
      payload.by = "Admin";
    }

    try {
      setSaving(true);

      // find all reports with the same building + concern
      const groupKey = getGroupKey(selectedReport);
      const groupReports = reports.filter((r) => getGroupKey(r) === groupKey);

      // update all of them on the server
      const updatedReports = await Promise.all(
        groupReports.map(async (r) => {
          const res = await fetch(`${API_BASE}/api/reports/${r._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json().catch(() => null);

          if (!res.ok || !data?.success) {
            throw new Error(data?.message || "Failed to update report");
          }

          return data.report as Report;
        })
      );

      // update all in local state
      setReports((prev) =>
        prev.map((r) => {
          const match = updatedReports.find((u) => u._id === r._id);
          return match || r;
        })
      );

      // keep modal in sync with the selected report
      const updatedSelected =
        updatedReports.find((u) => u._id === selectedReport._id) ||
        updatedReports[0];

      setSelectedReport(updatedSelected);
      setStatusValue(updatedSelected.status || "Pending");
      setCommentText("");
    } catch (err: any) {
      console.error("Error updating reports:", err);
      alert(err.message || "There was a problem saving the changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedReport) return;

    const payload = { status: "Archived" };

    try {
      setSaving(true);

      // find all reports with the same building + concern
      const groupKey = getGroupKey(selectedReport);
      const groupReports = reports.filter((r) => getGroupKey(r) === groupKey);

      // archive all of them on the server
      const updatedReports = await Promise.all(
        groupReports.map(async (r) => {
          const res = await fetch(`${API_BASE}/api/reports/${r._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json().catch(() => null);

          if (!res.ok || !data?.success) {
            throw new Error(data?.message || "Failed to archive report");
          }

          return data.report as Report;
        })
      );

      // update all in local state
      setReports((prev) =>
        prev.map((r) => {
          const match = updatedReports.find((u) => u._id === r._id);
          return match || r;
        })
      );

      const updatedSelected =
        updatedReports.find((u) => u._id === selectedReport._id) ||
        updatedReports[0];

      setSelectedReport(updatedSelected);
      setStatusValue("Archived");
    } catch (err: any) {
      console.error("Error archiving reports:", err);
      alert(err.message || "There was a problem archiving the report(s).");
    } finally {
      setSaving(false);
    }
  };

  const renderStatusPill = (statusRaw?: string) => {
    const classKey = getStatusClassKey(statusRaw);
    const status = statusRaw || "Pending";

    return <span className={`status-pill status-${classKey}`}>{status}</span>;
  };

  /* COMMENT EDIT / DELETE HELPERS (single report) */

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
    if (!trimmed) {
      alert("Comment cannot be empty.");
      return;
    }

    const updatedComments = selectedReport.comments.map((c, i) => {
      if (i !== index) return c;
      const updated: Comment = { ...c };

      // prefer updating text and comment to keep both in sync
      updated.text = trimmed;
      updated.comment = trimmed;
      updated.at = new Date().toISOString();

      return updated;
    });

    await syncComments(updatedComments);
  };

  const deleteComment = async (index: number) => {
    if (!selectedReport || !selectedReport.comments) return;

    const confirmDelete = window.confirm("Delete this comment?");
    if (!confirmDelete) return;

    const updatedComments = selectedReport.comments.filter(
      (_c, i) => i !== index
    );

    await syncComments(updatedComments);
  };

  /* =========================================================
    PRINT ANALYTICS (SUMMARY STATS) FOR CURRENT FILTERS
  ========================================================= */

  const handlePrint = useCallback(() => {
    if (typeof window === "undefined") return;

    const printedBy = firstName || "Administrator";

    // statistics based on current filtered reports
    const concernBaseCounts = new Map<string, number>();
    const concernCounts = new Map<string, number>();
    const buildingCounts = new Map<string, number>();

    filteredReports.forEach((r) => {
      // base concern
      const baseConcern = getBaseConcernFromReport(r) || "Unspecified";
      concernBaseCounts.set(
        baseConcern,
        (concernBaseCounts.get(baseConcern) || 0) + 1
      );

      // detailed concern (with subConcern)
      const concernLabel = formatConcern(r);
      const concernKey = concernLabel || "Unspecified";
      concernCounts.set(concernKey, (concernCounts.get(concernKey) || 0) + 1);

      // building
      const buildingKey = (r.building || "Unspecified").trim() || "Unspecified";
      buildingCounts.set(
        buildingKey,
        (buildingCounts.get(buildingKey) || 0) + 1
      );
    });

    const concernBaseStatsHtml =
      [...concernBaseCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<li>${name}: ${count}</li>`)
        .join("") || "<li>No concerns for current filters.</li>";

    const concernStatsHtml =
      [...concernCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<li>${name}: ${count}</li>`)
        .join("") || "<li>No detailed concerns for current filters.</li>";

    const buildingStatsHtml =
      [...buildingCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `<li>${name}: ${count}</li>`)
        .join("") || "<li>No buildings for current filters.</li>";

    const rowsHtml = filteredReports
      .map((r, idx) => {
        const concernLabel = formatConcern(r);
        const created = r.createdAt
          ? new Date(r.createdAt).toLocaleString()
          : "";
        const safe = (v?: string) => (v ? String(v) : "");
        return `
        <tr>
          <td>${idx + 1}</td>
          <td>${created}</td>
          <td>${safe(r.status)}</td>
          <td>${safe(r.building)}</td>
          <td>${safe(concernLabel)}</td>
          <td>${safe(r.college)}</td>
          <td>${safe(r.floor)}</td>
          <td>${safe(r.room)}</td>
          <td>${safe(r.email)}</td>
        </tr>
      `;
      })
      .join("");

    const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>BFMO Reports Analytics</title>
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 12px;
            color: #111827;
            padding: 16px;
          }
          h1 {
            font-size: 20px;
            margin-bottom: 4px;
          }
          h2 {
            font-size: 16px;
            margin-top: 16px;
            margin-bottom: 4px;
          }
          h3 {
            font-size: 14px;
            margin-top: 8px;
            margin-bottom: 4px;
          }
          .meta {
            font-size: 12px;
            color: #4b5563;
            margin-bottom: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 4px 8px;
            text-align: left;
            vertical-align: top;
          }
          thead {
            background: #f3f4f6;
          }
          ul {
            margin: 4px 0 8px 16px;
            padding: 0;
          }
          li {
            margin: 2px 0;
          }
        </style>
      </head>
      <body>
        <h1>BFMO Reports - Analytics (Current Filters)</h1>
        <div class="meta">
          Generated at: ${new Date().toLocaleString()}<br />
          Records shown: ${filteredReports.length}<br />
          Printed by: ${printedBy}
        </div>

        <h2>Summary Statistics</h2>

        <h3>By Concern (Base)</h3>
        <ul>
          ${concernBaseStatsHtml}
        </ul>

        <h3>By Concern (Detailed)</h3>
        <ul>
          ${concernStatsHtml}
        </ul>

        <h3>By Building</h3>
        <ul>
          ${buildingStatsHtml}
        </ul>

        <h2>Detailed Report</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date Created</th>
              <th>Status</th>
              <th>Building</th>
              <th>Concern</th>
              <th>College</th>
              <th>Floor</th>
              <th>Room</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${
              rowsHtml ||
              '<tr><td colspan="9">No data for current filters.</td></tr>'
            }
          </tbody>
        </table>
      </body>
    </html>
  `;

    const printWin = window.open("", "_blank");
    if (!printWin) return;
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    printWin.print();
  }, [filteredReports, firstName]);

  /* RENDER */

  // While Clerk is still loading, or we have not yet confirmed the user is admin
  if (!isLoaded || !canView) {
    return (
      <div className="report-wrapper">
        <p>Checking your permissions…</p>
      </div>
    );
  }

  // comments to show: ONLY from the currently selected report
  const commentsToShow: Comment[] = selectedReport?.comments || [];

  return (
    <>
      <div className="report-wrapper">
        <div className="header">
          <div>
            <h1>Reports</h1>
            <p className="header-subtitle">
              Review, update, and archive facility reports in one place.
            </p>
          </div>
          <div className="header-actions">
            <button className="printreports-btn" onClick={handlePrint}>
              Print Analytic Reports
            </button>
          </div>
        </div>

        {loadError && (
          <div className="load-error-banner">
            {loadError}{" "}
            <button type="button" onClick={fetchReports}>
              Retry
            </button>
          </div>
        )}

        <div className="filters-card">
          <div className="filters-header-row">
            <span className="filters-title">Filters</span>
            <button
              className="clear-filters-btn"
              type="button"
              onClick={handleClearFilters}
            >
              Clear filters
            </button>
          </div>

          <div className="filters">
            <div className="filter-field">
              <label htmlFor="building-filter">Building</label>
              <select
                id="building-filter"
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
              >
                {buildingOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="concern-filter">Concern</label>
              <select
                id="concern-filter"
                value={concernFilter}
                onChange={(e) => setConcernFilter(e.target.value)}
              >
                {concernOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="college-filter">College</label>
              <select
                id="college-filter"
                value={collegeFilter}
                onChange={(e) => setCollegeFilter(e.target.value)}
              >
                {collegeOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
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

        {filteredReports.length === 0 && !loadError && (
          <p className="no-reports-msg">
            No reports found for the current filters. Try submitting a report or
            clearing filters.
          </p>
        )}

        {filteredReports.length > 0 && (
          <>
            {selectedGroup ? (
              <div className="reports-list">
                <div className="group-header">
                  <h2>
                    Similar reports for <em>{selectedGroup}</em>
                  </h2>
                  <button
                    onClick={() => setSelectedGroup(null)}
                    className="back-btn"
                    type="button"
                  >
                    Back
                  </button>
                </div>

                {getReportsByGroup(selectedGroup).map((report) => {
                  const statusKey = getStatusClassKey(report.status);

                  return (
                    <div
                      key={report._id}
                      className="report"
                      onClick={() => handleCardClick(report)}
                    >
                      <div className="report-img-container">
                        <img
                          src={
                            report.ImageFile
                              ? `${API_BASE}${report.ImageFile}`
                              : defaultImg
                          }
                          alt="Report"
                          className="report-img"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = defaultImg;
                          }}
                        />
                      </div>
                      <div className="report-body">
                        <div className="report-header-row">
                          <h3>{report.heading || "Untitled report"}</h3>
                        </div>

                        <div
                          className={`status-focus-row status-focus-${statusKey}`}
                        >
                          <span className="status-focus-label">Status</span>
                          {renderStatusPill(report.status)}
                        </div>

                        <p className="report-description">
                          {report.description || "No description provided."}
                        </p>

                        <div className="report-info">
                          <p>
                            <strong>Building:</strong>{" "}
                            {formatBuilding(report)}
                          </p>
                          <p>
                            <strong>Concern:</strong> {formatConcern(report)}
                          </p>
                          <p>
                            <strong>College:</strong>{" "}
                            {report.college || "Unspecified"}
                          </p>
                        </div>
                        <p className="submitted-date">
                          {report.createdAt
                            ? new Date(report.createdAt).toLocaleDateString()
                            : ""}
                          {report.createdAt &&
                            ` (${getRelativeTime(report.createdAt)})`}
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

                    return (
                      <div
                        key={report._id}
                        className="report"
                        onClick={() => handleCardClick(report)}
                      >
                        <div className="report-img-container">
                        <img
                          src={
                            report.ImageFile
                              ? `${API_BASE}${report.ImageFile}`
                              : defaultImg
                          }
                          alt="Report"
                          className="report-img"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = defaultImg;
                          }}
                        />
                        </div>
                        <div className="report-body">
                          <div className="report-header-row">
                            <h3>{report.heading || "Untitled report"}</h3>
                          </div>

                          <div
                            className={`status-focus-row status-focus-${statusKey}`}
                          >
                            <span className="status-focus-label">Status</span>
                            {renderStatusPill(report.status)}
                          </div>

                          <p className="report-description">
                            {report.description || "No description provided."}
                          </p>

                          <div className="report-info">
                            <p>
                              <strong>Building:</strong>{" "}
                              {formatBuilding(report)}
                            </p>
                            <p>
                              <strong>Concern:</strong> {formatConcern(report)}
                            </p>
                            <p>
                              <strong>College:</strong>{" "}
                              {report.college || "Unspecified"}
                            </p>
                          </div>

                          <p className="submitted-date">
                            {report.createdAt
                              ? new Date(report.createdAt).toLocaleDateString()
                              : ""}
                            {report.createdAt &&
                              ` (${getRelativeTime(report.createdAt)})`}
                          </p>

                          {!showDuplicates && duplicates > 0 && (
                            <p
                              className="duplicate-msg"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroup(key);
                              }}
                            >
                              Similar type of report: ({duplicates}{" "}
                              {duplicates === 1 ? "report" : "reports"})
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>

                    {Array.from({ length: totalPages }, (_, idx) => {
                      const page = idx + 1;
                      return (
                        <button
                          key={page}
                          type="button"
                          className={
                            page === currentPage
                              ? "page-btn active"
                              : "page-btn"
                          }
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {selectedReport && (
          <div className="report-modal-backdrop" onClick={closeDetails}>
            <div className="report-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedReport.heading || "Report details"}</h2>
                <button
                  className="modal-close-btn"
                  onClick={closeDetails}
                  type="button"
                >
                  ✕
                </button>
              </div>

              <div className="modal-content">
                <div className="modal-img-wrapper">
                  <img
                    src={resolveImageFile(selectedReport.image)}
                    alt="Report"
                    className="report-img"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = defaultImg;
                    }}
                  />
                </div>

                <div className="modal-info">
                  <p className="modal-description">
                    {selectedReport.description || "No description provided."}
                  </p>

                  <div className="modal-meta-grid">
                    <p>
                      <strong>Building:</strong>{" "}
                      {formatBuilding(selectedReport)}
                    </p>
                    <p>
                      <strong>Concern:</strong> {formatConcern(selectedReport)}
                    </p>
                    <p>
                      <strong>College:</strong>{" "}
                      {selectedReport.college || "Unspecified"}
                    </p>
                    <p>
                      <strong>Email:</strong>{" "}
                      {selectedReport.email || "Unspecified"}
                    </p>
                    <p>
                      <strong>Submitted:</strong>{" "}
                      {selectedReport.createdAt &&
                        new Date(selectedReport.createdAt).toLocaleString()}{" "}
                      {selectedReport.createdAt &&
                        `(${getRelativeTime(selectedReport.createdAt)})`}
                    </p>
                  </div>

                  <div
                    className={`status-panel status-focus-${getStatusClassKey(
                      statusValue
                    )}`}
                  >
                    <div className="status-panel-header">
                      <span className="status-panel-title">Status</span>
                      {renderStatusPill(statusValue)}
                    </div>
                    <div className="status-row status-row-inline">
                      <label
                        htmlFor="status-select"
                        className="status-row-label"
                      >
                        Update
                      </label>
                      <select
                        id="status-select"
                        className="status-select"
                        value={statusValue}
                        onChange={(e) => setStatusValue(e.target.value)}
                        disabled={selectedReport.status === "Archived"}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Waiting for Materials">Waiting</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                  </div>

                  <div className="comments-section">
                    <h3>Comments</h3>

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
                                  onChange={(e) =>
                                    setEditingText(e.target.value)
                                  }
                                />
                                <div className="comment-actions-row">
                                  <button
                                    type="button"
                                    className="comment-btn-save"
                                    onClick={() => saveEditedComment(idx)}
                                    disabled={saving}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="comment-btn-cancel"
                                    onClick={cancelEditComment}
                                    disabled={saving}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="comment-text">
                                  {c.text || c.comment || String(c)}
                                </p>
                                <div className="comment-footer">
                                  <div>
                                    {c.at && (
                                      <span className="comment-date">
                                        {new Date(c.at).toLocaleString()}
                                        &nbsp;
                                      </span>
                                    )}
                                    {c.by && (
                                      <span className="comment-date">
                                        by {c.by}
                                      </span>
                                    )}
                                  </div>
                                  <div className="comment-actions">
                                    <button
                                      type="button"
                                      className="comment-btn-edit"
                                      onClick={() => startEditComment(idx)}
                                      disabled={saving}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="comment-btn-delete"
                                      onClick={() => deleteComment(idx)}
                                      disabled={saving}
                                    >
                                      Delete
                                    </button>
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
                      placeholder="Type your comment here..."
                    />

                    <div className="modal-actions">
                      {selectedReport.status !== "Archived" && (
                        <button
                          className="archive-btn"
                          onClick={handleArchive}
                          disabled={saving}
                          type="button"
                        >
                          {saving && statusValue === "Archived"
                            ? "Archiving..."
                            : "Archive report"}
                        </button>
                      )}

                      <button
                        className="save-comment-btn"
                        onClick={handleSaveChanges}
                        disabled={saving}
                        type="button"
                      >
                        
                        {saving && statusValue !== "Archived"
                          ? "Saving..."
                          : "Save changes"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
