# Token Not Saved in localStorage - Troubleshooting

## ❌ ปัญหา

หลัง login สำเร็จ:

- ✅ `refreshToken` ถูกเก็บใน localStorage
- ✅ `isAuthenticated` เป็น true
- ✅ `user` object มีข้อมูล
- ❌ **ไม่มี `token` (access token)**

## 🔍 สาเหตุที่เป็นไปได้

### 1. API Response ไม่มี `token` field

API อาจ return field name ต่างจาก code คาดหวัง:

```json
// ❌ Code คาดหวัง
{
  "token": "...",
  "refreshToken": "...",
  "user": {...}
}

// ✅ แต่ API อาจ return
{
  "accessToken": "...",  // ← ชื่อต่าง!
  "refreshToken": "...",
  "user": {...}
}
```

### 2. Time of Check

zustand persist อาจบันทึก state ก่อน localStorage.setItem() ทำงาน

## 🛠️ วิธีแก้ไข

### Step 1: เช็ค API Response

เปิด Browser Console แล้ว login ใหม่ จะเห็น:

```
[Login Response] {
  hasToken: true/false,  // ← ต้องเป็น true
  hasRefreshToken: true,
  hasUser: true,
  tokenPreview: "eyJhbG..."
}

[After Login] {
  localStorageToken: "eyJhbG...",  // ← ต้องมีค่า
  localStorageRefreshToken: "eyJhbG..."
}
```

### Step 2: ถ้า hasToken = false

แสดงว่า API **ไม่ได้ return `token`** หรือ **ชื่อ field ไม่ตรง**

**วิธีเช็ค API response จริง:**

```typescript
// ใน login handler เพิ่ม:
console.log("Raw API Response:", response);
```

### Step 3: แก้ไข Field Mapping (ถ้าจำเป็น)

ถ้า API return `accessToken` แทน `token`:

**แก้ไข `auth.service.ts`:**

```typescript
export interface LoginResponse {
  accessToken: string; // เปลี่ยนจาก token
  refreshToken: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}
```

**แก้ไข login handler:**

```typescript
// Old
login(response.user, response.token, response.refreshToken);

// New
login(response.user, response.accessToken, response.refreshToken);
```

### Step 4: Manual Fix (Temporary)

ถ้าต้องการ quick fix ชั่วคราว:

**Option A: เพิ่ม fallback**

```typescript
const token = response.token || response.accessToken;
const refreshToken = response.refreshToken;
login(response.user, token, refreshToken);
```

**Option B: Map response**

```typescript
const loginResponse = {
  token: response.accessToken, // map accessToken -> token
  refreshToken: response.refreshToken,
  user: response.user,
};
login(loginResponse.user, loginResponse.token, loginResponse.refreshToken);
```

## ✅ การตรวจสอบว่าแก้ไขถูกต้อง

### 1. เช็ค Browser Console

```
[Login Response] { hasToken: true ✅ }
[After Login] { localStorageToken: "eyJ..." ✅ }
```

### 2. เช็ค localStorage

```javascript
localStorage.getItem("token"); // ต้องมีค่า
localStorage.getItem("refreshToken"); // ต้องมีค่า
```

### 3. เช็ค Network Tab

API Response ควรมี:

```json
{
  "token": "eyJhbG...",  // or "accessToken"
  "refreshToken": "eyJhbG...",
  "user": {...}
}
```

### 4. เช็ค Axios Request

```
[Axios Request] {
  method: 'GET',
  url: '...',
  hasToken: true  // ← ต้องเป็น true
}
```

## 🎯 Expected Result

หลังแก้ไข:

- ✅ localStorage มี `token` key
- ✅ localStorage มี `refreshToken` key
- ✅ zustand state มี `token`, `refreshToken`, `user`
- ✅ axios requests มี Authorization header
- ✅ ไม่ได้ 401 error
- ✅ เข้า settings page ได้

## 🔗 Related Files

- `web/src/app/[locale]/page.tsx` - Login handler (มี debug logs)
- `web/src/services/auth.service.ts` - LoginResponse interface
- `web/src/store/auth-store.ts` - Login function
- `web/src/lib/axios.ts` - Request interceptor
