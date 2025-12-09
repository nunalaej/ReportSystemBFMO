"use client";

import React, { FC, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import "@/app/style/nav.css";

// Simple image icon for Activity Logs
const HistoryIcon: FC = () => (
  <img src="/icon.svg" alt="Activity Logs" className="nav-icon" />
);

const HeaderNav: FC = () => {
  const router = useRouter();
  router.refresh(); // Refreshes the current route, re-fetching data

  const { user, isLoaded, isSignedIn } = useUser();

  // Determine role from Clerk metadata
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

  if (!isLoaded || !isSignedIn) return <div />;

  // Only Admin and Staff see this nav
  if (role !== "admin" && role !== "staff") return <div />;

  // Navigation handlers
  const gotoReports = () => {
    if (role === "admin") {
      router.push("/Admin/Reports");
    } else if (role === "staff") {
      router.push("/Staff/Reports");
    }
  };

  const gotoAnalytics = () => {
    if (role === "admin") {
      router.push("/Admin/Analytics");
    } else if (role === "staff") {
      router.push("/Staff/Analytics");
    }
  };

  const gotoAdminEdit = () => router.push("/Admin/Edit");
  const gotoActivityLogs = () => router.push("/Logs");

  return (
    <nav className="input">
      {/* Shared buttons for Admin and Staff */}
      <button className="value" onClick={gotoReports}>
        Reports
      </button>

      <button className="value" onClick={gotoAnalytics}>
        Analytics
      </button>

      {/* Admin only */}
      {role === "admin" && (
        <button className="value" onClick={gotoAdminEdit}>
          Admin Edit
        </button>
      )}

      {/* Logs */}
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
