// Timeline: version diff, comment with @mention (edit/delete), New Email → Communication.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/timeline.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const DT = "Crema Timeline Doc";

async function cleanup() {
  for (const d of (await post("frappe.client.get_list", { doctype: "Communication", filters: { reference_doctype: DT }, fields: ["name"] })) ?? []) await post("frappe.client.delete", { doctype: "Communication", name: d.name });
  for (const d of (await post("frappe.client.get_list", { doctype: DT, fields: ["name"] }).catch(() => [])) ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();
await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash", track_changes: 1,
    fields: [{ fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 }],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, email: 1 }],
  },
});
const name = (await post("frappe.client.insert", { doc: { doctype: DT, title: "First" } })).name;

step("edit → version diff in the timeline");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/${name}`, { waitUntil: "domcontentloaded", timeout: 180000 });
const title = page.getByRole("textbox", { name: /^Title/ });
await title.waitFor({ timeout: 90000 });
await title.fill("Second");
await title.press("Tab");
await page.getByRole("button", { name: /^Save$/ }).click();
const activity = page.getByRole("region", { name: "Activity" });
await activity.getByText("changed the value of Title from First to Second").waitFor({ timeout: 30000 });
check(true, "version line shows field label and values");

step("comment with @mention");
const box = activity.getByLabel("Add a comment");
await box.click();
await box.pressSequentially("Please check @Admin", { delay: 30 });
await page.getByRole("listbox", { name: "Mention a user" }).getByRole("option").first().waitFor({ timeout: 15000 });
await box.press("Enter");
await box.pressSequentially("thanks");
await activity.getByRole("button", { name: "Post comment" }).click();
const comment = activity.getByLabel(/^Comment by /).first();
await comment.waitFor({ timeout: 20000 });
check(await comment.locator(".mention").isVisible(), "mention rendered");
let c = (await post("frappe.client.get_list", { doctype: "Comment", filters: { reference_doctype: DT, reference_name: name, comment_type: "Comment" }, fields: ["name", "content"] }))[0];
check(/data-id="Administrator"/.test(c?.content ?? ""), "Comment stores a Frappe mention span");

step("edit + delete comment");
await comment.hover();
await comment.getByRole("button", { name: "Edit comment" }).click();
await comment.getByLabel("Edit comment text").fill("Edited text");
await comment.getByRole("button", { name: "Save" }).click();
// the edit box closes once update_comment returned and docinfo reloaded (its textarea also "contains" the text)
await page.getByLabel("Edit comment text").waitFor({ state: "detached", timeout: 20000 });
await activity.getByText("Edited text").waitFor({ timeout: 20000 });
c = (await post("frappe.client.get_value", { doctype: "Comment", filters: { name: c.name }, fieldname: ["content"] }));
check(String(c?.content).includes("Edited text"), "comment updated on server");
await activity.getByLabel(/^Comment by /).first().hover();
await activity.getByRole("button", { name: "Delete comment" }).click();
await activity.getByText("Edited text").waitFor({ state: "detached", timeout: 20000 });
check(true, "comment deleted");

step("New Email → Communication on the timeline");
await activity.getByRole("button", { name: "New Email" }).click();
const dlg = page.getByRole("dialog");
await dlg.getByLabel("To").fill("someone@example.com");
await dlg.getByLabel("Message").fill("Hello from Crema");
await dlg.getByRole("button", { name: "Send" }).click();
await page.waitForTimeout(3000);
const accounts = await post("frappe.client.get_list", { doctype: "Email Account", filters: { enable_outgoing: 1 }, fields: ["name"] });
if (accounts?.length) {
  const comms = await post("frappe.client.get_list", { doctype: "Communication", filters: { reference_doctype: DT, reference_name: name }, fields: ["name", "subject", "recipients"] });
  check(comms?.length === 1 && comms[0].recipients.includes("someone@example.com"), `Communication created (${comms?.[0]?.subject})`);
  check(await activity.getByText(`${DT}: Second`).isVisible(), "email shown in timeline");
} else {
  // same as Desk on a site without an outgoing account: the server's message is shown, the draft is kept
  check(await page.getByText(/missing email account/i).first().isVisible(), "no outgoing account → server error shown");
  check(await dlg.isVisible(), "composer stays open with the draft");
}
await shot("timeline", false);

step("cleanup");
await cleanup();
await t.finish();
