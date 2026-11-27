"use client";

/**
 * Record preview state for a list (docs/PHASE2_DESIGN.md § 3.8): on wide screens in the New layout a row click
 * previews the record beside the list (keys: useListKeys). The user
 * can switch preview off; that choice is remembered (lib/ui/pane.ts).
 */
import { useState } from "react";
import { usePane } from "@/lib/ui/pane";

export function useListPreview<R extends { name: string }>(rows: R[]) {
  const pane = usePane("list-preview", 1600);
  const [name, setName] = useState<string | null>(null);
  const index = name ? rows.findIndex((r) => r.name === name) : -1;
  // a preview only while preview mode is on and the row is still in the list (filters may drop it)
  const current = pane.open && index >= 0 ? name : null;

  const go = (i: number) => {
    const next = rows[i]?.name;
    if (!next) return;
    setName(next);
    document
      .querySelector(`[data-row="${CSS.escape(next)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };
  const prev = current && index > 0 ? () => go(index - 1) : undefined;
  const next = current && index < rows.length - 1 ? () => go(index + 1) : undefined;

  return {
    /** preview mode can be offered (wide screen, New layout) */
    available: pane.available,
    /** preview mode is on: row clicks preview */
    on: pane.open,
    /** switch preview-on-click on / off (closes any open preview) */
    switchMode: () => {
      setName(null);
      pane.toggle();
    },
    current,
    /** the previewed row */
    row: current ? rows[index] : undefined,
    /** for RowContext: a row click previews while preview mode is on */
    onPreview: pane.open ? setName : undefined,
    open: setName,
    close: () => setName(null),
    prev,
    next,
  };
}
