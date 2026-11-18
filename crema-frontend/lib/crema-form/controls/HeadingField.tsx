"use client";

import type { FieldControlProps } from "@/lib/crema-form/controls";

/** heading.js: the label as an <h4> */
export default function HeadingField({ field }: FieldControlProps) {
  return <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{field.label || field.fieldname}</h4>;
}
