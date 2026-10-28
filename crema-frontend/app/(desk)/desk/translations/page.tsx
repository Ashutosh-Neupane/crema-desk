"use client";

import { TranslationManager } from "@/components/features/translations";

export default function TranslationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Translation Manager</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage translations and languages
        </p>
      </div>
      <TranslationManager />
    </div>
  );
}
