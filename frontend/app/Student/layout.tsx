"use client";

import { ReactNode } from "react";
import { useUser, SignedIn, UserButton } from "@clerk/nextjs";
import ThemeToggle from "@/app/ThemeToggle";
import HeaderNav from "@/app/HeaderNav";

export default function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn, user } = useUser();

  /* ===============================
     ALWAYS RETURN JSX
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

  const rawRole = (user.publicMetadata as any)?.role;
  const role = Array.isArray(rawRole)
    ? rawRole[0]?.toLowerCase()
    : typeof rawRole === "string"
    ? rawRole.toLowerCase()
    : "student";

  if (role !== "student") {
    return (
      <div className="page-center">
        <p>Unauthorized access.</p>
      </div>
    );
  }

  return (
    <>
      {/* HEADER */}
      <header className="layout">
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

        <HeaderNav />

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main className="student-layout-content">{children}</main>
    </>
  );
}
