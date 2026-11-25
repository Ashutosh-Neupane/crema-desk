"use client";

/**
 * Phase 2 switches (docs/GAPS.md § 3.6): screens render their new layout only when `useNewLayout()` is true.
 *
 *   const newLayout = useNewLayout();
 *   return newLayout ? <NewOrderForm /> : <DocForm />;
 *
 * Stored per user in Frappe (user_settings "Crema UI") with a localStorage cache; see ./prefs.ts.
 * SSR and the first client render return the defaults (classic layout, comfortable), then the stored value.
 */
import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_UI_PREFS, loadServerPrefs, readPrefs, subscribePrefs, updatePrefs, type Density, type UiPrefs } from "./prefs";

export type { Density, UiPrefs };

const getServerSnapshot = () => DEFAULT_UI_PREFS;

/** All UI prefs; fetches the user's server copy once per page session */
export function useUiPrefs(): UiPrefs {
  const prefs = useSyncExternalStore(subscribePrefs, readPrefs, getServerSnapshot);
  useEffect(() => {
    void loadServerPrefs();
  }, []);
  return prefs;
}

/** true when this user turned on the "New layout" switch */
export function useNewLayout(): boolean {
  return useUiPrefs().newLayout;
}

export function setNewLayout(on: boolean): void {
  updatePrefs({ newLayout: on });
}

/** "comfortable" (phase 2 default) or "compact" (Desk-like) */
export function useDensity(): Density {
  return useUiPrefs().density;
}

export function setDensity(density: Density): void {
  updatePrefs({ density });
}
