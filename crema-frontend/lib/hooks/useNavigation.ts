"use client";

import { useQuery } from "@tanstack/react-query";
import type { DeskNavigation } from "@/lib/navigation";

const EMPTY_NAV: DeskNavigation = {
  sections: [],
  apps: [],
  modules: [],
};

/**
 * Client-side hook for the metadata-driven desk navigation.
 * Calls /api/navigation (BFF) which assembles workspaces + modules + apps.
 */
export function useNavigation() {
  return useQuery({
    queryKey: ["navigation"],
    queryFn: async () => {
      const res = await fetch("/api/navigation", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load navigation");
      return (await res.json()) as DeskNavigation;
    },
    staleTime: 5 * 60 * 1000,
    // placeholder, not initialData: initialData counts as fresh and would
    // suppress the real fetch for the whole staleTime
    placeholderData: EMPTY_NAV,
  });
}

