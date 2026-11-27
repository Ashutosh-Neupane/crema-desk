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
  group: "Global" | "Form" | "Grid" | "List";
  action: (e: KeyboardEvent) => void;
  /** run even while typing in an input (Desk: ignore_inputs: false) */
  allowInInput?: boolean;
  /** run only when this holds (Desk: condition); otherwise the key does what it normally does */
  when?: (e: KeyboardEvent) => boolean;
  /** listed in the Shift+? dialog only: the key is handled elsewhere (grid cells, dialogs) */
  info?: boolean;
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
  if (key === "space") return e.key === " ";
  // "<" / ">" are Shift+, / Shift+. ; with Ctrl/Cmd held some browsers report the unshifted key
  if (key === "<" || key === ">") return e.key === key || e.key === (key === "<" ? "," : ".");
  return e.key.toLowerCase() === key;
}

/** the topmost open modal dialog, if any (a page's own shortcuts wait while one is open, as in Desk). Date / time /
 * colour pickers are non-modal <dialog open> popovers and don't count. */
export function openDialog(): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>("dialog:modal, [aria-modal=true], [role=alertdialog]")].filter((d) => d.getClientRects().length > 0);
  return all.at(-1) ?? null;
}

/** Desk keyboard.js ctrl+s → trigger_primary_action: inside a dialog, its primary button */
const dialogPrimary = (dlg: HTMLElement) => dlg.querySelector<HTMLButtonElement>("[data-primary-action]:not([disabled]), button[type=submit]:not([disabled])");

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
      const dlg = openDialog();
      if (dlg && matches("mod+s", e)) {
        const btn = dialogPrimary(dlg);
        if (btn) {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur();
          btn.click();
        }
        return;
      }
      for (const s of order) {
        if (s.info || !matches(s.keys, e)) continue;
        // Form / List shortcuts belong to the page under a dialog
        if (dlg && s.group !== "Global") continue;
        if (s.when && !s.when(e)) continue;
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

const ARROWS: Record<string, string> = { arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→" };

/** "shift+mod+d" → "⇧⌘D" on Mac, "Shift+Ctrl+D" elsewhere */
export function formatKeys(keys: string): string {
  const mac = isMac();
  return keys
    .split("+")
    .map((p) => {
      if (p === "mod") return mac ? "⌘" : "Ctrl";
      if (p === "shift") return mac ? "⇧" : "Shift";
      if (p === "alt") return mac ? "⌥" : "Alt";
      if (p in ARROWS) return ARROWS[p];
      if (p === "enter") return mac ? "↩" : "Enter";
      if (p === "escape") return "Esc";
      if (p === "space") return "Space";
      return p.length === 1 ? p.toUpperCase() : p;
    })
    .join(mac ? "" : "+");
}
