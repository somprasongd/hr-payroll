# Refresh Token & Protected Routes Implementation

## ✅ สรุปการทำงานที่เสร็จสมบูรณ์

### 1. **Refresh Token Support**

- อัพเดท auth store ให้รองรับ `refreshToken` และ `returnUrl`
- เพิ่ม `refreshToken` endpoint ใน auth service
- สร้าง axios instance พร้อม interceptors สำหรับ auto-refresh

### 2. **Protected Routes**

- สร้าง `ProtectedRoute` component สำหรับตรวจสอบ authentication
- อัพเดท dashboard layout ให้ใช้ `ProtectedRoute`
- ทุกหน้าภายใต้ dashboard layout จะได้รับการป้องกันอัตโนมัติ

### 3. **Return URL**

- จำหน้าจอเดิมก่อน redirect ไป login
- หลังจาก login สำเร็จจะ redirect กลับไปหน้าเดิม

## 📁 ไฟล์ที่สร้าง/แก้ไข

### สร้างใหม่

1. ✅ `web/src/lib/axios.ts` - Axios instance with interceptors
2. ✅ `web/src/components/protected-route.tsx` - Protected route component

### แก้ไข

3. ✅ `web/src/store/auth-store.ts` - เพิ่ม refreshToken และ returnUrl
4. ✅ `web/src/services/auth.service.ts` - เพิ่ม refreshToken endpoint
5. ✅ `web/src/app/[locale]/page.tsx` - รองรับ refreshToken และ returnUrl
6. ✅ `web/src/app/[locale]/dashboard/layout.tsx` - ใช้ ProtectedRoute
7. ✅ `web/src/app/[locale]/settings/page.tsx` - ลบ manual auth check

## 🎯 การทำงานของระบบ

### Login Flow

1. User พยายามเข้า protected page `/settings`
2. `ProtectedRoute` ตรวจจับว่ายังไม่ได้ login
3. บันทึก `/settings` ใน `returnUrl`
4. Redirect ไป `/` (login page)
5. User login สำเร็จ
6. Redirect กลับไป `/settings`

### Token Refresh Flow

1. User เรียก API ด้วย access token ที่หมดอายุ
2. Server ตอบ 401 Unauthorized
3. Axios interceptor ตรวจจับ 401
4. เรียก `/auth/refresh` ด้วย refresh token
5. ได้ access token ใหม่
6. Retry request ที่ล้มเหลวด้วย token ใหม่
7. ถ้า refresh token หมดอายุ → logout + redirect to login

## 📝 การใช้งาน

### Protected Page

```tsx
// ไม่ต้องเช็ค auth เอง
export default function MyPage() {
  return <div>My Protected Page</div>;
}
```

### Logout

```tsx
const { logout } = useAuthStore();
logout(); // Clears all auth data
router.push("/");
```

## 🔗 Related Documentation

- `docs/api-configuration.md` - API setup
- `docs/auth-troubleshooting.md` - Troubleshooting guide
