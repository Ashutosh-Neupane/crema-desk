import { start, BASE } from "./lib.mjs";
const t = await start();
const url = process.argv[2];
await t.page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
await t.page.waitForTimeout(Number(process.argv[4] ?? 6000));
await t.shot(process.argv[3] ?? "peek");
console.log((await t.page.locator("main").innerText()).slice(0, 1500));
await t.finish();
