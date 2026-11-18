"use client";

import type { FieldControlProps } from "./index";

/**
 * Button field (Desk form/controls/button.js). A click runs the form event named after the field, or the method
 * in `options` when no script handles it (see FormController.clickButton); in a dialog, df.click.
 * Desk's can_write() is always true, so a button stays clickable on read-only and submitted documents.
 * Look: button_color (Default / Primary / Info / Success / Warning / Danger) or `primary`, btn_size (xs default),
 * title as the tooltip.
 */
const COLOR: Record<string, string> = {
  Default: "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
  Primary: "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
  Info: "bg-sky-600 text-white hover:bg-sky-700",
  Success: "bg-emerald-600 text-white hover:bg-emerald-700",
  Warning: "bg-amber-500 text-white hover:bg-amber-600",
  Danger: "bg-red-600 text-white hover:bg-red-700",
};
const SIZE: Record<string, string> = {
  xs: "px-2.5 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export default function ButtonField({ field, inputId, onClick }: FieldControlProps) {
  const df = field as typeof field & { button_color?: string; primary?: unknown; btn_size?: string; title?: string };
  const color = df.button_color ? (COLOR[df.button_color] ?? COLOR.Default) : df.primary ? COLOR.Primary : COLOR.Default;
  const size = SIZE[String(df.btn_size ?? "xs")] ?? SIZE.xs;
  const label = field.label || field.fieldname;
  return (
    <div>
      <button
        type="button"
        id={inputId ?? field.fieldname}
        data-button-color={df.button_color || (df.primary ? "Primary" : "Default")}
        title={df.title || label}
        onClick={onClick}
        className={`rounded-md font-medium transition-colors ${size} ${color}`}
      >
        {label}
      </button>
    </div>
  );
}
