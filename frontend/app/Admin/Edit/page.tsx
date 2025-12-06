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
  const [searchBuilding, setSearchBuilding] = useState("");
  const [searchConcern, setSearchConcern] = useState("");

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
    []
  );

  useEffect(() => {
    loadMeta("preferDefaults");
  }, [loadMeta]);

  const handleSave = async (scope?: "building" | "concern") => {
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
        setBuildings(
          (data.buildings as any[]).map((b: any, idx: number) => {
            const name = String(b.name || "").trim();
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

            const singleLocationLabel =
              typeof b.singleLocationLabel === "string"
                ? String(b.singleLocationLabel).trim()
                : "";

            return {
              id,
              name: name || "Unnamed",
              floors,
              roomsPerFloor,
              hasRooms,
              singleLocationLabel,
            };
          })
        );

        setConcerns(
          (data.concerns as any[]).map((c: any, idx: number) => {
            const label = String(c.label || "").trim();
            const id =
              String(c.id || "").trim() ||
              norm(label).replace(/\s+/g, "-") ||
              `concern-${idx}-${Math.random().toString(36).slice(2, 6)}`;
            const subs: string[] = Array.isArray(c.subconcerns)
              ? c.subconcerns.map((s: unknown) => String(s || "").trim())
              : [];

            return {
              id,
              label: label || "Unnamed concern",
              subconcerns: subs.filter((s: string) => s.length > 0),
            };
          })
        );
      }

      if (scope === "building") {
        setSaveMsg("Building changes saved.");
      } else if (scope === "concern") {
        setSaveMsg("Concern changes saved.");
      } else {
        setSaveMsg("All changes saved.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // building handlers
  const handleBuildingChange = (index: number, value: string) => {
    setBuildings((prev) => {
      const next = [...prev];
      const current = next[index];
      next[index] = {
        ...current,
        name: value,
      };
      return next;
    });
  };

  const handleBuildingFloorsChange = (index: number, value: string) => {
    const num = parseInt(value, 10);
    setBuildings((prev) => {
      const next = [...prev];
      const current = next[index];
      next[index] = {
        ...current,
        floors: Number.isNaN(num) || num <= 0 ? 1 : num,
      };
      return next;
    });
  };

  const handleBuildingRoomsChange = (index: number, value: string) => {
    const num = parseInt(value, 10);
    setBuildings((prev) => {
      const next = [...prev];
      const current = next[index];
      next[index] = {
        ...current,
        roomsPerFloor: Number.isNaN(num) || num <= 0 ? 1 : num,
      };
      return next;
    });
  };

  const handleBuildingHasRoomsToggle = (index: number) => {
    setBuildings((prev) => {
      const next = [...prev];
      const current = next[index];
      next[index] = {
        ...current,
        hasRooms: current.hasRooms === false ? true : false,
      };
      return next;
    });
  };

  const handleBuildingPositionChange = (index: number, value: string) => {
    setBuildings((prev) => {
      const next = [...prev];
      const current = next[index];
      next[index] = {
        ...current,
        singleLocationLabel: value,
      };
      return next;
    });
  };

  const handleAddBuilding = () => {
    const newBuilding: BuildingMeta = {
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: "",
      floors: 1,
      roomsPerFloor: 1,
      hasRooms: true,
      singleLocationLabel: "",
    };
    setBuildings((prev) => [newBuilding, ...prev]);
  };

  const handleRemoveBuilding = (index: number) => {
    setBuildings((prev) => prev.filter((_, i) => i !== index));
  };

  // concern handlers
  const handleConcernLabelChange = (index: number, value: string) => {
    setConcerns((prev) =>
      prev.map((c, i) => (i === index ? { ...c, label: value } : c))
    );
  };

  const handleAddConcern = () => {
    const newConcern: ConcernMeta = {
      id: `concern-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: "",
      subconcerns: [""],
    };
    setConcerns((prev) => [newConcern, ...prev]);
  };

  const handleRemoveConcern = (index: number) => {
    setConcerns((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubconcernChange = (
    concernIndex: number,
    subIndex: number,
    value: string
  ) => {
    setConcerns((prev) =>
      prev.map((c, ci) => {
        if (ci !== concernIndex) return c;
        const subs = Array.isArray(c.subconcerns) ? [...c.subconcerns] : [];
        subs[subIndex] = value;
        return { ...c, subconcerns: subs };
      })
    );
  };

  const handleAddSubconcern = (concernIndex: number) => {
    setConcerns((prev) =>
      prev.map((c, ci) =>
        ci === concernIndex
          ? { ...c, subconcerns: [...(c.subconcerns || []), ""] }
          : c
      )
    );
  };

  const handleRemoveSubconcern = (concernIndex: number, subIndex: number) => {
    setConcerns((prev) =>
      prev.map((c, ci) => {
        if (ci !== concernIndex) return c;
        const subs = Array.isArray(c.subconcerns) ? [...c.subconcerns] : [];
        subs.splice(subIndex, 1);
        return { ...c, subconcerns: subs };
      })
    );
  };

  const buildingRows = useMemo(() => {
    const term = norm(searchBuilding);
    return buildings
      .map((b, index) => ({ index, building: b }))
      .filter(({ building }) => norm(building.name).includes(term));
  }, [buildings, searchBuilding]);

  const concernRows = useMemo(() => {
    const term = norm(searchConcern);
    return concerns
      .map((c, index) => ({ index, concern: c }))
      .filter(({ concern }) => norm(concern.label).includes(term));
  }, [concerns, searchConcern]);

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
              Buildings, concerns, and subconcerns
            </h1>
            <p className="admin-edit__page-subtitle">
              Configure options that appear in the report form. Changes affect how students select locations and concerns when submitting tickets.
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
              }}
              disabled={saving || loading}
              title="Reset to recommended default values"
            >
              Load defaults
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadMeta("dbOnly")}
              disabled={saving || loading}
              title="Reload the values stored in the database"
            >
              Load database
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSave()}
              disabled={saving || loading}
            >
              {saving ? "Saving..." : "Save all changes"}
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
            <Panel
              title="Buildings"
              subtitle="These fill the building dropdown. Mark if a building has floors and rooms, or if it is a specific position only."
              actions={
                <>
                  <input
                    type="text"
                    className="admin-edit__input admin-edit__search"
                    placeholder="Search buildings"
                    value={searchBuilding}
                    onChange={(e) => setSearchBuilding(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddBuilding}
                  >
                    + Add building
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSave("building")}
                    disabled={saving || loading}
                  >
                    Save buildings
                  </button>
                </>
              }
            >
              {buildingRows.length === 0 && (
                <p className="admin-edit__empty">
                  No buildings match your search.
                </p>
              )}

              <div className="admin-edit__list">
                {buildingRows.map(({ index, building }) => {
                  const hasRooms = building.hasRooms !== false;
                  const totalRooms =
                    hasRooms
                      ? (building.floors || 0) * (building.roomsPerFloor || 0)
                      : 0;

                  return (
                    <div
                      key={building.id || index}
                      className="admin-edit__list-row"
                    >
                      <div className="admin-edit__field-group admin-edit__field-group-wide">
                        <label className="admin-edit__label">
                          Building name
                        </label>
                        <input
                          type="text"
                          className="admin-edit__input"
                          value={building.name}
                          placeholder="Example: CBAA"
                          onChange={(e) =>
                            handleBuildingChange(index, e.target.value)
                          }
                        />
                      </div>

                      <div className="admin-edit__field-group">
                        <label className="admin-edit__label">Floors</label>
                        <input
                          type="number"
                          min={1}
                          className="admin-edit__input admin-edit__input-small"
                          value={building.floors}
                          onChange={(e) =>
                            handleBuildingFloorsChange(index, e.target.value)
                          }
                          disabled={!hasRooms}
                        />
                      </div>

                      <div className="admin-edit__field-group">
                        <label className="admin-edit__label">
                          Rooms / floor
                        </label>
                        <input
                          type="number"
                          min={1}
                          className="admin-edit__input admin-edit__input-small"
                          value={building.roomsPerFloor}
                          onChange={(e) =>
                            handleBuildingRoomsChange(index, e.target.value)
                          }
                          disabled={!hasRooms}
                        />
                      </div>

                      <div className="admin-edit__field-group admin-edit__field-summary">
                        <span className="admin-edit__summary-label">
                          Room setup
                        </span>

                        <label className="admin-edit__switch">
                          <input
                            type="checkbox"
                            checked={hasRooms}
                            onChange={() =>
                              handleBuildingHasRoomsToggle(index)
                            }
                          />
                          <span className="admin-edit__switch-pill">
                            <span className="admin-edit__switch-knob" />
                          </span>
                          <span className="admin-edit__switch-text">
                            {hasRooms
                              ? "Has floors and rooms"
                              : "Specific position only"}
                          </span>
                        </label>

                        {hasRooms ? (
                          <>
                            <span className="admin-edit__summary-label">
                              Approx. total rooms
                            </span>
                            <span className="admin-edit__summary-value">
                              {totalRooms}
                            </span>
                          </>
                        ) : (
                          <div className="admin-edit__field-position">
                            <label className="admin-edit__label">
                              Position or area label
                            </label>
                            <input
                              type="text"
                              className="admin-edit__input"
                              placeholder="Example: Guard post, Kiosk, Open area"
                              value={building.singleLocationLabel || ""}
                              onChange={(e) =>
                                handleBuildingPositionChange(
                                  index,
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleRemoveBuilding(index)}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel
              title="Concerns and subconcerns"
              subtitle="These fill the concern and subconcern dropdowns used for report categorization."
              actions={
                <>
                  <input
                    type="text"
                    className="admin-edit__input admin-edit__search"
                    placeholder="Search concerns"
                    value={searchConcern}
                    onChange={(e) => setSearchConcern(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddConcern}
                  >
                    + Add concern
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSave("concern")}
                    disabled={saving || loading}
                  >
                    Save concerns
                  </button>
                </>
              }
            >
              {concernRows.length === 0 && (
                <p className="admin-edit__empty">
                  No concerns match your search.
                </p>
              )}

              <div className="admin-edit__concern-list">
                {concernRows.map(({ index, concern }) => (
                  <div
                    key={concern.id || index}
                    className="admin-edit__concern-card"
                  >
                    <div className="admin-edit__concern-head">
                      <div className="admin-edit__field-group">
                        <label className="admin-edit__label">
                          Concern label
                        </label>
                        <input
                          type="text"
                          className="admin-edit__input"
                          value={concern.label}
                          placeholder="Example: Electrical"
                          onChange={(e) =>
                            handleConcernLabelChange(index, e.target.value)
                          }
                        />
                      </div>

                      <div className="admin-edit__field-group">
                        <label className="admin-edit__label">
                          Concern ID
                          <span className="admin-edit__label-hint">
                            {" "}
                            (generated automatically)
                          </span>
                        </label>
                        <input
                          type="text"
                          className="admin-edit__input"
                          value={
                            concern.id ||
                            norm(concern.label).replace(/\s+/g, "-")
                          }
                          readOnly
                        />
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleRemoveConcern(index)}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="admin-edit__subconcerns">
                      <div className="admin-edit__subconcerns-head">
                        <h4>Subconcerns</h4>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleAddSubconcern(index)}
                        >
                          + Add subconcern
                        </button>
                      </div>

                      {(!concern.subconcerns ||
                        concern.subconcerns.length === 0) && (
                        <p className="admin-edit__empty">
                          No subconcerns yet for this concern.
                        </p>
                      )}

                      {Array.isArray(concern.subconcerns) &&
                        concern.subconcerns.map((s, sIndex) => (
                          <div
                            key={sIndex}
                            className="admin-edit__list-row admin-edit__list-row--compact"
                          >
                            <input
                              type="text"
                              className="admin-edit__input"
                              value={s}
                              placeholder="Example: Light not working"
                              onChange={(e) =>
                                handleSubconcernChange(
                                  index,
                                  sIndex,
                                  e.target.value
                                )
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() =>
                                handleRemoveSubconcern(index, sIndex)
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
}
