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

  /* ── Icons ── */
  const DashboardIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"/>
      <path d="M3 13h8v8H3v-8zm10-10h8v8h-8V3zM3 3h8v8H3V3zm10 10h8v8h-8v-8z"/>
    </svg>
  );

  const CreateIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"/>
      <path d="M21 14v5c0 1.105-.895 2-2 2H5c-1.105 0-2-.895-2-2V5c0-1.105.895-2 2-2h5v2H5v14h14v-5h2z"/>
      <path d="M21 7h-4V3h-2v4h-4v2h4v4h2V9h4"/>
    </svg>
  );

  const ReportsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"/>
      <path d="M16 18H8v-2h8v2zm0-6H8v2h8v-2zm2-9h-2v2h2v15H6V5h2V3H6c-1.105 0-2 .895-2 2v15c0 1.105.895 2 2 2h12c1.105 0 2-.895 2-2V5c0-1.105-.895-2-2-2zm-4 2V4c0-1.105-.895-2-2-2s-2 .895-2 2v1c-1.105 0-2 .895-2 2v1h8V7c0-1.105-.895-2-2-2z"/>
    </svg>
  );

  const AnalyticsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"/>
      <path d="M3 13h8v8H3v-8zm10-10h8v8h-8V3zM3 3h8v8H3V3zm10 10h8v8h-8v-8z"/>
    </svg>
  );

  const SettingsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"/>
      <path d="M12 15.5c1.933 0 3.5-1.567 3.5-3.5s-1.567-3.5-3.5-3.5-3.5 1.567-3.5 3.5 1.567 3.5 3.5 3.5zm0 2c-3.038 0-5.5-2.462-5.5-5.5S8.962 6.5 12 6.5s5.5 2.462 5.5 5.5-2.462 5.5-5.5 5.5z"/>
      <path d="M19.5 12c0-.23-.01-.45-.03-.68l1.86-1.41-2-3.46-2.12.79c-.45-.34-.94-.62-1.47-.82L15.5 4h-4l-.24 2.42c-.53.2-1.02.48-1.47.82l-2.12-.79-2 3.46 1.86 1.41c-.02.23-.03.43-.03.68s.01.45.03.68l-1.86 1.41 2 3.46 2.12-.79c.45.34.94.62 1.47.82l.24 2.42h4l.24-2.42c.53-.2 1.02-.48 1.47-.82l2.12.79 2-3.46-1.86-1.41c.02-.23.03-.43.03-.68z"/>
    </svg>
  );

  const TaskIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"/>
      <path d="M16 18H8v-2h8v2zm0-6H8v2h8v-2zm2-9h-2v2h2v15H6V5h2V3H6c-1.105 0-2 .895-2 2v15c0 1.105.895 2 2 2h12c1.105 0 2-.895 2-2V5c0-1.105-.895-2-2-2z"/>
    </svg>
  );

  const NotificationIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"/>
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.93 6 11v5l-2 2v1h16v-1l-2-2z"/>
    </svg>
  );

  const LogsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="0" fill="none" width="24" height="24"/>
      <path d="M4 6h16v2H4V6zm2-4h12v2H6V2zm16 8H2v12h20V10zM4 12h16v8H4v-8z"/>
    </svg>
  );

  /* ── Fixed DocumentIcon: strokeWidth camelCase, no bare attribute warnings ── */
  const DocumentIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M18 6.00002V6.75002H18.75V6.00002H18ZM15.7172 2.32614L15.6111 1.58368L15.7172 2.32614ZM4.91959 3.86865L4.81353 3.12619H4.81353L4.91959 3.86865ZM5.07107 6.75002H18V5.25002H5.07107V6.75002ZM18.75 6.00002V4.30604H17.25V6.00002H18.75ZM15.6111 1.58368L4.81353 3.12619L5.02566 4.61111L15.8232 3.0686L15.6111 1.58368ZM4.81353 3.12619C3.91638 3.25435 3.25 4.0227 3.25 4.92895H4.75C4.75 4.76917 4.86749 4.63371 5.02566 4.61111L4.81353 3.12619ZM18.75 4.30604C18.75 2.63253 17.2678 1.34701 15.6111 1.58368L15.8232 3.0686C16.5763 2.96103 17.25 3.54535 17.25 4.30604H18.75ZM5.07107 5.25002C4.89375 5.25002 4.75 5.10627 4.75 4.92895H3.25C3.25 5.9347 4.06532 6.75002 5.07107 6.75002V5.25002Z"
        fill="currentColor"
      />
      <path d="M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 15.5H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path
        d="M4 6V19C4 20.6569 5.34315 22 7 22H17C18.6569 22 20 20.6569 20 19V14M4 6V5M4 6H17C18.6569 6 20 7.34315 20 9V10"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  );

  interface NavItem {
    id: string;
    icon: ReactNode;
    label: string;
    onClick: () => void;
    isAdminOnly?: boolean;
  }

  /* ── Shared nav button renderer ── */
  const renderNav = (items: NavItem[]) => (
    <div className="nav-wrapper" ref={navRef}>
      <div className="logo-container" onClick={() => router.push("")}/>
      <nav className="input">
        {items.map((item) => (
          <button
            key={item.id}
            className={`value ripple${expandedNav === item.id ? " active" : ""}${hoveredNav === item.id ? " hovered" : ""}`}
            onClick={() => { setExpandedNav(expandedNav === item.id ? null : item.id); item.onClick(); }}
            onMouseEnter={() => setHoveredNav(item.id)}
            onMouseLeave={() => setHoveredNav(null)}
            data-label={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className={`nav-label transition-all duration-300 ${expandedNav === item.id || hoveredNav === item.id ? "max-w-[150px] opacity-100 ml-2" : "max-w-0 opacity-0 ml-0"}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );

  /* ── STUDENT NAV ── */
  if (role === "student") {
    return renderNav([
      { id:"dashboard", icon:<DashboardIcon/>,    label:"Dashboard",      onClick:()=>router.push("/Student/Dashboard") },
      { id:"create",    icon:<CreateIcon/>,        label:"Create Report",  onClick:()=>router.push("/Student/CreateReport") },
      { id:"reports",   icon:<ReportsIcon/>,       label:"My Reports",     onClick:()=>router.push("/Student/ViewReports") },
      { id:"documents", icon:<DocumentIcon/>,      label:"View Documents", onClick:()=>router.push("/Student/Documents") },
    ]);
  }

  /* ── ADMIN / STAFF NAV ── */
  const adminStaffItems: NavItem[] = [
    { id:"reports",      icon:<ReportsIcon/>,      label:"Reports",        onClick:()=>router.push(role==="admin"?"/Admin/Reports":"/Staff/Reports") },
    { id:"analytics",    icon:<AnalyticsIcon/>,    label:"Analytics",      onClick:()=>router.push(role==="admin"?"/Admin/Analytics":"/Staff/Analytics") },
    { id:"adminedit",    icon:<SettingsIcon/>,     label:"Admin Edit",     onClick:()=>router.push("/Admin/Edit"), isAdminOnly:true },
    { id:"task",         icon:<TaskIcon/>,          label:"Task",           onClick:()=>router.push(role==="admin"?"/Admin/Task":"/Staff/Task") },
    { id:"notification", icon:<NotificationIcon/>, label:"Notification",   onClick:()=>router.push(role==="admin"?"/Admin/Notification":"/Staff/Notification") },
    { id:"logs",         icon:<LogsIcon/>,          label:"Logs",           onClick:()=>router.push("/Logs") },
    { id:"documents",    icon:<DocumentIcon/>,      label:"Documents",      onClick:()=>router.push(role==="admin"?"/Admin/Documents":"/Staff/Documents") },
  ];

  return renderNav(adminStaffItems.filter(item => !item.isAdminOnly || role === "admin"));
};

export default HeaderNav;