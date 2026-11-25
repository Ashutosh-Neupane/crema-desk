"use client";

/** Shared bits of DatePicker / TimePicker: closing the popover, the input's look */
import { useEffect, useEffectEvent, type RefObject } from "react";

/** Close the popover on a mousedown outside the input and the popover, or on Escape */
export function usePopoverDismiss(open: boolean, close: () => void, anchor: RefObject<HTMLElement | null>, popover: RefObject<HTMLElement | null>) {
  const onClose = useEffectEvent(close);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchor.current?.contains(t) && !popover.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchor, popover]);
}

/** the picker input's classes (full form field, or a compact grid cell) */
export function pickerInputClass({ compact, error, disabled }: { compact?: boolean; error?: boolean; disabled?: boolean }, extra = ""): string {
  const tone = error ? "border-red-500 focus:ring-red-500/20" : compact ? "focus:ring-0" : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-900/10 dark:border-zinc-700";
  return [
    `w-full rounded-lg border bg-white pr-8 text-sm ${extra} text-zinc-900 transition-colors focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100`,
    compact ? "h-8 rounded-md border-transparent px-2 hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-700" : "px-3 py-2",
    tone,
    disabled ? "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800" : "",
  ].join(" ");
}

/**
 * The popover is a non-modal <dialog open> portalled to <body> (role "dialog" comes from the element); these reset
 * the user-agent dialog box (margin, padding, border, colours) so it looks like the old <div>.
 */
export const POPOVER_DIALOG_CLASS =
  "z-[70] m-0 max-h-none max-w-none rounded-xl border border-zinc-200 bg-white p-0 text-inherit shadow-xl dark:border-zinc-700 dark:bg-zinc-900";
