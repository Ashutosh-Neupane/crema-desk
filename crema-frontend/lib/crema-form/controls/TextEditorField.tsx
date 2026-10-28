"use client";

import { useCallback, useRef, useState } from "react";
import type { FieldControlProps } from "./index";

/**
 * Text Editor field — clean, modern textarea with auto-resize and markdown hints.
 * Frappe's "Text Editor" maps to this.
 */
export default function TextEditorField({ field, inputId, value, onChange, disabled }: FieldControlProps) {
  const [focus, setFocus] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
  }, []);

  return (
    <div className={[
      "rounded-lg border transition-colors",
      focus
        ? "border-zinc-900 ring-2 ring-zinc-900/20 dark:border-zinc-500 dark:ring-zinc-500/20"
        : "border-zinc-300 dark:border-zinc-700",
      (disabled || !!field.read_only) && "bg-zinc-100 dark:bg-zinc-800",
    ].join(" ")}>
      <textarea
        ref={textareaRef}
        id={inputId ?? field.fieldname}
        value={String(value ?? "")}
        onChange={(e) => {
          onChange(e.target.value);
          autoResize();
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        readOnly={!!field.read_only}
        disabled={disabled || !!field.read_only}
        rows={4}
        placeholder={String(field.placeholder ?? "Enter text...")}
        className={[
          "w-full rounded-lg px-3 py-2 text-sm",
          "bg-transparent text-zinc-900 dark:text-zinc-100",
          "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
          "focus:outline-none",
          "resize-y",
          (disabled || !!field.read_only) && "cursor-not-allowed",
        ].join(" ")}
      />
    </div>
  );
}
