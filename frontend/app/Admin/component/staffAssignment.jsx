// Frontend/components/StaffAssignmentClerk.jsx
import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import "./StaffAssignment.css";

/**
 * StaffAssignment Component with Clerk Integration
 * Multi-staff assignment using Clerk user IDs
 *
 * Props:
 *   reportId: string - The report ID to assign staff to
 *   onAssignmentChange: (assignedStaff) => void - Callback when assignment changes
 */

const StaffAssignment = ({ reportId, onAssignmentChange }) => {
  const { user: currentUser } = useUser();
  const [assignedStaff, setAssignedStaff] = useState([]);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandPanel, setExpandPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  // Fetch available staff on mount
  useEffect(() => {
    fetchAvailableStaff();
  }, []);

  // Fetch assigned staff when reportId changes
  useEffect(() => {
    if (reportId) {
      fetchAssignedStaff();
    }
  }, [reportId]);

  /* ============================================================
     FETCH AVAILABLE STAFF FROM CLERK
  ============================================================ */
  const fetchAvailableStaff = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/staff-assignment/available-staff", {
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        // Filter out current user (optional)
        const filtered = data.staff.filter(
          (s) => s.staffId !== currentUser?.id
        );
        setAvailableStaff(filtered);
      } else {
        setError("Failed to load staff members");
      }
    } catch (error) {
      console.error("Failed to fetch available staff:", error);
      setError("Error loading staff members");
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     FETCH ASSIGNED STAFF FOR THIS REPORT
  ============================================================ */
  const fetchAssignedStaff = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/staff-assignment/${reportId}`
      );
      const data = await response.json();

      if (data.success) {
        setAssignedStaff(data.assignedStaff || []);
      } else {
        setError("Failed to load assigned staff");
      }
    } catch (error) {
      console.error("Failed to fetch assigned staff:", error);
      setError("Error loading assigned staff");
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     HANDLE STAFF CHECKBOX CHANGE
  ============================================================ */
  const handleStaffToggle = async (staff) => {
    const isAssigned = assignedStaff.some(
      (s) => s.staffId === staff.staffId
    );

    try {
      setLoading(true);
      setError("");

      if (isAssigned) {
        // UNASSIGN
        const response = await fetch("/api/staff-assignment/unassign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId,
            staffClerkId: staff.staffId,
          }),
        });

        const data = await response.json();
        if (data.success) {
          setAssignedStaff(data.assignedStaff || []);
          onAssignmentChange?.(data.assignedStaff || []);
        } else {
          setError(data.message || "Failed to unassign staff");
        }
      } else {
        // ASSIGN
        const response = await fetch("/api/staff-assignment/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId,
            staffClerkId: staff.staffId,
            role: "Assigned Staff",
          }),
        });

        const data = await response.json();
        if (data.success) {
          setAssignedStaff(data.assignedStaff || []);
          onAssignmentChange?.(data.assignedStaff || []);
        } else {
          setError(data.message || "Failed to assign staff");
        }
      }
    } catch (error) {
      console.error("Failed to update staff assignment:", error);
      setError("Error updating assignment");
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     BULK ASSIGN SELECTED STAFF
  ============================================================ */
  const handleBulkAssign = async (selectedStaffIds) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/staff-assignment/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          staffClerkIds: selectedStaffIds,
          role: "Assigned Staff",
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAssignedStaff(data.assignedStaff || []);
        onAssignmentChange?.(data.assignedStaff || []);
      } else {
        setError(data.message || "Failed to bulk assign staff");
      }
    } catch (error) {
      console.error("Failed to bulk assign staff:", error);
      setError("Error assigning staff");
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     UPDATE STAFF ROLE
  ============================================================ */
  const handleRoleChange = async (staffClerkId, newRole) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/staff-assignment/update-role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          staffClerkId,
          newRole,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAssignedStaff(data.assignedStaff || []);
        onAssignmentChange?.(data.assignedStaff || []);
      } else {
        setError(data.message || "Failed to update role");
      }
    } catch (error) {
      console.error("Failed to update staff role:", error);
      setError("Error updating role");
    } finally {
      setLoading(false);
    }
  };

  // Filter available staff based on search
  const filteredStaff = availableStaff.filter((staff) => {
    const query = searchQuery.toLowerCase();
    return (
      (staff.staffName || "").toLowerCase().includes(query) ||
      (staff.email || "").toLowerCase().includes(query)
    );
  });

  // Check if staff is assigned
  const isStaffAssigned = (staffId) =>
    assignedStaff.some((s) => s.staffId === staffId);

  return (
    <div className="staff-assignment-container">
      <div className="staff-assignment-header">
        <h3>Assign Staff to Report</h3>
        <button
          className="expand-btn"
          onClick={() => setExpandPanel(!expandPanel)}
          title={expandPanel ? "Collapse" : "Expand"}
        >
          {expandPanel ? "▼" : "▶"}
        </button>
      </div>

      {expandPanel && (
        <div className="staff-assignment-panel">
          {/* Error Message */}
          {error && (
            <div className="error-message">
              <span>⚠️ {error}</span>
              <button
                className="error-close"
                onClick={() => setError("")}
              >
                ✕
              </button>
            </div>
          )}

          {/* Assigned Staff Section */}
          <div className="assigned-staff-section">
            <h4>Currently Assigned ({assignedStaff.length})</h4>
            <div className="assigned-staff-list">
              {assignedStaff.length > 0 ? (
                assignedStaff.map((staff) => (
                  <div key={staff.staffId} className="assigned-staff-item">
                    <div className="staff-info">
                      <span className="staff-name">{staff.staffName}</span>
                      <span className="staff-email">{staff.staffEmail}</span>

                      {/* Role Selector */}
                      <select
                        className="role-select"
                        value={staff.role}
                        onChange={(e) =>
                          handleRoleChange(staff.staffId, e.target.value)
                        }
                        disabled={loading}
                        title="Change staff role"
                      >
                        <option value="Assigned Staff">Assigned Staff</option>
                        <option value="Lead Technician">Lead Technician</option>
                        <option value="Support Staff">Support Staff</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Inspector">Inspector</option>
                      </select>

                      {/* Assignment Info */}
                      <span className="assignment-info">
                        Assigned by {staff.assignedByName || staff.assignedBy}
                      </span>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() =>
                        handleStaffToggle({
                          staffId: staff.staffId,
                          staffName: staff.staffName,
                          email: staff.staffEmail,
                        })
                      }
                      disabled={loading}
                      title="Remove staff"
                    >
                      ✕
                    </button>
                  </div>
                ))
              ) : (
                <p className="no-assigned">No staff assigned to this report</p>
              )}
            </div>
          </div>

          {/* Available Staff Section */}
          <div className="available-staff-section">
            <h4>Available Staff ({availableStaff.length})</h4>

            {/* Search */}
            <div className="search-box">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                disabled={loading}
              />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery("")}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Staff Count */}
            {filteredStaff.length < availableStaff.length && (
              <div className="search-info">
                Showing {filteredStaff.length} of {availableStaff.length}
              </div>
            )}

            {/* Staff Checkboxes */}
            <div className="staff-checkboxes">
              {filteredStaff.length > 0 ? (
                filteredStaff.map((staff) => (
                  <label key={staff.staffId} className="staff-checkbox">
                    <input
                      type="checkbox"
                      checked={isStaffAssigned(staff.staffId)}
                      onChange={() => handleStaffToggle(staff)}
                      disabled={loading}
                    />
                    <span className="checkbox-label">
                      <span className="staff-name">{staff.staffName}</span>
                      <span className="staff-email">{staff.email}</span>
                      {staff.role && (
                        <span className="staff-role">{staff.role}</span>
                      )}
                    </span>
                  </label>
                ))
              ) : searchQuery ? (
                <p className="no-staff">
                  No staff members match "{searchQuery}"
                </p>
              ) : (
                <p className="no-staff">Loading staff members...</p>
              )}
            </div>
          </div>

          {loading && <div className="loading-indicator">Updating...</div>}
        </div>
      )}
    </div>
  );
};

export default StaffAssignment;