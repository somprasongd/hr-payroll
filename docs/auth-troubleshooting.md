# API Authentication Troubleshooting Guide

## ปัญหา: 401 Unauthorized

### อาการ

```
{"status":401,"method":"GET","path":"/api/v1/admin/payroll-configs"}
```

### สาเหตุ

User ยังไม่ได้ login หรือ token หมดอายุ

## ✅ การแก้ไข

### 1. เพิ่ม Debug Logging ใน API Client

**ไฟล์:** `web/src/lib/api-client.ts`

```typescript
// Debug logging (remove in production)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log("[API Client]", {
    method: options.method || "GET",
    url,
    hasToken: !!token,
    tokenPreview: token ? `${token.substring(0, 20)}...` : null,
  });
}
```

**ประโยชน์:**

- เช็คว่ามี token หรือไม่
- เช็คว่า URL ถูกต้องหรือไม่
- แสดง token preview (20 ตัวอักษรแรก)

### 2. ปรับปรุง Error Message สำหรับ 401

```typescript
// Better error message for 401
if (response.status === 401) {
  throw {
    message: error.message || "Authentication required. Please login.",
    statusCode: 401,
    errors: error.errors,
  } as ApiError;
}
```

### 3. เพิ่ม Authentication Guard ใน Settings Page

**ไฟล์:** `web/src/app/[locale]/settings/page.tsx`

```typescript
import { useRouter } from "@/i18n/routing";
import { useAuthStore } from "@/store/auth-store";

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
      return;
    }

    fetchEffectiveConfig();
    fetchConfigHistory();
  }, [isAuthenticated]);

  // Show loading or redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ... rest of component
}
```

## 🔍 วิธีตรวจสอบ Token

### 1. เช็ค localStorage

เปิด Browser Console:

```javascript
localStorage.getItem("token");
```

ผลลัพธ์ที่ควรเห็น:

- ถ้ามี token: `"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC..."`
- ถ้าไม่มี: `null`

### 2. เช็ค Zustand Store

เปิด React DevTools และดูที่ state:

```javascript
{
  user: { id: "1", username: "admin", role: "Admin" },
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...",
  isAuthenticated: true
}
```

### 3. เช็ค API Request Headers

เปิด Browser DevTools > Network tab > ดู request headers:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...
```

## 🎯 Flow การทำงาน

```
┌─────────────┐
│ User Login  │
└──────┬──────┘
       │
       ├── authService.login()
       │   └── POST /auth/login
       │       └── Response: { token, user }
       │
       ├── authStore.login(user, token)
       │   ├── localStorage.setItem('token', token)
       │   └── set({ user, token, isAuthenticated: true })
       │
       └── router.push('/dashboard')

┌──────────────────┐
│ Access Protected │
│      Page        │
└────────┬─────────┘
         │
         ├── Check isAuthenticated
         │   ├── false ──> Redirect to login
         │   └── true ──> Continue
         │
         ├── apiClient.get(endpoint)
         │   ├── Get token from localStorage
         │   ├── Add Authorization header
         │   └── Send request
         │
         └── Handle response/error
```

## 🐛 Debugging Steps

### Step 1: เช็คว่า Login สำเร็จหรือไม่

```typescript
// ใน login page, เช็ค response
const response = await authService.login(credentials);
console.log("Login response:", response);
console.log("Token saved:", localStorage.getItem("token"));
```

### Step 2: เช็ค Auth Store State

```typescript
// ใน Settings page
const { user, token, isAuthenticated } = useAuthStore();
console.log("Auth state:", { user, token, isAuthenticated });
```

### Step 3: เช็ค API Request

```typescript
// ดู [API Client] logs ใน console
[API Client] {
  method: 'GET',
  url: 'http://localhost:8080/api/v1/admin/payroll-configs/effective',
  hasToken: true,
  tokenPreview: 'eyJhbGciOiJIUzI1NiI...'
}
```

### Step 4: เช็ค Server Response

```bash
# ดู server logs
{"status":200,"method":"GET","path":"/api/v1/admin/payroll-configs/effective"}
# หรือ
{"status":401,"method":"GET","path":"/api/v1/admin/payroll-configs/effective"}
```

## 🔧 Solution Matrix

| อาการ                               | สาเหตุ               | วิธีแก้                                                     |
| ----------------------------------- | -------------------- | ----------------------------------------------------------- |
| `hasToken: false`                   | ยังไม่ได้ login      | Login ก่อนเข้าหน้า Settings                                 |
| `hasToken: true` แต่ได้ 401         | Token หมดอายุ        | Implement refresh token หรือ logout+login ใหม่              |
| `isAuthenticated: false`            | ไม่มี auth state     | ตรวจสอบว่า login function เรียก `authStore.login()` หรือไม่ |
| Request ไม่ส่ง Authorization header | apiClient config ผิด | ตรวจสอบ `api-client.ts` line 36                             |

## 💡 Best Practices

### 1. Protected Routes

ทุก protected pages ควรมี authentication guard:

```typescript
useEffect(() => {
  if (!isAuthenticated) {
    router.push("/");
  }
}, [isAuthenticated]);
```

### 2. Token Expiration Handling

จัดการกรณี token หมดอายุ:

```typescript
catch (err) {
  const error = err as ApiError;
  if (error.statusCode === 401) {
    // Clear auth state and redirect to login
    logout();
    router.push('/');
  }
}
```

### 3. Loading States

แสดง loading ระหว่างเช็ค authentication:

```typescript
if (!isAuthenticated) {
  return <Loader />;
}
```

## 📝 Checklist สำหรับ Protected Pages

- [ ] Import `useAuthStore` และ `useRouter`
- [ ] เช็ค `isAuthenticated` ใน `useEffect`
- [ ] Redirect ถ้าไม่ได้ authenticated
- [ ] แสดง loading state ระหว่าง check
- [ ] Handle 401 errors properly
- [ ] Clear auth state on logout

## 🔗 Related Files

- `web/src/lib/api-client.ts` - API client with authentication
- `web/src/store/auth-store.ts` - Authentication state management
- `web/src/services/auth.service.ts` - Authentication service
- `web/src/app/[locale]/page.tsx` - Login page
- `web/src/app/[locale]/settings/page.tsx` - Example protected page

## 🚀 Next Steps

1. **Implement Refresh Token** - Auto-refresh token เมื่อใกล้หมดอายุ
2. **Global Auth Guard** - สร้าง middleware สำหรับ protected routes
3. **Error Boundary** - จัดการ auth errors แบบ centralized
4. **Token Persistence** - เก็บ token ใน httpOnly cookie (more secure)
