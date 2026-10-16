"""
Seed an ERPNext v16 site with enough setup + demo data to exercise Trevo the way
Desk would be used: finished setup (no Setup Wizard), defaults, master data,
stock, and Sales Orders in Draft / Submitted / Cancelled states.

Idempotent — safe to re-run. Usage (vendor bench in Docker):
    docker cp scripts/seed_erpnext_demo.py sm-vendor:/tmp/seed.py
    docker exec sm-vendor bash -c 'cd /home/frappe/bench/sites && \
        /home/frappe/bench/env/bin/python /tmp/seed.py vendor1.localhost [--reset-orders]'
"""

import sys

import frappe
from frappe.utils import add_days, nowdate

SITE = sys.argv[1] if len(sys.argv) > 1 else "vendor1.localhost"
COUNTRY, CURRENCY, TZ = "Nepal", "NPR", "Asia/Kathmandu"


def ensure(doctype, name, **fields):
	"""Insert a doc keyed by `name` (or a dict filter) unless it exists."""
	if frappe.db.exists(doctype, name):
		return frappe.get_doc(doctype, name)
	doc = frappe.get_doc({"doctype": doctype, **fields})
	doc.insert(ignore_permissions=True)
	return doc


def tree_root(doctype, root, children, field, parent_field):
	ensure(doctype, root, **{field: root, "is_group": 1})
	for child in children:
		ensure(doctype, child, **{field: child, "is_group": 0, parent_field: root})


def setup_fixtures():
	try:
		from erpnext.setup.setup_wizard.operations.install_fixtures import install

		install(COUNTRY)
		frappe.db.commit()
		print("  ERPNext install_fixtures ok")
	except Exception as e:  # known to fail on Sales Person nested set in some v16 builds
		frappe.db.rollback()
		print(f"  install_fixtures failed ({type(e).__name__}: {e}); creating essentials")
	tree_root("Item Group", "All Item Groups", ["Products", "Raw Material", "Services"], "item_group_name", "parent_item_group")
	tree_root("Customer Group", "All Customer Groups", ["Commercial", "Individual"], "customer_group_name", "parent_customer_group")
	tree_root("Supplier Group", "All Supplier Groups", ["Local"], "supplier_group_name", "parent_supplier_group")
	tree_root("Territory", "All Territories", [COUNTRY], "territory_name", "parent_territory")
	for uom in ("Nos", "Kg", "Box"):
		ensure("UOM", uom, uom_name=uom, must_be_whole_number=1 if uom != "Kg" else 0)
	frappe.db.commit()


def setup_defaults(company):
	gd = frappe.get_single("Global Defaults")
	gd.default_company, gd.default_currency, gd.country = company, CURRENCY, COUNTRY
	gd.save(ignore_permissions=True)
	for key, value in {"company": company, "currency": CURRENCY, "country": COUNTRY}.items():
		frappe.db.set_default(key, value)
	frappe.db.set_single_value("System Settings", {"country": COUNTRY, "time_zone": TZ, "currency": CURRENCY})
	frappe.db.set_single_value(
		"Selling Settings",
		{"customer_group": "Commercial", "territory": COUNTRY, "selling_price_list": "Standard Selling"},
	)
	frappe.db.set_single_value(
		"Stock Settings",
		{"item_group": "Products", "stock_uom": "Nos", "default_warehouse": f"Stores - {frappe.db.get_value('Company', company, 'abbr')}"},
	)
	# Finish setup so Desk (and Trevo) don't route to the Setup Wizard
	frappe.db.set_single_value("System Settings", "setup_complete", 1)
	if frappe.db.has_column("Installed Application", "is_setup_complete"):
		frappe.db.sql("update `tabInstalled Application` set is_setup_complete=1")
	frappe.db.commit()
	print(f"  defaults set for {company}, setup marked complete")


CUSTOMERS = ["Himalayan Traders", "Kathmandu Mart", "Everest Foods", "Pokhara Supplies", "Lalitpur Retail"]
ITEMS = [
	("RICE-25", "Basmati Rice 25kg", 3200),
	("OIL-1L", "Sunflower Oil 1L", 290),
	("SUGAR-1", "Sugar 1kg", 110),
	("TEA-500", "Ilam Tea 500g", 650),
	("NOODLE-B", "Instant Noodles Box", 1150),
	("LENTIL-1", "Red Lentils 1kg", 180),
]


def seed_masters(company):
	for c in CUSTOMERS:
		ensure("Customer", c, customer_name=c, customer_group="Commercial", territory=COUNTRY, customer_type="Company")
	for code, name, rate in ITEMS:
		ensure("Item", code, item_code=code, item_name=name, item_group="Products", stock_uom="Nos", is_stock_item=1)
		if not frappe.db.exists("Item Price", {"item_code": code, "price_list": "Standard Selling"}):
			frappe.get_doc(
				{"doctype": "Item Price", "item_code": code, "price_list": "Standard Selling", "price_list_rate": rate}
			).insert(ignore_permissions=True)
	frappe.db.commit()
	print(f"  {len(CUSTOMERS)} customers, {len(ITEMS)} items with prices")


def seed_stock(company):
	if frappe.db.exists("Stock Entry", {"remarks": "trevo-demo-opening", "docstatus": 1}):
		return
	abbr = frappe.db.get_value("Company", company, "abbr")
	se = frappe.get_doc(
		{
			"doctype": "Stock Entry",
			"stock_entry_type": "Material Receipt",
			"company": company,
			"remarks": "trevo-demo-opening",
			"items": [
				{"item_code": code, "qty": 100, "t_warehouse": f"Stores - {abbr}", "basic_rate": rate * 0.8}
				for code, _, rate in ITEMS
			],
		}
	)
	se.insert(ignore_permissions=True)
	se.submit()
	frappe.db.commit()
	print(f"  stock received: {se.name}")


def reset_sales_orders():
	for so in frappe.get_all("Sales Order", {"po_no": ["like", "TREVO-DEMO-%"]}, ["name", "docstatus"]):
		doc = frappe.get_doc("Sales Order", so.name)
		if doc.docstatus == 1:
			doc.cancel()
		frappe.delete_doc("Sales Order", so.name, force=1, ignore_permissions=True)
	frappe.db.commit()
	print("  demo sales orders removed")


def seed_sales_orders(company):
	if frappe.db.count("Sales Order", {"po_no": ["like", "TREVO-DEMO-%"]}) >= 6:
		print("  sales orders already seeded")
		return
	abbr = frappe.db.get_value("Company", company, "abbr")
	plan = [("Draft", 0), ("Draft", 1), ("Submit", 2), ("Submit", 3), ("Submit", 4), ("Cancel", 0)]
	for i, (state, cust) in enumerate(plan):
		so = frappe.get_doc(
			{
				"doctype": "Sales Order",
				"company": company,
				"customer": CUSTOMERS[cust],
				"po_no": f"TREVO-DEMO-{i + 1}",
				"transaction_date": add_days(nowdate(), -i * 9),
				"delivery_date": add_days(nowdate(), 7),
				"selling_price_list": "Standard Selling",
				"set_warehouse": f"Stores - {abbr}",
				"items": [
					{
						# Desk fills rate client-side (get_item_details); a server insert must pass it
						"item_code": ITEMS[(i + k) % len(ITEMS)][0],
						"qty": 2 + k * 3,
						"rate": ITEMS[(i + k) % len(ITEMS)][2],
						"delivery_date": add_days(nowdate(), 7),
					}
					for k in range(1 + i % 3)
				],
			}
		)
		so.insert(ignore_permissions=True)
		if state in ("Submit", "Cancel"):
			so.submit()
		if state == "Cancel":
			so.cancel()
		print(f"  {so.name}: {state} ({so.customer}, {so.grand_total})")
	frappe.db.commit()


if __name__ == "__main__":
	frappe.init(SITE, sites_path=".")
	frappe.connect()
	frappe.set_user("Administrator")
	company = frappe.db.get_value("Company", {}, "name")
	print(f"Seeding {SITE} (company: {company})")
	setup_fixtures()
	setup_defaults(company)
	seed_masters(company)
	seed_stock(company)
	if "--reset-orders" in sys.argv:
		reset_sales_orders()
	seed_sales_orders(company)
	frappe.clear_cache()
	print("done")
