-- ============================================================================
-- SQL Schema Migration: Daily Checklists Table and View (Refactored to 8 Columns)
-- ============================================================================

-- 1. ลบตารางเก่าและวิวเก่าออกก่อนเพื่อหลีกเลี่ยงข้อขัดแย้งของโครงสร้างคอลัมน์เก่า
DROP VIEW IF EXISTS public.dtx_daily_checklists;
DROP TABLE IF EXISTS dtx_system.daily_checklists;

-- 2. สร้างตารางกายภาพใน dtx_system ด้วย 8 คอลัมน์ที่แยกกันอย่างอิสระ
CREATE TABLE dtx_system.daily_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    serial_number VARCHAR(100) NOT NULL, -- เลข Serial Number ตัวเครื่องหลัก (S/N จากผู้ผลิต)
    operator VARCHAR(150) NOT NULL, -- ผู้ตรวจสอบ
    status VARCHAR(50) DEFAULT 'normal' NOT NULL, -- 'normal' หรือ 'issue'
    
    -- 8 คอลัมน์ Checklist ประจำวัน (ค่าเริ่มต้นเป็น true / ผ่าน)
    chk_body_clean BOOLEAN DEFAULT true NOT NULL,      -- 1. ตัวเครื่องสะอาด ไม่มีคราบสกปรก
    chk_power_button BOOLEAN DEFAULT true NOT NULL,    -- 2. ปุ่มเปิด-ปิด กดได้ปกติ
    chk_strip_slot BOOLEAN DEFAULT true NOT NULL,      -- 3. ช่องเสียบแผ่นทดสอบปกติ ไม่เสียหาย
    chk_battery_slot BOOLEAN DEFAULT true NOT NULL,    -- 4. ช่องใส่ถ่านสะอาด ไม่เกิดสนิม
    chk_battery BOOLEAN DEFAULT true NOT NULL,         -- 5. แบตเตอรี่มีแรงดันไฟฟ้าปกติ
    chk_screen_display BOOLEAN DEFAULT true NOT NULL,  -- 6. หน้าจอแสดงผลชัดเจน ตัวเลขครบถ้วน
    chk_measurement BOOLEAN DEFAULT true NOT NULL,     -- 7. ตรวจสอบการวัดผลได้ปกติ
    chk_iqc_passed BOOLEAN DEFAULT true NOT NULL,      -- 8. ตรวจ iQC ผลอยู่ในเกณฑ์ปกติ

    remark TEXT, -- หมายเหตุเพิ่มเติม
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. เปิดใช้งาน Row Level Security (RLS) บนตารางกายภาพ
ALTER TABLE dtx_system.daily_checklists ENABLE ROW LEVEL SECURITY;

-- 4. สร้าง RLS Policy อนุญาตให้ทุกคนสามารถอ่าน เขียน และแก้ไขข้อมูลได้โดยตรง
DROP POLICY IF EXISTS "daily_checklists_all_policy" ON dtx_system.daily_checklists;
CREATE POLICY "daily_checklists_all_policy" ON dtx_system.daily_checklists 
    FOR ALL TO anon, authenticated 
    USING (true) 
    WITH CHECK (true);

-- 5. สร้าง View ใน public schema โดยมี prefix dtx_ เพื่อความปลอดภัยและความเสถียรของ REST API
CREATE OR REPLACE VIEW public.dtx_daily_checklists AS 
SELECT * FROM dtx_system.daily_checklists;

-- 6. มอบสิทธิ์การเข้าถึงทั้งหมดให้กับ PostgREST และผู้ใช้ทุกคน
GRANT ALL ON TABLE dtx_system.daily_checklists TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.dtx_daily_checklists TO anon, authenticated, service_role;

-- 7. สั่งให้ PostgREST โหลด Schema ใหม่ทันที
NOTIFY pgrst, 'reload schema';
