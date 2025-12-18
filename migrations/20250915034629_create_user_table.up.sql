CREATE DOMAIN user_role AS TEXT
  CONSTRAINT user_role_check CHECK (VALUE IN ('hr','admin'));

-- -- เพิ่มค่าใหม่ในอนาคต: แก้ที่ domain เดียว
-- ALTER DOMAIN user_role DROP CONSTRAINT user_role_check;
-- ALTER DOMAIN user_role ADD  CONSTRAINT user_role_check
--   CHECK (VALUE IN ('hr','admin','moderator'));

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuidv7(),
  username    TEXT    NOT NULL,
  password_hash TEXT  NOT NULL,
  user_role   user_role NOT NULL DEFAULT 'hr',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID  NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID  NULL REFERENCES users(id) ON DELETE SET NULL,
  deleted_at  TIMESTAMPTZ NULL,
  deleted_by  UUID  NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX users_username_active_ux
  ON users(username)  WHERE deleted_at IS NULL;

-- ดัชนีช่วย query ทั่วไป
CREATE INDEX users_created_by_idx ON users(created_by);
CREATE INDEX users_updated_by_idx ON users(updated_by);
CREATE INDEX users_deleted_by_idx ON users(deleted_by);
-- ถ้า list เฉพาะ active users บ่อย ๆ
CREATE INDEX users_active_created_at_idx
  ON users(created_at DESC) WHERE deleted_at IS NULL;

-- Trigger อัปเดต updated_at อัตโนมัติ
CREATE OR REPLACE FUNCTION set_updated_at() 
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Create admin user with role 'admin'
-- Password: 'changeme'
INSERT INTO users (username, password_hash, user_role)
  VALUES (
    'admin',
    '$argon2id$v=19$m=65536,t=3,p=4$vdCnms0qqpwQwsGkU9tONQ$/wvzZ56+cOqNU2AUQzQxmKAr0x+JrFCL7Qa1YeQxvpg',
    'admin'
  );

DO $$
DECLARE sys_id UUID;
BEGIN
  SELECT id INTO sys_id FROM users WHERE username = 'admin';
  IF sys_id IS NULL THEN
    RAISE EXCEPTION 'admin user not found';
  END IF;

  EXECUTE format('ALTER TABLE users ALTER COLUMN created_by SET DEFAULT %L::uuid', sys_id);
  EXECUTE format('ALTER TABLE users ALTER COLUMN updated_by SET DEFAULT %L::uuid', sys_id);
END $$;

-- ปรับ FK
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_created_by_fkey;
ALTER TABLE users ADD  CONSTRAINT users_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET DEFAULT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_updated_by_fkey;
ALTER TABLE users ADD  CONSTRAINT users_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET DEFAULT;

-- เอา id ของ admin user มาใช้เป็น default
UPDATE users u
SET created_by = id,
    updated_by = id
WHERE u.username='admin';

ALTER TABLE users
  ALTER COLUMN created_by SET NOT NULL,
  ALTER COLUMN updated_by SET NOT NULL;

-- =============================================
-- สร้างระบบป้องกัน: ต้องเป็น Admin เท่านั้นถึงจะสร้าง User ใหม่ได้
-- =============================================
-- ฟังก์ชันตรวจสอบสิทธิ์ก่อน Insert ลงตาราง users
CREATE OR REPLACE FUNCTION public.users_guard_create_policy() RETURNS trigger AS $$
DECLARE
    v_creator_role public.user_role;
BEGIN
    -- 1. ถ้าเป็นการสร้างโดย System (เช่น seed ข้อมูล หรือ created_by เป็น NULL/1 ในช่วงแรก) อาจจะอนุญาต
    -- แต่ถ้าระบบรันจริงแล้ว ต้องเช็คว่า created_by เป็นใคร
    
    IF NEW.created_by IS NULL THEN
        RAISE EXCEPTION 'created_by is required to identify the creator.';
    END IF;

    -- 2. ดึง Role ของคนที่ทำการสร้าง (Creator)
    SELECT user_role INTO v_creator_role 
    FROM public.users 
    WHERE id = NEW.created_by;

    -- 3. ถ้าคนสร้างไม่ใช่ admin ให้แจ้ง Error และยกเลิก
    IF v_creator_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can create new users. (User ID % is %)', NEW.created_by, v_creator_role;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ผูก Trigger กับตาราง users
CREATE TRIGGER tg_users_guard_create
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.users_guard_create_policy();

-- =============================================
-- สร้างตารางเก็บประวัติการเข้าใช้งาน (User Access Logs)
-- =============================================
CREATE TABLE public.user_access_logs (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    login_at timestamptz NOT NULL DEFAULT now(),
    ip_address text,
    user_agent text,
    status text NOT NULL DEFAULT 'success', -- เช่น 'success', 'failed_password'
    
    -- สร้าง Index เพื่อให้ดึง "ล่าสุด" ได้เร็วที่สุด
    CONSTRAINT user_access_logs_status_check CHECK (status IN ('success', 'failed', 'failed_password'))
);

-- Index สำหรับค้นหาประวัติของ user แต่ละคน โดยเรียงจากใหม่ไปเก่า
CREATE INDEX user_access_logs_lookup_idx ON public.user_access_logs (user_id, login_at DESC);

-- =============================================
-- สร้าง View เพื่อดู Users + Login ล่าสุดแบบง่ายๆ
-- =============================================
CREATE VIEW public.v_users_with_last_login AS
SELECT 
    u.id,
    u.username,
    u.user_role,
    u.created_at,
    -- ดึงเวลา Login ล่าสุดจากตาราง Logs
    (
        SELECT login_at 
        FROM public.user_access_logs l 
        WHERE l.user_id = u.id 
          AND l.status = 'success'
        ORDER BY l.login_at DESC 
        LIMIT 1
    ) as last_login_at
FROM public.users u
WHERE u.deleted_at IS NULL;
