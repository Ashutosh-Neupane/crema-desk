// Home supplied by an installed app (frappe.boot.home_api; components/home/provider): greeting and what waits today,
// "At a glance" tabs per module, approvals with a confirm before acting, waiting-work counts that open the filtered
// list, Recent. Skips (passes) when the site's apps supply no home.
//   BASE=http://localhost:3001 NEW_LAYOUT=0|1 OUT=/tmp/shots node e2e/p2.providerhome.mjs (both layouts use it)
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
await page.setViewportSize({ width: 1440, height: 1000 });

const api = await page.evaluate(async () => (await (await fetch("/api/desk/context")).json()).boot?.home_api ?? null).catch(() => null);
step("site supplies a home");
if (!api) {
  check(true, "no home_api on this site: built-in home (nothing to test)");
  await t.finish();
  process.exit(0);
}

step("/desk: greeting and At a glance");
await page.goto(`${BASE}/desk`, { waitUntil: "domcontentloaded" });
await page.getByRole("region", { name: "At a glance" }).waitFor({ timeout: 60000 });
check(/Good (morning|afternoon|evening)/.test(await page.locator("main h1").first().innerText()), "greeting shown");

step("switching tab shows that module");
const glance = page.getByRole("region", { name: "At a glance" });
const tabs = glance.getByRole("tab");
if ((await tabs.count()) > 1) {
  const second = (await tabs.nth(1).innerText()).trim();
  await tabs.nth(1).click();
  await glance.getByRole("tabpanel", { name: second }).waitFor({ timeout: 10000 });
  check((await tabs.nth(1).getAttribute("aria-selected")) === "true", `tab ${second} selected`);
}
await shot("p2_providerhome", false);

step("approvals ask before acting");
const approvals = page.getByRole("region", { name: "Waiting for your approval" });
if (await approvals.isVisible().catch(() => false)) {
  const first = approvals.getByRole("listitem").first();
  const action = first.getByRole("button").first();
  const label = (await action.innerText()).trim();
  await action.click();
  const confirm = first.getByRole("group", { name: "Confirm" });
  await confirm.waitFor({ timeout: 5000 });
  check((await confirm.innerText()).includes(label), `confirm names the action (${label})`);
  await confirm.getByRole("button", { name: "Cancel" }).click();
  check(!(await confirm.isVisible().catch(() => false)), "Cancel leaves the document alone");
} else check(true, "no approvals waiting");

step("a waiting-work count opens the filtered list");
const cues = page.getByRole("region", { name: "In your modules" });
if (await cues.isVisible().catch(() => false)) {
  const link = cues.getByRole("link").first();
  const href = await link.getAttribute("href");
  await link.click();
  await page.waitForURL((u) => u.pathname !== "/desk", { timeout: 30000 });
  check(page.url().includes("filters="), `opens the list with its filters (${href?.slice(0, 60)}…)`);
} else check(true, "no waiting work");

await t.finish();
