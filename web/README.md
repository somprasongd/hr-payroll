# HR Payroll Web

Frontend Web Application สำหรับระบบ HR Payroll พัฒนาด้วย Next.js

## 🏗️ Project Structure

```
web/
├── src/
│   ├── app/             # Next.js App Router pages
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities & helpers
│   ├── services/        # API services
│   ├── stores/          # Zustand stores
│   ├── messages/        # i18n translations (th, en, my)
│   └── types/           # TypeScript types
├── e2e/                 # Playwright E2E tests
│   ├── fixtures/        # Test fixtures
│   ├── helpers/         # Test helpers
│   ├── pages/           # Page Object Models
│   └── tests/           # Test specs
└── public/              # Static assets
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd web
npm install
```

### Run Development

```bash
npm run dev
# Open http://localhost:3000
```

### Build Production

```bash
npm run build
npm start
```

### Docker

```bash
# From project root
make image-web
```

## ⚙️ Configuration

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

| Variable              | Description     |
| --------------------- | --------------- |
| `NEXT_PUBLIC_API_URL` | Backend API URL |

## 🧪 E2E Testing

Uses [Playwright](https://playwright.dev/) for end-to-end testing.

### Setup

```bash
cp .env.test.example .env.test
# Edit .env.test with test credentials
```

### Run Tests

```bash
npm run test:e2e          # Headless mode
npm run test:e2e:headed   # With browser visible
npm run test:e2e:ui       # Interactive UI mode
npm run test:e2e:report   # View HTML report
```

### Test Seed Data

บาง test ต้องการ seed data พิเศษ ซึ่งถูกจัดเก็บในโฟลเดอร์ `migrations/test-seed/`:

| File                               | Description                                              | Used By                             |
| ---------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| `001_login_restriction_test.sql`   | Seed users สำหรับทดสอบ login กับบริษัทที่ถูกระงับ/ยกเลิก | 25-login-restriction.spec.ts        |
| `002_branch_and_employee_test.sql` | Seed "สาขา 1" และพนักงานสำหรับ DEFAULT company           | 24-branch-switch-navigation.spec.ts |
| `003_pt_payout_test.sql`           | Seed PT worklogs และ payouts (paid/to_pay status)        | 09-pt-payout.spec.ts                |
| `004_multi_tenancy_test.sql`       | Seed COMPANY2 พร้อม admin2, branches, และพนักงาน         | 19-multi-tenancy.spec.ts            |
| `005_document_types_test.sql`      | Seed document types (system + company-specific)          | 14-admin-document-types.spec.ts     |

**CI (GitHub Actions):** Seed data จะถูกรันอัตโนมัติใน workflow

**Local Development:** รัน seed data ทั้งหมดก่อนรัน test:

```bash
DB_URL="postgres://postgres:postgres@localhost:54322/test?sslmode=disable"

# รัน test-seed ทั้งหมด
for file in migrations/test-seed/*.sql; do
  echo "Running: $file"
  psql "$DB_URL" -f "$file"
done
```

### Test Coverage

| Spec | Description                    |
| ---- | ------------------------------ |
| 01   | Login/Logout                   |
| 02   | Users Management               |
| 03   | Employees (FT/PT)              |
| 04   | Worklogs (FT/PT)               |
| 05   | Salary Advance                 |
| 06   | Debt/Loan                      |
| 07   | Bonus Cycles                   |
| 08   | Salary Raise                   |
| 09   | PT Payout                      |
| 10   | Payroll Run                    |
| 11   | Filters                        |
| 20   | Super Admin (Company/Settings) |
| 25   | Login Restriction              |

## 🛠️ Tech Stack

| Category      | Technology                       |
| ------------- | -------------------------------- |
| Framework     | Next.js 16 (App Router)          |
| React         | React 19                         |
| Language      | TypeScript                       |
| Styling       | TailwindCSS 4                    |
| UI Components | Radix UI + shadcn/ui             |
| State         | Zustand                          |
| Data Fetching | TanStack Query (v5) & Table (v8) |
| Forms         | React Hook Form + Zod            |
| i18n          | next-intl (th, en, my)           |
| HTTP Client   | Axios                            |
| Charts        | Recharts                         |
| Testing       | Playwright (E2E)                 |
| PWA           | @ducanh2912/next-pwa             |

## 📦 Available Scripts

| Script             | Description              |
| ------------------ | ------------------------ |
| `npm run dev`      | Start development server |
| `npm run build`    | Build for production     |
| `npm start`        | Start production server  |
| `npm run lint`     | Run ESLint               |
| `npm run test:e2e` | Run E2E tests            |

## 🌐 Internationalization

Supported languages:

- 🇹🇭 Thai (`th`)
- 🇬🇧 English (`en`)
- 🇲🇲 Burmese (`my`)

Translation files: `src/messages/`

## 📊 Table Components

### GenericDataTable

A reusable table component located at `src/components/common/generic-data-table.tsx` that provides:

- Consistent table styling and behavior
- Loading states
- Empty states with customizable text
- Pagination support
- Row actions (buttons or dropdown menus)
- Sorting support via TanStack Table

**Usage:**

```tsx
import { GenericDataTable, ActionConfig } from '@/components/common/generic-data-table';
import { ColumnDef } from '@tanstack/react-table';

const columns: ColumnDef<MyDataType>[] = [...];
const actions: ActionConfig<MyDataType>[] = [...];

<GenericDataTable
  data={data}
  columns={columns}
  loading={loading}
  emptyStateText="No data found"
  actions={actions}
  pagination={{ currentPage, totalPages, onPageChange }}
/>
```

### Pages Using GenericDataTable

| Page                          | Component                             |
| ----------------------------- | ------------------------------------- |
| `/employees`                  | `employees/page.tsx`                  |
| `/payroll`                    | `payroll/page.tsx`                    |
| `/payroll/[id]`               | `payroll/[id]/page.tsx`               |
| `/bonuses`                    | `bonuses/page.tsx`                    |
| `/worklogs/ft`                | `worklogs/ft/page.tsx`                |
| `/worklogs/pt`                | `worklogs/pt/page.tsx`                |
| `/debt`                       | `debt-list.tsx`                       |
| `/salary-raise`               | `salary-raise-cycle-list.tsx`         |
| `/salary-advance`             | `salary-advance-list.tsx`             |
| `/payouts/pt`                 | `payouts/pt/page.tsx`                 |
| `/admin/branches`             | `admin/branches/page.tsx`             |
| `/admin/departments`          | `master-data-list.tsx`                |
| `/admin/positions`            | `master-data-list.tsx`                |
| `/admin/document-types`       | `document-type-list.tsx`              |
| `/admin/activity-logs`        | `activity-log-list.tsx`               |
| `/admin/users`                | `user-list.tsx`                       |
| `/super-admin/companies`      | `super-admin/companies/page.tsx`      |
| `/super-admin/document-types` | `super-admin/document-types/page.tsx` |

### Special Cases (Not Using GenericDataTable)

The following pages use raw `Table` components directly due to special requirements:

| Page                 | Reason                                         |
| -------------------- | ---------------------------------------------- |
| `/payouts/pt/create` | Checkbox selection for worklogs                |
| `/payouts/pt/[id]`   | Complex read-only detail view with nested data |
| `/salary-raise/[id]` | Editable cells for raise amounts               |
| `/bonuses/[id]`      | Editable cells for bonus amounts               |
| `/debt/[id]`         | Sub-table for installment history              |
| `/admin/settings`    | Editable tax bracket table                     |
| `/admin/org-profile` | History log table with special formatting      |

> **Note:** All special case tables MUST use consistent styling with GenericDataTable by wrapping the `<Table>` component with `<div className="border rounded-md">`.
