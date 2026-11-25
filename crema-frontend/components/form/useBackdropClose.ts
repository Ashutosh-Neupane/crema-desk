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
