import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Changelog Feed | Trevo",
    description: "Recent changes and updates",
  };
}

import { ChangelogFeed } from "@/components/features/system/ChangelogFeed";

export default function ChangelogFeedPage() {
  return <ChangelogFeed />;
}
