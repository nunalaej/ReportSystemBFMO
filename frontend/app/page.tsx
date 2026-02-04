"use client";

import "./style/login.css";
import Image from "next/image";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

import {
  SignedOut,
  SignInButton,
  useUser,
} from "@clerk/nextjs";

export default function HomePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const pathname = usePathname();


  /* =========================================
     FULL RESET REDIRECT ON LOGIN
     (NO SPA STATE LEFT BEHIND)
  ============================================ */
  useEffect(() => {
  if (!isLoaded || !isSignedIn || !user) return;

  // ✅ Only redirect when user is on the home page
  if (pathname !== "/") return;

  const rawRole = (user.publicMetadata as any)?.role;

  const role = Array.isArray(rawRole)
    ? rawRole[0]?.toLowerCase()
    : typeof rawRole === "string"
    ? rawRole.toLowerCase()
    : "student";

  const target =
    role === "admin"
      ? "/Admin"
      : role === "staff"
      ? "/Staff"
      : "/Student";

  window.location.replace(target);
}, [isLoaded, isSignedIn, user, pathname]);


  /* =========================================
     LOADING STATE
  ============================================ */
  if (!isLoaded) {
    return (
      <div className="create-scope create-scope__layout">
        <main className="create-scope__panel login-card">
          <p>Checking your session, please wait…</p>
        </main>
      </div>
    );
  }

  /* =========================================
     LOGIN PAGE (SIGNED OUT ONLY)
  ============================================ */
  return (
    <SignedOut>
      <div className="create-scope create-scope__layout">
        <main
          className="create-scope__panel login-card"
          style={{ maxWidth: 520, width: "100%" }}
        >
          {/* HEADER */}
          <header className="create-scope__panel-head login-card-head">
            <div className="header">
              <Image
                src="/logo-dlsud.png"
                alt="DLSU-D logo"
                width={48}
                height={48}
                priority
              />
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  BFMO Report System
                </h1>
                <p
                  style={{
                    margin: 0,
                    marginTop: 4,
                    fontSize: 12,
                  }}
                >
                  Buildings and Facilities Maintenance Office
                </p>
              </div>
            </div>
          </header>

          {/* BODY */}
          <section className="create-scope__panel-body">
            <p className="welcome">
              Welcome to the online reporting portal for maintenance concerns at
              DLSU-D. Please use your DLSU-D Account to login.
            </p>

            <div className="login-tabs-morph">
              <SignInButton mode="modal">
                <button type="button" className="neonButton">
                  <span className="buttonLabel">Sign In</span>
                </button>
              </SignInButton>
            </div>
          </section>
        </main>
      </div>
    </SignedOut>
  );
}
