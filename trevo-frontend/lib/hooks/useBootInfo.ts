"use client";

/**
 * useBootInfo — reads boot data from auth.store (Zustand write-through cache).
 *
 * AuthProvider (lib/frappe/auth.tsx) is the single fetch source.
 * It writes to auth.store after each successful boot fetch.
 * This hook just reads from the store — zero additional network calls.
 */

import { useAuthStore } from "@/lib/stores/auth.store";
import type { FrappeUser, InstalledApp, BootInfo } from "@/lib/frappe/types";

export type BootInfoLite = {
  user: FrappeUser | null;
  installed_apps: InstalledApp[];
  sysdefaults: Record<string, string>;
  lang: string;
  desk_theme?: "Light" | "Dark" | "System";
  notification_count: number;
};

const emptyBootInfo: BootInfoLite = {
  user: null,
  installed_apps: [],
  sysdefaults: {},
  lang: "en",
  desk_theme: "Light",
  notification_count: 0,
};

export function useBootInfo(): {
  data: BootInfo | BootInfoLite;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const bootInfo = useAuthStore((s) => s.bootInfo);
  const bootLoaded = useAuthStore((s) => s.bootLoaded);

  return {
    data: bootInfo ?? emptyBootInfo,
    isLoading: !bootLoaded,
    isError: false,
    refetch: () => {
      // Boot is managed by AuthProvider — call refresh() from useAuth() if needed
    },
  };
}
