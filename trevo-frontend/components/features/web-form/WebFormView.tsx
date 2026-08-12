"use client";

import { useState } from "react";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { frappePost } from "@/lib/frappe/client";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { FormBuilderField } from "@/components/features/form-builder/types";

interface WebFormViewProps {
  formId: string;
  title?: string;
  description?: string;
  fields?: FormBuilderField[];
  submitButtonLabel?: string;
  successMessage?: string;
  published?: boolean;
}

export function WebFormView({
  formId,
  title,
  description,
  fields = [],
  submitButtonLabel = "Submit",
  successMessage = "Thank you for your submission!",
  published = false,
}: WebFormViewProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (fieldname: string, value: unknown) => {
    setValues((v) => ({ ...v, [fieldname]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await frappePost(`/api/method/trevo.web_form.submit`, {
        form_id: formId,
        data: values,
      });
      setSubmitted(true);
    } catch {
      setError("Failed to submit form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!published) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-zinc-500">This form is not yet published.</p>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Submitted</h3>
        <p className="mt-2 text-sm text-zinc-500">{successMessage}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.fieldname}>
            <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="mt-1">
              {field.fieldtype === "Text" || field.fieldtype === "Small Text" || field.fieldtype === "Long Text" ? (
                <textarea
                  value={(values[field.fieldname] as string) ?? ""}
                  onChange={(e) => handleChange(field.fieldname, e.target.value)}
                  required={field.required}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  rows={3}
                />
              ) : field.fieldtype === "Check" ? (
                <input
                  type="checkbox"
                  checked={(values[field.fieldname] as boolean) ?? false}
                  onChange={(e) => handleChange(field.fieldname, e.target.checked)}
                  className="rounded"
                />
              ) : field.fieldtype === "Select" ? (
                <select
                  value={(values[field.fieldname] as string) ?? ""}
                  onChange={(e) => handleChange(field.fieldname, e.target.value)}
                  required={field.required}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <option value="">Select an option</option>
                  {(field.options ?? "").split("\n").filter(Boolean).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.fieldtype === "Date" ? (
                <input
                  type="date"
                  value={(values[field.fieldname] as string) ?? ""}
                  onChange={(e) => handleChange(field.fieldname, e.target.value)}
                  required={field.required}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              ) : field.fieldtype === "Int" || field.fieldtype === "Float" || field.fieldtype === "Currency" ? (
                <Input
                  type="number"
                  value={(values[field.fieldname] as string) ?? ""}
                  onChange={(e) => handleChange(field.fieldname, field.fieldtype === "Float" || field.fieldtype === "Currency" ? parseFloat(e.target.value) : parseInt(e.target.value))}
                  required={field.required}
                />
              ) : field.fieldtype === "Email" ? (
                <Input
                  type="email"
                  value={(values[field.fieldname] as string) ?? ""}
                  onChange={(e) => handleChange(field.fieldname, e.target.value)}
                  required={field.required}
                />
              ) : field.fieldtype === "Phone" ? (
                <Input
                  type="tel"
                  value={(values[field.fieldname] as string) ?? ""}
                  onChange={(e) => handleChange(field.fieldname, e.target.value)}
                  required={field.required}
                />
              ) : field.fieldtype === "URL" ? (
                <Input
                  type="url"
                  value={(values[field.fieldname] as string) ?? ""}
                  onChange={(e) => handleChange(field.fieldname, e.target.value)}
                  required={field.required}
                />
              ) : (
                <Input
                  value={(values[field.fieldname] as string) ?? ""}
                  onChange={(e) => handleChange(field.fieldname, e.target.value)}
                  required={field.required}
                />
              )}
            </div>
          </div>
        ))}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Submitting..." : submitButtonLabel}
        </Button>
      </form>
    </Card>
  );
}
