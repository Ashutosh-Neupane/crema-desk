"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import {
  Trash2,
  GripVertical,
  Eye,
  Save,
  Send,
  Settings2,
  Type,
  CheckSquare,
  List,
  Calendar,
  FileText,
  Hash,
  Mail,
  Phone,
  Link as LinkIcon,
  TextCursorInput,
} from "lucide-react";
import type { FormBuilderField } from "@/components/features/form-builder/types";

interface WebFormConfig {
  name: string;
  title: string;
  description?: string;
  doctype: string;
  fields: FormBuilderField[];
  submitButtonLabel?: string;
  successMessage?: string;
  published?: boolean;
}

interface WebFormBuilderProps {
  initialConfig?: WebFormConfig;
  onSave?: (config: WebFormConfig) => void;
  onPublish?: (config: WebFormConfig) => void;
}

const FIELD_TYPES = [
  { type: "Data", label: "Text", icon: Type },
  { type: "Text", label: "Text Area", icon: TextCursorInput },
  { type: "Check", label: "Checkbox", icon: CheckSquare },
  { type: "Select", label: "Select", icon: List },
  { type: "Date", label: "Date", icon: Calendar },
  { type: "Int", label: "Number", icon: Hash },
  { type: "Float", label: "Decimal", icon: Hash },
  { type: "Email", label: "Email", icon: Mail },
  { type: "Phone", label: "Phone", icon: Phone },
  { type: "URL", label: "URL", icon: LinkIcon },
  { type: "Attach", label: "Attachment", icon: FileText },
  { type: "Small Text", label: "Small Text", icon: Type },
];

export function WebFormBuilder({ initialConfig, onSave, onPublish }: WebFormBuilderProps) {
  const [config, setConfig] = useState<WebFormConfig>(
    initialConfig ?? {
      name: "",
      title: "",
      description: "",
      doctype: "",
      fields: [],
      submitButtonLabel: "Submit",
      successMessage: "Thank you for your submission!",
      published: false,
    },
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const addField = useCallback((fieldType: string) => {
    const label = FIELD_TYPES.find((f) => f.type === fieldType)?.label ?? fieldType;
    const newField: FormBuilderField = {
      fieldname: `field_${Date.now()}`,
      label,
      fieldtype: fieldType,
      required: false,
    };
    setConfig((c) => ({ ...c, fields: [...c.fields, newField] }));
  }, []);

  const removeField = useCallback((index: number) => {
    setConfig((c) => ({
      ...c,
      fields: c.fields.filter((_, i) => i !== index),
    }));
  }, []);

  const updateField = useCallback((index: number, updates: Partial<FormBuilderField>) => {
    setConfig((c) => ({
      ...c,
      fields: c.fields.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    }));
  }, []);

  const moveField = useCallback((index: number, direction: "up" | "down") => {
    setConfig((c) => {
      const fields = [...c.fields];
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= fields.length) return c;
      [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
      return { ...c, fields };
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(config);
  }, [config, onSave]);

  const handlePublish = useCallback(() => {
    onPublish?.({ ...config, published: true });
  }, [config, onPublish]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Web Form Builder</h2>
          <p className="text-sm text-zinc-500">Create public-facing forms linked to a DocType</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1" />
            Settings
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            Save Draft
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={!config.title || !config.doctype}>
            <Send className="h-4 w-4 mr-1" />
            Publish
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 p-4">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Field Palette</h3>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map((ft) => (
              <button
                key={ft.type}
                onClick={() => addField(ft.type)}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2 text-left text-sm hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <ft.icon className="h-4 w-4 text-zinc-500" />
                {ft.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2 p-4">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Form Fields</h3>
          {config.fields.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500">Click a field type on the left to add it to your form</p>
            </div>
          ) : (
            <div className="space-y-2">
              {config.fields.map((field, index) => (
                <div
                  key={field.fieldname}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <GripVertical className="h-4 w-4 text-zinc-400" />
                  <div className="flex-1 grid gap-3 sm:grid-cols-2">
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value, fieldname: field.fieldname || e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                      placeholder="Field label"
                    />
                    <select
                      value={field.fieldtype}
                      onChange={(e) => updateField(index, { fieldtype: e.target.value })}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft.type} value={ft.type}>{ft.label}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveField(index, "up")} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" disabled={index === 0}>
                      ↑
                    </button>
                    <button onClick={() => moveField(index, "down")} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" disabled={index === config.fields.length - 1}>
                      ↓
                    </button>
                    <button onClick={() => removeField(index)} className="p-1 hover:bg-red-50 text-red-600 dark:hover:bg-red-900/20 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview: {config.title || "Untitled Form"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {config.description && <p className="text-sm text-zinc-500">{config.description}</p>}
            {config.fields.map((field) => (
              <div key={field.fieldname}>
                <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <div className="mt-1">
                  {field.fieldtype === "Text" || field.fieldtype === "Small Text" ? (
                    <textarea className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" rows={3} readOnly />
                  ) : field.fieldtype === "Check" ? (
                    <input type="checkbox" className="rounded" disabled />
                  ) : field.fieldtype === "Select" ? (
                    <select className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" disabled>
                      <option>Select an option</option>
                    </select>
                  ) : field.fieldtype === "Date" ? (
                    <input type="date" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" disabled />
                  ) : field.fieldtype === "Int" || field.fieldtype === "Float" ? (
                    <input type="number" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" disabled />
                  ) : field.fieldtype === "Email" ? (
                    <input type="email" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" disabled />
                  ) : (
                    <Input disabled />
                  )}
                </div>
              </div>
            ))}
            <Button className="w-full">{config.submitButtonLabel || "Submit"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Form Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Form Title</Label>
              <Input value={config.title} onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))} />
            </div>
            <div>
              <Label>Linked DocType</Label>
              <Input value={config.doctype} onChange={(e) => setConfig((c) => ({ ...c, doctype: e.target.value }))} placeholder="e.g. Lead, Contact" />
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                value={config.description}
                onChange={(e) => setConfig((c) => ({ ...c, description: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                rows={3}
              />
            </div>
            <div>
              <Label>Submit Button Label</Label>
              <Input value={config.submitButtonLabel} onChange={(e) => setConfig((c) => ({ ...c, submitButtonLabel: e.target.value }))} />
            </div>
            <div>
              <Label>Success Message</Label>
              <textarea
                value={config.successMessage}
                onChange={(e) => setConfig((c) => ({ ...c, successMessage: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSettingsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
