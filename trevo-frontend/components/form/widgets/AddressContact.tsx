"use client";

/**
 * frappe.contacts.render_address_and_contact (frappe/public/js/frappe/utils/address_and_contact.js +
 * form/templates/address_list.html, contact_list.html): cards from doc.__onload.addr_list / contact_list
 * in the `address_html` / `contact_html` HTML fields, with Edit / Set as Primary / Unlink menu and
 * New Address / New Contact buttons that open a new form linked to this document. Hidden on new docs.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Ellipsis, MapPin, Mail, Phone, Plus, Smartphone, User } from "lucide-react";
import { toast } from "sonner";
import { deskCall, getDoc, isNewDoc } from "@/lib/frappe/form";
import { confirm as deskConfirm } from "@/lib/desk-runtime/dialogs";
import { PREFILL_KEY } from "@/lib/form/prefill";
import type { WidgetProps } from "./index";

type Rec = Record<string, unknown> & { name: string };

const GROUPS = {
  address_html: { doctype: "Address", onload: "addr_list", flag: "is_primary_address", noun: "address", plural: "addresses" },
  contact_html: { doctype: "Contact", onload: "contact_list", flag: "is_primary_contact", noun: "contact", plural: "contacts" },
} as const;

const enc = encodeURIComponent;

const s = (v: unknown) => (v == null ? "" : String(v));

export function AddressContact({ ctl, readOnly, fieldname }: WidgetProps & { fieldname: keyof typeof GROUPS }) {
  const g = GROUPS[fieldname];
  const router = useRouter();
  const doc = ctl.getDoc();
  const onload = doc.__onload as Record<string, unknown> | undefined;
  const [menu, setMenu] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  // Desk is_loaded: only when the server sent the list (saved docs of linkable doctypes)
  if (isNewDoc(doc) || !onload || !(g.onload in onload)) return null;

  const records = (onload[g.onload] as Rec[]) ?? [];
  const primaryField = (ctl.meta.fields ?? []).find((df) => df.fieldtype === "Link" && df.options === g.doctype && /primary/i.test(df.fieldname))?.fieldname;
  const primaryName = primaryField ? s(doc[primaryField]) : records.find((r) => r[g.flag])?.name;
  const sorted = [...records].sort((a, b) => Number(b.name === primaryName) - Number(a.name === primaryName));
  // Desk frm.reload_doc(): refetch and replace the doc (links changed, but `modified` of this doc may not have)
  const reload = async () => ctl.load((await getDoc(s(doc.doctype), s(doc.name))).doc);
  const setValue = (dt: string, name: string, field: string | Record<string, unknown>, value?: unknown) => deskCall("frappe.client.set_value", { doctype: dt, name, fieldname: typeof field === "string" ? field : JSON.stringify(field), value });

  const create = () => {
    // frappe.dynamic_link + QuickEntry source_frm: the new doc gets this document as its Dynamic Link row
    sessionStorage.setItem(PREFILL_KEY(g.doctype), JSON.stringify({ links: [{ doctype: "Dynamic Link", parentfield: "links", parenttype: g.doctype, link_doctype: doc.doctype, link_name: doc.name }] }));
    router.push(`/desk/doctype/${enc(g.doctype)}/new`);
  };
  const act = async (fn: () => Promise<unknown>) => {
    setMenu(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed", { duration: 10000 });
    }
  };
  const setPrimary = (r: Rec) =>
    act(async () => {
      if (primaryField) return setValue(s(doc.doctype), s(doc.name), primaryField, r.name);
      for (const p of records.filter((o) => o[g.flag] && o.name !== r.name)) {
        // react-doctor-disable-next-line async-await-in-loop
        await setValue(g.doctype, p.name, g.flag, 0);
      }
      return setValue(g.doctype, r.name, g.flag, 1);
    });
  const unsetPrimary = (r: Rec) =>
    act(async () => {
      if (!primaryField) return setValue(g.doctype, r.name, g.flag, 0);
      const updates: Record<string, unknown> = { [primaryField]: null };
      for (const df of ctl.meta.fields ?? []) if (df.fetch_from?.split(".")[0] === primaryField) updates[df.fieldname] = null;
      return setValue(s(doc.doctype), s(doc.name), updates);
    });
  const unlink = (r: Rec) =>
    deskConfirm(`Unlink ${g.doctype} ${r.name} from ${s(doc.name)}?`, () =>
      act(async () => {
        await deskCall("frappe.contacts.address_and_contact.remove_link", { doctype: g.doctype, name: r.name, link_doctype: doc.doctype, link_name: doc.name });
        toast.success(`${g.doctype} unlinked`);
      }),
    );

  const newBtn = (label: string, sm: boolean) =>
    readOnly ? null : (
      <button type="button" onClick={create} className={`inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${sm ? "h-7" : "h-8"}`}>
        <Plus className="h-3.5 w-3.5" aria-hidden /> {label}
      </button>
    );

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
        {g.doctype === "Address" ? <MapPin className="h-6 w-6" aria-hidden /> : <User className="h-6 w-6" aria-hidden />}
        <span>No {g.plural} added yet</span>
        {newBtn(`New ${g.doctype}`, false)}
      </div>
    );
  }

  const line = (icon: React.ReactNode, title: string, body: React.ReactNode) => (
    <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300" title={title}>
      <span className="text-zinc-400">{icon}</span>
      {body}
    </div>
  );

  return (
    <div ref={box} role="group" className="space-y-2" aria-label={`${g.doctype} cards`}>
      <div>{newBtn(g.doctype, true)}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sorted.map((r) => {
          const isPrimary = r.name === primaryName;
          const tags =
            g.doctype === "Address"
              ? [r.address_type !== "Other" ? s(r.address_type) : "", r.is_shipping_address ? "Shipping" : "", r.disabled ? "Disabled" : ""].filter(Boolean).join(" · ")
              : r.is_billing_contact
                ? "Billing"
                : "";
          const mobile = r.mobile_no !== r.phone ? s(r.mobile_no) : "";
          return (
            <div key={r.name} data-name={r.name} className="relative space-y-1 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="absolute right-2 top-2">
                <button type="button" aria-label="Options" aria-haspopup="menu" aria-expanded={menu === r.name} onClick={() => setMenu(menu === r.name ? null : r.name)} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <Ellipsis className="h-4 w-4" aria-hidden />
                </button>
                {menu === r.name && (
                  <div role="menu" className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-900">
                    <Link role="menuitem" href={`/desk/doctype/${enc(g.doctype)}/${enc(r.name)}`} className="block px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Edit
                    </Link>
                    {!readOnly && (
                      <>
                        <button type="button" role="menuitem" onClick={() => void (isPrimary ? unsetPrimary(r) : setPrimary(r))} className="block w-full px-3 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          {isPrimary ? "Unset as Primary" : "Set as Primary"}
                        </button>
                        <button type="button" role="menuitem" onClick={() => unlink(r)} className="block w-full px-3 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          Unlink {g.doctype}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <Link href={`/desk/doctype/${enc(g.doctype)}/${enc(r.name)}`} className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100" aria-label={`Edit ${r.name}`}>
                  {g.doctype === "Address" ? s(r.address_title) : `${s(r.first_name)} ${s(r.last_name)}`.trim()}
                </Link>
                {isPrimary && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Primary</span>}
              </div>
              {tags && <div className="text-xs text-zinc-500">{tags}</div>}
              {g.doctype === "Address" ? (
                // server-rendered by get_address_display (escaped by Frappe), exactly as Desk's template does
                <div className="address-display text-sm text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: s(r.display) }} />
              ) : (
                <>
                  {!!r.designation && line(<Briefcase className="h-3.5 w-3.5" aria-hidden />, "Designation", <span>{s(r.designation)}</span>)}
                  {!!r.phone && line(<Phone className="h-3.5 w-3.5" aria-hidden />, "Primary Phone", <a href={`tel:${s(r.phone)}`}>{s(r.phone)}</a>)}
                  {!!mobile && line(<Smartphone className="h-3.5 w-3.5" aria-hidden />, "Primary Mobile", <a href={`tel:${mobile}`}>{mobile}</a>)}
                  {!!r.email_id && line(<Mail className="h-3.5 w-3.5" aria-hidden />, "Primary Email", <a href={`mailto:${s(r.email_id)}`}>{s(r.email_id)}</a>)}
                  {!r.designation && !r.phone && !mobile && !r.email_id && <div className="text-sm text-zinc-400">No contact details</div>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
