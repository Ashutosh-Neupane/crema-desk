// Runs every e2e suite sequentially against the live bench and prints a summary.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/run-all.mjs [--only a,b] [--skip c,d]
// Suites that need ERPNext data are skipped automatically when SKIP_ERPNEXT=1 (e.g. the hub hub).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname);
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1]?.split(",") ?? null;
const only = arg("only");
const skip = new Set(arg("skip") ?? []);
// helpers / one-off probes, not suites
const NOT_SUITES = new Set(["lib", "run-all", "peek", "smoke.desk"]);
const ERPNEXT = new Set(["list.salesorder", "form.salesorder", "scripts.salesorder", "report", "reportview", "tree", "getitems", "print", "image", "gantt", "dataimport"]);

const suites = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".mjs"))
  .map((f) => f.replace(/\.mjs$/, ""))
  .filter((s) => !NOT_SUITES.has(s) && !s.startsWith("_"))
  .filter((s) => (only ? only.includes(s) : true))
  .filter((s) => !skip.has(s) && !(process.env.SKIP_ERPNEXT === "1" && ERPNEXT.has(s)))
  .sort();

const results = [];
for (const s of suites) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, `${s}.mjs`)], { env: process.env, encoding: "utf8", timeout: 600_000 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const fails = out.split("\n").filter((l) => /^\s+FAIL /.test(l)).map((l) => l.trim());
  const ok = r.status === 0 && !fails.length;
  results.push({ s, ok, secs: Math.round((Date.now() - t0) / 1000), fails, crash: ok || fails.length ? "" : out.split("\n").filter((l) => /Error|Timeout/.test(l)).slice(0, 2).join(" | ") });
  console.log(`${ok ? "PASS" : "FAIL"}  ${s.padEnd(20)} ${String(results.at(-1).secs).padStart(4)}s ${fails.join("; ")} ${results.at(-1).crash}`.trimEnd());
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} suites passed`);
process.exit(failed.length ? 1 : 0);
