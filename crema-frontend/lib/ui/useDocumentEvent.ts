"use client";

import { useEffect, useEffectEvent } from "react";

/** listen for a custom event on `document` while mounted (e.g. "crema:email" from the form's Ctrl+E) */
export function useDocumentEvent(name: string, handler: (e: Event) => void) {
  const on = useEffectEvent(handler);
  useEffect(() => {
    const h = (e: Event) => on(e);
    document.addEventListener(name, h);
    return () => document.removeEventListener(name, h);
  }, [name]);
}
