"use client";

import { useQuery } from "@tanstack/react-query";
import type { DeskContext } from "@/app/api/desk/context/route";
import { setFormatSettings } from "@/lib/frappe/format";

/** `enabled: false` skips the request (e.g. hosts mounted on public pages like /login, where there's no session) */
export function useDeskContext({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<DeskContext>({
    queryKey: ["desk-context"],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/desk/context", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load desk context");
      const ctx = (await res.json()) as DeskContext;
      // number/currency/date formats everywhere follow the site's settings (lib/frappe/format.ts)
      setFormatSettings({ sysdefaults: ctx.sysdefaults, defaults: ctx.defaults, timeZone: ctx.boot?.time_zone as { system?: string; user?: string } | undefined, docs: ctx.docs });
      return ctx;
    },
    staleTime: 5 * 60 * 1000,
  });
}
