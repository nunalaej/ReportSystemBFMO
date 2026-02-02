// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/* ---------- PUBLIC ROUTES ---------- */
const isPublicRoute = createRouteMatcher([
  "/",               // login page
  "/sign-in(.*)",    // Clerk default sign-in
  "/sign-up(.*)",    // Clerk default sign-up
]);

/* ---------- STUDENT ROUTES ---------- */
const isStudentDashboard = createRouteMatcher([
  "/Student(.*)",
]);

/* ---------- ANY ROUTE ---------- */
const isAnyRoute = createRouteMatcher(["/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  const metadata = sessionClaims?.publicMetadata || {};

  /* ---- 1. Public routes: allow if logged out ---- */
  if (isPublicRoute(req)) {
    // If already logged in → go to student dashboard
    if (userId) {
      return NextResponse.redirect(new URL("/Student", req.url));
    }
    return NextResponse.next(); // Allow visitor to stay on login page
  }

  /* ---- 2. Student Dashboard protection ---- */
  if (isStudentDashboard(req)) {
    // If NOT logged in → kick to home page "/"
    if (!userId) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  /* ---- 3. Any other route not public requires login ---- */
  if (isAnyRoute(req) && !userId) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
