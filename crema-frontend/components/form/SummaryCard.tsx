"use client";

/**
 * The New layout's summary under the form header (docs/PHASE2_DESIGN.md § 4.3): up to six facts about the document
 * (lib/form/summaryFields.ts). Shown as one compact line of facts. Nothing shows until two of them have a value, so a new
 * document starts without it.
 */
import Link from "next/link";
import { formatValue } from "@/lib/frappe/format";
import { docUrl } from "@/lib/navigation/deskUrl";
import { AMOUNT_TYPES, hasFact, summaryFields } from "@/lib/form/summaryFields";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import type { Doc } from "@/lib/frappe/form";

function Fact({ df, doc }: { df: DocField; doc: Doc }) {
  const raw = doc[df.fieldname];
  const shown = formatValue(raw, df, doc);
  const amount = AMOUNT_TYPES.has(df.fieldtype);
  const target = df.fieldtype === "Link" ? df.options : df.fieldtype === "Dynamic Link" && df.options ? String(doc[df.options] ?? "") : "";
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-xs text-[var(--ink-muted)]">{df.label ?? df.fieldname}</dt>
      <dd className={`truncate text-sm font-medium text-[var(--ink-default)] ${amount ? "tabular" : ""}`}>
        {target ? (
          <Link href={docUrl(target, String(raw))} className="hover:underline">
            {shown}
          </Link>
        ) : (
          shown
        )}
      </dd>
    </div>
  );
}

/** one line of label · value pairs under the title (wraps on narrow screens); amounts come last */
export default function SummaryCard({ meta, doc, visible }: { meta: DocTypeMeta; doc: Doc; visible?: (df: DocField) => boolean }) {
  const facts = summaryFields(meta, visible).filter((df) => hasFact(df, doc[df.fieldname]));
  // a single fact (an Item's group) repeats a field just below and isn't worth a row of its own
  if (facts.length < 2) return null;
  const ordered = [...facts.filter((df) => !AMOUNT_TYPES.has(df.fieldtype)), ...facts.filter((df) => AMOUNT_TYPES.has(df.fieldtype))];
  return (
    <section aria-label="Summary" className="-mt-1">
      <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 [&>div+div]:border-l [&>div+div]:border-[var(--outline-default)] [&>div+div]:pl-5">
        {ordered.map((df) => (
          <Fact key={df.fieldname} df={df} doc={doc} />
        ))}
      </dl>
    </section>
  );
}
