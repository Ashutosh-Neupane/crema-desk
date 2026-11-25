import { CircleCheck, CircleDot, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneFromIndicator, type StatusTone } from "@/lib/ui/status";

const TONE_ICON: Record<StatusTone, LucideIcon> = {
  neutral: CircleDot,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
};

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)] border-[var(--status-neutral-border)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-fg)] border-[var(--status-info-border)]",
  success: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)] border-[var(--status-success-border)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] border-[var(--status-warning-border)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border-[var(--status-danger-border)]",
};

/**
 * A document status as a plain word + colour + icon (GAPS § 3.1 rules 4 and 7: colour is never the only signal).
 * Pass `tone`, or a Frappe indicator colour (`indicator="green"`) and the tone is derived from it.
 */
export function StatusPill({
  children,
  tone,
  indicator,
  icon,
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  indicator?: string | null;
  /** replaces the tone's default icon */
  icon?: LucideIcon;
  className?: string;
}) {
  const t = tone ?? toneFromIndicator(indicator);
  const Icon = icon ?? TONE_ICON[t];
  return (
    <span
      data-tone={t}
      className={cn(
        "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-4",
        TONE_CLASS[t],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" strokeWidth={2.25} />
      <span className="truncate">{children}</span>
    </span>
  );
}
