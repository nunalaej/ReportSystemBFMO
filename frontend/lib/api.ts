// frontend/lib/api.ts

// 1. Export the Report type
export interface Report {
  _id: string;
  email?: string;
  heading: string;
  description?: string;
  concern?: string;
  subConcern?: string;
  otherConcern?: string;
  building?: string;
  otherBuilding?: string;
  college?: string;
  floor?: string;
  room?: string;
  otherRoom?: string;
  image?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

// 2. Base URL for backend
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://backendsystem-njyn.onrender.com/";

// 3. Export fetchReports
export async function fetchReports(): Promise<Report[]> {
  const res = await fetch(`${API_BASE}/api/reports`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch reports: ${res.status}`);
  }

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message || "Failed to load reports");
  }

  return data.reports as Report[];
}
