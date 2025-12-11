This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## E2E Testing

This project uses [Playwright](https://playwright.dev/) for end-to-end testing.

### Setup

```bash
# Copy test environment file
cp .env.test.example .env.test

# Edit .env.test with your test credentials
```

### Run Tests

```bash
# Run all tests (headless)
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed

# Run interactive UI mode
npm run test:e2e:ui

# View HTML report
npm run test:e2e:report
```

### Test Structure

```
e2e/
├── fixtures/          # Test fixtures and credentials
├── helpers/           # API helpers for setup/teardown
├── pages/             # Page Object Model (12 files)
└── tests/             # Test specs (11 files)
    ├── 01-login.spec.ts
    ├── 02-users.spec.ts
    ├── 03-employees.spec.ts
    ├── 04-worklogs.spec.ts
    ├── 05-salary-advance.spec.ts
    ├── 06-debt-loan.spec.ts
    ├── 07-bonus.spec.ts
    ├── 08-salary-raise.spec.ts
    ├── 09-pt-payout.spec.ts
    ├── 10-payroll.spec.ts
    └── 11-filters.spec.ts
```

### Test Coverage

| Phase | Description         |
| ----- | ------------------- |
| 1     | Login/Logout        |
| 2     | Users Management    |
| 3     | Employees (FT/PT)   |
| 4     | Worklogs (FT/PT)    |
| 5     | Salary Advance      |
| 6     | Debt/Loan           |
| 7     | Bonus Cycles        |
| 8     | Salary Raise        |
| 9     | PT Payout           |
| 10    | Payroll Run         |
| 11    | Filters (all pages) |

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
