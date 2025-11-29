import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 1. Routes that require being signed in (any role)
const isProtectedRoute = createRouteMatcher([
  "/Admin(.*)",
  "/Staff(.*)",
  "/Student(.*)",
  "/CreateReport(.*)",
  "/ViewReports(.*)",
  "/api/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // If this request is for a protected route, Clerk will:
  // - redirect to sign in for browser requests
  // - return 401 for API calls
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // If you need, you could read things like:
  // const { userId, sessionClaims } = auth;
  // but for now we only need protect()
});

// Next matcher - from Clerk docs
export const config = {
  matcher: [
    // all "real" pages
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/",
    // and all API routes
    "/(api|trpc)(.*)",
  ],
};
