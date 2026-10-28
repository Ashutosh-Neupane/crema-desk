/**
 * Document CRUD operations.
 */
import type { FrappeDocument } from "./types";
import { frappeServerFetch, getCookieHeader } from "./server";
import { frappeGet, frappePost, frappePut, frappeDelete, frappeMethod } from "./client";

// ---------------------------------------------------------------------------
// Server-side
// ---------------------------------------------------------------------------

export async function fetchDocumentServer<T extends FrappeDocument = FrappeDocument>(
  doctype: string,
  name: string,
  fields?: string[],
): Promise<T> {
  const cookie = await getCookieHeader();
  const params: Record<string, string | number | boolean | object | null | undefined> = {};
  if (fields) params.fields = JSON.stringify(fields);
  const { data } = await frappeServerFetch<T>(
    cookie,
    `api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    { params },
  );
  if (!data) throw new Error(`Document ${doctype}/${name} not found`);
  return data;
}

// ---------------------------------------------------------------------------
// Client-side
// ---------------------------------------------------------------------------

/** Get a single document. */
export async function fetchDocument<T extends FrappeDocument = FrappeDocument>(
  doctype: string,
  name: string,
  fields?: string[],
): Promise<T> {
  const params: Record<string, unknown> = {};
  if (fields) params.fields = JSON.stringify(fields);
  return frappeGet<T>(`${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, params);
}

/** Save a document using savedocs (the real Frappe desk save path).
 *  Handles Save, Submit, Update actions — runs server-side validations, onchange, naming.
 *  See frappe/desk/form/save.py:savedocs(doc: str, action: str)
 */
export async function savedocs(
  doc: Record<string, unknown>,
  action: "Save" | "Submit" | "Update",
): Promise<Record<string, unknown>> {
  const result = await frappeMethod<Record<string, unknown>>("frappe.desk.form.save.savedocs", {
    doc: JSON.stringify(doc),
    action,
  });
  return result;
}

/** Cancel a submitted document. */
export async function cancelDoc(doctype: string, name: string): Promise<void> {
  await frappeMethod("frappe.desk.form.save.cancel", { doctype, name });
}

/** Discard a draft document. */
export async function discardDoc(doctype: string, name: string): Promise<void> {
  await frappeMethod("frappe.desk.form.save.discard", { doctype, name });
}

/** REST POST — create a document (simpler alternative to savedocs). */
export async function createDocument<T = FrappeDocument>(
  doctype: string,
  data: Record<string, unknown>,
): Promise<T> {
  return frappePost<T>(encodeURIComponent(doctype), data);
}

/** REST PUT — update a document. */
export async function updateDocument<T = FrappeDocument>(
  doctype: string,
  name: string,
  data: Record<string, unknown>,
): Promise<T> {
  return frappePut<T>(`${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, data);
}

/** REST DELETE — delete a document. */
export async function deleteDocument(doctype: string, name: string): Promise<void> {
  await frappeDelete(`${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
}

// ---------------------------------------------------------------------------
// Doc info / timeline (get_doc_info)
// ---------------------------------------------------------------------------

export async function fetchDocInfo(doctype: string, name: string) {
  return frappeMethod<{
    docinfo: {
      comments?: Array<Record<string, unknown>>;
      attachments?: Array<Record<string, unknown>>;
      assignments?: Array<Record<string, unknown>>;
      versions?: Array<Record<string, unknown>>;
      shared?: Array<Record<string, unknown>>;
      tags?: string[];
      workflow_state?: string | null;
      energy_point_logs?: Array<Record<string, unknown>>;
    };
  }>("frappe.desk.form.load.get_doc_info", { doctype, name });
}

/** Add a comment to a document. */
export async function addComment(
  reference_doctype: string,
  reference_name: string,
  content: string,
): Promise<{ name: string }> {
  return frappeMethod("frappe.client.add_comment", {
    reference_doctype,
    reference_name,
    content,
  });
}
