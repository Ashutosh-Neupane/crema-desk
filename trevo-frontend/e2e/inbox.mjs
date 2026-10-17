// Inbox: received email in an account folder (unread), mark read, trash → Trash folder.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/inbox.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const ACC = "Trevo Test Inbox";
const subject = `Trevo inbox ${Date.now() % 100000}`;
await post("frappe.client.delete", { doctype: "Email Account", name: ACC });
await post("frappe.client.insert", { doc: { doctype: "Email Account", email_account_name: ACC, email_id: "trevo.inbox@example.com", enable_incoming: 0, enable_outgoing: 0 } });
const comm = (await post("frappe.client.insert", { doc: { doctype: "Communication", communication_type: "Communication", communication_medium: "Email", sent_or_received: "Received", status: "Open", email_account: ACC, subject, sender: "customer@example.com", sender_full_name: "A Customer", content: "<p>Hello</p>", recipients: "trevo.inbox@example.com", uid: 4242 } })).name; // uid: Frappe only flags IMAP mail

step("message listed unread in the account folder");
await page.goto(`${BASE}/desk/inbox`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("button", { name: ACC }).click({ timeout: 90000 });
const msgs = page.getByRole("list", { name: "Messages" });
const item = msgs.getByRole("listitem").filter({ hasText: subject });
await item.waitFor({ timeout: 30000 });
check(await item.locator(".font-semibold").first().isVisible(), "unread shown in bold");
await shot("inbox", false);

step("mark read");
await item.getByRole("checkbox").check();
await page.getByRole("button", { name: "Mark read" }).click();
await page.waitForTimeout(2000);
const seen = await post("frappe.client.get_value", { doctype: "Communication", filters: { name: comm }, fieldname: ["_seen", "seen"] });
check(String(seen?._seen).includes("Administrator") || !!seen?.seen, "seen on the server");

step("trash → Trash folder");
await item.getByRole("checkbox").check();
await page.getByRole("region", { name: ACC }).getByRole("button", { name: "Trash", exact: true }).click();
await page.waitForTimeout(2000);
check((await post("frappe.client.get_value", { doctype: "Communication", filters: { name: comm }, fieldname: ["email_status"] }))?.email_status === "Trash", "email_status Trash");
await page.getByRole("complementary", { name: "Mail folders" }).getByRole("button", { name: "Trash" }).click();
await msgs.getByRole("listitem").filter({ hasText: subject }).waitFor({ timeout: 20000 });
check(true, "listed in Trash");

step("cleanup");
await post("frappe.client.delete", { doctype: "Communication", name: comm });
await post("frappe.client.delete", { doctype: "Email Account", name: ACC });
await t.finish();
