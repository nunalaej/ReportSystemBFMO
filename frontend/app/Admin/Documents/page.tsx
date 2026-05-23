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

/* ══════════════════════════════════════════════════════
   THEME — inherits from the admin layout's CSS variables.
   No forced background on the page root.
   Falls back gracefully to both dark and light values.
══════════════════════════════════════════════════════ */
const T = {
  // Surface / background — inherits from layout
  surface:   "var(--tasks-surface, #fff)",
  surface2:  "var(--tasks-surface-2, #f8fafc)",
  bg:        "var(--color-bg-primary, #f4f6f9)",
  // Borders
  border:    "var(--tasks-border, #e8ecf0)",
  // Text
  text1:     "var(--tasks-text-1, #0d1b2a)",
  text2:     "var(--tasks-text-2, #2f3a4f)",
  text3:     "var(--tasks-text-3, #8a97a8)",
  text4:     "var(--tasks-text-4, #b8c4ce)",
  // Accent
  brand:     "#029006",
  danger:    "#ef4444",
  warn:      "#f59e0b",
  info:      "#3b82f6",
} as const;

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
  return new Date(d).toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
}

/* ── Toast ── */
type ToastType = "success"|"error"|"info";
let _tid = 0;
function useToast() {
  const [toasts, setToasts] = useState<{id:number;msg:string;type:ToastType}[]>([]);
  const show = useCallback((msg: string, type: ToastType = "success") => {
    const id = ++_tid;
    setToasts(p => [...p, {id, msg, type}]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, show, dismiss };
}

/* ── Shared styles (theme-aware) ── */
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: `1px solid ${T.border}`,
  background: T.surface2, color: T.text1,
  fontSize: "0.88rem", outline: "none", boxSizing: "border-box",
};

const fieldLabel: React.CSSProperties = {
  fontSize: "0.76rem", fontWeight: 700, color: T.text3,
  display: "block", marginBottom: 5,
  textTransform: "uppercase", letterSpacing: "0.04em",
};

/* ── Toggle switch ── */
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange} role="switch" aria-checked={on}
      tabIndex={0} onKeyDown={e => e.key === " " && onChange()}
      style={{
        width: 36, height: 20, borderRadius: 999, flexShrink: 0,
        background: on ? T.brand : T.border,
        cursor: "pointer", position: "relative", transition: "background 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: 2,
        left: on ? 18 : 2, width: 16, height: 16,
        borderRadius: "50%", background: "#fff", transition: "left 0.2s",
      }}/>
    </div>
  );
}

/* ── Action button ── */
function ActionBtn({ children, title, onClick, danger }: {
  children: React.ReactNode; title: string; onClick: () => void; danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "5px 8px", borderRadius: 6, cursor: "pointer",
        border: `1px solid ${danger ? T.danger+"66" : T.border}`,
        background: hover
          ? (danger ? T.danger+"18" : T.surface2)
          : "transparent",
        color: danger ? T.danger : T.text3,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.15s",
      }}
    >
      {children}
    </button>
  );
}

/* ── Modal overlay + card ── */
const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(3px)",
  zIndex: 9000, display: "flex",
  alignItems: "center", justifyContent: "center", padding: 16,
};

function Modal({ children, maxWidth, onClose, danger }: {
  children: React.ReactNode; maxWidth: number;
  onClose: () => void; danger?: boolean;
}) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surface, borderRadius: 16,
          border: `1px solid ${danger ? T.danger+"55" : T.border}`,
          width: "100%", maxWidth,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        {children}
      </div>
    </div>
  );
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

  /* ── Upload ── */
  const [showUpload,  setShowUpload]  = useState(false);
  const [uploadFile,  setUploadFile]  = useState<File|null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc,  setUploadDesc]  = useState("");
  const [uploadCat,   setUploadCat]   = useState("General");
  const [uploadPub,   setUploadPub]   = useState(true);
  const [uploadPin,   setUploadPin]   = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [dragOver,    setDragOver]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Edit ── */
  const [editDoc,    setEditDoc]    = useState<Doc|null>(null);
  const [editTitle,  setEditTitle]  = useState("");
  const [editDesc,   setEditDesc]   = useState("");
  const [editCat,    setEditCat]    = useState("General");
  const [editPub,    setEditPub]    = useState(true);
  const [editPin,    setEditPin]    = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  /* ── Delete / Preview ── */
  const [deleteDoc,     setDeleteDoc]     = useState<Doc|null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [previewDoc,    setPreviewDoc]    = useState<Doc|null>(null);

  const { toasts, show: showToast, dismiss } = useToast();

  /* ── Auth guard ── */
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { router.replace("/"); return; }
    const rawRole = (user.publicMetadata as any)?.role;
    const role = Array.isArray(rawRole)
      ? String(rawRole[0]).toLowerCase()
      : typeof rawRole === "string" ? rawRole.toLowerCase() : "";
    if (role !== "staff" && role !== "admin") { router.replace("/Student"); return; }
    setCanView(true);
  }, [isLoaded, isSignedIn, user, router]);

  /* ── Fetch ── */
  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/api/documents?all=1&ts=${Date.now()}`, { cache:"no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) setDocs(data.documents || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (canView) fetchDocs(); }, [canView]);

  /* ── Scroll lock ── */
  useEffect(() => {
    document.body.style.overflow = (showUpload || !!editDoc || !!deleteDoc || !!previewDoc) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showUpload, editDoc, deleteDoc, previewDoc]);

  /* ── Filtered list ── */
  const filtered = docs.filter(d => {
    const sm = !search.trim() ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase());
    return sm && (catFilter === "All" || d.category === catFilter);
  });

  /* ── Handlers ── */
  const resetUpload = () => {
    setUploadFile(null); setUploadTitle(""); setUploadDesc("");
    setUploadCat("General"); setUploadPub(true); setUploadPin(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") {
      setUploadFile(file);
      if (!uploadTitle) setUploadTitle(file.name.replace(/\.pdf$/i,"").replace(/_/g," "));
    } else showToast("Only PDF files are allowed.", "error");
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (!uploadTitle) setUploadTitle(file.name.replace(/\.pdf$/i,"").replace(/_/g," "));
    }
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
      const res  = await fetch(`${API_BASE}/api/documents`, { method:"POST", body:form });
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
        method:"PUT", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ title:editTitle.trim(), description:editDesc.trim(), category:editCat, published:editPub, pinned:editPin }),
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
      const res  = await fetch(`${API_BASE}/api/documents/${deleteDoc._id}`, { method:"DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed.");
      setDocs(p => p.filter(d => d._id !== deleteDoc._id));
      showToast("Document deleted.", "success"); setDeleteDoc(null);
    } catch (e: any) { showToast(e.message || "Failed.", "error"); }
    finally { setDeleteLoading(false); }
  };

  const toggleField = async (doc: Doc, field: "published"|"pinned") => {
    try {
      const res  = await fetch(`${API_BASE}/api/documents/${doc._id}`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ [field]: !doc[field] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setDocs(p => p.map(d => d._id === doc._id ? data.document : d));
      showToast(`${field === "published"
        ? (data.document.published ? "Published" : "Unpublished")
        : (data.document.pinned ? "Pinned" : "Unpinned")}.`, "success");
    } catch { showToast("Failed.", "error"); }
  };

  if (!isLoaded || !canView) return (
    <div style={{ padding:40, textAlign:"center", color:T.text4 }}>Loading…</div>
  );

  const catCounts = docs.reduce<Record<string,number>>((acc,d) => {
    acc[d.category] = (acc[d.category]||0)+1; return acc;
  }, {});

  /* ════════════════════════════════════════════════════
     RENDER — no forced background on root, inherits layout
  ════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Page wrapper — transparent, sits inside admin layout ── */}
      <div style={{ padding:"24px 28px", maxWidth:1240, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ fontSize:"1.4rem", fontWeight:800, margin:0, color:T.text1 }}>Documents</h1>
            <p style={{ margin:"4px 0 0", fontSize:"0.83rem", color:T.text3 }}>Manage PDF files visible to students and staff.</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:10, background:T.brand, color:"#fff", border:"none", fontWeight:700, fontSize:"0.88rem", cursor:"pointer", boxShadow:"0 2px 8px rgba(2,144,6,0.25)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Upload Document
          </button>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10, marginBottom:24 }}>
          {[
            { label:"Total",     value:docs.length,                        color:T.text3 },
            { label:"Published", value:docs.filter(d=>d.published).length,  color:T.brand },
            { label:"Drafts",    value:docs.filter(d=>!d.published).length, color:T.warn  },
            { label:"Pinned",    value:docs.filter(d=>d.pinned).length,     color:T.info  },
          ].map(s => (
            <div key={s.label} style={{ background:T.surface, borderRadius:10, padding:"14px 16px", border:`1px solid ${T.border}`, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize:"1.5rem", fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:"0.72rem", color:T.text4, marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ position:"relative", flex:"1", minWidth:200 }}>
            <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:T.text4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text" placeholder="Search documents…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft:32 }}
            />
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["All",...CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{
                padding:"6px 14px", borderRadius:999, fontSize:"0.75rem", fontWeight:600,
                border:`1px solid ${catFilter===cat ? T.brand : T.border}`,
                cursor:"pointer",
                background: catFilter===cat ? T.brand : T.surface,
                color: catFilter===cat ? "#fff" : T.text3,
                transition:"all 0.15s",
              }}>
                {cat}{cat!=="All"&&catCounts[cat]?` (${catCounts[cat]})`:""}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display:"grid", gap:10 }}>
            {[...Array(4)].map((_,i) => (
              <div key={i} style={{ height:60, borderRadius:10, background:T.surface, border:`1px solid ${T.border}`, opacity:0.7 }}/>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", color:T.text4 }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.3, marginBottom:12 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p style={{ margin:0 }}>{search||catFilter!=="All" ? "No documents match." : "No documents uploaded yet."}</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {/* Column headers */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 90px 60px 90px 90px 110px", gap:8, padding:"0 16px", fontSize:"0.7rem", fontWeight:700, color:T.text4, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              <span>Document</span><span>Category</span><span>Size</span>
              <span>Pin</span><span>Published</span><span>Date</span><span>Actions</span>
            </div>

            {filtered.map(doc => (
              <div key={doc._id} style={{
                display:"grid", gridTemplateColumns:"1fr 120px 90px 60px 90px 90px 110px",
                gap:8, alignItems:"center", padding:"13px 16px",
                background: T.surface,
                borderRadius:10,
                border:`1px solid ${doc.pinned ? T.info+"55" : T.border}`,
                boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
              }}>
                {/* Title */}
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <span style={{ fontWeight:700, fontSize:"0.87rem", color:T.text1 }}>{doc.title}</span>
                    {!doc.published&&<span style={{ fontSize:"0.64rem", background:T.warn+"22", color:T.warn, border:`1px solid ${T.warn}44`, borderRadius:999, padding:"1px 7px", fontWeight:700 }}>Draft</span>}
                    {doc.pinned&&<span style={{ fontSize:"0.64rem", background:T.info+"22", color:T.info, border:`1px solid ${T.info}44`, borderRadius:999, padding:"1px 7px", fontWeight:700 }}>📌 Pinned</span>}
                  </div>
                  {doc.description&&<p style={{ margin:"3px 0 0 22px", fontSize:"0.74rem", color:T.text4, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:300 }}>{doc.description}</p>}
                </div>

                <span style={{ fontSize:"0.75rem", color:T.text3 }}>{doc.category}</span>
                <span style={{ fontSize:"0.74rem", color:T.text4 }}>{fmtSize(doc.fileSize)}</span>

                {/* Pin toggle */}
                <button onClick={() => toggleField(doc,"pinned")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"1.05rem", opacity:doc.pinned?1:0.2, transition:"opacity 0.15s", padding:0 }} title={doc.pinned?"Unpin":"Pin"}>📌</button>

                {/* Published toggle */}
                <Toggle on={doc.published} onChange={() => toggleField(doc,"published")}/>

                <span style={{ fontSize:"0.72rem", color:T.text4 }}>{fmtDate(doc.createdAt)}</span>

                <div style={{ display:"flex", gap:5 }}>
                  <ActionBtn title="Preview" onClick={() => setPreviewDoc(doc)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </ActionBtn>
                  <ActionBtn title="Edit" onClick={() => openEdit(doc)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </ActionBtn>
                  <ActionBtn title="Delete" onClick={() => setDeleteDoc(doc)} danger>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </ActionBtn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════ UPLOAD MODAL ════ */}
      {mounted && showUpload && createPortal(
        <Modal maxWidth={520} onClose={() => { setShowUpload(false); resetUpload(); }}>
          <div style={{ padding:"18px 24px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h2 style={{ margin:0, fontSize:"1.05rem", fontWeight:800, color:T.text1 }}>Upload Document</h2>
            <button onClick={() => { setShowUpload(false); resetUpload(); }} style={{ background:"none", border:"none", cursor:"pointer", color:T.text3, fontSize:"1.1rem" }}>✕</button>
          </div>
          <div style={{ padding:"20px 24px 24px", display:"flex", flexDirection:"column", gap:16, maxHeight:"75vh", overflowY:"auto" }}>
            {/* Drop zone */}
            <div
              onDrop={handleFileDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              style={{
                border:`2px dashed ${dragOver||uploadFile ? T.brand : T.border}`,
                borderRadius:12, padding:"24px 20px", textAlign:"center", cursor:"pointer",
                background: uploadFile ? "rgba(2,144,6,0.05)" : T.surface2,
                transition:"all 0.2s",
              }}
            >
              <input ref={fileRef} type="file" accept="application/pdf" style={{ display:"none" }} onChange={handleFileInput}/>
              {uploadFile ? (
                <div>
                  <div style={{ fontSize:"2rem", marginBottom:6 }}>📄</div>
                  <p style={{ margin:0, fontWeight:700, color:T.brand, fontSize:"0.9rem" }}>{uploadFile.name}</p>
                  <p style={{ margin:"4px 0 0", fontSize:"0.74rem", color:T.text4 }}>{fmtSize(uploadFile.size)}</p>
                  <button type="button" onClick={e => { e.stopPropagation(); setUploadFile(null); }} style={{ marginTop:8, fontSize:"0.72rem", background:"none", border:"none", color:T.danger, cursor:"pointer" }}>Remove</button>
                </div>
              ) : (
                <>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={T.text4} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p style={{ margin:0, fontWeight:600, color:T.text2, fontSize:"0.88rem" }}>Drop PDF here or click to browse</p>
                  <p style={{ margin:"4px 0 0", fontSize:"0.74rem", color:T.text4 }}>PDF only · max 20 MB</p>
                </>
              )}
            </div>

            <div><label style={fieldLabel}>Title *</label><input type="text" value={uploadTitle} onChange={e=>setUploadTitle(e.target.value)} placeholder="Document title…" style={inputStyle}/></div>
            <div><label style={fieldLabel}>Description</label><textarea value={uploadDesc} onChange={e=>setUploadDesc(e.target.value)} rows={2} placeholder="Brief description…" style={{ ...inputStyle, resize:"none", fontFamily:"inherit" } as React.CSSProperties}/></div>
            <div>
              <label style={fieldLabel}>Category</label>
              <select value={uploadCat} onChange={e=>setUploadCat(e.target.value)} style={{ ...inputStyle, cursor:"pointer" }}>
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", gap:24 }}>
              <label style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer", fontSize:"0.83rem", color:T.text2 }}><Toggle on={uploadPub} onChange={()=>setUploadPub(!uploadPub)}/> Publish immediately</label>
              <label style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer", fontSize:"0.83rem", color:T.text2 }}><Toggle on={uploadPin} onChange={()=>setUploadPin(!uploadPin)}/> Pin to top</label>
            </div>
            <button onClick={handleUpload} disabled={uploading||!uploadFile||!uploadTitle.trim()} style={{
              padding:"12px", borderRadius:10, border:"none", fontWeight:700, fontSize:"0.9rem",
              cursor:(!uploadFile||!uploadTitle.trim())?"not-allowed":"pointer",
              background:(!uploadFile||!uploadTitle.trim()) ? T.border : T.brand,
              color:(!uploadFile||!uploadTitle.trim()) ? T.text4 : "#fff",
              opacity:uploading?0.75:1, transition:"background 0.2s",
            }}>
              {uploading?"Uploading…":"Upload Document"}
            </button>
          </div>
        </Modal>,
        document.body
      )}

      {/* ════ EDIT MODAL ════ */}
      {mounted && editDoc && createPortal(
        <Modal maxWidth={480} onClose={() => setEditDoc(null)}>
          <div style={{ padding:"18px 24px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h2 style={{ margin:0, fontSize:"1.05rem", fontWeight:800, color:T.text1 }}>Edit Document</h2>
            <button onClick={() => setEditDoc(null)} style={{ background:"none", border:"none", cursor:"pointer", color:T.text3, fontSize:"1.1rem" }}>✕</button>
          </div>
          <div style={{ padding:"20px 24px 24px", display:"flex", flexDirection:"column", gap:14 }}>
            <div><label style={fieldLabel}>Title *</label><input type="text" value={editTitle} onChange={e=>setEditTitle(e.target.value)} style={inputStyle}/></div>
            <div><label style={fieldLabel}>Description</label><textarea value={editDesc} onChange={e=>setEditDesc(e.target.value)} rows={2} style={{ ...inputStyle, resize:"none", fontFamily:"inherit" } as React.CSSProperties}/></div>
            <div>
              <label style={fieldLabel}>Category</label>
              <select value={editCat} onChange={e=>setEditCat(e.target.value)} style={{ ...inputStyle, cursor:"pointer" }}>
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", gap:24 }}>
              <label style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer", fontSize:"0.83rem", color:T.text2 }}><Toggle on={editPub} onChange={()=>setEditPub(!editPub)}/> Published</label>
              <label style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer", fontSize:"0.83rem", color:T.text2 }}><Toggle on={editPin} onChange={()=>setEditPin(!editPin)}/> Pinned</label>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:4 }}>
              <button onClick={()=>setEditDoc(null)} style={{ flex:1, padding:"10px", borderRadius:8, background:T.surface2, border:`1px solid ${T.border}`, color:T.text2, fontWeight:600, fontSize:"0.85rem", cursor:"pointer" }}>Cancel</button>
              <button onClick={handleEdit} disabled={editSaving||!editTitle.trim()} style={{ flex:2, padding:"10px", borderRadius:8, background:T.brand, color:"#fff", border:"none", fontWeight:700, fontSize:"0.88rem", cursor:"pointer", opacity:editSaving?0.7:1 }}>
                {editSaving?"Saving…":"Save Changes"}
              </button>
            </div>
          </div>
        </Modal>,
        document.body
      )}

      {/* ════ DELETE CONFIRM ════ */}
      {mounted && deleteDoc && createPortal(
        <Modal maxWidth={400} onClose={() => setDeleteDoc(null)} danger>
          <div style={{ padding:28 }}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:"2.2rem", marginBottom:10 }}>🗑️</div>
              <h3 style={{ margin:0, color:T.text1, fontSize:"1rem", fontWeight:800 }}>Delete Document?</h3>
              <p style={{ margin:"10px 0 0", fontSize:"0.84rem", color:T.text3, lineHeight:1.5 }}>
                <strong style={{ color:T.text1 }}>{deleteDoc.title}</strong> will be permanently removed from the database and Cloudinary. This cannot be undone.
              </p>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setDeleteDoc(null)} style={{ flex:1, padding:"10px", borderRadius:8, background:T.surface2, border:`1px solid ${T.border}`, color:T.text2, fontWeight:600, fontSize:"0.85rem", cursor:"pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} style={{ flex:1, padding:"10px", borderRadius:8, background:T.danger, color:"#fff", border:"none", fontWeight:700, fontSize:"0.88rem", cursor:"pointer", opacity:deleteLoading?0.7:1 }}>
                {deleteLoading?"Deleting…":"Delete"}
              </button>
            </div>
          </div>
        </Modal>,
        document.body
      )}

      {/* ════ PREVIEW MODAL ════ */}
      {mounted && previewDoc && createPortal(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", backdropFilter:"blur(3px)", zIndex:9000, display:"flex", flexDirection:"column" }} onClick={() => setPreviewDoc(null)}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", background:T.surface, borderBottom:`1px solid ${T.border}`, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{ fontWeight:700, color:T.text1, fontSize:"0.95rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{previewDoc.title}</span>
              <span style={{ fontSize:"0.72rem", color:T.text4, flexShrink:0 }}>{previewDoc.category} · {fmtSize(previewDoc.fileSize)}</span>
            </div>
            <div style={{ display:"flex", gap:8, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
              <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8, background:T.brand, color:"#fff", textDecoration:"none", fontSize:"0.8rem", fontWeight:700 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button onClick={()=>setPreviewDoc(null)} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:8, cursor:"pointer", color:T.text3, padding:"7px 12px", fontSize:"0.85rem" }}>✕ Close</button>
            </div>
          </div>
          <div style={{ flex:1, padding:16, overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
            <iframe src={getPdfIframeSrc(previewDoc.fileUrl)} style={{ width:"100%", height:"100%", border:"none", borderRadius:8 }} title={previewDoc.title}/>
          </div>
        </div>,
        document.body
      )}

      {/* ── Toasts ── */}
      {mounted && createPortal(
        <div style={{ position:"fixed", bottom:20, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:8 }}>
          {toasts.map(t => (
            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderRadius:10, background:t.type==="error"?T.danger:t.type==="info"?T.info:T.brand, color:"#fff", fontSize:"0.84rem", fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.2)", minWidth:220 }}>
              <span style={{ flex:1 }}>{t.msg}</span>
              <button onClick={()=>dismiss(t.id)} style={{ background:"none", border:"none", color:"#fff", cursor:"pointer", opacity:0.75, fontSize:"0.9rem" }}>✕</button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}