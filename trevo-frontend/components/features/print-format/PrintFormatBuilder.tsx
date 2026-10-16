"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import {
  Save,
  Eye,
  Printer,
  Plus,
  GripVertical,
  Trash2,
  Type,
  Image,
  Table,
  FileText,
} from "lucide-react";

interface PrintField {
  fieldname: string;
  label: string;
  type: "field" | "text" | "image" | "table";
  value?: string;
  width?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
}

interface PrintSection {
  id: string;
  label: string;
  fields: PrintField[];
  columns?: number;
}

interface PrintFormatConfig {
  name: string;
  doctype: string;
  sections: PrintSection[];
  pageSize?: "A4" | "Letter" | "Legal";
  orientation?: "portrait" | "landscape";
  margin?: string;
  css?: string;
}

interface PrintFormatBuilderProps {
  doctype?: string;
  formatName?: string;
  initialConfig?: PrintFormatConfig;
  onSave?: (config: PrintFormatConfig) => void;
}

const DEFAULT_SECTION = (id: string): PrintSection => ({
  id,
  label: "Section",
  fields: [],
  columns: 1,
});

export function PrintFormatBuilder({
  doctype,
  formatName,
  initialConfig,
  onSave,
}: PrintFormatBuilderProps) {
  const [config, setConfig] = useState<PrintFormatConfig>(
    initialConfig ?? {
      name: formatName ?? `${doctype ?? "Document"} Print Format`,
      doctype: doctype ?? "Document",
      sections: [DEFAULT_SECTION("section-1")],
      pageSize: "A4",
      orientation: "portrait",
      margin: "15mm",
    },
  );
  const [activeTab, setActiveTab] = useState("design");
  const [editingField, setEditingField] = useState<PrintField | null>(null);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: meta } = useQuery({
    queryKey: ["doctype-meta", doctype],
    queryFn: async () => {
      const res = await fetch(`/api/doctype/${encodeURIComponent(doctype ?? "Document")}/meta`);
      if (!res.ok) throw new Error("Failed to fetch meta");
      return res.json() as Promise<{ fields: Array<{ fieldname: string; label: string; fieldtype: string }> }>;
    },
    enabled: activeTab === "design",
  });

  const fields = meta?.fields ?? [];

  const addSection = useCallback(() => {
    const id = `section-${Date.now()}`;
    setConfig((prev) => ({
      ...prev,
      sections: [...prev.sections, DEFAULT_SECTION(id)],
    }));
  }, []);

  const removeSection = useCallback((sectionId: string) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }));
  }, []);

  const addField = useCallback((sectionId: string, field: PrintField) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, fields: [...s.fields, field] } : s,
      ),
    }));
  }, []);

  const removeField = useCallback((sectionId: string, fieldIndex: number) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, fields: s.fields.filter((_, i) => i !== fieldIndex) }
          : s,
      ),
    }));
  }, []);

  const generatePreview = useCallback(() => {
    let html = `<!DOCTYPE html><html><head><style>
      body { font-family: 'Inter', sans-serif; margin: ${config.margin ?? "15mm"}; font-size: 12px; }
      h1 { font-size: 18px; margin-bottom: 8px; }
      h2 { font-size: 14px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      td, th { padding: 6px 8px; border: 1px solid #ddd; text-align: left; }
      .field-label { color: #666; font-size: 10px; text-transform: uppercase; }
      .field-value { font-size: 12px; }
      @page { size: ${config.pageSize ?? "A4"} ${config.orientation ?? "portrait"}; margin: ${config.margin ?? "15mm"}; }
    </style></head><body>`;
    html += `<h1>${config.name}</h1>`;
    for (const section of config.sections) {
      if (section.fields.length === 0) continue;
      html += `<h2>${section.label}</h2>`;
      html += `<table><tr>`;
      for (const field of section.fields) {
        const align = field.align ?? "left";
        html += `<td style="text-align:${align};${field.bold ? "font-weight:bold;" : ""}${field.width ? `width:${field.width};` : ""}">
          <div class="field-label">${field.label}</div>
          <div class="field-value">${field.value ?? `{{ ${field.fieldname} }}`}</div>
        </td>`;
      }
      html += `</tr></table>`;
    }
    if (config.sections.every((s) => s.fields.length === 0)) {
      html += `<p style="color:#999;text-align:center;">Add fields to design your print format</p>`;
    }
    html += `</body></html>`;
    setPreviewHtml(html);
    setPreviewOpen(true);
  }, [config]);

  const handleSave = useCallback(() => {
    onSave?.(config);
  }, [config, onSave]);

  const getFieldIcon = (type: string) => {
    switch (type) {
      case "image": return Image;
      case "table": return Table;
      case "text": return Type;
      default: return FileText;
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Input
            value={config.name}
            onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
            className="w-64 text-sm font-medium"
          />
          <span className="text-xs text-zinc-500">{doctype}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={generatePreview}>
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="css">CSS</TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="space-y-4">
          {config.sections.map((section, _sectionIndex) => (
            <Card key={section.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Input
                  value={section.label}
                  onChange={(e) => {
                    setConfig((prev) => ({
                      ...prev,
                      sections: prev.sections.map((s) =>
                        s.id === section.id ? { ...s, label: e.target.value } : s,
                      ),
                    }));
                  }}
                  className="w-48 text-sm font-medium"
                />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newField: PrintField = {
                        fieldname: "",
                        label: "New Field",
                        type: "field",
                      };
                      setEditingField(newField);
                      setFieldDialogOpen(true);
                    }}
                    className="h-7"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Field
                  </Button>
                  {config.sections.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSection(section.id)}
                      className="h-7 text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Fields grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {section.fields.map((field, fieldIndex) => {
                  const Icon = getFieldIcon(field.type);
                  return (
                    <div
                      key={fieldIndex}
                      className="group flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <GripVertical className="h-3 w-3 shrink-0 text-zinc-400 cursor-grab" />
                      <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {field.label}
                        </p>
                        <p className="truncate text-[10px] text-zinc-500">{field.fieldname}</p>
                      </div>
                      <button aria-label="Remove field"
                        onClick={() => removeField(section.id, fieldIndex)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {section.fields.length === 0 && (
                  <p className="col-span-full text-center text-sm text-zinc-500 py-4">
                     No fields — click &quot;Add Field&quot; to add content
                  </p>
                )}
              </div>
            </Card>
          ))}

          <Button variant="outline" onClick={addSection} className="w-full">
            <Plus className="h-4 w-4 mr-1" />
            Add Section
          </Button>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Page Size</Label>
                <select aria-label="Page size"
                  value={config.pageSize}
                  onChange={(e) => setConfig((prev) => ({ ...prev, pageSize: e.target.value as "A4" | "Letter" | "Legal" }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>
              <div>
                <Label>Orientation</Label>
                <select aria-label="Orientation"
                  value={config.orientation}
                  onChange={(e) => setConfig((prev) => ({ ...prev, orientation: e.target.value as "portrait" | "landscape" }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
              <div>
                <Label>Margin</Label>
                <Input
                  value={config.margin}
                  onChange={(e) => setConfig((prev) => ({ ...prev, margin: e.target.value }))}
                  placeholder="15mm"
                  className="mt-1"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="css">
          <Card className="p-4">
            <Label>Custom CSS</Label>
            <textarea aria-label="Custom HTML"
              value={config.css ?? ""}
              onChange={(e) => setConfig((prev) => ({ ...prev, css: e.target.value }))}
              className="mt-1 h-64 w-full rounded-lg border border-zinc-300 p-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="/* Add custom CSS here */"
            />
          </Card>
        </TabsContent>
      </Tabs>

      {/* Field addition dialog */}
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Field Type</Label>
              <select aria-label="Field type"
                value={editingField?.type ?? "field"}
                onChange={(e) => setEditingField((prev) => prev ? { ...prev, type: e.target.value as PrintField["type"] } : null)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="field">DocField</option>
                <option value="text">Custom Text</option>
                <option value="image">Image</option>
                <option value="table">Table</option>
              </select>
            </div>
            <div>
              <Label>Field / Label</Label>
              <Input
                value={editingField?.label ?? ""}
                onChange={(e) => setEditingField((prev) => prev ? { ...prev, label: e.target.value } : null)}
                placeholder="Field label"
                className="mt-1"
              />
            </div>
            {editingField?.type === "field" && (
              <div>
                <Label>DocField</Label>
                <select aria-label="DocField"
                  value={editingField?.fieldname ?? ""}
                  onChange={(e) => {
                    const field = fields.find((f) => f.fieldname === e.target.value);
                    setEditingField((prev) => prev ? { ...prev, fieldname: e.target.value, label: field?.label ?? e.target.value } : null);
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">Select field...</option>
                  {fields.map((f) => (
                    <option key={f.fieldname} value={f.fieldname}>
                      {f.label} ({f.fieldname})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Width</Label>
                <Input
                  value={editingField?.width ?? ""}
                  onChange={(e) => setEditingField((prev) => prev ? { ...prev, width: e.target.value } : null)}
                  placeholder="100%"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Align</Label>
                <select aria-label="Alignment"
                  value={editingField?.align ?? "left"}
                  onChange={(e) => setEditingField((prev) => prev ? { ...prev, align: e.target.value as "left" | "center" | "right" } : null)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (editingField) {
                const activeSection = config.sections[0];
                if (activeSection) addField(activeSection.id, editingField);
              }
              setFieldDialogOpen(false);
            }}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Print Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-lg">
            <iframe
              sandbox=""
              srcDoc={previewHtml}
              className="w-full h-full min-h-[60vh]"
              title="Print Preview"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button onClick={() => {
              const win = window.open("", "_blank");
              if (win) {
                win.document.write(previewHtml);
                win.document.close();
                win.focus();
                setTimeout(() => win.print(), 500);
              }
            }}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
