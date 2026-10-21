/** sessionStorage key handing a document copy to a new form (Duplicate / Amend / mapped "Create →"). */
export const PREFILL_KEY = (doctype: string) => `trevo:prefill:${doctype}`;

// A taken prefill is remembered briefly: React (StrictMode in dev, or a route remount) can run the new form's
// initializer twice, and the second read must see the same values instead of an already-removed key.
const taken = new Map<string, { at: number; value: Record<string, unknown> }>();

/** Read and consume the prefill for a new `doctype` form ({} when there is none) */
export function takePrefill(doctype: string): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const key = PREFILL_KEY(doctype);
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      sessionStorage.removeItem(key);
      const value = JSON.parse(raw) as Record<string, unknown>;
      taken.set(doctype, { at: Date.now(), value });
      return value;
    }
  } catch {
    return {};
  }
  const hit = taken.get(doctype);
  return hit && Date.now() - hit.at < 3000 ? hit.value : {};
}
