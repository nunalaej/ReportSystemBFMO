"use client";

import "@/app/style/reports.css";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const defaultImg = "/default.jpg";

// Backend base URL
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

  const [currentPage, setCurrentPage] = useState(1);

  // NEW: fullscreen image viewer
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Mobile mode
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateMobile = () => setIsMobile(window.innerWidth <= 768);

    updateMobile();
    window.addEventListener("resize", updateMobile);
    return () => window.removeEventListener("resize", updateMobile);
  }, []);

  const handleHome = () => {
    router.push("/Student");
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("currentUser");
      sessionStorage.clear();
      router.push("/");
    }
  };

  useEffect(() => {
    if (!isLoaded || !user) return;

    const role = user.publicMetadata?.role;
    if (role === "admin") return router.push("/Admin/");
    if (role === "staff") return router.push("/Staff/");

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
  }, [user, isLoaded, router]);

  useEffect(() => {
    if (!userEmail) return;

    const fetchReportsForUser = async () => {
      try {
        setLoadError("");
        const res = await fetch(`${API_BASE}/api/reports`, {
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data) {
          setLoadError("Failed to load reports.");
          setReports([]);
          return;
        }

        let list: Report[] = [];

        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data.reports)) list = data.reports;
        else if (Array.isArray(data.data)) list = data.data;

        const filtered = list.filter(
          (r) =>
            r.email?.toLowerCase() === userEmail.toLowerCase() &&
            r.status !== "Archived"
        );

        setReports(filtered);
        setSelectedReport(filtered[0] || null);
        setCurrentPage(1);
      } catch (err) {
        setLoadError("Network error loading reports.");
      }
    };

    fetchReportsForUser();
  }, [userEmail]);

  const renderStatusPill = (statusRaw?: string) => {
    const key = getStatusClassKey(statusRaw);
    return <span className={`status-pill status-${key}`}>{statusRaw || "Pending"}</span>;
  };

  const renderDetailsContent = (report: Report) => (
    <div className="report-details-panel">
      <div className="details-header">
        <h3>{report.heading || "Report details"}</h3>

        
      <div className="modal-img-wrapper">
        <img
          src={report.ImageFile || report.image || defaultImg}
          alt="Report"
          className="report-img-clickable"
          onClick={() =>
            setFullscreenImage(report.ImageFile || report.image || defaultImg)
          }
          onError={(e) => ((e.target as HTMLImageElement).src = defaultImg)}
        />
      </div>
      
        {renderStatusPill(report.status)}
      </div>

      
      <p className="modal-description">
        {report.description || "No description provided."}
      </p>

      <div className="modal-meta-grid">
        <p><strong>Building:</strong> {formatBuilding(report)}</p>
        <p><strong>Concern:</strong> {formatConcern(report)}</p>
        <p><strong>College:</strong> {report.college || "Unspecified"}</p>
        <p><strong>Email:</strong> {report.email}</p>
        <p>
          <strong>Submitted:</strong>{" "}
          {report.createdAt &&
            new Date(report.createdAt).toLocaleString()}{" "}
          {report.createdAt && `(${getRelativeTime(report.createdAt)})`}
        </p>
      </div>


      <div className="comments-section comments-section--static">
        <h3>Comments</h3>

        {Array.isArray(report.comments) && report.comments.length > 0 ? (
          <ul className="comments-list">
            {report.comments.map((c, idx) => (
              <li key={idx} className="comment-item">
                <p className="comment-text">{c.text || c.comment}</p>
                <div>
                  {c.at && (
                    <span className="comment-date">
                      {new Date(c.at).toLocaleString()}{" "}
                    </span>
                  )}
                  {c.by && <span className="comment-date">by {c.by}</span>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-comments">No comments yet.</p>
        )}
      </div>
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(reports.length / REPORTS_PER_PAGE));
  const startIndex = (currentPage - 1) * REPORTS_PER_PAGE;
  const paginatedReports = reports.slice(startIndex, startIndex + REPORTS_PER_PAGE);

  return (
    <>
      <div className="report-wrapper">
        <div className="header">
          <div>
            <h1>My reports</h1>
            <p className="header-subtitle">
              View all issues you have submitted.
            </p>
          </div>

  <div className="header-actions">
  <a href="/Student/CreateReport" className="create-report-btn">
    <span className="btn-long">+ Create</span>
    <span className="btn-short">+ Create Report</span>
  </a>
</div>

        </div>

        {!isLoaded && <p>Loading...</p>}

        {loadError && (
          <div className="load-error-banner">
            {loadError}
            <button onClick={() => userEmail && location.reload()}>Retry</button>
          </div>
        )}

        {reports.length > 0 && (
          <div className="reports-two-column">
            {/* LEFT LIST */}
            <div className="reports-list-column">
              <div className="reports-list">
                {paginatedReports.map((report) => {
                  const isActive =
                    selectedReport && selectedReport._id === report._id;

                  const latestComment =
                    report.comments?.[report.comments.length - 1] || null;

                  return (
                    <div
                      key={report._id}
                      className={`report ${isActive ? "report--active" : ""}`}
                      onClick={() => {
                        setSelectedReport(report);
                        if (isMobile) window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <div className="report-img-container">
                        <img
                          src={report.ImageFile || report.image || defaultImg}
                          alt="Report"
                          className="report-img"
                          onError={(e) =>
                            ((e.target as HTMLImageElement).src = defaultImg)
                          }
                        />
                      </div>

                      <div className="report-body">
                        <div className="report-header-row">
                          <h3>{report.heading || "Untitled report"}</h3>
                        </div>

                        <div
                          className={`status-focus-row status-focus-${getStatusClassKey(
                            report.status
                          )}`}
                        >
                          <span className="status-focus-label">Status</span>
                          {renderStatusPill(report.status)}
                        </div>

                        <p className="report-description">
                          {report.description || "No description provided."}
                        </p>

                        <div className="report-info">
                          <p><strong>Building:</strong> {formatBuilding(report)}</p>
                          <p><strong>Concern:</strong> {formatConcern(report)}</p>
                          <p><strong>College:</strong> {report.college}</p>
                        </div>

                        <p className="submitted-date">
                          {report.createdAt &&
                            new Date(report.createdAt).toLocaleDateString()}{" "}
                          {report.createdAt &&
                            `(${getRelativeTime(report.createdAt)})`}
                        </p>

                        {latestComment && (
                          <p className="report-comment-preview">
                            <strong>Latest comment:</strong>{" "}
                            {latestComment.text || latestComment.comment}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* PAGINATION */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      className={`page-btn ${currentPage === i + 1 ? "active" : ""}`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}

                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT DETAILS (DESKTOP) */}
            {!isMobile && selectedReport && (
              <div className="report-details-column">
                <h2 className="column-title">Details and comments</h2>
                {renderDetailsContent(selectedReport)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MOBILE MODAL */}
      {isMobile && selectedReport && (
        <div
          className="report-modal-backdrop"
          onClick={() => setSelectedReport(null)}
        >
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedReport.heading}</h2>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedReport(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <div className="modal-img-wrapper">
                <img
                  src={
                    selectedReport.ImageFile ||
                    selectedReport.image ||
                    defaultImg
                  }
                  alt="Report"
                  className="report-img-clickable"
                  onClick={() =>
                    setFullscreenImage(
                      selectedReport.ImageFile ||
                        selectedReport.image ||
                        defaultImg
                    )
                  }
                  onError={(e) => ((e.target as HTMLImageElement).src = defaultImg)}
                />
              </div>

              <div className="modal-info">
                <div className="status-panel">
                  <div className="status-panel-header">
                    <span className="status-panel-title">Current status</span>
                    {renderStatusPill(selectedReport.status)}
                  </div>
                  <div className="status-row-inline">
                    <span className="status-row-label">
                      Submitted {getRelativeTime(selectedReport.createdAt)}
                    </span>
                  </div>
                </div>

                <p className="modal-description">
                  {selectedReport.description || "No description provided."}
                </p>

                <div className="modal-meta-grid">
                  <p><strong>Building:</strong> {formatBuilding(selectedReport)}</p>
                  <p><strong>Concern:</strong> {formatConcern(selectedReport)}</p>
                  <p><strong>College:</strong> {selectedReport.college}</p>
                  <p><strong>Email:</strong> {selectedReport.email}</p>
                </div>

                <div className="comments-section comments-section--static">
                  <h3>Comments</h3>

                  {selectedReport.comments?.length ? (
                    <ul className="comments-list">
                      {selectedReport.comments.map((c, idx) => (
                        <li key={idx} className="comment-item">
                          <p className="comment-text">
                            {c.text || c.comment}
                          </p>
                          <div>
                            {c.at && (
                              <span className="comment-date">
                                {new Date(c.at).toLocaleString()}{" "}
                              </span>
                            )}
                            {c.by && <span className="comment-date">by {c.by}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-comments">No comments yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE OVERLAY (DESKTOP + MOBILE) */}
      {fullscreenImage && (
        <div
          className="image-fullscreen-backdrop"
          onClick={() => setFullscreenImage(null)}
        >
          <img
            src={fullscreenImage}
            className="image-fullscreen-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
