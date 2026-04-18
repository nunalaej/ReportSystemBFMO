// app/Admin/Edit/page.tsx
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
const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconBuilding = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
  </svg>
);
const IconTag = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const IconActivity = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IconGraduate = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);
const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconSave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
);

/* ─────────────────────────── Types ─────────────────────────── */
type BuildingMeta  = { id: string; name: string; floors: number; roomsPerFloor: number | number[]; hasRooms?: boolean; singleLocationLabel?: string; };
type ConcernMeta   = { id: string; label: string; subconcerns: string[]; };
type StatusMeta    = { id: string; name: string; color: string; };
type PriorityMeta  = { id: string; name: string; color: string; notifyInterval?: string; };
type NotifRule     = { name: string; color: string; maxDuration: string; schedule: { phase: string; interval: string }[]; unfinishedNote: string; };
type StaffMember   = {
  _id?: string; name: string; email: string; phone?: string;
  position: string; disciplines: string[]; active: boolean;
  notes?: string; clerkUsername?: string; clerkId?: string;
};

/* ─────────────────────────── Position colors ───────────────── */
const POSITION_COLOR_DEFAULTS: Record<string, { bg: string; text: string }> = {
  "Head Engineer":  { bg: "#fef3c7", text: "#92400e" },
  "Staff Engineer": { bg: "#dbeafe", text: "#1e40af" },
  "Supervisor":     { bg: "#f3e8ff", text: "#6b21a8" },
  "Technician":     { bg: "#dcfce7", text: "#166534" },
  "Other":          { bg: "#f1f5f9", text: "#475569" },
};
const POSITION_COLOR_CYCLE = [
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#dbeafe", text: "#1e40af" },
  { bg: "#f3e8ff", text: "#6b21a8" },
  { bg: "#dcfce7", text: "#166534" },
  { bg: "#f1f5f9", text: "#475569" },
  { bg: "#fce7f3", text: "#9d174d" },
  { bg: "#ecfdf5", text: "#065f46" },
  { bg: "#fff7ed", text: "#9a3412" },
];
function getPositionStyle(position: string, positionOptions: string[]): { bg: string; text: string } {
  if (POSITION_COLOR_DEFAULTS[position]) return POSITION_COLOR_DEFAULTS[position];
  const idx = positionOptions.indexOf(position);
  return POSITION_COLOR_CYCLE[idx >= 0 ? idx % POSITION_COLOR_CYCLE.length : 0];
}

/* ─────────────────────────── Defaults ──────────────────────── */
const DEFAULT_POSITION_OPTIONS: string[]   = ["Head Engineer", "Staff Engineer", "Supervisor", "Technician", "Other"];
const DEFAULT_DISCIPLINE_OPTIONS: string[] = ["Electrical", "Civil", "Mechanical", "Safety Hazard"];
const DEFAULT_EMPTY_STAFF = (pos: string[]): Omit<StaffMember, "_id"> => ({
  name: "", email: "", phone: "",
  position: pos[1] || pos[0] || "Staff Engineer",
  disciplines: [], active: true, notes: "", clerkUsername: "",
});
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
const DEFAULT_COLLEGES:    string[] = ["CICS","COCS","CTHM","CBAA","CLAC","COED","CEAT","CCJE","Staff"];
const DEFAULT_YEAR_LEVELS: string[] = ["1st Year","2nd Year","3rd Year","4th Year"];
const DEFAULT_NOTIF_RULES: NotifRule[] = [
  { name:"Urgent",  color:"#a40010", maxDuration:"1 Day",            schedule:[{phase:"Immediately",interval:"Every 1 hour"},{phase:"After deadline",interval:"Escalate → Unfinished, notify every 3 days"}], unfinishedNote:"Staff notified every 3 days until task is closed." },
  { name:"High",    color:"#ce4f01", maxDuration:"1 Week (7 days)",   schedule:[{phase:"Days 1–6",interval:"Every 1 day"},{phase:"Last 12 hours",interval:"Every 4 hours"},{phase:"After deadline",interval:"Escalate → Unfinished, notify every 3 days"}], unfinishedNote:"Staff notified every 3 days until task is closed." },
  { name:"Medium",  color:"#FFC107", maxDuration:"1 Month (30 days)", schedule:[{phase:"Days 1–29",interval:"Every 3 days"},{phase:"Last 24 hours",interval:"Every 8 hours"},{phase:"After deadline",interval:"Escalate → Unfinished, notify every 3 days"}], unfinishedNote:"Staff notified every 3 days until task is closed." },
  { name:"Low",     color:"#28A745", maxDuration:"3 Months (90 days)",schedule:[{phase:"Days 1–87",interval:"Every 7 days"},{phase:"Last 3 days",interval:"Every 1 day"},{phase:"After deadline",interval:"Escalate → Unfinished, notify every 3 days"}], unfinishedNote:"Staff notified every 3 days until task is closed." },
];

const NOTIFY_INTERVAL_OPTIONS = [
  { value:"daily",   label:"Every Day"      },
  { value:"1week",   label:"Every Week"     },
  { value:"1month",  label:"Every Month"    },
  { value:"3months", label:"Every 3 Months" },
];
const NOTIFY_INTERVAL_LABELS: Record<string,string> = {
  daily:"Every Day", "1week":"Every Week", "1month":"Every Month", "3months":"Every 3 Months",
};
const FLOOR_ORDINALS = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th"].map(n=>`${n} Floor`);

/* ─────────────────────────── Nav tabs config ───────────────── */
type TabId = "buildings" | "concerns" | "statuses" | "priorities" | "notifications" | "students" | "staff";
const NAV_TABS: { id: TabId; label: string; icon: React.ReactNode; badge?: (s: any) => number }[] = [
  { id:"buildings",     label:"Buildings",          icon:<IconBuilding/>,  badge:s=>s.buildings.length  },
  { id:"concerns",      label:"Concerns",           icon:<IconTag/>,       badge:s=>s.concerns.length   },
  { id:"statuses",      label:"Statuses",           icon:<IconActivity/>,  badge:s=>s.statuses.length   },
  { id:"priorities",    label:"Priorities",         icon:<IconActivity/>,  badge:s=>s.priorities.length },
  { id:"notifications", label:"Notif. Rules",       icon:<IconBell/>,      badge:s=>s.notifRules.length },
  { id:"students",      label:"Student Settings",   icon:<IconGraduate/>,  badge:s=>s.colleges.length+s.yearLevels.length },
  { id:"staff",         label:"Staff Management",   icon:<IconUsers/>,     badge:s=>s.staffList.length  },
];

/* ─────────────────────────── Color palette ─────────────────── */
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
  const [open, setOpen] = useState(false);
  const [hex,  setHex]  = useState(value);
  const ref             = React.useRef<HTMLDivElement>(null);
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
          style={{ transition:"transform 0.2s", transform:open?"rotate(180deg)":"rotate(0deg)", flexShrink:0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="cp-dropdown">
          <button type="button" className="cp-auto-btn" onClick={() => pick("#000000")}><span className="cp-auto-swatch"/><span>Automatic</span></button>
          <p className="cp-section-label">Theme Colors</p>
          <div className="cp-grid">
            {THEME_COLORS.map((row, ri) => row.map((color, ci) => (
              <button key={`t-${ri}-${ci}`} type="button" className={`cp-swatch${value===color?" cp-swatch--active":""}`} style={{backgroundColor:color}} title={color} onClick={()=>pick(color)}/>
            )))}
          </div>
          <p className="cp-section-label">Standard Colors</p>
          <div className="cp-row">
            {STANDARD_COLORS.map(color=>(
              <button key={color} type="button" className={`cp-swatch${value===color?" cp-swatch--active":""}`} style={{backgroundColor:color}} title={color} onClick={()=>pick(color)}/>
            ))}
          </div>
          <div className="cp-custom-row">
            <span className="cp-custom-label">Custom</span>
            <input type="color" className="cp-native" value={hex.startsWith("#")&&hex.length===7?hex:"#000000"} onChange={e=>{setHex(e.target.value);onChange(e.target.value);}}/>
            <input type="text" className="cp-hex-input" value={hex} maxLength={7} placeholder="#000000" onChange={e=>setHex(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();}}/>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── API ────────────────────────────── */
const API_BASE  = (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/,"")) || "http://localhost:3000";
const META_URL  = `${API_BASE}/api/meta`;
const STAFF_URL = `${API_BASE}/api/staff`;
const norm = (v: unknown) => v==null?"":String(v).trim().toLowerCase();

function normaliseRPF(raw: unknown, floors: number): number[] {
  if (Array.isArray(raw)) {
    const arr = (raw as unknown[]).map(v=>{const n=parseInt(String(v),10);return isNaN(n)||n<=0?1:n;});
    while(arr.length<floors) arr.push(arr[arr.length-1]??1);
    return arr.slice(0,floors);
  }
  const flat = typeof raw==="number"&&raw>0?Math.round(raw):1;
  return Array.from({length:floors},()=>flat);
}
const getRoomsArray = (b:BuildingMeta) => normaliseRPF(b.roomsPerFloor,b.floors);
const totalRooms    = (b:BuildingMeta) => getRoomsArray(b).reduce((s,n)=>s+n,0);

function normBuildings(raw:unknown[]):BuildingMeta[]{return raw.map((b,idx)=>{if(typeof b==="string"){const name=b.trim();return{id:norm(name).replace(/\s+/g,"-")||`b-${idx}`,name:name||"Unnamed",floors:1,roomsPerFloor:[1],hasRooms:true,singleLocationLabel:""}}const o=b as any,rawName=String(o?.name||"").trim();const id=String(o?.id||"").trim()||norm(rawName).replace(/\s+/g,"-")||`b-${idx}`;const floors=typeof o?.floors==="number"&&o.floors>0?Math.round(o.floors):1;return{id,name:rawName||"Unnamed",floors,roomsPerFloor:normaliseRPF(o?.roomsPerFloor,floors),hasRooms:o?.hasRooms===false?false:true,singleLocationLabel:String(o?.singleLocationLabel||"").trim()}});}
function normConcerns(raw:unknown[]):ConcernMeta[]{return raw.map((c,idx)=>{const o=c as any,label=String(o?.label||"").trim();const id=String(o?.id||"").trim()||norm(label).replace(/\s+/g,"-")||`c-${idx}`;const subs:string[]=Array.isArray(o?.subconcerns)?o.subconcerns.map((s:unknown)=>String(s||"").trim()).filter((s:string)=>s):[];return{id,label:label||"Unnamed",subconcerns:subs}});}
function normStatuses(raw:unknown[]):StatusMeta[]{return raw.map((s,idx)=>{const o=s as any;return{id:String(o?.id||idx+1),name:String(o?.name||"").trim()||"Unnamed",color:String(o?.color||"#6C757D").trim()}});}
function normPriorities(raw:unknown[]):PriorityMeta[]{const v=["daily","1week","1month","3months"];return raw.map((p,idx)=>{const o=p as any;const ni=String(o?.notifyInterval??"").trim();return{id:String(o?.id||idx+1).trim(),name:String(o?.name||"").trim()||"Unnamed",color:String(o?.color||"#6C757D").trim(),notifyInterval:v.includes(ni)?ni:"1month"}});}
function normNotifRules(raw:unknown[]):NotifRule[]{return raw.map((r:any)=>({name:String(r?.name||"").trim()||"Unnamed",color:String(r?.color||"#6C757D").trim(),maxDuration:String(r?.maxDuration||"").trim(),schedule:Array.isArray(r?.schedule)?r.schedule.map((s:any)=>({phase:String(s?.phase||""),interval:String(s?.interval||"")})):[],unfinishedNote:String(r?.unfinishedNote||"").trim()}));}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function AdminEditPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { addNotification } = useNotifications();

  /* ── Active tab + sidebar expand ── */
  const [activeTab,    setActiveTab]    = useState<TabId>("buildings");
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  /* ── Meta state ── */
  const [buildings,  setBuildings]  = useState<BuildingMeta[]>(DEFAULT_BUILDINGS);
  const [concerns,   setConcerns]   = useState<ConcernMeta[]>(DEFAULT_CONCERNS);
  const [statuses,   setStatuses]   = useState<StatusMeta[]>(DEFAULT_STATUSES);
  const [priorities, setPriorities] = useState<PriorityMeta[]>(DEFAULT_PRIORITIES);
  const [notifRules, setNotifRules] = useState<NotifRule[]>(DEFAULT_NOTIF_RULES);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [saveMsg,    setSaveMsg]    = useState("");

  const [colleges,         setColleges]         = useState<string[]>(DEFAULT_COLLEGES);
  const [yearLevels,       setYearLevels]       = useState<string[]>(DEFAULT_YEAR_LEVELS);
  const [newCollege,       setNewCollege]       = useState("");
  const [newYearLevel,     setNewYearLevel]     = useState("");
  const [editCollegeIdx,   setEditCollegeIdx]   = useState<number|null>(null);
  const [editYearLevelIdx, setEditYearLevelIdx] = useState<number|null>(null);

  const [positionOptions,   setPositionOptions]   = useState<string[]>(DEFAULT_POSITION_OPTIONS);
  const [disciplineOptions, setDisciplineOptions] = useState<string[]>(DEFAULT_DISCIPLINE_OPTIONS);
  const [newPosition,       setNewPosition]       = useState("");
  const [newDiscipline,     setNewDiscipline]     = useState("");
  const [editPositionIdx,   setEditPositionIdx]   = useState<number|null>(null);
  const [editDisciplineIdx, setEditDisciplineIdx] = useState<number|null>(null);

  const [selBuildingId, setSelBuildingId] = useState("");
  const [selConcernId,  setSelConcernId]  = useState("");
  const [selStatusId,   setSelStatusId]   = useState("");
  const [editPriId,     setEditPriId]     = useState<string|null>(null);
  const [editPriDraft,  setEditPriDraft]  = useState<PriorityMeta|null>(null);
  const [showAddPri,    setShowAddPri]    = useState(false);
  const [newPriDraft,   setNewPriDraft]   = useState<PriorityMeta>({id:"",name:"",color:"#6C757D",notifyInterval:"1month"});

  const [staffList,      setStaffList]      = useState<StaffMember[]>([]);
  const [staffLoading,   setStaffLoading]   = useState(false);
  const [staffError,     setStaffError]     = useState("");
  const [staffSaving,    setStaffSaving]    = useState(false);
  const [staffTab,       setStaffTab]       = useState<"list"|"disciplines"|"positions">("list");
  const [discFilter,     setDiscFilter]     = useState("All");

  /* ── Editable permission map: position name → string[] ── */
  const DEFAULT_PERMISSIONS: Record<string, string[]> = {
    "Head Engineer":  ["Create tasks","Edit tasks","Assign staff","Update status","Comment"],
    "Staff Engineer": ["Update status","Comment"],
    "Supervisor":     ["View only", "Assign staff"],
    "Technician":     ["View only"],
    "Other":          ["View only"],
  };
  const [positionPerms,    setPositionPerms]    = useState<Record<string,string[]>>(DEFAULT_PERMISSIONS);
  const [editingPermPos,   setEditingPermPos]   = useState<string|null>(null);
  const [newPermInput,     setNewPermInput]     = useState<Record<string,string>>({});
  const [showAddStaff,   setShowAddStaff]   = useState(false);
  const [newStaff,       setNewStaff]       = useState<Omit<StaffMember,"_id">>(() => DEFAULT_EMPTY_STAFF(DEFAULT_POSITION_OPTIONS));
  const [editStaffId,    setEditStaffId]    = useState<string|null>(null);
  const [editStaffDraft, setEditStaffDraft] = useState<StaffMember|null>(null);
  const [clerkCreating,  setClerkCreating]  = useState(false);
  const [clerkResult,    setClerkResult]    = useState<{success:boolean;message:string}|null>(null);
  const [newClerkPw,     setNewClerkPw]     = useState("");
  const [showClerkForm,  setShowClerkForm]  = useState<string|null>(null);

  /* ── Auth ── */
  const role = useMemo(() => {
    if (!isLoaded||!isSignedIn||!user) return "guest";
    const raw=(user.publicMetadata as any)?.role;
    let r="student";
    if(Array.isArray(raw)&&raw.length>0) r=String(raw[0]).toLowerCase();
    else if(typeof raw==="string") r=raw.toLowerCase();
    return r;
  },[isLoaded,isSignedIn,user]);

  useEffect(()=>{
    if(!isLoaded) return;
    if(!isSignedIn||!user){router.replace("/");return;}
    if(role!=="admin") router.replace("/");
  },[isLoaded,isSignedIn,user,role,router]);

  /* ── Load meta ── */
  const loadMeta = useCallback(async (mode:"preferDefaults"|"dbOnly"="preferDefaults") => {
    try {
      setLoading(true);setError("");setSaveMsg("");
      const res=await fetch(`${META_URL}?ts=${Date.now()}`,{cache:"no-store"});
      if(!res.ok) throw new Error("Failed to load.");
      const data=await res.json().catch(()=>null);
      if(!data) throw new Error("Empty response.");
      const rawB=Array.isArray(data.buildings)?data.buildings:[];
      const rawC=Array.isArray(data.concerns)?data.concerns:[];
      const rawS=Array.isArray(data.statuses)?data.statuses:[];
      const rawP=Array.isArray(data.priorities)?data.priorities:[];
      const iB=(mode==="preferDefaults"&&rawB.length===0)?DEFAULT_BUILDINGS:normBuildings(rawB);
      const iC=(mode==="preferDefaults"&&rawC.length===0)?DEFAULT_CONCERNS:normConcerns(rawC);
      const iS=(mode==="preferDefaults"&&rawS.length===0)?DEFAULT_STATUSES:normStatuses(rawS);
      const iP=(mode==="preferDefaults"&&rawP.length===0)?DEFAULT_PRIORITIES:normPriorities(rawP);
      setBuildings(iB);setConcerns(iC);setStatuses(iS);setPriorities(iP);
      if(iB.length>0&&!selBuildingId) setSelBuildingId(iB[0].id);
      if(iC.length>0&&!selConcernId)  setSelConcernId(iC[0].id);
      if(iS.length>0&&!selStatusId)   setSelStatusId(iS[0].id);
      if(Array.isArray(data.colleges)         &&data.colleges.length)         setColleges(data.colleges);
      if(Array.isArray(data.yearLevels)        &&data.yearLevels.length)       setYearLevels(data.yearLevels);
      if(Array.isArray(data.notifRules)        &&data.notifRules.length)       setNotifRules(normNotifRules(data.notifRules));
      if(Array.isArray(data.positionOptions)   &&data.positionOptions.length)  setPositionOptions(data.positionOptions);
      if(Array.isArray(data.disciplineOptions) &&data.disciplineOptions.length) setDisciplineOptions(data.disciplineOptions);
      if(data.positionPerms && typeof data.positionPerms==="object") setPositionPerms(data.positionPerms);
    } catch(err:any){
      setError(err?.message||"Could not load.");
      if(mode==="preferDefaults"){
        setBuildings(DEFAULT_BUILDINGS);setConcerns(DEFAULT_CONCERNS);
        setStatuses(DEFAULT_STATUSES);setPriorities(DEFAULT_PRIORITIES);
        setColleges(DEFAULT_COLLEGES);setYearLevels(DEFAULT_YEAR_LEVELS);
        setNotifRules(DEFAULT_NOTIF_RULES);
        setPositionOptions(DEFAULT_POSITION_OPTIONS);
        setDisciplineOptions(DEFAULT_DISCIPLINE_OPTIONS);
      }
    } finally {setLoading(false);}
  },[selBuildingId,selConcernId,selStatusId]);

  const loadStaff = useCallback(async()=>{
    try{
      setStaffLoading(true);setStaffError("");
      const res=await fetch(`${STAFF_URL}?all=true&ts=${Date.now()}`,{cache:"no-store"});
      const data=await res.json().catch(()=>null);
      if(!res.ok||!data){setStaffError(data?.message||"Failed.");return;}
      setStaffList(Array.isArray(data.staff)?data.staff:Array.isArray(data)?data:[]);
    }catch{setStaffError("Network error.");}
    finally{setStaffLoading(false);}
  },[]);

  useEffect(()=>{loadMeta("preferDefaults");loadStaff();},[]);

  /* ── Save ── */
  const handleSave = async()=>{
    setSaving(true);setError("");setSaveMsg("");
    let cleanB=buildings.map((b,idx)=>{const name=String(b.name||"").trim();if(!name)return null;const id=String(b.id||"").trim()||norm(name).replace(/\s+/g,"-")||`b-${idx}`;const floors=typeof b.floors==="number"&&b.floors>0?Math.round(b.floors):1;return{id,name,floors,roomsPerFloor:normaliseRPF(b.roomsPerFloor,floors),hasRooms:b.hasRooms!==false,singleLocationLabel:String(b.singleLocationLabel||"").trim()};}).filter(Boolean) as BuildingMeta[];
    if(!cleanB.some(b=>norm(b.name)==="other")) cleanB.push({id:"other",name:"Other",floors:1,roomsPerFloor:[1],hasRooms:false,singleLocationLabel:""});
    cleanB=[...cleanB.filter(b=>norm(b.name)!=="other"),...cleanB.filter(b=>norm(b.name)==="other")];
    let cleanC=concerns.map((c,idx)=>{const label=String(c.label||"").trim();if(!label)return null;const id=String(c.id||"").trim()||norm(label).replace(/\s+/g,"-")||`c-${idx}`;let subs=(Array.isArray(c.subconcerns)?c.subconcerns:[]).map(s=>String(s||"").trim()).filter(s=>s);subs=[...subs.filter(s=>norm(s)!=="other"),"Other"];return{id,label,subconcerns:subs};}).filter(Boolean) as ConcernMeta[];
    if(!cleanC.some(c=>norm(c.label)==="other")) cleanC.push({id:"other",label:"Other",subconcerns:["Other"]});
    cleanC=[...cleanC.filter(c=>norm(c.label)!=="other"),...cleanC.filter(c=>norm(c.label)==="other")];
    const cleanS=statuses.map((s,idx)=>{const name=String(s.name||"").trim();if(!name)return null;return{id:String(s.id||idx+1).trim(),name,color:String(s.color||"#6C757D").trim()};}).filter(Boolean) as StatusMeta[];
    const cleanP=priorities.map((p,idx)=>{const name=String(p.name||"").trim();if(!name)return null;return{id:String(p.id||idx+1).trim(),name,color:String(p.color||"#6C757D").trim(),notifyInterval:String(p.notifyInterval||"1month")};}).filter(Boolean) as PriorityMeta[];
    try{
      const res=await fetch(META_URL,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({buildings:cleanB,concerns:cleanC,statuses:cleanS,priorities:cleanP,colleges:colleges.map(c=>String(c).trim()).filter(Boolean),yearLevels:yearLevels.map(y=>String(y).trim()).filter(Boolean),notifRules,positionOptions:positionOptions.map(p=>String(p).trim()).filter(Boolean),disciplineOptions:disciplineOptions.map(d=>String(d).trim()).filter(Boolean),positionPerms})});
      if(!res.ok) throw new Error((await res.text().catch(()=>""))||"Failed to save.");
      const data=await res.json().catch(()=>null);
      if(data?.buildings)         setBuildings(normBuildings(data.buildings));
      if(data?.concerns)          setConcerns(normConcerns(data.concerns));
      if(data?.statuses)          setStatuses(normStatuses(data.statuses));
      if(data?.priorities)        setPriorities(normPriorities(data.priorities));
      if(Array.isArray(data?.colleges)&&data.colleges.length)          setColleges(data.colleges);
      if(Array.isArray(data?.yearLevels)&&data.yearLevels.length)      setYearLevels(data.yearLevels);
      if(Array.isArray(data?.notifRules)&&data.notifRules.length)      setNotifRules(normNotifRules(data.notifRules));
      if(Array.isArray(data?.positionOptions)&&data.positionOptions.length)   setPositionOptions(data.positionOptions);
      if(Array.isArray(data?.disciplineOptions)&&data.disciplineOptions.length) setDisciplineOptions(data.disciplineOptions);
      if(data?.positionPerms && typeof data.positionPerms==="object")   setPositionPerms(data.positionPerms);
      setSaveMsg("All changes saved successfully.");
    }catch(err:any){setError(err?.message||"Failed to save.");}
    finally{setSaving(false);}
  };

  const selBuilding = useMemo(()=>buildings.find(b=>b.id===selBuildingId),[buildings,selBuildingId]);
  const selConcern  = useMemo(()=>concerns.find(c=>c.id===selConcernId),[concerns,selConcernId]);
  const selStatus   = useMemo(()=>statuses.find(s=>s.id===selStatusId),[statuses,selStatusId]);

  /* ── Building handlers ── */
  const setBName       = (v:string) => setBuildings(p=>p.map(b=>b.id===selBuildingId?{...b,name:v}:b));
  const toggleHasRooms = ()         => setBuildings(p=>p.map(b=>b.id===selBuildingId?{...b,hasRooms:b.hasRooms===false}:b));
  const setFloors      = (v:string) => {const fl=Math.min(Math.max(parseInt(v,10)||1,1),20);setBuildings(p=>p.map(b=>b.id!==selBuildingId?b:{...b,floors:fl,roomsPerFloor:normaliseRPF(normaliseRPF(b.roomsPerFloor,b.floors),fl)}));};
  const setFloorRooms  = (idx:number,v:string) => {const rooms=Math.max(parseInt(v,10)||1,1);setBuildings(p=>p.map(b=>{if(b.id!==selBuildingId)return b;const arr=normaliseRPF(b.roomsPerFloor,b.floors);arr[idx]=rooms;return{...b,roomsPerFloor:[...arr]};}));};
  const addBuilding    = () => {const nb:BuildingMeta={id:`b-${Date.now()}`,name:"New Building",floors:1,roomsPerFloor:[1],hasRooms:true,singleLocationLabel:""};setBuildings(p=>[...p,nb]);setSelBuildingId(nb.id);addNotification(`Building "${nb.name}" added.`,"building");};
  const deleteBuilding = () => {if(!selBuilding)return;addNotification(`Building "${selBuilding.name}" deleted.`,"building");const rem=buildings.filter(b=>b.id!==selBuildingId);setBuildings(rem);setSelBuildingId(rem[0]?.id||"");};

  /* ── Concern handlers ── */
  const setCLabel    = (v:string) => setConcerns(p=>p.map(c=>c.id===selConcernId?{...c,label:v}:c));
  const addConcern   = () => {const nc:ConcernMeta={id:`c-${Date.now()}`,label:"New Concern",subconcerns:[]};setConcerns(p=>[...p,nc]);setSelConcernId(nc.id);addNotification(`Concern "${nc.label}" added.`,"concern");};
  const deleteConcern= () => {if(!selConcern)return;addNotification(`Concern "${selConcern.label}" deleted.`,"concern");const rem=concerns.filter(c=>c.id!==selConcernId);setConcerns(rem);setSelConcernId(rem[0]?.id||"");};
  const setSub=(i:number,v:string)=>setConcerns(p=>p.map(c=>{if(c.id!==selConcernId)return c;const s=[...(c.subconcerns||[])];s[i]=v;return{...c,subconcerns:s};}));
  const addSub=()=>setConcerns(p=>p.map(c=>c.id===selConcernId?{...c,subconcerns:[...(c.subconcerns||[]),""]}: c));
  const delSub=(i:number)=>setConcerns(p=>p.map(c=>{if(c.id!==selConcernId)return c;const s=[...(c.subconcerns||[])];s.splice(i,1);return{...c,subconcerns:s};}));

  /* ── Status handlers ── */
  const setSName  = (v:string) => setStatuses(p=>p.map(s=>s.id===selStatusId?{...s,name:v}:s));
  const setSColor = (v:string) => setStatuses(p=>p.map(s=>s.id===selStatusId?{...s,color:v}:s));
  const addStatus = () => {const ns:StatusMeta={id:`s-${Date.now()}`,name:"New Status",color:"#6C757D"};setStatuses(p=>[...p,ns]);setSelStatusId(ns.id);addNotification(`Status "${ns.name}" added.`,"status");};
  const deleteStatus=()=>{if(!selStatus)return;addNotification(`Status "${selStatus.name}" deleted.`,"status");const rem=statuses.filter(s=>s.id!==selStatusId);setStatuses(rem);setSelStatusId(rem[0]?.id||"");};

  /* ── Priority handlers ── */
  const startEditPri=(p:PriorityMeta)=>{setEditPriId(p.id);setEditPriDraft({id:p.id,name:p.name,color:p.color,notifyInterval:p.notifyInterval||"1month"});setShowAddPri(false);};
  const cancelEditPri=()=>{setEditPriId(null);setEditPriDraft(null);};
  const saveEditPri=()=>{if(!editPriDraft)return;const prev=priorities.find(p=>p.id===editPriDraft.id);setPriorities(p=>p.map(x=>x.id===editPriDraft.id?{...editPriDraft}:x));if(prev?.name!==editPriDraft.name) addNotification(`Priority renamed to "${editPriDraft.name}".`,"priority");if(prev?.notifyInterval!==editPriDraft.notifyInterval) addNotification(`Priority "${editPriDraft.name}" interval updated.`,"priority");cancelEditPri();};
  const deletePriority=(p:PriorityMeta)=>{addNotification(`Priority "${p.name}" deleted.`,"priority");setPriorities(r=>r.filter(x=>x.id!==p.id));if(editPriId===p.id)cancelEditPri();};
  const addPriority=()=>{const np:PriorityMeta={id:`p-${Date.now()}`,name:newPriDraft.name.trim()||"New Priority",color:newPriDraft.color,notifyInterval:newPriDraft.notifyInterval||"1month"};setPriorities(p=>[...p,np]);addNotification(`Priority "${np.name}" added.`,"priority");setShowAddPri(false);setNewPriDraft({id:"",name:"",color:"#6C757D",notifyInterval:"1month"});};

  /* ── Notif rule helpers ── */
  const updateRule=(rIdx:number,patch:Partial<NotifRule>)=>setNotifRules(p=>p.map((r,i)=>i===rIdx?{...r,...patch}:r));
  const updateRuleStep=(rIdx:number,sIdx:number,patch:Partial<{phase:string;interval:string}>)=>setNotifRules(p=>p.map((r,i)=>{if(i!==rIdx)return r;const schedule=r.schedule.map((s,j)=>j===sIdx?{...s,...patch}:s);return{...r,schedule};}));
  const addRuleStep=(rIdx:number)=>setNotifRules(p=>p.map((r,i)=>i!==rIdx?r:{...r,schedule:[...r.schedule,{phase:"",interval:""}]}));
  const removeRuleStep=(rIdx:number,sIdx:number)=>setNotifRules(p=>p.map((r,i)=>i!==rIdx?r:{...r,schedule:r.schedule.filter((_,j)=>j!==sIdx)}));
  const addRule=()=>setNotifRules(p=>[...p,{name:"New Priority",color:"#6C757D",maxDuration:"1 Week",schedule:[{phase:"",interval:""}],unfinishedNote:"Staff notified every 3 days."}]);
  const removeRule=(rIdx:number)=>setNotifRules(p=>p.filter((_,i)=>i!==rIdx));

  /* ── Staff helpers ── */
  const toggleDisc=(disc:string,current:string[],setter:(fn:(d:any)=>any)=>void)=>{const next=current.includes(disc)?current.filter(d=>d!==disc):[...current,disc];setter((d:any)=>({...d,disciplines:next}));};
  const addStaff=async()=>{if(!newStaff.name.trim())return;try{setStaffSaving(true);setStaffError("");const res=await fetch(STAFF_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(newStaff)});const data=await res.json().catch(()=>null);if(!res.ok||!data?.success)throw new Error(data?.message||"Failed.");setStaffList(p=>[...p,data.staff]);setNewStaff(DEFAULT_EMPTY_STAFF(positionOptions));setShowAddStaff(false);addNotification(`Staff "${newStaff.name}" added.`,"staff");}catch(err:any){setStaffError(err.message||"Failed.");}finally{setStaffSaving(false);}};
  const saveStaff=async()=>{if(!editStaffDraft?._id)return;try{setStaffSaving(true);setStaffError("");const res=await fetch(`${STAFF_URL}/${editStaffDraft._id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(editStaffDraft)});const data=await res.json().catch(()=>null);if(!res.ok||!data?.success)throw new Error(data?.message||"Failed.");setStaffList(p=>p.map(s=>s._id===data.staff._id?data.staff:s));setEditStaffId(null);setEditStaffDraft(null);addNotification(`Staff "${editStaffDraft.name}" updated.`,"staff");}catch(err:any){setStaffError(err.message||"Failed.");}finally{setStaffSaving(false);}};
  const deleteStaff=async(m:StaffMember)=>{if(!m._id)return;try{setStaffSaving(true);const res=await fetch(`${STAFF_URL}/${m._id}`,{method:"DELETE"});if(!res.ok)throw new Error();setStaffList(p=>p.filter(s=>s._id!==m._id));if(editStaffId===m._id){setEditStaffId(null);setEditStaffDraft(null);}addNotification(`Staff "${m.name}" removed.`,"staff");}catch{setStaffError("Failed to delete.");}finally{setStaffSaving(false);}};
  const createClerkAccount=async(member:StaffMember)=>{if(!member.clerkUsername?.trim()||!newClerkPw.trim()){setClerkResult({success:false,message:"Username and password are required."});return;}try{setClerkCreating(true);setClerkResult(null);const res=await fetch(`${API_BASE}/api/staff/create-clerk`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({staffId:member._id,username:member.clerkUsername.trim(),password:newClerkPw.trim(),name:member.name})});const data=await res.json().catch(()=>null);if(!res.ok||!data?.success)throw new Error(data?.message||"Failed.");setClerkResult({success:true,message:`Account "${member.clerkUsername}" created!`});setNewClerkPw("");setShowClerkForm(null);loadStaff();}catch(err:any){setClerkResult({success:false,message:err.message||"Failed."});}finally{setClerkCreating(false);}};

  const filteredStaff = staffList.filter(s=>discFilter==="All"||s.disciplines.includes(discFilter));

  /* ── Badge counts for nav ── */
  const badgeCounts = { buildings:buildings.length, concerns:concerns.length, statuses:statuses.length, priorities:priorities.length, notifRules:notifRules.length, colleges:colleges.length, yearLevels:yearLevels.length, staffList:staffList.length };

  if(!isLoaded||!isSignedIn) return <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Checking permissions…</div>;
  if(role!=="admin")         return <div style={{padding:40,textAlign:"center",color:"#ef4444"}}>Access denied.</div>;

  /* ─── sidebar label for active tab ─── */
  const activeTabMeta = NAV_TABS.find(t=>t.id===activeTab);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:"flex", height:"calc(100vh - 64px)", overflow:"hidden", fontFamily:"system-ui,-apple-system,sans-serif", background:"var(--tasks-bg,#f4f6f9)" }}>

      {/* ══ SIDEBAR ══ */}
      <aside style={{
        width: sidebarOpen ? 220 : 56,
        minWidth: sidebarOpen ? 220 : 56,
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.22s cubic-bezier(.4,0,.2,1), min-width 0.22s cubic-bezier(.4,0,.2,1)",
        overflow: "hidden",
        zIndex: 10,
        boxShadow: "2px 0 12px rgba(0,0,0,0.15)",
      }}>

        {/* Nav items */}
        <nav style={{ flex:1, overflowY:"auto", overflowX:"hidden", paddingTop:8 }}>
          {NAV_TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const count = tab.badge?.(badgeCounts) ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); }}
                title={!sidebarOpen ? tab.label : undefined}
                style={{
                  display:"flex", alignItems:"center", gap:12,
                  width:"100%", padding:"10px 14px",
                  background: isActive ? "rgba(37,99,235,0.18)" : "none",
                  border:"none",
                  borderLeft: isActive ? "3px solid #3b82f6" : "3px solid transparent",
                  cursor:"pointer",
                  color: isActive ? "#60a5fa" : "#94a3b8",
                  transition:"all 0.14s",
                  textAlign:"left",
                }}
              >
                <span style={{ flexShrink:0, opacity: isActive ? 1 : 0.7 }}>{tab.icon}</span>
                {sidebarOpen && (
                  <span style={{ flex:1, fontSize:"0.8rem", fontWeight: isActive ? 700 : 500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {tab.label}
                  </span>
                )}
                {sidebarOpen && count > 0 && (
                  <span style={{
                    fontSize:"0.62rem", fontWeight:700,
                    background: isActive ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.08)",
                    color: isActive ? "#93c5fd" : "#64748b",
                    padding:"1px 6px", borderRadius:999, flexShrink:0,
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: save button */}
        <div style={{ padding:"12px 10px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving||loading}
            title={!sidebarOpen ? "Save All Changes" : undefined}
            style={{
              display:"flex", alignItems:"center", justifyContent: sidebarOpen ? "flex-start" : "center",
              gap:8, width:"100%", padding:"9px 12px",
              background:"#2563eb", border:"none", borderRadius:8,
              color:"#fff", cursor:saving||loading?"not-allowed":"pointer",
              opacity:saving||loading?0.7:1,
              fontSize:"0.78rem", fontWeight:700,
              transition:"background 0.14s",
              whiteSpace:"nowrap",
            }}
          >
            <IconSave/>
            {sidebarOpen && <span>{saving?"Saving…":"Save All Changes"}</span>}
          </button>
        </div>
      </aside>

      {/* ══ MAIN CONTENT ══ */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Top bar */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 24px", height:56,
          background:"var(--tasks-surface,#fff)",
          borderBottom:"1px solid var(--tasks-border,#e8ecf0)",
          flexShrink:0,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ color:"var(--tasks-text-3,#8a97a8)", fontSize:"0.78rem" }}>System Configuration</span>
            <span style={{ color:"var(--tasks-text-4,#b8c4ce)" }}>›</span>
            <span style={{ color:"var(--tasks-text-1,#0d1b2a)", fontSize:"0.82rem", fontWeight:700 }}>
              {activeTabMeta?.label}
            </span>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {(error||saveMsg) && (
              <span style={{
                fontSize:"0.75rem", fontWeight:600, padding:"4px 12px", borderRadius:6,
                background: error ? "#fef2f2" : "#f0fdf4",
                color: error ? "#dc2626" : "#16a34a",
                border:`1px solid ${error?"#fecaca":"#bbf7d0"}`,
              }}>
                {error || saveMsg}
              </span>
            )}
            <button type="button" className="btn btn-secondary" style={{ fontSize:"0.75rem", padding:"5px 12px" }}
              disabled={saving||loading} onClick={()=>loadMeta("dbOnly")}>
              Reload DB
            </button>
            <button type="button" className="btn btn-secondary" style={{ fontSize:"0.75rem", padding:"5px 12px" }}
              disabled={saving||loading}
              onClick={()=>{setBuildings(DEFAULT_BUILDINGS);setConcerns(DEFAULT_CONCERNS);setStatuses(DEFAULT_STATUSES);setPriorities(DEFAULT_PRIORITIES);setColleges(DEFAULT_COLLEGES);setYearLevels(DEFAULT_YEAR_LEVELS);setNotifRules(DEFAULT_NOTIF_RULES);setPositionOptions(DEFAULT_POSITION_OPTIONS);setDisciplineOptions(DEFAULT_DISCIPLINE_OPTIONS);setSaveMsg("");setError("");setSelBuildingId(DEFAULT_BUILDINGS[0].id);setSelConcernId(DEFAULT_CONCERNS[0].id);setSelStatusId(DEFAULT_STATUSES[0].id);cancelEditPri();setShowAddPri(false);}}>
              Defaults
            </button>
            <button type="button" className="btn btn-primary" style={{ fontSize:"0.75rem", padding:"5px 14px", display:"flex", alignItems:"center", gap:6 }}
              disabled={saving||loading} onClick={handleSave}>
              <IconSave/>{saving?"Saving…":"Save Changes"}
            </button>
          </div>
        </div>

        {/* Scrollable panel area */}
        <div style={{ flex:1, overflowY:"auto", padding:"28px 32px" }}>
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[...Array(4)].map((_,i)=><div key={i} style={{height:48,borderRadius:8,background:"linear-gradient(90deg,#e8ecf0 25%,#f8fafc 50%,#e8ecf0 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}}/>)}
              <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
            </div>
          ) : (
            <>
              {/* ══ BUILDINGS ══ */}
              {activeTab==="buildings" && (
                <div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
                    <div>
                      <h2 style={{ margin:"0 0 4px", fontSize:"1.2rem", fontWeight:800, color:"var(--tasks-text-1,#0d1b2a)" }}>Buildings</h2>
                      <p style={{ margin:0, fontSize:"0.78rem", color:"var(--tasks-text-3,#8a97a8)" }}>Add, edit, or remove campus buildings</p>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={addBuilding}>+ Add Building</button>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:20, alignItems:"start" }}>
                    {/* Building list */}
                    <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, overflow:"hidden" }}>
                      {buildings.map(b=>(
                        <button key={b.id} type="button" onClick={()=>setSelBuildingId(b.id)}
                          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"10px 14px", border:"none", borderLeft:`3px solid ${b.id===selBuildingId?"#2563eb":"transparent"}`, background:b.id===selBuildingId?"rgba(37,99,235,0.05)":"none", cursor:"pointer", textAlign:"left", fontSize:"0.82rem", fontWeight:b.id===selBuildingId?700:400, color:b.id===selBuildingId?"#1d4ed8":"var(--tasks-text-1,#0d1b2a)", borderBottom:"1px solid var(--tasks-border,#e8ecf0)" }}>
                          <span>{b.name}</span>
                          {b.id===selBuildingId && <IconChevronRight/>}
                        </button>
                      ))}
                    </div>
                    {/* Editor */}
                    {selBuilding ? (
                      <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, padding:24 }}>
                        <div className="admin-edit__field-group">
                          <label className="admin-edit__label">Building Name</label>
                          <input type="text" className="admin-edit__input" value={selBuilding.name} placeholder="e.g. CBAA" onChange={e=>setBName(e.target.value)} onBlur={e=>{const prev=buildings.find(b=>b.id===selBuildingId)?.name||"";if(prev!==e.target.value)addNotification(`Building renamed to "${e.target.value}".`,"building");}}/>
                        </div>
                        <div className="admin-edit__field-group">
                          <label className="admin-edit__switch">
                            <input type="checkbox" checked={selBuilding.hasRooms!==false} onChange={toggleHasRooms}/>
                            <span className="admin-edit__switch-pill"><span className="admin-edit__switch-knob"/></span>
                            <span className="admin-edit__switch-text">{selBuilding.hasRooms!==false?"Has floors and rooms":"Specific spot only"}</span>
                          </label>
                        </div>
                        {selBuilding.hasRooms!==false&&(<>
                          <div className="admin-edit__field-group">
                            <label className="admin-edit__label">Number of Floors</label>
                            <input type="number" min={1} max={20} className="admin-edit__input admin-edit__input-small" value={selBuilding.floors} onChange={e=>setFloors(e.target.value)}/>
                          </div>
                          <div className="admin-edit__field-group">
                            <label className="admin-edit__label">Rooms per Floor</label>
                            <div className="admin-edit__floors-grid">
                              {getRoomsArray(selBuilding).map((count,idx)=>(
                                <div key={idx} className="admin-edit__floor-row">
                                  <span className="admin-edit__floor-label">{FLOOR_ORDINALS[idx]??`Floor ${idx+1}`}</span>
                                  <input type="number" min={1} className="admin-edit__input admin-edit__input-floor" value={count} onChange={e=>setFloorRooms(idx,e.target.value)}/>
                                  <span className="admin-edit__floor-unit">rooms</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="admin-edit__info-box"><strong>Total:</strong> {totalRooms(selBuilding)} rooms</div>
                        </>)}
                        <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid var(--tasks-border,#e8ecf0)" }}>
                          <button type="button" className="btn btn-danger" onClick={deleteBuilding}>Delete Building</button>
                        </div>
                      </div>
                    ) : <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, padding:40, textAlign:"center", color:"var(--tasks-text-4,#b8c4ce)" }}>Select a building to edit</div>}
                  </div>
                </div>
              )}

              {/* ══ CONCERNS ══ */}
              {activeTab==="concerns" && (
                <div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
                    <div>
                      <h2 style={{ margin:"0 0 4px", fontSize:"1.2rem", fontWeight:800, color:"var(--tasks-text-1,#0d1b2a)" }}>Concerns</h2>
                      <p style={{ margin:0, fontSize:"0.78rem", color:"var(--tasks-text-3,#8a97a8)" }}>Manage concern categories and subconcerns</p>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={addConcern}>+ Add Concern</button>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:20, alignItems:"start" }}>
                    <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, overflow:"hidden" }}>
                      {concerns.map(c=>(
                        <button key={c.id} type="button" onClick={()=>setSelConcernId(c.id)}
                          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"10px 14px", border:"none", borderLeft:`3px solid ${c.id===selConcernId?"#2563eb":"transparent"}`, background:c.id===selConcernId?"rgba(37,99,235,0.05)":"none", cursor:"pointer", textAlign:"left", fontSize:"0.82rem", fontWeight:c.id===selConcernId?700:400, color:c.id===selConcernId?"#1d4ed8":"var(--tasks-text-1,#0d1b2a)", borderBottom:"1px solid var(--tasks-border,#e8ecf0)" }}>
                          <span>{c.label}</span>
                          <span style={{ fontSize:"0.65rem", background:"#f1f5f9", color:"#64748b", padding:"1px 6px", borderRadius:999 }}>{c.subconcerns.length}</span>
                        </button>
                      ))}
                    </div>
                    {selConcern ? (
                      <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, padding:24 }}>
                        <div className="admin-edit__field-group">
                          <label className="admin-edit__label">Concern Name</label>
                          <input type="text" className="admin-edit__input" value={selConcern.label} onChange={e=>setCLabel(e.target.value)} onBlur={e=>{const prev=concerns.find(c=>c.id===selConcernId)?.label||"";if(prev!==e.target.value)addNotification(`Concern renamed to "${e.target.value}".`,"concern");}}/>
                        </div>
                        <div className="admin-edit__subconcerns-section">
                          <div className="admin-edit__subconcerns-head">
                            <h4>Subconcerns</h4>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={addSub}>+ Add</button>
                          </div>
                          {(selConcern.subconcerns||[]).map((sub,idx)=>(
                            <div key={idx} className="admin-edit__subconcern-row">
                              <input type="text" className="admin-edit__input" value={sub} onChange={e=>setSub(idx,e.target.value)}/>
                              <button type="button" className="btn btn-ghost" onClick={()=>delSub(idx)}>Delete</button>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid var(--tasks-border,#e8ecf0)" }}>
                          <button type="button" className="btn btn-danger" onClick={deleteConcern}>Delete Concern</button>
                        </div>
                      </div>
                    ) : <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, padding:40, textAlign:"center", color:"var(--tasks-text-4,#b8c4ce)" }}>Select a concern to edit</div>}
                  </div>
                </div>
              )}

              {/* ══ STATUSES ══ */}
              {activeTab==="statuses" && (
                <div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
                    <div>
                      <h2 style={{ margin:"0 0 4px", fontSize:"1.2rem", fontWeight:800, color:"var(--tasks-text-1,#0d1b2a)" }}>Statuses</h2>
                      <p style={{ margin:0, fontSize:"0.78rem", color:"var(--tasks-text-3,#8a97a8)" }}>Configure report status labels and display colors</p>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={addStatus}>+ Add Status</button>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:20, alignItems:"start" }}>
                    <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, overflow:"hidden" }}>
                      {statuses.map(s=>(
                        <button key={s.id} type="button" onClick={()=>setSelStatusId(s.id)}
                          style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"10px 14px", border:"none", borderLeft:`3px solid ${s.id===selStatusId?s.color:"transparent"}`, background:s.id===selStatusId?s.color+"12":"none", cursor:"pointer", textAlign:"left", fontSize:"0.82rem", fontWeight:s.id===selStatusId?700:400, borderBottom:"1px solid var(--tasks-border,#e8ecf0)" }}>
                          <span style={{ width:10, height:10, borderRadius:"50%", backgroundColor:s.color, flexShrink:0 }}/>
                          <span style={{ color:"var(--tasks-text-1,#0d1b2a)" }}>{s.name}</span>
                        </button>
                      ))}
                    </div>
                    {selStatus ? (
                      <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, padding:24 }}>
                        <div className="admin-edit__field-group">
                          <label className="admin-edit__label">Status Name</label>
                          <input type="text" className="admin-edit__input" value={selStatus.name} onChange={e=>setSName(e.target.value)} onBlur={e=>{const prev=statuses.find(s=>s.id===selStatusId)?.name||"";if(prev!==e.target.value)addNotification(`Status renamed to "${e.target.value}".`,"status");}}/>
                        </div>
                        <div className="admin-edit__field-group">
                          <label className="admin-edit__label">Display Color</label>
                          <div className="admin-edit__color-row">
                            <ColorPicker value={selStatus.color} onChange={setSColor}/>
                            <span className="admin-edit__color-preview" style={{ backgroundColor:selStatus.color }}>{selStatus.name}</span>
                          </div>
                        </div>
                        <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid var(--tasks-border,#e8ecf0)" }}>
                          <button type="button" className="btn btn-danger" onClick={deleteStatus}>Delete Status</button>
                        </div>
                      </div>
                    ) : <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, padding:40, textAlign:"center", color:"var(--tasks-text-4,#b8c4ce)" }}>Select a status to edit</div>}
                  </div>
                </div>
              )}

              {/* ══ PRIORITIES ══ */}
              {activeTab==="priorities" && (
                <div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
                    <div>
                      <h2 style={{ margin:"0 0 4px", fontSize:"1.2rem", fontWeight:800, color:"var(--tasks-text-1,#0d1b2a)" }}>Priority Levels</h2>
                      <p style={{ margin:0, fontSize:"0.78rem", color:"var(--tasks-text-3,#8a97a8)" }}>Configure priority labels, colors, and notification intervals</p>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={()=>{setShowAddPri(true);setEditPriId(null);setNewPriDraft({id:"",name:"",color:"#6C757D",notifyInterval:"1month"});}}>+ Add Priority</button>
                  </div>
                  {showAddPri && (
                    <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid #bfdbfe", borderRadius:12, padding:20, marginBottom:16 }}>
                      <h4 style={{ margin:"0 0 14px", fontSize:13, fontWeight:700 }}>New Priority</h4>
                      <div className="admin-edit__priority-form-fields">
                        <div className="admin-edit__field-group"><label className="admin-edit__label">Name</label><input type="text" className="admin-edit__input" value={newPriDraft.name} placeholder="e.g. Critical" onChange={e=>setNewPriDraft(d=>({...d,name:e.target.value}))}/></div>
                        <div className="admin-edit__field-group"><label className="admin-edit__label">Color</label><div className="admin-edit__color-row"><ColorPicker value={newPriDraft.color} onChange={color=>setNewPriDraft(d=>({...d,color}))}/><span className="admin-edit__color-preview" style={{backgroundColor:newPriDraft.color}}>{newPriDraft.name||"Preview"}</span></div></div>
                        <div className="admin-edit__field-group"><label className="admin-edit__label">Notification Interval</label><div className="admin-edit__notify-timeline">{NOTIFY_INTERVAL_OPTIONS.map(opt=>(<button key={opt.value} type="button" className={`admin-edit__notify-option${newPriDraft.notifyInterval===opt.value?" admin-edit__notify-option--active":""}`} onClick={()=>setNewPriDraft(d=>({...d,notifyInterval:opt.value}))}>{opt.label}</button>))}</div></div>
                      </div>
                      <div style={{ display:"flex", gap:8, marginTop:12 }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={addPriority}>Add</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setShowAddPri(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {priorities.map(p=>(
                      <div key={p.id} style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, overflow:"hidden" }}>
                        {editPriId===p.id&&editPriDraft ? (
                          <div style={{ padding:20 }}>
                            <div className="admin-edit__priority-form-fields">
                              <div className="admin-edit__field-group"><label className="admin-edit__label">Name</label><input type="text" className="admin-edit__input" value={editPriDraft.name} onChange={e=>setEditPriDraft(d=>d?{...d,name:e.target.value}:d)}/></div>
                              <div className="admin-edit__field-group"><label className="admin-edit__label">Color</label><div className="admin-edit__color-row"><ColorPicker value={editPriDraft.color} onChange={color=>setEditPriDraft(d=>d?{...d,color}:d)}/><span className="admin-edit__color-preview" style={{backgroundColor:editPriDraft.color}}>{editPriDraft.name}</span></div></div>
                              <div className="admin-edit__field-group"><label className="admin-edit__label">Notification Interval</label><div className="admin-edit__notify-timeline">{NOTIFY_INTERVAL_OPTIONS.map(opt=>(<button key={opt.value} type="button" className={`admin-edit__notify-option${editPriDraft.notifyInterval===opt.value?" admin-edit__notify-option--active":""}`} onClick={()=>setEditPriDraft(d=>d?{...d,notifyInterval:opt.value}:d)}>{opt.label}</button>))}</div></div>
                            </div>
                            <div style={{ display:"flex", gap:8, marginTop:12 }}>
                              <button type="button" className="btn btn-primary btn-sm" onClick={saveEditPri}>Save</button>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEditPri}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", gap:12 }}>
                            <span style={{ width:14, height:14, borderRadius:"50%", backgroundColor:p.color, flexShrink:0 }}/>
                            <span style={{ flex:1, fontWeight:600, fontSize:"0.88rem", color:"var(--tasks-text-1,#0d1b2a)" }}>{p.name}</span>
                            <span style={{ fontSize:"0.72rem", color:"var(--tasks-text-3,#8a97a8)", background:"var(--tasks-surface-2,#f8fafc)", padding:"2px 10px", borderRadius:999, border:"1px solid var(--tasks-border,#e8ecf0)" }}>
                              {NOTIFY_INTERVAL_LABELS[p.notifyInterval||"1month"]}
                            </span>
                            <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--edit" onClick={()=>startEditPri(p)} title="Edit"><IconPencil/></button>
                            <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--delete" onClick={()=>deletePriority(p)} title="Delete"><IconTrash/></button>
                          </div>
                        )}
                      </div>
                    ))}
                    {priorities.length===0&&<p className="admin-edit__empty">No priorities yet.</p>}
                  </div>
                </div>
              )}

              {/* ══ NOTIFICATION RULES ══ */}
              {activeTab==="notifications" && (
                <div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
                    <div>
                      <h2 style={{ margin:"0 0 4px", fontSize:"1.2rem", fontWeight:800, color:"var(--tasks-text-1,#0d1b2a)" }}>Notification Rules</h2>
                      <p style={{ margin:0, fontSize:"0.78rem", color:"var(--tasks-text-3,#8a97a8)" }}>Configure escalation schedules per priority level</p>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={addRule}>+ Add Rule</button>
                  </div>
                  <div className="admin-edit__notif-rules-grid">
                    {notifRules.map((rule,rIdx)=>(
                      <div key={rIdx} className="admin-edit__notif-rule-card" style={{"--rule-color":rule.color} as React.CSSProperties}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                          <input type="text" className="admin-edit__input" style={{width:110,fontWeight:700}} value={rule.name} onChange={e=>updateRule(rIdx,{name:e.target.value})}/>
                          <ColorPicker value={rule.color} onChange={color=>updateRule(rIdx,{color})}/>
                          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                            <IconClock/><span style={{ fontSize:12, color:"#6b7280" }}>Max:</span>
                            <input type="text" className="admin-edit__input" style={{width:150}} value={rule.maxDuration} onChange={e=>updateRule(rIdx,{maxDuration:e.target.value})}/>
                          </div>
                        </div>
                        <label className="admin-edit__label" style={{marginBottom:6}}>Schedule Steps</label>
                        {rule.schedule.map((step,sIdx)=>(
                          <div key={sIdx} style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6 }}>
                            <input type="text" className="admin-edit__input" placeholder="Phase" value={step.phase} onChange={e=>updateRuleStep(rIdx,sIdx,{phase:e.target.value})}/>
                            <input type="text" className="admin-edit__input" placeholder="Interval" value={step.interval} onChange={e=>updateRuleStep(rIdx,sIdx,{interval:e.target.value})}/>
                            <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--delete" onClick={()=>removeRuleStep(rIdx,sIdx)}><IconTrash/></button>
                          </div>
                        ))}
                        <button type="button" className="btn btn-secondary btn-sm" style={{marginTop:4}} onClick={()=>addRuleStep(rIdx)}>+ Add Step</button>
                        <div className="admin-edit__field-group" style={{marginTop:10}}>
                          <label className="admin-edit__label">Unfinished Note</label>
                          <input type="text" className="admin-edit__input" value={rule.unfinishedNote} onChange={e=>updateRule(rIdx,{unfinishedNote:e.target.value})}/>
                        </div>
                        <div style={{ marginTop:12, textAlign:"right" }}>
                          <button type="button" className="btn btn-danger btn-sm" onClick={()=>removeRule(rIdx)}>Delete Rule</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ══ STUDENT SETTINGS ══ */}
              {activeTab==="students" && (
                <div>
                  <div style={{ marginBottom:24 }}>
                    <h2 style={{ margin:"0 0 4px", fontSize:"1.2rem", fontWeight:800, color:"var(--tasks-text-1,#0d1b2a)" }}>Student Report Settings</h2>
                    <p style={{ margin:0, fontSize:"0.78rem", color:"var(--tasks-text-3,#8a97a8)" }}>Configure options shown on the student report form</p>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
                    {/* Colleges */}
                    <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, padding:20 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                        <h4 style={{ margin:0, fontSize:13, fontWeight:700 }}>Colleges / Departments</h4>
                        <span className="admin-edit__panel-badge">{colleges.length}</span>
                      </div>
                      {colleges.map((c,idx)=>(
                        <div key={idx} className="admin-edit__subconcern-row">
                          {editCollegeIdx===idx ? (<input type="text" className="admin-edit__input" value={c} autoFocus onChange={e=>setColleges(p=>p.map((x,i)=>i===idx?e.target.value:x))} onBlur={()=>setEditCollegeIdx(null)} onKeyDown={e=>{if(e.key==="Enter")setEditCollegeIdx(null);}}/>) : (<span style={{flex:1,fontSize:13,padding:"8px 10px",borderRadius:6,background:"var(--tasks-surface-2,#f8fafc)",cursor:"pointer"}} onClick={()=>setEditCollegeIdx(idx)}>{c}</span>)}
                          <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--edit" onClick={()=>setEditCollegeIdx(idx)}><IconPencil/></button>
                          <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--delete" onClick={()=>{setColleges(p=>p.filter((_,i)=>i!==idx));addNotification(`College "${c}" removed.`,"concern");}}><IconTrash/></button>
                        </div>
                      ))}
                      <div className="admin-edit__subconcern-row" style={{marginTop:10}}>
                        <input type="text" className="admin-edit__input" value={newCollege} placeholder="e.g. CLAW" onChange={e=>setNewCollege(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newCollege.trim()){setColleges(p=>[...p,newCollege.trim()]);addNotification(`College "${newCollege.trim()}" added.`,"concern");setNewCollege("");}}}/>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={()=>{if(!newCollege.trim())return;setColleges(p=>[...p,newCollege.trim()]);addNotification(`College "${newCollege.trim()}" added.`,"concern");setNewCollege("");}}>+ Add</button>
                      </div>
                    </div>
                    {/* Year Levels */}
                    <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, padding:20 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                        <h4 style={{ margin:0, fontSize:13, fontWeight:700 }}>Year Levels</h4>
                        <span className="admin-edit__panel-badge">{yearLevels.length}</span>
                      </div>
                      {yearLevels.map((y,idx)=>(
                        <div key={idx} className="admin-edit__subconcern-row">
                          {editYearLevelIdx===idx ? (<input type="text" className="admin-edit__input" value={y} autoFocus onChange={e=>setYearLevels(p=>p.map((x,i)=>i===idx?e.target.value:x))} onBlur={()=>setEditYearLevelIdx(null)} onKeyDown={e=>{if(e.key==="Enter")setEditYearLevelIdx(null);}}/>) : (<span style={{flex:1,fontSize:13,padding:"8px 10px",borderRadius:6,background:"var(--tasks-surface-2,#f8fafc)",cursor:"pointer"}} onClick={()=>setEditYearLevelIdx(idx)}>{y}</span>)}
                          <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--edit" onClick={()=>setEditYearLevelIdx(idx)}><IconPencil/></button>
                          <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--delete" onClick={()=>{setYearLevels(p=>p.filter((_,i)=>i!==idx));addNotification(`Year level "${y}" removed.`,"concern");}}><IconTrash/></button>
                        </div>
                      ))}
                      <div className="admin-edit__subconcern-row" style={{marginTop:10}}>
                        <input type="text" className="admin-edit__input" value={newYearLevel} placeholder="e.g. 5th Year" onChange={e=>setNewYearLevel(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newYearLevel.trim()){setYearLevels(p=>[...p,newYearLevel.trim()]);addNotification(`Year level "${newYearLevel.trim()}" added.`,"concern");setNewYearLevel("");}}}/>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={()=>{if(!newYearLevel.trim())return;setYearLevels(p=>[...p,newYearLevel.trim()]);addNotification(`Year level "${newYearLevel.trim()}" added.`,"concern");setNewYearLevel("");}}>+ Add</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ STAFF ══ */}
              {activeTab==="staff" && (
                <div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                    <div>
                      <h2 style={{ margin:"0 0 4px", fontSize:"1.2rem", fontWeight:800, color:"var(--tasks-text-1,#0d1b2a)" }}>Staff Management</h2>
                      <p style={{ margin:0, fontSize:"0.78rem", color:"var(--tasks-text-3,#8a97a8)" }}>Manage engineers, technicians, positions, and disciplines</p>
                    </div>
                    {staffTab==="list" && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={()=>{setShowAddStaff(v=>!v);setEditStaffId(null);setEditStaffDraft(null);setNewStaff(DEFAULT_EMPTY_STAFF(positionOptions));}}>
                        <span style={{display:"flex",alignItems:"center",gap:4}}><IconPlus/> Add Staff</span>
                      </button>
                    )}
                  </div>

                  {staffError && <div className="admin-edit__alert admin-edit__alert--error" style={{marginBottom:12}}>{staffError}</div>}

                  {/* Staff sub-tabs */}
                  <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:"2px solid var(--tasks-border,#e8ecf0)" }}>
                    {([
                      {key:"list",        label:"Staff List",   count:staffList.length       },
                      {key:"disciplines", label:"Disciplines",  count:disciplineOptions.length},
                      {key:"positions",   label:"Positions",    count:positionOptions.length  },
                    ] as const).map(tab=>(
                      <button key={tab.key} type="button" onClick={()=>setStaffTab(tab.key)}
                        style={{ padding:"8px 16px", border:"none", borderBottom:staffTab===tab.key?"2px solid #2563eb":"2px solid transparent", marginBottom:-2, background:"transparent", fontSize:"0.82rem", fontWeight:staffTab===tab.key?700:500, color:staffTab===tab.key?"#2563eb":"var(--tasks-text-3,#8a97a8)", cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontFamily:"inherit" }}>
                        {tab.label}
                        <span style={{ fontSize:"0.62rem", fontWeight:700, background:staffTab===tab.key?"#dbeafe":"var(--tasks-surface-2,#f8fafc)", color:staffTab===tab.key?"#1d4ed8":"var(--tasks-text-3,#8a97a8)", padding:"1px 6px", borderRadius:999, border:`1px solid ${staffTab===tab.key?"#bfdbfe":"var(--tasks-border,#e8ecf0)"}` }}>{tab.count}</span>
                      </button>
                    ))}
                  </div>

                  {/* STAFF LIST */}
                  {staffTab==="list" && (<>
                    {showAddStaff && (
                      <div className="staff-form-card" style={{marginBottom:16}}>
                        <p className="staff-form-card-title">New Staff Member</p>
                        <div className="staff-form-grid">
                          <div className="admin-edit__field-group"><label className="admin-edit__label">Full Name <span className="staff-required">*</span></label><input type="text" className="admin-edit__input" value={newStaff.name} placeholder="e.g. John Doe" onChange={e=>setNewStaff(d=>({...d,name:e.target.value}))}/></div>
                          <div className="admin-edit__field-group"><label className="admin-edit__label">Email</label><input type="email" className="admin-edit__input" value={newStaff.email} placeholder="john@bfmo.edu" onChange={e=>setNewStaff(d=>({...d,email:e.target.value}))}/></div>
                          <div className="admin-edit__field-group"><label className="admin-edit__label">Username</label><input type="text" className="admin-edit__input" value={newStaff.clerkUsername||""} placeholder="e.g. ejn2032" onChange={e=>setNewStaff(d=>({...d,clerkUsername:e.target.value.replace(/[^a-zA-Z0-9_-]/g,"")}))}/>  <span className="admin-edit__label-hint">Used for login. No spaces or @ symbols.</span></div>
                          <div className="admin-edit__field-group"><label className="admin-edit__label">Position</label><select className="admin-edit__input" value={newStaff.position} onChange={e=>setNewStaff(d=>({...d,position:e.target.value}))}>{positionOptions.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                          <div className="admin-edit__field-group"><label className="admin-edit__label">Phone</label><input type="text" className="admin-edit__input" value={newStaff.phone||""} placeholder="Optional" onChange={e=>setNewStaff(d=>({...d,phone:e.target.value}))}/></div>
                        </div>
                        <div className="admin-edit__field-group" style={{marginTop:12}}>
                          <label className="admin-edit__label">Disciplines</label>
                          <div className="staff-chips">{disciplineOptions.map(d=>{const on=newStaff.disciplines.includes(d);return(<button key={d} type="button" className={`staff-chip${on?" staff-chip--on":""}`} onClick={()=>toggleDisc(d,newStaff.disciplines,setNewStaff)}>{on&&<IconCheck/>}{d}</button>);})}</div>
                        </div>
                        <div className="admin-edit__field-group" style={{marginTop:8}}><label className="admin-edit__label">Notes</label><input type="text" className="admin-edit__input" value={newStaff.notes||""} placeholder="Optional" onChange={e=>setNewStaff(d=>({...d,notes:e.target.value}))}/></div>
                        <div className="staff-form-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setShowAddStaff(false)} disabled={staffSaving}>Cancel</button>
                          <button type="button" className="btn btn-primary btn-sm" onClick={addStaff} disabled={staffSaving||!newStaff.name.trim()}>{staffSaving?"Adding…":"Add Member"}</button>
                        </div>
                      </div>
                    )}
                    {/* Discipline filter tabs */}
                    <div className="staff-topbar" style={{marginBottom:12}}>
                      <div className="staff-disc-tabs">
                        {["All",...disciplineOptions].map(d=>(<button key={d} type="button" className={`staff-disc-tab${discFilter===d?" staff-disc-tab--active":""}`} onClick={()=>setDiscFilter(d)}>{d}</button>))}
                      </div>
                    </div>
                    {staffLoading?<p className="admin-edit__loading">Loading staff…</p>:(
                      <div className="staff-list">
                        {filteredStaff.length===0&&<div className="staff-empty"><p>{discFilter==="All"?'No staff yet. Click "Add Staff" to get started.':`No ${discFilter} staff assigned.`}</p></div>}
                        {filteredStaff.map(member=>{
                          const isEditing=editStaffId===member._id;
                          const posStyle=getPositionStyle(member.position,positionOptions);
                          const initials=member.name.split(" ").slice(0,2).map(w=>w[0]?.toUpperCase()||"").join("");
                          return(
                            <div key={member._id}>
                              <div className={`staff-card${isEditing?" staff-card--editing":""}${!member.active?" staff-card--inactive":""}`}>
                                {isEditing&&editStaffDraft?(
                                  <div className="staff-edit-body">
                                    <div className="staff-form-grid">
                                      <div className="admin-edit__field-group"><label className="admin-edit__label">Full Name</label><input type="text" className="admin-edit__input" value={editStaffDraft.name} onChange={e=>setEditStaffDraft(d=>d?{...d,name:e.target.value}:d)}/></div>
                                      <div className="admin-edit__field-group"><label className="admin-edit__label">Email</label><input type="email" className="admin-edit__input" value={editStaffDraft.email} onChange={e=>setEditStaffDraft(d=>d?{...d,email:e.target.value}:d)}/></div>
                                      <div className="admin-edit__field-group"><label className="admin-edit__label">Position</label><select className="admin-edit__input" value={editStaffDraft.position} onChange={e=>setEditStaffDraft(d=>d?{...d,position:e.target.value}:d)}>{positionOptions.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                                      <div className="admin-edit__field-group"><label className="admin-edit__label">Phone</label><input type="text" className="admin-edit__input" value={editStaffDraft.phone||""} onChange={e=>setEditStaffDraft(d=>d?{...d,phone:e.target.value}:d)}/></div>
                                    </div>
                                    <div className="admin-edit__field-group" style={{marginTop:10}}><label className="admin-edit__label">Disciplines</label><div className="staff-chips">{disciplineOptions.map(d=>{const on=editStaffDraft.disciplines.includes(d);return(<button key={d} type="button" className={`staff-chip${on?" staff-chip--on":""}`} onClick={()=>toggleDisc(d,editStaffDraft.disciplines,setEditStaffDraft)}>{on&&<IconCheck/>}{d}</button>);})}</div></div>
                                    <div className="admin-edit__field-group" style={{marginTop:8}}><label className="admin-edit__label">Notes</label><input type="text" className="admin-edit__input" value={editStaffDraft.notes||""} onChange={e=>setEditStaffDraft(d=>d?{...d,notes:e.target.value}:d)}/></div>
                                    <label className="admin-edit__switch" style={{marginTop:10}}><input type="checkbox" checked={editStaffDraft.active} onChange={()=>setEditStaffDraft(d=>d?{...d,active:!d.active}:d)}/><span className="admin-edit__switch-pill"><span className="admin-edit__switch-knob"/></span><span className="admin-edit__switch-text">{editStaffDraft.active?"Active":"Inactive"}</span></label>
                                    <div className="staff-form-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={()=>{setEditStaffId(null);setEditStaffDraft(null);}} disabled={staffSaving}>Cancel</button><button type="button" className="btn btn-primary btn-sm" onClick={saveStaff} disabled={staffSaving||!editStaffDraft.name.trim()}>{staffSaving?"Saving…":"Save Changes"}</button></div>
                                  </div>
                                ):(
                                  <div className="staff-row">
                                    <div className="staff-avatar">{initials}</div>
                                    <div className="staff-info">
                                      <div className="staff-info-top">
                                        <span className="staff-name">{member.name}</span>
                                        <span className="staff-pos-badge" style={{backgroundColor:posStyle.bg,color:posStyle.text}}>{member.position}</span>
                                        {!member.active&&<span className="staff-inactive-tag">Inactive</span>}
                                        {member.clerkId&&<span style={{fontSize:11,background:"#dcfce7",color:"#166534",borderRadius:4,padding:"2px 6px"}}>✓ Clerk linked</span>}
                                      </div>
                                      {member.email&&<span className="staff-email">{member.email}</span>}
                                      <div className="staff-disc-pills">{member.disciplines.length===0?<span className="staff-no-disc">No disciplines</span>:member.disciplines.map(d=><span key={d} className="staff-disc-pill">{d}</span>)}</div>
                                      {member.notes&&<span className="staff-notes">{member.notes}</span>}
                                    </div>
                                    <div className="staff-row-btns">
                                      <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--clerk" title={member.clerkId?"Clerk linked":"Create Clerk account"}
                                        onClick={()=>{setShowClerkForm(showClerkForm===member._id?null:(member._id||null));setClerkResult(null);setNewClerkPw("");const ep=(member.email||"").split("@")[0].replace(/[^a-zA-Z0-9_]/g,"");setEditStaffDraft({...member,clerkUsername:member.clerkUsername||ep});}}>
                                        {member.clerkId?(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>):(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>)}
                                      </button>
                                      <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--edit" onClick={()=>{setEditStaffId(member._id||"");setEditStaffDraft({...member});setShowAddStaff(false);setShowClerkForm(null);}} title="Edit"><IconPencil/></button>
                                      <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--delete" onClick={()=>deleteStaff(member)} title="Remove"><IconTrash/></button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {showClerkForm===member._id&&(
                                <div className="staff-clerk-form">
                                  <p className="staff-clerk-form-title">{member.clerkId?"✓ Clerk account already linked":"Create Login Account"}</p>
                                  {!member.clerkId?(
                                    <>
                                      <div className="staff-clerk-fields">
                                        <div className="admin-edit__field-group"><label className="admin-edit__label">Email</label><input type="text" className="admin-edit__input" value={member.email||""} readOnly style={{background:"#f3f4f6",color:"#6b7280"}}/><span className="admin-edit__label-hint">Pulled from staff record</span></div>
                                        <div className="admin-edit__field-group"><label className="admin-edit__label">Username <span className="staff-required">*</span></label><input type="text" className="admin-edit__input" placeholder="e.g. ejn2032" value={editStaffDraft?.clerkUsername||""} onChange={e=>setEditStaffDraft(d=>d?{...d,clerkUsername:e.target.value.replace(/[^a-zA-Z0-9_-]/g,"")}:d)}/></div>
                                        <div className="admin-edit__field-group"><label className="admin-edit__label">Temporary Password <span className="staff-required">*</span></label><input type="text" className="admin-edit__input" placeholder="Min 8 characters" value={newClerkPw} onChange={e=>setNewClerkPw(e.target.value)}/><span className="admin-edit__label-hint">Share with the staff member.</span></div>
                                        <div className="admin-edit__field-group"><label className="admin-edit__label">Name</label><input type="text" className="admin-edit__input" value={member.name} readOnly style={{background:"#f3f4f6",color:"#6b7280"}}/></div>
                                        <div className="admin-edit__field-group"><label className="admin-edit__label">Accessibility</label><input type="text" className="admin-edit__input" value="Staff — can view reports and tasks" readOnly style={{background:"#f3f4f6",color:"#6b7280"}}/></div>
                                      </div>
                                      {clerkResult&&<div className={`staff-clerk-result${clerkResult.success?" staff-clerk-result--ok":" staff-clerk-result--err"}`}>{clerkResult.message}</div>}
                                      <div className="staff-form-actions" style={{marginTop:16}}>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={()=>{setShowClerkForm(null);setClerkResult(null);setNewClerkPw("");}}>Cancel</button>
                                        <button type="button" className="btn btn-primary btn-sm" onClick={()=>createClerkAccount({...member,clerkUsername:editStaffDraft?.clerkUsername||""})} disabled={clerkCreating||!newClerkPw.trim()||!editStaffDraft?.clerkUsername?.trim()}>{clerkCreating?"Creating…":"Create Account"}</button>
                                      </div>
                                    </>
                                  ):(
                                    <div style={{marginTop:8}}>
                                      <p style={{fontSize:13,color:"#16a34a",fontWeight:600}}>✓ Clerk account linked.</p>
                                      <p className="admin-edit__label-hint">Username: <code>{member.clerkUsername||"—"}</code></p>
                                      <p className="admin-edit__label-hint">Clerk ID: <code style={{fontSize:11}}>{member.clerkId}</code></p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>)}

                  {/* DISCIPLINES TAB */}
                  {staffTab==="disciplines" && (
                    <div>
                      <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:12, color:"#0369a1" }}>
                        <strong style={{color:"#0c4a6e"}}>How disciplines work:</strong> Staff assigned to a discipline only see tasks where <code>concernType</code> matches. No disciplines = sees all assigned tasks.
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {disciplineOptions.map((disc,idx)=>(
                          <div key={idx} className="admin-edit__subconcern-row">
                            {editDisciplineIdx===idx?(
                              <input type="text" className="admin-edit__input" value={disc} autoFocus onChange={e=>setDisciplineOptions(p=>p.map((x,i)=>i===idx?e.target.value:x))} onBlur={()=>setEditDisciplineIdx(null)} onKeyDown={e=>{if(e.key==="Enter")setEditDisciplineIdx(null);}}/>
                            ):(
                              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderRadius:8, background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)" }}>
                                <span style={{fontSize:14,fontWeight:500}}>{disc}</span>
                                <span style={{fontSize:11,color:"#9ca3af"}}>{staffList.filter(s=>s.disciplines.includes(disc)).length} staff</span>
                              </div>
                            )}
                            <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--edit" onClick={()=>setEditDisciplineIdx(idx)}><IconPencil/></button>
                            <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--delete" onClick={()=>{setDisciplineOptions(p=>p.filter((_,i)=>i!==idx));addNotification(`Discipline "${disc}" removed.`,"staff");}}><IconTrash/></button>
                          </div>
                        ))}
                      </div>
                      {disciplineOptions.length===0&&<p className="admin-edit__empty">No disciplines yet.</p>}
                      <div className="admin-edit__subconcern-row" style={{marginTop:12}}>
                        <input type="text" className="admin-edit__input" value={newDiscipline} placeholder="e.g. Plumbing" onChange={e=>setNewDiscipline(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newDiscipline.trim()){if(!disciplineOptions.includes(newDiscipline.trim())){setDisciplineOptions(p=>[...p,newDiscipline.trim()]);addNotification(`Discipline "${newDiscipline.trim()}" added.`,"staff");}setNewDiscipline("");}}}/>
                        <button type="button" className="btn btn-primary btn-sm" onClick={()=>{if(!newDiscipline.trim())return;if(!disciplineOptions.includes(newDiscipline.trim())){setDisciplineOptions(p=>[...p,newDiscipline.trim()]);addNotification(`Discipline "${newDiscipline.trim()}" added.`,"staff");}setNewDiscipline("");}}>+ Add Discipline</button>
                      </div>
                    </div>
                  )}

                  {/* POSITIONS TAB */}
                  {staffTab==="positions" && (
                    <div>
                      <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:8, padding:"10px 14px", marginBottom:20, fontSize:12, color:"#0369a1" }}>
                        <strong style={{color:"#0c4a6e"}}>How permissions work:</strong> Permissions are matched by position name (case-insensitive) in the Staff Task page. Click a position card to edit its permissions. Changes are saved with <strong>Save All Changes</strong>.
                      </div>

                      {/* Editable permission cards grid */}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12, marginBottom:24 }}>
                        {positionOptions.map((pos) => {
                          const style   = getPositionStyle(pos, positionOptions);
                          const perms   = positionPerms[pos] || ["View only"];
                          const isOpen  = editingPermPos === pos;
                          const staffCt = staffList.filter(s => s.position === pos).length;
                          return (
                            <div key={pos} style={{
                              background:"var(--tasks-surface,#fff)",
                              border:`1.5px solid ${isOpen ? style.text : "var(--tasks-border,#e8ecf0)"}`,
                              borderRadius:12,
                              borderLeft:`4px solid ${style.text}`,
                              overflow:"hidden",
                              boxShadow: isOpen ? `0 0 0 3px ${style.bg}` : "none",
                              transition:"all 0.15s",
                            }}>
                              {/* Card header */}
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom: isOpen ? "1px solid var(--tasks-border,#e8ecf0)" : "none" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                  <span style={{ background:style.bg, color:style.text, fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:999 }}>{pos}</span>
                                  <span style={{ fontSize:11, color:"#9ca3af" }}>{staffCt} staff</span>
                                </div>
                                <button type="button"
                                  onClick={() => setEditingPermPos(isOpen ? null : pos)}
                                  style={{ display:"flex", alignItems:"center", gap:4, background: isOpen ? style.bg : "var(--tasks-surface-2,#f8fafc)", border:`1px solid ${isOpen ? style.text : "var(--tasks-border,#e8ecf0)"}`, borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:11, fontWeight:600, color: isOpen ? style.text : "var(--tasks-text-2,#4a5568)" }}>
                                  {isOpen ? (<><IconCheck/> Done</>) : (<><IconPencil/> Edit</>)}
                                </button>
                              </div>

                              {/* Permissions list */}
                              <div style={{ padding:"10px 14px" }}>
                                {perms.map((perm, pIdx) => (
                                  <div key={pIdx} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--tasks-text-1,#0d1b2a)" }}>
                                      {isOpen ? (
                                        <input
                                          type="text"
                                          value={perm}
                                          onChange={e => {
                                            const updated = [...perms];
                                            updated[pIdx] = e.target.value;
                                            setPositionPerms(prev => ({ ...prev, [pos]: updated }));
                                          }}
                                          style={{ fontSize:12, padding:"3px 8px", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:5, width:170, fontFamily:"inherit" }}
                                        />
                                      ) : (
                                        <>
                                          <span style={{ color:"#22c55e", fontWeight:700, fontSize:13 }}>✓</span>
                                          <span>{perm}</span>
                                        </>
                                      )}
                                    </div>
                                    {isOpen && (
                                      <button type="button"
                                        onClick={() => setPositionPerms(prev => ({ ...prev, [pos]: perms.filter((_,i)=>i!==pIdx) }))}
                                        style={{ background:"none", border:"none", cursor:"pointer", color:"#ef4444", padding:"2px 4px", display:"flex", alignItems:"center" }}>
                                        <IconTrash/>
                                      </button>
                                    )}
                                  </div>
                                ))}

                                {/* Add permission input */}
                                {isOpen && (
                                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                                    <input
                                      type="text"
                                      placeholder="e.g. Delete tasks"
                                      value={newPermInput[pos] || ""}
                                      onChange={e => setNewPermInput(prev => ({ ...prev, [pos]: e.target.value }))}
                                      onKeyDown={e => {
                                        if (e.key==="Enter" && newPermInput[pos]?.trim()) {
                                          setPositionPerms(prev => ({ ...prev, [pos]: [...(prev[pos]||[]), newPermInput[pos].trim()] }));
                                          setNewPermInput(prev => ({ ...prev, [pos]: "" }));
                                        }
                                      }}
                                      style={{ flex:1, fontSize:12, padding:"4px 8px", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:5, fontFamily:"inherit" }}
                                    />
                                    <button type="button"
                                      onClick={() => {
                                        if (!newPermInput[pos]?.trim()) return;
                                        setPositionPerms(prev => ({ ...prev, [pos]: [...(prev[pos]||[]), newPermInput[pos].trim()] }));
                                        setNewPermInput(prev => ({ ...prev, [pos]: "" }));
                                      }}
                                      style={{ background:style.text, color:"#fff", border:"none", borderRadius:5, padding:"4px 10px", cursor:"pointer", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                                      + Add
                                    </button>
                                  </div>
                                )}

                                {perms.length === 0 && !isOpen && (
                                  <span style={{ fontSize:11, color:"#9ca3af", fontStyle:"italic" }}>No permissions set</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Position name list — add / rename / delete */}
                      <div style={{ background:"var(--tasks-surface,#fff)", border:"1px solid var(--tasks-border,#e8ecf0)", borderRadius:12, padding:16 }}>
                        <p style={{ margin:"0 0 12px", fontSize:12, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.05em" }}>Manage Position Names</p>
                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          {positionOptions.map((pos,idx)=>{
                            const style=getPositionStyle(pos,positionOptions);
                            return(
                              <div key={idx} className="admin-edit__subconcern-row">
                                {editPositionIdx===idx?(
                                  <input type="text" className="admin-edit__input" value={pos} autoFocus
                                    onChange={e => {
                                      const oldName = positionOptions[idx];
                                      const newName = e.target.value;
                                      setPositionOptions(p=>p.map((x,i)=>i===idx?newName:x));
                                      // rename key in perms map
                                      setPositionPerms(prev => {
                                        const copy = { ...prev };
                                        if (copy[oldName] !== undefined) { copy[newName] = copy[oldName]; delete copy[oldName]; }
                                        return copy;
                                      });
                                    }}
                                    onBlur={()=>setEditPositionIdx(null)}
                                    onKeyDown={e=>{if(e.key==="Enter")setEditPositionIdx(null);}}/>
                                ):(
                                  <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderRadius:8, background:"var(--tasks-surface-2,#f8fafc)", border:"1px solid var(--tasks-border,#e8ecf0)" }}>
                                    <span className="staff-pos-badge" style={{backgroundColor:style.bg,color:style.text}}>{pos}</span>
                                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                      <span style={{fontSize:11,color:"#9ca3af"}}>{(positionPerms[pos]||[]).length} permissions</span>
                                      <span style={{fontSize:11,color:"#9ca3af"}}>·</span>
                                      <span style={{fontSize:11,color:"#9ca3af"}}>{staffList.filter(s=>s.position===pos).length} staff</span>
                                    </div>
                                  </div>
                                )}
                                <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--edit" onClick={()=>setEditPositionIdx(idx)} title="Rename"><IconPencil/></button>
                                <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--delete"
                                  onClick={()=>{
                                    setPositionOptions(p=>p.filter((_,i)=>i!==idx));
                                    setPositionPerms(prev=>{ const copy={...prev}; delete copy[pos]; return copy; });
                                    addNotification(`Position "${pos}" removed.`,"staff");
                                  }} title="Delete"><IconTrash/></button>
                              </div>
                            );
                          })}
                        </div>
                        {positionOptions.length===0&&<p className="admin-edit__empty">No positions yet.</p>}
                        <div className="admin-edit__subconcern-row" style={{marginTop:12}}>
                          <input type="text" className="admin-edit__input" value={newPosition} placeholder="e.g. Electrician"
                            onChange={e=>setNewPosition(e.target.value)}
                            onKeyDown={e=>{if(e.key==="Enter"&&newPosition.trim()){setPositionOptions(p=>[...p,newPosition.trim()]);setPositionPerms(prev=>({...prev,[newPosition.trim()]:["View only"]}));addNotification(`Position "${newPosition.trim()}" added.`,"staff");setNewPosition("");}}}/>
                          <button type="button" className="btn btn-primary btn-sm"
                            onClick={()=>{if(!newPosition.trim())return;setPositionOptions(p=>[...p,newPosition.trim()]);setPositionPerms(prev=>({...prev,[newPosition.trim()]:["View only"]}));addNotification(`Position "${newPosition.trim()}" added.`,"staff");setNewPosition("");}}>
                            + Add Position
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}