"use client";

import { useQuery } from "@tanstack/react-query";
import type { DeskContext } from "@/app/api/desk/context/route";

export function useDeskContext() {
  return useQuery<DeskContext>({
    queryKey: ["desk-context"],
    queryFn: async () => {
      const res = await fetch("/api/desk/context", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load desk context");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
