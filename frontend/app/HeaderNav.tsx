"use client";

import React, { FC, useMemo, useState, useEffect, useRef, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import "@/app/style/nav.css";

const HeaderNav: FC = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [expandedNav, setExpandedNav] = useState<string | null>(null);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

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

  // Close expanded nav when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setExpandedNav(null);
        setHoveredNav(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isLoaded || !isSignedIn) return null;


  // Dashboard Icon
  const DashboardIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"></rect>
      <g>
        <path d="M3 13h8v8H3v-8zm10-10h8v8h-8V3zM3 3h8v8H3V3zm10 10h8v8h-8v-8z"></path>
      </g>
    </svg>
  );

  // Create Report Icon (Plus icon)
  const CreateIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"></rect>
      <g>
        <path d="M21 14v5c0 1.105-.895 2-2 2H5c-1.105 0-2-.895-2-2V5c0-1.105.895-2 2-2h5v2H5v14h14v-5h2z"></path>
        <path d="M21 7h-4V3h-2v4h-4v2h4v4h2V9h4"></path>
      </g>
    </svg>
  );

  // My Reports Icon
  const ReportsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"></rect>
      <g>
        <path d="M16 18H8v-2h8v2zm0-6H8v2h8v-2zm2-9h-2v2h2v15H6V5h2V3H6c-1.105 0-2 .895-2 2v15c0 1.105.895 2 2 2h12c1.105 0 2-.895 2-2V5c0-1.105-.895-2-2-2zm-4 2V4c0-1.105-.895-2-2-2s-2 .895-2 2v1c-1.105 0-2 .895-2 2v1h8V7c0-1.105-.895-2-2-2z"></path>
      </g>
    </svg>
  );

  // Analytics Icon
  const AnalyticsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"></rect>
      <g>
        <path d="M3 13h8v8H3v-8zm10-10h8v8h-8V3zM3 3h8v8H3V3zm10 10h8v8h-8v-8z"></path>
      </g>
    </svg>
  );

  // Settings/Admin Icon
  const SettingsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"></rect>
      <g>
        <path d="M12 15.5c1.933 0 3.5-1.567 3.5-3.5s-1.567-3.5-3.5-3.5-3.5 1.567-3.5 3.5 1.567 3.5 3.5 3.5zm0 2c-3.038 0-5.5-2.462-5.5-5.5S8.962 6.5 12 6.5s5.5 2.462 5.5 5.5-2.462 5.5-5.5 5.5z"></path>
        <path d="M19.5 12c0-.23-.01-.45-.03-.68l1.86-1.41-2-3.46-2.12.79c-.45-.34-.94-.62-1.47-.82L15.5 4h-4l-.24 2.42c-.53.2-1.02.48-1.47.82l-2.12-.79-2 3.46 1.86 1.41c-.02.23-.03.43-.03.68s.01.45.03.68l-1.86 1.41 2 3.46 2.12-.79c.45.34.94.62 1.47.82l.24 2.42h4l.24-2.42c.53-.2 1.02-.48 1.47-.82l2.12.79 2-3.46-1.86-1.41c.02-.23.03-.43.03-.68z"></path>
      </g>
    </svg>
  );

  // Task Icon
  const TaskIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"></rect>
      <g>
        <path d="M16 18H8v-2h8v2zm0-6H8v2h8v-2zm2-9h-2v2h2v15H6V5h2V3H6c-1.105 0-2 .895-2 2v15c0 1.105.895 2 2 2h12c1.105 0 2-.895 2-2V5c0-1.105-.895-2-2-2z"></path>
      </g>
    </svg>
  );

  // Notification Icon
  const NotificationIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"></rect>
      <g>
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.93 6 11v5l-2 2v1h16v-1l-2-2z"></path>
      </g>
    </svg>
  );

  // Logs Icon
  const LogsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"></rect>
      <g>
        <path d="M4 6h16v2H4V6zm2-4h12v2H6V2zm16 8H2v12h20V10zM4 12h16v8H4v-8z"></path>
      </g>
    </svg>
  );

  // Navigation item type
  interface NavItem {
    id: string;
    icon: ReactNode;
    label: string;
    onClick: () => void;
    isAdminOnly?: boolean;
  }

  // ✅ STUDENT NAV
  if (role === "student") {
    const studentNavItems: NavItem[] = [
      {
        id: "dashboard",
        icon: <DashboardIcon />,
        label: "Dashboard",
        onClick: () => router.push("/Student/Dashboard"),
      },
      {
        id: "create",
        icon: <CreateIcon />,
        label: "Create Report",
        onClick: () => router.push("/Student/CreateReport"),
      },
      {
        id: "reports",
        icon: <ReportsIcon />,
        label: "My Reports",
        onClick: () => router.push("/Student/ViewReports"),
      },
    ];

    return (
      <div className="nav-wrapper" ref={navRef}>
        <div className="logo-container" onClick={() => router.push("/")}>
        </div>
        <nav className="input">
          {studentNavItems.map((item) => (
            <button
              key={item.id}
              className={`value ripple ${expandedNav === item.id ? "active" : ""} ${
                hoveredNav === item.id ? "hovered" : ""
              }`}
              onClick={() => {
                setExpandedNav(expandedNav === item.id ? null : item.id);
                item.onClick();
              }}
              onMouseEnter={() => setHoveredNav(item.id)}
              onMouseLeave={() => setHoveredNav(null)}
              data-label={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span
                className={`nav-label transition-all duration-300 ${
                  expandedNav === item.id || hoveredNav === item.id
                    ? "max-w-[150px] opacity-100 ml-2"
                    : "max-w-0 opacity-0 ml-0"
                }`}
              >
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  // ✅ ADMIN / STAFF NAV
  const adminStaffNavItems: NavItem[] = [
    {
      id: "reports",
      icon: <ReportsIcon />,
      label: "Reports",
      onClick: () => router.push(role === "admin" ? "/Admin/Reports" : "/Staff/Reports"),
    },
    {
      id: "analytics",
      icon: <AnalyticsIcon />,
      label: "Analytics",
      onClick: () => router.push(role === "admin" ? "/Admin/Analytics" : "/Staff/Analytics"),
    },
    {
      id: "adminedit",
      icon: <SettingsIcon />,
      label: "Admin Edit",
      onClick: () => router.push("/Admin/Edit"),
      isAdminOnly: true,
    },
    {
      id: "task",
      icon: <TaskIcon />,
      label: "Task",
      onClick: () => router.push(role === "admin" ? "/Admin/Task" : "/Staff/Task"),
    },
    {
      id: "notification",
      icon: <NotificationIcon />,
      label: "Notification",
      onClick: () => router.push(role === "admin" ? "/Admin/Notification" : "/Staff/Notification"),
    },
    {
      id: "logs",
      icon: <LogsIcon />,
      label: "Logs",
      onClick: () => router.push("/Logs"),
    },
  ];

  const filteredNavItems = adminStaffNavItems.filter(
    (item) => !item.isAdminOnly || (item.isAdminOnly && role === "admin")
  );

  return (
    <div className="nav-wrapper" ref={navRef}>
      <div className="logo-container" onClick={() => router.push("/")}>
      </div>
      <nav className="input">
        {filteredNavItems.map((item) => (
          <button
            key={item.id}
            className={`value ripple ${expandedNav === item.id ? "active" : ""} ${
              hoveredNav === item.id ? "hovered" : ""
            }`}
            onClick={() => {
              setExpandedNav(expandedNav === item.id ? null : item.id);
              item.onClick();
            }}
            onMouseEnter={() => setHoveredNav(item.id)}
            onMouseLeave={() => setHoveredNav(null)}
            data-label={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span
              className={`nav-label transition-all duration-300 ${
                expandedNav === item.id || hoveredNav === item.id
                  ? "max-w-[150px] opacity-100 ml-2"
                  : "max-w-0 opacity-0 ml-0"
              }`}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default HeaderNav;