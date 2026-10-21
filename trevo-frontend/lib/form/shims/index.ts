/**
 * ERPNext/app UI helpers that form scripts call from Desk bundles Trevo doesn't load (erpnext.stock.ItemDashboard,
 * erpnext.accounts.ledger_preview, …). One file per helper; each installs itself on the form's runtime.
 */
import type { Runtime } from "@/lib/desk-runtime";
import { install as installItemDashboard } from "./itemDashboard";
import { install as installLedgerPreview } from "./ledgerPreview";
import { install as installSerialBatch } from "./serialBatch";

export interface ShimOptions {
  frm: Record<string, unknown>;
  navigate?: (href: string) => void;
}

export function installShims(rt: Runtime, opts: ShimOptions) {
  installItemDashboard(rt, opts);
  installLedgerPreview(rt, opts);
  installSerialBatch(rt, opts);
}
