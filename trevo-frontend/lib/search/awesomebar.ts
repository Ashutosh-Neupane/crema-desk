/**
 * Awesomebar query parsing + ranking, transcribed from Desk's awesome_bar.js / search_utils.js:
 *  - get_creatables: first word "new" → "New <DocType>" for the doctypes the user can create
 *  - get_search_in_list: "<text> in <DocType>" → the list filtered by <text>
 *  - score(): Desk fuzzy_search order (exact > prefix > word start > substring)
 */

/** Desk score(): 0 exact, 1 prefix, 2 word start, 3 substring; null = no match. Both args lowercased by caller. */
export function score(key: string, q: string): number | null {
  const k = key.toLowerCase();
  if (k === q) return 0;
  if (k.startsWith(q)) return 1;
  if (k.split(/[\s_-]+/).some((w) => w.startsWith(q))) return 2;
  if (k.includes(q)) return 3;
  return null;
}

/** "new" or "new <text>" (case-insensitive) → the text after "new" ("" for a bare "new"); otherwise null. */
export function newDoctypeQuery(input: string): string | null {
  const m = /^new(?:\s+(.*))?$/i.exec(input.trim());
  return m ? (m[1] ?? "").trim().toLowerCase() : null;
}

/** "<text> in <DocType>" → { text, target }; needs both parts (Desk: a trailing " in" is not a search). */
export function searchInQuery(input: string): { text: string; target: string } | null {
  const m = /^(.+?)\s+in\s+(.+)$/i.exec(input.trim());
  if (!m) return null;
  const text = m[1].trim();
  const target = m[2].trim();
  return text && target ? { text, target } : null;
}
