"use client";

import { useEffect, useMemo, useState } from "react";
import "@/app/style/AdminEdit.css";
// adjust this path if your Navigation component is somewhere else

// Types
interface Concern {
  id?: string;
  label: string;
  subconcerns: string[];
}

interface MetaResponse {
  buildings?: string[];
  concerns?: Concern[];
}

interface PanelProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Same defaults as Create page, plus an "Other" subconcern for each.
 * These are used as a fallback if meta is not found in the database.
 */
const DEFAULT_BUILDINGS: string[] = [
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

const DEFAULT_CONCERNS: Concern[] = [
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

// helper lowercase trim
const norm = (v: unknown): string =>
  v == null ? "" : String(v).trim().toLowerCase();

// API base for client side
const RAW_BASE = (process.env.NEXT_PUBLIC_API_BASE || "") as string;
const TRIMMED_BASE = RAW_BASE.replace(/\/+$/, "");
const API_BASE = TRIMMED_BASE; // empty string if not set

// Final endpoint
// - If NEXT_PUBLIC_API_BASE is set: https://your-api.com/api/meta
// - Else: /api/meta (same origin)
const META_URL = "/api/meta";

// Reusable Panel
function Panel({ title, subtitle, actions, children }: PanelProps) {
  return (
    <section className="create-scope__panel admin-edit__panel">
      <header className="create-scope__panel-head admin-edit__panel-head">
        <div>
          {title && <h3 className="create-scope__panel-title">{title}</h3>}
          {subtitle && (
            <p className="create-scope__panel-subtitle">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="create-scope__panel-actions admin-edit__panel-actions">
            {actions}
          </div>
        )}
      </header>
      <div className="create-scope__panel-body admin-edit__panel-body">
        {children}
      </div>
    </section>
  );
}

export default function AdminEdit(): JSX.Element {
  const [buildings, setBuildings] = useState<string[]>(DEFAULT_BUILDINGS);
  const [concerns, setConcerns] = useState<Concern[]>(DEFAULT_CONCERNS);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [saveMsg, setSaveMsg] = useState<string>("");
  const [searchBuilding, setSearchBuilding] = useState<string>("");
  const [searchConcern, setSearchConcern] = useState<string>("");

  // ============ LOAD META FROM BACKEND ============
  useEffect(() => {
    let alive = true;

    async function loadMeta() {
      setLoading(true);
      setError("");
      console.log("[AdminEdit] Fetch meta from:", META_URL);

      try {
        const res = await fetch(META_URL, { credentials: "omit" });

        if (!res.ok) {
          const raw = await res.text().catch(() => "");
          console.error("Meta load failed:", res.status, raw);
          throw new Error(`Failed to load options. Status ${res.status}`);
        }

        const data = (await res.json()) as MetaResponse;
        console.log("[AdminEdit] Meta response:", data);

        if (!alive) return;

        const incomingBuildings =
          Array.isArray(data.buildings) && data.buildings.length
            ? data.buildings
            : DEFAULT_BUILDINGS;

        const incomingConcerns =
          Array.isArray(data.concerns) && data.concerns.length
            ? data.concerns
            : DEFAULT_CONCERNS;

        setBuildings(incomingBuildings);
        setConcerns(incomingConcerns);
      } catch (err: any) {
        console.error(err);
        if (!alive) return;
        setError(
          err?.message ||
            "Could not load buildings and concerns. Using defaults."
        );
        setBuildings(DEFAULT_BUILDINGS);
        setConcerns(DEFAULT_CONCERNS);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadMeta();

    return () => {
      alive = false;
    };
  }, []);

  // ============ SAVE META TO BACKEND ============
  async function handleSave() {
    setSaving(true);
    setError("");
    setSaveMsg("");

    const payload: MetaResponse = {
      buildings: buildings
        .map((b) => (b ?? "").trim())
        .filter((b) => b.length > 0)
        .sort((a, b) => a.localeCompare(b)),
      concerns: concerns
        .map((c) => {
          const cleanLabel = (c.label ?? "").trim();
          if (!cleanLabel) return null;

          const idFromLabel = norm(cleanLabel).replace(/\s+/g, "-");
          const subs = Array.isArray(c.subconcerns) ? c.subconcerns : [];

          return {
            id: c.id || idFromLabel,
            label: cleanLabel,
            subconcerns: subs
              .map((s) => (s ?? "").trim())
              .filter((s) => s.length > 0)
              .sort((a, b) => a.localeCompare(b)),
          } as Concern;
        })
        .filter(Boolean) as Concern[],
    };

    console.log("[AdminEdit] Saving meta to:", META_URL, payload);

    try {
      const res = await fetch(META_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        console.error("Meta save failed:", res.status, raw);
        throw new Error(raw || `Failed to save. Status ${res.status}`);
      }

      const data = (await res.json().catch(() => null)) as MetaResponse | null;
      console.log("[AdminEdit] Save response:", data);

      if (data && data.buildings && data.concerns) {
        setBuildings(data.buildings);
        setConcerns(data.concerns);
      }

      setSaveMsg("Changes saved successfully.");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  // ============ BUILDING HANDLERS ============
  function handleBuildingChange(index: number, value: string) {
    setBuildings((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleAddBuilding() {
    setBuildings((prev) => [...prev, ""]);
  }

  function handleRemoveBuilding(index: number) {
    setBuildings((prev) => prev.filter((_, i) => i !== index));
  }

  // ============ CONCERN HANDLERS ============
  function handleConcernLabelChange(index: number, value: string) {
    setConcerns((prev) =>
      prev.map((c, i) => (i === index ? { ...c, label: value } : c))
    );
  }

  function handleAddConcern() {
    setConcerns((prev) => [
      ...prev,
      {
        id: `concern-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: "",
        subconcerns: [""],
      },
    ]);
  }

  function handleRemoveConcern(index: number) {
    setConcerns((prev) => prev.filter((_, i) => i !== index));
  }

  // ============ SUBCONCERN HANDLERS ============
  function handleSubconcernChange(
    concernIndex: number,
    subIndex: number,
    value: string
  ) {
    setConcerns((prev) =>
      prev.map((c, ci) => {
        if (ci !== concernIndex) return c;
        const subs = Array.isArray(c.subconcerns) ? [...c.subconcerns] : [];
        subs[subIndex] = value;
        return { ...c, subconcerns: subs };
      })
    );
  }

  function handleAddSubconcern(concernIndex: number) {
    setConcerns((prev) =>
      prev.map((c, ci) =>
        ci === concernIndex
          ? { ...c, subconcerns: [...(c.subconcerns || []), ""] }
          : c
      )
    );
  }

  function handleRemoveSubconcern(concernIndex: number, subIndex: number) {
    setConcerns((prev) =>
      prev.map((c, ci) => {
        if (ci !== concernIndex) return c;
        const subs = Array.isArray(c.subconcerns) ? [...c.subconcerns] : [];
        subs.splice(subIndex, 1);
        return { ...c, subconcerns: subs };
      })
    );
  }

  // ============ SORT + SEARCH ============
  const buildingRows = useMemo(() => {
    const term = norm(searchBuilding);
    return buildings
      .map((name, index) => ({ index, name }))
      .filter(({ name }) => norm(name).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [buildings, searchBuilding]);

  const concernRows = useMemo(() => {
    const term = norm(searchConcern);
    return concerns
      .map((c, index) => ({ index, concern: c }))
      .filter(({ concern }) => norm(concern.label).includes(term))
      .sort((a, b) => a.concern.label.localeCompare(b.concern.label));
  }, [concerns, searchConcern]);

  // ============ UI ============
  return (
    <div className="create-scope admin-edit">
      <main className="create-scope__lay admin-edit__layout">
        <div className="create-scope__content admin-edit__content">
          <header className="create-scope__page-head admin-edit__page-head">
            <div className="admin-edit__heading">
              <span className="admin-edit__badge">Admin configuration</span>
              <h1 className="create-scope__page-title">
                Buildings and concerns
              </h1>
              <p className="create-scope__page-subtitle">
                Manage buildings, concerns, and subconcerns used in the report
                creation form. Changes are applied to the Create Report page.
              </p>
            </div>

            <div className="create-scope__page-actions admin-edit__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setBuildings(DEFAULT_BUILDINGS);
                  setConcerns(DEFAULT_CONCERNS);
                  setSaveMsg("");
                  setError("");
                }}
                disabled={saving}
              >
                Reset to defaults
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </header>

          {error && (
            <div className="create-scope__alert create-scope__alert--error">
              {error}
            </div>
          )}

          {saveMsg && (
            <div className="create-scope__alert create-scope__alert--success">
              {saveMsg}
            </div>
          )}

          {loading ? (
            <p className="admin-edit__loading">Loading options...</p>
          ) : (
            <div className="admin-edit__grid">
              {/* Buildings panel */}
              <Panel
                title="Buildings"
                subtitle="These fill the building dropdown in the Create Report page."
                actions={
                  <>
                    <input
                      type="text"
                      className="create-scope__input admin-edit__search"
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
                  </>
                }
              >
                {buildingRows.length === 0 && (
                  <p className="create-scope__empty">
                    No buildings match your search.
                  </p>
                )}

                <div className="create-scope__list">
                  {buildingRows.map(({ index, name }) => (
                    <div
                      key={index}
                      className="create-scope__list-row create-scope__list-row--compact"
                    >
                      <input
                        type="text"
                        className="create-scope__input"
                        value={name}
                        placeholder="Building name"
                        onChange={(e) =>
                          handleBuildingChange(index, e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleRemoveBuilding(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Concerns panel */}
              <Panel
                title="Concerns and subconcerns"
                subtitle="These fill the concern and subconcern dropdowns in the Create Report page."
                actions={
                  <>
                    <input
                      type="text"
                      className="create-scope__input admin-edit__search"
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
                  </>
                }
              >
                {concernRows.length === 0 && (
                  <p className="create-scope__empty">
                    No concerns match your search.
                  </p>
                )}

                <div className="create-scope__concern-list">
                  {concernRows.map(({ index, concern }) => (
                    <div
                      key={concern.id || index}
                      className="create-scope__concern-card"
                    >
                      <div className="create-scope__concern-head">
                        <div className="create-scope__field-group">
                          <label className="create-scope__label">
                            Concern label
                          </label>
                          <input
                            type="text"
                            className="create-scope__input"
                            value={concern.label || ""}
                            placeholder="Example: Electrical"
                            onChange={(e) =>
                              handleConcernLabelChange(index, e.target.value)
                            }
                          />
                        </div>

                        <div className="create-scope__field-group">
                          <label className="create-scope__label">
                            Concern ID
                            <span className="create-scope__label-hint">
                              (generated automatically)
                            </span>
                          </label>
                          <input
                            type="text"
                            className="create-scope__input"
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
                          Remove concern
                        </button>
                      </div>

                      <div className="create-scope__subconcerns">
                        <div className="create-scope__subconcerns-head">
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
                          <p className="create-scope__empty">
                            No subconcerns yet for this concern.
                          </p>
                        )}

                        {Array.isArray(concern.subconcerns) &&
                          [...concern.subconcerns]
                            .map((s, sIndex) => ({ s, sIndex }))
                            .sort((a, b) =>
                              (a.s || "").localeCompare(b.s || "")
                            )
                            .map(({ s, sIndex }) => (
                              <div
                                key={sIndex}
                                className="create-scope__list-row create-scope__list-row--compact"
                              >
                                <input
                                  type="text"
                                  className="create-scope__input"
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
        </div>
      </main>
    </div>
  );
}
