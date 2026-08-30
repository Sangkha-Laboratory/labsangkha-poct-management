# Project Architectural Rules & Instructions

## 1. Strictly No Mock Data
- Never use mock data, placeholder data, or initial dummy data arrays.
- If data does not exist in the database, return an empty array `[]` or null.
- All operations must read from and write to the real Supabase database.

## 2. Database Schema Architecture
- **Schema `public`**:
  - Contains **ONLY ONE PHYSICAL TABLE**: `public.master_wards` (specifically column `thai_name`).
  - Contains **PUBLIC VIEWS** for all system tables. **ALL VIEWS IN `public` SCHEMA MUST HAVE THE `dtx_` PREFIX** to prevent naming conflicts and confusion:
    1. `public.dtx_machines` (View -> `dtx_system.dtx_machines`)
    2. `public.dtx_repair_requests` (View -> `dtx_system.repair_requests`)
    3. `public.dtx_supply_requests` (View -> `dtx_system.supply_requests`)
    4. `public.dtx_qc_records` (View -> `dtx_system.qc_records`)
    5. `public.dtx_qc_lot_configs` (View -> `dtx_system.qc_lot_configs`)
    6. `public.dtx_eqa_records` (View -> `dtx_system.eqa_records`)
    7. `public.dtx_user_manuals` (View -> `dtx_system.user_manuals`)
    8. `public.dtx_announcements` (View -> `dtx_system.announcements`)
    9. `public.dtx_daily_checklists` (View -> `dtx_system.daily_checklists`)
- **Schema `dtx_system`**:
  - Contains all physical project-specific tables:
    1. `dtx_system.dtx_machines`
    2. `dtx_system.repair_requests`
    3. `dtx_system.supply_requests`
    4. `dtx_system.qc_records`
    5. `dtx_system.qc_lot_configs`
    6. `dtx_system.eqa_records`
    7. `dtx_system.user_manuals`
    8. `dtx_system.announcements`
    9. `dtx_system.daily_checklists`

## 3. Communication & Behavior
- Always analyze, verify, and understand user intent thoroughly before acting.
- Do not make unprompted changes or add unsolicited features.

## 4. Reagent & Strip Stock Workflow (Hospital Lab Specific)
- **Lab internal use only**: The laboratory uses strip and control reagent stock internally for QC/testing (typically dispensing 1 box/bottle at a time).
- **Ward strip procurement**: Wards/departments do NOT request or dispense strips/reagents from the Lab; wards procure/requisition strips directly from the hospital's central warehouse/inventory. The supply request feature in the DTX system is for other supplies/accessories (e.g. backup machines, log books, lancing devices, calibration check items) or lab internal records, NOT for ward strip replenishment from the lab.

## 5. Supabase Schema & Public Views Resolution
- **Default Client Query Strategy (`src/lib/supabase.ts`)**:
  - `querySupabaseClient` queries the default client (`public` schema / public views) first.
  - If direct query on `public` fails, fallback to `dtx_system` schema.
- **Public Views Proxying**:
  - Tables physically reside in `dtx_system` schema.
  - Views are created in `public` schema (`CREATE OR REPLACE VIEW public.table_name AS SELECT * FROM dtx_system.table_name;`) so standard REST calls work without requiring client-side schema switching or encountering HTTP 406/404 errors when `dtx_system` is not exposed in PostgREST API headers.
- **Location History Log**:
  - Machine movement/location logs are stored as `JSONB` array in `dtx_system.dtx_machines(location_history)`.

## 6. Daily Checklist (Quick Win & Staff Maintenance)
- **Once-a-day Laboratory-Internal Process**: The daily checklists are performed exactly once per day internally within the lab/unit.
- **No Ward or Shift columns**: Because this is a quick-win internal process done once a day, it does NOT require `ward` or `shift` columns. Keep the schema focused purely on the 8 boolean checklist criteria, `bgm_code`, `serial_number`, `operator`, `status`, `remark`, and timestamps. Avoid adding any unneeded fields like `shift` or `ward` for this module.

