"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import "@/app/style/dashboard.css";

export default function StudentDashboard() {
  const { user, isLoaded } = useUser();
  const [firstName, setFirstName] = useState("Student");

  useEffect(() => {
    if (isLoaded && user) {
      // Try Clerk firstName
      if (user.firstName && user.firstName.trim() !== "") {
        setFirstName(user.firstName);
        return;
      }

      // Otherwise extract from email
      const email =
        user.primaryEmailAddress?.emailAddress ||
        user.emailAddresses[0]?.emailAddress ||
        "";

      if (email.includes("@")) {
        setFirstName(email.split("@")[0]);
      }
    }
  }, [isLoaded, user]);

  return (
    <div className="dashboard-container">
      <main className="dashboard-main">
        {/* Top welcome / intro */}
        <section className="dashboard-welcome">
          <p className="dashboard-eyebrow">Student Portal</p>
          <h1 className="dashboard-title">Hello, {firstName}</h1>
          <p className="dashboard-description">
            This is your student dashboard. You can create and view your BFMO
            reports here.
          </p>
        </section>

        {/* Card grid */}
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">Quick actions</h2>

          <div className="dashboard-cards">
            {/* Create Report */}
            <Link href="/Student/CreateReport" className="card1">
              <div className="card-inner">
                <div className="card-icon-badge">
                  <span className="card-icon">📝</span>
                </div>
                <h3 className="card-title">Create Report</h3>
                <p className="card-text">
                  Submit a new BFMO request or concern, including building,
                  room, and a clear description of the issue.
                </p>
              </div>
            </Link>

            {/* View Reports */}
            <Link href="/Student/ViewReports" className="card1">
              <div className="card-inner">
                <div className="card-icon-badge">
                  <span className="card-icon">📂</span>
                </div>
                <h3 className="card-title">My Reports</h3>
                <p className="card-text">
                  Track the status of your submitted reports and see which
                  issues are in progress or resolved.
                </p>
              </div>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
