"use client";

import { SignedIn, UserButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ThemeToggle from "@/app/ThemeToggle";
import HeaderNav from "@/app/HeaderNav";
import "@/app/Admin/style/dashboard.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.replace("/");
      return;
    }

    const rawRole = (user?.publicMetadata as any)?.role;
    const role = Array.isArray(rawRole)
      ? rawRole[0]?.toLowerCase()
      : rawRole?.toLowerCase();

    if (role !== "admin" && role !== "staff") {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, user, router]);

  if (!isLoaded || !isSignedIn) return null;

  const rawRole = (user?.publicMetadata as any)?.role;
  const role = Array.isArray(rawRole)
    ? rawRole[0]?.toLowerCase()
    : rawRole?.toLowerCase();

  return (
    <>
      {/* ✅ ADMIN HEADER ONLY */}
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

      {children}
    </>
  );
}
