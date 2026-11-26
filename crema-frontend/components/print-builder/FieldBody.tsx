/**
 * What a field card on the Print Format Builder canvas shows (docs/GAPS.md § 2.19 B): one small renderer per
 * fieldtype, the sample record's value for ordinary fields.
 */
import type { CSSProperties, ReactNode } from "react";
import { formatCell } from "@/lib/list/format";
import type { DocTypeMeta } from "@/lib/frappe/types";
import type { PFField } from "@/lib/print-builder/layout";
import { sanitizeHtml } from "@/lib/report/columns";

type Sample = Record<string, unknown> | null;
interface BodyProps {
  f: PFField;
  meta: DocTypeMeta | null;
  sample: Sample;
  label: ReactNode;
  style: CSSProperties;
}

/** what a field card shows: the sample record's value, formatted like the list does */
function sampleValue(f: PFField, meta: DocTypeMeta | null, sample: Sample): string {
  if (!sample) return "";
  const df = meta?.fields?.find((x) => x.fieldname === f.fieldname);
  const v = sample[f.fieldname] ?? (f.fieldname === "name" ? sample.name : undefined);
  if (v == null || v === "") return "";
  return formatCell(v, { fieldtype: df?.fieldtype ?? f.fieldtype, options: df?.options ?? (f.options as string | undefined) }, sample);
}

function StaticTextBody({ f, style }: BodyProps) {
  return <div style={style} className="whitespace-pre-line">{String(f.text ?? "") || <span className="italic text-zinc-400">Empty text</span>}</div>;
}

function HtmlBody({ f }: BodyProps) {
  const html = String(f.html ?? "");
  return (
    <div>
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-400">{String(f.label || "HTML")}</span>
      {html.trim() ? (
        // the block's HTML as it will look (sanitized; Jinja tags show as written until the preview fills them)
        <div className="max-h-40 overflow-hidden [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
      ) : (
        <span className="text-[11px] text-zinc-400">Empty HTML block — write it on the right</span>
      )}
    </div>
  );
}

function SpacerBody({ f }: BodyProps) {
  return <div style={{ height: `${Number(f.height ?? 10)}px` }} className="rounded border border-dashed border-zinc-300 bg-zinc-50" aria-label="Spacer" />;
}

function DividerBody() {
  return <hr className="my-1.5 border-zinc-400" aria-label="Divider" />;
}

function ImageBody({ f }: BodyProps) {
  if (!f.image_url) return <div className="flex h-12 items-center justify-center rounded border border-dashed border-zinc-300 text-xs text-zinc-400">Image (set a URL)</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- user-supplied URL, not an optimisable asset
    <img src={String(f.image_url)} alt={String(f.label ?? "Image")} style={{ width: f.width ? String(f.width) : undefined }} className="max-h-24 max-w-full object-contain" />
  );
}

function BarcodeBody({ f }: BodyProps) {
  return <div className="flex h-12 items-center justify-center rounded border border-dashed border-zinc-300 text-xs text-zinc-500">{f.barcode_format === "QR" ? "QR code" : "Barcode"} · {String(f.barcode_field || f.barcode_value || "no value yet")}</div>;
}

type TableCol = { label?: string; fieldname: string; width?: number };

function TableBody({ f, sample, label }: BodyProps) {
  const cols = (f.table_columns as TableCol[] | undefined) ?? [];
  const rows = ((sample?.[f.fieldname] as Array<Record<string, unknown>> | undefined) ?? []).slice(0, 2);
  const cell = "border border-zinc-300 px-1.5 py-0.5 text-zinc-700";
  return (
    <div>
      {label}
      <table className="mt-0.5 w-full border-collapse text-[0.85em]">
        <thead>
          <tr>{cols.map((c) => <th key={c.fieldname} className="border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-left font-medium">{c.label ?? c.fieldname}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? (
            // child rows carry their own `name`
            rows.map((r) => (
              <tr key={String(r.name)}>{cols.map((c) => <td key={c.fieldname} className={cell}>{r[c.fieldname] == null ? "" : String(r[c.fieldname])}</td>)}</tr>
            ))
          ) : (
            <tr>{cols.map((c) => <td key={c.fieldname} className={cell} />)}</tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ValueBody({ f, meta, sample, label, style }: BodyProps) {
  const v = sampleValue(f, meta, sample);
  return (
    <div style={style} className={f.show_label === "inline" ? "flex gap-2" : ""}>
      {label}
      <div className="min-h-[1.2em] break-words">{v || <span className="text-zinc-300">—</span>}</div>
    </div>
  );
}

const BODIES: Record<string, (p: BodyProps) => ReactNode> = {
  "Static Text": StaticTextBody,
  HTML: HtmlBody,
  Spacer: SpacerBody,
  Divider: DividerBody,
  Image: ImageBody,
  Barcode: BarcodeBody,
  Table: TableBody,
  "Table MultiSelect": TableBody,
};

export default function FieldBody({ f, meta, sample, colon }: { f: PFField; meta: DocTypeMeta | null; sample: Sample; colon: boolean }) {
  const label = f.show_label === "hide" ? null : <span className="text-[0.85em] text-zinc-500">{String(f.label ?? f.fieldname)}{colon && !f.hide_colon ? ":" : ""}</span>;
  const style: CSSProperties = { textAlign: (f.align as CSSProperties["textAlign"]) || undefined, fontWeight: f.bold ? 700 : undefined, fontSize: f.font_size ? `${Number(f.font_size)}px` : undefined };
  const Body = BODIES[f.fieldtype] ?? ValueBody;
  return <Body f={f} meta={meta} sample={sample} label={label} style={style} />;
}
