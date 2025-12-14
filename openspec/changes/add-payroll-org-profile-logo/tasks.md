## 1. Implementation
- [x] 1.1 สร้างตาราง payroll_org_logo (bytea + metadata + checksum) และ payroll_org_profile (daterange versioning + no overlap + auto retire)
- [x] 1.2 เพิ่มฟังก์ชัน get_effective_org_profile และ trigger payroll_run_apply_org_profile สำหรับ snapshot JSONB
- [x] 1.3 Seed โปรไฟล์เริ่มต้น + backfill payroll_run ที่มีอยู่ให้มี org_profile_id/snapshot
- [x] 1.4 เขียน spec delta สำหรับ capability payroll-org-profile (เวอร์ชัน โปรไฟล์ โลโก้ snapshot)
- [x] 1.5 เพิ่ม API สำหรับ payroll_org_profile (list/get/create) + upload logo แยก และ wire module (งด patch/upsert ใช้ insert เวอร์ชันใหม่เท่านั้น)
