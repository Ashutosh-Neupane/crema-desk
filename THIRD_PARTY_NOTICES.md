# Third-party notices

Crema is licensed under the GNU General Public License v3.0 only (see `LICENSE`). It builds on the projects
below; their copyright notices and licence terms are kept here.

## Frappe Framework — MIT
Copyright (c) Frappe Technologies Pvt. Ltd. — https://github.com/frappe/frappe

- Images, icons and sounds in `crema-frontend/public/` (`images/`, `icons/espresso`, `icons/timeless`,
  `icons/desktop_icons`, `icons/social`, `sounds/`, `html/print_template.html`).
- Many modules transcribe Desk behaviour from `frappe/public/js/frappe` and say so in their header comment
  (for example `lib/form/perm.ts` from `model/perm.js`, `lib/frappe/format.ts` from `number_format.js`).

## ERPNext — GPL-3.0
Copyright (c) Frappe Technologies Pvt. Ltd. — https://github.com/frappe/erpnext

Crema ports behaviour from ERPNext's JavaScript, under the same GPL-3.0 as the rest of Crema; the ported modules
name their ERPNext source file in their header comment. Among them:

- `crema-frontend/lib/form/shims/serialBatch.ts`, `SerialBatchDialog.tsx` (serial and batch selector)
- `crema-frontend/lib/form/shims/itemDashboard.ts` (item stock levels)
- `crema-frontend/lib/form/shims/ledgerPreview.ts` (accounting and stock ledger preview)
- The ERPNext-specific parts of `crema-frontend/lib/form/compat.ts` and `crema-frontend/lib/form/adapters.ts`

## Lucide — ISC
Copyright (c) Lucide Contributors — https://lucide.dev — `crema-frontend/public/icons/lucide*`

## Leaflet — BSD-2-Clause
Copyright (c) Vladimir Agafonkin and contributors — https://leafletjs.com — `crema-frontend/public/images/leaflet`

## Frappe Framework licence text

```
The MIT License

Copyright (c) 2016-2021 Frappe Technologies Pvt. Ltd. <developers@frappe.io>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
