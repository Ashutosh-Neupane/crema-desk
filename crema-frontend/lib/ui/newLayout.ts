"use client";

/**
 * Phase 2 switches (docs/GAPS.md § 3.6): screens render their new layout only when `useNewLayout()` is true.
 *
 *   const newLayout = useNewLayout();
 *   return newLayout ? <NewOrderForm /> : <DocForm />;
 *
 * Stored per user in Frappe (user_settings "Crema UI") with a localStorage cache; see ./prefs.ts.
 * The server renders with the prefs mirrored in the `crema_ui` cookie (./prefsCookie.ts, read by app/layout.tsx and
 * passed to <UiPrefsProvider>), and hydration uses the same value, so the first HTML already has the chosen layout.
 */
import { createContext, createElement, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_UI_PREFS, loadServerPrefs, readPrefs, subscribePrefs, updatePrefs, type Density, type UiPrefs } from "./prefs";

export type { Density, UiPrefs };

const ServerPrefs = createContext<UiPrefs>(DEFAULT_UI_PREFS);

/** the prefs the server rendered with (from the cookie); the root layout wraps the app in it */
export function UiPrefsProvider({ initial, children }: { initial: UiPrefs; children: ReactNode }) {
  return createElement(ServerPrefs.Provider, { value: initial }, children);
}

/** All UI prefs; fetches the user's server copy once per page session */
export function useUiPrefs(): UiPrefs {
  const initial = useContext(ServerPrefs);
  const prefs = useSyncExternalStore(subscribePrefs, readPrefs, () => initial);
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
