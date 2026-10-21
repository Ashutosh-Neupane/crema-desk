// frappe.ui.Dialog parity: Table fields (rows grid, df.data, grid API), depends_on, HTML $wrapper, set_indicator,
// disable_primary_action, add_custom_action. A Client Script opens a dialog from a custom button; the primary
// action writes JSON.stringify(values) into the doc, which is then saved and checked on the server.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/dialogs.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const DT = "Trevo Dialog Test";
const CS = "Trevo Dialog Test CS";
async function cleanup() {
  await post("frappe.client.delete", { doctype: "Client Script", name: CS });
  for (const d of (await post("frappe.client.get_list", { doctype: DT, fields: ["name"] }).catch(() => [])) ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();
await post("frappe.client.insert", { doc: { doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash", fields: [
  { fieldname: "title_f", label: "Title", fieldtype: "Data" },
  { fieldname: "payload", label: "Payload", fieldtype: "Long Text" },
], permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }] } });
await post("frappe.client.insert", { doc: { doctype: "Client Script", name: CS, dt: DT, view: "Form", enabled: 1, script: `
frappe.ui.form.on("${DT}", {
  refresh(frm) {
    frm.add_custom_button("Open Dlg", () => {
      const d = new frappe.ui.Dialog({
        title: "Dlg Test",
        size: "large",
        fields: [
          { fieldtype: "Check", fieldname: "extra", label: "Show Extra" },
          { fieldtype: "Data", fieldname: "extra_note", label: "Extra Note", depends_on: "eval:doc.extra" },
          { fieldtype: "HTML", fieldname: "info" },
          { fieldtype: "Table", fieldname: "rows", label: "Rows",
            data: [{ label: "alpha", qty: 1 }, { label: "beta", qty: 2 }],
            fields: [
              { fieldtype: "Data", fieldname: "label", label: "Label", in_list_view: 1 },
              { fieldtype: "Int", fieldname: "qty", label: "Qty", in_list_view: 1,
                onchange() { this.doc.doubled = (this.doc.qty || 0) * 2; } },
              { fieldtype: "Link", fieldname: "item", label: "Item", options: "Item", in_list_view: 1 },
            ] },
        ],
        primary_action_label: "Apply",
        primary_action(values) { frm.set_value("payload", JSON.stringify(values)); d.hide(); },
      });
      d.set_indicator("Draft", "orange");
      d.fields_dict.info.$wrapper.html('<div class="dlg-info">Rows: ' + d.fields_dict.rows.df.data.length + '</div>');
      d.add_custom_action("Toggle Apply", () => { d.__off = !d.__off; d.__off ? d.disable_primary_action() : d.enable_primary_action(); });
      d.show();
      globalThis.__dlg = d;
    });
  },
});` } });

step("open the dialog");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${DT}` }).waitFor({ timeout: 90000 });
await page.getByRole("button", { name: "Open Dlg" }).click();
const dlg = page.getByRole("dialog", { name: "Dlg Test" });
await dlg.waitFor({ timeout: 20000 });
const rows = dlg.locator("[data-dialog-table=rows] tr.grid-row");
check((await rows.count()) === 2, "table renders 2 preset rows");
check((await rows.nth(0).locator("input[type=text], input:not([type])").first().inputValue()) === "alpha", "row 1 label = alpha");
check((await dlg.locator(".dlg-info").innerText()) === "Rows: 2", "HTML field $wrapper.html() rendered");
check(await dlg.locator(".indicator", { hasText: "Draft" }).isVisible(), "set_indicator shown");
await shot("dlg-open", false);

step("depends_on");
check((await dlg.getByLabel("Extra Note").count()) === 0, "Extra Note hidden while Show Extra is off");
await dlg.getByRole("checkbox", { name: "Show Extra" }).check();
await dlg.getByLabel("Extra Note").waitFor({ timeout: 5000 });
check(true, "Extra Note shown after Show Extra");
await dlg.getByLabel("Extra Note").fill("hello");
await dlg.getByRole("checkbox", { name: "Show Extra" }).uncheck();
await page.waitForTimeout(200);
check((await dlg.getByLabel("Extra Note").count()) === 0, "Extra Note hidden again");

step("edit, add, delete rows");
const cell = (r, c) => rows.nth(r).locator("td").nth(c + 2).locator("input").first();
await cell(0, 0).fill("alpha2");
await cell(0, 0).blur();
await cell(1, 1).fill("5");
await cell(1, 1).blur();
await dlg.getByRole("button", { name: "Add Row" }).click();
check((await rows.count()) === 3, "Add Row adds a third row");
await cell(2, 0).fill("gamma");
await cell(2, 1).fill("7");
await cell(2, 1).blur();
await rows.nth(0).getByRole("checkbox").check();
await dlg.getByRole("button", { name: "Delete" }).click();
check((await rows.count()) === 2, "Delete removes the selected row");
const live = await page.evaluate(() => globalThis.__dlg.fields_dict.rows.df.data.map((r) => ({ l: r.label, q: r.qty, d: r.doubled, i: r.idx })));
console.log("  live df.data:", JSON.stringify(live));
check(live.length === 2 && live[0].l === "beta" && Number(live[0].q) === 5, "fields_dict.rows.df.data is live (beta/5 first)");
check(live[0].d === 10, "child field onchange ran (doubled = 10)");
check(live[1].l === "gamma" && live[1].i === 2, "added row gamma, idx renumbered");

step("grid API from a script");
await page.evaluate(() => {
  const g = globalThis.__dlg.fields_dict.rows;
  g.df.data = [...g.df.data, { label: "delta", qty: 9 }];
  g.grid.refresh();
});
await page.waitForTimeout(200);
check((await rows.count()) === 3, "df.data = [...] + grid.refresh() re-renders");
check(await page.evaluate(() => globalThis.__dlg.fields_dict.rows.grid.get_selected_children().length === 0), "get_selected_children() empty");
await page.evaluate(() => globalThis.__dlg.fields_dict.rows.grid.add_new_row());
await page.waitForTimeout(200);
check((await rows.count()) === 4, "grid.add_new_row()");
await rows.nth(3).getByRole("checkbox").check();
check(await page.evaluate(() => globalThis.__dlg.fields_dict.rows.grid.get_selected_children().length === 1), "get_selected_children() sees the checked row");
await dlg.getByRole("button", { name: "Delete" }).click();
check((await rows.count()) === 3, "deleted the empty row");

step("disable_primary_action blocks Apply");
await dlg.getByRole("button", { name: "Toggle Apply" }).click();
const apply = dlg.getByRole("button", { name: "Apply", exact: true });
check(await apply.isDisabled(), "Apply disabled");
await apply.click({ force: true }).catch(() => {});
check(await dlg.isVisible(), "dialog still open after clicking disabled Apply");
check((await page.getByLabel("Payload").first().inputValue()) === "", "payload untouched");
await dlg.getByRole("button", { name: "Toggle Apply" }).click();
check(await apply.isEnabled(), "Apply enabled again");

step("Apply writes get_values() into the doc; save");
await apply.click();
await dlg.waitFor({ state: "hidden", timeout: 5000 });
await page.getByLabel("Title").first().fill("dlg");
await page.keyboard.press("Control+s");
await page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 30000 });
const saved = (await post("frappe.client.get_list", { doctype: DT, fields: ["name", "payload"] }))?.[0];
let parsed = {};
try { parsed = JSON.parse(saved?.payload ?? "{}"); } catch {}
console.log("  saved payload:", saved?.payload);
check(Array.isArray(parsed.rows) && parsed.rows.length === 3, "server payload has 3 rows");
check(parsed.rows?.[0]?.label === "beta" && Number(parsed.rows?.[0]?.qty) === 5, "edited row persisted (beta / 5)");
check(parsed.rows?.[1]?.label === "gamma" && Number(parsed.rows?.[1]?.qty) === 7, "added row persisted (gamma / 7)");
check(parsed.rows?.[2]?.label === "delta", "script-added row persisted (delta)");
check(parsed.extra === 0, "check value = 0");

step("cleanup");
await cleanup();
await t.finish();
