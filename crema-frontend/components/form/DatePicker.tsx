"use client";

/**
 * Date input with a shadcn Calendar popover. Shows/accepts the site's
 * date_format (System Settings), stores ISO yyyy-mm-dd like Frappe.
 */
import { useEffect, useRef, useState } from "react";
import { useAnchoredPosition } from "@/lib/hooks/useAnchoredPosition";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/shadcn/calendar";
import { useDeskContext } from "@/lib/hooks/useDeskContext";

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function formatForUser(iso: string, fmt: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return fmt.replace("yyyy", y).replace("mm", m).replace("dd", d);
}

/** Parse what the user typed in the site's format (or ISO) → ISO, or null */
export function parseUserDate(text: string, fmt: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const parts = t.split(/[^0-9]/).filter(Boolean);
  const order = fmt.split(/[^a-z]/).filter(Boolean); // e.g. ["dd","mm","yyyy"]
  if (parts.length !== 3 || order.length !== 3) return null;
  const get = (k: string) => Number(parts[order.indexOf(k)]);
  let y = get("yyyy");
  const m = get("mm");
  const d = get("dd");
  if (y < 100) y += 2000;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toIso(date);
}

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
  const popRef = useRef<HTMLDivElement>(null);

  // portalled to <body>, anchored to the input — grids / scroll containers can't clip it
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
        className={[
          "w-full rounded-lg border bg-white pr-8 text-sm text-zinc-900 transition-colors focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100",
          compact ? "h-8 rounded-md border-transparent px-2 hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-700" : "px-3 py-2",
          error ? "border-red-500 focus:ring-red-500/20" : compact ? "focus:ring-0" : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-900/10 dark:border-zinc-700",
          disabled ? "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800" : "",
        ].join(" ")}
      />
      <CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      {open && !disabled && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Choose date"
          style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          className="z-[70] rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            captionLayout="dropdown"
            startMonth={new Date(1950, 0)}
            endMonth={new Date(2100, 11)}
            onSelect={(d) => {
              setText(null);
              onChange(d ? toIso(d) : null);
              setOpen(false);
            }}
          />
          <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(toIso(new Date())); setOpen(false); }} className="text-xs font-medium text-zinc-700 hover:underline dark:text-zinc-200">
              Today
            </button>
            {iso && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(null); setOpen(false); }} className="text-xs text-zinc-500 hover:underline">
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
