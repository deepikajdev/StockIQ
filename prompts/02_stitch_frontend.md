# Google Stitch prompt — StockIQ UI (paste in order; screens are generated one at a time)

## Master prompt (paste first)
Design a responsive web app called **StockIQ** — an inventory & reorder-recommendation dashboard for small
retail shop owners. Style: clean, calm, accessible SaaS dashboard. Light theme primary (dark optional).
Left sidebar nav on desktop (collapses to bottom tab bar / hamburger on mobile): Dashboard, Products, Inventory,
Sales, Purchases, Suppliers, Alerts & Reorder, Movement History, Reports. Top bar: global search, user avatar
menu with role badge (Admin / Staff) and Sign out.
Visual rules: one deep-teal/indigo primary, neutral grays, amber for warnings, red for critical, green for healthy.
Inter-style sans font, 8px grid, 12px rounded cards, readable dense data tables with sticky headers, tabular
numerals, zebra rows optional. Prioritise readable tables and clear primary actions over decoration. Every
screen needs empty, loading (skeleton) and error states. Currency in ₹ (Indian rupee), dates DD MMM YYYY.
Buttons: primary filled, secondary outline, destructive red. Status chips: In stock / Low stock / Out of stock.

## Screens (generate each)
1. **Login** — centered card, email, password, show/hide, inline error "Invalid email or password", demo-credentials hint text.
2. **Dashboard** — 4 KPI cards (Active products, Stock value, Low-stock items, Today's sales), a 7-day revenue
   line/bar chart, "Needs reordering" list (top 5 with days-left chip), "Recent sales" table, quick actions
   (New sale, Receive purchase, Add product).
3. **Products** — search + category filter + active toggle, table (SKU, Name, Category, Unit, Price, Cost,
   Stock, Reorder point, Status), row actions edit/deactivate, "Add product" button → right-side drawer form
   (SKU, name, category select, unit, selling price, cost price, reorder point, safety stock) with inline
   validation incl. "SKU already exists". Pagination footer.
4. **Product detail** — header with stock status, tabs: Overview, Suppliers (table with unit cost, lead time,
   MOQ, preferred star + "Link supplier" modal), Movement history.
5. **Inventory** — stock table with value column, low-stock filter chip, "Adjust stock" modal (signed quantity,
   reason dropdown: Opening balance / Damaged / Lost / Found / Correction / Other, note) — admin only.
6. **New sale (POS style)** — product search-and-add, line items table with qty steppers, running total, red
   inline banner "Insufficient stock for <SKU>: available 3, requested 5" state, Complete sale button, success toast.
7. **Sales history** — table with date range filter, status chip (Completed / Cancelled), expandable rows with
   items, admin-only Cancel action with confirm dialog.
8. **Purchases** — list with status chips (Draft / Received / Cancelled), "New purchase" form (supplier select,
   line items with qty + unit cost, Save as draft / Save & receive), detail view with "Receive items" button.
9. **Suppliers** — list + add/edit drawer (name, contact, email, phone, address, active) + linked products table.
10. **Alerts & Reorder** — two sections. (a) Low-stock alert table. (b) Recommendations table: product, current
   stock, avg daily sales, days left, reorder point, suggested qty, supplier. Row click opens an
   **"Explain this recommendation"** panel listing every input (lookback window, units sold, avg/day, lead time
   and its source, safety stock, review period, reorder point, target stock, suggested qty) with the formula
   shown with substituted numbers and a footer note "Estimate based on recent sales; not a guarantee."
   Also show the data-insufficient state ("Not enough sales history" / "Supplier lead time unknown") as an
   amber chip instead of a number. Button "Create purchase draft" prefilled.
11. **Movement history** — table (Date-time, Product, Type chip, signed qty in green/red, before → after,
    source link e.g. "Sale #123", reason, user) with filters.
12. **Reports** — tabs: Sales (date range picker, KPIs, chart, top products), Inventory (value by category),
    Dead stock (no sales in N days).
13. **Role variants** — Staff view hides: Add/Edit product, Adjust stock, Suppliers edit, Cancel actions, New purchase.

After generating, export as HTML/CSS (or Figma) and keep the screen names above.

## Next step: wiring prompt for Antigravity (paste after Stitch export)
"Convert the exported Stitch screens in `stitch-export/` into a Vite + React + TypeScript app in `frontend/`
(React Router, TanStack Query, Tailwind or the exported CSS, Recharts). Keep the exported look. Implement
`src/api/client.ts` (fetch wrapper with `Authorization: Bearer`, base URL from `VITE_API_URL`, 401 → logout)
and wire every screen to the REST API described in `docs/api-contract.md` and the Swagger at `/docs`.
Rules: money fields arrive as decimal STRINGS — format with Intl, never do float math for totals; the server is
the source of truth for stock (never compute balances in the browser); hide admin-only actions for role=staff
but assume the API enforces it; show server `detail.message` for 409 insufficient_stock; paginate with
`limit/offset`; token in memory + sessionStorage. Add loading/empty/error states. Provide `.env.example`
(VITE_API_URL) and a production build (`npm run build`)."
