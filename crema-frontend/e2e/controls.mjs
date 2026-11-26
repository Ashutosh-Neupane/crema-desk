// Controls whose stored value must match Desk's (form/controls/rating.js, duration.js, phone.js, barcode.js,
// geolocation.js): a document written in Desk's format opens correctly in Crema, and Crema's edits are saved in
// that format — Rating as a fraction (half stars), Duration in seconds ("1d 2h 3m 4s"), Phone "+<isd>-<number>"
// (empty field → site country), Barcode as JsBarcode SVG with data-barcode-value (EAN validated), Geolocation as a
// GeoJSON FeatureCollection (circles keep their radius).
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/controls.mjs
import { start, BASE, slug } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "Crema Controls Doc";
const mod = process.platform === "darwin" ? "Meta" : "Control";

async function cleanup() {
  const docs = await api(`api/resource/${encodeURIComponent(DT)}?limit_page_length=100`).catch(() => null);
  for (const d of docs?.data ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();

step("setup: Rating, Duration, Phone, Barcode (EAN), Geolocation; a document written in Desk's format");
let r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash",
    fields: [
      { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 },
      { fieldname: "score", label: "Score", fieldtype: "Rating", options: "5" },
      { fieldname: "spent", label: "Time Spent", fieldtype: "Duration" },
      { fieldname: "mobile", label: "Mobile", fieldtype: "Phone" },
      { fieldname: "code", label: "Code", fieldtype: "Barcode", options: '{"format": "EAN"}' },
      { fieldname: "site", label: "Site", fieldtype: "Geolocation" },
    ],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
  },
});
check(r.ok(), `DocType (${r.status()})`);
const GEO = { type: "FeatureCollection", features: [
  { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [85.324, 27.7172] } },
  { type: "Feature", properties: { point_type: "circle", radius: 300 }, geometry: { type: "Point", coordinates: [85.33, 27.71] } },
] };
r = await post("frappe.client.insert", { doc: { doctype: DT, title: "From Desk", score: 0.7, spent: 93784, mobile: "+977-9800000000", site: JSON.stringify(GEO) } });
const name = (await r.json()).message?.name;
check(!!name, `document ${name}`);

await page.goto(`${BASE}/desk/${slug(DT)}/${name}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("textbox", { name: /^Title/ }).waitFor({ timeout: 90000 });

step("Desk's values shown right");
const rating = page.getByRole("slider", { name: "Score" });
check((await rating.getAttribute("aria-valuenow")) === "3.5", `0.7 of 5 → 3.5 stars (${await rating.getAttribute("aria-valuenow")})`);
const spent = page.getByRole("textbox", { name: "Time Spent" });
check((await spent.inputValue()) === "1d 2h 3m 4s", `93784 s → ${await spent.inputValue()}`);
const isd = page.getByRole("combobox", { name: "Mobile country code" });
await page.waitForFunction(() => document.querySelectorAll('select[aria-label="Mobile country code"] option').length > 100, null, { timeout: 20000 });
check((await isd.inputValue()) === "+977" && (await page.getByRole("textbox", { name: "Mobile" }).inputValue()) === "9800000000", "+977-9800000000 → +977 | 9800000000");
const map = page.locator('[data-fieldname="site"]');
await map.locator(".leaflet-marker-icon").first().waitFor({ timeout: 20000 });
check((await map.locator(".leaflet-marker-icon").count()) === 1 && (await map.locator("path.leaflet-interactive").count()) === 1, "GeoJSON: one marker and one circle drawn");
check(!(await page.getByText("Not Saved").isVisible()), "opening leaves it clean");
await shot("controls_loaded", false);

step("Rating: click the left half of star 2 → 1.5 stars = 0.3; ←/→ by half stars");
const star2 = rating.locator('[data-rating="2"]');
const b = await star2.boundingBox();
await page.mouse.click(b.x + b.width * 0.25, b.y + b.height / 2);
check((await rating.getAttribute("aria-valuenow")) === "1.5", `1.5 stars (${await rating.getAttribute("aria-valuenow")})`);
await rating.focus();
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowRight");
check((await rating.getAttribute("aria-valuenow")) === "2.5", "→→ 2.5 stars");

step("Duration: typed \"1h 30m\" → 5400 s; picker minutes → seconds");
await spent.fill("1h 30m");
await spent.press("Enter");
check((await spent.inputValue()) === "1h 30m", `shown ${await spent.inputValue()}`);
await spent.click();
const picker = page.getByRole("group", { name: "Time Spent picker" });
await picker.getByRole("spinbutton", { name: "Minutes" }).fill("45");
check((await picker.getByRole("spinbutton", { name: "Hours" }).inputValue()) === "1", "picker shows the value");
await spent.press("Escape");
check((await spent.inputValue()) === "1h 45m", `picker → ${await spent.inputValue()}`);
await spent.fill("nonsense");
await spent.press("Enter");
check((await spent.getAttribute("aria-invalid")) === "true", "unrecognised text flagged, value kept");

step("Phone: new number keeps the country; another country");
await page.getByRole("textbox", { name: "Mobile" }).fill("9811111111");
await isd.selectOption("+91");

step("Barcode: invalid EAN refused; valid EAN-8 stored as SVG");
const code = page.getByRole("textbox", { name: "Code" });
await code.fill("123");
await code.press("Enter");
await page.getByRole("alert").filter({ hasText: "Invalid Barcode" }).waitFor({ timeout: 5000 });
check(true, `invalid shown: ${(await page.getByRole("alert").filter({ hasText: "Invalid Barcode" }).innerText()).slice(0, 80)}`);
await code.fill("96385074");
await code.press("Enter");
await page.locator("[data-barcode] svg").waitFor({ timeout: 5000 });
check((await page.locator("[data-barcode] svg").getAttribute("data-barcode-value")) === "96385074", "barcode drawn");

step("Geolocation: draw a marker");
await map.locator(".leaflet-draw-draw-marker").click();
const mb = await map.locator(".leaflet-container").boundingBox();
await page.mouse.click(mb.x + mb.width * 0.3, mb.y + mb.height * 0.7);
await page.waitForTimeout(500);
check((await map.locator(".leaflet-marker-icon").count()) === 2, `two markers (${await map.locator(".leaflet-marker-icon").count()})`);
await shot("controls_edited", false);

step("save → Desk's formats");
await page.keyboard.press(`${mod}+s`);
await page.waitForTimeout(3000);
const d = (await api(`api/resource/${encodeURIComponent(DT)}/${name}`)).data;
check(d.score === 0.5, `Rating 2.5/5 → ${d.score}`);
check(d.spent === 6300, `Duration 1h 45m → ${d.spent}`);
check(d.mobile === "+91-9811111111", `Phone → ${d.mobile}`);
check(/^<svg[^>]*data-barcode-value="96385074"/.test(d.code) && /width="100%"/.test(d.code), `Barcode → ${String(d.code).slice(0, 80)}…`);
const geo = JSON.parse(d.site);
const circle = geo.features.find((f) => f.properties?.point_type === "circle");
check(geo.type === "FeatureCollection" && geo.features.length === 3 && circle?.properties.radius === 300, `GeoJSON: 3 features, circle radius ${circle?.properties.radius}`);

step("new document: Phone starts on the site's country");
await page.goto(`${BASE}/desk/${slug(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${DT}` }).waitFor({ timeout: 90000 });
const sysCountry = (await api("api/method/frappe.client.get_single_value?doctype=System%20Settings&field=country")).message;
await page.waitForFunction(() => document.querySelectorAll('select[aria-label="Mobile country code"] option').length > 100, null, { timeout: 20000 });
const pre = await page.getByRole("combobox", { name: "Mobile country code" }).evaluate((s) => s.selectedOptions[0]?.textContent ?? "");
check(!sysCountry || pre.includes(sysCountry), `${sysCountry ?? "no country set"} preselected (${pre.trim()})`);

step("cleanup");
await cleanup();
await t.finish();
