// Desk's frappe.perm on the form: a non-admin user with level-0 read/write/create, level-1 read only and nothing at level 2
// sees the level-0 field editable, the level-1 field read-only and the level-2 field hidden (get_field_display_status);
// saving a level-0 change works. frm.perm / frm.has_perm / frappe.perm.has_perm follow the same rules.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/permlevel.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, browser, check, step, shot } = t;
const post = async (method, data) => {
  const r = await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json();
  if (r.exception || r.exc_type) throw new Error(`${method}: ${r.exception ?? r.exc_type}`);
  return r.message;
};
const N = Date.now() % 1000000;
const DT = `Crema PL Test ${N}`;
const ROLE = `Crema PL Role ${N}`;
const EMAIL = `crema.pl.${N}@example.com`;
const PASS = `Tv-${Date.now().toString(36)}-pL9!`;
async function cleanup() {
  const del = (doctype, name) => post("frappe.client.delete", { doctype, name }).catch(() => {});
  await del("User", EMAIL);
  await del("DocType", DT);
  for (const d of (await post("frappe.client.get_list", { doctype: "Custom DocPerm", filters: { parent: DT }, fields: ["name"], limit_page_length: 0 }).catch(() => [])) ?? []) await del("Custom DocPerm", d.name);
  await del("Role", ROLE);
}
await cleanup();

await post("frappe.client.insert", { doc: { doctype: "Role", role_name: ROLE, desk_access: 1 } });
await post("frappe.client.insert", { doc: { doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash", fields: [
  { fieldname: "open_note", label: "Open Note", fieldtype: "Data" },
  { fieldname: "restricted_note", label: "Restricted Note", fieldtype: "Data", permlevel: 1 },
  { fieldname: "secret_note", label: "Secret Note", fieldtype: "Data", permlevel: 2 },
], permissions: [
  { role: "System Manager", read: 1, write: 1, create: 1, delete: 1 },
  { role: "System Manager", permlevel: 1, read: 1, write: 1 },
  { role: "System Manager", permlevel: 2, read: 1, write: 1 },
  { role: ROLE, permlevel: 0, read: 1, write: 1, create: 1 },
  { role: ROLE, permlevel: 1, read: 1, write: 0 }, // DocPerm.write defaults to 1
] } });
const docName = (await post("frappe.client.insert", { doc: { doctype: DT, open_note: "open v1", restricted_note: "restricted v1", secret_note: "secret v1" } })).name;
await post("frappe.client.insert", { doc: { doctype: "User", email: EMAIL, first_name: "PL", send_welcome_email: 0, new_password: PASS, roles: [{ role: ROLE }] } });

step("administrator sees every level");
const FORM = `${BASE}/desk/doctype/${encodeURIComponent(DT)}/${encodeURIComponent(docName)}`;
await page.goto(FORM, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByLabel("Open Note").waitFor({ timeout: 120000 });
check(await page.getByLabel("Secret Note").isEditable(), "Administrator: level-2 field is editable");
check(await page.getByLabel("Restricted Note").isEditable(), "Administrator: level-1 field is editable");

step("test user: field permissions");
const ctx = await browser.newContext();
const p2 = await ctx.newPage();
try {
  await p2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await p2.fill("input:not([type=password])", EMAIL);
  await p2.fill("input[type=password]", PASS);
  await p2.click("button[type=submit]");
  await p2.waitForURL(/\/desk/, { timeout: 120000 });
  await p2.goto(FORM, { waitUntil: "domcontentloaded", timeout: 180000 });
  const open = p2.getByLabel("Open Note");
  await open.waitFor({ timeout: 120000 });
  check(await open.isEditable(), "level-0 field is editable");
  const restricted = p2.getByLabel("Restricted Note");
  await restricted.waitFor({ timeout: 15000 });
  check(!(await restricted.isEditable()), "level-1 field (read only) is not editable");
  check((await restricted.inputValue().catch(async () => (await restricted.textContent()) ?? "")).includes("restricted v1"), "level-1 value is visible");
  check((await p2.getByLabel("Secret Note").count()) === 0, "level-2 field is not shown");
  await shot("permlevel_user");

  step("test user: save a level-0 change");
  await open.fill("open v2");
  await p2.keyboard.press("Control+s");
  // poll from Node: waitForFunction treats an async predicate's Promise as truthy and returns at once
  let saved = false;
  for (let i = 0; i < 60 && !saved; i++) {
    saved = await p2.evaluate(async ([dt, n]) => {
      const r = await fetch(`/api/frappe/api/resource/${encodeURIComponent(dt)}/${encodeURIComponent(n)}`);
      return (await r.json()).data?.open_note === "open v2";
    }, [DT, docName]);
    if (!saved) await p2.waitForTimeout(500);
  }
  check(saved, "level-0 change saved");
  const row = await post("frappe.client.get", { doctype: DT, name: docName });
  check(row?.open_note === "open v2", "server: open_note updated");
  check(row?.restricted_note === "restricted v1" && row?.secret_note === "secret v1", "server: level-1/2 values untouched");
} finally {
  await ctx.close();
}

step("cleanup");
await cleanup();
await t.finish();
