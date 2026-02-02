"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import "../style/admin-edit.css";

type BuildingMeta = {
  id: string;
  name: string;
  floors: number;
  roomsPerFloor: number;
  hasRooms?: boolean;
  singleLocationLabel?: string;
};

type ConcernMeta = {
  id: string;
  label: string;
  subconcerns: string[];
};

const DEFAULT_BUILDINGS: BuildingMeta[] = [
  {
    id: "ayuntamiento",
    name: "Ayuntamiento",
    floors: 4,
    roomsPerFloor: 20,
    hasRooms: false,
  },
  { id: "jfh", name: "JFH", floors: 4, roomsPerFloor: 10, hasRooms: true },
  { id: "ictc", name: "ICTC", floors: 2, roomsPerFloor: 13, hasRooms: true },
  { id: "pch", name: "PCH", floors: 3, roomsPerFloor: 10, hasRooms: true },
  {
    id: "food-square",
    name: "Food Square",
    floors: 1,
    roomsPerFloor: 20,
    hasRooms: false,
  },
  { id: "cos", name: "COS", floors: 1, roomsPerFloor: 10, hasRooms: true },
  { id: "cbaa", name: "CBAA", floors: 4, roomsPerFloor: 10, hasRooms: true },
  { id: "cthm", name: "CTHM", floors: 4, roomsPerFloor: 10, hasRooms: true },
  { id: "gmh", name: "GMH", floors: 2, roomsPerFloor: 6, hasRooms: true },
  { id: "ceat", name: "CEAT", floors: 4, roomsPerFloor: 10, hasRooms: true },
  {
    id: "other",
    name: "Other",
    floors: 1,
    roomsPerFloor: 1,
    hasRooms: false,
  },
];

const DEFAULT_CONCERNS: ConcernMeta[] = [
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

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) ||
  "http://localhost:3000";

const META_URL = `${API_BASE.replace(/\/+$/, "")}/api/meta`;

const norm = (v: unknown) =>
  v == null ? "" : String(v).trim().toLowerCase();

function Panel(props: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { title, subtitle, actions, children } = props;
  return (
    <section className="admin-edit__panel">
      <header className="admin-edit__panel-head">
        <div>
          {title && <h3 className="admin-edit__panel-title">{title}</h3>}
          {subtitle && (
            <p className="admin-edit__panel-subtitle">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="admin-edit__panel-actions">{actions}</div>
        )}
      </header>
      <div className="admin-edit__panel-body">{children}</div>
    </section>
  );
}

// Normalize buildings coming from DB
function normalizeBuildingsFromDb(raw: unknown[]): BuildingMeta[] {
  return raw.map((b, idx) => {
    if (typeof b === "string") {
      const label = String(b || "").trim();
      const id =
        norm(label).replace(/\s+/g, "-") ||
        `b-${idx}-${Math.random().toString(36).slice(2, 6)}`;
      return {
        id,
        name: label || "Unnamed",
        floors: 1,
        roomsPerFloor: 1,
        hasRooms: true,
        singleLocationLabel: "",
      };
    }

    const obj = b as any;
    const rawName = String(obj?.name || "").trim();
    const id =
      String(obj?.id || "").trim() ||
      norm(rawName).replace(/\s+/g, "-") ||
      `b-${idx}-${Math.random().toString(36).slice(2, 6)}`;

    const hasRooms =
      obj?.hasRooms === false
        ? false
        : true;

    const floors =
      typeof obj?.floors === "number" && obj.floors > 0
        ? Math.round(obj.floors)
        : 1;

    const roomsPerFloor =
      typeof obj?.roomsPerFloor === "number" && obj.roomsPerFloor > 0
        ? Math.round(obj.roomsPerFloor)
        : 1;

    const singleLocationLabel =
      typeof obj?.singleLocationLabel === "string"
        ? String(obj.singleLocationLabel).trim()
        : "";

    return {
      id,
      name: rawName || "Unnamed",
      floors,
      roomsPerFloor,
      hasRooms,
      singleLocationLabel,
    };
  });
}

function normalizeConcernsFromDb(raw: unknown[]): ConcernMeta[] {
  return raw.map((c, idx) => {
    const obj = c as any;
    const label = String(obj?.label || "").trim();
    const id =
      String(obj?.id || "").trim() ||
      norm(label).replace(/\s+/g, "-") ||
      `concern-${idx}-${Math.random().toString(36).slice(2, 6)}`;

    const subs: string[] = Array.isArray(obj?.subconcerns)
      ? obj.subconcerns.map((s: unknown) => String(s || "").trim())
      : [];

    return {
      id,
      label: label || "Unnamed concern",
      subconcerns: subs.filter((s: string) => s.length > 0),
    };
  });
}

export default function AdminEditPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const [buildings, setBuildings] = useState<BuildingMeta[]>(DEFAULT_BUILDINGS);
  const [concerns, setConcerns] = useState<ConcernMeta[]>(DEFAULT_CONCERNS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  
  // Selected items for editing
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedConcernId, setSelectedConcernId] = useState<string>("");

  const role = useMemo(() => {
    if (!isLoaded || !isSignedIn || !user) return "guest";

    const rawRole = (user.publicMetadata as any)?.role;
    let r = "student";

    if (Array.isArray(rawRole) && rawRole.length > 0) {
      r = String(rawRole[0]).toLowerCase();
    } else if (typeof rawRole === "string") {
      r = rawRole.toLowerCase();
    }

    return r;
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) {
      router.replace("/");
      return;
    }

    if (role !== "admin") {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, user, role, router]);

  const loadMeta = useCallback(
    async (mode: "preferDefaults" | "dbOnly" = "preferDefaults") => {
      try {
        setLoading(true);
        setError("");
        setSaveMsg("");

        const res = await fetch(`${META_URL}?ts=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const raw = await res.text().catch(() => "");
          console.error("Meta load failed:", res.status, raw);
          throw new Error("Failed to load options from server.");
        }

        const data = await res.json().catch(() => null);
        if (!data) {
          throw new Error("Server returned empty meta.");
        }

        const rawBuildings = Array.isArray((data as any).buildings)
          ? ((data as any).buildings as unknown[])
          : [];
        const rawConcerns = Array.isArray((data as any).concerns)
          ? ((data as any).concerns as unknown[])
          : [];

        let incomingBuildings: BuildingMeta[];
        let incomingConcerns: ConcernMeta[];

        if (mode === "preferDefaults") {
          incomingBuildings =
            rawBuildings.length > 0
              ? normalizeBuildingsFromDb(rawBuildings)
              : DEFAULT_BUILDINGS;
          incomingConcerns =
            rawConcerns.length > 0
              ? normalizeConcernsFromDb(rawConcerns)
              : DEFAULT_CONCERNS;
        } else {
          incomingBuildings = normalizeBuildingsFromDb(rawBuildings);
          incomingConcerns = normalizeConcernsFromDb(rawConcerns);
        }

        setBuildings(incomingBuildings);
        setConcerns(incomingConcerns);
        
        // Auto-select first items
        if (incomingBuildings.length > 0 && !selectedBuildingId) {
          setSelectedBuildingId(incomingBuildings[0].id);
        }
        if (incomingConcerns.length > 0 && !selectedConcernId) {
          setSelectedConcernId(incomingConcerns[0].id);
        }
      } catch (err: any) {
        console.error(err);
        if (mode === "preferDefaults") {
          setError(
            err?.message ||
              "Could not load buildings and concerns. Using defaults."
          );
          setBuildings(DEFAULT_BUILDINGS);
          setConcerns(DEFAULT_CONCERNS);
        } else {
          setError(
            err?.message ||
              "Could not load buildings and concerns from database."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedBuildingId, selectedConcernId]
  );

  useEffect(() => {
    loadMeta("preferDefaults");
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaveMsg("");

    let cleanBuildings: BuildingMeta[] = buildings
      .map((b, idx) => {
        const name = String(b.name || "").trim();
        if (!name) return null;

        const id =
          String(b.id || "").trim() ||
          norm(name).replace(/\s+/g, "-") ||
          `b-${idx}-${Math.random().toString(36).slice(2, 6)}`;

        const hasRooms = b.hasRooms === false ? false : true;

        const floors =
          typeof b.floors === "number" && b.floors > 0
            ? Math.round(b.floors)
            : 1;

        const roomsPerFloor =
          typeof b.roomsPerFloor === "number" && b.roomsPerFloor > 0
            ? Math.round(b.roomsPerFloor)
            : 1;

        const singleLocationLabel = String(
          b.singleLocationLabel || ""
        ).trim();

        return {
          id,
          name,
          floors,
          roomsPerFloor,
          hasRooms,
          singleLocationLabel,
        };
      })
      .filter(Boolean) as BuildingMeta[];

    const hasOtherBuilding = cleanBuildings.some(
      (b) => norm(b.name) === "other"
    );
    if (!hasOtherBuilding) {
      cleanBuildings.push({
        id: "other",
        name: "Other",
        floors: 1,
        roomsPerFloor: 1,
        hasRooms: false,
        singleLocationLabel: "",
      });
    }

    const otherBuildings = cleanBuildings.filter(
      (b) => norm(b.name) === "other"
    );
    const normalBuildings = cleanBuildings.filter(
      (b) => norm(b.name) !== "other"
    );
    cleanBuildings = [...normalBuildings, ...otherBuildings];

    let cleanConcerns: ConcernMeta[] = concerns
      .map((c, idx) => {
        const label = String(c.label || "").trim();
        if (!label) return null;

        const id =
          String(c.id || "").trim() ||
          norm(label).replace(/\s+/g, "-") ||
          `concern-${idx}-${Math.random().toString(36).slice(2, 6)}`;

        let subs = Array.isArray(c.subconcerns) ? c.subconcerns : [];
        subs = subs
          .map((s) => String(s || "").trim())
          .filter((s) => s.length > 0);

        const hasOtherSub = subs.some((s) => norm(s) === "other");
        if (!hasOtherSub) {
          subs.push("Other");
        } else {
          const others = subs.filter((s) => norm(s) === "other");
          const normalSubs = subs.filter((s) => norm(s) !== "other");
          subs = [...normalSubs, ...others];
        }

        return {
          id,
          label,
          subconcerns: subs,
        };
      })
      .filter(Boolean) as ConcernMeta[];

    let otherConcernIndex = cleanConcerns.findIndex(
      (c) => norm(c.label) === "other"
    );

    if (otherConcernIndex === -1) {
      cleanConcerns.push({
        id: "other",
        label: "Other",
        subconcerns: ["Other"],
      });
    } else {
      const oc = cleanConcerns[otherConcernIndex];
      let subs = Array.isArray(oc.subconcerns) ? oc.subconcerns : [];
      subs = subs
        .map((s) => String(s || "").trim())
        .filter((s) => s.length > 0);

      const hasOtherSub = subs.some((s) => norm(s) === "other");
      if (!hasOtherSub) {
        subs.push("Other");
      } else {
        const others = subs.filter((s) => norm(s) === "other");
        const normalSubs = subs.filter((s) => norm(s) !== "other");
        subs = [...normalSubs, ...others];
      }

      cleanConcerns[otherConcernIndex] = {
        ...oc,
        subconcerns: subs,
      };
    }

    const payload = {
      buildings: cleanBuildings,
      concerns: cleanConcerns,
    };

    try {
      const res = await fetch(META_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        console.error("Meta save failed:", res.status, raw);
        throw new Error(raw || "Failed to save changes.");
      }

      const data = await res.json().catch(() => null);

      if (data?.buildings && data?.concerns) {
        setBuildings(normalizeBuildingsFromDb(data.buildings));
        setConcerns(normalizeConcernsFromDb(data.concerns));
      }

      setSaveMsg("All changes saved successfully.");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // Get selected building and concern
  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === selectedBuildingId),
    [buildings, selectedBuildingId]
  );

  const selectedConcern = useMemo(
    () => concerns.find((c) => c.id === selectedConcernId),
    [concerns, selectedConcernId]
  );

  // Building handlers
  const handleBuildingNameChange = (value: string) => {
    setBuildings((prev) =>
      prev.map((b) =>
        b.id === selectedBuildingId ? { ...b, name: value } : b
      )
    );
  };

  const handleBuildingHasRoomsToggle = () => {
    setBuildings((prev) =>
      prev.map((b) =>
        b.id === selectedBuildingId
          ? { ...b, hasRooms: b.hasRooms === false ? true : false }
          : b
      )
    );
  };

  const handleBuildingFloorsChange = (value: string) => {
    const num = parseInt(value, 10);
    setBuildings((prev) =>
      prev.map((b) =>
        b.id === selectedBuildingId
          ? { ...b, floors: Number.isNaN(num) || num <= 0 ? 1 : num }
          : b
      )
    );
  };

  const handleBuildingRoomsChange = (value: string) => {
    const num = parseInt(value, 10);
    setBuildings((prev) =>
      prev.map((b) =>
        b.id === selectedBuildingId
          ? { ...b, roomsPerFloor: Number.isNaN(num) || num <= 0 ? 1 : num }
          : b
      )
    );
  };

  const handleAddBuilding = () => {
    const newBuilding: BuildingMeta = {
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: "New Building",
      floors: 1,
      roomsPerFloor: 1,
      hasRooms: true,
      singleLocationLabel: "",
    };
    setBuildings((prev) => [...prev, newBuilding]);
    setSelectedBuildingId(newBuilding.id);
  };

  const handleDeleteBuilding = () => {
    if (!selectedBuildingId) return;
    const idx = buildings.findIndex((b) => b.id === selectedBuildingId);
    setBuildings((prev) => prev.filter((b) => b.id !== selectedBuildingId));
    
    // Select next or previous building
    const remaining = buildings.filter((b) => b.id !== selectedBuildingId);
    if (remaining.length > 0) {
      if (idx < remaining.length) {
        setSelectedBuildingId(remaining[idx].id);
      } else {
        setSelectedBuildingId(remaining[remaining.length - 1].id);
      }
    } else {
      setSelectedBuildingId("");
    }
  };

  // Concern handlers
  const handleConcernLabelChange = (value: string) => {
    setConcerns((prev) =>
      prev.map((c) =>
        c.id === selectedConcernId ? { ...c, label: value } : c
      )
    );
  };

  const handleAddConcern = () => {
    const newConcern: ConcernMeta = {
      id: `concern-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: "New Concern",
      subconcerns: [],
    };
    setConcerns((prev) => [...prev, newConcern]);
    setSelectedConcernId(newConcern.id);
  };

  const handleDeleteConcern = () => {
    if (!selectedConcernId) return;
    const idx = concerns.findIndex((c) => c.id === selectedConcernId);
    setConcerns((prev) => prev.filter((c) => c.id !== selectedConcernId));
    
    // Select next or previous concern
    const remaining = concerns.filter((c) => c.id !== selectedConcernId);
    if (remaining.length > 0) {
      if (idx < remaining.length) {
        setSelectedConcernId(remaining[idx].id);
      } else {
        setSelectedConcernId(remaining[remaining.length - 1].id);
      }
    } else {
      setSelectedConcernId("");
    }
  };

  const handleSubconcernChange = (subIndex: number, value: string) => {
    setConcerns((prev) =>
      prev.map((c) => {
        if (c.id !== selectedConcernId) return c;
        const subs = [...(c.subconcerns || [])];
        subs[subIndex] = value;
        return { ...c, subconcerns: subs };
      })
    );
  };

  const handleAddSubconcern = () => {
    setConcerns((prev) =>
      prev.map((c) =>
        c.id === selectedConcernId
          ? { ...c, subconcerns: [...(c.subconcerns || []), ""] }
          : c
      )
    );
  };

  const handleDeleteSubconcern = (subIndex: number) => {
    setConcerns((prev) =>
      prev.map((c) => {
        if (c.id !== selectedConcernId) return c;
        const subs = [...(c.subconcerns || [])];
        subs.splice(subIndex, 1);
        return { ...c, subconcerns: subs };
      })
    );
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="admin-edit__wrapper">
        <p>Checking your permissions...</p>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="admin-edit__wrapper">
        <p>You do not have access to the admin configuration page.</p>
      </div>
    );
  }

  return (
    <div className="admin-edit admin-edit__wrapper">
      <main className="admin-edit__layout">
        <header className="admin-edit__page-head">
          <div className="admin-edit__heading">
            <h1 className="admin-edit__page-title">
              Buildings & Concerns Configuration
            </h1>
            <p className="admin-edit__page-subtitle">
              Select a building or concern from the dropdown to edit its details
            </p>
            <p className="admin-edit__meta">
              {buildings.length} buildings · {concerns.length} concerns
            </p>
          </div>

          <div className="admin-edit__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setBuildings(DEFAULT_BUILDINGS);
                setConcerns(DEFAULT_CONCERNS);
                setSaveMsg("");
                setError("");
                if (DEFAULT_BUILDINGS.length > 0) {
                  setSelectedBuildingId(DEFAULT_BUILDINGS[0].id);
                }
                if (DEFAULT_CONCERNS.length > 0) {
                  setSelectedConcernId(DEFAULT_CONCERNS[0].id);
                }
              }}
              disabled={saving || loading}
            >
              Load Defaults
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadMeta("dbOnly")}
              disabled={saving || loading}
            >
              Load Database
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? "Saving..." : "Save All Changes"}
            </button>
          </div>
        </header>

        {error && (
          <div className="admin-edit__alert admin-edit__alert--error">
            {error}
          </div>
        )}

        {saveMsg && (
          <div className="admin-edit__alert admin-edit__alert--success">
            {saveMsg}
          </div>
        )}

        {loading ? (
          <p className="admin-edit__loading">Loading options...</p>
        ) : (
          <div className="admin-edit__grid">
            {/* Buildings Section */}
            <Panel
              title="Buildings"
              subtitle="Select a building to edit its configuration"
            >
              <div className="admin-edit__selector-row">
                <div className="admin-edit__field-group" style={{ flex: 1 }}>
                  <label className="admin-edit__label">Select Building</label>
                  <select
                    className="admin-edit__input"
                    value={selectedBuildingId}
                    onChange={(e) => setSelectedBuildingId(e.target.value)}
                  >
                    <option value="">-- Select a building --</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleAddBuilding}
                >
                  + Add New Building
                </button>
              </div>

              {selectedBuilding && (
                <div className="admin-edit__editor-card">
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__label">Building Name</label>
                    <input
                      type="text"
                      className="admin-edit__input"
                      value={selectedBuilding.name}
                      placeholder="Example: CBAA"
                      onChange={(e) => handleBuildingNameChange(e.target.value)}
                    />
                  </div>

                  <div className="admin-edit__field-group">
                    <label className="admin-edit__switch">
                      <input
                        type="checkbox"
                        checked={selectedBuilding.hasRooms !== false}
                        onChange={handleBuildingHasRoomsToggle}
                      />
                      <span className="admin-edit__switch-pill">
                        <span className="admin-edit__switch-knob" />
                      </span>
                      <span className="admin-edit__switch-text">
                        {selectedBuilding.hasRooms !== false
                          ? "Has floors and rooms"
                          : "Specific spot only"}
                      </span>
                    </label>
                  </div>

                  {selectedBuilding.hasRooms !== false && (
                    <>
                      <div className="admin-edit__row-two">
                        <div className="admin-edit__field-group">
                          <label className="admin-edit__label">
                            Number of Floors
                          </label>
                          <input
                            type="number"
                            min={1}
                            className="admin-edit__input"
                            value={selectedBuilding.floors}
                            onChange={(e) =>
                              handleBuildingFloorsChange(e.target.value)
                            }
                          />
                        </div>

                        <div className="admin-edit__field-group">
                          <label className="admin-edit__label">
                            Rooms per Floor
                          </label>
                          <input
                            type="number"
                            min={1}
                            className="admin-edit__input"
                            value={selectedBuilding.roomsPerFloor}
                            onChange={(e) =>
                              handleBuildingRoomsChange(e.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="admin-edit__info-box">
                        <strong>Total Rooms:</strong>{" "}
                        {selectedBuilding.floors * selectedBuilding.roomsPerFloor}
                      </div>
                    </>
                  )}

                  <div className="admin-edit__actions-row">
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={handleDeleteBuilding}
                    >
                      Delete Building
                    </button>
                  </div>
                </div>
              )}

              {!selectedBuilding && (
                <p className="admin-edit__empty">
                  Select a building from the dropdown above to edit it
                </p>
              )}
            </Panel>

            {/* Concerns Section */}
            <Panel
              title="Concerns"
              subtitle="Select a concern to edit its subconcerns"
            >
              <div className="admin-edit__selector-row">
                <div className="admin-edit__field-group" style={{ flex: 1 }}>
                  <label className="admin-edit__label">Select Concern</label>
                  <select
                    className="admin-edit__input"
                    value={selectedConcernId}
                    onChange={(e) => setSelectedConcernId(e.target.value)}
                  >
                    <option value="">-- Select a concern --</option>
                    {concerns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleAddConcern}
                >
                  + Add New Concern
                </button>
              </div>

              {selectedConcern && (
                <div className="admin-edit__editor-card">
                  <div className="admin-edit__field-group">
                    <label className="admin-edit__label">Concern Name</label>
                    <input
                      type="text"
                      className="admin-edit__input"
                      value={selectedConcern.label}
                      placeholder="Example: Electrical"
                      onChange={(e) => handleConcernLabelChange(e.target.value)}
                    />
                  </div>

                  <div className="admin-edit__subconcerns-section">
                    <div className="admin-edit__subconcerns-head">
                      <h4>Subconcerns</h4>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleAddSubconcern}
                      >
                        + Add Subconcern
                      </button>
                    </div>

                    {(!selectedConcern.subconcerns ||
                      selectedConcern.subconcerns.length === 0) && (
                      <p className="admin-edit__empty">
                        No subconcerns yet. Click "Add Subconcern" to create one.
                      </p>
                    )}

                    {Array.isArray(selectedConcern.subconcerns) &&
                      selectedConcern.subconcerns.map((sub, idx) => (
                        <div key={idx} className="admin-edit__subconcern-row">
                          <input
                            type="text"
                            className="admin-edit__input"
                            value={sub}
                            placeholder="Example: Walls"
                            onChange={(e) =>
                              handleSubconcernChange(idx, e.target.value)
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => handleDeleteSubconcern(idx)}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                  </div>

                  <div className="admin-edit__actions-row">
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={handleDeleteConcern}
                    >
                      Delete Concern
                    </button>
                  </div>
                </div>
              )}

              {!selectedConcern && (
                <p className="admin-edit__empty">
                  Select a concern from the dropdown above to edit it
                </p>
              )}
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
}