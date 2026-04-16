"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import "@/app/Staff/style/login.css";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "")) || "";

export default function StaffLoginPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router  = useRouter();
  const [status,  setStatus]  = useState<"idle" | "linking" | "error" | "done">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isLoaded) return;

    // Not signed in — send back to main login
    if (!isSignedIn || !user) {
      router.replace("/");
      return;
    }

    // Check role from Clerk metadata
    const rawRole = (user.publicMetadata as any)?.role;
    const role = Array.isArray(rawRole)
      ? rawRole[0]?.toLowerCase()
      : typeof rawRole === "string"
      ? rawRole.toLowerCase()
      : "";

    // Wrong role — not staff
    if (role === "admin") { router.replace("/Admin"); return; }
    if (role === "student") { router.replace("/Student"); return; }

    // ✅ Already verified staff — skip linking, go straight to dashboard
    if (role === "staff") {
      router.replace("/Staff/Dashboard");
      return;
    }

    // No role yet — try to link by username
    const clerkId  = user.id;
    const username = user.username || "";
    const email    = user.primaryEmailAddress?.emailAddress || "";

    if (!username && !email) {
      setStatus("error");
      setMessage("No username found on your account. Contact your administrator.");
      return;
    }

    setStatus("linking");

    fetch(`${API_BASE}/api/staff/link-clerk`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ clerkId, username, email }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.success) {
          setStatus("error");
          setMessage(data.message || "Account not recognised. Contact your administrator.");
          return;
        }
        setStatus("done");
        router.replace("/Staff/Dashboard");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });

  }, [isLoaded, isSignedIn, user, router]);

  // Loading state
  if (!isLoaded || status === "idle") {
    return (
      <div className="staff-auth-wrapper">
        <div className="staff-auth-loading">Checking session…</div>
      </div>
    );
  }

  return (
    <div className="staff-auth-wrapper">
      <div className="staff-auth-box">
        <img src="/logo-dlsud.png" alt="DLSUD" width={52} height={52} style={{ marginBottom: 16 }} />

        {status === "linking" && (
          <>
            <div className="staff-auth-spinner" />
            <p className="staff-auth-status-title">Verifying your account…</p>
            <p className="staff-auth-status-sub">Checking staff records.</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="staff-auth-icon staff-auth-icon--error">✕</div>
            <p className="staff-auth-status-title" style={{ color: "#dc2626" }}>
              Access Denied
            </p>
            <p className="staff-auth-status-sub">{message}</p>
            <p className="staff-auth-hint">
              Your account must be added by an administrator in the Staff Management panel before you can access this portal.
            </p>
            <button
              className="staff-auth-retry-btn"
              onClick={() => router.replace("/")}
            >
              ← Back to Login
            </button>
          </>
        )}

        {status === "done" && (
          <>
            <div className="staff-auth-icon staff-auth-icon--success">✓</div>
            <p className="staff-auth-status-title" style={{ color: "#16a34a" }}>
              Verified!
            </p>
            <p className="staff-auth-status-sub">Redirecting to your dashboard…</p>
          </>
        )}
      </div>
    </div>
  );
}