// app/Admin/Notification/page.tsx
"use client";

import NextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";

const NotificationPageInner = NextDynamic(
  () => import("./NotificationPageInner"),
  { ssr: false }
);

export default function NotificationPage() {
  return <NotificationPageInner />;
}