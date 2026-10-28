"use client";

import { useState } from "react";
import type { FieldControlProps } from "./index";

export default function JSONField({ field, value, onChange, disabled }: FieldControlProps) {
  const [text, setText] = useState(() => {
    if (typeof value === "string") return value;
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return "";
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (val: string) => {
    setText(val);
    setError(null);
    try {
      const parsed = JSON.parse(val);
      onChange(parsed);
    } catch {
      setError("Invalid JSON");
      onChange(val);
    }
  };

  return (
    <div className="space-y-1">
      <textarea aria-label={field.label || field.fieldname}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled || !!field.read_only}
        rows={6}
        className={`w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500"} bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100`}
      />
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
