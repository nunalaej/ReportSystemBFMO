// app/Staff/layout.tsx

"use client";


export const dynamic = "force-dynamic";


import { ReactNode, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/app/ThemeToggle";
import HeaderNav from "@/app/HeaderNav";
import Link from "next/link";
import { useNotifications } from "@/app/context/notification";

export default function StaffLayout({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { unreadCount } = useNotifications();
  const router = useRouter();

  const rawRole = isLoaded && user ? (user.publicMetadata as any)?.role : null;
  const role = Array.isArray(rawRole)
    ? rawRole[0]?.toLowerCase()
    : typeof rawRole === "string"
    ? rawRole.toLowerCase()
    : "";

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) { router.replace("/"); return; }
    if (role === "admin")   { router.replace("/Admin");   return; }
    if (role === "student") { router.replace("/Student"); return; }
  }, [isLoaded, isSignedIn, user, role, router]);

  if (!isLoaded) return <div className="page-center"><p>Loading...</p></div>;
  if (!isSignedIn || !user) return null;
  if (role !== "staff") return null;

  return (
    <>
      <header className="layout">
        <div
          className="flex items-center gap-3"
          onClick={() => router.push("/Staff/Dashboard")}
          style={{ cursor: "pointer" }}
        >
          <img src="/logo-dlsud.png" alt="DLSU-D Logo" className="w-10 h-10 object-contain" />
          <h1 className="text-base sm:text-lg font-semibold site-title">
            BFMO Report System
          </h1>
        </div>

        <HeaderNav />

        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* ── Notification Bell ── */}
          <Link
            href="/Staff/Notification"
            style={{
              position: "relative", display: "flex", alignItems: "center",
              padding: 6, borderRadius: 8, color: "inherit", textDecoration: "none",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: 2, right: 2,
                background: "#ef4444", color: "#fff",
                fontSize: "0.55rem", fontWeight: 700,
                minWidth: 16, height: 16,
                borderRadius: 999, display: "flex",
                alignItems: "center", justifyContent: "center",
                padding: "0 3px", lineHeight: 1,
              }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>

          <UserButton />
        </div>
      </header>
      <main className="student-layout-content">
        {children}
      </main>
    </>
  );
}