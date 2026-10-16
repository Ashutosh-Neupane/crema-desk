"use client";

import { Card } from "@/components/shadcn/card";
import type { FormBuilderField, BuilderLayoutSection } from "./types";

interface FormPreviewProps {
  doctype: string;
  fields: FormBuilderField[];
  sections: BuilderLayoutSection[];
}

export function FormPreview({ doctype, fields: _fields, sections }: FormPreviewProps) {
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Preview: {doctype}</h3>
        <p className="text-sm text-zinc-500">This is how your form will look</p>
      </div>
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        {sections.map((section) => (
          <div key={section.id} className="mb-6">
            <h4 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">{section.name}</h4>
            <div className={`grid gap-4 ${section.columns.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {section.columns.map((column) => (
                <div key={column.id} className="space-y-4">
                  {column.fields.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-400 dark:border-zinc-700">
                      No fields in this column
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {column.fields.map((field) => (
                        <div key={field.fieldname} className="space-y-1">
                          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {field.label || field.fieldname}
                            {field.required && <span aria-hidden="true" className="ml-1 text-red-500">*</span>}
                          </label>
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
                            {field.fieldtype}
                            {field.options && <span className="ml-2 text-xs text-zinc-400">({field.options.split("\n").slice(0, 3).join(", ")}...)</span>}
                          </div>
                          {field.description && <p className="text-xs text-zinc-400">{field.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
