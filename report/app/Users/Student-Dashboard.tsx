"use client";
import './style/Student-Db.css';
import Link from "next/link";

export default function StudentDashboard() {
  return (
    <div className="create-scope create-scope__layout" style={{ paddingTop: 60 }}>
      <main
        className="create-scope__panel"
        style={{
          maxWidth: 520,
          width: "100%",
          padding: 24,
          borderRadius: 16,
        }}
      >
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 20,
            color: "var(--text)"
          }}
        >
          Student Dashboard
        </h1>

        <p
          style={{
            fontSize: 14,
            marginBottom: 30,
            color: "var(--text-2)"
          }}
        >
          What would you like to do today?
        </p>

        {/* ACTION BUTTONS */}
        <div style={{ display: "grid", gap: 16 }}>
          
          {/* CREATE REPORT BUTTON */}
          <Link href="/Users/Create-Report">
            <button
              className="create-scope__btn create-scope__btn--primary create-scope__w-full"
              style={{ padding: "16px 20px", fontSize: 16 }}
            >
              Create New Report
            </button>
          </Link>

          {/* VIEW REPORTS BUTTON */}
          <Link href="/Users/View-Reports">
            <button
              className="create-scope__btn create-scope__btn--ghost create-scope__w-full"
              style={{ padding: "16px 20px", fontSize: 16 }}
            >
              View Created Reports
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
