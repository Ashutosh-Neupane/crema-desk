// End-to-end CRUD on ToDo through the Trevo UI, verified against Frappe.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/crud.todo.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3001";
const OUT = process.env.OUT ?? "./smoke-shots";
const USER = process.env.TREVO_USER ?? "Administrator";
const PASS = process.env.TREVO_PASS ?? "admin";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
page.on("response", async (r) => {
  if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url().replace(BASE, "")}`);
});
const step = (m) => console.log(`• ${m}`);
const shot = (n) => page.screenshot({ path: `${OUT}/crud_${n}.png`, fullPage: true });
const api = async (path) => (await page.request.get(`${BASE}/api/frappe/${path}`)).json();
let failures = 0;
const check = (cond, msg) => {
  console.log(`  ${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failures++;
};

await page.goto(`${BASE}/login`);
await page.fill("input:not([type=password])", USER);
await page.fill("input[type=password]", PASS);
await page.click("button[type=submit]");
await page.waitForURL(/\/desk/);

step("open New ToDo");
await page.goto(`${BASE}/desk/doctype/ToDo/new`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "New ToDo" }).waitFor();
check(await page.getByText("Not Saved").isVisible(), "indicator shows Not Saved");
check((await page.locator("select").first().inputValue()) === "Open", "status default = Open (Desk default)");
await shot("1_new");

step("save without mandatory Description");
await page.getByRole("button", { name: /^Save/ }).click();
await page.getByText("Missing fields").waitFor({ timeout: 10000 });
check(await page.getByRole("dialog").getByText("Description").isVisible(), "Missing fields dialog lists Description");
await page.getByRole("button", { name: "OK" }).click();
check(page.url().endsWith("/new"), "still on /new");

step("fill Description and save");
const desc = `Trevo e2e ${Date.now()}`;
await page.locator("textarea").first().fill(desc);
await page.getByRole("button", { name: /^Save/ }).click();
await page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 15000 });
const name = decodeURIComponent(page.url().split("/").pop());
check(!!name && !name.startsWith("new-"), `redirected to saved doc ${name}`);
const created = await api(`api/resource/ToDo/${encodeURIComponent(name)}`);
check(created.data?.description?.includes(desc), "backend has the description");
await page.waitForTimeout(500);
check(!(await page.getByText("Not Saved").isVisible()), "indicator cleared after save");
await shot("2_saved");

step("edit priority → High and save with ⌘S");
const prioritySelect = page.locator("select").nth(1);
await prioritySelect.selectOption("High");
check(await page.getByText("Not Saved").isVisible(), "dirty after edit");
await page.keyboard.press("Meta+s");
await page.waitForTimeout(1500);
const updated = await api(`api/resource/ToDo/${encodeURIComponent(name)}`);
check(updated.data?.priority === "High", "backend priority = High");
// not networkidle: the realtime client keeps polling when socket.io is absent
await page.reload({ waitUntil: "domcontentloaded" });
page.on("dialog", (d) => { console.log(`  dialog: ${d.type()} ${d.message()}`); void d.accept(); });
try {
  await page.locator("select").nth(1).waitFor({ timeout: 20000 });
} catch (e) {
  await shot("debug_reload");
  console.log("  url after reload:", page.url());
  console.log("  body:", (await page.locator("main").innerText()).slice(0, 400));
  throw e;
}
check((await page.locator("select").nth(1).inputValue()) === "High", "reload shows High");

step("comment");
await page.getByPlaceholder(/Add a comment/).fill("Looks good from Trevo");
await page.getByRole("button", { name: "Post comment" }).click();
await page.waitForTimeout(1500);
check(await page.getByText("Looks good from Trevo").isVisible(), "comment appears in activity");
await shot("3_commented");

step("delete via … menu");
await page.getByRole("button", { name: "More actions" }).click();
await page.getByRole("menuitem", { name: /Delete/ }).click();
await page.getByRole("button", { name: "Yes" }).click();
await page.waitForURL(/\/desk\/doctype\/ToDo$/, { timeout: 15000 });
const gone = await page.request.get(`${BASE}/api/frappe/api/resource/ToDo/${encodeURIComponent(name)}`);
check(gone.status() === 404, `backend returns 404 for deleted ${name}`);
await shot("4_list_after_delete");

console.log(`\n${failures ? "FAILED" : "ALL PASSED"} (${failures} failures)`);
for (const e of errors) console.log(e);
await browser.close();
process.exit(failures ? 1 : 0);
