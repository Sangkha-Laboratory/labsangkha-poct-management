import React, { useState, useEffect } from 'react';
import { isSupabaseConfigured, getSupabaseConfigInfo, dbService, getSupabaseUrl, getSupabaseAnonKey, saveSupabaseCredentials } from '../lib/supabase';
import { DtxMachine, RepairRequest, SupplyRequest, QcRecord, QcLotConfig, EqaRecord, UserManual, Announcement } from '../types';
import { Database, ShieldCheck, RefreshCw, CloudUpload, CheckCircle, AlertTriangle, HelpCircle, Code, Server, Lock, Key, Save } from 'lucide-react';

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

  const [supabaseUrlInput, setSupabaseUrlInput] = useState(getSupabaseUrl());
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(getSupabaseAnonKey());
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(supabaseUrlInput, supabaseKeyInput);
    setSaveSuccess(true);
    onShowToast('บันทึกการตั้งค่าการเชื่อมต่อ Supabase เรียบร้อยแล้ว!');
    fetchServerConfig();
    setTimeout(() => setSaveSuccess(false), 3000);
    handleTestConnection();
  };

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

  // Test the database connection by querying 1 record from dtx_machines
  const handleTestConnection = async () => {
    setConnectionTestStatus('testing');
    setTestError('');

    try {
      // Fetch a simple query to verify communication with poct_system schema
      await dbService.getMachines();
      setConnectionTestStatus('success');
      onShowToast('เชื่อมต่อฐานข้อมูล Supabase สำเร็จ!');
    } catch (err: any) {
      console.error(err);
      setConnectionTestStatus('failed');
      setTestError(err.message || 'การเชื่อมต่อถูกปฏิเสธ (กรุณาตรวจเช็ค SQL Schema และสิทธิ์ RLS/ตาราง)');
    }
  };

  // Pull all tables from Supabase to overwrite local memory/state
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

      onShowToast('ซิงก์ดึงข้อมูลจาก Supabase เข้าสู่ระบบในเบราว์เซอร์ของคุณสำเร็จแล้ว!');
    } catch (err: any) {
      console.error(err);
      onShowToast(`เกิดข้อผิดพลาดในการดึงข้อมูล: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Push current memory state to Supabase as Seed data
  const handlePushData = async () => {
    if (!window.confirm('คุณต้องการอัปโหลดข้อมูลเริ่มต้นปัจจุบันทั้งหมด (Seed Data) ขึ้นไปยัง Supabase หรือไม่?\n\n*ข้อแนะนำ: ควรล้างตารางเพื่อหลีกเลี่ยง ID ซ้ำซ้อนก่อนทำรายการ*')) return;
    
    setIsSeeding(true);
    try {
      onShowToast('เริ่มการอัปโหลดข้อมูลจำลองจำแนกตามโครงสร้าง...');

      // 1. Upload Lot Configs first (for reference)
      for (const lot of lotConfigs) {
        await dbService.insertLotConfig(lot).catch(err => {
          if (err.message?.includes('duplicate key')) return; // Ignore duplicate LOT
          throw err;
        });
      }

      // 2. Upload Machines
      for (const machine of machines) {
        await dbService.insertMachine(machine).catch(err => {
          if (err.message?.includes('duplicate key')) return; // Ignore duplicate
          throw err;
        });
      }

      // 3. Upload Supplies
      for (const supply of supplies) {
        await dbService.insertSupply(supply).catch(err => {
          if (err.message?.includes('duplicate key')) return;
          throw err;
        });
      }

      // 4. Upload QC Records
      for (const qc of qcRecords) {
        await dbService.insertQcRecord(qc).catch(err => {
          if (err.message?.includes('duplicate key')) return;
          throw err;
        });
      }

      // 5. Upload Repairs
      for (const repair of repairs) {
        await dbService.insertRepair(repair).catch(err => {
          if (err.message?.includes('duplicate key')) return;
          throw err;
        });
      }

      // 6. Upload EQA
      for (const eqa of eqaRecords) {
        await dbService.insertEqaRecord(eqa).catch(err => {
          if (err.message?.includes('duplicate key')) return;
          throw err;
        });
      }

      // 7. Upload Manuals
      if (manuals && manuals.length > 0) {
        for (const manual of manuals) {
          await dbService.insertManual(manual).catch(err => {
            if (err.message?.includes('duplicate key')) return;
            throw err;
          });
        }
      }

      // 8. Upload Announcements
      if (announcements && announcements.length > 0) {
        for (const ann of announcements) {
          await dbService.insertAnnouncement(ann).catch(err => {
            if (err.message?.includes('duplicate key')) return;
            throw err;
          });
        }
      }

      onShowToast('อัปโหลดข้อมูลจำลองขึ้นระบบคลาวด์สำเร็จเรียบร้อยแล้ว!');
    } catch (err: any) {
      console.error(err);
      onShowToast(`อัปโหลดผิดพลาด: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCopySql = () => {
    try {
      navigator.clipboard.writeText(POCT_SCHEMA_SQL);
      onShowToast('คัดลอกสคริปต์ SQL สำหรับสกีมา poct_system สำเร็จแล้ว! นำไปวางรันใน SQL Editor ได้เลย');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      onShowToast('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคัดลอกสคริปต์จากไฟล์ /supabase_schema.sql');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="supabase-config-tab">
      {/* 1. Header & Status Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-3xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
              <ShieldCheck size={18} />
            </div>
            <h3 className="text-sm font-black text-slate-800">ฐานข้อมูลผ่านตัวแทนความปลอดภัยหลังบ้าน (Secure Backend API Proxy)</h3>
          </div>
          <p className="text-[11px] text-slate-500 max-w-xl leading-relaxed font-medium">
            เราเปลี่ยนการเชื่อมต่อจาก Client-Side SDK ไปเป็นระบบ Secure API Proxy แบบฟูลสแต็ก คีย์และ URL เชื่อมต่อของ Supabase จะถูกเก็บซ่อนไว้บนระบบหลังบ้าน (Node.js/Express) อย่างปลอดภัย 100% และไม่มีวันรั่วไหลไปยังเบราว์เซอร์ของผู้ใช้
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isLoadingConfig ? (
            <div className="inline-flex items-center space-x-2 bg-slate-50 text-slate-400 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold shadow-3xs animate-pulse">
              <RefreshCw size={13} className="animate-spin" />
              <span>กำลังเช็คสถานะเซิร์ฟเวอร์...</span>
            </div>
          ) : serverConfig.configured ? (
            <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-100 px-4 py-2 rounded-xl text-xs font-bold shadow-3xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>เซิร์ฟเวอร์ Proxy เชื่อมต่อสำเร็จ</span>
            </div>
          ) : (
            <div className="inline-flex items-center space-x-2 bg-amber-50 text-amber-800 border border-amber-150 px-4 py-2 rounded-xl text-xs font-bold shadow-3xs">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>รันแบบ Local Offline (หรือใช้ Direct Client)</span>
            </div>
          )}

          <button
            onClick={handleTestConnection}
            disabled={connectionTestStatus === 'testing'}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-3xs cursor-pointer flex items-center space-x-1"
          >
            <RefreshCw size={13} className={connectionTestStatus === 'testing' ? 'animate-spin' : ''} />
            <span>{connectionTestStatus === 'testing' ? 'กำลังตรวจเช็ค...' : 'ทดสอบ Connection'}</span>
          </button>
        </div>
      </div>

      {/* Direct Credentials Setting (Browser/Local Override) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-3xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-700">
              <Key size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">ตั้งค่าการเชื่อมต่อ Supabase บนหน้าเว็บ (Direct Client Credentials)</h3>
              <p className="text-[11px] text-slate-500">ป้อน Supabase URL และ Anon Key ได้ที่นี่โดยตรงเพื่อทดสอบหรือเปิดใช้งานทันทีในเบราว์เซอร์</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveCredentials} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Supabase Project URL (VITE_SUPABASE_URL)</label>
              <input
                type="text"
                placeholder="https://xxxxxxxxxxxx.supabase.co"
                value={supabaseUrlInput}
                onChange={(e) => setSupabaseUrlInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all bg-slate-50/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Supabase Anon Key (VITE_SUPABASE_ANON_KEY)</label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseKeyInput}
                onChange={(e) => setSupabaseKeyInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all bg-slate-50/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-slate-500">
              {saveSuccess && <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle size={13} /> บันทึกลงเบราว์เซอร์เรียบร้อยแล้ว</span>}
            </div>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-3xs cursor-pointer flex items-center space-x-1.5"
            >
              <Save size={14} />
              <span>บันทึกและทดสอบการเชื่อมต่อ</span>
            </button>
          </div>
        </form>
      </div>

      {/* Connection Test Diagnostics */}
      {connectionTestStatus === 'success' && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start space-x-2.5 shadow-3xs animate-scale-up">
          <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
          <div className="text-xs space-y-1 font-medium">
            <p className="font-extrabold">ทดสอบเชื่อมต่อสำเร็จ!</p>
            <p className="text-emerald-700">ระบบหลังบ้าน Express Server สามารถแลกเปลี่ยนข้อมูลและสื่อสารกับสกีมา <code className="bg-white px-1 py-0.5 rounded border border-emerald-100 font-mono font-bold">poct_system</code> บนฐานข้อมูล Supabase ได้อย่างสมบูรณ์แบบ ทั้งในส่วนโครงสร้าง RLS และสิทธิ์การใช้งานแบบสาธารณะ</p>
          </div>
        </div>
      )}

      {connectionTestStatus === 'failed' && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-5 rounded-2xl flex flex-col md:flex-row items-start gap-4 shadow-3xs animate-scale-up">
          <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
          <div className="text-xs space-y-3 font-medium flex-1 w-full">
            <div>
              <p className="font-black text-rose-950 text-sm">การเชื่อมต่อสกีมา poct_system ล้มเหลว (Database Schema Connection Issue)</p>
              <p className="text-rose-700 mt-1 leading-relaxed">ข้อผิดพลาดจาก Supabase: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-100 font-bold inline-block mt-0.5 break-all">{testError}</span></p>
            </div>

            <div className="bg-white/90 border border-rose-100 rounded-xl p-4 text-slate-700 space-y-3">
              <p className="font-bold text-slate-900 text-[11px] border-b pb-1.5 flex items-center gap-1">
                <Server size={13} className="text-rose-600" />
                <span>ขั้นตอนการเปิดใช้งานสกีมา poct_system บน Supabase (ห้ามยุ่งกับ public):</span>
              </p>
              
              <div className="space-y-3.5 text-[11px] leading-relaxed">
                <div>
                  <p className="font-extrabold text-slate-950 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-black">1</span>
                    <span>เปิดสิทธิ์สกีมา poct_system ให้แอปเข้าถึง (Exposed schemas):</span>
                  </p>
                  <p className="text-slate-500 pl-5.5 mt-0.5">
                    ไปที่หน้า <strong>Supabase Dashboard</strong> {"→"} <strong>Project Settings</strong> (ไอคอนฟันเฟืองด้านล่าง) {"→"} <strong>API</strong> {"→"} ตรงหัวข้อ <strong>Exposed schemas</strong> ให้พิมพ์เพิ่มคำว่า <code className="font-mono font-bold bg-slate-100 px-1 py-0.5 rounded text-rose-600">poct_system</code> เข้าไปต่อท้าย public (เช่น <code className="font-mono font-bold text-slate-600">public, poct_system</code>) แล้วกด <strong>Save</strong> ด้านบนขวา
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100/80">
                  <p className="font-extrabold text-slate-950 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-black">2</span>
                    <span>รันสคริปต์ SQL เพื่อสร้างสกีมาและตาราง poct_system ทั้งหมด:</span>
                  </p>
                  <p className="text-slate-500 pl-5.5 mt-0.5">
                    คัดลอกคำสั่ง SQL ดั้งเดิมสำหรับสกีมา <code className="font-mono font-bold text-slate-700">poct_system</code> โดยใช้ปุ่มสีส้มด้านล่างนี้ จากนั้นนำไปวางและกดรันในเมนู <strong>SQL Editor</strong> บนหน้าต่าง Supabase Dashboard เพื่อติดตั้งฐานข้อมูล ระบบ RLS และสิทธิ์การเข้าถึงทั้งหมด
                  </p>
                  
                  <div className="flex flex-wrap gap-2 pt-2 pl-5.5">
                    <button
                      onClick={handleCopySql}
                      className="inline-flex items-center space-x-1 bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10.5px] transition-all shadow-3xs cursor-pointer"
                    >
                      <Code size={12} />
                      <span>คัดลอกคำสั่ง SQL สำหรับสกีมา poct_system</span>
                    </button>
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 font-extrabold px-3 py-1.5 rounded-lg text-[10.5px] transition-all cursor-pointer"
                    >
                      <Database size={12} />
                      <span>เปิด Supabase Dashboard ↗</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Config Form & Cloud Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Security Information */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-3xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center space-x-2">
            <Lock size={15} className="text-emerald-600" />
            <div>
              <h4 className="text-xs font-bold text-slate-800">1. การรักษาความปลอดภัยสูงสุด (Zero-Exposure)</h4>
              <p className="text-[10px] text-slate-400 font-medium">ไม่มีการเก็บคีย์เชื่อมต่อฐานข้อมูลไว้บนบราวเซอร์หรือฝั่ง Frontend</p>
            </div>
          </div>

          <div className="space-y-4 text-xs leading-relaxed text-slate-600">
            <p>
              ตามนโยบายความมั่นคงปลอดภัยสารสนเทศของโรงพยาบาล <strong>แอปพลิเคชันนี้ไม่อนุญาตให้วางข้อมูลเชื่อมต่อ API หรือกุญแจส่วนตัวในตัวแปรสาธารณะฝั่งหน้าบ้าน</strong>
            </p>
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
              <h5 className="font-bold text-slate-800 flex items-center space-x-1.5">
                <Server size={13} className="text-slate-600" />
                <span>สถาปัตยกรรมระบบหลังบ้าน (Backend Proxy Client)</span>
              </h5>
              <p className="text-[10.5px] text-slate-500">
                เมื่อหน้าบ้านต้องการบันทึก ค้นหา หรือลบข้อมูล จะส่งคำขอผ่าน URL <code className="bg-white border px-1 rounded font-mono font-bold text-slate-600">/api/*</code> ภายในเครือข่ายเดียวกับที่ใช้บริการแอปพลิเคชัน ตัวแปรระบบทั้งหมดจะถูกป้องกันจากบุคคลภายนอกอย่างสมบูรณ์แบบ
              </p>
            </div>

            <div className="bg-emerald-50/50 text-emerald-800 rounded-xl p-4 border border-emerald-100 space-y-2">
              <h5 className="font-bold text-emerald-900 flex items-center space-x-1.5">
                <Lock size={13} className="text-emerald-700" />
                <span>การเชื่อมต่อฝั่งเซิร์ฟเวอร์ (Server Variables)</span>
              </h5>
              <div className="text-[10.5px] text-emerald-700 space-y-1">
                <p>ในการพัฒนาแบบโลคอลหรือดีพลอยขึ้นระบบคลาวด์ ให้คัดลอกตัวแปรนี้ไปใช้ในไฟล์สภาพแวดล้อม:</p>
                <pre className="bg-slate-900 text-slate-100 font-mono text-[10px] p-2.5 rounded-lg border border-slate-800 leading-normal block overflow-x-auto whitespace-pre">
{`# .env config
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Database Operations and Seeds */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-3xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h4 className="text-xs font-bold text-slate-800">2. การจัดการข้อมูลและการซิงก์ (Database Operations)</h4>
            <p className="text-[10px] text-slate-400 font-medium">จัดการดึงข้อมูลหรืออัปโหลดโครงสร้างเพื่อเริ่มต้นระบบงาน</p>
          </div>

          <div className="space-y-4">
            {/* Sync Pull */}
            <div className="border border-slate-100 rounded-xl p-4 space-y-3.5 hover:border-slate-200 transition-colors">
              <div>
                <h5 className="text-[11px] font-bold text-slate-800">ดึงข้อมูลทั้งหมดจากระบบคลาวด์ (Pull Sync)</h5>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-1">
                  ดาวน์โหลดข้อมูลล่าสุดจำแนกตามตารางต่าง ๆ ทั้งหมดจาก Supabase ผ่าน secure API proxy มารับช่วงบันทึกและจัดเก็บไว้ในแอปพลิเคชันเบราว์เซอร์ของคุณ
                </p>
              </div>
              <button
                onClick={handlePullData}
                disabled={isSyncing}
                className="w-full bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 text-slate-700 font-extrabold py-2.5 rounded-xl text-xs border border-slate-200/80 transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'กำลังซิงก์ดาวน์โหลดข้อมูล...' : 'เริ่มกระบวนการ Sync Pull'}</span>
              </button>
            </div>

            {/* Sync Push / Seed */}
            <div className="border border-slate-100 rounded-xl p-4 space-y-3.5 hover:border-slate-200 transition-colors">
              <div>
                <h5 className="text-[11px] font-bold text-slate-800">อัปโหลดข้อมูลจำลองเริ่มต้นขึ้นระบบคลาวด์ (Seed Database)</h5>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-1">
                  สำหรับกรณีที่คุณสร้างตารางว่างขึ้นมาใหม่บน Supabase และต้องการข้อมูลตัวอย่างเพื่อความรวดเร็วในการทดลอง สามารถกดฟังก์ชันนี้เพื่ออัปโหลดข้อมูลเริ่มต้นปัจจุบันขึ้นไปยังตารางต่าง ๆ ได้ทันที
                </p>
              </div>
              <button
                onClick={handlePushData}
                disabled={isSeeding}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-300 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-2xs"
              >
                <CloudUpload size={13} className={isSeeding ? 'animate-pulse' : ''} />
                <span>{isSeeding ? 'กำลังทยอยอัปโหลดข้อมูล...' : 'ส่งข้อมูลจำลองเริ่มต้นขึ้นระบบ (Seed Push)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

const POCT_SCHEMA_SQL = `-- ==========================================================================
-- SQL Schema for Supabase (Sangkha Hospital DTX Management System)
-- Schema Namespace: poct_system
-- Description: ระบบบริหารจัดการเครื่องตรวจวัดน้ำตาลปลายนิ้ว (DTX) โรงพยาบาลสังขะ
-- ==========================================================================

-- ล้างระบบเก่าทั้งหมดเพื่อป้องกันข้อผิดพลาดจากตารางหรือความสัมพันธ์เดิม (แนะนำสำหรับสร้างระบบใหม่)
DROP SCHEMA IF EXISTS poct_system CASCADE;

-- 1. Create Schema
CREATE SCHEMA poct_system;

-- 2. Create Tables with Short and Clean Column Names

-- Table: dtx_machines (คลังเครื่อง DTX)
CREATE TABLE poct_system.dtx_machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bgm_code VARCHAR(100) UNIQUE NOT NULL,      -- รหัสเครื่องใน รพ. (เช่น BGM-000)
    serial_number VARCHAR(150) UNIQUE NOT NULL, -- S/N จริงจากผู้ผลิต (เช่น 103A2002FB7)
    brand VARCHAR(150) DEFAULT 'VivaChek Fad Blood Glucose Meter', -- ยี่ห้อ
    ward VARCHAR(150) NOT NULL,                -- หอผู้ป่วยที่ดูแลเครื่อง
    status VARCHAR(50) DEFAULT 'active' NOT NULL, -- สถานะ: active, lost, claim, repair, inactive
    rec_date DATE NOT NULL,                     -- วันที่รับเครื่องเข้าคลัง
    last_qc_date DATE,                          -- วันที่ทำ QC ล่าสุด
    lot_number VARCHAR(100) NOT NULL,          -- LOT ของเครื่อง
    remark TEXT,                                -- หมายเหตุ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: repair_requests (งานแจ้งซ่อมและวินิจฉัย)
CREATE TABLE poct_system.repair_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bgm_code VARCHAR(100) NOT NULL,            -- รหัสเครื่อง (BGM-xxx)
    serial_number VARCHAR(150),                 -- S/N จากผู้ผลิต
    ward VARCHAR(150) NOT NULL,                -- หอผู้ป่วยที่ส่งซ่อม
    reporter VARCHAR(200) NOT NULL,            -- ผู้ส่งซ่อม
    phone VARCHAR(50) NOT NULL,                -- เบอร์ติดต่อ
    problem TEXT NOT NULL,                      -- อาการเสียตามแจ้ง
    req_date DATE DEFAULT CURRENT_DATE NOT NULL, -- วันที่ส่งซ่อม
    status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- สถานะ: pending, repairing, wait_claim, claimed, completed
    diagnosis TEXT,                             -- ผลการวินิจฉัยจริง
    action VARCHAR(100),                        -- การดำเนินการ: change_battery, return_original, provide_new, etc.
    operator VARCHAR(200),                      -- ผู้ดำเนินการซ่อม
    receiver VARCHAR(200),                      -- ผู้รับเครื่องกลับ
    complete_date DATE,                         -- วันที่ซ่อมเสร็จ
    need_backup BOOLEAN DEFAULT FALSE NOT NULL, -- ต้องการเครื่องสำรองใช้ชั่วคราวหรือไม่
    checklist JSONB DEFAULT '{}'::jsonb NOT NULL, -- เช็คลิสต์ตรวจสอบเครื่อง (ปุ่มกด, หน้าจอ, ความสะอาด ฯลฯ)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: supply_requests (คำขอเบิกอุปกรณ์และวัสดุ)
CREATE TABLE poct_system.supply_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward VARCHAR(150) NOT NULL,                -- หอผู้ป่วยที่ขอเบิก
    requester VARCHAR(200) NOT NULL,           -- ผู้ส่งคำขอเบิก
    item VARCHAR(100) NOT NULL,                 -- ชนิดของ: machine, strip, lancet, control, battery
    qty INTEGER NOT NULL,                       -- จำนวนที่ขอเบิก
    reason TEXT NOT NULL,                       -- เหตุผลความจำเป็น
    req_date DATE DEFAULT CURRENT_DATE NOT NULL, -- วันที่ขอเบิก
    status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- สถานะ: pending, approved, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: qc_records (บันทึกผลการควบคุมคุณภาพ QC 3 Level)
CREATE TABLE poct_system.qc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE DEFAULT CURRENT_DATE NOT NULL,    -- วันที่ทำ QC
    rec_date DATE NOT NULL,                     -- วันที่รับเครื่องมาทำ QC
    ret_date DATE NOT NULL,                     -- วันที่ส่งเครื่องคืน
    ward VARCHAR(150) NOT NULL,                -- หอผู้ป่วย
    bgm_code VARCHAR(100) NOT NULL,            -- รหัสเครื่อง
    serial_number VARCHAR(150),                 -- S/N จริงจากผู้ผลิต
    operator VARCHAR(200) NOT NULL,            -- ผู้ตรวจวิเคราะห์
    lot_number VARCHAR(100) NOT NULL,          -- LOT ของแถบควบคุม
    level1 NUMERIC NOT NULL,                    -- ผลทดสอบ Level 1
    level2 NUMERIC NOT NULL,                    -- ผลทดสอบ Level 2
    level3 NUMERIC NOT NULL,                    -- ผลทดสอบ Level 3
    l1_status VARCHAR(50) NOT NULL,             -- สถานะ Level 1 (normal / out)
    l2_status VARCHAR(50) NOT NULL,             -- สถานะ Level 2 (normal / out)
    l3_status VARCHAR(50) NOT NULL,             -- สถานะ Level 3 (normal / out)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: qc_lot_configs (การตั้งค่าเกณฑ์เป้าหมายของแต่ละ LOT)
CREATE TABLE poct_system.qc_lot_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_number VARCHAR(100) UNIQUE NOT NULL,    -- หมายเลข LOT
    l1_target NUMERIC NOT NULL,                 -- Target Level 1
    l1_min NUMERIC NOT NULL,                    -- Min Level 1
    l1_max NUMERIC NOT NULL,                    -- Max Level 1
    l1_sd NUMERIC NOT NULL,                     -- SD Level 1
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
CREATE TABLE poct_system.eqa_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round VARCHAR(100) NOT NULL,                -- รอบการประเมิน (เช่น 1/2026)
    test_date DATE NOT NULL,                    -- วันที่ทำการทดสอบ
    l1_val NUMERIC NOT NULL,                    -- ค่าตรวจได้ Level 1
    l1_tgt NUMERIC NOT NULL,                    -- ค่าเป้าหมาย Level 1
    l2_val NUMERIC NOT NULL,
    l2_tgt NUMERIC NOT NULL,
    l3_val NUMERIC NOT NULL,
    l3_tgt NUMERIC NOT NULL,
    score NUMERIC NOT NULL,                      -- คะแนนรวม (%)
    status VARCHAR(50) NOT NULL,                -- excel, pass, warn, fail
    feedback TEXT,                              -- ข้อแนะนำการตอบกลับ
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE poct_system.dtx_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.repair_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.supply_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.qc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.qc_lot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.eqa_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.user_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_system.announcements ENABLE ROW LEVEL SECURITY;

-- Policies (Public access)
CREATE POLICY "machines_read_policy" ON poct_system.dtx_machines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "machines_admin_policy" ON poct_system.dtx_machines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "repairs_insert_policy" ON poct_system.repair_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "repairs_read_policy" ON poct_system.repair_requests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "repairs_admin_policy" ON poct_system.repair_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "supplies_insert_policy" ON poct_system.supply_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "supplies_read_policy" ON poct_system.supply_requests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "supplies_admin_policy" ON poct_system.supply_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "qc_records_read_policy" ON poct_system.qc_records FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "qc_configs_read_policy" ON poct_system.qc_lot_configs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "qc_records_admin_policy" ON poct_system.qc_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qc_configs_admin_policy" ON poct_system.qc_lot_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "eqa_read_policy" ON poct_system.eqa_records FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "eqa_admin_policy" ON poct_system.eqa_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "manuals_read_policy" ON poct_system.user_manuals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "manuals_admin_policy" ON poct_system.user_manuals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "announcements_read_policy" ON poct_system.announcements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "announcements_admin_policy" ON poct_system.announcements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
`;
