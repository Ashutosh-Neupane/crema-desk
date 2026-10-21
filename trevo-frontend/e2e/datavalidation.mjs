// Data field `options` validation (Email / Phone / URL): Desk's message appears under the field,
// the input is aria-invalid, and both clear when the value becomes valid.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/datavalidation.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const DT = `Trevo Data Validation ${Date.now() % 100000}`;
async function cleanup() {
  for (const d of (await post("frappe.client.get_list", { doctype: "DocType", filters: [["name", "like", "Trevo Data Validation %"]], fields: ["name"] }).catch(() => [])) ?? []) {
    await post("frappe.client.delete", { doctype: "DocType", name: d.name });
  }
}
await cleanup();
await post("frappe.client.insert", { doc: { doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash", fields: [
  { fieldname: "e_mail", label: "Email", fieldtype: "Data", options: "Email" },
  { fieldname: "phone_no", label: "Phone", fieldtype: "Data", options: "Phone" },
  { fieldname: "web", label: "Website", fieldtype: "Data", options: "URL" },
], permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }] } });

step("new doc: invalid values show Desk's message and aria-invalid");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${DT}` }).waitFor({ timeout: 90000 });

const email = page.getByLabel("Email", { exact: true });
const phone = page.getByLabel("Phone", { exact: true });
const web = page.getByLabel("Website", { exact: true });
await email.waitFor({ timeout: 20000 });
check((await email.getAttribute("type")) === "email", "Email input has type=email");
check((await phone.getAttribute("type")) === "tel", "Phone input has type=tel");
check((await web.getAttribute("type")) === "url", "Website input has type=url");

const msg = (text) => page.getByText(text, { exact: true });

await email.fill("bad@");
await email.press("Tab");
check(await msg("bad@ is not a valid Email Address").isVisible(), "invalid email: Desk message shown");
check((await email.getAttribute("aria-invalid")) === "true", "invalid email: aria-invalid=true");
check((await email.inputValue()) === "bad@", "invalid email: typed value kept");

await email.fill("a@b.com, c@d.org");
await email.press("Tab");
check((await page.getByText(/is not a valid Email Address/).count()) === 0, "valid comma-separated emails: no message");
check((await email.getAttribute("aria-invalid")) === "false", "valid email: aria-invalid=false");

await phone.fill("abc");
await phone.press("Tab");
check(await msg("abc is not a valid Phone Number").isVisible(), "invalid phone: Desk message shown");
check((await phone.getAttribute("aria-invalid")) === "true", "invalid phone: aria-invalid=true");
await phone.fill("+1 555 0100");
await phone.press("Tab");
check((await page.getByText(/is not a valid Phone Number/).count()) === 0, "valid phone: message gone");
check((await phone.getAttribute("aria-invalid")) === "false", "valid phone: aria-invalid=false");

await web.fill("not a url");
await web.press("Tab");
check(await msg("'not a url' is not a valid URL").isVisible(), "invalid URL: Desk message shown");
check((await web.getAttribute("aria-invalid")) === "true", "invalid URL: aria-invalid=true");
await web.fill("https://example.com");
await web.press("Tab");
check((await page.getByText(/is not a valid URL/).count()) === 0, "valid URL: message gone");
check((await web.getAttribute("aria-invalid")) === "false", "valid URL: aria-invalid=false");
await shot("datavalidation", false);

step("re-typing an invalid value shows the message again; clearing it removes it");
await email.fill("x");
await email.press("Tab");
check(await msg("x is not a valid Email Address").isVisible(), "email re-invalid: message shown again");
await email.fill("");
await email.press("Tab");
check((await page.getByText(/is not a valid Email Address/).count()) === 0, "empty email: no message");

step("cleanup");
await cleanup();
await t.finish();
