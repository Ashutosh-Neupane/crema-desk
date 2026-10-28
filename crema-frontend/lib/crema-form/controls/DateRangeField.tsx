"use client";

import { useState, useCallback } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import DatePicker from "@/components/form/DatePicker";
import type { FieldControlProps } from "@/lib/crema-form/controls";

/** Stored value is `{from, to}`, possibly JSON-encoded by the backend. */
function parseRange(value: unknown): { from: string; to: string } {
  let v = value;
  if (typeof v === "string" && v.trim().startsWith("{")) {
    try {
      v = JSON.parse(v);
    } catch {
      v = null;
    }
  }
  if (v && typeof v === "object") {
    const r = v as Record<string, unknown>;
    return { from: String(r.from ?? ""), to: String(r.to ?? "") };
  }
  return { from: "", to: "" };
}

export default function DateRangeField({ field, value, onChange, disabled }: FieldControlProps) {
  const [from, setFrom] = useState<string>(() => parseRange(value).from);
  const [to, setTo] = useState<string>(() => parseRange(value).to);

  // Re-sync when the document reloads or another control/script sets the value
  const valueKey = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const [syncedKey, setSyncedKey] = useState(valueKey);
  if (syncedKey !== valueKey) {
    const r = parseRange(value);
    setSyncedKey(valueKey);
    setFrom(r.from);
    setTo(r.to);
  }

  const applyRange = useCallback(() => {
    const range: Record<string, string> = {};
    if (from) range.from = from;
    if (to) range.to = to;
    onChange(Object.keys(range).length ? range : "");
  }, [from, to, onChange]);

  const clear = useCallback(() => {
    setFrom("");
    setTo("");
    onChange("");
  }, [onChange]);

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-4 w-4 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {field.label || field.fieldname}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-40">
          <DatePicker ariaLabel="From date" value={from || null} onChange={(v) => setFrom(v ?? "")} disabled={disabled} />
        </div>
        <span className="text-xs text-zinc-500">to</span>
        <div className="w-40">
          <DatePicker ariaLabel="To date" value={to || null} onChange={(v) => setTo(v ?? "")} disabled={disabled} />
        </div>
        <Button size="sm" onClick={applyRange} disabled={disabled || (!from && !to)}>
          Apply
        </Button>
        {(from || to) && (
          <Button size="sm" variant="ghost" onClick={clear} disabled={disabled}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
