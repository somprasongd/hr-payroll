# HR & Payroll System - End-to-End Workflow

เอกสารนี้สรุปขั้นตอนการทำงานของระบบ โดยแบ่งเป็น 5 ระยะ (Phases) ตามลำดับการใช้งานจริง

---

## Phase 1: Authentication (การเข้าสู่ระบบ)

ผู้ใช้งานทุกคนต้องผ่านขั้นตอนนี้ก่อน เพื่อรับ Access Token สำหรับเรียก API อื่นๆ

1. **Login (เข้าสู่ระบบ)**
    - **API:** `POST /auth/login`
    - **Input:** `username`, `password`
    - **Output:** `accessToken`, `refreshToken`, `user` info
    - **Flow:** User กรอกรหัสผ่าน -> Server ตรวจสอบ -> ได้ Token ไปแนบใน Header (Authorization: Bearer ...)
2. **Refresh Token (ต่ออายุ)**
    - **API:** `POST /auth/refresh`
    - **Flow:** เมื่อ Access Token หมดอายุ ให้ส่ง Refresh Token ไปขอใหม่โดยไม่ต้อง Login ซ้ำ

---

## Phase 2: Setup & Onboarding (การตั้งค่าและรับพนักงาน)

Admin หรือ HR เตรียมข้อมูลพื้นฐานและนำพนักงานเข้าสู่ระบบ

1. **Prepare Master Data (เตรียมข้อมูลอ้างอิง)**
    - **API:**
        - `GET /master/person-titles` (คำนำหน้า)
        - `GET /master/employee-types` (ประเภทพนักงาน)
        - `GET /master/id-document-types` (ประเภทบัตร)
    - **Flow:** Frontend ดึงข้อมูลเหล่านี้ไปแสดงใน Dropdown หน้าสร้างพนักงาน
2. **Create Employee (สร้างพนักงานใหม่)**
    - **API:** `POST /employees`
    - **Input:** ข้อมูลส่วนตัว, เงินเดือน (`basePayAmount`), สถานะกองทุน (`sso`, `pvd`), เลขบัญชี
    - **Flow:** บันทึกข้อมูลพนักงานลง DB -> พร้อมสำหรับการทำรายการต่างๆ
3. **Set Opening Balance (บันทึกยอดยกมา - กรณีไมเกรตระบบ)**
    - **API:** `POST /employees/{id}/accumulations`
    - **Input:** `type` (sso/tax/pf), `year`, `amount`
    - **Flow:** Admin ใส่ยอดสะสมประกันสังคม/ภาษีของปีปัจจุบัน และยอดกองทุนสำรองเลี้ยงชีพสะสม เพื่อให้คำนวณภาษีปลายปีได้ถูกต้อง

---

## Phase 3: Daily Operations (การทำงานประจำวัน/เดือน)

การบันทึกข้อมูลที่เกิดขึ้นระหว่างเดือน ก่อนที่จะถึงวันจ่ายเงินเดือน

### 3.1 Time Attendance (บันทึกเวลา)

1. **Full-Time Worklog (บันทึกขาด/ลา/มาสาย/OT)**
    - **API:** `POST /worklogs/ft`
    - **Action:** HR หรือ หัวหน้างาน บันทึกรายการผิดปกติ (Exception) เช่น "ลาป่วย", "OT 3 ชั่วโมง"
    - **Status:** เริ่มต้น `pending`
2. **Part-Time Worklog (บันทึกเวลาเข้า-ออก)**
    - **API:** `POST /worklogs/pt`
    - **Action:** บันทึกเวลา `morningIn`, `morningOut`, ฯลฯ
    - **System:** Database คำนวณ `totalHours` ให้อัตโนมัติ

### 3.2 Financial Requests (ธุรกรรมการเงิน)

1. **Salary Advance (ขอเบิกเงินล่วงหน้า)**
    - **API:** `POST /salary-advances`
    - **Input:** ยอดเงิน, วันที่รับเงิน
    - **Constraint:** วันที่เบิกต้องอยู่ในเดือนเดียวกับงวดที่จะหักคืน
    - **Status:** `pending` (รอหักใน Payroll)
2. **Create Loan (กู้ยืม/ตั้งหนี้สิน)**
    - **API:** `POST /debt-txns/loan`
    - **Input:** ยอดกู้รวม, ตารางผ่อนชำระ (`installments`)
    - **Flow:** สร้างสัญญาแม่ (`loan`) และงวดผ่อน (`installment`) ทั้งหมด
3. **Approve Loan (อนุมัติเงินกู้)**
    - **API:** `POST /debt-txns/{id}/approve`
    - **Effect:** สถานะ Loan เป็น `approved` -> Trigger สร้างยอดหนี้คงค้างใน `payroll_accumulation` -> งวดผ่อนชำระเริ่มมีผลบังคับใช้

---

## Phase 4: Pre-Payroll Adjustments (การปรับปรุงพิเศษ)

(ทำเป็นครั้งคราว หรือปีละครั้ง)

1. **Salary Raise (ปรับขึ้นเงินเดือน)**
    - **API:** `POST /salary-raise-cycles` (สร้างรอบ) -> `PATCH /salary-raise-items/{id}` (ใส่ยอดปรับ) -> `PATCH /salary-raise-cycles/{id}` (Approve)
    - **Effect:** เมื่อ Approve รอบ -> Database อัปเดต `basePayAmount` ในตาราง Employees ให้อัตโนมัติ
2. **Bonus (จ่ายโบนัส)**
    - **API:** `POST /bonus-cycles` (สร้างรอบ) -> `PATCH /bonus-items/{id}` (ใส่ยอดโบนัส) -> `PATCH /bonus-cycles/{id}` (Approve)
    - **Effect:** เมื่อ Approve รอบ -> ยอดโบนัสจะไปรอรวมใน Payroll Run ของเดือนนั้นๆ

---

## Phase 5: Payroll Processing (การทำเงินเดือน)

ขั้นตอนสุดท้ายของเดือน เพื่อประมวลผลและปิดงวด

1. **Create Payroll Run (สร้างงวดการจ่าย)**
    - **API:** `POST /payroll-runs`
    - **Input:** งวดเดือน (`payrollMonthDate`), วันจ่ายจริง (`payDate`)
    - **Behind the Scenes (Trigger):**
        - ดึงพนักงาน Active ทุกคน
        - รวมยอด `worklog_ft` (OT/สาย/ลา) เป็นตัวเงิน
        - รวมยอด `salary_advance` (pending) มาหัก
        - รวมยอด `debt_txn` (installment pending) มาหัก
        - รวมยอด `bonus` (approved) มาจ่าย
        - คำนวณ ประกันสังคม, ภาษี, กองทุนฯ
        - สร้าง `payroll_run_item` (สลิป) ให้ครบทุกคน
2. **Verify & Adjust (ตรวจสอบและแก้ไข)**
    - **API:** `GET /payroll-runs/{id}/items` (ดูภาพรวม)
    - **API:** `GET /payroll-items/{id}` (ดูรายละเอียดรายคน)
    - **API:** `PATCH /payroll-items/{id}` (แก้ไขยอด Manual)
        - *Action:* HR อาจใส่รายได้อื่นๆ (`othersIncome`) เพิ่มเติม
        - *System:* Trigger คำนวณ `netPay` (ยอดสุทธิ) ให้ใหม่ทันที
3. **Approve Payroll (อนุมัติและปิดงวด)**
    - **API:** `PATCH /payroll-runs/{id}` (ส่ง `status: "approved"`)
    - **Behind the Scenes (Automated by DB Trigger):**
        - **Worklogs:** เปลี่ยนสถานะเป็น `approved` (ล็อกห้ามแก้)
        - **Advance:** เปลี่ยนสถานะเป็น `processed` (ถือว่าใช้คืนแล้ว)
        - **Debt:** เปลี่ยนสถานะ Installment เป็น `approved` (ถือว่าจ่ายค่างวดแล้ว -> ยอดหนี้คงเหลือลดลง)
        - **Accumulation:** บวกยอด SSO, Tax, PF ของงวดนี้ เข้าไปในยอดสะสมรายปี/ยอดรวม
        - **Payroll Item:** ข้อมูลสลิปเงินเดือนถูกล็อก

---

**สิ้นสุดกระบวนการ** ข้อมูลพร้อมสำหรับออกรายงาน ภง.ด., ประกันสังคม และโอนเงินเข้าบัญชีธนาคาร