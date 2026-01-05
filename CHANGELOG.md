# Changelog

## [Unreleased]

### Added

- Implement multi-tenancy with company and branch management, including super-admin features and RLS. (d47a560)

- Implement multi-tenancy by adding company and branch IDs to payroll operations, database schema, and refactoring related modules. (6f4f27b)

- Introduce tenant-specific repositories and update module dependencies and various module functionalities. (dc2ec6c)

- Implement company-specific configuration and organization profiles, persist refresh tokens, and enhance tenant store hydration error handling. (167f7cd)

- Implement soft deletion for branches with `deleted_at` column, update API and repository logic, and refresh frontend branch filtering. (20af5dd)

- Implement superadmin management for system document types with new UI, API endpoints, database migrations, and shared contracts." (704c610)

- Implement event logging for branch and company operations and add a new tenant repository. (dfbeb43)

- Implement comprehensive company and branch management, user assignment, activity logging, and doctype features with new API endpoints and contracts. (21ca728)

- Add user branch activity logging, implement user companies endpoint, and improve error handling (6968b5b)

- Implement multi-tenancy by adding company module, tenant columns, company_id to payroll accumulation, and refining branch filtering in API, alongside UI updates for user and payroll settings. (18e5927)

- Restructure dev seeding, add branch-scoped pending cycle migrations, and expand E2E test coverage for multi-tenancy and payroll features. (7c9e1af)

- Implement branch-level access control in API repositories and add admin E2E tests. (32209ea)

- Enforce tenant context checks in API queries, update dev seed to preserve system document types, and apply sorting to document type list. (8d4b1f8)

- internationalize "no data" and "no items found" messages in salary raise components. (d1e934c)

- introduce GenericDataTable for consistent table UI, refactor salary advance list, add DB seeding, and update README (d7dbcb1)

- Implement robust multi-tenancy with company and branch IDs across modules, and add part-time payout functionality with dedicated seeding and E2E tests. (610b6f6)

- Consolidate database migrations by removing several individual scripts and adding a new multi-tenant core tables migration. (d93b860)

- introduce Super Admin Activity Logs with dedicated backend endpoints for system-level logs and a new web UI. (8b71780)

- Enhance form usability by adding auto-focus to first input on tab changes and select-on-focus for login fields, and improve user branch saving flow with post-save redirect and refined button logic. (a64ec91)

- Update social security wage cap default from 15000 to 17500 across frontend and backend. (569c0ff)

- Orchestrate payroll organization profile and config creation during company setup within a transaction. (7d781d6)

- Introduce company-scoped unique employee numbers with dedicated frontend error messaging for duplicates. (b0186c2)

- Implement and refine various HR-payroll API features, commands, and endpoints, including new payroll run item and master data listing endpoints. (a4aa19d)

- Add loan outstanding tracking to payroll accumulation calculations (7a6f8cb)

- handle payroll item cleanup on employee deletion or termination (26f946b)

- Add tenant-based filtering to the top employees by attendance feature using tenant context. (a344c7b)

- update payroll functions to use configurable late/leave rates, adjust SSO cap, and filter worklogs by pending status (cacb6c6)

- Enhance employee form validation with tab error highlighting, automatic tab switching, and updated back navigation. (d4b31c2)

- add API version endpoint and display application version in web UI footers (12e1d88)

- Implement PT worklog overnight shift calculation and refactor worklog forms and routing. (a88a197)

- enhance company creation error handling with specific conflict detection and improved UI feedback. (df41b85)

- restrict login for users without active company access (35f26b3)

- Add URL parameter support for list filtering and enhance dashboard attendance chart with new views and translations." (d1179fc)

- Add bonus management, accumulation adjustments, branch management, and update app icons and translations. (f11e811)


### Changed

- Centralize tenant management into a new module and shared contract, removing individual tenant repositories. (6089233)

- Simplify tenant branch handling to use a single branch ID instead of an array of branch IDs. (9142c18)

- set BranchID to nil in branch feature log events (0995f61)

- rename activity_log to activity_logs and revert branch-level scoping for pending cycles and associated trigger functions. (dab7e5b)

- change activity_logs primary key default to uuidv7 (a3d0b15)

- rename update handler to command and remove fiber registration (9835f05)

- streamline entries by consolidating and updating multi-tenancy features and enhancements (5d9ac30)


### Docs

- Enhance project READMEs with architecture details, updated tech stack, and new development commands including Playwright E2E tests. (447bf70)


### Fixed

- explicitly cast company ID parameter to UUID type in payroll organization profile insert query. (1b50cb6)

- update late deduction condition to use late minutes instead of late deduct (219be6e)

- Add tenant filtering to payroll run and item repository methods. (f53c456)

- manual test (75c8b23)

- Correctly handle empty nicknames in employee queries and refactor employee form by removing document/accumulation tabs and enhancing document management with filtering and grouping. (084a7f1)

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

