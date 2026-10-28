"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeHtml } from "@/lib/report/columns";
import type { FieldControlProps } from "./index";

/**
 * Text Editor field (Desk: form/controls/text_editor.js, a Quill editor). The value is HTML: addresses
 * (`12 Street<br>City`), terms, notes, ERPNext's tax breakup table. Read-only shows the HTML rendered (Desk's
 * `.ql-editor.read-mode`); editable is a rich-text box with a small toolbar.
 * The value is only written back when the user types or formats, never on mount, so opening a form doesn't make it dirty.
 */
const TOOLS: Array<{ cmd: string; arg?: string; label: string; text: string }> = [
  { cmd: "bold", label: "Bold", text: "B" },
  { cmd: "italic", label: "Italic", text: "I" },
  { cmd: "underline", label: "Underline", text: "U" },
  { cmd: "formatBlock", arg: "h3", label: "Heading", text: "H" },
  { cmd: "insertUnorderedList", label: "Bullet list", text: "•" },
  { cmd: "insertOrderedList", label: "Numbered list", text: "1." },
  { cmd: "createLink", label: "Link", text: "🔗" },
  { cmd: "removeFormat", label: "Clear formatting", text: "T×" },
];

/** Quill leaves `<p><br></p>` for an empty editor; Desk treats that as empty */
const isEmptyHtml = (html: string) => !html.replace(/<(p|div|br)[^>]*>|<\/(p|div)>|&nbsp;|\s/gi, "");

export default function TextEditorField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const html = typeof value === "string" ? value : value == null ? "" : String(value);
  const readOnly = disabled || !!field.read_only;
  const ref = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(false);

  // show the current value, unless the user is typing in it (scripts' set_value lands after blur)
  useEffect(() => {
    const el = ref.current;
    if (!el || readOnly || document.activeElement === el) return;
    const clean = sanitizeHtml(html);
    if (el.innerHTML !== clean) el.innerHTML = clean;
  }, [html, readOnly]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    onChange(isEmptyHtml(el.innerHTML) ? "" : el.innerHTML);
  }, [onChange]);

  const run = (t: (typeof TOOLS)[number]) => {
    ref.current?.focus();
    if (t.cmd === "createLink") {
      const url = window.prompt("Link URL");
      if (!url || /^\s*javascript:/i.test(url)) return;
      document.execCommand("createLink", false, url);
    } else document.execCommand(t.cmd, false, t.arg);
    emit();
  };

  if (readOnly) {
    if (isEmptyHtml(html)) return <div id={inputId ?? field.fieldname} className="text-sm text-zinc-400">—</div>;
    return (
      <div
        id={inputId ?? field.fieldname}
        role="document"
        aria-label={field.label || field.fieldname}
        className="crema-rich rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    );
  }

  return (
    <div
      className={[
        "overflow-hidden rounded-lg border transition-colors",
        error ? "border-red-500" : focus ? "border-zinc-900 ring-2 ring-zinc-900/20 dark:border-zinc-500" : "border-zinc-300 dark:border-zinc-700",
      ].join(" ")}
    >
      <div role="toolbar" aria-label={`${field.label || field.fieldname} formatting`} className="flex flex-wrap gap-0.5 border-b border-zinc-200 bg-zinc-50 px-1.5 py-1 dark:border-zinc-700 dark:bg-zinc-900">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            onMouseDown={(e) => {
              e.preventDefault();
              run(t);
            }}
            className="h-6 min-w-6 rounded px-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {t.text}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        id={inputId ?? field.fieldname}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={field.label || field.fieldname}
        aria-required={!!field.reqd}
        aria-invalid={!!error}
        data-placeholder={String(field.placeholder ?? "")}
        onInput={emit}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        className="crema-rich min-h-[clamp(6rem,18vh,10rem)] bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)] dark:bg-zinc-950 dark:text-zinc-100"
      />
    </div>
  );
}
