"use client";

import "@/app/style/reports.css";

import React, { useEffect, useState } from "react";
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

const REPORTS_PER_PAGE = 12;

export default function ReportPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
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

  useEffect(() => {
    if (!isLoaded || !user) return;

    // READ ROLE FROM CLERK PUBLIC METADATA
    const role = user.publicMetadata?.role;

    // 1. CHECK IF ADMIN → REDIRECT
    if (role === "admin") {
      router.push("/Admin/");
      return;
    } else if (role === "staff") {
      router.push("/Staff/");
      return;
    }

    // If normal user → continue loading their reports
    const emailFromClerk =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses[0]?.emailAddress ||
      "";

    const usernameFromClerk =
      user.username ||
      (user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || "");

    setUserEmail(emailFromClerk);
    setCurrentUserName(usernameFromClerk);
  }, [isLoaded, user, router]);

  /* FETCH REPORTS FOR THIS USER ONLY */

  useEffect(() => {
    if (!userEmail) return;
    fetchReportsForUser(userEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  const fetchReportsForUser = async (email: string) => {
    try {
      setLoadError("");

      const res = await fetch(`${API_BASE}/api/reports`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        console.warn("Failed /api/reports:", data);
        setLoadError(
          data?.message ||
            "Could not load reports. Check the server response."
        );
        setReports([]);
        setSelectedReport(null);
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
        setSelectedReport(null);
        return;
      }

      // only reports for this email and not archived
      const userReports = list.filter(
        (r) =>
          r.email &&
          r.email.toLowerCase() === email.toLowerCase() &&
          r.status !== "Archived"
      );

      setReports(userReports);
      setCurrentPage(1);

      if (userReports.length > 0) {
        setSelectedReport(userReports[0]);
      } else {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error("Error fetching reports:", err);
      setLoadError("Network error while loading reports.");
      setReports([]);
      setSelectedReport(null);
    }
  };

  const renderStatusPill = (statusRaw?: string) => {
    const classKey = getStatusClassKey(statusRaw);
    const status = statusRaw || "Pending";

    return <span className={`status-pill status-${classKey}`}>{status}</span>;
  };

  /* PAGINATION */

  const totalPages = Math.max(1, Math.ceil(reports.length / REPORTS_PER_PAGE));
  const startIndex = (currentPage - 1) * REPORTS_PER_PAGE;
  const paginatedReports = reports.slice(
    startIndex,
    startIndex + REPORTS_PER_PAGE
  );

  /* RENDER */

  return (
    <>
      <div className="report-wrapper">
        <div className="header">
          <div className="header-left">
            <h1>My reports</h1>
          </div>

          <div className="header-right">
            <a href="/Student/CreateReport" className="create-report-btn">
              + Create Report
            </a>
          </div>
        </div>

        {!isLoaded && <p>Loading your account...</p>}

        {isLoaded && !userEmail && (
          <p className="no-reports-msg">
            No logged in user found. Please log in again.
          </p>
        )}

        {loadError && (
          <div className="load-error-banner">
            {loadError}{" "}
            <button
              type="button"
              onClick={() => userEmail && fetchReportsForUser(userEmail)}
            >
              Retry
            </button>
          </div>
        )}

        {isLoaded && userEmail && (
          <>
            {reports.length === 0 && !loadError && (
              <p className="no-reports-msg">
                You have not submitted any reports yet.
              </p>
            )}

            {reports.length > 0 && (
              <div className="reports-two-column">
                {/* LEFT: list of reports */}
                <div className="reports-list-column">
                  <div className="reports-list">
                    {paginatedReports.map((report) => {
                      const statusKey = getStatusClassKey(report.status);
                      const isActive =
                        selectedReport && selectedReport._id === report._id;

                      const latestComment =
                        Array.isArray(report.comments) &&
                        report.comments.length > 0
                          ? report.comments[report.comments.length - 1]
                          : null;

                      return (
                        <div
                          key={report._id}
                          className={
                            "report" + (isActive ? " report--active" : "")
                          }
                          onClick={() => setSelectedReport(report)}
                        >
                          <div className="report-img-container">
                            <img
                              src={
                                report.ImageFile || report.image || defaultImg
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
                                ` (${getRelativeTime(report.createdAt)})`}
                            </p>

                            {latestComment && (
                              <p className="report-comment-preview">
                                <strong>Latest comment:</strong>{" "}
                                {latestComment.text ||
                                  latestComment.comment ||
                                  String(latestComment)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

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
                </div>

                {/* RIGHT: details plus comments (read only) */}
                <div className="report-details-column">
                  <h2 className="column-title">Details and comments</h2>

                  {!selectedReport && (
                    <p className="no-reports-msg">
                      Select a report on the left to see its details and
                      comments.
                    </p>
                  )}

                  {selectedReport && (
                    <div className="report-details-panel">
                      <div className="details-header">
                        <h3>
                          {selectedReport.heading || "Report details"}
                        </h3>
                        {renderStatusPill(selectedReport.status)}
                      </div>

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
                          {selectedReport.college || "Unspecified"}
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

                      {/* use the same modal-img-wrapper class so mobile CSS applies */}
                      <div className="modal-img-wrapper">
                        <img
                          src={
                            selectedReport.ImageFile ||
                            selectedReport.image ||
                            defaultImg
                          }
                          alt="Report"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = defaultImg;
                          }}
                        />
                      </div>

                      <div className="comments-section comments-section--static">
                        <h3>Comments</h3>

                        {Array.isArray(selectedReport.comments) &&
                        selectedReport.comments.length > 0 ? (
                          <ul className="comments-list">
                            {selectedReport.comments.map((c, idx) => (
                              <li key={idx} className="comment-item">
                                <p className="comment-text">
                                  {c.text || c.comment || String(c)}
                                </p>
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
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="no-comments">
                            No comments yet for this report.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
