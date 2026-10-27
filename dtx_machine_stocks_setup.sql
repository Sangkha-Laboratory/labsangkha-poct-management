-- ============================================================================
-- SQL Schema Migration: Unopened DTX Machine Stock (เครื่องตรวจ DTX รอเปิดใช้งาน)
-- Schema dtx_system: ตารางกายภาพ dtx_system.dtx_machine_stocks และ dtx_system.unopened_machines
-- Schema public: Views public.dtx_machine_stocks และ public.dtx_unopened_machines
-- ============================================================================

-- 1. สร้าง Schema dtx_system หากยังไม่มี
CREATE SCHEMA IF NOT EXISTS dtx_system;

-- 2. สร้างตารางกายภาพ dtx_system.dtx_machine_stocks
CREATE TABLE IF NOT EXISTS dtx_system.dtx_machine_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(150) UNIQUE NOT NULL,      -- Serial Number (S/N จากโรงงาน เช่น SN88291001)
    machine_serial VARCHAR(150),                     -- สำเนา S/N เพื่อความเข้ากันได้กับระบบ
    lot_number VARCHAR(100) NOT NULL,                -- เลข LOT ของเครื่อง
    brand VARCHAR(150) DEFAULT 'VivaChek',          -- ยี่ห้อ
    model VARCHAR(100) DEFAULT 'Fad',                -- รุ่น
    receive_date DATE DEFAULT CURRENT_DATE NOT NULL, -- วันที่รับเข้าคลัง
    rec_date DATE DEFAULT CURRENT_DATE,              -- วันที่รับเข้า (alias)
    status VARCHAR(50) DEFAULT 'standby' NOT NULL,   -- สถานะ: 'standby' (รอเปิดใช้), 'deployed' (เปิดใช้แล้ว)
    ward VARCHAR(150) DEFAULT 'คลังแล็บ/สำรอง (In Stock)',
    bgm_code VARCHAR(100),                           -- ว่างไว้ขณะอยู่ในคลัง จะได้รับรหัสเมื่อเปิดใช้งานจ่าย Ward
    remark TEXT,                                     -- หมายเหตุ / ซัพพลายเออร์
    location_history JSONB DEFAULT '[]'::jsonb,      -- ประวัติการเคลื่อนย้าย
    deployed_at TIMESTAMPTZ,                         -- วันเวลาที่เปิดใช้งาน
    deployed_ward VARCHAR(150),                      -- Ward ที่ส่งมอบไป
    deployed_by VARCHAR(150),                        -- เจ้าหน้าที่ผู้เปิดใช้งาน
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- สร้างตารางกายภาพ alias dtx_system.unopened_machines (หากต้องการใช้ชื่อนี้โดยตรง)
CREATE TABLE IF NOT EXISTS dtx_system.unopened_machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(150) UNIQUE NOT NULL,
    machine_serial VARCHAR(150),
    lot_number VARCHAR(100) NOT NULL,
    brand VARCHAR(150) DEFAULT 'VivaChek',
    model VARCHAR(100) DEFAULT 'Fad',
    receive_date DATE DEFAULT CURRENT_DATE NOT NULL,
    rec_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'standby' NOT NULL,
    ward VARCHAR(150) DEFAULT 'คลังแล็บ/สำรอง (In Stock)',
    bgm_code VARCHAR(100),
    remark TEXT,
    location_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. เปิดใช้งาน Row Level Security (RLS)
ALTER TABLE dtx_system.dtx_machine_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dtx_system.unopened_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dtx_machine_stocks_all_policy" ON dtx_system.dtx_machine_stocks;
CREATE POLICY "dtx_machine_stocks_all_policy" ON dtx_system.dtx_machine_stocks 
FOR ALL TO anon, authenticated, service_role, postgres 
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "unopened_machines_all_policy" ON dtx_system.unopened_machines;
CREATE POLICY "unopened_machines_all_policy" ON dtx_system.unopened_machines 
FOR ALL TO anon, authenticated, service_role, postgres 
USING (true) WITH CHECK (true);

-- 4. สร้าง Public Views สำหรับการเข้าถึงผ่าน PostgREST API (มี prefix dtx_ นำหน้า)
CREATE OR REPLACE VIEW public.dtx_machine_stocks AS 
SELECT * FROM dtx_system.dtx_machine_stocks;

CREATE OR REPLACE VIEW public.dtx_unopened_machines AS 
SELECT * FROM dtx_system.dtx_machine_stocks;

-- 5. มอบสิทธิ์การเข้าถึงฐานข้อมูลครบถ้วน
GRANT USAGE ON SCHEMA dtx_system TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE dtx_system.dtx_machine_stocks TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE dtx_system.unopened_machines TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.dtx_machine_stocks TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.dtx_unopened_machines TO anon, authenticated, service_role, postgres;

-- 6. แจ้งเตือน PostgREST ให้รีโหลด Schema Cache ทันที
NOTIFY pgrst, 'reload schema';
