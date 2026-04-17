"use client";

import React, { FC, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import "@/app/style/nav.css";

const HeaderNav: FC = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const role = useMemo(() => {
    if (!isLoaded || !isSignedIn || !user) return "guest";
    const rawRole = (user.publicMetadata as any)?.role;

    let r = "student";
    if (Array.isArray(rawRole) && rawRole.length > 0)
      r = String(rawRole[0]).toLowerCase();
    else if (typeof rawRole === "string")
      r = rawRole.toLowerCase();

    return r;
  }, [isLoaded, isSignedIn, user]);

  if (!isLoaded || !isSignedIn) return null;

  // ✅ STUDENT NAV
  if (role === "student") {
    return (
      <nav className="input">
        <button className="value" onClick={() => router.push("/Student/Dashboard")}>
          Dashboard
        </button>
        <button className="value" onClick={() => router.push("/Student/CreateReport")}>
          Create Report
        </button>
        <button className="value" onClick={() => router.push("/Student/ViewReports")}>
          My Reports
        </button>
      </nav>
    );
  }

  // ✅ ADMIN / STAFF NAV
  const gotoReports      = () => router.push(role === "admin" ? "/Admin/Reports"   : "/Staff/Reports");
  const gotoAnalytics    = () => router.push(role === "admin" ? "/Admin/Analytics" : "/Staff/Analytics");
  const gotoTask         = () => router.push(role === "admin" ? "/Admin/Task"      : "/Staff/Task");
  const gotoAdminEdit    = () => router.push("/Admin/Edit");
  const gotoNotification = () => router.push(role === "admin" ? "/Admin/Notification" : "/Staff/Notification");
  const gotoActivityLogs = () => router.push("/Logs");

  return (
    <nav className="input">
      <button className="value" onClick={gotoReports}>Reports</button>
      <button className="value" onClick={gotoAnalytics}>Analytics</button>

      {role === "admin" && (
        <button className="value" onClick={gotoAdminEdit}>Admin Edit</button>
      )}

      <button className="value" onClick={gotoTask}>Task</button>
      <button className="value" onClick={gotoNotification}>Notification</button>
      <button className="value" onClick={gotoActivityLogs}>Logs</button>
    </nav>
  );
};

export default HeaderNav;