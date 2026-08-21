# Project Architectural Rules & Instructions

## 1. Strictly No Mock Data
- Never use mock data, placeholder data, or initial dummy data arrays.
- If data does not exist in the database, return an empty array `[]` or null.
- All operations must read from and write to the real Supabase database.

## 2. Database Schema Architecture
- **Schema `public`**:
  - Contains **ONLY ONE TABLE**: `public.master_wards` (specifically column `thai_name`).
  - This table is a hospital-wide shared reference table for wards/departments.
- **Schema `dtx_system`**:
  - Contains all other 8 project-specific tables:
    1. `dtx_system.dtx_machines`
    2. `dtx_system.repair_requests`
    3. `dtx_system.supply_requests`
    4. `dtx_system.qc_records`
    5. `dtx_system.qc_lot_configs`
    6. `dtx_system.eqa_records`
    7. `dtx_system.user_manuals`
    8. `dtx_system.announcements`

## 3. Communication & Behavior
- Always analyze, verify, and understand user intent thoroughly before acting.
- Do not make unprompted changes or add unsolicited features.
