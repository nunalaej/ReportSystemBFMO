"use client";

import { useEffect, useState } from "react";
import { fetchReports, type Report } from "../../../lib/api";

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchReports();
        setReports(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load reports";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <p>Loading reports…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!reports.length) return <p>No reports yet.</p>;

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Reports</h1>
      <ul>
        {reports.map((r) => (
          <li key={r._id}>
            <strong>{r.heading}</strong> {" - "}
            {r.building || "No building"} {" - "}
            <em>{r.status}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
