import type { DocField } from "@/lib/frappe/types";
import { getFieldCurrency } from "@/lib/frappe/format";

/** frappe.meta.get_field_currency — the field's currency field, "Company:company:default_currency", or the default */
export function currencyFor(field: DocField, doc?: Record<string, unknown>): string | undefined {
  return getFieldCurrency(field, doc, (doc?.currency as string) || undefined);
}
