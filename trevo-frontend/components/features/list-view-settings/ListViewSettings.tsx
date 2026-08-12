"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Settings2, Save, RotateCcw, GripVertical } from "lucide-react";
import { useDoctype } from "@/lib/hooks/useDoctype";

interface ColumnConfig {
  fieldname: string;
  label: string;
  visible: boolean;
  sortable: boolean;
  width?: number;
}

interface GroupConfig {
  fieldname: string;
  direction: "asc" | "desc";
}

interface ListViewSettingsProps {
  onColumnsChange?: (columns: ColumnConfig[]) => void;
  onGroupChange?: (group: GroupConfig | null) => void;
}

export function ListViewSettings({ onColumnsChange, onGroupChange }: ListViewSettingsProps) {
  const params = useParams<{ doctype: string }>();
  const doctype = decodeURIComponent(params.doctype);
  const { data: meta } = useDoctype(doctype);

  const storageKey = `trevo-list-settings-${doctype}`;
  const metaFields = meta?.fields ?? [];

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const [group, setGroup] = useState<GroupConfig | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(`${storageKey}-group`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  // One-time initialization from meta once fields load
  // (adjust-state-during-render pattern; runs only when nothing was persisted)
  if (initializedFor !== doctype && columns.length === 0 && metaFields.length > 0) {
    const listFields = metaFields
      .filter((f) => f.in_list_view && !["Section Break", "Column Break", "Tab Break", "Heading"].includes(f.fieldtype))
      .map((f) => ({
        fieldname: f.fieldname,
        label: f.label || f.fieldname,
        visible: true,
        sortable: true,
        width: 150,
      }));
    setInitializedFor(doctype);
    setColumns(listFields);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(columns));
    } catch {}
    onColumnsChange?.(columns);
  }, [columns, onColumnsChange, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (group) {
        window.localStorage.setItem(`${storageKey}-group`, JSON.stringify(group));
      } else {
        window.localStorage.removeItem(`${storageKey}-group`);
      }
    } catch {}
    onGroupChange?.(group);
  }, [group, onColumnsChange, onGroupChange, storageKey]);

  const toggleColumn = (fieldname: string) => {
    setColumns((cols) =>
      cols.map((c) => (c.fieldname === fieldname ? { ...c, visible: !c.visible } : c)),
    );
  };

  const updateWidth = (fieldname: string, width: number) => {
    setColumns((cols) =>
      cols.map((c) => (c.fieldname === fieldname ? { ...c, width } : c)),
    );
  };

  const resetSettings = () => {
    setColumns(
      metaFields
        .filter((f) => f.in_list_view && !["Section Break", "Column Break", "Tab Break", "Heading"].includes(f.fieldtype))
        .map((f) => ({
          fieldname: f.fieldname,
          label: f.label || f.fieldname,
          visible: true,
          sortable: true,
          width: 150,
        })),
    );
    setGroup(null);
  };

  const visibleCount = columns.filter((c) => c.visible).length;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            List View Settings
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            {visibleCount} of {columns.length} columns visible
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={resetSettings}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
          <Button size="sm" onClick={() => {}}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-zinc-500 mb-2 block">Visible Columns</label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {columns.map((col) => (
              <div
                key={col.fieldname}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <GripVertical className="h-4 w-4 text-zinc-400" />
                <Checkbox
                  checked={col.visible}
                  onChange={() => toggleColumn(col.fieldname)}
                />
                <span className={`flex-1 text-sm ${col.visible ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>
                  {col.label}
                </span>
                {col.visible && (
                  <Input
                    type="number"
                    value={col.width}
                    onChange={(e) => updateWidth(col.fieldname, parseInt(e.target.value) || 150)}
                    className="w-20 h-8 text-xs"
                    min={50}
                    max={400}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 mb-2 block">Group By</label>
          <div className="flex flex-wrap gap-2">
            {columns.filter((c) => c.visible).map((col) => (
              <button
                key={col.fieldname}
                onClick={() => setGroup(group?.fieldname === col.fieldname ? null : { fieldname: col.fieldname, direction: "asc" })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  group?.fieldname === col.fieldname
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {col.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
