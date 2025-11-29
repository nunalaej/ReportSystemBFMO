"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import "@/app/style/logs.css";

type Comment = {
  text?: string;
  comment?: string;
  at?: string;
  by?: string;
};

type Report = {
  _id: string;
  email?: string;
  heading?: string;
  description?: string;
  concern?: string;
  subConcern?: string;
  otherConcern?: string;
  building?: string;
  otherBuilding?: string;
  college?: string;
  floor?: string;
  room?: string;
  otherRoom?: string;
  image?: string;
  status?: string;
  createdAt?: string;
  comments?: Comment[];
};

type CollegeEntry = {
  college: string;
  count: number;
};

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "")) ||
  "";

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getBaseConcern(r: Report) {
  const base = (r.concern || "Unspecified").trim();
  return base || "Unspecified";
}

const ActivityLogsPage = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Resolve role
  const role = useMemo(() => {
    if (!isLoaded || !isSignedIn || !user) return "guest";

    const rawRole = (user.publicMetadata as any)?.role;
    let r = "student";

    if (Array.isArray(rawRole) && rawRole.length > 0) {
      r = String(rawRole[0]).toLowerCase();
    } else if (typeof rawRole === "string") {
      r = rawRole.toLowerCase();
    }

    return r; // "admin", "staff", "student", etc.
  }, [isLoaded, isSignedIn, user]);

  // Protect page for admin + staff only
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) {
      router.replace("/");
      return;
    }

    if (role !== "admin" && role !== "staff") {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, user, role, router]);

  // Fetch reports
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const fetchReports = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const res = await fetch(`${API_BASE}/api/reports`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data) {
          setLoadError(
            data?.message || "Could not load reports for activity logs."
          );
          setReports([]);
          return;
        }

        let list: Report[] = [];

        if (Array.isArray(data)) {
          list = data;
        } else if (Array.isArray(data.reports)) {
          list = data.reports;
        } else if (Array.isArray(data.data)) {
          list = data.data;
        } else {
          setLoadError("Unexpected reports payload for activity logs.");
          setReports([]);
          return;
        }

        setReports(list);
      } catch (err) {
        console.error("Error fetching reports for logs:", err);
        setLoadError("Network error while loading activity logs.");
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [isLoaded, isSignedIn]);

  // Compute today's logs
  const today = useMemo(() => new Date(), []);
  const todayReports = useMemo(() => {
    return reports.filter((r) => {
      if (!r.createdAt) return false;
      const created = new Date(r.createdAt);
      if (Number.isNaN(created.getTime())) return false;
      return sameCalendarDay(created, today);
    });
  }, [reports, today]);

  const firstReportToday = useMemo(() => {
    if (!todayReports.length) return null;
    const sorted = [...todayReports].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });
    return sorted[0];
  }, [todayReports]);

  // Count by college with safe trimming
  const collegeCounts = useMemo(() => {
    const map = new Map<string, number>();

    todayReports.forEach((r) => {
      const college =
        typeof r.college === "string" && r.college.trim().length > 0
          ? r.college.trim()
          : "Unspecified";

      map.set(college, (map.get(college) || 0) + 1);
    });

    return map;
  }, [todayReports]);

  // Pick the college with highest count
  const topCollegeEntry = useMemo<CollegeEntry | null>(() => {
    let top: CollegeEntry | null = null;
    collegeCounts.forEach((count, college) => {
      if (!top || count > top.count) {
        top = { college, count };
      }
    });
    return top;
  }, [collegeCounts]);

  // Count Civil concerns today
  const civilCount = useMemo(() => {
    return todayReports.filter((r) => getBaseConcern(r) === "Civil").length;
  }, [todayReports]);

  // Build display logs
  const activityLogs = useMemo(() => {
    const logs: {
      id: string;
      text: string;
      clickable?: boolean;
      onClick?: () => void;
    }[] = [];

    // 1) First report today
    if (firstReportToday) {
      const heading =
        firstReportToday.heading && firstReportToday.heading.trim().length
          ? firstReportToday.heading.trim()
          : "Untitled report";

      logs.push({
        id: "first-today",
        text: `First report for today is "${heading}".`,
        clickable: true,
        onClick: () =>
          router.push(`/Admin/Reports?focus=${firstReportToday._id}`),
      });
    } else {
      logs.push({
        id: "no-today",
        text: "There are no reports created today yet.",
      });
    }

    // 2) Top college for today
    if (topCollegeEntry && topCollegeEntry.count > 0) {
      const label =
        topCollegeEntry.college === "Unspecified"
          ? "unspecified colleges"
          : topCollegeEntry.college;

      logs.push({
        id: "top-college",
        text: `There have been ${topCollegeEntry.count} reports in ${label} today.`,
      });
    }

    // 3) Civil concerns count
    if (civilCount > 0) {
      logs.push({
        id: "civil-today",
        text: `There have been ${civilCount} reports about Civil concerns today.`,
      });
    }

    // 4) Total reports today
    logs.push({
      id: "total-today",
      text: `Total reports created today: ${todayReports.length}.`,
    });

    return logs;
  }, [firstReportToday, topCollegeEntry, civilCount, todayReports, router]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="logs-wrapper">
        <p>Checking your permissions…</p>
      </div>
    );
  }

  if (role !== "admin" && role !== "staff") {
    return (
      <div className="logs-wrapper">
        <p>You do not have access to the activity logs.</p>
      </div>
    );
  }

  const roleLabel =
    role === "admin" ? "Administrator" : role === "staff" ? "Staff" : role;

  return (
    <div className="logs-wrapper">
      <header className="logs-header">
        <div>
          <h1>Activity Logs</h1>
          <p className="logs-subtitle">
            Quick summary of what is happening in the BFMO Report System today.
          </p>
        </div>
        <div className="logs-role-pill">
          Role: <strong>{roleLabel}</strong>
        </div>
      </header>

      {loadError && <div className="logs-error">{loadError}</div>}

      {loading ? (
        <p className="logs-loading">Loading activity logs…</p>
      ) : (
        <section className="logs-list">
          {activityLogs.map((log) => (
            <button
              key={log.id}
              type="button"
              onClick={log.onClick}
              disabled={!log.clickable}
              className={
                log.clickable ? "logs-item logs-item--clickable" : "logs-item"
              }
            >
              <span className="logs-item-bullet" />
              <span className="logs-item-text">{log.text}</span>
              {log.clickable && (
                <span className="logs-item-view-label">View report</span>
              )}
            </button>
          ))}
        </section>
      )}
    </div>
  );
};

export default ActivityLogsPage;
