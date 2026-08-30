-- ============================================================================
-- SQL Schema Migration: Strip & Reagent Items (Individual Box/Bottle Tracking)
-- รองรับการ Gen Unique Item Code รายกล่อง/ขวด (เช่น ST-LOT2026A-01)
-- ============================================================================

-- 1. สร้างตารางกายภาพใน dtx_system
CREATE TABLE IF NOT EXISTS dtx_system.strip_reagent_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code VARCHAR(100) UNIQUE NOT NULL, -- เช่น 'ST-LOT2026A-01' (Unique Code รายกล่อง)
    lot_number VARCHAR(100) NOT NULL,       -- เลข LOT ข้างกล่อง
    manufacturer VARCHAR(150) DEFAULT 'VivaChek Fad',
    item_type VARCHAR(50) NOT NULL,         -- 'strip' หรือ 'control_solution'
    received_date DATE DEFAULT CURRENT_DATE NOT NULL,
    exp_date DATE NOT NULL,                 -- วันหมดอายุตามฉลาก
    open_date DATE,                         -- วันที่เปิดขวด/เปิดกล่องใช้จริงในแล็บ
    open_exp_date DATE,                     -- วันหมดอายุหลังเปิดขวด (เช่น +90 วัน)
    status VARCHAR(50) DEFAULT 'in_stock' NOT NULL, -- 'in_stock', 'in_use', 'depleted'
    opened_by VARCHAR(150),
    notes TEXT,
    box_index INTEGER DEFAULT 1,
    total_boxes INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. เปิดใช้งาน RLS Policy
ALTER TABLE dtx_system.strip_reagent_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "strip_items_all_policy" ON dtx_system.strip_reagent_items;
CREATE POLICY "strip_items_all_policy" ON dtx_system.strip_reagent_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. สร้าง View ใน public schema โดยมี prefix dtx_ นำหน้า
CREATE OR REPLACE VIEW public.dtx_strip_reagent_items AS 
SELECT * FROM dtx_system.strip_reagent_items;

-- 4. มอบสิทธิ์ให้ PostgREST
GRANT ALL ON dtx_system.strip_reagent_items TO anon, authenticated, service_role;
GRANT ALL ON public.dtx_strip_reagent_items TO anon, authenticated, service_role;

-- 5. สั่งรีโหลด Schema Cache
NOTIFY pgrst, 'reload schema';
