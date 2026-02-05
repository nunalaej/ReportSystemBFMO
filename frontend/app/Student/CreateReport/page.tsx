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

const FALLBACK_BUILDINGS: string[] = [
  "Ayuntamiento",
  "JFH",
  "ICTC",
  "PCH",
  "Food Square",
  "COS",
  "CBAA",
  "CTHM",
  "GMH",
  "CEAT",
  "Other",
];

const FALLBACK_CONCERNS: ConcernMeta[] = [
  {
    id: "electrical",
    label: "Electrical",
    subconcerns: ["Lights", "Aircons", "Wires", "Outlets", "Switches", "Other"],
  },
  {
    id: "civil",
    label: "Civil",
    subconcerns: ["Walls", "Ceilings", "Cracks", "Doors", "Windows", "Other"],
  },
  {
    id: "mechanical",
    label: "Mechanical",
    subconcerns: ["TV", "Projectors", "Fans", "Elevators", "Other"],
  },
  {
    id: "safety-hazard",
    label: "Safety Hazard",
    subconcerns: ["Spikes", "Open Wires", "Blocked Exits", "Wet Floor", "Other"],
  },
  {
    id: "other",
    label: "Other",
    subconcerns: ["Other"],
  },
];

const COLLEGE_OPTIONS: string[] = [
  "CICS",
  "COCS",
  "CTHM",
  "CBAA",
  "CLAC",
  "COED",
  "CEAT",
  "CCJE",
  "Staff",
];

const FLOOR_OPTIONS: string[] = [
  "First Floor",
  "Second Floor",
  "Third Floor",
  "Fourth Floor",
  "Other",
];

const BUILDING_ROOM_RANGES: Record<string, string[] | null> = {
  JFH: ["101-109", "201-210", "301-310", "401-405"],
  ICTC: null,
  PCH: ["101-109", "201-210", "301-310", "401-405"],
  Ayuntamiento: null,
  "Food Square": null,
  COS: ["101-110"],
  CBAA: ["101-109", "201-210", "301-310", "401-405"],
  CTHM: ["101-109", "201-210"],
  GMH: ["101-109"],
  CEAT: ["101-109", "201-210", "301-310", "401-405"],
  Other: null,
};

const FLOOR_ROOM_RANGES: Record<string, string[]> = {
  "First Floor": ["101-110"],
  "Second Floor": ["201-213"],
  "Third Floor": ["301-310"],
  "Fourth Floor": ["401-410"],
};

const PROFANITY_PATTERNS: RegExp[] = [
  /potangina/i,
  /p0t4ng1na/i,
  /shit/i,
  /sh\*t/i,
  /sht/i,
  /fuck/i,
  /fck/i,
  /f\*ck/i,
  /bitch/i,
  /b1tch/i,
  /ul0l/i,
  /gago/i,
  /gag0/i,
  /yawa/i,
  /y4wa/i,
  /pakyu/i,
];

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

type BuildingMetaRaw = string | { id?: string; name?: string };

interface MetaState {
  buildings: BuildingMetaRaw[];
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
  floor: string;
  room: string;
  ImageFile: File | null;
  otherConcern: string;
  otherBuilding: string;
  otherRoom: string;
}

interface Report {
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

const normalizeLeet = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t");
};

const containsProfanity = (text: string | undefined | null): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  const leet = normalizeLeet(text);
  return PROFANITY_PATTERNS.some((re) => re.test(lower) || re.test(leet));
};

const deriveFloorFromRoom = (roomValue: unknown): string => {
  if (!roomValue) return "";
  const num = parseInt(String(roomValue), 10);
  if (Number.isNaN(num)) return "";
  const floor = Math.floor(num / 100);
  return floor > 0 ? String(floor) : "";
};

const expandRanges = (ranges: string[] | null): string[] | null => {
  if (!ranges) return null;
  const out: string[] = [];
  for (const r of ranges) {
    const [a, b] = r.split("-").map((x) => parseInt(x, 10));
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      for (let n = a; n <= b; n += 1) out.push(String(n));
    }
  }
  return out;
};

const getSimilarityKey = (r: {
  building?: string;
  concern?: string;
  subConcern?: string;
  otherConcern?: string;
  room?: string;
  otherRoom?: string;
}): string => {
  const building = (r.building || "").trim();
  const concern = (r.concern || "").trim();
  const sub = (r.subConcern || r.otherConcern || "").trim();
  const room =
    r.room && r.room !== "Other" ? r.room.trim() : (r.otherRoom || "").trim();
  return room
    ? `${building}|${concern}|${sub}|${room}`
    : `${building}|${concern}|${sub}`;
};

/* ===============================
   REUSABLE COMPONENTS
=============================== */

const Panel = memo(({ title, subtitle, actions, children }: PanelProps) => (
  <section className="create-scope__panel">
    <header className="create-scope__panel-head">
      <div>
        {title && <h3 className="create-scope__panel-title">{title}</h3>}
        {subtitle && <p className="create-scope__panel-subtitle">{subtitle}</p>}
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
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
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

  // Sidebar state
  const { sidebarOpen, setSidebarOpen, sidebarOverlayOpen, setSidebarOverlayOpen } =
    useSidebarState();

  // Body scroll lock
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  useBodyScrollLock(sidebarOverlayOpen || isConfirming);

  // Form state
  const [formData, setFormData] = useState<FormDataState>({
    email: "",
    heading: "",
    description: "",
    concern: "",
    subConcern: "",
    building: "",
    college: "",
    floor: "",
    room: "",
    ImageFile: null,
    otherConcern: "",
    otherBuilding: "",
    otherRoom: "",
  });

  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info" | "">("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [specificRoom, setSpecificRoom] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  // Data state
  const [existingReports, setExistingReports] = useState<Report[]>([]);
  const [meta, setMeta] = useState<MetaState>({
    buildings: FALLBACK_BUILDINGS,
    concerns: FALLBACK_CONCERNS,
  });
  const [metaLoading, setMetaLoading] = useState<boolean>(true);
  const [metaError, setMetaError] = useState<string>("");

  // Validation state
  const [hasProfanity, setHasProfanity] = useState<boolean>(false);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Set user email from Clerk
  useEffect(() => {
    if (!isLoaded || !user) return;

    const emailFromClerk =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses[0]?.emailAddress ||
      "";

    if (emailFromClerk) {
      setCurrentUserEmail(emailFromClerk);
      setFormData((f) => ({ ...f, email: emailFromClerk }));
    }
  }, [isLoaded, user]);

  // Load metadata
  useEffect(() => {
    let alive = true;

    async function loadMeta() {
      setMetaLoading(true);
      setMetaError("");
      try {
        const res = await fetch(META_URL, { credentials: "omit" });
        if (!res.ok)
          throw new Error(`Failed to load options. Status ${res.status}`);

        const data = (await res.json()) as {
          buildings?: unknown;
          concerns?: unknown;
        };

        if (!alive) return;

        const incomingBuildings: BuildingMetaRaw[] =
          Array.isArray(data.buildings) && data.buildings.length
            ? (data.buildings as BuildingMetaRaw[])
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
    return () => {
      alive = false;
    };
  }, []);

  // Fetch existing reports for similarity check
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const url = API_BASE ? `${API_BASE}/api/reports` : "/api/reports";
        const res = await fetch(url, { credentials: "omit" });
        if (!res.ok) return;

        const data = await res.json();
        let list: Report[] = [];
        if (Array.isArray(data)) list = data as Report[];
        else if (Array.isArray((data as any).reports))
          list = (data as any).reports as Report[];
        else if (Array.isArray((data as any).data))
          list = (data as any).data as Report[];

        setExistingReports(list);
      } catch (err) {
        console.error("Error fetching reports for similarity:", err);
      }
    };
    fetchReports();
  }, []);

  // Memoized options
  const buildingOptions = useMemo(() => {
    const list = (meta.buildings || [])
      .map((b) =>
        typeof b === "string"
          ? b
          : String((b as { name?: string }).name || "").trim()
      )
      .filter((name) => name && name.trim().length > 0);

    const others = list.filter((x) => norm(x) === "other");
    const normal = list.filter((x) => norm(x) !== "other");

    normal.sort((a, b) => a.localeCompare(b));
    return [...normal, ...others];
  }, [meta.buildings]);

  const concernOptions = useMemo(() => {
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

  const dynamicSubconcernOptions = useMemo(() => {
    if (!selectedConcern || !Array.isArray(selectedConcern.subconcerns))
      return [];
    return selectedConcern.subconcerns;
  }, [selectedConcern]);

  // Building-specific logic
  const isIctc = formData.building === "ICTC";
  const isCos = formData.building === "COS";

  const visibleFloorOptions = useMemo(() => {
    if (isIctc) return ["First Floor", "Second Floor", "Other"];
    return FLOOR_OPTIONS;
  }, [isIctc]);

  const allRoomsForBuilding = useMemo(() => {
    if (isIctc) return null;
    return expandRanges(BUILDING_ROOM_RANGES[formData.building] ?? null);
  }, [formData.building, isIctc]);

  const availableRooms = useMemo(() => {
    if (!allRoomsForBuilding) return null;
    if (isCos) return allRoomsForBuilding;
    if (!specificRoom || !formData.floor) return allRoomsForBuilding;

    const floorRanges = FLOOR_ROOM_RANGES[formData.floor];
    if (!floorRanges) return allRoomsForBuilding;

    const floorRooms = expandRanges(floorRanges) || [];
    const setAll = new Set(allRoomsForBuilding);
    return floorRooms.filter((r) => setAll.has(r));
  }, [allRoomsForBuilding, specificRoom, formData.floor, isCos]);

  const availableRoomsWithOther = useMemo(() => {
    if (!availableRooms) return null;
    return [...availableRooms, "Other"];
  }, [availableRooms]);

  const hasRoom = useMemo(() => {
    if (isIctc) return false;
    return Array.isArray(availableRooms) && availableRooms.length > 0;
  }, [availableRooms, isIctc]);

  const ictcSecondFloorRooms = useMemo(() => {
    if (!isIctc || formData.floor !== "Second Floor") return [];
    const rooms: string[] = [];
    for (let n = 201; n <= 213; n += 1) rooms.push(String(n));
    rooms.push("Other");
    return rooms;
  }, [isIctc, formData.floor]);

  // Conditional rendering flags
  const showSubConcern = formData.concern && formData.concern !== "Other";
  const needsOtherConcern = formData.concern === "Other";
  const needsOtherSubConcern = formData.subConcern === "Other";
  const needsOtherBuilding = formData.building === "Other";
  const roomIsOther = formData.room === "Other";
  const needsOtherRoomText = specificRoom && !!formData.building && roomIsOther;
  const needsRoomDropdown = !isIctc && !isCos && specificRoom && hasRoom;
  const needsOtherRoom = !isIctc && specificRoom && !hasRoom && !!formData.building;
  const ictcHasSpecific = isIctc && specificRoom;
  const ictcFirstFloor = ictcHasSpecific && formData.floor === "First Floor";
  const ictcSecondFloor = ictcHasSpecific && formData.floor === "Second Floor";
  const cosHasSpecificRooms = isCos && specificRoom && hasRoom;

  // Required fields calculation
  const requiredNow = useMemo(() => {
    const req: (keyof FormDataState)[] = [
      "email",
      "heading",
      "description",
      "concern",
      "building",
      "college",
    ];
    if (showSubConcern) req.push("subConcern");
    if (needsOtherConcern) req.push("otherConcern");
    if (needsOtherSubConcern) req.push("otherConcern");
    if (needsOtherBuilding) req.push("otherBuilding");
    if (needsRoomDropdown) {
      req.push("floor");
      req.push("room");
      if (roomIsOther) req.push("otherRoom");
    }
    if (needsOtherRoom) req.push("otherRoom");
    if (ictcHasSpecific) req.push("floor");
    if (ictcFirstFloor || ictcSecondFloor) req.push("room");
    if (cosHasSpecificRooms) req.push("room");
    return req;
  }, [
    showSubConcern,
    needsOtherConcern,
    needsOtherSubConcern,
    needsOtherBuilding,
    needsRoomDropdown,
    roomIsOther,
    needsOtherRoom,
    ictcHasSpecific,
    ictcFirstFloor,
    ictcSecondFloor,
    cosHasSpecificRooms,
  ]);

  const filledCount = useMemo(() => {
    return requiredNow.reduce((acc, key) => {
      const val = formData[key];
      return acc + (val && String(val).trim() ? 1 : 0);
    }, 0);
  }, [requiredNow, formData]);

  const progressPct = useMemo(() => {
    const total = requiredNow.length || 1;
    return Math.round((filledCount / total) * 100);
  }, [filledCount, requiredNow]);

  const readyToSubmit = progressPct === 100;

  const roomFloorLabel = useMemo(() => {
    if (!specificRoom || !hasRoom || isIctc || isCos) return "";
    if (formData.floor) return formData.floor;
    if (formData.room) return deriveFloorFromRoom(formData.room);
    return "";
  }, [specificRoom, hasRoom, formData.floor, formData.room, isIctc, isCos]);

  // Similarity check
  const similarReportsCount = useMemo(() => {
    if (!formData.building || !formData.concern) return 0;

    const currentKey = getSimilarityKey({
      building:
        formData.building === "Other"
          ? formData.otherBuilding
          : formData.building,
      concern: formData.concern,
      subConcern: formData.concern === "Other" ? "" : formData.subConcern,
      otherConcern:
        formData.concern === "Other" ? formData.otherConcern : undefined,
      room: formData.room || undefined,
      otherRoom: formData.room ? undefined : formData.otherRoom || undefined,
    });

    if (!currentKey.trim()) return 0;

    return existingReports.filter((r) => {
      const status = norm(r.status || "Pending");
      if (status === "archived") return false;
      const key = getSimilarityKey(r);
      return key === currentKey;
    }).length;
  }, [
    existingReports,
    formData.building,
    formData.concern,
    formData.subConcern,
    formData.otherConcern,
    formData.room,
    formData.otherRoom,
  ]);

  // Summary text
  const summaryText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Title: ${formData.heading || "-"}`);

    let concernDisplay = formData.concern || "-";
    if (formData.concern === "Other" && formData.otherConcern) {
      concernDisplay = `Other: ${formData.otherConcern}`;
    } else if (formData.subConcern) {
      if (formData.subConcern === "Other" && formData.otherConcern) {
        concernDisplay += ` / Other: ${formData.otherConcern}`;
      } else {
        concernDisplay += ` / ${formData.subConcern}`;
      }
    }
    parts.push(`Concern: ${concernDisplay}`);

    let buildingDisplay = formData.building || "-";
    if (formData.building === "Other" && formData.otherBuilding) {
      buildingDisplay = `Other: ${formData.otherBuilding}`;
    }
    parts.push(`Building: ${buildingDisplay}`);

    if (specificRoom) {
      if (isIctc) {
        if (formData.floor) parts.push(`Floor: ${formData.floor}`);
        let roomDisplay = formData.room || "-";
        if (formData.room === "Other" && formData.otherRoom) {
          roomDisplay = `Other: ${formData.otherRoom}`;
        }
        parts.push(`Room: ${roomDisplay}`);
      } else if (isCos) {
        let roomDisplay = formData.room || "-";
        if (formData.room === "Other" && formData.otherRoom) {
          roomDisplay = `Other: ${formData.otherRoom}`;
        }
        parts.push(`Room: ${roomDisplay}`);
      } else if (needsRoomDropdown) {
        const floorLabel = formData.floor || deriveFloorFromRoom(formData.room);
        if (floorLabel) parts.push(`Floor: ${floorLabel}`);
        let roomDisplay = formData.room || "-";
        if (formData.room === "Other" && formData.otherRoom) {
          roomDisplay = `Other: ${formData.otherRoom}`;
        }
        parts.push(`Room: ${roomDisplay}`);
      } else if (needsOtherRoom) {
        parts.push(`Spot: ${formData.otherRoom || "-"}`);
      } else {
        parts.push("Room or spot: -");
      }
    } else {
      parts.push("Specific room: No");
    }

    if (formData.college) parts.push(`College: ${formData.college}`);
    parts.push(`Photo attached: ${formData.ImageFile ? "Yes" : "No"}`);
    return parts.join("\n");
  }, [
    formData,
    specificRoom,
    needsRoomDropdown,
    needsOtherRoom,
    isIctc,
    isCos,
  ]);

  // Profanity check
  useEffect(() => {
    const fieldsToCheck = [
      formData.heading,
      formData.description,
      formData.otherConcern,
      formData.otherBuilding,
      formData.otherRoom,
      formData.room,
    ];
    setHasProfanity(fieldsToCheck.some((t) => containsProfanity(t)));
  }, [formData]);

  // Event handlers
  const showMsg = useCallback(
    (type: "success" | "error" | "info", text: string) => {
      setMessageType(type);
      setMessage(text);
    },
    []
  );

  const handleChange = useCallback(
    (
      e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
      const { name, value } = e.target;
      const target = e.target as HTMLInputElement;

      if (name === "room" && value === "Other") {
        setFormData((prev) => ({ ...prev, room: "Other", otherRoom: "" }));
        return;
      }

      if (target.files && target.files[0]) {
        const file = target.files[0];

        if (!isValidImageFile(file)) {
          showMsg(
            "error",
            "Unsupported file type. Please upload an image (JPG, PNG, HEIC, WEBP)."
          );
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
        const next: FormDataState = { ...prev, [name]: value } as FormDataState;

        if (name === "concern") {
          next.concern = value;
          next.subConcern = "";
          next.otherConcern = "";
        }
        if (name === "building") {
          next.building = value;
          next.otherBuilding = "";
          next.floor = "";
          next.room = "";
          next.otherRoom = "";
        }
        if (name === "floor") {
          next.floor = value;
          next.room = "";
        }
        if (name === "room" && value !== "Other") {
          next.otherRoom = "";
        }

        return next;
      });
    },
    [showMsg]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
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
    },
    [showMsg]
  );

  const onDragOver = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add("is-dragover");
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove("is-dragover");
  }, []);

  const performSubmit = useCallback(async () => {
    setSubmitting(true);
    setIsConfirming(false);
    showMsg("info", "Submitting report...");

    try {
      const data = new FormData();

      data.append("email", formData.email);
      data.append("heading", formData.heading);
      data.append("description", formData.description);

      // Handle "Other" concern properly
      if (formData.concern === "Other") {
        data.append("concern", formData.concern); // "Other"
data.append("subConcern", "");

      } else {
        data.append("concern", formData.concern);
        if (formData.subConcern === "Other") {
data.append("subConcern", "Other");
        } else {
          data.append("subConcern", formData.subConcern);
        }
      }

      // Handle "Other" building properly
      data.append(
        "building",
        formData.building === "Other"
          ? `Other: ${formData.otherBuilding.trim()}`
          : formData.building
      );

      data.append("college", formData.college);
      data.append("floor", formData.floor);

      // Handle "Other" room properly
      data.append(
        "room",
        formData.room === "Other"
          ? `Other: ${formData.otherRoom.trim()}`
          : formData.room
      );

data.append("otherConcern", formData.otherConcern.trim());
      data.append("otherBuilding", formData.otherBuilding);
      data.append("otherRoom", formData.otherRoom);

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
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {}

      if (result.success) {
        if (result.report && typeof result.report === "object") {
          setExistingReports((prev) => [...prev, result.report as Report]);
        }

        showMsg("success", "Report submitted successfully.");
        setFormData({
          email: currentUserEmail || "",
          heading: "",
          description: "",
          concern: "",
          subConcern: "",
          building: "",
          college: "",
          floor: "",
          room: "",
          ImageFile: null,
          otherConcern: "",
          otherBuilding: "",
          otherRoom: "",
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
  }, [formData, currentUserEmail, showMsg]);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (formData.ImageFile && !isValidImageFile(formData.ImageFile)) {
        showMsg(
          "error",
          "Invalid attachment detected. Please upload a valid image file."
        );
        return;
      }

      if (!formData.ImageFile) {
        showMsg("error", "Please attach an image before submitting.");
        return;
      }

      if (hasProfanity) {
        showMsg(
          "error",
          "Your report contains foul or inappropriate language. Please remove it before submitting."
        );
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
      heading: "",
      description: "",
      concern: "",
      subConcern: "",
      building: "",
      college: "",
      floor: "",
      room: "",
      ImageFile: null,
      otherConcern: "",
      otherBuilding: "",
      otherRoom: "",
    });
    setPreview(null);
    setSpecificRoom(false);
    setIsConfirming(false);
    showMsg("info", "Form cleared.");
  }, [currentUserEmail, showMsg]);

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
      `}</style>

      <div
        className={`create-scope__layout ${sidebarOpen ? "" : "is-collapsed"}`}
      >
        <aside
          id="app-sidebar"
          className={`create-scope__sidebar ${
            sidebarOverlayOpen ? "is-open" : ""
          }`}
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
                    ? `${similarReportsCount} similar ${
                        similarReportsCount === 1 ? "report" : "reports"
                      }`
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
                <button
                  type="button"
                  className="create-scope__ghost-btn"
                  onClick={copySummary}
                >
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
                  <strong
                    className={
                      readyToSubmit && !hasProfanity ? "is-ok" : "is-warn"
                    }
                  >
                    {readyToSubmit && !hasProfanity ? "Yes" : "No"}
                  </strong>
                </div>

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
                      ? `: ${formData.otherBuilding}`
                      : ""}
                  </div>
                  <div>Specific room</div>
                  <div>{specificRoom ? "Yes" : "No"}</div>

                  {specificRoom && formData.building === "ICTC" && (
                    <>
                      <div>Floor</div>
                      <div>{formData.floor || "-"}</div>
                      <div>Room</div>
                      <div>
                        {formData.room === "Other" && formData.otherRoom
                          ? `Other: ${formData.otherRoom}`
                          : formData.room || "-"}
                      </div>
                    </>
                  )}

                  {specificRoom && isCos && hasRoom && (
                    <>
                      <div>Room</div>
                      <div>
                        {formData.room === "Other" && formData.otherRoom
                          ? `Other: ${formData.otherRoom}`
                          : formData.room || "-"}
                      </div>
                    </>
                  )}

                  {specificRoom &&
                    formData.building !== "ICTC" &&
                    !isCos &&
                    hasRoom && (
                      <>
                        <div>Floor</div>
                        <div>{roomFloorLabel || "-"}</div>
                        <div>Room</div>
                        <div>
                          {formData.room === "Other" && formData.otherRoom
                            ? `Other: ${formData.otherRoom}`
                            : formData.room || "-"}
                        </div>
                      </>
                    )}

                  {specificRoom &&
                    formData.building !== "ICTC" &&
                    !hasRoom &&
                    !!formData.building && (
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
                    {preview ? (
                      <img src={preview} alt="Attachment preview" />
                    ) : (
                      <div className="create-scope__preview-empty">
                        No image yet
                      </div>
                    )}
                  </div>
                </Panel>
              </div>
            </Panel>
          </div>
        </aside>

        {sidebarOverlayOpen && (
          <div
            className="create-scope__scrim is-open"
            onClick={() => setSidebarOverlayOpen(false)}
          />
        )}

        <main className="create-scope__main">
          <header className="create-scope__topbar">
            <div className="create-scope__topbar-left">
              <label className="burger">
                <input
                  type="checkbox"
                  checked={sidebarOverlayOpen}
                  onChange={(e) => setSidebarOverlayOpen(e.target.checked)}
                />
                <span></span>
                <span></span>
                <span></span>
              </label>
            </div>
          </header>

          <Panel
            title="Create a report"
            subtitle="Fill the form and attach a photo if available."
            actions={
              <div className="create-scope__toolbar">
                <button
                  type="button"
                  className="view-reports-btn"
                  onClick={viewreports}
                  title="View Reports"
                >
                  View Reports
                </button>
                <button
                  type="button"
                  className="create-scope__reset-btn"
                  onClick={resetForm}
                >
                  Reset
                </button>
              </div>
            }
          >
            {message && (
              <div
                className={`create-scope__message ${
                  messageType === "error"
                    ? "is-error"
                    : messageType === "success"
                      ? "is-success"
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
              {/* Email Field */}
              <div className="create-scope__group">
                <label htmlFor="email">
                  Email
                  <RequiredStar value={formData.email} />
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="name@dlsud.edu.ph"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  readOnly={Boolean(currentUserEmail)}
                />
                <p className="create-scope__hint">
                  {currentUserEmail
                    ? "This email came from your login."
                    : "We may contact you using this email for follow up."}
                </p>
              </div>

              {/* Heading & College Row */}
              <div className="create-scope__row-two">
                <div className="create-scope__group">
                  <label htmlFor="heading">
                    Heading
                    <RequiredStar value={formData.heading} />
                  </label>
                  <input
                    id="heading"
                    type="text"
                    name="heading"
                    placeholder="Short title of the issue"
                    value={formData.heading}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="create-scope__group">
                  <label htmlFor="college">
                    College
                    <RequiredStar value={formData.college} />
                  </label>
                  <select
                    id="college"
                    name="college"
                    value={formData.college}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select college</option>
                    {COLLEGE_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="create-scope__group">
                <label htmlFor="description">
                  Description
                  <RequiredStar value={formData.description} />
                </label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Describe the issue with details. Include location markers and safety risks."
                  value={formData.description}
                  onChange={handleChange}
                  rows={5}
                  required
                />
                <p className="create-scope__hint">
                  Tip: Add steps to reproduce or time observed.
                </p>
              </div>

              {/* Concern & SubConcern Row */}
              <div className="create-scope__row-two">
                <div className="create-scope__group">
                  <div className="concern-label-wrapper">
                    <label htmlFor="concern">
                      Concern
                      <RequiredStar value={formData.concern} />
                    </label>
                    {formData.concern && CONCERN_INFO[formData.concern] && (
                      <InfoTooltip text={CONCERN_INFO[formData.concern]} />
                    )}
                  </div>
                  <select
                    id="concern"
                    name="concern"
                    value={formData.concern}
                    onChange={handleChange}
                    required
                    disabled={metaLoading}
                  >
                    <option value="">
                      {metaLoading ? "Loading concerns..." : "Select concern"}
                    </option>
                    {concernOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {showSubConcern && (
                  <div className="create-scope__group">
                    <label htmlFor="subConcern">
                      Sub concern
                      <RequiredStar value={formData.subConcern} />
                    </label>
                    {formData.subConcern === "Other" ? (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <select
                          id="subConcern"
                          name="subConcern"
                          value={formData.subConcern}
                          onChange={handleChange}
                          required
                          style={{ flex: "0 0 120px" }}
                        >
                          <option value="">Select sub concern</option>
                          {dynamicSubconcernOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          name="otherConcern"
                          placeholder="Specify sub concern"
                          value={formData.otherConcern}
                          onChange={handleChange}
                          required
                          style={{ flex: "1" }}
                        />
                      </div>
                    ) : (
                      <select
                        id="subConcern"
                        name="subConcern"
                        value={formData.subConcern}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select sub concern</option>
                        {dynamicSubconcernOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Other Concern Input */}
              {needsOtherConcern && (
                <div className="create-scope__group">
                  <label htmlFor="otherConcern">
                    Specify concern
                    <RequiredStar value={formData.otherConcern} />
                  </label>
                  <input
                    id="otherConcern"
                    type="text"
                    name="otherConcern"
                    placeholder="Describe your concern"
                    value={formData.otherConcern}
                    onChange={handleChange}
                    required
                  />
                </div>
              )}

              {/* Building & Specific Room Toggle Row */}
              <div className="create-scope__row-two">
                <div className="create-scope__group">
                  <label htmlFor="building">
                    Building
                    <RequiredStar value={formData.building} />
                  </label>
                  <select
                    id="building"
                    name="building"
                    value={formData.building}
                    onChange={handleChange}
                    required
                    disabled={metaLoading}
                  >
                    <option value="">
                      {metaLoading ? "Loading buildings..." : "Select building"}
                    </option>
                    {buildingOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
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
                          if (!nv) {
                            setFormData((f) => ({
                              ...f,
                              floor: "",
                              room: "",
                              otherRoom: "",
                            }));
                          }
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

              {/* Other Building Input */}
              {needsOtherBuilding && (
                <div className="create-scope__group">
                  <label htmlFor="otherBuilding">
                    Specify building
                    <RequiredStar value={formData.otherBuilding} />
                  </label>
                  <input
                    id="otherBuilding"
                    type="text"
                    name="otherBuilding"
                    placeholder="Specify the building name"
                    value={formData.otherBuilding}
                    onChange={handleChange}
                    required
                  />
                </div>
              )}

              {/* ====== FIX: Room/spot input for buildings without dropdown ====== */}
              {specificRoom &&
                formData.building !== "ICTC" &&
                !isCos &&
                !hasRoom &&
                !!formData.building && (
                  <div className="create-scope__group">
                    <label htmlFor="otherRoom">
                      Specify room / spot
                      <RequiredStar value={formData.otherRoom} />
                    </label>
                    <input
                      id="otherRoom"
                      type="text"
                      name="otherRoom"
                      placeholder="Example: 1st floor near the exit, Main entrance, Hallway C"
                      value={formData.otherRoom}
                      onChange={handleChange}
                      required
                    />
                    <p className="create-scope__hint">
                      Describe the specific location within{" "}
                      {formData.building === "Other"
                        ? "the building"
                        : formData.building}
                      .
                    </p>
                  </div>
                )}

              {/* ICTC-specific room logic */}
              {ictcHasSpecific && (
                <>
                  <div className="create-scope__group">
                    <label htmlFor="floor">
                      Floor
                      <RequiredStar value={formData.floor} />
                    </label>
                    <select
                      id="floor"
                      name="floor"
                      value={formData.floor}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select floor</option>
                      {visibleFloorOptions.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  {ictcFirstFloor && (
                    <div className="create-scope__group">
                      <label htmlFor="room">
                        Room
                        <RequiredStar value={formData.room} />
                      </label>
                      <input
                        id="room"
                        type="text"
                        name="room"
                        placeholder="Enter room on 1st floor (e.g. 101, Lab, Lobby)"
                        value={formData.room}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  )}

                  {ictcSecondFloor && (
                    <div className="create-scope__group">
                      <label htmlFor="room">
                        Room
                        <RequiredStar value={formData.room} />
                      </label>
                      <select
                        id="room"
                        name="room"
                        value={formData.room}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select room</option>
                        {ictcSecondFloorRooms.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.floor === "Other" && (
                    <div className="create-scope__group">
                      <label htmlFor="room">
                        Room or area
                        <RequiredStar value={formData.room} />
                      </label>
                      <input
                        id="room"
                        type="text"
                        name="room"
                        placeholder="Enter room or specific area"
                        value={formData.room}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  )}
                </>
              )}

              {/* COS room dropdown */}
              {cosHasSpecificRooms && (
                <div className="create-scope__group">
                  <label htmlFor="room">
                    Room
                    <RequiredStar value={formData.room} />
                  </label>
                  <select
                    id="room"
                    name="room"
                    value={formData.room}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select room</option>
                    {availableRoomsWithOther?.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Other buildings with room dropdown */}
              {needsRoomDropdown && (
                <>
                  <div className="create-scope__group">
                    <label htmlFor="floor">
                      Floor
                      <RequiredStar value={formData.floor} />
                    </label>
                    <select
                      id="floor"
                      name="floor"
                      value={formData.floor}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select floor</option>
                      {visibleFloorOptions.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="create-scope__group">
                    <label htmlFor="room">
                      Room
                      <RequiredStar value={formData.room} />
                    </label>
                    <select
                      id="room"
                      name="room"
                      value={formData.room}
                      onChange={handleChange}
                      required
                      disabled={!formData.floor}
                    >
                      <option value="">
                        {formData.floor ? "Select room" : "Select floor first"}
                      </option>
                      {formData.floor &&
                        availableRoomsWithOther?.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              {/* When room dropdown shows "Other" */}
              {needsOtherRoomText && (
                <div className="create-scope__group">
                  <label htmlFor="otherRoomText">
                    Specify room / spot
                    <RequiredStar value={formData.otherRoom} />
                  </label>
                  <input
                    id="otherRoomText"
                    type="text"
                    name="otherRoom"
                    placeholder="Example: 1st floor near the exit"
                    value={formData.otherRoom}
                    onChange={handleChange}
                    required
                  />
                  <p className="create-scope__hint">
                    Please describe the exact room or location.
                  </p>
                </div>
              )}

              {/* Image Upload */}
              <div className="create-scope__group">
                <label>Attach an image (Required)</label>
                <label
                  className="create-scope__dropzone"
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                >
                  <input
                    type="file"
                    name="ImageFile"
                    accept=".jpg,.jpeg,.png,.heic,.heif,.webp,.gif,image/*"
                    onChange={handleChange}
                    required={!formData.ImageFile}
                  />
                  <div className="create-scope__dropzone-inner">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="create-scope__hint">PNG, JPG up to 10 MB</div>
                  </div>
                </label>
                {preview && (
                  <img
                    className="create-scope__preview-img"
                    src={preview}
                    alt="Preview"
                  />
                )}
              </div>

              {/* Profanity Warning */}
              {hasProfanity && (
                <p className="create-scope__hint create-scope__hint--error">
                  Profanity or foul words were detected in your text. Please remove
                  them before submitting.
                </p>
              )}

              {/* Submit Button */}
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

      {/* Confirmation Modal */}
      {isConfirming && similarReportsCount > 0 && (
        <div className="confirm-overlay">
          <div className="card">
            <p className="cookieHeading">Are you sure?</p>
            <p className="cookieDescription">
              There&apos;s {similarReportsCount} similar report
              {similarReportsCount === 1 ? "" : "s"} about the same building, room,
              and concern.
              <br />
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
                  showMsg(
                    "info",
                    "Submission cancelled. You can adjust your report and try again."
                  );
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