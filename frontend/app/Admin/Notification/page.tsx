// app/Notification/page.tsx
import NotificationPageInner from "./NotificationPageInner";

export const metadata = {
  title: "Activity Log | BFMO",
  description: "Task activity log and notification history",
};

export default function NotificationPage() {
  return <NotificationPageInner />;
}