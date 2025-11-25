"use client";

import "@/app/style/create.css";

import React, {
  useEffect,
  useMemo,
  useState,
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs"; // ⬅ add this

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

interface MetaState {
  buildings: string[];
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
  imageFile: File | null;
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

// small helper for safe string comparison
const norm = (v: unknown): string =>
  v == null ? "" : String(v).trim().toLowerCase();

// derive floor from room string like "102" -> "1" (fallback)
const deriveFloorFromRoom = (roomValue: unknown): string => {
  if (!roomValue) return "";
  const num = parseInt(String(roomValue), 10);
  if (Number.isNaN(num)) return "";
  const floor = Math.floor(num / 100);
  return floor > 0 ? String(floor) : "";
};

// required star helper for labels
const requiredStar = (value: unknown): ReactNode => {
  const str = value == null ? "" : String(value).trim();
  if (!str) {
    return <span className="create-scope__required-star"> *</span>;
  }
  return null;
};

// fallback options used if /api/meta is not available
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

const META_URL = "/api/meta";


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

export default function Create(): JSX.Element {
  const { user, isLoaded } = useUser(); // ⬅ get logged in Clerk user
  const router = useRouter();

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
    imageFile: null,
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
  const [light, setLight] = useState<boolean>(false);

  const [specificRoom, setSpecificRoom] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  const [existingReports, setExistingReports] = useState<Report[]>([]);

  const [meta, setMeta] = useState<MetaState>({
    buildings: FALLBACK_BUILDINGS,
    concerns: FALLBACK_CONCERNS,
  });
  const [metaLoading, setMetaLoading] = useState<boolean>(true);
  const [metaError, setMetaError] = useState<string>("");

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

  // Load email from localStorage currentUser and prefill
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
        if (!res.ok) {
          throw new Error(`Failed to load options. Status ${res.status}`);
        }
        const data = (await res.json()) as {
          buildings?: unknown;
          concerns?: unknown;
        };

        if (!alive) return;

        const incomingBuildings =
          Array.isArray(data.buildings) && data.buildings.length
            ? (data.buildings as string[])
            : FALLBACK_BUILDINGS;

        const incomingConcerns =
          Array.isArray(data.concerns) && data.concerns.length
            ? (data.concerns as ConcernMeta[])
            : FALLBACK_CONCERNS;

        setMeta({
          buildings: incomingBuildings,
          concerns: incomingConcerns,
        });
      } catch (err) {
        console.error("Error loading meta:", err);
        if (!alive) return;
        setMeta({
          buildings: FALLBACK_BUILDINGS,
          concerns: FALLBACK_CONCERNS,
        });
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
        const res = await fetch("/api/reports");
        const data = await res.json();

        let list: Report[] = [];
        if (Array.isArray(data)) {
          list = data as Report[];
        } else if (Array.isArray((data as any).reports)) {
          list = (data as any).reports as Report[];
        } else if (Array.isArray((data as any).data)) {
          list = (data as any).data as Report[];
        } else {
          console.warn("Unexpected reports payload shape:", data);
        }

        setExistingReports(list);
      } catch (err) {
        console.error("Error fetching reports for similarity:", err);
      }
    };
    fetchReports();
  }, []);

  // dynamic options from meta
  const buildingOptions = useMemo(() => {
    const list = meta.buildings
      .slice()
      .filter((b) => b && String(b).trim().length > 0);

    const others = list.filter((x) => norm(x) === "other");
    const normal = list.filter((x) => norm(x) !== "other");

    normal.sort((a, b) => String(a).localeCompare(String(b)));

    return [...normal, ...others]; // "Other" always last
  }, [meta.buildings]);

  const concernOptions = useMemo(() => {
    const list = meta.concerns
      .map((c) => c.label)
      .filter((label) => label && String(label).trim().length > 0);

    const others = list.filter((x) => norm(x) === "other");
    const normal = list.filter((x) => norm(x) !== "other");

    normal.sort((a, b) => String(a).localeCompare(String(b)));

    return [...normal, ...others]; // "Other" always last
  }, [meta.concerns]);

  const selectedConcern = useMemo(
    () => meta.concerns.find((c) => c.label === formData.concern) || null,
    [meta.concerns, formData.concern]
  );

  const dynamicSubconcernOptions = useMemo(() => {
    if (!selectedConcern || !Array.isArray(selectedConcern.subconcerns)) {
      return [];
    }
    return selectedConcern.subconcerns;
  }, [selectedConcern]);

  // Rooms allowed per building (full set) for non ICTC buildings
  const buildingRoomRanges: Record<string, string[] | null> = {
    JFH: ["101-109", "201-210", "301-310", "401-405"],
    ICTC: null, // handled separately
    PCH: ["101-109", "201-210", "301-310", "401-405"],
    Ayuntamiento: null,
    "Food Square": null,
    COS: ["101-110"], // single floor, rooms 101-110
    CBAA: ["101-109", "201-210", "301-310", "401-405"],
    CTHM: ["101-109", "201-210"],
    GMH: ["101-109"],
    CEAT: ["101-109", "201-210", "301-310", "401-405"],
    Other: null,
  };

  // Floor options
  const floorOptions: string[] = [
    "First Floor",
    "Second Floor",
    "Third Floor",
    "Fourth Floor",
  ];

  // Floor options that should be visible given building
  const visibleFloorOptions = useMemo(() => {
    if (formData.building === "ICTC") {
      return ["First Floor", "Second Floor"];
    }
    return floorOptions;
  }, [formData.building]);

  // Room ranges allowed per floor (global, then intersect per building)
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

  const isIctc = formData.building === "ICTC";
  const isCos = formData.building === "COS";

  // All rooms allowed for the chosen building (non ICTC)
  const allRoomsForBuilding = useMemo(() => {
    if (isIctc) return null;
    return expandRanges(buildingRoomRanges[formData.building] ?? null);
  }, [formData.building, isIctc]);

  // Final list of rooms depends on building + floor (non ICTC)
  const availableRooms = useMemo(() => {
    if (!allRoomsForBuilding) return null;

    // COS ignores floors: always show all allowed rooms
    if (isCos) return allRoomsForBuilding;

    // If no specific room or no floor chosen yet, allow all rooms in the building
    if (!specificRoom || !formData.floor) return allRoomsForBuilding;

    const floorRanges = floorRoomRanges[formData.floor];
    if (!floorRanges) return allRoomsForBuilding;

    const floorRooms = expandRanges(floorRanges) || [];
    const setAll = new Set(allRoomsForBuilding);

    // intersection
    return floorRooms.filter((r) => setAll.has(r));
  }, [allRoomsForBuilding, specificRoom, formData.floor, isCos]);

  useEffect(() => {
    if (isIctc) {
      // ICTC handled separately
      return;
    }
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
      setFormData((prev) => ({ ...prev, imageFile: f }));
      setPreview(URL.createObjectURL(f));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (name === "concern") {
        setFormData((prev) => ({
          ...prev,
          concern: value,
          subConcern: "",
          otherConcern: "",
        }));
      }
      if (name === "building") {
        setFormData((prev) => ({
          ...prev,
          building: value,
          otherBuilding: "",
          floor: "",
          room: "",
          otherRoom: "",
        }));
      }
      if (name === "floor") {
        setFormData((prev) => ({
          ...prev,
          floor: value,
          room: "",
        }));
      }
    }
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("is-dragover");
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, imageFile: file }));
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    showMsg("info", "Submitting report...");
    try {
      const data = new FormData();
      (
        Object.entries(formData) as [
          keyof FormDataState,
          FormDataState[keyof FormDataState]
        ][]
      ).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== "") {
          data.append(k, v as Blob | string);
        }
      });
      const res = await fetch("/api/reports", {
  method: "POST",
  body: data,
});


      if (!res.ok) {
  const text = await res.text();
  console.error("Submit error status:", res.status, text);
}


      const result = await res.json();
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
          imageFile: null,
          otherConcern: "",
          otherBuilding: "",
          otherRoom: "",
        });
        setPreview(null);
        setSpecificRoom(false);
      } else {
        showMsg("error", result.message || "Submission failed.");
      }
    } catch {
      showMsg("error", "Network error while submitting report.");
    } finally {
      setSubmitting(false);
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  /* Derived summary and validation */
  const showSubConcern = formData.concern && formData.concern !== "Other";
  const needsOtherConcern = formData.concern === "Other";
  const needsOtherBuilding = formData.building === "Other";

  // multi-floor buildings (non ICTC, non COS)
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

  // floor label derived for summary panels (non ICTC, non COS)
  const roomFloorLabel = useMemo(() => {
    if (!specificRoom || !hasRoom || isIctc || isCos) return "";
    if (formData.floor) return formData.floor;
    if (formData.room) return deriveFloorFromRoom(formData.room);
    return "";
  }, [specificRoom, hasRoom, formData.floor, formData.room, isIctc, isCos]);

  // Similar reports count by building + concern + subConcern/otherConcern
  const similarReportsCount = useMemo(() => {
    if (!formData.building || !formData.concern) return 0;

    const building = norm(formData.building);
    const concern = norm(formData.concern);
    const curSub = norm(formData.subConcern);
    const curOther = norm(formData.otherConcern);

    return existingReports.filter((r) => {
      const status = norm(r.status || "Pending");
      if (status === "archived") return false;

      if (norm(r.building) !== building) return false;
      if (norm(r.concern) !== concern) return false;

      if (concern === norm("Other")) {
        if (curOther) {
          const repOther = norm(r.otherConcern);
          if (repOther !== curOther) return false;
        }
      } else if (curSub) {
        const repSub = norm(r.subConcern);
        if (repSub !== curSub) return false;
      }

      return true;
    }).length;
  }, [
    existingReports,
    formData.building,
    formData.concern,
    formData.subConcern,
    formData.otherConcern,
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
    parts.push(`Photo attached: ${formData.imageFile ? "Yes" : "No"}`);
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
    formData.imageFile,
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

  // ICTC second floor rooms list
  const ictcSecondFloorRooms = useMemo(() => {
    if (!isIctc || formData.floor !== "Second Floor") return [];
    const rooms: string[] = [];
    for (let n = 201; n <= 213; n += 1) {
      rooms.push(String(n));
    }
    rooms.push("Other");
    return rooms;
  }, [isIctc, formData.floor]);

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
                    : "Select building and concern"}
                </div>

                <div>Attach clear photo</div>
                <div>Optional</div>
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
                  <strong className={readyToSubmit ? "is-ok" : "is-warn"}>
                    {readyToSubmit ? "Yes" : "No"}
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

                  {specificRoom && formData.building !== "ICTC" && !hasRoom && (
                    <>
                      <div>Spot</div>
                      <div>{formData.otherRoom || "-"}</div>
                    </>
                  )}

                  <div>College</div>
                  <div>{formData.college || "-"}</div>
                  <div>Photo</div>
                  <div>{formData.imageFile ? "Attached" : "None"}</div>
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

            <Panel title="Theme">
              <label className="create-scope__switch">
                <input
                  id="lightMode"
                  type="checkbox"
                  checked={light}
                  onChange={() => setLight((v) => !v)}
                />
                <span className="create-scope__slider" />
                <span className="create-scope__switch-label">
                  Use light mode
                </span>
              </label>
            </Panel>
          </div>
        </aside>

        {/* Scrim for mobile drawer */}
        <div
          className={`create-scope__scrim ${
            sidebarOverlayOpen ? "is-open" : ""
          }`}
          onClick={() => setSidebarOverlayOpen(false)}
        />

        {/* Main */}
        <main className="create-scope__main">
          {/* Top bar with burger and logo */}
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

              <div className="create-scope__topbar-brand">
                <img
                  src="https://upload.wikimedia.org/wikipedia/en/8/8c/DLSU-Dasmari%C3%B1as_Seal.png"
                  alt="DLSU-D Logo"
                />
                <span>BFMO Reporting</span>
              </div>
            </div>
          </header>

          <Panel
            title="Create a report"
            subtitle="Fill the form and attach a photo if available."
            actions={
              <div className="create-scope__toolbar">
                <button
                  type="button"
                  className="create-scope__ghost-btn"
                  onClick={() => setLight((v) => !v)}
                >
                  {light ? "Dark" : "Light"}
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
                      imageFile: null,
                      otherConcern: "",
                      otherBuilding: "",
                      otherRoom: "",
                    });
                    setPreview(null);
                    setSpecificRoom(false);
                    showMsg("info", "Form cleared.");
                  }}
                >
                  Reset
                </button>

                <button
                  type="button"
                  className="create-scope__logout-btn"
                  onClick={logout}
                  title="Logout"
                >
                  Logout
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
              {/* Email */}
              <div className="create-scope__group">
                <label htmlFor="email">
                  Email{requiredStar(formData.email)}
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
                {currentUserEmail ? (
                  <p className="create-scope__hint">
                    This email came from your login.
                  </p>
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
                      <label htmlFor="room">
                        Room{requiredStar(formData.room)}
                      </label>
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
                      <label htmlFor="room">
                        Room{requiredStar(formData.room)}
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
                </>
              )}

              {/* COS specific room handling (no floor, just room) */}
              {specificRoom && isCos && hasRoom && (
                <div className="create-scope__group">
                  <label htmlFor="room">
                    Room{requiredStar(formData.room)}
                  </label>
                  <select
                    id="room"
                    name="room"
                    value={formData.room}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select room</option>
                    {availableRooms?.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Generic specific room handling for other buildings */}
              {specificRoom &&
                formData.building !== "ICTC" &&
                !isCos &&
                hasRoom && (
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

                    <div className="create-scope__group">
                      <label htmlFor="room">
                        Room{requiredStar(formData.room)}
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
                          {formData.floor
                            ? "Select room"
                            : "Select floor first"}
                        </option>
                        {formData.floor &&
                          availableRooms?.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                )}

              {specificRoom &&
                formData.building !== "ICTC" &&
                !hasRoom &&
                !!formData.building && (
                  <div className="create-scope__group">
                    <label htmlFor="otherRoom">
                      Specific spot{requiredStar(formData.otherRoom)}
                    </label>
                    <input
                      id="otherRoom"
                      type="text"
                      name="otherRoom"
                      placeholder="Example. Canteen south corner, near sink"
                      value={formData.otherRoom}
                      onChange={handleChange}
                      required
                    />
                    <p className="create-scope__hint">
                      If there is no room number, describe the exact location.
                    </p>
                  </div>
                )}

              {/* Dropzone */}
              <div className="create-scope__group">
                <label>Attach an image optional</label>
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
                    name="imageFile"
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
                    <div className="create-scope__hint">
                      PNG, JPG up to 10 MB
                    </div>
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

              <button
                className="create-scope__btn create-scope__btn--primary create-scope__w-full"
                type="submit"
                disabled={submitting || !readyToSubmit}
              >
                {submitting ? "Submitting..." : "Submit report"}
              </button>
            </form>
          </Panel>
        </main>
      </div>
    </div>
  );
}
