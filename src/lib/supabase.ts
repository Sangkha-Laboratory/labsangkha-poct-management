/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DtxMachine, MachineLocationLog, RepairRequest, SupplyRequest, QcRecord, QcLotConfig, EqaRecord, UserManual, Announcement, DailyChecklist, MaintenanceLog } from '../types';

// Helper to validate standard UUID format
export const isUuid = (val?: string): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

// 1. Read Supabase URL & Anon Key with local storage fallback
export const getSupabaseUrl = (): string => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('VITE_SUPABASE_URL');
    if (saved) return saved.trim();
  }
  return import.meta.env.VITE_SUPABASE_URL || '';
};

export const getSupabaseAnonKey = (): string => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('VITE_SUPABASE_ANON_KEY');
    if (saved) return saved.trim();
  }
  return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
};

let cachedClient: SupabaseClient<any, any, any> | null = null;
let cachedKey = '';
let cachedPublicClient: SupabaseClient<any, any, any> | null = null;
let cachedPublicKey = '';

export function getSupabaseClient(): SupabaseClient<any, any, any> | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) return null;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;

  const currentComposite = `${url}::${key}`;
  if (cachedClient && cachedKey === currentComposite) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      db: { schema: 'public' },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
    cachedKey = currentComposite;
    return cachedClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
}

export function getPublicSupabaseClient(): SupabaseClient<any, any, any> | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) return null;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;

  const currentComposite = `${url}::${key}`;
  if (cachedPublicClient && cachedPublicKey === currentComposite) {
    return cachedPublicClient;
  }

  try {
    cachedPublicClient = createClient(url, key, {
      db: { schema: 'public' },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    });
    cachedPublicKey = currentComposite;
    return cachedPublicClient;
  } catch (err) {
    console.warn('Failed to initialize Public Supabase client (public schema):', err);
    return null;
  }
}

export function saveSupabaseCredentials(url: string, key: string) {
  if (typeof localStorage !== 'undefined') {
    if (url && url.trim()) localStorage.setItem('VITE_SUPABASE_URL', url.trim());
    else localStorage.removeItem('VITE_SUPABASE_URL');

    if (key && key.trim()) localStorage.setItem('VITE_SUPABASE_ANON_KEY', key.trim());
    else localStorage.removeItem('VITE_SUPABASE_ANON_KEY');
  }
  cachedClient = null;
  cachedKey = '';
  cachedPublicClient = null;
  cachedPublicKey = '';
  resetSupabaseCache();
}

export const supabase = getSupabaseClient();

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseClient() !== null;
};

export async function loginWithSupabaseAuth(identifier: string, password: string) {
  const cleanId = identifier.trim();
  const cleanPass = password.trim();

  let client = getSupabaseClient();
  
  // If client not initialized locally, try loading config from backend /api/supabase/config
  if (!client) {
    try {
      const res = await fetch('/api/supabase/config');
      if (res.ok) {
        const conf = await res.json();
        if (conf.url && conf.anonKey) {
          saveSupabaseCredentials(conf.url, conf.anonKey);
          client = getSupabaseClient();
        }
      }
    } catch {}
  }

  // 1. If we have client, try Supabase Auth
  if (client) {
    const candidateEmails = cleanId.includes('@')
      ? [cleanId]
      : [
          cleanId,
          `${cleanId.toLowerCase()}@sangkha-hospital.com`,
          `${cleanId.toLowerCase()}@gmail.com`
        ];

    let authErrorMsg = '';
    for (const email of candidateEmails) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password: cleanPass
        });

        if (!error && data?.user) {
          const userMeta = data.user.user_metadata || {};
          let role = userMeta.role || 'staff';

          // Check if there is a users table with custom role
          try {
            const { data: profile } = await querySupabaseClient((c) => 
              c.from('users').select('role, name, ward').or(`email.eq.${email},username.eq.${cleanId}`).maybeSingle()
            );
            const userProfile = profile as { role?: string; name?: string; ward?: string } | null;
            if (userProfile && userProfile.role) {
              role = userProfile.role;
            }
          } catch {}

          if (cleanId.toLowerCase() === 'admin' || email.toLowerCase().startsWith('admin@')) {
            role = 'admin';
          }

          return {
            success: true,
            user: {
              id: data.user.id,
              email: data.user.email,
              role: role,
              name: userMeta.name || data.user.email?.split('@')[0] || 'User',
              token: data.session?.access_token
            }
          };
        } else if (error) {
          authErrorMsg = error.message;
        }
      } catch (err: any) {
        authErrorMsg = err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Auth';
      }
    }

    // Try checking a custom users table in the database
    try {
      const { data: dbUser } = await querySupabaseClient((c) =>
        c.from('users').select('*').or(`username.eq.${cleanId},email.eq.${cleanId}`).maybeSingle()
      );
      if (dbUser && (dbUser as any).password === cleanPass) {
        return {
          success: true,
          user: {
            id: (dbUser as any).id || 'db-user',
            email: (dbUser as any).email || `${cleanId}@sangkha-hospital.com`,
            role: (dbUser as any).role || 'admin',
            name: (dbUser as any).name || (dbUser as any).username || 'Admin User'
          }
        };
      }
    } catch {}
  }

  // 2. Try Backend Server Auth Proxy /api/auth/login
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId, password: cleanPass })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        return data;
      }
    } else {
      const errData = await res.json().catch(() => null);
      if (errData?.error) {
        return { success: false, error: errData.error };
      }
    }
  } catch {}

  if (!client) {
    return { 
      success: false, 
      error: 'ยังไม่ได้ตั้งค่าเชื่อมต่อ Supabase หรือเซิร์ฟเวอร์ยังไม่พร้อมใช้งาน (กรุณาตรวจสอบที่เมนู "ตั้งค่า Supabase")' 
    };
  }

  return { success: false, error: 'ชื่อผู้ใช้งาน/อีเมล หรือรหัสผ่านไม่ถูกต้อง' };
}

export const getSupabaseConfigInfo = async () => {
  const client = getSupabaseClient();
  const url = getSupabaseUrl();
  if (client && url) {
    return { configured: true, url };
  }
  try {
    const res = await fetch('/api/supabase/status');
    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      return await res.json() as { configured: boolean; url: string };
    }
  } catch (err) {
    console.warn('Backend database status check failed or skipped:', err);
  }
  return { configured: false, url: '' };
};

// Safe API Fetch helper to prevent HTML response crashes
async function safeApiFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type');
    if (!res.ok || !contentType || !contentType.includes('application/json')) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

let poctSchemaSupported: boolean | null = null;
const missingTablesCache = new Set<string>();

/**
 * Reset schema cache (e.g. when config changes)
 */
export function resetSupabaseCache() {
  poctSchemaSupported = null;
  missingTablesCache.clear();
}

/**
 * Robust Query Runner:
 * Prioritizes dtx_ prefixed public views (e.g. dtx_repair_requests, dtx_machines) and dtx_system schema.
 * For master_wards, public schema is queried.
 */
async function querySupabaseClient<T>(
  fn: (client: any, tableName: string) => PromiseLike<{ data: T | null; error: any }> | Promise<{ data: T | null; error: any }>,
  primaryTable?: string,
  _aliases?: string[]
): Promise<{ data: T | null; error: any; isMissingTable?: boolean }> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: new Error('Supabase client not initialized') };

  const table = primaryTable || '';
  // Build candidate table/view names for public schema (prioritizing dtx_ prefix for views)
  const dtxPrefixed = table.startsWith('dtx_') ? table : `dtx_${table}`;
  const rawName = table.startsWith('dtx_') ? table.replace(/^dtx_/, '') : table;
  
  const publicCandidates = table === 'master_wards'
    ? ['master_wards']
    : Array.from(new Set([dtxPrefixed, rawName, ...(_aliases || [])]));

  const dtxCandidates = Array.from(new Set([rawName, dtxPrefixed, ...(_aliases || [])]));

  try {
    // 1. Try public schema with dtx_ prefixed view name FIRST
    for (const cand of publicCandidates) {
      const resDefault = (await fn(client, cand)) as { data: T | null; error: any };
      if (!resDefault.error) {
        return resDefault;
      }
    }

    // 2. Try dtx_system schema if default client failed
    const dtxClient = client.schema('dtx_system');
    for (const cand of dtxCandidates) {
      const resDtx = (await fn(dtxClient, cand)) as { data: T | null; error: any };
      if (!resDtx.error) {
        return resDtx;
      }
    }

    // 3. Fallback to explicit public schema client
    const publicClient = client.schema('public');
    for (const cand of publicCandidates) {
      const resPublic = (await fn(publicClient, cand)) as { data: T | null; error: any };
      if (!resPublic.error) {
        return resPublic;
      }
    }

    // If all failed, return last error
    const lastRes = (await fn(client, dtxPrefixed)) as { data: T | null; error: any };
    const isMissing = lastRes.error?.code === 'PGRST205' || 
                      lastRes.error?.code === '42P01' || 
                      lastRes.error?.message?.includes('Could not find the table') || 
                      lastRes.error?.message?.includes('does not exist');

    return { data: null, error: lastRes.error, isMissingTable: isMissing };
  } catch (err: any) {
    return { data: null, error: err, isMissingTable: false };
  }
}

export interface TableDiagnosticResult {
  tableName: string;
  thaiLabel: string;
  poctSchemaStatus: 'ok' | 'error' | 'not_exposed' | 'not_found';
  poctSchemaError?: string;
  publicSchemaStatus: 'ok' | 'error' | 'not_found';
  publicSchemaError?: string;
  recordCount: number;
  isReady: boolean;
}

export async function runTableDiagnostics(): Promise<TableDiagnosticResult[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase Client ยังไม่ได้ตั้งค่า URL / Key');

  const tables = [
    { name: 'dtx_machines', label: 'เครื่องตรวจน้ำตาล (dtx_machines)' },
    { name: 'repair_requests', label: 'รายการแจ้งซ่อม (dtx_repair_requests)' },
    { name: 'supply_requests', label: 'รายการเบิกอุปกรณ์ (dtx_supply_requests)' },
    { name: 'qc_records', label: 'บันทึกผล QC (dtx_qc_records)' },
    { name: 'qc_lot_configs', label: 'ค่าเป้าหมาย QC Lot (dtx_qc_lot_configs)' },
    { name: 'eqa_records', label: 'บันทึกผล EQA (dtx_eqa_records)' },
    { name: 'user_manuals', label: 'คู่มือการใช้งาน (dtx_user_manuals)' },
    { name: 'announcements', label: 'ข่าวประกาศ (dtx_announcements)' },
    { name: 'master_wards', label: 'รายชื่อ Ward/หน่วยงาน (master_wards)' },
    { name: 'maintenance_logs', label: 'บันทึกซ่อมบำรุง/เปลี่ยนถ่าน (dtx_maintenance_logs)' },
  ];

  const results: TableDiagnosticResult[] = [];

  for (const t of tables) {
    let dtxStatus: 'ok' | 'error' | 'not_exposed' | 'not_found' = 'not_found';
    let dtxErr = '';
    let publicStatus: 'ok' | 'error' | 'not_found' = 'not_found';
    let publicErr = '';
    let count = 0;

    const dtxPrefixed = t.name.startsWith('dtx_') ? t.name : `dtx_${t.name}`;
    const rawName = t.name.startsWith('dtx_') ? t.name.replace(/^dtx_/, '') : t.name;

    // 1. Check dtx_system schema
    try {
      const { count: c, error } = await client.schema('dtx_system').from(rawName).select('*', { count: 'exact', head: true });
      if (!error) {
        dtxStatus = 'ok';
        count = c || 0;
      } else {
        dtxErr = error.message || error.code || 'Error';
        if (dtxErr.includes('PGRST106') || dtxErr.includes('The schema must be one of the following')) {
          dtxStatus = 'not_exposed';
        } else if (dtxErr.includes('42P01') || dtxErr.includes('does not exist')) {
          dtxStatus = 'not_found';
        } else {
          dtxStatus = 'error';
        }
      }
    } catch (e: any) {
      dtxErr = e.message || 'Exception';
      dtxStatus = 'error';
    }

    // 2. Check public schema (check dtx_ prefixed view first, then raw name)
    try {
      let { count: c, error } = await client.from(dtxPrefixed).select('*', { count: 'exact', head: true });
      if (error && dtxPrefixed !== rawName) {
        const fallback = await client.from(rawName).select('*', { count: 'exact', head: true });
        if (!fallback.error) {
          c = fallback.count;
          error = null;
        }
      }
      if (!error) {
        publicStatus = 'ok';
        if (count === 0 && c) count = c;
      } else {
        publicErr = error.message || error.code || 'Error';
        if (publicErr.includes('42P01') || publicErr.includes('does not exist')) {
          publicStatus = 'not_found';
        } else {
          publicStatus = 'error';
        }
      }
    } catch (e: any) {
      publicErr = e.message || 'Exception';
      publicStatus = 'error';
    }

    results.push({
      tableName: dtxPrefixed,
      thaiLabel: t.label,
      poctSchemaStatus: dtxStatus,
      poctSchemaError: dtxErr,
      publicSchemaStatus: publicStatus,
      publicSchemaError: publicErr,
      recordCount: count,
      isReady: dtxStatus === 'ok' || publicStatus === 'ok'
    });
  }

  return results;
}

// ==========================================================================
// Data Mappers: Convert CamelCase (Frontend) <-> snake_case (Supabase)
// ==========================================================================

export const mapDbToMachine = (db: any): DtxMachine => {
  let locationHistory: MachineLocationLog[] = [];
  if (Array.isArray(db.location_history)) {
    locationHistory = db.location_history;
  } else if (typeof db.location_history === 'string' && db.location_history.trim().startsWith('[')) {
    try {
      locationHistory = JSON.parse(db.location_history);
    } catch {}
  }

  return {
    id: db.id,
    serialNumber: db.bgm_code || db.serial_number || db.serialNumber || db.code || db.id || '',
    machineSerial: db.serial_number || db.machineSerial || db.serial || db.bgm_code || '',
    brand: (db.brand || '').trim(),
    model: (db.model || '').trim(),
    ward: db.ward || '',
    status: db.status as any,
    receiveDate: db.rec_date || db.receiveDate || db.created_at || '',
    lastQCDate: db.last_qc_date || db.lastQCDate || undefined,
    lotNumber: db.lot_number || db.lotNumber || '',
    remark: db.remark || undefined,
    locationHistory: locationHistory.length > 0 ? locationHistory : undefined
  };
};

export const mapMachineToDb = (m: DtxMachine) => {
  return {
    bgm_code: m.serialNumber,
    serial_number: m.machineSerial,
    brand: (m.brand || '').trim(),
    model: (m.model || '').trim(),
    ward: m.ward,
    status: m.status || 'active',
    rec_date: m.receiveDate || new Date().toISOString().split('T')[0],
    last_qc_date: m.lastQCDate || null,
    lot_number: m.lotNumber || '',
    remark: m.remark || null,
    location_history: m.locationHistory || []
  };
};

export const mapDbToRepair = (db: any): RepairRequest => ({
  id: db.id,
  serialNumber: db.bgm_code,
  machineSerial: db.serial_number || undefined,
  ward: db.ward,
  reporterName: db.reporter,
  reporterPhone: db.phone,
  reportedProblem: db.problem,
  requestDate: db.req_date || (db.created_at ? db.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
  status: db.status as any,
  diagnosedProblem: db.diagnosis || undefined,
  actionTaken: db.action || undefined,
  operatorName: db.operator || undefined,
  receiverName: db.receiver || undefined,
  completionDate: db.complete_date || undefined,
  needsBackup: db.need_backup || false,
  checklist: db.checklist || {
    cleanliness: 'pending',
    buttons: 'pending',
    stripSlot: 'pending',
    batterySlot: 'pending',
    battery: 'pending',
    screen: 'pending',
    measurement: 'pending',
    iqc: 'pending',
    intercomparison: 'pending',
    others: ''
  }
});

export const mapRepairToDb = (r: RepairRequest) => ({
  bgm_code: r.serialNumber,
  serial_number: r.machineSerial || null,
  ward: r.ward,
  reporter: r.reporterName,
  phone: r.reporterPhone,
  problem: r.reportedProblem,
  status: r.status || 'pending',
  diagnosis: r.diagnosedProblem || null,
  action: r.actionTaken || null,
  operator: r.operatorName || null,
  receiver: r.receiverName || null,
  complete_date: r.completionDate || null,
  need_backup: r.needsBackup || false,
  checklist: r.checklist || {},
  req_date: r.requestDate || new Date().toISOString().split('T')[0]
});

export const mapDbToSupply = (db: any): SupplyRequest => ({
  id: db.id,
  ward: db.ward,
  requesterName: db.requester,
  itemType: (db.item || (db.items && db.items.itemType) || 'strip') as any,
  quantity: Number(db.qty || (db.items && db.items.quantity) || 1),
  reason: db.reason || (db.items && db.items.reason) || '',
  requestDate: db.req_date || (db.created_at ? db.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
  status: db.status as any,
  details: db.details || undefined
});

export const mapSupplyToDb = (s: SupplyRequest) => ({
  ward: s.ward,
  requester: s.requesterName,
  item: s.itemType,
  qty: Number(s.quantity) || 1,
  reason: s.reason || '',
  status: s.status || 'pending',
  req_date: s.requestDate || new Date().toISOString().split('T')[0],
  details: s.details || {}
});

export const mapDbToQcRecord = (db: any): QcRecord => ({
  id: db.id,
  date: db.date,
  receiveDate: db.rec_date,
  returnDate: db.ret_date || db.rec_date,
  ward: db.ward,
  serialNumber: db.bgm_code,
  operator: db.operator || db.technician || 'เจ้าหน้าที่',
  lotNumber: db.lot_number,
  level1: Number(db.level1 ?? db.l1_val ?? 0),
  level2: Number(db.level2 ?? db.l2_val ?? 0),
  level3: Number(db.level3 ?? db.l3_val ?? 0),
  level1Status: (db.l1_status || 'normal') as any,
  level2Status: (db.l2_status || 'normal') as any,
  level3Status: (db.l3_status || 'normal') as any
});

export const mapQcRecordToDb = (q: QcRecord) => ({
  date: q.date,
  rec_date: q.receiveDate,
  ret_date: q.returnDate || q.receiveDate,
  ward: q.ward,
  bgm_code: q.serialNumber,
  operator: q.operator,
  lot_number: q.lotNumber,
  level1: Number(q.level1) || 0,
  level2: Number(q.level2) || 0,
  level3: Number(q.level3) || 0,
  l1_status: q.level1Status || 'normal',
  l2_status: q.level2Status || 'normal',
  l3_status: q.level3Status || 'normal'
});

export const mapDbToLotConfig = (db: any): QcLotConfig => ({
  lotNumber: db.lot_number,
  expDate: db.exp_date || db.expiration_date || db.expiry_date || undefined,
  openDate: db.open_date || db.opened_date || undefined,
  openExpDays: db.open_exp_days ? Number(db.open_exp_days) : (db.open_stability_days ? Number(db.open_stability_days) : undefined),
  manufacturer: db.manufacturer || db.brand || undefined,
  notes: db.notes || db.remark || undefined,
  level1Target: Number(db.l1_target),
  level1Min: Number(db.l1_min ?? (Number(db.l1_target) - Number(db.l1_sd || 0) * 2)),
  level1Max: Number(db.l1_max ?? (Number(db.l1_target) + Number(db.l1_sd || 0) * 2)),
  level1SD: Number(db.l1_sd || 0),
  level2Target: Number(db.l2_target),
  level2Min: Number(db.l2_min ?? (Number(db.l2_target) - Number(db.l2_sd || 0) * 2)),
  level2Max: Number(db.l2_max ?? (Number(db.l2_target) + Number(db.l2_sd || 0) * 2)),
  level2SD: Number(db.l2_sd || 0),
  level3Target: Number(db.l3_target),
  level3Min: Number(db.l3_min ?? (Number(db.l3_target) - Number(db.l3_sd || 0) * 2)),
  level3Max: Number(db.l3_max ?? (Number(db.l3_target) + Number(db.l3_sd || 0) * 2)),
  level3SD: Number(db.l3_sd || 0)
});

export const mapLotConfigToDb = (l: QcLotConfig) => {
  const payload: any = {
    lot_number: l.lotNumber,
    l1_target: l.level1Target,
    l1_min: l.level1Min,
    l1_max: l.level1Max,
    l1_sd: l.level1SD,
    l2_target: l.level2Target,
    l2_min: l.level2Min,
    l2_max: l.level2Max,
    l2_sd: l.level2SD,
    l3_target: l.level3Target,
    l3_min: l.level3Min,
    l3_max: l.level3Max,
    l3_sd: l.level3SD
  };
  return payload;
};

export const mapDbToEqaRecord = (db: any): EqaRecord => ({
  id: db.id,
  organizer: db.organizer || '',
  round: db.round || '',
  actionStatus: db.action_status || 'completed',
  actionDate: db.action_date || db.test_date || '',
  testDate: db.test_date || '',
  level1Value: Number(db.l1_val || 0),
  level1Target: Number(db.l1_tgt || 0),
  level2Value: Number(db.l2_val || 0),
  level2Target: Number(db.l2_tgt || 0),
  level3Value: Number(db.l3_val || 0),
  level3Target: Number(db.l3_tgt || 0),
  score: Number(db.score || 0),
  status: db.status as any || 'pass',
  feedback: db.feedback || '',
  documentUrl: db.document_url || '',
  attachmentFile: db.attachment_file ? (typeof db.attachment_file === 'string' ? JSON.parse(db.attachment_file) : db.attachment_file) : undefined
});

export const mapEqaRecordToDb = (e: EqaRecord) => ({
  organizer: e.organizer || null,
  round: e.round,
  action_status: e.actionStatus || null,
  action_date: e.actionDate || null,
  test_date: e.testDate,
  l1_val: e.level1Value || 0,
  l1_tgt: e.level1Target || 0,
  l2_val: e.level2Value || 0,
  l2_tgt: e.level2Target || 0,
  l3_val: e.level3Value || 0,
  l3_tgt: e.level3Target || 0,
  score: e.score || 0,
  status: e.status || 'pass',
  feedback: e.feedback || null,
  document_url: e.documentUrl || null,
  attachment_file: e.attachmentFile ? JSON.stringify(e.attachmentFile) : null
});

export const mapDbToManual = (db: any): UserManual => ({
  id: db.id,
  title: db.title,
  category: db.category,
  description: db.description || '',
  fileName: db.file_name || undefined,
  downloadUrl: db.download_url || undefined,
  fileData: db.file_data || undefined,
  uploadDate: db.upload_date || undefined,
  isDeleted: db.is_deleted || false
});

export const mapManualToDb = (m: UserManual) => ({
  id: m.id,
  title: m.title,
  category: m.category,
  description: m.description || null,
  file_name: m.fileName || null,
  download_url: m.downloadUrl || null,
  file_data: m.fileData || null,
  upload_date: m.uploadDate || null,
  is_deleted: m.isDeleted || false
});

export const mapDbToAnnouncement = (db: any): Announcement => ({
  id: db.id,
  title: db.title,
  content: db.content,
  category: db.category,
  date: db.date,
  author: db.author,
  pinned: db.pinned || false,
  attachmentName: db.attachment_name || undefined,
  attachmentUrl: db.attachment_url || undefined,
  isDeleted: db.is_deleted || false
});

export const mapAnnouncementToDb = (a: Announcement) => ({
  id: a.id,
  title: a.title,
  content: a.content,
  category: a.category,
  date: a.date,
  author: a.author,
  pinned: a.pinned || false,
  attachment_name: a.attachmentName || null,
  attachment_url: a.attachmentUrl || null,
  is_deleted: a.isDeleted || false
});

function parseWardRow(w: any): { en_name: string; thai_name: string } | null {
  if (!w || typeof w !== 'object') return null;
  const thaiName = 
    w.thai_name ||
    w.ward_name ||
    w.ward_name_th ||
    w.name_th ||
    w.ward_thai ||
    w.wardname ||
    w.ward_desc ||
    w.ward_description ||
    w.department ||
    w.department_name ||
    w.dept_name ||
    w.dept ||
    w.name ||
    w.ward ||
    w.en_name ||
    w.ward_code ||
    w.code ||
    (w.id ? String(w.id) : '');

  const enName = 
    w.en_name ||
    w.ward_code ||
    w.code ||
    w.ward_name_en ||
    w.name_en ||
    w.ward_en ||
    w.ward ||
    w.name ||
    thaiName ||
    '';

  const tStr = String(thaiName || '').trim();
  const eStr = String(enName || tStr).trim();

  if (!tStr && !eStr) return null;
  return {
    en_name: eStr || tStr,
    thai_name: tStr || eStr
  };
}

// ==========================================================================
// Database Service: Dual-Schema (dtx_system -> public) + API Proxy Fallback
// ==========================================================================

export const dbService = {
  // --- master_wards (Strictly queries public.master_wards for thai_name via dedicated public client) ---
  async getWards(): Promise<{ en_name: string; thai_name: string }[]> {
    const publicClient = getPublicSupabaseClient();
    if (publicClient) {
      try {
        console.log('[DEBUG master_wards] Initiating query to public.master_wards via dedicated public client...');
        let resData: any[] | null = null;
        const { data, error, status, statusText } = await publicClient.from('master_wards').select('*');
        
        if (!error && Array.isArray(data) && data.length > 0) {
          console.log(`[DEBUG master_wards] Query public.master_wards SUCCESS: found ${data.length} records`);
          resData = data;
        } else {
          if (error) {
            console.warn(`[DEBUG master_wards] Query select(*) returned error:`, {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
              status,
              statusText
            });
          }
          // Fallback to querying specifically thai_name
          const { data: dThai, error: eThai, status: sThai } = await publicClient.from('master_wards').select('thai_name');
          if (!eThai && Array.isArray(dThai) && dThai.length > 0) {
            console.log(`[DEBUG master_wards] Query select(thai_name) SUCCESS: found ${dThai.length} records`);
            resData = dThai;
          } else if (eThai) {
            console.warn(`[DEBUG master_wards] Query select(thai_name) returned error:`, {
              code: eThai.code,
              message: eThai.message,
              details: eThai.details,
              hint: eThai.hint,
              status: sThai
            });
          }
        }

        if (resData && resData.length > 0) {
          const list = resData
            .map(parseWardRow)
            .filter((w): w is { en_name: string; thai_name: string } => w !== null);
          if (list.length > 0) {
            return list.sort((a, b) => a.thai_name.localeCompare(b.thai_name, 'th'));
          }
        }
      } catch (err: any) {
        console.error('[DEBUG master_wards] Exception during client query:', err);
      }
    } else {
      console.warn('[DEBUG master_wards] Supabase public client not configured or unavailable');
    }

    // Fallback to Express backend API proxy (/api/wards)
    try {
      console.log('[DEBUG master_wards] Attempting backend API fallback: /api/wards');
      const data = await safeApiFetch('/api/wards');
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[DEBUG master_wards] API fallback /api/wards SUCCESS: received ${data.length} records`);
        const list = data
          .map(parseWardRow)
          .filter((w): w is { en_name: string; thai_name: string } => w !== null);
        if (list.length > 0) {
          return list.sort((a, b) => a.thai_name.localeCompare(b.thai_name, 'th'));
        }
      } else {
        console.log('[DEBUG master_wards] API fallback /api/wards returned empty array');
      }
    } catch (err: any) {
      console.warn('[DEBUG master_wards] Backend API /api/wards error:', err?.message || err);
    }

    return [];
  },

  // --- dtx_machines ---
  async getMachines(): Promise<DtxMachine[]> {
    let rawList: any[] = [];
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).select('*'),
        'dtx_machines',
        ['machines', 'dtx_devices']
      );
      if (!error && Array.isArray(data)) {
        rawList = data;
      } else if (error && !isMissingTable) {
        console.warn('Supabase getMachines notice:', error.message || error);
      }
    }
    
    if (rawList.length === 0) {
      const apiData = await safeApiFetch('/api/machines');
      if (Array.isArray(apiData)) {
        rawList = apiData;
      }
    }

    const mapped = rawList
      .sort((a, b) => new Date(b.created_at || b.install_date || 0).getTime() - new Date(a.created_at || a.install_date || 0).getTime())
      .map(mapDbToMachine);

    // Deduplicate by serialNumber (CODE) and id
    const seenCodes = new Set<string>();
    const seenIds = new Set<string>();
    const uniqueMachines: DtxMachine[] = [];

    for (const m of mapped) {
      const codeKey = (m.serialNumber || m.machineSerial || '').trim().toUpperCase();
      const idKey = (m.id || '').trim();

      if (codeKey && seenCodes.has(codeKey)) continue;
      if (idKey && seenIds.has(idKey)) continue;

      if (codeKey) seenCodes.add(codeKey);
      if (idKey) seenIds.add(idKey);
      uniqueMachines.push(m);
    }

    return uniqueMachines;
  },

  async insertMachine(machine: DtxMachine): Promise<DtxMachine> {
    const dbPayload = mapMachineToDb(machine);
    const payloadWithId = isUuid(machine.id) ? { ...dbPayload, id: machine.id } : dbPayload;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([payloadWithId]).select().maybeSingle(),
        'dtx_machines',
        ['machines']
      );
      if (!error && data) return mapDbToMachine(data);
      
      // If error is due to missing 'model' column in legacy database schema (42703), retry without model column
      if (error && (error.code === '42703' || error.message?.includes('model'))) {
        const fallbackPayload = {
          ...payloadWithId,
          brand: `${payloadWithId.brand} ${payloadWithId.model}`.trim()
        };
        delete (fallbackPayload as any).model;

        const retryRes = await querySupabaseClient(
          (c, tbl) => c.from(tbl).insert([fallbackPayload]).select().maybeSingle(),
          'dtx_machines',
          ['machines']
        );
        if (!retryRes.error && retryRes.data) return mapDbToMachine(retryRes.data);
      }

      if (error && !isMissingTable) {
        console.warn('Supabase insertMachine notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadWithId)
    });
    return data ? mapDbToMachine(data) : machine;
  },

  async insertMachinesBulk(machinesList: DtxMachine[], overwrite = false): Promise<{ success: number; failed: number; results: DtxMachine[] }> {
    const results: DtxMachine[] = [];
    let success = 0;
    let failed = 0;

    for (const m of machinesList) {
      try {
        if (overwrite) {
          const updated = await this.updateMachine(m.id || m.serialNumber, m);
          results.push(updated);
          success++;
        } else {
          const inserted = await this.insertMachine(m);
          results.push(inserted);
          success++;
        }
      } catch (err) {
        console.error('Failed to import machine item:', m.serialNumber, err);
        failed++;
      }
    }
    return { success, failed, results };
  },

  async updateMachine(id: string, machine: Partial<DtxMachine>): Promise<DtxMachine> {
    const dbPayload: any = {};
    if (machine.serialNumber !== undefined) dbPayload.bgm_code = machine.serialNumber;
    if (machine.machineSerial !== undefined) dbPayload.serial_number = machine.machineSerial;
    if (machine.brand !== undefined) dbPayload.brand = machine.brand.trim();
    if (machine.model !== undefined) dbPayload.model = machine.model.trim();
    if (machine.ward !== undefined) dbPayload.ward = machine.ward;
    if (machine.status !== undefined) dbPayload.status = machine.status;
    if (machine.receiveDate !== undefined) dbPayload.rec_date = machine.receiveDate;
    if (machine.lastQCDate !== undefined) dbPayload.last_qc_date = machine.lastQCDate || null;
    if (machine.lotNumber !== undefined) dbPayload.lot_number = machine.lotNumber;
    if (machine.remark !== undefined) dbPayload.remark = machine.remark || null;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => isUuid(id)
          ? c.from(tbl).update(dbPayload).eq('id', id).select().maybeSingle()
          : c.from(tbl).update(dbPayload).eq('bgm_code', machine.serialNumber || id).select().maybeSingle(),
        'dtx_machines',
        ['machines']
      );
      if (!error && data) return mapDbToMachine(data);

      // If legacy table without 'model' column
      if (error && (error.code === '42703' || error.message?.includes('model'))) {
        const fallbackPayload = { ...dbPayload };
        if (fallbackPayload.model && fallbackPayload.brand) {
          fallbackPayload.brand = `${fallbackPayload.brand} ${fallbackPayload.model}`.trim();
        }
        delete fallbackPayload.model;

        const retryRes = await querySupabaseClient(
          (c, tbl) => isUuid(id)
            ? c.from(tbl).update(fallbackPayload).eq('id', id).select().maybeSingle()
            : c.from(tbl).update(fallbackPayload).eq('bgm_code', machine.serialNumber || id).select().maybeSingle(),
          'dtx_machines',
          ['machines']
        );
        if (!retryRes.error && retryRes.data) return mapDbToMachine(retryRes.data);
      }

      if (error && !isMissingTable) {
        console.warn('Supabase updateMachine notice:', error.message || error);
      }
    }
    const data = await safeApiFetch(`/api/machines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToMachine(data) : (machine as DtxMachine);
  },

  async deleteMachine(id: string): Promise<void> {
    if (getSupabaseClient()) {
      const { error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => isUuid(id)
          ? c.from(tbl).delete().eq('id', id)
          : c.from(tbl).delete().eq('bgm_code', id),
        'dtx_machines',
        ['machines']
      );
      if (!error) return;
      if (error && !isMissingTable) {
        console.warn('Supabase deleteMachine notice:', error.message || error);
      }
    }
    await safeApiFetch(`/api/machines/${id}`, { method: 'DELETE' });
  },

  // --- repair_requests ---
  async getRepairs(): Promise<RepairRequest[]> {
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).select('*'),
        'repair_requests',
        ['repairs', 'repair_records']
      );
      if (!error && Array.isArray(data)) {
        return (data as any[])
          .sort((a, b) => new Date(b.created_at || b.req_date || 0).getTime() - new Date(a.created_at || a.req_date || 0).getTime())
          .map(mapDbToRepair);
      }
      if (error && !isMissingTable) {
        console.warn('Supabase getRepairs notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/repairs');
    return data ? (data as any[]).map(mapDbToRepair) : [];
  },

  async insertRepair(repair: RepairRequest): Promise<RepairRequest> {
    const dbPayload = mapRepairToDb(repair);
    const payloadWithId = isUuid(repair.id) ? { ...dbPayload, id: repair.id } : dbPayload;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([payloadWithId]).select().maybeSingle(),
        'repair_requests',
        ['repairs']
      );
      if (!error && data) return mapDbToRepair(data);
      if (error && !isMissingTable) {
        console.warn('Supabase insertRepair notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/repairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadWithId)
    });
    return data ? mapDbToRepair(data) : repair;
  },

  async updateRepair(id: string, repair: Partial<RepairRequest>): Promise<RepairRequest> {
    const dbPayload: any = {};
    if (repair.serialNumber !== undefined) dbPayload.bgm_code = repair.serialNumber;
    if (repair.machineSerial !== undefined) dbPayload.serial_number = repair.machineSerial || null;
    if (repair.ward !== undefined) dbPayload.ward = repair.ward;
    if (repair.reporterName !== undefined) dbPayload.reporter = repair.reporterName;
    if (repair.reporterPhone !== undefined) dbPayload.phone = repair.reporterPhone;
    if (repair.reportedProblem !== undefined) dbPayload.problem = repair.reportedProblem;
    if (repair.requestDate !== undefined) dbPayload.req_date = repair.requestDate;
    if (repair.status !== undefined) dbPayload.status = repair.status;
    if (repair.diagnosedProblem !== undefined) dbPayload.diagnosis = repair.diagnosedProblem || null;
    if (repair.actionTaken !== undefined) dbPayload.action = repair.actionTaken || null;
    if (repair.operatorName !== undefined) dbPayload.operator = repair.operatorName || null;
    if (repair.receiverName !== undefined) dbPayload.receiver = repair.receiverName || null;
    if (repair.completionDate !== undefined) dbPayload.complete_date = repair.completionDate || null;
    if (repair.needsBackup !== undefined) dbPayload.need_backup = repair.needsBackup;
    if (repair.checklist !== undefined) dbPayload.checklist = repair.checklist;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => isUuid(id)
          ? c.from(tbl).update(dbPayload).eq('id', id).select().maybeSingle()
          : c.from(tbl).update(dbPayload).eq('bgm_code', repair.serialNumber || id).select().maybeSingle(),
        'repair_requests',
        ['repairs']
      );
      if (!error && data) return mapDbToRepair(data);
      if (error && !isMissingTable) {
        console.warn('Supabase updateRepair notice:', error.message || error);
      }
    }
    const data = await safeApiFetch(`/api/repairs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToRepair(data) : (repair as RepairRequest);
  },

  async deleteRepair(id: string): Promise<void> {
    if (getSupabaseClient()) {
      const { error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => isUuid(id)
          ? c.from(tbl).delete().eq('id', id)
          : c.from(tbl).delete().eq('bgm_code', id),
        'repair_requests',
        ['repairs']
      );
      if (!error) return;
      if (error && !isMissingTable) {
        console.warn('Supabase deleteRepair notice:', error.message || error);
      }
    }
    await safeApiFetch(`/api/repairs/${id}`, { method: 'DELETE' });
  },

  // --- supply_requests ---
  async getSupplies(): Promise<SupplyRequest[]> {
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).select('*'),
        'supply_requests',
        ['supplies', 'supply_orders']
      );
      if (!error && Array.isArray(data)) {
        return (data as any[])
          .sort((a, b) => new Date(b.created_at || b.req_date || 0).getTime() - new Date(a.created_at || a.req_date || 0).getTime())
          .map(mapDbToSupply);
      }
      if (error && !isMissingTable) {
        console.warn('Supabase getSupplies notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/supplies');
    return data ? (data as any[]).map(mapDbToSupply) : [];
  },

  async insertSupply(supply: SupplyRequest): Promise<SupplyRequest> {
    const dbPayload = mapSupplyToDb(supply);
    const payloadWithId = isUuid(supply.id) ? { ...dbPayload, id: supply.id } : dbPayload;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([payloadWithId]).select().maybeSingle(),
        'supply_requests',
        ['supplies']
      );
      if (!error && data) return mapDbToSupply(data);
      if (error && !isMissingTable) {
        console.warn('Supabase insertSupply notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/supplies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadWithId)
    });
    return data ? mapDbToSupply(data) : supply;
  },

  async updateSupply(id: string, supply: Partial<SupplyRequest>): Promise<SupplyRequest> {
    const dbPayload: any = {};
    if (supply.ward !== undefined) dbPayload.ward = supply.ward;
    if (supply.requesterName !== undefined) dbPayload.requester = supply.requesterName;
    if (supply.itemType !== undefined) dbPayload.item = supply.itemType;
    if (supply.quantity !== undefined) dbPayload.qty = Number(supply.quantity);
    if (supply.reason !== undefined) dbPayload.reason = supply.reason;
    if (supply.requestDate !== undefined) dbPayload.req_date = supply.requestDate;
    if (supply.status !== undefined) dbPayload.status = supply.status;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).update(dbPayload).eq('id', id).select().maybeSingle(),
        'supply_requests',
        ['supplies']
      );
      if (!error && data) return mapDbToSupply(data);
      if (error && !isMissingTable) {
        console.warn('Supabase updateSupply notice:', error.message || error);
      }
    }
    const data = await safeApiFetch(`/api/supplies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToSupply(data) : (supply as SupplyRequest);
  },

  async deleteSupply(id: string): Promise<void> {
    if (getSupabaseClient()) {
      const { error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).delete().eq('id', id),
        'supply_requests',
        ['supplies']
      );
      if (!error) return;
      if (error && !isMissingTable) {
        console.warn('Supabase deleteSupply notice:', error.message || error);
      }
    }
    await safeApiFetch(`/api/supplies/${id}`, { method: 'DELETE' });
  },

  // --- qc_records ---
  async getQcRecords(): Promise<QcRecord[]> {
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).select('*'),
        'qc_records'
      );
      if (!error && Array.isArray(data)) {
        return (data as any[])
          .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
          .map(mapDbToQcRecord);
      }
      if (error && !isMissingTable) {
        console.warn('Supabase getQcRecords notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/qc-records');
    return data ? (data as any[]).map(mapDbToQcRecord) : [];
  },

  async insertQcRecord(qc: QcRecord): Promise<QcRecord> {
    const dbPayload = mapQcRecordToDb(qc);
    const payloadWithId = isUuid(qc.id) ? { ...dbPayload, id: qc.id } : dbPayload;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([payloadWithId]).select().maybeSingle(),
        'qc_records'
      );
      if (!error && data) return mapDbToQcRecord(data);
      if (error && !isMissingTable) {
        console.warn('Supabase insertQcRecord notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/qc-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadWithId)
    });
    return data ? mapDbToQcRecord(data) : qc;
  },

  async updateQcRecord(id: string, qc: Partial<QcRecord>): Promise<QcRecord> {
    const dbPayload: any = {};
    if (qc.date !== undefined) dbPayload.date = qc.date;
    if (qc.receiveDate !== undefined) dbPayload.rec_date = qc.receiveDate;
    if (qc.returnDate !== undefined) dbPayload.ret_date = qc.returnDate;
    if (qc.ward !== undefined) dbPayload.ward = qc.ward;
    if (qc.serialNumber !== undefined) dbPayload.bgm_code = qc.serialNumber;
    if (qc.operator !== undefined) dbPayload.operator = qc.operator;
    if (qc.lotNumber !== undefined) dbPayload.lot_number = qc.lotNumber;
    if (qc.level1 !== undefined) dbPayload.level1 = Number(qc.level1);
    if (qc.level2 !== undefined) dbPayload.level2 = Number(qc.level2);
    if (qc.level3 !== undefined) dbPayload.level3 = Number(qc.level3);
    if (qc.level1Status !== undefined) dbPayload.l1_status = qc.level1Status;
    if (qc.level2Status !== undefined) dbPayload.l2_status = qc.level2Status;
    if (qc.level3Status !== undefined) dbPayload.l3_status = qc.level3Status;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).update(dbPayload).eq('id', id).select().maybeSingle(),
        'qc_records'
      );
      if (!error && data) return mapDbToQcRecord(data);
      if (error && !isMissingTable) {
        console.warn('Supabase updateQcRecord notice:', error.message || error);
      }
    }
    const data = await safeApiFetch(`/api/qc-records/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToQcRecord(data) : (qc as QcRecord);
  },

  async deleteQcRecord(id: string): Promise<void> {
    if (getSupabaseClient()) {
      const { error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).delete().eq('id', id),
        'qc_records'
      );
      if (!error) return;
      if (error && !isMissingTable) {
        console.warn('Supabase deleteQcRecord notice:', error.message || error);
      }
    }
    await safeApiFetch(`/api/qc-records/${id}`, { method: 'DELETE' });
  },

  // --- qc_lot_configs ---
  async getLotConfigs(): Promise<QcLotConfig[]> {
    let list: QcLotConfig[] = [];
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).select('*'),
        'qc_lot_configs',
        ['lot_configs', 'qc_lots']
      );
      if (!error && data) {
        list = (data as any[]).map(mapDbToLotConfig);
      } else if (error && !isMissingTable) {
        console.warn('Supabase getLotConfigs notice:', error.message || error);
      }
    }
    if (list.length === 0) {
      const data = await safeApiFetch('/api/lot-configs');
      if (data && Array.isArray(data)) {
        list = (data as any[]).map(mapDbToLotConfig);
      }
    }
    // Deduplicate by normalized case-insensitive lotNumber
    const uniqueMap = new Map<string, QcLotConfig>();
    list.forEach(cfg => {
      if (!cfg || !cfg.lotNumber) return;
      const key = cfg.lotNumber.trim().toUpperCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...cfg, lotNumber: cfg.lotNumber.trim() });
      }
    });
    return Array.from(uniqueMap.values());
  },

  async insertLotConfig(lot: QcLotConfig): Promise<QcLotConfig> {
    const dbPayload = mapLotConfigToDb(lot);
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([dbPayload]).select().maybeSingle(),
        'qc_lot_configs',
        ['lot_configs']
      );
      if (!error && data) return mapDbToLotConfig(data);
      
      // Fallback to update on duplicate key conflict (PG error code 23505)
      if (error && (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('already exists'))) {
        return this.updateLotConfig(lot.lotNumber, lot);
      }

      if (error && !isMissingTable) {
        console.warn('Supabase insertLotConfig notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/lot-configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToLotConfig(data) : lot;
  },

  async updateLotConfig(lotNumber: string, lot: Partial<QcLotConfig>): Promise<QcLotConfig> {
    const dbPayload: any = {};
    if (lot.level1Target !== undefined) dbPayload.l1_target = lot.level1Target;
    if (lot.level1Min !== undefined) dbPayload.l1_min = lot.level1Min;
    if (lot.level1Max !== undefined) dbPayload.l1_max = lot.level1Max;
    if (lot.level1SD !== undefined) dbPayload.l1_sd = lot.level1SD;
    if (lot.level2Target !== undefined) dbPayload.l2_target = lot.level2Target;
    if (lot.level2Min !== undefined) dbPayload.l2_min = lot.level2Min;
    if (lot.level2Max !== undefined) dbPayload.l2_max = lot.level2Max;
    if (lot.level2SD !== undefined) dbPayload.l2_sd = lot.level2SD;
    if (lot.level3Target !== undefined) dbPayload.l3_target = lot.level3Target;
    if (lot.level3Min !== undefined) dbPayload.l3_min = lot.level3Min;
    if (lot.level3Max !== undefined) dbPayload.l3_max = lot.level3Max;
    if (lot.level3SD !== undefined) dbPayload.l3_sd = lot.level3SD;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).update(dbPayload).eq('lot_number', lotNumber).select().maybeSingle(),
        'qc_lot_configs',
        ['lot_configs']
      );
      if (!error && data) return mapDbToLotConfig(data);
      if (error && !isMissingTable) {
        console.warn('Supabase updateLotConfig notice:', error.message || error);
      }
    }
    const data = await safeApiFetch(`/api/lot-configs/${lotNumber}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToLotConfig(data) : (lot as QcLotConfig);
  },

  async deleteLotConfig(lotNumber: string): Promise<void> {
    const cleanLot = lotNumber.trim();
    if (getSupabaseClient()) {
      // 1. Try dtx_system schema directly with case-insensitive ilike
      try {
        const dtxClient = getSupabaseClient()!.schema('dtx_system');
        const { error: dtxErr } = await dtxClient.from('qc_lot_configs').delete().ilike('lot_number', cleanLot);
        if (!dtxErr) {
          await safeApiFetch(`/api/lot-configs/${encodeURIComponent(cleanLot)}`, { method: 'DELETE' });
          return;
        }
      } catch {}

      // 2. Try querySupabaseClient fallback with case-insensitive ilike
      const { error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).delete().ilike('lot_number', cleanLot),
        'qc_lot_configs',
        ['lot_configs', 'dtx_qc_lot_configs']
      );
      if (!error) {
        await safeApiFetch(`/api/lot-configs/${encodeURIComponent(cleanLot)}`, { method: 'DELETE' });
        return;
      }
      if (error && !isMissingTable) {
        console.warn('Supabase deleteLotConfig notice:', error.message || error);
      }
    }
    await safeApiFetch(`/api/lot-configs/${encodeURIComponent(cleanLot)}`, { method: 'DELETE' });
  },

  // --- eqa_records ---
  async getEqaRecords(): Promise<EqaRecord[]> {
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).select('*'),
        'eqa_records'
      );
      if (!error && Array.isArray(data)) {
        return (data as any[])
          .sort((a, b) => new Date(b.test_date || b.created_at || 0).getTime() - new Date(a.test_date || a.created_at || 0).getTime())
          .map(mapDbToEqaRecord);
      }
      if (error && !isMissingTable) {
        console.warn('Supabase getEqaRecords notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/eqa-records');
    return data ? (data as any[]).map(mapDbToEqaRecord) : [];
  },

  async insertEqaRecord(eqa: EqaRecord): Promise<EqaRecord> {
    const dbPayload = mapEqaRecordToDb(eqa);
    const payloadWithId = isUuid(eqa.id) ? { ...dbPayload, id: eqa.id } : dbPayload;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([payloadWithId]).select().maybeSingle(),
        'eqa_records'
      );
      if (!error && data) return mapDbToEqaRecord(data);
      if (error && !isMissingTable) {
        console.warn('Supabase insertEqaRecord notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/eqa-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadWithId)
    });
    return data ? mapDbToEqaRecord(data) : eqa;
  },

  async updateEqaRecord(id: string, eqa: Partial<EqaRecord>): Promise<EqaRecord> {
    const dbPayload: any = {};
    if (eqa.round !== undefined) dbPayload.round = eqa.round;
    if (eqa.testDate !== undefined) dbPayload.test_date = eqa.testDate;
    if (eqa.level1Value !== undefined) dbPayload.l1_val = eqa.level1Value;
    if (eqa.level1Target !== undefined) dbPayload.l1_tgt = eqa.level1Target;
    if (eqa.level2Value !== undefined) dbPayload.l2_val = eqa.level2Value;
    if (eqa.level2Target !== undefined) dbPayload.l2_tgt = eqa.level2Target;
    if (eqa.level3Value !== undefined) dbPayload.l3_val = eqa.level3Value;
    if (eqa.level3Target !== undefined) dbPayload.l3_tgt = eqa.level3Target;
    if (eqa.score !== undefined) dbPayload.score = eqa.score;
    if (eqa.status !== undefined) dbPayload.status = eqa.status;
    if (eqa.feedback !== undefined) dbPayload.feedback = eqa.feedback || null;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).update(dbPayload).eq('id', id).select().maybeSingle(),
        'eqa_records'
      );
      if (!error && data) return mapDbToEqaRecord(data);
      if (error && !isMissingTable) {
        console.warn('Supabase updateEqaRecord notice:', error.message || error);
      }
    }
    const data = await safeApiFetch(`/api/eqa-records/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToEqaRecord(data) : (eqa as EqaRecord);
  },

  async deleteEqaRecord(id: string): Promise<void> {
    if (getSupabaseClient()) {
      const { error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).delete().eq('id', id),
        'eqa_records'
      );
      if (!error) return;
      if (error && !isMissingTable) {
        console.warn('Supabase deleteEqaRecord notice:', error.message || error);
      }
    }
    await safeApiFetch(`/api/eqa-records/${id}`, { method: 'DELETE' });
  },

  // --- user_manuals ---
  async getManuals(): Promise<UserManual[]> {
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).select('*'),
        'user_manuals'
      );
      if (!error && Array.isArray(data)) {
        const filtered = (data as any[])
          .filter(m => !m.is_deleted)
          .sort((a, b) => new Date(b.created_at || b.upload_date || 0).getTime() - new Date(a.created_at || a.upload_date || 0).getTime());
        return filtered.map(mapDbToManual);
      }
      if (error && !isMissingTable) {
        console.warn('Supabase getManuals notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/manuals');
    return data ? (data as any[]).map(mapDbToManual) : [];
  },

  async insertManual(manual: UserManual): Promise<UserManual> {
    const dbPayload = mapManualToDb(manual);
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([dbPayload]).select().maybeSingle(),
        'user_manuals'
      );
      if (!error && data) return mapDbToManual(data);
      if (error && !isMissingTable) {
        console.warn('Supabase insertManual notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/manuals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToManual(data) : manual;
  },

  async deleteManual(id: string): Promise<void> {
    if (getSupabaseClient()) {
      const { error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).update({ is_deleted: true }).eq('id', id),
        'user_manuals'
      );
      if (!error) return;
      if (error && !isMissingTable) {
        console.warn('Supabase deleteManual notice:', error.message || error);
      }
    }
    await safeApiFetch(`/api/manuals/${id}`, { method: 'DELETE' });
  },

  // --- announcements ---
  async getAnnouncements(): Promise<Announcement[]> {
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).select('*'),
        'announcements'
      );
      if (!error && Array.isArray(data)) {
        const filtered = (data as any[])
          .filter(a => !a.is_deleted)
          .sort((a, b) => {
            if (Boolean(b.pinned) !== Boolean(a.pinned)) {
              return b.pinned ? 1 : -1;
            }
            return new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime();
          });
        return filtered.map(mapDbToAnnouncement);
      }
      if (error && !isMissingTable) {
        console.warn('Supabase getAnnouncements notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/announcements');
    return data ? (data as any[]).map(mapDbToAnnouncement) : [];
  },

  async insertAnnouncement(ann: Announcement): Promise<Announcement> {
    const dbPayload = mapAnnouncementToDb(ann);
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([dbPayload]).select().maybeSingle(),
        'announcements'
      );
      if (!error && data) return mapDbToAnnouncement(data);
      if (error && !isMissingTable) {
        console.warn('Supabase insertAnnouncement notice:', error.message || error);
      }
    }
    const data = await safeApiFetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToAnnouncement(data) : ann;
  },

  async deleteAnnouncement(id: string): Promise<void> {
    if (getSupabaseClient()) {
      const { error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).update({ is_deleted: true }).eq('id', id),
        'announcements'
      );
      if (!error) return;
      if (error && !isMissingTable) {
        console.warn('Supabase deleteAnnouncement notice:', error.message || error);
      }
    }
    await safeApiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
  },

  // --- maintenance_logs ---
  async getMaintenanceLogs(): Promise<any[]> {
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).select('*'),
        'maintenance_logs',
        ['repair_requests']
      );
      if (!error && Array.isArray(data)) {
        return (data as any[]).map((row) => {
          if (row.maintenance_type || row.description) {
            return {
              id: row.id,
              date: row.date || row.created_at?.split('T')[0],
              serialNumber: row.serial_number,
              actionType: row.maintenance_type,
              description: row.description,
              operator: row.operator
            };
          } else if (row.problem && row.problem.startsWith('[Maintenance')) {
            return {
              id: row.id,
              date: row.req_date || row.created_at?.split('T')[0],
              serialNumber: row.bgm_code,
              actionType: row.diagnosis || 'repair',
              description: row.problem.replace(/^\[Maintenance: [^\]]+\]\s*/, ''),
              operator: row.reporter
            };
          }
          return null;
        }).filter(Boolean).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      }
      if (error && !isMissingTable) {
        console.warn('Supabase getMaintenanceLogs notice:', error.message || error);
      }
    }
    return [];
  },

  async insertMaintenanceLog(log: any): Promise<any> {
    const dbPayload = {
      date: log.date || new Date().toISOString().split('T')[0],
      serial_number: log.serialNumber,
      ward: log.ward || 'LAB',
      maintenance_type: log.actionType,
      description: log.description,
      operator: log.operator
    };

    const repairPayload = {
      bgm_code: log.serialNumber,
      ward: log.ward || 'LAB',
      reporter: log.operator,
      problem: `[Maintenance: ${log.actionType}] ${log.description}`,
      diagnosis: log.actionType,
      action: log.description,
      status: 'completed',
      operator: log.operator,
      req_date: log.date || new Date().toISOString().split('T')[0]
    };

    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([dbPayload]).select().maybeSingle(),
        'maintenance_logs'
      );
      
      await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([repairPayload]),
        'repair_requests'
      ).catch(() => {});

      if (error) {
        throw error;
      }
      if (data) {
        const item = data as any;
        return {
          id: item.id,
          date: item.date,
          serialNumber: item.serial_number,
          actionType: item.maintenance_type,
          description: item.description,
          operator: item.operator
        };
      }
    }

    return log;
  },

  // --- strip_reagent_items ---
  async getStripReagentItems(): Promise<any[]> {
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).select('*'),
        'strip_reagent_items'
      );
      if (!error && Array.isArray(data)) {
        return (data as any[]).map((row) => ({
          id: row.id,
          itemCode: row.item_code,
          lotNumber: row.lot_number,
          manufacturer: row.manufacturer,
          itemType: row.item_type,
          receivedDate: row.received_date,
          expDate: row.exp_date,
          openDate: row.open_date,
          openExpDate: row.open_exp_date,
          status: row.status,
          openedBy: row.opened_by,
          notes: row.notes,
          boxIndex: row.box_index,
          totalBoxes: row.total_boxes
        })).sort((a, b) => new Date(b.receivedDate || 0).getTime() - new Date(a.receivedDate || 0).getTime());
      }
      if (error && !isMissingTable) {
        console.warn('Supabase getStripReagentItems notice:', error.message || error);
      }
    }
    return [];
  },

  async insertStripReagentItems(items: any[]): Promise<any[]> {
    if (!items || items.length === 0) return [];
    const dbPayloads = items.map(item => ({
      item_code: item.itemCode,
      lot_number: item.lotNumber,
      manufacturer: item.manufacturer || 'VivaChek Fad',
      item_type: item.itemType,
      received_date: item.receivedDate,
      exp_date: item.expDate,
      open_date: item.openDate || null,
      open_exp_date: item.openExpDate || null,
      status: item.status || 'in_stock',
      opened_by: item.openedBy || null,
      notes: item.notes || null,
      box_index: item.boxIndex || 1,
      total_boxes: item.totalBoxes || 1
    }));

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert(dbPayloads).select(),
        'strip_reagent_items'
      );
      if (!error && Array.isArray(data)) {
        return (data as any[]).map(row => ({
          id: row.id,
          itemCode: row.item_code,
          lotNumber: row.lot_number,
          manufacturer: row.manufacturer,
          itemType: row.item_type,
          receivedDate: row.received_date,
          expDate: row.exp_date,
          openDate: row.open_date,
          openExpDate: row.open_exp_date,
          status: row.status,
          openedBy: row.opened_by,
          notes: row.notes,
          boxIndex: row.box_index,
          totalBoxes: row.total_boxes
        }));
      }
      if (error && !isMissingTable) {
        console.warn('Supabase insertStripReagentItems notice:', error.message || error);
      }
    }
    return items;
  },

  async updateStripReagentItem(id: string, updates: Partial<any>): Promise<any> {
    const dbPayload: any = {};
    if (updates.status !== undefined) dbPayload.status = updates.status;
    if (updates.openDate !== undefined) dbPayload.open_date = updates.openDate;
    if (updates.openExpDate !== undefined) dbPayload.open_exp_date = updates.openExpDate;
    if (updates.openedBy !== undefined) dbPayload.opened_by = updates.openedBy;
    if (updates.notes !== undefined) dbPayload.notes = updates.notes;
    if (updates.itemCode !== undefined) dbPayload.item_code = updates.itemCode;
    if (updates.lotNumber !== undefined) dbPayload.lot_number = updates.lotNumber;
    if (updates.manufacturer !== undefined) dbPayload.manufacturer = updates.manufacturer;
    if (updates.itemType !== undefined) dbPayload.item_type = updates.itemType;
    if (updates.receivedDate !== undefined) dbPayload.received_date = updates.receivedDate;
    if (updates.expDate !== undefined) dbPayload.exp_date = updates.expDate;
    if (updates.boxIndex !== undefined) dbPayload.box_index = updates.boxIndex;
    if (updates.totalBoxes !== undefined) dbPayload.total_boxes = updates.totalBoxes;

    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).update(dbPayload).eq('id', id).select().maybeSingle(),
        'strip_reagent_items'
      );
      if (!error && data) {
        const row = data as any;
        return {
          id: row.id,
          itemCode: row.item_code,
          lotNumber: row.lot_number,
          manufacturer: row.manufacturer,
          itemType: row.item_type,
          receivedDate: row.received_date,
          expDate: row.exp_date,
          openDate: row.open_date,
          openExpDate: row.open_exp_date,
          status: row.status,
          openedBy: row.opened_by,
          notes: row.notes,
          boxIndex: row.box_index,
          totalBoxes: row.total_boxes
        };
      }
      if (error && !isMissingTable) {
        console.warn('Supabase updateStripReagentItem notice:', error.message || error);
      }
    }
    const data = await safeApiFetch(`/api/strip-reagent-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? data : updates;
  },

  async deleteStripReagentItem(id: string): Promise<void> {
    if (getSupabaseClient()) {
      const { error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).delete().eq('id', id),
        'strip_reagent_items'
      );
      if (error && !isMissingTable) {
        console.warn('Supabase deleteStripReagentItem notice:', error.message || error);
      }
    }
    await safeApiFetch(`/api/strip-reagent-items/${id}`, { method: 'DELETE' }).catch(() => {});
  },

  // --- daily_checklists (Quick Win & Staff Maintenance) ---
  async getDailyChecklists(): Promise<DailyChecklist[]> {
    if (getSupabaseClient()) {
      const { data, error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).select('*'),
        'daily_checklists',
        ['repair_requests']
      );
      if (!error && Array.isArray(data)) {
        return (data as any[]).map((row): DailyChecklist => ({
          id: row.id,
          date: row.date || row.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          serialNumber: row.serial_number || '',
          ward: row.ward || 'งานชันสูตรสาธารณสุข',
          chkBodyClean: row.chk_body_clean ?? true,
          chkPowerButton: row.chk_power_button ?? true,
          chkStripSlot: row.chk_strip_slot ?? true,
          chkBatterySlot: row.chk_battery_slot ?? true,
          chkBattery: row.chk_battery ?? true,
          chkScreenDisplay: row.chk_screen_display ?? true,
          chkMeasurement: row.chk_measurement ?? true,
          chkIqcPassed: row.chk_iqc_passed ?? true,
          status: (row.status === 'issue' || row.status === 'fail') ? 'issue' : 'normal',
          note: row.remark || row.note || row.notes || '',
          operator: row.operator || row.inspector || row.staff_name || '',
          createdAt: row.created_at
        })).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      }
      if (error && !isMissingTable) {
        console.warn('Supabase getDailyChecklists notice:', error.message || error);
      }
    }
    return [];
  },

  async insertDailyChecklist(chk: DailyChecklist): Promise<DailyChecklist> {
    const dbPayload = {
      date: chk.date || new Date().toISOString().split('T')[0],
      serial_number: chk.serialNumber, // S/N from manufacturer
      operator: chk.operator,
      status: chk.status,
      chk_body_clean: chk.chkBodyClean,
      chk_power_button: chk.chkPowerButton,
      chk_strip_slot: chk.chkStripSlot,
      chk_battery_slot: chk.chkBatterySlot,
      chk_battery: chk.chkBattery,
      chk_screen_display: chk.chkScreenDisplay,
      chk_measurement: chk.chkMeasurement,
      chk_iqc_passed: chk.chkIqcPassed,
      remark: chk.note || ''
    };

    // Find the machine code (bgm_code) and machineSerial to map to repairPayload
    let bgmCode = chk.serialNumber;
    let mfgSerial = chk.serialNumber;
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('dtx_machines');
        if (stored) {
          const machinesList = JSON.parse(stored);
          const found = machinesList.find((m: any) => m.machineSerial === chk.serialNumber || m.serialNumber === chk.serialNumber);
          if (found) {
            bgmCode = found.serialNumber || found.machineSerial;
            mfgSerial = found.machineSerial || found.serialNumber;
          }
        }
      } catch {}
    }

    const repairPayload = {
      bgm_code: bgmCode,
      serial_number: mfgSerial,
      ward: 'LAB', // Internal lab maintenance
      reporter: chk.operator,
      problem: `[Daily Checklist: ${chk.status}] Note: ${chk.note || '-'}`,
      status: chk.status === 'issue' ? 'pending' : 'completed',
      operator: chk.operator,
      req_date: chk.date || new Date().toISOString().split('T')[0],
      checklist: chk
    };

    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([dbPayload]).select().maybeSingle(),
        'daily_checklists'
      );
      if (error) {
        throw error;
      }

      await querySupabaseClient(
        (c, tbl) => c.from(tbl).insert([repairPayload]),
        'repair_requests'
      ).catch(() => {});

      if (data) {
        const row = data as any;
        return {
          id: row.id,
          date: row.date,
          serialNumber: row.serial_number,
          ward: row.ward || 'งานชันสูตรสาธารณสุข',
          chkBodyClean: row.chk_body_clean,
          chkPowerButton: row.chk_power_button,
          chkStripSlot: row.chk_strip_slot,
          chkBatterySlot: row.chk_battery_slot,
          chkBattery: row.chk_battery,
          chkScreenDisplay: row.chk_screen_display,
          chkMeasurement: row.chk_measurement,
          chkIqcPassed: row.chk_iqc_passed,
          status: row.status === 'issue' ? 'issue' : 'normal',
          note: row.remark,
          operator: row.operator,
          createdAt: row.created_at
        };
      }
    }

    return chk;
  },

  async deleteDailyChecklist(id: string): Promise<void> {
    if (getSupabaseClient()) {
      const { error, isMissingTable } = await querySupabaseClient(
        (c, tbl) => c.from(tbl).delete().eq('id', id),
        'daily_checklists'
      );
      if (error && !isMissingTable) {
        console.warn('Supabase deleteDailyChecklist notice:', error.message || error);
      }
    }
    await safeApiFetch(`/api/daily-checklists/${id}`, { method: 'DELETE' });
  }
};
