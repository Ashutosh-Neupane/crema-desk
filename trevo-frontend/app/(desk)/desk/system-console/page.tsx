"use client";

import { SystemConsole } from "@/components/features/system-console";

export default function SystemConsolePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">System Console</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          SQL console and system tools
        </p>
      </div>
      <SystemConsole />
    </div>
  );
}
