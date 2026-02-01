"use client";

import { useEffect, useRef } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import Image from "next/image";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, user } = useUser();

  // Prevent infinite reload
  const didReload = useRef(false);

  /* ===============================
     AUTH + ROLE GUARD (HARD RESET)
  =============================== */
  useEffect(() => {
    if (!isLoaded) return;

    // 🔴 LOGOUT → FULL PAGE RESET
    if (!isSignedIn || !user) {
      if (!didReload.current) {
        didReload.current = true;
        window.location.replace("/"); // ✅ HARD RESET
      }
      return;
    }

    // 🔐 ROLE CHECK
    const rawRole = (user.publicMetadata as any)?.role;
    const role = Array.isArray(rawRole)
      ? rawRole[0]?.toLowerCase()
      : typeof rawRole === "string"
      ? rawRole.toLowerCase()
      : "student";

    if (role !== "student") {
      window.location.replace("/"); // ✅ HARD RESET
    }
  }, [isLoaded, isSignedIn, user]);

  /* Prevent flicker */
  if (!isLoaded || !isSignedIn) return null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* ===============================
          STUDENT HEADER
      =============================== */}
      <header className="layout">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-dlsud.png"
            alt="DLSU-D Logo"
            width={40}
            height={40}
            priority
          />
          <h1 className="text-base sm:text-lg font-semibold">
            BFMO Report System
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Clerk sign out */}
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* ===============================
          PAGE CONTENT
      =============================== */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
