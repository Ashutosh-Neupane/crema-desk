// Desk URLs open in Crema in place: the address bar keeps Desk's URL (`/desk/sales-order/<name>`, `/desk/selling`,
// `/desk/point-of-sale`) and the screen is the one Desk shows (Desk router.convert_to_standard_route, served by
// proxy.ts → lib/navigation/deskRoute.ts). Data comes from the site.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/deskurls.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const SO = (await post("frappe.client.get_list", { doctype: "Sales Order", fields: ["name"], order_by: "modified desc", limit_page_length: 1 }))?.[0]?.name;
check(!!SO, `site data: Sales Order ${SO}`);
// the list restores its last filters into the address (Desk list settings), so start and end from none
const resetList = () => post("frappe.model.utils.user_settings.save", { doctype: "Sales Order", user_settings: JSON.stringify({ List: { filters: [] } }) });
await resetList();

// open a Desk URL; the address bar must not change
const open = async (path) => {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  const now = new URL(page.url());
  check(`${now.pathname}${now.search}` === path, `address bar keeps ${path}${now.pathname + now.search !== path ? ` (now ${now.pathname}${now.search})` : ""}`);
};

step("list: /desk/sales-order");
await open("/desk/sales-order");
await page.getByRole("heading", { name: "Sales Order", exact: true }).first().waitFor({ timeout: 90000 });
check(true, "Sales Order list shown");

step("form: /desk/sales-order/<name>");
await open(`/desk/sales-order/${encodeURIComponent(SO)}`);
await page.waitForFunction((so) => document.title.startsWith(so), SO, { timeout: 90000 });
await page.getByRole("button", { name: /^(Save|Submit|Update)/ }).first().waitFor({ timeout: 60000 });
check(true, `${SO} form shown`);
// the breadcrumb shows the record name as it is, not as a prettified slug ("SAL ORD 2026 00087")
check(!(await page.locator("body").innerText()).includes(SO.replace(/-/g, " ")), "breadcrumb keeps the name verbatim");
await shot("deskurls_form", false);

step("new: /desk/sales-order/new");
await open("/desk/sales-order/new");
await page.getByRole("heading", { name: /New Sales Order/ }).first().waitFor({ timeout: 90000 });
check(true, "new Sales Order form shown");

step("report view: /desk/sales-order/view/report");
await open("/desk/sales-order/view/report");
await page.getByRole("grid").or(page.locator("main table")).first().waitFor({ timeout: 90000 });
check(true, "report view shown");

step("workspace: /desk/selling, and a doctype inside its shell: /desk/selling/sales-order");
await open("/desk/selling");
await page.getByRole("heading", { name: "Selling" }).first().waitFor({ timeout: 90000 });
check(true, "Selling workspace shown");
await open("/desk/selling/sales-order");
await page.getByRole("heading", { name: "Sales Order", exact: true }).first().waitFor({ timeout: 90000 });
check(true, "Sales Order list in the Selling shell");

step("Desk page: /desk/point-of-sale");
await open("/desk/point-of-sale");
await page.locator('iframe[title="Frappe page point-of-sale"]').waitFor({ timeout: 90000 });
check(true, "Point of Sale page shown");

step("query string kept: /desk/sales-order?status=Draft");
await open("/desk/sales-order?status=Draft");
await page.getByRole("heading", { name: "Sales Order", exact: true }).first().waitFor({ timeout: 90000 });
check(true, "list with the Draft filter from the URL");

await resetList();
await t.finish();
