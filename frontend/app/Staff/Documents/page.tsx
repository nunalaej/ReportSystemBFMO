// app/Admin/Documents/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

type Doc = {
  _id: string; title: string; description: string; category: string;
  fileUrl: string; fileName: string; fileSize: number;
  published: boolean; pinned: boolean; uploadedBy: string;
  createdAt: string; updatedAt: string;
};

const CATEGORIES = ["General", "Forms", "Guidelines", "Policies", "Announcements", "Other"];

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  Forms:         { icon: "📋", color: "#3b82f6" },
  Guidelines:    { icon: "📖", color: "#8b5cf6" },
  Policies:      { icon: "⚖️", color: "#ef4444" },
  Announcements: { icon: "📢", color: "#f59e0b" },
  General:       { icon: "📄", color: "#059669" },
  Other:         { icon: "📎", color: "#6b7280" },
};
const getMeta = (cat: string) => CATEGORY_META[cat] || CATEGORY_META["Other"];

function fmtSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getPdfIframeSrc(url: string) {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/* ── Toast ── */
type ToastType = "success" | "error" | "info";
let _tid = 0;
function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: ToastType }[]>([]);
  const show = useCallback((msg: string, type: ToastType = "success") => {
    const id = ++_tid;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, show, dismiss };
}

/* ── Toggle ── */
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div onClick={onChange} role="switch" aria-checked={on} tabIndex={0}
      onKeyDown={e => e.key === " " && onChange()}
      style={{ width: 36, height: 20, borderRadius: 999, flexShrink: 0, background: on ? "#029006" : "var(--tasks-border,#3a4a5a)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
      <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }}/>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════ */
export default function AdminDocumentsPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const [canView,   setCanView]   = useState(false);
  const [docs,      setDocs]      = useState<Doc[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [mounted,   setMounted]   = useState(false);
  useEffect(() => setMounted(true), []);

  /* ── Upload state ── */
  const [showUpload,  setShowUpload]  = useState(false);
  const [uploadFile,  setUploadFile]  = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc,  setUploadDesc]  = useState("");
  const [uploadCat,   setUploadCat]   = useState("General");
  const [uploadPub,   setUploadPub]   = useState(true);
  const [uploadPin,   setUploadPin]   = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [dragOver,    setDragOver]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Edit state ── */
  const [editDoc,    setEditDoc]    = useState<Doc | null>(null);
  const [editTitle,  setEditTitle]  = useState("");
  const [editDesc,   setEditDesc]   = useState("");
  const [editCat,    setEditCat]    = useState("General");
  const [editPub,    setEditPub]    = useState(true);
  const [editPin,    setEditPin]    = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteDoc,     setDeleteDoc]     = useState<Doc | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [previewDoc,    setPreviewDoc]    = useState<Doc | null>(null);

  const { toasts, show: showToast, dismiss } = useToast();

  /* ── Auth ── */
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { router.replace("/"); return; }
    const rawRole = (user.publicMetadata as any)?.role;
    const role = Array.isArray(rawRole) ? String(rawRole[0]).toLowerCase() : typeof rawRole === "string" ? rawRole.toLowerCase() : "";
    if (role !== "staff" && role !== "admin") { router.replace("/Student"); return; }
    setCanView(true);
  }, [isLoaded, isSignedIn, user, router]);

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/api/documents?all=1&ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) setDocs(data.documents || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (canView) fetchDocs(); }, [canView]);

  useEffect(() => {
    document.body.style.overflow = (showUpload || !!editDoc || !!deleteDoc || !!previewDoc) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showUpload, editDoc, deleteDoc, previewDoc]);

  const filtered = docs.filter(d => {
    const sm = !search.trim() ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase());
    return sm && (catFilter === "All" || d.category === catFilter);
  });

  const resetUpload = () => {
    setUploadFile(null); setUploadTitle(""); setUploadDesc("");
    setUploadCat("General"); setUploadPub(true); setUploadPin(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") {
      setUploadFile(file);
      if (!uploadTitle) setUploadTitle(file.name.replace(/\.pdf$/i, "").replace(/_/g, " "));
    } else showToast("Only PDF files are allowed.", "error");
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setUploadFile(file); if (!uploadTitle) setUploadTitle(file.name.replace(/\.pdf$/i, "").replace(/_/g, " ")); }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) { showToast("Title and PDF required.", "error"); return; }
    try {
      setUploading(true);
      const form = new FormData();
      form.append("pdf", uploadFile);
      form.append("title", uploadTitle.trim());
      form.append("description", uploadDesc.trim());
      form.append("category", uploadCat);
      form.append("published", String(uploadPub));
      form.append("pinned", String(uploadPin));
      form.append("uploadedBy", user?.fullName || "Admin");
      const res  = await fetch(`${API_BASE}/api/documents`, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Upload failed.");
      showToast(`"${uploadTitle}" uploaded.`, "success");
      setDocs(p => [data.document, ...p]);
      setShowUpload(false); resetUpload();
    } catch (e: any) { showToast(e.message || "Upload failed.", "error"); }
    finally { setUploading(false); }
  };

  const openEdit = (doc: Doc) => {
    setEditDoc(doc); setEditTitle(doc.title); setEditDesc(doc.description);
    setEditCat(doc.category); setEditPub(doc.published); setEditPin(doc.pinned);
  };

  const handleEdit = async () => {
    if (!editDoc || !editTitle.trim()) { showToast("Title required.", "error"); return; }
    try {
      setEditSaving(true);
      const res  = await fetch(`${API_BASE}/api/documents/${editDoc._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), description: editDesc.trim(), category: editCat, published: editPub, pinned: editPin }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed.");
      setDocs(p => p.map(d => d._id === editDoc._id ? data.document : d));
      showToast("Document updated.", "success"); setEditDoc(null);
    } catch (e: any) { showToast(e.message || "Failed.", "error"); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    try {
      setDeleteLoading(true);
      const res  = await fetch(`${API_BASE}/api/documents/${deleteDoc._id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed.");
      setDocs(p => p.filter(d => d._id !== deleteDoc._id));
      showToast("Document deleted.", "success"); setDeleteDoc(null);
    } catch (e: any) { showToast(e.message || "Failed.", "error"); }
    finally { setDeleteLoading(false); }
  };

  const toggleField = async (doc: Doc, field: "published" | "pinned") => {
    try {
      const res  = await fetch(`${API_BASE}/api/documents/${doc._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !doc[field] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setDocs(p => p.map(d => d._id === doc._id ? data.document : d));
      showToast(`${field === "published" ? (data.document.published ? "Published" : "Unpublished") : (data.document.pinned ? "Pinned" : "Unpinned")}.`, "success");
    } catch { showToast("Failed.", "error"); }
  };

  if (!isLoaded || !canView) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--tasks-text-4,#b8c4ce)" }}>Loading…</div>
  );

  const catCounts = docs.reduce<Record<string, number>>((acc, d) => { acc[d.category] = (acc[d.category] || 0) + 1; return acc; }, {});

  /* ── Shared input style using CSS vars ── */
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid var(--tasks-border,#3a4a5a)",
    background: "var(--tasks-surface-2,#0f1925)",
    color: "var(--tasks-text-1,#e2e8f0)",
    fontSize: "0.88rem", outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: "0.72rem", fontWeight: 700,
    color: "var(--tasks-text-3,#8a97a8)",
    display: "block", marginBottom: 5,
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  /* ── Modal wrapper ── */
  const ModalWrap = ({ children, onClose, maxWidth = 520, danger = false }: {
    children: React.ReactNode; onClose: () => void; maxWidth?: number; danger?: boolean;
  }) => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--tasks-card,#1a2535)",
        borderRadius: 16,
        border: `1px solid ${danger ? "#ef444455" : "var(--tasks-border,#2a3a4a)"}`,
        width: "100%", maxWidth,
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        {children}
      </div>
    </div>
  );

  const ModalHeader = ({ title, onClose }: { title: string; onClose: () => void }) => (
    <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--tasks-border,#2a3a4a)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
      <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--tasks-text-1,#e2e8f0)" }}>{title}</h2>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tasks-text-3,#8a97a8)", fontSize: "1.1rem", lineHeight: 1 }}>✕</button>
    </div>
  );

  return (
    <>
      <div style={{ padding: "24px 28px", maxWidth: 1240, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, color: "var(--tasks-text-1,#e2e8f0)" }}>Documents</h1>
            <p style={{ margin: "4px 0 0", fontSize: "0.83rem", color: "var(--tasks-text-3,#8a97a8)" }}>Manage PDF files visible to students and staff.</p>
          </div>
          <button onClick={() => setShowUpload(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 10, background: "#029006", color: "#fff", border: "none", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", boxShadow: "0 2px 10px rgba(2,144,6,0.3)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Upload Document
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10, marginBottom: 22 }}>
          {[
            { label: "Total",     value: docs.length,                          color: "var(--tasks-text-1,#e2e8f0)" },
            { label: "Published", value: docs.filter(d => d.published).length,  color: "#029006" },
            { label: "Drafts",    value: docs.filter(d => !d.published).length, color: "#f59e0b" },
            { label: "Pinned",    value: docs.filter(d => d.pinned).length,     color: "#3b82f6" },
          ].map(s => (
            <div key={s.label} style={{
              background: "var(--tasks-surface,#131f2e)",
              borderRadius: 10, padding: "14px 16px",
              border: "1px solid var(--tasks-border,#2a3a4a)",
            }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--tasks-text-3,#8a97a8)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1", minWidth: 200 }}>
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--tasks-text-4,#b8c4ce)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 32 }}/>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["All", ...CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{
                padding: "6px 14px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600,
                border: `1px solid ${catFilter === cat ? "#029006" : "var(--tasks-border,#2a3a4a)"}`,
                cursor: "pointer",
                background: catFilter === cat ? "#02900622" : "var(--tasks-surface,#131f2e)",
                color: catFilter === cat ? "#029006" : "var(--tasks-text-3,#8a97a8)",
                transition: "all 0.15s",
              }}>
                {cat !== "All" && getMeta(cat).icon + " "}{cat}{cat !== "All" && catCounts[cat] ? ` (${catCounts[cat]})` : ""}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: 60, borderRadius: 10, background: "var(--tasks-surface,#131f2e)", border: "1px solid var(--tasks-border,#2a3a4a)", opacity: 0.6 }}/>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--tasks-text-4,#b8c4ce)" }}>
            <div style={{ fontSize: "3rem", marginBottom: 10 }}>📂</div>
            <p style={{ margin: 0, fontSize: "0.92rem" }}>{search || catFilter !== "All" ? "No documents match your filters." : "No documents uploaded yet."}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: 12, overflow: "hidden", border: "1px solid var(--tasks-border,#2a3a4a)" }}>
            {/* Column header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 90px 60px 100px 90px 110px", gap: 8, padding: "10px 16px", background: "var(--tasks-surface,#131f2e)", fontSize: "0.68rem", fontWeight: 700, color: "var(--tasks-text-4,#b8c4ce)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--tasks-border,#2a3a4a)" }}>
              <span>Document</span><span>Category</span><span>Size</span>
              <span>Pin</span><span>Published</span><span>Date</span><span style={{ textAlign: "right" }}>Actions</span>
            </div>

            {filtered.map((doc, idx) => {
              const meta = getMeta(doc.category);
              return (
                <div key={doc._id} style={{
                  display: "grid", gridTemplateColumns: "1fr 130px 90px 60px 100px 90px 110px",
                  gap: 8, alignItems: "center", padding: "13px 16px",
                  background: idx % 2 === 0 ? "var(--tasks-surface,#131f2e)" : "var(--tasks-surface-2,#0f1925)",
                  borderBottom: idx < filtered.length - 1 ? "1px solid var(--tasks-border,#1e2d3d)" : "none",
                  transition: "background 0.1s",
                }}>
                  {/* Title */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "1rem", flexShrink: 0 }}>{meta.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: "0.87rem", color: "var(--tasks-text-1,#e2e8f0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</span>
                      {!doc.published && <span style={{ fontSize: "0.63rem", background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44", borderRadius: 999, padding: "1px 7px", fontWeight: 700, flexShrink: 0 }}>Draft</span>}
                      {doc.pinned && <span style={{ fontSize: "0.63rem", background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644", borderRadius: 999, padding: "1px 7px", fontWeight: 700, flexShrink: 0 }}>📌 Pinned</span>}
                    </div>
                    {doc.description && <p style={{ margin: "3px 0 0 24px", fontSize: "0.73rem", color: "var(--tasks-text-4,#b8c4ce)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{doc.description}</p>}
                  </div>

                  {/* Category */}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.74rem", color: meta.color, fontWeight: 600 }}>
                    {doc.category}
                  </span>

                  <span style={{ fontSize: "0.74rem", color: "var(--tasks-text-3,#8a97a8)" }}>{fmtSize(doc.fileSize)}</span>

                  {/* Pin */}
                  <button onClick={() => toggleField(doc, "pinned")} title={doc.pinned ? "Unpin" : "Pin"}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", opacity: doc.pinned ? 1 : 0.2, transition: "opacity 0.15s", padding: 0 }}>📌</button>

                  {/* Published toggle */}
                  <Toggle on={doc.published} onChange={() => toggleField(doc, "published")}/>

                  <span style={{ fontSize: "0.72rem", color: "var(--tasks-text-4,#b8c4ce)" }}>{fmtDate(doc.createdAt)}</span>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    {[
                      { title: "Preview", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>, fn: () => setPreviewDoc(doc), danger: false },
                      { title: "Edit", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, fn: () => openEdit(doc), danger: false },
                      { title: "Delete", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>, fn: () => setDeleteDoc(doc), danger: true },
                    ].map(btn => (
                      <button key={btn.title} onClick={btn.fn} title={btn.title} style={{
                        padding: "5px 7px", borderRadius: 6, cursor: "pointer",
                        border: `1px solid ${btn.danger ? "#ef444444" : "var(--tasks-border,#2a3a4a)"}`,
                        background: "transparent",
                        color: btn.danger ? "#ef4444" : "var(--tasks-text-3,#8a97a8)",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        transition: "background 0.15s",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = btn.danger ? "#ef444418" : "var(--tasks-surface-2,#0f1925)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {btn.icon}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ════ UPLOAD MODAL ════ */}
      {mounted && showUpload && createPortal(
        <ModalWrap onClose={() => { setShowUpload(false); resetUpload(); }}>
          <ModalHeader title="Upload Document" onClose={() => { setShowUpload(false); resetUpload(); }}/>
          <div style={{ padding: "20px 22px 24px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
            {/* Drop zone */}
            <div
              onDrop={handleFileDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragOver || uploadFile ? "#029006" : "var(--tasks-border,#2a3a4a)"}`, borderRadius: 12, padding: "22px 20px", textAlign: "center", cursor: "pointer", background: uploadFile ? "rgba(2,144,6,0.06)" : "var(--tasks-surface-2,#0f1925)", transition: "all 0.2s" }}
            >
              <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleFileInput}/>
              {uploadFile ? (
                <div>
                  <div style={{ fontSize: "2rem", marginBottom: 6 }}>📄</div>
                  <p style={{ margin: 0, fontWeight: 700, color: "#029006", fontSize: "0.88rem" }}>{uploadFile.name}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "0.73rem", color: "var(--tasks-text-4,#b8c4ce)" }}>{fmtSize(uploadFile.size)}</p>
                  <button type="button" onClick={e => { e.stopPropagation(); setUploadFile(null); }} style={{ marginTop: 8, fontSize: "0.72rem", background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>Remove</button>
                </div>
              ) : (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--tasks-text-3,#8a97a8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--tasks-text-1,#e2e8f0)", fontSize: "0.88rem" }}>Drop PDF here or click to browse</p>
                  <p style={{ margin: "4px 0 0", fontSize: "0.73rem", color: "var(--tasks-text-4,#b8c4ce)" }}>PDF only · max 20 MB</p>
                </>
              )}
            </div>
            <div><label style={fieldLabel}>Title *</label><input type="text" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Document title…" style={inputStyle}/></div>
            <div><label style={fieldLabel}>Description</label><textarea value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} rows={2} placeholder="Brief description…" style={{ ...inputStyle, resize: "none" } as React.CSSProperties}/></div>
            <div>
              <label style={fieldLabel}>Category</label>
              <select value={uploadCat} onChange={e => setUploadCat(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.82rem", color: "var(--tasks-text-1,#e2e8f0)" }}><Toggle on={uploadPub} onChange={() => setUploadPub(!uploadPub)}/> Publish immediately</label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.82rem", color: "var(--tasks-text-1,#e2e8f0)" }}><Toggle on={uploadPin} onChange={() => setUploadPin(!uploadPin)}/> Pin to top</label>
            </div>
            <button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadTitle.trim()} style={{
              padding: "12px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: "0.9rem",
              cursor: (!uploadFile || !uploadTitle.trim()) ? "not-allowed" : "pointer",
              background: (!uploadFile || !uploadTitle.trim()) ? "var(--tasks-border,#2a3a4a)" : "#029006",
              color: (!uploadFile || !uploadTitle.trim()) ? "var(--tasks-text-3,#8a97a8)" : "#fff",
              opacity: uploading ? 0.75 : 1, transition: "background 0.2s",
            }}>
              {uploading ? "Uploading…" : "Upload Document"}
            </button>
          </div>
        </ModalWrap>,
        document.body
      )}

      {/* ════ EDIT MODAL ════ */}
      {mounted && editDoc && createPortal(
        <ModalWrap maxWidth={480} onClose={() => setEditDoc(null)}>
          <ModalHeader title="Edit Document" onClose={() => setEditDoc(null)}/>
          <div style={{ padding: "20px 22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div><label style={fieldLabel}>Title *</label><input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={inputStyle}/></div>
            <div><label style={fieldLabel}>Description</label><textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} style={{ ...inputStyle, resize: "none" } as React.CSSProperties}/></div>
            <div>
              <label style={fieldLabel}>Category</label>
              <select value={editCat} onChange={e => setEditCat(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.82rem", color: "var(--tasks-text-1,#e2e8f0)" }}><Toggle on={editPub} onChange={() => setEditPub(!editPub)}/> Published</label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.82rem", color: "var(--tasks-text-1,#e2e8f0)" }}><Toggle on={editPin} onChange={() => setEditPin(!editPin)}/> Pinned</label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditDoc(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "var(--tasks-surface-2,#0f1925)", border: "1px solid var(--tasks-border,#2a3a4a)", color: "var(--tasks-text-2,#cbd5e1)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleEdit} disabled={editSaving || !editTitle.trim()} style={{ flex: 2, padding: "10px", borderRadius: 8, background: "#029006", color: "#fff", border: "none", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </ModalWrap>,
        document.body
      )}

      {/* ════ DELETE CONFIRM ════ */}
      {mounted && deleteDoc && createPortal(
        <ModalWrap maxWidth={400} onClose={() => setDeleteDoc(null)} danger>
          <div style={{ padding: 28 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🗑️</div>
              <h3 style={{ margin: 0, color: "var(--tasks-text-1,#e2e8f0)", fontSize: "1rem", fontWeight: 800 }}>Delete Document?</h3>
              <p style={{ margin: "10px 0 0", fontSize: "0.84rem", color: "var(--tasks-text-3,#8a97a8)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--tasks-text-1,#e2e8f0)" }}>{deleteDoc.title}</strong> will be permanently removed. This cannot be undone.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteDoc(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "var(--tasks-surface-2,#0f1925)", border: "1px solid var(--tasks-border,#2a3a4a)", color: "var(--tasks-text-2,#cbd5e1)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "#ef4444", color: "#fff", border: "none", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", opacity: deleteLoading ? 0.7 : 1 }}>
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </ModalWrap>,
        document.body
      )}

      {/* ════ PREVIEW MODAL ════ */}
      {mounted && previewDoc && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(4px)", zIndex: 9000, display: "flex", flexDirection: "column" }}
          onClick={() => setPreviewDoc(null)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "var(--tasks-card,#1a2535)", borderBottom: "1px solid var(--tasks-border,#2a3a4a)", flexShrink: 0 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{getMeta(previewDoc.category).icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "var(--tasks-text-1,#e2e8f0)", fontSize: "0.92rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewDoc.title}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--tasks-text-4,#b8c4ce)", marginTop: 1 }}>{previewDoc.category} · {fmtSize(previewDoc.fileSize)} · {fmtDate(previewDoc.createdAt)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#029006", color: "#fff", textDecoration: "none", fontSize: "0.8rem", fontWeight: 700 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button onClick={() => setPreviewDoc(null)} style={{ background: "none", border: "1px solid var(--tasks-border,#2a3a4a)", borderRadius: 8, cursor: "pointer", color: "var(--tasks-text-3,#8a97a8)", padding: "7px 13px", fontSize: "0.84rem", fontWeight: 600 }}>✕ Close</button>
            </div>
          </div>
          <div style={{ flex: 1, padding: 16, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <iframe src={getPdfIframeSrc(previewDoc.fileUrl)} style={{ width: "100%", height: "100%", border: "none", borderRadius: 8 }} title={previewDoc.title}/>
          </div>
          <div style={{ padding: "8px 20px", background: "var(--tasks-card,#1a2535)", borderTop: "1px solid var(--tasks-border,#2a3a4a)", textAlign: "center", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--tasks-text-4,#b8c4ce)" }}>
              PDF not loading? <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#029006", textDecoration: "none", fontWeight: 700 }}>Open in new tab ↗</a>
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* ── Toasts ── */}
      {mounted && createPortal(
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
          {toasts.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, background: t.type === "error" ? "#ef4444" : t.type === "info" ? "#3b82f6" : "#029006", color: "#fff", fontSize: "0.84rem", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", minWidth: 220 }}>
              <span style={{ flex: 1 }}>{t.msg}</span>
              <button onClick={() => dismiss(t.id)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.75, fontSize: "0.9rem" }}>✕</button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}