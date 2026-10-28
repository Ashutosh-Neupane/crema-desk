"use client";

/**
 * Keyboard shortcuts, matching Frappe Desk (frappe/public/js/frappe/ui/keyboard.js,
 * form/toolbar.js, list/list_view.js). "mod" = ⌘ on macOS, Ctrl elsewhere; like
 * Desk, Ctrl also works on a Mac. Pages register shortcuts while mounted; the
 * Shift+? dialog lists whatever is active.
 */
import { useEffect, useSyncExternalStore } from "react";

export interface Shortcut {
  /** e.g. "mod+j", "shift+mod+d", "shift+r", "shift+?" */
  keys: string;
  description: string;
  group: "Global" | "Form" | "List";
  action: (e: KeyboardEvent) => void;
  /** run even while typing in an input (Desk: ignore_inputs: false) */
  allowInInput?: boolean;
}

const registry = new Map<string, Shortcut>();
const listeners = new Set<() => void>();
let snapshot: Shortcut[] = [];
const emit = () => {
  snapshot = [...registry.values()];
  listeners.forEach((l) => l());
};

export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function matches(keys: string, e: KeyboardEvent): boolean {
  const parts = keys.toLowerCase().split("+");
  const key = parts.pop()!;
  const wantMod = parts.includes("mod");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");
  const mod = e.metaKey || e.ctrlKey;
  if (wantMod !== mod || wantAlt !== e.altKey) return false;
  // "?" and "/" are the same physical key; Shift is implied by "?"
  if (key === "?") return e.key === "?" || (e.shiftKey && e.key === "/");
  if (wantShift !== e.shiftKey) return false;
  // "<" / ">" are Shift+, / Shift+. ; with Ctrl/Cmd held some browsers report the unshifted key
  if (key === "<" || key === ">") return e.key === key || e.key === (key === "<" ? "," : ".");
  return e.key.toLowerCase() === key;
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

let installed = false;
function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener(
    "keydown",
    (e) => {
      // most specific (form/list) first, then global
      const order = [...registry.values()].sort((a, b) => (a.group === "Global" ? 1 : 0) - (b.group === "Global" ? 1 : 0));
      for (const s of order) {
        if (!matches(s.keys, e)) continue;
        // plain-key shortcuts never fire while typing; modifier ones only if allowed
        const plain = !s.keys.includes("mod") && !s.keys.includes("alt");
        if (isTyping(e) && (plain || !s.allowInInput)) continue;
        e.preventDefault();
        s.action(e);
        return;
      }
    },
    true,
  );
}

/** Register shortcuts while the calling component is mounted */
export function useShortcuts(list: Shortcut[], deps: unknown[] = []) {
  useEffect(() => {
    install();
    const ids = list.map((s) => `${s.group}:${s.keys}`);
    list.forEach((s, i) => registry.set(ids[i], s));
    emit();
    return () => {
      ids.forEach((id) => registry.delete(id));
      emit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useRegisteredShortcuts(): Shortcut[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
}

/** "shift+mod+d" → "⇧⌘D" on Mac, "Shift+Ctrl+D" elsewhere */
export function formatKeys(keys: string): string {
  const mac = isMac();
  return keys
    .split("+")
    .map((p) => {
      if (p === "mod") return mac ? "⌘" : "Ctrl";
      if (p === "shift") return mac ? "⇧" : "Shift";
      if (p === "alt") return mac ? "⌥" : "Alt";
      return p.length === 1 ? p.toUpperCase() : p;
    })
    .join(mac ? "" : "+");
}
