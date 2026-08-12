"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  Boxes,
  ListChecks,
  Eye,
} from "lucide-react";

type FieldType =
  | "Data"
  | "Link"
  | "Select"
  | "Text"
  | "Text Editor"
  | "Date"
  | "Datetime"
  | "Time"
  | "Int"
  | "Float"
  | "Currency"
  | "Check"
  | "Table"
  | "Rating";

const FIELD_TYPES: FieldType[] = [
  "Data",
  "Link",
  "Select",
  "Text",
  "Text Editor",
  "Date",
  "Datetime",
  "Time",
  "Int",
  "Float",
  "Currency",
  "Check",
  "Table",
  "Rating",
];

interface DocFieldDraft {
  key: string;
  label: string;
  fieldname: string;
  fieldtype: FieldType;
  options: string;
  reqd: boolean;
  in_list_view: boolean;
  in_standard_filter: boolean;
}

interface ModuleOption {
  name: string;
  app_name?: string;
}

function toFieldname(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const genKey = () => Math.random().toString(36).slice(2, 10);

const blankField = (): DocFieldDraft => ({
  key: genKey(),
  label: "",
  fieldname: "",
  fieldtype: "Data",
  options: "",
  reqd: false,
  in_list_view: false,
  in_standard_filter: false,
});

export default function NewDocTypePage() {
  const router = useRouter();

  // Basic info
  const [name, setName] = useState("");
  const [module, setModule] = useState("");
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [istable, setIstable] = useState(false);
  const [issingle, setIssingle] = useState(false);
  const [isSubmittable, setIsSubmittable] = useState(false);
  const [trackChanges, setTrackChanges] = useState(true);

  // Fields
  const [fields, setFields] = useState<DocFieldDraft[]>([blankField()]);

  // Status
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Field dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<DocFieldDraft>(blankField());

  // Load modules from nav API (already metadata-driven)
  useMemo(() => {
    (async () => {
      try {
        const res = await fetch("/api/navigation", { cache: "no-store" });
        if (res.ok) {
          const json = (await res.json()) as { modules?: ModuleOption[] };
          setModules(json?.modules ?? []);
          if (json?.modules?.length) setModule(json.modules[0].name);
        }
      } catch {
        // no-op
      }
    })();
  }, []);

  const openAddField = () => {
    setDraft(blankField());
    setEditingKey(null);
    setDialogOpen(true);
  };

  const openEditField = (key: string) => {
    const f = fields.find((x) => x.key === key);
    if (f) {
      setDraft({ ...f });
      setEditingKey(key);
      setDialogOpen(true);
    }
  };

  const applyFieldDraft = () => {
    if (!draft.fieldname.trim()) {
      setError("Fieldname is required.");
      return;
    }
    setError(null);
    if (editingKey) {
      setFields((prev) => prev.map((f) => (f.key === editingKey ? { ...draft } : f)));
    } else {
      setFields((prev) => [...prev, draft]);
    }
    setDialogOpen(false);
    setEditingKey(null);
  };

  const removeField = (key: string) => {
    setFields((prev) => prev.filter((f) => f.key !== key));
  };

  const fieldDraftCount = useMemo(
    () => fields.filter((f) => f.fieldname.trim()).length,
    [fields],
  );

  const validate = (): string | null => {
    if (!name.trim()) return "DocType name is required.";
    if (!module.trim()) return "Module is required.";
    if (fields.filter((f) => f.fieldname.trim()).length === 0)
      return "Add at least one field.";
    return null;
  };

  const handleCreate = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/doctype/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          module,
          istable,
          issingle,
          is_submittable: isSubmittable,
          track_changes: trackChanges,
          fields: fields
            .filter((f) => f.fieldname.trim())
            .map((f) => ({
              fieldname: f.fieldname,
              label: f.label || f.fieldname,
              fieldtype: f.fieldtype,
              options: f.options || undefined,
              reqd: f.reqd,
              in_list_view: f.in_list_view,
              in_standard_filter: f.in_standard_filter,
            })),
        }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to create DocType.");
        return;
      }
      setSuccess(`DocType "${name}" created successfully.`);
      toast.success(`DocType "${name}" created`);
      setTimeout(() => router.push(`/desk/doctype/${encodeURIComponent(name)}`), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create DocType.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="New DocType"
        description="Visually create a custom DocType — name, module, features and fields. Saved to backend as a full DocType with child DocFields."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Basic Info */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Boxes className="h-4 w-4" /> Basic Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              DocType Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Library Member"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Module *
            </label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {modules.length === 0 && <option value="">Loading modules...</option>}
              {modules.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Features */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
            <input
              type="checkbox"
              checked={issingle}
              onChange={(e) => setIssingle(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Is Single
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
            <input
              type="checkbox"
              checked={istable}
              onChange={(e) => setIstable(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Is Table
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
            <input
              type="checkbox"
              checked={isSubmittable}
              onChange={(e) => setIsSubmittable(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Is Submittable
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
            <input
              type="checkbox"
              checked={trackChanges}
              onChange={(e) => setTrackChanges(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Track Changes
          </label>
        </div>
      </Card>

      {/* Fields */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <ListChecks className="h-4 w-4" /> Fields
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {fieldDraftCount}
            </span>
          </h2>
          <Button variant="outline" size="sm" onClick={openAddField}>
            <Plus className="mr-1 h-4 w-4" /> Add Field
          </Button>
        </div>

        {fields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No fields yet. Click the Add Field button to create your first field.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {fields.map((f, idx) => (
              <div key={f.key} className="flex items-center gap-3 py-2.5">
                <GripVertical className="h-4 w-4 shrink-0 text-zinc-300" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {f.label || f.fieldname}
                    </span>
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {f.fieldtype}
                    </span>
                    {f.reqd && (
                      <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        Reqd
                      </span>
                    )}
                    {f.in_list_view && (
                      <span className="shrink-0 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:bg-green-900/30 dark:text-green-400">
                        List
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-zinc-500">
                    {f.fieldname}
                    {f.options ? ` · ${f.options}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openEditField(f.key)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeField(f.key)}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <span className="w-6 text-right text-xs text-zinc-400">{idx + 1}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/desk/doctype")}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          Create DocType
        </Button>
      </div>

      {/* Field editor dialog */}
      <FieldEditorDialog
        open={dialogOpen}
        draft={draft}
        setDraft={setDraft}
        onSave={applyFieldDraft}
        onClose={() => {
          setDialogOpen(false);
          setEditingKey(null);
        }}
      />
    </div>
  );
}

function FieldEditorDialog({
  open,
  draft,
  setDraft,
  onSave,
  onClose,
}: {
  open: boolean;
  draft: DocFieldDraft;
  setDraft: (d: DocFieldDraft) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            {draft.fieldname ? "Edit Field" : "Add Field"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Label
              </label>
              <input
                type="text"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Field Label"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Fieldname
              </label>
              <input
                type="text"
                value={draft.fieldname}
                onChange={(e) => setDraft({ ...draft, fieldname: toFieldname(e.target.value) || e.target.value })}
                placeholder="field_name"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Field Type
              </label>
              <select
                value={draft.fieldtype}
                onChange={(e) => setDraft({ ...draft, fieldtype: e.target.value as FieldType })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {draft.fieldtype === "Select" ? "Options (one per line)" : "Options"}
              </label>
              <textarea
                value={draft.options}
                onChange={(e) => setDraft({ ...draft, options: e.target.value })}
                placeholder={
                  draft.fieldtype === "Select"
                    ? "Option A\nOption B"
                    : draft.fieldtype === "Link"
                      ? "Link DocType (e.g. User)"
                      : "Optional"
                }
                className="h-20 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
              <input
                type="checkbox"
                checked={draft.reqd}
                onChange={(e) => setDraft({ ...draft, reqd: e.target.checked })}
                className="rounded border-zinc-300"
              />
              Mandatory
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
              <input
                type="checkbox"
                checked={draft.in_list_view}
                onChange={(e) => setDraft({ ...draft, in_list_view: e.target.checked })}
                className="rounded border-zinc-300"
              />
              In List View
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
              <input
                type="checkbox"
                checked={draft.in_standard_filter}
                onChange={(e) => setDraft({ ...draft, in_standard_filter: e.target.checked })}
                className="rounded border-zinc-300"
              />
              Standard Filter
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            <Save className="mr-1 h-4 w-4" />
            {draft.fieldname ? "Save Field" : "Add Field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

