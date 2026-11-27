/**
 * The "New DocType" start step (docs/PHASE2_DESIGN.md § 4.9): plain words → DocType properties.
 * Name rules are Frappe's (core/doctype/doctype/doctype.py validate_name); naming choices map to `naming_rule` +
 * `autoname` (model/naming.py) with a live example of the first name.
 */

export type Kind = "records" | "child" | "single";

export const KINDS: Array<{ value: Kind; label: string; hint: string }> = [
  { value: "records", label: "Records", hint: "A list of documents, each with its own page (Customer, Vehicle)" },
  { value: "child", label: "Rows inside another record", hint: "A table on another form (order lines, contacts)" },
  { value: "single", label: "One settings page", hint: "A single page of settings, no list" },
];

export type Naming = "series" | "prompt" | "autoincrement" | "hash";

export const NAMINGS: Array<{ value: Naming; label: string }> = [
  { value: "series", label: "Series with a prefix" },
  { value: "autoincrement", label: "Number (1, 2, 3…)" },
  { value: "prompt", label: "Typed by the user" },
  { value: "hash", label: "Random" },
];

export interface StartValues {
  name: string;
  module: string;
  kind: Kind;
  submittable: boolean;
  naming: Naming;
  prefix: string;
}

/** Frappe's START_WITH_LETTERS_PATTERN: starts with a letter; letters, numbers, spaces, _ and - */
const NAME_PATTERN = /^(?![\W])[^\d_\s][\w -]+$/;
const MAX_NAME = 61;

export function nameProblem(name: string): string | null {
  if (!name) return "Give it a name";
  if (name !== name.trim()) return "No spaces at the start or end";
  if (name.length > MAX_NAME) return `At most ${MAX_NAME} characters`;
  if (!NAME_PATTERN.test(name)) return "Start with a letter; use letters, numbers, spaces, _ and - only";
  return null;
}

/** a series prefix from the name: "Vehicle Service" → "VS", "Vehicle" → "VEH" */
export function suggestPrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

const PREFIX_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
export const prefixProblem = (p: string) => (!p ? "Add a prefix" : PREFIX_PATTERN.test(p) ? null : "Letters, numbers and - only");

/** the name the first document would get */
export function namingExample(v: Pick<StartValues, "naming" | "prefix" | "name">): string {
  switch (v.naming) {
    case "series":
      return `${v.prefix || "PRE"}-00001`;
    case "autoincrement":
      return "1";
    case "prompt":
      return `typed when saving, e.g. "${v.name ? `My ${v.name}` : "Name"}"`;
    case "hash":
      return "a random code, e.g. 7f3k2p9q1c";
  }
}

/**
 * The DocType to insert, as Desk's "Create New DocType" dialog does (core/doctype/doctype/doctype_list.js): System
 * Manager gets full rights and one Section Break starts the layout; fields are added next in the builder.
 */
export function toDoctypeDoc(v: StartValues): Record<string, unknown> {
  const naming: Record<Naming, [string, string]> = {
    series: ["Expression (old style)", `${v.prefix}-.#####`],
    autoincrement: ["Autoincrement", "autoincrement"],
    prompt: ["Set by user", "prompt"],
    hash: ["Random", "hash"],
  };
  const [rule, autoname] = naming[v.naming];
  const submittable = v.kind === "records" && v.submittable;
  return {
    doctype: "DocType",
    name: v.name.trim(),
    module: v.module,
    // stored in the database, not written into an app's files (Desk's default outside developer mode)
    custom: 1,
    istable: v.kind === "child" ? 1 : 0,
    issingle: v.kind === "single" ? 1 : 0,
    editable_grid: v.kind === "child" ? 1 : 0,
    // child rows and settings pages are never submitted
    is_submittable: submittable ? 1 : 0,
    // child rows are named by Frappe; a single is named after itself
    ...(v.kind === "records" ? { naming_rule: rule, autoname } : {}),
    permissions:
      v.kind === "child"
        ? []
        : [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, report: 1, export: 1, print: 1, email: 1, share: 1, submit: submittable ? 1 : 0, cancel: submittable ? 1 : 0, amend: submittable ? 1 : 0 }],
    fields: [{ fieldtype: "Section Break" }],
  };
}
