// Server error details: a failing save shows the error toast with a "Details" action (System Manager),
// which opens the server traceback in a dialog. Also: the email composer dialog is wider than max-w-lg.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/errordetails.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => {
  const r = await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json();
  if (r.exception || r.exc_type) throw new Error(`${method}: ${r.exception ?? r.exc_type}`);
  return r.message;
};
const DT = "Crema Error Details";
const SS = "Crema Error Details SS";

async function cleanup() {
  await post("frappe.client.delete", { doctype: "Server Script", name: SS }).catch(() => {});
  for (const d of (await post("frappe.client.get_list", { doctype: DT, fields: ["name"] }).catch(() => [])) ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT }).catch(() => {});
}
await cleanup();

step("DocType + Server Script that raises on before_save");
await post("frappe.client.insert", { doc: { doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash", fields: [
  { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 },
], permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, email: 1 }] } });
await post("frappe.client.insert", { doc: { doctype: "Server Script", name: SS, script_type: "DocType Event", reference_doctype: DT,
  doctype_event: "Before Save", disabled: 0, script: "1 / 0\n" } });

step("failing save → error toast with Details → traceback dialog");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${DT}` }).waitFor({ timeout: 90000 });
await page.getByRole("textbox", { name: /^Title/ }).fill("Boom");
await page.getByRole("button", { name: "Save", exact: true }).first().click();
const toast = page.locator("[data-sonner-toast]").filter({ hasText: /division by zero/i });
await toast.waitFor({ timeout: 30000 });
check(true, "error toast shows the server message");
const details = toast.getByRole("button", { name: "Details" });
check(await details.isVisible({ timeout: 5000 }).catch(() => false), "toast offers a Details action");
await details.click();
const errDlg = page.getByRole("dialog", { name: "Server Error" });
await errDlg.waitFor({ timeout: 10000 });
const tb = await errDlg.locator("pre").innerText();
check(tb.includes("ZeroDivisionError") && tb.includes("Traceback (most recent call last)"), "dialog shows the server traceback in a <pre>");
check(await errDlg.getByRole("button", { name: /^Copy/ }).isVisible(), "copy button shown");
await shot("errordetails-dialog", false);
await page.keyboard.press("Escape");
await errDlg.waitFor({ state: "detached", timeout: 5000 });
check(true, "Escape closes the error dialog");

step("saved doc → email composer dialog is wider than max-w-lg");
await post("frappe.client.set_value", { doctype: "Server Script", name: SS, fieldname: "disabled", value: 1 });
const name = (await post("frappe.client.insert", { doc: { doctype: DT, title: "Saved" } })).name;
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/${name}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("textbox", { name: /^Title/ }).waitFor({ timeout: 90000 });
await page.getByRole("region", { name: "Activity" }).getByRole("button", { name: "New Email" }).click();
const mail = page.getByRole("dialog");
await mail.waitFor({ timeout: 10000 });
const box = await mail.boundingBox();
// max-w-lg is 32rem; the root font size is 14px, so compare in rem rather than fixed pixels
const lg = 32 * (await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)));
check(box && box.width > lg, `email composer width ${Math.round(box?.width ?? 0)}px > max-w-lg (${lg}px)`);
await page.keyboard.press("Escape");
await mail.waitFor({ state: "detached", timeout: 5000 });

step("cleanup");
await cleanup();
await t.finish();
