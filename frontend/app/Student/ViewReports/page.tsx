"use client";

import "@/app/style/reports.css";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";

const defaultImg = "/default.jpg";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

/* ── Types ── */
type Comment = { text?: string; comment?: string; at?: string; by?: string; };
type HistoryEntry = { status: string; at: string; by?: string; note?: string; };

type Report = {
  _id: string;
  reportId?: string;
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
  updatedAt?: string;
  comments?: Comment[];
  history?: HistoryEntry[];
};

type MetaStatus = { id: string; name: string; color: string; };

/* ── Helpers ── */
const formatConcern = (r: Report) => {
  const base = r.concern || "Unspecified";
  const sub  = r.subConcern || r.otherConcern;
  return sub ? `${base} · ${sub}` : base;
};

const formatBuilding = (r: Report) => {
  const raw   = r.building || "Unspecified";
  const label = raw.toLowerCase() === "other" && r.otherBuilding ? r.otherBuilding : raw;
  const room  = r.room || r.otherRoom;
  return room ? `${label} · ${room}` : label;
};

function getRelativeTime(d?: string) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const diff = Math.max(0, Date.now() - date.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60)   return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const dy = Math.floor(h / 24);
  if (dy < 30)  return `${dy}d ago`;
  const mo = Math.floor(dy / 30);
  if (mo < 12)  return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

const FALLBACK_STATUSES: MetaStatus[] = [
  { id: "1", name: "Pending",         color: "#F59E0B" },
  { id: "2", name: "Pending Inspect", color: "#EAB308" },
  { id: "3", name: "In Progress",     color: "#3B82F6" },
  { id: "4", name: "Resolved",        color: "#22C55E" },
  { id: "5", name: "Archived",        color: "#6B7280" },
];

const REPORTS_PER_PAGE = 10;

// Helper function to get last visible status
const getLastVisibleStatus = (report: Report, hiddenStatuses: string[]): string => {
  if (!hiddenStatuses.includes(report.status || "Pending")) {
    return report.status || "Pending";
  }
  if (report.history && report.history.length > 0) {
    for (let i = report.history.length - 1; i >= 0; i--) {
      if (!hiddenStatuses.includes(report.history[i].status)) {
        return report.history[i].status;
      }
    }
  }
  return "Pending";
};

/* ── Timeline builder ── */
function buildTimeline(report: Report): HistoryEntry[] {
  if (report.history?.length) {
    return [...report.history].sort((a, b) => +new Date(a.at) - +new Date(b.at));
  }
  const entries: HistoryEntry[] = [];
  if (report.createdAt) entries.push({ status: "Submitted", at: report.createdAt, by: "You", note: "Report submitted." });
  (report.comments || []).forEach(c => {
    if (c.at) entries.push({ status: "Update", at: c.at, by: c.by || "Staff", note: c.text || c.comment || "" });
  });
  if (report.status && report.status !== "Pending" && report.updatedAt)
    entries.push({ status: report.status, at: report.updatedAt, by: "Admin" });
  return entries.sort((a, b) => +new Date(a.at) - +new Date(b.at));
}

function buildStatusFlow(statuses: MetaStatus[], hiddenStatuses: string[]) {
  return statuses.filter(s => 
    s.name.toLowerCase() !== "archived" && 
    !hiddenStatuses.includes(s.name)
  );
}

function getStepState(stepName: string, current: string, statuses: MetaStatus[], hiddenStatuses: string[]): "completed" | "active" | "pending" {
  const flow = buildStatusFlow(statuses, hiddenStatuses);
  const ci = flow.findIndex(s => s.name === current);
  const si = flow.findIndex(s => s.name === stepName);
  if (si < ci) return "completed";
  if (si === ci) return "active";
  return "pending";
}

/* ── Toast ── */
type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType };
let _toastId = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, show, dismiss };
}

/* ══════════════════════════════════════════════════════════ */
export default function StudentReportPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();

  const [userEmail,       setUserEmail]       = useState<string | null>(null);
  const [reports,         setReports]         = useState<Report[]>([]);
  const [selectedReport,  setSelectedReport]  = useState<Report | null>(null);
  const [loadError,       setLoadError]       = useState("");
  const [isLoading,       setIsLoading]       = useState(false);
  const [currentPage,     setCurrentPage]     = useState(1);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isMobile,        setIsMobile]        = useState(false);
  const [mounted,         setMounted]         = useState(false);
  const [metaStatuses,    setMetaStatuses]    = useState<MetaStatus[]>(FALLBACK_STATUSES);
  const [hiddenStudentStatuses, setHiddenStudentStatuses] = useState<string[]>([]);
  const [followUpSending, setFollowUpSending] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const upd = () => setIsMobile(window.innerWidth <= 768);
    upd(); window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  useEffect(() => {
    document.body.style.overflow = (!!fullscreenImage || (isMobile && !!selectedReport)) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [fullscreenImage, isMobile, selectedReport]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (fullscreenImage)                    { setFullscreenImage(null); return; }
      if (isMobile && selectedReport)         { setSelectedReport(null); return; }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [fullscreenImage, isMobile, selectedReport]);

  /* ── Auth ── */
  useEffect(() => {
    if (!isLoaded || !user) return;
    const role = user.publicMetadata?.role;
    if (role === "admin") { router.push("/Admin/"); return; }
    if (role === "staff") { router.push("/Staff/"); return; }
    const email = 
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses[0]?.emailAddress ||
      user.username ||
      "";
    setUserEmail(email);
  }, [user, isLoaded, router]);

  /* ── Fetch meta ── */
  useEffect(() => {
    fetch(`${API_BASE}/api/meta?ts=${Date.now()}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { 
        if (d?.statuses?.length > 0) setMetaStatuses(d.statuses);
        if (d?.hiddenStudentStatuses && Array.isArray(d.hiddenStudentStatuses)) {
          setHiddenStudentStatuses(d.hiddenStudentStatuses);
        }
      })
      .catch(() => {});
  }, []);

  /* ── Fetch reports ── */
  useEffect(() => {
    if (!userEmail) return;
    (async () => {
      try {
        setIsLoading(true); setLoadError("");
        const res  = await fetch(`${API_BASE}/api/reports`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) { setLoadError("Failed to load reports."); setReports([]); return; }
        const list: Report[] = Array.isArray(data) ? data : Array.isArray(data.reports) ? data.reports : Array.isArray(data.data) ? data.data : [];
        const filtered = list.filter(r => r.email?.toLowerCase() === userEmail.toLowerCase() && r.status !== "Archived");
        setReports(filtered);
        setSelectedReport(filtered[0] || null);
        setCurrentPage(1);
      } catch { setLoadError("Network error loading reports."); }
      finally { setIsLoading(false); }
    })();
  }, [userEmail]);

  const getStatusColor = useCallback((name?: string) =>
    metaStatuses.find(s => s.name === (name || "Pending"))?.color || "#6B7280"
  , [metaStatuses]);

  /* ── Follow up ── */
  const handleFollowUp = async (report: Report) => {
    if (followUpSending) return;
    try {
      setFollowUpSending(report._id);
      const res  = await fetch(`${API_BASE}/api/reports/${report._id}/followup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.reportId || report._id, email: report.email, heading: report.heading, by: userEmail }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Failed.");
      showToast("Follow-up notification sent to staff!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to send follow-up.", "error");
    } finally { setFollowUpSending(null); }
  };

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(reports.length / REPORTS_PER_PAGE));
  const startIdx   = (currentPage - 1) * REPORTS_PER_PAGE;
  const paginated  = reports.slice(startIdx, startIdx + REPORTS_PER_PAGE);

  /* ── Inline Progress Stepper ── */
  const renderProgressStepper = (report: Report) => {
    const flow = buildStatusFlow(metaStatuses, hiddenStudentStatuses);
    const displayStatus = getLastVisibleStatus(report, hiddenStudentStatuses);
    const timeline = buildTimeline(report).filter(entry => !hiddenStudentStatuses.includes(entry.status));

    return (
      <div className="sr-progress-section">
        <div className="sr-stepper">
          {flow.map((step, idx) => {
            const state = getStepState(step.name, displayStatus, metaStatuses, hiddenStudentStatuses);
            const isLast = idx === flow.length - 1;
            return (
              <React.Fragment key={step.id}>
                <div className={`sr-step sr-step--${state}`}>
                  <div
                    className="sr-step-circle"
                    style={
                      state === "completed" ? { backgroundColor: step.color, borderColor: step.color } :
                      state === "active"    ? { borderColor: step.color, boxShadow: `0 0 0 3px ${step.color}30` } :
                      {}
                    }
                  >
                    {state === "completed" ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : state === "active" ? (
                      <div className="sr-step-dot" style={{ backgroundColor: step.color }} />
                    ) : null}
                  </div>
                  <span
                    className="sr-step-label"
                    style={state !== "pending" ? { color: step.color, fontWeight: 700 } : {}}
                  >
                    {step.name}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className="sr-step-connector"
                    style={{ backgroundColor: state === "completed" ? step.color : "#e5e7eb" }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {timeline.length > 0 && (
          <div className="sr-timeline">
            <p className="sr-timeline-title">History</p>
            {timeline.map((entry, idx) => {
              const color  = metaStatuses.find(s => s.name === entry.status)?.color || "#6b7280";
              const isLast = idx === timeline.length - 1;
              return (
                <div key={idx} className="sr-timeline-item">
                  <div className="sr-timeline-track">
                    <div className="sr-timeline-dot" style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}25` }} />
                    {!isLast && <div className="sr-timeline-line" />}
                  </div>
                  <div className="sr-timeline-body">
                    <div className="sr-timeline-row">
                      <span className="sr-timeline-badge" style={{ backgroundColor: color + "20", color, border: `1px solid ${color}40` }}>
                        {entry.status}
                      </span>
                      <span className="sr-timeline-time">{getRelativeTime(entry.at)}</span>
                    </div>
                    {entry.note && <p className="sr-timeline-note">{entry.note}</p>}
                    {(entry.by || entry.at) && (
                      <p className="sr-timeline-meta">
                        {entry.by && `by ${entry.by}`}
                        {entry.by && entry.at && " · "}
                        {entry.at && new Date(entry.at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /* ── Details content ── */
  const renderDetails = (report: Report) => {
    const displayStatus = getLastVisibleStatus(report, hiddenStudentStatuses);
    
    return (
      <div className="sr-details">
        {/* Top bar: status + actions */}
        <div className="sr-details-topbar">
          <div className="sr-status-pill" style={{ backgroundColor: getStatusColor(displayStatus) + "22", color: getStatusColor(displayStatus), border: `1px solid ${getStatusColor(displayStatus)}55` }}>
            {displayStatus}
          </div>
          <div className="sr-details-actions">
            <button
              type="button"
              className={`sr-followup-btn${followUpSending === report._id ? " sr-followup-btn--loading" : ""}`}
              onClick={() => handleFollowUp(report)}
              disabled={!!followUpSending}
            >
              <svg width="13" height="13" viewBox="0 0 448 512" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"/>
              </svg>
              {followUpSending === report._id ? "Sending…" : "Follow Up"}
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="sr-img-wrap">
          <img
            src={report.ImageFile || report.image || defaultImg}
            alt="Report"
            className="sr-img"
            onClick={() => setFullscreenImage(report.ImageFile || report.image || defaultImg)}
            onError={e => { (e.target as HTMLImageElement).src = defaultImg; }}
          />
          <span className="sr-img-hint">Click to enlarge</span>
        </div>

        {/* Meta */}
        <h3 className="sr-details-heading">{report.heading}</h3>
        <p className="sr-details-desc">{report.description || "No description provided."}</p>

        <div className="sr-meta-grid">
          <div className="sr-meta-item">
            <span className="sr-meta-key">Building & Facilities</span>
            <span className="sr-meta-val">{formatBuilding(report)}</span>
          </div>
          <div className="sr-meta-item">
            <span className="sr-meta-key">Concern</span>
            <span className="sr-meta-val">{formatConcern(report)}</span>
          </div>
          <div className="sr-meta-item">
            <span className="sr-meta-key">College</span>
            <span className="sr-meta-val">{report.college || "—"}</span>
          </div>
          <div className="sr-meta-item">
            <span className="sr-meta-key">Submitted</span>
            <span className="sr-meta-val">{report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "—"} <span className="sr-meta-rel">({getRelativeTime(report.createdAt)})</span></span>
          </div>
        </div>

        {/* INLINE PROGRESS */}
        {renderProgressStepper(report)}

        {/* Comments (read-only) */}
        <div className="sr-comments">
          <div className="sr-comments-header">
            <span className="sr-comments-title">Staff Comments</span>
            {(report.comments?.length || 0) > 0 && (
              <span className="sr-comments-count">{report.comments!.length}</span>
            )}
          </div>
          {report.comments && report.comments.length > 0 ? (
            <ul className="sr-comments-list">
              {report.comments.map((c, idx) => (
                <li key={idx} className="sr-comment">
                  <p className="sr-comment-text">{c.text || c.comment}</p>
                  <div className="sr-comment-meta">
                    {c.by && <span className="sr-comment-by">{c.by}</span>}
                    {c.at && <span className="sr-comment-time">{new Date(c.at).toLocaleString()}</span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sr-comments-empty">No comments yet. Staff will update you here.</p>
          )}
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="sr-wrapper">
        {/* Page header */}
        <div className="sr-header">
          <div>
            <h1 className="sr-title">My Reports</h1>
            <p className="sr-subtitle">Track all your submitted facility reports.</p>
          </div>
          <a href="/Student/CreateReport" className="sr-create-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Report
          </a>
        </div>

        {/* States */}
        {!isLoaded && (
          <div className="sr-shimmer-grid">
            {[...Array(4)].map((_, i) => <div key={i} className="sr-shimmer" />)}
          </div>
        )}

        {loadError && (
          <div className="sr-error">
            {loadError}
            <button type="button" onClick={() => userEmail && location.reload()}>Retry</button>
          </div>
        )}

        {isLoaded && !loadError && reports.length === 0 && (
          <div className="sr-empty">
            <svg viewBox="0 0 64 64" fill="none" width="56" height="56">
              <rect x="8" y="8" width="48" height="48" rx="10" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
              <path d="M22 32h20M32 22v20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
            </svg>
            <p>No reports yet</p>
            <span>Submit your first facility issue to get started.</span>
            <a href="/Student/CreateReport" className="sr-create-btn" style={{ marginTop: 12 }}>+ Create Report</a>
          </div>
        )}

        {reports.length > 0 && (
          <div className="sr-layout">
            {/* LEFT: Report list */}
            <div className="sr-list-col">
              {paginated.map(report => {
                const isActive = selectedReport?._id === report._id;
                const displayStatusForCard = getLastVisibleStatus(report, hiddenStudentStatuses);
                const color = getStatusColor(displayStatusForCard);
                const latest = report.comments?.[report.comments.length - 1];
                const flow = buildStatusFlow(metaStatuses, hiddenStudentStatuses);
                const currentIdx = flow.findIndex(s => s.name === displayStatusForCard);
                const progress = flow.length > 1 ? Math.round(((currentIdx < 0 ? 0 : currentIdx) / (flow.length - 1)) * 100) : 0;

                return (
                  <div
                    key={report._id}
                    className={`sr-card${isActive ? " sr-card--active" : ""}`}
                    style={isActive ? { borderColor: color, boxShadow: `0 0 0 2px ${color}30` } : {}}
                    onClick={() => { setSelectedReport(report); if (isMobile) window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  >
                    <div className="sr-card-stripe" style={{ backgroundColor: color }} />
                    <div className="sr-card-inner">
                      <div className="sr-card-img-wrap">
                        <img
                          src={report.ImageFile || report.image || defaultImg}
                          alt="Report" className="sr-card-img"
                          onError={e => { (e.target as HTMLImageElement).src = defaultImg; }}
                        />
                      </div>
                      <div className="sr-card-body">
                        <div className="sr-card-head">
                          <h3 className="sr-card-title">{report.heading || "Untitled report"}</h3>
                          <span className="sr-card-pill" style={{ backgroundColor: color + "20", color, border: `1px solid ${color}40` }}>
                            {displayStatusForCard}
                          </span>
                        </div>
                        {report.reportId && <p className="sr-card-id">#{report.reportId}</p>}
                        <p className="sr-card-desc">{report.description || "No description."}</p>
                        <div className="sr-card-info">
                          <span>{formatBuilding(report)}</span>
                          <span className="sr-card-sep">·</span>
                          <span>{formatConcern(report)}</span>
                        </div>
                        <div className="sr-card-progress">
                          <div className="sr-card-progress-track">
                            <div
                              className="sr-card-progress-fill"
                              style={{ width: `${progress}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="sr-card-progress-label" style={{ color }}>
                            {progress === 100 ? "Done" : `${progress}%`}
                          </span>
                        </div>
                        <div className="sr-card-footer">
                          <span className="sr-card-time">{getRelativeTime(report.createdAt)}</span>
                          {latest && (
                            <span className="sr-card-latest">
                              {latest.text || latest.comment}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="sr-pagination">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} className={currentPage === i + 1 ? "active" : ""} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                  ))}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
                </div>
              )}
            </div>

            {/* RIGHT: Detail panel (desktop) */}
            {!isMobile && selectedReport && (
              <div className="sr-detail-col">
                {renderDetails(selectedReport)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MOBILE DETAIL MODAL */}
      {isMobile && selectedReport && (
        <div className="sr-modal-backdrop" onClick={() => setSelectedReport(null)}>
          <div className="sr-modal" onClick={e => e.stopPropagation()}>
            <div className="sr-modal-header">
              <div>
                <h2 className="sr-modal-title">{selectedReport.heading}</h2>
                {selectedReport.reportId && <span className="sr-modal-id">#{selectedReport.reportId}</span>}
              </div>
              <button className="sr-modal-close" onClick={() => setSelectedReport(null)}>✕</button>
            </div>
            <div className="sr-modal-body">
              {renderDetails(selectedReport)}
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE */}
      {fullscreenImage && (
        <div className="sr-fullscreen" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} className="sr-fullscreen-img" onClick={e => e.stopPropagation()} />
          <button className="sr-fullscreen-close" onClick={() => setFullscreenImage(null)}>✕</button>
        </div>
      )}

      {/* TOASTS */}
      {mounted && createPortal(
        <div className="sr-toast-container" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className={`sr-toast sr-toast--${t.type}`}>
              <span>{t.message}</span>
              <button type="button" onClick={() => dismissToast(t.id)}>✕</button>
            </div>
          ))}
        </div>, document.body
      )}
    </>
  );
}