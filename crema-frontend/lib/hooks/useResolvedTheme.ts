"use client";

import { useSyncExternalStore } from "react";

/** "light" | "dark" as currently applied on <html data-theme> (by ui.store's applyTheme). */
export function useResolvedTheme(): "light" | "dark" {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => obs.disconnect();
    },
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"),
    () => "light",
  );
}
