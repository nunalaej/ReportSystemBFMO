"use client";

import { useEffect, useState } from "react";
import { fetchReports } from "@/lib/api";

export default function DashboardPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const data = await fetchReports();
        setReports(data);
      } catch (err: any) {
        setError(err.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, []);

  if (loading) return <p>Loading reports…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  if (!reports.length) return <p>No reports yet.</p>;

  return (
    <div>
      <h1>Reports</h1>
      <ul>
        {reports.map((r: any) => (
          <li key={r._id}>
            <strong>{r.heading}</strong> – {r.building} –{" "}
            <span>{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
