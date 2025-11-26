const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export async function fetchReports() {
  const res = await fetch(`${API_BASE}/api/reports`, {
    // avoid caching so you always see latest
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch reports: ${res.status}`);
  }

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message || "Failed to load reports");
  }

  return data.reports as any[];
}
