import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Backups | Trevo",
    description: "Manage system backups",
  };
}

import { BackupManager } from "@/components/features/system/BackupManager";

export default function BackupsPage() {
  return <BackupManager />;
}

