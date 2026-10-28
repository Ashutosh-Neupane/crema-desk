"use client";

import type { FieldControlProps } from "@/lib/crema-form/controls";

export default function HeadingField({ field }: FieldControlProps) {
  return (
    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
      {field.label || field.fieldname}
    </h3>
  );
}
