"use client";

/**
 * What the Print Format Builder previews with (docs/GAPS.md § 2.19 B): the DocType's meta, recent printable records
 * to sample from (Desk printable_sample), the letter heads, and the picked sample record. The picked record, letter
 * head and paper aren't part of a Print Format; they're remembered per format in this browser.
 */
import { useEffect, useState } from "react";
import { fetchDoctypeMetaClient } from "@/lib/frappe/doctype";
import { deskCall, getDoc } from "@/lib/frappe/form";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { PAPERS } from "@/lib/print-builder/layout";

export type Prefs = { record?: string; letterhead?: string; paper?: string };
export type LetterHead = { name: string; is_default?: number };

/** preview record, letter head and paper, kept in localStorage per format */
export function usePrefs(name: string) {
  const prefsKey = `crema.pfb.${name}`;
  const [prefs, setPrefs] = useState<Prefs>({});
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot restore from localStorage after hydration
      setPrefs(JSON.parse(localStorage.getItem(prefsKey) ?? "{}") as Prefs);
    } catch {
      /* private window: defaults */
    }
  }, [prefsKey]);
  // the updater stays pure (React may run it twice); the write happens once, outside it
  const setPref = (patch: Prefs) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(prefsKey, JSON.stringify(next));
    } catch {
      /* not persisted */
    }
  };
  const paper = PAPERS.find((x) => x.key === prefs.paper) ?? PAPERS[0];
  return { prefs, setPref, paper };
}

async function loadRecords(doctype: string, m: DocTypeMeta | null): Promise<string[]> {
  try {
    const { env } = await deskCall("frappe.client.get_list", { doctype, filters: m?.is_submittable ? { docstatus: 1 } : {}, fields: ["name"], order_by: "modified desc", limit_page_length: 20 });
    return ((env.message as Array<{ name: string }> | undefined) ?? []).map((r) => r.name);
  } catch {
    return []; // no records: cards show labels only
  }
}

async function loadLetterHeads(): Promise<LetterHead[]> {
  try {
    const { env } = await deskCall("frappe.client.get_list", { doctype: "Letter Head", filters: { disabled: 0 }, fields: ["name", "is_default"], order_by: "is_default desc, name asc", limit_page_length: 50 });
    return (env.message as LetterHead[]) ?? [];
  } catch {
    return []; // no access to Letter Head: only the default
  }
}

export function useSampleData(doctype: string, record: string | undefined) {
  const [meta, setMeta] = useState<DocTypeMeta | null>(null);
  const [records, setRecords] = useState<string[]>([]);
  const [letterHeads, setLetterHeads] = useState<LetterHead[]>([]);
  const [sample, setSample] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!doctype) return;
    let alive = true;
    void (async () => {
      const m = await fetchDoctypeMetaClient(doctype).catch(() => null);
      if (!alive) return;
      setMeta(m);
      const rs = await loadRecords(doctype, m);
      if (alive) setRecords(rs);
      const lhs = await loadLetterHeads();
      if (alive) setLetterHeads(lhs);
    })();
    return () => {
      alive = false;
    };
  }, [doctype]);

  const sampleName = record && records.includes(record) ? record : records[0];
  useEffect(() => {
    if (!doctype || !sampleName) return;
    let alive = true;
    getDoc(doctype, sampleName)
      .then(({ doc }) => alive && setSample(doc))
      .catch(() => alive && setSample(null));
    return () => {
      alive = false;
    };
  }, [doctype, sampleName]);

  return { meta, records, letterHeads, sample, sampleName };
}
