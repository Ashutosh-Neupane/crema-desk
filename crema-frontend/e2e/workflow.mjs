// Workflow on a form: default state, Actions menu from get_transitions (Save/Submit hidden),
// apply_workflow transitions (docstatus follows the state), end of workflow.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/workflow.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "Crema WF Doc";
const WF = "Crema WF";

async function cleanup() {
  const docs = await api(`api/resource/${encodeURIComponent(DT)}?limit_page_length=100&fields=["name","docstatus"]`).catch(() => null);
  for (const d of docs?.data ?? []) {
    if (d.docstatus === 1) await post("frappe.client.cancel", { doctype: DT, name: d.name });
    await post("frappe.client.delete", { doctype: DT, name: d.name });
  }
  await post("frappe.client.delete", { doctype: "Workflow", name: WF });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();

step("setup: submittable custom DocType + workflow");
let r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: DT, module: "Custom", custom: 1, is_submittable: 1, autoname: "hash",
    fields: [
      { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1, in_list_view: 1 },
      { fieldname: "workflow_state", label: "Workflow State", fieldtype: "Link", options: "Workflow State", allow_on_submit: 1, read_only: 1 },
    ],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1 }],
  },
});
check(r.ok(), `DocType created (${r.status()})`);
r = await post("frappe.client.insert", {
  doc: {
    doctype: "Workflow", workflow_name: WF, document_type: DT, is_active: 1, workflow_state_field: "workflow_state", send_email_alert: 0,
    states: [
      { state: "Pending", doc_status: "0", allow_edit: "System Manager" },
      { state: "Approved", doc_status: "1", allow_edit: "System Manager" },
      { state: "Rejected", doc_status: "0", allow_edit: "System Manager" },
    ],
    transitions: [
      { state: "Pending", action: "Approve", next_state: "Approved", allowed: "System Manager", allow_self_approval: 1 },
      { state: "Pending", action: "Reject", next_state: "Rejected", allowed: "System Manager", allow_self_approval: 1 },
    ],
  },
});
check(r.ok(), `Workflow created (${r.status()})`);

async function newDoc(title) {
  await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("heading", { name: `New ${DT}` }).waitFor({ timeout: 90000 });
  await page.getByRole("textbox", { name: /^Title/ }).fill(title);
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.waitForURL(new RegExp(`${encodeURIComponent(DT)}/(?!new)`), { timeout: 30000 });
  await page.waitForTimeout(1500);
  return decodeURIComponent(page.url().split("/").pop());
}

step("new doc saves with the default state; Actions replace Submit");
const a = await newDoc("Approve me");
let d = (await api(`api/resource/${encodeURIComponent(DT)}/${a}`)).data;
check(d?.workflow_state === "Pending", `default state Pending (${d?.workflow_state})`);
const actions = page.getByRole("button", { name: /^Actions/ });
await actions.waitFor({ timeout: 15000 });
check(true, "Actions menu shown");
check(!(await page.getByRole("button", { name: /^Submit$/ }).isVisible()), "Submit hidden while workflow actions exist");
check(await page.getByText("Pending").first().isVisible(), "state indicator");
await actions.click();
check(await page.getByRole("menuitem", { name: "Approve" }).isVisible(), "Approve offered");
check(await page.getByRole("menuitem", { name: "Reject" }).isVisible(), "Reject offered");
await shot("workflow_actions", false);

step("Approve → Approved + submitted");
await page.getByRole("menuitem", { name: "Approve" }).click();
await page.waitForTimeout(2500);
d = (await api(`api/resource/${encodeURIComponent(DT)}/${a}`)).data;
check(d?.workflow_state === "Approved" && d?.docstatus === 1, `state ${d?.workflow_state}, docstatus ${d?.docstatus}`);
check(await page.getByText("Approved").first().isVisible(), "form shows Approved");
check(!(await page.getByRole("button", { name: /^Actions/ }).isVisible()), "no actions at end of workflow");

step("Reject stays draft");
const b = await newDoc("Reject me");
await page.getByRole("button", { name: /^Actions/ }).click();
await page.getByRole("menuitem", { name: "Reject" }).click();
await page.waitForTimeout(2500);
d = (await api(`api/resource/${encodeURIComponent(DT)}/${b}`)).data;
check(d?.workflow_state === "Rejected" && d?.docstatus === 0, `state ${d?.workflow_state}, docstatus ${d?.docstatus}`);

step("editing shows Save again (actions hidden while dirty)");
await page.getByRole("textbox", { name: /^Title/ }).fill("Reject me (edited)");
await page.waitForTimeout(400);
check(await page.getByRole("button", { name: /^Save$/ }).isVisible(), "Save visible when dirty");

step("cleanup");
await cleanup();
await t.finish();
