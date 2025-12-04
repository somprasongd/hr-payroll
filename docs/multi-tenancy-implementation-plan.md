# Multi-Tenancy Implementation Plan

## Objectives
- รองรับหลายบริษัทและหลายสาขา โดยข้อมูลถูกกั้นด้วย company/branch isolation เต็มรูปแบบ
- ให้ HR สามารถสลับสาขาได้อย่างปลอดภัย พร้อม audit ได้ว่าทำงานในสาขาใด
- ลดความเสี่ยง query หลุด tenant ด้วย guard ในทุกชั้น (DB, repo, middleware)

## Assumptions & Constraints
- ใช้ DB เดียว (Postgres) multi-tenant แบบ shared schema + tenant key (`company_id`, `branch_id`)
- มี role base (admin/hr) อยู่แล้ว; จะเพิ่มระดับสิทธิ์ต่อ company/branch
- JWT ใช้ HS256 อยู่แล้ว สามารถเพิ่ม claims ได้

## Data Model & Migration
1) สร้างตารางหลัก
   - `companies(id, code, name, status, created_at, ...)`
   - `branches(id, company_id FK, code, name, status, created_at, ...)`
2) ตาราง mapping สิทธิ์
   - `user_company_roles(user_id, company_id, role)`
   - `user_branch_roles(user_id, branch_id, role)` (optional ถ้าต้องแยกระดับสาขา)
3) เพิ่มคอลัมน์ tenant key ทุกตาราง business (employee, payroll, worklog, configs ฯลฯ)
   - ใช้ composite unique เช่น `UNIQUE(company_id, username)` แทน global unique
   - Index ที่มีการค้นหาบ่อย `company_id` + `branch_id`/status
4) Backfill/migrate
   - สร้าง company/branch default แล้วเติม `company_id`/`branch_id` ให้ข้อมูลเก่า
   - ตั้ง NOT NULL + FK + index หลัง backfill เสร็จ
5) (ทางเลือก) ใช้ RLS
   - Set `app.current_company_id`/`app.current_branch_id` แล้วเพิ่ม policy ใช้ tenant key

## Auth & Session Flow
- JWT Claims เพิ่ม: `company_id`, `branch_id`, `companies` (list), `branches` (list) หรือ `default_branch_id`
- Login flow ใหม่
  1) `/auth/login` คืน user info + companies/branches ที่อนุญาต (ยังไม่ออก access token หรือออก token generic)
  2) `/auth/switch` หรือ `/auth/login` (with `companyId`, `branchId`) สร้าง access token ผูก tenant
- Refresh token: ต้องตรวจสอบว่า branch/company ยังอนุญาตอยู่

## Middleware / Context
- เพิ่ม `TenantInfo{CompanyID, BranchID}` ใน `shared/common/contextx`
- Middleware หลัง Auth: resolve tenant จาก header/path/body (เช่น `X-Company-ID`, `X-Branch-ID`) หรือจาก claims
- ตรวจสิทธิ์: ใช้ repo เช็กว่า user มีสิทธิ์ในบริษัท/สาขาที่ร้องขอ; reject 403 ถ้าไม่มี
- เซ็ต tenant info ลง context; ถ้าใช้ RLS ให้ `SET LOCAL` ตาม tenant ก่อน query

## Repository & Service Changes
- ทุก repository function รับ `tenant` param หรืออ่านจาก context แล้วบังคับ WHERE `company_id = $x` (และ `branch_id` ถ้าผูกสาขา)
- ทุก INSERT/UPDATE ต้องตั้งค่า `company_id`/`branch_id`
- เพิ่ม guard/unit test ให้ query ใส่ tenant key เสมอ (ป้องกันหลุด)

## API Surface
- แนะนำ path prefix หรือ header ชัดเจน
  - Path style: `/api/v1/companies/:cid/branches/:bid/...`
  - หรือ Header style: `X-Company-ID`, `X-Branch-ID`
- ปรับ Swagger/doc ให้สะท้อนพารามิเตอร์ tenant
- เพิ่ม endpoint `/auth/switch` (รับ companyId, branchId) และคืน access token ใหม่

## Hybrid Provisioning (Ops + Company Admin)
- Roles: `super_admin` (global/ops), `company_admin` (per company), `hr`/branch-level roles (per branch)
- Backoffice/Ops API (protected by super_admin):
  1) Create company (`code/name/locale/timezone/status`) -> returns `company_id`
  2) (Optional) Create initial branch for that company -> returns `branch_id`
  3) Seed founder admin: create user + `user_company_roles` mapping as `company_admin`; optional branch role if needed
  4) Audit log every provisioning event (who created, when, payload)
- Main app (tenant-scoped):
  - `company_admin` creates/edits branches under own company
  - `company_admin` invites/creates users under own company, assigns branch roles
  - HR uses tenant switcher to work per branch; no access across companies
- Migration/Config:
  - Seed `super_admin` role and secure login path (could be CLI or ops-only UI)
  - Ensure global guards: only super_admin can call provisioning endpoints; company_admin cannot create companies
  - Provide CLI script for ops to call provisioning endpoints with service token for emergency/manual tasks
- Ops Checklist:
  - Verification (billing/domain/doc) before `status=active`
  - Quota/limits per company (branches/users) configurable
  - Deprovision path: set company status `suspended`/`archived`, revoke logins, retain audit

## Web UI Changes
1) Login Screen
   - Step 1: username/password -> รับรายการบริษัท/สาขา
   - Step 2: เลือก company + branch (auto-select ถ้ามีอันเดียว), remember last selection (local storage)
   - Step 3: call switch/login with selected tenant -> เก็บ token + tenant context
2) Topbar Switcher
   - แสดง company/branch ปัจจุบัน + dropdown สำหรับสลับ; calling `/auth/switch`
   - รีโหลดข้อมูล/invalidates cache หลังสลับ
3) HR multi-branch
   - Default: HR สลับ branch ผ่าน switcher
   - Option: เปิด “multi-branch mode” (role-based) ที่อนุญาตเลือกหลาย branch ใน filter; backend ตรวจสิทธิ์ทุก branch

## Testing Plan
- Unit test middleware: ไม่มี header -> 400/401; header ไม่ตรงสิทธิ์ -> 403; ถูกต้อง -> pass + context มี tenant
- Repo tests: verify query ถูก filter ด้วย company_id/branch_id; insert ติด tenant key
- Auth/login/switch integration: token carries tenant; refresh honors tenant; revoked/removed access handled
- E2E UI: login + select tenant + switch branch, run payroll/employee CRUD แล้วเห็นเฉพาะ tenant ตัวเอง

## Rollout Strategy
- Feature flag สำหรับ tenant enforcement
- Deploy migrations (backfill -> add constraints -> enforce)
- Gradual enable RLS/guards per module (start read paths, then write)
- Monitor access log พร้อม tenant id เพื่อ audit

## Open Decisions / Inputs Needed
- ใช้ path vs header สำหรับ tenant selection
- จะใช้ RLS หรือ rely on app-level guard เท่านั้น
- ต้องรองรับ “multi-branch mode” ในจอเดียวหรือไม่ (ถ้าใช่ ต้องมี contract API ใหม่)
- Default branch selection rule (ล่าสุด / primary)
