"use client";

import { useRouter } from "next/navigation";
import "@/app/Admin/style/dashboard.css";

export default function AdminDashboard() {
  const router = useRouter();

  return (
    <main className="admin-dashboard">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>Only admins can access this page.</p>
      </header>

      <section className="admin-card-grid">
        <button
          className="admin-card"
          onClick={() => router.push("/Admin/Reports")}
        >
          <h2>View Reports</h2>
          <p>See all facility reports submitted by students and staff.</p>
        </button>

        <button
          className="admin-card"
          onClick={() => router.push("/Admin/Analytics")}
        >
          <h2>Analytics</h2>
          <p>Check statistics by status, building, and concern type.</p>
        </button>

        <button
          className="admin-card"
          onClick={() => router.push("/Admin/Edit")}
        >
          <h2>Admin Edit</h2>
          <p>Manage admin accounts, staff roles, and system settings.</p>
        </button>
      </section>
    </main>
  );
}
