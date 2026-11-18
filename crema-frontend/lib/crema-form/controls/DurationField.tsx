"use client";

/**
 * Duration (Desk: form/controls/duration.js): stored as seconds, shown as "1d 2h 30m"; type "1h 30m" or a number of
 * seconds, or use the picker (days / hours / minutes / seconds; days and seconds hidden by the field's
 * hide_days / hide_seconds).
 */
import { useRef, useState } from "react";
import { formattedDuration, parseDuration, secondsToDuration, durationToSeconds, type DurationParts } from "@/lib/frappe/duration";
import type { FieldControlProps } from "./index";

export default function DurationField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const opts = { hide_days: field.hide_days as number | undefined, hide_seconds: field.hide_seconds as number | undefined };
  const secs = Math.trunc(Number(value) || 0);
  const shown = formattedDuration(secs, opts);
  const [text, setText] = useState<string | null>(null); // null = not editing: show the formatted value
  const [open, setOpen] = useState(false);
  const [bad, setBad] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const readOnly = disabled || !!field.read_only;
  const label = field.label || field.fieldname;
  const parts = secondsToDuration(secs, opts);

  const commitText = () => {
    if (text === null) return;
    const v = parseDuration(text);
    setText(null);
    if (v === null) {
      setBad(true);
      return;
    }
    setBad(false);
    if ((v || 0) !== secs || (v === "" && value)) onChange(v === "" ? null : v);
  };
  const setPart = (k: keyof DurationParts, n: number) => {
    const next = { ...parts, [k]: Math.max(0, Number.isFinite(n) ? n : 0) };
    onChange(durationToSeconds(next) || null);
  };

  if (readOnly) return <div className="min-h-[38px] rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-200">{shown || "—"}</div>;

  const keys: Array<[keyof DurationParts, string]> = [
    ...(opts.hide_days ? [] : [["days", "Days"] as [keyof DurationParts, string]]),
    ["hours", "Hours"],
    ["minutes", "Minutes"],
    ...(opts.hide_seconds ? [] : [["seconds", "Seconds"] as [keyof DurationParts, string]]),
  ];

  return (
    <div
      ref={wrap}
      className="relative"
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <input
        id={inputId ?? field.fieldname}
        type="text"
        aria-label={label}
        aria-invalid={!!error || bad}
        value={text ?? shown}
        placeholder="e.g. 1h 30m"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setBad(false);
        }}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitText();
          } else if (e.key === "Escape") {
            setText(null);
            setOpen(false);
          }
        }}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 ${error || bad ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-900/10 dark:border-zinc-700"}`}
      />
      {bad && <p className="mt-1 text-xs text-red-600">Use a number of seconds or a duration like 1d 2h 30m 15s</p>}
      {open && (
        <div role="group" aria-label={`${label} picker`} className="absolute left-0 top-full z-30 mt-1 flex gap-2 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {keys.map(([k, l]) => (
            <label key={k} className="flex flex-col items-center gap-1 text-xs text-zinc-500">
              <input
                type="number"
                min={0}
                aria-label={l}
                value={parts[k]}
                onChange={(e) => setPart(k, parseInt(e.target.value || "0", 10))}
                className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-center text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              {l}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
