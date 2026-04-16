"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useNotifications } from "@/app/context/notification";
import "../style/admin-edit.css";

/* ─────────────────────────── Icons ─────────────────────────── */
const IconPencil = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 0.25s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconCheck = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

/* ─────────────────────────── Types ─────────────────────────── */
type BuildingMeta  = { id: string; name: string; floors: number; roomsPerFloor: number | number[]; hasRooms?: boolean; singleLocationLabel?: string; };
type ConcernMeta   = { id: string; label: string; subconcerns: string[]; };
type StatusMeta    = { id: string; name: string; color: string; };
type PriorityMeta  = { id: string; name: string; color: string; notifyInterval?: string; };
type StaffMember   = {
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  position: string;
  disciplines: string[];
  active: boolean;
  notes?: string;
  clerkUsername?: string;
  clerkId?: string;
};

/* ─────────────────────────── Constants ──────────────────────── */
const POSITION_OPTIONS = ["Head Engineer", "Staff Engineer", "Supervisor", "Technician", "Other"];

const POSITION_COLORS: Record<string, { bg: string; text: string }> = {
  "Head Engineer":  { bg: "#fef3c7", text: "#92400e" },
  "Staff Engineer": { bg: "#dbeafe", text: "#1e40af" },
  "Supervisor":     { bg: "#f3e8ff", text: "#6b21a8" },
  "Technician":     { bg: "#dcfce7", text: "#166534" },
  "Other":          { bg: "#f1f5f9", text: "#475569" },
};

const EMPTY_STAFF: Omit<StaffMember, "_id"> = {
  name: "", email: "", phone: "",
  position: "Staff Engineer",
  disciplines: [], active: true, notes: "",
  clerkUsername: "",
};

const DEFAULT_BUILDINGS: BuildingMeta[] = [
  { id: "ayuntamiento", name: "Ayuntamiento", floors: 4, roomsPerFloor: 20, hasRooms: false },
  { id: "jfh",          name: "JFH",          floors: 4, roomsPerFloor: 10, hasRooms: true  },
  { id: "ictc",         name: "ICTC",         floors: 2, roomsPerFloor: 13, hasRooms: true  },
  { id: "pch",          name: "PCH",          floors: 3, roomsPerFloor: 10, hasRooms: true  },
  { id: "food-square",  name: "Food Square",  floors: 1, roomsPerFloor: 20, hasRooms: false },
  { id: "cos",          name: "COS",          floors: 1, roomsPerFloor: 10, hasRooms: true  },
  { id: "cbaa",         name: "CBAA",         floors: 4, roomsPerFloor: 10, hasRooms: true  },
  { id: "cthm",         name: "CTHM",         floors: 4, roomsPerFloor: 10, hasRooms: true  },
  { id: "gmh",          name: "GMH",          floors: 2, roomsPerFloor: 6,  hasRooms: true  },
  { id: "ceat",         name: "CEAT",         floors: 4, roomsPerFloor: 10, hasRooms: true  },
  { id: "other",        name: "Other",        floors: 1, roomsPerFloor: 1,  hasRooms: false },
];
const DEFAULT_CONCERNS: ConcernMeta[] = [
  { id: "electrical",    label: "Electrical",    subconcerns: ["Lights","Aircons","Wires","Outlets","Switches","Other"] },
  { id: "civil",         label: "Civil",         subconcerns: ["Walls","Ceilings","Cracks","Doors","Windows","Other"] },
  { id: "mechanical",    label: "Mechanical",    subconcerns: ["TV","Projectors","Fans","Elevators","Other"] },
  { id: "safety-hazard", label: "Safety Hazard", subconcerns: ["Spikes","Open Wires","Blocked Exits","Wet Floor","Other"] },
  { id: "other",         label: "Other",         subconcerns: ["Other"] },
];
const DEFAULT_STATUSES: StatusMeta[] = [
  { id: "1", name: "Pending",         color: "#FFA500" },
  { id: "2", name: "Pending Inspect", color: "#FFD700" },
  { id: "3", name: "In Progress",     color: "#4169E1" },
  { id: "4", name: "Resolved",        color: "#28A745" },
  { id: "5", name: "Archived",        color: "#6C757D" },
];
const DEFAULT_PRIORITIES: PriorityMeta[] = [
  { id: "1", name: "Low",    color: "#28A745", notifyInterval: "3months" },
  { id: "2", name: "Medium", color: "#FFC107", notifyInterval: "1month"  },
  { id: "3", name: "High",   color: "#ce4f01", notifyInterval: "1week"   },
  { id: "4", name: "Urgent", color: "#a40010", notifyInterval: "daily"   },
];

const NOTIFY_INTERVAL_OPTIONS = [
  { value: "daily",   label: "Every Day"      },
  { value: "1week",   label: "Every Week"     },
  { value: "1month",  label: "Every Month"    },
  { value: "3months", label: "Every 3 Months" },
];
const NOTIFY_INTERVAL_LABELS: Record<string, string> = {
  daily: "Every Day", "1week": "Every Week", "1month": "Every Month", "3months": "Every 3 Months",
};
const FLOOR_ORDINALS = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th"].map(n => `${n} Floor`);

/* ─────────────────────────── Color palette ──────────────────── */
const THEME_COLORS = [
  ["#FFFFFF","#000000","#E7E6E6","#44546A","#4472C4","#ED7D31","#A9A9A9","#FFC000","#70AD47","#FF0000"],
  ["#F2F2F2","#808080","#D0CECE","#D6DCE4","#D9E2F3","#FCE4D6","#EDEDED","#FFF2CC","#E2EFDA","#FFCCCC"],
  ["#D9D9D9","#595959","#AEAAAA","#ADB9CA","#B4C6E7","#F8CBAD","#DBDBDB","#FFE699","#C6EFCE","#FF9999"],
  ["#BFBFBF","#404040","#757070","#8496B0","#9DC3E6","#F4B183","#C9C9C9","#FFD966","#A9D18E","#FF6666"],
  ["#A6A6A6","#262626","#3A3838","#323F4F","#2E74B5","#C55A11","#7B7B7B","#BF8F00","#538135","#CC0000"],
  ["#7F7F7F","#0D0D0D","#161616","#222A35","#1F4E79","#843C0C","#525252","#7F6000","#375623","#990000"],
];
const STANDARD_COLORS = ["#C00000","#FF0000","#FFC000","#FFFF00","#92D050","#00B050","#00B0F0","#0070C0","#002060","#7030A0"];

/* ─────────────────────────── ColorPicker ────────────────────── */
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen]   = useState(false);
  const [hex,  setHex]    = useState(value);
  const ref               = React.useRef<HTMLDivElement>(null);
  useEffect(() => { setHex(value); }, [value]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const pick   = (c: string) => { onChange(c); setHex(c); setOpen(false); };
  const commit = () => { if (/^#[0-9a-fA-F]{6}$/.test(hex.trim())) { onChange(hex.trim()); setOpen(false); } };
  return (
    <div className="cp-root" ref={ref}>
      <button type="button" className="cp-trigger" onClick={() => setOpen(v => !v)} title={value}>
        <span className="cp-trigger-swatch" style={{ backgroundColor: value }} />
        <span className="cp-trigger-hex">{value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="cp-dropdown">
          <button type="button" className="cp-auto-btn" onClick={() => pick("#000000")}>
            <span className="cp-auto-swatch"/><span>Automatic</span>
          </button>
          <p className="cp-section-label">Theme Colors</p>
          <div className="cp-grid">
            {THEME_COLORS.map((row, ri) => row.map((color, ci) => (
              <button key={`t-${ri}-${ci}`} type="button"
                className={`cp-swatch${value === color ? " cp-swatch--active" : ""}`}
                style={{ backgroundColor: color }} title={color} onClick={() => pick(color)}/>
            )))}
          </div>
          <p className="cp-section-label">Standard Colors</p>
          <div className="cp-row">
            {STANDARD_COLORS.map(color => (
              <button key={color} type="button"
                className={`cp-swatch${value === color ? " cp-swatch--active" : ""}`}
                style={{ backgroundColor: color }} title={color} onClick={() => pick(color)}/>
            ))}
          </div>
          <div className="cp-custom-row">
            <span className="cp-custom-label">Custom</span>
            <input type="color" className="cp-native"
              value={hex.startsWith("#") && hex.length === 7 ? hex : "#000000"}
              onChange={e => { setHex(e.target.value); onChange(e.target.value); }}/>
            <input type="text" className="cp-hex-input" value={hex} maxLength={7} placeholder="#000000"
              onChange={e => setHex(e.target.value)} onBlur={commit}
              onKeyDown={e => { if (e.key === "Enter") commit(); }}/>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── API ────────────────────────────── */
const API_BASE  = (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "")) || "http://localhost:3000";
const META_URL  = `${API_BASE}/api/meta`;
const STAFF_URL = `${API_BASE}/api/staff`;
const norm = (v: unknown) => v == null ? "" : String(v).trim().toLowerCase();

/* ─────────────────────────── Helpers ───────────────────────── */
function normaliseRPF(raw: unknown, floors: number): number[] {
  if (Array.isArray(raw)) {
    const arr = (raw as unknown[]).map(v => { const n = parseInt(String(v), 10); return isNaN(n) || n <= 0 ? 1 : n; });
    while (arr.length < floors) arr.push(arr[arr.length - 1] ?? 1);
    return arr.slice(0, floors);
  }
  const flat = typeof raw === "number" && raw > 0 ? Math.round(raw) : 1;
  return Array.from({ length: floors }, () => flat);
}
const getRoomsArray = (b: BuildingMeta) => normaliseRPF(b.roomsPerFloor, b.floors);
const totalRooms    = (b: BuildingMeta) => getRoomsArray(b).reduce((s, n) => s + n, 0);

function normBuildings(raw: unknown[]): BuildingMeta[] {
  return raw.map((b, idx) => {
    if (typeof b === "string") { const name = b.trim(); return { id: norm(name).replace(/\s+/g, "-") || `b-${idx}`, name: name || "Unnamed", floors: 1, roomsPerFloor: [1], hasRooms: true, singleLocationLabel: "" }; }
    const o = b as any, rawName = String(o?.name || "").trim();
    const id = String(o?.id || "").trim() || norm(rawName).replace(/\s+/g, "-") || `b-${idx}`;
    const floors = typeof o?.floors === "number" && o.floors > 0 ? Math.round(o.floors) : 1;
    return { id, name: rawName || "Unnamed", floors, roomsPerFloor: normaliseRPF(o?.roomsPerFloor, floors), hasRooms: o?.hasRooms === false ? false : true, singleLocationLabel: String(o?.singleLocationLabel || "").trim() };
  });
}
function normConcerns(raw: unknown[]): ConcernMeta[] {
  return raw.map((c, idx) => {
    const o = c as any, label = String(o?.label || "").trim();
    const id = String(o?.id || "").trim() || norm(label).replace(/\s+/g, "-") || `c-${idx}`;
    const subs: string[] = Array.isArray(o?.subconcerns) ? o.subconcerns.map((s: unknown) => String(s || "").trim()).filter((s: string) => s) : [];
    return { id, label: label || "Unnamed", subconcerns: subs };
  });
}
function normStatuses(raw: unknown[]): StatusMeta[] {
  return raw.map((s, idx) => { const o = s as any; return { id: String(o?.id || idx + 1), name: String(o?.name || "").trim() || "Unnamed", color: String(o?.color || "#6C757D").trim() }; });
}
function normPriorities(raw: unknown[]): PriorityMeta[] {
  return raw.map((p, idx) => { const o = p as any; return { id: String(o?.id || idx + 1), name: String(o?.name || "").trim() || "Unnamed", color: String(o?.color || "#6C757D").trim(), notifyInterval: String(o?.notifyInterval || "1month") }; });
}

/* ─────────────────────────── Panel ─────────────────────────── */
function Panel({ title, subtitle, badge, children, defaultOpen = false }: {
  title?: string; subtitle?: string; badge?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`admin-edit__panel admin-edit__panel--collapsible${open ? " admin-edit__panel--open" : ""}`}>
      <button type="button" className="admin-edit__panel-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <div className="admin-edit__panel-toggle-left">
          <div>
            {title    && <h3 className="admin-edit__panel-title">{title}</h3>}
            {subtitle && <p  className="admin-edit__panel-subtitle">{subtitle}</p>}
          </div>
          {badge !== undefined && <span className="admin-edit__panel-badge">{badge}</span>}
        </div>
        <IconChevron open={open}/>
      </button>
      {open && <div className="admin-edit__panel-body">{children}</div>}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function AdminEditPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { addNotification } = useNotifications();

  /* ── Meta state ── */
  const [buildings,  setBuildings]  = useState<BuildingMeta[]>(DEFAULT_BUILDINGS);
  const [concerns,   setConcerns]   = useState<ConcernMeta[]>(DEFAULT_CONCERNS);
  const [statuses,   setStatuses]   = useState<StatusMeta[]>(DEFAULT_STATUSES);
  const [priorities, setPriorities] = useState<PriorityMeta[]>(DEFAULT_PRIORITIES);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [saveMsg,    setSaveMsg]    = useState("");

  /* ── Selectors ── */
  const [selBuildingId,  setSelBuildingId]  = useState("");
  const [selConcernId,   setSelConcernId]   = useState("");
  const [selStatusId,    setSelStatusId]    = useState("");
  const [editPriId,      setEditPriId]      = useState<string | null>(null);
  const [editPriDraft,   setEditPriDraft]   = useState<PriorityMeta | null>(null);
  const [showAddPri,     setShowAddPri]     = useState(false);
  const [newPriDraft,    setNewPriDraft]    = useState<PriorityMeta>({ id: "", name: "", color: "#6C757D", notifyInterval: "1month" });

  /* ── Staff state ── */
  const [staffList,      setStaffList]      = useState<StaffMember[]>([]);
  const [staffLoading,   setStaffLoading]   = useState(false);
  const [staffError,     setStaffError]     = useState("");
  const [staffSaving,    setStaffSaving]    = useState(false);
  const [discFilter,     setDiscFilter]     = useState("All");
  const [showAddStaff,   setShowAddStaff]   = useState(false);
  const [newStaff,       setNewStaff]       = useState<Omit<StaffMember, "_id">>(EMPTY_STAFF);
  const [editStaffId,    setEditStaffId]    = useState<string | null>(null);
  const [editStaffDraft, setEditStaffDraft] = useState<StaffMember | null>(null);

  /* ── Clerk account creation state ── */
  const [clerkCreating, setClerkCreating] = useState(false);
  const [clerkResult,   setClerkResult]   = useState<{ success: boolean; message: string } | null>(null);
  const [newClerkPw,    setNewClerkPw]    = useState("");
  const [showClerkForm, setShowClerkForm] = useState<string | null>(null);

  /* Discipline options = concern labels (excluding "Other") */
  const disciplineOptions = useMemo(
    () => concerns.map(c => c.label).filter(l => l.toLowerCase() !== "other"),
    [concerns]
  );

  /* ── Auth ── */
  const role = useMemo(() => {
    if (!isLoaded || !isSignedIn || !user) return "guest";
    const raw = (user.publicMetadata as any)?.role;
    let r = "student";
    if (Array.isArray(raw) && raw.length > 0) r = String(raw[0]).toLowerCase();
    else if (typeof raw === "string") r = raw.toLowerCase();
    return r;
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { router.replace("/"); return; }
    if (role !== "admin") router.replace("/");
  }, [isLoaded, isSignedIn, user, role, router]);

  /* ── Load meta ── */
  const loadMeta = useCallback(async (mode: "preferDefaults" | "dbOnly" = "preferDefaults") => {
    try {
      setLoading(true); setError(""); setSaveMsg("");
      const res  = await fetch(`${META_URL}?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load options from server.");
      const data = await res.json().catch(() => null);
      if (!data)  throw new Error("Empty meta from server.");
      const rawB = Array.isArray(data.buildings)  ? data.buildings  : [];
      const rawC = Array.isArray(data.concerns)   ? data.concerns   : [];
      const rawS = Array.isArray(data.statuses)   ? data.statuses   : [];
      const rawP = Array.isArray(data.priorities) ? data.priorities : [];
      const iB = (mode === "preferDefaults" && rawB.length === 0) ? DEFAULT_BUILDINGS  : normBuildings(rawB);
      const iC = (mode === "preferDefaults" && rawC.length === 0) ? DEFAULT_CONCERNS   : normConcerns(rawC);
      const iS = (mode === "preferDefaults" && rawS.length === 0) ? DEFAULT_STATUSES   : normStatuses(rawS);
      const iP = (mode === "preferDefaults" && rawP.length === 0) ? DEFAULT_PRIORITIES : normPriorities(rawP);
      setBuildings(iB); setConcerns(iC); setStatuses(iS); setPriorities(iP);
      if (iB.length > 0 && !selBuildingId) setSelBuildingId(iB[0].id);
      if (iC.length > 0 && !selConcernId)  setSelConcernId(iC[0].id);
      if (iS.length > 0 && !selStatusId)   setSelStatusId(iS[0].id);
    } catch (err: any) {
      setError(err?.message || "Could not load. Using defaults.");
      if (mode === "preferDefaults") { setBuildings(DEFAULT_BUILDINGS); setConcerns(DEFAULT_CONCERNS); setStatuses(DEFAULT_STATUSES); setPriorities(DEFAULT_PRIORITIES); }
    } finally { setLoading(false); }
  }, [selBuildingId, selConcernId, selStatusId]);

  /* ── Load staff ── */
  const loadStaff = useCallback(async () => {
    try {
      setStaffLoading(true); setStaffError("");
      const res  = await fetch(`${STAFF_URL}?all=true&ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) { setStaffError(data?.message || "Failed to load staff."); return; }
      setStaffList(Array.isArray(data.staff) ? data.staff : Array.isArray(data) ? data : []);
    } catch { setStaffError("Network error loading staff."); }
    finally { setStaffLoading(false); }
  }, []);

  useEffect(() => { loadMeta("preferDefaults"); loadStaff(); }, []);

  /* ── Save meta ── */
  const handleSave = async () => {
    setSaving(true); setError(""); setSaveMsg("");
    let cleanB = buildings.map((b, idx) => {
      const name = String(b.name || "").trim(); if (!name) return null;
      const id   = String(b.id || "").trim() || norm(name).replace(/\s+/g, "-") || `b-${idx}`;
      const floors = typeof b.floors === "number" && b.floors > 0 ? Math.round(b.floors) : 1;
      return { id, name, floors, roomsPerFloor: normaliseRPF(b.roomsPerFloor, floors), hasRooms: b.hasRooms !== false, singleLocationLabel: String(b.singleLocationLabel || "").trim() };
    }).filter(Boolean) as BuildingMeta[];
    if (!cleanB.some(b => norm(b.name) === "other")) cleanB.push({ id: "other", name: "Other", floors: 1, roomsPerFloor: [1], hasRooms: false, singleLocationLabel: "" });
    cleanB = [...cleanB.filter(b => norm(b.name) !== "other"), ...cleanB.filter(b => norm(b.name) === "other")];

    let cleanC = concerns.map((c, idx) => {
      const label = String(c.label || "").trim(); if (!label) return null;
      const id    = String(c.id || "").trim() || norm(label).replace(/\s+/g, "-") || `c-${idx}`;
      let subs    = (Array.isArray(c.subconcerns) ? c.subconcerns : []).map(s => String(s || "").trim()).filter(s => s);
      subs = [...subs.filter(s => norm(s) !== "other"), "Other"];
      return { id, label, subconcerns: subs };
    }).filter(Boolean) as ConcernMeta[];
    if (!cleanC.some(c => norm(c.label) === "other")) cleanC.push({ id: "other", label: "Other", subconcerns: ["Other"] });
    cleanC = [...cleanC.filter(c => norm(c.label) !== "other"), ...cleanC.filter(c => norm(c.label) === "other")];

    const cleanS = statuses.map((s, idx)   => { const name = String(s.name || "").trim(); if (!name) return null; return { id: String(s.id || idx + 1).trim(), name, color: String(s.color || "#6C757D").trim() }; }).filter(Boolean) as StatusMeta[];
    const cleanP = priorities.map((p, idx) => { const name = String(p.name || "").trim(); if (!name) return null; return { id: String(p.id || idx + 1).trim(), name, color: String(p.color || "#6C757D").trim(), notifyInterval: String(p.notifyInterval || "1month") }; }).filter(Boolean) as PriorityMeta[];

    try {
      const res  = await fetch(META_URL, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buildings: cleanB, concerns: cleanC, statuses: cleanS, priorities: cleanP }) });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Failed to save.");
      const data = await res.json().catch(() => null);
      if (data?.buildings)  setBuildings(normBuildings(data.buildings));
      if (data?.concerns)   setConcerns(normConcerns(data.concerns));
      if (data?.statuses)   setStatuses(normStatuses(data.statuses));
      if (data?.priorities) setPriorities(normPriorities(data.priorities));
      setSaveMsg("All changes saved successfully.");
    } catch (err: any) { setError(err?.message || "Failed to save."); }
    finally { setSaving(false); }
  };

  const selBuilding = useMemo(() => buildings.find(b => b.id === selBuildingId), [buildings, selBuildingId]);
  const selConcern  = useMemo(() => concerns.find(c  => c.id === selConcernId),  [concerns,  selConcernId]);
  const selStatus   = useMemo(() => statuses.find(s  => s.id === selStatusId),   [statuses,  selStatusId]);

  /* ── Building handlers ── */
  const setBName       = (v: string) => setBuildings(p => p.map(b => b.id === selBuildingId ? { ...b, name: v } : b));
  const toggleHasRooms = ()          => setBuildings(p => p.map(b => b.id === selBuildingId ? { ...b, hasRooms: b.hasRooms === false } : b));
  const setFloors      = (v: string) => {
    const fl = Math.min(Math.max(parseInt(v, 10) || 1, 1), 20);
    setBuildings(p => p.map(b => b.id !== selBuildingId ? b : { ...b, floors: fl, roomsPerFloor: normaliseRPF(normaliseRPF(b.roomsPerFloor, b.floors), fl) }));
  };
  const setFloorRooms = (idx: number, v: string) => {
    const rooms = Math.max(parseInt(v, 10) || 1, 1);
    setBuildings(p => p.map(b => { if (b.id !== selBuildingId) return b; const arr = normaliseRPF(b.roomsPerFloor, b.floors); arr[idx] = rooms; return { ...b, roomsPerFloor: [...arr] }; }));
  };
  const addBuilding = () => {
    const nb: BuildingMeta = { id: `b-${Date.now()}`, name: "New Building", floors: 1, roomsPerFloor: [1], hasRooms: true, singleLocationLabel: "" };
    setBuildings(p => [...p, nb]); setSelBuildingId(nb.id);
    addNotification(`Building "${nb.name}" was added.`, "building");
  };
  const deleteBuilding = () => {
    if (!selBuilding) return;
    addNotification(`Building "${selBuilding.name}" was deleted.`, "building");
    const rem = buildings.filter(b => b.id !== selBuildingId);
    setBuildings(rem); setSelBuildingId(rem[0]?.id || "");
  };

  /* ── Concern handlers ── */
  const setCLabel    = (v: string) => setConcerns(p => p.map(c => c.id === selConcernId ? { ...c, label: v } : c));
  const addConcern   = () => {
    const nc: ConcernMeta = { id: `c-${Date.now()}`, label: "New Concern", subconcerns: [] };
    setConcerns(p => [...p, nc]); setSelConcernId(nc.id);
    addNotification(`Concern "${nc.label}" was added.`, "concern");
  };
  const deleteConcern = () => {
    if (!selConcern) return;
    addNotification(`Concern "${selConcern.label}" was deleted.`, "concern");
    const rem = concerns.filter(c => c.id !== selConcernId);
    setConcerns(rem); setSelConcernId(rem[0]?.id || "");
  };
  const setSub = (i: number, v: string) => setConcerns(p => p.map(c => { if (c.id !== selConcernId) return c; const s = [...(c.subconcerns || [])]; s[i] = v; return { ...c, subconcerns: s }; }));
  const addSub = ()          => setConcerns(p => p.map(c => c.id === selConcernId ? { ...c, subconcerns: [...(c.subconcerns || []), ""] } : c));
  const delSub = (i: number) => setConcerns(p => p.map(c => { if (c.id !== selConcernId) return c; const s = [...(c.subconcerns || [])]; s.splice(i, 1); return { ...c, subconcerns: s }; }));

  /* ── Status handlers ── */
  const setSName  = (v: string) => setStatuses(p => p.map(s => s.id === selStatusId ? { ...s, name: v }  : s));
  const setSColor = (v: string) => setStatuses(p => p.map(s => s.id === selStatusId ? { ...s, color: v } : s));
  const addStatus = () => {
    const ns: StatusMeta = { id: `s-${Date.now()}`, name: "New Status", color: "#6C757D" };
    setStatuses(p => [...p, ns]); setSelStatusId(ns.id);
    addNotification(`Status "${ns.name}" was added.`, "status");
  };
  const deleteStatus = () => {
    if (!selStatus) return;
    addNotification(`Status "${selStatus.name}" was deleted.`, "status");
    const rem = statuses.filter(s => s.id !== selStatusId);
    setStatuses(rem); setSelStatusId(rem[0]?.id || "");
  };

  /* ── Priority handlers ── */
  const startEditPri  = (p: PriorityMeta) => { setEditPriId(p.id); setEditPriDraft({ ...p }); setShowAddPri(false); };
  const cancelEditPri = ()                => { setEditPriId(null);  setEditPriDraft(null); };
  const saveEditPri   = () => {
    if (!editPriDraft) return;
    const prev = priorities.find(p => p.id === editPriDraft.id);
    setPriorities(p => p.map(x => x.id === editPriDraft.id ? { ...editPriDraft } : x));
    if (prev?.name           !== editPriDraft.name)           addNotification(`Priority renamed to "${editPriDraft.name}".`, "priority");
    if (prev?.color          !== editPriDraft.color)          addNotification(`Priority "${editPriDraft.name}" color changed.`, "priority");
    if (prev?.notifyInterval !== editPriDraft.notifyInterval) addNotification(`Priority "${editPriDraft.name}" interval updated.`, "priority");
    cancelEditPri();
  };
  const deletePriority = (p: PriorityMeta) => {
    addNotification(`Priority "${p.name}" was deleted.`, "priority");
    setPriorities(r => r.filter(x => x.id !== p.id));
    if (editPriId === p.id) cancelEditPri();
  };
  const addPriority = () => {
    const np: PriorityMeta = { id: `p-${Date.now()}`, name: newPriDraft.name.trim() || "New Priority", color: newPriDraft.color, notifyInterval: newPriDraft.notifyInterval || "1month" };
    setPriorities(p => [...p, np]);
    addNotification(`Priority "${np.name}" was added.`, "priority");
    setShowAddPri(false); setNewPriDraft({ id: "", name: "", color: "#6C757D", notifyInterval: "1month" });
  };

  /* ── Staff helpers ── */
  const toggleDisc = (disc: string, current: string[], setter: (fn: (d: any) => any) => void) => {
    const next = current.includes(disc) ? current.filter(d => d !== disc) : [...current, disc];
    setter((d: any) => ({ ...d, disciplines: next }));
  };

  const addStaff = async () => {
    if (!newStaff.name.trim()) return;
    try {
      setStaffSaving(true); setStaffError("");
      const res  = await fetch(STAFF_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newStaff) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed.");
      setStaffList(p => [...p, data.staff]);
      setNewStaff(EMPTY_STAFF); setShowAddStaff(false);
      addNotification(`Staff "${newStaff.name}" added.`, "staff");
    } catch (err: any) { setStaffError(err.message || "Failed to add staff."); }
    finally { setStaffSaving(false); }
  };

  const saveStaff = async () => {
    if (!editStaffDraft?._id) return;
    try {
      setStaffSaving(true); setStaffError("");
      const res  = await fetch(`${STAFF_URL}/${editStaffDraft._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editStaffDraft) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed.");
      setStaffList(p => p.map(s => s._id === data.staff._id ? data.staff : s));
      setEditStaffId(null); setEditStaffDraft(null);
      addNotification(`Staff "${editStaffDraft.name}" updated.`, "staff");
    } catch (err: any) { setStaffError(err.message || "Failed to save."); }
    finally { setStaffSaving(false); }
  };

  const deleteStaff = async (m: StaffMember) => {
    if (!m._id) return;
    try {
      setStaffSaving(true);
      const res = await fetch(`${STAFF_URL}/${m._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setStaffList(p => p.filter(s => s._id !== m._id));
      if (editStaffId === m._id) { setEditStaffId(null); setEditStaffDraft(null); }
      addNotification(`Staff "${m.name}" removed.`, "staff");
    } catch { setStaffError("Failed to delete."); }
    finally { setStaffSaving(false); }
  };

  /* ── Clerk account creation ── */
  const createClerkAccount = async (member: StaffMember) => {
    if (!member.clerkUsername?.trim() || !newClerkPw.trim()) {
      setClerkResult({ success: false, message: "Username and password are required." });
      return;
    }
    try {
      setClerkCreating(true);
      setClerkResult(null);
      const res  = await fetch(`${API_BASE}/api/staff/create-clerk`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          staffId:  member._id,
          username: member.clerkUsername.trim(),
          password: newClerkPw.trim(),
          name:     member.name,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to create account.");
      setClerkResult({ success: true, message: `Account "${member.clerkUsername}" created successfully!` });
      setNewClerkPw("");
      setShowClerkForm(null);
      loadStaff();
    } catch (err: any) {
      setClerkResult({ success: false, message: err.message || "Failed." });
    } finally {
      setClerkCreating(false);
    }
  };

  const filteredStaff = staffList.filter(s => discFilter === "All" || s.disciplines.includes(discFilter));

  /* ── Guards ── */
  if (!isLoaded || !isSignedIn) return <div className="admin-edit__wrapper"><p>Checking permissions…</p></div>;
  if (role !== "admin")         return <div className="admin-edit__wrapper"><p>Access denied.</p></div>;

  /* ════════════════════════════════════════════════════════════ */
  return (
    <div className="admin-edit admin-edit__wrapper">
      <main className="admin-edit__layout">

        {/* Header */}
        <header className="admin-edit__page-head">
          <div className="admin-edit__heading">
            <h1 className="admin-edit__page-title">System Configuration</h1>
            <p className="admin-edit__page-subtitle">Click any section to expand and edit</p>
            <p className="admin-edit__meta">
              {buildings.length} buildings · {concerns.length} concerns · {statuses.length} statuses · {priorities.length} priorities · {staffList.length} staff
            </p>
          </div>
          <div className="admin-edit__actions">
            <button type="button" className="btn btn-secondary" disabled={saving || loading}
              onClick={() => {
                setBuildings(DEFAULT_BUILDINGS); setConcerns(DEFAULT_CONCERNS); setStatuses(DEFAULT_STATUSES); setPriorities(DEFAULT_PRIORITIES);
                setSaveMsg(""); setError("");
                setSelBuildingId(DEFAULT_BUILDINGS[0].id); setSelConcernId(DEFAULT_CONCERNS[0].id); setSelStatusId(DEFAULT_STATUSES[0].id);
                cancelEditPri(); setShowAddPri(false);
              }}>Load Defaults</button>
            <button type="button" className="btn btn-secondary" onClick={() => loadMeta("dbOnly")} disabled={saving || loading}>Load Database</button>
            <button type="button" className="btn btn-primary"   onClick={handleSave}               disabled={saving || loading}>{saving ? "Saving…" : "Save All Changes"}</button>
          </div>
        </header>

        {error   && <div className="admin-edit__alert admin-edit__alert--error">{error}</div>}
        {saveMsg && <div className="admin-edit__alert admin-edit__alert--success">{saveMsg}</div>}

        {loading ? <p className="admin-edit__loading">Loading options…</p> : (
          <div className="admin-edit__accordion">

            {/* ══ BUILDINGS ══ */}
            <Panel title="Buildings" subtitle="Add, edit, or remove campus buildings" badge={buildings.length}>
              <div className="admin-edit__selector-row">
                <div className="admin-edit__field-group" style={{ flex: 1 }}>
                  <label className="admin-edit__label">Select Building</label>
                  <select className="admin-edit__input" value={selBuildingId} onChange={e => setSelBuildingId(e.target.value)}>
                    <option value="">-- Select a building --</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <button type="button" className="btn btn-secondary" onClick={addBuilding}>+ Add New</button>
              </div>
              {selBuilding ? (
                <div className="admin-edit__editor-card">
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__label">Building Name</label>
                    <input type="text" className="admin-edit__input" value={selBuilding.name} placeholder="e.g. CBAA"
                      onChange={e => setBName(e.target.value)}
                      onBlur={e => { const prev = buildings.find(b => b.id === selBuildingId)?.name || ""; if (prev !== e.target.value) addNotification(`Building renamed to "${e.target.value}".`, "building"); }}/>
                  </div>
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__switch">
                      <input type="checkbox" checked={selBuilding.hasRooms !== false} onChange={toggleHasRooms}/>
                      <span className="admin-edit__switch-pill"><span className="admin-edit__switch-knob"/></span>
                      <span className="admin-edit__switch-text">{selBuilding.hasRooms !== false ? "Has floors and rooms" : "Specific spot only"}</span>
                    </label>
                  </div>
                  {selBuilding.hasRooms !== false && (<>
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Number of Floors</label>
                      <input type="number" min={1} max={20} className="admin-edit__input admin-edit__input-small" value={selBuilding.floors} onChange={e => setFloors(e.target.value)}/>
                    </div>
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Rooms per Floor<span className="admin-edit__label-hint"> — set individually</span></label>
                      <div className="admin-edit__floors-grid">
                        {getRoomsArray(selBuilding).map((count, idx) => (
                          <div key={idx} className="admin-edit__floor-row">
                            <span className="admin-edit__floor-label">{FLOOR_ORDINALS[idx] ?? `Floor ${idx + 1}`}</span>
                            <input type="number" min={1} className="admin-edit__input admin-edit__input-floor" value={count} onChange={e => setFloorRooms(idx, e.target.value)}/>
                            <span className="admin-edit__floor-unit">rooms</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="admin-edit__info-box">
                      <strong>Total Rooms:</strong> {totalRooms(selBuilding)}
                      <span className="admin-edit__info-breakdown">&nbsp;({getRoomsArray(selBuilding).map((n, i) => `${FLOOR_ORDINALS[i] ?? `F${i + 1}`}: ${n}`).join(" · ")})</span>
                    </div>
                  </>)}
                  <div className="admin-edit__actions-row">
                    <button type="button" className="btn btn-danger" onClick={deleteBuilding}>Delete Building</button>
                  </div>
                </div>
              ) : <p className="admin-edit__empty">Select a building to edit it</p>}
            </Panel>

            {/* ══ CONCERNS ══ */}
            <Panel title="Concerns" subtitle="Manage concern categories and their subconcerns" badge={concerns.length}>
              <div className="admin-edit__selector-row">
                <div className="admin-edit__field-group" style={{ flex: 1 }}>
                  <label className="admin-edit__label">Select Concern</label>
                  <select className="admin-edit__input" value={selConcernId} onChange={e => setSelConcernId(e.target.value)}>
                    <option value="">-- Select a concern --</option>
                    {concerns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <button type="button" className="btn btn-secondary" onClick={addConcern}>+ Add New</button>
              </div>
              {selConcern ? (
                <div className="admin-edit__editor-card">
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__label">Concern Name</label>
                    <input type="text" className="admin-edit__input" value={selConcern.label} placeholder="e.g. Electrical"
                      onChange={e => setCLabel(e.target.value)}
                      onBlur={e => { const prev = concerns.find(c => c.id === selConcernId)?.label || ""; if (prev !== e.target.value) addNotification(`Concern renamed to "${e.target.value}".`, "concern"); }}/>
                  </div>
                  <div className="admin-edit__subconcerns-section">
                    <div className="admin-edit__subconcerns-head">
                      <h4>Subconcerns</h4>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={addSub}>+ Add Subconcern</button>
                    </div>
                    {(!selConcern.subconcerns || selConcern.subconcerns.length === 0) && <p className="admin-edit__empty">No subconcerns yet.</p>}
                    {(selConcern.subconcerns || []).map((sub, idx) => (
                      <div key={idx} className="admin-edit__subconcern-row">
                        <input type="text" className="admin-edit__input" value={sub} placeholder="e.g. Walls" onChange={e => setSub(idx, e.target.value)}/>
                        <button type="button" className="btn btn-ghost" onClick={() => delSub(idx)}>Delete</button>
                      </div>
                    ))}
                  </div>
                  <div className="admin-edit__actions-row">
                    <button type="button" className="btn btn-danger" onClick={deleteConcern}>Delete Concern</button>
                  </div>
                </div>
              ) : <p className="admin-edit__empty">Select a concern to edit it</p>}
            </Panel>

            {/* ══ STATUSES ══ */}
            <Panel title="Statuses" subtitle="Configure report status labels and display colors" badge={statuses.length}>
              <div className="admin-edit__selector-row">
                <div className="admin-edit__field-group" style={{ flex: 1 }}>
                  <label className="admin-edit__label">Select Status</label>
                  <select className="admin-edit__input" value={selStatusId} onChange={e => setSelStatusId(e.target.value)}>
                    <option value="">-- Select a status --</option>
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <button type="button" className="btn btn-secondary" onClick={addStatus}>+ Add New</button>
              </div>
              {selStatus ? (
                <div className="admin-edit__editor-card">
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__label">Status Name</label>
                    <input type="text" className="admin-edit__input" value={selStatus.name} placeholder="e.g. In Progress"
                      onChange={e => setSName(e.target.value)}
                      onBlur={e => { const prev = statuses.find(s => s.id === selStatusId)?.name || ""; if (prev !== e.target.value) addNotification(`Status renamed to "${e.target.value}".`, "status"); }}/>
                  </div>
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__label">Display Color</label>
                    <div className="admin-edit__color-row">
                      <ColorPicker value={selStatus.color} onChange={setSColor}/>
                      <span className="admin-edit__color-preview" style={{ backgroundColor: selStatus.color }}>{selStatus.name}</span>
                    </div>
                  </div>
                  <div className="admin-edit__actions-row">
                    <button type="button" className="btn btn-danger" onClick={deleteStatus}>Delete Status</button>
                  </div>
                </div>
              ) : <p className="admin-edit__empty">Select a status to edit it</p>}
            </Panel>

            {/* ══ PRIORITIES ══ */}
            <Panel title="Priority Levels" subtitle="Configure priority labels, colors and notification intervals" badge={priorities.length}>
              <div className="admin-edit__priority-header">
                <button type="button" className="btn btn-primary btn-sm"
                  onClick={() => { setShowAddPri(true); setEditPriId(null); setNewPriDraft({ id: "", name: "", color: "#6C757D", notifyInterval: "1month" }); }}>
                  + Add Priority
                </button>
              </div>
              {showAddPri && (
                <div className="admin-edit__priority-form">
                  <div className="admin-edit__priority-form-fields">
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Name</label>
                      <input type="text" className="admin-edit__input" value={newPriDraft.name} placeholder="e.g. Critical" onChange={e => setNewPriDraft(d => ({ ...d, name: e.target.value }))}/>
                    </div>
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Color</label>
                      <div className="admin-edit__color-row">
                        <ColorPicker value={newPriDraft.color} onChange={color => setNewPriDraft(d => ({ ...d, color }))}/>
                        <span className="admin-edit__color-preview" style={{ backgroundColor: newPriDraft.color }}>{newPriDraft.name || "Preview"}</span>
                      </div>
                    </div>
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Notification Interval</label>
                      <div className="admin-edit__notify-timeline">
                        {NOTIFY_INTERVAL_OPTIONS.map(opt => (
                          <button key={opt.value} type="button"
                            className={`admin-edit__notify-option${newPriDraft.notifyInterval === opt.value ? " admin-edit__notify-option--active" : ""}`}
                            onClick={() => setNewPriDraft(d => ({ ...d, notifyInterval: opt.value }))}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="admin-edit__priority-form-actions">
                    <button type="button" className="btn btn-primary btn-sm"   onClick={addPriority}>Add</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddPri(false)}>Cancel</button>
                  </div>
                </div>
              )}
              <div className="admin-edit__priority-list">
                {priorities.map(p => (
                  <div key={p.id} className="admin-edit__priority-item-wrap">
                    {editPriId === p.id && editPriDraft ? (
                      <div className="admin-edit__priority-form">
                        <div className="admin-edit__priority-form-fields">
                          <div className="admin-edit__field-group">
                            <label className="admin-edit__label">Name</label>
                            <input type="text" className="admin-edit__input" value={editPriDraft.name} onChange={e => setEditPriDraft(d => d ? { ...d, name: e.target.value } : d)}/>
                          </div>
                          <div className="admin-edit__field-group">
                            <label className="admin-edit__label">Color</label>
                            <div className="admin-edit__color-row">
                              <ColorPicker value={editPriDraft.color} onChange={color => setEditPriDraft(d => d ? { ...d, color } : d)}/>
                              <span className="admin-edit__color-preview" style={{ backgroundColor: editPriDraft.color }}>{editPriDraft.name}</span>
                            </div>
                          </div>
                          <div className="admin-edit__field-group">
                            <label className="admin-edit__label">Notification Interval</label>
                            <div className="admin-edit__notify-timeline">
                              {NOTIFY_INTERVAL_OPTIONS.map(opt => (
                                <button key={opt.value} type="button"
                                  className={`admin-edit__notify-option${editPriDraft.notifyInterval === opt.value ? " admin-edit__notify-option--active" : ""}`}
                                  onClick={() => setEditPriDraft(d => d ? { ...d, notifyInterval: opt.value } : d)}>{opt.label}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="admin-edit__priority-form-actions">
                          <button type="button" className="btn btn-primary btn-sm"   onClick={saveEditPri}>Save</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEditPri}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="admin-edit__priority-row">
                        <span className="admin-edit__priority-dot" style={{ backgroundColor: p.color }}/>
                        <span className="admin-edit__priority-name">{p.name}</span>
                        <span className="admin-edit__priority-interval">{NOTIFY_INTERVAL_LABELS[p.notifyInterval || "1month"]}</span>
                        <div className="admin-edit__priority-row-actions">
                          <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--edit"   onClick={() => startEditPri(p)}  title="Edit"><IconPencil/></button>
                          <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--delete" onClick={() => deletePriority(p)} title="Delete"><IconTrash/></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {priorities.length === 0 && <p className="admin-edit__empty">No priorities yet.</p>}
              </div>
            </Panel>

            {/* ══ STAFF MANAGEMENT ══ */}
            <Panel title="Staff Management" subtitle="Configure engineers and technicians — assign disciplines and positions" badge={staffList.length}>

              {staffError && <div className="admin-edit__alert admin-edit__alert--error" style={{ marginBottom: 12 }}>{staffError}</div>}

              {/* Top bar */}
              <div className="staff-topbar">
                <div className="staff-disc-tabs">
                  {["All", ...disciplineOptions].map(d => (
                    <button key={d} type="button"
                      className={`staff-disc-tab${discFilter === d ? " staff-disc-tab--active" : ""}`}
                      onClick={() => setDiscFilter(d)}>{d}</button>
                  ))}
                </div>
                <button type="button" className="btn btn-primary btn-sm staff-add-btn"
                  onClick={() => { setShowAddStaff(v => !v); setEditStaffId(null); setEditStaffDraft(null); setNewStaff(EMPTY_STAFF); }}>
                  <IconPlus/> Add Staff
                </button>
              </div>

              {/* Add form */}
              {showAddStaff && (
                <div className="staff-form-card">
                  <p className="staff-form-card-title">New Staff Member</p>
                  <div className="staff-form-grid">
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Full Name <span className="staff-required">*</span></label>
                      <input type="text" className="admin-edit__input" value={newStaff.name} placeholder="e.g. John Doe"
                        onChange={e => setNewStaff(d => ({ ...d, name: e.target.value }))}/>
                    </div>
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Email</label>
                      <input type="email" className="admin-edit__input" value={newStaff.email} placeholder="john@bfmo.edu"
                        onChange={e => setNewStaff(d => ({ ...d, email: e.target.value }))}/>
                    </div>
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Position</label>
                      <select className="admin-edit__input" value={newStaff.position} onChange={e => setNewStaff(d => ({ ...d, position: e.target.value }))}>
                        {POSITION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Phone</label>
                      <input type="text" className="admin-edit__input" value={newStaff.phone || ""} placeholder="Optional"
                        onChange={e => setNewStaff(d => ({ ...d, phone: e.target.value }))}/>
                    </div>
                  </div>
                  <div className="admin-edit__field-group" style={{ marginTop: 12 }}>
                    <label className="admin-edit__label">
                      Disciplines
                      <span className="admin-edit__label-hint"> — staff only appear in tasks for their assigned disciplines</span>
                    </label>
                    <div className="staff-chips">
                      {disciplineOptions.map(d => {
                        const on = newStaff.disciplines.includes(d);
                        return (
                          <button key={d} type="button" className={`staff-chip${on ? " staff-chip--on" : ""}`}
                            onClick={() => toggleDisc(d, newStaff.disciplines, setNewStaff)}>
                            {on && <IconCheck/>}{d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="admin-edit__field-group" style={{ marginTop: 8 }}>
                    <label className="admin-edit__label">Notes</label>
                    <input type="text" className="admin-edit__input" value={newStaff.notes || ""} placeholder="Optional"
                      onChange={e => setNewStaff(d => ({ ...d, notes: e.target.value }))}/>
                  </div>
                  <div className="staff-form-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddStaff(false)} disabled={staffSaving}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm"   onClick={addStaff} disabled={staffSaving || !newStaff.name.trim()}>
                      {staffSaving ? "Adding…" : "Add Member"}
                    </button>
                  </div>
                </div>
              )}

              {/* Staff list */}
              {staffLoading ? <p className="admin-edit__loading">Loading staff…</p> : (
                <div className="staff-list">
                  {filteredStaff.length === 0 && (
                    <div className="staff-empty">
                      <svg viewBox="0 0 64 64" fill="none" width="40" height="40">
                        <circle cx="32" cy="24" r="12" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
                        <path d="M8 56c0-13.3 10.7-24 24-24s24 10.7 24 24" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
                      </svg>
                      <p>{discFilter === "All" ? 'No staff yet. Click "Add Staff" to get started.' : `No ${discFilter} engineers assigned.`}</p>
                    </div>
                  )}

                  {filteredStaff.map(member => {
                    const isEditing = editStaffId === member._id;
                    const posStyle  = POSITION_COLORS[member.position] || POSITION_COLORS["Other"];
                    const initials  = member.name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
                    return (
                      <div key={member._id}>

                        {/* ── Staff card ── */}
                        <div className={`staff-card${isEditing ? " staff-card--editing" : ""}${!member.active ? " staff-card--inactive" : ""}`}>
                          {isEditing && editStaffDraft ? (
                            /* Edit form */
                            <div className="staff-edit-body">
                              <div className="staff-form-grid">
                                <div className="admin-edit__field-group">
                                  <label className="admin-edit__label">Full Name</label>
                                  <input type="text" className="admin-edit__input" value={editStaffDraft.name}
                                    onChange={e => setEditStaffDraft(d => d ? { ...d, name: e.target.value } : d)}/>
                                </div>
                                <div className="admin-edit__field-group">
                                  <label className="admin-edit__label">Email</label>
                                  <input type="email" className="admin-edit__input" value={editStaffDraft.email}
                                    onChange={e => setEditStaffDraft(d => d ? { ...d, email: e.target.value } : d)}/>
                                </div>
                                <div className="admin-edit__field-group">
                                  <label className="admin-edit__label">Position</label>
                                  <select className="admin-edit__input" value={editStaffDraft.position}
                                    onChange={e => setEditStaffDraft(d => d ? { ...d, position: e.target.value } : d)}>
                                    {POSITION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                </div>
                                <div className="admin-edit__field-group">
                                  <label className="admin-edit__label">Phone</label>
                                  <input type="text" className="admin-edit__input" value={editStaffDraft.phone || ""}
                                    onChange={e => setEditStaffDraft(d => d ? { ...d, phone: e.target.value } : d)}/>
                                </div>
                              </div>
                              <div className="admin-edit__field-group" style={{ marginTop: 10 }}>
                                <label className="admin-edit__label">Disciplines</label>
                                <div className="staff-chips">
                                  {disciplineOptions.map(d => {
                                    const on = editStaffDraft.disciplines.includes(d);
                                    return (
                                      <button key={d} type="button" className={`staff-chip${on ? " staff-chip--on" : ""}`}
                                        onClick={() => toggleDisc(d, editStaffDraft.disciplines, setEditStaffDraft)}>
                                        {on && <IconCheck/>}{d}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="admin-edit__field-group" style={{ marginTop: 8 }}>
                                <label className="admin-edit__label">Notes</label>
                                <input type="text" className="admin-edit__input" value={editStaffDraft.notes || ""}
                                  onChange={e => setEditStaffDraft(d => d ? { ...d, notes: e.target.value } : d)}/>
                              </div>
                              <label className="admin-edit__switch" style={{ marginTop: 10 }}>
                                <input type="checkbox" checked={editStaffDraft.active}
                                  onChange={() => setEditStaffDraft(d => d ? { ...d, active: !d.active } : d)}/>
                                <span className="admin-edit__switch-pill"><span className="admin-edit__switch-knob"/></span>
                                <span className="admin-edit__switch-text">{editStaffDraft.active ? "Active" : "Inactive"}</span>
                              </label>
                              <div className="staff-form-actions">
                                <button type="button" className="btn btn-secondary btn-sm"
                                  onClick={() => { setEditStaffId(null); setEditStaffDraft(null); }} disabled={staffSaving}>Cancel</button>
                                <button type="button" className="btn btn-primary btn-sm" onClick={saveStaff}
                                  disabled={staffSaving || !editStaffDraft.name.trim()}>
                                  {staffSaving ? "Saving…" : "Save Changes"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Display row */
                            <div className="staff-row">
                              <div className="staff-avatar">{initials}</div>
                              <div className="staff-info">
                                <div className="staff-info-top">
                                  <span className="staff-name">{member.name}</span>
                                  <span className="staff-pos-badge" style={{ backgroundColor: posStyle.bg, color: posStyle.text }}>
                                    {member.position}
                                  </span>
                                  {!member.active && <span className="staff-inactive-tag">Inactive</span>}
                                  {member.clerkId && (
                                    <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", borderRadius: 4, padding: "2px 6px" }}>
                                      ✓ Clerk linked
                                    </span>
                                  )}
                                </div>
                                {member.email && <span className="staff-email">{member.email}</span>}
                                <div className="staff-disc-pills">
                                  {member.disciplines.length === 0
                                    ? <span className="staff-no-disc">No disciplines</span>
                                    : member.disciplines.map(d => <span key={d} className="staff-disc-pill">{d}</span>)
                                  }
                                </div>
                                {member.notes && <span className="staff-notes">{member.notes}</span>}
                              </div>
                              <div className="staff-row-btns">
                                {/* Create Clerk Account button */}
                                <button
                                  type="button"
                                  className="admin-edit__icon-btn admin-edit__icon-btn--clerk"
                                  title={member.clerkId ? "Clerk account linked" : "Create Clerk account"}
                                 onClick={() => {
  setShowClerkForm(showClerkForm === member._id ? null : (member._id || null));
  setClerkResult(null);
  setNewClerkPw("");
  // ✅ Auto-generate username from email prefix (ejn-2032@dlsud.edu.ph → ejn2032)
  const emailPrefix = (member.email || "").split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
  setEditStaffDraft({
    ...member,
    clerkUsername: member.clerkUsername || emailPrefix,
  });
}}
                                >
                                  {member.clerkId ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                      <circle cx="12" cy="7" r="4"/>
                                      <polyline points="16 11 18 13 22 9"/>
                                    </svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                      <circle cx="12" cy="7" r="4"/>
                                      <line x1="12" y1="11" x2="12" y2="17"/>
                                      <line x1="9" y1="14" x2="15" y2="14"/>
                                    </svg>
                                  )}
                                </button>
                                <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--edit"
                                  onClick={() => { setEditStaffId(member._id || ""); setEditStaffDraft({ ...member }); setShowAddStaff(false); setShowClerkForm(null); }}
                                  title="Edit"><IconPencil/></button>
                                <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--delete"
                                  onClick={() => deleteStaff(member)} title="Remove"><IconTrash/></button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* ── Clerk Account Creation Form — inside map, has access to `member` ── */}
                        {showClerkForm === member._id && (
  <div className="staff-clerk-form">
    <p className="staff-clerk-form-title">
      {member.clerkId ? "✓ Clerk account already linked" : "Create Login Account"}
    </p>

    {!member.clerkId ? (
      <>
        <div className="staff-clerk-fields">

          {/* Email — pre-filled from staff record, read-only display */}
          <div className="admin-edit__field-group">
            <label className="admin-edit__label">Email</label>
            <input
              type="text"
              className="admin-edit__input"
              value={member.email || ""}
              readOnly
              style={{ background: "#f3f4f6", color: "#6b7280" }}
            />
            <span className="admin-edit__label-hint">Pulled from staff record</span>
          </div>

          {/* Username — auto-generated from email prefix, editable */}
          <div className="admin-edit__field-group">
            <label className="admin-edit__label">Username <span className="staff-required">*</span></label>
            <input
              type="text"
              className="admin-edit__input"
              placeholder="e.g. ejn2032"
              value={editStaffDraft?.clerkUsername || ""}
              onChange={e => setEditStaffDraft(d => d ? { ...d, clerkUsername: e.target.value.replace(/[^a-zA-Z0-9_-]/g, "") } : d)}
            />
            <span className="admin-edit__label-hint">
              No spaces or special characters. Staff uses this to log in.
            </span>
          </div>

          {/* Temporary password */}
          <div className="admin-edit__field-group">
            <label className="admin-edit__label">Temporary Password <span className="staff-required">*</span></label>
            <input
              type="text"
              className="admin-edit__input"
              placeholder="Min 8 characters"
              value={newClerkPw}
              onChange={e => setNewClerkPw(e.target.value)}
            />
            <span className="admin-edit__label-hint">
              Share this with the staff member. They can change it after logging in.
            </span>
          </div>

          {/* Name — read-only */}
          <div className="admin-edit__field-group">
            <label className="admin-edit__label">Name</label>
            <input
              type="text"
              className="admin-edit__input"
              value={member.name}
              readOnly
              style={{ background: "#f3f4f6", color: "#6b7280" }}
            />
          </div>

          {/* Position — read-only */}
          <div className="admin-edit__field-group">
            <label className="admin-edit__label">Position</label>
            <input
              type="text"
              className="admin-edit__input"
              value={member.position}
              readOnly
              style={{ background: "#f3f4f6", color: "#6b7280" }}
            />
          </div>

          {/* Disciplines — read-only */}
          <div className="admin-edit__field-group">
            <label className="admin-edit__label">Disciplines</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {member.disciplines.length === 0
                ? <span className="staff-no-disc">None assigned</span>
                : member.disciplines.map(d => (
                    <span key={d} className="staff-disc-pill">{d}</span>
                  ))
              }
            </div>
          </div>

          {/* Role/Accessibility */}
          <div className="admin-edit__field-group">
            <label className="admin-edit__label">Accessibility (Role)</label>
            <input
              type="text"
              className="admin-edit__input"
              value="Staff — can view reports and tasks"
              readOnly
              style={{ background: "#f3f4f6", color: "#6b7280" }}
            />
            <span className="admin-edit__label-hint">
              Role is automatically set to "staff" in Clerk.
            </span>
          </div>

        </div>

        {clerkResult && (
          <div className={`staff-clerk-result${clerkResult.success ? " staff-clerk-result--ok" : " staff-clerk-result--err"}`}>
            {clerkResult.message}
          </div>
        )}

        <div className="staff-form-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-secondary btn-sm"
            onClick={() => { setShowClerkForm(null); setClerkResult(null); setNewClerkPw(""); }}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm"
            onClick={() => createClerkAccount({ ...member, clerkUsername: editStaffDraft?.clerkUsername || "" })}
            disabled={clerkCreating || !newClerkPw.trim() || !editStaffDraft?.clerkUsername?.trim()}>
            {clerkCreating ? "Creating…" : "Create Account"}
          </button>
        </div>
      </>
    ) : (
      <div style={{ marginTop: 8 }}>
        <p style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✓ This staff member has a Clerk account.</p>
        <p className="admin-edit__label-hint">Username: <code>{member.clerkUsername || "—"}</code></p>
        <p className="admin-edit__label-hint">Clerk ID: <code style={{ fontSize: 11 }}>{member.clerkId}</code></p>
      </div>
    )}
  </div>
)}

                      </div> // closes key={member._id} wrapper
                    );
                  })}
                </div>
              )}
            </Panel>

          </div>
        )}
      </main>
    </div>
  );
}