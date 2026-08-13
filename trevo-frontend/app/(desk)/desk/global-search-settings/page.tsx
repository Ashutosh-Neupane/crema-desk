import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Global Search Settings | Trevo",
    description: "Configure global search",
  };
}

import { GlobalSearchSettings } from "@/components/features/system/GlobalSearchSettings";

export default function GlobalSearchSettingsPage() {
  return <GlobalSearchSettings />;
}
