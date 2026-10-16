"use client";

import { useState } from "react";
import type { FieldControlProps } from "./index";

/**
 * Color field — maps to Frappe fieldtype "Color".
 * Renders a native color picker with a hex text input beside it.
 */
export default function ColorField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const str = typeof value === "string" && value ? value : "#000000";
  const [hex, setHex] = useState(str);

  const isValid = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

  const handleColorInput = (v: string) => {
    setHex(v);
    onChange(v);
  };

  const handleTextInput = (v: string) => {
    // Normalise: prepend # if missing
    const norm = v.startsWith("#") ? v : `#${v}`;
    setHex(norm);
    if (isValid(norm)) onChange(norm);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Colour swatch preview */}
      <div
        className="h-9 w-9 flex-shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 shadow-inner"
        style={{ backgroundColor: isValid(hex) ? hex : "#000000" }}
        aria-hidden="true"
      />
      {/* Native colour picker */}
      <input
        type="color"
        id={`${field.fieldname}-picker`}
        value={isValid(hex) ? hex : "#000000"}
        onChange={(e) => handleColorInput(e.target.value)}
        disabled={disabled || !!field.read_only}
        aria-label={`${field.label || field.fieldname} colour picker`}
        className="h-9 w-14 cursor-pointer rounded border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900 disabled:cursor-not-allowed"
      />
      {/* Hex text input */}
      <input
        type="text"
        id={inputId ?? field.fieldname}
        value={hex}
        maxLength={7}
        onChange={(e) => handleTextInput(e.target.value)}
        disabled={disabled || !!field.read_only}
        placeholder="#000000"
        aria-label={`${field.label || field.fieldname} hex value`}
        className={[
          "w-28 rounded-lg border px-3 py-2 text-sm font-mono transition-colors",
          error
            ? "border-red-500 focus:ring-red-500/20"
            : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
          "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2",
          (disabled || !!field.read_only) && "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800",
        ].join(" ")}
      />
    </div>
  );
}
