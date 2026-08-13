import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Notification Settings | Trevo",
    description: "Manage email notification preferences",
  };
}

import { NotificationSettings } from "@/components/features/system-console/NotificationSettings";

export default function NotificationSettingsPage() {
  return <NotificationSettings />;
}
