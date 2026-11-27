"use client";

/** One form section drawn from its plan (lib/form/sectionPlan.ts): heading, columns of fields, More fields. */
import { ChevronDown } from "lucide-react";
import type { SectionPlan } from "@/lib/form/sectionPlan";
import type { DocField } from "@/lib/frappe/types";

const GRID: Record<number, string> = { 2: "@xl:grid-cols-2", 3: "@xl:grid-cols-2 @4xl:grid-cols-3" };
const HEADING = "text-sm font-semibold text-zinc-900 dark:text-zinc-100";

function Chevron({ closed }: { closed: boolean }) {
  return <ChevronDown aria-hidden="true" className={`h-4 w-4 text-zinc-400 transition-transform ${closed ? "-rotate-90" : ""}`} />;
}

/** the label as a plain heading, or as the button that collapses / unfolds the section */
function SectionHeading({ heading, plan, onToggle }: { heading: string; plan: SectionPlan; onToggle: () => void }) {
  if (plan.mode === "plain") return <h3 className={`mb-field ${HEADING}`}>{heading}</h3>;
  return (
    <button type="button" onClick={onToggle} aria-expanded={!plan.collapsed} className={`flex w-full items-center gap-2 text-left ${plan.collapsed ? "" : "mb-field"}`}>
      <h3 className={HEADING}>{heading}</h3>
      {plan.mode === "fold" && plan.collapsed && <span className="text-xs text-zinc-500">{plan.emptyCount} empty</span>}
      <Chevron closed={plan.collapsed} />
    </button>
  );
}

function MoreFields({ plan, onMore }: { plan: SectionPlan; onMore: () => void }) {
  return (
    <button type="button" onClick={onMore} aria-expanded={plan.moreOpen} className="mt-field inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
      <Chevron closed={!plan.moreOpen} />
      {plan.moreOpen ? "Fewer fields" : `More fields (${plan.moreCount} empty)`}
    </button>
  );
}

export default function FormSection({
  label,
  plan,
  frame,
  cards,
  onToggle,
  onMore,
  renderField,
}: {
  /** shown label ("" when the section has none or hides it) */
  label: string;
  plan: SectionPlan;
  frame: string;
  cards: boolean;
  /** collapse / fold flipped */
  onToggle: () => void;
  onMore: () => void;
  renderField: (df: DocField) => React.ReactNode;
}) {
  const n = plan.cols.length;
  // columns follow the form's own width (container queries), so an open sidebar or a dialog doesn't squeeze them
  const grid = GRID[Math.min(n, 3)] ?? "";
  const heading = plan.mode === "fold" ? label || "More details" : label;
  const ariaLabel = plan.mode === "fold" ? heading : cards ? label || undefined : undefined;
  return (
    <section aria-label={ariaLabel} className={frame}>
      {heading && <SectionHeading heading={heading} plan={plan} onToggle={onToggle} />}
      {!plan.collapsed && (
        <div data-cols={n} className={`crema-section-grid grid grid-cols-1 gap-x-column gap-y-field ${grid}`}>
          {plan.cols.map((col) => (
            <div key={col[0].fieldname} className="crema-col flex min-w-0 flex-col gap-field">
              {col.map((f) => renderField(f))}
            </div>
          ))}
        </div>
      )}
      {!plan.collapsed && plan.moreCount > 0 && <MoreFields plan={plan} onMore={onMore} />}
    </section>
  );
}
