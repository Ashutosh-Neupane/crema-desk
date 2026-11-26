// Phase 2 Home — "My work" (/desk/my-work): a workflow document waiting on me (Workflow Action), an open assignment
// (ToDo / _assign), a draft I started, a record I opened (Recent), workspace shortcuts; open works from each list;
// screenshots at 390 / 768 / 1280 px. Creates its own DocTypes, workflow and documents and removes them at the end.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/p2.mywork.mjs
import { start, BASE, slug } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const enc = encodeURIComponent;
const DT_WF = "Crema MyWork Approval";
const DT_DRAFT = "Crema MyWork Draft";
const WF = "Crema MyWork WF";
const stamp = Date.now().toString(36);
const APPROVE_TITLE = `Approve me ${stamp}`;
const DRAFT_TITLE = `My draft ${stamp}`;

async function cleanup() {
  for (const dt of [DT_WF, DT_DRAFT]) {
    const todos = await api(`api/resource/ToDo?filters=${enc(JSON.stringify([["reference_type", "=", dt]]))}&limit_page_length=500`).catch(() => null);
    for (const d of todos?.data ?? []) await post("frappe.client.delete", { doctype: "ToDo", name: d.name });
    const docs = await api(`api/resource/${enc(dt)}?limit_page_length=500&fields=["name","docstatus"]`).catch(() => null);
    for (const d of docs?.data ?? []) {
      if (d.docstatus === 1) await post("frappe.client.cancel", { doctype: dt, name: d.name });
      await post("frappe.client.delete", { doctype: dt, name: d.name });
    }
    const was = await api(`api/resource/Workflow%20Action?filters=${enc(JSON.stringify([["reference_doctype", "=", dt]]))}&limit_page_length=500`).catch(() => null);
    for (const w of was?.data ?? []) await post("frappe.client.delete", { doctype: "Workflow Action", name: w.name });
  }
  await post("frappe.client.delete", { doctype: "Workflow", name: WF });
  for (const dt of [DT_WF, DT_DRAFT]) await post("frappe.client.delete", { doctype: "DocType", name: dt });
}

const docType = (name) => ({
  doctype: "DocType", name, module: "Custom", custom: 1, is_submittable: 1, autoname: "hash", title_field: "title",
  fields: [
    { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1, in_list_view: 1 },
    ...(name === DT_WF ? [{ fieldname: "workflow_state", label: "Workflow State", fieldtype: "Link", options: "Workflow State", allow_on_submit: 1, read_only: 1 }] : []),
  ],
  permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1 }],
});

const region = (name) => page.getByRole("region", { name });

async function openMyWork() {
  await page.goto(`${BASE}/desk/my-work`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("heading", { level: 1, name: "My work" }).waitFor({ timeout: 90000 });
  // sections drop aria-busy once loaded
  await page.waitForFunction(() => !document.querySelector("section[aria-busy]"), null, { timeout: 60000 }).catch(() => {});
}

try {
  await cleanup();
  step("setup: two submittable DocTypes, a workflow, an approval doc, a draft assigned to me");
  for (const dt of [DT_WF, DT_DRAFT]) {
    const r = await post("frappe.client.insert", { doc: docType(dt) });
    check(r.ok(), `DocType ${dt} created (${r.status()})`);
  }
  let r = await post("frappe.client.insert", {
    doc: {
      doctype: "Workflow", workflow_name: WF, document_type: DT_WF, is_active: 1, workflow_state_field: "workflow_state", send_email_alert: 0,
      states: [
        { state: "Pending", doc_status: "0", allow_edit: "System Manager" },
        { state: "Approved", doc_status: "1", allow_edit: "System Manager" },
      ],
      transitions: [{ state: "Pending", action: "Approve", next_state: "Approved", allowed: "System Manager", allow_self_approval: 1 }],
    },
  });
  check(r.ok(), `Workflow created (${r.status()})`);
  r = await post("frappe.client.insert", { doc: { doctype: DT_WF, title: APPROVE_TITLE } });
  const approval = (await r.json()).message;
  check(approval?.workflow_state === "Pending", `approval doc in Pending (${approval?.name})`);
  r = await post("frappe.client.insert", { doc: { doctype: DT_DRAFT, title: DRAFT_TITLE } });
  const draft = (await r.json()).message;
  check(draft?.docstatus === 0, `draft doc created (${draft?.name})`);
  r = await post("frappe.desk.form.assign_to.add", { doctype: DT_DRAFT, name: draft.name, assign_to: ["Administrator"], description: `Finish ${DRAFT_TITLE}` });
  check(r.ok(), `draft assigned to Administrator (${r.status()})`);
  const wa = await api(`api/resource/Workflow%20Action?filters=${enc(JSON.stringify([["reference_doctype", "=", DT_WF], ["status", "=", "Open"]]))}`);
  check((wa?.data ?? []).length > 0, "Frappe created an open Workflow Action for the approval doc");

  step("Waiting on me: the workflow document and the assignment");
  await openMyWork();
  const waiting = region("Waiting on me");
  const approvalLink = waiting.getByRole("link", { name: new RegExp(approval.name) });
  check(await approvalLink.isVisible().catch(() => false), "approval doc listed under Waiting on me");
  check(/Pending/.test((await approvalLink.textContent().catch(() => "")) ?? ""), "approval row shows its workflow state");
  check(await waiting.getByRole("link", { name: new RegExp(draft.name) }).isVisible().catch(() => false), "assigned draft listed under Waiting on me");

  step("Drafts I started");
  const drafts = region("Drafts I started");
  const draftLink = drafts.getByRole("link", { name: new RegExp(DRAFT_TITLE) });
  check(await draftLink.isVisible().catch(() => false), "draft listed under Drafts I started (by its title)");

  step("Shortcuts from the workspace");
  const shortcuts = region("Shortcuts");
  const scCount = await shortcuts.getByRole("link").count();
  check(scCount > 0, `shortcuts or their empty-state action render (${scCount} links)`);

  step("open from Drafts → form, then it shows under Recent");
  await draftLink.click();
  await page.waitForURL(new RegExp(`/desk/${slug(DT_DRAFT)}/${draft.name}`), { timeout: 30000 });
  check(await page.getByText(DRAFT_TITLE).first().waitFor({ timeout: 60000 }).then(() => true, () => false), "draft form opened");
  await page.waitForTimeout(1500);
  await openMyWork();
  check(await region("Recent").getByRole("link", { name: new RegExp(DRAFT_TITLE) }).first().isVisible().catch(() => false), "opened draft listed under Recent");

  step("open from Waiting on me (keyboard) → workflow form");
  const link = region("Waiting on me").getByRole("link", { name: new RegExp(approval.name) });
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(new RegExp(`/${approval.name}$`), { timeout: 30000 });
  check(await page.getByText(APPROVE_TITLE).first().waitFor({ timeout: 60000 }).then(() => true, () => false), "approval form opened with Enter");

  step("screenshots at 390 / 768 / 1280");
  for (const w of [390, 768, 1280]) {
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 1000 });
    await openMyWork();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 1, `no horizontal scroll at ${w}px (${overflow})`);
    if (w === 390) {
      const h = await region("Waiting on me").getByRole("link", { name: new RegExp(approval.name) }).boundingBox();
      check(!!h && h.height >= 40, `row is a ≥40px touch target on phones (${h?.height})`);
    }
    await shot(`p2-mywork-${w}`);
  }
  await openMyWork();
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await shot("p2-mywork-1280-dark");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
} finally {
  await cleanup().catch((e) => console.log(`cleanup failed: ${e.message}`));
}
await t.finish();
