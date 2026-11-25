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
import { isCompleteTime, joinTime, pad, parseUserTime, splitTime, type TimeParts } from "@/components/form/dateTimeText";
import { POPOVER_DIALOG_CLASS, pickerInputClass, usePopoverDismiss } from "@/components/form/pickerPopover";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SIXTY = Array.from({ length: 60 }, (_, i) => i);

type TimeColumn = { label: string; i: 0 | 1 | 2; items: number[] };

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
  const parts = splitTime(value);
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDialogElement>(null);
  const pos = useAnchoredPosition(ref, popRef, open);

  usePopoverDismiss(open, () => setOpen(false), ref, popRef);

  // keep the selected values in view when the popover opens
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => popRef.current?.querySelectorAll<HTMLElement>("[aria-selected=true]").forEach((el) => el.scrollIntoView({ block: "center" })), 0);
    return () => clearTimeout(t);
  }, [open]);

  const current = value ? joinTime(parts ?? [0, 0, 0]) : null;
  const emit = (next: string | null) => next !== current && onChange(next);
  const commit = () => {
    if (text === null) return;
    const parsed = parseUserTime(text);
    setText(null);
    // an unreadable entry keeps the old value (Desk's control does the same)
    if (parsed || !text.trim()) emit(parsed);
  };
  const pick = (i: 0 | 1 | 2, n: number) => {
    const next: TimeParts = [...(parts ?? [0, 0, 0])];
    next[i] = n;
    setText(null);
    emit(joinTime(next));
  };

  const shown = text ?? (parts ? (withSeconds ? joinTime(parts) : `${pad(parts[0])}:${pad(parts[1])}`) : "");
  const columns: TimeColumn[] = [
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
          if (isCompleteTime(v)) {
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
        className={pickerInputClass({ compact, error, disabled }, "tabular-nums")}
      />
      <Clock className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      {open && !disabled && typeof document !== "undefined" && createPortal(
        <TimePopover
          popRef={popRef}
          pos={pos}
          columns={columns}
          parts={parts}
          canClear={!!value}
          onPick={pick}
          onNow={() => {
            const d = new Date();
            setText(null);
            emit(joinTime([d.getHours(), d.getMinutes(), withSeconds ? d.getSeconds() : 0]));
            setOpen(false);
          }}
          onClear={() => {
            setText(null);
            emit(null);
            setOpen(false);
          }}
        />,
        document.body,
      )}
    </div>
  );
}

/** the hour / minute (/ second) columns: a non-modal <dialog open> portalled to <body>, anchored to the input */
function TimePopover({
  popRef,
  pos,
  columns,
  parts,
  canClear,
  onPick,
  onNow,
  onClear,
}: {
  popRef: React.RefObject<HTMLDialogElement | null>;
  pos: { top: number; left: number } | null;
  columns: TimeColumn[];
  parts: TimeParts | null;
  canClear: boolean;
  onPick: (i: 0 | 1 | 2, n: number) => void;
  onNow: () => void;
  onClear: () => void;
}) {
  return (
    <dialog
      open
      ref={popRef}
      aria-label="Choose time"
      style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className={POPOVER_DIALOG_CLASS}
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
                  onClick={() => onPick(c.i, n)}
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
        <button type="button" onClick={onNow} className="text-xs font-medium text-zinc-700 hover:underline dark:text-zinc-200">
          Now
        </button>
        {canClear && (
          <button type="button" onClick={onClear} className="text-xs text-zinc-500 hover:underline">
            Clear
          </button>
        )}
      </div>
    </dialog>
  );
}
