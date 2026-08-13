import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Console Logs | Trevo",
    description: "View console log entries",
  };
}

import { ConsoleLogList } from "@/components/features/system/ConsoleLogList";

export default function ConsoleLogPage() {
  return <ConsoleLogList />;
}
