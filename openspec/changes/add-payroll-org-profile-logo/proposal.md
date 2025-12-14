# Change: Add payroll org profile and logo storage for slip header

## Why
- Slip เงินเดือนต้องมีหัวกระดาษ (ชื่อบริษัท/ที่อยู่/เบอร์/อีเมล/เลขผู้เสียภาษี/โลโก้) ที่ปรับได้ โดยไม่ต้องแก้ payroll_config ซึ่งเป็นตัวเลขคำนวณ
- ต้องการเก็บโลโก้ใน DB (bytea) ไม่พึ่ง object storage และให้ payroll_run ใช้โปรไฟล์ที่มีผลในงวดนั้นแบบเวอร์ชัน

## What Changes
- เพิ่ม schema สำหรับ payroll_org_profile (effective daterange, versioning, status) และ payroll_org_logo (ไฟล์โลโก้ binary + metadata + checksum)
- เพิ่ม trigger/ฟังก์ชันเลือกโปรไฟล์ตามวันที่งวด และ snapshot ข้อมูลหัวกระดาษลง payroll_run เป็น JSONB
- เติม seed โปรไฟล์เริ่มต้น และ backfill payroll_run ที่มีอยู่ให้มี snapshot

## Impact
- Specs: payroll-org-profile
- DB: ตารางใหม่ payroll_org_profile, payroll_org_logo; คอลัมน์/trigger ใหม่ใน payroll_run
- Service: การสร้าง payroll_run ต้องเลือกโปรไฟล์และเติม snapshot เพื่อใช้ render slip
