"use client";

import { ReactNode, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/app/ThemeToggle";

export default function StaffLayout({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
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
        <div className="flex items-center gap-3">
          <img src="/logo-dlsud.png" alt="DLSU-D Logo" className="w-10 h-10 object-contain" />
          <h1 className="text-base sm:text-lg font-semibold site-title">
            BFMO Report System
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserButton />
        </div>
      </header>
      <main className="student-layout-content">
        {children}
      </main>
    </>
  );
}