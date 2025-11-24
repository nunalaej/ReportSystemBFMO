"use client";
import "./style/login.css";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function Home() {
  const [lightMode, setLightMode] = useState(false);
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  // If already signed in, always go straight to Student Dashboard
  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      router.replace("/Users/Student-Dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  const isLoadingUser = !isLoaded;

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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          {/* Intro text */}
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--text-2)",
              }}
            >
              Welcome to the online reporting portal for maintenance concerns at
              DLSU-D. Please use your DLSU-D Account to Login
            </p>
          </div>

          {/* Loading state while Clerk is resolving session */}
          {isLoadingUser && (
            <div
              className="create-scope__message create-scope__message.is-info"
              style={{ marginBottom: 16 }}
            >
              Checking your session, please wait…
            </div>
          )}

          {/* Morphing login buttons */}
          <div className="login-tabs-morph">
            <SignedOut>
              <SignInButton
                mode="modal"
                fallbackRedirectUrl="/Users/Student-Dashboard"
                signUpFallbackRedirectUrl="/Users/Student-Dashboard"
              >
                <button type="button" className="morphButton expanded">
                  <span className="icon">
                    <span style={{ fontSize: 18, fontWeight: 700 }}>↪</span>
                  </span>
                  <span className="buttonLabel">Sign In</span>
                </button>
              </SignInButton>

              <SignUpButton
                mode="modal"
                fallbackRedirectUrl="/Users/Student-Dashboard"
              >
                <button type="button" className="morphButton">
                  <span className="icon">
                    <span style={{ fontSize: 18, fontWeight: 700 }}>＋</span>
                  </span>
                  <span className="buttonLabel">Create Account</span>
                </button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>

          {/* Footer links */}
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
