// app/Student/Dashboard/page.tsx

import "./Student-Db.css";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function StudentDashboard() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <div className="create-scope student-dashboard">
      <main className="student-dashboard__panel">
        <h1 className="student-dashboard__title">Student Dashboard</h1>
        <p className="student-dashboard__subtitle">
          What would you like to do today?
        </p>

        <div className="student-dashboard__actions">
          {/* Adjust this href to where your Create page actually lives */}
          <Link href="/Student/create">
            <button className="student-dashboard__btn-primary">
              Create New Report
            </button>
          </Link>

          <Link href="/ReportDataList">
            <button className="student-dashboard__btn-secondary">
              View Created Reports
            </button>
          </Link>
        </div>

        {/* Here is where the data from /api/getAllData shows up */}
        <section style={{ marginTop: 32 }}></section>
      </main>
    </div>
  );
}
