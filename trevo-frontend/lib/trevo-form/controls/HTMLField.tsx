"use client";

import type { FieldControlProps } from "./index";

/**
 * HTML field — Frappe renders the field's `options` as static HTML inside
 * the form layout (no stored value).
 */
export default function HTMLField({ field }: FieldControlProps) {
  const html = String(field.options ?? "");
  if (!html.trim()) return null;

  return (
    <div
      className="prose dark:prose-invert max-w-none text-sm text-zinc-700 dark:text-zinc-300"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
