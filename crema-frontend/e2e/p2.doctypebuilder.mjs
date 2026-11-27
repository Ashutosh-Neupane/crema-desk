// Phase 2 DocType creation (docs/PHASE2_DESIGN.md § 4.9): guided start → builder with palette, drag to a new
// column beside a field, live checks, look properties → save → first record → cleanup.
//   BASE=http://localhost:3001 NEW_LAYOUT=1 OUT=/tmp/shots node e2e/p2.doctypebuilder.mjs
import { start, BASE, slug } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const NAME = `Crema Fleet ${Date.now().toString(36)}`;
const MODULE = process.env.CREMA_MODULE ?? "Custom";
const del = (doctype, name) => page.request.post(`${BASE}/api/frappe/api/method/frappe.client.delete`, { data: { doctype, name } });
const layoutRows = (dt) => (dt?.fields ?? []).map((f) => (f.fieldtype === "Column Break" ? "|" : f.fieldtype === "Section Break" ? "§" : f.fieldname)).join(" ");

try {
  step("DocType list Add → guided start (not Desk's dialog)");
  await page.goto(`${BASE}/desk/doctype`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Add DocType/ }).click();
  const startCard = page.getByTestId("new-doctype-start");
  await startCard.waitFor({ timeout: 30000 });
  check(page.url().endsWith("/desk/doctype/new"), `start at /desk/doctype/new (${page.url()})`);
  check(await page.getByRole("navigation", { name: "Create a DocType" }).isVisible(), "stepper shows the steps");

  step("checks: bad name, taken name, live naming example");
  await page.getByRole("button", { name: /Create and add fields/ }).click();
  check(await startCard.getByText("Give it a name").isVisible(), "empty name is flagged on submit");
  await page.getByLabel(/^Name/).fill("1 Bad");
  check(await startCard.getByText(/Start with a letter/).isVisible(), "name starting with a digit is flagged");
  await page.getByLabel(/^Name/).fill("Customer");
  await startCard.getByText(/already exists/).waitFor({ timeout: 10000 });
  check(true, "existing DocType name is flagged");
  await page.getByLabel(/^Name/).fill(NAME);
  const suggested = (await startCard.getByText(/^[A-Z0-9]+-00001$/).first().innerText().catch(() => "")).trim();
  check(/^CF[A-Z0-9]?-00001$/.test(suggested), `series prefix suggested from the name (${suggested})`);
  await page.getByLabel("Series prefix").fill("FLT");
  check(await startCard.getByText("FLT-00001").isVisible(), "example follows the prefix");
  const mod = page.getByRole("combobox", { name: /^Module/ });
  await mod.click();
  await mod.fill(MODULE);
  await page.getByRole("option", { name: MODULE, exact: true }).first().click();
  await page.getByLabel(/Can be submitted/).check();
  await t.axeCheck("start step", "[data-testid=new-doctype-start]");
  await shot("p2_doctype_start", false);

  step("create → the DocType form opens on the Form tab");
  await page.getByRole("button", { name: /Create and add fields/ }).click();
  await page.waitForURL((u) => decodeURIComponent(u.pathname).endsWith(`/${NAME}`), { timeout: 30000 });
  const created = (await api(`api/resource/DocType/${encodeURIComponent(NAME)}`)).data;
  check(created?.custom === 1 && created?.module === MODULE && created?.is_submittable === 1 && created?.autoname === "FLT-.#####", `inserted (custom, module, submittable, autoname=${created?.autoname})`);
  check(created?.permissions?.some((p) => p.role === "System Manager" && p.submit === 1), "System Manager can submit");
  const palette = page.getByRole("navigation", { name: "Add a field" });
  await palette.waitFor({ timeout: 30000 });
  check(true, "Form tab open with the palette");

  step("palette: click adds named fields with fresh fieldnames");
  await palette.getByRole("button", { name: "Add Text", exact: true }).click();
  const aside = page.locator("aside");
  await aside.locator("input").first().fill("Plate No");
  await aside.getByLabel("Mandatory").check();
  await palette.getByRole("button", { name: "Add Date", exact: true }).click();
  await aside.locator("input").first().fill("Insurance Expiry");
  await aside.getByLabel("Bold").check();
  await palette.getByRole("button", { name: "Add Link", exact: true }).click();
  await aside.locator("input").first().fill("Owner Name");
  check(await page.getByText(/choose which doctype it links to/i).isVisible(), "live check: Link needs a target");

  step("drag 'Insurance Expiry' beside 'Plate No' → new column");
  const card = (label) => page.locator('[data-drop^="col:"]').getByText(label, { exact: true }).first();
  const src = await card("Insurance Expiry").boundingBox();
  await page.mouse.move(src.x + 20, src.y + src.height / 2);
  await page.mouse.down();
  await page.mouse.move(src.x + 40, src.y + src.height / 2, { steps: 4 });
  const gap = page.locator('[data-drop="newcol:0:1"]');
  await gap.waitFor({ timeout: 5000 });
  const g = await gap.boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2, { steps: 12 });
  await page.waitForTimeout(150);
  await page.mouse.move(g.x + g.width / 2 + 1, g.y + g.height / 2, { steps: 2 });
  await shot("p2_doctype_drag_gap", false);
  await page.mouse.up();
  await page.waitForTimeout(400);
  check((await page.locator('[data-drop^="col:0:"]').count()) === 2, "section now has two columns");

  step("move buttons: Owner Name to the column on the right");
  await card("Owner Name").click();
  await aside.getByRole("button", { name: /Column to the right/ }).click();
  check(await page.locator('[data-drop="col:0:1"]').getByText("Owner Name").isVisible(), "Owner Name moved to column 2");
  const opts = aside.getByRole("combobox", { name: /Links to/ });
  await opts.click();
  await opts.fill("Employee");
  await page.getByRole("option", { name: /^Employee\b/ }).first().click();
  check(!(await page.getByText(/choose which doctype it links to/i).isVisible()), "Link check clears once a target is chosen");
  await shot("p2_doctype_builder", true);

  step("save → layout and properties in the database");
  await page.keyboard.press("Meta+s");
  await page.waitForTimeout(4000);
  const dt = (await api(`api/resource/DocType/${encodeURIComponent(NAME)}`)).data;
  const f = (n) => dt?.fields?.find((x) => x.fieldname === n);
  console.log("layout:", layoutRows(dt));
  check(f("plate_no")?.reqd === 1 && f("insurance_expiry")?.bold === 1 && f("owner_name")?.options === "Employee", "fields saved with their properties");
  check(/plate_no.*\|.*insurance_expiry|plate_no.*\|.*owner_name/.test(layoutRows(dt)), "a Column Break was created between the columns");

  step("first record uses the new form");
  await page.goto(`${BASE}/desk/${slug(NAME)}/new`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: /^Plate No/ }).waitFor({ timeout: 60000 });
  check((await page.locator(".crema-bold").count()) >= 1, "bold field rendered bold");
  await shot("p2_doctype_record", true);
} finally {
  console.log("cleanup:", (await del("DocType", NAME)).status());
}
await t.finish();
