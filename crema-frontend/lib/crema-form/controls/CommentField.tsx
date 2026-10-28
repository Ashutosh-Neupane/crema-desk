"use client";

import type { FieldControlProps } from "@/lib/crema-form/controls";

export default function CommentField({ field, value }: FieldControlProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {field.label && (
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {field.label}
        </span>
      )}
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {typeof value === "string" ? value : ""}
      </p>
    </div>
  );
}
