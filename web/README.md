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

### Test Coverage

| Spec | Description       |
| ---- | ----------------- |
| 01   | Login/Logout      |
| 02   | Users Management  |
| 03   | Employees (FT/PT) |
| 04   | Worklogs (FT/PT)  |
| 05   | Salary Advance    |
| 06   | Debt/Loan         |
| 07   | Bonus Cycles      |
| 08   | Salary Raise      |
| 09   | PT Payout         |
| 10   | Payroll Run       |
| 11   | Filters           |

## 🛠️ Tech Stack

| Category      | Technology            |
| ------------- | --------------------- |
| Framework     | Next.js 16            |
| React         | React 19              |
| Styling       | TailwindCSS 4         |
| State         | Zustand               |
| Data Fetching | TanStack Query        |
| Forms         | React Hook Form + Zod |
| UI Components | Radix UI + shadcn/ui  |
| i18n          | next-intl             |
| Testing       | Playwright            |

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
