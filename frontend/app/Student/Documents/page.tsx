// app/Student/Documents/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

/* ── Types ── */
type Doc = {
  _id: string; title: string; description: string; category: string;
  fileUrl: string; fileName: string; fileSize: number;
  published: boolean; pinned: boolean;
  createdAt: string;
};

const CATEGORY_ICONS: Record<string, string> = {
  Forms: "📋", Guidelines: "📖", Policies: "⚖️",
  Announcements: "📢", General: "📄", Other: "📎",
};
const CATEGORY_COLORS: Record<string, string> = {
  Forms: "#3b82f6", Guidelines: "#8b5cf6", Policies: "#ef4444",
  Announcements: "#f59e0b", General: "#6b7280", Other: "#6b7280",
};

function fmtSize(bytes: number) {
  if (!bytes) return "";
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
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function StudentDocumentsPage() {
  const { isLoaded } = useUser();

  const [docs,      setDocs]      = useState<Doc[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [previewDoc, setPreviewDoc] = useState<Doc|null>(null);
  const [mounted,   setMounted]   = useState(false);
  useEffect(() => setMounted(true), []);

  /* ── Fetch published docs only ── */
  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/api/documents?ts=${Date.now()}`, { cache:"no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) setDocs(data.documents || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDocs(); }, []);

  /* ── Body scroll lock ── */
  useEffect(() => {
    document.body.style.overflow = previewDoc ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [previewDoc]);

  /* ── Escape key ── */
  useEffect(() => {
    const l = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewDoc(null); };
    if (previewDoc) window.addEventListener("keydown", l);
    return () => window.removeEventListener("keydown", l);
  }, [previewDoc]);

  /* ── Filter ── */
  const allCategories = ["All", ...Array.from(new Set(docs.map(d => d.category).filter(Boolean)))];

  const filtered = docs.filter(d => {
    const sm = !search.trim() ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase());
    const cm = catFilter === "All" || d.category === catFilter;
    return sm && cm;
  });

  const pinned = filtered.filter(d => d.pinned);
  const rest   = filtered.filter(d => !d.pinned);

  /* ════════════════════════════════════════
     DOCUMENT CARD
  ════════════════════════════════════════ */
  const DocCard = ({ doc }: { doc: Doc }) => {
    const icon  = CATEGORY_ICONS[doc.category]  || "📄";
    const color = CATEGORY_COLORS[doc.category] || "#6b7280";
    return (
      <div
        style={{
          background:"var(--tasks-card,#1a2535)",
          borderRadius:14,
          border:"1px solid var(--border,#2a3a4a)",
          padding:"18px 20px",
          display:"flex",
          flexDirection:"column",
          gap:10,
          transition:"transform 0.15s, box-shadow 0.15s",
          cursor:"default",
          position:"relative",
          overflow:"hidden",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
      >
        {/* Top color stripe */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:color }}/>

        {/* Icon + category */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:4 }}>
          <span style={{ fontSize:"1.6rem" }}>{icon}</span>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {doc.pinned && <span style={{ fontSize:"0.68rem", background:"#3b82f622", color:"#3b82f6", border:"1px solid #3b82f640", borderRadius:999, padding:"1px 7px", fontWeight:700 }}>📌 Pinned</span>}
            <span style={{ fontSize:"0.68rem", background:`${color}18`, color, border:`1px solid ${color}40`, borderRadius:999, padding:"2px 8px", fontWeight:700 }}>{doc.category}</span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h3 style={{ margin:0, fontSize:"0.95rem", fontWeight:800, color:"var(--tasks-text-1,#e2e8f0)", lineHeight:1.3 }}>{doc.title}</h3>
          {doc.description && <p style={{ margin:"5px 0 0", fontSize:"0.78rem", color:"var(--tasks-text-4,#b8c4ce)", lineHeight:1.4 }}>{doc.description}</p>}
        </div>

        {/* Meta */}
        <div style={{ display:"flex", alignItems:"center", gap:12, fontSize:"0.72rem", color:"var(--tasks-text-4,#b8c4ce)", marginTop:"auto" }}>
          {doc.fileSize > 0 && <span>📦 {fmtSize(doc.fileSize)}</span>}
          <span>🗓 {fmtDate(doc.createdAt)}</span>
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:8, marginTop:4 }}>
          <button
            onClick={() => setPreviewDoc(doc)}
            style={{ flex:1, padding:"9px 12px", borderRadius:8, background:"var(--tasks-bg,#0f1925)", border:"1px solid var(--border,#2a3a4a)", color:"var(--tasks-text-2,#cbd5e1)", fontWeight:600, fontSize:"0.8rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"background 0.15s" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View
          </button>
          <a
            href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download
            style={{ flex:1, padding:"9px 12px", borderRadius:8, background:"#029006", color:"#fff", fontWeight:700, fontSize:"0.8rem", textDecoration:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </a>
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <>
      <div style={{ padding:"24px 28px", maxWidth:1200, margin:"0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, margin:0, color:"var(--tasks-text-1,#e2e8f0)" }}>
            Documents
          </h1>
          <p style={{ margin:"4px 0 0", fontSize:"0.85rem", color:"var(--tasks-text-4,#b8c4ce)" }}>
            Official BFMO forms, guidelines, and policies — click to view or download.
          </p>
        </div>

        {/* ── Search + Category filters ── */}
        <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ position:"relative", flex:"1", minWidth:200 }}>
            <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", opacity:0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text" placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width:"100%", padding:"9px 12px 9px 32px", borderRadius:8, border:"1px solid var(--border,#2a3a4a)", background:"var(--tasks-card,#1a2535)", color:"var(--tasks-text-1,#e2e8f0)", fontSize:"0.84rem", outline:"none", boxSizing:"border-box" }}
            />
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {allCategories.map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{ padding:"7px 16px", borderRadius:999, fontSize:"0.75rem", fontWeight:700, border:"1px solid var(--border,#2a3a4a)", cursor:"pointer", background: catFilter===cat ? "#029006" : "var(--tasks-card,#1a2535)", color: catFilter===cat ? "#fff" : "var(--tasks-text-3,#94a3b8)", transition:"all 0.15s" }}>
                {CATEGORY_ICONS[cat] || ""} {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
            {[...Array(6)].map((_,i) => (
              <div key={i} style={{ height:180, borderRadius:14, background:"var(--tasks-card,#1a2535)", opacity:0.5, animation:"pulse 1.5s infinite" }}/>
            ))}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 20px", color:"var(--tasks-text-4,#b8c4ce)" }}>
            <div style={{ fontSize:"3rem", marginBottom:12 }}>📂</div>
            <p style={{ margin:0, fontSize:"0.95rem" }}>
              {search || catFilter !== "All" ? "No documents match your search." : "No documents available yet."}
            </p>
          </div>
        )}

        {/* ── Pinned section ── */}
        {!loading && pinned.length > 0 && (
          <div style={{ marginBottom:28 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <span style={{ fontSize:"1rem" }}>📌</span>
              <h2 style={{ margin:0, fontSize:"0.85rem", fontWeight:800, color:"var(--tasks-text-3,#94a3b8)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Pinned</h2>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
              {pinned.map(doc => <DocCard key={doc._id} doc={doc} />)}
            </div>
          </div>
        )}

        {/* ── All docs ── */}
        {!loading && rest.length > 0 && (
          <div>
            {pinned.length > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <h2 style={{ margin:0, fontSize:"0.85rem", fontWeight:800, color:"var(--tasks-text-3,#94a3b8)", textTransform:"uppercase", letterSpacing:"0.06em" }}>All Documents</h2>
                <span style={{ fontSize:"0.75rem", color:"var(--tasks-text-4,#b8c4ce)" }}>({rest.length})</span>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
              {rest.map(doc => <DocCard key={doc._id} doc={doc} />)}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          PDF PREVIEW MODAL
      ════════════════════════════════════════ */}
      {mounted && previewDoc && createPortal(
        <div
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:9000, display:"flex", flexDirection:"column" }}
          onClick={() => setPreviewDoc(null)}
        >
          {/* Header bar */}
          <div
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", background:"var(--tasks-card,#1a2535)", borderBottom:"1px solid var(--border,#2a3a4a)", flexShrink:0 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:"1.3rem" }}>{CATEGORY_ICONS[previewDoc.category] || "📄"}</span>
              <div>
                <div style={{ fontWeight:800, color:"var(--tasks-text-1,#e2e8f0)", fontSize:"0.95rem" }}>{previewDoc.title}</div>
                <div style={{ fontSize:"0.72rem", color:"var(--tasks-text-4,#b8c4ce)", marginTop:1 }}>
                  {previewDoc.category} · {fmtSize(previewDoc.fileSize)} · {fmtDate(previewDoc.createdAt)}
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }} onClick={e => e.stopPropagation()}>
              <a
                href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer" download
                style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, background:"#029006", color:"#fff", textDecoration:"none", fontSize:"0.82rem", fontWeight:700 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button
                onClick={() => setPreviewDoc(null)}
                style={{ background:"none", border:"1px solid var(--border,#2a3a4a)", borderRadius:8, cursor:"pointer", color:"var(--tasks-text-3,#94a3b8)", padding:"8px 14px", fontSize:"0.85rem", fontWeight:600 }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* PDF iframe */}
          <div style={{ flex:1, padding:16, overflow:"hidden" }} onClick={e => e.stopPropagation()}>
            <iframe
              src={getPdfIframeSrc(previewDoc.fileUrl)}
              style={{ width:"100%", height:"100%", border:"none", borderRadius:10 }}
              title={previewDoc.title}
            />
          </div>

          {/* Mobile fallback hint */}
          <div style={{ padding:"8px 20px", background:"var(--tasks-card,#1a2535)", borderTop:"1px solid var(--border,#2a3a4a)", textAlign:"center", flexShrink:0 }} onClick={e => e.stopPropagation()}>
            <p style={{ margin:0, fontSize:"0.72rem", color:"var(--tasks-text-4,#b8c4ce)" }}>
              PDF not loading?{" "}
              <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color:"#029006", textDecoration:"none", fontWeight:700 }}>
                Open in new tab ↗
              </a>
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}