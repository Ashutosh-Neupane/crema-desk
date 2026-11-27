"use client";

/**
 * List keyboard navigation (Desk list/list_view.js setup_keyboard_navigation): ↓ / ↑ focus the next / previous
 * row (the first one when no row has focus), Shift+↓ / ↑ select the row and move on, Space selects, Enter opens.
 * In preview mode (useListPreview) the focused row is also previewed, and Esc closes the preview.
 */
import { useRouter } from "next/navigation";
import { useShortcuts } from "@/lib/shortcuts";

interface Preview {
  on: boolean;
  current: string | null;
  open: (name: string) => void;
  close: () => void;
}

const rowEl = (name: string) =>
  document.querySelector<HTMLElement>(`tbody tr[data-row="${CSS.escape(name)}"]`);
const focusedRow = () =>
  (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("tbody tr[data-row]")
    ?.dataset.row ?? null;
// arrow keys keep their meaning inside menus, list boxes and tab lists
const ownsArrows = (e: KeyboardEvent) =>
  !!(e.target as HTMLElement | null)?.closest?.(
    "[role=menu], [role=listbox], [role=tablist], [role=radiogroup], [role=slider], [role=grid]"
  );

export function useListKeys({
  rows,
  preview,
  toggle,
  hrefOf,
}: {
  rows: Array<{ name: string }>;
  preview: Preview;
  toggle: (name: string) => void;
  hrefOf: (name: string) => string;
}) {
  const router = useRouter();
  const at = () => focusedRow() ?? preview.current;

  const focus = (name: string | undefined) => {
    if (!name) return;
    const el = rowEl(name);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest" });
    if (preview.on) preview.open(name);
  };
  const step = (down: boolean, select = false) => {
    const cur = at();
    const i = cur ? rows.findIndex((r) => r.name === cur) : -1;
    if (select && cur) toggle(cur);
    if (i < 0) return focus(rows[0]?.name);
    focus(rows[down ? Math.min(i + 1, rows.length - 1) : Math.max(i - 1, 0)]?.name);
  };

  useShortcuts(
    [
      {
        keys: "arrowdown",
        description: "Next row",
        group: "List",
        when: (e) => !ownsArrows(e) && rows.length > 0,
        action: () => step(true),
      },
      {
        keys: "arrowup",
        description: "Previous row",
        group: "List",
        when: (e) => !ownsArrows(e) && rows.length > 0,
        action: () => step(false),
      },
      {
        keys: "shift+arrowdown",
        description: "Select the row and go down",
        group: "List",
        when: (e) => !ownsArrows(e) && !!at(),
        action: () => step(true, true),
      },
      {
        keys: "shift+arrowup",
        description: "Select the row and go up",
        group: "List",
        when: (e) => !ownsArrows(e) && !!at(),
        action: () => step(false, true),
      },
      {
        keys: "space",
        description: "Select the row",
        group: "List",
        when: () => !!focusedRow(),
        action: () => toggle(focusedRow()!),
      },
      {
        keys: "enter",
        description: "Open the row",
        group: "List",
        when: () => !!focusedRow(),
        action: () => router.push(hrefOf(focusedRow()!)),
      },
      {
        keys: "escape",
        description: "Close the preview",
        group: "List",
        when: () => !!preview.current,
        action: () => preview.close(),
      },
    ],
    [rows, preview.on, preview.current, toggle, hrefOf]
  );
}
