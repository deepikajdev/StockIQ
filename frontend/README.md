# StockIQ — Frontend Application

**StockIQ** is an Intelligent Inventory Management and Reorder Recommendation System purpose-built for retail operations (stationery/office supplies).

This frontend is a high-performance Single Page Application (SPA) built with React 18, TypeScript, Tailwind CSS, TanStack Query, and Vite, connecting to the FastAPI backend.

---

## 🛠 Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (Precision Commerce design tokens)
- **State & Server Sync**: TanStack Query (React Query v5)
- **Routing**: React Router v6 (Protected routes with role-based view layers)
- **Forms & Validation**: React Hook Form + Zod
- **Data Visualization**: Recharts
- **Icons**: Lucide React
- **Notifications**: Sonner (Toast alerts)

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js**: v18.0.0 or higher
2. **FastAPI Backend**: Running at `http://localhost:8000`
3. **Database**: MySQL 8.0 instance with initialized StockIQ schema

### Installation

Navigate to the `frontend/` directory and install dependencies:

```bash
cd frontend
npm install
```

### Environment Configuration

Create a `.env` file in `frontend/` based on `.env.example`:

```bash
cp .env.example .env
```

Configuration parameters:

```env
# StockIQ FastAPI Backend API URL
VITE_API_URL=http://localhost:8000
```

---

## 💻 Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Launch the Vite development server (default: `http://localhost:5173`) |
| `npm run build` | Compile TypeScript and produce production build in `dist/` |
| `npm run typecheck` | Run TypeScript strict compiler verification (`tsc --noEmit`) |
| `npm run test` | Run Vitest unit and integration test suite |
| `npm run preview` | Locally preview production build |

*Note for Windows environments with JDK conflicts*: If `npm run ...` throws a `cmd.exe` path collision, run directly via Node:
```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

---

## 🔐 Authentication & Roles

StockIQ enforces server-authoritative Role-Based Access Control (RBAC):

| Capability | Store Admin (`admin`) | Floor Staff (`staff`) |
|---|:---:|:---:|
| View Dashboard & Inventory | ✅ | ✅ |
| Point of Sale (New Sale) | ✅ | ✅ |
| View Sales History | ✅ | ✅ |
| Cancel Sale (Reversal) | ✅ | ❌ |
| Create / Edit Products | ✅ | ❌ |
| Deactivate Products | ✅ | ❌ |
| Commit Stock Adjustments | ✅ | ❌ |
| Create Purchase Orders | ✅ | ❌ |
| Receive Goods into Stock | ✅ | ✅ |
| Add / Edit Suppliers | ✅ | ❌ |
| View Reports & Analytics | ✅ | ✅ |

### Default Credentials (Seed Data)
- **Admin**: `admin@stockiq.example.com` / `admin12345`
- **Staff**: `staff@stockiq.example.com` / `staff12345`

---

## 📁 Source Architecture

```
frontend/
├── public/                 # Static assets & favicon
├── src/
│   ├── api/
│   │   └── client.ts       # Centralized fetch client with JWT Bearer & 409 handling
│   ├── components/
│   │   └── common/         # DataTable, Modal, Drawer, KpiCard, StatusBadge, etc.
│   ├── contexts/
│   │   └── AuthContext.tsx # JWT session management & user role verification
│   ├── hooks/
│   │   └── useAuth.ts      # Auth hook re-export
│   ├── layouts/
│   │   ├── AppLayout.tsx   # Master 1440px shell
│   │   ├── Sidebar.tsx     # 248px desktop navigation rail
│   │   ├── Topbar.tsx      # Header bar with user profile & role badge
│   │   └── MobileNav.tsx   # Responsive slide-over drawer
│   ├── pages/              # 13 Connected application screens + 404
│   │   ├── AlertsReorder.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Inventory.tsx
│   │   ├── Login.tsx
│   │   ├── MovementHistory.tsx
│   │   ├── NewSale.tsx
│   │   ├── NotFound.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── Products.tsx
│   │   ├── Purchases.tsx
│   │   ├── Reports.tsx
│   │   ├── RoleVariants.tsx
│   │   ├── SalesHistory.tsx
│   │   └── Suppliers.tsx
│   ├── routes/
│   │   └── index.tsx       # Route definitions with ProtectedRoute wrappers
│   ├── types/
│   │   └── index.ts        # Domain models matching OpenAPI contract
│   ├── utils/
│   │   └── format.ts       # Indian currency format (₹), dates, signed deltas
│   ├── __tests__/          # Vitest unit & schema tests
│   ├── App.tsx             # Root query client & router provider
│   └── main.tsx            # React DOM entrypoint
├── stockiq_*/              # Original Stitch screen design exports (Preserved)
├── tailwind.config.js      # Precision Commerce color palette & elevation tokens
└── vite.config.ts          # Vite build config
```

---

## 🎨 Design System & Formatting Rules

1. **Monetary Formatting**: All prices and valuation figures use the Indian Numbering System with Rupee symbol (e.g. `₹1,24,580.00`) formatted through `Intl.NumberFormat('en-IN')`.
2. **Tabular Numerics**: Financial and quantity columns enforce `tabular-nums` CSS class for clean vertical alignment.
3. **Atomic Inventory Transactions**: Stock changes are never mutated optimistically on the client; state transitions are committed server-side via the append-only ledger before UI updates.
