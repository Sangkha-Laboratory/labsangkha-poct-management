-- Create the master_wards table
CREATE TABLE IF NOT EXISTS public.master_wards (
    id SERIAL PRIMARY KEY,
    en_name TEXT NOT NULL UNIQUE,
    thai_name TEXT NOT NULL
);

-- Insert the data
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
