"use client";

/** The New layout's wide-screen pane switches beside the filter bar: show the filters pane, and preview-on-click */
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";

const BTN =
  "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--outline-default)] hover:bg-[var(--surface-hover)]";

export function ShowFiltersButton({
  pane,
}: {
  pane: { available: boolean; open: boolean; toggle: () => void };
}) {
  if (!pane.available || pane.open) return null;
  return (
    <button
      type="button"
      onClick={pane.toggle}
      aria-label="Show filters pane"
      title="Filters pane"
      className={`${BTN} text-[var(--ink-muted)]`}
    >
      <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function PreviewModeButton({
  preview,
}: {
  preview: { available: boolean; on: boolean; switchMode: () => void };
}) {
  if (!preview.available) return null;
  const { on } = preview;
  return (
    <button
      type="button"
      onClick={preview.switchMode}
      aria-pressed={on}
      aria-label="Preview records on click"
      title={
        on
          ? "Clicking a row previews it (click to open rows instead)"
          : "Preview rows beside the list"
      }
      className={`order-last ${BTN} ${on ? "bg-[var(--surface-selected)] text-[var(--ink-default)]" : "text-[var(--ink-muted)]"}`}
    >
      <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/**
 * The list between its optional wide-screen panes (§ 3.8): filters on the left (≥ 1920), the record preview on the
 * right (≥ 1600). Without panes the list is a plain block.
 */
export function ListPanes<R>({
  left,
  leftPane,
  right,
  rightPane,
  children,
}: {
  left: boolean;
  leftPane: React.ReactNode;
  right: R | undefined;
  rightPane: (row: R) => React.ReactNode;
  children: React.ReactNode;
}) {
  const cols = [
    left ? "15rem" : "",
    "minmax(0,1fr)",
    right ? "clamp(22rem,28vw,30rem)" : "",
  ].filter(Boolean);
  if (cols.length === 1) return <div>{children}</div>;
  return (
    <div className="grid items-start gap-4" style={{ gridTemplateColumns: cols.join(" ") }}>
      {left ? leftPane : null}
      {children}
      {right ? rightPane(right) : null}
    </div>
  );
}
