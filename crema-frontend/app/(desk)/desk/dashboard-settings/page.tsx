import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Dashboard Settings | Crema",
    description: "Configure dashboard defaults",
  };
}

import { DashboardSettings } from "@/components/features/dashboard/DashboardSettings";

export default function DashboardSettingsPage() {
  return <DashboardSettings />;
}
