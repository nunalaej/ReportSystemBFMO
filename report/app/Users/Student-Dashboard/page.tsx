// app/Users/Student-Dashboard/page.tsx

import "./Student-Db.css";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function StudentDashboard() {
  // auth() is async in your version
  const { userId } = await auth();

  // If not logged in, kick back to home/login
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
          <Link href="/Users/Create-Report">
            <button className="student-dashboard__btn-primary">
              Create New Report
            </button>
          </Link>

          <Link href="/Users/View-Reports">
            <button className="student-dashboard__btn-secondary">
              View Created Reports
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
