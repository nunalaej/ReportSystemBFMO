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

/* ===============================
   CONSTANTS & CONFIGURATION
=============================== */

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "image/gif",
] as const;

const ALLOWED_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "heic",
  "heif",
  "webp",
  "gif",
] as const;

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const CONCERN_INFO: Record<string, string> = {
  Civil:
    "Environment concerns in campus including paint, cracks, flooring, tiles, bathrooms, walls, ceilings, doors, windows, etc.",
  Electrical:
    "Electric concerns range from minor appliance issues to life-threatening safety hazards. Includes lightbulbs, aircons, switches, circuits, wires, outlets, etc.",
  Mechanical:
    "Issues with physical parts, systems, or machinery that cause inefficient operation, breakdown, or safety risks. Includes elevators, doors, machines, TV, projectors, fans, etc.",
  "Safety Hazard":
    "Physical dangers like slippery floors, uneven walkways, poorly lit areas, overloaded outlets, faulty wiring, improper chemical storage, loose handrails, broken windows, spikes, sharp objects, fire hazards, etc.",
};

interface BuildingMeta {
  id: string;
  name: string;
  floors: number;
  roomsPerFloor: number | number[];
  hasRooms: boolean;
  singleLocationLabel?: string;
}

const FALLBACK_BUILDINGS: BuildingMeta[] = [
  { id: "ayuntamiento", name: "Ayuntamiento", floors: 4, roomsPerFloor: [20,20,20,20], hasRooms: false },
  { id: "jfh",          name: "JFH",          floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "ictc",         name: "ICTC",          floors: 2, roomsPerFloor: [13,13],       hasRooms: true  },
  { id: "pch",          name: "PCH",           floors: 3, roomsPerFloor: [10,10,10],    hasRooms: true  },
  { id: "food-square",  name: "Food Square",   floors: 1, roomsPerFloor: [20],          hasRooms: false },
  { id: "cos",          name: "COS",           floors: 1, roomsPerFloor: [10],          hasRooms: true  },
  { id: "cbaa",         name: "CBAA",          floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "cthm",         name: "CTHM",          floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "gmh",          name: "GMH",           floors: 2, roomsPerFloor: [6,6],         hasRooms: true  },
  { id: "ceat",         name: "CEAT",          floors: 4, roomsPerFloor: [10,10,10,10], hasRooms: true  },
  { id: "other",        name: "Other",         floors: 1, roomsPerFloor: [1],           hasRooms: false },
];

const FALLBACK_CONCERNS: ConcernMeta[] = [
  { id: "electrical",    label: "Electrical",    subconcerns: ["Lights","Aircons","Wires","Outlets","Switches","Other"] },
  { id: "civil",         label: "Civil",         subconcerns: ["Walls","Ceilings","Cracks","Doors","Windows","Other"] },
  { id: "mechanical",    label: "Mechanical",    subconcerns: ["TV","Projectors","Fans","Elevators","Other"] },
  { id: "safety-hazard", label: "Safety Hazard", subconcerns: ["Spikes","Open Wires","Blocked Exits","Wet Floor","Other"] },
  { id: "other",         label: "Other",         subconcerns: ["Other"] },
];

const COLLEGE_OPTIONS: string[] = [
  "CICS","COCS","CTHM","CBAA","CLAC","COED","CEAT","CCJE","Staff",
];

const USER_TYPE_OPTIONS: string[] = ["Student", "Staff/Faculty"];

const FLOOR_ORDINALS = [
  "1st Floor","2nd Floor","3rd Floor","4th Floor",
  "5th Floor","6th Floor","7th Floor","8th Floor",
  "9th Floor","10th Floor",
] as const;

const getFloorLabel = (index: number): string =>
  FLOOR_ORDINALS[index] ?? `${index + 1}th Floor`;

const PROFANITY_PATTERNS: RegExp[] = [
  /potangina/i, /p0t4ng1na/i, /shit/i, /sh\*t/i, /sht/i,
  /fuck/i,      /fck/i,       /f\*ck/i,/bitch/i,  /b1tch/i,
  /ul0l/i,      /gago/i,      /gag0/i, /yawa/i,   /y4wa/i, /pakyu/i,
];

// Status priority — higher number = more meaningful to surface
const STATUS_PRIORITY: Record<string, number> = {
  "Resolved":               4,
  "In Progress":            3,
  "Waiting for Materials":  2,
  "Pending":                1,
};

const STATUS_COLOR: Record<string, string> = {
  "Resolved":               "#16a34a",
  "In Progress":            "#2563eb",
  "Waiting for Materials":  "#d97706",
};

const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
const API_BASE = RAW_BASE.replace(/\/+$/, "");
const META_URL = API_BASE ? `${API_BASE}/api/meta` : "/api/meta";

/* ===============================
   TYPE DEFINITIONS
=============================== */

interface PanelProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

interface ConcernMeta {
  id?: string;
  label: string;
  subconcerns?: string[];
}

interface MetaState {
  buildings: BuildingMeta[];
  concerns: ConcernMeta[];
}

interface FormDataState {
  email: string;
  heading: string;
  description: string;
  concern: string;
  subConcern: string;
  building: string;
  college: string;
  userType: string;
  floor: string;
  room: string;
  ImageFile: File | null;
  otherConcern: string;
  otherBuilding: string;
  otherRoom: string;
}

interface Report {
  _id?: string;
  reportId?: string;
  building?: string;
  concern?: string;
  subConcern?: string;
  otherConcern?: string;
  status?: string;
  room?: string;
  otherRoom?: string;
}

/* ===============================
   UTILITY FUNCTIONS
=============================== */

const isValidImageFile = (file: File): boolean => {
  const mimeValid = ALLOWED_IMAGE_MIME_TYPES.includes(
    file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
  );
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extValid = ALLOWED_IMAGE_EXTENSIONS.includes(
    ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number]
  );
  const sizeValid = file.size <= MAX_IMAGE_SIZE_BYTES;
  return (mimeValid || extValid) && sizeValid;
};

const norm = (v: unknown): string =>
  v == null ? "" : String(v).trim().toLowerCase();

const normalizeLeet = (text: string): string =>
  text.toLowerCase()
    .replace(/0/g,"o").replace(/1/g,"i").replace(/3/g,"e")
    .replace(/4/g,"a").replace(/5/g,"s").replace(/7/g,"t");

const containsProfanity = (text: string | undefined | null): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  const leet  = normalizeLeet(text);
  return PROFANITY_PATTERNS.some((re) => re.test(lower) || re.test(leet));
};

const getSimilarityKey = (r: {
  building?: string; concern?: string; subConcern?: string;
  otherConcern?: string; room?: string; otherRoom?: string;
}): string => {
  const building = (r.building || "").trim();
  const concern  = (r.concern  || "").trim();
  const sub      = (r.subConcern || r.otherConcern || "").trim();
  const room     = r.room && r.room !== "Other"
    ? r.room.trim()
    : (r.otherRoom || "").trim();
  return room
    ? `${building}|${concern}|${sub}|${room}`
    : `${building}|${concern}|${sub}`;
};

function normaliseRoomsPerFloor(
  raw: number | number[] | unknown,
  floors: number
): number[] {
  let arr: number[];
  if (Array.isArray(raw)) {
    arr = (raw as unknown[]).map((v) => {
      const n = parseInt(String(v), 10);
      return Number.isNaN(n) || n < 1 ? 1 : n;
    });
  } else {
    const flat  = parseInt(String(raw), 10);
    const count = Number.isNaN(flat) || flat < 1 ? 1 : flat;
    arr = Array.from({ length: floors }, () => count);
  }
  while (arr.length < floors) arr.push(arr[arr.length - 1] ?? 1);
  return arr.slice(0, floors);
}

function parseBuildingMeta(raw: unknown, idx: number): BuildingMeta {
  if (typeof raw === "string") {
    const name = raw.trim();
    return {
      id: norm(name).replace(/\s+/g, "-") || `b-${idx}`,
      name: name || "Unnamed",
      floors: 1,
      roomsPerFloor: [1],
      hasRooms: true,
    };
  }
  const obj = raw as any;
  const name   = String(obj?.name  || "").trim();
  const id     = String(obj?.id    || "").trim()
    || norm(name).replace(/\s+/g, "-")
    || `b-${idx}-${Math.random().toString(36).slice(2, 6)}`;
  const floors = typeof obj?.floors === "number" && obj.floors > 0
    ? Math.round(obj.floors) : 1;
  return {
    id,
    name: name || "Unnamed",
    floors,
    roomsPerFloor: normaliseRoomsPerFloor(obj?.roomsPerFloor, floors),
    hasRooms: obj?.hasRooms === false ? false : true,
    singleLocationLabel: typeof obj?.singleLocationLabel === "string"
      ? obj.singleLocationLabel.trim() : "",
  };
}

function getRoomsForFloor(
  building: BuildingMeta | null,
  floorLabel: string
): string[] | null {
  if (!building || building.hasRooms === false) return null;
  if (!floorLabel || floorLabel === "Other") return null;

  const match = floorLabel.match(/^(\d+)/);
  if (!match) return null;
  const floorNum = parseInt(match[1], 10);
  const floorIdx = floorNum - 1;

  const arr   = normaliseRoomsPerFloor(building.roomsPerFloor, building.floors);
  const count = arr[floorIdx];
  if (!count || count < 1) return null;

  const base = floorNum * 100;
  return Array.from({ length: count }, (_, i) => String(base + i + 1));
}

/* ===============================
   REUSABLE COMPONENTS
=============================== */

const Panel = memo(({ title, subtitle, actions, children }: PanelProps) => (
  <section className="create-scope__panel">
    <header className="create-scope__panel-head">
      <div>
        {title    && <h3 className="create-scope__panel-title">{title}</h3>}
        {subtitle && <p  className="create-scope__panel-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="create-scope__panel-actions">{actions}</div>}
    </header>
    <div className="create-scope__panel-body">{children}</div>
  </section>
));
Panel.displayName = "Panel";

const InfoTooltip = memo(({ text }: { text: string }) => (
  <div className="tooltip-container">
    <span className="tooltip">{text}</span>
    <span className="text">More Info</span>
  </div>
));
InfoTooltip.displayName = "InfoTooltip";

const RequiredStar = memo(({ value }: { value: unknown }) => {
  const str = value == null ? "" : String(value).trim();
  if (!str) return <span className="create-scope__required-star"> *</span>;
  return null;
});
RequiredStar.displayName = "RequiredStar";

/* ===============================
   CUSTOM HOOKS
=============================== */

const useBodyScrollLock = (lock: boolean) => {
  useLayoutEffect(() => {
    if (lock) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [lock]);
};

const useSidebarState = () => {
  const [sidebarOpen,        setSidebarOpen]        = useState<boolean>(true);
  const [sidebarOverlayOpen, setSidebarOverlayOpen] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem("create_sidebar_open");
    if (saved !== null) setSidebarOpen(saved === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("create_sidebar_open", String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOverlayOpen(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return { sidebarOpen, setSidebarOpen, sidebarOverlayOpen, setSidebarOverlayOpen };
};

/* ===============================
   MAIN COMPONENT
=============================== */

export default function Create() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { theme } = useTheme();
  const light = theme === "light";

  const { sidebarOpen, setSidebarOpen, sidebarOverlayOpen, setSidebarOverlayOpen } =
    useSidebarState();

  const [isConfirming,      setIsConfirming]      = useState<boolean>(false);
  useBodyScrollLock(sidebarOverlayOpen || isConfirming);

  const [formData, setFormData] = useState<FormDataState>({
    email: "", heading: "", description: "",
    concern: "", subConcern: "", building: "",
    college: "", userType: "Student",
    floor: "", room: "",
    ImageFile: null,
    otherConcern: "", otherBuilding: "", otherRoom: "",
  });

  const [preview,           setPreview]           = useState<string | null>(null);
  const [message,           setMessage]           = useState<string>("");
  const [messageType,       setMessageType]       = useState<"success"|"error"|"info"|"">("");
  const [submitting,        setSubmitting]        = useState<boolean>(false);
  const [specificRoom,      setSpecificRoom]      = useState<boolean>(false);
  const [currentUserEmail,  setCurrentUserEmail]  = useState<string>("");
  const [generatedReportId, setGeneratedReportId] = useState<string>("");
  const [existingReports,   setExistingReports]   = useState<Report[]>([]);
  const [hasProfanity,      setHasProfanity]      = useState<boolean>(false);

  const [meta,        setMeta]        = useState<MetaState>({
    buildings: FALLBACK_BUILDINGS,
    concerns:  FALLBACK_CONCERNS,
  });
  const [metaLoading, setMetaLoading] = useState<boolean>(true);
  const [metaError,   setMetaError]   = useState<string>("");

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const emailFromClerk =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses[0]?.emailAddress || "";
    if (emailFromClerk) {
      setCurrentUserEmail(emailFromClerk);
      setFormData((f) => ({ ...f, email: emailFromClerk }));
    }
  }, [isLoaded, user]);

  useEffect(() => {
    let alive = true;
    async function loadMeta() {
      setMetaLoading(true);
      setMetaError("");
      try {
        const res  = await fetch(META_URL, { credentials: "omit" });
        if (!res.ok) throw new Error(`Failed to load options. Status ${res.status}`);
        const data = await res.json() as { buildings?: unknown; concerns?: unknown };
        if (!alive) return;

        const incomingBuildings: BuildingMeta[] =
          Array.isArray(data.buildings) && data.buildings.length
            ? (data.buildings as unknown[]).map(parseBuildingMeta)
            : FALLBACK_BUILDINGS;

        const incomingConcerns: ConcernMeta[] =
          Array.isArray(data.concerns) && data.concerns.length
            ? (data.concerns as ConcernMeta[])
            : FALLBACK_CONCERNS;

        setMeta({ buildings: incomingBuildings, concerns: incomingConcerns });
      } catch (err) {
        console.error("Error loading meta:", err);
        if (!alive) return;
        setMeta({ buildings: FALLBACK_BUILDINGS, concerns: FALLBACK_CONCERNS });
        setMetaError("Could not load latest options. Using defaults.");
      } finally {
        if (alive) setMetaLoading(false);
      }
    }
    loadMeta();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const url = API_BASE ? `${API_BASE}/api/reports` : "/api/reports";
        const res = await fetch(url, { credentials: "omit" });
        if (!res.ok) return;
        const data = await res.json();
        let list: Report[] = [];
        if      (Array.isArray(data))                   list = data as Report[];
        else if (Array.isArray((data as any).reports))  list = (data as any).reports as Report[];
        else if (Array.isArray((data as any).data))     list = (data as any).data as Report[];
        setExistingReports(list);
      } catch (err) {
        console.error("Error fetching reports for similarity:", err);
      }
    };
    fetchReports();
  }, []);

  /* ── Meta-driven building/floor/room state ─────────────────── */

  const selectedBuildingMeta = useMemo((): BuildingMeta | null => {
    if (!formData.building || formData.building === "Other") return null;
    return meta.buildings.find((b) => b.name === formData.building) ?? null;
  }, [meta.buildings, formData.building]);

  const buildingHasRooms = useMemo((): boolean => {
    return selectedBuildingMeta?.hasRooms === true;
  }, [selectedBuildingMeta]);

  const visibleFloorOptions = useMemo((): string[] => {
    if (!selectedBuildingMeta || !buildingHasRooms) return [];
    const count = selectedBuildingMeta.floors ?? 1;
    const opts  = Array.from({ length: count }, (_, i) => getFloorLabel(i));
    opts.push("Other");
    return opts;
  }, [selectedBuildingMeta, buildingHasRooms]);

  const availableRooms = useMemo((): string[] | null => {
    if (!buildingHasRooms || !formData.floor || formData.floor === "Other")
      return null;
    return getRoomsForFloor(selectedBuildingMeta, formData.floor);
  }, [selectedBuildingMeta, buildingHasRooms, formData.floor]);

  const availableRoomsWithOther = useMemo((): string[] | null => {
    if (!availableRooms) return null;
    return [...availableRooms, "Other"];
  }, [availableRooms]);

  const hasRoom = useMemo((): boolean => {
    return Array.isArray(availableRooms) && availableRooms.length > 0;
  }, [availableRooms]);

  /* ── Conditional flags ─────────────────────────────────────── */

  const showSubConcern       = !!formData.concern && formData.concern !== "Other";
  const needsOtherConcern    = formData.concern === "Other";
  const needsOtherSubConcern = formData.subConcern === "Other";
  const needsOtherBuilding   = formData.building === "Other";
  const roomIsOther          = formData.room === "Other";

  const showFloorDropdown =
    specificRoom && buildingHasRooms &&
    !!formData.building && formData.building !== "Other";

  const showRoomDropdown =
    showFloorDropdown &&
    !!formData.floor && formData.floor !== "Other" &&
    hasRoom;

  const needsOtherRoomText =
    specificRoom && buildingHasRooms &&
    !!formData.building && formData.building !== "Other" &&
    (roomIsOther || formData.floor === "Other");

  const needsOtherRoom =
    specificRoom &&
    !!formData.building && formData.building !== "Other" &&
    !buildingHasRooms;

  /* ── Required fields ───────────────────────────────────────── */

  const requiredNow = useMemo((): (keyof FormDataState)[] => {
    const req: (keyof FormDataState)[] = [
      "email","heading","description","concern","building","college","userType",
    ];
    if (showSubConcern)       req.push("subConcern");
    if (needsOtherConcern || needsOtherSubConcern) req.push("otherConcern");
    if (needsOtherBuilding)   req.push("otherBuilding");
    if (showFloorDropdown)    req.push("floor");
    if (showRoomDropdown)     req.push("room");
    if (needsOtherRoomText || needsOtherRoom) req.push("otherRoom");
    if (roomIsOther && showRoomDropdown)      req.push("otherRoom");
    return req;
  }, [
    showSubConcern, needsOtherConcern, needsOtherSubConcern,
    needsOtherBuilding, showFloorDropdown, showRoomDropdown,
    needsOtherRoomText, needsOtherRoom, roomIsOther,
  ]);

  const filledCount = useMemo(
    () => requiredNow.reduce((acc, key) => {
      const val = formData[key];
      return acc + (val && String(val).trim() ? 1 : 0);
    }, 0),
    [requiredNow, formData]
  );

  const progressPct   = useMemo(() => {
    const total = requiredNow.length || 1;
    return Math.round((filledCount / total) * 100);
  }, [filledCount, requiredNow]);

  const readyToSubmit = progressPct === 100;

  /* ── Similarity check — now also captures highest status ───── */

  const similarMatches = useMemo((): Report[] => {
    if (!formData.building || !formData.concern) return [];
    const currentKey = getSimilarityKey({
      building:     formData.building === "Other" ? formData.otherBuilding : formData.building,
      concern:      formData.concern,
      subConcern:   formData.concern === "Other" ? "" : formData.subConcern,
      otherConcern: formData.concern === "Other" ? formData.otherConcern : undefined,
      room:         formData.room    || undefined,
      otherRoom:    formData.room    ? undefined : formData.otherRoom || undefined,
    });
    if (!currentKey.trim()) return [];
    return existingReports.filter((r) => {
      if (norm(r.status || "Pending") === "archived") return false;
      return getSimilarityKey(r) === currentKey;
    });
  }, [existingReports, formData]);

  const similarReportsCount = useMemo(() => similarMatches.length, [similarMatches]);

  /** The highest-priority status among all matching reports. */
  const similarStatus = useMemo((): string | null => {
    if (similarMatches.length === 0) return null;
    const best = similarMatches.reduce((prev, curr) => {
      const prevP = STATUS_PRIORITY[prev.status || "Pending"] ?? 0;
      const currP = STATUS_PRIORITY[curr.status || "Pending"] ?? 0;
      return currP > prevP ? curr : prev;
    });
    return best.status || "Pending";
  }, [similarMatches]);

  /* ── Summary text ──────────────────────────────────────────── */

  const summaryText = useMemo((): string => {
    const parts: string[] = [];
    parts.push(`Title: ${formData.heading || "-"}`);

    let concernDisplay = formData.concern || "-";
    if (formData.concern === "Other" && formData.otherConcern) {
      concernDisplay = `Other: ${formData.otherConcern}`;
    } else if (formData.subConcern) {
      concernDisplay += formData.subConcern === "Other" && formData.otherConcern
        ? ` / Other: ${formData.otherConcern}`
        : ` / ${formData.subConcern}`;
    }
    parts.push(`Concern: ${concernDisplay}`);

    let buildingDisplay = formData.building || "-";
    if (formData.building === "Other" && formData.otherBuilding)
      buildingDisplay = `Other: ${formData.otherBuilding}`;
    parts.push(`Building: ${buildingDisplay}`);
    parts.push(`User Type: ${formData.userType || "-"}`);

    if (specificRoom) {
      if (showFloorDropdown && formData.floor)
        parts.push(`Floor: ${formData.floor}`);
      if (showRoomDropdown || needsOtherRoomText) {
        const roomDisplay = formData.room === "Other" && formData.otherRoom
          ? `Other: ${formData.otherRoom}`
          : formData.room || "-";
        parts.push(`Room: ${roomDisplay}`);
      } else if (needsOtherRoom) {
        parts.push(`Spot: ${formData.otherRoom || "-"}`);
      }
    } else {
      parts.push("Specific room: No");
    }

    if (formData.college) parts.push(`College: ${formData.college}`);
    parts.push(`Photo attached: ${formData.ImageFile ? "Yes" : "No"}`);
    return parts.join("\n");
  }, [formData, specificRoom, showFloorDropdown, showRoomDropdown, needsOtherRoomText, needsOtherRoom]);

  /* ── Concern / building options ────────────────────────────── */

  const buildingOptions = useMemo((): string[] => {
    const list = meta.buildings
      .map((b) => String(b.name || "").trim())
      .filter((name) => name.length > 0);
    const others = list.filter((x) => norm(x) === "other");
    const normal = list.filter((x) => norm(x) !== "other");
    normal.sort((a, b) => a.localeCompare(b));
    return [...normal, ...others];
  }, [meta.buildings]);

  const concernOptions = useMemo((): string[] => {
    const list = meta.concerns
      .map((c) => c.label)
      .filter((label) => label && String(label).trim().length > 0);
    const others = list.filter((x) => norm(x) === "other");
    const normal = list.filter((x) => norm(x) !== "other");
    normal.sort((a, b) => String(a).localeCompare(String(b)));
    return [...normal, ...others];
  }, [meta.concerns]);

  const selectedConcern = useMemo(
    () => meta.concerns.find((c) => c.label === formData.concern) || null,
    [meta.concerns, formData.concern]
  );

  const dynamicSubconcernOptions = useMemo((): string[] => {
    if (!selectedConcern || !Array.isArray(selectedConcern.subconcerns)) return [];
    return selectedConcern.subconcerns;
  }, [selectedConcern]);

  /* ── Profanity check ───────────────────────────────────────── */

  useEffect(() => {
    setHasProfanity([
      formData.heading, formData.description,
      formData.otherConcern, formData.otherBuilding,
      formData.otherRoom, formData.room,
    ].some((t) => containsProfanity(t)));
  }, [formData]);

  /* ── Event handlers ────────────────────────────────────────── */

  const showMsg = useCallback((type: "success"|"error"|"info", text: string) => {
    setMessageType(type);
    setMessage(text);
  }, []);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      const target = e.target as HTMLInputElement;

      if (name === "room" && value === "Other") {
        setFormData((prev) => ({ ...prev, room: "Other", otherRoom: "" }));
        return;
      }

      if (target.files && target.files[0]) {
        const file = target.files[0];
        if (!isValidImageFile(file)) {
          showMsg("error", "Unsupported file type. Please upload an image (JPG, PNG, HEIC, WEBP).");
          target.value = "";
          setFormData((prev) => ({ ...prev, ImageFile: null }));
          setPreview(null);
          return;
        }
        setFormData((prev) => ({ ...prev, ImageFile: file }));
        setPreview(URL.createObjectURL(file));
        return;
      }

      setFormData((prev) => {
        const next = { ...prev, [name]: value } as FormDataState;
        if (name === "concern")  { next.subConcern = ""; next.otherConcern = ""; }
        if (name === "building") { next.otherBuilding = ""; next.floor = ""; next.room = ""; next.otherRoom = ""; }
        if (name === "floor")    { next.room = ""; next.otherRoom = ""; }
        if (name === "room" && value !== "Other") { next.otherRoom = ""; }
        return next;
      });
    },
    [showMsg]
  );

  const onDrop = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("is-dragover");
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
      showMsg("error", "Unsupported file type. Only image files are allowed.");
      return;
    }
    setFormData((prev) => ({ ...prev, ImageFile: file }));
    setPreview(URL.createObjectURL(file));
  }, [showMsg]);

  const onDragOver  = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); e.currentTarget.classList.add("is-dragover");
  }, []);
  const onDragLeave = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); e.currentTarget.classList.remove("is-dragover");
  }, []);

  const performSubmit = useCallback(async () => {
    setSubmitting(true);
    setIsConfirming(false);
    showMsg("info", "Submitting report...");

    try {
      const data = new FormData();
      data.append("email",       formData.email);
      data.append("heading",     formData.heading);
      data.append("description", formData.description);
      data.append("userType",    formData.userType);

      if (formData.concern === "Other") {
        data.append("concern",    formData.concern);
        data.append("subConcern", "");
      } else {
        data.append("concern",    formData.concern);
        data.append("subConcern", formData.subConcern === "Other" ? "Other" : formData.subConcern);
      }

      data.append("building",
        formData.building === "Other"
          ? `Other: ${formData.otherBuilding.trim()}`
          : formData.building
      );
      data.append("college",  formData.college);
      data.append("floor",    formData.floor);
      data.append("room",
        formData.room === "Other"
          ? `Other: ${formData.otherRoom.trim()}`
          : formData.room
      );
      data.append("otherConcern",  formData.otherConcern.trim());
      data.append("otherBuilding", formData.otherBuilding);
      data.append("otherRoom",     formData.otherRoom);

      // Pass the matching status so the backend can inherit it
      if (similarStatus && similarStatus !== "Pending") {
        data.append("inheritedStatus", similarStatus);
      }

      if (formData.ImageFile) data.append("ImageFile", formData.ImageFile);

      const submitUrl = API_BASE ? `${API_BASE}/api/reports` : "/api/reports";
      const res = await fetch(submitUrl, { method: "POST", body: data });
      const raw = await res.text().catch(() => "");

      if (!res.ok) {
        console.error("Submit error status:", res.status, raw);
        showMsg("error", raw || `Submission failed with status ${res.status}`);
        return;
      }

      let result: any = {};
      try { result = raw ? JSON.parse(raw) : {}; } catch {}

      if (result.success) {
        if (result.report && typeof result.report === "object") {
          setExistingReports((prev) => [...prev, result.report as Report]);
          if (result.report.reportId) setGeneratedReportId(result.report.reportId);
        }
        showMsg("success", `Report submitted successfully.`);
        setFormData({
          email: currentUserEmail || "",
          heading: "", description: "",
          concern: "", subConcern: "", building: "",
          college: "", userType: "Student",
          floor: "", room: "", ImageFile: null,
          otherConcern: "", otherBuilding: "", otherRoom: "",
        });
        setPreview(null);
        setSpecificRoom(false);
      } else {
        showMsg("error", result.message || "Submission failed.");
      }
    } catch (err) {
      console.error("Submit error:", err);
      showMsg("error", "Network error while submitting report.");
    } finally {
      setSubmitting(false);
    }
  }, [formData, currentUserEmail, showMsg, similarStatus]);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (formData.ImageFile && !isValidImageFile(formData.ImageFile)) {
        showMsg("error", "Invalid attachment detected. Please upload a valid image file.");
        return;
      }
      if (!formData.ImageFile) {
        showMsg("error", "Please attach an image before submitting.");
        return;
      }
      if (hasProfanity) {
        showMsg("error", "Your report contains foul or inappropriate language. Please remove it before submitting.");
        return;
      }
      if (similarReportsCount > 0) {
        setIsConfirming(true);
        return;
      }
      void performSubmit();
    },
    [formData, hasProfanity, similarReportsCount, showMsg, performSubmit]
  );

  const copySummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      showMsg("success", "Summary copied to clipboard.");
    } catch {
      showMsg("error", "Could not copy summary.");
    }
  }, [summaryText, showMsg]);

  const viewreports = useCallback(() => {
    localStorage.removeItem("currentUser");
    router.push("/Student/ViewReports");
  }, [router]);

  const resetForm = useCallback(() => {
    setFormData({
      email: currentUserEmail || "",
      heading: "", description: "",
      concern: "", subConcern: "", building: "",
      college: "", userType: "Student",
      floor: "", room: "", ImageFile: null,
      otherConcern: "", otherBuilding: "", otherRoom: "",
    });
    setPreview(null);
    setSpecificRoom(false);
    setIsConfirming(false);
    setGeneratedReportId("");
    showMsg("info", "Form cleared.");
  }, [currentUserEmail, showMsg]);

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className={`create-scope ${light ? "create-scope--light" : ""}`}>
      <style>{`
        .tooltip-container {
          --background-light: #ff5555;
          --background-dark: #000000;
          --text-color-light: #ffffff;
          --text-color-dark: #ffffff;
          --bubble-size: 12px;
          --glow-color: rgba(255, 255, 255, 0.5);
          position: relative;
          background: var(--background-light);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          padding: 0.4em 1em;
          color: var(--text-color-light);
          border-radius: 8px;
          display: inline-block;
          margin-left: 8px;
          border: none;
        }
        .tooltip {
          position: absolute;
          bottom: 125%;
          left: 50%;
          transform: translateX(-50%);
          padding: 0.8em 1.2em;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: all 0.3s;
          border-radius: var(--bubble-size);
          background: var(--background-light);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          width: max-content;
          max-width: 300px;
          font-size: 13px;
          line-height: 1.4;
          z-index: 1000;
          white-space: normal;
        }
        .tooltip::before {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-style: solid;
          border-width: 8px 8px 0;
          border-color: var(--background-light) transparent transparent;
        }
        .tooltip-container:hover {
          background: var(--background-dark);
          color: var(--text-color-dark);
          box-shadow: 0 0 20px var(--glow-color);
        }
        .tooltip-container:hover .tooltip {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }
        .concern-label-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .similar-status-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
          margin-left: 4px;
        }
      `}</style>

      <div className={`create-scope__layout ${sidebarOpen ? "" : "is-collapsed"}`}>

        {/* ── Sidebar ─────────────────────────────────────── */}
        <aside
          id="app-sidebar"
          className={`create-scope__sidebar ${sidebarOverlayOpen ? "is-open" : ""}`}
          aria-label="Sidebar"
        >
          <div className="create-scope__sidebar-inner">
            <div className="create-scope__brand">
              <div className="create-scope__brand-badge">
                <img
                  src="https://upload.wikimedia.org/wikipedia/en/8/8c/DLSU-Dasmari%C3%B1as_Seal.png"
                  alt="DLSU-D Logo"
                />
              </div>
              <div className="create-scope__brand-title">BFMO</div>
            </div>

            <Panel title="Quick tips">
              <div className="create-scope__kv">
                <div>Similar reports</div>
                <div>
                  {formData.building && formData.concern
                    ? similarReportsCount === 0
                      ? "None found"
                      : <>
                          {similarReportsCount} similar{" "}
                          {similarReportsCount === 1 ? "report" : "reports"}
                          {similarStatus && similarStatus !== "Pending" && (
                            <span
                              className="similar-status-badge"
                              style={{
                                background: STATUS_COLOR[similarStatus]
                                  ? STATUS_COLOR[similarStatus] + "22"
                                  : "#88888822",
                                color: STATUS_COLOR[similarStatus] ?? "#888",
                                border: `1px solid ${STATUS_COLOR[similarStatus] ?? "#888"}55`,
                              }}
                            >
                              {similarStatus}
                            </span>
                          )}
                        </>
                    : "Set building and concern"}
                </div>
                <div>Attach clear photo</div>
                <div>Required</div>
                <div>Include room number</div>
                <div>If applicable</div>
              </div>
            </Panel>

            <Panel
              title="Summary report"
              subtitle="Auto updates while you type"
              actions={
                <button type="button" className="create-scope__ghost-btn" onClick={copySummary}>
                  Copy
                </button>
              }
            >
              <div className="create-scope__summary">
                <div className="create-scope__progress">
                  <div
                    className="create-scope__progress-bar"
                    style={{ width: `${progressPct}%` }}
                    aria-hidden="true"
                  />
                </div>
                <div className="create-scope__summary-row">
                  <span>Form completeness</span>
                  <strong>{progressPct}%</strong>
                </div>
                <div className="create-scope__summary-row">
                  <span>Ready to submit</span>
                  <strong className={readyToSubmit && !hasProfanity ? "is-ok" : "is-warn"}>
                    {readyToSubmit && !hasProfanity ? "Yes" : "No"}
                  </strong>
                </div>

                {generatedReportId && (
                  <>
                    <hr className="create-scope__summary-rule" />
                    <div className="create-scope__summary-row">
                      <span>Report ID</span>
                      <strong className="is-ok">{generatedReportId}</strong>
                    </div>
                  </>
                )}

                <hr className="create-scope__summary-rule" />

                <div className="create-scope__summary-kv">
                  <div>Title</div>
                  <div>{formData.heading || "-"}</div>
                  <div>Concern</div>
                  <div>
                    {formData.concern || "-"}
                    {formData.concern === "Other" && formData.otherConcern
                      ? `: ${formData.otherConcern}`
                      : formData.subConcern === "Other" && formData.otherConcern
                      ? ` / Other: ${formData.otherConcern}`
                      : formData.subConcern
                      ? ` / ${formData.subConcern}`
                      : ""}
                  </div>
                  <div>Building</div>
                  <div>
                    {formData.building || "-"}
                    {formData.building === "Other" && formData.otherBuilding
                      ? `: ${formData.otherBuilding}` : ""}
                  </div>
                  <div>User Type</div>
                  <div>{formData.userType || "-"}</div>
                  <div>Specific room</div>
                  <div>{specificRoom ? "Yes" : "No"}</div>

                  {specificRoom && showFloorDropdown && (
                    <>
                      <div>Floor</div>
                      <div>{formData.floor || "-"}</div>
                    </>
                  )}

                  {specificRoom && (showRoomDropdown || needsOtherRoomText) && (
                    <>
                      <div>Room</div>
                      <div>
                        {formData.room === "Other" && formData.otherRoom
                          ? `Other: ${formData.otherRoom}`
                          : formData.room || "-"}
                      </div>
                    </>
                  )}

                  {specificRoom && needsOtherRoom && (
                    <>
                      <div>Spot</div>
                      <div>{formData.otherRoom || "-"}</div>
                    </>
                  )}

                  <div>College</div>
                  <div>{formData.college || "-"}</div>
                  <div>Photo</div>
                  <div>{formData.ImageFile ? "Attached" : "None"}</div>
                </div>

                <Panel>
                  <div className="create-scope__preview">
                    {preview
                      ? <img src={preview} alt="Attachment preview" />
                      : <div className="create-scope__preview-empty">No image yet</div>
                    }
                  </div>
                </Panel>
              </div>
            </Panel>
          </div>
        </aside>

        {sidebarOverlayOpen && (
          <div className="create-scope__scrim is-open" onClick={() => setSidebarOverlayOpen(false)} />
        )}

        {/* ── Main form ───────────────────────────────────── */}
        <main className="create-scope__main">
          <header className="create-scope__topbar">
            <div className="create-scope__topbar-left">
              <label className="burger">
                <input
                  type="checkbox"
                  checked={sidebarOverlayOpen}
                  onChange={(e) => setSidebarOverlayOpen(e.target.checked)}
                />
                <span></span><span></span><span></span>
              </label>
            </div>
          </header>

          <Panel
            title="Create a report"
            subtitle="Fill the form and attach a photo if available."
            actions={
              <div className="create-scope__toolbar">
                <button type="button" className="view-reports-btn" onClick={viewreports} title="View Reports">
                  View Reports
                </button>
                <button type="button" className="create-scope__reset-btn" onClick={resetForm}>
                  Reset
                </button>
              </div>
            }
          >
            {message && (
              <div
                className={`create-scope__message ${
                  messageType === "error" ? "is-error"
                  : messageType === "success" ? "is-success"
                  : "is-info"
                }`}
                role="status"
                aria-live="polite"
              >
                {message}
              </div>
            )}

            {metaError && (
              <div className="create-scope__message is-info">{metaError}</div>
            )}

            <form onSubmit={handleSubmit} className="create-scope__form">

              {/* Email */}
              <div className="create-scope__group">
                <label htmlFor="email">Email <RequiredStar value={formData.email} /></label>
                <input
                  id="email" type="email" name="email"
                  placeholder="name@dlsud.edu.ph"
                  value={formData.email} onChange={handleChange}
                  required autoComplete="email"
                  readOnly={Boolean(currentUserEmail)}
                />
              </div>

              {/* Heading & College */}
              <div className="create-scope__row-two">
                <div className="create-scope__group">
                  <label htmlFor="heading">Heading <RequiredStar value={formData.heading} /></label>
                  <input
                    id="heading" type="text" name="heading"
                    placeholder="Short title of the issue"
                    value={formData.heading} onChange={handleChange} required
                  />
                </div>
                <div className="create-scope__group">
                  <label htmlFor="college">College <RequiredStar value={formData.college} /></label>
                  <select id="college" name="college" value={formData.college} onChange={handleChange} required>
                    <option value="">Select college</option>
                    {COLLEGE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* User Type */}
              <div className="create-scope__group">
                <label htmlFor="userType">User Type <RequiredStar value={formData.userType} /></label>
                <select id="userType" name="userType" value={formData.userType} onChange={handleChange} required>
                  {USER_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              {/* Description */}
              <div className="create-scope__group">
                <label htmlFor="description">Description <RequiredStar value={formData.description} /></label>
                <textarea
                  id="description" name="description"
                  placeholder="Describe the issue with details. Include location markers and safety risks."
                  value={formData.description} onChange={handleChange} rows={5} required
                />
                <p className="create-scope__hint">Tip: Add steps to reproduce or time observed.</p>
              </div>

              {/* Concern & SubConcern */}
              <div className="create-scope__row-two">
                <div className="create-scope__group">
                  <div className="concern-label-wrapper">
                    <label htmlFor="concern">Concern <RequiredStar value={formData.concern} /></label>
                    {formData.concern && CONCERN_INFO[formData.concern] && (
                      <InfoTooltip text={CONCERN_INFO[formData.concern]} />
                    )}
                  </div>
                  <select
                    id="concern" name="concern"
                    value={formData.concern} onChange={handleChange}
                    required disabled={metaLoading}
                  >
                    <option value="">{metaLoading ? "Loading concerns..." : "Select concern"}</option>
                    {concernOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {showSubConcern && (
                  <div className="create-scope__group">
                    <label htmlFor="subConcern">Sub concern <RequiredStar value={formData.subConcern} /></label>
                    {formData.subConcern === "Other" ? (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <select
                          id="subConcern" name="subConcern"
                          value={formData.subConcern} onChange={handleChange}
                          required style={{ flex: "0 0 120px" }}
                        >
                          <option value="">Select sub concern</option>
                          {dynamicSubconcernOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input
                          type="text" name="otherConcern"
                          placeholder="Specify sub concern"
                          value={formData.otherConcern}
                          onChange={handleChange} required style={{ flex: "1" }}
                        />
                      </div>
                    ) : (
                      <select
                        id="subConcern" name="subConcern"
                        value={formData.subConcern} onChange={handleChange} required
                      >
                        <option value="">Select sub concern</option>
                        {dynamicSubconcernOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Other Concern */}
              {needsOtherConcern && (
                <div className="create-scope__group">
                  <label htmlFor="otherConcern">Specify concern <RequiredStar value={formData.otherConcern} /></label>
                  <input
                    id="otherConcern" type="text" name="otherConcern"
                    placeholder="Describe your concern"
                    value={formData.otherConcern} onChange={handleChange} required
                  />
                </div>
              )}

              {/* Building & Specific Room Toggle */}
              <div className="create-scope__row-two">
                <div className="create-scope__group">
                  <label htmlFor="building">Building <RequiredStar value={formData.building} /></label>
                  <select
                    id="building" name="building"
                    value={formData.building} onChange={handleChange}
                    required disabled={metaLoading}
                  >
                    <option value="">{metaLoading ? "Loading buildings..." : "Select building"}</option>
                    {buildingOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div className="create-scope__group">
                  <label className="create-scope__switch">
                    <input
                      type="checkbox"
                      checked={specificRoom}
                      onChange={() => {
                        setSpecificRoom((v) => {
                          const nv = !v;
                          if (!nv) setFormData((f) => ({ ...f, floor: "", room: "", otherRoom: "" }));
                          return nv;
                        });
                      }}
                    />
                    <span className="create-scope__slider" />
                    <span className="create-scope__switch-label">
                      Is there a specific location / spot / room?
                    </span>
                  </label>
                </div>
              </div>

              {/* Other Building */}
              {needsOtherBuilding && (
                <div className="create-scope__group">
                  <label htmlFor="otherBuilding">Specify building <RequiredStar value={formData.otherBuilding} /></label>
                  <input
                    id="otherBuilding" type="text" name="otherBuilding"
                    placeholder="Specify the building name"
                    value={formData.otherBuilding} onChange={handleChange} required
                  />
                </div>
              )}

              {/* Floor dropdown */}
              {showFloorDropdown && (
                <div className="create-scope__group">
                  <label htmlFor="floor">Floor <RequiredStar value={formData.floor} /></label>
                  <select id="floor" name="floor" value={formData.floor} onChange={handleChange} required>
                    <option value="">Select floor</option>
                    {visibleFloorOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              )}

              {/* Room dropdown */}
              {showRoomDropdown && (
                <div className="create-scope__group">
                  <label htmlFor="room">Room <RequiredStar value={formData.room} /></label>
                  <select id="room" name="room" value={formData.room} onChange={handleChange} required>
                    <option value="">Select room</option>
                    {availableRoomsWithOther?.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {/* Other room text */}
              {needsOtherRoomText && (
                <div className="create-scope__group">
                  <label htmlFor="otherRoomText">
                    Specify room / spot <RequiredStar value={formData.otherRoom} />
                  </label>
                  <input
                    id="otherRoomText" type="text" name="otherRoom"
                    placeholder="Example: 1st floor near the exit"
                    value={formData.otherRoom} onChange={handleChange} required
                  />
                  <p className="create-scope__hint">Please describe the exact room or location.</p>
                </div>
              )}

              {/* Free-text spot (no-room buildings) */}
              {needsOtherRoom && (
                <div className="create-scope__group">
                  <label htmlFor="otherRoom">
                    Specify room / spot <RequiredStar value={formData.otherRoom} />
                  </label>
                  <input
                    id="otherRoom" type="text" name="otherRoom"
                    placeholder="Example: 1st floor near the exit, Main entrance, Hallway C"
                    value={formData.otherRoom} onChange={handleChange} required
                  />
                  <p className="create-scope__hint">
                    Describe the specific location within{" "}
                    {formData.building === "Other" ? "the building" : formData.building}.
                  </p>
                </div>
              )}

              {/* Image Upload */}
              <div className="create-scope__group">
                <label>Attach an image (Required)</label>
                <label
                  className="create-scope__dropzone"
                  onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
                >
                  <input
                    type="file" name="ImageFile"
                    accept=".jpg,.jpeg,.png,.heic,.heif,.webp,.gif,image/*"
                    onChange={handleChange}
                    required={!formData.ImageFile}
                  />
                  <div className="create-scope__dropzone-inner">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div className="create-scope__hint">PNG, JPG up to 10 MB</div>
                  </div>
                </label>
                {preview && (
                  <img className="create-scope__preview-img" src={preview} alt="Preview" />
                )}
              </div>

              {/* Profanity Warning */}
              {hasProfanity && (
                <p className="create-scope__hint create-scope__hint--error">
                  Profanity or foul words were detected in your text. Please remove them before submitting.
                </p>
              )}

              {/* Submit */}
              <button
                className="create-scope__btn create-scope__btn--primary create-scope__w-full"
                type="submit"
                disabled={submitting || !readyToSubmit || hasProfanity}
              >
                {submitting ? "Submitting..." : "Submit report"}
              </button>
            </form>
          </Panel>
        </main>
      </div>

      {/* ── Confirmation Modal ─────────────────────────────────── */}
      {isConfirming && similarReportsCount > 0 && (
        <div className="confirm-overlay">
          <div className="card">
            <p className="cookieHeading">Similar report exists</p>
            <p className="cookieDescription">
              There {similarReportsCount === 1 ? "is" : "are"}{" "}
              <strong>{similarReportsCount}</strong> similar report
              {similarReportsCount === 1 ? "" : "s"} about the same
              building, room, and concern.

              {similarStatus && similarStatus !== "Pending" && (
                <>
                  <br /><br />
                  The existing report is currently{" "}
                  <strong style={{ color: STATUS_COLOR[similarStatus] ?? "inherit" }}>
                    {similarStatus}
                  </strong>
                  {similarStatus === "Resolved"
                    ? " — this issue may already be fixed."
                    : similarStatus === "In Progress"
                    ? " — staff are already working on it."
                    : similarStatus === "Waiting for Materials"
                    ? " — staff are awaiting materials."
                    : "."}
                  {" "}Submitting a duplicate may be unnecessary.
                </>
              )}

              <br /><br />
              Are you sure you want to submit this report?
            </p>
            <div className="buttonContainer">
              <button
                type="button"
                className="acceptButton"
                onClick={() => void performSubmit()}
              >
                Submit
              </button>
              <button
                type="button"
                className="declineButton"
                onClick={() => {
                  setIsConfirming(false);
                  showMsg("info", "Submission cancelled. You can adjust your report and try again.");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}