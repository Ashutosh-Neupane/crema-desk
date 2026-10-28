/**
 * Form API (browser) — the calls Desk's form makes, through the BFF proxy:
 *   load    frappe.desk.form.load.getdoc        → doc + docinfo
 *   save    frappe.desk.form.save.savedocs      → Save / Submit / Update (runs all server hooks)
 *   cancel  frappe.desk.form.save.cancel
 *   delete  frappe.client.delete
 * Errors throw DeskError carrying Frappe's own message (what Desk would show).
 */
import { frappeErrorMessage, frappeTraceback, parseServerMessages } from "./errors";

export type Doc = Record<string, unknown> & { doctype: string; name: string; docstatus?: number; modified?: string };

export interface DocInfo {
  comments?: Array<Record<string, unknown>>;
  communications?: Array<Record<string, unknown>>;
  versions?: Array<Record<string, unknown>>;
  attachments?: Array<Record<string, unknown>>;
  assignments?: Array<Record<string, unknown>>;
  shared?: Array<Record<string, unknown>>;
  tags?: string;
  permissions?: Record<string, 0 | 1>;
  is_document_followed?: boolean;
  [key: string]: unknown;
}

export class DeskError extends Error {
  excType?: string;
  serverMessages: string[];
  status: number;
  /** Server traceback (Desk's `exc`), present only when the server allows showing it */
  traceback?: string;
  constructor(message: string, opts: { excType?: string; serverMessages?: string[]; status: number; traceback?: string }) {
    super(message);
    this.name = "DeskError";
    this.excType = opts.excType;
    this.serverMessages = opts.serverMessages ?? [];
    this.status = opts.status;
    this.traceback = opts.traceback;
  }
}

interface Envelope {
  message?: unknown;
  docs?: Doc[];
  docinfo?: DocInfo;
  exc_type?: string;
  _server_messages?: string;
  [key: string]: unknown;
}

/** Call a whitelisted method; returns the raw envelope plus non-error msgprints. */
export async function deskCall(
  method: string,
  args: Record<string, unknown> = {},
  opts: { get?: boolean } = {},
): Promise<{ env: Envelope; messages: string[] }> {
  const url = `/api/frappe/api/method/${method}`;
  const res = opts.get
    ? await fetch(`${url}?${new URLSearchParams(Object.entries(args).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]))}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
    : await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
  const env = ((await res.json().catch(() => ({}))) ?? {}) as Envelope;
  const messages = parseServerMessages(env._server_messages);
  if (!res.ok || env.exc_type) {
    throw new DeskError(frappeErrorMessage(env, messages, res.status), {
      excType: env.exc_type,
      serverMessages: messages,
      status: res.status,
      traceback: frappeTraceback(env),
    });
  }
  return { env, messages };
}

export async function getDoc(doctype: string, name: string): Promise<{ doc: Doc; docinfo: DocInfo }> {
  const { env } = await deskCall("frappe.desk.form.load.getdoc", { doctype, name }, { get: true });
  const doc = env.docs?.[0];
  if (!doc) throw new DeskError(`${doctype} ${name} not found`, { status: 404 });
  return { doc, docinfo: env.docinfo ?? {} };
}

/** Temporary name Desk gives unsaved docs: new-sales-order-1 */
export function newDocName(doctype: string): string {
  return `new-${doctype.toLowerCase().replace(/\s+/g, "-")}-1`;
}

export function isNewDoc(doc: Partial<Doc> | null | undefined): boolean {
  return !!doc && (!!doc.__islocal || !doc.name || String(doc.name).startsWith("new-"));
}

export type SaveAction = "Save" | "Submit" | "Update";

/** Save via savedocs; returns the doc as the server stored it (hooks may change values). */
export async function saveDoc(doc: Doc, action: SaveAction = "Save"): Promise<{ doc: Doc; messages: string[] }> {
  const payload: Record<string, unknown> = { ...doc };
  if (isNewDoc(doc)) {
    payload.__islocal = 1;
    payload.name = String(doc.name ?? "").startsWith("new-") ? doc.name : newDocName(doc.doctype);
  }
  const { env, messages } = await deskCall("frappe.desk.form.save.savedocs", { doc: JSON.stringify(payload), action });
  const saved = env.docs?.[0];
  if (!saved) throw new DeskError("Save returned no document", { status: 500 });
  return { doc: saved, messages };
}

export async function cancelDoc(doctype: string, name: string): Promise<{ doc: Doc; messages: string[] }> {
  const { env, messages } = await deskCall("frappe.desk.form.save.cancel", { doctype, name });
  return { doc: (env.docs?.[0] ?? env.message) as Doc, messages };
}

export async function deleteDoc(doctype: string, name: string): Promise<void> {
  await deskCall("frappe.client.delete", { doctype, name });
}
