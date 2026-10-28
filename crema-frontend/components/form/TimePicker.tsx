"use client";

/**
 * Time input with a popover of hour / minute (/ second) columns, styled like DatePicker (no native
 * <input type="time">). Shows the site's time_format (System Settings: "HH:mm:ss" or "HH:mm"), stores
 * "HH:mm:ss" like Frappe. Typing works too: "14:30", "2:30 pm", "1430".
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { useAnchoredPosition } from "@/lib/hooks/useAnchoredPosition";
import { useDeskContext } from "@/lib/hooks/useDeskContext";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SIXTY = Array.from({ length: 60 }, (_, i) => i);

/** "14:30:00.000000" / "14:30" → [14, 30, 0], or null */
function split(v: string | null | undefined): [number, number, number] | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(v ?? ""));
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
}
const join = ([h, m, s]: [number, number, number]) => `${pad(h)}:${pad(m)}:${pad(s)}`;

/** what the user typed → "HH:mm:ss", or null if it isn't a time */
export function parseUserTime(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const m = /^(\d{1,2})(?:[:.\s]?(\d{2}))?(?:[:.](\d{2}))?\s*(am|pm|a|p)?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const sec = Number(m[3] ?? 0);
  if (m[4]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[4].startsWith("p") ? 12 : 0);
  }
  if (h > 23 || min > 59 || sec > 59) return null;
  return join([h, min, sec]);
}

export default function TimePicker({
  id,
  value,
  onChange,
  disabled,
  error,
  compact,
  ariaLabel,
  className = "",
}: {
  id?: string;
  value: string | null | undefined;
  /** "HH:mm:ss", or null when cleared */
  onChange: (time: string | null) => void;
  disabled?: boolean;
  error?: boolean;
  compact?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const { data: ctx } = useDeskContext();
  const withSeconds = String(ctx?.sysdefaults?.time_format ?? "HH:mm:ss").includes("ss");
  const parts = split(value);
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPosition(ref, popRef, open);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // keep the selected values in view when the popover opens
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => popRef.current?.querySelectorAll<HTMLElement>("[aria-selected=true]").forEach((el) => el.scrollIntoView({ block: "center" })), 0);
    return () => clearTimeout(t);
  }, [open]);

  const current = value ? join(parts ?? [0, 0, 0]) : null;
  const emit = (next: string | null) => next !== current && onChange(next);
  const commit = () => {
    if (text === null) return;
    const parsed = parseUserTime(text);
    setText(null);
    // an unreadable entry keeps the old value (Desk's control does the same)
    if (parsed || !text.trim()) emit(parsed);
  };
  const pick = (i: 0 | 1 | 2, n: number) => {
    const next: [number, number, number] = [...(parts ?? [0, 0, 0])];
    next[i] = n;
    setText(null);
    emit(join(next));
  };

  const shown = text ?? (parts ? (withSeconds ? join(parts) : `${pad(parts[0])}:${pad(parts[1])}`) : "");
  const columns: Array<{ label: string; i: 0 | 1 | 2; items: number[] }> = [
    { label: "Hour", i: 0, items: HOURS },
    { label: "Minute", i: 1, items: SIXTY },
    ...(withSeconds ? [{ label: "Second", i: 2 as const, items: SIXTY }] : []),
  ];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        id={id}
        value={shown}
        disabled={disabled}
        inputMode="numeric"
        placeholder={withSeconds ? "HH:mm:ss" : "HH:mm"}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        onFocus={() => !disabled && setOpen(true)}
        onClick={() => !disabled && setOpen(true)}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          // a complete time ("10:00", "10:00:30", "2:30 pm") goes to the form right away, so Ctrl+S before blur saves it
          // (a half-typed "1" waits for blur / Enter rather than becoming 01:00)
          if (/^\s*\d{1,2}[:.]\d{2}([:.]\d{2})?\s*(am|pm|a|p)?\s*$/i.test(v)) {
            const parsed = parseUserTime(v);
            if (parsed) emit(parsed);
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            setOpen(false);
          }
        }}
        className={[
          "w-full rounded-lg border bg-white pr-8 text-sm tabular-nums text-zinc-900 transition-colors focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100",
          compact ? "h-8 rounded-md border-transparent px-2 hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-700" : "px-3 py-2",
          error ? "border-red-500 focus:ring-red-500/20" : compact ? "focus:ring-0" : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-900/10 dark:border-zinc-700",
          disabled ? "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800" : "",
        ].join(" ")}
      />
      <Clock className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      {open && !disabled && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Choose time"
          style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          className="z-[70] rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex divide-x divide-zinc-100 dark:divide-zinc-800">
            {columns.map((c) => (
              <div key={c.label} role="listbox" aria-label={c.label} className="h-56 w-14 overflow-y-auto overscroll-contain p-1 [scrollbar-width:thin]">
                {c.items.map((n) => {
                  const sel = parts?.[c.i] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="option"
                      aria-selected={sel}
                      onClick={() => pick(c.i, n)}
                      className={[
                        "block w-full rounded-md py-1 text-center text-sm tabular-nums",
                        sel ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
                      ].join(" ")}
                    >
                      {pad(n)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                setText(null);
                emit(join([d.getHours(), d.getMinutes(), withSeconds ? d.getSeconds() : 0]));
                setOpen(false);
              }}
              className="text-xs font-medium text-zinc-700 hover:underline dark:text-zinc-200"
            >
              Now
            </button>
            {value && (
              <button type="button" onClick={() => { setText(null); emit(null); setOpen(false); }} className="text-xs text-zinc-500 hover:underline">
                Clear
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
