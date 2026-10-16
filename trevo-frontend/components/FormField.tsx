"use client";

import { useCallback, useMemo, useState } from "react";
import type { DocField } from "@/lib/frappe/types";

const STRUCTURAL_TYPES = new Set([
  "Section Break", "Column Break", "Tab Break", "Heading", "Read Only", "Button", "HTML",
]);

interface FormFieldProps {
  field: DocField;
  value: unknown;
  onChange: (fieldname: string, value: unknown) => void;
  errors?: Record<string, string>;
}

export function isStructuralField(field: DocField) {
  return STRUCTURAL_TYPES.has(field.fieldtype);
}

export function filterEditableFields(fields: DocField[]) {
  return fields.filter((f) => !STRUCTURAL_TYPES.has(f.fieldtype));
}

export default function FormField({ field, value, onChange, errors }: FormFieldProps) {
  const fieldName = field.fieldname;
  const isReadOnly = !!field.read_only;
  const error = errors?.[fieldName];

  const handleChange = useCallback((next: unknown) => onChange(fieldName, next), [onChange, fieldName]);

  const selectOptions = useMemo(() => {
    if (!field.options) return [];
    return String(field.options).split("\n").filter(Boolean);
  }, [field.options]);

  const widget = useMemo(() => {
    switch (field.fieldtype) {
      case "Check":
        return (
          <input
            id={fieldName}
            type="checkbox"
            checked={!!value}
            onChange={(e) => handleChange(e.target.checked)}
            disabled={isReadOnly}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 disabled:opacity-50"
          />
        );

      case "Select":
      case "Autocomplete":
        return (
          <select
            id={fieldName}
            value={String(value ?? "")}
            onChange={(e) => handleChange(e.target.value || null)}
            disabled={isReadOnly}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100"
          >
            <option value="">{field.reqd ? "Select..." : "--"}</option>
            {selectOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case "Date":
        return (
          <input
            id={fieldName}
            type="date"
            value={String(value ?? "")}
            onChange={(e) => handleChange(e.target.value || null)}
            readOnly={isReadOnly}
            disabled={isReadOnly}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100"
          />
        );

      case "Datetime":
        return (
          <input
            id={fieldName}
            type="datetime-local"
            value={String(value ?? "")}
            onChange={(e) => handleChange(e.target.value || null)}
            readOnly={isReadOnly}
            disabled={isReadOnly}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100"
          />
        );

      case "Time":
        return (
          <input
            id={fieldName}
            type="time"
            value={String(value ?? "")}
            onChange={(e) => handleChange(e.target.value || null)}
            readOnly={isReadOnly}
            disabled={isReadOnly}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100"
          />
        );

      case "Int":
      case "Float":
      case "Currency":
      case "Percent":
        return (
          <input
            id={fieldName}
            type="number"
            value={String(value ?? "")}
            onChange={(e) => handleChange(e.target.value === "" ? null : Number(e.target.value))}
            readOnly={isReadOnly}
            disabled={isReadOnly}
            step={field.fieldtype === "Int" ? "1" : "any"}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100"
          />
        );

      case "Text Editor":
        return (
          <textarea
            id={fieldName}
            value={String(value ?? "")}
            onChange={(e) => handleChange(e.target.value)}
            readOnly={isReadOnly}
            disabled={isReadOnly}
            rows={4}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100"
          />
        );

      case "Link":
      case "Dynamic Link":
      case "Autocomplete": {
        const linkDoctype = field.options ?? "";
        return (
          <LinkFieldInput
            doctype={linkDoctype}
            value={value as string | null}
            onChange={handleChange}
            disabled={isReadOnly}
          />
        );
      }

      default:
        return (
          <input
            id={fieldName}
            type="text"
            value={String(value ?? "")}
            onChange={(e) => handleChange(e.target.value || null)}
            readOnly={isReadOnly}
            disabled={isReadOnly}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100"
          />
        );
    }
  }, [field, value, isReadOnly, fieldName, handleChange, selectOptions]);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldName} className="text-sm font-medium text-zinc-700">
        {field.label || fieldName}
        {field.reqd && <span aria-hidden="true" className="ml-1 text-red-500">*</span>}
      </label>
      {widget}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

function LinkFieldInput({
  doctype,
  value,
  onChange,
  disabled,
}: {
  doctype: string;
  value: string | null;
  onChange: (val: unknown) => void;
  disabled: boolean;
}) {
  const [txt, setTxt] = useState(String(value ?? ""));

  return (
    <input
      type="text"
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value);
        onChange(e.target.value || null);
      }}
      readOnly={disabled}
      disabled={disabled}
      placeholder={`${doctype}...`}
      className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100"
    />
  );
}
