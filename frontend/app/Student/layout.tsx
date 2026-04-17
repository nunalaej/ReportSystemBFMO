"use client";

import { ReactNode, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/app/ThemeToggle";
import HeaderNav from "@/app/HeaderNav";

export default function StudentLayout({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  const rawRole = isLoaded && user ? (user.publicMetadata as any)?.role : null;
  const role = Array.isArray(rawRole)
    ? rawRole[0]?.toLowerCase()
    : typeof rawRole === "string"
    ? rawRole.toLowerCase()
    : "student";

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    // ✅ Only redirect admin — staff has their own layout, student stays here
    if (role === "admin") router.replace("/Admin");
    if (role === "staff") router.replace("/Staff");
  }, [isLoaded, isSignedIn, user, role, router]);

  if (!isLoaded) {
    return <div className="page-center"><p>Loading...</p></div>;
  }

  if (!isSignedIn || !user) {
    return <div className="page-center"><p>Please sign in to continue.</p></div>;
  }

  // ✅ Block admin and staff from seeing student pages
  if (role === "admin" || role === "staff") return null;

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
          <UserButton />
        </div>
      </header>
      <main className="student-layout-content">
        {children}
      </main>
    </>
  );
}