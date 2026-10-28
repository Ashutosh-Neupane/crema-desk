// Workspace Onboarding block + Custom HTML Block (Desk onboarding_widget.js / custom_block_widget.js), verified against the API.
// Creates a Custom HTML Block, a Module Onboarding with 3 Onboarding Steps and a public Workspace that holds both blocks.
// Needs System Settings > enable_onboarding (Desk hides onboardings without it); it is enabled for the run and restored.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/workspaceblocks.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { BASE, OUT } from "./lib.mjs";

// Same helpers as lib.mjs start(), but signs in through the login API: this test goes straight to a workspace, so it
// does not wait for the /desk home page (the slowest route to compile) to load.
async function start() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|socket\.io/.test(m.text()) && errors.push(`console: ${m.text().slice(0, 300)}`));
  const r = await page.request.post(`${BASE}/api/auth/login`, { data: { email: "Administrator", password: "admin" } });
  if (!r.ok()) throw new Error(`login failed: ${r.status()}`);
  let failures = 0;
  return {
    browser, page, errors,
    check(cond, msg) { console.log(`  ${cond ? "PASS" : "FAIL"} ${msg}`); if (!cond) failures++; },
    step: (m) => console.log(`• ${m}`),
    shot: (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }),
    async finish() {
      console.log(`\n${failures ? "FAILED" : "ALL PASSED"} (${failures} failures)`);
      errors.forEach((e) => console.log(e));
      await browser.close();
      process.exit(failures ? 1 : 0);
    },
  };
}

const t = await start();
const { page, check, step, shot } = t;
const enc = encodeURIComponent;
const API = `${BASE}/api/frappe/api`;
const get = async (path) => (await (await page.request.get(`${API}/${path}`)).json());
const post = async (method, data) => (await (await page.request.post(`${API}/method/${method}`, { data })).json()).message;
const insert = async (doc) => {
  const r = await (await page.request.post(`${API}/resource/${enc(doc.doctype)}`, { data: doc })).json();
  if (!r.data) throw new Error(`insert ${doc.doctype} failed: ${JSON.stringify(r).slice(0, 300)}`);
  return r.data;
};
const del = (doctype, name) => page.request.delete(`${API}/resource/${enc(doctype)}/${enc(name)}`);

const BLOCK = "Crema WS Block";
const OB = "Crema WS Onboarding";
const WS = "Crema WS Blocks";
const STEPS = ["Crema WS Step Entry", "Crema WS Step Page", "Crema WS Step Skip"];
let enableOnboarding = 0;

async function cleanup() {
  await del("Workspace", WS);
  await del("Module Onboarding", OB);
  for (const s of STEPS) await del("Onboarding Step", s);
  await del("Custom HTML Block", BLOCK);
}
const stepRow = async (name) => (await get(`resource/Onboarding%20Step/${enc(name)}`)).data;

await cleanup();
enableOnboarding = (await get("resource/System%20Settings/System%20Settings")).data.enable_onboarding ?? 0;
if (!enableOnboarding) await post("frappe.client.set_value", { doctype: "System Settings", name: "System Settings", fieldname: "enable_onboarding", value: 1 });

try {
  // a doctype with no records, so the Create Entry step is not "already done"
  let entryDoctype = null;
  for (const dt of ["Note", "Event", "Blog Post", "Energy Point Rule"]) {
    const rows = (await get(`resource/${enc(dt)}?limit_page_length=1`)).data;
    if (Array.isArray(rows) && !rows.length) { entryDoctype = dt; break; }
  }
  if (!entryDoctype) throw new Error("no empty doctype available for the Create Entry step");

  await insert({
    doctype: "Custom HTML Block", name: BLOCK,
    html: '<div id="tb-box" class="tb-box"><span id="tb-out">html-only</span><script>window.__tbLeak = 1</script></div>',
    style: ".tb-box { color: rgb(255, 0, 0); } #tb-out { font-weight: 700; }",
    script: "root_element.querySelector('#tb-out').textContent = 'script-ran:' + (root_element.host ? 'shadow' : 'none');",
  });
  await insert({ doctype: "Onboarding Step", name: STEPS[0], title: STEPS[0], action: "Create Entry", reference_document: entryDoctype, description: "Make **one** `entry`.", action_label: "Create the entry" });
  await insert({ doctype: "Onboarding Step", name: STEPS[1], title: STEPS[1], action: "Go to Page", path: "todo", description: "Open the ToDo page." });
  await insert({ doctype: "Onboarding Step", name: STEPS[2], title: STEPS[2], action: "Go to Page", path: "todo", is_optional: 0, description: "Skip me." });
  const stepNames = [];
  for (const s of STEPS) stepNames.push((await stepRow(s)).name);
  await insert({ doctype: "Module Onboarding", name: OB, title: OB, module: "Custom", allow_roles: [{ role: "System Manager" }], steps: stepNames.map((s) => ({ step: s })) });
  const ob = (await get(`resource/Module%20Onboarding/${enc(OB)}`)).data;
  await insert({
    doctype: "Workspace", label: WS, title: WS, module: "Custom", public: 1, type: "Workspace",
    content: JSON.stringify([
      { id: "tbh0000001", type: "header", data: { text: `<span class="h4">Blocks</span>`, col: 12 } },
      { id: "tbo0000001", type: "onboarding", data: { onboarding_name: ob.name, col: 12 } },
      { id: "tbc0000001", type: "custom_block", data: { custom_block_name: BLOCK, col: 12 } },
    ]),
    custom_blocks: [{ custom_block_name: BLOCK, label: BLOCK }],
  });

  step("workspace renders both blocks");
  await page.goto(`${BASE}/desk/workspace/${enc(WS)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  const widget = page.getByRole("region", { name: "Onboarding" });
  await widget.waitFor({ timeout: 90000 });
  check((await widget.locator("li[data-step]").count()) === 3, "onboarding shows its 3 steps");
  check(await widget.getByText("0 of 3 steps done").isVisible(), "progress 0 of 3");
  check(await widget.getByRole("heading", { name: OB }).isVisible(), "onboarding title");
  check(await widget.getByRole("button", { name: "Dismiss" }).isVisible(), "Dismiss button");
  check(await widget.locator("li[data-step][data-open=true]").getByText("one", { exact: true }).count() === 1, "first step open with its markdown description");
  await shot("ws_blocks");

  step("custom block: shadow root, style, script");
  // the block's html/script load separately from the onboarding data
  await page.waitForFunction(() => !!document.querySelector("[data-custom-block]")?.shadowRoot?.querySelector("#tb-out")?.textContent, null, { timeout: 30000 }).catch(() => {});
  const info = await page.evaluate(() => {
    const host = document.querySelector("[data-custom-block]");
    const root = host?.shadowRoot;
    const out = root?.querySelector("#tb-out");
    return {
      hasShadow: !!root,
      text: out?.textContent,
      color: root?.querySelector("#tb-box") ? getComputedStyle(root.querySelector("#tb-box")).color : null,
      weight: out ? getComputedStyle(out).fontWeight : null,
      leaked: !!document.querySelector("#tb-out"),
      scriptKept: !!root?.querySelector("script"),
      leakVar: window.__tbLeak === 1,
    };
  });
  check(info.hasShadow, "custom block has an open shadow root");
  check(info.text === "script-ran:shadow", `script ran with root_element = the shadow root (${info.text})`);
  check(info.color === "rgb(255, 0, 0)" && info.weight === "700", `block style applied inside the root (${info.color}, ${info.weight})`);
  check(!info.leaked, "block content is not in the light DOM");
  check(!info.scriptKept && !info.leakVar, "script tag inside the html field is stripped (remove_script_and_style)");

  step("step action routes");
  await widget.getByRole("button", { name: "Create the entry" }).click();
  await page.waitForURL(new RegExp(`/desk/doctype/${enc(entryDoctype).replace(/%20/g, "(%20|\\+)")}/new`), { timeout: 60000 });
  check(true, `Create Entry opens a new ${entryDoctype} form`);
  check(!(await stepRow(stepNames[0])).is_complete, "Create Entry is not ticked until the work is done");
  await page.goBack();
  await widget.waitFor({ timeout: 60000 });

  step("Go to Page marks the step complete on the server");
  await widget.locator(`li[data-step="${stepNames[1]}"] button[aria-expanded]`).click();
  await widget.locator(`li[data-step="${stepNames[1]}"]`).getByRole("button", { name: STEPS[1] }).last().click();
  await page.waitForURL(/\/desk\/todo/, { timeout: 60000 });
  check(true, "Go to Page routes to /desk/todo");
  check((await stepRow(stepNames[1])).is_complete === 1, "is_complete = 1 on the server");
  await page.goBack();
  await widget.waitFor({ timeout: 60000 });
  await widget.getByText("1 of 3 steps done").waitFor({ timeout: 15000 }).catch(() => undefined);
  check(await widget.getByText("1 of 3 steps done").isVisible(), "progress 1 of 3 after returning (state comes from the server)");

  step("Skip");
  await widget.locator(`li[data-step="${stepNames[2]}"] button[aria-expanded]`).click();
  await widget.getByRole("button", { name: "Skip", exact: true }).click();
  await widget.getByText("Skipped").waitFor({ timeout: 15000 }).catch(async () => { await shot("ws_skip_fail"); });
  check((await stepRow(stepNames[2])).is_skipped === 1, "is_skipped = 1 on the server");
  check(await widget.getByText(/1 of 3 done · 1 skipped/).isVisible(), "progress shows the skipped step");

  step("Dismiss hides for 24h");
  await widget.getByRole("button", { name: "Dismiss" }).click();
  check(await widget.isHidden(), "widget hidden after Dismiss");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("[data-custom-block]").waitFor({ timeout: 60000 });
  check(await page.getByRole("region", { name: "Onboarding" }).count() === 0, "stays hidden after reload");
  await page.evaluate(() => localStorage.removeItem("dismissed-onboarding"));

  step("enable_onboarding = 0 hides the block (Desk get_onboarding_doc)");
  await post("frappe.client.set_value", { doctype: "System Settings", name: "System Settings", fieldname: "enable_onboarding", value: 0 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("[data-custom-block]").waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  check(await page.getByRole("region", { name: "Onboarding" }).count() === 0, "onboarding hidden when disabled");
} finally {
  await post("frappe.client.set_value", { doctype: "System Settings", name: "System Settings", fieldname: "enable_onboarding", value: enableOnboarding });
  await cleanup();
}
const left = (await get(`resource/Workspace/${enc(WS)}`)).data;
check(!left, "cleaned up");
await t.finish();
