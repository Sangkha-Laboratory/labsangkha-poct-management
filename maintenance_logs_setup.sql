-- ============================================================================
-- SQL Schema Migration: Maintenance Logs Table and View (Refactored to dtx_ prefix)
-- ============================================================================

-- 1. ลบวิวและตารางเก่าที่ทับซ้อนหรือตกค้างใน public และ dtx_system
DROP VIEW IF EXISTS public.dtx_maintenance_logs CASCADE;
DROP VIEW IF EXISTS public.maintenance_logs CASCADE;
DROP TABLE IF EXISTS public.maintenance_logs CASCADE;
DROP TABLE IF EXISTS public.dtx_maintenance_logs CASCADE;

-- 2. สร้างตารางกายภาพ dtx_system.maintenance_logs ให้ถูกต้องสมบูรณ์
CREATE TABLE IF NOT EXISTS dtx_system.maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    serial_number VARCHAR(150) NOT NULL,
    ward VARCHAR(150) NOT NULL,
    maintenance_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    operator VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. เปิดใช้งาน Row Level Security (RLS)
ALTER TABLE dtx_system.maintenance_logs ENABLE ROW LEVEL SECURITY;

-- 4. สร้าง RLS Policy เพื่อสิทธิ์การอ่านเขียนที่ครอบคลุม
DROP POLICY IF EXISTS "maintenance_all_policy" ON dtx_system.maintenance_logs;
CREATE POLICY "maintenance_all_policy" ON dtx_system.maintenance_logs 
    FOR ALL TO anon, authenticated 
    USING (true) 
    WITH CHECK (true);

-- 5. สร้าง Public View ที่มี prefix dtx_ ตามมาตรฐานสถาปัตยกรรมของระบบ
CREATE OR REPLACE VIEW public.dtx_maintenance_logs AS 
SELECT * FROM dtx_system.maintenance_logs;

-- 6. สร้าง Public View แบบเดิม (ไม่มี prefix) เพื่อความเข้ากันได้ย้อนหลัง (Backward Compatibility)
CREATE OR REPLACE VIEW public.maintenance_logs AS 
SELECT * FROM dtx_system.maintenance_logs;

-- 7. มอบสิทธิ์การเข้าถึงทั้งหมดให้กับ PostgREST และทุกบทบาท
GRANT ALL ON TABLE dtx_system.maintenance_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.dtx_maintenance_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.maintenance_logs TO anon, authenticated, service_role;

-- 8. สั่งให้ PostgREST รีโหลดแคช Schema ทันที
NOTIFY pgrst, 'reload schema';
