"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useNotifications } from "@/app/context/notification";
import "../style/admin-edit.css";

// Add these instead:
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

/* ── Types ── */
type BuildingMeta  = { id: string; name: string; floors: number; roomsPerFloor: number | number[]; hasRooms?: boolean; singleLocationLabel?: string; };
type ConcernMeta   = { id: string; label: string; subconcerns: string[]; };
type StatusMeta    = { id: string; name: string; color: string; };
type PriorityMeta  = { id: string; name: string; color: string; notifyInterval?: string; };

/* ── Defaults ── */
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
  { value: "daily",   label: "Every Day"     },
  { value: "1week",   label: "Every Week"    },
  { value: "1month",  label: "Every Month"   },
  { value: "3months", label: "Every 3 Months"},
];

const NOTIFY_INTERVAL_LABELS: Record<string, string> = {
  daily:   "Every Day",
  "1week": "Every Week",
  "1month":"Every Month",
  "3months":"Every 3 Months",
};

const FLOOR_ORDINALS = ["1st Floor","2nd Floor","3rd Floor","4th Floor","5th Floor","6th Floor","7th Floor","8th Floor","9th Floor","10th Floor"];

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "")) || "http://localhost:3000";
const META_URL = `${API_BASE}/api/meta`;
const norm = (v: unknown) => v == null ? "" : String(v).trim().toLowerCase();

/* ── Helpers ── */
function normaliseRoomsPerFloor(raw: unknown, floors: number): number[] {
  if (Array.isArray(raw)) {
    const arr = (raw as unknown[]).map((v) => { const n = parseInt(String(v), 10); return Number.isNaN(n) || n <= 0 ? 1 : n; });
    while (arr.length < floors) arr.push(arr[arr.length - 1] ?? 1);
    return arr.slice(0, floors);
  }
  const flat = typeof raw === "number" && raw > 0 ? Math.round(raw) : 1;
  return Array.from({ length: floors }, () => flat);
}
function getRoomsArray(b: BuildingMeta) { return normaliseRoomsPerFloor(b.roomsPerFloor, b.floors); }
function totalRooms(b: BuildingMeta)    { return getRoomsArray(b).reduce((s, n) => s + n, 0); }

/* ── DB normalisers ── */
function normalizeBuildingsFromDb(raw: unknown[]): BuildingMeta[] {
  return raw.map((b, idx) => {
    if (typeof b === "string") { const label = String(b).trim(); const id = norm(label).replace(/\s+/g,"-")||`b-${idx}`; return { id, name: label||"Unnamed", floors:1, roomsPerFloor:[1], hasRooms:true, singleLocationLabel:"" }; }
    const obj = b as any;
    const rawName = String(obj?.name||"").trim();
    const id = String(obj?.id||"").trim() || norm(rawName).replace(/\s+/g,"-") || `b-${idx}`;
    const floors = typeof obj?.floors==="number" && obj.floors>0 ? Math.round(obj.floors) : 1;
    return { id, name: rawName||"Unnamed", floors, roomsPerFloor: normaliseRoomsPerFloor(obj?.roomsPerFloor,floors), hasRooms: obj?.hasRooms===false?false:true, singleLocationLabel: typeof obj?.singleLocationLabel==="string"?String(obj.singleLocationLabel).trim():"" };
  });
}
function normalizeConcernsFromDb(raw: unknown[]): ConcernMeta[] {
  return raw.map((c, idx) => {
    const obj = c as any;
    const label = String(obj?.label||"").trim();
    const id = String(obj?.id||"").trim() || norm(label).replace(/\s+/g,"-") || `concern-${idx}`;
    const subs: string[] = Array.isArray(obj?.subconcerns) ? obj.subconcerns.map((s:unknown)=>String(s||"").trim()) : [];
    return { id, label: label||"Unnamed concern", subconcerns: subs.filter(s=>s.length>0) };
  });
}
function normalizeStatusesFromDb(raw: unknown[]): StatusMeta[] {
  return raw.map((s, idx) => { const obj = s as any; return { id: String(obj?.id||idx+1), name: String(obj?.name||"").trim()||"Unnamed", color: String(obj?.color||"#6C757D").trim() }; });
}
function normalizePrioritiesFromDb(raw: unknown[]): PriorityMeta[] {
  return raw.map((p, idx) => { const obj = p as any; return { id: String(obj?.id||idx+1), name: String(obj?.name||"").trim()||"Unnamed", color: String(obj?.color||"#6C757D").trim(), notifyInterval: String(obj?.notifyInterval||"1month") }; });
}

/* ── Panel ── */
function Panel({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="admin-edit__panel">
      <header className="admin-edit__panel-head">
        <div>
          {title    && <h3 className="admin-edit__panel-title">{title}</h3>}
          {subtitle && <p  className="admin-edit__panel-subtitle">{subtitle}</p>}
        </div>
      </header>
      <div className="admin-edit__panel-body">{children}</div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function AdminEditPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { addNotification } = useNotifications();

  const [buildings,  setBuildings]  = useState<BuildingMeta[]>(DEFAULT_BUILDINGS);
  const [concerns,   setConcerns]   = useState<ConcernMeta[]>(DEFAULT_CONCERNS);
  const [statuses,   setStatuses]   = useState<StatusMeta[]>(DEFAULT_STATUSES);
  const [priorities, setPriorities] = useState<PriorityMeta[]>(DEFAULT_PRIORITIES);

  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  /* Building / Concern / Status — dropdown selection */
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedConcernId,  setSelectedConcernId]  = useState("");
  const [selectedStatusId,   setSelectedStatusId]   = useState("");

  /* Priority — inline edit state */
  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);
  const [editPriorityDraft, setEditPriorityDraft] = useState<PriorityMeta | null>(null);
  const [showAddPriority,   setShowAddPriority]   = useState(false);
  const [newPriorityDraft,  setNewPriorityDraft]  = useState<PriorityMeta>({ id: "", name: "", color: "#6C757D", notifyInterval: "1month" });

  /* ── Auth ── */
  const role = useMemo(() => {
    if (!isLoaded || !isSignedIn || !user) return "guest";
    const rawRole = (user.publicMetadata as any)?.role;
    let r = "student";
    if (Array.isArray(rawRole) && rawRole.length > 0) r = String(rawRole[0]).toLowerCase();
    else if (typeof rawRole === "string") r = rawRole.toLowerCase();
    return r;
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { router.replace("/"); return; }
    if (role !== "admin") router.replace("/");
  }, [isLoaded, isSignedIn, user, role, router]);

  /* ── Load ── */
  const loadMeta = useCallback(async (mode: "preferDefaults" | "dbOnly" = "preferDefaults") => {
    try {
      setLoading(true); setError(""); setSaveMsg("");
      const res = await fetch(`${META_URL}?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load options from server.");
      const data = await res.json().catch(() => null);
      if (!data) throw new Error("Server returned empty meta.");

      const rawB = Array.isArray(data.buildings)  ? data.buildings  : [];
      const rawC = Array.isArray(data.concerns)   ? data.concerns   : [];
      const rawS = Array.isArray(data.statuses)   ? data.statuses   : [];
      const rawP = Array.isArray(data.priorities) ? data.priorities : [];

      const iB = (mode==="preferDefaults"&&rawB.length===0) ? DEFAULT_BUILDINGS  : normalizeBuildingsFromDb(rawB);
      const iC = (mode==="preferDefaults"&&rawC.length===0) ? DEFAULT_CONCERNS   : normalizeConcernsFromDb(rawC);
      const iS = (mode==="preferDefaults"&&rawS.length===0) ? DEFAULT_STATUSES   : normalizeStatusesFromDb(rawS);
      const iP = (mode==="preferDefaults"&&rawP.length===0) ? DEFAULT_PRIORITIES : normalizePrioritiesFromDb(rawP);

      setBuildings(iB); setConcerns(iC); setStatuses(iS); setPriorities(iP);
      if (iB.length>0&&!selectedBuildingId) setSelectedBuildingId(iB[0].id);
      if (iC.length>0&&!selectedConcernId)  setSelectedConcernId(iC[0].id);
      if (iS.length>0&&!selectedStatusId)   setSelectedStatusId(iS[0].id);
    } catch (err: any) {
      setError(err?.message||"Could not load. Using defaults.");
      if (mode==="preferDefaults") { setBuildings(DEFAULT_BUILDINGS); setConcerns(DEFAULT_CONCERNS); setStatuses(DEFAULT_STATUSES); setPriorities(DEFAULT_PRIORITIES); }
    } finally { setLoading(false); }
  }, [selectedBuildingId, selectedConcernId, selectedStatusId]);

  useEffect(() => { loadMeta("preferDefaults"); }, []);

  /* ── Save ── */
  const handleSave = async () => {
    setSaving(true); setError(""); setSaveMsg("");

    let cleanBuildings = buildings.map((b,idx)=>{
      const name=String(b.name||"").trim(); if(!name) return null;
      const id=String(b.id||"").trim()||norm(name).replace(/\s+/g,"-")||`b-${idx}`;
      const floors=typeof b.floors==="number"&&b.floors>0?Math.round(b.floors):1;
      return { id, name, floors, roomsPerFloor:normaliseRoomsPerFloor(b.roomsPerFloor,floors), hasRooms:b.hasRooms===false?false:true, singleLocationLabel:String(b.singleLocationLabel||"").trim() };
    }).filter(Boolean) as BuildingMeta[];
    if (!cleanBuildings.some(b=>norm(b.name)==="other")) cleanBuildings.push({id:"other",name:"Other",floors:1,roomsPerFloor:[1],hasRooms:false,singleLocationLabel:""});
    cleanBuildings = [...cleanBuildings.filter(b=>norm(b.name)!=="other"), ...cleanBuildings.filter(b=>norm(b.name)==="other")];

    let cleanConcerns = concerns.map((c,idx)=>{
      const label=String(c.label||"").trim(); if(!label) return null;
      const id=String(c.id||"").trim()||norm(label).replace(/\s+/g,"-")||`concern-${idx}`;
      let subs=(Array.isArray(c.subconcerns)?c.subconcerns:[]).map(s=>String(s||"").trim()).filter(s=>s.length>0);
      subs=[...subs.filter(s=>norm(s)!=="other"),"Other"];
      return { id, label, subconcerns: subs };
    }).filter(Boolean) as ConcernMeta[];
    if (!cleanConcerns.some(c=>norm(c.label)==="other")) cleanConcerns.push({id:"other",label:"Other",subconcerns:["Other"]});
    cleanConcerns = [...cleanConcerns.filter(c=>norm(c.label)!=="other"), ...cleanConcerns.filter(c=>norm(c.label)==="other")];

    const cleanStatuses = statuses.map((s,idx)=>{ const name=String(s.name||"").trim(); if(!name) return null; return { id:String(s.id||idx+1).trim(), name, color:String(s.color||"#6C757D").trim() }; }).filter(Boolean) as StatusMeta[];
    const cleanPriorities = priorities.map((p,idx)=>{ const name=String(p.name||"").trim(); if(!name) return null; return { id:String(p.id||idx+1).trim(), name, color:String(p.color||"#6C757D").trim(), notifyInterval:String(p.notifyInterval||"1month") }; }).filter(Boolean) as PriorityMeta[];

    try {
      const res = await fetch(META_URL, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ buildings:cleanBuildings, concerns:cleanConcerns, statuses:cleanStatuses, priorities:cleanPriorities }) });
      if (!res.ok) { const raw=await res.text().catch(()=>""); throw new Error(raw||"Failed to save changes."); }
      const data = await res.json().catch(()=>null);
      if (data?.buildings)  setBuildings(normalizeBuildingsFromDb(data.buildings));
      if (data?.concerns)   setConcerns(normalizeConcernsFromDb(data.concerns));
      if (data?.statuses)   setStatuses(normalizeStatusesFromDb(data.statuses));
      if (data?.priorities) setPriorities(normalizePrioritiesFromDb(data.priorities));
      setSaveMsg("All changes saved successfully.");
    } catch (err: any) {
      setError(err?.message||"Failed to save changes.");
    } finally { setSaving(false); }
  };

  const selectedBuilding = useMemo(()=>buildings.find(b=>b.id===selectedBuildingId),[buildings,selectedBuildingId]);
  const selectedConcern  = useMemo(()=>concerns.find(c=>c.id===selectedConcernId),  [concerns, selectedConcernId]);
  const selectedStatus   = useMemo(()=>statuses.find(s=>s.id===selectedStatusId),   [statuses, selectedStatusId]);

  /* ── Building handlers ── */
  const handleBuildingNameChange    = (v:string) => setBuildings(p=>p.map(b=>b.id===selectedBuildingId?{...b,name:v}:b));
  const handleBuildingHasRoomsToggle = ()        => setBuildings(p=>p.map(b=>b.id===selectedBuildingId?{...b,hasRooms:b.hasRooms===false?true:false}:b));
  const handleBuildingFloorsChange  = (v:string) => {
    const floors=Math.min(Math.max(parseInt(v,10)||1,1),20);
    setBuildings(p=>p.map(b=>{ if(b.id!==selectedBuildingId) return b; return {...b,floors,roomsPerFloor:normaliseRoomsPerFloor(normaliseRoomsPerFloor(b.roomsPerFloor,b.floors),floors)}; }));
  };
  const handleFloorRoomsChange = (idx:number, v:string) => {
    const rooms=Math.max(parseInt(v,10)||1,1);
    setBuildings(p=>p.map(b=>{ if(b.id!==selectedBuildingId) return b; const arr=normaliseRoomsPerFloor(b.roomsPerFloor,b.floors); arr[idx]=rooms; return {...b,roomsPerFloor:[...arr]}; }));
  };
  const handleAddBuilding = () => {
    const nb:BuildingMeta={id:`b-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name:"New Building",floors:1,roomsPerFloor:[1],hasRooms:true,singleLocationLabel:""};
    setBuildings(p=>[...p,nb]); setSelectedBuildingId(nb.id);
    addNotification(`Building "${nb.name}" was added.`, "building");
  };
  const handleDeleteBuilding = () => {
    if (!selectedBuildingId||!selectedBuilding) return;
    addNotification(`Building "${selectedBuilding.name}" was deleted.`, "building");
    const idx=buildings.findIndex(b=>b.id===selectedBuildingId);
    const rem=buildings.filter(b=>b.id!==selectedBuildingId);
    setBuildings(rem); setSelectedBuildingId(rem.length>0?rem[Math.min(idx,rem.length-1)].id:"");
  };
  const handleBuildingNameBlur = (prev:string, next:string) => {
    if (prev!==next) addNotification(`Building renamed to "${next}".`, "building");
  };

  /* ── Concern handlers ── */
  const handleConcernLabelChange = (v:string) => setConcerns(p=>p.map(c=>c.id===selectedConcernId?{...c,label:v}:c));
  const handleAddConcern = () => {
    const nc:ConcernMeta={id:`concern-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,label:"New Concern",subconcerns:[]};
    setConcerns(p=>[...p,nc]); setSelectedConcernId(nc.id);
    addNotification(`Concern "${nc.label}" was added.`, "concern");
  };
  const handleDeleteConcern = () => {
    if (!selectedConcernId||!selectedConcern) return;
    addNotification(`Concern "${selectedConcern.label}" was deleted.`, "concern");
    const idx=concerns.findIndex(c=>c.id===selectedConcernId);
    const rem=concerns.filter(c=>c.id!==selectedConcernId);
    setConcerns(rem); setSelectedConcernId(rem.length>0?rem[Math.min(idx,rem.length-1)].id:"");
  };
  const handleSubconcernChange = (si:number,v:string) => setConcerns(p=>p.map(c=>{ if(c.id!==selectedConcernId) return c; const s=[...(c.subconcerns||[])]; s[si]=v; return {...c,subconcerns:s}; }));
  const handleAddSubconcern    = ()     => setConcerns(p=>p.map(c=>c.id===selectedConcernId?{...c,subconcerns:[...(c.subconcerns||[]),""]}: c));
  const handleDeleteSubconcern = (si:number) => setConcerns(p=>p.map(c=>{ if(c.id!==selectedConcernId) return c; const s=[...(c.subconcerns||[])]; s.splice(si,1); return {...c,subconcerns:s}; }));

  /* ── Status handlers ── */
  const handleStatusNameChange  = (v:string) => setStatuses(p=>p.map(s=>s.id===selectedStatusId?{...s,name:v}:s));
  const handleStatusColorChange = (v:string) => setStatuses(p=>p.map(s=>s.id===selectedStatusId?{...s,color:v}:s));
  const handleAddStatus = () => {
    const ns:StatusMeta={id:`status-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name:"New Status",color:"#6C757D"};
    setStatuses(p=>[...p,ns]); setSelectedStatusId(ns.id);
    addNotification(`Status "${ns.name}" was added.`, "status");
  };
  const handleDeleteStatus = () => {
    if (!selectedStatusId||!selectedStatus) return;
    addNotification(`Status "${selectedStatus.name}" was deleted.`, "status");
    const idx=statuses.findIndex(s=>s.id===selectedStatusId);
    const rem=statuses.filter(s=>s.id!==selectedStatusId);
    setStatuses(rem); setSelectedStatusId(rem.length>0?rem[Math.min(idx,rem.length-1)].id:"");
  };

  /* ── Priority handlers (inline list UI) ── */
  const startEditPriority = (p:PriorityMeta) => { setEditingPriorityId(p.id); setEditPriorityDraft({...p}); setShowAddPriority(false); };
  const cancelEditPriority = () => { setEditingPriorityId(null); setEditPriorityDraft(null); };
  const saveEditPriority = () => {
    if (!editPriorityDraft) return;
    const prev = priorities.find(p=>p.id===editPriorityDraft.id);
    setPriorities(p=>p.map(x=>x.id===editPriorityDraft.id?{...editPriorityDraft}:x));
    if (prev && prev.name!==editPriorityDraft.name)  addNotification(`Priority renamed to "${editPriorityDraft.name}".`, "priority");
    if (prev && prev.color!==editPriorityDraft.color) addNotification(`Priority "${editPriorityDraft.name}" color changed.`, "priority");
    if (prev && prev.notifyInterval!==editPriorityDraft.notifyInterval) addNotification(`Priority "${editPriorityDraft.name}" notification interval set to ${NOTIFY_INTERVAL_LABELS[editPriorityDraft.notifyInterval||"1month"]}.`, "priority");
    cancelEditPriority();
  };
  const handleDeletePriority = (p:PriorityMeta) => {
    addNotification(`Priority "${p.name}" was deleted.`, "priority");
    const idx=priorities.findIndex(x=>x.id===p.id);
    const rem=priorities.filter(x=>x.id!==p.id);
    setPriorities(rem);
    if (editingPriorityId===p.id) cancelEditPriority();
  };
  const handleAddPriority = () => {
    const np:PriorityMeta={id:`priority-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name:newPriorityDraft.name.trim()||"New Priority",color:newPriorityDraft.color,notifyInterval:newPriorityDraft.notifyInterval||"1month"};
    setPriorities(p=>[...p,np]);
    addNotification(`Priority "${np.name}" was added.`, "priority");
    setShowAddPriority(false);
    setNewPriorityDraft({id:"",name:"",color:"#6C757D",notifyInterval:"1month"});
  };

  /* ── Guards ── */
  if (!isLoaded||!isSignedIn) return <div className="admin-edit__wrapper"><p>Checking your permissions…</p></div>;
  if (role!=="admin")         return <div className="admin-edit__wrapper"><p>You do not have access to the admin configuration page.</p></div>;

  /* ══════════════════════════════════════════════════════════ */
  return (
    <div className="admin-edit admin-edit__wrapper">
      <main className="admin-edit__layout">

        {/* Header */}
        <header className="admin-edit__page-head">
          <div className="admin-edit__heading">
            <h1 className="admin-edit__page-title">Buildings &amp; Concerns Configuration</h1>
            <p className="admin-edit__page-subtitle">Select a building or concern from the dropdown to edit its details</p>
            <p className="admin-edit__meta">{buildings.length} buildings · {concerns.length} concerns · {statuses.length} statuses · {priorities.length} priorities</p>
          </div>
          <div className="admin-edit__actions">
            <button type="button" className="btn btn-secondary" disabled={saving||loading}
              onClick={()=>{ setBuildings(DEFAULT_BUILDINGS); setConcerns(DEFAULT_CONCERNS); setStatuses(DEFAULT_STATUSES); setPriorities(DEFAULT_PRIORITIES); setSaveMsg(""); setError(""); if(DEFAULT_BUILDINGS.length>0)setSelectedBuildingId(DEFAULT_BUILDINGS[0].id); if(DEFAULT_CONCERNS.length>0)setSelectedConcernId(DEFAULT_CONCERNS[0].id); if(DEFAULT_STATUSES.length>0)setSelectedStatusId(DEFAULT_STATUSES[0].id); cancelEditPriority(); setShowAddPriority(false); }}>
              Load Defaults
            </button>
            <button type="button" className="btn btn-secondary" onClick={()=>loadMeta("dbOnly")} disabled={saving||loading}>Load Database</button>
            <button type="button" className="btn btn-primary"   onClick={handleSave}            disabled={saving||loading}>{saving?"Saving…":"Save All Changes"}</button>
          </div>
        </header>

        {error   && <div className="admin-edit__alert admin-edit__alert--error">{error}</div>}
        {saveMsg && <div className="admin-edit__alert admin-edit__alert--success">{saveMsg}</div>}

        {loading ? <p className="admin-edit__loading">Loading options…</p> : (
          <div className="admin-edit__grid">

            {/* ── Buildings ── */}
            <Panel title="Buildings" subtitle="Select a building to edit its configuration">
              <div className="admin-edit__selector-row">
                <div className="admin-edit__field-group" style={{flex:1}}>
                  <label className="admin-edit__label">Select Building</label>
                  <select className="admin-edit__input" value={selectedBuildingId} onChange={e=>setSelectedBuildingId(e.target.value)}>
                    <option value="">-- Select a building --</option>
                    {buildings.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <button type="button" className="btn btn-secondary" onClick={handleAddBuilding}>+ Add New Building</button>
              </div>
              {selectedBuilding && (
                <div className="admin-edit__editor-card">
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__label">Building Name</label>
                    <input type="text" className="admin-edit__input" value={selectedBuilding.name} placeholder="Example: CBAA"
                      onChange={e=>handleBuildingNameChange(e.target.value)}
                      onBlur={e=>handleBuildingNameBlur(buildings.find(b=>b.id===selectedBuildingId)?.name||"",e.target.value)} />
                  </div>
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__switch">
                      <input type="checkbox" checked={selectedBuilding.hasRooms!==false} onChange={handleBuildingHasRoomsToggle}/>
                      <span className="admin-edit__switch-pill"><span className="admin-edit__switch-knob"/></span>
                      <span className="admin-edit__switch-text">{selectedBuilding.hasRooms!==false?"Has floors and rooms":"Specific spot only"}</span>
                    </label>
                  </div>
                  {selectedBuilding.hasRooms!==false && (<>
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Number of Floors</label>
                      <input type="number" min={1} max={20} className="admin-edit__input admin-edit__input-small" value={selectedBuilding.floors} onChange={e=>handleBuildingFloorsChange(e.target.value)}/>
                    </div>
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Rooms per Floor<span className="admin-edit__label-hint"> — set individually</span></label>
                      <div className="admin-edit__floors-grid">
                        {getRoomsArray(selectedBuilding).map((count,idx)=>(
                          <div key={idx} className="admin-edit__floor-row">
                            <span className="admin-edit__floor-label">{FLOOR_ORDINALS[idx]??`Floor ${idx+1}`}</span>
                            <input type="number" min={1} className="admin-edit__input admin-edit__input-floor" value={count} onChange={e=>handleFloorRoomsChange(idx,e.target.value)}/>
                            <span className="admin-edit__floor-unit">rooms</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="admin-edit__info-box">
                      <strong>Total Rooms:</strong> {totalRooms(selectedBuilding)}
                      <span className="admin-edit__info-breakdown">&nbsp;({getRoomsArray(selectedBuilding).map((n,i)=>`${FLOOR_ORDINALS[i]??`F${i+1}`}: ${n}`).join(" · ")})</span>
                    </div>
                  </>)}
                  <div className="admin-edit__actions-row">
                    <button type="button" className="btn btn-danger" onClick={handleDeleteBuilding}>Delete Building</button>
                  </div>
                </div>
              )}
              {!selectedBuilding && <p className="admin-edit__empty">Select a building from the dropdown above to edit it</p>}
            </Panel>

            {/* ── Concerns ── */}
            <Panel title="Concerns" subtitle="Select a concern to edit its subconcerns">
              <div className="admin-edit__selector-row">
                <div className="admin-edit__field-group" style={{flex:1}}>
                  <label className="admin-edit__label">Select Concern</label>
                  <select className="admin-edit__input" value={selectedConcernId} onChange={e=>setSelectedConcernId(e.target.value)}>
                    <option value="">-- Select a concern --</option>
                    {concerns.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <button type="button" className="btn btn-secondary" onClick={handleAddConcern}>+ Add New Concern</button>
              </div>
              {selectedConcern && (
                <div className="admin-edit__editor-card">
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__label">Concern Name</label>
                    <input type="text" className="admin-edit__input" value={selectedConcern.label} placeholder="Example: Electrical"
                      onChange={e=>handleConcernLabelChange(e.target.value)}
                      onBlur={e=>{ const prev=concerns.find(c=>c.id===selectedConcernId)?.label||""; if(prev!==e.target.value) addNotification(`Concern renamed to "${e.target.value}".`,"concern"); }}/>
                  </div>
                  <div className="admin-edit__subconcerns-section">
                    <div className="admin-edit__subconcerns-head">
                      <h4>Subconcerns</h4>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddSubconcern}>+ Add Subconcern</button>
                    </div>
                    {(!selectedConcern.subconcerns||selectedConcern.subconcerns.length===0) && <p className="admin-edit__empty">No subconcerns yet. Click "Add Subconcern" to create one.</p>}
                    {Array.isArray(selectedConcern.subconcerns) && selectedConcern.subconcerns.map((sub,idx)=>(
                      <div key={idx} className="admin-edit__subconcern-row">
                        <input type="text" className="admin-edit__input" value={sub} placeholder="Example: Walls" onChange={e=>handleSubconcernChange(idx,e.target.value)}/>
                        <button type="button" className="btn btn-ghost" onClick={()=>handleDeleteSubconcern(idx)}>Delete</button>
                      </div>
                    ))}
                  </div>
                  <div className="admin-edit__actions-row">
                    <button type="button" className="btn btn-danger" onClick={handleDeleteConcern}>Delete Concern</button>
                  </div>
                </div>
              )}
              {!selectedConcern && <p className="admin-edit__empty">Select a concern from the dropdown above to edit it</p>}
            </Panel>

            {/* ── Statuses ── */}
            <Panel title="Statuses" subtitle="Configure report status options and their display colors">
              <div className="admin-edit__selector-row">
                <div className="admin-edit__field-group" style={{flex:1}}>
                  <label className="admin-edit__label">Select Status</label>
                  <select className="admin-edit__input" value={selectedStatusId} onChange={e=>setSelectedStatusId(e.target.value)}>
                    <option value="">-- Select a status --</option>
                    {statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <button type="button" className="btn btn-secondary" onClick={handleAddStatus}>+ Add New Status</button>
              </div>
              {selectedStatus && (
                <div className="admin-edit__editor-card">
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__label">Status Name</label>
                    <input type="text" className="admin-edit__input" value={selectedStatus.name} placeholder="Example: In Progress"
                      onChange={e=>handleStatusNameChange(e.target.value)}
                      onBlur={e=>{ const prev=statuses.find(s=>s.id===selectedStatusId)?.name||""; if(prev!==e.target.value) addNotification(`Status renamed to "${e.target.value}".`,"status"); }}/>
                  </div>
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__label">Display Color</label>
                    <div className="admin-edit__color-row">
                      <input type="color" className="admin-edit__color-swatch" value={selectedStatus.color} onChange={e=>handleStatusColorChange(e.target.value)}/>
                      <input type="text"  className="admin-edit__input"       value={selectedStatus.color} placeholder="#6C757D" onChange={e=>handleStatusColorChange(e.target.value)}/>
                      <span className="admin-edit__color-preview" style={{backgroundColor:selectedStatus.color}}>{selectedStatus.name}</span>
                    </div>
                  </div>
                  <div className="admin-edit__actions-row">
                    <button type="button" className="btn btn-danger" onClick={handleDeleteStatus}>Delete Status</button>
                  </div>
                </div>
              )}
              {!selectedStatus && <p className="admin-edit__empty">Select a status from the dropdown above to edit it</p>}
            </Panel>

            {/* ── Priorities — list UI matching screenshot ── */}
            <Panel title="Priority Levels" subtitle="Add, edit, or delete priority levels">
              {/* Header row with Add button */}
              <div className="admin-edit__priority-header">
                <button type="button" className="btn btn-primary btn-sm" onClick={()=>{ setShowAddPriority(true); setEditingPriorityId(null); setNewPriorityDraft({id:"",name:"",color:"#6C757D",notifyInterval:"1month"}); }}>
                  + Add Priority
                </button>
              </div>

              {/* Add form */}
              {showAddPriority && (
                <div className="admin-edit__priority-form">
                  <div className="admin-edit__priority-form-fields">
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Name</label>
                      <input type="text" className="admin-edit__input" value={newPriorityDraft.name} placeholder="e.g. Critical"
                        onChange={e=>setNewPriorityDraft(d=>({...d,name:e.target.value}))}/>
                    </div>
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Color</label>
                      <div className="admin-edit__color-row">
                        <input type="color" className="admin-edit__color-swatch" value={newPriorityDraft.color} onChange={e=>setNewPriorityDraft(d=>({...d,color:e.target.value}))}/>
                        <input type="text"  className="admin-edit__input"       value={newPriorityDraft.color} onChange={e=>setNewPriorityDraft(d=>({...d,color:e.target.value}))}/>
                        <span className="admin-edit__color-preview" style={{backgroundColor:newPriorityDraft.color}}>{newPriorityDraft.name||"Preview"}</span>
                      </div>
                    </div>
                    <div className="admin-edit__field-group">
                      <label className="admin-edit__label">Notification Interval</label>
                      <div className="admin-edit__notify-timeline">
                        {NOTIFY_INTERVAL_OPTIONS.map(opt=>(
                          <button key={opt.value} type="button"
                            className={`admin-edit__notify-option${newPriorityDraft.notifyInterval===opt.value?" admin-edit__notify-option--active":""}`}
                            onClick={()=>setNewPriorityDraft(d=>({...d,notifyInterval:opt.value}))}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="admin-edit__priority-form-actions">
                    <button type="button" className="btn btn-primary btn-sm"    onClick={handleAddPriority}>Add</button>
                    <button type="button" className="btn btn-secondary btn-sm"  onClick={()=>setShowAddPriority(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Priority list */}
              <div className="admin-edit__priority-list">
                {priorities.map((p) => (
                  <div key={p.id} className="admin-edit__priority-item-wrap">
                    {editingPriorityId===p.id && editPriorityDraft ? (
                      /* Inline edit form */
                      <div className="admin-edit__priority-form">
                        <div className="admin-edit__priority-form-fields">
                          <div className="admin-edit__field-group">
                            <label className="admin-edit__label">Name</label>
                            <input type="text" className="admin-edit__input" value={editPriorityDraft.name}
                              onChange={e=>setEditPriorityDraft(d=>d?{...d,name:e.target.value}:d)}/>
                          </div>
                          <div className="admin-edit__field-group">
                            <label className="admin-edit__label">Color</label>
                            <div className="admin-edit__color-row">
                              <input type="color" className="admin-edit__color-swatch" value={editPriorityDraft.color} onChange={e=>setEditPriorityDraft(d=>d?{...d,color:e.target.value}:d)}/>
                              <input type="text"  className="admin-edit__input"       value={editPriorityDraft.color} onChange={e=>setEditPriorityDraft(d=>d?{...d,color:e.target.value}:d)}/>
                              <span className="admin-edit__color-preview" style={{backgroundColor:editPriorityDraft.color}}>{editPriorityDraft.name}</span>
                            </div>
                          </div>
                          <div className="admin-edit__field-group">
                            <label className="admin-edit__label">Notification Interval</label>
                            <div className="admin-edit__notify-timeline">
                              {NOTIFY_INTERVAL_OPTIONS.map(opt=>(
                                <button key={opt.value} type="button"
                                  className={`admin-edit__notify-option${editPriorityDraft.notifyInterval===opt.value?" admin-edit__notify-option--active":""}`}
                                  onClick={()=>setEditPriorityDraft(d=>d?{...d,notifyInterval:opt.value}:d)}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="admin-edit__priority-form-actions">
                          <button type="button" className="btn btn-primary btn-sm"   onClick={saveEditPriority}>Save</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEditPriority}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      /* List row */
                      <div className="admin-edit__priority-row">
                        <span className="admin-edit__priority-dot" style={{backgroundColor:p.color}}/>
                        <span className="admin-edit__priority-name">{p.name}</span>
                        <span className="admin-edit__priority-interval">{NOTIFY_INTERVAL_LABELS[p.notifyInterval||"1month"]}</span>
                        <div className="admin-edit__priority-row-actions">
                          <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--edit"   onClick={()=>startEditPriority(p)} title="Edit"><IconPencil/></button>
                          <button type="button" className="admin-edit__icon-btn admin-edit__icon-btn--delete" onClick={()=>handleDeletePriority(p)} title="Delete"><IconTrash/></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {priorities.length===0 && <p className="admin-edit__empty">No priorities yet. Click "+ Add Priority" to create one.</p>}
              </div>
            </Panel>

          </div>
        )}
      </main>
    </div>
  );
}