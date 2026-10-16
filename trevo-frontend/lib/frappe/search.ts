/**
 * Search / autocomplete — Link field autocomplete + global search.
 */
import type { SearchLinkResult } from "./types";
import { frappeMethod } from "./client";

/** Autocomplete search for Link fields.
 *  Calls frappe.desk.search.search_link (verified: returns { message: [...] })
 */
export async function searchLink(
  doctype: string,
  txt: string,
  opts?: {
    filters?: unknown;
    reference_doctype?: string;
    page_length?: number;
  },
): Promise<SearchLinkResult[]> {
  const args: Record<string, unknown> = {
    doctype,
    txt,
    page_length: opts?.page_length ?? 10,
  };
  if (opts?.filters) args.filters = typeof opts.filters === "string" ? opts.filters : JSON.stringify(opts.filters);
  if (opts?.reference_doctype) args.reference_doctype = opts.reference_doctype;

  const results = await frappeMethod<SearchLinkResult[]>(
    "frappe.desk.search.search_link",
    args,
  );
  return Array.isArray(results) ? results : [];
}

/**
 * Full-text search across documents — what Desk's awesomebar runs
 * ("Search for …"). Returns [{doctype, name, content, title?}].
 */
export async function globalSearch(txt: string, opts?: { doctype?: string; page_length?: number }) {
  const args: Record<string, unknown> = { text: txt, start: 0, limit: opts?.page_length ?? 20 };
  if (opts?.doctype) args.doctype = opts.doctype;
  return frappeMethod("frappe.utils.global_search.search", args);
}
