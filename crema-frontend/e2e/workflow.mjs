// Workflow on a form: default state, Actions menu from get_transitions (Save/Submit hidden),
// apply_workflow transitions (docstatus follows the state), end of workflow; the workflow bar (stepper, "Waiting on
// you" buttons, condition hint, history), Desk's Help dialog, Workflow Action list rows opening the document.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/workflow.mjs
import { start, BASE, OUT } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "Crema WF Doc";
const WF = "Crema WF";
// a second user without every role (Administrator has all of them and may always self-approve)
const USER = "crema.wf.tester@example.com";
const USER_PASS = "Crema-wf-Test-2026!";
const ROLE = "Crema WF Approver";

async function cleanup() {
  const docs = await api(`api/resource/${encodeURIComponent(DT)}?limit_page_length=100&fields=["name","docstatus"]`).catch(() => null);
  for (const d of docs?.data ?? []) {
    if (d.docstatus === 1) await post("frappe.client.cancel", { doctype: DT, name: d.name });
    await post("frappe.client.delete", { doctype: DT, name: d.name });
  }
  // completed Workflow Actions stay as history and link to the role; remove them so the role can go
  const was = await api(`api/resource/Workflow%20Action?filters=${encodeURIComponent(JSON.stringify([["reference_doctype", "=", DT]]))}&limit_page_length=500`).catch(() => null);
  for (const w of was?.data ?? []) await post("frappe.client.delete", { doctype: "Workflow Action", name: w.name });
  await post("frappe.client.delete", { doctype: "Workflow", name: WF });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
  await post("frappe.client.delete", { doctype: "User", name: USER });
  // the role stays: Frappe's clear_workflow_actions deletes Workflow Actions without their permitted-role rows,
  // and those orphans keep the role "linked"; the suite reuses it
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
r = await post("frappe.client.insert", { doc: { doctype: "Role", role_name: ROLE, desk_access: 1 } });
check(r.ok() || r.status() === 409, `Role ${ROLE} present (${r.status()})`);
// states and actions are link masters; the stock ones (Pending, Approve, …) ship with Frappe
for (const doc of [{ doctype: "Workflow State", workflow_state_name: "Escalated" }, ...["Escalate", "Reopen"].map((a) => ({ doctype: "Workflow Action Master", workflow_action_name: a }))]) {
  const name = doc.workflow_state_name ?? doc.workflow_action_name;
  const have = await api(`api/resource/${encodeURIComponent(doc.doctype)}/${name}`).catch(() => null);
  if (!have?.data) await post("frappe.client.insert", { doc });
}
r = await post("frappe.client.insert", {
  doc: {
    doctype: "Workflow", workflow_name: WF, document_type: DT, is_active: 1, workflow_state_field: "workflow_state", send_email_alert: 0,
    states: [
      { state: "Pending", doc_status: "0", allow_edit: "System Manager" },
      { state: "Approved", doc_status: "1", allow_edit: "System Manager" },
      { state: "Rejected", doc_status: "0", allow_edit: "System Manager" },
      { state: "Escalated", doc_status: "0", allow_edit: "System Manager" },
    ],
    transitions: [
      { state: "Pending", action: "Approve", next_state: "Approved", allowed: "System Manager", allow_self_approval: 1 },
      { state: "Pending", action: "Reject", next_state: "Rejected", allowed: "System Manager", allow_self_approval: 0 },
      { state: "Rejected", action: "Reopen", next_state: "Pending", allowed: ROLE, allow_self_approval: 1 },
      { state: "Pending", action: "Escalate", next_state: "Escalated", allowed: "System Manager", allow_self_approval: 1, condition: "doc.title == 'Escalate'" },
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
check(!(await page.getByRole("menuitem", { name: "Escalate" }).isVisible()), "Escalate held back (condition not met)");
check(await page.getByRole("menuitem", { name: "Help" }).isVisible(), "Help in Actions");
await shot("workflow_actions", false);
await page.getByRole("menuitem", { name: "Help" }).click();
const help = page.getByRole("dialog");
await help.waitFor({ timeout: 5000 });
check(/Current status:\s*Pending/.test(await help.innerText()), "Help: current status");
check(/Approve\s*by role System Manager/.test(await help.innerText()), "Help: next actions with roles");
await page.keyboard.press("Escape");

step("workflow bar: stepper, waiting on you, condition hint");
const bar = page.getByRole("region", { name: "Workflow" });
check(await bar.isVisible(), "workflow bar shown");
const steps = page.getByRole("list", { name: "Workflow steps" });
check((await steps.locator('[aria-current="step"]').innerText()).includes("Pending"), "current step Pending");
const nextSteps = (await steps.locator('[data-step="next"]').allInnerTexts()).join(" ");
check(/Approved/.test(nextSteps) && /Rejected/.test(nextSteps), `next steps (${nextSteps})`);
const waiting = page.getByRole("region", { name: "Waiting on you" });
check(await waiting.isVisible(), "Waiting on you banner");
check(await waiting.getByRole("button", { name: "Approve" }).isVisible() && await waiting.getByRole("button", { name: "Reject" }).isVisible(), "banner has Approve / Reject");
const hint = await page.getByLabel("Unavailable actions").innerText();
check(/Escalate isn't available: the transition's condition isn't met/.test(hint), `condition hint for Escalate (${hint})`);
await shot("workflow_bar", false);

step("Approve (banner button) → Approved + submitted");
await waiting.getByRole("button", { name: "Approve" }).click();
await page.waitForTimeout(2500);
d = (await api(`api/resource/${encodeURIComponent(DT)}/${a}`)).data;
check(d?.workflow_state === "Approved" && d?.docstatus === 1, `state ${d?.workflow_state}, docstatus ${d?.docstatus}`);
check(await page.getByText("Approved").first().isVisible(), "form shows Approved");
check(!(await page.getByRole("button", { name: /^Actions/ }).isVisible()), "no actions at end of workflow");
check(await steps.getByText("End of workflow").isVisible(), "stepper: end of workflow");
const done = (await steps.locator('[data-step="done"]').allInnerTexts()).join(" ");
check(/Pending/.test(done) && /you/.test(done), `history: Pending by you (${done})`);
check(!(await page.getByRole("region", { name: "Waiting on you" }).isVisible()), "no banner at the end");

step("Workflow Action list: an open action opens the document");
const b = await newDoc("Reject me");
await page.goto(`${BASE}/desk/doctype/Workflow%20Action?reference_name=${encodeURIComponent(b)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
const waRow = page.getByRole("link", { name: b }).first();
await waRow.waitFor({ timeout: 60000 });
check(true, "Workflow Action row for the pending doc");
await waRow.click();
await page.waitForURL(new RegExp(`${encodeURIComponent(DT).replace(/%20/g, "(%20| )")}/${b}`), { timeout: 60000 }).catch(() => {});
check(decodeURIComponent(page.url()).includes(`${DT}/${b}`), `row opened the document (${decodeURIComponent(page.url()).replace(BASE, "")})`);
await page.getByRole("region", { name: "Waiting on you" }).waitFor({ timeout: 30000 });

step("Reject stays draft");
await page.getByRole("button", { name: /^Actions/ }).click();
await page.getByRole("menuitem", { name: "Reject" }).click();
await page.waitForTimeout(2500);
d = (await api(`api/resource/${encodeURIComponent(DT)}/${b}`)).data;
check(d?.workflow_state === "Rejected" && d?.docstatus === 0, `state ${d?.workflow_state}, docstatus ${d?.docstatus}`);

// Frappe closes the Pending action and opens one for the next step (Reopen, for ROLE)
const wa = (await api(`api/resource/Workflow%20Action?filters=${encodeURIComponent(JSON.stringify([["reference_name", "=", b]]))}&fields=["status","workflow_state"]`)).data ?? [];
const waBy = (st) => wa.find((x) => x.workflow_state === st)?.status;
check(waBy("Pending") === "Completed" && waBy("Rejected") === "Open", `Workflow Actions: Pending completed, Rejected open (${JSON.stringify(wa)})`);

step("editing shows Save again (actions hidden while dirty)");
await page.getByRole("textbox", { name: /^Title/ }).fill("Reject me (edited)");
await page.waitForTimeout(400);
check(await page.getByRole("button", { name: /^Save$/ }).isVisible(), "Save visible when dirty");

step("condition met: Escalate offered");
await newDoc("Escalate");
await page.getByRole("region", { name: "Waiting on you" }).waitFor({ timeout: 30000 });
check(await page.getByRole("region", { name: "Waiting on you" }).getByRole("button", { name: "Escalate" }).isVisible(), "Escalate button shown");
check(!(await page.getByLabel("Unavailable actions").isVisible()), "no condition hint");

step("second user: self-approval off, waiting on another role");
r = await post("frappe.client.insert", {
  doc: { doctype: "User", email: USER, first_name: "WF Tester", send_welcome_email: 0, new_password: USER_PASS, roles: [{ role: "System Manager" }] },
});
check(r.ok(), `test user created (${r.status()})`);
const ctx2 = await t.browser.newContext({ viewport: { width: 1440, height: 1000 } });
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/login`);
await p2.fill("input:not([type=password])", USER);
await p2.fill("input[type=password]", USER_PASS);
await p2.click("button[type=submit]");
await p2.waitForURL(/\/desk/, { timeout: 120000 });
await p2.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await p2.getByRole("textbox", { name: /^Title/ }).fill("Mine to approve");
await p2.getByRole("button", { name: /^Save$/ }).click();
await p2.waitForURL(new RegExp(`${encodeURIComponent(DT)}/(?!new)`), { timeout: 30000 });
const own = decodeURIComponent(p2.url().split("/").pop());
const w2 = p2.getByRole("region", { name: "Waiting on you" });
await w2.waitFor({ timeout: 30000 });
check(await w2.getByRole("button", { name: "Approve" }).isVisible(), "owner may Approve (self-approval on)");
check(!(await w2.getByRole("button", { name: "Reject" }).isVisible()), "owner can't Reject (self-approval off)");
check(/self-approval is off for Reject/.test(await p2.getByLabel("Unavailable actions").innerText()), "self-approval hint");
await p2.screenshot({ path: `${OUT}/workflow_selfapproval.png` });
// Administrator rejects it; the owner then waits on a role they don't have
const ownDoc = (await api(`api/resource/${encodeURIComponent(DT)}/${own}`)).data;
r = await post("frappe.model.workflow.apply_workflow", { doc: JSON.stringify(ownDoc), action: "Reject" });
check(r.ok(), `Administrator rejected it (${r.status()})`);
await p2.reload({ waitUntil: "domcontentloaded" });
const st2 = p2.getByRole("status", { name: "Workflow status" });
await st2.waitFor({ timeout: 60000 });
check((await st2.innerText()).includes(`Waiting on ${ROLE}`), `waiting on ${ROLE} (${await st2.innerText()})`);
check(!(await p2.getByRole("button", { name: /^Actions/ }).isVisible()), "no Actions for the owner");
await ctx2.close();

step("cleanup");
await cleanup();
await t.finish();
