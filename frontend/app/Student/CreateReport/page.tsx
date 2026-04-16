"use client";

import "@/app/style/create.css";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useCallback,
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
  memo,
} from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "@/app/ThemeProvider";

/* ── Constants ── */
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg","image/png","image/heic","image/heif","image/webp","image/gif"] as const;
const ALLOWED_IMAGE_EXTENSIONS = ["jpg","jpeg","png","heic","heif","webp","gif"] as const;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const CONCERN_INFO: Record<string, string> = {
  Civil: "Environment concerns including paint, cracks, flooring, tiles, bathrooms, walls, ceilings, doors, windows, etc.",
  Electrical: "Electric concerns from minor appliance issues to safety hazards. Includes lightbulbs, aircons, switches, wires, outlets, etc.",
  Mechanical: "Issues with physical parts or machinery. Includes elevators, doors, TV, projectors, fans, etc.",
  "Safety Hazard": "Physical dangers like slippery floors, overloaded outlets, faulty wiring, loose handrails, broken windows, fire hazards, etc.",
};

interface BuildingMeta { id: string; name: string; floors: number; roomsPerFloor: number | number[]; hasRooms: boolean; singleLocationLabel?: string; }
interface ConcernMeta  { id?: string; label: string; subconcerns?: string[]; }
interface MetaState    { buildings: BuildingMeta[]; concerns: ConcernMeta[]; }
interface FormDataState {
  email: string; heading: string; description: string;
  concern: string; subConcern: string; building: string;
  college: string; year: string; userType: string;
  floor: string; room: string; ImageFile: File | null;
  otherConcern: string; otherBuilding: string; otherRoom: string;
}
interface Report { _id?: string; reportId?: string; building?: string; concern?: string; subConcern?: string; otherConcern?: string; status?: string; room?: string; otherRoom?: string; }

const FALLBACK_BUILDINGS: BuildingMeta[] = [
  { id: "ayuntamiento", name: "Ayuntamiento", floors: 4, roomsPerFloor: [20,20,20,20], hasRooms: false },
  { id: "jfh",          name: "JFH",          floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "ictc",         name: "ICTC",         floors: 2, roomsPerFloor: [13,13],       hasRooms: true  },
  { id: "pch",          name: "PCH",          floors: 3, roomsPerFloor: [10,10,10],    hasRooms: true  },
  { id: "food-square",  name: "Food Square",  floors: 1, roomsPerFloor: [20],          hasRooms: false },
  { id: "cos",          name: "COS",          floors: 1, roomsPerFloor: [10],          hasRooms: true  },
  { id: "cbaa",         name: "CBAA",         floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "cthm",         name: "CTHM",         floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "gmh",          name: "GMH",          floors: 2, roomsPerFloor: [6,6],         hasRooms: true  },
  { id: "ceat",         name: "CEAT",         floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "other",        name: "Other",        floors: 1, roomsPerFloor: [1],           hasRooms: false },
];
const FALLBACK_CONCERNS: ConcernMeta[] = [
  { id: "electrical",    label: "Electrical",    subconcerns: ["Lights","Aircons","Wires","Outlets","Switches","Other"] },
  { id: "civil",         label: "Civil",         subconcerns: ["Walls","Ceilings","Cracks","Doors","Windows","Other"] },
  { id: "mechanical",    label: "Mechanical",    subconcerns: ["TV","Projectors","Fans","Elevators","Other"] },
  { id: "safety-hazard", label: "Safety Hazard", subconcerns: ["Spikes","Open Wires","Blocked Exits","Wet Floor","Other"] },
  { id: "other",         label: "Other",         subconcerns: ["Other"] },
];

const COLLEGE_OPTIONS = ["CICS","COCS","CTHM","CBAA","CLAC","COED","CEAT","CCJE"];
const YEAR_OPTIONS    = ["1st Year","2nd Year","3rd Year","4th Year"];
const FLOOR_ORDINALS  = ["1st Floor","2nd Floor","3rd Floor","4th Floor","5th Floor","6th Floor","7th Floor","8th Floor","9th Floor","10th Floor"];

const STATUS_PRIORITY: Record<string, number> = { "Resolved": 4, "In Progress": 3, "Waiting for Materials": 2, "Pending": 1 };
const STATUS_COLOR: Record<string, string>    = { "Resolved": "#16a34a", "In Progress": "#2563eb", "Waiting for Materials": "#d97706" };

const PROFANITY_PATTERNS: RegExp[] = [
  /potangina/i, /p0t4ng1na/i, /shit/i, /sh\*t/i, /sht/i,
  /fuck/i, /fck/i, /f\*ck/i, /bitch/i, /b1tch/i,
  /ul0l/i, /gago/i, /gag0/i, /yawa/i, /y4wa/i, /pakyu/i,
];

const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
const API_BASE = RAW_BASE.replace(/\/+$/, "");
const META_URL = API_BASE ? `${API_BASE}/api/meta` : "/api/meta";

/* ── Detect student email: xxx0000@dlsud.edu.ph ── */
const isStudentEmail = (email: string): boolean =>
  /^[a-z]{2,4}\d{4}@dlsud\.edu\.ph$/i.test(email.trim());

/* ── Utilities ── */
const isValidImageFile = (file: File): boolean => {
  const mimeValid = ALLOWED_IMAGE_MIME_TYPES.includes(file.type as any);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extValid = ALLOWED_IMAGE_EXTENSIONS.includes(ext as any);
  return (mimeValid || extValid) && file.size <= MAX_IMAGE_SIZE_BYTES;
};
const norm = (v: unknown): string => v == null ? "" : String(v).trim().toLowerCase();
const normalizeLeet = (t: string) => t.toLowerCase().replace(/0/g,"o").replace(/1/g,"i").replace(/3/g,"e").replace(/4/g,"a").replace(/5/g,"s").replace(/7/g,"t");
const containsProfanity = (text?: string | null) => {
  if (!text) return false;
  return PROFANITY_PATTERNS.some(re => re.test(text.toLowerCase()) || re.test(normalizeLeet(text)));
};
const getSimilarityKey = (r: { building?: string; concern?: string; subConcern?: string; otherConcern?: string; room?: string; otherRoom?: string }) => {
  const building = (r.building || "").trim();
  const concern  = (r.concern  || "").trim();
  const sub      = (r.subConcern || r.otherConcern || "").trim();
  const room     = r.room && r.room !== "Other" ? r.room.trim() : (r.otherRoom || "").trim();
  return room ? `${building}|${concern}|${sub}|${room}` : `${building}|${concern}|${sub}`;
};
const getFloorLabel = (i: number) => FLOOR_ORDINALS[i] ?? `${i + 1}th Floor`;

function normaliseRPF(raw: unknown, floors: number): number[] {
  let arr: number[];
  if (Array.isArray(raw)) {
    arr = (raw as unknown[]).map(v => { const n = parseInt(String(v),10); return isNaN(n)||n<1?1:n; });
  } else {
    const flat = parseInt(String(raw),10);
    arr = Array.from({ length: floors }, () => isNaN(flat)||flat<1?1:flat);
  }
  while (arr.length < floors) arr.push(arr[arr.length-1]??1);
  return arr.slice(0, floors);
}

function parseBuildingMeta(raw: unknown, idx: number): BuildingMeta {
  if (typeof raw === "string") {
    const name = raw.trim();
    return { id: norm(name).replace(/\s+/g,"-")||`b-${idx}`, name: name||"Unnamed", floors:1, roomsPerFloor:[1], hasRooms:true };
  }
  const obj = raw as any;
  const name   = String(obj?.name||"").trim();
  const id     = String(obj?.id||"").trim() || norm(name).replace(/\s+/g,"-") || `b-${idx}`;
  const floors = typeof obj?.floors==="number"&&obj.floors>0 ? Math.round(obj.floors) : 1;
  return { id, name: name||"Unnamed", floors, roomsPerFloor: normaliseRPF(obj?.roomsPerFloor, floors), hasRooms: obj?.hasRooms===false?false:true, singleLocationLabel: String(obj?.singleLocationLabel||"").trim() };
}

function getRoomsForFloor(building: BuildingMeta|null, floorLabel: string): string[]|null {
  if (!building||building.hasRooms===false||!floorLabel||floorLabel==="Other") return null;
  const match = floorLabel.match(/^(\d+)/);
  if (!match) return null;
  const floorNum = parseInt(match[1],10);
  const arr   = normaliseRPF(building.roomsPerFloor, building.floors);
  const count = arr[floorNum-1];
  if (!count||count<1) return null;
  return Array.from({ length: count }, (_,i) => String(floorNum*100+i+1));
}

/* ── Components ── */
const RequiredStar = memo(({ value }: { value: unknown }) => {
  const str = value == null ? "" : String(value).trim();
  return str ? null : <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>;
});
RequiredStar.displayName = "RequiredStar";

const FieldGroup = ({ label, hint, children, htmlFor }: { label: ReactNode; hint?: string; children: ReactNode; htmlFor?: string }) => (
  <div className="cf-field">
    <label className="cf-label" htmlFor={htmlFor}>{label}</label>
    {children}
    {hint && <p className="cf-hint">{hint}</p>}
  </div>
);

/* ── Hooks ── */
const useBodyScrollLock = (lock: boolean) => {
  useLayoutEffect(() => {
    document.body.style.overflow = lock ? "hidden" : "";
    document.documentElement.style.overflow = lock ? "hidden" : "";
    return () => { document.body.style.overflow = ""; document.documentElement.style.overflow = ""; };
  }, [lock]);
};

/* ══════════════════════════════════════════════════════════════════════ */
export default function Create() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { theme } = useTheme();
  const light = theme === "light";

  const [isConfirming, setIsConfirming] = useState(false);
  useBodyScrollLock(isConfirming);

  const [formData, setFormData] = useState<FormDataState>({
    email: "", heading: "", description: "",
    concern: "", subConcern: "", building: "",
    college: "", year: "", userType: "Student",
    floor: "", room: "", ImageFile: null,
    otherConcern: "", otherBuilding: "", otherRoom: "",
  });

  const [preview,           setPreview]           = useState<string|null>(null);
  const [message,           setMessage]           = useState("");
  const [messageType,       setMessageType]       = useState<"success"|"error"|"info"|"">("");
  const [submitting,        setSubmitting]        = useState(false);
  const [specificRoom,      setSpecificRoom]      = useState(false);
  const [currentUserEmail,  setCurrentUserEmail]  = useState("");
  const [generatedReportId, setGeneratedReportId] = useState("");
  const [existingReports,   setExistingReports]   = useState<Report[]>([]);
  const [hasProfanity,      setHasProfanity]      = useState(false);
  const [meta,              setMeta]              = useState<MetaState>({ buildings: FALLBACK_BUILDINGS, concerns: FALLBACK_CONCERNS });
  const [metaLoading,       setMetaLoading]       = useState(true);
  const [metaError,         setMetaError]         = useState("");

  useEffect(() => { return () => { if (preview) URL.revokeObjectURL(preview); }; }, [preview]);

  /* ── Auto-fill email + detect student ── */
  useEffect(() => {
    if (!isLoaded || !user) return;
    const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses[0]?.emailAddress || "";
    if (email) {
      setCurrentUserEmail(email);
      const userType = isStudentEmail(email) ? "Student" : "Staff/Faculty";
      setFormData(f => ({ ...f, email, userType }));
    }
  }, [isLoaded, user]);

  /* ── Load meta ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      setMetaLoading(true);
      try {
        const res  = await fetch(META_URL, { credentials: "omit" });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        setMeta({
          buildings: Array.isArray(data.buildings) && data.buildings.length ? data.buildings.map(parseBuildingMeta) : FALLBACK_BUILDINGS,
          concerns:  Array.isArray(data.concerns)  && data.concerns.length  ? data.concerns                         : FALLBACK_CONCERNS,
        });
      } catch {
        if (!alive) return;
        setMeta({ buildings: FALLBACK_BUILDINGS, concerns: FALLBACK_CONCERNS });
        setMetaError("Using default options.");
      } finally { if (alive) setMetaLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  /* ── Load existing reports for similarity ── */
  useEffect(() => {
    (async () => {
      try {
        const url = API_BASE ? `${API_BASE}/api/reports` : "/api/reports";
        const res = await fetch(url, { credentials: "omit" });
        if (!res.ok) return;
        const data = await res.json();
        const list: Report[] = Array.isArray(data) ? data : Array.isArray(data.reports) ? data.reports : Array.isArray(data.data) ? data.data : [];
        setExistingReports(list);
      } catch {}
    })();
  }, []);

  /* ── Derived building state ── */
  const selectedBuildingMeta = useMemo(() =>
    (!formData.building || formData.building === "Other") ? null :
    meta.buildings.find(b => b.name === formData.building) ?? null
  , [meta.buildings, formData.building]);

  const buildingHasRooms = selectedBuildingMeta?.hasRooms === true;

  const visibleFloorOptions = useMemo(() => {
    if (!selectedBuildingMeta || !buildingHasRooms) return [];
    const opts = Array.from({ length: selectedBuildingMeta.floors }, (_,i) => getFloorLabel(i));
    return [...opts, "Other"];
  }, [selectedBuildingMeta, buildingHasRooms]);

  const availableRooms = useMemo(() => {
    if (!buildingHasRooms || !formData.floor || formData.floor === "Other") return null;
    return getRoomsForFloor(selectedBuildingMeta, formData.floor);
  }, [selectedBuildingMeta, buildingHasRooms, formData.floor]);

  const availableRoomsWithOther = availableRooms ? [...availableRooms, "Other"] : null;
  const hasRoom = Array.isArray(availableRooms) && availableRooms.length > 0;

  /* ── Conditional flags ── */
  const showSubConcern       = !!formData.concern && formData.concern !== "Other";
  const needsOtherConcern    = formData.concern === "Other";
  const needsOtherSubConcern = formData.subConcern === "Other";
  const needsOtherBuilding   = formData.building === "Other";
  const roomIsOther          = formData.room === "Other";
  const showFloorDropdown    = specificRoom && buildingHasRooms && !!formData.building && formData.building !== "Other";
  const showRoomDropdown     = showFloorDropdown && !!formData.floor && formData.floor !== "Other" && hasRoom;
  const needsOtherRoomText   = specificRoom && buildingHasRooms && !!formData.building && formData.building !== "Other" && (roomIsOther || formData.floor === "Other");
  const needsOtherRoom       = specificRoom && !!formData.building && formData.building !== "Other" && !buildingHasRooms;

  /* ── isStudent detection ── */
  const isStudent = isStudentEmail(formData.email);

  /* ── Required fields ── */
  const requiredNow = useMemo(() => {
    const req: (keyof FormDataState)[] = ["email","heading","description","concern","building","college","year"];
    if (!isStudent) req.push("userType");
    if (showSubConcern) req.push("subConcern");
    if (needsOtherConcern || needsOtherSubConcern) req.push("otherConcern");
    if (needsOtherBuilding) req.push("otherBuilding");
    if (showFloorDropdown)  req.push("floor");
    if (showRoomDropdown)   req.push("room");
    if (needsOtherRoomText || needsOtherRoom) req.push("otherRoom");
    if (roomIsOther && showRoomDropdown) req.push("otherRoom");
    return req;
  }, [showSubConcern, needsOtherConcern, needsOtherSubConcern, needsOtherBuilding, showFloorDropdown, showRoomDropdown, needsOtherRoomText, needsOtherRoom, roomIsOther, isStudent]);

  const filledCount   = useMemo(() => requiredNow.reduce((a, k) => { const v = formData[k]; return a + (v && String(v).trim() ? 1 : 0); }, 0), [requiredNow, formData]);
  const progressPct   = Math.round((filledCount / (requiredNow.length || 1)) * 100);
  const readyToSubmit = progressPct === 100;

  /* ── Similarity ── */
  const similarMatches = useMemo(() => {
    if (!formData.building || !formData.concern) return [];
    const key = getSimilarityKey({
      building:     formData.building === "Other" ? formData.otherBuilding : formData.building,
      concern:      formData.concern,
      subConcern:   formData.concern === "Other" ? "" : formData.subConcern,
      otherConcern: formData.concern === "Other" ? formData.otherConcern : undefined,
      room:         formData.room || undefined,
      otherRoom:    formData.room ? undefined : formData.otherRoom || undefined,
    });
    if (!key.trim()) return [];
    return existingReports.filter(r => norm(r.status||"Pending") !== "archived" && getSimilarityKey(r) === key);
  }, [existingReports, formData]);

  const similarReportsCount = similarMatches.length;
  const similarStatus = useMemo(() => {
    if (!similarMatches.length) return null;
    return similarMatches.reduce((prev, curr) => (STATUS_PRIORITY[curr.status||"Pending"]??0) > (STATUS_PRIORITY[prev.status||"Pending"]??0) ? curr : prev).status || "Pending";
  }, [similarMatches]);

  /* ── Concern/building options ── */
  const buildingOptions = useMemo(() => {
    const list = meta.buildings.map(b => b.name).filter(Boolean);
    return [...list.filter(x => norm(x) !== "other").sort(), ...list.filter(x => norm(x) === "other")];
  }, [meta.buildings]);

  const concernOptions = useMemo(() => {
    const list = meta.concerns.map(c => c.label).filter(Boolean);
    return [...list.filter(x => norm(x) !== "other").sort(), ...list.filter(x => norm(x) === "other")];
  }, [meta.concerns]);

  const selectedConcern         = meta.concerns.find(c => c.label === formData.concern) || null;
  const dynamicSubconcernOptions = selectedConcern?.subconcerns || [];

  /* ── Profanity ── */
  useEffect(() => {
    setHasProfanity([formData.heading, formData.description, formData.otherConcern, formData.otherBuilding, formData.otherRoom].some(containsProfanity));
  }, [formData]);

  /* ── Handlers ── */
  const showMsg = useCallback((type: "success"|"error"|"info", text: string) => { setMessageType(type); setMessage(text); }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const target = e.target as HTMLInputElement;

    if (name === "room" && value === "Other") { setFormData(p => ({ ...p, room: "Other", otherRoom: "" })); return; }

    if (target.files?.[0]) {
      const file = target.files[0];
      if (!isValidImageFile(file)) { showMsg("error","Unsupported file. Please upload JPG, PNG, HEIC, or WEBP."); target.value = ""; setFormData(p => ({ ...p, ImageFile: null })); setPreview(null); return; }
      setFormData(p => ({ ...p, ImageFile: file }));
      setPreview(URL.createObjectURL(file));
      return;
    }

    setFormData(prev => {
      const next = { ...prev, [name]: value } as FormDataState;
      if (name === "concern")  { next.subConcern = ""; next.otherConcern = ""; }
      if (name === "building") { next.otherBuilding = ""; next.floor = ""; next.room = ""; next.otherRoom = ""; }
      if (name === "floor")    { next.room = ""; next.otherRoom = ""; }
      if (name === "room" && value !== "Other") next.otherRoom = "";
      return next;
    });
  }, [showMsg]);

  const onDrop      = useCallback((e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.currentTarget.classList.remove("is-dragover"); const file = e.dataTransfer.files?.[0]; if (!file||!isValidImageFile(file)) { showMsg("error","Only image files allowed."); return; } setFormData(p => ({...p,ImageFile:file})); setPreview(URL.createObjectURL(file)); }, [showMsg]);
  const onDragOver  = useCallback((e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.currentTarget.classList.add("is-dragover"); }, []);
  const onDragLeave = useCallback((e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.currentTarget.classList.remove("is-dragover"); }, []);

  const resetForm = useCallback(() => {
    setFormData({ email: currentUserEmail||"", heading:"", description:"", concern:"", subConcern:"", building:"", college:"", year:"", userType: isStudentEmail(currentUserEmail)?"Student":"", floor:"", room:"", ImageFile:null, otherConcern:"", otherBuilding:"", otherRoom:"" });
    setPreview(null); setSpecificRoom(false); setIsConfirming(false); setGeneratedReportId(""); showMsg("info","Form cleared.");
  }, [currentUserEmail, showMsg]);

  const performSubmit = useCallback(async () => {
    setSubmitting(true); setIsConfirming(false); showMsg("info","Submitting...");
    try {
      const data = new FormData();
      data.append("email",       formData.email);
      data.append("heading",     formData.heading);
      data.append("description", formData.description);
      data.append("userType",    isStudent ? "Student" : formData.userType);
      data.append("college",     `${formData.college}${formData.year ? ` - ${formData.year}` : ""}`);
      data.append("concern",     formData.concern);
      data.append("subConcern",  formData.subConcern === "Other" ? "Other" : formData.subConcern);
      data.append("building",    formData.building === "Other" ? `Other: ${formData.otherBuilding.trim()}` : formData.building);
      data.append("floor",       formData.floor);
      data.append("room",        formData.room === "Other" ? `Other: ${formData.otherRoom.trim()}` : formData.room);
      data.append("otherConcern",  formData.otherConcern.trim());
      data.append("otherBuilding", formData.otherBuilding);
      data.append("otherRoom",     formData.otherRoom);
      if (similarStatus && similarStatus !== "Pending") data.append("inheritedStatus", similarStatus);
      if (formData.ImageFile) data.append("ImageFile", formData.ImageFile);

      const res  = await fetch(API_BASE ? `${API_BASE}/api/reports` : "/api/reports", { method: "POST", body: data });
      const raw  = await res.text().catch(() => "");
      if (!res.ok) { showMsg("error", raw || `Submission failed (${res.status})`); return; }
      let result: any = {};
      try { result = raw ? JSON.parse(raw) : {}; } catch {}
      if (result.success) {
        if (result.report?.reportId) { setExistingReports(p => [...p, result.report]); setGeneratedReportId(result.report.reportId); }
        showMsg("success", "Report submitted successfully.");
        setFormData({ email: currentUserEmail||"", heading:"", description:"", concern:"", subConcern:"", building:"", college:"", year:"", userType: isStudentEmail(currentUserEmail)?"Student":"", floor:"", room:"", ImageFile:null, otherConcern:"", otherBuilding:"", otherRoom:"" });
        setPreview(null); setSpecificRoom(false);
      } else { showMsg("error", result.message || "Submission failed."); }
    } catch { showMsg("error","Network error."); }
    finally { setSubmitting(false); }
  }, [formData, currentUserEmail, showMsg, similarStatus, isStudent]);

  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (formData.ImageFile && !isValidImageFile(formData.ImageFile)) { showMsg("error","Invalid image file."); return; }
    if (!formData.ImageFile) { showMsg("error","Please attach a photo before submitting."); return; }
    if (hasProfanity) { showMsg("error","Please remove inappropriate language before submitting."); return; }
    if (similarReportsCount > 0) { setIsConfirming(true); return; }
    void performSubmit();
  }, [formData, hasProfanity, similarReportsCount, showMsg, performSubmit]);

  /* ══════════ RENDER ══════════ */
  return (
    <div className={`cf-root ${light ? "cf-root--light" : ""}`}>
      <style>{`
        /* ── Design System ── */
        .cf-root {
          --cf-bg:        #0f1117;
          --cf-surface:   #1a1d27;
          --cf-border:    #2a2d3a;
          --cf-accent:    #3b82f6;
          --cf-accent-2:  #06b6d4;
          --cf-text:      #e2e8f0;
          --cf-muted:     #64748b;
          --cf-error:     #ef4444;
          --cf-success:   #22c55e;
          --cf-warning:   #f59e0b;
          --cf-radius:    10px;
          --cf-radius-sm: 6px;
          min-height: 100vh;
          background: var(--cf-bg);
          color: var(--cf-text);
          font-family: 'DM Sans', 'Outfit', system-ui, sans-serif;
        }
        .cf-root--light {
          --cf-bg:      #f1f5f9;
          --cf-surface: #ffffff;
          --cf-border:  #e2e8f0;
          --cf-text:    #0f172a;
          --cf-muted:   #94a3b8;
        }

        /* ── Layout ── */
        .cf-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          min-height: 100vh;
        }
        @media (max-width: 900px) {
          .cf-layout { grid-template-columns: 1fr; }
          .cf-sidebar { display: none; }
        }

        /* ── Sidebar ── */
        .cf-sidebar {
          background: var(--cf-surface);
          border-right: 1px solid var(--cf-border);
          padding: 28px 20px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .cf-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--cf-border);
        }
        .cf-brand img { width: 38px; height: 38px; border-radius: 8px; }
        .cf-brand-name { font-size: 15px; font-weight: 700; letter-spacing: -0.3px; }
        .cf-brand-sub  { font-size: 11px; color: var(--cf-muted); margin-top: 1px; }

        .cf-sidebar-section { display: flex; flex-direction: column; gap: 8px; }
        .cf-sidebar-title { font-size: 11px; font-weight: 600; color: var(--cf-muted); text-transform: uppercase; letter-spacing: 0.8px; }

        .cf-progress-wrap { display: flex; flex-direction: column; gap: 6px; }
        .cf-progress-bar-bg { height: 6px; background: var(--cf-border); border-radius: 999px; overflow: hidden; }
        .cf-progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--cf-accent), var(--cf-accent-2)); border-radius: 999px; transition: width 0.4s ease; }
        .cf-progress-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--cf-muted); }
        .cf-progress-pct { font-weight: 700; color: var(--cf-accent); }

        .cf-summary-kv { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 12px; }
        .cf-summary-key { color: var(--cf-muted); white-space: nowrap; }
        .cf-summary-val { color: var(--cf-text); word-break: break-word; font-weight: 500; }

        .cf-report-id-box {
          background: color-mix(in srgb, var(--cf-success) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--cf-success) 30%, transparent);
          border-radius: var(--cf-radius-sm);
          padding: 10px 14px;
          font-size: 13px;
        }
        .cf-report-id-label { color: var(--cf-muted); font-size: 11px; margin-bottom: 2px; }
        .cf-report-id-value { font-weight: 700; color: var(--cf-success); font-size: 15px; letter-spacing: 0.5px; }

        .cf-similar-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          margin-left: 6px;
        }

        .cf-preview-img {
          width: 100%;
          border-radius: var(--cf-radius-sm);
          border: 1px solid var(--cf-border);
          object-fit: cover;
          max-height: 140px;
        }
        .cf-preview-empty {
          aspect-ratio: 16/7;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--cf-border);
          border-radius: var(--cf-radius-sm);
          color: var(--cf-muted);
          font-size: 12px;
        }

        /* ── Main ── */
        .cf-main {
          padding: 32px 36px;
          max-width: 820px;
        }
        @media (max-width: 700px) { .cf-main { padding: 20px 16px; } }

        .cf-page-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 28px;
          gap: 16px;
        }
        .cf-page-title    { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
        .cf-page-subtitle { font-size: 13px; color: var(--cf-muted); }
        .cf-head-btns     { display: flex; gap: 8px; flex-shrink: 0; }

        /* ── Buttons ── */
        .cf-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: var(--cf-radius-sm);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
        }
        .cf-btn-primary {
          background: var(--cf-accent);
          color: #fff;
        }
        .cf-btn-primary:hover { background: #2563eb; }
        .cf-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .cf-btn-ghost {
          background: transparent;
          color: var(--cf-muted);
          border: 1px solid var(--cf-border);
        }
        .cf-btn-ghost:hover { color: var(--cf-text); border-color: var(--cf-text); }
        .cf-btn-full { width: 100%; justify-content: center; padding: 13px; font-size: 15px; }

        /* ── Message ── */
        .cf-message {
          padding: 12px 16px;
          border-radius: var(--cf-radius-sm);
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 20px;
          border-left: 3px solid;
        }
        .cf-message-error   { background: color-mix(in srgb, var(--cf-error)   10%, transparent); border-color: var(--cf-error);   color: var(--cf-error); }
        .cf-message-success { background: color-mix(in srgb, var(--cf-success) 10%, transparent); border-color: var(--cf-success); color: var(--cf-success); }
        .cf-message-info    { background: color-mix(in srgb, var(--cf-accent)  10%, transparent); border-color: var(--cf-accent);  color: var(--cf-accent); }

        /* ── Form sections ── */
        .cf-section {
          background: var(--cf-surface);
          border: 1px solid var(--cf-border);
          border-radius: var(--cf-radius);
          padding: 22px;
          margin-bottom: 16px;
        }
        .cf-section-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--cf-muted);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cf-section-title::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--cf-border);
        }

        .cf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 600px) { .cf-grid-2 { grid-template-columns: 1fr; } }

        /* ── Field ── */
        .cf-field { display: flex; flex-direction: column; gap: 5px; }
        .cf-label { font-size: 13px; font-weight: 600; color: var(--cf-text); display: flex; align-items: center; gap: 4px; }

        .cf-input,
        .cf-select,
        .cf-textarea {
          background: var(--cf-bg);
          border: 1px solid var(--cf-border);
          border-radius: var(--cf-radius-sm);
          color: var(--cf-text);
          font-size: 14px;
          padding: 10px 12px;
          width: 100%;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .cf-input:focus, .cf-select:focus, .cf-textarea:focus { border-color: var(--cf-accent); }
        .cf-input[readonly] { opacity: 0.6; cursor: default; }
        .cf-select option { background: var(--cf-surface); }
        .cf-textarea { resize: vertical; min-height: 120px; }
        .cf-hint { font-size: 12px; color: var(--cf-muted); margin-top: 3px; }
        .cf-hint-error { color: var(--cf-error); }

        /* ── User type badge ── */
        .cf-usertype-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: var(--cf-radius-sm);
          font-size: 13px;
          font-weight: 600;
          background: color-mix(in srgb, var(--cf-accent) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--cf-accent) 30%, transparent);
          color: var(--cf-accent);
        }

        /* ── Concern tooltip ── */
        .cf-tooltip-wrap { position: relative; display: inline-block; }
        .cf-tooltip-btn {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid var(--cf-border);
          background: transparent;
          color: var(--cf-muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .cf-tooltip-btn:hover { border-color: var(--cf-accent); color: var(--cf-accent); }
        .cf-tooltip-popup {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          background: var(--cf-surface);
          border: 1px solid var(--cf-border);
          border-radius: var(--cf-radius-sm);
          padding: 10px 14px;
          font-size: 12px;
          line-height: 1.5;
          width: 260px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          z-index: 100;
          color: var(--cf-text);
        }

        /* ── Toggle switch ── */
        .cf-switch { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
        .cf-switch input { display: none; }
        .cf-switch-pill {
          width: 40px; height: 22px;
          background: var(--cf-border);
          border-radius: 999px;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .cf-switch input:checked ~ .cf-switch-pill { background: var(--cf-accent); }
        .cf-switch-knob {
          position: absolute;
          top: 3px; left: 3px;
          width: 16px; height: 16px;
          background: #fff;
          border-radius: 50%;
          transition: transform 0.2s;
        }
        .cf-switch input:checked ~ .cf-switch-pill .cf-switch-knob { transform: translateX(18px); }
        .cf-switch-text { font-size: 13px; color: var(--cf-text); }

        /* ── Dropzone ── */
        .cf-dropzone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 2px dashed var(--cf-border);
          border-radius: var(--cf-radius);
          padding: 32px 20px;
          cursor: pointer;
          transition: all 0.15s;
          text-align: center;
        }
        .cf-dropzone:hover, .cf-dropzone.is-dragover { border-color: var(--cf-accent); background: color-mix(in srgb, var(--cf-accent) 5%, transparent); }
        .cf-dropzone input { display: none; }
        .cf-dropzone-icon { color: var(--cf-muted); }
        .cf-dropzone-text { font-size: 13px; font-weight: 500; color: var(--cf-text); }
        .cf-dropzone-sub  { font-size: 12px; color: var(--cf-muted); }
        .cf-preview-attached { width: 100%; border-radius: var(--cf-radius-sm); object-fit: cover; max-height: 200px; margin-top: 12px; border: 1px solid var(--cf-border); }

        /* ── Sub-concern inline ── */
        .cf-inline-row { display: flex; gap: 8px; }
        .cf-inline-row .cf-select { flex: 0 0 140px; }
        .cf-inline-row .cf-input  { flex: 1; }

        /* ── Confirm modal ── */
        .cf-confirm-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
        }
        .cf-confirm-card {
          background: var(--cf-surface);
          border: 1px solid var(--cf-border);
          border-radius: 14px;
          padding: 28px;
          max-width: 460px;
          width: 100%;
          box-shadow: 0 24px 60px rgba(0,0,0,0.5);
        }
        .cf-confirm-title { font-size: 17px; font-weight: 700; margin-bottom: 10px; }
        .cf-confirm-body  { font-size: 14px; color: var(--cf-muted); line-height: 1.6; margin-bottom: 20px; }
        .cf-confirm-btns  { display: flex; gap: 10px; justify-content: flex-end; }
      `}</style>

      <div className="cf-layout">

        {/* ════ SIDEBAR ════ */}
        <aside className="cf-sidebar">
          <div className="cf-brand">
            <img src="https://upload.wikimedia.org/wikipedia/en/8/8c/DLSU-Dasmari%C3%B1as_Seal.png" alt="DLSU-D" />
            <div>
              <div className="cf-brand-name">BFMO</div>
              <div className="cf-brand-sub">Facility Report System</div>
            </div>
          </div>

          {/* Progress */}
          <div className="cf-sidebar-section">
            <div className="cf-sidebar-title">Form Progress</div>
            <div className="cf-progress-wrap">
              <div className="cf-progress-bar-bg">
                <div className="cf-progress-bar-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="cf-progress-row">
                <span>{filledCount} of {requiredNow.length} fields</span>
                <span className="cf-progress-pct">{progressPct}%</span>
              </div>
            </div>
          </div>

          {/* Report ID */}
          {generatedReportId && (
            <div className="cf-report-id-box">
              <div className="cf-report-id-label">Report Submitted</div>
              <div className="cf-report-id-value">{generatedReportId}</div>
            </div>
          )}

          {/* Similar reports */}
          {formData.building && formData.concern && (
            <div className="cf-sidebar-section">
              <div className="cf-sidebar-title">Similar Reports</div>
              <div style={{ fontSize: 13, color: similarReportsCount > 0 ? "var(--cf-warning)" : "var(--cf-success)" }}>
                {similarReportsCount === 0 ? "✓ No similar reports found" : (
                  <>
                    {similarReportsCount} similar {similarReportsCount === 1 ? "report" : "reports"}
                    {similarStatus && similarStatus !== "Pending" && (
                      <span className="cf-similar-badge" style={{
                        background: (STATUS_COLOR[similarStatus]||"#888") + "22",
                        color: STATUS_COLOR[similarStatus] || "#888",
                        border: `1px solid ${STATUS_COLOR[similarStatus]||"#888"}55`
                      }}>{similarStatus}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="cf-sidebar-section">
            <div className="cf-sidebar-title">Summary</div>
            <div className="cf-summary-kv">
              <span className="cf-summary-key">Subject</span>
              <span className="cf-summary-val">{formData.heading || "—"}</span>
              <span className="cf-summary-key">Concern</span>
              <span className="cf-summary-val">
                {formData.concern || "—"}
                {formData.subConcern && formData.subConcern !== "Other" ? ` / ${formData.subConcern}` : ""}
                {formData.subConcern === "Other" && formData.otherConcern ? ` / ${formData.otherConcern}` : ""}
              </span>
              <span className="cf-summary-key">Building</span>
              <span className="cf-summary-val">
                {formData.building || "—"}
                {formData.building === "Other" && formData.otherBuilding ? `: ${formData.otherBuilding}` : ""}
              </span>
              {formData.college && <>
                <span className="cf-summary-key">College</span>
                <span className="cf-summary-val">{formData.college}{formData.year ? ` · ${formData.year}` : ""}</span>
              </>}
              <span className="cf-summary-key">Photo</span>
              <span className="cf-summary-val">{formData.ImageFile ? "✓ Attached" : "None"}</span>
            </div>
          </div>

          {/* Preview */}
          {preview
            ? <img className="cf-preview-img" src={preview} alt="Preview" />
            : <div className="cf-preview-empty">No image attached</div>
          }
        </aside>

        {/* ════ MAIN ════ */}
        <main className="cf-main">
          <div className="cf-page-head">
            <div>
              <h1 className="cf-page-title">Submit a Report</h1>
              <p className="cf-page-subtitle">Fill in all required fields and attach a photo.</p>
            </div>
            <div className="cf-head-btns">
              <button type="button" className="cf-btn cf-btn-ghost" onClick={() => router.push("/Student/ViewReports")}>
                View Reports
              </button>
              <button type="button" className="cf-btn cf-btn-ghost" onClick={resetForm}>
                Reset
              </button>
            </div>
          </div>

          {message && (
            <div className={`cf-message ${messageType === "error" ? "cf-message-error" : messageType === "success" ? "cf-message-success" : "cf-message-info"}`}>
              {message}
            </div>
          )}
          {metaError && <div className="cf-message cf-message-info">{metaError}</div>}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>

            {/* ── Section: Basic Info ── */}
            <div className="cf-section">
              <div className="cf-section-title">Basic Information</div>

              <FieldGroup label={<>Email <RequiredStar value={formData.email} /></>} htmlFor="email">
                <input id="email" type="email" name="email" className="cf-input"
                  placeholder="name@dlsud.edu.ph"
                  value={formData.email} onChange={handleChange}
                  readOnly={Boolean(currentUserEmail)} required />
              </FieldGroup>

              <div style={{ marginTop: 14 }} />

              <div className="cf-grid-2">
                <FieldGroup label={<>Subject <RequiredStar value={formData.heading} /></>} htmlFor="heading">
                  <input id="heading" type="text" name="heading" className="cf-input"
                    placeholder="Short title of the issue"
                    value={formData.heading} onChange={handleChange} required />
                </FieldGroup>

                {/* User type — auto-detected from email */}
                <FieldGroup label="User Type" htmlFor="userType">
                  {isStudent ? (
                    <div>
                      <div className="cf-usertype-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                        Student
                      </div>
                      <p className="cf-hint" style={{ marginTop: 6 }}>Detected from your email address</p>
                    </div>
                  ) : (
                    <select id="userType" name="userType" className="cf-select"
                      value={formData.userType} onChange={handleChange} required>
                      <option value="">Select type</option>
                      <option value="Student">Student</option>
                      <option value="Staff/Faculty">Staff / Faculty</option>
                    </select>
                  )}
                </FieldGroup>
              </div>

              <div style={{ marginTop: 14 }} />

              {/* College & Year — separate selects, stored together */}
              <div className="cf-grid-2">
                <FieldGroup label={<>College <RequiredStar value={formData.college} /></>} htmlFor="college">
                  <select id="college" name="college" className="cf-select"
                    value={formData.college} onChange={handleChange} required>
                    <option value="">Select college</option>
                    {COLLEGE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FieldGroup>

                <FieldGroup label={<>Year Level <RequiredStar value={formData.year} /></>} htmlFor="year">
                  <select id="year" name="year" className="cf-select"
                    value={formData.year} onChange={handleChange} required>
                    <option value="">Select year</option>
                    {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </FieldGroup>
              </div>
            </div>

            {/* ── Section: Description ── */}
            <div className="cf-section">
              <div className="cf-section-title">Issue Description</div>
              <FieldGroup
                label={<>Description <RequiredStar value={formData.description} /></>}
                htmlFor="description"
                hint="Tip: Include time observed, how long the issue has persisted, and any safety risks."
              >
                <textarea id="description" name="description" className="cf-textarea"
                  placeholder="Describe the problem in detail. Include what happened, where exactly, and any safety concerns."
                  value={formData.description} onChange={handleChange} rows={5} required />
              </FieldGroup>
            </div>

            {/* ── Section: Concern ── */}
            <div className="cf-section">
              <div className="cf-section-title">Concern Type</div>
              <div className="cf-grid-2">
                <FieldGroup label={<>Category <RequiredStar value={formData.concern} /></>} htmlFor="concern">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <select id="concern" name="concern" className="cf-select"
                      value={formData.concern} onChange={handleChange}
                      required disabled={metaLoading} style={{ flex: 1 }}>
                      <option value="">{metaLoading ? "Loading…" : "Select concern"}</option>
                      {concernOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {formData.concern && CONCERN_INFO[formData.concern] && (
                      <ConcernInfoButton text={CONCERN_INFO[formData.concern]} />
                    )}
                  </div>
                </FieldGroup>

                {showSubConcern && (
                  <FieldGroup label={<>Subcategory <RequiredStar value={formData.subConcern} /></>} htmlFor="subConcern">
                    {formData.subConcern === "Other" ? (
                      <div className="cf-inline-row">
                        <select id="subConcern" name="subConcern" className="cf-select"
                          value={formData.subConcern} onChange={handleChange} required>
                          <option value="">Select</option>
                          {dynamicSubconcernOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input type="text" name="otherConcern" className="cf-input"
                          placeholder="Specify…" value={formData.otherConcern}
                          onChange={handleChange} required />
                      </div>
                    ) : (
                      <select id="subConcern" name="subConcern" className="cf-select"
                        value={formData.subConcern} onChange={handleChange} required>
                        <option value="">Select subcategory</option>
                        {dynamicSubconcernOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </FieldGroup>
                )}
              </div>

              {needsOtherConcern && (
                <div style={{ marginTop: 14 }}>
                  <FieldGroup label={<>Specify Concern <RequiredStar value={formData.otherConcern} /></>} htmlFor="otherConcern">
                    <input id="otherConcern" type="text" name="otherConcern" className="cf-input"
                      placeholder="Describe your concern" value={formData.otherConcern}
                      onChange={handleChange} required />
                  </FieldGroup>
                </div>
              )}
            </div>

            {/* ── Section: Location ── */}
            <div className="cf-section">
              <div className="cf-section-title">Location</div>

              <div className="cf-grid-2">
                <FieldGroup label={<>Building <RequiredStar value={formData.building} /></>} htmlFor="building">
                  <select id="building" name="building" className="cf-select"
                    value={formData.building} onChange={handleChange}
                    required disabled={metaLoading}>
                    <option value="">{metaLoading ? "Loading…" : "Select building"}</option>
                    {buildingOptions.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </FieldGroup>

                <FieldGroup label="Specific Location?">
                  <label className="cf-switch">
                    <input type="checkbox" checked={specificRoom}
                      onChange={() => {
                        setSpecificRoom(v => {
                          if (v) setFormData(f => ({ ...f, floor: "", room: "", otherRoom: "" }));
                          return !v;
                        });
                      }} />
                    <span className="cf-switch-pill"><span className="cf-switch-knob" /></span>
                    <span className="cf-switch-text">Specify room or spot</span>
                  </label>
                </FieldGroup>
              </div>

              {needsOtherBuilding && (
                <div style={{ marginTop: 14 }}>
                  <FieldGroup label={<>Specify Building <RequiredStar value={formData.otherBuilding} /></>} htmlFor="otherBuilding">
                    <input id="otherBuilding" type="text" name="otherBuilding" className="cf-input"
                      placeholder="Enter building name" value={formData.otherBuilding}
                      onChange={handleChange} required />
                  </FieldGroup>
                </div>
              )}

              {showFloorDropdown && (
                <div style={{ marginTop: 14 }}>
                  <FieldGroup label={<>Floor <RequiredStar value={formData.floor} /></>} htmlFor="floor">
                    <select id="floor" name="floor" className="cf-select"
                      value={formData.floor} onChange={handleChange} required>
                      <option value="">Select floor</option>
                      {visibleFloorOptions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </FieldGroup>
                </div>
              )}

              {showRoomDropdown && (
                <div style={{ marginTop: 14 }}>
                  <FieldGroup label={<>Room <RequiredStar value={formData.room} /></>} htmlFor="room">
                    <select id="room" name="room" className="cf-select"
                      value={formData.room} onChange={handleChange} required>
                      <option value="">Select room</option>
                      {availableRoomsWithOther?.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </FieldGroup>
                </div>
              )}

              {needsOtherRoomText && (
                <div style={{ marginTop: 14 }}>
                  <FieldGroup
                    label={<>Specify Room / Spot <RequiredStar value={formData.otherRoom} /></>}
                    htmlFor="otherRoomText"
                    hint="Example: 2nd floor near the restroom, end of hallway"
                  >
                    <input id="otherRoomText" type="text" name="otherRoom" className="cf-input"
                      placeholder="Describe the exact location"
                      value={formData.otherRoom} onChange={handleChange} required />
                  </FieldGroup>
                </div>
              )}

              {needsOtherRoom && (
                <div style={{ marginTop: 14 }}>
                  <FieldGroup
                    label={<>Specify Location / Spot <RequiredStar value={formData.otherRoom} /></>}
                    htmlFor="otherRoom"
                    hint={`Describe the specific spot within ${formData.building === "Other" ? "the building" : formData.building}.`}
                  >
                    <input id="otherRoom" type="text" name="otherRoom" className="cf-input"
                      placeholder="e.g. Main entrance, Hallway near Canteen, Ground floor stairwell"
                      value={formData.otherRoom} onChange={handleChange} required />
                  </FieldGroup>
                </div>
              )}
            </div>

            {/* ── Section: Photo ── */}
            <div className="cf-section">
              <div className="cf-section-title">Photo Attachment</div>
              <label className="cf-dropzone" onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
                <input type="file" name="ImageFile" accept=".jpg,.jpeg,.png,.heic,.heif,.webp,.gif,image/*"
                  onChange={handleChange} required={!formData.ImageFile} />
                <svg className="cf-dropzone-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div className="cf-dropzone-text">{formData.ImageFile ? formData.ImageFile.name : "Click to upload or drag & drop"}</div>
                <div className="cf-dropzone-sub">JPG, PNG, HEIC, WEBP — max 10 MB</div>
              </label>
              {preview && <img className="cf-preview-attached" src={preview} alt="Preview" />}
              <p className="cf-hint" style={{ marginTop: 8 }}>If you have multiple photos, combine them into a single image before uploading.</p>
            </div>

            {/* ── Profanity warning ── */}
            {hasProfanity && (
              <div className="cf-message cf-message-error">
                Inappropriate language detected. Please review your text before submitting.
              </div>
            )}

            {/* ── Submit ── */}
            <button type="submit" className="cf-btn cf-btn-primary cf-btn-full"
              disabled={submitting || !readyToSubmit || hasProfanity}>
              {submitting ? (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Submitting…</>
              ) : "Submit Report"}
            </button>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </form>
        </main>
      </div>

      {/* ════ CONFIRM MODAL ════ */}
      {isConfirming && similarReportsCount > 0 && (
        <div className="cf-confirm-overlay">
          <div className="cf-confirm-card">
            <div className="cf-confirm-title">⚠️ Similar Report Exists</div>
            <div className="cf-confirm-body">
              There {similarReportsCount === 1 ? "is" : "are"} <strong>{similarReportsCount}</strong> similar {similarReportsCount === 1 ? "report" : "reports"} for the same building, room, and concern.
              {similarStatus && similarStatus !== "Pending" && (
                <>
                  <br /><br />
                  The existing report is currently <strong style={{ color: STATUS_COLOR[similarStatus] ?? "inherit" }}>{similarStatus}</strong>
                  {similarStatus === "Resolved" ? " — this issue may already be resolved." : similarStatus === "In Progress" ? " — staff are already working on it." : similarStatus === "Waiting for Materials" ? " — staff are awaiting materials." : "."}
                  {" "}Submitting a duplicate may not be necessary.
                </>
              )}
              <br /><br />
              Are you sure you want to proceed?
            </div>
            <div className="cf-confirm-btns">
              <button type="button" className="cf-btn cf-btn-ghost"
                onClick={() => { setIsConfirming(false); showMsg("info","Submission cancelled."); }}>
                Cancel
              </button>
              <button type="button" className="cf-btn cf-btn-primary" onClick={() => void performSubmit()}>
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Concern info popup (inline component) ── */
function ConcernInfoButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="cf-tooltip-btn"
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}>
        Info
      </button>
      {open && <div className="cf-tooltip-popup">{text}</div>}
    </div>
  );
}