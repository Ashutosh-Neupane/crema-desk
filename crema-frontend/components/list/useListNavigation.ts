"use client";

/** Where a list sends you: Singles and tree DocTypes elsewhere, ?new=1 and Add to the right New. */
import { useEffect, useRef } from "react";
import { redirect, RedirectType, useRouter } from "next/navigation";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { canQuickEntry } from "@/components/form/QuickEntry";
import { docHref, newDocHref, type ListSettings } from "@/components/list/listModel";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

const hasPrimaryAction = (settings: ListSettings) => typeof settings?.primary_action === "function";

/**
 * Redirects decided while rendering (no wrong page flashes first):
 *  - a Single has no list: Desk's router opens its only document (router.set_doctype_route)
 *  - Desk opens tree DocTypes (Account, Item Group, …) in Tree view unless the list is asked for
 *  - ?new=1 (e.g. /desk/doctype/new redirect) goes to the new form unless the app has a primary action, which the
 *    list opens once its JS is loaded
 */
export function useListRedirects({ doctype, meta, settings, view, wantNew }: { doctype: string; meta: DocTypeMeta | undefined; settings: ListSettings; view: string | null; wantNew: boolean }) {
  const opened = useRef(false);
  useEffect(() => {
    if (!wantNew || opened.current || !hasPrimaryAction(settings)) return;
    opened.current = true;
    (settings?.primary_action as () => unknown).call(settings);
  }, [wantNew, settings]);

  if (meta?.issingle) redirect(docHref(doctype, doctype), RedirectType.replace);
  if (meta?.is_tree && view !== "list") redirect(`${doctypeUrl(doctype)}/view/tree`, RedirectType.replace);
  if (wantNew && meta && settings !== undefined && !hasPrimaryAction(settings)) redirect(newDocHref(doctype), RedirectType.push);
}

/** Desk: the app's listview_settings.primary_action replaces New (e.g. DocType's "Create New DocType" dialog) */
export function useAddAction(doctype: string, meta: DocTypeMeta | undefined, settings: ListSettings, openQuickEntry: () => void) {
  const router = useRouter();
  return () => {
    if (hasPrimaryAction(settings)) {
      try {
        (settings?.primary_action as () => unknown).call(settings);
        return;
      } catch (err) {
        console.warn("[list] primary_action failed", err);
      }
    }
    if (meta && canQuickEntry(meta)) openQuickEntry();
    else router.push(newDocHref(doctype));
  };
}
