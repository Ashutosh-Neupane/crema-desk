"use client";

/**
 * Date input with a shadcn Calendar popover. Shows/accepts the site's
 * date_format (System Settings), stores ISO yyyy-mm-dd like Frappe.
 */
import { useRef, useState } from "react";
import { useAnchoredPosition } from "@/lib/hooks/useAnchoredPosition";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/shadcn/calendar";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { formatForUser, parseUserDate, toIso } from "@/components/form/dateTimeText";
import { POPOVER_DIALOG_CLASS, pickerInputClass, usePopoverDismiss } from "@/components/form/pickerPopover";

export default function DatePicker({
  id,
  value,
  onChange,
  disabled,
  error,
  compact,
  ariaLabel,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
  error?: boolean;
  compact?: boolean;
  ariaLabel?: string;
}) {
  const { data: ctx } = useDeskContext();
  const fmt = String(ctx?.sysdefaults?.date_format ?? "yyyy-mm-dd");
  const iso = value ? String(value).slice(0, 10) : "";
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDialogElement>(null);

  // portalled to <body>, anchored to the input — grids / scroll containers can't clip it
  const pos = useAnchoredPosition(ref, popRef, open);

  usePopoverDismiss(open, () => setOpen(false), ref, popRef);

  const commit = () => {
    if (text === null) return;
    const parsed = parseUserDate(text, fmt);
    setText(null);
    if (parsed !== (iso || null)) onChange(parsed);
  };

  const shown = text ?? (iso ? formatForUser(iso, fmt) : "");
  const selected = iso ? new Date(`${iso}T00:00:00`) : undefined;

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
        value={shown}
        disabled={disabled}
        placeholder={fmt}
        aria-label={ariaLabel}
        onFocus={() => !disabled && setOpen(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            setOpen(false);
          }
        }}
        className={pickerInputClass({ compact, error, disabled })}
      />
      <CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      {open && !disabled && typeof document !== "undefined" && createPortal(
        <DatePopover
          popRef={popRef}
          pos={pos}
          selected={selected}
          canClear={!!iso}
          onPick={(next) => {
            setText(null);
            onChange(next);
            setOpen(false);
          }}
        />,
        document.body,
      )}
    </div>
  );
}

/** the calendar popover: a non-modal <dialog open> portalled to <body>, anchored to the input */
function DatePopover({
  popRef,
  pos,
  selected,
  canClear,
  onPick,
}: {
  popRef: React.RefObject<HTMLDialogElement | null>;
  pos: { top: number; left: number } | null;
  selected: Date | undefined;
  canClear: boolean;
  onPick: (iso: string | null) => void;
}) {
  return (
    <dialog open ref={popRef} aria-label="Choose date" style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }} className={POPOVER_DIALOG_CLASS}>
      <Calendar
        mode="single"
        selected={selected}
        defaultMonth={selected}
        captionLayout="dropdown"
        startMonth={new Date(1950, 0)}
        endMonth={new Date(2100, 11)}
        onSelect={(d) => onPick(d ? toIso(d) : null)}
      />
      <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(toIso(new Date()))} className="text-xs font-medium text-zinc-700 hover:underline dark:text-zinc-200">
          Today
        </button>
        {canClear && (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(null)} className="text-xs text-zinc-500 hover:underline">
            Clear
          </button>
        )}
      </div>
    </dialog>
  );
}
