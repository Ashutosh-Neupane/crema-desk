import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "System Health | Trevo",
    description: "System health report and diagnostics",
  };
}

import { SystemHealthReport } from "@/components/features/system-console/SystemHealthReport";

export default function SystemHealthPage() {
  return <SystemHealthReport />;
}
