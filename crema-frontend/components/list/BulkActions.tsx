"use client";

/**
 * List bulk actions (Desk: list_view.js get_actions_menu_items + bulk_operations.js):
 * Edit · Assign To · Add Tags · Export · workflow actions common to the selection ·
 * Submit / Cancel · Delete.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, X } from "lucide-react";
import { deskCall } from "@/lib/frappe/form";
import { deleteRows, submitOrCancelRows, type Row } from "@/lib/list/api";
import { getWorkflow } from "@/lib/form/workflow";
import { toCsv } from "@/lib/report/columns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import LinkInput from "@/components/list/LinkInput";
import DatePicker from "@/components/form/DatePicker";
import TimePicker from "@/components/form/TimePicker";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

type Kind = "delete" | "submit" | "cancel" | "edit" | "assign" | "tags" | { workflow: string };
const NO_EDIT = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Button", "Table", "Table MultiSelect", "Image", "Fold", "Heading", "Attach Image", "Signature", "Password", "Geolocation", "JSON", "Code"]);
const inputCls = "h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const primaryBtn = "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const ghostBtn = "rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200";

export default function BulkActions({
  meta,
  rows,
  columns,
  onDone,
}: {
  meta: DocTypeMeta;
  /** selected rows (as loaded in the list) */
  rows: Row[];
  /** fields shown in the list, for Export */
  columns: Array<{ fieldname: string; label: string; fieldtype: string }>;
  onDone: () => void;
}) {
  const doctype = meta.name;
  const names = rows.map((r) => r.name);
  const [open, setOpen] = useState<Kind | null>(null);
  const workflow = getWorkflow(meta);

  const { data: wfActions = [] } = useQuery({
    queryKey: ["bulk-workflow-actions", doctype, names],
    enabled: !!workflow && rows.length > 0,
    queryFn: async () => {
      const docs = rows.map((r) => ({ ...r, doctype }));
      return ((await deskCall("frappe.model.workflow.get_common_transition_actions", { docs: JSON.stringify(docs), doctype })).env.message as string[]) ?? [];
    },
  });

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setOpen(null);
    try {
      await fn();
      toast.success(`${label}: ${names.length} ${doctype}${names.length === 1 ? "" : " records"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${label} failed`, { duration: 8000 });
    }
    onDone();
  };

  const exportCsv = () => {
    const cols = [{ fieldname: "name", label: "ID", fieldtype: "Data" }, ...columns.filter((c) => c.fieldname !== "name")];
    const blob = new Blob([toCsv(rows, cols)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doctype}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmKind = open === "delete" || open === "submit" || open === "cancel" || (typeof open === "object" && open) ? open : null;
  const confirmLabel = confirmKind === null ? "" : typeof confirmKind === "object" ? confirmKind.workflow : confirmKind === "delete" ? "Delete" : confirmKind === "submit" ? "Submit" : "Cancel";
  const onConfirm = () => {
    if (!confirmKind) return;
    if (typeof confirmKind === "object") void run(confirmKind.workflow, () => deskCall("frappe.model.workflow.bulk_workflow_approval", { docnames: JSON.stringify(names), doctype, action: confirmKind.workflow }));
    else if (confirmKind === "delete") void run("Deleted", () => deleteRows(doctype, names));
    else void run(confirmKind === "submit" ? "Submitted" : "Cancelled", () => submitOrCancelRows(doctype, names, confirmKind));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Actions ({rows.length}) <ChevronDown className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setOpen("edit")}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("assign")}>Assign To</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("tags")}>Add Tags</DropdownMenuItem>
          <DropdownMenuItem onClick={exportCsv}>Export</DropdownMenuItem>
          {wfActions.length > 0 && <DropdownMenuSeparator />}
          {wfActions.map((a) => (
            <DropdownMenuItem key={a} onClick={() => setOpen({ workflow: a })}>
              {a}
            </DropdownMenuItem>
          ))}
          {meta.is_submittable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOpen("submit")}>Submit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOpen("cancel")}>Cancel</DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen("delete")} className="text-red-600">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!confirmKind} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmLabel} {rows.length} {doctype} {rows.length === 1 ? "record" : "records"}?
            </DialogTitle>
            <DialogDescription>{confirmKind === "delete" ? "This cannot be undone." : "This changes the documents permanently."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setOpen(null)} className={ghostBtn}>
              No
            </button>
            <button type="button" onClick={onConfirm} className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${confirmKind === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"}`}>
              Yes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {open === "edit" && (
        <BulkEdit
          meta={meta}
          count={rows.length}
          onClose={() => setOpen(null)}
          onApply={(field, value) =>
            void run(`Updated ${field.label ?? field.fieldname}`, async () => {
              const { env } = await deskCall("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", { doctype, docnames: JSON.stringify(names), action: "update", data: JSON.stringify({ [field.fieldname]: value }) });
              const failed = (env.message as { failed?: unknown[] } | undefined)?.failed ?? [];
              if (Array.isArray(env.message) && env.message.length) throw new Error(`Could not update ${env.message.length} record(s)`);
              if (failed.length) throw new Error(`Could not update ${failed.length} record(s)`);
            })
          }
        />
      )}
      {open === "assign" && (
        <AssignDialog
          count={rows.length}
          onClose={() => setOpen(null)}
          onApply={(users, comment) => void run("Assigned", () => deskCall("frappe.desk.form.assign_to.add_multiple", { doctype, name: JSON.stringify(names), assign_to: JSON.stringify(users), description: comment, bulk_assign: true }))}
        />
      )}
      {open === "tags" && <TagsDialog count={rows.length} onClose={() => setOpen(null)} onApply={(tags) => void run("Tagged", () => deskCall("frappe.desk.doctype.tag.tag.add_tags", { tags: JSON.stringify(tags), dt: doctype, docs: JSON.stringify(names) }))} />}
    </>
  );
}

function BulkEdit({ meta, count, onClose, onApply }: { meta: DocTypeMeta; count: number; onClose: () => void; onApply: (field: DocField, value: unknown) => void }) {
  const fields = (meta.fields ?? []).filter((f) => !NO_EDIT.has(f.fieldtype) && !f.read_only && !f.hidden && f.fieldname);
  const [fieldname, setFieldname] = useState(fields[0]?.fieldname ?? "");
  const [value, setValue] = useState<unknown>("");
  const df = fields.find((f) => f.fieldname === fieldname);
  const control = () => {
    if (!df) return null;
    switch (df.fieldtype) {
      case "Link":
        return <LinkInput doctype={String(df.options)} value={String(value ?? "")} onChange={setValue} placeholder="Value" className="[&_input]:h-9 [&_input]:w-full" />;
      case "Select":
        return (
          <select aria-label="Value" value={String(value ?? "")} onChange={(e) => setValue(e.target.value)} className={inputCls}>
            {String(df.options ?? "").split("\n").map((o) => (
              <option key={o} value={o}>
                {o || "(empty)"}
              </option>
            ))}
          </select>
        );
      case "Check":
        return (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!value} onChange={(e) => setValue(e.target.checked ? 1 : 0)} /> {df.label}
          </label>
        );
      case "Date":
        return <DatePicker value={String(value ?? "")} onChange={(v) => setValue(v ?? "")} ariaLabel="Value" />;
      case "Time":
        return <TimePicker value={String(value ?? "")} onChange={(v) => setValue(v ?? "")} ariaLabel="Value" />;
      default:
        return <input aria-label="Value" type={["Int", "Float", "Currency", "Percent"].includes(df.fieldtype) ? "number" : "text"} value={String(value ?? "")} onChange={(e) => setValue(e.target.value)} className={inputCls} />;
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Edit</DialogTitle>
          <DialogDescription>
            Set one field on {count} {count === 1 ? "record" : "records"}.
          </DialogDescription>
        </DialogHeader>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Field
          <select
            value={fieldname}
            onChange={(e) => {
              setFieldname(e.target.value);
              setValue("");
            }}
            className={`${inputCls} mt-1 font-normal`}
          >
            {fields.map((f) => (
              <option key={f.fieldname} value={f.fieldname}>
                {f.label ?? f.fieldname}
              </option>
            ))}
          </select>
        </label>
        <div>
          <div className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Value</div>
          {control()}
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" disabled={!df} onClick={() => df && onApply(df, df.fieldtype === "Check" ? (value ? 1 : 0) : value)} className={primaryBtn}>
            Update {count} {count === 1 ? "record" : "records"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ count, onClose, onApply }: { count: number; onClose: () => void; onApply: (users: string[], comment: string) => void }) {
  const [users, setUsers] = useState<string[]>([]);
  const [pick, setPick] = useState(0);
  const [comment, setComment] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign To</DialogTitle>
          <DialogDescription>
            Creates an assignment (ToDo) on {count} {count === 1 ? "record" : "records"} for each user.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1">
          {users.map((u) => (
            <span key={u} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
              {u}
              <button type="button" aria-label={`Remove ${u}`} onClick={() => setUsers(users.filter((x) => x !== u))}>
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
        <LinkInput key={pick} doctype="User" value="" placeholder="Add a user" onChange={(v) => {
          if (v && !users.includes(v)) setUsers([...users, v]);
          setPick((n) => n + 1);
        }} className="[&_input]:h-9 [&_input]:w-full" />
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Comment
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <DialogFooter>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" disabled={!users.length} onClick={() => onApply(users, comment)} className={primaryBtn}>
            Assign
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TagsDialog({ count, onClose, onApply }: { count: number; onClose: () => void; onApply: (tags: string[]) => void }) {
  const [text, setText] = useState("");
  const tags = text.split(",").map((t) => t.trim()).filter(Boolean);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Tags</DialogTitle>
          <DialogDescription>
            Comma-separated; new tags are created. Applies to {count} {count === 1 ? "record" : "records"}.
          </DialogDescription>
        </DialogHeader>
        <input aria-label="Tags" autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tags.length && onApply(tags)} placeholder="urgent, follow-up" className={inputCls} />
        <DialogFooter>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" disabled={!tags.length} onClick={() => onApply(tags)} className={primaryBtn}>
            Add
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
