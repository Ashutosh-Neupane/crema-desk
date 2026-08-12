"use client";

import { useState, useCallback } from "react";
import type { FieldControlProps } from "./index";

/**
 * Markdown Editor field — maps to Frappe fieldtype "Markdown Editor".
 * Split-pane: textarea on left (edit mode), rendered preview on right.
 * Uses a lightweight inline renderer — no external markdown library needed.
 * The stored value is always raw Markdown text.
 */

/** Very small Markdown → HTML renderer (covers headings, bold, italic, code, lists, links). */
function renderMarkdown(md: string): string {
  return md
    // Escape HTML entities first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Fenced code blocks
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code class='bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs'>$1</code>")
    // Headings
    .replace(/^### (.+)$/gm, "<h3 class='text-base font-semibold mt-2 mb-1'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-lg font-semibold mt-3 mb-1'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-xl font-bold mt-3 mb-2'>$1</h1>")
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li class='ml-4 list-decimal'>$1</li>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href='$2' class='text-blue-600 underline' target='_blank' rel='noopener noreferrer'>$1</a>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote class='border-l-4 border-zinc-300 pl-3 italic text-zinc-500'>$1</blockquote>")
    // Horizontal rules
    .replace(/^---$/gm, "<hr class='border-zinc-200 dark:border-zinc-700 my-2' />")
    // Paragraphs (double newline)
    .replace(/\n\n/g, "</p><p class='mb-2'>")
    .replace(/^(?!<[h1-6|ul|ol|li|pre|blockquote|hr])(.+)$/gm, "$1");
}

export default function MarkdownField({ field, value, onChange, disabled, error }: FieldControlProps) {
  const str = typeof value === "string" ? value : "";
  const [mode, setMode] = useState<"write" | "preview">("write");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
    [onChange],
  );

  const isDisabled = disabled || !!field.read_only;

  return (
    <div className={[
      "rounded-lg border overflow-hidden",
      error ? "border-red-500" : "border-zinc-300 dark:border-zinc-700",
    ].join(" ")}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setMode("write")}
          aria-pressed={mode === "write"}
          className={[
            "rounded px-2 py-0.5 text-xs font-medium transition-colors",
            mode === "write"
              ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
          ].join(" ")}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          aria-pressed={mode === "preview"}
          className={[
            "rounded px-2 py-0.5 text-xs font-medium transition-colors",
            mode === "preview"
              ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
          ].join(" ")}
        >
          Preview
        </button>
        <span className="ml-auto text-xs text-zinc-400">Markdown</span>
      </div>

      {mode === "write" ? (
        <textarea
          id={field.fieldname}
          value={str}
          onChange={handleChange}
          disabled={isDisabled}
          rows={8}
          placeholder="Write Markdown here…"
          aria-label={field.label || field.fieldname}
          aria-required={!!field.reqd}
          aria-invalid={!!error}
          className={[
            "w-full resize-y px-3 py-2 text-sm font-mono",
            "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
            "focus:outline-none",
            isDisabled && "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800",
          ].join(" ")}
        />
      ) : (
        <div
          className="min-h-[8rem] px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 prose dark:prose-invert max-w-none"
          aria-label={`${field.label || field.fieldname} preview`}
          dangerouslySetInnerHTML={{
            __html: str
              ? `<p class='mb-2'>${renderMarkdown(str)}</p>`
              : `<p class='text-zinc-400 italic'>Nothing to preview</p>`,
          }}
        />
      )}
    </div>
  );
}
