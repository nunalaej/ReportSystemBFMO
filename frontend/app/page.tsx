"use client";
import "./style/login.css";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function Home() {
  const [lightMode, setLightMode] = useState(false);

  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  /* =========================================
     ROLE-BASED REDIRECTION
  ============================================ */
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    // Read the role from Clerk publicMetadata
    const rawRole = (user.publicMetadata as any)?.role;

    // Support: "admin" or ["admin"]
    let role: string =
      Array.isArray(rawRole) && rawRole.length > 0 ? rawRole[0] : rawRole;

    role = typeof role === "string" ? role.toLowerCase() : "";

    // Redirect based on role
    if (role === "admin") {
      router.replace("/Admin");
    } else if (role === "staff" || role === "Staff") {
      router.replace("/Staff");          // ← EXACT PATH FOR Staff/page.tsx
    } else {
      router.replace("/Student/Dashboard");
    }
  }, [isLoaded, isSignedIn, user, router]);

  const isLoadingUser = !isLoaded;

  /* =========================================
     MAIN LOGIN PAGE UI
  ============================================ */
  return (
    <div
      className={
        lightMode
          ? "create-scope create-scope__layout create-scope--light"
          : "create-scope create-scope__layout"
      }
    >
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
                  color: "var(--text)",
                }}
              >
                BFMO Report System
              </h1>
              <p
                style={{
                  margin: 0,
                  marginTop: 4,
                  fontSize: 12,
                  color: "var(--text-2)",
                }}
              >
                Buildings and Facilities Maintenance Office
              </p>
            </div>
          </div>
        </header>

        {/* BODY */}
        <section className="create-scope__panel-body">
          <div style={{ marginBottom: 20 }}>
            <p className="welcome">
              Welcome to the online reporting portal for maintenance concerns at
              DLSU-D. Please use your DLSU-D Account to Login.
            </p>
          </div>

          {isLoadingUser && (
            <div
              className="create-scope__message create-scope__message.is-info"
              style={{ marginBottom: 16 }}
            >
              Checking your session, please wait…
            </div>
          )}

          <div className="login-tabs-morph">
            {/* Not Signed In */}
            <SignedOut>
              <SignInButton
                mode="modal"
                fallbackRedirectUrl="/"
                signUpFallbackRedirectUrl="/"
              >
                <button type="button" className="neonButton">
                  <span className="buttonLabel">Sign In</span>
                </button>
              </SignInButton>
            </SignedOut>

            {/* Signed In */}
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>

          <div className="login-footer">
            <a href="#" className="login-footer-link">
              Help
            </a>
            <span className="login-dot" />
            <a href="#" className="login-footer-link">
              Privacy
            </a>
            <span className="login-dot" />
            <a href="#" className="login-footer-link">
              Terms
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
