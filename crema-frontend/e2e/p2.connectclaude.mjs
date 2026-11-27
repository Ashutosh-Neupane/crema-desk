// Connect Claude (docs/PHASE2_DESIGN.md § 5.14, PR C1): reachable from ⌘K; "Claude on the web" shows the site checks,
// creates the Claude client and shows the values to paste into Claude; "On this computer" creates a personal key and
// the Claude Code / Desktop setup; My settings lists connected apps. Skips (passes) when the crema app isn't installed.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/p2.connectclaude.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
await page.setViewportSize({ width: 1440, height: 1000 });

const installed = await page.evaluate(async () => "crema" in ((await (await fetch("/api/desk/context")).json()).boot?.versions ?? {})).catch(() => false);
step("crema app on the site");
if (!installed) {
  check(true, "skipped: the crema app is not installed");
  await t.finish();
  process.exit(0);
}
const keyBefore = (await api("api/method/crema.ai.connect.my_key")).message;

step("⌘K finds Connect Claude");
await page.goto(`${BASE}/desk/todo`, { waitUntil: "domcontentloaded" });
const input = page.getByPlaceholder("Search for anything");
for (let i = 0; i < 3 && !(await input.isVisible().catch(() => false)); i++) {
  await page.keyboard.press("Control+k");
  await input.waitFor({ timeout: 5000 }).catch(() => {});
}
await input.fill("connect claude");
await page.getByRole("option", { name: /Connect Claude/ }).first().click();
await page.waitForURL(/\/desk\/connect-claude/, { timeout: 30000 });
check(true, "palette opens /desk/connect-claude");

step("Claude on the web: checks and the Claude client");
const checks = page.getByRole("region", { name: "Checks" });
await checks.waitFor({ timeout: 60000 });
check((await checks.getByRole("listitem").count()) >= 7, `${await checks.getByRole("listitem").count()} checks listed`);
const useAddress = checks.getByRole("button", { name: "Use this address" });
if (await useAddress.isVisible().catch(() => false)) {
  await useAddress.click();
  await page.waitForTimeout(1500);
}
const client = page.getByRole("region", { name: "Claude client" });
await client.getByRole("checkbox", { name: "System Manager" }).waitFor({ timeout: 30000 });
check((await client.getByRole("checkbox").count()) > 5, `roles to choose from (${await client.getByRole("checkbox").count()})`);
check(await client.getByRole("checkbox", { name: "System Manager" }).isChecked(), "System Manager chosen");
await client.getByRole("button", { name: /Create Claude client|Save and show/ }).click();
await client.getByText("Paste these into Claude").waitFor({ timeout: 30000 });
const values = await client.locator("code").allInnerTexts();
check(values.some((v) => v.endsWith("/api/v2/mcp")) && values.length >= 3, `connector URL, client id and secret shown (${values[0]})`);
await shot("p2_connectclaude_web", false);
await t.axeCheck("connect claude web", "main");

step("On this computer: personal key and setup");
await page.getByRole("tab", { name: "On this computer" }).click();
const keyCard = page.getByRole("region", { name: "Your API key" });
await keyCard.waitFor({ timeout: 30000 });
await keyCard.getByRole("button", { name: /Create (a new )?key/ }).click();
await keyCard.getByText("Shown once").waitFor({ timeout: 30000 });
const codes = await keyCard.locator("code").allInnerTexts();
check(codes.some((c) => /^Authorization: token \w+:\w+/.test(c)), "header with the new key shown once");
check(codes.some((c) => c.startsWith("claude mcp add --transport http crema ")), "Claude Code command");
check(codes.some((c) => c.includes('"mcp-remote"')), "Claude Desktop config");
await shot("p2_connectclaude_local", false);
await t.axeCheck("connect claude local", "main");

step("header ✦: Ask in Claude");
await page.getByRole("button", { name: "Ask in Claude" }).click();
const ask = page.getByLabel("Ask in Claude", { exact: true }).last();
await ask.waitFor({ timeout: 10000 });
check(await page.getByRole("button", { name: "Open in Claude app" }).isDisabled(), "needs a question first");
await ask.fill("Which orders are late?");
check(await page.getByRole("button", { name: "Copy and open claude.ai" }).isEnabled(), "question typed: hand-off buttons ready");
check(await page.getByText(/Claude (is connected|isn't connected)/).isVisible(), "connection status shown");
await page.keyboard.press("Escape");

step("My settings lists connected apps");
await page.goto(`${BASE}/desk/settings`, { waitUntil: "domcontentloaded" });
await page.getByRole("region", { name: "Connected apps" }).waitFor({ timeout: 60000 });
check(true, "Connected apps on My settings");

// leave the user's key as it was: revoke the one made here unless they had one before
if (!keyBefore?.has_secret) await api("api/method/crema.ai.connect.revoke_my_key", { data: {} });
await t.finish();
