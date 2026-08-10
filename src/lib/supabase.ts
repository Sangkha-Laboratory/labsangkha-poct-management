/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DtxMachine, RepairRequest, SupplyRequest, QcRecord, QcLotConfig, EqaRecord, UserManual, Announcement } from '../types';
import { INITIAL_WARDS } from '../mockData';

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

let cachedClient: SupabaseClient | null = null;
let cachedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) return null;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;

  const currentComposite = `${url}::${key}`;
  if (cachedClient && cachedKey === currentComposite) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key);
    cachedKey = currentComposite;
    return cachedClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
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
}

export const supabase = getSupabaseClient();

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseClient() !== null;
};

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

/**
 * Smart query runner:
 * Tries `poct_system` schema first. If that throws an error or table is missing,
 * falls back to `public` schema automatically.
 */
async function querySupabaseClient<T>(
  fn: (client: any) => PromiseLike<{ data: T | null; error: any }> | Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: new Error('Supabase client not initialized') };

  // Attempt 1: poct_system schema
  try {
    const poctClient = client.schema('poct_system');
    const resPoct = (await fn(poctClient)) as { data: T | null; error: any };
    if (!resPoct.error && resPoct.data !== null) {
      return resPoct;
    }
  } catch (err) {
    // Ignore and proceed to public schema fallback
  }

  // Attempt 2: public schema fallback
  try {
    const resPublic = (await fn(client)) as { data: T | null; error: any };
    return resPublic;
  } catch (err: any) {
    return { data: null, error: err };
  }
}

// ==========================================================================
// Data Mappers: Convert CamelCase (Frontend) <-> snake_case (Supabase)
// ==========================================================================

export const mapDbToMachine = (db: any): DtxMachine => ({
  id: db.id,
  serialNumber: db.bgm_code,
  machineSerial: db.serial_number,
  brand: db.brand,
  model: 'Instant',
  ward: db.ward,
  status: db.status as any,
  receiveDate: db.rec_date,
  lastQCDate: db.last_qc_date || undefined,
  lotNumber: db.lot_number,
  remark: db.remark || undefined
});

export const mapMachineToDb = (m: DtxMachine) => ({
  bgm_code: m.serialNumber,
  serial_number: m.machineSerial,
  brand: m.brand,
  ward: m.ward,
  status: m.status,
  rec_date: m.receiveDate,
  last_qc_date: m.lastQCDate || null,
  lot_number: m.lotNumber,
  remark: m.remark || null
});

export const mapDbToRepair = (db: any): RepairRequest => ({
  id: db.id,
  serialNumber: db.bgm_code,
  machineSerial: db.serial_number || undefined,
  ward: db.ward,
  reporterName: db.reporter,
  reporterPhone: db.phone,
  reportedProblem: db.problem,
  requestDate: db.created_at || db.req_date,
  status: db.status as any,
  diagnosedProblem: db.diagnosis || undefined,
  actionTaken: db.action || undefined,
  operatorName: db.operator || undefined,
  receiverName: db.receiver || undefined,
  completionDate: db.complete_date || undefined,
  needsBackup: db.need_backup,
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
  status: r.status,
  diagnosis: r.diagnosedProblem || null,
  action: r.actionTaken || null,
  operator: r.operatorName || null,
  receiver: r.receiverName || null,
  complete_date: r.completionDate || null,
  need_backup: r.needsBackup || false,
  checklist: r.checklist
});

export const mapDbToSupply = (db: any): SupplyRequest => ({
  id: db.id,
  ward: db.ward,
  requesterName: db.requester,
  itemType: db.item as any,
  quantity: db.qty,
  reason: db.reason,
  requestDate: db.created_at || db.req_date,
  status: db.status as any
});

export const mapSupplyToDb = (s: SupplyRequest) => ({
  ward: s.ward,
  requester: s.requesterName,
  item: s.itemType,
  qty: s.quantity,
  reason: s.reason,
  status: s.status
});

export const mapDbToQcRecord = (db: any): QcRecord => ({
  id: db.id,
  date: db.date,
  receiveDate: db.rec_date,
  returnDate: db.ret_date,
  ward: db.ward,
  serialNumber: db.bgm_code,
  operator: db.operator,
  lotNumber: db.lot_number,
  level1: Number(db.level1),
  level2: Number(db.level2),
  level3: Number(db.level3),
  level1Status: db.l1_status as any,
  level2Status: db.l2_status as any,
  level3Status: db.l3_status as any
});

export const mapQcRecordToDb = (q: QcRecord) => ({
  date: q.date,
  rec_date: q.receiveDate,
  ret_date: q.returnDate,
  ward: q.ward,
  bgm_code: q.serialNumber,
  operator: q.operator,
  lot_number: q.lotNumber,
  level1: q.level1,
  level2: q.level2,
  level3: q.level3,
  l1_status: q.level1Status,
  l2_status: q.level2Status,
  l3_status: q.level3Status
});

export const mapDbToLotConfig = (db: any): QcLotConfig => ({
  lotNumber: db.lot_number,
  level1Target: Number(db.l1_target),
  level1Min: Number(db.l1_min),
  level1Max: Number(db.l1_max),
  level1SD: Number(db.l1_sd),
  level2Target: Number(db.l2_target),
  level2Min: Number(db.l2_min),
  level2Max: Number(db.l2_max),
  level2SD: Number(db.l2_sd),
  level3Target: Number(db.l3_target),
  level3Min: Number(db.l3_min),
  level3Max: Number(db.l3_max),
  level3SD: Number(db.l3_sd)
});

export const mapLotConfigToDb = (l: QcLotConfig) => ({
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
});

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

// ==========================================================================
// Database Service: Dual-Schema (poct_system -> public) + API Proxy Fallback
// ==========================================================================

export const dbService = {
  // --- master_wards ---
  async getWards(): Promise<{ en_name: string; thai_name: string }[]> {
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('master_wards').select('en_name, thai_name'));
      if (!error && data) return data as any;
    }
    try {
      const data = await safeApiFetch('/api/wards');
      if (Array.isArray(data)) return data;
    } catch {}
    return [];
  },

  // --- dtx_machines ---
  async getMachines(): Promise<DtxMachine[]> {
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('dtx_machines').select('*'));
      if (!error && data) return (data as any[]).map(mapDbToMachine);
    }
    const data = await safeApiFetch('/api/machines');
    return data ? (data as any[]).map(mapDbToMachine) : [];
  },

  async insertMachine(machine: DtxMachine): Promise<DtxMachine> {
    const dbPayload = mapMachineToDb(machine);
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('dtx_machines').insert(dbPayload).select().single());
      if (!error && data) return mapDbToMachine(data);
    }
    const data = await safeApiFetch('/api/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToMachine(data) : machine;
  },

  async updateMachine(id: string, machine: Partial<DtxMachine>): Promise<DtxMachine> {
    const dbPayload: any = {};
    if (machine.serialNumber !== undefined) dbPayload.bgm_code = machine.serialNumber;
    if (machine.machineSerial !== undefined) dbPayload.serial_number = machine.machineSerial;
    if (machine.brand !== undefined) dbPayload.brand = machine.brand;
    if (machine.ward !== undefined) dbPayload.ward = machine.ward;
    if (machine.status !== undefined) dbPayload.status = machine.status;
    if (machine.receiveDate !== undefined) dbPayload.rec_date = machine.receiveDate;
    if (machine.lastQCDate !== undefined) dbPayload.last_qc_date = machine.lastQCDate || null;
    if (machine.lotNumber !== undefined) dbPayload.lot_number = machine.lotNumber;
    if (machine.remark !== undefined) dbPayload.remark = machine.remark || null;

    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('dtx_machines').update(dbPayload).eq('id', id).select().single());
      if (!error && data) return mapDbToMachine(data);
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
      const { error } = await querySupabaseClient((c) => c.from('dtx_machines').delete().eq('id', id));
      if (!error) return;
    }
    await safeApiFetch(`/api/machines/${id}`, { method: 'DELETE' });
  },

  // --- repair_requests ---
  async getRepairs(): Promise<RepairRequest[]> {
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('repair_requests').select('*'));
      if (!error && data) return (data as any[]).map(mapDbToRepair);
    }
    const data = await safeApiFetch('/api/repairs');
    return data ? (data as any[]).map(mapDbToRepair) : [];
  },

  async insertRepair(repair: RepairRequest): Promise<RepairRequest> {
    const dbPayload = mapRepairToDb(repair);
    const payloadWithId = repair.id ? { ...dbPayload, id: repair.id } : dbPayload;
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('repair_requests').insert(payloadWithId).select().single());
      if (!error && data) return mapDbToRepair(data);
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
      const { data, error } = await querySupabaseClient((c) => c.from('repair_requests').update(dbPayload).eq('id', id).select().single());
      if (!error && data) return mapDbToRepair(data);
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
      const { error } = await querySupabaseClient((c) => c.from('repair_requests').delete().eq('id', id));
      if (!error) return;
    }
    await safeApiFetch(`/api/repairs/${id}`, { method: 'DELETE' });
  },

  // --- supply_requests ---
  async getSupplies(): Promise<SupplyRequest[]> {
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('supply_requests').select('*'));
      if (!error && data) return (data as any[]).map(mapDbToSupply);
    }
    const data = await safeApiFetch('/api/supplies');
    return data ? (data as any[]).map(mapDbToSupply) : [];
  },

  async insertSupply(supply: SupplyRequest): Promise<SupplyRequest> {
    const dbPayload = mapSupplyToDb(supply);
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('supply_requests').insert(dbPayload).select().single());
      if (!error && data) return mapDbToSupply(data);
    }
    const data = await safeApiFetch('/api/supplies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToSupply(data) : supply;
  },

  async updateSupply(id: string, supply: Partial<SupplyRequest>): Promise<SupplyRequest> {
    const dbPayload: any = {};
    if (supply.ward !== undefined) dbPayload.ward = supply.ward;
    if (supply.requesterName !== undefined) dbPayload.requester = supply.requesterName;
    if (supply.itemType !== undefined) dbPayload.item = supply.itemType;
    if (supply.quantity !== undefined) dbPayload.qty = supply.quantity;
    if (supply.reason !== undefined) dbPayload.reason = supply.reason;
    if (supply.requestDate !== undefined) dbPayload.req_date = supply.requestDate;
    if (supply.status !== undefined) dbPayload.status = supply.status;

    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('supply_requests').update(dbPayload).eq('id', id).select().single());
      if (!error && data) return mapDbToSupply(data);
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
      const { error } = await querySupabaseClient((c) => c.from('supply_requests').delete().eq('id', id));
      if (!error) return;
    }
    await safeApiFetch(`/api/supplies/${id}`, { method: 'DELETE' });
  },

  // --- qc_records ---
  async getQcRecords(): Promise<QcRecord[]> {
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('qc_records').select('*'));
      if (!error && data) return (data as any[]).map(mapDbToQcRecord);
    }
    const data = await safeApiFetch('/api/qc-records');
    return data ? (data as any[]).map(mapDbToQcRecord) : [];
  },

  async insertQcRecord(qc: QcRecord): Promise<QcRecord> {
    const dbPayload = mapQcRecordToDb(qc);
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('qc_records').insert(dbPayload).select().single());
      if (!error && data) return mapDbToQcRecord(data);
    }
    const data = await safeApiFetch('/api/qc-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
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
    if (qc.level1 !== undefined) dbPayload.level1 = qc.level1;
    if (qc.level2 !== undefined) dbPayload.level2 = qc.level2;
    if (qc.level3 !== undefined) dbPayload.level3 = qc.level3;
    if (qc.level1Status !== undefined) dbPayload.l1_status = qc.level1Status;
    if (qc.level2Status !== undefined) dbPayload.l2_status = qc.level2Status;
    if (qc.level3Status !== undefined) dbPayload.l3_status = qc.level3Status;

    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('qc_records').update(dbPayload).eq('id', id).select().single());
      if (!error && data) return mapDbToQcRecord(data);
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
      const { error } = await querySupabaseClient((c) => c.from('qc_records').delete().eq('id', id));
      if (!error) return;
    }
    await safeApiFetch(`/api/qc-records/${id}`, { method: 'DELETE' });
  },

  // --- qc_lot_configs ---
  async getLotConfigs(): Promise<QcLotConfig[]> {
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('qc_lot_configs').select('*'));
      if (!error && data) return (data as any[]).map(mapDbToLotConfig);
    }
    const data = await safeApiFetch('/api/lot-configs');
    return data ? (data as any[]).map(mapDbToLotConfig) : [];
  },

  async insertLotConfig(lot: QcLotConfig): Promise<QcLotConfig> {
    const dbPayload = mapLotConfigToDb(lot);
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('qc_lot_configs').insert(dbPayload).select().single());
      if (!error && data) return mapDbToLotConfig(data);
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
      const { data, error } = await querySupabaseClient((c) => c.from('qc_lot_configs').update(dbPayload).eq('lot_number', lotNumber).select().single());
      if (!error && data) return mapDbToLotConfig(data);
    }
    const data = await safeApiFetch(`/api/lot-configs/${lotNumber}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
    });
    return data ? mapDbToLotConfig(data) : (lot as QcLotConfig);
  },

  async deleteLotConfig(lotNumber: string): Promise<void> {
    if (getSupabaseClient()) {
      const { error } = await querySupabaseClient((c) => c.from('qc_lot_configs').delete().eq('lot_number', lotNumber));
      if (!error) return;
    }
    await safeApiFetch(`/api/lot-configs/${lotNumber}`, { method: 'DELETE' });
  },

  // --- eqa_records ---
  async getEqaRecords(): Promise<EqaRecord[]> {
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('eqa_records').select('*'));
      if (!error && data) return (data as any[]).map(mapDbToEqaRecord);
    }
    const data = await safeApiFetch('/api/eqa-records');
    return data ? (data as any[]).map(mapDbToEqaRecord) : [];
  },

  async insertEqaRecord(eqa: EqaRecord): Promise<EqaRecord> {
    const dbPayload = mapEqaRecordToDb(eqa);
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('eqa_records').insert(dbPayload).select().single());
      if (!error && data) return mapDbToEqaRecord(data);
    }
    const data = await safeApiFetch('/api/eqa-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbPayload)
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
      const { data, error } = await querySupabaseClient((c) => c.from('eqa_records').update(dbPayload).eq('id', id).select().single());
      if (!error && data) return mapDbToEqaRecord(data);
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
      const { error } = await querySupabaseClient((c) => c.from('eqa_records').delete().eq('id', id));
      if (!error) return;
    }
    await safeApiFetch(`/api/eqa-records/${id}`, { method: 'DELETE' });
  },

  // --- user_manuals ---
  async getManuals(): Promise<UserManual[]> {
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('user_manuals').select('*').eq('is_deleted', false));
      if (!error && data) return (data as any[]).map(mapDbToManual);
    }
    const data = await safeApiFetch('/api/manuals');
    return data ? (data as any[]).map(mapDbToManual) : [];
  },

  async insertManual(manual: UserManual): Promise<UserManual> {
    const dbPayload = mapManualToDb(manual);
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('user_manuals').insert(dbPayload).select().single());
      if (!error && data) return mapDbToManual(data);
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
      const { error } = await querySupabaseClient((c) => c.from('user_manuals').update({ is_deleted: true }).eq('id', id));
      if (!error) return;
    }
    await safeApiFetch(`/api/manuals/${id}`, { method: 'DELETE' });
  },

  // --- announcements ---
  async getAnnouncements(): Promise<Announcement[]> {
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('announcements').select('*').eq('is_deleted', false));
      if (!error && data) return (data as any[]).map(mapDbToAnnouncement);
    }
    const data = await safeApiFetch('/api/announcements');
    return data ? (data as any[]).map(mapDbToAnnouncement) : [];
  },

  async insertAnnouncement(ann: Announcement): Promise<Announcement> {
    const dbPayload = mapAnnouncementToDb(ann);
    if (getSupabaseClient()) {
      const { data, error } = await querySupabaseClient((c) => c.from('announcements').insert(dbPayload).select().single());
      if (!error && data) return mapDbToAnnouncement(data);
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
      const { error } = await querySupabaseClient((c) => c.from('announcements').update({ is_deleted: true }).eq('id', id));
      if (!error) return;
    }
    await safeApiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
  }
};
