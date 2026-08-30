-- ============================================================================
-- SQL Script: Quick Win Setup (dtx_system Schema & Public Views)
-- สำหรับระบบบริหารจัดการเครื่องตรวจน้ำตาล DTX (โรงพยาบาลสังขะ)
-- ============================================================================

-- 1. Create Schema dtx_system
CREATE SCHEMA IF NOT EXISTS dtx_system;

-- 2. Create Master Wards Table in public schema (Only 1 table in public)
CREATE TABLE IF NOT EXISTS public.master_wards (
    id SERIAL PRIMARY KEY,
    en_name TEXT UNIQUE,
    thai_name TEXT NOT NULL
);

-- Insert Initial Master Wards Data
INSERT INTO public.master_wards (en_name, thai_name) VALUES
('LAB', 'งานชันสูตรสาธารณสุข'),
('SX', 'ตึกศัลยกรรมทั่วไป'),
('PED', 'ตึกกุมารเวชกรรม'),
('OPD2', 'แผนกผู้ป่วยนอก 2'),
('LR', 'ห้องคลอด'),
('COHORT', 'ตึกติดเชื้อ'),
('OPD1', 'แผนกผู้ป่วยนอก 1'),
('ER', 'งานอุบัติเหตุและฉุกเฉิน'),
('MED_F', 'อายุรกรรมหญิง'),
('ICU', 'ICU'),
('MED_M', 'อายุรกรรมชาย'),
('NCD', 'NCD'),
('OR', 'OR'),
('VIP6', 'VIP6'),
('GYN', 'ตึกสูตินรีเวช'),
('PSY', 'ตึกดาวดึงส์'),
('VIP5', 'VIP5'),
('NCD_TB', 'TB'),
('ARI', 'ARI'),
('ANC', 'ANC'),
('NCD_CKD', 'แผนกผู้ป่วยไตวายเรื้อรัง')
ON CONFLICT (en_name) DO NOTHING;


-- ============================================================================
-- 3. Create 8 Core Project Tables in dtx_system schema
-- ============================================================================

-- 3.1 dtx_system.dtx_machines
CREATE TABLE IF NOT EXISTS dtx_system.dtx_machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bgm_code TEXT UNIQUE NOT NULL,
    serial_number TEXT,
    brand TEXT DEFAULT 'VivaChek Fad',
    model TEXT,
    ward TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    rec_date DATE,
    last_qc_date DATE,
    lot_number TEXT,
    remark TEXT,
    location_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2 dtx_system.repair_requests
CREATE TABLE IF NOT EXISTS dtx_system.repair_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bgm_code TEXT NOT NULL,
    serial_number TEXT,
    ward TEXT NOT NULL,
    reporter TEXT NOT NULL,
    phone TEXT,
    problem TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    diagnosis TEXT,
    action TEXT,
    operator TEXT,
    receiver TEXT,
    complete_date DATE,
    need_backup BOOLEAN DEFAULT false,
    checklist JSONB DEFAULT '{}'::jsonb,
    req_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.3 dtx_system.supply_requests
CREATE TABLE IF NOT EXISTS dtx_system.supply_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward TEXT NOT NULL,
    requester TEXT NOT NULL,
    item TEXT NOT NULL DEFAULT 'strip',
    qty INTEGER DEFAULT 1,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    req_date DATE DEFAULT CURRENT_DATE,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.4 dtx_system.qc_records
CREATE TABLE IF NOT EXISTS dtx_system.qc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE DEFAULT CURRENT_DATE,
    rec_date DATE,
    ret_date DATE,
    ward TEXT NOT NULL,
    bgm_code TEXT NOT NULL,
    operator TEXT NOT NULL,
    lot_number TEXT NOT NULL,
    level1 NUMERIC DEFAULT 0,
    level2 NUMERIC DEFAULT 0,
    level3 NUMERIC DEFAULT 0,
    l1_status TEXT DEFAULT 'normal',
    l2_status TEXT DEFAULT 'normal',
    l3_status TEXT DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5 dtx_system.qc_lot_configs
CREATE TABLE IF NOT EXISTS dtx_system.qc_lot_configs (
    lot_number TEXT PRIMARY KEY,
    l1_target NUMERIC NOT NULL,
    l1_min NUMERIC NOT NULL,
    l1_max NUMERIC NOT NULL,
    l1_sd NUMERIC DEFAULT 0,
    l2_target NUMERIC NOT NULL,
    l2_min NUMERIC NOT NULL,
    l2_max NUMERIC NOT NULL,
    l2_sd NUMERIC DEFAULT 0,
    l3_target NUMERIC NOT NULL,
    l3_min NUMERIC NOT NULL,
    l3_max NUMERIC NOT NULL,
    l3_sd NUMERIC DEFAULT 0,
    exp_date DATE,
    open_date DATE,
    open_exp_days INTEGER DEFAULT 90,
    manufacturer TEXT DEFAULT 'VivaChek Fad',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.6 dtx_system.eqa_records
CREATE TABLE IF NOT EXISTS dtx_system.eqa_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer TEXT,
    round TEXT NOT NULL,
    action_status TEXT DEFAULT 'completed',
    action_date DATE,
    test_date DATE DEFAULT CURRENT_DATE,
    l1_val NUMERIC DEFAULT 0,
    l1_tgt NUMERIC DEFAULT 0,
    l2_val NUMERIC DEFAULT 0,
    l2_tgt NUMERIC DEFAULT 0,
    l3_val NUMERIC DEFAULT 0,
    l3_tgt NUMERIC DEFAULT 0,
    score NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pass',
    feedback TEXT,
    document_url TEXT,
    attachment_file JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.7 dtx_system.user_manuals
CREATE TABLE IF NOT EXISTS dtx_system.user_manuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    file_name TEXT,
    download_url TEXT,
    file_data TEXT,
    upload_date DATE DEFAULT CURRENT_DATE,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.8 dtx_system.announcements
CREATE TABLE IF NOT EXISTS dtx_system.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    author TEXT NOT NULL,
    pinned BOOLEAN DEFAULT false,
    attachment_name TEXT,
    attachment_url TEXT,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.9 dtx_system.maintenance_logs
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


-- ============================================================================
-- 4. Create Public View Proxies in public schema (All prefixed with dtx_)
-- Proxy REST queries from public schema down to dtx_system schema tables
-- ============================================================================

CREATE OR REPLACE VIEW public.dtx_machines AS SELECT * FROM dtx_system.dtx_machines;
CREATE OR REPLACE VIEW public.dtx_repair_requests AS SELECT * FROM dtx_system.repair_requests;
CREATE OR REPLACE VIEW public.dtx_supply_requests AS SELECT * FROM dtx_system.supply_requests;
CREATE OR REPLACE VIEW public.dtx_qc_records AS SELECT * FROM dtx_system.qc_records;
CREATE OR REPLACE VIEW public.dtx_qc_lot_configs AS SELECT * FROM dtx_system.qc_lot_configs;
CREATE OR REPLACE VIEW public.dtx_eqa_records AS SELECT * FROM dtx_system.eqa_records;
CREATE OR REPLACE VIEW public.dtx_user_manuals AS SELECT * FROM dtx_system.user_manuals;
CREATE OR REPLACE VIEW public.dtx_announcements AS SELECT * FROM dtx_system.announcements;
CREATE OR REPLACE VIEW public.dtx_maintenance_logs AS SELECT * FROM dtx_system.maintenance_logs;
CREATE OR REPLACE VIEW public.maintenance_logs AS SELECT * FROM dtx_system.maintenance_logs;


-- ============================================================================
-- 5. Grant Permissions & Schema Access to PostgREST Roles
-- ============================================================================

GRANT USAGE ON SCHEMA dtx_system TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA dtx_system TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA dtx_system TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
