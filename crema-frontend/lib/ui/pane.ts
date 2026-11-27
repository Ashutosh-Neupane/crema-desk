"use client";

/**
 * Optional side panes of the New layout (docs/PHASE2_DESIGN.md § 3.4 rule 6): a pane exists only from a minimum
 * width, the user can close it, and that choice is remembered per screen type in this browser.
 */
import { useSyncExternalStore } from "react";
import { useNewLayout } from "@/lib/ui/newLayout";

const KEY = (pane: string) => `crema:pane:${pane}`;
const EVENT = "crema-pane";

function readOpen(pane: string): boolean {
  try {
    return localStorage.getItem(KEY(pane)) !== "0";
  } catch {
    return true;
  }
}

function writeOpen(pane: string, open: boolean) {
  try {
    localStorage.setItem(KEY(pane), open ? "1" : "0");
  } catch {
    // storage blocked: the pane still toggles for this page view
  }
  window.dispatchEvent(new Event(EVENT));
}

function useMinWidth(px: number): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(`(min-width: ${px}px)`);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(`(min-width: ${px}px)`).matches,
    () => false
  );
}

function usePaneOpen(pane: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => readOpen(pane),
    () => true
  );
}

/** `available`: the screen is wide enough in the New layout; `open`: shown (available and not closed by the user) */
export function usePane(pane: string, minWidth: number) {
  const wide = useMinWidth(minWidth);
  const newLayout = useNewLayout();
  const chosen = usePaneOpen(pane);
  const available = newLayout && wide;
  return { available, open: available && chosen, toggle: () => writeOpen(pane, !chosen) };
}
