# HR Management System - API Specification

Version: 1.1.0 (Revised Schema UUIDv7)

Base URL: <https://api.hrmsystem.com/v1>

Content-Type: application/json

## 1. General Standards

### 1.1 Security & Data Types

- **Transport:** HTTPS เท่านั้น
- **Authentication:** `Bearer <Access Token>` (JWT)
- **ID Format:** ใช้ **UUID v7** เป็น Primary Key (`id`) สำหรับทุก Resource แทน integer และ public_id เดิม
- **Date-only Fields:** ช่องที่เป็นวันที่อย่างเดียวส่งและรับเป็น String รูปแบบ `YYYY-MM-DD` (ไม่พ่วงเวลา)

### 1.2 Error Response Format (RFC 7807)

เมื่อเกิด Error ระบบจะคืนค่า HTTP Status Code พร้อม Body ในรูปแบบ `application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Invalid Request",
  "status": 400,
  "detail": "Username is required.",
  "instance": "/auth/login"
}
```

---

### 1.3 Pagination Defaults

- `page` เริ่มต้นที่ 1 ถ้าไม่ส่ง หรือส่งค่าน้อยกว่า 1 ระบบจะรีเซ็ตเป็น 1
- `limit` เริ่มต้นที่ 20 ถ้าไม่ส่ง หรือส่งค่าน้อยกว่าหรือเท่ากับ 0 ระบบจะรีเซ็ตเป็น 20
- `limit` สูงสุด 1000 ถ้าส่งมากกว่า 1000 ระบบจะบังคับใช้ 1000

---

## 2. Authentication & Authorization

### 2.1 Login

เข้าสู่ระบบเพื่อรับ Access Token และ Refresh Token

- **Endpoint:** `POST /auth/login`
- **Access:** Public

**Request Body Example:**

```json
{
  "username": "admin",
  "password": "SecretPassword123!"
}
```

**Request Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)**     | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | ------------------------------ | ----------------- | ------------ | ---------------------- |
| `username`      | ชื่อผู้ใช้งานสำหรับเข้าสู่ระบบ | String            | **Yes**      | `"admin"`              |
| `password`      | รหัสผ่าน                       | String            | **Yes**      | `"SecretPassword123!"` |

**Success Response Example (200 OK):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1Ni...",
  "refreshToken": "d9b9d...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "019347e8-94ca-7d69-9f3a-1c3d4e5f6789",
    "username": "admin",
    "role": "admin"
  }
}
```

**Response Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)**         | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | ---------------------------------- | ----------------- | ------------ | ---------------------- |
| `accessToken`   | JWT Token สำหรับใช้เรียก API อื่นๆ | String            | **Yes**      | `"eyJhbGci..."`        |
| `refreshToken`  | Token สำหรับขอ Access Token ใหม่   | String            | **Yes**      | `"d9b9d..."`           |
| `tokenType`     | ประเภทของ Token (ปกติคือ Bearer)   | String            | **Yes**      | `"Bearer"`             |
| `expiresIn`     | อายุของ Access Token (วินาที)      | Integer           | **Yes**      | `900`                  |
| `user`          | ข้อมูลย่อของผู้ใช้งาน              | Object            | **Yes**      | `{...}`                |
| `user.id`       | รหัสประจำตัวผู้ใช้งาน (UUIDv7)     | UUID              | **Yes**      | `"019347e8-..."`       |
| `user.username` | ชื่อผู้ใช้งาน                      | String            | **Yes**      | `"admin"`              |
| `user.role`     | สิทธิ์การใช้งาน (`admin`, `hr`)    | Enum              | **Yes**      | `"admin"`              |

**Error Responses:**

| **HTTP Status** | **Title**    | **Description/Reason**                                  |
| --------------- | ------------ | ------------------------------------------------------- |
| **400**         | Bad Request  | ข้อมูลใน Request Body ไม่ครบถ้วน หรือ JSON ผิด format   |
| **401**         | Unauthorized | Username หรือ Password ไม่ถูกต้อง (Invalid credentials) |

---

### 2.2 Refresh Token

ขอ Access Token ใหม่เมื่อ Token เดิมหมดอายุ

- **Endpoint:** `POST /auth/refresh`
- **Access:** Public (ต้องมี Valid Refresh Token)

**Request Body Example:**

```json
{
  "refreshToken": "d9b9d..."
}
```

**Request Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)**                      | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | ----------------------------------------------- | ----------------- | ------------ | ---------------------- |
| `refreshToken`  | Refresh Token ที่ได้รับจากการ Login ครั้งล่าสุด | String            | **Yes**      | `"d9b9d..."`           |

**Success Response Example (200 OK):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1Ni...",
  "refreshToken": "new_refresh_token_xyz...",
  "expiresIn": 900
}
```

**Response Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)**       | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | -------------------------------- | ----------------- | ------------ | ---------------------- |
| `accessToken`   | Access Token ชุดใหม่             | String            | **Yes**      | `"eyJhbGci..."`        |
| `refreshToken`  | Refresh Token ชุดใหม่ (Rotation) | String            | **Yes**      | `"new_refresh..."`     |
| `expiresIn`     | อายุของ Token (วินาที)           | Integer           | **Yes**      | `900`                  |

**Error Responses:**

| **HTTP Status** | **Title**    | **Description/Reason**                           |
| --------------- | ------------ | ------------------------------------------------ |
| **400**         | Bad Request  | ไม่ได้ส่ง `refreshToken` มาใน Body               |
| **401**         | Unauthorized | Token ไม่ถูกต้อง, หมดอายุ, หรือถูก Revoke ไปแล้ว |

---

### 2.3 Logout (Revoke Token)

ออกจากระบบโดยการยกเลิก Refresh Token

- **Endpoint:** `POST /auth/logout`
- **Access:** Authenticated

**Request Body Example:**

```json
{
  "refreshToken": "d9b9d..."
}
```

**Request Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)**      | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | ------------------------------- | ----------------- | ------------ | ---------------------- |
| `refreshToken`  | Token ที่ต้องการยกเลิก (Revoke) | String            | **Yes**      | `"d9b9d..."`           |

**Success Response:**

- **Status:** `204 No Content`
- **Body:** Empty

**Error Responses:**

| **HTTP Status** | **Title**    | **Description/Reason**                     |
| --------------- | ------------ | ------------------------------------------ |
| **400**         | Bad Request  | ไม่ระบุ `refreshToken`                     |
| **401**         | Unauthorized | Access Token สำหรับเรียก API นี้ไม่ถูกต้อง |

---

## 3. User Management (Admin Only)

### 3.1 List Users

ดึงรายชื่อผู้ใช้งานทั้งหมดพร้อม Pagination

- **Endpoint:** `GET /admin/users`
- **Access:** Admin
- **Query Parameters:** `page`, `limit`, `role`

**Success Response Example (200 OK):**

```json
{
  "data": [
    {
      "id": "019347e8-94ca-7d69-9f3a-1c3d4e5f6789",
      "username": "hr01",
      "role": "hr",
      "createdAt": "2025-11-20T10:00:00Z",
      "lastLoginAt": "2025-11-20T12:30:00Z"
    }
  ],
  "meta": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100
  }
}
```

**Response Fields:**

| **ชื่อ (Name)**      | **คำอธิบาย (Description)**                 | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| -------------------- | ------------------------------------------ | ----------------- | ------------ | ---------------------- |
| `data`               | Array ของข้อมูลผู้ใช้งาน                   | Array             | **Yes**      | `[...]`                |
| `data[].id`          | รหัสผู้ใช้งาน (UUIDv7)                     | UUID              | **Yes**      | `"019347e8..."`        |
| `data[].username`    | ชื่อผู้ใช้งาน                              | String            | **Yes**      | `"hr01"`               |
| `data[].role`        | สิทธิ์ (`hr`, `admin`)                     | Enum              | **Yes**      | `"hr"`                 |
| `data[].createdAt`   | เวลาที่สร้างบัญชี (ISO 8601)               | String            | **Yes**      | `"2025-11-20..."`      |
| `data[].lastLoginAt` | เวลาเข้าสู่ระบบล่าสุด (Null ถ้าไม่เคยเข้า) | String            | No           | `"2025-11-20..."`      |
| `meta`               | ข้อมูลสำหรับการแบ่งหน้า (Pagination)       | Object            | **Yes**      | `{...}`                |
| `meta.currentPage`   | หน้าปัจจุบัน                               | Integer           | **Yes**      | `1`                    |
| `meta.totalPages`    | จำนวนหน้าทั้งหมด                           | Integer           | **Yes**      | `5`                    |
| `meta.totalItems`    | จำนวนรายการทั้งหมด                         | Integer           | **Yes**      | `100`                  |

**Error Responses:**

| **HTTP Status** | **Title**    | **Description/Reason**             |
| --------------- | ------------ | ---------------------------------- |
| **401**         | Unauthorized | ไม่ได้แนบ Token หรือ Token หมดอายุ |
| **403**         | Forbidden    | ผู้เรียกไม่ใช่ Role `admin`        |

---

### 3.2 Create User

สร้างผู้ใช้งานใหม่ (Admin Only)

- **Endpoint:** `POST /admin/users`
- **Access:** Admin

**Request Body Example:**

```json
{
  "username": "new_hr",
  "password": "InitialPassword123",
  "role": "hr"
}
```

**Request Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)**                | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | ----------------------------------------- | ----------------- | ------------ | ---------------------- |
| `username`      | ชื่อผู้ใช้งาน (ต้องไม่ซ้ำ)                | String            | **Yes**      | `"new_hr"`             |
| `password`      | รหัสผ่านเริ่มต้น (ควรมีความยาวตาม Policy) | String            | **Yes**      | `"InitialPassword123"` |
| `role`          | สิทธิ์การใช้งาน (`hr`, `admin`)           | Enum              | **Yes**      | `"hr"`                 |

**Success Response Example (201 Created):**

```json
{
  "id": "019347f1-abcd-7ef0-1234-567890abcdef",
  "username": "new_hr",
  "role": "hr",
  "createdAt": "2025-11-20T14:00:00Z"
}
```

**Response Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)**         | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | ---------------------------------- | ----------------- | ------------ | ---------------------- |
| `id`            | รหัสผู้ใช้งานที่สร้างใหม่ (UUIDv7) | UUID              | **Yes**      | `"019347f1..."`        |
| `username`      | ชื่อผู้ใช้งาน                      | String            | **Yes**      | `"new_hr"`             |
| `role`          | สิทธิ์ที่กำหนดให้                  | Enum              | **Yes**      | `"hr"`                 |
| `createdAt`     | เวลาที่สร้างสำเร็จ                 | String            | **Yes**      | `"2025-11-20..."`      |

**Error Responses:**

| **HTTP Status** | **Title**   | **Description/Reason**                                  |
| --------------- | ----------- | ------------------------------------------------------- |
| **400**         | Bad Request | Password ไม่ผ่านเงื่อนไขความปลอดภัย หรือส่งข้อมูลไม่ครบ |
| **403**         | Forbidden   | ผู้เรียกไม่ใช่ Role `admin`                             |
| **409**         | Conflict    | `username` นี้มีอยู่ในระบบแล้ว                          |

---

### 3.3 Get User Detail

ดูข้อมูลผู้ใช้งานรายบุคคล

- **Endpoint:** `GET /admin/users/{id}`
- **Access:** Admin
- **Params:** `id` (UUIDv7)

**Success Response Example (200 OK):**

```json
{
  "id": "019347e8-94ca-7d69-9f3a-1c3d4e5f6789",
  "username": "hr01",
  "role": "hr",
  "createdAt": "2025-11-20T10:00:00Z"
}
```

**Response Fields:** ดูที่ 3.2 Create User

**Error Responses:**

| **HTTP Status** | **Title**   | **Description/Reason**            |
| --------------- | ----------- | --------------------------------- |
| **400**         | Bad Request | `id` ไม่ใช่รูปแบบ UUID ที่ถูกต้อง |
| **403**         | Forbidden   | ผู้เรียกไม่ใช่ Role `admin`       |
| **404**         | Not Found   | ไม่พบข้อมูล User จาก ID ที่ระบุ   |

---

### 3.4 Update User (Role Only)

แก้ไข Role ของผู้ใช้งาน

- **Endpoint:** `PATCH /admin/users/{id}`
- **Access:** Admin
- **Params:** `id` (UUIDv7)

**Request Body Example:**

```json
{
  "role": "admin"
}
```

**Request Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)**                  | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | ------------------------------------------- | ----------------- | ------------ | ---------------------- |
| `role`          | สิทธิ์ใหม่ที่ต้องการตั้งค่า (`hr`, `admin`) | Enum              | **Yes**      | `"admin"`              |

**Success Response Example (200 OK):**

- คืนค่า JSON Object ของ User (เหมือน Get User Detail) ที่อัปเดตค่าแล้ว

**Error Responses:**

| **HTTP Status** | **Title**   | **Description/Reason**        |
| --------------- | ----------- | ----------------------------- |
| **400**         | Bad Request | ค่า `role` ไม่ถูกต้องตาม Enum |
| **404**         | Not Found   | ไม่พบข้อมูล User              |

---

### 3.5 Admin Reset Password

Admin ทำการตั้งรหัสผ่านใหม่ให้ User (Force Change)

- **Endpoint:** `POST /admin/users/{id}/password-reset`
- **Access:** Admin
- **Params:** `id` (UUIDv7)

**Request Body Example:**

```json
{
  "newPassword": "NewStrongPassword123!"
}
```

**Request Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)**     | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | ------------------------------ | ----------------- | ------------ | ---------------------- |
| `newPassword`   | รหัสผ่านใหม่ที่ Admin กำหนดให้ | String            | **Yes**      | `"NewStrong..."`       |

**Success Response Example (200 OK):**

```json
{
  "message": "Password has been reset successfully."
}
```

**Response Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)** | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | -------------------------- | ----------------- | ------------ | ---------------------- |
| `message`       | ข้อความยืนยันผลการทำงาน    | String            | **Yes**      | `"Password has..."`    |

**Error Responses:**

| **HTTP Status** | **Title**            | **Description/Reason**                                  |
| --------------- | -------------------- | ------------------------------------------------------- |
| **404**         | Not Found            | ไม่พบข้อมูล User                                        |
| **422**         | Unprocessable Entity | Password ใหม่ไม่ผ่านเงื่อนไขความปลอดภัย (Weak password) |

---

### 3.6 Delete User (Soft Delete)

ลบผู้ใช้งาน (Soft Delete: update `deleted_at`)

- **Endpoint:** `DELETE /admin/users/{id}`
- **Access:** Admin
- **Params:** `id` (UUIDv7)

**Success Response:**

- **Status:** `204 No Content`
- **Body:** Empty

**Error Responses:**

| **HTTP Status** | **Title**   | **Description/Reason**                   |
| --------------- | ----------- | ---------------------------------------- |
| **400**         | Bad Request | `id` ไม่ใช่รูปแบบ UUID ที่ถูกต้อง        |
| **403**         | Forbidden   | ผู้เรียกไม่ใช่ Role `admin`              |
| **404**         | Not Found   | ไม่พบข้อมูล User (หรือ User ถูกลบไปแล้ว) |

---

## 4. User Profile (Self Service)

### 4.1 Change Own Password

User เปลี่ยนรหัสผ่านด้วยตนเอง

- **Endpoint:** `PUT /me/password`
- **Access:** Authenticated (Any Role)

**Request Body Example:**

```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewSecurePassword456!"
}
```

**Request Fields:**

| **ชื่อ (Name)**   | **คำอธิบาย (Description)**      | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| ----------------- | ------------------------------- | ----------------- | ------------ | ---------------------- |
| `currentPassword` | รหัสผ่านเดิม (เพื่อยืนยันตัวตน) | String            | **Yes**      | `"OldPassword123"`     |
| `newPassword`     | รหัสผ่านใหม่ที่ต้องการตั้ง      | String            | **Yes**      | `"NewSecure..."`       |

**Success Response Example (200 OK):**

```json
{
  "message": "Password changed successfully."
}
```

**Response Fields:** ดูที่ 3.5 Admin Reset Password

**Error Responses:**

| **HTTP Status** | **Title**            | **Description/Reason**                    |
| --------------- | -------------------- | ----------------------------------------- |
| **400**         | Bad Request          | `currentPassword` ไม่ถูกต้อง              |
| **422**         | Unprocessable Entity | `newPassword` เหมือนเดิม หรือไม่ปลอดภัยพอ |

---

### 4.2 Get My Profile

ดูข้อมูลของตนเอง (จากการถอดรหัส Token หรือ Query จาก DB โดยใช้ ID ใน Token)

- **Endpoint:** `GET /me`
- **Access:** Authenticated

**Success Response Example (200 OK):**

```json
{
  "id": "019347e8-94ca-7d69-9f3a-1c3d4e5f6789",
  "username": "myself",
  "role": "hr",
  "lastLoginAt": "2025-11-20T10:00:00Z"
}
```

**Response Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)**     | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | ------------------------------ | ----------------- | ------------ | ---------------------- |
| `id`            | รหัสประจำตัวผู้ใช้งาน (UUIDv7) | UUID              | **Yes**      | `"019347e8..."`        |
| `username`      | ชื่อผู้ใช้งาน                  | String            | **Yes**      | `"myself"`             |
| `role`          | สิทธิ์การใช้งาน                | Enum              | **Yes**      | `"hr"`                 |
| `lastLoginAt`   | เวลาเข้าสู่ระบบล่าสุด          | String            | No           | `"2025-11-20..."`      |

**Error Responses:**

| **HTTP Status** | **Title**    | **Description/Reason**                                 |
| --------------- | ------------ | ------------------------------------------------------ |
| **401**         | Unauthorized | Token หมดอายุ หรือไม่ถูกต้อง                           |
| **500**         | Server Error | ไม่พบข้อมูล User ในฐานข้อมูล (กรณี Data Inconsistency) |

---

## 5. Payroll Configuration (Admin Only)

กลุ่ม API สำหรับจัดการค่าคงที่ในการคำนวณเงินเดือน (เช่น ค่าแรงขั้นต่ำ, ประกันสังคม) ซึ่งมีการเก็บประวัติการเปลี่ยนแปลงตามช่วงเวลา

### 5.1 List Configurations (Full History)

ดึงประวัติการตั้งค่าทั้งหมดอย่างละเอียด (ครบทุก Field)

- **Endpoint:** `GET /admin/payroll-configs`
- **Access:** Admin
- **Query Parameters:** `page`, `limit`

**Success Response Example (200 OK):**

```json
{
  "data": [
    {
      "id": "019347f5-1234-7d69-9f3a-1c3d4e5f9999",
      "versionNo": 2,
      "startDate": "2026-01-01",
      "endDate": null,
      "status": "active",
      "hourlyRate": 400.0,
      "otHourlyRate": 600.0,
      "attendanceBonusNoLate": 500.0,
      "attendanceBonusNoLeave": 1000.0,
      "housingAllowance": 1000.0,
      "waterRatePerUnit": 10.0,
      "electricityRatePerUnit": 7.0,
      "internetFeeMonthly": 100.0,
      "socialSecurityRateEmployee": 0.05,
      "socialSecurityRateEmployer": 0.05,
      "note": "ปรับขึ้นค่าแรงและสวัสดิการประจำปี 2026",
      "createdAt": "2025-11-20T15:00:00Z",
      "updatedAt": "2025-11-20T15:00:00Z"
    },
    {
      "id": "019347e8-5555-7d69-9f3a-1c3d4e5f8888",
      "versionNo": 1,
      "startDate": "2025-01-01",
      "endDate": "2026-01-01",
      "status": "retired",
      "hourlyRate": 350.0,
      "otHourlyRate": 525.0,
      "attendanceBonusNoLate": 500.0,
      "attendanceBonusNoLeave": 1000.0,
      "housingAllowance": 1000.0,
      "waterRatePerUnit": 8.0,
      "electricityRatePerUnit": 6.0,
      "internetFeeMonthly": 80.0,
      "socialSecurityRateEmployee": 0.05,
      "socialSecurityRateEmployer": 0.05,
      "note": "Initial Config",
      "createdAt": "2025-01-01T09:00:00Z",
      "updatedAt": "2025-11-20T15:00:00Z"
    }
  ],
  "meta": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 2
  }
}
```

**Response Fields (Full):**

| **ชื่อ (Name)**                     | **คำอธิบาย (Description)**                    | **ประเภท (Type)**   | **Required** | **ตัวอย่าง (Example)** |
| ----------------------------------- | --------------------------------------------- | ------------------- | ------------ | ---------------------- |
| `data[].id`                         | รหัส Config (UUIDv7)                          | UUID                | **Yes**      | `"019347f5..."`        |
| `data[].versionNo`                  | เลขเวอร์ชัน (Running Number)                  | Integer             | **Yes**      | `2`                    |
| `data[].startDate`                  | วันที่มีผลบังคับใช้ (จาก effective_daterange) | String (YYYY-MM-DD) | **Yes**      | `"2026-01-01"`         |
| `data[].endDate`                    | วันที่สิ้นสุด (Null = infinity)               | String (YYYY-MM-DD) | No           | `null`                 |
| `data[].status`                     | สถานะ (`active`, `retired`)                   | Enum                | **Yes**      | `"active"`             |
| `data[].hourlyRate`                 | ค่าแรงรายชั่วโมง (Part-time)                  | Number              | **Yes**      | `400.00`               |
| `data[].otHourlyRate`               | ค่า OT ต่อชั่วโมง                             | Number              | **Yes**      | `600.00`               |
| `data[].attendanceBonusNoLate`      | เบี้ยขยัน (ไม่สาย)                            | Number              | **Yes**      | `500.00`               |
| `data[].attendanceBonusNoLeave`     | เบี้ยขยัน (ไม่ลา)                             | Number              | **Yes**      | `1000.00`              |
| `data[].housingAllowance`           | ค่าเช่าบ้าน                                   | Number              | **Yes**      | `1000.00`              |
| `data[].waterRatePerUnit`           | ค่าน้ำ (บาท/หน่วย)                            | Number              | **Yes**      | `10.00`                |
| `data[].electricityRatePerUnit`     | ค่าไฟ (บาท/หน่วย)                             | Number              | **Yes**      | `7.00`                 |
| `data[].internetFeeMonthly`         | ค่าอินเทอร์เน็ต (รายเดือน)                    | Number              | **Yes**      | `100.00`               |
| `data[].socialSecurityRateEmployee` | อัตราหักประกันสังคมลูกจ้าง (ทศนิยม)           | Number              | **Yes**      | `0.05`                 |
| `data[].socialSecurityRateEmployer` | อัตราสมทบประกันสังคมนายจ้าง (ทศนิยม)          | Number              | **Yes**      | `0.05`                 |
| `data[].note`                       | หมายเหตุ                                      | String              | No           | `"..."`                |
| `data[].createdAt`                  | เวลาที่สร้าง                                  | String              | **Yes**      | `"2025..."`            |
| `data[].updatedAt`                  | เวลาแก้ไขล่าสุด                               | String              | **Yes**      | `"2025..."`            |

หมายเหตุ:

สาเหตุที่แตก effective_daterange (Postgres Type) ออกเป็น startDate และ endDate ใน JSON ก็เพื่อให้ Frontend นำไปแสดงผลได้ง่าย ไม่ต้องมานั่ง Parse String [2025-01-01, 2026-01-01) เอง

**Error Responses:**

| **HTTP Status** | **Title** | **Description/Reason**       |
| --------------- | --------- | ---------------------------- |
| **403**         | Forbidden | ผู้ใช้งานไม่ใช่ Role `admin` |

---

### 5.2 Get Effective Config

ดึงค่า Config ที่มีผลใช้งาน ณ วันที่ระบุ (ใช้สำหรับดูว่าวันนี้ หรือเดือนหน้าจะใช้เรทไหน)

- **Endpoint:** `GET /admin/payroll-configs/effective`
- **Access:** Admin
- **Query Parameters:** `date` (YYYY-MM-DD, default = today)

**Success Response Example (200 OK):**

```json
{
  "id": "019347f5-1234-7d69-9f3a-1c3d4e5f9999",
  "versionNo": 2,
  "startDate": "2026-01-01",
  "status": "active",
  "hourlyRate": 400.0,
  "otHourlyRate": 600.0,
  "attendanceBonusNoLate": 500.0,
  "attendanceBonusNoLeave": 1000.0,
  "housingAllowance": 1000.0,
  "waterRatePerUnit": 10.0,
  "electricityRatePerUnit": 6.0,
  "internetFeeMonthly": 80.0,
  "socialSecurityRateEmployee": 0.05,
  "socialSecurityRateEmployer": 0.05,
  "note": "ปรับขึ้นค่าแรงประจำปี 2026"
}
```

**Error Responses:**

| **HTTP Status** | **Title** | **Description/Reason**        |
| --------------- | --------- | ----------------------------- |
| **404**         | Not Found | ไม่พบ Config สำหรับวันที่ระบุ |

---

### 5.3 Create New Configuration (Adjust Rates)

ใช้สำหรับทั้งการ **"ปรับขึ้นอัตราใหม่"** และ **"แก้ไขข้อมูลเดิม"** (ระบบจะปิดรอบ Config เก่าให้อัตโนมัติตาม Trigger)

- **Endpoint:** `POST /admin/payroll-configs`
- **Access:** Admin

**Logic การทำงาน:**
Frontend จะต้องทำงานแบบ "Clone & Edit":

1. ดึงข้อมูลชุดล่าสุดมาโชว์ใน Form
2. User แก้ไขค่าใน Form (เช่น แก้ตัวเลขที่ผิด หรือแก้ Note)
3. กดบันทึก -> Frontend ส่งเป็น `POST` สร้างรายการใหม่
4. **Database Trigger:** จะตรวจสอบวันที่ `startDate`
   - ถ้าเป็นวันที่ในอนาคต: ข้อมูลเก่าจะถูกตัดจบเมื่อถึงวันนั้น
   - ถ้าเป็นวันที่ _เดิม_ (แก้ข้อมูลวันเดิม): ข้อมูลเก่าจะถูก Retire ทันที และข้อมูลใหม่จะขึ้นมาแทนที่ (เสมือนการแก้ไข แต่จริงๆ คือสร้างเวอร์ชันใหม่ทับ)

**Request Body Example:**

```json
{
  "startDate": "2026-01-01",
  "hourlyRate": 420.0,
  "otHourlyRate": 630.0,
  "attendanceBonusNoLate": 500.0,
  "attendanceBonusNoLeave": 1000.0,
  "housingAllowance": 1000.0,
  "waterRatePerUnit": 10.0,
  "electricityRatePerUnit": 7.0,
  "internetFeeMonthly": 100.0,
  "socialSecurityRateEmployee": 0.05,
  "socialSecurityRateEmployer": 0.05,
  "note": "ปรับค่าไฟและเน็ตตามจริง"
}
```

**Request Fields:**

| **ชื่อ (Name)**              | **คำอธิบาย (Description)**    | **ประเภท (Type)**   | **Required** | **ตัวอย่าง (Example)** |
| ---------------------------- | ----------------------------- | ------------------- | ------------ | ---------------------- |
| `startDate`                  | วันที่เริ่มมีผลบังคับใช้      | String (YYYY-MM-DD) | **Yes**      | `"2026-01-01"`         |
| `hourlyRate`                 | ค่าจ้างรายชั่วโมง (Part-time) | Number              | **Yes**      | `420.00`               |
| `otHourlyRate`               | ค่าโอทีต่อชั่วโมง             | Number              | **Yes**      | `630.00`               |
| `attendanceBonusNoLate`      | เบี้ยขยัน (ไม่สาย)            | Number              | **Yes**      | `500.00`               |
| `attendanceBonusNoLeave`     | เบี้ยขยัน (ไม่ลา)             | Number              | **Yes**      | `1000.00`              |
| `housingAllowance`           | ค่าเช่าบ้าน                   | Number              | **Yes**      | `1000.00`              |
| `waterRatePerUnit`           | ค่าน้ำ (บาท/หน่วย)            | Number              | **Yes**      | `10.00`                |
| `electricityRatePerUnit`     | ค่าไฟ (บาท/หน่วย)             | Number              | **Yes**      | `7.00`                 |
| `internetFeeMonthly`         | ค่าเน็ต (รายเดือน)            | Number              | **Yes**      | `100.00`               |
| `socialSecurityRateEmployee` | ประกันสังคมลูกจ้าง (0-1)      | Number              | **Yes**      | `0.05`                 |
| `socialSecurityRateEmployer` | ประกันสังคมนายจ้าง (0-1)      | Number              | **Yes**      | `0.05`                 |
| `note`                       | หมายเหตุการปรับปรุง           | String              | No           | `"..."`                |

**Success Response Example (201 Created):**

```json
{
  "id": "019348a1-bbbb-7d69-9f3a-1c3d4e5faaaa",
  "versionNo": 3,
  "startDate": "2026-01-01",
  "status": "active",
  "createdAt": "2025-11-20T15:00:00Z"
}
```

**Response Fields:**

| **ชื่อ (Name)** | **คำอธิบาย (Description)**  | **ประเภท (Type)** | **Required** | **ตัวอย่าง (Example)** |
| --------------- | --------------------------- | ----------------- | ------------ | ---------------------- |
| `id`            | รหัสรายการใหม่              | UUID              | **Yes**      | `"019348a1..."`        |
| `versionNo`     | เลขเวอร์ชันที่รันต่อจากเดิม | Integer           | **Yes**      | `3`                    |
| `status`        | สถานะ (จะเป็น active เสมอ)  | Enum              | **Yes**      | `"active"`             |

**Error Responses:**

| **HTTP Status** | **Title**   | **Description/Reason**                                           |
| --------------- | ----------- | ---------------------------------------------------------------- |
| **400**         | Bad Request | วันที่ `startDate` ย้อนหลังเกินไป หรือข้อมูลตัวเลขไม่ถูกต้อง     |
| **409**         | Conflict    | มี Config Active ในช่วงเวลาเดียวกันอยู่แล้ว (Database Exclusion) |

---

## 6. Employee Management

กลุ่ม API สำหรับจัดการทะเบียนประวัติพนักงาน

**Access Control:**

- **Admin / HR:** ทำได้ทุกอย่าง (Create, Read, Update, Delete)
- **HR:** ทำได้เพียง เพิ่ม (Create), อ่าน (Read), และ แก้ไข (Update) **ไม่สามารถลบได้**

### 6.1 List Employees

ค้นหาและดึงรายชื่อพนักงาน

- **Endpoint:** `GET /employees`
- **Access:** Admin, HR
- **Query Parameters:**
  - `page`: (int) หน้าที่ต้องการ (default: 1)
  - `limit`: (int) จำนวนต่อหน้า (default: 20, max: 1000)
  - `search`: (string) ค้นหาจาก ชื่อ, นามสกุล, รหัสพนักงาน
  - `status`: (string) `active` (ทำงานอยู่), `terminated` (ออกแล้ว), `all` (ทั้งหมด) - _Default: active_
  - `employeeTypeId`: (UUID) รหัสประเภทพนักงาน (เช่น ประจำ/พาร์ทไทม์) ถ้าส่งมาจะกรองให้เฉพาะประเภทนั้น

**Success Response Example (200 OK):**

```json
{
  "data": [
    {
      "id": "019aa095-7c43-7388-be88-f24681d5a3f3",
      "employeeNumber": "EMP-001",
      "fullNameTh": "นายสมชาย ศรีสุข",
      "employeeTypeName": "ประจำ",
      "phone": "0812345678",
      "email": "somchai@example.com",
      "employmentStartDate": "2024-06-01",
      "status": "active"
    }
  ],
  "meta": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50
  }
}
```

---

### 6.2 Get Employee Detail

ดึงข้อมูลพนักงานรายบุคคล (รวมข้อมูลเงินเดือนและสวัสดิการ)

- **Endpoint:** `GET /employees/{id}`
- **Access:** Admin, HR
- **Params:** `id` (UUIDv7)

**Success Response Example (200 OK):**

```json
{
  "id": "019aa095-7c43-7388-be88-f24681d5a3f3",
  "employeeNumber": "EMP-001",
  "titleId": "019aa095-7c42-7f6a-afcb-489e6689e22d",
  "firstName": "สมชาย",
  "lastName": "ศรีสุข",
  "idDocumentTypeId": "019aa095-7c43-71dc-9955-eca529c5cc4e",
  "idDocumentNumber": "1103701234567",
  "phone": "0812345678",
  "email": "somchai@example.com",
  "employeeTypeId": "019aa095-7c43-7388-be88-f24681d5a3f3",
  "basePayAmount": 30500.0,
  "employmentStartDate": "2024-06-01",
  "employmentEndDate": null,
  "bankName": "KBank",
  "bankAccountNo": "123-4-56789-0",
  "ssoContribute": true,
  "ssoDeclaredWage": 15000.0,
  "providentFundContribute": true,
  "providentFundRateEmployee": 0.03,
  "providentFundRateEmployer": 0.03,
  "withholdTax": true,
  "allowHousing": true,
  "allowWater": false,
  "allowElectric": false,
  "allowInternet": true,
  "allowDoctorFee": true,
  "createdAt": "2025-11-20T10:00:00Z",
  "updatedAt": "2025-11-21T12:00:00Z"
}
```

**Response Body Fields Description**

| **ชื่อฟิลด์ (Field Name)**  | **ประเภท (Type)** | **ตัวอย่าง (Example)**  | **คำอธิบาย (Description)**                                         |
| --------------------------- | ----------------- | ----------------------- | ------------------------------------------------------------------ |
| `id`                        | UUID              | `"019aa095-..."`        | รหัสอ้างอิงพนักงาน (Primary Key แบบ UUIDv7)                        |
| `employeeNumber`            | String            | `"EMP-001"`             | รหัสพนักงาน (ที่ HR กำหนด)                                         |
| `titleId`                   | UUID              | `"019aa..."`            | รหัสคำนำหน้าชื่อ (FK เชื่อมตาราง `person_title`)                   |
| `firstName`                 | String            | `"สมชาย"`               | ชื่อจริง (ภาษาไทย/อังกฤษ ตามที่เก็บ)                               |
| `lastName`                  | String            | `"ศรีสุข"`              | นามสกุล                                                            |
| `idDocumentTypeId`          | UUID              | `"019aa..."`            | รหัสประเภทบัตรยืนยันตัวตน (FK เชื่อม `id_document_type`)           |
| `idDocumentNumber`          | String            | `"1103701234567"`       | เลขที่บัตรประชาชน หรือเลขที่พาสปอร์ต                               |
| `phone`                     | String            | `"0812345678"`          | เบอร์โทรศัพท์ติดต่อ (อาจเป็น null)                                 |
| `email`                     | String            | `"somchai@example.com"` | อีเมล (อาจเป็น null)                                               |
| `employeeTypeId`            | UUID              | `"019aa..."`            | รหัสประเภทพนักงาน (FK เชื่อม `employee_type` เช่น ประจำ/พาร์ทไทม์) |
| `basePayAmount`             | Number            | `30500.00`              | ฐานเงินเดือน (พนักงานประจำ) หรือค่าแรงต่อชั่วโมง (พาร์ทไทม์)       |
| `employmentStartDate`       | String (Date)     | `"2024-06-01"`          | วันที่เริ่มงาน (Format: YYYY-MM-DD)                                |
| `employmentEndDate`         | String (Date)     | `null`                  | วันที่สิ้นสุดงาน/ลาออก (เป็น `null` ถ้ายังทำงานอยู่)               |
| `bankName`                  | String            | `"KBank"`               | ชื่อธนาคารเจ้าของบัญชี (อาจเป็น null)                              |
| `bankAccountNo`             | String            | `"123-4-56789-0"`       | เลขที่บัญชีธนาคาร (อาจเป็น null)                                   |
| `ssoContribute`             | Boolean           | `true`                  | สถานะการหักเงินสมทบประกันสังคม (`true` = หัก)                      |
| `ssoDeclaredWage`           | Number            | `15000.00`              | ฐานเงินเดือนสำหรับคำนวณประกันสังคม (สูงสุด 15,000)                 |
| `providentFundContribute`   | Boolean           | `true`                  | สถานะการหักกองทุนสำรองเลี้ยงชีพ (PVD)                              |
| `providentFundRateEmployee` | Number            | `0.03`                  | อัตราสะสมส่วนของลูกจ้าง (ทศนิยม: 0.03 = 3%)                        |
| `providentFundRateEmployer` | Number            | `0.03`                  | อัตราสมทบส่วนของนายจ้าง (ทศนิยม: 0.03 = 3%)                        |
| `withholdTax`               | Boolean           | `true`                  | สถานะการหักภาษี ณ ที่จ่าย (`true` = คำนวณภาษี)                     |
| `allowHousing`              | Boolean           | `true`                  | สิทธิ์ได้รับค่าเช่าบ้าน                                            |
| `allowWater`                | Boolean           | `false`                 | สิทธิ์ได้รับค่าน้ำ                                                 |
| `allowElectric`             | Boolean           | `false`                 | สิทธิ์ได้รับค่าไฟ                                                  |
| `allowInternet`             | Boolean           | `true`                  | สิทธิ์ได้รับค่าอินเทอร์เน็ต                                        |
| `allowDoctorFee`            | Boolean           | `true`                  | สิทธิ์ได้รับค่าเวร/ค่าใบประกอบวิชาชีพ (มาจาก `allow_df` ใน DB)     |
| `createdAt`                 | String (ISO)      | `"2025-11-20T..."`      | วันเวลาที่สร้างข้อมูล                                              |
| `updatedAt`                 | String (ISO)      | `"2025-11-21T..."`      | วันเวลาที่แก้ไขข้อมูลล่าสุด                                        |

**หมายเหตุสำหรับ Developer:**

1. **Number Fields:** ค่าที่เป็นตัวเลขเงิน (`Amount`, `Wage`) ควรรับส่งเป็นทศนิยม 2 ตำแหน่งเสมอ
2. **Rate Fields:** ค่าอัตรา (`providentFundRate...`) เก็บเป็นทศนิยม (0.00 - 1.00) หน้าบ้านควรคูณ 100 เพื่อแสดงเป็น %
3. **Date Fields:** ส่งเฉพาะวันที่ในรูปแบบ `YYYY-MM-DD` ไม่ต้องพ่วงเวลามาด้วย

**Error Responses:**

| **HTTP Status** | **Title** | **Description**    |
| --------------- | --------- | ------------------ |
| **404**         | Not Found | ไม่พบข้อมูลพนักงาน |

---

### 6.3 Create Employee

เพิ่มข้อมูลพนักงานใหม่

- **Endpoint:** `POST /employees`
- **Access:** Admin, HR

**Request Body Example:**

```json
{
  "employeeNumber": "EMP-002",
  "titleId": "019aa095-7c42-7f6a-afcb-489e6689e22d",
  "firstName": "วิชัย",
  "lastName": "ใจดี",
  "idDocumentTypeId": "019aa095-7c43-71dc-9955-eca529c5cc4e",
  "idDocumentNumber": "1234567890123",
  "phone": "0899998888",
  "email": "wichai@email.com",
  "employeeTypeId": "019aa095-7c43-7388-be88-f24681d5a3f3",
  "basePayAmount": 25000.0,
  "employmentStartDate": "2025-12-01",
  "bankName": "SCB",
  "bankAccountNo": "987-6-54321-0",
  "ssoContribute": true,
  "ssoDeclaredWage": 15000.0,
  "providentFundContribute": false,
  "withholdTax": true,
  "allowHousing": false,
  "allowDoctorFee": false
}
```

**Request Fields (Validation):**

| **ชื่อ (Name)**             | **คำอธิบาย**     | **ประเภท** | **Required** | **Constraint / Note**             |
| --------------------------- | ---------------- | ---------- | ------------ | --------------------------------- |
| `employeeNumber`            | รหัสพนักงาน      | String     | **Yes**      | ห้ามซ้ำ (Unique)                  |
| `titleId`                   | ID คำนำหน้า      | UUID       | **Yes**      | ต้องมีอยู่ในระบบ                  |
| `firstName`                 | ชื่อจริง         | String     | **Yes**      |                                   |
| `lastName`                  | นามสกุล          | String     | **Yes**      |                                   |
| `idDocumentTypeId`          | ID ประเภทบัตร    | UUID       | **Yes**      |                                   |
| `idDocumentNumber`          | เลขที่บัตร       | String     | **Yes**      |                                   |
| `employeeTypeId`            | ID ประเภทพนักงาน | UUID       | **Yes**      |                                   |
| `basePayAmount`             | เงินเดือน/ค่าแรง | Number     | **Yes**      | ต้อง > 0                          |
| `employmentStartDate`       | วันเริ่มงาน      | Date       | **Yes**      | YYYY-MM-DD                        |
| `bankName`                  | ชื่อธนาคาร       | String     | No           | ต้องมาคู่กับ AccountNo            |
| `bankAccountNo`             | เลขบัญชี         | String     | No           | ต้องมาคู่กับ BankName             |
| `ssoContribute`             | ส่งประกันสังคม   | Boolean    | **Yes**      | Default: false                    |
| `ssoDeclaredWage`           | ฐานเงินเดือน SSO | Number     | Cond         | ต้องใส่ถ้า Contribute=true        |
| `providentFundContribute`   | ส่งกองทุนฯ (PVD) | Boolean    | **Yes**      | Default: false                    |
| `providentFundRateEmployee` | % สะสมลูกจ้าง    | Number     | Cond         | 0.00 - 1.00 (ต้องใส่ถ้า PVD=true) |
| `providentFundRateEmployer` | % สมทบนายจ้าง    | Number     | Cond         | 0.00 - 1.00 (ต้องใส่ถ้า PVD=true) |
| `allowDoctorFee`            | ค่าเวร/แพทย์     | Boolean    | **Yes**      | (`allow_df` ใน DB)                |

**Success Response (201 Created):**

```json
{
  "id": "019aa095-8888-...",
  "employeeNumber": "EMP-002",
  "message": "Employee created successfully."
}
```

**Error Responses:**

| **HTTP Status** | **Title**   | **Description**                                       |
| --------------- | ----------- | ----------------------------------------------------- |
| **400**         | Bad Request | ข้อมูลไม่ครบ, ขัดแย้งกัน (เช่น เปิด SSO แต่ไม่ใส่ยอด) |
| **409**         | Conflict    | รหัสพนักงานซ้ำ                                        |

---

### 6.4 Update Employee

แก้ไขข้อมูลพนักงาน

- **Endpoint:** `PATCH /employees/{id}`
- **Access:** Admin, HR
- **Params:** `id` (UUIDv7)

**Request Body Example:**

```json
{
  "basePayAmount": 28000.0,
  "allowDoctorFee": true,
  "providentFundContribute": true,
  "providentFundRateEmployee": 0.05,
  "providentFundRateEmployer": 0.05
}
```

**Success Response (200 OK):**

```json
{
  "id": "019aa095-7c43-7388-be88-f24681d5a3f3",
  "employeeNumber": "EMP-001",
  "titleId": "019aa095-7c42-7f6a-afcb-489e6689e22d",
  "firstName": "สมชาย",
  "lastName": "ศรีสุข",
  "idDocumentTypeId": "019aa095-7c43-71dc-9955-eca529c5cc4e",
  "idDocumentNumber": "1103701234567",
  "phone": "0812345678",
  "email": "somchai@example.com",
  "employeeTypeId": "019aa095-7c43-7388-be88-f24681d5a3f3",
  "basePayAmount": 28000.0, // <--- ค่าที่ถูกแก้
  "employmentStartDate": "2024-06-01",
  "employmentEndDate": null,
  "bankName": "KBank",
  "bankAccountNo": "123-4-56789-0",
  "ssoContribute": true,
  "ssoDeclaredWage": 15000.0, // <--- อาจถูกคำนวณใหม่โดย Trigger
  "providentFundContribute": true,
  "providentFundRateEmployee": 0.05,
  "providentFundRateEmployer": 0.05,
  "withholdTax": true,
  "allowHousing": true,
  "allowWater": false,
  "allowElectric": false,
  "allowInternet": true,
  "allowDoctorFee": true,
  "createdAt": "2025-11-20T10:00:00Z",
  "updatedAt": "2025-11-21T14:30:00Z" // <--- เวลาอัปเดตล่าสุด
}
```

**Error Responses:**

| **HTTP Status** | **Title**   | **Description**                                |
| --------------- | ----------- | ---------------------------------------------- |
| **400**         | Bad Request | ข้อมูลไม่ถูกต้อง (เช่น วันลาออก < วันเริ่มงาน) |
| **404**         | Not Found   | ไม่พบพนักงาน                                   |

---

### 6.5 Delete Employee (Soft Delete)

ลบพนักงาน (สงวนสิทธิ์ให้ Admin เท่านั้น เพื่อความปลอดภัยของข้อมูล)

- **Endpoint:** `DELETE /employees/{id}`
- **Access:** **Admin, HR**
- **Params:** `id` (UUIDv7)

**Success Response:**

- **Status:** `204 No Content`

**Error Responses:**

| **HTTP Status** | **Title** | **Description**                  |
| --------------- | --------- | -------------------------------- |
| **403**         | Forbidden | ผู้ใช้งานเป็น HR (ไม่มีสิทธิ์ลบ) |
| **404**         | Not Found | ไม่พบพนักงาน                     |

---

## 7. Payroll Accumulation

กลุ่ม API สำหรับดูและจัดการยอดเงินสะสม (ยอดยกมา) ของพนักงาน เช่น ประกันสังคม, ภาษี, และกองทุนสำรองเลี้ยงชีพ

**Access Control:**

- **Admin:** ดู (Read), สร้าง/แก้ไข (Upsert), ลบ (Delete)
- **HR:** ดู (Read)

### 7.1 Get Employee Accumulations

ดึงยอดเงินสะสมของพนักงาน (HR ดูได้เพื่อตอบคำถามพนักงาน แต่แก้ไขไม่ได้)

- **Endpoint:** `GET /employees/{id}/accumulations`
- **Access:** Admin, HR
- **Params:** `id` (UUIDv7) - รหัสพนักงาน
- **Query Parameters:**
  - `year`: (int) ปีปฏิทินที่ต้องการดูยอดสะสม (Default: ปีปัจจุบัน)

**Success Response Example (200 OK):**

```json
{
  "employeeId": "019aa095-7c43-7388-be88-f24681d5a3f3",
  "year": 2025,
  "totals": {
    "sso": 4500.0,
    "tax": 2500.0,
    "providentFund": 150000.0
  },
  "updatedAt": "2025-11-21T10:30:00Z"
}
```

**Response Fields:**

| **ชื่อ (Name)**        | **คำอธิบาย (Description)**                         | **ประเภท** | **ตัวอย่าง** |
| ---------------------- | -------------------------------------------------- | ---------- | ------------ |
| `employeeId`           | รหัสพนักงาน                                        | UUID       | `"019aa..."` |
| `year`                 | ปีของข้อมูลที่เรียกดู                              | Integer    | `2025`       |
| `totals`               | วัตถุเก็บยอดรวม                                    | Object     | `{...}`      |
| `totals.sso`           | ยอดประกันสังคมสะสม **รายปี**                       | Number     | `4500.00`    |
| `totals.tax`           | ยอดภาษีหัก ณ ที่จ่ายสะสม **รายปี**                 | Number     | `2500.00`    |
| `totals.providentFund` | ยอดกองทุนสำรองเลี้ยงชีพสะสม **ทั้งหมด (Lifetime)** | Number     | `150000.00`  |
| `updatedAt`            | เวลาที่มีการแก้ไขยอดล่าสุด                         | String     | `"2025..."`  |

**Error Responses:**

| **HTTP Status** | **Title** | **Description** |
| --------------- | --------- | --------------- |
| **404**         | Not Found | ไม่พบพนักงาน    |

---

### 7.2 Upsert Accumulation (Admin Only)

สร้างหรือแก้ไขยอดสะสม (ใช้สำหรับการตั้งยอดยกมา หรือแก้ตัวเลขที่ผิด)

- **Endpoint:** `POST /employees/{id}/accumulations`
- **Access:** **Admin Only**
- **Params:** `id` (UUIDv7)

**Request Body Example:**

```json
{
  "type": "sso",
  "amount": 5400.0,
  "year": 2025,
  "note": "ยอดยกมาจากระบบเก่า (Jan-Jun)"
}
```

**Request Fields:**

| **ชื่อ (Name)** | **คำอธิบาย**                   | **ประเภท** | **Required** | **Constraint**                                 |
| --------------- | ------------------------------ | ---------- | ------------ | ---------------------------------------------- |
| `type`          | ประเภทเงินสะสม                 | Enum       | **Yes**      | `sso`, `tax`, `pf`                             |
| `amount`        | ยอดเงินสะสมรวมใหม่ (Net Total) | Number     | **Yes**      | >= 0                                           |
| `year`          | ปีปฏิทิน                       | Integer    | Cond         | จำเป็นสำหรับ `sso`, `tax` (ห้ามใส่สำหรับ `pf`) |
| `note`          | บันทึกช่วยจำ                   | String     | No           |                                                |

**Success Response Example (200 OK):**

```json
{
  "id": "019ab123-4567-...",
  "employeeId": "019aa095-...",
  "type": "sso",
  "year": 2025,
  "amount": 5400.0,
  "message": "Accumulation updated successfully."
}
```

**Error Responses:**

| **HTTP Status** | **Title**   | **Description**                           |
| --------------- | ----------- | ----------------------------------------- |
| **400**         | Bad Request | `amount` ติดลบ หรือใส่ `year` ผิดเงื่อนไข |
| **403**         | Forbidden   | ผู้ใช้งานเป็น HR (ไม่มีสิทธิ์แก้ไข)       |
| **404**         | Not Found   | ไม่พบพนักงาน                              |

---

### 7.3 Delete Accumulation (Reset) (Admin Only)

ล้างค่ายอดสะสม

- **Endpoint:** `DELETE /employees/{id}/accumulations`
- **Access:** **Admin Only**
- **Params:** `id` (UUIDv7)
- **Query Parameters:**
  - `type`: (string, required) `sso`, `tax`, `pf`
  - `year`: (int, optional) จำเป็นสำหรับ `sso`, `tax`

**Success Response:**

- **Status:** `204 No Content`

**Error Responses:**

| **HTTP Status** | **Title**   | **Description**                  |
| --------------- | ----------- | -------------------------------- |
| **400**         | Bad Request | ไม่ระบุ `type`                   |
| **403**         | Forbidden   | ผู้ใช้งานเป็น HR (ไม่มีสิทธิ์ลบ) |
| **404**         | Not Found   | ไม่พบรายการที่ต้องการลบ          |

---

## 8. Full-Time Worklogs

กลุ่ม API สำหรับจัดการบันทึกเวลาพนักงานประจำ (เน้นบันทึกรายการหัก/เพิ่ม เช่น สาย, ลา, OT)

**Access Control:** Admin, HR

### 8.1 List Worklogs (Filterable)

ดูข้อมูลรายการบันทึกเวลา สามารถกรองตามเงื่อนไขต่างๆ ได้

- **Endpoint:** `GET /worklogs/ft`
- **Query Parameters:**
  - `employeeId`: (UUID) กรองรายคน
  - `entryType`: (string) `late`, `leave_day`, `ot`, etc.
  - `status`: (string) `pending`, `approved`
  - `startDate`: (date) วันที่เริ่มต้น (YYYY-MM-DD)
  - `endDate`: (date) วันที่สิ้นสุด (YYYY-MM-DD)
  - `page`, `limit`: Pagination

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "019aa095-...",
      "employeeId": "019aa095-...",
      "employeeName": "สมชาย ศรีสุข",
      "workDate": "2025-11-20",
      "entryType": "late",
      "quantity": 15.00, // นาที
      "status": "pending"
    }
  ],
  "meta": { ... }
}
```

### 8.2 Get Worklog Detail

ดึงข้อมูลรายการบันทึกเวลาของพนักงานประจำรายรายการ

- **Endpoint:** `GET /worklogs/ft/{id}`
- **Access:** Admin, HR
- **Params:** `id` (UUIDv7)

**Success Response Example (200 OK):**

```json
{
  "id": "019aa095-1234-7c43-be88-f24681d5a3f3",
  "employeeId": "019aa095-7c43-7388-be88-f24681d5a3f3",
  "employeeName": "สมชาย ศรีสุข",
  "workDate": "2025-11-20",
  "entryType": "late",
  "quantity": 15.0,
  "status": "pending",
  "createdAt": "2025-11-20T08:30:00Z",
  "updatedAt": "2025-11-20T08:30:00Z"
}
```

**Response Fields:**

| **ชื่อ (Name)** | **คำอธิบาย**                       | **ประเภท** | **ตัวอย่าง**   |
| --------------- | ---------------------------------- | ---------- | -------------- |
| `id`            | รหัสรายการ                         | UUID       | `"019aa..."`   |
| `employeeId`    | รหัสพนักงาน                        | UUID       | `"019aa..."`   |
| `employeeName`  | ชื่อ-สกุล (Join มาเพื่อแสดงผล)     | String     | `"สมชาย..."`   |
| `workDate`      | วันที่เกิดรายการ                   | Date       | `"2025-11-20"` |
| `entryType`     | ประเภท (`late`, `ot`, `leave_...`) | Enum       | `"late"`       |
| `quantity`      | จำนวน (นาที/ชั่วโมง/วัน)           | Number     | `15.00`        |
| `status`        | สถานะ (`pending`, `approved`)      | Enum       | `"pending"`    |

**Error Responses:**

- `404 Not Found`: ไม่พบรายการ

### 8.3 Create Worklog

เพิ่มรายการบันทึกเวลา

- **Endpoint:** `POST /worklogs/ft`

**Request Body:**

```json
{
  "employeeId": "019aa095-...",
  "workDate": "2025-11-20",
  "entryType": "late", // Enum: late, leave_day, leave_hours, ot
  "quantity": 15
}
```

**Success Response (201 Created):**

- คืนค่า Object ที่สร้าง

### 8.4 Update Worklog

แก้ไขรายการ (ทำได้เฉพาะสถานะ `pending` เท่านั้น)

- **Endpoint:** `PATCH /worklogs/ft/{id}`

**Request Body:**

```json
{
  "quantity": 10
}
```

**Error Responses:**

- `400 Bad Request`: ข้อมูลไม่ถูกต้อง หรือสถานะไม่ใช่ `pending` (แก้ไขไม่ได้แล้ว)

### 8.5 Delete Worklog

ลบรายการ (ทำได้เฉพาะสถานะ `pending` เท่านั้น)

- **Endpoint:** `DELETE /worklogs/ft/{id}`

**Success Response:** `204 No Content`

**Error Responses:**

- `400 Bad Request`: สถานะไม่ใช่ `pending` (ลบไม่ได้)

---

## 9. Part-Time Worklogs

กลุ่ม API สำหรับจัดการลงเวลาพนักงานพาร์ทไทม์ (บันทึกเวลาเข้า-ออกจริง)

**Access Control:** Admin, HR

### 9.1 List Worklogs (Filterable)

ดูข้อมูลเวลาเข้าออก กรองตามสถานะเพื่อเตรียมทำจ่ายได้

- **Endpoint:** `GET /worklogs/pt`
- **Query Parameters:**
  - `employeeId`: (UUID) กรองรายคน
  - `status`: (string) `pending`, `approved`
  - `startDate`: (date)
  - `endDate`: (date)

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "019bb123-...",
      "employeeId": "019aa095-...",
      "workDate": "2025-11-20",
      "morningIn": "08:00:00",
      "morningOut": "12:00:00",
      "eveningIn": "13:00:00",
      "eveningOut": "17:00:00",
      "totalHours": 8.0, // คำนวณจาก DB
      "status": "pending"
    }
  ]
}
```

### 9.2 Get Worklog Detail

ดึงข้อมูลเวลาเข้า-ออกรายวันของพนักงานพาร์ทไทม์

- **Endpoint:** `GET /worklogs/pt/{id}`
- **Access:** Admin, HR
- **Params:** `id` (UUIDv7)

**Success Response Example (200 OK):**

```json
{
  "id": "019bb123-4567-7c43-be88-f24681d5b4g4",
  "employeeId": "019aa095-7c43-7388-be88-f24681d5a3f3",
  "employeeName": "วิชัย ใจดี",
  "workDate": "2025-11-20",
  "morningIn": "08:00:00",
  "morningOut": "12:00:00",
  "morningMinutes": 240,
  "eveningIn": "13:00:00",
  "eveningOut": "17:00:00",
  "eveningMinutes": 240,
  "totalMinutes": 480,
  "totalHours": 8.0,
  "status": "pending",
  "createdAt": "2025-11-20T17:05:00Z",
  "updatedAt": "2025-11-20T17:05:00Z"
}
```

**Response Fields:**

| **ชื่อ (Name)** | **คำอธิบาย**                                    | **ประเภท** | **ตัวอย่าง**   |
| --------------- | ----------------------------------------------- | ---------- | -------------- |
| `id`            | รหัสรายการ                                      | UUID       | `"019bb..."`   |
| `workDate`      | วันที่ทำงาน                                     | Date       | `"2025-11-20"` |
| `morningIn`     | เวลาเข้าช่วงเช้า                                | Time       | `"08:00:00"`   |
| `morningOut`    | เวลาออกช่วงเช้า                                 | Time       | `"12:00:00"`   |
| `eveningIn`     | เวลาเข้าช่วงบ่าย                                | Time       | `"13:00:00"`   |
| `eveningOut`    | เวลาออกช่วงบ่าย                                 | Time       | `"17:00:00"`   |
| `totalHours`    | ชั่วโมงทำงานรวม (คำนวณจาก DB)                   | Number     | `8.00`         |
| `status`        | สถานะ (`pending`, `approved`, `to_pay`, `paid`) | Enum       | `"pending"`    |

**Error Responses:**

- `404 Not Found`: ไม่พบรายการ

### 9.3 Create Worklog

บันทึกเวลาเข้า-ออกใหม่

- **Endpoint:** `POST /worklogs/pt`

**Request Body:**

```json
{
  "employeeId": "019aa095-...",
  "workDate": "2025-11-20",
  "morningIn": "08:00",
  "morningOut": "12:00",
  "eveningIn": "13:00",
  "eveningOut": "17:00"
}
```

### 9.4 Update Worklog

แก้ไขเวลา (เฉพาะ `pending`)

- **Endpoint:** `PATCH /worklogs/pt/{id}`

**Request Body:**

```json
{
  "eveningOut": "17:30" // แก้ไขเวลาออก
}
```

**Error Responses:**

- `400 Bad Request`: สถานะไม่ใช่ `pending`

### 9.5 Delete Worklog

ลบรายการ (เฉพาะ `pending`)

- **Endpoint:** `DELETE /worklogs/pt/{id}`

**Error Responses:**

- `400 Bad Request`: สถานะไม่ใช่ `pending`

---

## 10. Part-Time Payout (Advance Payment)

กลุ่ม API สำหรับรวบรวมรายการลงเวลาพาร์ทไทม์ (จากข้อ 9) มาสร้างเป็นใบเบิกจ่าย (Payout)

**Access Control:** Admin, HR

### 10.1 Create Payout (Generate from Worklogs)

เลือกรายการลงเวลาที่ต้องการ (status: `pending` หรือ `approved`) มาสร้างรายการทำจ่าย

- **Endpoint:** `POST /payouts/pt`

**Logic การทำงาน:**

1. ตรวจสอบว่า `worklogIds` ทั้งหมดเป็นของ `employeeId` เดียวกัน
2. ตรวจสอบสถานะ Worklog ต้องเป็น `pending` เท่านั้น (ห้ามเอาที่จ่ายแล้วมาวนซ้ำ)
3. สร้าง Record ใน `payout_pt`
4. สร้าง Record ใน `payout_pt_item`
5. อัปเดตสถานะ Worklog เหล่านั้นเป็น `to_pay` (ล็อกห้ามแก้ไข)
6. คำนวณยอดเงินรวม (`totalHours` \* `hourlyRate`)

**Request Body:**

```json
{
  "employeeId": "019aa095-...",
  "worklogIds": ["019bb123-...", "019bb124-...", "019bb125-..."]
}
```

**Success Response (201 Created):**

```json
{
  "id": "019cc999-...",
  "employeeId": "019aa095-...",
  "status": "to_pay",
  "totalHours": 24.5,
  "amountTotal": 2450.0, // สมมติชั่วโมงละ 100
  "itemCount": 3
}
```

### 10.2 List Payouts

ดูประวัติการเบิกจ่ายเงินพาร์ทไทม์

- **Endpoint:** `GET /payouts/pt`
- **Query Parameters:** `employeeId`, `status` (`to_pay`, `paid`)

### 10.3 Get Payout Detail

ดูรายละเอียดใบเบิกจ่ายว่าประกอบด้วยกะงานวันไหนบ้าง

- **Endpoint:** `GET /payouts/pt/{id}`

**Success Response:**

```json
{
  "id": "019cc999-...",
  "status": "to_pay",
  "amountTotal": 2450.00,
  "items": [
    {
      "worklogId": "019bb123-...",
      "workDate": "2025-11-20",
      "totalHours": 8.00
    },
    ...
  ]
}
```

### 10.4 Mark as Paid

บันทึกว่าจ่ายเงินแล้ว (เปลี่ยนสถานะจาก `to_pay` -> `paid`)

- **Endpoint:** `POST /payouts/pt/{id}/pay`
- **Access:** **Admin Only** (เรื่องเงินควรกำหนดสิทธิ์ให้สูงขึ้น หรือตาม Policy บริษัท)

**Success Response:** สถานะเปลี่ยนเป็น `paid` และ Worklog ที่ผูกอยู่ก็จะเปลี่ยนเป็น `paid` ตาม Trigger ใน DB

---

## 11. Salary Raise Management

กลุ่ม API สำหรับบริหารจัดการรอบการปรับเงินเดือนประจำปี หรือการปรับตามงวด

**Access Control:**

- **HR:** สร้างรอบ (Draft), แก้ไขตัวเลขรายคน, ดูข้อมูล
- **Admin:** ทำได้ทุกอย่าง และมีสิทธิ์พิเศษในการ **อนุมัติ (Approve)** หรือ **ไม่อนุมัติ (Reject)**

### 11.1 List Cycles

ดูรายการรอบการปรับเงินเดือนทั้งหมด

- **Endpoint:** `GET /salary-raise-cycles`
- **Access:** Admin, HR
- **Query Parameters:**
  - `page`, `limit`: Pagination
  - `status`: `pending`, `approved`, `rejected`
  - `year`: (int) กรองตามปีของ `periodStartDate`

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "019cc123-4567-...",
      "periodStartDate": "2025-01-01",
      "periodEndDate": "2025-12-31",
      "status": "pending",
      "note": "ปรับเงินเดือนประจำปี 2025",
      "totalEmployees": 150,
      "totalRaiseAmount": 45000.00, // ยอดรวมที่เสนอปรับเพิ่มทั้งหมด
      "createdAt": "2026-01-05T10:00:00Z"
    }
  ],
  "meta": { ... }
}
```

---

### 11.2 Get Cycle Detail

ดูข้อมูลรายรอบ (Header)

- **Endpoint:** `GET /salary-raise-cycles/{id}`
- **Access:** Admin, HR
- **Params:** `id` (UUIDv7)

**Success Response (200 OK):**

```json
{
  "id": "019cc123-4567-...",
  "periodStartDate": "2025-01-01",
  "periodEndDate": "2025-12-31",
  "status": "pending",
  "createdAt": "2026-01-05T10:00:00Z",
  "updatedAt": "2026-01-05T10:00:00Z"
}
```

---

### 11.3 Create Cycle (Auto-Generate Items)

สร้างรอบการประเมินใหม่

- **Endpoint:** `POST /salary-raise-cycles`
- **Access:** Admin, HR

Logic พิเศษ:

ทันทีที่สร้างสำเร็จ Database Trigger (tg_salary_raise_cycle_ai) จะทำการ Copy พนักงานประจำ (Full-time) ทุกคน เข้ามาในตารางรายการ (salary_raise_item) พร้อมคำนวณสถิติการมาสาย/วันลาในช่วงวันที่ที่ระบุให้อัตโนมัติ

**Request Body:**

```json
{
  "periodStartDate": "2025-01-01", // วันเริ่มนับสถิติ (Performance)
  "periodEndDate": "2025-12-31" // วันสิ้นสุดนับสถิติ
}
```

**Success Response (201 Created):**

```json
{
  "id": "019cc123-4567-...",
  "status": "pending",
  "message": "Cycle created. Employee items have been generated automatically."
}
```

**Error Responses:**

- `400 Bad Request`: วันที่ผิด (`endDate < startDate`)

---

### 11.4 Update Cycle (Status Change)

แก้ไขช่วงเวลา หรือ เปลี่ยนสถานะ (Approve/Reject)

- **Endpoint:** `PATCH /salary-raise-cycles/{id}`
- **Access:** Admin, HR (HR แก้ Status ไม่ได้)

**Logic พิเศษ (Approval):**

- หากส่ง `status: "approved"` ระบบ (Database Trigger) จะทำการ **อัปเดตฐานเงินเดือน (`basePayAmount`)** ของพนักงานทุกคนในรอบนั้นที่ตาราง `employees` ทันที
- **HR:** ห้ามส่ง field `status` (หรือส่งได้แค่ `pending`)
- **Admin:** สามารถส่ง `approved` หรือ `rejected` ได้
- การ `rejected` ไม่ได้ลบรอบออกไป (ยังอยู่ในระบบจนกว่าจะลบด้วย API Delete)

**Request Body:**

```json
{
  "periodEndDate": "2025-12-30", // แก้ไขวันที่ (ระบบจะคำนวณสถิติใหม่ให้)
  "status": "approved" // Admin Only
}
```

**Success Response (200 OK):**

```json
{
  "id": "019cc123-...",
  "status": "approved",
  "updatedAt": "..."
}
```

**Error Responses:**

- `403 Forbidden`: HR พยายามเปลี่ยนสถานะเป็น Approved
- `400 Bad Request`: พยายามแก้ไขรอบที่ Approved ไปแล้ว

---

### 11.5 Delete Cycle

ลบรอบการประเมิน (Soft Delete)

- **Endpoint:** `DELETE /salary-raise-cycles/{id}`
- **Access:** Admin, HR
- ไม่เปลี่ยนสถานะรอบ เพียงตั้งค่า `deleted_at/deleted_by` (Soft Delete)

**Success Response:** `204 No Content`

---

### 11.6 List Cycle Items (Items to Edit)

ดึงรายการพนักงานในรอบนั้นๆ เพื่อนำมากรอกตัวเลข

- **Endpoint:** `GET /salary-raise-cycles/{id}/items`
- **Access:** Admin, HR
- **Query Parameters:**
  - `search`: ชื่อพนักงาน
  - `departmentId`: (ถ้ามี)

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "019dd999-...",
      "cycleId": "019cc123-...",
      "employeeId": "019aa095-...",
      "employeeName": "สมชาย ศรีสุข",
      "tenureDays": 365,
      "currentSalary": 30000.0,
      "currentSsoWage": 15000.0,
      "raisePercent": 5.0,
      "raiseAmount": 1500.0,
      "newSalary": 31500.0, // Calculated (current + raiseAmount)
      "newSsoWage": 15000.0,
      "stats": {
        "lateMinutes": 45,
        "leaveDays": 2.5,
        "leaveDoubleDays": 0.0,
        "leaveHours": 4.0,
        "otHours": 12.0
      },
      "updatedAt": "2026-01-05T10:00:00Z"
    }
  ]
}
```

---

### 11.7 Update Cycle Item (Propose Raise)

กรอกตัวเลขการปรับเงินเดือนรายคน

- **Endpoint:** `PATCH /salary-raise-items/{id}`
- **Access:** Admin, HR
- **Params:** `id` (UUIDv7 ของ Item ไม่ใช่ Employee)

**Logic:**

- แก้ไขได้เฉพาะเมื่อ Cycle Status = `pending`
- Frontend ควรคำนวณให้ User ว่าถ้ากรอก `%` จะได้ `amount` เท่าไหร่ แล้วส่ง `amount` มา (หรือส่งทั้งคู่)

**Request Body:**

```json
{
  "raisePercent": 10.0,
  "raiseAmount": 3000.0,
  "newSsoWage": 15000.0 // ถ้าต้องการปรับฐาน SSO ใหม่ (Optional)
}
```

**Success Response (200 OK):**

```json
{
  "id": "019dd999-...",
  "newSalary": 33000.0, // ยืนยันยอดใหม่
  "updatedAt": "..."
}
```

**Error Responses:**

- `400 Bad Request`: รอบการประเมินไม่ได้อยู่ในสถานะ Pending
- `404 Not Found`: ไม่พบรายการ

---

## 12. Bonus Management

กลุ่ม API สำหรับจัดการรอบการจ่ายโบนัสและการกำหนดเงินโบนัสรายบุคคล

Workflow: **สร้างรอบ -> ระบบดึงคนและสถิติให้อัตโนมัติ -> HR พิจารณากรอกยอด -> Admin อนุมัติ -> รอจ่ายใน Payroll**

**Access Control:**

- **HR:** สร้างรอบ (Draft), กรอกยอดเงินรายคน, ดูข้อมูล
- **Admin:** ทำได้ทุกอย่าง และมีสิทธิ์ **อนุมัติ (Approve)** หรือ **ไม่อนุมัติ (Reject)**

---

### 12.1 List Bonus Cycles

ดูประวัติรอบการจ่ายโบนัสทั้งหมด

- **Endpoint:** `GET /bonus-cycles`
- **Access:** Admin, HR
- **Query Parameters:**
  - `page`, `limit`: Pagination
  - `status`: `pending`, `approved`, `rejected`
  - `year`: (int) ปีของ `payrollMonthDate`

**Success Response Example (200 OK):**

```json
{
  "data": [
    {
      "id": "019ee123-4567-...",
      "payrollMonthDate": "2025-12-01", // จ่ายในงวดเดือนธันวาคม
      "periodStartDate": "2025-01-01",  // ประเมินผลจาก 1 ม.ค.
      "periodEndDate": "2025-12-31",    // ถึง 31 ธ.ค.
      "status": "pending",
      "totalEmployees": 120,
      "totalBonusAmount": 500000.00,    // ยอดรวมที่ HR กรอกไว้
      "createdAt": "2025-11-20T10:00:00Z"
    }
  ],
  "meta": { ... }
}
```

---

### 12.2 Create Bonus Cycle

สร้างรอบโบนัสใหม่ (ระบบจะดึงพนักงานและคำนวณสถิติให้อัตโนมัติ)

- **Endpoint:** `POST /bonus-cycles`
- **Access:** Admin, HR
- **Constraints / Business Rules:**
  - มีรอบ **pending ได้ครั้งละ 1 รายการ** (ถ้ามีอยู่แล้วจะตอบ 409)
  - ไม่อนุญาตสร้างรอบที่มี `payrollMonthDate` **ชนกับรอบที่อนุมัติแล้ว** (ตอบ 409)
  - สร้างใหม่ทับเดือนเดิมได้ถ้ารอบก่อนหน้าไม่อนุมัติ (rejected) หรือถูกลบแล้ว

**Request Body Example:**

```json
{
  "payrollMonthDate": "2025-12-01", // ระบุว่าจะให้โบนัสก้อนนี้ไปโผล่ในสลิปเดือนไหน
  "periodStartDate": "2025-01-01", // เริ่มนับสถิติ (สาย/ลา) เมื่อไหร่
  "periodEndDate": "2025-12-31" // สิ้นสุดนับสถิติเมื่อไหร่
}
```

**Logic (Backend/DB):**

- Trigger `bonus_cycle_after_insert` จะทำงาน
- ดึงพนักงาน Full-time ทุกคนสร้างลง `bonus_item`
- คำนวณ `tenureDays` (อายุงาน), `lateMinutes`, `leaveDays` จาก `worklog_ft` ในช่วงวันที่ระบุมาใส่ให้
- บล็อกซ้ำ: 1 pending ต่อระบบ และ 1 `payrollMonthDate` ต่อรอบที่อนุมัติแล้ว

**Success Response (201 Created):**

```json
{
  "id": "019ee123-4567-...",
  "status": "pending",
  "message": "Bonus cycle created and employee items generated."
}
```

**Error Responses:**

- `400 Bad Request`: วันที่ผิด (`payrollMonthDate` ต้องเป็นวันแรกของเดือน หรือ `periodEndDate < periodStartDate`)
- `409 Conflict`: มีรอบ `pending` อยู่แล้ว หรือมีรอบที่ **อนุมัติ** แล้วใน `payrollMonthDate` เดียวกัน

---

### 12.3 Update Bonus Cycle (Status / Dates)

แก้ไขวันประเมิน หรือ เปลี่ยนสถานะ (อนุมัติ)

- **Endpoint:** `PATCH /bonus-cycles/{id}`
- **Access:** **Admin Only**

**Request Body Example:**

```json
{
  "periodEndDate": "2025-11-30", // แก้ไขวัน (ระบบจะ Recalculate สถิติคนในรอบให้ใหม่)
  "status": "approved" // Admin Only
}
```

**Logic การอนุมัติ:**

- เมื่อ `status` = `approved` ข้อมูลจะถูกล็อก (ห้ามแก้ `bonus_item` อีก)
- ระบบ Payroll จะมองเห็นข้อมูลนี้และดึงไปรวมยอดรายได้เมื่อถึงรอบ `payrollMonthDate`

**Success Response (200 OK):**

- คืนค่า Object Cycle ที่อัปเดตแล้ว

---

### 12.4 Delete Bonus Cycle

ลบรอบโบนัส (เฉพาะสถานะ Pending/Rejected)

- **Endpoint:** `DELETE /bonus-cycles/{id}`
- **Access:** **Admin Only**

**Success Response:** `204 No Content`

---

### 12.5 List Bonus Items (Entry Form)

ดึงรายการพนักงานในรอบนั้นๆ เพื่อมากรอกยอดโบนัส

- **Endpoint:** `GET /bonus-cycles/{id}/items`
- **Access:** Admin, HR
- **Query Parameters:**
  - `search`: ชื่อพนักงาน
  - `departmentId`: (ถ้ามี)

**Success Response Example (200 OK):**

```json
{
  "data": [
    {
      "id": "019ff999-...",
      "employeeId": "019aa095-...",
      "employeeName": "สมชาย ศรีสุข",
      "currentSalary": 30000.0,
      "tenureDays": 365,
      "stats": {
        "lateMinutes": 120,
        "leaveDays": 5.0,
        "leaveDoubleDays": 0.0,
        "leaveHours": 4.0,
        "otHours": 12.5
      },
      "bonusMonths": 1.5, // จำนวนเท่า (HR กรอก)
      "bonusAmount": 45000.0 // ยอดเงิน (HR กรอก หรือคำนวณมา)
    }
  ]
}
```

**ตารางสรุปฟิลด์สำหรับ JSON**

| **ชื่อฟิลด์**           | **ประเภท** | **คำอธิบาย**                                     |
| ----------------------- | ---------- | ------------------------------------------------ |
| `currentSalary`         | Number     | เงินเดือน ณ วันสร้างรอบ (ใช้เป็นฐานคำนวณ)        |
| `tenureDays`            | Integer    | อายุงาน (วัน) นับจากวันเริ่มงานถึงวันสร้างรอบ    |
| `stats.lateMinutes`     | Integer    | นาทีสายสะสม (ในช่วง period)                      |
| `stats.leaveDays`       | Number     | วันลาสะสม (ในช่วง period)                        |
| `stats.leaveDoubleDays` | Number     | วันลาซ้อนที่นับสองเท่า (ในช่วง period)           |
| `stats.leaveHours`      | Number     | ชั่วโมงลาสะสม (ในช่วง period)                    |
| `stats.otHours`         | Number     | ชั่วโมง OT สะสม (ในช่วง period)                  |
| `bonusMonths`           | Number     | โบนัสกี่เท่าของเงินเดือน (เก็บไว้เป็น Reference) |
| `bonusAmount`           | Number     | **ยอดเงินโบนัสสุทธิที่จะจ่ายจริง**               |

---

### 12.6 Update Bonus Item (Set Amount)

บันทึกยอดโบนัสให้พนักงานรายคน

- **Endpoint:** `PATCH /bonus-items/{id}`
- **Access:** Admin, HR
- **Params:** `id` (UUIDv7 ของ Item)

**Logic:**

- แก้ไขได้เฉพาะเมื่อ Cycle Status = `pending`
- Frontend ควรคำนวณยอด `amount` มาให้เลย (เช่น `salary * months`) หรือจะส่งมาแต่ `amount` ก็ได้

**Request Body Example:**

```json
{
  "bonusMonths": 2.0,
  "bonusAmount": 60000.0
}
```

**Success Response (200 OK):**

```json
{
  "id": "019ff999-...",
  "bonusAmount": 60000.0,
  "updatedAt": "2025-11-21T15:00:00Z"
}
```

**Error Responses:**

- `400 Bad Request`: รอบโบนัสถูกอนุมัติไปแล้ว (แก้ไขไม่ได้)
- `404 Not Found`: ไม่พบรายการ

---

## 13. Salary Advance Management

กลุ่ม API สำหรับจัดการรายการเบิกเงินล่วงหน้าของพนักงาน

**Access Control:**

- **HR:** ดูรายการ, สร้างรายการขอเบิก, แก้ไข/ลบ (เฉพาะสถานะ `pending`)
- **Admin:** ทำได้ทุกอย่าง และสามารถดูรายการที่ `processed` แล้วได้ (แต่แก้ไขไม่ได้เช่นกันตาม Database Rule)

### 13.1 List Salary Advances

ดูรายการเบิกเงินล่วงหน้า สามารถกรองตามงวดเดือน หรือสถานะได้

- **Endpoint:** `GET /salary-advances`
- **Access:** Admin, HR
- **Query Parameters:**
  - `page`, `limit`: Pagination
  - `employeeId`: (UUID) กรองรายคน
  - `payrollMonth`: (date) กรองตามงวดเดือนที่จะหักคืน (YYYY-MM-01)
  - `status`: `pending`, `processed`

**Success Response Example (200 OK):**

```json
{
  "data": [
    {
      "id": "019cc111-2222-7d69-9f3a-1c3d4e5f6789",
      "employeeId": "019aa095-...",
      "employeeName": "สมชาย ศรีสุข",
      "amount": 5000.00,
      "advanceDate": "2025-09-15",
      "payrollMonthDate": "2025-09-01", // งวดที่จะหักคืน
      "status": "pending",
      "createdAt": "2025-09-15T10:00:00Z"
    }
  ],
  "meta": { ... }
}
```

---

### 13.2 Create Salary Advance

สร้างรายการขอเบิกเงินล่วงหน้า

- **Endpoint:** `POST /salary-advances`
- **Access:** Admin, HR

**Logic (Backend):**

1. รับ `advanceDate` และ `payrollMonthDate` (ต้องเป็นวันแรกของเดือนนั้น)
2. ไม่บังคับให้ `advanceDate` ต้องอยู่เดือนเดียวกับ `payrollMonthDate` (รองรับการจ่ายข้ามงวด)
3. บันทึกสถานะเริ่มต้นเป็น `pending`

**Request Body Example:**

```json
{
  "employeeId": "019aa095-7c43-7388-be88-f24681d5a3f3",
  "amount": 5000.0,
  "advanceDate": "2025-09-15",
  "payrollMonthDate": "2025-09-01"
}
```

**Request Fields:**

| **ชื่อ (Name)**    | **คำอธิบาย**                             | **ประเภท** | **Required** | **ตัวอย่าง**    |
| ------------------ | ---------------------------------------- | ---------- | ------------ | --------------- |
| `employeeId`       | รหัสพนักงาน                              | UUID       | **Yes**      | `"019aa..."`    |
| `amount`           | ยอดเงินที่ต้องการเบิก                    | Number     | **Yes**      | `5000.00` (> 0) |
| `advanceDate`      | วันที่รับเงิน/โอนเงิน                    | Date       | **Yes**      | `"2025-09-15"`  |
| `payrollMonthDate` | งวดเงินเดือน (วันแรกของเดือนที่จะหักคืน) | Date       | **Yes**      | `"2025-09-01"`  |

**Success Response (201 Created):**

```json
{
  "id": "019cc111-2222-...",
  "status": "pending",
  "payrollMonthDate": "2025-09-01",
  "message": "Salary advance request created."
}
```

**Error Responses:**

| **HTTP Status** | **Title**   | **Description**               |
| --------------- | ----------- | ----------------------------- |
| **400**         | Bad Request | ยอดเงิน <= 0 หรือข้อมูลไม่ครบ |
| **404**         | Not Found   | ไม่พบพนักงาน                  |

---

### 13.3 Update Salary Advance

แก้ไขยอดเงินหรือวันที่ (ทำได้เฉพาะเมื่อสถานะยังเป็น `pending` เท่านั้น)

- **Endpoint:** `PATCH /salary-advances/{id}`
- **Access:** Admin, HR
- **Params:** `id` (UUIDv7)

**Logic:**

- ตรวจสอบสถานะปัจจุบันใน DB ถ้าเป็น `processed` (ถูกหักคืนไปแล้ว) ต้องห้ามแก้ไข (Return 400/409)

**Request Body Example:**

```json
{
  "amount": 4500.0,
  "advanceDate": "2025-09-16",
  "payrollMonthDate": "2025-09-01"
}
```

**Success Response (200 OK):**

- คืนค่า Object ที่อัปเดตแล้ว

**Error Responses:**

| **HTTP Status** | **Title**   | **Description**                                    |
| --------------- | ----------- | -------------------------------------------------- |
| **400**         | Bad Request | รายการนี้ถูกประมวลผลไปแล้ว (Processed) แก้ไขไม่ได้ |
| **404**         | Not Found   | ไม่พบรายการ                                        |

---

### 13.4 Delete Salary Advance

ยกเลิกรายการเบิก (ทำได้เฉพาะเมื่อสถานะยังเป็น `pending`)

- **Endpoint:** `DELETE /salary-advances/{id}`
- **Access:** Admin, HR

**Success Response:**

- **Status:** `204 No Content`

**Error Responses:**

| **HTTP Status** | **Title**   | **Description**                                 |
| --------------- | ----------- | ----------------------------------------------- |
| **400**         | Bad Request | รายการนี้ถูกประมวลผลไปแล้ว (Processed) ลบไม่ได้ |
| **404**         | Not Found   | ไม่พบรายการ                                     |

---

### 13.5 Get Salary Advance Detail

ดูรายละเอียดรายการเบิก

- **Endpoint:** `GET /salary-advances/{id}`
- **Access:** Admin, HR

**Success Response Example (200 OK):**

```json
{
  "id": "019cc111-2222-7d69-9f3a-1c3d4e5f6789",
  "employeeId": "019aa095-...",
  "employeeName": "สมชาย ศรีสุข",
  "amount": 5000.0,
  "advanceDate": "2025-09-15",
  "payrollMonthDate": "2025-09-01",
  "status": "pending",
  "createdAt": "2025-09-15T10:00:00Z",
  "updatedAt": "2025-09-15T10:00:00Z"
}
```

### หมายเหตุการนำไปใช้งาน (Implementation Note)

ในขั้นตอนการทำจ่ายเงินเดือน (**Payroll Run**):

1. ระบบ Backend จะต้อง Query ตาราง `salary_advance` โดยหาเงื่อนไข:
   - `status = 'pending'`
   - `payroll_month_date = <งวดที่กำลังจ่าย>`
2. นำยอด `amount` ไปรวมเป็นยอดหัก (Deduction) ในสลิปเงินเดือน
3. เมื่อ Payroll Run ถูก **Approve** -> ระบบต้อง Update `salary_advance` เหล่านั้นให้ `status = 'processed'` (ผ่าน Trigger หรือ Code) เพื่อล็อกไม่ให้แก้ไขย้อนหลังครับ

---

## 14. Debt & Loan Management

กลุ่ม API สำหรับจัดการหนี้สิน เงินกู้ยืม และการผ่อนชำระคืน

**Access Control:**

- **HR:** สร้างคำขอเงินกู้ (Draft), ดูรายการ, บันทึกการคืนเงิน (Draft)
- **Admin:** ทำได้ทุกอย่าง และมีสิทธิ์ **อนุมัติ (Approve)** รายการเพื่อให้มีผลหักเงินเดือนจริง

### 14.1 Create Loan with Schedule

สร้างรายการเงินกู้พร้อมกำหนดตารางผ่อนชำระในครั้งเดียว (สะดวกกว่าการสร้างทีละงวด)

- **Endpoint:** `POST /debt-txns/create-plan`
- **Access:** Admin, HR

**Request Body Example:**

กรณีเงินกู้ - Loan:

```json
{
  "employeeId": "019aa095-7c43-7388-be88-f24681d5a3f3",
  "txnType": "loan", // <--- ระบุประเภท
  "txnDate": "2025-11-21",
  "amount": 12000.0,
  "reason": "กู้ซ่อมแซมบ้าน",
  "installments": [
    {
      "amount": 4000.0,
      "payrollMonthDate": "2025-12-01"
    },
    {
      "amount": 4000.0,
      "payrollMonthDate": "2026-01-01"
    },
    {
      "amount": 4000.0,
      "payrollMonthDate": "2026-02-01"
    }
  ]
}
```

กรณีหนี้สินอื่น - Other

```json
{
  "employeeId": "019aa...",
  "txnType": "other",         // <--- ระบุประเภท
  "otherDesc": "ค่าปรับทำอุปกรณ์เสียหาย", // <--- บังคับใส่ (Map เข้า other_desc)
  "txnDate": "2025-11-21",
  "amount": 5000.00,
  "installments": [...]
}
```

**Request Fields:**

| **ชื่อ (Name)**                   | **คำอธิบาย**                                  | **ประเภท** | **Required**            | **ตัวอย่าง**                            |
| --------------------------------- | --------------------------------------------- | ---------- | ----------------------- | --------------------------------------- |
| `employeeId`                      | รหัสพนักงาน                                   | UUID       | **Yes**                 | `"019aa..."`                            |
| `txnType`                         | ประเภท "เงินกู้" กับ "หนี้สินอื่นๆ”           | String     | **Yes**                 | `"loan"` หรือ `"other"`                 |
| `otherDesc`                       | คำอธิบาย                                      | String     | **Yes if other**        | `"ค่าปรับทำอุปกรณ์เสียหาย"`             |
| `txnDate`                         | วันที่ทำรายการกู้                             | Date       | **Yes**                 | `"2025-11-21"`                          |
| `amount`                          | ยอดเงินกู้รวม (Principal)                     | Number     | **Yes**                 | `12000.00`                              |
| `reason`                          | เหตุผลการกู้                                  | String     | No                      | `"ซ่อมบ้าน"`                            |
| `installments`                    | ตารางผ่อนชำระ (สามารถส่ง `[]` ถ้ายังไม่กำหนด) | Array      | **Yes**                 | `[...]`                                 |
| `installments[].amount`           | ยอดที่จะหักในงวดนั้น                          | Number     | **Yes if installments** | `4000.00`                               |
| `installments[].payrollMonthDate` | งวดเดือนที่จะหักเงิน                          | Date       | **Yes if installments** | `"2025-12-01"` (ต้องเป็นวันแรกของเดือน) |

**Logic (Backend):**

1. อนุญาตให้ `installments` เป็น Array ว่าง `[]` ได้ (กรณียังไม่ตั้งงวดผ่อน)
2. ถ้ามีการส่ง `installments` (จำนวนงวด > 0) ให้บังคับว่า `amount` (ยอดกู้) ต้องเท่ากับผลรวม `installments[].amount`
3. ตรวจสอบว่า `installments[].payrollMonthDate` (ถ้ามี) ต้องเป็น **วันแรกของเดือน** เสมอ
4. สร้าง Transaction หลัก (`txn_type` ตามที่ส่ง `loan/other`) สถานะ `pending`
5. ถ้ามีงวดผ่อนที่ส่งมา ให้สร้างรายการลูก (`txn_type = 'installment'`) ตามจำนวนงวด สถานะ `pending` โดยผูก `parent_id` กับรายการหลัก

**Success Response (201 Created):**

```json
{
  "id": "019dd222-3333-...",
  "employeeId": "019aa095-...",
  "status": "pending",
  "message": "Loan request created with 3 installments."
}
```

**Error Responses:**

| **HTTP Status** | **Title**   | **Description**                                 |
| --------------- | ----------- | ----------------------------------------------- |
| **400**         | Bad Request | ยอดรวมผ่อนชำระไม่เท่ากับยอดกู้ หรือข้อมูลไม่ครบ |
| **404**         | Not Found   | ไม่พบพนักงาน                                    |

---

### 14.2 List Debt Transactions

ดูรายการหนี้สินและประวัติการชำระ

- **Endpoint:** `GET /debt-txns`
- **Access:** Admin, HR
- **Query Parameters:**
  - `employeeId`: (UUID) กรองรายคน
  - `type`: (string) `loan`, `repayment`, `all` (**default: all; ตัด `installment` ออกอัตโนมัติ**)
  - `status`: (string) `pending`, `approved`
  - `startDate`, `endDate`: (date) กรองตาม `txnDate`

**Success Response Example (200 OK):**

```json
{
  "data": [
    {
      "id": "019dd222-3333-...",
      "employeeId": "019aa095-...",
      "employeeName": "นางสาวสมหญิง ใจดี",
      "txnDate": "2025-11-21",
      "txnType": "loan",
      "amount": 12000.00,
      "status": "pending",
      "reason": "กู้ซ่อมแซมบ้าน",
      "installments": [
        {
          "id": "019dd222-aaaa-...",
          "payrollMonthDate": "2025-12-01",
          "amount": 4000.00,
          "status": "pending"
        },
        {
          "id": "019dd222-bbbb-...",
          "payrollMonthDate": "2026-01-01",
          "amount": 4000.00,
          "status": "pending"
        }
      ]
    }
  ],
  "meta": { ... }
}
```

**หมายเหตุสำคัญ:**

- รายการที่มี `txnType = "installment"` จะถูกกรองออกจากรายการหลักอัตโนมัติในโหมด `type=all` (ยังสามารถกรองเฉพาะ installment ได้หากจำเป็นในภายหลัง)
- สำหรับ `loan` หรือ `other` ที่มีแผนผ่อนชำระ จะมี `installments` array แสดงรายละเอียดงวดผ่อน
- UI ควรแสดงเป็น "เงินกู้ (การผ่อนชำระ)" เมื่อมี installments

---

### 14.3 Get Loan Detail

ดูรายละเอียดเงินกู้ พร้อมตารางผ่อนชำระ

- **Endpoint:** `GET /debt-txns/{id}`
- **Access:** Admin, HR
- **Params:** `id` (UUIDv7 ของรายการ Loan)

**Success Response Example (200 OK):**

```json
{
  "id": "019dd222-3333-...",
  "employeeId": "019aa095-...",
  "employeeName": "นางสาวสมหญิง ใจดี",
  "txnDate": "2025-11-21",
  "txnType": "loan",
  "amount": 12000.0,
  "reason": "กู้ซ่อมแซมบ้าน",
  "status": "pending",
  "installments": [
    {
      "id": "019dd222-aaaa-...",
      "payrollMonthDate": "2025-12-01",
      "amount": 4000.0,
      "status": "pending" // pending=รอหัก, approved=หักแล้ว
    },
    {
      "id": "019dd222-bbbb-...",
      "payrollMonthDate": "2026-01-01",
      "amount": 4000.0,
      "status": "pending"
    }
  ]
}
```

**Error Responses:**

| **HTTP Status** | **Title** | **Description**    |
| --------------- | --------- | ------------------ |
| **404**         | Not Found | ไม่พบรายการเงินกู้ |

---

### 14.4 Get Outstanding Installments (Pending)

ดึงยอดผ่อนชำระที่ยังคงค้าง (สถานะ `pending`) ของพนักงาน พร้อมรายละเอียดงวด

- **Endpoint:** `GET /debt-txns/{employeeId}/outstanding-installments`
- **Access:** Admin, HR
- **Params:** `employeeId` (UUIDv7)

**Success Response Example (200 OK):**

```json
{
  "employeeId": "019aa095-...",
  "employeeName": "นางสาวสมหญิง ใจดี",
  "outstandingAmount": 8000.0,
  "installments": [
    {
      "id": "019dd222-aaaa-...",
      "payrollMonthDate": "2025-12-01",
      "amount": 4000.0,
      "status": "pending"
    },
    {
      "id": "019dd222-bbbb-...",
      "payrollMonthDate": "2026-01-01",
      "amount": 4000.0,
      "status": "pending"
    }
  ],
  "meta": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 2
  }
}
```

**Notes:**

- คืนเฉพาะรายการ `txn_type = installment` ที่ `status = pending`
- ยอด `outstandingAmount` คือผลรวมของ `amount` ทุกงวดในลิสต์

---

### 14.5 Approve Loan (Admin Only)

อนุมัติเงินกู้ (เมื่ออนุมัติแล้ว งวดผ่อนชำระจะเริ่มมีผลบังคับใช้ใน Payroll)

- **Endpoint:** `POST /debt-txns/{id}/approve`
- **Access:** **Admin Only**
- **Params:** `id` (UUIDv7 ของ Loan)

**Logic:**

1. เปลี่ยนสถานะ Parent (`loan` หรือ `other`) เป็น `approved`
2. **ไม่อนุมัติรายการผ่อน (`installments`) ให้อัตโนมัติ** งวดผ่อนจะถูกอนุมัติทีละงวดตามกระบวนการ Payroll (เมื่อถึง payrollMonthDate ของงวดนั้น)
3. (Optional) ระบบอาจจะล็อกไม่ให้แก้ไขรายการลูก (`installments`) ผ่าน API ปกติ ยกเว้นจะใช้ API ปรับปรุงหนี้โดยเฉพาะ

**Success Response (200 OK):**

```json
{
  "id": "019dd222-3333-...",
  "status": "approved",
  "approvedAt": "2025-11-22T09:00:00Z",
  "message": "Loan approved. Installments are now active."
}
```

**Error Responses:**

| **HTTP Status** | **Title**   | **Description**                                       |
| --------------- | ----------- | ----------------------------------------------------- |
| **400**         | Bad Request | รายการนี้ถูกอนุมัติไปแล้ว หรือไม่ใช่รายการประเภท Loan |
| **403**         | Forbidden   | ผู้ใช้งานเป็น HR                                      |

---

### 14.5 Manual Repayment

บันทึกการคืนเงินสด (โปะหนี้) นอกเหนือจากการหักผ่านเงินเดือน

- **Endpoint:** `POST /debt-txns/repayment`
- **Access:** Admin (รับเงิน), HR (บันทึกช่วย)

**Request Body Example:**

```json
{
  "employeeId": "019aa095-...",
  "txnDate": "2025-12-15",
  "amount": 2000.0,
  "reason": "พนักงานนำเงินสดมาคืนบางส่วน"
}
```

**Request Fields:**

| **ชื่อ (Name)** | **คำอธิบาย**  | **ประเภท** | **Required** | **ตัวอย่าง**   |
| --------------- | ------------- | ---------- | ------------ | -------------- |
| `employeeId`    | รหัสพนักงาน   | UUID       | **Yes**      | `"019aa..."`   |
| `txnDate`       | วันที่รับเงิน | Date       | **Yes**      | `"2025-12-15"` |
| `amount`        | ยอดเงินที่คืน | Number     | **Yes**      | `2000.00`      |
| `reason`        | หมายเหตุ      | String     | No           | `"คืนเงินสด"`  |

**Success Response (201 Created):**

```json
{
  "id": "019ee555-...",
  "txnType": "repayment",
  "status": "approved", // ปกติคืนเงินสดถือว่าสำเร็จเลย หรือจะ Pending รอ Admin กดรับก็ได้
  "amount": 2000.0
}
```

---

### 14.6 Delete/Cancel Loan

ยกเลิกรายการกู้ (ทำได้เฉพาะเมื่อสถานะ `pending`)

- **Endpoint:** `DELETE /debt-txns/{id}`
- **Access:** Admin, HR
- **Params:** `id` (UUIDv7 ของ Loan)

**Logic:**

- Database มี Trigger `debt_txn_cascade_soft_delete_children` อยู่แล้ว การลบ Parent จะลบ Installments ให้โดยอัตโนมัติ
- ถ้าสถานะเป็น `approved` แล้ว Database Trigger จะป้องกันไม่ให้ลบ (ต้องใช้ API พิเศษ หรือ Manual Adjustment ถ้าจำเป็น)

**Success Response:**

- **Status:** `204 No Content`

**Error Responses:**

| **HTTP Status** | **Title**   | **Description**              |
| --------------- | ----------- | ---------------------------- |
| **400**         | Bad Request | รายการอนุมัติไปแล้ว ลบไม่ได้ |
| **404**         | Not Found   | ไม่พบรายการ                  |

---

### ตารางสรุป JSON Response Fields (สำหรับ List & Detail)

| **ชื่อฟิลด์**      | **ประเภท** | **คำอธิบาย**                                  |
| ------------------ | ---------- | --------------------------------------------- |
| `txnType`          | Enum       | `loan`, `installment`, `repayment`            |
| `amount`           | Number     | ยอดเงิน (ถ้าเป็น Installment คือยอดหักต่องวด) |
| `payrollMonthDate` | Date       | (เฉพาะ Installment) เดือนที่จะหักเงินเดือน    |
| `status`           | Enum       | `pending`, `approved`                         |
| `parent_id`        | UUID       | (เฉพาะ Installment) อ้างอิงถึงเงินกู้ก้อนไหน  |

---

## 15. Master Data

ข้อมูลอ้างอิงสำหรับใช้ในฟอร์มสร้างพนักงานและธุรกรรมต่างๆ (ดึงจากตาราง person_title, employee_type, id_document_type)

**Access Control:** Authenticated (`admin`, `hr`)

### 15.1 Get All Master Data

- **Endpoint:** `GET /master/all`
- **Access:** Admin, HR
- **Data Source:** ดึงข้อมูลจากตาราง `person_title`, `employee_type`, `id_document_type`

**Success Response Example (200 OK):**

```json
{
  "personTitles": [
    { "id": "019a1...", "code": "mr", "name": "นาย" },
    { "id": "019a2...", "code": "mrs", "name": "นาง" },
    { "id": "019a3...", "code": "ms", "name": "นางสาว" }
  ],
  "employeeTypes": [
    { "id": "019a4...", "code": "full_time", "name": "พนักงานประจำ" },
    { "id": "019a5...", "code": "part_time", "name": "พนักงานชั่วคราว" }
  ],
  "idDocumentTypes": [
    { "id": "019a6...", "code": "citizen_id", "name": "บัตรประชาชน" },
    { "id": "019a7...", "code": "passport", "name": "หนังสือเดินทาง" }
  ]
}
```

**Response Fields:**

| **ชื่อ (Name)**     | **ประเภท (Type)** | **คำอธิบาย (Description)**     |
| ------------------- | ----------------- | ------------------------------ |
| `personTitles[]`    | Array             | คำนำหน้า (นาย/นาง/นางสาว)      |
| `employeeTypes[]`   | Array             | ประเภทพนักงาน (ประจำ/ชั่วคราว) |
| `idDocumentTypes[]` | Array             | ประเภทเอกสารยืนยันตัวตน        |
| `*.id`              | UUID              | ไอดีของ master record          |
| `*.code`            | String            | รหัสย่อของรายการ               |
| `*.name`            | String            | ชื่อภาษาไทย                    |

---

### 15.2 List Person Titles

- **Endpoint:** `GET /master/person-titles`
- **Access:** Admin, HR

**Success Response Example (200 OK):**

```json
[
  { "id": "019a1...", "code": "mr", "name": "นาย" },
  { "id": "019a2...", "code": "mrs", "name": "นาง" },
  { "id": "019a3...", "code": "ms", "name": "นางสาว" }
]
```

---

### 15.3 List Employee Types

- **Endpoint:** `GET /master/employee-types`
- **Access:** Admin, HR

**Success Response Example (200 OK):**

```json
[
  { "id": "019a4...", "code": "full_time", "name": "พนักงานประจำ" },
  { "id": "019a5...", "code": "part_time", "name": "พนักงานชั่วคราว" }
]
```

---

### 15.4 List ID Document Types

- **Endpoint:** `GET /master/id-document-types`
- **Access:** Admin, HR

**Success Response Example (200 OK):**

```json
[
  { "id": "019a6...", "code": "citizen_id", "name": "บัตรประชาชน" },
  { "id": "019a7...", "code": "passport", "name": "หนังสือเดินทาง" }
]
```

---

## 16. Payroll Processing

กลุ่ม API สำหรับสร้างงวดการจ่ายเงิน, ตรวจสอบสลิปเงินเดือน, แก้ไขยอดก่อนจ่าย, และอนุมัติการจ่าย

**Access Control:**

- **HR:** สร้างงวด (Draft), ตรวจสอบรายการ, แก้ไขยอดรายคน (Prepare Data)
- **Admin:** ทำได้ทุกอย่าง และมีสิทธิ์ **อนุมัติ (Approve)** เพื่อปิดงวดบัญชี

### 16.1 List Payroll Runs

ดูประวัติงวดการจ่ายเงินเดือนทั้งหมด

- **Endpoint:** `GET /payroll-runs`
- **Access:** Admin, HR
- **Query Parameters:**
  - `page`, `limit`: Pagination
  - `year`: (int) กรองตามปีของ `payrollMonthDate`
  - `monthDate`: (date, YYYY-MM-DD) ใช้เดือน/ปี จากค่านี้ไปกรอง `payrollMonthDate` (ถ้ามี `monthDate` จะใช้ค่านี้ แม้จะไม่ได้ส่ง `year`)
  - `status`: `pending`, `approved`, `all`

**Success Response Example (200 OK):**

```json
{
  "data": [
    {
      "id": "019ee123-4567-...",
      "payrollMonthDate": "2025-11-01", // งวดเดือน พ.ย.
      "periodStartDate": "2025-10-01",  // รอบคิดเงิน 1-31 ต.ค.
      "payDate": "2025-11-30",          // วันเงินเข้า
      "status": "pending",
      "totalEmployees": 150,            // (Count Items)
      "totalNetPay": 4500000.00,        // (Sum Items)
      "createdAt": "2025-11-25T10:00:00Z"
    }
  ],
  "meta": { ... }
}
```

---

### 16.2 Create Payroll Run (Start Process)

สร้างงวดการจ่ายเงินใหม่

- **Endpoint:** `POST /payroll-runs`
- **Access:** Admin, HR

Logic (Database Trigger):

ทันทีที่สร้างสำเร็จ Trigger payroll_run_generate_items จะทำงาน:

1. ดึงพนักงาน Active ทุกคน
2. คำนวณเงินเดือน, OT, หักสาย/ลา จาก `worklog`
3. ดึงหนี้สิน (`debt`) และเงินเบิก (`advance`) มาตั้งรอหัก
4. สร้าง Row ใน `payroll_run_item` ให้ครบทุกคน

**Request Body Example:**

```json
{
  "payrollMonthDate": "2025-11-01", // งวดบัญชี (ต้องเป็นวันที่ 1)
  "periodStartDate": "2025-10-01", // วันเริ่มนับเวลาทำงาน
  "payDate": "2025-11-30", // วันที่จ่ายจริง
  "socialSecurityRateEmployee": 0.05, // เรทประกันสังคมที่ใช้ในงวดนี้ (Snapshot)
  "socialSecurityRateEmployer": 0.05
}
```

**Success Response (201 Created):**

```json
{
  "id": "019ee123-4567-...",
  "payrollMonthDate": "2025-11-01",
  "periodStartDate": "2025-10-01",
  "payDate": "2025-11-30",
  "status": "pending",
  "socialSecurityRateEmployee": 0.05,
  "socialSecurityRateEmployer": 0.05,
  "createdAt": "2025-11-25T10:00:00Z",
  "updatedAt": "2025-11-25T10:00:00Z",
  "message": "Payroll run created. System is generating payslips."
}
```

**Error Responses:**

- `409 Conflict`: เดือนนี้มีการสร้าง Payroll Run ไปแล้ว (Unique Constraint)

---

### 16.3 Get Payroll Run Detail

ดูข้อมูลหัวบิล (Header) และสรุปยอดรวม

- **Endpoint:** `GET /payroll-runs/{id}`
- **Access:** Admin, HR

**Success Response (200 OK):**

```json
{
  "id": "019ee123-4567-...",
  "payrollMonthDate": "2025-11-01",
  "periodStartDate": "2025-10-01",
  "payDate": "2025-11-30",
  "status": "pending",
  "approvedAt": null,
  "totals": {
    "totalIncome": 5000000.0,
    "totalDeduction": 500000.0,
    "totalNetPay": 4500000.0
  }
}
```

---

### 16.4 Update Payroll Run (Approve)

แก้ไขวันที่จ่าย หรือ **อนุมัติงวดบัญชี**

- **Endpoint:** `PATCH /payroll-runs/{id}`
- **Access:** Admin Only (สำหรับการ Approve), HR (แก้ Note/Date)

**Logic การอนุมัติ (`status: approved`):**

1. Trigger `payroll_run_guard_update` ตรวจสอบสิทธิ์
2. Trigger `payroll_run_on_approve_actions` (ที่เราเพิ่งเขียน) ทำงาน:
   - เปลี่ยนสถานะ `worklog` -> `approved`
   - ตัดยอด `salary_advance` -> `processed`
   - ตัดยอด `debt_txn` -> `approved`
   - อัปเดตยอดสะสม `payroll_accumulation`
3. ข้อมูลทั้งหมดใน `payroll_run_item` ถูกล็อก

**Request Body Example:**

```json
{
  "status": "approved",
  "payDate": "2025-11-29" // แก้วันจ่ายได้ถ้ายังไม่ approve
}
```

**Success Response (200 OK):**

```json
{
  "id": "019ee123-4567-...",
  "status": "approved",
  "approvedAt": "2025-11-28T09:00:00Z",
  "message": "Payroll approved successfully. All related records updated."
}
```

---

### 16.5 List Payroll Items (Payslips)

ดึงรายการสลิปเงินเดือนของพนักงานในงวดนั้นๆ

- **Endpoint:** `GET /payroll-runs/{id}/items`
- **Access:** Admin, HR
- **Query Parameters:**
  - `search`: ค้นหาชื่อพนักงาน **หรือ** รหัสพนักงาน (`employeeNumber`)
  - `employeeTypeCode`: กรองตามประเภทพนักงาน (`full_time` หรือ `part_time`)
  - `limit`, `page`: Pagination

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "019ff111-...",
      "employeeId": "019aa095-...",
      "employeeNumber": "EMP-001",
      "employeeTypeCode": "full_time",
      "employeeName": "สมชาย ศรีสุข",
      "salaryAmount": 30000.0,
      "leaveCompensationAmount": 200.0,
      "incomeTotal": 35000.0,
      "deductionTotal": 1500.0,
      "netPay": 33500.0 // (Income - Deduction) - Calculated in DB
    }
  ]
}
```

**หมายเหตุ:** ระบบจะเรียงผลลัพธ์โดย `employeeTypeCode` (full_time ก่อน part_time) จากนั้นตาม `employeeNumber` แล้วชื่อพนักงาน

---

### 16.6 Get Payslip Detail

ดูรายละเอียดรายรับ-รายจ่าย ของพนักงาน 1 คน (เพื่อตรวจสอบความถูกต้อง)

- **Endpoint:** `GET /payroll-items/{id}`
- **Access:** Admin, HR (Admin/HR ดูของทุกคน, User ดูของตัวเองผ่าน API อื่น)
- **Params:** `id` (UUIDv7 ของ Item)

**Success Response (Full Payslip Detail):**

```json
{
  "id": "019ff111-...",
  "employee": { "id": "...", "name": "สมชาย", "bankAccount": "..." },
  "earnings": {
    "salary": 30000.0,
    "ot": 2500.0,
    "bonus": 0.0,
    "leaveCompensationAmount": 200.0,
    "housingAllowance": 1000.0,
    "attendanceBonus": 500.0,
    "waterRatePerUnit": 10.0,
    "electricityRatePerUnit": 6.0,
    "others": [
      // JSONB others_income
      { "description": "ค่าคอมมิชชั่น", "amount": 1000.0 }
    ],
    "total": 35000.0
  },
  "deductions": {
    "tax": 500.0,
    "sso": 750.0,
    "providentFund": 900.0,
    "absence": 0.0, // late + leave deduction
    "loan": 2000.0, // advance + loan repayment
    "total": 4150.0
  },
  "netPay": 30850.0
}
```

---

### 16.7 Update Payslip (Adjustments)

แก้ไขยอดเงินในสลิปรายคน (กรณีระบบคำนวณไม่ตรง หรือมีรายรับพิเศษ)

- **Endpoint:** `PATCH /payroll-items/{id}`
- **Access:** Admin, HR

**Logic:**

- เมื่อมีการแก้ไขค่าใดๆ Trigger `payroll_run_item_compute_totals` ใน DB จะทำงานใหม่ เพื่อรวมยอด `incomeTotal`, `netPay` ให้ทันที
- แก้ไขได้เฉพาะเมื่อ `payroll_run.status` = `pending`
- ถ้า `advanceAmount` = 0 แต่ส่ง `advanceRepayAmount` > 0 จะถูกปฏิเสธ (400)
- ถ้า `loanOutstandingTotal` = 0 แต่ส่ง `loanRepayments` ที่มีค่า จะถูกปฏิเสธ (400)

**Request Body Example:**

```json
{
  "salaryAmount": 30000.0, // แก้ฐานเงินเดือนเฉพาะเดือนนี้
  "othersIncome": [
    // เพิ่มรายได้อื่นๆ
    { "description": "ค่าคอมมิชชั่น", "value": 5000.0 }
  ],
  "taxMonthAmount": 800.0 // Override ภาษี (ถ้าคำนวณมือมา)
}
```

**Success Response (204 No Content):**

- ไม่มี Body

**Error Responses:**

- `400 Bad Request`: งวดบัญชีถูกอนุมัติไปแล้ว (แก้ไขไม่ได้)

---

### 16.8 Delete Payroll Run

ลบงวดการจ่ายเงิน (ทำได้เฉพาะสถานะ Processing/Pending)

- **Endpoint:** `DELETE /payroll-runs/{id}`
- **Access:** **Admin Only**

**Logic:**

- การลบ Payroll Run จะลบ Items ทั้งหมด (Cascade)
- ข้อมูล Worklog, Advance, Debt ที่เคยถูกดึงมา จะยังคงอยู่ (เพราะสถานะพวกนั้นยังเป็น Pending อยู่ ตราบใดที่ Payroll ยังไม่ Approved) ทำให้สามารถสร้าง Payroll Run ใหม่ได้ทันที

**Success Response:** `204 No Content`

---

### ตารางสรุป JSON Response Fields (16.6 Payslip Detail)

| **Group**     | **Field (JSON)**   | **Mapped DB Column**                       |
| ------------- | ------------------ | ------------------------------------------ |
| **Income**    | `salary`           | `salary_amount`                            |
|               | `ot`               | `ot_amount`                                |
|               | `bonus`            | `bonus_amount`                             |
|               | `housingAllowance` | `housing_allowance`                        |
|               | `attendanceBonus`  | `attendance_bonus_nolate` + `_noleave`     |
|               | `others`           | `others_income` (JSONB)                    |
| **Deduction** | `tax`              | `tax_month_amount`                         |
|               | `sso`              | `sso_month_amount`                         |
|               | `providentFund`    | `pf_month_amount`                          |
|               | `late`             | `late_minutes_deduction`                   |
|               | `leave`            | `leave_..._deduction`                      |
|               | `loan`             | `loan_repayments` (Sum from JSON)          |
|               | `advance`          | `advance_repay_amount`                     |
|               | `utilities`        | `water_` + `electric_` + `internet_amount` |
