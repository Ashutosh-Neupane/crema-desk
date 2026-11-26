"use client";

/**
 * Table MultiSelect (Desk: form/controls/table_multiselect.js): `options` is a child DocType; its first Link field
 * holds each pick. The value is the child rows ([{ <link field>: "X" }, …]), shown as pills (the link's title for
 * "Show Title in Link Fields" DocTypes) with ✕ to remove and a link to the record; a Link box adds a row (values
 * already chosen are not offered, an unknown value is refused, Backspace in the empty box removes the last pill).
 * In a form, rows go through the form so `<table>_add` / `before_<table>_remove` / `<table>_remove` fire (onAddRow /
 * onRemoveRow); elsewhere (dialogs) the rows are the value (onChange).
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { fetchDoctypeMetaClient } from "@/lib/frappe/doctype";
import { frappeMethod } from "@/lib/frappe/client";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import type { DocField } from "@/lib/frappe/types";
import LinkField from "./LinkField";
import type { FieldControlProps } from "./index";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

type Row = Record<string, unknown> & { name?: string };

interface Props extends FieldControlProps {
  onAddRow?: (values: Record<string, unknown>) => Promise<unknown> | void;
  onRemoveRow?: (row: Row, index: number) => Promise<unknown> | void;
}

function Pill({ doctype, value, onRemove }: { doctype: string; value: string; onRemove?: () => void }) {
  const { data: ctx } = useDeskContext();
  const isTitleLink = ((ctx?.boot?.link_title_doctypes as string[] | undefined) ?? []).includes(doctype);
  const { data: title } = useQuery({
    queryKey: ["link-title", doctype, value],
    queryFn: () => frappeMethod<string>("frappe.desk.search.get_link_title", { doctype, docname: value }).catch(() => value),
    enabled: isTitleLink && !!value,
    staleTime: 5 * 60 * 1000,
  });
  const label = (isTitleLink && title) || value;
  return (
    <span data-pill={value} className="inline-flex max-w-full items-center gap-1 rounded-md bg-zinc-100 py-0.5 pl-2 pr-1 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      <Link href={`${doctypeUrl(doctype)}/${encodeURIComponent(value)}`} title={label !== value ? value : undefined} className="truncate hover:underline">
        {label}
      </Link>
      {onRemove && (
        <button type="button" aria-label={`Remove ${label}`} onMouseDown={(e) => e.preventDefault()} onClick={onRemove} className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export default function TableMultiSelectField(props: Props) {
  const { field, value, onChange, disabled, error, inputId, getQuery, doc, onAddRow, onRemoveRow } = props;
  const childDoctype = String(field.options ?? "");
  const { data: childMeta } = useQuery({
    queryKey: ["doctype-meta-client", childDoctype],
    queryFn: () => fetchDoctypeMetaClient(childDoctype),
    enabled: !!childDoctype,
    staleTime: 5 * 60 * 1000,
  });
  // get_link_field: the child table's first Link field
  const linkField = childMeta?.fields?.find((f) => f.fieldtype === "Link") as DocField | undefined;
  const rows: Row[] = Array.isArray(value) ? (value as Row[]) : [];
  const fn = linkField?.fieldname ?? "";
  const values = rows.map((r) => String(r[fn] ?? "")).filter(Boolean);
  const readOnly = disabled || !!field.read_only;

  const add = async (v: unknown) => {
    const picked = typeof v === "string" ? v.trim() : "";
    if (!picked || !linkField || values.includes(picked)) return;
    let name = picked;
    // validate: the value must exist (validate_link_and_fetch), unless ignore_link_validation
    if (!field.ignore_link_validation) {
      try {
        const r = await frappeMethod<{ name?: string } | null>("frappe.client.validate_link_and_fetch", { doctype: linkField.options, docname: picked, fields_to_fetch: "[]" });
        if (!r?.name) {
          toast.error(`${field.label || field.fieldname}: ${picked} does not exist`);
          return;
        }
        name = r.name;
      } catch {
        /* the server validates on save */
      }
      if (values.includes(name)) return;
    }
    if (onAddRow) await onAddRow({ [fn]: name });
    else onChange([...rows, { [fn]: name }]);
  };
  const remove = (i: number) => {
    if (onRemoveRow) void onRemoveRow(rows[i], i);
    else onChange(rows.filter((_, k) => k !== i));
  };

  if (childMeta && !linkField) {
    return <p role="alert" className="text-sm text-red-600">Table MultiSelect requires a Table with at least one Link field</p>;
  }

  return (
    <div
      data-fieldname={field.fieldname}
      className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 ${readOnly ? "border-transparent bg-zinc-100 dark:bg-zinc-800/70" : error ? "border-red-500" : "border-zinc-300 focus-within:border-zinc-500 dark:border-zinc-700"}`}
      onKeyDownCapture={(e) => {
        // Backspace in the empty box removes the last value
        if (!readOnly && e.key === "Backspace" && (e.target as HTMLInputElement).value === "" && rows.length) remove(rows.length - 1);
      }}
    >
      {values.map((v, i) => (
        <Pill key={v} doctype={String(linkField?.options ?? "")} value={v} onRemove={readOnly ? undefined : () => remove(i)} />
      ))}
      {readOnly && !values.length && <span className="text-sm text-zinc-400">—</span>}
      {!readOnly && linkField && (
        <div className="min-w-[10rem] flex-1 [&_input]:border-0 [&_input]:px-1 [&_input]:py-1 [&_input]:ring-0 [&_input]:focus:ring-0">
          <LinkField
            field={{ ...linkField, fieldname: field.fieldname, label: field.label || linkField.label, reqd: field.reqd, placeholder: field.placeholder, link_filters: field.link_filters ?? linkField.link_filters, only_select: field.only_select } as DocField}
            value=""
            onChange={(v) => void add(v)}
            inputId={inputId}
            getQuery={getQuery}
            doc={doc}
            exclude={values}
            clearOnPick
          />
        </div>
      )}
    </div>
  );
}
