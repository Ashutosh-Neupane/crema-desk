"use client";

/**
 * A keyboard shortcut as text (docs/PHASE2_DESIGN.md § 2.4): `<Kbd keys="Mod+K" />` shows ⌘K on a Mac and Ctrl+K
 * elsewhere. Screen readers hear the words ("Command K"), not the symbols. The server renders the Ctrl form and the
 * browser switches after hydration, so the HTML matches.
 */
import { useSyncExternalStore } from "react";

const MAC_SYMBOL: Record<string, string> = { Mod: "⌘", Shift: "⇧", Alt: "⌥", Ctrl: "⌃", Enter: "↵", Esc: "Esc" };
const SPOKEN: Record<string, string> = { "⌘": "Command", "⇧": "Shift", "⌥": "Option", "⌃": "Control", "↵": "Enter" };

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function formatKeys(keys: string, mac = isMac()): string[] {
  return keys.split("+").map((k) => (mac ? (MAC_SYMBOL[k] ?? k) : k === "Mod" ? "Ctrl" : k));
}

const noSubscribe = () => () => {};

export function Kbd({ keys, className = "" }: { keys: string; className?: string }) {
  const mac = useSyncExternalStore(noSubscribe, isMac, () => false);
  const parts = formatKeys(keys, mac);
  const spoken = parts.map((p) => SPOKEN[p] ?? p).join(" ");
  return (
    <kbd
      aria-label={spoken}
      className={`inline-flex items-center gap-0.5 rounded border border-[var(--outline-default)] bg-[var(--surface-sunken)] px-1.5 font-sans text-[var(--type-caption)] leading-5 text-[var(--ink-muted)] ${className}`}
    >
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} aria-hidden="true">
          {p}
        </span>
      ))}
    </kbd>
  );
}
