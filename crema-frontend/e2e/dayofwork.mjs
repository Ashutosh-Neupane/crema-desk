// A day of work in Crema, the way a user does it in Desk: each document is opened, the next one is made from
// ERPNext's own "Create" menu (frappe.model.open_mapped_doc), then saved and submitted through the UI. Verified
// on the server after every step, and in the reports at the end.
//   buy:   Purchase Order → Purchase Receipt → Purchase Invoice → Payment
//   stock: Stock Entry (Material Receipt) typed in from a new form
//   sell:  Quotation → Sales Order → Delivery Note → Sales Invoice → Payment
//   reports: Stock Balance (or the live Stock Ledger where prepared reports can't run) = the warehouse's Bin; General Ledger balances for the invoice; Accounts Receivable no
//            longer lists the paid invoice
// Customer, supplier, item and warehouse come from the site; everything created is cancelled and deleted at the end.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/dayofwork.mjs
import { start, BASE, defaultCompany, slug, localDate } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const enc = encodeURIComponent;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const get = async (dt, name) => (await api(`api/resource/${enc(dt)}/${enc(name)}`)).data;
const pick = async (doctype, filters, fields = ["name"]) => (await post("frappe.client.get_list", { doctype, filters, fields, limit_page_length: 1 }))?.[0];
const today = localDate();
const inDays = localDate;

const COMPANY = await defaultCompany(page);
const ABBR = (await post("frappe.client.get_value", { doctype: "Company", fieldname: "abbr", filters: COMPANY }))?.abbr;
const CUSTOMER = (await pick("Customer", { disabled: 0 }))?.name;
const SUPPLIER = (await pick("Supplier", { disabled: 0 }))?.name;
const ITEM = (await pick("Item", { is_stock_item: 1, is_sales_item: 1, is_purchase_item: 1, disabled: 0, has_variants: 0, has_serial_no: 0, has_batch_no: 0 }))?.name;
const WH = (await pick("Warehouse", { company: COMPANY, is_group: 0, name: ["like", "Stores%"] }))?.name ?? `Stores - ${ABBR}`;
check(!!(CUSTOMER && SUPPLIER && ITEM && WH), `site data: ${CUSTOMER} / ${SUPPLIER} / ${ITEM} / ${WH}`);
const binQty = async () => Number((await pick("Bin", { item_code: ITEM, warehouse: WH }, ["actual_qty"]))?.actual_qty ?? 0);
const startQty = await binQty();

const made = []; // [doctype, name] in creation order — cancelled and deleted in reverse
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

const open = async (dt, name) => {
  await page.goto(`${BASE}/desk/${slug(dt)}/${enc(name)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  // the heading shows the title (party name); a submitted document is ready once ERPNext's Create group is up
  await page.getByRole("button", { name: /^Create/ }).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
};
/** ERPNext's "Create" group (add_custom_button(label, fn, __("Create"))) → the mapped new form */
const createFrom = async (label, target) => {
  await page.getByRole("button", { name: /^Create/ }).first().click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
  await page.getByRole("heading", { name: `New ${target}` }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
};
const field = (label) => page.getByLabel(label, { exact: true }).first();
const setDate = async (label, iso) => {
  const f = page.getByRole("textbox", { name: new RegExp(`^${label}`) }).first();
  await f.click();
  await f.fill(iso);
  await f.press("Enter");
  await page.waitForTimeout(600);
};
const setLink = async (label, value) => {
  const f = field(label);
  await f.click();
  await f.fill(value);
  await page.getByRole("option", { name: value }).first().click();
  await page.waitForTimeout(1500);
};
/** Save (→ the saved name in the URL), then Submit → Yes; returns the submitted doc from the server */
const saveSubmit = async (dt) => {
  // a payment through a bank account needs a cheque / reference number and date (ERPNext payment_entry.json)
  const ref = page.getByLabel(/^Cheque\/Reference No/).first();
  if (dt === "Payment Entry" && (await ref.isVisible().catch(() => false))) {
    await ref.fill(`E2E-${Date.now().toString(36)}`);
    const refDate = page.getByRole("textbox", { name: /^Cheque\/Reference Date/ }).first();
    if (await refDate.isVisible().catch(() => false)) {
      await refDate.fill(localDate());
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(500);
  }
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.waitForURL((u) => u.pathname.startsWith(`/desk/${slug(dt)}/`) && !u.pathname.endsWith("/new"), { timeout: 60000 }).catch(async (e) => {
    // say why the save didn't land (a validation message, or the URL it stayed on)
    const msg = await page.locator('[role="alertdialog"], [role="dialog"], [data-sonner-toast], [role="alert"], [aria-invalid="true"]').evaluateAll((els) => els.map((e) => e.innerText || e.getAttribute("aria-label") || e.id)).catch(() => []);
    console.log(`  save of ${dt} did not finish at ${page.url()}: ${msg.join(" | ").replace(/\s+/g, " ").slice(0, 600)}`);
    throw e;
  });
  const name = decodeURIComponent(page.url().split("?")[0].split("/").pop());
  made.push([dt, name]);
  await page.getByRole("button", { name: /^Submit$/ }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Submit$/ }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  let doc;
  for (let i = 0; i < 30; i++) {
    doc = await get(dt, name);
    if (doc?.docstatus === 1) break;
    await page.waitForTimeout(1000);
  }
  return doc;
};

try {
  // ── buy ────────────────────────────────────────────────────────────────────────────────────────────────
  step("buy: Purchase Order (submitted) → Create → Purchase Receipt");
  const po = await post("frappe.client.insert", { doc: { doctype: "Purchase Order", company: COMPANY, supplier: SUPPLIER, schedule_date: inDays(3), set_warehouse: WH, items: [{ item_code: ITEM, qty: 10, rate: 50, warehouse: WH, schedule_date: inDays(3) }] } });
  made.push(["Purchase Order", po.name]);
  await post("frappe.client.submit", { doc: { ...po, docstatus: 0 } });
  await open("Purchase Order", po.name);
  await createFrom("Purchase Receipt", "Purchase Receipt");
  const inputs = await page.locator("main input").evaluateAll((els) => els.map((e) => e.value));
  check(inputs.includes(ITEM) && inputs.includes(po.supplier), "receipt mapped with the ordered supplier and item");
  const pr = await saveSubmit("Purchase Receipt");
  check(pr?.docstatus === 1 && pr.items?.[0]?.qty === 10 && pr.items[0].purchase_order === po.name, `${pr?.name} submitted: 10 × ${ITEM} against ${po.name}`);
  check((await binQty()) === startQty + 10, `stock in ${WH}: ${startQty} → ${await binQty()}`);
  check((await get("Purchase Order", po.name))?.per_received === 100, "PO 100% received");

  step("buy: Purchase Receipt → Create → Purchase Invoice");
  await createFrom("Purchase Invoice", "Purchase Invoice");
  const pinv = await saveSubmit("Purchase Invoice");
  check(pinv?.docstatus === 1 && pinv.items?.[0]?.purchase_receipt === pr.name, `${pinv?.name} submitted against ${pr.name}`);
  check(pinv?.outstanding_amount === pinv?.rounded_total || pinv?.outstanding_amount === pinv?.grand_total, `outstanding ${pinv?.outstanding_amount}`);

  step("buy: Purchase Invoice → Create → Payment");
  await createFrom("Payment", "Payment Entry");
  const ppay = await saveSubmit("Payment Entry");
  check(ppay?.docstatus === 1 && ppay.payment_type === "Pay" && ppay.party === SUPPLIER, `${ppay?.name}: Pay ${ppay?.paid_amount} to ${SUPPLIER}`);
  check((await get("Purchase Invoice", pinv.name))?.outstanding_amount === 0, "purchase invoice paid (outstanding 0)");
  await shot("day_purchase_paid");

  // ── stock ──────────────────────────────────────────────────────────────────────────────────────────────
  step("stock: new Stock Entry (Material Receipt) typed in");
  await page.goto(`${BASE}/desk/stock-entry/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("heading", { name: "New Stock Entry" }).waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  await setLink("Stock Entry Type", "Material Receipt");
  // "Default Warehouse" is a collapsible section (collapsed in Desk too)
  if (!(await field("Default Target Warehouse").isVisible().catch(() => false))) await page.getByRole("button", { name: "Default Warehouse" }).click();
  await setLink("Default Target Warehouse", WH);
  const row = page.locator("[aria-label^='Select row']").first().locator("xpath=ancestor::div[contains(@class,'grid')][1]");
  const itemCell = row.getByLabel("Item Code", { exact: true });
  await itemCell.click();
  await itemCell.fill(ITEM);
  await page.waitForTimeout(800);
  await page.getByRole("option", { name: new RegExp(ITEM) }).first().click();
  await page.waitForTimeout(2500);
  const qty = page.getByLabel("Qty", { exact: true }).first();
  await qty.click();
  await qty.fill("5");
  await qty.press("Enter");
  await page.waitForTimeout(1500);
  const basic = page.getByLabel("Basic Rate (as per Stock UOM)", { exact: true }).first();
  if (await basic.isVisible().catch(() => false)) {
    await basic.click();
    await basic.fill("50");
    await basic.press("Enter");
    await page.waitForTimeout(800);
  }
  const se = await saveSubmit("Stock Entry");
  check(se?.docstatus === 1 && se.items?.[0]?.t_warehouse === WH && se.items[0].qty === 5, `${se?.name}: +5 into ${WH}`);
  check((await binQty()) === startQty + 15, `stock now ${await binQty()} (start ${startQty} + 10 + 5)`);

  // ── sell ───────────────────────────────────────────────────────────────────────────────────────────────
  step("sell: Quotation (submitted) → Create → Sales Order");
  const qtn = await post("frappe.client.insert", { doc: { doctype: "Quotation", company: COMPANY, quotation_to: "Customer", party_name: CUSTOMER, valid_till: inDays(10), items: [{ item_code: ITEM, qty: 4, rate: 120 }] } });
  made.push(["Quotation", qtn.name]);
  await post("frappe.client.submit", { doc: { ...qtn, docstatus: 0 } });
  await open("Quotation", qtn.name);
  await createFrom("Sales Order", "Sales Order");
  await setDate("Delivery Date", inDays(2));
  const sw = field("Set Source Warehouse");
  if (await sw.isVisible().catch(() => false)) await setLink("Set Source Warehouse", WH);
  const so = await saveSubmit("Sales Order");
  check(so?.docstatus === 1 && so.items?.[0]?.prevdoc_docname === qtn.name && so.items[0].qty === 4, `${so?.name} submitted from ${qtn.name}`);
  check((await get("Quotation", qtn.name))?.status === "Ordered", "quotation status Ordered");

  step("sell: Sales Order → Create → Delivery Note");
  await createFrom("Delivery Note", "Delivery Note");
  const dn = await saveSubmit("Delivery Note");
  check(dn?.docstatus === 1 && dn.items?.[0]?.against_sales_order === so.name, `${dn?.name} delivered against ${so.name}`);
  check((await binQty()) === startQty + 11, `stock now ${await binQty()} (−4 delivered)`);

  step("sell: Delivery Note → Create → Sales Invoice");
  await createFrom("Sales Invoice", "Sales Invoice");
  const sinv = await saveSubmit("Sales Invoice");
  check(sinv?.docstatus === 1 && sinv.items?.[0]?.delivery_note === dn.name && sinv.items[0].sales_order === so.name, `${sinv?.name} billed for ${dn.name} / ${so.name}`);
  check(sinv?.net_total === 480, `net total ${sinv?.net_total} (4 × 120)`);

  step("sell: Sales Invoice → Create → Payment");
  await createFrom("Payment", "Payment Entry");
  const spay = await saveSubmit("Payment Entry");
  check(spay?.docstatus === 1 && spay.payment_type === "Receive" && spay.party === CUSTOMER, `${spay?.name}: Receive ${spay?.received_amount} from ${CUSTOMER}`);
  check((await get("Sales Invoice", sinv.name))?.status === "Paid", "sales invoice Paid");
  const soAfter = await get("Sales Order", so.name);
  check(soAfter?.per_delivered === 100 && soAfter?.per_billed === 100 && soAfter?.status === "Completed", `sales order ${soAfter?.status} (delivered ${soAfter?.per_delivered}%, billed ${soAfter?.per_billed}%)`);
  await shot("day_sales_paid");

  // ── reports ────────────────────────────────────────────────────────────────────────────────────────────
  const report = async (name, params) => {
    const run = page.waitForResponse((r) => r.url().includes("frappe.desk.query_report.run") && r.request().method() === "POST", { timeout: 120000 });
    await page.goto(`${BASE}/desk/query-report/${enc(name)}?${new URLSearchParams(params)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    const msg = (await (await run).json()).message;
    await page.locator("main table tbody tr").first().waitFor({ timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(800);
    return msg;
  };
  const cellsOf = (msg, fieldname) => msg.columns.findIndex((c) => (c.fieldname ?? c) === fieldname);

  step("reports: stock report agrees with the warehouse");
  const shownNumber = async (label, col) => {
    const cells = await page.locator("main table tbody tr", { hasText: label }).last().evaluate((tr) => [...tr.querySelectorAll("td")].slice(1).map((td) => td.innerText.trim())).catch(() => []);
    return Number(String(cells[col] ?? "").replace(/[^\d.-]/g, ""));
  };
  let msg = await report("Stock Balance", { company: COMPANY, from_date: today, to_date: today, item_code: ITEM, warehouse: WH });
  const bin = await binQty();
  if (Array.isArray(msg.result)) {
    const sb = msg.result.find((r) => r && r.item_code === ITEM && r.warehouse === WH);
    check(!!sb && Number(sb.bal_qty) === bin, `Stock Balance bal_qty ${sb?.bal_qty} = Bin ${bin}`);
    check(Number(sb?.in_qty) >= 15 && Number(sb?.out_qty) >= 4, `today in ${sb?.in_qty}, out ${sb?.out_qty}`);
    check((await shownNumber(ITEM, cellsOf(msg, "bal_qty"))) === Number(sb?.bal_qty), "Crema shows that Balance Qty");
  } else {
    // a prepared report: generated by a background worker, which a bench without workers never runs (Desk shows
    // it queued too) — the live Stock Ledger carries the same running balance
    check(!!msg.prepared_report, `Stock Balance is a prepared report (${msg.doc?.status ?? "queued"}); checking Stock Ledger`);
    msg = await report("Stock Ledger", { company: COMPANY, from_date: today, to_date: today, item_code: ITEM, warehouse: WH });
    const sle = msg.result.filter((r) => r && r.item_code === ITEM && r.warehouse === WH);
    const last = sle[sle.length - 1];
    const moved = sle.reduce((s, r) => s + Number(r.actual_qty || 0), 0);
    check(!!last && Number(last.qty_after_transaction) === bin, `Stock Ledger balance ${last?.qty_after_transaction} = Bin ${bin}`);
    check(moved === 11, `today's movements +10 +5 −4 = ${moved}`);
    check((await shownNumber(ITEM, cellsOf(msg, "qty_after_transaction"))) === bin, "Crema shows that balance");
  }
  await shot("day_stock_report");

  step("reports: General Ledger for the sales invoice balances");
  msg = await report("General Ledger", { company: COMPANY, from_date: today, to_date: today, voucher_no: sinv.name, group_by: "Group by Voucher (Consolidated)" });
  const gle = msg.result.filter((r) => r && r.voucher_no === sinv.name);
  const dr = gle.reduce((s, r) => s + Number(r.debit || 0), 0);
  const cr = gle.reduce((s, r) => s + Number(r.credit || 0), 0);
  check(gle.length >= 2 && Math.abs(dr - cr) < 0.01, `${gle.length} entries, debit ${dr} = credit ${cr}`);
  check((await page.locator("main table tbody").innerText()).includes(sinv.name), "Crema lists the invoice's ledger entries");

  step("reports: Accounts Receivable no longer lists the paid invoice");
  msg = await report("Accounts Receivable", { company: COMPANY, report_date: today, party_type: "Customer", party: JSON.stringify([CUSTOMER]) });
  check(!msg.result.some((r) => r && r.voucher_no === sinv.name), "paid invoice not outstanding (server)");
  check(!(await page.locator("main").innerText()).includes(sinv.name), "and not shown in Crema");
  await shot("day_receivable");

  check(pageErrors.length === 0, `no page errors${pageErrors.length ? ": " + pageErrors.slice(0, 2).join(" | ") : ""}`);
} finally {
  step("cleanup: cancel and delete in reverse order");
  for (const [dt, name] of made.reverse()) {
    const d = await get(dt, name).catch(() => null);
    if (!d) continue;
    if (d.docstatus === 1) await post("frappe.client.cancel", { doctype: dt, name });
    await post("frappe.client.delete", { doctype: dt, name });
  }
  check((await binQty()) === startQty, `stock back to ${startQty} (${await binQty()})`);
}
await t.finish();
