"use client";

import React, { FC, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import "@/app/style/nav.css";

const HistoryIcon: FC = () => (
  <img src="/icon.svg" alt="Activity Logs" className="nav-icon" />
);

const HeaderNav: FC = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const role = useMemo(() => {
    if (!isLoaded || !isSignedIn || !user) return "guest";
    const rawRole = (user.publicMetadata as any)?.role;
    let r = "student";
    if (Array.isArray(rawRole) && rawRole.length > 0) r = String(rawRole[0]).toLowerCase();
    else if (typeof rawRole === "string") r = rawRole.toLowerCase();
    return r;
  }, [isLoaded, isSignedIn, user]);

  if (!isLoaded || !isSignedIn) return <div />;
  if (role !== "admin" && role !== "staff") return <div />;

  const gotoReports      = () => router.push(role === "admin" ? "/Admin/Reports"   : "/Staff/Reports");
  const gotoAnalytics    = () => router.push(role === "admin" ? "/Admin/Analytics" : "/Staff/Analytics");
  const gotoTask         = () => router.push(role === "admin" ? "/Admin/Task"      : "/Staff/Task"); // ✅ fixed
  const gotoAdminEdit    = () => router.push("/Admin/Edit");
  const gotoNotification = () => router.push("/Notification");
  const gotoActivityLogs = () => router.push("/Logs");

  return (
    <nav className="input">
      <button className="value" onClick={gotoReports}>Reports</button>
      <button className="value" onClick={gotoAnalytics}>Analytics</button>

      {/* Admin only */}
      {role === "admin" && (
        <button className="value" onClick={gotoAdminEdit}>Admin Edit</button>
      )}

      <button className="value" onClick={gotoTask}>Task</button>
      <button className="value" onClick={gotoNotification}>Notification</button>

      <button className="value" onClick={gotoActivityLogs} title="Activity Logs">
        <HistoryIcon />
        <span style={{ marginLeft: "0.35rem" }}>Logs</span>
      </button>
    </nav>
  );
};

export default HeaderNav;