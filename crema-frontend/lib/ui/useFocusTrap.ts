"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function focusableIn(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest("[hidden],[inert]") && el.getClientRects().length > 0);
}

/**
 * While `active`: focus moves into `ref` (the `[data-autofocus]` element, else the first focusable, else the
 * container), Tab / Shift+Tab cycle inside it, Escape calls `onEscape`; on deactivate focus returns to the opener.
 * Same contract as WAI-ARIA APG "Dialog (Modal)".
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  const escape = useEffectEvent(() => onEscape?.());
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initial = node.querySelector<HTMLElement>("[data-autofocus]") ?? focusableIn(node)[0] ?? node;
    initial.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        escape();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusableIn(node);
      if (!items.length) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [active, ref]);
}
