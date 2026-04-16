"use client";

import "@/app/style/staff-login.css";
import { useEffect, useState } from "react";
import { useUser, SignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "")) || "";

export default function StaffLoginPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router  = useRouter();
  const [status,  setStatus]  = useState<"idle" | "linking" | "error" | "done">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const email   = user.primaryEmailAddress?.emailAddress || "";
    const clerkId = user.id;

    setStatus("linking");

    fetch(`${API_BASE}/api/staff/link-clerk`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ clerkId, email }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.success) {
          setStatus("error");
          setMessage(data.message || "No staff record found for your email.");
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

  /* ── Not signed in: show Clerk SignIn ── */
  if (!isLoaded) {
    return (
      <div className="staff-auth-wrapper">
        <div className="staff-auth-loading">Loading…</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="staff-auth-wrapper">
        <div className="staff-auth-box">
          <div className="staff-auth-logo">
            <img src="/logo-dlsud.png" alt="DLSUD" width={56} height={56} />
          </div>
          <h1 className="staff-auth-title">Staff Portal</h1>
          <p className="staff-auth-sub">
            Sign in with your institutional email to access the staff dashboard.
          </p>
          <SignIn
            appearance={{
              elements: {
                rootBox:  { width: "100%" },
                card:     { boxShadow: "none", padding: 0 },
              },
            }}
          />
        </div>
      </div>
    );
  }

  /* ── Signed in: show linking status ── */
  return (
    <div className="staff-auth-wrapper">
      <div className="staff-auth-box">
        <img src="/logo-dlsud.png" alt="DLSUD" width={48} height={48} style={{ marginBottom: 16 }} />

        {status === "linking" && (
          <>
            <div className="staff-auth-spinner" />
            <p className="staff-auth-status-title">Verifying your account…</p>
            <p className="staff-auth-status-sub">Linking your account to your staff record.</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="staff-auth-icon staff-auth-icon--error">✕</div>
            <p className="staff-auth-status-title" style={{ color: "#dc2626" }}>Access Denied</p>
            <p className="staff-auth-status-sub">{message}</p>
            <p className="staff-auth-hint">
              Your email must be added by an administrator in the Staff Management panel before you can log in.
            </p>
            <button
              className="staff-auth-retry-btn"
              onClick={() => { setStatus("idle"); setMessage(""); }}
            >
              Try a different account
            </button>
          </>
        )}

        {status === "done" && (
          <>
            <div className="staff-auth-icon staff-auth-icon--success">✓</div>
            <p className="staff-auth-status-title" style={{ color: "#16a34a" }}>Verified!</p>
            <p className="staff-auth-status-sub">Redirecting to your dashboard…</p>
          </>
        )}
      </div>
    </div>
  );
}