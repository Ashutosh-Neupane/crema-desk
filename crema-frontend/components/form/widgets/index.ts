/**
 * Native replacements for the jQuery widgets Desk mounts into HTML fields (layer 3 of the
 * compatibility plan in docs/GAPS.md). Keyed by DocType + HTML fieldname; each writes to the
 * same child tables Desk's widget writes to, so saving behaves exactly like Desk.
 *   frappe.RoleEditor   → User.roles_html, Role Profile.roles_html   (Has Role rows)
 *   frappe.ModuleEditor → User.modules_html, Module Profile.module_html (Block Module rows = unchecked)
 */
import { createElement, type ReactNode } from "react";
import { AddressContact } from "./AddressContact";
import { ModuleEditor, RoleEditor } from "./RoleModuleEditors";
import type { WidgetProps } from "./types";

export type { WidgetProps } from "./types";

type Widget = (p: WidgetProps) => ReactNode;

const WIDGETS: Record<string, Record<string, Widget>> = {
  User: { roles_html: (p) => createElement(RoleEditor, p), modules_html: (p) => createElement(ModuleEditor, p) },
  "Role Profile": { roles_html: (p) => createElement(RoleEditor, p) },
  "Module Profile": { module_html: (p) => createElement(ModuleEditor, p) },
};

/** Desk renders these for ANY doctype that has the field (frappe.contacts.render_address_and_contact) */
const FIELD_WIDGETS: Record<string, Widget> = {
  address_html: (p) => createElement(AddressContact, { ...p, fieldname: "address_html" }),
  contact_html: (p) => createElement(AddressContact, { ...p, fieldname: "contact_html" }),
};

export function getHtmlWidget(doctype: string, fieldname: string): Widget | undefined {
  return WIDGETS[doctype]?.[fieldname] ?? FIELD_WIDGETS[fieldname];
}
