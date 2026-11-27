"use client";

/** Close an overlay when a mousedown lands on its backdrop itself (not on the panel inside it) */
import { useEffect, useEffectEvent, type RefObject } from "react";

export function useBackdropClose(backdrop: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.target === backdrop.current) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [backdrop]);
}

/**
 * Esc closes the dialog (Desk ui/dialog.js), when it is the topmost one and no dropdown inside it is open (that Esc
 * closes the dropdown first).
 */
export function useEscapeClose(dialog: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || !dialog.current) return;
      const open = [...document.querySelectorAll<HTMLElement>("dialog[open], [role=dialog]")];
      if (open[open.length - 1] !== dialog.current) return;
      if ([...document.querySelectorAll<HTMLElement>("[role=listbox]")].some((l) => l.offsetParent)) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);
}
