// Frontend/app/Admin/Analytics.tsx - WITH EDITABLE SERVER TASKS
"use client";

import "@/app/Admin/style/analytics.css";

import React, { FC, useState, useEffect, useMemo, useCallback } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE && 
  process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) || "http://localhost:5000";

/* ===== Types ===== */

interface Task {
  id: string;
  text: string;
  done: boolean;
}

interface Assignment {
  _id?: string;
  id?: string;
  name: string;
  concernType: "Mechanical" | "Civil" | "Electrical" | "Safety Hazard" | "Other";
  reportId?: string;
  assignedStaff: string[];
  status: "Pending" | "Waiting for Materials" | "In Progress" | "Resolved";
  checklist: Task[];
  createdAt?: string;
}

interface Report {
  _id?: string;
  reportId?: string;
  userType?: string;
  email?: string;
  heading?: string;
  concern?: string;
  building?: string;
  college?: string;
  status?: string;
  createdAt?: string;
}

/* ===== MAIN COMPONENT ===== */

const Analytics: FC = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [canView, setCanView] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { router.replace("/"); return; }
    const rawRole = (user.publicMetadata as any)?.role;
    let role = "student";
    if (Array.isArray(rawRole) && rawRole.length > 0) role = String(rawRole[0]).toLowerCase();
    else if (typeof rawRole === "string") role = rawRole.toLowerCase();
    if (role !== "admin") { router.replace("/Student"); return; }
    setCanView(true);
  }, [isLoaded, isSignedIn, user, router]);

  /* =========================================================
    DATA & STATE
  ========================================================= */
  const [reports, setReports] = useState<Report[]>([]);
  const [serverTasks, setServerTasks] = useState<Assignment[]>([]);
  const [listsOpen, setListsOpen] = useState<boolean>(false);
  const [listSaveStatus, setListSaveStatus] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);

  const [newAssignment, setNewAssignment] = useState<Assignment>({
    name: "", concernType: "Mechanical", reportId: "",
    assignedStaff: [], status: "Pending", checklist: [],
  });

  const uid = useCallback(
    () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    [],
  );

  /* Fetch Reports */
  const fetchReports = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`${API_BASE}/api/reports`, {
        cache: "no-store", signal,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      const list: Report[] = Array.isArray(data.reports) ? data.reports : [];
      setReports(list);
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    }
  }, []);

  /* Fetch Server Tasks */
  const loadTasksFromServer = useCallback(async () => {
    if (!user?.id) return;
    setLoadingTasks(true);
    setListSaveStatus("Loading tasks…");
    try {
      const res = await fetch(`${API_BASE}/api/liststask?userId=${encodeURIComponent(user.id)}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      const tasks: Assignment[] = Array.isArray(data.tasks) ? data.tasks : [];
      setServerTasks(tasks);
      setListSaveStatus(`✅ Loaded ${tasks.length} task(s)!`);
    } catch (e: any) {
      console.error("Error loading tasks:", e);
      setListSaveStatus(`❌ Load failed`);
    } finally {
      setLoadingTasks(false);
      setTimeout(() => setListSaveStatus(""), 3000);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!canView) return;
    const ctrl = new AbortController();
    fetchReports(ctrl.signal);
    return () => ctrl.abort();
  }, [canView, fetchReports]);

  useEffect(() => {
    if (user?.id && listsOpen) {
      loadTasksFromServer();
    }
  }, [user?.id, listsOpen, loadTasksFromServer]);

  /* =========================================================
    TASK CRUD OPERATIONS
  ========================================================= */

  const createAssignment = useCallback(async (assignment: Assignment) => {
    if (!user?.id) { setListSaveStatus("❌ Not signed in"); return; }
    setListSaveStatus("Saving…");
    try {
      const payload = {
        userId: user.id,
        name: assignment.name,
        concernType: assignment.concernType,
        reportId: assignment.reportId || null,
        assignedStaff: assignment.assignedStaff,
        status: assignment.status,
        checklist: assignment.checklist,
      };

      const res = await fetch(`${API_BASE}/api/liststask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create task");
      setListSaveStatus("✅ Task created!");
      loadTasksFromServer();
    } catch (e: any) {
      setListSaveStatus(`❌ ${e?.message || "Save failed"}`);
    } finally {
      setTimeout(() => setListSaveStatus(""), 3000);
    }
  }, [user?.id, loadTasksFromServer]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Assignment>) => {
    if (!user?.id) { setListSaveStatus("❌ Not signed in"); return; }
    setListSaveStatus("Updating…");
    try {
      const res = await fetch(`${API_BASE}/api/liststask/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update task");
      
      // Update local state
      setServerTasks((prev) =>
        prev.map((t) => t._id === taskId ? { ...t, ...updates } : t)
      );
      
      setListSaveStatus("✅ Updated!");
      setEditingTaskId(null);
    } catch (e: any) {
      setListSaveStatus(`❌ ${e?.message || "Update failed"}`);
    } finally {
      setTimeout(() => setListSaveStatus(""), 3000);
    }
  }, [user?.id]);

  const toggleChecklistItem = useCallback(async (taskId: string, itemId: string, done: boolean) => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/liststask/${taskId}/checklist/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      if (!res.ok) throw new Error("Failed to update");
      
      // Update local state
      setServerTasks((prev) =>
        prev.map((t) =>
          t._id === taskId
            ? {
                ...t,
                checklist: t.checklist.map((c) =>
                  c.id === itemId ? { ...c, done } : c
                ),
              }
            : t
        )
      );
    } catch (e) {
      console.error("Error toggling checklist:", e);
    }
  }, [user?.id]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    if (!user?.id) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/liststask/${taskId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to delete");
      
      setServerTasks((prev) => prev.filter((t) => t._id !== taskId));
      setListSaveStatus("✅ Task deleted!");
      setTimeout(() => setListSaveStatus(""), 2000);
    } catch (e: any) {
      setListSaveStatus(`❌ Delete failed`);
    }
  }, [user?.id]);

  const updateTaskStatus = useCallback(async (taskId: string, status: Assignment["status"]) => {
    await updateTask(taskId, { status });
  }, [updateTask]);

  /* =========================================================
    RENDER
  ========================================================= */

  if (!isLoaded || !canView) {
    return <div className="analytics-wrapper"><div className="analytics-container"><p className="note">Checking permissions...</p></div></div>;
  }

  return (
    <div className="analytics-wrapper">
      <div className="analytics-container">
        <header className="analytics-header">
          <div>
            <div className="analytics-title">
              <h1>Analytics Dashboard</h1>
              <p className="subtitle">Insights from BFMO Report System</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="pa-btn" onClick={() => setListsOpen(true)}>
              Open Tasks Panel
            </button>
          </div>
        </header>
      </div>

      {/* ── SIDE PANEL WITH EDITABLE TASKS ── */}
      {listsOpen && (
        <>
          <div
            className="sidepanel is-open"
            style={{
              position: "fixed", right: 0, top: 0, bottom: 0, width: "400px", maxWidth: "90vw",
              background: "#0f172a", borderLeft: "1px solid #1e293b", zIndex: 400,
              display: "flex", flexDirection: "column", boxShadow: "-2px 0 10px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1rem", borderBottom: "1px solid #1e293b",
            }}>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "#f9fafb" }}>Server Tasks</h3>
              <button onClick={() => setListsOpen(false)} style={{
                background: "none", border: "none", color: "#9ca3af", fontSize: 24,
                cursor: "pointer", padding: 0, width: 24, height: 24,
              }}>×</button>
            </div>

            <div style={{
              display: "flex", gap: "8px", padding: "1rem",
              borderBottom: "1px solid #1e293b", flexShrink: 0,
            }}>
              <button className="pa-btn" onClick={() => {
                setNewAssignment({
                  name: "", concernType: "Mechanical", reportId: "",
                  assignedStaff: [], status: "Pending", checklist: [],
                });
                setShowModal(true);
              }} style={{ flex: 1 }}>+ Create Task</button>

              {listSaveStatus && (
                <span style={{
                  fontSize: 11, padding: "6px 8px", borderRadius: 6,
                  background: listSaveStatus.startsWith("✅") ? "#dcfce7" : "#fee2e2",
                  color: listSaveStatus.startsWith("✅") ? "#166534" : "#991b1b",
                  whiteSpace: "nowrap",
                }}>
                  {listSaveStatus}
                </span>
              )}
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {loadingTasks ? (
                <p style={{ color: "#9ca3af", fontSize: "12px" }}>Loading tasks…</p>
              ) : serverTasks.length === 0 ? (
                <p style={{ color: "#6b7280", fontSize: "13px", textAlign: "center" }}>No tasks yet</p>
              ) : (
                serverTasks.map((task) => (
                  <div
                    key={task._id}
                    style={{
                      background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
                      padding: "1rem", position: "relative",
                    }}
                  >
                    {editingTaskId === task._id ? (
                      /* ── EDIT MODE ── */
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <input
                          type="text"
                          value={task.name}
                          onChange={(e) => setServerTasks((prev) =>
                            prev.map((t) => t._id === task._id ? { ...t, name: e.target.value } : t)
                          )}
                          style={{
                            padding: "6px", borderRadius: 4, border: "1px solid #334155",
                            background: "#0f172a", color: "#f9fafb", fontSize: "13px",
                          }}
                        />

                        <select
                          value={task.status}
                          onChange={(e) => updateTaskStatus(task._id!, e.target.value as Assignment["status"])}
                          style={{
                            padding: "6px", borderRadius: 4, border: "1px solid #334155",
                            background: "#0f172a", color: "#f9fafb", fontSize: "13px",
                          }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Waiting for Materials">Waiting for Materials</option>
                          <option value="Resolved">Resolved</option>
                        </select>

                        <textarea
                          placeholder="Assigned staff (comma separated)"
                          defaultValue={task.assignedStaff.join(", ")}
                          onBlur={(e) => updateTask(task._id!, {
                            assignedStaff: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })}
                          style={{
                            padding: "6px", borderRadius: 4, border: "1px solid #334155",
                            background: "#0f172a", color: "#f9fafb", fontSize: "12px",
                            minHeight: "60px", fontFamily: "inherit",
                          }}
                        />

                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => {
                              updateTask(task._id!, { name: task.name });
                              setEditingTaskId(null);
                            }}
                            style={{
                              flex: 1, padding: "6px", fontSize: "11px", background: "#10b981",
                              color: "#fff", border: "none", borderRadius: 4, cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTaskId(null)}
                            style={{
                              flex: 1, padding: "6px", fontSize: "11px", background: "#6b7280",
                              color: "#fff", border: "none", borderRadius: 4, cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── VIEW MODE ── */
                      <>
                        <div style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "start", marginBottom: "8px",
                        }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#f9fafb", fontWeight: 600 }}>
                              {task.name}
                            </h4>
                            <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>
                              {task.concernType} • {task.status}
                            </p>
                          </div>
                          <button
                            onClick={() => setEditingTaskId(task._id!)}
                            style={{
                              background: "none", border: "none", color: "#9ca3af",
                              cursor: "pointer", fontSize: "14px", padding: "2px 4px",
                            }}
                            title="Edit"
                          >
                            ✏️
                          </button>
                        </div>

                        {task.assignedStaff.length > 0 && (
                          <p style={{ margin: "6px 0", fontSize: "11px", color: "#cbd5e1" }}>
                            👤 {task.assignedStaff.join(", ")}
                          </p>
                        )}

                        {task.checklist.length > 0 && (
                          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #334155" }}>
                            {task.checklist.map((item) => (
                              <div key={item.id} style={{
                                display: "flex", alignItems: "center", gap: "6px",
                                marginBottom: "4px", fontSize: "12px",
                              }}>
                                <input
                                  type="checkbox"
                                  checked={!!item.done}
                                  onChange={(e) => toggleChecklistItem(task._id!, item.id, e.target.checked)}
                                />
                                <span style={{
                                  flex: 1, textDecoration: item.done ? "line-through" : "none",
                                  color: "#cbd5e1", opacity: item.done ? 0.6 : 1,
                                }}>
                                  {item.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={() => deleteTask(task._id!)}
                          style={{
                            marginTop: "8px", width: "100%", padding: "4px",
                            fontSize: "11px", background: "#ef4444", color: "#fff",
                            border: "none", borderRadius: 4, cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            onClick={() => setListsOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(2px)", pointerEvents: listsOpen ? "auto" : "none",
            }}
            aria-hidden="true"
          />
        </>
      )}

      {/* ── CREATE TASK MODAL ── */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 500,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16,
              padding: "1.5rem", width: "100%", maxWidth: 500,
              display: "flex", flexDirection: "column", gap: "0.75rem",
              maxHeight: "90vh", overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: "1rem", color: "#f9fafb" }}>Create Task</h3>

            <input
              className="input"
              placeholder="Task name"
              value={newAssignment.name}
              onChange={(e) => setNewAssignment({ ...newAssignment, name: e.target.value })}
              style={{
                padding: "8px", borderRadius: 4, border: "1px solid #334155",
                background: "#1e293b", color: "#f9fafb", fontSize: "13px",
              }}
            />

            <select
              value={newAssignment.concernType}
              onChange={(e) => setNewAssignment({ ...newAssignment, concernType: e.target.value as Assignment["concernType"] })}
              style={{
                padding: "8px", borderRadius: 4, border: "1px solid #334155",
                background: "#1e293b", color: "#f9fafb", fontSize: "13px",
              }}
            >
              <option value="Mechanical">Mechanical</option>
              <option value="Civil">Civil</option>
              <option value="Electrical">Electrical</option>
              <option value="Safety Hazard">Safety Hazard</option>
              <option value="Other">Other</option>
            </select>

            <select
              value={newAssignment.reportId || ""}
              onChange={(e) => setNewAssignment({ ...newAssignment, reportId: e.target.value })}
              style={{
                padding: "8px", borderRadius: 4, border: "1px solid #334155",
                background: "#1e293b", color: "#f9fafb", fontSize: "13px",
              }}
            >
              <option value="">— Link to Report (optional) —</option>
              {reports.map((r) => (
                <option key={r._id} value={r.reportId}>{r.reportId} – {r.concern}</option>
              ))}
            </select>

            <input
              placeholder="Assigned staff (comma separated)"
              defaultValue={newAssignment.assignedStaff.join(", ")}
              onBlur={(e) => setNewAssignment({
                ...newAssignment,
                assignedStaff: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })}
              style={{
                padding: "8px", borderRadius: 4, border: "1px solid #334155",
                background: "#1e293b", color: "#f9fafb", fontSize: "13px",
              }}
            />

            <select
              value={newAssignment.status}
              onChange={(e) => setNewAssignment({ ...newAssignment, status: e.target.value as Assignment["status"] })}
              style={{
                padding: "8px", borderRadius: 4, border: "1px solid #334155",
                background: "#1e293b", color: "#f9fafb", fontSize: "13px",
              }}
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Waiting for Materials">Waiting for Materials</option>
              <option value="Resolved">Resolved</option>
            </select>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  if (!newAssignment.name.trim()) { alert("Please enter a task name."); return; }
                  createAssignment(newAssignment);
                  setNewAssignment({
                    name: "", concernType: "Mechanical", reportId: "",
                    assignedStaff: [], status: "Pending", checklist: [],
                  });
                  setShowModal(false);
                }}
                style={{
                  flex: 1, padding: "8px", fontSize: "13px", background: "#10b981",
                  color: "#fff", border: "none", borderRadius: 4, cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Save Task
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1, padding: "8px", fontSize: "13px", background: "#6b7280",
                  color: "#fff", border: "none", borderRadius: 4, cursor: "pointer",
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
};

export default Analytics;