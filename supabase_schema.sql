-- ==========================================================================
-- SQL Schema Setup Script for Supabase (Sangkha Hospital POCT DTX System)
-- Compatible with both 'poct_system' and 'public' schemas
-- Supports Direct Client (Frontend) and Backend API Proxy
-- ==========================================================================

-- 1. สร้าง Schema poct_system
CREATE SCHEMA IF NOT EXISTS poct_system;

-- 2. สร้างตารางทั้งหมดใน schema poct_system
-- Table: master_wards (หอผู้ป่วย / แผนก)
CREATE TABLE IF NOT EXISTS poct_system.master_wards (
    id SERIAL PRIMARY KEY,
    en_name VARCHAR(100) UNIQUE NOT NULL,
    thai_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: dtx_machines (คลังเครื่อง DTX)
CREATE TABLE IF NOT EXISTS poct_system.dtx_machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bgm_code VARCHAR(100) UNIQUE NOT NULL,
    serial_number VARCHAR(150) UNIQUE NOT NULL,
    brand VARCHAR(150) DEFAULT 'VivaChek Fad Blood Glucose Meter',
    ward VARCHAR(150) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    rec_date DATE NOT NULL,
    last_qc_date DATE,
    lot_number VARCHAR(100) NOT NULL,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: repair_requests (งานแจ้งซ่อมและวินิจฉัย)
CREATE TABLE IF NOT EXISTS poct_system.repair_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bgm_code VARCHAR(100) NOT NULL,
    serial_number VARCHAR(150),
    ward VARCHAR(150) NOT NULL,
    reporter VARCHAR(200) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    problem TEXT NOT NULL,
    req_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    diagnosis TEXT,
    action VARCHAR(100),
    operator VARCHAR(200),
    receiver VARCHAR(200),
    complete_date DATE,
    need_backup BOOLEAN DEFAULT FALSE NOT NULL,
    checklist JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: supply_requests (คำขอเบิกอุปกรณ์และวัสดุ)
CREATE TABLE IF NOT EXISTS poct_system.supply_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward VARCHAR(150) NOT NULL,
    requester VARCHAR(200) NOT NULL,
    item VARCHAR(100) NOT NULL,
    qty INTEGER NOT NULL,
    reason TEXT NOT NULL,
    req_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: qc_records (บันทึกผลการควบคุมคุณภาพ QC 3 Level)
CREATE TABLE IF NOT EXISTS poct_system.qc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    rec_date DATE NOT NULL,
    ret_date DATE NOT NULL,
    ward VARCHAR(150) NOT NULL,
    bgm_code VARCHAR(100) NOT NULL,
    serial_number VARCHAR(150),
    operator VARCHAR(200) NOT NULL,
    lot_number VARCHAR(100) NOT NULL,
    level1 NUMERIC NOT NULL,
    level2 NUMERIC NOT NULL,
    level3 NUMERIC NOT NULL,
    l1_status VARCHAR(50) NOT NULL,
    l2_status VARCHAR(50) NOT NULL,
    l3_status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: qc_lot_configs (การตั้งค่าเกณฑ์เป้าหมายของแต่ละ LOT)
CREATE TABLE IF NOT EXISTS poct_system.qc_lot_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_number VARCHAR(100) UNIQUE NOT NULL,
    l1_target NUMERIC NOT NULL,
    l1_min NUMERIC NOT NULL,
    l1_max NUMERIC NOT NULL,
    l1_sd NUMERIC NOT NULL,
    l2_target NUMERIC NOT NULL,
    l2_min NUMERIC NOT NULL,
    l2_max NUMERIC NOT NULL,
    l2_sd NUMERIC NOT NULL,
    l3_target NUMERIC NOT NULL,
    l3_min NUMERIC NOT NULL,
    l3_max NUMERIC NOT NULL,
    l3_sd NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: eqa_records (การประเมินคุณภาพจากภายนอก EQA)
CREATE TABLE IF NOT EXISTS poct_system.eqa_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer VARCHAR(150),
    round VARCHAR(100) NOT NULL,
    action_status VARCHAR(100),
    action_date DATE,
    test_date DATE NOT NULL,
    l1_val NUMERIC NOT NULL,
    l1_tgt NUMERIC NOT NULL,
    l2_val NUMERIC NOT NULL,
    l2_tgt NUMERIC NOT NULL,
    l3_val NUMERIC NOT NULL,
    l3_tgt NUMERIC NOT NULL,
    score NUMERIC NOT NULL,
    status VARCHAR(50) NOT NULL,
    feedback TEXT,
    document_url TEXT,
    attachment_file JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: user_manuals (เอกสารคู่มือการใช้งาน)
CREATE TABLE IF NOT EXISTS poct_system.user_manuals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    file_name TEXT,
    download_url TEXT,
    file_data TEXT,
    upload_date DATE DEFAULT CURRENT_DATE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: announcements (ข่าวประชาสัมพันธ์)
CREATE TABLE IF NOT EXISTS poct_system.announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    author VARCHAR(200) NOT NULL,
    pinned BOOLEAN DEFAULT FALSE,
    attachment_name TEXT,
    attachment_url TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Seed Wards (ถ้ายังไม่มี)
INSERT INTO poct_system.master_wards (en_name, thai_name) VALUES
('OPD', 'OPD (ผู้ป่วยนอก)'),
('ER', 'ER (อุบัติเหตุและฉุกเฉิน)'),
('IPD_MALE', 'IPD ชาย (หอผู้ป่วยในชาย)'),
('IPD_FEMALE', 'IPD หญิง (หอผู้ป่วยในหญิง)'),
('LR', 'ห้องคลอด (Labor Room)'),
('OR', 'ห้องผ่าตัด (OR)'),
('ICU', 'ICU (หอผู้ป่วยหนัก)'),
('CHRONIC', 'คลินิก NCD / เบาหวาน'),
('DENTAL', 'กลุ่มงานทันตกรรม'),
('PHYSIO', 'กลุ่มงานกายภาพบำบัด'),
('THAI_MED', 'กลุ่มงานแพทย์แผนไทย'),
('PHARMACY', 'กลุ่มงานเภสัชกรรม'),
('XRAY', 'กลุ่มงานรังสีวิทยา (X-Ray)'),
('LAB', 'ห้องปฏิบัติการเทคนิคการแพทย์ (LAB)'),
('HEMO', 'หน่วยไตเทียม (Hemodialysis)'),
('MED_REC', 'เวชระเบียนและสถิติ'),
('PCU', 'PCU / ส่งเสริมสุขภาพ'),
('ADMIN', 'กลุ่มงานบริหารทั่วไป')
ON CONFLICT (en_name) DO NOTHING;

-- 4. Grant Usage & Permissions on poct_system schema
GRANT USAGE ON SCHEMA poct_system TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA poct_system TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA poct_system TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA poct_system GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- 5. Enable RLS and Create Open Policies for Anon & Authenticated
ALTER TABLE poct_system.master_wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.dtx_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.repair_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.supply_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.qc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.qc_lot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.eqa_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.user_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.announcements ENABLE ROW LEVEL SECURITY;

-- Drop old policies if existing
DROP POLICY IF EXISTS "wards_all_policy" ON poct_system.master_wards;
DROP POLICY IF EXISTS "machines_all_policy" ON poct_system.dtx_machines;
DROP POLICY IF EXISTS "repairs_all_policy" ON poct_system.repair_requests;
DROP POLICY IF EXISTS "supplies_all_policy" ON poct_system.supply_requests;
DROP POLICY IF EXISTS "qc_records_all_policy" ON poct_system.qc_records;
DROP POLICY IF EXISTS "qc_configs_all_policy" ON poct_system.qc_lot_configs;
DROP POLICY IF EXISTS "eqa_all_policy" ON poct_system.eqa_records;
DROP POLICY IF EXISTS "manuals_all_policy" ON poct_system.user_manuals;
DROP POLICY IF EXISTS "announcements_all_policy" ON poct_system.announcements;

-- Create ALL operations policy (SELECT, INSERT, UPDATE, DELETE) for anon and authenticated
CREATE POLICY "wards_all_policy" ON poct_system.master_wards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "machines_all_policy" ON poct_system.dtx_machines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "repairs_all_policy" ON poct_system.repair_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "supplies_all_policy" ON poct_system.supply_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qc_records_all_policy" ON poct_system.qc_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qc_configs_all_policy" ON poct_system.qc_lot_configs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "eqa_all_policy" ON poct_system.eqa_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "manuals_all_policy" ON poct_system.user_manuals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "announcements_all_policy" ON poct_system.announcements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Create Updatable Views in public schema (Bridge to poct_system)
-- ทำให้เข้าถึงผ่าน Supabase Default Client ได้ทันทีโดยไม่ต้องไปตั้งค่า Exposed Schemas
CREATE OR REPLACE VIEW public.master_wards AS SELECT * FROM poct_system.master_wards;
CREATE OR REPLACE VIEW public.dtx_machines AS SELECT * FROM poct_system.dtx_machines;
CREATE OR REPLACE VIEW public.repair_requests AS SELECT * FROM poct_system.repair_requests;
CREATE OR REPLACE VIEW public.supply_requests AS SELECT * FROM poct_system.supply_requests;
CREATE OR REPLACE VIEW public.qc_records AS SELECT * FROM poct_system.qc_records;
CREATE OR REPLACE VIEW public.qc_lot_configs AS SELECT * FROM poct_system.qc_lot_configs;
CREATE OR REPLACE VIEW public.eqa_records AS SELECT * FROM poct_system.eqa_records;
CREATE OR REPLACE VIEW public.user_manuals AS SELECT * FROM poct_system.user_manuals;
CREATE OR REPLACE VIEW public.announcements AS SELECT * FROM poct_system.announcements;

GRANT ALL ON public.master_wards TO anon, authenticated, service_role;
GRANT ALL ON public.dtx_machines TO anon, authenticated, service_role;
GRANT ALL ON public.repair_requests TO anon, authenticated, service_role;
GRANT ALL ON public.supply_requests TO anon, authenticated, service_role;
GRANT ALL ON public.qc_records TO anon, authenticated, service_role;
GRANT ALL ON public.qc_lot_configs TO anon, authenticated, service_role;
GRANT ALL ON public.eqa_records TO anon, authenticated, service_role;
GRANT ALL ON public.user_manuals TO anon, authenticated, service_role;
GRANT ALL ON public.announcements TO anon, authenticated, service_role;
