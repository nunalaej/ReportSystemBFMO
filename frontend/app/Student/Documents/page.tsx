// app/Student/Documents/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "";

type Doc = {
  _id: string; title: string; description: string; category: string;
  fileUrl: string; fileName: string; fileSize: number;
  published: boolean; pinned: boolean; createdAt: string;
};

const CATEGORY_META: Record<string, { icon: string; color: string; bg: string }> = {
  Forms:         { icon: "📋", color: "#2563eb", bg: "#eff6ff" },
  Guidelines:    { icon: "📖", color: "#7c3aed", bg: "#f5f3ff" },
  Policies:      { icon: "⚖️", color: "#dc2626", bg: "#fef2f2" },
  Announcements: { icon: "📢", color: "#d97706", bg: "#fffbeb" },
  General:       { icon: "📄", color: "#059669", bg: "#ecfdf5" },
  Other:         { icon: "📎", color: "#6b7280", bg: "#f9fafb" },
};

const getMeta = (cat: string) => CATEGORY_META[cat] || CATEGORY_META["Other"];

function fmtSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getPdfIframeSrc(url: string) {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
}

export default function StudentDocumentsPage() {
  const { isLoaded } = useUser();
  const [docs,       setDocs]       = useState<Doc[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [catFilter,  setCatFilter]  = useState("All");
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [mounted,    setMounted]    = useState(false);
  useEffect(() => setMounted(true), []);

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/api/documents?ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) setDocs(data.documents || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDocs(); }, []);

  useEffect(() => {
    document.body.style.overflow = previewDoc ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [previewDoc]);

  useEffect(() => {
    const l = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewDoc(null); };
    if (previewDoc) window.addEventListener("keydown", l);
    return () => window.removeEventListener("keydown", l);
  }, [previewDoc]);

  const allCategories = ["All", ...Array.from(new Set(docs.map(d => d.category).filter(Boolean)))];

  const filtered = docs.filter(d => {
    const sm = !search.trim() ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || "").toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase());
    const cm = catFilter === "All" || d.category === catFilter;
    return sm && cm;
  });

  const pinned = filtered.filter(d => d.pinned);
  const rest   = filtered.filter(d => !d.pinned);

  /* ── Document Card ── */
  const DocCard = ({ doc }: { doc: Doc }) => {
    const meta = getMeta(doc.category);
    return (
      <div style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.2s, transform 0.2s",
        cursor: "default",
      }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.10)";
          el.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.boxShadow = "";
          el.style.transform = "";
        }}
      >
        {/* Color top bar */}
        <div style={{ height: 4, background: meta.color, flexShrink: 0 }}/>

        {/* Body */}
        <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Category + pinned badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: "0.7rem", fontWeight: 700, padding: "2px 9px", borderRadius: 999,
              background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30`,
            }}>
              {meta.icon} {doc.category}
            </span>
            {doc.pinned && (
              <span style={{
                fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a",
              }}>📌 Pinned</span>
            )}
          </div>

          {/* Title */}
          <h3 style={{
            margin: 0, fontSize: "0.92rem", fontWeight: 700,
            color: "#111827", lineHeight: 1.35,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{doc.title}</h3>

          {/* Description */}
          {doc.description && (
            <p style={{
              margin: 0, fontSize: "0.77rem", color: "#6b7280", lineHeight: 1.45,
              display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{doc.description}</p>
          )}

          {/* Meta row */}
          <div style={{
            marginTop: "auto", paddingTop: 6,
            display: "flex", alignItems: "center", gap: 10,
            fontSize: "0.7rem", color: "#9ca3af",
          }}>
            {doc.fileSize > 0 && <span>📦 {fmtSize(doc.fileSize)}</span>}
            <span>🗓 {fmtDate(doc.createdAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", borderTop: "1px solid #f3f4f6" }}>
          <button
            onClick={() => setPreviewDoc(doc)}
            style={{
              flex: 1, padding: "11px", background: "#f9fafb", border: "none",
              borderRight: "1px solid #f3f4f6", color: "#374151",
              fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f9fafb")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            View
          </button>
          <a
            href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download
            style={{
              flex: 1, padding: "11px", background: "#029006", color: "#fff",
              fontWeight: 700, fontSize: "0.78rem", textDecoration: "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#027a05")}
            onMouseLeave={e => (e.currentTarget.style.background = "#029006")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </a>
        </div>
      </div>
    );
  };

  /* ── Skeleton loader ── */
  const Skeleton = () => (
    <div style={{ borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <div style={{ height: 4, background: "#e5e7eb" }}/>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ height: 20, width: "40%", borderRadius: 6, background: "#f3f4f6" }}/>
        <div style={{ height: 16, width: "85%", borderRadius: 6, background: "#f3f4f6" }}/>
        <div style={{ height: 14, width: "60%", borderRadius: 6, background: "#f3f4f6" }}/>
        <div style={{ height: 12, width: "45%", borderRadius: 6, background: "#f3f4f6", marginTop: 6 }}/>
      </div>
      <div style={{ height: 42, background: "#f9fafb", borderTop: "1px solid #f3f4f6" }}/>
    </div>
  );

  /* ── Section header ── */
  const SectionHeader = ({ label, count }: { label: string; count?: number }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: "#029006" }}/>
      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      {count !== undefined && (
        <span style={{ fontSize: "0.7rem", color: "#9ca3af", background: "#f3f4f6", borderRadius: 999, padding: "1px 8px", fontWeight: 600 }}>{count}</span>
      )}
    </div>
  );

  return (
    <>
      <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
              📂
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "#111827" }}>Documents</h1>
          </div>
          <p style={{ margin: "2px 0 0 46px", fontSize: "0.83rem", color: "#6b7280" }}>
            Official BFMO forms, guidelines, and policies — click to view or download.
          </p>
        </div>

        {/* ── Search + category filters ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text" placeholder="Search documents…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px 9px 33px", borderRadius: 9,
                border: "1px solid #e5e7eb", background: "#fff",
                color: "#111827", fontSize: "0.84rem", outline: "none",
                boxSizing: "border-box", transition: "border-color 0.15s",
              }}
              onFocus={e => (e.target.style.borderColor = "#029006")}
              onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
            />
            {search && (
              <button onClick={() => setSearch("")}
                style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, lineHeight: 1 }}>
                ✕
              </button>
            )}
          </div>

          {/* Category filter chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {allCategories.map(cat => {
              const isActive = catFilter === cat;
              const meta = cat === "All" ? null : getMeta(cat);
              return (
                <button key={cat} onClick={() => setCatFilter(cat)} style={{
                  padding: "7px 14px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 700,
                  border: `1.5px solid ${isActive ? (meta?.color || "#029006") : "#e5e7eb"}`,
                  background: isActive ? (meta?.bg || "#f0fdf4") : "#fff",
                  color: isActive ? (meta?.color || "#029006") : "#6b7280",
                  cursor: "pointer", transition: "all 0.15s",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  {cat !== "All" && meta?.icon} {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Stats bar ── */}
        {!loading && docs.length > 0 && (
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "Total", value: docs.length, color: "#6366f1" },
              { label: "Pinned", value: docs.filter(d => d.pinned).length, color: "#d97706" },
              { label: "Showing", value: filtered.length, color: "#029006" },
            ].map(s => (
              <div key={s.label} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                borderRadius: 10, background: "#fff", border: "1px solid #e5e7eb",
              }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: "0.72rem", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Skeleton ── */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {[...Array(6)].map((_, i) => <Skeleton key={i}/>)}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 20px" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>📭</div>
            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#374151" }}>No documents found</p>
            <p style={{ margin: "6px 0 0", fontSize: "0.84rem", color: "#9ca3af" }}>
              {search || catFilter !== "All" ? "Try adjusting your search or filter." : "Documents will appear here once published."}
            </p>
            {(search || catFilter !== "All") && (
              <button onClick={() => { setSearch(""); setCatFilter("All"); }}
                style={{ marginTop: 16, padding: "9px 20px", borderRadius: 8, background: "#029006", color: "#fff", border: "none", fontWeight: 700, fontSize: "0.84rem", cursor: "pointer" }}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* ── Pinned ── */}
        {!loading && pinned.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <SectionHeader label="Pinned" count={pinned.length}/>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
              {pinned.map(doc => <DocCard key={doc._id} doc={doc}/>)}
            </div>
          </div>
        )}

        {/* ── All docs ── */}
        {!loading && rest.length > 0 && (
          <div>
            <SectionHeader label={pinned.length > 0 ? "All Documents" : "Documents"} count={rest.length}/>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
              {rest.map(doc => <DocCard key={doc._id} doc={doc}/>)}
            </div>
          </div>
        )}
      </div>

      {/* ── PDF Preview Modal ── */}
      {mounted && previewDoc && createPortal(
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9000, display: "flex", flexDirection: "column" }}
          onClick={() => setPreviewDoc(null)}
        >
          {/* Modal header */}
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: getMeta(previewDoc.category).bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.1rem",
              }}>
                {getMeta(previewDoc.category).icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#111827", fontSize: "0.92rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {previewDoc.title}
                </div>
                <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 1 }}>
                  {previewDoc.category} · {fmtSize(previewDoc.fileSize)} · {fmtDate(previewDoc.createdAt)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <a
                href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer" download
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "#029006", color: "#fff", textDecoration: "none", fontSize: "0.81rem", fontWeight: 700 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </a>
              <button
                onClick={() => setPreviewDoc(null)}
                style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", color: "#374151", padding: "8px 14px", fontSize: "0.82rem", fontWeight: 600 }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Iframe */}
          <div style={{ flex: 1, padding: 16, overflow: "hidden", background: "#f9fafb" }} onClick={e => e.stopPropagation()}>
            <iframe
              src={getPdfIframeSrc(previewDoc.fileUrl)}
              style={{ width: "100%", height: "100%", border: "none", borderRadius: 10, background: "#fff" }}
              title={previewDoc.title}
            />
          </div>

          {/* Fallback */}
          <div style={{ padding: "8px 20px", background: "#fff", borderTop: "1px solid #e5e7eb", textAlign: "center", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>
              PDF not loading?{" "}
              <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#029006", textDecoration: "none", fontWeight: 700 }}>
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