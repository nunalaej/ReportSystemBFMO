"use client";

import { ReactNode } from "react";
import { SignedIn, UserButton, useUser } from "@clerk/nextjs";
import ThemeToggle from "@/app/ThemeToggle";
import HeaderNav from "@/app/HeaderNav";

export default function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn, user } = useUser();

  /* ===============================
     AUTH GUARD (NO REDIRECTS)
  =============================== */

  // Wait for Clerk
  if (!isLoaded) {
    return (
      <div className="page-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Not logged in → block render
  if (!isSignedIn || !user) {
    return (
      <div className="page-center">
        <p>Please sign in to continue.</p>
      </div>
    );
  }

  // Role check
  const rawRole = (user.publicMetadata as any)?.role;
  const role = Array.isArray(rawRole)
    ? rawRole[0]?.toLowerCase()
    : typeof rawRole === "string"
    ? rawRole.toLowerCase()
    : "student"; // fail-safe

  // Not a student → block render
  if (role !== "student") {
    return (
      <div className="page-center">
        <p>Unauthorized access.</p>
      </div>
    );
  }

  /* ===============================
     LAYOUT
  =============================== */

  return (
    <>
      {/* TOP HEADER */}
      <header className="layout">
        {/* LEFT */}
        <div className="flex items-center gap-3">
          <img
            src="/logo-dlsud.png"
            alt="DLSU-D Logo"
            className="w-10 h-10 object-contain"
          />
          <h1 className="text-base sm:text-lg font-semibold site-title">
            BFMO Report System
          </h1>
        </div>

        {/* MIDDLE NAV (role-aware inside HeaderNav) */}
        <HeaderNav />

        {/* RIGHT */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main className="student-layout-content">
        {children}
      </main>
    </>
  );
}
