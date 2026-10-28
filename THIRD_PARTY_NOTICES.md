# Third-party notices

Crema is MIT-licensed (see `LICENSE`), except for the material below, which keeps its original license.

## Frappe Framework — MIT
Copyright (c) Frappe Technologies Pvt. Ltd. — https://github.com/frappe/frappe

- Images, icons and sounds in `crema-frontend/public/` (`images/`, `icons/espresso`, `icons/timeless`,
  `icons/desktop_icons`, `icons/social`, `sounds/`, `html/print_template.html`).
- Many modules transcribe Desk behaviour from `frappe/public/js/frappe` and say so in their header comment
  (for example `lib/form/perm.ts` from `model/perm.js`, `lib/frappe/format.ts` from `number_format.js`).

## ERPNext — GPL-3.0
Copyright (c) Frappe Technologies Pvt. Ltd. — https://github.com/frappe/erpnext

These files are ported from ERPNext's JavaScript and are distributed under the GPL-3.0, not MIT:

- `crema-frontend/lib/form/shims/serialBatch.ts`, `SerialBatchDialog.tsx` (serial and batch selector)
- `crema-frontend/lib/form/shims/itemDashboard.ts` (item stock levels)
- `crema-frontend/lib/form/shims/ledgerPreview.ts` (accounting and stock ledger preview)
- The ERPNext-specific parts of `crema-frontend/lib/form/compat.ts` and `crema-frontend/lib/form/adapters.ts`

## Lucide — ISC
Copyright (c) Lucide Contributors — https://lucide.dev — `crema-frontend/public/icons/lucide*`

## Leaflet — BSD-2-Clause
Copyright (c) Vladimir Agafonkin and contributors — https://leafletjs.com — `crema-frontend/public/images/leaflet`
