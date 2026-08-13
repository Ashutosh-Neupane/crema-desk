import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Server Scripts | Trevo",
    description: "Extend server-side behavior with Python/JS scripts",
  };
}

import { ServerScriptEditor } from "@/components/features/system/ServerScriptEditor";

export default function ServerScriptsPage() {
  return <ServerScriptEditor />;
}
