"use client";

import { useSyncExternalStore } from "react";

/** Below Tailwind's `sm` (640px): lists and grids switch to cards, form actions move to a bottom bar.
 *  Only one layout is rendered (not both with CSS), so tests and screen readers see a single copy. */
const QUERY = "(max-width: 639px)";

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
