  "use client";

  import { useEffect, useState } from "react";
  import { useUser } from "@clerk/nextjs";
  import Link from "next/link";
  import "@/app/style/dashboard.css";

  export default function StudentDashboard() {
    const { user, isLoaded } = useUser();
    const [firstName, setFirstName] = useState("Student");

    useEffect(() => {
      if (!isLoaded || !user) return;

      if (user.firstName && user.firstName.trim() !== "") {
        setFirstName(user.firstName);
        return;
      }

      const email =
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        "";

      if (email.includes("@")) {
        setFirstName(email.split("@")[0]);
      }
    }, [isLoaded, user]);

    if (!isLoaded) return null;

    return (
      <div className="dashboard-container">
        <main className="dashboard-main">
          <section className="dashboard-welcome">
            <p className="dashboard-eyebrow">Student Portal</p>
            <h1 className="dashboard-title">Hello, {firstName}</h1>
          <p className="dashboard-description">
    Use this dashboard to report facility issues, upload photos, and track the
    progress of your BFMO requests in one place.
  </p>

          </section>

          <section className="dashboard-section">
            <h2 className="dashboard-section-title">Quick actions</h2>

            <div className="dashboard-cards">
              <Link href="/Student/CreateReport" className="card1">
                <div className="card-inner">
                  <div className="card-icon-badge">
                    <span className="card-icon">📝</span>
                  </div>
                  <h3 className="card-title">Create Report</h3>
                  <p className="card-text">
                    Submit a new BFMO request or concern.
                  </p>
                </div>
              </Link>

              <Link href="/Student/ViewReports" className="card1">
                <div className="card-inner">
                  <div className="card-icon-badge">
                    <span className="card-icon">📂</span>
                  </div>
                  <h3 className="card-title">My Reports</h3>
                  <p className="card-text">
                    Track the status of your submitted reports.
                  </p>
                </div>
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }
