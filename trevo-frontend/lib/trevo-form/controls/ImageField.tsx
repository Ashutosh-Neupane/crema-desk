"use client";

import type { FieldControlProps } from "./index";
import { Image as ImageIcon } from "lucide-react";

/**
 * Image field — displays the value as an image preview.
 * In Frappe, an Image field shows the attachment referenced by its value
 * (typically another Attach/Attach Image field on the same document).
 */
export default function ImageField({ field, value }: FieldControlProps) {
  const src = typeof value === "string" && value ? value : "";

  if (!src) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-1 text-zinc-400">
          <ImageIcon className="h-6 w-6" aria-hidden="true" />
          <span className="text-xs">No image</span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
      {/* eslint-disable-next-line @next/next/no-img-element -- image URL comes from the Frappe backend at runtime */}
      <img
        src={src}
        alt={String(field.label ?? field.fieldname)}
        className="max-h-64 w-full bg-zinc-50 object-contain dark:bg-zinc-900"
      />
    </div>
  );
}
