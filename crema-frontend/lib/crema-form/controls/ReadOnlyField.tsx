"use client";

import type { FieldControlProps } from "./index";

export default function ReadOnlyField({ field: _field, value }: FieldControlProps) {
  let display = "-";
  if (value !== null && value !== undefined && value !== "") {
    if (Array.isArray(value)) {
      display = value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
    } else if (typeof value === "object") {
      display = JSON.stringify(value);
    } else {
      display = String(value);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {display}
    </div>
  );
}
