import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Route History | Trevo",
    description: "Recent pages you visited",
  };
}

import { RouteHistoryList } from "@/components/features/system/RouteHistoryList";

export default function RouteHistoryPage() {
  return <RouteHistoryList />;
}
