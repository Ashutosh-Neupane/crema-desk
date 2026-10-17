// L2 script DOM: real jQuery in HTML fields — a Client Script draws markup, binds clicks, calls a missing
// plugin (must not abort), and sets HTML via set_df_property.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/scriptdom.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const DT = "Trevo Script DOM";
const CS = "Trevo Script DOM CS";
async function cleanup() {
  await post("frappe.client.delete", { doctype: "Client Script", name: CS });
  for (const d of (await post("frappe.client.get_list", { doctype: DT, fields: ["name"] }).catch(() => [])) ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();
await post("frappe.client.insert", { doc: { doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash", fields: [
  { fieldname: "qty", label: "Qty", fieldtype: "Int" },
  { fieldname: "info_html", label: "Info", fieldtype: "HTML" },
  { fieldname: "notes_html", label: "Notes", fieldtype: "HTML", options: "<p>static options</p>" },
], permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }] } });
await post("frappe.client.insert", { doc: { doctype: "Client Script", name: CS, dt: DT, view: "Form", enabled: 1, script: `
const draw = (frm) => {
  const $w = frm.fields_dict.info_html.$wrapper;
  $w.html('<div class="trevo-box">Total: ' + (frm.doc.qty || 0) + '</div><button type="button" class="trevo-btn">Bump</button>');
  $w.find(".trevo-btn").on("click", () => frm.set_value("qty", (frm.doc.qty || 0) + 1));
  $w.find(".trevo-box").select2(); // a plugin Trevo doesn't ship — must be a no-op, not a crash
  $w.find(".trevo-box").css("font-weight", "600");
};
frappe.ui.form.on("${DT}", {
  refresh(frm) {
    draw(frm);
    frm.set_df_property("notes_html", "options", "<p class='from-script'>Set by set_df_property</p>");
  },
  qty(frm) { draw(frm); },
});` } });

step("new doc: script draws into the HTML field");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${DT}` }).waitFor({ timeout: 90000 });
const box = page.locator(".trevo-box");
await box.waitFor({ timeout: 20000 });
check((await box.innerText()) === "Total: 0", "markup rendered by $wrapper.html()");
check((await box.evaluate((e) => getComputedStyle(e).fontWeight)) === "600", "jQuery .css() applied after the missing plugin call");
check(await page.locator(".from-script").isVisible(), "set_df_property options shown");

step("jQuery click handler changes the doc, script redraws");
await page.locator(".trevo-btn").click();
await page.locator(".trevo-btn").click();
await page.waitForTimeout(500);
check((await box.innerText()) === "Total: 2", `box redrawn (${await box.innerText()})`);
check((await page.getByRole("spinbutton", { name: /^Qty/ }).or(page.getByRole("textbox", { name: /^Qty/ })).first().inputValue()).replace(/\D/g, "") === "2", "qty field = 2");
await shot("scriptdom", false);

step("cleanup");
await cleanup();
await t.finish();
