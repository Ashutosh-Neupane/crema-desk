import { Check, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "complete" | "current" | "upcoming" | "error";

export interface Step {
  /** stable id (defaults to the label) */
  key?: string;
  label: string;
  description?: string;
  state: StepState;
}

const STATE_TEXT: Record<StepState, string> = {
  complete: "completed",
  current: "current step",
  upcoming: "not started",
  error: "needs attention",
};

const DOT_CLASS: Record<StepState, string> = {
  complete: "border-[var(--status-success-fg)] bg-[var(--status-success-fg)] text-[var(--card)]",
  current: "border-[var(--focus-color)] bg-[var(--card)] text-[var(--focus-color)] ring-2 ring-[var(--focus-color)] ring-offset-1 ring-offset-[var(--card)]",
  upcoming: "border-[var(--dark-border-color)] bg-[var(--card)] text-[var(--text-muted)]",
  error: "border-[var(--status-danger-fg)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
};

/**
 * Where a document is in its life (GAPS § 2.16 / 3.4: workflow states in the form header). An ordered list with
 * aria-current="step"; each step's state is in text for screen readers and as an icon (not colour only).
 * Vertical in a narrow container, horizontal from 32rem (container query).
 */
export function Stepper({ steps, label = "Progress", className }: { steps: Step[]; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("@container", className)}>
      <ol className="flex flex-col gap-2 @lg:flex-row @lg:items-start @lg:gap-0">
        {steps.map((s, i) => (
          <li
            key={s.key ?? s.label}
            aria-current={s.state === "current" ? "step" : undefined}
            data-state={s.state}
            className="flex min-w-0 items-start gap-2 @lg:flex-1 @lg:flex-col @lg:items-center @lg:text-center"
          >
            <div className="flex items-center @lg:w-full">
              <span aria-hidden="true" className={cn("hidden h-0.5 flex-1 @lg:block", i === 0 ? "invisible" : s.state === "upcoming" ? "bg-[var(--border-color)]" : "bg-[var(--status-success-fg)]")} />
              <span
                aria-hidden="true"
                className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold", DOT_CLASS[s.state])}
              >
                {s.state === "complete" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.state === "error" ? <CircleAlert className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                aria-hidden="true"
                className={cn("hidden h-0.5 flex-1 @lg:block", i === steps.length - 1 ? "invisible" : steps[i + 1].state === "upcoming" ? "bg-[var(--border-color)]" : "bg-[var(--status-success-fg)]")}
              />
            </div>
            <div className="min-w-0 @lg:px-1">
              <div className={cn("text-sm", s.state === "current" ? "font-semibold text-[var(--text-color)]" : "text-[var(--text-muted)]")}>
                {s.label}
                <span className="sr-only">, {STATE_TEXT[s.state]}</span>
              </div>
              {s.description && <div className="text-xs text-[var(--text-muted)]">{s.description}</div>}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
