"use client";

/**
 * FormBody's view state: the open tab (a #hash naming a tab, a script's tab.set_active()), Desk's collapsed sections,
 * the New layout's opened folds, and Ctrl+J "jump to field" (open its tab, section and fold, then focus it).
 */
import { useEffect, useState } from "react";
import type { parseDoctypeMeta } from "@/lib/crema-form/meta/parseDoctypeMeta";

type Layout = ReturnType<typeof parseDoctypeMeta>;

function tabFromHash(tabs: Array<{ fieldname: string; label?: string | null }>): string | null {
  if (typeof window === "undefined" || !window.location.hash) return null;
  let h: string;
  try {
    h = decodeURIComponent(window.location.hash.slice(1)).toLowerCase();
  } catch {
    return null;
  }
  const slug = (s: string) => s.toLowerCase().trim().replace(/\s+/g, "-");
  return tabs.find((t) => t.fieldname.toLowerCase() === h || (t.label && slug(t.label) === h))?.fieldname ?? null;
}

const flip = (set: Set<string>, key: string) => {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
};

export function useFormBodyState(layout: Layout, overrides: Record<string, Record<string, unknown>>, overridePrefix: string, focusRequest: { fieldname: string; n: number } | null | undefined) {
  // a #hash naming a tab (its fieldname, or its label as a slug: #form) opens on that tab
  const [activeTab, setActiveTab] = useState<string | null>(() => tabFromHash(layout.tabs));
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  // folded parts the user opened: a section's fieldname, or `${fieldname}:more` for its More fields
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const flipToggled = (key: string) => setToggled((t) => flip(t, key));
  const flipOpened = (key: string) => setOpened((o) => flip(o, key));

  // a script's tab.set_active(): open the tab with the newest stamp (adjusted during render, no effect)
  const activation = layout.tabs.reduce<{ tab: string; at: number } | null>((best, t) => {
    const at = Number((overrides[`${overridePrefix}${t.fieldname}`] as { __activate?: unknown } | undefined)?.__activate ?? 0);
    return at > (best?.at ?? 0) ? { tab: t.fieldname, at } : best;
  }, null);
  const [activated, setActivated] = useState(0);
  if (activation && activation.at !== activated) {
    setActivated(activation.at);
    setActiveTab(activation.tab);
  }

  const [handled, setHandled] = useState(0);
  if (focusRequest && focusRequest.n !== handled) {
    // adjust state during render (no effect cascade): reveal the field's tab + section
    setHandled(focusRequest.n);
    const sec = layout.sections.find((s) => [...s.fields, ...s.childTables].some((f) => f.fieldname === focusRequest.fieldname));
    if (sec?.tab) setActiveTab(sec.tab);
    if (sec?.collapsible) setToggled((t) => new Set([...t, sec.fieldname]));
    if (sec) setOpened((o) => new Set([...o, sec.fieldname, `${sec.fieldname}:more`]));
  }
  useEffect(() => {
    if (!focusRequest) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[id$="-${CSS.escape(focusRequest.fieldname)}"]`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [focusRequest]);

  return { activeTab, setActiveTab, toggled, opened, flipToggled, flipOpened };
}
