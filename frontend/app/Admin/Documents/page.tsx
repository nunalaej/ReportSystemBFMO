// app/Admin/Documents/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

/* ── Types ── */
type Doc = {
  _id: string; title: string; description: string; category: string;
  fileUrl: string; fileName: string; fileSize: number;
  published: boolean; pinned: boolean; uploadedBy: string;
  createdAt: string; updatedAt: string;
};

const CATEGORIES = ["General", "Forms", "Guidelines", "Policies", "Announcements", "Other"];

function fmtSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Google Docs viewer — most reliable way to embed PDFs from Cloudinary ── */
function getPdfIframeSrc(url: string): string {
  if (!url) return "";
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
}

/* ── Toast ── */
type ToastType = "success"|"error"|"info";
let _tid = 0;
function useToast() {
  const [toasts, setToasts] = useState<{id:number;msg:string;type:ToastType}[]>([]);
  const show = useCallback((msg: string, type: ToastType = "success") => {
    const id = ++_tid; setToasts(p => [...p, {id, msg, type}]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, show, dismiss };
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
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

  /* ── Upload modal state ── */
  const [showUpload,   setShowUpload]   = useState(false);
  const [uploadFile,   setUploadFile]   = useState<File|null>(null);
  const [uploadTitle,  setUploadTitle]  = useState("");
  const [uploadDesc,   setUploadDesc]   = useState("");
  const [uploadCat,    setUploadCat]    = useState("General");
  const [uploadPub,    setUploadPub]    = useState(true);
  const [uploadPin,    setUploadPin]    = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [dragOver,     setDragOver]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Edit modal state ── */
  const [editDoc,    setEditDoc]    = useState<Doc|null>(null);
  const [editTitle,  setEditTitle]  = useState("");
  const [editDesc,   setEditDesc]   = useState("");
  const [editCat,    setEditCat]    = useState("General");
  const [editPub,    setEditPub]    = useState(true);
  const [editPin,    setEditPin]    = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  /* ── Delete confirm ── */
  const [deleteDoc,    setDeleteDoc]    = useState<Doc|null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── Preview ── */
  const [previewDoc, setPreviewDoc] = useState<Doc|null>(null);

  const { toasts, show: showToast, dismiss } = useToast();

  /* ── Auth guard ── */
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { router.replace("/"); return; }
    const rawRole = (user.publicMetadata as any)?.role;
    const role = Array.isArray(rawRole) ? String(rawRole[0]).toLowerCase() : typeof rawRole === "string" ? rawRole.toLowerCase() : "";
    if (role !== "admin") { router.replace("/Student"); return; }
    setCanView(true);
  }, [isLoaded, isSignedIn, user, router]);

  /* ── Fetch docs ── */
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

  /* ── Body scroll lock ── */
  useEffect(() => {
    document.body.style.overflow = (showUpload || editDoc || deleteDoc || previewDoc) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showUpload, editDoc, deleteDoc, previewDoc]);

  /* ── Filtered ── */
  const filtered = docs.filter(d => {
    const sm = !search.trim() ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase());
    const cm = catFilter === "All" || d.category === catFilter;
    return sm && cm;
  });

  /* ── Upload ── */
  const resetUpload = () => { setUploadFile(null); setUploadTitle(""); setUploadDesc(""); setUploadCat("General"); setUploadPub(true); setUploadPin(false); };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") { setUploadFile(file); if (!uploadTitle) setUploadTitle(file.name.replace(/\.pdf$/i, "").replace(/_/g, " ")); }
    else showToast("Only PDF files are allowed.", "error");
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setUploadFile(file); if (!uploadTitle) setUploadTitle(file.name.replace(/\.pdf$/i, "").replace(/_/g, " ")); }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) { showToast("Title and PDF file are required.", "error"); return; }
    try {
      setUploading(true);
      const form = new FormData();
      form.append("pdf",         uploadFile);
      form.append("title",       uploadTitle.trim());
      form.append("description", uploadDesc.trim());
      form.append("category",    uploadCat);
      form.append("published",   String(uploadPub));
      form.append("pinned",      String(uploadPin));
      form.append("uploadedBy",  user?.fullName || "Admin");
      const res  = await fetch(`${API_BASE}/api/documents`, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Upload failed.");
      showToast(`"${uploadTitle}" uploaded successfully.`, "success");
      setDocs(p => [data.document, ...p]);
      setShowUpload(false); resetUpload();
    } catch (e: any) { showToast(e.message || "Upload failed.", "error"); }
    finally { setUploading(false); }
  };

  /* ── Edit ── */
  const openEdit = (doc: Doc) => { setEditDoc(doc); setEditTitle(doc.title); setEditDesc(doc.description); setEditCat(doc.category); setEditPub(doc.published); setEditPin(doc.pinned); };

  const handleEdit = async () => {
    if (!editDoc || !editTitle.trim()) { showToast("Title is required.", "error"); return; }
    try {
      setEditSaving(true);
      const res  = await fetch(`${API_BASE}/api/documents/${editDoc._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), description: editDesc.trim(), category: editCat, published: editPub, pinned: editPin }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed.");
      setDocs(p => p.map(d => d._id === editDoc._id ? data.document : d));
      showToast("Document updated.", "success");
      setEditDoc(null);
    } catch (e: any) { showToast(e.message || "Failed.", "error"); }
    finally { setEditSaving(false); }
  };

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!deleteDoc) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`${API_BASE}/api/documents/${deleteDoc._id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed.");
      setDocs(p => p.filter(d => d._id !== deleteDoc._id));
      showToast("Document deleted.", "success");
      setDeleteDoc(null);
    } catch (e: any) { showToast(e.message || "Failed.", "error"); }
    finally { setDeleteLoading(false); }
  };

  /* ── Toggle publish/pin ── */
  const toggleField = async (doc: Doc, field: "published"|"pinned") => {
    try {
      const res  = await fetch(`${API_BASE}/api/documents/${doc._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !doc[field] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setDocs(p => p.map(d => d._id === doc._id ? data.document : d));
      showToast(`Document ${field === "published" ? (data.document.published ? "published" : "unpublished") : (data.document.pinned ? "pinned" : "unpinned")}.`, "success");
    } catch { showToast("Failed to update.", "error"); }
  };

  if (!isLoaded || !canView) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--tasks-text-4,#b8c4ce)" }}>
      Loading…
    </div>
  );

  const catCounts = docs.reduce<Record<string, number>>((acc, d) => { acc[d.category] = (acc[d.category]||0)+1; return acc; }, {});

  /* ═══════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════ */
  return (
    <>
      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ fontSize:"1.6rem", fontWeight:800, margin:0, color:"var(--tasks-text-1,#e2e8f0)" }}>Documents</h1>
            <p style={{ margin:"4px 0 0", fontSize:"0.85rem", color:"var(--tasks-text-4,#b8c4ce)" }}>
              Manage PDF files visible to students and staff.
            </p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:10, background:"#029006", color:"#fff", border:"none", fontWeight:700, fontSize:"0.88rem", cursor:"pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Upload Document
          </button>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10, marginBottom:24 }}>
          {[
            { label:"Total",     value:docs.length,                       color:"#6b7280" },
            { label:"Published", value:docs.filter(d=>d.published).length, color:"#029006" },
            { label:"Drafts",    value:docs.filter(d=>!d.published).length,color:"#f59e0b" },
            { label:"Pinned",    value:docs.filter(d=>d.pinned).length,    color:"#3b82f6" },
          ].map(s => (
            <div key={s.label} style={{ background:"var(--tasks-card,#1a2535)", borderRadius:10, padding:"14px 16px", border:"1px solid var(--border,#2a3a4a)" }}>
              <div style={{ fontSize:"1.5rem", fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:"0.73rem", color:"var(--tasks-text-4,#b8c4ce)", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
          {/* Search */}
          <div style={{ position:"relative", flex:"1", minWidth:200 }}>
            <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", opacity:0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text" placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width:"100%", padding:"9px 12px 9px 32px", borderRadius:8, border:"1px solid var(--border,#2a3a4a)", background:"var(--tasks-card,#1a2535)", color:"var(--tasks-text-1,#e2e8f0)", fontSize:"0.84rem", outline:"none", boxSizing:"border-box" }}
            />
          </div>
          {/* Category tabs */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["All", ...CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{ padding:"6px 14px", borderRadius:999, fontSize:"0.75rem", fontWeight:600, border:"1px solid var(--border,#2a3a4a)", cursor:"pointer", background: catFilter===cat ? "#029006" : "var(--tasks-card,#1a2535)", color: catFilter===cat ? "#fff" : "var(--tasks-text-3,#94a3b8)", transition:"all 0.15s" }}>
                {cat}{cat !== "All" && catCounts[cat] ? ` (${catCounts[cat]})` : ""}
              </button>
            ))}
          </div>
        </div>

        {/* ── Document table ── */}
        {loading ? (
          <div style={{ display:"grid", gap:10 }}>
            {[...Array(4)].map((_,i) => <div key={i} style={{ height:64, borderRadius:10, background:"var(--tasks-card,#1a2535)", opacity:0.6, animation:"pulse 1.5s infinite" }}/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", color:"var(--tasks-text-4,#b8c4ce)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.3, marginBottom:12 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p style={{ margin:0 }}>{search || catFilter !== "All" ? "No documents match your filters." : "No documents uploaded yet."}</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {/* Table header */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 90px 80px 80px 80px 100px", gap:8, padding:"0 16px", fontSize:"0.72rem", fontWeight:700, color:"var(--tasks-text-4,#b8c4ce)", textTransform:"uppercase", letterSpacing:"0.04em" }}>
              <span>Document</span><span>Category</span><span>Size</span><span>Pinned</span><span>Published</span><span>Date</span><span>Actions</span>
            </div>
            {filtered.map(doc => (
              <div key={doc._id} style={{ display:"grid", gridTemplateColumns:"1fr 120px 90px 80px 80px 80px 100px", gap:8, alignItems:"center", padding:"14px 16px", background:"var(--tasks-card,#1a2535)", borderRadius:10, border:`1px solid ${doc.pinned ? "#3b82f640" : "var(--border,#2a3a4a)"}`, transition:"border-color 0.15s" }}>
                {/* Title + filename */}
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <span style={{ fontWeight:700, fontSize:"0.88rem", color:"var(--tasks-text-1,#e2e8f0)" }}>{doc.title}</span>
                    {!doc.published && <span style={{ fontSize:"0.65rem", background:"#f59e0b22", color:"#f59e0b", border:"1px solid #f59e0b40", borderRadius:999, padding:"1px 6px", fontWeight:700 }}>Draft</span>}
                    {doc.pinned && <span style={{ fontSize:"0.65rem", background:"#3b82f622", color:"#3b82f6", border:"1px solid #3b82f640", borderRadius:999, padding:"1px 6px", fontWeight:700 }}>📌 Pinned</span>}
                  </div>
                  {doc.description && <p style={{ margin:"3px 0 0 24px", fontSize:"0.75rem", color:"var(--tasks-text-4,#b8c4ce)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:320 }}>{doc.description}</p>}
                </div>
                {/* Category */}
                <span style={{ fontSize:"0.75rem", color:"var(--tasks-text-3,#94a3b8)" }}>{doc.category}</span>
                {/* Size */}
                <span style={{ fontSize:"0.75rem", color:"var(--tasks-text-4,#b8c4ce)" }}>{fmtSize(doc.fileSize)}</span>
                {/* Pinned toggle */}
                <button onClick={() => toggleField(doc, "pinned")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"1.1rem", opacity: doc.pinned ? 1 : 0.25, transition:"opacity 0.15s" }} title={doc.pinned ? "Unpin" : "Pin"}>📌</button>
                {/* Published toggle */}
                <div onClick={() => toggleField(doc, "published")} style={{ width:36, height:20, borderRadius:999, background: doc.published ? "#029006" : "#374151", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                  <div style={{ position:"absolute", top:2, left: doc.published ? 18 : 2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
                </div>
                {/* Date */}
                <span style={{ fontSize:"0.73rem", color:"var(--tasks-text-4,#b8c4ce)" }}>{fmtDate(doc.createdAt)}</span>
                {/* Actions */}
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => setPreviewDoc(doc)} title="Preview" style={{ padding:"5px 8px", borderRadius:6, background:"var(--tasks-bg,#0f1925)", border:"1px solid var(--border,#2a3a4a)", cursor:"pointer", color:"var(--tasks-text-3,#94a3b8)", fontSize:"0.75rem" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button onClick={() => openEdit(doc)} title="Edit" style={{ padding:"5px 8px", borderRadius:6, background:"var(--tasks-bg,#0f1925)", border:"1px solid var(--border,#2a3a4a)", cursor:"pointer", color:"var(--tasks-text-3,#94a3b8)", fontSize:"0.75rem" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => setDeleteDoc(doc)} title="Delete" style={{ padding:"5px 8px", borderRadius:6, background:"var(--tasks-bg,#0f1925)", border:"1px solid #ef444440", cursor:"pointer", color:"#ef4444", fontSize:"0.75rem" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          UPLOAD MODAL
      ════════════════════════════════════════ */}
      {mounted && showUpload && createPortal(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => { setShowUpload(false); resetUpload(); }}>
          <div style={{ background:"var(--tasks-card,#1a2535)", borderRadius:16, width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", border:"1px solid var(--border,#2a3a4a)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"20px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h2 style={{ margin:0, fontSize:"1.1rem", fontWeight:800, color:"var(--tasks-text-1,#e2e8f0)" }}>Upload Document</h2>
              <button onClick={() => { setShowUpload(false); resetUpload(); }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--tasks-text-4,#b8c4ce)", fontSize:"1.2rem" }}>✕</button>
            </div>
            <div style={{ padding:"20px 24px 24px", display:"flex", flexDirection:"column", gap:16 }}>

              {/* Drop zone */}
              <div
                onDrop={handleFileDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileRef.current?.click()}
                style={{ border:`2px dashed ${dragOver || uploadFile ? "#029006" : "var(--border,#2a3a4a)"}`, borderRadius:12, padding:"28px 20px", textAlign:"center", cursor:"pointer", background: uploadFile ? "rgba(2,144,6,0.06)" : "transparent", transition:"all 0.2s" }}
              >
                <input ref={fileRef} type="file" accept="application/pdf" style={{ display:"none" }} onChange={handleFileInput}/>
                {uploadFile ? (
                  <div>
                    <div style={{ fontSize:"2rem", marginBottom:6 }}>📄</div>
                    <p style={{ margin:0, fontWeight:700, color:"#029006", fontSize:"0.9rem" }}>{uploadFile.name}</p>
                    <p style={{ margin:"4px 0 0", fontSize:"0.75rem", color:"var(--tasks-text-4,#b8c4ce)" }}>{fmtSize(uploadFile.size)}</p>
                    <button type="button" onClick={e => { e.stopPropagation(); setUploadFile(null); }} style={{ marginTop:8, fontSize:"0.72rem", background:"none", border:"none", color:"#ef4444", cursor:"pointer" }}>Remove</button>
                  </div>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.4, marginBottom:8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p style={{ margin:0, fontWeight:600, color:"var(--tasks-text-2,#cbd5e1)", fontSize:"0.88rem" }}>Drop PDF here or click to browse</p>
                    <p style={{ margin:"4px 0 0", fontSize:"0.75rem", color:"var(--tasks-text-4,#b8c4ce)" }}>PDF files only · max 20 MB</p>
                  </>
                )}
              </div>

              {/* Title */}
              <div>
                <label style={{ fontSize:"0.78rem", fontWeight:700, color:"var(--tasks-text-3,#94a3b8)", display:"block", marginBottom:5 }}>Title *</label>
                <input type="text" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Document title…" style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--border,#2a3a4a)", background:"var(--tasks-bg,#0f1925)", color:"var(--tasks-text-1,#e2e8f0)", fontSize:"0.88rem", outline:"none", boxSizing:"border-box" }}/>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize:"0.78rem", fontWeight:700, color:"var(--tasks-text-3,#94a3b8)", display:"block", marginBottom:5 }}>Description</label>
                <textarea value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} rows={2} placeholder="Brief description…" style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--border,#2a3a4a)", background:"var(--tasks-bg,#0f1925)", color:"var(--tasks-text-1,#e2e8f0)", fontSize:"0.85rem", outline:"none", resize:"none", fontFamily:"inherit", boxSizing:"border-box" }}/>
              </div>

              {/* Category */}
              <div>
                <label style={{ fontSize:"0.78rem", fontWeight:700, color:"var(--tasks-text-3,#94a3b8)", display:"block", marginBottom:5 }}>Category</label>
                <select value={uploadCat} onChange={e => setUploadCat(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--border,#2a3a4a)", background:"var(--tasks-bg,#0f1925)", color:"var(--tasks-text-1,#e2e8f0)", fontSize:"0.85rem", outline:"none" }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Toggles */}
              <div style={{ display:"flex", gap:20 }}>
                {[
                  { label:"Publish immediately", state:uploadPub, set:setUploadPub },
                  { label:"Pin to top",          state:uploadPin, set:setUploadPin },
                ].map(({ label, state, set }) => (
                  <label key={label} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:"0.83rem", color:"var(--tasks-text-2,#cbd5e1)" }}>
                    <div onClick={() => set(!state)} style={{ width:36, height:20, borderRadius:999, background: state ? "#029006" : "#374151", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                      <div style={{ position:"absolute", top:2, left: state ? 18 : 2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
                    </div>
                    {label}
                  </label>
                ))}
              </div>

              {/* Submit */}
              <button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadTitle.trim()} style={{ padding:"12px", borderRadius:10, background: (!uploadFile || !uploadTitle.trim()) ? "#374151" : "#029006", color:"#fff", border:"none", fontWeight:700, fontSize:"0.9rem", cursor: (!uploadFile || !uploadTitle.trim()) ? "not-allowed" : "pointer", transition:"background 0.2s" }}>
                {uploading ? "Uploading…" : "Upload Document"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ════════════════════════════════════════
          EDIT MODAL
      ════════════════════════════════════════ */}
      {mounted && editDoc && createPortal(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setEditDoc(null)}>
          <div style={{ background:"var(--tasks-card,#1a2535)", borderRadius:16, width:"100%", maxWidth:480, border:"1px solid var(--border,#2a3a4a)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"20px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h2 style={{ margin:0, fontSize:"1.05rem", fontWeight:800, color:"var(--tasks-text-1,#e2e8f0)" }}>Edit Document</h2>
              <button onClick={() => setEditDoc(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--tasks-text-4,#b8c4ce)", fontSize:"1.2rem" }}>✕</button>
            </div>
            <div style={{ padding:"20px 24px 24px", display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:"0.78rem", fontWeight:700, color:"var(--tasks-text-3,#94a3b8)", display:"block", marginBottom:5 }}>Title *</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--border,#2a3a4a)", background:"var(--tasks-bg,#0f1925)", color:"var(--tasks-text-1,#e2e8f0)", fontSize:"0.88rem", outline:"none", boxSizing:"border-box" }}/>
              </div>
              <div>
                <label style={{ fontSize:"0.78rem", fontWeight:700, color:"var(--tasks-text-3,#94a3b8)", display:"block", marginBottom:5 }}>Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--border,#2a3a4a)", background:"var(--tasks-bg,#0f1925)", color:"var(--tasks-text-1,#e2e8f0)", fontSize:"0.85rem", outline:"none", resize:"none", fontFamily:"inherit", boxSizing:"border-box" }}/>
              </div>
              <div>
                <label style={{ fontSize:"0.78rem", fontWeight:700, color:"var(--tasks-text-3,#94a3b8)", display:"block", marginBottom:5 }}>Category</label>
                <select value={editCat} onChange={e => setEditCat(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--border,#2a3a4a)", background:"var(--tasks-bg,#0f1925)", color:"var(--tasks-text-1,#e2e8f0)", fontSize:"0.85rem", outline:"none" }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display:"flex", gap:20 }}>
                {[
                  { label:"Published", state:editPub, set:setEditPub },
                  { label:"Pinned",    state:editPin, set:setEditPin },
                ].map(({ label, state, set }) => (
                  <label key={label} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:"0.83rem", color:"var(--tasks-text-2,#cbd5e1)" }}>
                    <div onClick={() => set(!state)} style={{ width:36, height:20, borderRadius:999, background: state ? "#029006" : "#374151", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                      <div style={{ position:"absolute", top:2, left: state ? 18 : 2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
                    </div>
                    {label}
                  </label>
                ))}
              </div>
              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <button onClick={() => setEditDoc(null)} style={{ flex:1, padding:"10px", borderRadius:8, background:"var(--tasks-bg,#0f1925)", border:"1px solid var(--border,#2a3a4a)", color:"var(--tasks-text-2,#cbd5e1)", fontWeight:600, fontSize:"0.85rem", cursor:"pointer" }}>Cancel</button>
                <button onClick={handleEdit} disabled={editSaving || !editTitle.trim()} style={{ flex:2, padding:"10px", borderRadius:8, background:"#029006", color:"#fff", border:"none", fontWeight:700, fontSize:"0.88rem", cursor:"pointer" }}>
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ════════════════════════════════════════
          DELETE CONFIRM
      ════════════════════════════════════════ */}
      {mounted && deleteDoc && createPortal(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setDeleteDoc(null)}>
          <div style={{ background:"var(--tasks-card,#1a2535)", borderRadius:16, width:"100%", maxWidth:400, padding:24, border:"1px solid #ef444440" }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:"2.5rem", marginBottom:8 }}>🗑️</div>
              <h3 style={{ margin:0, color:"var(--tasks-text-1,#e2e8f0)", fontSize:"1rem", fontWeight:800 }}>Delete Document?</h3>
              <p style={{ margin:"8px 0 0", fontSize:"0.84rem", color:"var(--tasks-text-3,#94a3b8)" }}>
                <strong style={{ color:"var(--tasks-text-1,#e2e8f0)" }}>{deleteDoc.title}</strong> will be permanently deleted from the database and Cloudinary. This cannot be undone.
              </p>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setDeleteDoc(null)} style={{ flex:1, padding:"10px", borderRadius:8, background:"var(--tasks-bg,#0f1925)", border:"1px solid var(--border,#2a3a4a)", color:"var(--tasks-text-2,#cbd5e1)", fontWeight:600, fontSize:"0.85rem", cursor:"pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} style={{ flex:1, padding:"10px", borderRadius:8, background:"#ef4444", color:"#fff", border:"none", fontWeight:700, fontSize:"0.88rem", cursor:"pointer" }}>
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ════════════════════════════════════════
          PREVIEW MODAL (embedded PDF)
      ════════════════════════════════════════ */}
      {mounted && previewDoc && createPortal(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9000, display:"flex", flexDirection:"column" }} onClick={() => setPreviewDoc(null)}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", background:"var(--tasks-card,#1a2535)", borderBottom:"1px solid var(--border,#2a3a4a)", flexShrink:0 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{ fontWeight:700, color:"var(--tasks-text-1,#e2e8f0)", fontSize:"0.95rem" }}>{previewDoc.title}</span>
              <span style={{ fontSize:"0.72rem", color:"var(--tasks-text-4,#b8c4ce)" }}>{previewDoc.category} · {fmtSize(previewDoc.fileSize)}</span>
            </div>
            <div style={{ display:"flex", gap:8 }} onClick={e => e.stopPropagation()}>
              <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8, background:"#029006", color:"#fff", textDecoration:"none", fontSize:"0.8rem", fontWeight:700 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button onClick={() => setPreviewDoc(null)} style={{ background:"none", border:"1px solid var(--border,#2a3a4a)", borderRadius:8, cursor:"pointer", color:"var(--tasks-text-3,#94a3b8)", padding:"7px 12px", fontSize:"0.85rem" }}>✕ Close</button>
            </div>
          </div>
          <div style={{ flex:1, padding:16, overflow:"hidden" }} onClick={e => e.stopPropagation()}>
            <iframe
              src={getPdfIframeSrc(previewDoc.fileUrl)}
              style={{ width:"100%", height:"100%", border:"none", borderRadius:8 }}
              title={previewDoc.title}
            />
          </div>
        </div>,
        document.body
      )}

      {/* ── Toasts ── */}
      {mounted && createPortal(
        <div style={{ position:"fixed", bottom:20, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:8 }}>
          {toasts.map(t => (
            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderRadius:10, background: t.type==="error" ? "#ef4444" : t.type==="info" ? "#3b82f6" : "#029006", color:"#fff", fontSize:"0.84rem", fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.3)", minWidth:220 }}>
              <span style={{ flex:1 }}>{t.msg}</span>
              <button onClick={() => dismiss(t.id)} style={{ background:"none", border:"none", color:"#fff", cursor:"pointer", opacity:0.7, fontSize:"0.9rem" }}>✕</button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}