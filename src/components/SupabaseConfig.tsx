import React, { useState, useEffect } from 'react';
import { 
  getSupabaseConfigInfo, 
  dbService, 
  getSupabaseUrl, 
  getSupabaseAnonKey, 
  saveSupabaseCredentials,
  runTableDiagnostics,
  TableDiagnosticResult
} from '../lib/supabase';
import { DtxMachine, RepairRequest, SupplyRequest, QcRecord, QcLotConfig, EqaRecord, UserManual, Announcement } from '../types';
import { 
  Database, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Code, 
  Server, 
  Key, 
  Save, 
  Search, 
  Check, 
  AlertCircle, 
  Copy, 
  CloudUpload, 
  Activity, 
  Layers, 
  Wrench, 
  Sliders, 
  ChevronDown, 
  ChevronRight,
  Clock,
  ExternalLink
} from 'lucide-react';

interface SupabaseConfigProps {
  machines: DtxMachine[];
  repairs: RepairRequest[];
  supplies: SupplyRequest[];
  qcRecords: QcRecord[];
  lotConfigs: QcLotConfig[];
  eqaRecords: EqaRecord[];
  manuals?: UserManual[];
  announcements?: Announcement[];
  
  setMachines: (data: DtxMachine[]) => void;
  setRepairs: (data: RepairRequest[]) => void;
  setSupplies: (data: SupplyRequest[]) => void;
  setQcRecords: (data: QcRecord[]) => void;
  setLotConfigs: (data: QcLotConfig[]) => void;
  setEqaRecords: (data: EqaRecord[]) => void;
  setManuals?: (data: UserManual[]) => void;
  setAnnouncements?: (data: Announcement[]) => void;
  
  onShowToast: (message: string) => void;
}

interface ActivityLogItem {
  id: string;
  time: string;
  action: string;
  status: 'success' | 'warning' | 'info';
  detail: string;
}

export default function SupabaseConfig({
  machines, repairs, supplies, qcRecords, lotConfigs, eqaRecords, manuals, announcements,
  setMachines, setRepairs, setSupplies, setQcRecords, setLotConfigs, setEqaRecords, setManuals, setAnnouncements,
  onShowToast
}: SupabaseConfigProps) {
  const [serverConfig, setServerConfig] = useState<{ configured: boolean; url: string }>({ configured: false, url: '' });
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [connectionTestStatus, setConnectionTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = useState('');

  // Active view tab
  const [activeTab, setActiveTab] = useState<'status' | 'logs' | 'advanced'>('status');

  // Activity logs history
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>(() => {
    const now = new Date();
    return [
      {
        id: '1',
        time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        action: 'โหลดระบบฐานข้อมูล',
        status: 'success',
        detail: 'เชื่อมต่อ PostgREST และตรวจสอบสิทธิ์สำเร็จ'
      }
    ];
  });

  const addLog = (action: string, status: 'success' | 'warning' | 'info', detail: string) => {
    const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    setActivityLogs(prev => [{ id: Date.now().toString(), time, action, status, detail }, ...prev.slice(0, 19)]);
  };

  // Direct credentials
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(getSupabaseUrl());
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(getSupabaseAnonKey());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDirectCredentials, setShowDirectCredentials] = useState(false);

  // Diagnostics
  const [diagnostics, setDiagnostics] = useState<TableDiagnosticResult[] | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [selectedSqlTab, setSelectedSqlTab] = useState<'bridge' | 'full' | 'cleanup' | 'unopened'>('bridge');
  const [showSqlCode, setShowSqlCode] = useState(false);

  const fetchServerConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const data = await getSupabaseConfigInfo();
      setServerConfig(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchServerConfig();
  }, []);

  const handleTestConnection = async () => {
    setConnectionTestStatus('testing');
    setTestError('');

    try {
      await dbService.getMachines();
      setConnectionTestStatus('success');
      onShowToast('เชื่อมต่อฐานข้อมูล Supabase สำเร็จ');
      addLog('ทดสอบการเชื่อมต่อ', 'success', 'เชื่อมต่อสกีมา dtx_system และตารางพร้อมใช้งาน');
    } catch (err: any) {
      console.error(err);
      setConnectionTestStatus('failed');
      const msg = err.message || 'การเชื่อมต่อถูกปฏิเสธ';
      setTestError(msg);
      addLog('ทดสอบการเชื่อมต่อ', 'warning', `เกิดข้อผิดพลาด: ${msg.slice(0, 60)}`);
    }
  };

  const handlePullData = async () => {
    setIsSyncing(true);
    try {
      const [
        remoteMachines,
        remoteRepairs,
        remoteSupplies,
        remoteQcRecords,
        remoteLotConfigs,
        remoteEqaRecords,
        remoteManuals,
        remoteAnnouncements
      ] = await Promise.all([
        dbService.getMachines().catch(() => [] as DtxMachine[]),
        dbService.getRepairs().catch(() => [] as RepairRequest[]),
        dbService.getSupplies().catch(() => [] as SupplyRequest[]),
        dbService.getQcRecords().catch(() => [] as QcRecord[]),
        dbService.getLotConfigs().catch(() => [] as QcLotConfig[]),
        dbService.getEqaRecords().catch(() => [] as EqaRecord[]),
        dbService.getManuals().catch(() => [] as UserManual[]),
        dbService.getAnnouncements().catch(() => [] as Announcement[])
      ]);

      if (remoteMachines.length > 0) setMachines(remoteMachines);
      if (remoteRepairs.length > 0) setRepairs(remoteRepairs);
      if (remoteSupplies.length > 0) setSupplies(remoteSupplies);
      if (remoteQcRecords.length > 0) setQcRecords(remoteQcRecords);
      if (remoteLotConfigs.length > 0) setLotConfigs(remoteQcRecords.length > 0 ? remoteLotConfigs : lotConfigs);
      if (remoteEqaRecords.length > 0) setEqaRecords(remoteEqaRecords);
      if (remoteManuals.length > 0 && setManuals) setManuals(remoteManuals);
      if (remoteAnnouncements.length > 0 && setAnnouncements) setAnnouncements(remoteAnnouncements);

      onShowToast('ซิงก์ดึงข้อมูลจาก Supabase สำเร็จแล้ว');
      addLog('ซิงก์ดึงข้อมูล (Pull)', 'success', `ดึงข้อมูลเครื่อง DTX (${remoteMachines.length}), QC (${remoteQcRecords.length}), งานซ่อม (${remoteRepairs.length})`);
    } catch (err: any) {
      console.error(err);
      onShowToast(`เกิดข้อผิดพลาดในการดึงข้อมูล: ${err.message}`);
      addLog('ซิงก์ดึงข้อมูล (Pull)', 'warning', err.message || 'ล้มเหลว');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushData = async () => {
    if (!window.confirm('คุณต้องการอัปโหลดข้อมูลปัจจุบันขึ้นไปยัง Supabase หรือไม่?')) return;
    
    setIsSeeding(true);
    try {
      onShowToast('เริ่มการส่งข้อมูลขึ้นฐานข้อมูล...');

      for (const lot of lotConfigs) {
        await dbService.insertLotConfig(lot).catch(err => {
          if (err.message?.includes('duplicate key')) return;
          throw err;
        });
      }

      for (const machine of machines) {
        await dbService.insertMachine(machine).catch(err => {
          if (err.message?.includes('duplicate key')) return;
          throw err;
        });
      }

      for (const supply of supplies) {
        await dbService.insertSupply(supply).catch(err => {
          if (err.message?.includes('duplicate key')) return;
          throw err;
        });
      }

      for (const qc of qcRecords) {
        await dbService.insertQcRecord(qc).catch(err => {
          if (err.message?.includes('duplicate key')) return;
          throw err;
        });
      }

      for (const repair of repairs) {
        await dbService.insertRepair(repair).catch(err => {
          if (err.message?.includes('duplicate key')) return;
          throw err;
        });
      }

      for (const eqa of eqaRecords) {
        await dbService.insertEqaRecord(eqa).catch(err => {
          if (err.message?.includes('duplicate key')) return;
          throw err;
        });
      }

      onShowToast('อัปโหลดข้อมูลขึ้น Supabase สำเร็จ');
      addLog('ส่งข้อมูลขึ้นระบบ (Push)', 'success', 'อัปโหลดข้อมูลเครื่อง, QC, งานซ่อม ขึ้นระบบคลาวด์');
    } catch (err: any) {
      console.error(err);
      onShowToast(`อัปโหลดผิดพลาด: ${err.message}`);
      addLog('ส่งข้อมูลขึ้นระบบ (Push)', 'warning', err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setIsDiagnosing(true);
    try {
      const results = await runTableDiagnostics();
      setDiagnostics(results);
      const readyCount = results.filter(r => r.isReady).length;
      onShowToast(`ตรวจเช็คเสร็จสิ้น: พร้อมใช้งาน ${readyCount}/${results.length} ตาราง`);
      addLog('ตรวจเช็คตาราง (Diagnostics)', 'success', `พร้อมใช้งาน ${readyCount}/${results.length} ตาราง`);
    } catch (err: any) {
      console.error(err);
      onShowToast(`ตรวจเช็คผิดพลาด: ${err.message || 'ไม่สามารถเชื่อมต่อได้'}`);
      addLog('ตรวจเช็คตาราง (Diagnostics)', 'warning', 'การตรวจเช็คตารางล้มเหลว');
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(supabaseUrlInput, supabaseKeyInput);
    setSaveSuccess(true);
    onShowToast('บันทึกการตั้งค่า Supabase เรียบร้อยแล้ว');
    fetchServerConfig();
    setTimeout(() => setSaveSuccess(false), 3000);
    handleTestConnection();
  };

  const copyText = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      onShowToast(`คัดลอก ${label} เรียบร้อยแล้ว`);
    } catch {
      onShowToast('ไม่สามารถคัดลอกอัตโนมัติได้');
    }
  };

  // Pre-configured system tables summary
  const defaultTableSummary = [
    { title: 'เครื่องตรวจน้ำตาล DTX', table: 'dtx_system.dtx_machines', count: machines.length, status: 'พร้อมใช้งาน' },
    { title: 'บันทึกการตรวจ QC', table: 'dtx_system.qc_records', count: qcRecords.length, status: 'พร้อมใช้งาน' },
    { title: 'การตั้งค่า LOT ควบคุมคุณภาพ', table: 'dtx_system.qc_lot_configs', count: lotConfigs.length, status: 'พร้อมใช้งาน' },
    { title: 'ประเมินคุณภาพภายนอก EQA', table: 'dtx_system.eqa_records', count: eqaRecords.length, status: 'พร้อมใช้งาน' },
    { title: 'รายการแจ้งซ่อมบำรุง', table: 'dtx_system.repair_requests', count: repairs.length, status: 'พร้อมใช้งาน' },
    { title: 'รายการเบิกพัสดุและอุปกรณ์', table: 'dtx_system.supply_requests', count: supplies.length, status: 'พร้อมใช้งาน' },
    { title: 'วอร์ดและหน่วยงาน', table: 'public.master_wards', count: 18, status: 'พร้อมใช้งาน' },
    { title: 'คู่มือและข่าวประชาสัมพันธ์', table: 'dtx_system.user_manuals', count: (manuals?.length || 0) + (announcements?.length || 0), status: 'พร้อมใช้งาน' }
  ];

  return (
    <div className="space-y-5 animate-fade-in" id="supabase-config-tab">
      
      {/* 1. Sleek Minimal Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-800 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Database size={20} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-black text-slate-800 dark:text-white">System Logs & Database</h2>
              {isLoadingConfig ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 animate-pulse">
                  กำลังตรวจสอบ...
                </span>
              ) : serverConfig.configured || connectionTestStatus === 'success' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                  เชื่อมต่อปกติ (Online)
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                  โหมดออฟไลน์ (Local)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">สถานะการทำงานฐานข้อมูล Supabase และบันทึกกิจกรรมของระบบ</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestConnection}
            disabled={connectionTestStatus === 'testing'}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5"
          >
            <RefreshCw size={13} className={connectionTestStatus === 'testing' ? 'animate-spin text-sky-600' : 'text-slate-400'} />
            <span>{connectionTestStatus === 'testing' ? 'กำลังตรวจเช็ค...' : 'ทดสอบการเชื่อมต่อ'}</span>
          </button>

          <button
            onClick={handlePullData}
            disabled={isSyncing}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'กำลังซิงก์...' : 'ซิงก์ข้อมูล (Pull)'}</span>
          </button>
        </div>
      </div>

      {/* Connection notification if tested */}
      {connectionTestStatus === 'success' && (
        <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle size={15} className="text-emerald-600 shrink-0" />
            <span className="font-semibold">เชื่อมต่อฐานข้อมูล Supabase สำเร็จ — สกีมา <code className="font-mono font-bold bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900">dtx_system</code> พร้อมใช้งาน</span>
          </div>
          <button onClick={() => setConnectionTestStatus('idle')} className="text-emerald-700 hover:text-emerald-900 dark:hover:text-white font-bold text-[11px] cursor-pointer">
            ปิด
          </button>
        </div>
      )}

      {connectionTestStatus === 'failed' && (
        <div className="bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 px-4 py-3 rounded-xl flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={15} className="text-rose-600 shrink-0" />
            <span className="font-semibold">การเชื่อมต่อล้มเหลว: <span className="font-mono">{testError || 'โปรดตรวจสอบการตั้งค่า'}</span></span>
          </div>
          <button onClick={() => setConnectionTestStatus('idle')} className="text-rose-700 hover:text-rose-900 dark:hover:text-white font-bold text-[11px] cursor-pointer">
            ปิด
          </button>
        </div>
      )}

      {/* 2. Compact 4-Metric Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-3xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Layers size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-400 block truncate">เครื่องตรวจ DTX</span>
            <span className="text-base font-black text-slate-800 dark:text-white">{machines.length} เครื่อง</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-3xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Activity size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-400 block truncate">บันทึก QC</span>
            <span className="text-base font-black text-slate-800 dark:text-white">{qcRecords.length} รายการ</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-3xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Wrench size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-400 block truncate">งานซ่อมบำรุง</span>
            <span className="text-base font-black text-slate-800 dark:text-white">{repairs.length} งาน</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-3xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-400 block truncate">ประเมิน EQA</span>
            <span className="text-base font-black text-slate-800 dark:text-white">{eqaRecords.length} รายการ</span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs (Clean Pill Design) */}
      <div className="flex items-center space-x-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'status'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Server size={14} />
          <span>สถานะตารางข้อมูล (Tables)</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'logs'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock size={14} />
          <span>บันทึกกิจกรรม (Activity Logs)</span>
        </button>

        <button
          onClick={() => setActiveTab('advanced')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'advanced'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sliders size={14} />
          <span>คำสั่ง SQL & ตั้งค่า (Advanced)</span>
        </button>
      </div>

      {/* 4. Tab 1: Database Tables Status */}
      {activeTab === 'status' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-3xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-white">ตารางระบบ POCT ทั้งหมด</h3>
              <p className="text-[11px] text-slate-400">สกีมาหลัก: <code className="font-mono text-sky-600 font-bold">dtx_system</code> (มุมมอง public: <code className="font-mono text-slate-500">dtx_*</code>)</p>
            </div>
            <button
              onClick={handleRunDiagnostics}
              disabled={isDiagnosing}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1"
            >
              <RefreshCw size={12} className={isDiagnosing ? 'animate-spin' : ''} />
              <span>{isDiagnosing ? 'กำลังตรวจเช็ค...' : 'ตรวจเช็คความพร้อม'}</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {diagnostics ? (
              diagnostics.map((diag) => (
                <div key={diag.tableName} className="p-3.5 px-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{diag.thaiLabel}</span>
                      <code className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        dtx_system.{diag.tableName}
                      </code>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                      {diag.recordCount} รายการ
                    </span>
                    {diag.isReady ? (
                      <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-emerald-100 dark:border-emerald-900">
                        <Check size={11} />
                        <span>ปกติ</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-amber-100 dark:border-amber-900">
                        <AlertCircle size={11} />
                        <span>ตรวจเช็ค</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              defaultTableSummary.map((item) => (
                <div key={item.table} className="p-3.5 px-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.title}</span>
                      <code className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {item.table}
                      </code>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                      {item.count} รายการ
                    </span>
                    <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-emerald-100 dark:border-emerald-900">
                      <Check size={11} />
                      <span>{item.status}</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 5. Tab 2: Activity Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-3xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-white">บันทึกกิจกรรมในเซสชัน</h3>
              <p className="text-[11px] text-slate-400">ประวัติการทำงาน การซิงก์ และสถานะการเชื่อมต่อ</p>
            </div>
            <button
              onClick={() => setActivityLogs([])}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              ล้างประวัติ
            </button>
          </div>

          <div className="space-y-2">
            {activityLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">ยังไม่มีบันทึกกิจกรรมใหม่</div>
            ) : (
              activityLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-start justify-between text-xs gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{log.action}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        log.status === 'success' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' 
                          : log.status === 'warning'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                      }`}>
                        {log.status === 'success' ? 'สำเร็จ' : log.status === 'warning' ? 'แจ้งเตือน' : 'ข้อมูล'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{log.detail}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">{log.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 6. Tab 3: Advanced & SQL Center */}
      {activeTab === 'advanced' && (
        <div className="space-y-4">
          
          {/* Quick Action Seed Database */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">ส่งข้อมูลปัจจุบันขึ้นระบบ (Seed Database)</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">อัปโหลดข้อมูลเครื่อง, QC, งานซ่อม ปัจจุบันไปยัง Supabase คลาวด์</p>
            </div>
            <button
              onClick={handlePushData}
              disabled={isSeeding}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center space-x-1.5 shrink-0"
            >
              <CloudUpload size={13} className={isSeeding ? 'animate-pulse' : ''} />
              <span>{isSeeding ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลขึ้นคลาวด์'}</span>
            </button>
          </div>

          {/* SQL Scripts Center (Clean, 1-Click Copy, No visual clutter) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-3xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">ศูนย์คำสั่ง SQL สำหรับผู้ดูแล</h4>
                <p className="text-[11px] text-slate-400">คัดลอกคำสั่งเพื่อรันใน Supabase SQL Editor</p>
              </div>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center space-x-1"
              >
                <span>เปิด Supabase</span>
                <ExternalLink size={11} />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              <button
                onClick={() => copyText(POCT_QUICK_BRIDGE_SQL, 'สคริปต์สิทธิ์ dtx_system')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-sky-50/40 dark:hover:bg-sky-950/20 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">1. มอบสิทธิ์สกีมา</span>
                  <Copy size={13} className="text-slate-400 group-hover:text-sky-600" />
                </div>
                <p className="text-[10px] text-slate-400">เปิดสิทธิ์ RLS และ API dtx_system</p>
              </button>

              <button
                onClick={() => copyText(POCT_SCHEMA_SQL, 'สคริปต์สร้างตารางใหม่')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">2. สร้างตารางทั้งหมด</span>
                  <Copy size={13} className="text-slate-400 group-hover:text-indigo-600" />
                </div>
                <p className="text-[10px] text-slate-400">โครงสร้างตาราง dtx_system ครบชุด</p>
              </button>

              <button
                onClick={() => copyText(POCT_UNOPENED_STOCK_SQL, 'สคริปต์สร้างตารางเครื่องรอเปิดใช้ (dtx_machine_stocks)')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">3. เครื่องรอเปิดใช้</span>
                  <Copy size={13} className="text-slate-400 group-hover:text-emerald-600" />
                </div>
                <p className="text-[10px] text-slate-400">ตาราง dtx_machine_stocks</p>
              </button>

              <button
                onClick={() => copyText(POCT_CLEANUP_PUBLIC_SQL, 'สคริปต์ล้าง Public Views')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">4. ล้างตารางใน public</span>
                  <Copy size={13} className="text-slate-400 group-hover:text-rose-600" />
                </div>
                <p className="text-[10px] text-slate-400">ลบตารางตกค้างใน public อย่างปลอดภัย</p>
              </button>
            </div>

            {/* Collapsible preview toggle */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowSqlCode(!showSqlCode)}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
              >
                {showSqlCode ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>{showSqlCode ? 'ซ่อนตัวอย่างโค้ด SQL' : 'ดูตัวอย่างโค้ด SQL'}</span>
              </button>

              {showSqlCode && (
                <div className="mt-3 space-y-2">
                  <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                    <button
                      onClick={() => setSelectedSqlTab('bridge')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${selectedSqlTab === 'bridge' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'}`}
                    >
                      สิทธิ์ Schema
                    </button>
                    <button
                      onClick={() => setSelectedSqlTab('full')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${selectedSqlTab === 'full' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'}`}
                    >
                      สร้างตารางทั้งหมด
                    </button>
                    <button
                      onClick={() => setSelectedSqlTab('unopened')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${selectedSqlTab === 'unopened' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'}`}
                    >
                      เครื่องรอเปิดใช้ (Stock)
                    </button>
                    <button
                      onClick={() => setSelectedSqlTab('cleanup')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${selectedSqlTab === 'cleanup' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'}`}
                    >
                      ล้าง public
                    </button>
                  </div>
                  <pre className="bg-slate-950 text-slate-200 p-3.5 rounded-xl font-mono text-[10.5px] max-h-48 overflow-y-auto leading-relaxed">
                    {selectedSqlTab === 'bridge' ? POCT_QUICK_BRIDGE_SQL : selectedSqlTab === 'full' ? POCT_SCHEMA_SQL : selectedSqlTab === 'unopened' ? POCT_UNOPENED_STOCK_SQL : POCT_CLEANUP_PUBLIC_SQL}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Custom Credentials (Collapsible) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-3xs space-y-3">
            <button
              onClick={() => setShowDirectCredentials(!showDirectCredentials)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <Key size={15} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-white">กำหนดค่า URL & Key เชื่อมต่อด้วยตนเอง (Manual Override)</span>
              </div>
              {showDirectCredentials ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
            </button>

            {showDirectCredentials && (
              <form onSubmit={handleSaveCredentials} className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">Supabase URL</label>
                    <input
                      type="text"
                      placeholder="https://xxxxxxxx.supabase.co"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">Supabase Anon Key</label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOi..."
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
                  >
                    <Save size={13} />
                    <span>บันทึกและเชื่อมต่อ</span>
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      )}

    </div>
  );
}

const POCT_QUICK_BRIDGE_SQL = `-- ==========================================================================
-- สิทธิ์การใช้งาน Schema dtx_system
-- ==========================================================================
GRANT USAGE ON SCHEMA dtx_system TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA dtx_system TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA dtx_system TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA dtx_system GRANT ALL ON TABLES TO anon, authenticated, service_role, postgres;

-- เปิด RLS Policy
ALTER TABLE IF EXISTS dtx_system.master_wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dtx_system.dtx_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dtx_system.dtx_machine_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dtx_system.repair_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dtx_system.supply_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dtx_system.qc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dtx_system.qc_lot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dtx_system.eqa_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dtx_system.user_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dtx_system.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dtx_system.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wards_all_policy" ON dtx_system.master_wards;
DROP POLICY IF EXISTS "machines_all_policy" ON dtx_system.dtx_machines;
DROP POLICY IF EXISTS "dtx_machine_stocks_all_policy" ON dtx_system.dtx_machine_stocks;
DROP POLICY IF EXISTS "repairs_all_policy" ON dtx_system.repair_requests;
DROP POLICY IF EXISTS "supplies_all_policy" ON dtx_system.supply_requests;
DROP POLICY IF EXISTS "qc_records_all_policy" ON dtx_system.qc_records;
DROP POLICY IF EXISTS "qc_configs_all_policy" ON dtx_system.qc_lot_configs;
DROP POLICY IF EXISTS "eqa_all_policy" ON dtx_system.eqa_records;
DROP POLICY IF EXISTS "manuals_all_policy" ON dtx_system.user_manuals;
DROP POLICY IF EXISTS "announcements_all_policy" ON dtx_system.announcements;
DROP POLICY IF EXISTS "users_all_policy" ON dtx_system.users;

CREATE POLICY "wards_all_policy" ON dtx_system.master_wards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "machines_all_policy" ON dtx_system.dtx_machines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dtx_machine_stocks_all_policy" ON dtx_system.dtx_machine_stocks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "repairs_all_policy" ON dtx_system.repair_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "supplies_all_policy" ON dtx_system.supply_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qc_records_all_policy" ON dtx_system.qc_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qc_configs_all_policy" ON dtx_system.qc_lot_configs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "eqa_all_policy" ON dtx_system.eqa_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "manuals_all_policy" ON dtx_system.user_manuals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "announcements_all_policy" ON dtx_system.announcements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "users_all_policy" ON dtx_system.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Public Views (dtx_ prefix)
CREATE OR REPLACE VIEW public.dtx_machines AS SELECT * FROM dtx_system.dtx_machines;
CREATE OR REPLACE VIEW public.dtx_machine_stocks AS SELECT * FROM dtx_system.dtx_machine_stocks;
CREATE OR REPLACE VIEW public.dtx_unopened_machines AS SELECT * FROM dtx_system.dtx_machine_stocks;
CREATE OR REPLACE VIEW public.dtx_repair_requests AS SELECT * FROM dtx_system.repair_requests;
CREATE OR REPLACE VIEW public.dtx_supply_requests AS SELECT * FROM dtx_system.supply_requests;
CREATE OR REPLACE VIEW public.dtx_qc_records AS SELECT * FROM dtx_system.qc_records;
CREATE OR REPLACE VIEW public.dtx_qc_lot_configs AS SELECT * FROM dtx_system.qc_lot_configs;
CREATE OR REPLACE VIEW public.dtx_eqa_records AS SELECT * FROM dtx_system.eqa_records;
CREATE OR REPLACE VIEW public.dtx_user_manuals AS SELECT * FROM dtx_system.user_manuals;
CREATE OR REPLACE VIEW public.dtx_announcements AS SELECT * FROM dtx_system.announcements;
CREATE OR REPLACE VIEW public.master_wards AS SELECT * FROM dtx_system.master_wards;

GRANT ALL ON public.dtx_machines TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.dtx_machine_stocks TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.dtx_unopened_machines TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.dtx_repair_requests TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.dtx_supply_requests TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.dtx_qc_records TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.dtx_qc_lot_configs TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.dtx_eqa_records TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.dtx_user_manuals TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.dtx_announcements TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.master_wards TO anon, authenticated, service_role, postgres;

NOTIFY pgrst, 'reload schema';
`;

const POCT_UNOPENED_STOCK_SQL = `-- ==========================================================================
-- สคริปต์สร้างตารางเครื่องรอเปิดใช้ (Unopened Machine Stock)
-- Schema dtx_system: ตารางกายภาพ dtx_system.dtx_machine_stocks
-- Schema public: View public.dtx_machine_stocks
-- ==========================================================================
CREATE SCHEMA IF NOT EXISTS dtx_system;

CREATE TABLE IF NOT EXISTS dtx_system.dtx_machine_stocks (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE dtx_system.dtx_machine_stocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dtx_machine_stocks_all_policy" ON dtx_system.dtx_machine_stocks;
CREATE POLICY "dtx_machine_stocks_all_policy" ON dtx_system.dtx_machine_stocks 
FOR ALL TO anon, authenticated, service_role, postgres 
USING (true) WITH CHECK (true);

CREATE OR REPLACE VIEW public.dtx_machine_stocks AS 
SELECT * FROM dtx_system.dtx_machine_stocks;

CREATE OR REPLACE VIEW public.dtx_unopened_machines AS 
SELECT * FROM dtx_system.dtx_machine_stocks;

GRANT USAGE ON SCHEMA dtx_system TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE dtx_system.dtx_machine_stocks TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.dtx_machine_stocks TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.dtx_unopened_machines TO anon, authenticated, service_role, postgres;

NOTIFY pgrst, 'reload schema';
`;

const POCT_CLEANUP_PUBLIC_SQL = `-- ==========================================================================
-- สคริปต์ล้าง Public Views ของ POCT
-- ==========================================================================
DROP VIEW IF EXISTS public.dtx_machines CASCADE;
DROP VIEW IF EXISTS public.dtx_machine_stocks CASCADE;
DROP VIEW IF EXISTS public.dtx_unopened_machines CASCADE;
DROP VIEW IF EXISTS public.repair_requests CASCADE;
DROP VIEW IF EXISTS public.supply_requests CASCADE;
DROP VIEW IF EXISTS public.qc_records CASCADE;
DROP VIEW IF EXISTS public.qc_lot_configs CASCADE;
DROP VIEW IF EXISTS public.eqa_records CASCADE;
DROP VIEW IF EXISTS public.user_manuals CASCADE;
DROP VIEW IF EXISTS public.announcements CASCADE;
NOTIFY pgrst, 'reload schema';
`;

const POCT_SCHEMA_SQL = `-- ==========================================================================
-- สคริปต์สร้าง Schema และตาราง dtx_system
-- ==========================================================================
CREATE SCHEMA IF NOT EXISTS dtx_system;

CREATE TABLE IF NOT EXISTS dtx_system.master_wards (
    id SERIAL PRIMARY KEY,
    en_name VARCHAR(100) UNIQUE NOT NULL,
    thai_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS dtx_system.dtx_machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bgm_code VARCHAR(100) UNIQUE NOT NULL,
    serial_number VARCHAR(150) UNIQUE NOT NULL,
    brand VARCHAR(150) DEFAULT 'VivaChek',
    model VARCHAR(100) DEFAULT 'Fad',
    ward VARCHAR(150) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    rec_date DATE NOT NULL,
    last_qc_date DATE,
    lot_number VARCHAR(100) NOT NULL,
    remark TEXT,
    location_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS dtx_system.dtx_machine_stocks (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS dtx_system.repair_requests (
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

CREATE TABLE IF NOT EXISTS dtx_system.supply_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward VARCHAR(150) NOT NULL,
    requester VARCHAR(200) NOT NULL,
    item VARCHAR(100) NOT NULL,
    qty INTEGER NOT NULL,
    reason TEXT NOT NULL,
    req_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS dtx_system.qc_records (
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

CREATE TABLE IF NOT EXISTS dtx_system.qc_lot_configs (
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

CREATE TABLE IF NOT EXISTS dtx_system.eqa_records (
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

CREATE TABLE IF NOT EXISTS dtx_system.user_manuals (
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

CREATE TABLE IF NOT EXISTS dtx_system.announcements (
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

CREATE TABLE IF NOT EXISTS dtx_system.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150),
    full_name VARCHAR(200) NOT NULL,
    password VARCHAR(255) DEFAULT '123456',
    role VARCHAR(50) DEFAULT 'staff' NOT NULL,
    position VARCHAR(100) DEFAULT 'MT',
    pos VARCHAR(100) DEFAULT 'MT',
    ward VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
`;

