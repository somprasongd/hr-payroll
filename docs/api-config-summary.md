# API Configuration - Summary

## ✅ สรุปการแก้ไข API Configuration

### 1. ไฟล์ Configuration ที่สร้าง

#### `web/src/config/api.ts`

- สร้างไฟล์ config สำหรับ API base URL
- รองรับ environment variables
- มี default values ตาม NODE_ENV (dev/prod)

```typescript
export const API_CONFIG = {
  baseURL:
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === "production"
      ? "/api/v1"
      : "http://localhost:8080/api/v1"),
  timeout: 30000,
};
```

### 2. API Client

#### `web/src/lib/api-client.ts`

- สร้าง centralized HTTP client
- รองรับ authentication (auto-inject token)
- จัดการ errors แบบ structured
- มี timeout protection
- รองรับ methods: GET, POST, PUT, PATCH, DELETE

### 3. Services ที่สร้าง

#### `web/src/services/auth.service.ts`

- `login(credentials)` - เข้าสู่ระบบ
- `logout()` - ออกจากระบบ
- `me()` - ดึงข้อมูล user ปัจจุบัน

#### `web/src/services/payroll-config.service.ts`

- `getEffective()` - ดึง config ที่ใช้งานอยู่
- `getAll()` - ดึง config history ทั้งหมด
- `getById(id)` - ดึง config ตาม ID
- `create(data)` - สร้าง config ใหม่

#### `web/src/services/index.ts`

- Export point สำหรับ import services ทั้งหมด

### 4. การแก้ไข Login Page

#### `web/src/app/[locale]/page.tsx`

- ✅ เชื่อมต่อกับ API จริงแทน mock data
- ✅ ใช้ `authService.login()`
- ✅ แสดง error message เมื่อ login ไม่สำเร็จ
- ✅ รองรับ multi-language error messages (th, en, my)

### 5. Environment Variables

#### `.env.local.example`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

#### `.env.local` (สร้างแล้ว สำหรับ development)

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

### 6. Documentation

#### `docs/api-configuration.md`

- คู่มือการใช้งาน API configuration
- วิธี setup environment variables
- ตัวอย่างการใช้งาน API client และ services
- Troubleshooting guide
- Proxy configuration สำหรับ production

#### `web/src/services/README.md`

- คู่มือการสร้าง services ใหม่
- ตัวอย่างการใช้งาน services
- Best practices สำหรับการเขียน services

### 7. Translation Updates

เพิ่ม error messages ใน:

- ✅ `web/src/messages/th.json` - "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน"
- ✅ `web/src/messages/en.json` - "Login failed. Please check your username and password"
- ✅ `web/src/messages/my.json` - "အကောင့်ဝင်ရန် မအောင်မြင်ပါ။ သင့်အသုံးပြုသူအမည်နှင့် စကားဝှက်ကို စစ်ဆေးပါ"

## 🎯 การใช้งาน

### Development

```bash
# ตั้งค่า .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1

# รัน dev server
npm run dev
```

### Production (Behind Proxy)

```bash
# ตั้งค่า .env.production
NEXT_PUBLIC_API_BASE_URL=/api/v1

# Build
npm run build

# Start
npm start
```

### Production (Different Domain)

```bash
# ตั้งค่า .env.production
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1

# Build & Start
npm run build && npm start
```

## 📦 โครงสร้างไฟล์ที่เกี่ยวข้อง

```
web/
├── .env.local.example          # ตัวอย่าง env config
├── .env.local                  # Dev environment config (gitignored)
├── src/
│   ├── config/
│   │   └── api.ts              # API configuration
│   ├── lib/
│   │   └── api-client.ts       # HTTP client
│   ├── services/
│   │   ├── README.md           # Services documentation
│   │   ├── index.ts            # Export point
│   │   ├── auth.service.ts     # Authentication service
│   │   └── payroll-config.service.ts  # Payroll config service
│   ├── messages/
│   │   ├── th.json             # Thai translations (updated)
│   │   ├── en.json             # English translations (updated)
│   │   └── my.json             # Myanmar translations (updated)
│   └── app/[locale]/
│       └── page.tsx            # Login page (updated)
└── docs/
    └── api-configuration.md    # API config documentation
```

## ✨ Features

1. **Flexible Configuration** - ตั้งค่า API base URL ได้ตาม environment
2. **Type Safety** - TypeScript interfaces สำหรับทุก API calls
3. **Error Handling** - จัดการ errors แบบ centralized
4. **Authentication** - Auto-inject bearer token ทุก requests
5. **Timeout Protection** - ป้องกัน requests ที่ค้างนาน
6. **Multi-language Support** - Error messages รองรับ 3 ภาษา
7. **Documentation** - มีเอกสารครบถ้วนสำหรับ developers

## 🔐 Security Notes

- ❌ **ห้าม** commit `.env.local` เข้า git
- ✅ ใช้ HTTPS ใน production
- ✅ Token เก็บใน localStorage (with zustand persist)
- ✅ CORS ต้องตั้งค่าที่ API server

## 🚀 Next Steps

1. **Settings Page** - อัพเดทให้ใช้ `payrollConfigService` แทน fetch โดยตรง
2. **Employee Service** - สร้าง service สำหรับจัดการพนักงาน
3. **Attendance Service** - สร้าง service สำหรับระบบเวลาทำงาน
4. **Report Service** - สร้าง service สำหรับ reports
5. **Error Boundary** - เพิ่ม error boundary สำหรับ catch API errors ใน component tree

## 📝 Example Usage

### Login Example

```typescript
import { authService } from "@/services/auth.service";

try {
  const response = await authService.login({
    username: "admin",
    password: "password123",
  });

  // Store in auth store
  login(response.user, response.token);

  // Redirect
  router.push("/dashboard");
} catch (err) {
  const error = err as ApiError;
  setError(error.message);
}
```

### Payroll Config Example

```typescript
import { payrollConfigService } from "@/services/payroll-config.service";

// Get effective config
const config = await payrollConfigService.getEffective();

// Create new config
await payrollConfigService.create({
  hourlyRate: 50,
  otHourlyRate: 75,
  // ... other fields
  effectiveDate: "2024-01-01",
});
```
