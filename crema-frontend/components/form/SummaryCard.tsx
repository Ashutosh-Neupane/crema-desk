"use client";

/**
 * The New layout's summary under the form header (docs/PHASE2_DESIGN.md § 4.3): up to six facts about the document
 * (lib/form/summaryFields.ts). Amounts sit on the right. Nothing shows until one of them has a value, so a new
 * document starts without the card.
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
    <div className={`min-w-0 ${amount ? "text-right" : ""}`}>
      <dt className="truncate text-xs text-[var(--ink-muted)]">{df.label ?? df.fieldname}</dt>
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

export default function SummaryCard({ meta, doc, visible }: { meta: DocTypeMeta; doc: Doc; visible?: (df: DocField) => boolean }) {
  const facts = summaryFields(meta, visible).filter((df) => hasFact(df, doc[df.fieldname]));
  if (!facts.length) return null;
  const amounts = facts.filter((df) => AMOUNT_TYPES.has(df.fieldtype));
  return (
    <section aria-label="Summary" className="rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)] px-4 py-3">
      <dl className="flex flex-wrap items-start gap-x-8 gap-y-3">
        {facts
          .filter((df) => !AMOUNT_TYPES.has(df.fieldtype))
          .map((df) => (
            <Fact key={df.fieldname} df={df} doc={doc} />
          ))}
        {amounts.length > 0 && (
          <div className="ml-auto flex gap-x-8">
            {amounts.map((df) => (
              <Fact key={df.fieldname} df={df} doc={doc} />
            ))}
          </div>
        )}
      </dl>
    </section>
  );
}
