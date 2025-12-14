## ADDED Requirements
### Requirement: Versioned payroll org profile for slip header
ระบบ SHALL จัดเก็บโปรไฟล์องค์กรสำหรับหัวใบสลิปเงินเดือน (company_name, address lines, phones, email, tax_id, footer_note, optional logo_id) แบบกำหนดช่วงวันที่มีผล (effective_daterange) และสถานะ active/retired โดยโปรไฟล์ active ห้ามช่วงทับซ้อน และเมื่อมีโปรไฟล์ใหม่จะปิดเวอร์ชันเก่าปลายเปิดอัตโนมัติ

#### Scenario: Select effective profile by date
- **WHEN** สร้าง payroll_run สำหรับเดือนจ่าย D
- **THEN** ระบบ SHALL เลือกโปรไฟล์ที่ effective_daterange ครอบคลุม D และถ้าวันเริ่มซ้ำกันให้ใช้เวอร์ชันล่าสุด

### Requirement: Store logo binary in database
ระบบ SHALL รองรับการอัปโหลดโลโก้และเก็บเป็น binary (bytea) พร้อม metadata (file_name, content_type, file_size limit ≤ 2MB, checksum) และให้โปรไฟล์อ้างอิงโลโก้ด้วย logo_id

#### Scenario: Store logo and link to profile
- **WHEN** ผู้ใช้บันทึกโลโก้ (ขนาดไม่เกิน 2MB) พร้อมชื่อไฟล์และ content type
- **THEN** ระบบ SHALL เก็บข้อมูล binary และ checksum และอนุญาตให้โปรไฟล์อ้างอิงโลโก้ผ่าน logo_id

### Requirement: Snapshot org profile into payroll run
ระบบ SHALL ทำ snapshot โปรไฟล์องค์กร (ฟิลด์หัวสลิป + logo_id + version/effective range) ลงคอลัมน์ JSONB ใน payroll_run ตอนสร้างงวด และ error ถ้าไม่พบโปรไฟล์ที่มีผลในวันดังกล่าว

#### Scenario: Snapshot header on payroll run insert
- **WHEN** มีการ INSERT แถว payroll_run
- **THEN** ระบบ SHALL กำหนด org_profile_id เป็นโปรไฟล์ที่เลือกได้ และเติม org_profile_snapshot JSONB (company_name, address lines, phones, email, tax_id, footer_note, logo_id, version_no, effective_start/end) เพื่อใช้ render slip
