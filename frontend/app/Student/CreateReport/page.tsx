"use client";

import "@/app/style/create.css";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "@/app/ThemeProvider";

/* Types */
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

/* Reusable Panel */
function Panel({ title, subtitle, actions, children }: PanelProps) {
  return (
    <section className="create-scope__panel">
      <header className="create-scope__panel-head">
        <div>
          {title && <h3 className="create-scope__panel-title">{title}</h3>}
          {subtitle && (
            <p className="create-scope__panel-subtitle">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="create-scope__panel-actions">{actions}</div>
        )}
      </header>
      <div className="create-scope__panel-body">{children}</div>
    </section>
  );
}

const norm = (v: unknown): string =>
  v == null ? "" : String(v).trim().toLowerCase();

const deriveFloorFromRoom = (roomValue: unknown): string => {
  if (!roomValue) return "";
  const num = parseInt(String(roomValue), 10);
  if (Number.isNaN(num)) return "";
  const floor = Math.floor(num / 100);
  return floor > 0 ? String(floor) : "";
};

const requiredStar = (value: unknown): ReactNode => {
  const str = value == null ? "" : String(value).trim();
  if (!str) return <span className="create-scope__required-star"> *</span>;
  return null;
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
    subconcerns: [
      "Spikes",
      "Open Wires",
      "Blocked Exits",
      "Wet Floor",
      "Other",
    ],
  },
  {
    id: "other",
    label: "Other",
    subconcerns: ["Other"],
  },
];

const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
const API_BASE = RAW_BASE.replace(/\/+$/, "");
const META_URL = API_BASE ? `${API_BASE}/api/meta` : "/api/meta";

const collegeOptions: string[] = [
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

/* Profanity detection */
const profanityPatterns: RegExp[] = [
  /potangina/i,
  /p0t4ng1na/i,
  /shit/i,
  /sh\*t/i,
  /sht/i,
  /fuck/i,
  /fck/i,
  /f\*ck/i,
  /gago/i,
  /gag0/i,
  /yawa/i,
  /y4wa/i,
  /pakyu/i,
];

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
  return profanityPatterns.some((re) => re.test(lower) || re.test(leet));
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
  const room = (r.room || r.otherRoom || "").trim();
  return room ? `${building}|${concern}|${sub}|${room}` : `${building}|${concern}|${sub}`;
};

export default function Create() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { theme } = useTheme();
  const light = theme === "light";

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
  const [messageType, setMessageType] = useState<
    "success" | "error" | "info" | ""
  >("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [hasRoom, setHasRoom] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [sidebarOverlayOpen, setSidebarOverlayOpen] = useState<boolean>(false);

  const [specificRoom, setSpecificRoom] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  const [existingReports, setExistingReports] = useState<Report[]>([]);

  const [meta, setMeta] = useState<MetaState>({
    buildings: FALLBACK_BUILDINGS,
    concerns: FALLBACK_CONCERNS,
  });
  const [metaLoading, setMetaLoading] = useState<boolean>(true);
  const [metaError, setMetaError] = useState<string>("");

  const [hasProfanity, setHasProfanity] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  // ✅ IMPORTANT FIX:
  // Run before paint to avoid initial "stuck no scroll" on first visit.
  // Lock scroll only when overlay/modal is open; otherwise always unlock.
  useLayoutEffect(() => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";

    const shouldLock = sidebarOverlayOpen || isConfirming;
    if (shouldLock) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [sidebarOverlayOpen, isConfirming]);

  // ✅ Recommended: close overlay automatically on desktop widths
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOverlayOpen(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // remember sidebar collapse state on desktop
  useEffect(() => {
    const saved = localStorage.getItem("create_sidebar_open");
    if (saved !== null) setSidebarOpen(saved === "true");
  }, []);
  useEffect(() => {
    localStorage.setItem("create_sidebar_open", String(sidebarOpen));
  }, [sidebarOpen]);

  // cleanup preview URL
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Load email from Clerk user and prefill
  useEffect(() => {
    if (!isLoaded || !user) return;

    const emailFromClerk =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses[0]?.emailAddress ||
      "";

    if (emailFromClerk) {
      setCurrentUserEmail(emailFromClerk);
      setFormData((f) => ({
        ...f,
        email: emailFromClerk,
      }));
    }
  }, [isLoaded, user]);

  // fetch meta buildings and concerns
  useEffect(() => {
    let alive = true;

    async function loadMeta() {
      setMetaLoading(true);
      setMetaError("");
      try {
        const res = await fetch(META_URL, { credentials: "omit" });
        if (!res.ok) throw new Error(`Failed to load options. Status ${res.status}`);

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

  // fetch existing reports for similarity count
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const url = API_BASE ? `${API_BASE}/api/reports` : "/api/reports";
        const res = await fetch(url, { credentials: "omit" });
        if (!res.ok) {
          const raw = await res.text().catch(() => "");
          console.error("Reports fetch failed:", res.status, raw);
          return;
        }

        const data = await res.json();

        let list: Report[] = [];
        if (Array.isArray(data)) list = data as Report[];
        else if (Array.isArray((data as any).reports)) list = (data as any).reports as Report[];
        else if (Array.isArray((data as any).data)) list = (data as any).data as Report[];
        else console.warn("Unexpected reports payload shape:", data);

        setExistingReports(list);
      } catch (err) {
        console.error("Error fetching reports for similarity:", err);
      }
    };
    fetchReports();
  }, []);

  // dynamic options from meta: always convert to building names
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
    if (!selectedConcern || !Array.isArray(selectedConcern.subconcerns)) return [];
    return selectedConcern.subconcerns;
  }, [selectedConcern]);

  // Rooms allowed per building (full set) for non ICTC buildings
  const buildingRoomRanges: Record<string, string[] | null> = {
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

  const floorOptions: string[] = [
    "First Floor",
    "Second Floor",
    "Third Floor",
    "Fourth Floor",
    "Other",
  ];

  const isIctc = formData.building === "ICTC";
  const isCos = formData.building === "COS";

  const visibleFloorOptions = useMemo(() => {
    if (isIctc) return ["First Floor", "Second Floor", "Other"];
    return floorOptions;
  }, [isIctc]);

  const floorRoomRanges: Record<string, string[]> = {
    "First Floor": ["101-110"],
    "Second Floor": ["201-213"],
    "Third Floor": ["301-310"],
    "Fourth Floor": ["401-410"],
  };

  const showMsg = (type: "success" | "error" | "info", text: string) => {
    setMessageType(type);
    setMessage(text);
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

  const allRoomsForBuilding = useMemo(() => {
    if (isIctc) return null;
    return expandRanges(buildingRoomRanges[formData.building] ?? null);
  }, [formData.building, isIctc]);

  const availableRooms = useMemo(() => {
    if (!allRoomsForBuilding) return null;

    if (isCos) return allRoomsForBuilding;
    if (!specificRoom || !formData.floor) return allRoomsForBuilding;

    const floorRanges = floorRoomRanges[formData.floor];
    if (!floorRanges) return allRoomsForBuilding;

    const floorRooms = expandRanges(floorRanges) || [];
    const setAll = new Set(allRoomsForBuilding);
    return floorRooms.filter((r) => setAll.has(r));
  }, [allRoomsForBuilding, specificRoom, formData.floor, isCos]);

  const availableRoomsWithOther = useMemo(() => {
    if (!availableRooms) return null;
    const set = new Set(availableRooms);
    set.add("Other");
    return Array.from(set);
  }, [availableRooms]);

  useEffect(() => {
    if (isIctc) return;
    const showRoom = Array.isArray(availableRooms) && availableRooms.length > 0;
    setHasRoom(showRoom);
    setFormData((f) => ({ ...f, room: "", otherRoom: "" }));
  }, [availableRooms, isIctc]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const target = e.target as HTMLInputElement;

    if (target.files && target.files[0]) {
      const f = target.files[0];
      setFormData((prev) => ({ ...prev, ImageFile: f }));
      setPreview(URL.createObjectURL(f));
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
      // ✅ Auto-clear otherRoom if room is not "Other"
if (name === "room" && value !== "Other") {
  next.otherRoom = "";
}


      return next;
    });
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("is-dragover");
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, ImageFile: file }));
      setPreview(URL.createObjectURL(file));
    }
  };

  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add("is-dragover");
  };

  const onDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove("is-dragover");
  };

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

  const performSubmit = async () => {
    setSubmitting(true);
    setIsConfirming(false);
    showMsg("info", "Submitting report...");
    try {
      const data = new FormData();

      data.append("email", formData.email);
      data.append("heading", formData.heading);
      data.append("description", formData.description);
      data.append("concern", formData.concern);
      data.append("subConcern", formData.subConcern);
      data.append("building", formData.building);
      data.append("college", formData.college);
      data.append("floor", formData.floor);
      data.append("room", formData.room);
      data.append("otherConcern", formData.otherConcern);
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
  };

  const showSubConcern = formData.concern && formData.concern !== "Other";
  const needsOtherConcern = formData.concern === "Other";
  const needsOtherBuilding = formData.building === "Other";

  const roomIsOther = formData.room === "Other";


  const needsOtherRoomText =
  specificRoom &&
  !!formData.building &&
  roomIsOther;



  const needsRoomDropdown = !isIctc && !isCos && specificRoom && hasRoom;
  const needsOtherRoom =
    !isIctc && specificRoom && !hasRoom && !!formData.building;

  const ictcHasSpecific = isIctc && specificRoom;
  const ictcFirstFloor = ictcHasSpecific && formData.floor === "First Floor";
  const ictcSecondFloor = ictcHasSpecific && formData.floor === "Second Floor";

  const cosHasSpecificRooms = isCos && specificRoom && hasRoom;

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
    if (needsOtherBuilding) req.push("otherBuilding");
    if (needsRoomDropdown) {
  req.push("floor");
  req.push("room");
  // ✅ If room dropdown is "Other", require textbox too
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

  const similarReportsCount = useMemo(() => {
    if (!formData.building || !formData.concern) return 0;

    const currentKey = getSimilarityKey({
      building: formData.building,
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

  const summaryText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Title: ${formData.heading || "-"}`);
    parts.push(
      `Concern: ${formData.concern || "-"}${
        formData.subConcern ? " / " + formData.subConcern : ""
      }`
    );
    if (needsOtherConcern && formData.otherConcern)
      parts.push(`Other concern: ${formData.otherConcern}`);
    parts.push(`Building: ${formData.building || "-"}`);
    if (needsOtherBuilding && formData.otherBuilding)
      parts.push(`Other building: ${formData.otherBuilding}`);

    if (specificRoom) {
      if (isIctc) {
        if (formData.floor) parts.push(`Floor: ${formData.floor}`);
        parts.push(`Room: ${formData.room || "-"}`);
      } else if (isCos) {
        parts.push(`Room: ${formData.room || "-"}`);
      } else if (needsRoomDropdown) {
        const floorLabel = formData.floor || deriveFloorFromRoom(formData.room);
        if (floorLabel) parts.push(`Floor: ${floorLabel}`);
        parts.push(`Room: ${formData.room || "-"}`);
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
    formData.heading,
    formData.concern,
    formData.subConcern,
    formData.otherConcern,
    formData.building,
    formData.otherBuilding,
    formData.floor,
    formData.room,
    formData.otherRoom,
    formData.college,
    formData.ImageFile,
    needsOtherConcern,
    needsOtherBuilding,
    specificRoom,
    needsRoomDropdown,
    needsOtherRoom,
    isIctc,
    isCos,
  ]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      showMsg("success", "Summary copied to clipboard.");
    } catch {
      showMsg("error", "Could not copy summary.");
    }
  };

  const ictcSecondFloorRooms = useMemo(() => {
    if (!isIctc || formData.floor !== "Second Floor") return [];
    const rooms: string[] = [];
    for (let n = 201; n <= 213; n += 1) rooms.push(String(n));
    rooms.push("Other");
    return rooms;
  }, [isIctc, formData.floor]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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
  };

  const viewreports = () => {
    localStorage.removeItem("currentUser");
    router.push("/Student/ViewReports");
  };

  return (
    <div className={`create-scope ${light ? "create-scope--light" : ""}`}>
      <div
        className={`create-scope__layout ${sidebarOpen ? "" : "is-collapsed"}`}
      >
        {/* Sidebar */}
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
                    className={readyToSubmit && !hasProfanity ? "is-ok" : "is-warn"}
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
                    {formData.subConcern ? ` / ${formData.subConcern}` : ""}
                    {formData.concern === "Other" && formData.otherConcern
                      ? ` / ${formData.otherConcern}`
                      : ""}
                  </div>
                  <div>Building</div>
                  <div>
                    {formData.building || "-"}
                    {formData.building === "Other" && formData.otherBuilding
                      ? ` / ${formData.otherBuilding}`
                      : ""}
                  </div>
                  <div>Specific room</div>
                  <div>{specificRoom ? "Yes" : "No"}</div>

                  {specificRoom && formData.building === "ICTC" && (
                    <>
                      <div>Floor</div>
                      <div>{formData.floor || "-"}</div>
                      <div>Room</div>
                      <div>{formData.room || "-"}</div>
                    </>
                  )}

                  {specificRoom && isCos && hasRoom && (
                    <>
                      <div>Room</div>
                      <div>{formData.room || "-"}</div>
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
                        <div>{formData.room || "-"}</div>
                      </>
                    )}

                    {needsOtherRoomText && (
  <div className="create-scope__group">
    <label htmlFor="otherRoom">
      Specify room / spot{requiredStar(formData.otherRoom)}
    </label>
    <input
      id="otherRoom"
      type="text"
      name="otherRoom"
      placeholder="Example: Near stairs, hallway, lab area"
      value={formData.otherRoom}
      onChange={handleChange}
      required
    />
    <p className="create-scope__hint">
      Please describe the exact room or location.
    </p>
  </div>
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
                      <div className="create-scope__preview-empty">No image yet</div>
                    )}
                  </div>
                </Panel>
              </div>
            </Panel>
          </div>
        </aside>

        {/* ✅ Scrim: render ONLY when open so it can never block scroll invisibly */}
        {sidebarOverlayOpen && (
          <div
            className="create-scope__scrim is-open"
            onClick={() => setSidebarOverlayOpen(false)}
          />
        )}

        {/* Main */}
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
                  onClick={() => {
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
                  }}
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

            {metaError && <div className="create-scope__message is-info">{metaError}</div>}

            <form onSubmit={handleSubmit} className="create-scope__form">
              {/* Email */}
              <div className="create-scope__group">
                <label htmlFor="email">Email{requiredStar(formData.email)}</label>
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
                {currentUserEmail ? (
                  <p className="create-scope__hint">This email came from your login.</p>
                ) : (
                  <p className="create-scope__hint">
                    We may contact you using this email for follow up.
                  </p>
                )}
              </div>

              {/* Heading and College */}
              <div className="create-scope__row-two">
                <div className="create-scope__group">
                  <label htmlFor="heading">
                    Heading{requiredStar(formData.heading)}
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
                    College{requiredStar(formData.college)}
                  </label>
                  <select
                    id="college"
                    name="college"
                    value={formData.college}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select college</option>
                    {collegeOptions.map((c) => (
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
                  Description{requiredStar(formData.description)}
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
                  Tip. Add steps to reproduce or time observed.
                </p>
              </div>

              {/* Concern and Sub concern */}
              <div className="create-scope__row-two">
                <div className="create-scope__group">
                  <label htmlFor="concern">
                    Concern{requiredStar(formData.concern)}
                  </label>
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

                {formData.concern && formData.concern !== "Other" && (
                  <div className="create-scope__group">
                    <label htmlFor="subConcern">
                      Sub concern{requiredStar(formData.subConcern)}
                    </label>
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
                  </div>
                )}
              </div>

              {formData.concern === "Other" && (
                <div className="create-scope__group">
                  <label htmlFor="otherConcern">
                    Other concern{requiredStar(formData.otherConcern)}
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

              {/* Building and toggle */}
              <div className="create-scope__row-two">
                <div className="create-scope__group">
                  <label htmlFor="building">
                    Building{requiredStar(formData.building)}
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

              {formData.building === "Other" && (
                <div className="create-scope__group">
                  <label htmlFor="otherBuilding">
                    Other building{requiredStar(formData.otherBuilding)}
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

              {/* ICTC specific room handling */}
              {specificRoom && formData.building === "ICTC" && (
                <>
                  <div className="create-scope__group">
                    <label htmlFor="floor">
                      Floor{requiredStar(formData.floor)}
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

                  {formData.floor === "First Floor" && (
                    <div className="create-scope__group">
                      <label htmlFor="room">Room{requiredStar(formData.room)}</label>
                      <input
                        id="room"
                        type="text"
                        name="room"
                        placeholder="Enter room on 1st floor (for example. 101, Lab, Lobby)"
                        value={formData.room}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  )}

                  {formData.floor === "Second Floor" && (
                    <div className="create-scope__group">
                      <label htmlFor="room">Room{requiredStar(formData.room)}</label>
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
                        Room or area{requiredStar(formData.room)}
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

              {/* Generic room handling */}
              {specificRoom &&
                formData.building !== "ICTC" &&
                !isCos &&
                hasRoom && (
                  <>
                    <div className="create-scope__group">
                      <label htmlFor="floor">Floor{requiredStar(formData.floor)}</label>
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
                      <label htmlFor="room">Room{requiredStar(formData.room)}</label>
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

              

                {/* ✅ OTHER ROOM TEXTBOX – GLOBAL */}
<div
  className={`animate-reveal ${
    needsOtherRoomText ? "is-open" : ""
  }`}
>
  {needsOtherRoomText && (
    <div className="create-scope__group">
      <label htmlFor="otherRoom">
        Specify room / spot{requiredStar(formData.otherRoom)}
      </label>
      <input
        id="otherRoom"
        type="text"
        name="otherRoom"
        placeholder="Example: Near stairs, hallway, lab area"
        value={formData.otherRoom}
        onChange={handleChange}
        required
      />
      <p className="create-scope__hint">
        Please describe the exact room or location.
      </p>
    </div>
  )}
</div>


              {/* Dropzone */}
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
                    accept="image/*"
                    onChange={handleChange}
                    name="ImageFile"
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

              {hasProfanity && (
                <p className="create-scope__hint create-scope__hint--error">
                  Profanity or foul words were detected in your text. Please remove them
                  before submitting.
                </p>
              )}

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

      {/* Confirmation modal */}
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
