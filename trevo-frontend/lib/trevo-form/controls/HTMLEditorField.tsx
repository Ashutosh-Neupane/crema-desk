"use client";

import { useRef, useCallback, useEffect } from "react";
import type { FieldControlProps } from "./index";

/**
 * HTML Editor field — maps to Frappe fieldtype "HTML Editor".
 * WYSIWYG editor using contenteditable with an execCommand toolbar.
 * No external library. Stores raw HTML string.
 * In read-only mode, renders the HTML safely with dangerouslySetInnerHTML.
 */

type ToolbarAction =
  | "bold" | "italic" | "underline" | "strikeThrough"
  | "insertUnorderedList" | "insertOrderedList"
  | "justifyLeft" | "justifyCenter" | "justifyRight"
  | "createLink" | "removeFormat";

const TOOLBAR_ITEMS: Array<{ action: ToolbarAction; label: string; icon: string }> = [
  { action: "bold",                icon: "B",   label: "Bold" },
  { action: "italic",              icon: "I",   label: "Italic" },
  { action: "underline",           icon: "U",   label: "Underline" },
  { action: "strikeThrough",       icon: "S̶",   label: "Strikethrough" },
  { action: "insertUnorderedList", icon: "•≡",  label: "Bullet list" },
  { action: "insertOrderedList",   icon: "1≡",  label: "Numbered list" },
  { action: "justifyLeft",         icon: "≡←",  label: "Align left" },
  { action: "justifyCenter",       icon: "≡",   label: "Align center" },
  { action: "justifyRight",        icon: "≡→",  label: "Align right" },
  { action: "removeFormat",        icon: "T×",  label: "Clear formatting" },
];

export default function HTMLEditorField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const str = typeof value === "string" ? value : "";
  const isDisabled = disabled || !!field.read_only;

  // Initialise content once on mount
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== str) {
      editorRef.current.innerHTML = str;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const execAction = useCallback((action: ToolbarAction) => {
    if (action === "createLink") {
      const url = prompt("Enter URL:");
      if (url) document.execCommand("createLink", false, url);
    } else {
      document.execCommand(action, false, undefined);
    }
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  if (isDisabled) {
    return (
      <div
        className={[
          "min-h-[8rem] rounded-lg border px-4 py-3 text-sm prose dark:prose-invert max-w-none",
          error ? "border-red-500" : "border-zinc-200 dark:border-zinc-700",
          "bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
        ].join(" ")}
        aria-label={field.label || field.fieldname}
        dangerouslySetInnerHTML={{ __html: str || "<span class='text-zinc-400 italic'>—</span>" }}
      />
    );
  }

  return (
    <div className={[
      "rounded-lg border overflow-hidden",
      error ? "border-red-500" : "border-zinc-300 dark:border-zinc-700",
    ].join(" ")}>
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label={`${field.label || field.fieldname} formatting toolbar`}
        className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-zinc-50 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {TOOLBAR_ITEMS.map((item) => (
          <button
            key={item.action}
            type="button"
            title={item.label}
            aria-label={item.label}
            onMouseDown={(e) => { e.preventDefault(); execAction(item.action); }}
            className="rounded px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            {item.icon}
          </button>
        ))}
        {/* Heading selectors */}
        {(["h1","h2","h3"] as const).map((h) => (
          <button
            key={h}
            type="button"
            title={`Heading ${h.slice(1)}`}
            aria-label={`Heading ${h.slice(1)}`}
            onMouseDown={(e) => { e.preventDefault(); document.execCommand("formatBlock", false, h); handleInput(); }}
            className="rounded px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            {h.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        id={inputId ?? field.fieldname}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        role="textbox"
        aria-multiline="true"
        aria-label={field.label || field.fieldname}
        aria-required={!!field.reqd}
        aria-invalid={!!error}
        data-placeholder="Write HTML content here…"
        className={[
          "min-h-[8rem] px-4 py-3 text-sm prose dark:prose-invert max-w-none focus:outline-none",
          "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:italic",
        ].join(" ")}
      />
    </div>
  );
}
