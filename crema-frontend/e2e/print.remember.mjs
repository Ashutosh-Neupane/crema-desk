// Print page (components/views/PrintView.tsx): the format picked last is picked again the next time print opens
// (Desk's print page keeps its selector between documents), and a format with builder changes that weren't applied
// says so, with "Apply changes" (print_format.py apply_draft) a click away; Desk's builder address
// (/desk/print-format-builder-beta/<name>) opens Crema's builder. Makes its own ToDo and print format.
//   BASE=http://localhost:3001 node e2e/print.remember.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step } = t;
const PF = "Crema e2e remember";
const api = t.api;
const post = (m, data) => api(`api/method/${m}`, { data });
const cleanup = async () => {
  await post("frappe.client.delete", { doctype: "Print Format", name: PF }).catch(() => null);
  await page.evaluate(() => localStorage.removeItem("crema:print-format:ToDo")).catch(() => null);
};

step("setup: a ToDo and a custom print format with an unapplied draft");
await cleanup();
const todo = (await api("api/resource/ToDo", { data: { description: "Crema e2e print remember" } })).data?.name;
const pf = (await api("api/resource/Print Format", { data: { name: PF, doc_type: "ToDo", custom_format: 1, print_format_type: "Jinja", html: "<p>e2e applied</p>" } })).data;
check(!!todo && !!pf, "fixtures created");
await post("frappe.printing.doctype.print_format.print_format.save_draft", { name: PF, modified: pf.modified, data: JSON.stringify({ font_size: 13 }) });

const printUrl = `${BASE}/desk/print/ToDo/${encodeURIComponent(todo)}`;
const fmt = page.getByLabel("Print format");
const notice = page.getByText("aren't applied yet");

step("pick the format: the draft is announced");
await page.goto(printUrl, { waitUntil: "domcontentloaded" });
await page.locator("iframe").waitFor({ timeout: 60000 });
await fmt.selectOption(PF);
await notice.waitFor({ timeout: 20000 });
check(true, "notice shown for a format with builder changes");

step("leave and come back: the picked format stays");
await page.goto(`${BASE}/desk/todo/${encodeURIComponent(todo)}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.goto(printUrl, { waitUntil: "domcontentloaded" });
await page.locator("iframe").waitFor({ timeout: 60000 });
check((await fmt.inputValue()) === PF, `remembered (${await fmt.inputValue()})`);

step("Apply changes: the draft is applied and the notice goes");
await page.getByRole("button", { name: "Apply changes" }).click();
await notice.waitFor({ state: "hidden", timeout: 20000 });
const after = (await api(`api/resource/Print Format/${encodeURIComponent(PF)}`)).data;
check(!after?.draft_data && Number(after?.font_size) === 13, "draft applied on the server");
check((await page.frameLocator("iframe").locator("body").innerText()).includes("e2e applied"), "preview shows the format");

step("Desk's builder address opens Crema's builder, not a frame of Crema inside Crema");
await page.goto(`${BASE}/desk/print-format-builder-beta/${encodeURIComponent(PF)}`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Save & Apply" }).waitFor({ timeout: 60000 });
check((await page.locator("iframe").count()) === 0, "no frame: Crema's builder in place");

step("cleanup");
await cleanup();
await post("frappe.client.delete", { doctype: "ToDo", name: todo }).catch(() => null);
await t.finish();
