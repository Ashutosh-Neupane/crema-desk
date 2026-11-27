/**
 * What a form section shows (components/form/FormBody.tsx → FormSection.tsx). Desk's rules (form/section.js): a
 * collapsible section starts collapsed unless collapsible_depends_on is true or it holds an error. The New layout adds
 * folding on a saved document (docs/PHASE2_DESIGN.md § 4.3): a section whose fields are all empty and optional starts
 * folded, and a section with more than MORE_AFTER empty optional fields shows them behind "More fields (n)".
 */
import type { DocField } from "@/lib/frappe/types";

export const MORE_AFTER = 6;

export interface SectionPlan {
  /** "collapse": Desk's collapsible section; "fold": the New layout's empty section; "plain": always open */
  mode: "plain" | "collapse" | "fold";
  collapsed: boolean;
  /** the visible fields per column, after More fields */
  cols: DocField[][];
  /** fields of a folded empty section */
  emptyCount: number;
  /** empty optional fields behind More fields (0: no More fields) */
  moreCount: number;
  moreOpen: boolean;
}

export function planSection(input: {
  fieldname: string;
  collapsible: boolean;
  /** collapsible_depends_on is true */
  forcedOpen: boolean;
  /** the section holds a field with an error */
  hasError: boolean;
  /** the visible fields per column */
  cols: DocField[][];
  /** the next section in the tab has no label: it continues this one, so this one never folds */
  continued: boolean;
  /** New layout, saved document, editable */
  fold: boolean;
  isFoldable: (df: DocField) => boolean;
  /** the user flipped Desk's collapse */
  toggled: boolean;
  isOpened: (key: string) => boolean;
}): SectionPlan {
  const all = input.cols.flat();
  const nonEmpty = (cols: DocField[][]) => cols.filter((c) => c.length);
  if (input.collapsible) {
    const byDefault = !input.forcedOpen && !input.hasError;
    return { mode: "collapse", collapsed: input.toggled ? !byDefault : byDefault, cols: nonEmpty(input.cols), emptyCount: 0, moreCount: 0, moreOpen: false };
  }
  if (input.fold && !input.continued && all.every(input.isFoldable)) {
    return { mode: "fold", collapsed: !input.isOpened(input.fieldname), cols: nonEmpty(input.cols), emptyCount: all.length, moreCount: 0, moreOpen: false };
  }
  const extra = input.fold ? all.filter(input.isFoldable) : [];
  const moreCount = extra.length > MORE_AFTER ? extra.length : 0;
  const moreOpen = input.isOpened(`${input.fieldname}:more`);
  const hidden = new Set(moreCount && !moreOpen ? extra.map((f) => f.fieldname) : []);
  return { mode: "plain", collapsed: false, cols: nonEmpty(input.cols.map((c) => c.filter((f) => !hidden.has(f.fieldname)))), emptyCount: 0, moreCount, moreOpen };
}
