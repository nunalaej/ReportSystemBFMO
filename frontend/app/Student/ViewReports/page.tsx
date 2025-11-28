"use client";

import "@/app/style/reports.css";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  status?: string;
  createdAt?: string;
  comments?: Comment[];
};

const formatConcern = (report: Report) => {
  const base = report.concern || "Unspecified";
  const sub = report.subConcern || report.otherConcern;
  return sub ? `${base} : ${sub}` : base;
};

const formatBuilding = (report: Report) => {
  const rawBuilding = report.building || "Unspecified";

  const isOther =
    rawBuilding && rawBuilding.toLowerCase() === "other";
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
  if (filter === "Archived") return currentStatus === "Archived";
  if (filter === "All Statuses") return currentStatus !== "Archived";
  return currentStatus === filter;
};

const REPORTS_PER_PAGE = 12;

export default function ReportPage() {
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const [buildingFilter, setBuildingFilter] = useState("All Buildings");
  const [concernFilter, setConcernFilter] = useState("All Concerns");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [showDuplicates, setShowDuplicates] = useState(false);

  const [selectedReport, setSelectedReport] =
    useState<Report | null>(null);
  const [statusValue, setStatusValue] = useState("Pending");
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);

  const [loadError, setLoadError] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  /* NAVIGATION */

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("currentUser");
      sessionStorage.clear();
      router.push("/");
    }
  };

  const handleHome = () => {
    router.push("/Student/Dashboard");
  };

  /* FETCH REPORTS */

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setLoadError(
          "Could not load reports. Check the server response."
        );
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
      const key = `${report.building}-${report.concern}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  };

  const duplicateCounts = getDuplicateCounts(reports);

  const filterUniqueReports = (reportsArr: Report[]) => {
    const seen = new Set<string>();
    return reportsArr.filter((report) => {
      const key = `${report.building}-${report.concern}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const reportsToDisplay = showDuplicates
    ? reports
    : filterUniqueReports(reports);

  const getReportsByGroup = (groupKey: string) =>
    reports.filter(
      (r) => `${r.building}-${r.concern}` === groupKey
    );

  /* FILTER OPTIONS */

  const buildingOptions = [
    "All Buildings",
    ...new Set(
      reports
        .filter(
          (r) =>
            (concernFilter === "All Concerns" ||
              r.concern === concernFilter) &&
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
            (concernFilter === "All Concerns" ||
              r.concern === concernFilter) &&
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

    if (
      concernFilter !== "All Concerns" &&
      !validConcerns.has(concernFilter)
    ) {
      setConcernFilter("All Concerns");
    }
  }, [
    buildingFilter,
    collegeFilter,
    statusFilter,
    reports,
    concernFilter,
  ]);

  useEffect(() => {
    const validBuildings = new Set(
      reports
        .filter(
          (r) =>
            (concernFilter === "All Concerns" ||
              r.concern === concernFilter) &&
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
  }, [
    concernFilter,
    collegeFilter,
    statusFilter,
    reports,
    buildingFilter,
  ]);

  /* FILTERED REPORTS */

  const filteredReports = reportsToDisplay.filter((report) => {
    const buildingMatch =
      buildingFilter === "All Buildings" ||
      report.building === buildingFilter;

    const concernMatch =
      concernFilter === "All Concerns" ||
      report.concern === concernFilter;

    const collegeMatch =
      collegeFilter === "All Colleges" ||
      (report.college || "Unspecified") === collegeFilter;

    const statusMatch = statusMatchesFilter(
      report.status,
      statusFilter
    );

    return buildingMatch && concernMatch && collegeMatch && statusMatch;
  });

  // Reset to first page whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [buildingFilter, concernFilter, collegeFilter, statusFilter, showDuplicates]);

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
  };

  const closeDetails = () => {
    setSelectedReport(null);
    setStatusValue("Pending");
    setCommentText("");
  };

  const handleClearFilters = () => {
    setBuildingFilter("All Buildings");
    setConcernFilter("All Concerns");
    setCollegeFilter("All Colleges");
    setStatusFilter("All Statuses");
    setShowDuplicates(false);
    setCurrentPage(1);
  };

  /* UPDATE STATUS / COMMENTS */

  const handleSaveChanges = async () => {
    if (!selectedReport) return;

    const payload: { status: string; comment?: string; by?: string } = {
      status: statusValue,
    };

    if (commentText.trim()) {
      payload.comment = commentText.trim();
      payload.by = "Admin";
    }

    try {
      setSaving(true);

      const res = await fetch(
        `${API_BASE}/api/reports/${selectedReport._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to update report");
      }

      const updatedReport: Report = data.report;

      setReports((prev) =>
        prev.map((r) => (r._id === updatedReport._id ? updatedReport : r))
      );
      setSelectedReport(updatedReport);
      setStatusValue(updatedReport.status || "Pending");
      setCommentText("");
    } catch (err: any) {
      console.error("Error updating report:", err);
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

      const res = await fetch(
        `${API_BASE}/api/reports/${selectedReport._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to archive report");
      }

      const data = await res.json();
      const updatedReport: Report = data.report;

      setReports((prev) =>
        prev.map((r) =>
          r._id === updatedReport._id ? updatedReport : r
        )
      );
      setSelectedReport(updatedReport);
      setStatusValue("Archived");
    } catch (err) {
      console.error("Error archiving report:", err);
      alert("There was a problem archiving the report.");
    } finally {
      setSaving(false);
    }
  };

  const renderStatusPill = (statusRaw?: string) => {
    const classKey = getStatusClassKey(statusRaw);
    const status = statusRaw || "Pending";

    return (
      <span className={`status-pill status-${classKey}`}>
        {status}
      </span>
    );
  };

  /* PRINT CURRENT FILTERED REPORTS */

  const handlePrintCollegeReports = () => {
    const reportsToPrint = filteredReports; // print ALL filtered, not just page

    if (reportsToPrint.length === 0) {
      alert("No reports to print for the current filters.");
      return;
    }

    const groupMap: Record<string, Report[]> = {};
    reports.forEach((r) => {
      const key = `${r.building}-${r.concern}`;
      if (!groupMap[key]) groupMap[key] = [];
      groupMap[key].push(r);
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const filterSummary = `Building: ${buildingFilter}, Concern: ${concernFilter}, College: ${collegeFilter}, Status: ${statusFilter}`;

    const pagesHtml = (() => {
      let pages = "";
      for (let i = 0; i < reportsToPrint.length; i += 4) {
        const chunk = reportsToPrint.slice(i, i + 4);
        pages += `
          <div class="page">
            ${chunk
              .map((r) => {
                const key = `${r.building}-${r.concern}`;
                const group = groupMap[key] || [];
                const similar = group.filter(
                  (x) => x._id !== r._id
                );

                const similarHtml =
                  similar.length > 0
                    ? `
                      <div class="similar-block">
                        <strong>${similar.length} similar ${
                      similar.length === 1 ? "report" : "reports"
                    }</strong>
                      </div>`
                    : "";

                return `
                  <div class="report">
                    <h3>${r.heading || "Untitled Report"}</h3>

                    <p><strong>Building:</strong> ${formatBuilding(r)}</p>
                    <p><strong>Concern:</strong> ${formatConcern(r)}</p>
                    <p><strong>College:</strong> ${
                      r.college || "Unspecified"
                    }</p>

                    ${
                      r.image
                        ? `<img class="square-img" src="${API_BASE}${r.image}" />`
                        : ""
                    }

                    ${similarHtml}

                    <p><strong>Description:</strong><br>${
                      r.description || ""
                    }</p>
                  </div>
                `;
              })
              .join("")}
          </div>
        `;
      }
      return pages;
    })();

    const html = `
      <html>
        <head>
          <title>Filtered Reports</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              line-height: 1.5;
            }
            h1 {
              text-align: center;
              margin-bottom: 10px;
            }
            .filters-summary {
              text-align: center;
              font-size: 12px;
              color: #555;
              margin-bottom: 20px;
            }
            .page {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              grid-template-rows: repeat(2, auto);
              gap: 20px;
              margin-bottom: 50px;
              page-break-after: always;
            }
            .report {
              border: 1px solid #000;
              border-radius: 8px;
              padding: 12px;
              background: #fff;
            }
            .square-img {
              width: 250px;
              height: 120px;
              object-fit: cover;
              display: block;
              margin: 10px auto;
              border-radius: 6px;
              border: 1px solid #999;
            }
            .similar-block {
              margin-top: 8px;
              font-size: 12px;
              color: #222;
            }
            .similar-block ul {
              margin: 4px 0 0;
              padding-left: 16px;
            }
            @media print {
              .page {
                page-break-after: always;
              }
              .report {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <h1>Filtered Reports</h1>
          <div class="filters-summary">${filterSummary}</div>
          ${pagesHtml}
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  /* RENDER */

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
            <button className="home-btn" onClick={handleHome}>
              Home
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
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
                onChange={() =>
                  setShowDuplicates((prev) => !prev)
                }
              />
              Show duplicates
            </label>
          </div>

          {filteredReports.length > 0 && (
            <button
              className="print-btn"
              type="button"
              onClick={handlePrintCollegeReports}
            >
              Print current filtered reports
            </button>
          )}
        </div>

        {filteredReports.length === 0 && !loadError && (
          <p className="no-reports-msg">
            No reports found for the current filters. Try submitting a
            report or clearing filters.
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
                            report.image
                              ? `${API_BASE}${report.image}`
                              : defaultImg
                          }
                          alt="Report"
                          className="report-img"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              defaultImg;
                          }}
                        />
                      </div>
                      <div className="report-body">
                        <div className="report-header-row">
                          <h3>
                            {report.heading || "Untitled report"}
                          </h3>
                        </div>

                        <div
                          className={`status-focus-row status-focus-${statusKey}`}
                        >
                          <span className="status-focus-label">
                            Status
                          </span>
                          {renderStatusPill(report.status)}
                        </div>

                        <p className="report-description">
                          {report.description ||
                            "No description provided."}
                        </p>

                        <div className="report-info">
                          <p>
                            <strong>Building:</strong>{" "}
                            {formatBuilding(report)}
                          </p>
                          <p>
                            <strong>Concern:</strong>{" "}
                            {formatConcern(report)}
                          </p>
                          <p>
                            <strong>College:</strong>{" "}
                            {report.college || "Unspecified"}
                          </p>
                        </div>
                        <p className="submitted-date">
                          {report.createdAt
                            ? new Date(
                                report.createdAt
                              ).toLocaleDateString()
                            : ""}
                          {report.createdAt &&
                            ` (${getRelativeTime(
                              report.createdAt
                            )})`}
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
                    const key = `${report.building}-${report.concern}`;
                    const duplicates =
                      (duplicateCounts[key] || 1) - 1;
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
                              report.image
                                ? `${API_BASE}${report.image}`
                                : defaultImg
                            }
                            alt="Report"
                            className="report-img"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                defaultImg;
                            }}
                          />
                        </div>
                        <div className="report-body">
                          <div className="report-header-row">
                            <h3>
                              {report.heading || "Untitled report"}
                            </h3>
                          </div>

                          <div
                            className={`status-focus-row status-focus-${statusKey}`}
                          >
                            <span className="status-focus-label">
                              Status
                            </span>
                            {renderStatusPill(report.status)}
                          </div>

                          <p className="report-description">
                            {report.description ||
                              "No description provided."}
                          </p>

                          <div className="report-info">
                            <p>
                              <strong>Building:</strong>{" "}
                              {formatBuilding(report)}
                            </p>
                            <p>
                              <strong>Concern:</strong>{" "}
                              {formatConcern(report)}
                            </p>
                            <p>
                              <strong>College:</strong>{" "}
                              {report.college || "Unspecified"}
                            </p>
                          </div>

                          <p className="submitted-date">
                            {report.createdAt
                              ? new Date(
                                  report.createdAt
                                ).toLocaleDateString()
                              : ""}
                            {report.createdAt &&
                              ` (${getRelativeTime(
                                report.createdAt
                              )})`}
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
                              {duplicates === 1
                                ? "report"
                                : "reports"}
                              )
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
                      onClick={() =>
                        setCurrentPage((p) => Math.max(1, p - 1))
                      }
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
                        setCurrentPage((p) =>
                          Math.min(totalPages, p + 1)
                        )
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
          <div
            className="report-modal-backdrop"
            onClick={closeDetails}
          >
            <div
              className="report-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>
                  {selectedReport.heading || "Report details"}
                </h2>
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
                    src={
                      selectedReport.image
                        ? `${API_BASE}${selectedReport.image}`
                        : defaultImg
                    }
                    alt="Report"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        defaultImg;
                    }}
                  />
                </div>

                <div className="modal-info">
                  <p className="modal-description">
                    {selectedReport.description ||
                      "No description provided."}
                  </p>

                  <div className="modal-meta-grid">
                    <p>
                      <strong>Building:</strong>{" "}
                      {formatBuilding(selectedReport)}
                    </p>
                    <p>
                      <strong>Concern:</strong>{" "}
                      {formatConcern(selectedReport)}
                    </p>
                    <p>
                      <strong>College:</strong>{" "}
                      {selectedReport.college ||
                        "Unspecified"}
                    </p>
                    <p>
                      <strong>Email:</strong>{" "}
                      {selectedReport.email || "Unspecified"}
                    </p>
                    <p>
                      <strong>Submitted:</strong>{" "}
                      {selectedReport.createdAt &&
                        new Date(
                          selectedReport.createdAt
                        ).toLocaleString()}{" "}
                      {selectedReport.createdAt &&
                        `(${getRelativeTime(
                          selectedReport.createdAt
                        )})`}
                    </p>
                  </div>

                  <div
                    className={`status-panel status-focus-${getStatusClassKey(
                      statusValue
                    )}`}
                  >
                    <div className="status-panel-header">
                      <span className="status-panel-title">
                        Status
                      </span>
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
                        onChange={(e) =>
                          setStatusValue(e.target.value)
                        }
                        disabled={
                          selectedReport.status === "Archived"
                        }
                      >
                        <option value="Pending">Pending</option>
                        <option value="Waiting for Materials">
                          Waiting
                        </option>
                        <option value="In Progress">
                          In Progress
                        </option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                  </div>

                  <div className="comments-section">
                    <h3>Comments</h3>

                    {Array.isArray(selectedReport.comments) &&
                    selectedReport.comments.length > 0 ? (
                      <ul className="comments-list">
                        {selectedReport.comments.map((c, idx) => (
                          <li key={idx} className="comment-item">
                            <p className="comment-text">
                              {c.text ||
                                c.comment ||
                                String(c)}
                            </p>
                            <div>
                              {c.at && (
                                <span className="comment-date">
                                  {new Date(
                                    c.at
                                  ).toLocaleString()}
                                  &nbsp;
                                </span>
                              )}
                              {c.by && (
                                <span className="comment-date">
                                  by {c.by}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="no-comments">
                        No comments yet.
                      </p>
                    )}

                    <textarea
                      className="comment-input"
                      rows={3}
                      value={commentText}
                      onChange={(e) =>
                        setCommentText(e.target.value)
                      }
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
                          {saving &&
                          statusValue === "Archived"
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
                        {saving &&
                        statusValue !== "Archived"
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
