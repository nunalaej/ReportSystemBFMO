"use client";

import { FC, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import "@/app/style/nav.css";

interface HeaderNavProps {}

const HeaderNav: FC<HeaderNavProps> = () => {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const role = useMemo(() => {
    if (!isLoaded || !isSignedIn || !user) return "guest";

    const rawRole = (user.publicMetadata as any)?.role;
    let r = "student";

    if (Array.isArray(rawRole) && rawRole.length > 0) {
      r = String(rawRole[0]).toLowerCase();
    } else if (typeof rawRole === "string") {
      r = rawRole.toLowerCase();
    }

    return r; // "admin", "staff", or something else
  }, [isLoaded, isSignedIn, user]);

  const gotoReports = () => {
    router.push("/Admin/Reports");
  };

  const gotoAnalytics = () => {
    router.push("/Admin/Analytics");
  };

  const gotoAdminEdit = () => {
    router.push("/Admin/Edit");
  };

  // While loading user, or not signed in, no middle nav
  if (!isLoaded || !isSignedIn) {
    return <div />;
  }

  // Only admin and staff see the nav
  if (role !== "admin" && role !== "staff") {
    return <div />;
  }

  return (
    <nav className="input">
      <button className="value" onClick={gotoReports}>
        Reports
      </button>
      <button className="value" onClick={gotoAnalytics}>
        Analytics
      </button>
      {role === "admin" && (
        <button className="value" onClick={gotoAdminEdit}>
          Admin Edit
        </button>
      )}
    </nav>
  );
};

export default HeaderNav;
