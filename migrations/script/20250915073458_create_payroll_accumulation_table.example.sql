-- 1. กำหนดตัวแปร (เพื่อความสะดวกในการแก้ไขและป้องกันความผิดพลาด)
DO $$
DECLARE
    v_employee_code TEXT := 'EMP-001';  -- <--- แก้รหัสพนักงานที่นี่
    v_current_year  INT  := 2025;       -- <--- แก้ปีปัจจุบันที่นี่
    v_admin_username TEXT := 'admin';   -- <--- user ที่ทำการแก้ไข
    
    -- ตัวแปรสำหรับเก็บ ID (ไม่ต้องแก้)
    v_emp_id UUID;
    v_admin_id UUID;
BEGIN
    -- ดึง ID พนักงานจากรหัส
    SELECT id INTO v_emp_id FROM public.employees WHERE employee_number = v_employee_code;
    
    -- ดึง ID ของ Admin
    SELECT id INTO v_admin_id FROM public.users WHERE username = v_admin_username;

    -- ตรวจสอบว่าพบข้อมูลหรือไม่
    IF v_emp_id IS NULL THEN
        RAISE NOTICE 'ไม่พบพนักงานรหัส %', v_employee_code;
        RETURN;
    END IF;

    -- 2. ลบข้อมูลเก่าออกก่อน (กรณีรันซ้ำ หรือต้องการ Reset ค่าใหม่)
    -- หมายเหตุ: ลบเฉพาะข้อมูลของพนักงานคนนี้ ในปีนี้ (SSO/Tax) และ PF
    DELETE FROM public.payroll_accumulation 
    WHERE employee_id = v_emp_id 
      AND (
          (accum_type IN ('sso', 'tax') AND accum_year = v_current_year) 
          OR (accum_type = 'pf')
      );

    -- 3. Insert ข้อมูลตั้งต้นใหม่ (Migration Data)
    INSERT INTO public.payroll_accumulation (
        employee_id, 
        accum_type, 
        accum_year, 
        amount, 
        updated_by, 
        updated_at
    )
    VALUES
    -- A. ประกันสังคม (SSO) -> ต้องระบุปี
    (
        v_emp_id, 
        'sso', 
        v_current_year, 
        4500.00, -- <--- ใส่ยอด SSO สะสมที่นี่
        v_admin_id, 
        now()
    ),
    -- B. ภาษี (Tax) -> ต้องระบุปี
    (
        v_emp_id, 
        'tax', 
        v_current_year, 
        2500.00, -- <--- ใส่ยอด Tax สะสมที่นี่
        v_admin_id, 
        now()
    ),
    -- C. กองทุนสำรองเลี้ยงชีพ (PF) -> ยอด Lifetime (ปีเป็น NULL)
    (
        v_emp_id, 
        'pf', 
        NULL,    -- <--- PF ต้องเป็น NULL เสมอตาม Constraint
        150000.00, -- <--- ใส่ยอด PF รวมทั้งหมดที่นี่
        v_admin_id, 
        now()
    );

    RAISE NOTICE 'บันทึกยอดยกมาให้พนักงาน % เรียบร้อยแล้ว', v_employee_code;
END $$;