// Claude over MCP with the Crema Frappe app (docs/PHASE2_DESIGN.md § 5.14, PR C1): a token of the "Claude" OAuth
// client creates a draft (noted "Created via Claude" on its timeline, logged in AI activity) and is refused a delete
// (drafts only). MCP is called on the bench directly, as Claude would; everything else goes through Crema.
// Skips (passes) when the crema app isn't installed or the bench isn't reachable.
//   BASE=http://localhost:3001 FRAPPE_BACKEND_URL=http://localhost:8050 FRAPPE_SITE_NAME=<site> node e2e/p2.ai.mcp.mjs
import crypto from "node:crypto";
import { start } from "./lib.mjs";

const BACKEND = process.env.FRAPPE_BACKEND_URL;
const SITE = process.env.FRAPPE_SITE_NAME;
const t = await start();
const { check, step, api } = t;
const post = async (method, data) => (await api(`api/method/${method}`, { data })).message;

const skip = async (why) => {
  check(true, `skipped: ${why}`);
  await t.finish();
  process.exit(0);
};
if (!BACKEND || !SITE) await skip("set FRAPPE_BACKEND_URL and FRAPPE_SITE_NAME to call the bench's MCP endpoint");
const status = await api("api/method/crema.ai.connect.status");
if (!status?.message?.checks) await skip("the crema app is not installed on this site");

let rpcId = 0;
const mcp = async (token, name, args) => {
  const r = await fetch(`${BACKEND}/api/v2/mcp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", "X-Frappe-Site-Name": SITE },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const lastLog = async (tool) => (await api(`api/resource/Crema AI Log?fields=${encodeURIComponent('["name","tool","result","via_claude","reference_doctype","reference_name","message"]')}&filters=${encodeURIComponent(JSON.stringify([["tool", "=", tool]]))}&order_by=creation%20desc&limit_page_length=1`)).data?.[0];

let todo = null;
let tokenName = null;
const created = [];
try {
  step("site ready for Claude: MCP on, Claude client created");
  if (!status.message.checks.find((c) => c.key === "mcp_enabled")?.ok) await post("crema.ai.connect.fix", { check: "mcp_enabled" });
  const client = await post("crema.ai.connect.create_claude_client", { roles: ["System Manager"] });
  check(!!client?.client_id && !!client?.client_secret, "Claude client id and secret returned");
  const after = (await api("api/method/crema.ai.connect.status")).message;
  const ok = Object.fromEntries(after.checks.map((c) => [c.key, c.ok]));
  check(ok.mcp_enabled && ok.claude_client && ok.dcr_off && ok.drafts_only, `checks: MCP ${ok.mcp_enabled}, client ${ok.claude_client}, DCR off ${ok.dcr_off}, drafts only ${ok.drafts_only}`);

  step("a signed-in Claude token (as after the OAuth flow)");
  const accessToken = crypto.randomBytes(16).toString("hex");
  // a day ahead: the site's time zone may be ahead of UTC, and the token must not start out expired
  const expires = new Date(Date.now() + 86400e3).toISOString().slice(0, 19).replace("T", " ");
  const tok = await api("api/resource/OAuth Bearer Token", { data: { client: after.client.name, user: "Administrator", scopes: "all openid", access_token: accessToken, expires_in: 3600, expiration_time: expires, status: "Active" } });
  tokenName = tok.data?.name;
  check(!!tokenName, "token stored");

  step("Claude creates a draft");
  const res = await mcp(accessToken, "create_document", { doctype: "ToDo", data: { description: `Created by the Crema MCP suite ${Date.now()}` } });
  const result = res.body?.result;
  todo = result?.structuredContent?.name ?? JSON.parse(result?.content?.[0]?.text ?? "{}").name;
  check(res.status === 200 && !result?.isError && !!todo, `create_document → ${todo} (HTTP ${res.status})`);
  if (todo) created.push(todo);
  const notes = (await api(`api/resource/Comment?fields=${encodeURIComponent('["content"]')}&filters=${encodeURIComponent(JSON.stringify([["reference_doctype", "=", "ToDo"], ["reference_name", "=", todo ?? ""]]))}`)).data ?? [];
  check(notes.some((n) => /Created via Claude/.test(n.content)), "timeline says Created via Claude");
  const log = await lastLog("create_document");
  check(log?.result === "Success" && log?.via_claude === 1 && log?.reference_name === todo, `AI activity: create_document ${log?.result}, via Claude ${log?.via_claude}, ${log?.reference_name}`);

  step("Claude may not delete (drafts only)");
  const del = await mcp(accessToken, "delete_document", { doctype: "ToDo", name: todo });
  const text = del.body?.result?.content?.map((c) => c.text).join(" ") ?? JSON.stringify(del.body);
  check(del.body?.result?.isError === true && /is done in Crema/.test(text) && text.includes(`/desk/todo/${todo}`), `refused with a Crema link (${text.slice(0, 120)})`);
  check(!!(await api(`api/resource/ToDo/${todo}`)).data, "the ToDo is still there");
  const refused = await lastLog("delete_document");
  check(refused?.result === "Refused", `AI activity: delete_document ${refused?.result}`);
} finally {
  for (const name of created) await api(`api/method/frappe.client.delete`, { data: { doctype: "ToDo", name } }).catch(() => {});
  if (tokenName) await api(`api/method/frappe.client.delete`, { data: { doctype: "OAuth Bearer Token", name: tokenName } }).catch(() => {});
  await t.finish();
}
