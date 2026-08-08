-- ==========================================================================
-- SQL Migration & Cleanup Script for Supabase (Sangkha Hospital DTX System)
-- Schema Namespace: poct_system
-- Description: ย้ายตารางที่สร้างผิดใน schema public กลับมาไว้ใน schema poct_system และทำความสะอาดตารางใน public
-- ==========================================================================

-- 1. สร้าง Schema poct_system (ถ้ายังไม่มี)
CREATE SCHEMA IF NOT EXISTS poct_system;

-- 2. ย้ายตารางจาก public ไปยัง poct_system (กรณีที่เผลอสร้างไว้ใน public)
DO $$ 
BEGIN
    -- dtx_machines
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dtx_machines') AND
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'poct_system' AND table_name = 'dtx_machines') THEN
        ALTER TABLE public.dtx_machines SET SCHEMA poct_system;
    END IF;

    -- repair_requests
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_requests') AND
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'poct_system' AND table_name = 'repair_requests') THEN
        ALTER TABLE public.repair_requests SET SCHEMA poct_system;
    END IF;

    -- supply_requests
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'supply_requests') AND
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'poct_system' AND table_name = 'supply_requests') THEN
        ALTER TABLE public.supply_requests SET SCHEMA poct_system;
    END IF;

    -- qc_records
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'qc_records') AND
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'poct_system' AND table_name = 'qc_records') THEN
        ALTER TABLE public.qc_records SET SCHEMA poct_system;
    END IF;

    -- qc_lot_configs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'qc_lot_configs') AND
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'poct_system' AND table_name = 'qc_lot_configs') THEN
        ALTER TABLE public.qc_lot_configs SET SCHEMA poct_system;
    END IF;

    -- eqa_records
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eqa_records') AND
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'poct_system' AND table_name = 'eqa_records') THEN
        ALTER TABLE public.eqa_records SET SCHEMA poct_system;
    END IF;
END $$;

-- 3. ลบตารางที่สร้างซ้ำหรือสร้างผิดใน public ทิ้ง (ถ้ามีอยู่ใน poct_system แล้ว เพื่อไม่ให้รกและสับสน)
DROP TABLE IF EXISTS public.dtx_machines CASCADE;
DROP TABLE IF EXISTS public.repair_requests CASCADE;
DROP TABLE IF EXISTS public.supply_requests CASCADE;
DROP TABLE IF EXISTS public.qc_records CASCADE;
DROP TABLE IF EXISTS public.qc_lot_configs CASCADE;
DROP TABLE IF EXISTS public.eqa_records CASCADE;

-- 4. สร้างตารางทั้งหมดใน schema poct_system (หากยังไม่มี)
CREATE TABLE IF NOT EXISTS poct_system.dtx_machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bgm_code VARCHAR(100) UNIQUE NOT NULL,      -- รหัสเครื่องใน รพ. (เช่น BGM-000)
    serial_number VARCHAR(150) UNIQUE NOT NULL, -- S/N จริงจากผู้ผลิต
    brand VARCHAR(100) NOT NULL,
    ward VARCHAR(150) NOT NULL,                -- หอผู้ป่วยที่รับผิดชอบ
    status VARCHAR(50) DEFAULT 'active',       -- สถานะเครื่อง (active, repair, retired)
    rec_date DATE,                             -- วันที่รับเข้า
    last_qc_date DATE,                         -- วันที่ทำ QC ครั้งล่าสุด
    lot_number VARCHAR(100),
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS poct_system.repair_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bgm_code VARCHAR(100) NOT NULL,            -- รหัสเครื่อง (BGM-xxx)
    serial_number VARCHAR(150),
    ward VARCHAR(150) NOT NULL,
    reporter VARCHAR(200) NOT NULL,            -- ผู้แจ้ง
    phone VARCHAR(50),
    problem TEXT NOT NULL,                     -- รายละเอียดปัญหา
    status VARCHAR(50) DEFAULT 'pending',      -- สถานะ (pending, in_progress, completed)
    diagnosis TEXT,
    action TEXT,
    operator VARCHAR(200),
    receiver VARCHAR(200),
    complete_date DATE,
    need_backup BOOLEAN DEFAULT false,
    checklist JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS poct_system.supply_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward VARCHAR(150) NOT NULL,                -- หอผู้ป่วยที่ขอเบิก
    requester VARCHAR(200) NOT NULL,           -- ผู้ส่งคำขอเบิก
    items JSONB NOT NULL,                      -- รายการอุปกรณ์ที่ขอ
    status VARCHAR(50) DEFAULT 'pending',      -- สถานะ (pending, approved, delivered)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS poct_system.qc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE DEFAULT CURRENT_DATE NOT NULL,    -- วันที่ทำ QC
    rec_date DATE NOT NULL,                     -- วันที่รับเครื่องมาทำ QC
    l1_val NUMERIC,                             -- ผล L1
    l2_val NUMERIC,                             -- ผล L2
    l3_val NUMERIC,                             -- ผล L3
    technician VARCHAR(200) NOT NULL,          -- ผู้ปฏิบัติงาน
    lot_number VARCHAR(100),
    l1_status VARCHAR(50),
    l2_status VARCHAR(50),
    l3_status VARCHAR(50),
    qc_status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS poct_system.qc_lot_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_number VARCHAR(100) UNIQUE NOT NULL,    -- หมายเลข LOT
    l1_target NUMERIC NOT NULL,
    l1_sd NUMERIC,
    l2_target NUMERIC NOT NULL,
    l2_sd NUMERIC,
    l3_target NUMERIC NOT NULL,
    l3_sd NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS poct_system.eqa_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer VARCHAR(150),
    round VARCHAR(100) NOT NULL,                -- รอบการประเมิน
    action_status VARCHAR(100),
    action_date DATE,
    test_date DATE NOT NULL,                    -- วันที่ทำการทดสอบ
    l1_val NUMERIC,
    l1_tgt NUMERIC,
    l2_val NUMERIC,
    l2_tgt NUMERIC,
    l3_val NUMERIC,
    l3_tgt NUMERIC,
    score NUMERIC,
    status VARCHAR(50),
    feedback TEXT,
    document_url TEXT,
    attachment_file JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Grant permissions on poct_system schema
GRANT USAGE ON SCHEMA poct_system TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA poct_system TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA poct_system TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA poct_system GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- 6. Enable RLS
ALTER TABLE poct_system.dtx_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.repair_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.supply_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.qc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.qc_lot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.eqa_records ENABLE ROW LEVEL SECURITY;

-- 7. Create Updatable Views in public schema pointing directly to poct_system tables
-- (ทำหน้าที่เป็น Bridge ให้ Supabase PostgREST API อ่าน-เขียนข้อมูลไปยัง poct_system ได้ทันที
--  โดยไม่ต้องไปกดเปิด Exposed Schemas ใน Supabase Dashboard)

CREATE OR REPLACE VIEW public.dtx_machines AS SELECT * FROM poct_system.dtx_machines;
CREATE OR REPLACE VIEW public.repair_requests AS SELECT * FROM poct_system.repair_requests;
CREATE OR REPLACE VIEW public.supply_requests AS SELECT * FROM poct_system.supply_requests;
CREATE OR REPLACE VIEW public.qc_records AS SELECT * FROM poct_system.qc_records;
CREATE OR REPLACE VIEW public.qc_lot_configs AS SELECT * FROM poct_system.qc_lot_configs;
CREATE OR REPLACE VIEW public.eqa_records AS SELECT * FROM poct_system.eqa_records;

-- Grant permissions on public views
GRANT ALL ON public.dtx_machines TO anon, authenticated, service_role;
GRANT ALL ON public.repair_requests TO anon, authenticated, service_role;
GRANT ALL ON public.supply_requests TO anon, authenticated, service_role;
GRANT ALL ON public.qc_records TO anon, authenticated, service_role;
GRANT ALL ON public.qc_lot_configs TO anon, authenticated, service_role;
GRANT ALL ON public.eqa_records TO anon, authenticated, service_role;
