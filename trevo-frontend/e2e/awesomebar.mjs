// Awesomebar (⌘K) special results, transcribed from Desk's awesome_bar.js / search_utils.js:
//   "new todo" → "New ToDo" → /desk/doctype/ToDo/new; "3*7+2" → "3*7+2 = 23" (copies 23);
//   "trevo in todo" → "Find trevo in ToDo" → /desk/doctype/ToDo?q=trevo
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/awesomebar.mjs
// Logs in through the API and starts on a list page (lib.mjs start() waits for the /desk home page, which
// was not rendering on the shared dev server while this was written).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { BASE, OUT } from "./lib.mjs";

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
let failures = 0;
const check = (cond, msg) => {
  console.log(`  ${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failures++;
};
const step = (m) => console.log(`• ${m}`);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

const login = await page.request.post(`${BASE}/api/auth/login`, { data: { email: process.env.TREVO_USER ?? "Administrator", password: process.env.TREVO_PASS ?? "admin" }, timeout: 180000 });
if (!login.ok()) throw new Error(`login failed: ${login.status()}`);
// record what the calculator copies (the clipboard API needs a permission the test browser lacks); runs on every page load
await page.addInitScript(() => {
  window.__copied = null;
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (s) => { window.__copied = s; } } });
});
const input = () => page.getByPlaceholder("Search for anything");
const option = (name) => page.getByRole("option", { name, exact: true });
const openPalette = async () => {
  // the shell can still be hydrating right after a navigation: retry the shortcut until the palette opens
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Control+k");
    if (await input().waitFor({ timeout: 5000 }).then(() => true, () => false)) return;
  }
  await input().waitFor({ timeout: 10000 });
};

step("open the palette with the shortcut");
await page.goto(`${BASE}/desk/doctype/ToDo`, { waitUntil: "domcontentloaded", timeout: 180000 });
await openPalette();
check(await input().isVisible(), "⌘K opens the awesomebar");

step("new todo → New ToDo → the new-document route");
await input().fill("new todo");
await option("New ToDo").waitFor({ timeout: 30000 });
check(await option("New ToDo").isVisible(), "\"New ToDo\" listed for \"new todo\"");
await shot("awesomebar_new");
await option("New ToDo").click();
await page.waitForURL(/\/desk\/doctype\/ToDo\/new$/, { timeout: 60000 });
check(true, "selecting it opens /desk/doctype/ToDo/new");

step("calculator: 3*7+2 = 23, copies the result");
await page.goto(`${BASE}/desk/doctype/ToDo`, { waitUntil: "domcontentloaded" });
await openPalette();
await input().fill("3*7+2");
const calcRow = page.getByRole("option", { name: /3\*7\+2 = 23/ });
await calcRow.waitFor({ timeout: 15000 });
check(await calcRow.isVisible(), "\"3*7+2 = 23\" shown");
check(await page.getByRole("option").first().textContent().then((x) => /3\*7\+2 = 23/.test(x ?? "")), "calculator is the first result");
await shot("awesomebar_calc");
await calcRow.click();
check((await page.evaluate(() => window.__copied)) === "23", "result copied to the clipboard (23)");
check(!(await input().isVisible().catch(() => false)), "palette closes after copying");

step("trevo in todo → Find trevo in ToDo → ToDo list filtered by the text");
// start on the ToDo list itself: the list must follow ?q= without remounting
await page.goto(`${BASE}/desk/doctype/ToDo`, { waitUntil: "domcontentloaded" });
await openPalette();
await input().fill("trevo in todo");
await option("Find trevo in ToDo").waitFor({ timeout: 15000 });
check(await option("Find trevo in ToDo").isVisible(), "\"Find trevo in ToDo\" listed");
await option("Find trevo in ToDo").click();
await page.waitForURL(/\/desk\/doctype\/ToDo\?q=trevo$/, { timeout: 60000 });
check(true, "routes to /desk/doctype/ToDo?q=trevo");
await page.waitForFunction(() => [...document.querySelectorAll("input")].some((i) => i.placeholder?.startsWith("Search") && i.value === "trevo"), null, { timeout: 30000 }).then(() => check(true, "the list's search box holds \"trevo\""), () => check(false, "the list's search box holds \"trevo\""));
await shot("awesomebar_find");

console.log(`\n${failures ? "FAILED" : "ALL PASSED"} (${failures} failures)`);
errors.forEach((e) => console.log(e));
await browser.close();
process.exit(failures ? 1 : 0);
