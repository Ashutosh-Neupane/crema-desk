import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

/**
 * DocTypes named by the user (autoname "Prompt", or "name") get a required "Name" field on a new form
 * (Desk: form/layout.js get_new_name_field, placed under the first Tab Break; save.js treats it as mandatory).
 * The value goes to the server as `__newname`.
 */
export const asksForName = (meta: DocTypeMeta | undefined) => ["prompt", "name"].includes(String(meta?.autoname ?? "").toLowerCase());

const NEW_NAME_FIELD = { fieldname: "__newname", label: "Name", fieldtype: "Data", reqd: 1 } as DocField;

// one derived meta per meta object, so the form body's memoised layout isn't rebuilt on every render
const cache = new WeakMap<DocTypeMeta, DocTypeMeta>();

/** meta for the form body with the Name field first (after the first Tab Break when the form starts with one) */
export function withNewNameField(meta: DocTypeMeta): DocTypeMeta {
  let out = cache.get(meta);
  if (!out) {
    const fields = [...(meta.fields ?? [])];
    fields.splice(fields[0]?.fieldtype === "Tab Break" ? 1 : 0, 0, NEW_NAME_FIELD);
    out = { ...meta, fields };
    cache.set(meta, out);
  }
  return out;
}
