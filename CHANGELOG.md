# Changelog

## [Unreleased]

### Changed

- Centralize API root URL configuration using `API_CONFIG.rootURL`. (92e6927)


### Docs

- update changelog to reflect the v2.3.0 release (8b3a460)

## v2.3.0 - 2026-01-27

### Added

- Introduce timekeeper role, update API documentation, and enhance HR/Payroll functionalities for dashboard, salary raise, payout, and user branch management. (6815bc0)

## v2.2.0 - 2026-01-20

### Added

- Implement employee type change logic with new contracts for bonus, salary raise, and payout PT modules, alongside a duplicate employee check and UI updates. (c861bc5)

## v2.1.1 - 2026-01-20

### Added

- hide superadmin company updates from tenant logs and fix duplicate logging (6eef9e0)

- Enhance API error message extraction in frontend components and implement build-time API versioning with improved display. (1350c48)


### Fixed

- Normalize empty email before validation in employee endpoints (080fe9d)

## v2.1.0 - 2026-01-08

### Added

- Document Printing, Payment Cover Sheets, and Payroll Settings Snapshots (#3) (0184e34)


### Chore

- release v2.1.0 (14941ef)


### Docs

- Add v2.0.0 release notes, Dockerfile caching entry, and remove previous unreleased entries. (f40ac38)

## v2.0.0 - 2026-01-07

### Added

- Multi-tenancy support, Super Admin management, and Payroll enhancements (#1) (3663233)

- update swagger tenant headers and stabilize cookie-based auth (#2) (4d9608f)

- Expand Dockerfile to include dependency caching for additional modules and shared components. (5c25890)


### Docs

- Add v2.0.0 release notes and remove previous unreleased entries. (eeb5ef4)

## v1.4.0 - 2026-01-02

### Added

- Add payroll configuration for work hours, late deduction rate, and grace minutes. (65537b5)

## v1.3.0 - 2026-01-02

### Added

- Implement year selection for the attendance chart and refine loading/error display within the widget. (fc26d06)

- Add employee filter to attendance summary dashboard. (370dbe9)

- Implement attendance leaderboard widget and API to display top employees by attendance. (b2d5165)

## v1.2.0 - 2026-01-01

### Added

- Update payslip print template content and styling. (ca51a37)

- add EmployeeCellDisplay component and integrate it into worklogs, debt, and salary advance lists, enhancing employee display and filtering. (853a660)

- Add date range filtering to the payout list UI, service, and API. (b85d9f3)

- add filter for employees with outstanding debt (8718ca0)

- Add employee fields for nickname, ID document description, and SSO hospital name with associated validation, UI, and migration updates. (e9a63f2)


### Changed

- adjust route paths and permissions for payroll and user modules (0a42bb1)


### Fixed

- allow updating existing loan repayments when loan outstanding is zero during payroll item update. (c76bcd8)

- allow updating existing payroll item repayments when amount is zero and add `EmployeeCellDisplay` component to debt and salary advance lists. (1f3a6fb)

## v1.1.0 - 2026-01-01

### Added

- add loan outstanding tracking to payroll calculations (78eefe5)

- allow listing all employees update payroll for deleted (76a3494)

- Make batch and individual payslip printing available for pending payrolls, defaulting to original print when pending. (33ee283)

- Add payslip preview functionality to batch print and individual payslip edit dialogs. (6e71ba8)

- Add radio group for selecting full/half day leave duration in worklog form, automatically setting quantity. (f378f23)


### Changed

- handle SSO declared wage null and update import syntax (bf6e573)


### Fixed

- update late deduction condition to use late minutes instead of late deduct (8f9800b)

## v1.0.0 - 2025-12-20

### Added

- Create initial Next.js web application with i18n, UI components, and dashboard pages, and update Makefile. (e92664d)

- migrate from NPM to custom nginx proxy with health checks (7b702e1)

- Implement payroll config ui (5401ca9)

- Implement comprehensive employee management features with new UI pages and API endpoints, alongside general API enhancements and bug fixes across various modules. (52fb442)

- implement employee accumulation management and user profile page with password change (8bd22cf)

- Implement admin user management with new API endpoints, UI, toast notifications, and updated API documentation. (b720f45)

- change WorkDate type from time.Time to string and add time formatting utilities (84b1d7f)

- Implement part-time payout management with new UI pages for list, detail, and create, alongside corresponding API endpoints and documentation updates. (5f90649)

- Implement comprehensive salary raise module including API, web UI, and documentation. (fc261fe)

- implement bonus management feature with dedicated API, UI, services, and database migrations. (6a91d04)

- Implement "Remember Me" functionality to pre-fill username and store/remove it from local storage. (813c815)

- Hide approve and reject actions for HR users on bonus and salary raise detail pages. (37954a2)

- update application icons and integrate them into metadata and dashboard layout. (8f425c5)

- Implement bonus cycle creation with dynamic default date pre-filling and specific conflict error messages. (fb23c98)

- Implement and integrate new pagination component across user, worklog, and salary raise lists, updating service calls. (117cc40)

- increase query limit from 100 to 1000 and add salary advance module with UI translations (f8f0644)

- Add comprehensive debt management functionality including creation, listing, details, and repayment. (4e1fed3)

- Introduce a new application sidebar with collapsible menus and add Skeleton, Tooltip, and Collapsible UI components. (8977022)

- Add i18n keys for installment statuses and confirmation dialogs, and update debt detail to use new installment status key. (11fb757)

- Introduce `MonthPicker` component and refactor bonus and salary advance forms to use it, updating bonus display formats. (ad0f26f)

- Add 'Current Month' button to month picker and introduce new i18n keys for 'currentMonth' and 'errorLoadingData'. (ecf7747)

- Add automatic redirection for authenticated users after hydration, respecting preferred locale. (914e8af)

- Enhance Docker build/deployment, add session verification, and update employee form UI. (299f4ab)

- Enhance session management by updating both access and refresh tokens and improving refresh token handling across the application. (466cf8a)

- add OpenSpec workflow definitions for proposal, apply, and archive operations (33ac924)

- add optional build-related dependencies to package.json (7fda0b8)

- change date fields to strings and add parsing logic (5ffa6a1)

- add payroll detail and edit (8abdc2c)

- update @swc/helpers version and fix payroll monthDate reference (d15fdfb)

- add doctor fee and benefit flags to item DTO and update validation (33f3418)

- add PT payout cancellation, improve worklog creation, and update payroll configurations and UI components (4919584)

- enhance return URL logic by storing user ID for more accurate post-login redirection (0dc85bd)

- add comprehensive tax configuration settings and API support for payroll calculations (2af4db5)

- Implement tax calculation, allowances, and update payroll item structure and migrations. (7f878e1)

- Add total tax, social security, and provident fund to payroll run details across API, database, and UI. (d3cd72d)

- Implement view-only mode for payslip dialog with conditional UI elements and new translations. (5adbb05)

- add end-to-end tests for salary advance, debt/loan, and bonus management (9fef9b1)

- Introduce API health check with database connectivity, update Docker Compose healthcheck, and refine E2E tests. (08dda86)

- Update Go version, enhance API server startup with logging, improve readiness check, and add JWT secrets for E2E tests (91806c2)

- Update E2E test configuration to copy static assets for standalone mode and adjust web server command (154774f)

- add test data seeding to the e2e workflow. (e0d93f1)

- enhance documentation for HR Payroll API and Web, including project structure and setup instructions (5f5d0be)

- Implement FT worklog date range and validation, and enhance employee form auto-fill logic (54de7fd)

- reorganize compensation and deductions sections (6194958)

- support income accumulation and new fields in payroll run (131555f)

- set granular CORS, add payroll org profile module (d73b575)

- Implement employee photo management and master data CRUD for departments and employee positions. (3baa319)

- add employee type, department, position, bank info to payroll_run_item (a813750)

- extend DTOs and repository with employee type, department, position, and bank details (c27572b)

- add bonusYear to bonus cycle and support filtering by year (ed960a4)

- Implement payslip printing functionality and enrich payroll data with detailed employee and organizational information. (8366eed)

- Bilingual label component (Thai + Burmese) (e1b8746)

- Add options to print payslips as original, copy, or both in print dialogs. (d6b6c3f)

- Add employee title name to data models and implement PT payout print functionality. (810e2a6)

- Implement employee photo management and display across API and web modules. (32b965c)

- Implement `minDate` prop for `MonthPicker` to disable past months, applied to the salary advance payroll month field. (e59ed21)

- Implement role-based debt plan redirection, refine debt list filter layout, and remove service worker files. (9388698)

- Add `auth_refresh_tokens` table and update default passwords in test fixtures and password generation playground script. (0bc9a92)

- Add public branding and logo endpoints to payroll organization profile, including client-side integration. (9f04767)

- Implement comprehensive employee document and document type management, including API endpoints, database migrations, UI for CRUD operations, and an expiring documents dashboard widget. (34edd60)

- Introduce activity logging module, database migrations, event infrastructure, and corresponding web UI components. (654f0ca)

- Implement dashboard with new widgets and a dedicated API module. (78a7952)

- Refactor admin master data pages to use reusable list and form components for document types, positions, and departments. (923af21)

- add E2E tests for admin modules, user profile, and dashboard, and update employee tests. (ecb80a5)

- Move settings page to admin path and implement comprehensive payroll configuration with tax brackets and social security settings. (be7962f)

- Pre-fill organization profile start date from existing data and refactor attendance chart display logic to use conditional rendering. (a03fdbc)

- introduce and integrate a new dismissible alert component across various forms and pages for enhanced user feedback. (ea6b84e)

- Add activity logging for master data operations and dynamic filters for the activity log list. (7240d15)

- enhance employee creation and update audit logs by adding new detail fields. (a9e2041)

- Introduce employee photo deletion functionality and refine duplicate photo/document upload handling. (a6b8b72)

- Redirect to new bonus cycle detail page after creation and improve salary advance validation messages with i18n. (6f9512c)

- add CI workflow and migration support to Docker builds (c69f0a8)


### Build

- Add `activitylog`, `dashboard`, and `shared/events` Go module dependencies to Dockerfile. (773e61d)


### CI

- Add steps to start web server and wait for API and web readiness before E2E tests. (1943f34)

- add NEXT_PUBLIC_API_BASE_URL environment variable to E2E standalone build step. (b20640f)


### Changed

- Update color palette and component styling, simplify dashboard menu, and remove global toaster. (137e4a2)

- rename `payrollMonthDate` query parameter to `monthDate` (3b070c6)

- remove redundant details field from delete audit logs across various modules. (68d03d9)

- add attendance bonus flags to employee detail DTO (2d3b132)


### Chore

- Add favicon.ico route to return 204 No Content. (53a6844)

- update ignore patterns and Dockerfile for new module (ea575c6)

- add --unreleased flag to changelog-release target (59710fc)

- add v1.0.0 release notes (c48230a)


### Docs

- Add HR Payroll system color palette documentation and its associated image asset. (4d18530)

- add initial CHANGELOG.md with release notes (5ccba9f)


### Fixed

- Ensure auth store hydration before protecting routes and refine 401 handling for login attempts. (6065771)

- use `value` prop for Select components in bonus cycle creation dialog. (4dd7e95)

- Adjust Go module paths in e2e workflow configuration. (4a9a831)

- default position and department data to empty array on null API responses (0bdf061)


### Other

- init api (19a38c7)

- update next.js dependency to version 16.0.10. (38c5564)


### Tests

- update E2E tests for filters functionality (883c2b6)

