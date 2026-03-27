"use client";

import { ReactNode, useEffect } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/app/ThemeToggle";
import HeaderNav from "@/app/HeaderNav";

export default function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  // ── Derive role before any returns ──────────────────────────────
  const rawRole = isLoaded && user ? (user.publicMetadata as any)?.role : null;
  const role = Array.isArray(rawRole)
    ? rawRole[0]?.toLowerCase()
    : typeof rawRole === "string"
    ? rawRole.toLowerCase()
    : "student";

  // ── All hooks at the top, no conditions ─────────────────────────
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (role !== "student") {
      router.replace("/Admin");
    }
  }, [isLoaded, isSignedIn, user, role, router]);

  /* ===============================
     GUARDS (after all hooks)
  =============================== */

  if (!isLoaded) {
    return (
      <div className="page-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <div className="page-center">
        <p>Please sign in to continue.</p>
      </div>
    );
  }

  if (role !== "student") {
    // Redirect is already firing via useEffect above,
    // show nothing while it navigates
    return null;
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

        {/* MIDDLE NAV */}
        <HeaderNav />

        <div className="flex items-center gap-3">
                  <ThemeToggle />
                  <UserButton />
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main className="student-layout-content">
        {children}
      </main>
    </>
  );
}