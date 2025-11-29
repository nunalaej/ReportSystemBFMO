"use client";

import React, { FC, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import "@/app/style/nav.css";

// Simple image icon for Activity Logs
const HistoryIcon: FC = () => (
  <img
    src="/icon.svg"          // change this path if your icon is different
    alt="Activity Logs"
    className="nav-icon"     // optional class, style it in nav.css
  />
);

interface HeaderNavProps {}

const HeaderNav: FC<HeaderNavProps> = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const role = useMemo(() => {
    if (!isLoaded || !isSignedIn || !user) return "guest";

    const rawRole = (user.publicMetadata as any)?.role;
    let r = "student";

    if (Array.isArray(rawRole) && rawRole.length > 0) {
      r = String(rawRole[0]).toLowerCase();
    } else if (typeof rawRole === "string") {
      r = rawRole.toLowerCase();
    }

    return r;
  }, [isLoaded, isSignedIn, user]);

  const gotoReports = () => router.push("/Admin/Reports");
  const gotoAnalytics = () => router.push("/Admin/Analytics");
  const gotoAdminEdit = () => router.push("/Admin/Edit");
  const gotoActivityLogs = () => router.push("/Logs"); // Logs page

  if (!isLoaded || !isSignedIn) return <div />;

  if (role !== "admin" && role !== "staff") return <div />;

  return (
    <nav className="input">
      <button className="value" onClick={gotoReports}>
        Reports
      </button>

      <button className="value" onClick={gotoAnalytics}>
        Analytics
      </button>

      {role === "admin" && (
        <button className="value" onClick={gotoAdminEdit}>
          Admin Edit
        </button>
      )}

      <button
        className="value"
        onClick={gotoActivityLogs}
        title="Activity Logs"
      >
        <HistoryIcon />
        <span style={{ marginLeft: "0.35rem" }}>Logs</span>
      </button>
    </nav>
  );
};

export default HeaderNav;
