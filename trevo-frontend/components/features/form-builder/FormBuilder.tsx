"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical, Plus, Eye, Save, Settings } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { Card } from "@/components/shadcn/card";
import { FieldPalette } from "./FieldPalette";
import { FieldProperties } from "./FieldProperties";
import { FormPreview } from "./FormPreview";
import type { FormBuilderField, BuilderLayoutSection } from "./types";

interface FormBuilderProps {
  doctype: string;
  initialFields?: FormBuilderField[];
  initialSections?: BuilderLayoutSection[];
  onSave?: (layout: BuilderLayoutSection[]) => Promise<void>;
  saving?: boolean;
  readOnly?: boolean;
}

export function FormBuilder({ doctype, initialFields = [], initialSections, onSave, saving: externalSaving, readOnly = false }: FormBuilderProps) {
  const [sections, setSections] = useState<BuilderLayoutSection[]>(
    initialSections ?? [
      { id: "section-1", name: "Main Section", columns: [{ id: "col-1", fields: [] }] },
    ],
  );
  const [selectedField, setSelectedField] = useState<FormBuilderField | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [internalSaving, setInternalSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const saving = externalSaving ?? internalSaving;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const availableFields = useMemo(() => {
    return initialFields.map((f) => ({
      ...f,
      id: f.fieldname,
    }));
  }, [initialFields]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const fieldId = active.id as string;
    const targetId = over.id as string;

    // Find the field being dragged
    const field = availableFields.find((f) => f.fieldname === fieldId);
    if (!field) return;

    // Find target section/column
    const targetSection = sections.find((s) => s.id === targetId);
    if (targetSection) {
      // Dropped on a section - add to first column
      setSections((prev) =>
        prev.map((s) => {
          if (s.id !== targetSection.id) return s;
          return {
            ...s,
            columns: s.columns.map((col, idx) =>
              idx === 0 ? { ...col, fields: [...col.fields, field] } : col
            ),
          };
        })
      );
      return;
    }

    // Find target column
    for (const section of sections) {
      for (const column of section.columns) {
        if (column.id === targetId) {
          setSections((prev) =>
            prev.map((s) => {
              if (s.id !== section.id) return s;
              return {
                ...s,
                columns: s.columns.map((col) =>
                  col.id === column.id ? { ...col, fields: [...col.fields, field] } : col
                ),
              };
            })
          );
          return;
        }
      }
    }
  };

  const handleRemoveField = (fieldId: string) => {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        columns: s.columns.map((col) => ({
          ...col,
          fields: col.fields.filter((f) => f.fieldname !== fieldId),
        })),
      }))
    );
    if (selectedField?.fieldname === fieldId) {
      setSelectedField(null);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setInternalSaving(true);
    try {
      await onSave(sections);
    } finally {
      setInternalSaving(false);
    }
  };

  const allFields = useMemo(() => {
    return sections.flatMap((s) => s.columns.flatMap((c) => c.fields));
  }, [sections]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Form Builder</h2>
          <p className="text-sm text-zinc-500">Design the layout for {doctype}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(!previewOpen)}>
            <Eye className="h-4 w-4 mr-1.5" />
            {previewOpen ? "Edit" : "Preview"}
          </Button>
          {!readOnly && onSave && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </div>

      {previewOpen ? (
        <FormPreview doctype={doctype} fields={allFields} sections={sections} />
      ) : (
        <Tabs value="layout" onValueChange={() => {}} className="space-y-4">
          <TabsList>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="properties">Properties</TabsTrigger>
          </TabsList>

          <TabsContent value="layout">
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="lg:col-span-1">
                <FieldPalette fields={availableFields} />
              </div>
              <div className="lg:col-span-3">
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                  <SortableContext items={sections.flatMap((s) => s.columns.map((c) => c.id))} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {sections.map((section) => (
                        <Card key={section.id} className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{section.name}</h3>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <GripVertical className="h-3 w-3 text-zinc-400" />
                              </Button>
                              {!readOnly && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <Settings className="h-3 w-3 text-zinc-400" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className={`grid gap-4 ${section.columns.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                            {section.columns.map((column) => (
                              <div
                                key={column.id}
                                className="min-h-[100px] rounded-lg border-2 border-dashed border-zinc-200 p-3 dark:border-zinc-700"
                              >
                                {column.fields.length === 0 ? (
                                  <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Drop fields here
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {column.fields.map((field) => (
                                      <div
                                        key={field.fieldname}
                                        role="button"
                                        tabIndex={0}
                                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 ${
                                          selectedField?.fieldname === field.fieldname
                                            ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
                                            : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                                        }`}
                                        onClick={() => setSelectedField(field)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            setSelectedField(field);
                                          }
                                        }}
                                      >
                                        <GripVertical className="h-3 w-3 text-zinc-400" />
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{field.label || field.fieldname}</span>
                                        {!readOnly && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="ml-auto h-6 w-6 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveField(field.fieldname);
                                            }}
                                          >
                                            ×
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </SortableContext>

                  <DragOverlay>
                    {activeId ? (
                      <Card className="p-2 shadow-lg">
                        <span className="text-sm text-zinc-700">
                          {availableFields.find((f) => f.fieldname === activeId)?.label || activeId}
                        </span>
                      </Card>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="properties">
            <FieldProperties field={selectedField} onUpdate={setSelectedField} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
