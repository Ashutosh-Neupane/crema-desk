"use client";

/**
 * Color (Desk: form/controls/color.js + color_picker/): a text box ("Choose a color") with the colour swatch; the
 * picker has Desk's swatches and a custom colour; a value must be #RRGGBB (color.js validate) — anything else is
 * not stored. Empty stays empty (it showed #000000).
 */
import { useState } from "react";
import type { FieldControlProps } from "./index";

/** color.js swatches */
export const SWATCHES = ["#171717", "#7c7c7c", "#ce2c2c", "#d35a09", "#ca7e0c", "#ab790d", "#268c5c", "#0a857b", "#1f8cad", "#077ddf", "#6e57d1", "#8e49ca", "#cf3a96"];
const VALID = /^#[0-9A-F]{6}$/i;

export default function ColorField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const current = typeof value === "string" ? value : "";
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const readOnly = disabled || !!field.read_only;
  const label = field.label || field.fieldname;
  const shown = text ?? current;
  const bad = text !== null && text !== "" && !VALID.test(text);

  const set = (v: string) => {
    setText(null);
    if (v === "" || VALID.test(v)) {
      if (v !== current) onChange(v || null);
    }
  };

  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setOpen(false)}>
      <div className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${error || bad ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"} ${readOnly ? "bg-zinc-100 dark:bg-zinc-800/70" : "bg-white dark:bg-zinc-900"}`}>
        <button
          type="button"
          aria-label={`${label} colour picker`}
          aria-expanded={open}
          disabled={readOnly}
          onClick={() => setOpen((o) => !o)}
          className="h-6 w-6 shrink-0 rounded border border-zinc-300 dark:border-zinc-600"
          style={{ background: VALID.test(current) ? current : "repeating-conic-gradient(#e4e4e7 0 25%, #fff 0 50%) 0 0 / 8px 8px" }}
        />
        <input
          id={inputId ?? field.fieldname}
          type="text"
          aria-label={label}
          aria-invalid={!!error || bad}
          value={shown}
          readOnly={readOnly}
          placeholder={String(field.placeholder || "Choose a color")}
          onChange={(e) => setText(e.target.value.trim())}
          onBlur={() => text !== null && set(text)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), text !== null && set(text))}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-zinc-900 focus:outline-none dark:text-zinc-100"
        />
      </div>
      {bad && <p className="mt-1 text-xs text-red-600">Use a colour like #1f8cad</p>}
      {open && !readOnly && (
        <div role="dialog" aria-label={`${label} colours`} className="absolute left-0 top-full z-40 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="grid grid-cols-7 gap-1.5">
            {SWATCHES.map((c) => (
              <button key={c} type="button" aria-label={c} title={c} onClick={() => (set(c), setOpen(false))} className={`h-6 w-6 rounded-full ${c.toLowerCase() === current.toLowerCase() ? "ring-2 ring-zinc-900 ring-offset-1 dark:ring-white" : ""}`} style={{ background: c }} />
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            Custom
            <input type="color" aria-label={`${label} custom colour`} value={VALID.test(current) ? current : "#000000"} onChange={(e) => set(e.target.value)} className="h-6 w-10 cursor-pointer rounded border border-zinc-300 bg-white p-0 dark:border-zinc-700" />
          </label>
        </div>
      )}
    </div>
  );
}
