"use client";

import { ListViewSettings } from "@/components/features/list-view-settings";

export default function ListViewSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">List View Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Configure list columns, sorting, and grouping
        </p>
      </div>
      <ListViewSettings />
    </div>
  );
}
