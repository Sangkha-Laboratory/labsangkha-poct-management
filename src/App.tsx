/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import CustomSelect from "./components/CustomSelect";
import { dbService } from './lib/supabase';
import { 
  INITIAL_MACHINES, 
  INITIAL_REPAIRS, 
  INITIAL_SUPPLIES, 
  INITIAL_QC_RECORDS, 
  INITIAL_LOT_CONFIGS, 
  INITIAL_EQA_RECORDS,
  MANUALS_LIST,
  INITIAL_ANNOUNCEMENTS
} from './mockData';
import { DtxMachine, RepairRequest, SupplyRequest, QcRecord, QcLotConfig, EqaRecord, UserManual, Announcement } from './types';
import { Activity, ShieldCheck, User, ShieldAlert, Wrench, Package, BarChart2, Layers, Smartphone, Database, Lock, Unlock, Menu, X, ChevronDown, Home, LogIn, LogOut, Search, BookOpen, ArrowLeft, Microscope, Lightbulb, FileText, Megaphone, Sun, Moon } from 'lucide-react';

// Component Imports
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import StockManagement from './components/StockManagement';
import QCManagement from './components/QCManagement';
import RepairManagement from './components/RepairManagement';
import EQAManagement from './components/EQAManagement';
import QualityManagement from './components/QualityManagement';
import LineNotifyConfig from './components/LineNotifyConfig';
import SupabaseConfig from './components/SupabaseConfig';
import DocumentsAndAnnouncementsManager from './components/DocumentsAndAnnouncementsManager';

// Supabase Imports
import { isSupabaseConfigured, getSupabaseConfigInfo } from './lib/supabase';

export default function App() {

  // Global States loaded from Supabase
  const [machines, setMachines] = useState<DtxMachine[]>([]);
  const [repairs, setRepairs] = useState<RepairRequest[]>([]);
  const [supplies, setSupplies] = useState<SupplyRequest[]>([]);
  const [qcRecords, setQcRecords] = useState<QcRecord[]>([]);
  const [lotConfigs, setLotConfigs] = useState<QcLotConfig[]>([]);
  const [eqaRecords, setEqaRecords] = useState<EqaRecord[]>([]);
  const [lineNotifyToken, setLineNotifyToken] = useState<string>('');

  // Fetch initial data from Supabase / API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const config = await getSupabaseConfigInfo();
        if (!config.configured) {
          console.log('Database not configured. Setting empty states.');
          setMachines([]);
          setRepairs([]);
          setSupplies([]);
          setQcRecords([]);
          setLotConfigs([]);
          setEqaRecords([]);
          return;
        }

        console.log('Fetching data from API/Supabase...');
        const [
          remoteMachines,
          remoteRepairs,
          remoteSupplies,
          remoteQc,
          remoteLot,
          remoteEqa,
          remoteManuals,
          remoteAnnouncements
        ] = await Promise.all([
          dbService.getMachines().catch(() => []),
          dbService.getRepairs().catch(() => []),
          dbService.getSupplies().catch(() => []),
          dbService.getQcRecords().catch(() => []),
          dbService.getLotConfigs().catch(() => []),
          dbService.getEqaRecords().catch(() => []),
          dbService.getManuals().catch(() => []),
          dbService.getAnnouncements().catch(() => [])
        ]);

        setMachines(remoteMachines || []);
        setRepairs(remoteRepairs || []);
        setSupplies(remoteSupplies || []);
        setQcRecords(remoteQc || []);
        setLotConfigs(remoteLot || []);
        setEqaRecords(remoteEqa || []);
        if (remoteManuals) setManuals(remoteManuals);
        if (remoteAnnouncements) setAnnouncements(remoteAnnouncements);

        setShowToast('เชื่อมต่อและดึงข้อมูลจากระบบ Supabase Cloud เรียบร้อยแล้ว');
      } catch (err) {
        console.warn('DB Fetch failed, setting empty states:', err);
        setMachines([]);
        setRepairs([]);
        setSupplies([]);
        setQcRecords([]);
        setLotConfigs([]);
        setEqaRecords([]);
      }
    };
    fetchData();
  }, []);

  // Navigation Roles & Active Tab inside Admin & User
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    const session = localStorage.getItem('dtx_admin_session');
    const lastActiveStr = localStorage.getItem('dtx_admin_last_active');
    if (session === 'true' && lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
      if (Date.now() - lastActive < TIMEOUT_MS) {
        return true;
      }
    }
    return false;
  });

  const [role, setRole] = useState<'user' | 'admin'>(() => {
    const savedRole = localStorage.getItem('dtx_role');
    const session = localStorage.getItem('dtx_admin_session');
    const lastActiveStr = localStorage.getItem('dtx_admin_last_active');
    if (session === 'true' && lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      if (Date.now() - lastActive < 30 * 60 * 1000) {
        return savedRole === 'user' ? 'user' : 'admin';
      }
    }
    return savedRole === 'admin' ? 'admin' : 'user';
  });

  const [activeUserTab, setActiveUserTab] = useState<'repair' | 'supply' | 'track' | 'guide'>('repair');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdminProfileOpen, setIsAdminProfileOpen] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'stock' | 'quality' | 'repair' | 'line' | 'supabase' | 'documents'>('dashboard');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showTimeoutNotice, setShowTimeoutNotice] = useState(false);

  // Manuals & Announcements State
  const [manuals, setManuals] = useState<UserManual[]>(() => {
    let deletedManualIds: string[] = [];
    try {
      deletedManualIds = JSON.parse(localStorage.getItem('dtx_deleted_manual_ids') || '[]');
    } catch (e) {}

    const saved = localStorage.getItem('dtx_manuals');
    let list: UserManual[] = [];
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) list = parsed;
      } catch (e) {}
    }
    // Filter out old mock items ('man1', 'man2', 'man3') as well as deleted IDs
    const filtered = list.filter(m => m && !m.isDeleted && !deletedManualIds.includes(m.id) && !['man1', 'man2', 'man3'].includes(m.id));
    localStorage.setItem('dtx_manuals', JSON.stringify(filtered));
    return filtered;
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    let deletedAnnIds: string[] = [];
    try {
      deletedAnnIds = JSON.parse(localStorage.getItem('dtx_deleted_ann_ids') || '[]');
    } catch (e) {}

    const saved = localStorage.getItem('dtx_announcements');
    let list: Announcement[] = [];
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) list = parsed;
      } catch (e) {}
    }
    // Filter out old mock items ('ann-1', 'ann-2') as well as deleted IDs
    const filtered = list.filter(a => a && !a.isDeleted && !deletedAnnIds.includes(a.id) && !['ann-1', 'ann-2'].includes(a.id));
    localStorage.setItem('dtx_announcements', JSON.stringify(filtered));
    return filtered;
  });

  useEffect(() => {
    localStorage.setItem('dtx_manuals', JSON.stringify(manuals));
  }, [manuals]);

  useEffect(() => {
    localStorage.setItem('dtx_announcements', JSON.stringify(announcements));
  }, [announcements]);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('dtx_dark_mode') === 'true' || localStorage.getItem('dtx_night_mode') === 'true';
  });
  const [showToast, setShowToast] = useState<string>('');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const toggleDarkMode = () => {
    const nextVal = !isDarkMode;
    setIsDarkMode(nextVal);
    localStorage.setItem('dtx_dark_mode', String(nextVal));
    localStorage.setItem('dtx_night_mode', String(nextVal));
    setShowToast(nextVal 
      ? 'เปิดใช้งานโหมดมืด (Dark Mode) เรียบร้อย' 
      : 'ปิดใช้งานโหมดมืด - กลับสู่โหมดสว่างปกติ'
    );
  };

  // Sliding 30-Minute Session Timeout for Admin Portal
  useEffect(() => {
    if (!isAdminLoggedIn) return;

    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      localStorage.setItem('dtx_admin_last_active', String(Date.now()));
      timeoutId = window.setTimeout(() => {
        setIsAdminLoggedIn(false);
        setAdminPassword('');
        setShowTimeoutNotice(true);
        localStorage.removeItem('dtx_admin_session');
        localStorage.removeItem('dtx_admin_last_active');
      }, TIMEOUT_MS);
    };

    // Initial setup
    resetTimer();

    // Event listeners to detect activity and slide the timeout window
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isAdminLoggedIn]);

  // Handlers for data updates passed to children
  
  useEffect(() => {
    localStorage.setItem('dtx_line_token', lineNotifyToken);
  }, [lineNotifyToken]);

  const handleAddRepair = (newRepair: RepairRequest) => {
    setRepairs(prev => [newRepair, ...prev]);
    if (isSupabaseConfigured()) {
      dbService.insertRepair(newRepair).then(() => {
        setShowToast('ส่งตั๋วแจ้งซ่อมเข้าสู่ฐานข้อมูลคลาวด์แล้ว');
      }).catch(err => {
        setShowToast(`แจ้งซ่อมบันทึกในเครื่องแล้ว แต่ไม่สามารถซิงก์ขึ้นคลาวด์: ${err.message}`);
      });
    }
  };

  const handleAddSupply = (newSupply: SupplyRequest) => {
    setSupplies(prev => [newSupply, ...prev]);
    if (isSupabaseConfigured()) {
      dbService.insertSupply(newSupply).then(() => {
        setShowToast('ส่งตั๋วเบิกอุปกรณ์เข้าสู่ฐานข้อมูลคลาวด์แล้ว');
      }).catch(err => {
        setShowToast(`ตั๋วเบิกบันทึกในเครื่องแล้ว แต่ไม่สามารถซิงก์ขึ้นคลาวด์: ${err.message}`);
      });
    }
  };

  const handleUpdateRepair = (updatedRepair: RepairRequest) => {
    setRepairs(prev => prev.map(r => r.id === updatedRepair.id ? updatedRepair : r));
    
    let updatedMachines = [...machines];
    // If completed, update lastQCDate in corresponding machine
    if (updatedRepair.status === 'completed') {
      updatedMachines = machines.map(m => {
        if (m.serialNumber === updatedRepair.serialNumber) {
          return { ...m, status: 'active', lastQCDate: new Date().toISOString().split('T')[0] };
        }
        return m;
      });
      setMachines(updatedMachines);
    } else if (updatedRepair.status === 'waiting_claim') {
      updatedMachines = machines.map(m => {
        if (m.serialNumber === updatedRepair.serialNumber) {
          return { ...m, status: 'waiting_claim' };
        }
        return m;
      });
      setMachines(updatedMachines);
    } else if (updatedRepair.status === 'claimed') {
      updatedMachines = machines.map(m => {
        if (m.serialNumber === updatedRepair.serialNumber) {
          return { ...m, status: 'claimed' };
        }
        return m;
      });
      setMachines(updatedMachines);
    }

    if (isSupabaseConfigured()) {
      // 1. Update repair record
      dbService.updateRepair(updatedRepair.id, updatedRepair).then(() => {
        setShowToast('อัปเดตสถานะงานซ่อมบนระบบคลาวด์สำเร็จ');
      }).catch(err => {
        console.error('Failed to sync updated repair:', err);
      });

      // 2. Update corresponding machine status if affected
      const affectedMachine = updatedMachines.find(m => m.serialNumber === updatedRepair.serialNumber);
      if (affectedMachine) {
        dbService.updateMachine(affectedMachine.id, affectedMachine).catch(err => {
          console.error('Failed to sync machine state:', err);
        });
      }
    }
  };

  const handleAddMachine = (newMachine: DtxMachine) => {
    setMachines(prev => [...prev, newMachine]);
    if (isSupabaseConfigured()) {
      dbService.insertMachine(newMachine).then(() => {
        setShowToast('บันทึกเครื่องตรวจน้ำตาลใหม่ขึ้นคลาวด์สำเร็จ');
      }).catch(err => {
        setShowToast(`บันทึกเครื่องในเบราว์เซอร์แล้ว แต่ไม่สามารถซิงก์ขึ้นคลาวด์: ${err.message}`);
      });
    }
  };

  const handleUpdateMachine = (updatedMachine: DtxMachine) => {
    setMachines(prev => prev.map(m => m.id === updatedMachine.id ? updatedMachine : m));
    if (isSupabaseConfigured()) {
      dbService.updateMachine(updatedMachine.id, updatedMachine).then(() => {
        setShowToast('อัปเดตข้อมูลเครื่องตรวจน้ำตาลบนคลาวด์สำเร็จ');
      }).catch(err => {
        console.error('Failed to sync updated machine:', err);
      });
    }
  };

  const handleDeleteMachine = (id: string) => {
    setMachines(prev => prev.filter(m => m.id !== id));
    if (isSupabaseConfigured()) {
      dbService.deleteMachine(id).then(() => {
        setShowToast('ลบเครื่องตรวจน้ำตาลจากระบบคลาวด์สำเร็จ');
      }).catch(err => {
        console.error('Failed to sync deleted machine:', err);
      });
    }
  };

  const handleAddQcRecord = (newRecord: QcRecord) => {
    setQcRecords(prev => [newRecord, ...prev]);
    // Also update machine's lastQCDate and active status if normal
    const updatedMachines = machines.map(m => {
      if (m.serialNumber === newRecord.serialNumber) {
        return {
          ...m,
          lastQCDate: newRecord.date,
          status: (newRecord.level1Status === 'normal' && newRecord.level2Status === 'normal' && newRecord.level3Status === 'normal') ? 'active' : m.status as any
        };
      }
      return m;
    });
    setMachines(updatedMachines);

    if (isSupabaseConfigured()) {
      // 1. Insert QC Record
      dbService.insertQcRecord(newRecord).then(() => {
        setShowToast('ผลการตรวจวิเคราะห์คุณภาพ (QC) ถูกส่งขึ้นคลาวด์แล้ว');
      }).catch(err => {
        setShowToast(`ผล QC บันทึกในเครื่องแล้ว แต่ไม่สามารถซิงก์ขึ้นคลาวด์: ${err.message}`);
      });

      // 2. Update machine affected states
      const affectedMachine = updatedMachines.find(m => m.serialNumber === newRecord.serialNumber);
      if (affectedMachine) {
        dbService.updateMachine(affectedMachine.id, affectedMachine).catch(err => {
          console.error('Failed to sync machine state after QC:', err);
        });
      }
    }
  };

  const handleUpdateLotConfigs = (newConfigs: QcLotConfig[]) => {
    setLotConfigs(newConfigs);
    if (isSupabaseConfigured()) {
      // Find which LOT was modified by looking at changes or just sync all
      Promise.all(newConfigs.map(lot => dbService.insertLotConfig(lot).catch(err => {
        // If it already exists (duplicate key error), update it instead
        if (err.message?.includes('duplicate key') || err.code === '23505') {
          return dbService.updateLotConfig(lot.lotNumber, lot);
        }
        throw err;
      }))).then(() => {
        setShowToast('อัปเดตกำหนดค่าเป้าหมายล็อตน้ำยาบนระบบคลาวด์แล้ว');
      }).catch(err => {
        console.error('Failed to sync lot configs:', err);
      });
    }
  };

  const handleAddEqaRecord = (newEqa: EqaRecord) => {
    setEqaRecords(prev => [newEqa, ...prev]);
    if (isSupabaseConfigured()) {
      dbService.insertEqaRecord(newEqa).then(() => {
        setShowToast('ส่งผลประเมินภายนอก (EQA) ขึ้นฐานข้อมูลคลาวด์แล้ว');
      }).catch(err => {
        setShowToast(`ผล EQA บันทึกในเบราว์เซอร์แล้ว แต่ไม่สามารถซิงก์ขึ้นคลาวด์: ${err.message}`);
      });
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-50/50 dark:bg-slate-900 flex flex-col font-sans transition-all duration-300 relative text-slate-800 dark:text-slate-100" 
      id="app-root"
    >
      {/* Top Main Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs no-print relative" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div onClick={() => { setRole('user'); localStorage.setItem('dtx_role', 'user'); setActiveUserTab('repair'); }} className="flex items-center gap-2 sm:gap-2.5 cursor-pointer">
            {/* ไอคอนกล้องจุลทรรศน์ */}
            <div className="w-7 h-7 sm:w-9 sm:h-9 flex-shrink-0 bg-sky-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <Microscope className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            {/* ข้อความชื่อหน่วยงาน */}
            <div>
              <h1 className="text-xs sm:text-sm font-black text-gray-900 leading-tight whitespace-nowrap">
                กลุ่มงานเทคนิคการแพทย์
              </h1>
              <p className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                โรงพยาบาลสังขะ
              </p>
            </div>
          </div>

          {/* PC Navigation: Elegant service tabs directly in header */}
          <div className="hidden md:flex items-center space-x-2 h-16">
            {role === 'user' ? (
              <div className="flex items-center space-x-4 mr-2 h-16">
                <button
                  onClick={() => setActiveUserTab('repair')}
                  className={`px-1 h-16 text-[11px] md:text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${activeUserTab === 'repair' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                  id="header-tab-repair"
                >
                  <Wrench size={13} className="shrink-0" />
                  <span>แจ้งซ่อม (Repair)</span>
                </button>
                <button
                  onClick={() => setActiveUserTab('supply')}
                  className={`px-1 h-16 text-[11px] md:text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${activeUserTab === 'supply' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                  id="header-tab-supply"
                >
                  <Package size={13} className="shrink-0" />
                  <span>ขอเบิก (Request Supply)</span>
                </button>
                <button
                  onClick={() => setActiveUserTab('track')}
                  className={`px-1 h-16 text-[11px] md:text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${activeUserTab === 'track' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                  id="header-tab-track"
                >
                  <Search size={13} className="shrink-0" />
                  <span>ติดตามสถานะ</span>
                </button>
                <button
                  onClick={() => setActiveUserTab('guide')}
                  className={`px-1 h-16 text-[11px] md:text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${activeUserTab === 'guide' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                  id="header-tab-guide"
                >
                  <BookOpen size={13} className="shrink-0" />
                  <span>คู่มือ & เอกสาร</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2.5 mr-2">
                <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 px-3.5 py-2 rounded-xl border border-emerald-100/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold tracking-wide">ห้องปฏิบัติการผู้ดูแลระบบ (Admin)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRole('user');
                    localStorage.setItem('dtx_role', 'user');
                  }}
                  className="bg-sky-50 hover:bg-sky-100 text-sky-700 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-2xs border border-sky-200 cursor-pointer"
                  id="header-back-main-btn"
                  title="กลับสู่หน้าหลักสำหรับผู้ใช้งานทั่วไป"
                >
                  <ArrowLeft size={13} className="text-sky-600" />
                  <span>กลับสู่หน้าหลัก</span>
                </button>
              </div>
            )}

            {/* Header Right Tools & Profile Menu */}
            <div className="flex items-center space-x-2 border-l border-slate-200 dark:border-slate-700 pl-4 h-8 relative">
              <button 
                type="button"
                onClick={toggleDarkMode}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isDarkMode 
                    ? 'bg-slate-800 text-amber-300 border border-slate-700 hover:bg-slate-700 shadow-3xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title={isDarkMode ? "เปลี่ยนเป็นโหมดสว่าง (Light Mode)" : "เปลี่ยนเป็นโหมดมืด (Dark Mode)"}
              >
                {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              {role === 'admin' && isAdminLoggedIn ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAdminProfileOpen(!isAdminProfileOpen)}
                    className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    id="admin-profile-menu-trigger"
                  >
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <User size={12} />
                    </div>
                    <span>แอดมิน (Admin)</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isAdminProfileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isAdminProfileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsAdminProfileOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                        {/* Profile Info Header */}
                        <div className="p-3 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl mb-1.5 space-y-1">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                              <User size={16} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">ผู้ดูแลระบบ (Admin)</h4>
                              <p className="text-[10px] text-slate-300">กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลสังขะ</p>
                            </div>
                          </div>
                        </div>

                        {/* Section Title */}
                        <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          เมนูตั้งค่าผู้ดูแลระบบ (Admin Profile)
                        </div>

                        {/* Profile Settings Menu Options */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAdminTab('line');
                            setIsAdminProfileOpen(false);
                          }}
                          className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                            activeAdminTab === 'line' ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                          id="menu-line-settings"
                        >
                          <Smartphone size={15} className="text-emerald-500 shrink-0" />
                          <span>ตั้งค่าแจ้งเตือน LINE</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveAdminTab('supabase');
                            setIsAdminProfileOpen(false);
                          }}
                          className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                            activeAdminTab === 'supabase' ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                          id="menu-supabase-settings"
                        >
                          <Database size={15} className="text-sky-500 shrink-0" />
                          <span>เชื่อมต่อ Supabase</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveAdminTab('documents');
                            setIsAdminProfileOpen(false);
                          }}
                          className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                            activeAdminTab === 'documents' ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                          id="menu-documents-settings"
                        >
                          <FileText size={15} className="text-amber-500 shrink-0" />
                          <span>จัดการคู่มือ & ประชาสัมพันธ์</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRole('user');
                            localStorage.setItem('dtx_role', 'user');
                            setIsAdminProfileOpen(false);
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all text-left cursor-pointer"
                          id="menu-back-main-option"
                        >
                          <ArrowLeft size={15} className="text-sky-600 shrink-0" />
                          <span>กลับสู่หน้าหลัก (Staff View)</span>
                        </button>

                        <div className="my-1.5 border-t border-slate-100" />

                        {/* Logout Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAdminLoggedIn(false);
                            setAdminPassword('');
                            localStorage.removeItem('dtx_admin_session');
                            localStorage.removeItem('dtx_admin_last_active');
                            localStorage.setItem('dtx_role', 'user');
                            setRole('user');
                            setIsAdminProfileOpen(false);
                            setShowToast('ออกจากระบบผู้ดูแลระบบเรียบร้อยแล้ว');
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all text-left cursor-pointer"
                          id="menu-logout-option"
                        >
                          <LogOut size={15} className="text-rose-500 shrink-0" />
                          <span>ออกจากระบบ (Logout)</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => {
                    if (role === 'admin') {
                      setRole('user');
                      localStorage.setItem('dtx_role', 'user');
                    } else {
                      setRole('admin');
                      localStorage.setItem('dtx_role', 'admin');
                      if (!isAdminLoggedIn) {
                        setShowToast('กรุณาเข้าสู่ระบบด้วยรหัสผ่านแอดมิน (lab1234)');
                      }
                    }
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors animate-fade-in ${role === 'admin' ? 'bg-sky-600 text-white shadow-md shadow-sky-500/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  title={role === 'admin' ? "กลับสู่หน้าหลักแจ้งซ่อม/เบิก" : "เข้าสู่ระบบผู้ดูแลระบบ (Admin Login)"}
                  id="admin-login-icon-btn"
                >
                  <User size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Mobile Navigation Icons */}
          <div className="flex md:hidden items-center space-x-2.5">
            <button 
              type="button"
              onClick={toggleDarkMode}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isDarkMode 
                  ? 'bg-slate-800 text-amber-300 border border-slate-700' 
                  : 'bg-slate-100 text-slate-600'
              }`}
              title={isDarkMode ? "โหมดมืด (เปิดอยู่)" : "โหมดสว่าง"}
            >
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button 
              onClick={() => {
                setRole('admin');
                localStorage.setItem('dtx_role', 'admin');
                setIsMobileMenuOpen(false);
                if (!isAdminLoggedIn) {
                  setShowToast('กรุณาเข้าสู่ระบบด้วยรหัสผ่านแอดมิน (lab1234)');
                }
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${role === 'admin' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}
              title="เข้าสู่ระบบผู้ดูแลระบบ"
            >
              <User size={14} />
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center border border-slate-200/80 transition-all cursor-pointer"
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Drop-down list (mimicking template dropdown) */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-slate-50/98 backdrop-blur-md border-b border-slate-200 px-4 py-4 animate-fade-in no-print" id="mobile-nav-dropdown">
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-md p-1.5 space-y-1">
              <button
                onClick={() => {
                  setRole('user');
                  setActiveUserTab('repair');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 text-left text-xs font-semibold rounded-xl transition-all ${role === 'user' && activeUserTab === 'repair' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-600 hover:bg-slate-50/50'}`}
              >
                <div className="flex items-center space-x-3">
                  <Wrench size={14} className={role === 'user' && activeUserTab === 'repair' ? 'text-sky-600' : 'text-slate-400'} />
                  <span>แจ้งส่งซ่อมเครื่อง (Repair)</span>
                </div>
                {role === 'user' && activeUserTab === 'repair' && <div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div>}
              </button>
              
              <button
                onClick={() => {
                  setRole('user');
                  setActiveUserTab('supply');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 text-left text-xs font-semibold rounded-xl transition-all ${role === 'user' && activeUserTab === 'supply' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-600 hover:bg-slate-50/50'}`}
              >
                <div className="flex items-center space-x-3">
                  <Package size={14} className={role === 'user' && activeUserTab === 'supply' ? 'text-sky-600' : 'text-slate-400'} />
                  <span>ขอเบิกอุปกรณ์ (Supply Request)</span>
                </div>
                {role === 'user' && activeUserTab === 'supply' && <div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div>}
              </button>
              
              <button
                onClick={() => {
                  setRole('user');
                  setActiveUserTab('track');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 text-left text-xs font-semibold rounded-xl transition-all ${role === 'user' && activeUserTab === 'track' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-600 hover:bg-slate-50/50'}`}
              >
                <div className="flex items-center space-x-3">
                  <Search size={14} className={role === 'user' && activeUserTab === 'track' ? 'text-sky-600' : 'text-slate-400'} />
                  <span>ติดตามสถานะแจ้งซ่อม/เบิก</span>
                </div>
                {role === 'user' && activeUserTab === 'track' && <div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div>}
              </button>
              
              <button
                onClick={() => {
                  setRole('user');
                  setActiveUserTab('guide');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 text-left text-xs font-semibold rounded-xl transition-all ${role === 'user' && activeUserTab === 'guide' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-600 hover:bg-slate-50/50'}`}
              >
                <div className="flex items-center space-x-3">
                  <BookOpen size={14} className={role === 'user' && activeUserTab === 'guide' ? 'text-sky-600' : 'text-slate-400'} />
                  <span>คู่มือและวิธีแก้ไขปัญหาเบื้องต้น</span>
                </div>
                {role === 'user' && activeUserTab === 'guide' && <div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div>}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8" id="app-workspace">
        {role === 'user' ? (
          // USER STAFF LANDING PAGE
          <LandingPage
            machines={machines}
            repairs={repairs}
            supplies={supplies}
            onAddRepair={handleAddRepair}
            onAddSupply={handleAddSupply}
            lineNotifyToken={lineNotifyToken}
            activeTab={activeUserTab}
            onActiveTabChange={setActiveUserTab}
            manuals={manuals}
            announcements={announcements}
          />
        ) : !isAdminLoggedIn ? (
          // ADMIN LOGIN FORM
          <div className="max-w-md mx-auto space-y-4 mt-8">
            <button
              type="button"
              onClick={() => {
                setRole('user');
                localStorage.setItem('dtx_role', 'user');
              }}
              className="inline-flex items-center space-x-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} className="text-sky-600" />
              <span>กลับสู่หน้าหลัก</span>
            </button>

            {showTimeoutNotice && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start space-x-2.5 shadow-2xs animate-fade-in" id="timeout-alert-banner">
                <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={16} />
                <div className="text-xs space-y-1">
                  <p className="font-extrabold">เซสชันหมดอายุแล้ว (Session Timeout)</p>
                  <p className="text-amber-700 leading-relaxed font-medium">เซสชันการใช้งานระบบของท่านถูกตัดโดยอัตโนมัติเนื่องจากไม่มีกิจกรรมใดๆ เกิน 30 นาที เพื่อความปลอดภัยของข้อมูล</p>
                  <button
                    onClick={() => setShowTimeoutNotice(false)}
                    className="text-[10px] text-amber-950 font-extrabold hover:underline"
                  >
                    รับทราบและปิดการแจ้งเตือน
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white p-8 rounded-2xl border border-sky-100 shadow-sm space-y-6 animate-scale-up" id="admin-login-form">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-sky-100 text-sky-700 rounded-full flex items-center justify-center mx-auto shadow-xs">
                  <Lock size={22} />
                </div>
                <h2 className="text-lg font-bold text-slate-800">เข้าสู่ระบบผู้ดูแลระบบ (Admin Login)</h2>
                <p className="text-xs text-slate-400">กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลสังขะ</p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (adminUsername.trim() === 'admin' && adminPassword === 'lab1234') {
                  setIsAdminLoggedIn(true);
                  localStorage.setItem('dtx_admin_session', 'true');
                  localStorage.setItem('dtx_admin_last_active', String(Date.now()));
                  localStorage.setItem('dtx_role', 'admin');
                  setRole('admin');
                  setLoginError('');
                  setShowTimeoutNotice(false);
                } else {
                  setLoginError('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
                }
              }} className="space-y-4 text-xs">
              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg text-center font-bold">
                  {loginError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">ชื่อผู้ใช้งาน (Username) *</label>
                <input
                  type="text"
                  placeholder="กรอกชื่อผู้ใช้งาน"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:border-sky-500 bg-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">รหัสผ่าน (Password) *</label>
                <input
                  type="password"
                  placeholder="กรอกรหัสผ่าน"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:border-sky-500 bg-white"
                  required
                />
              </div>

              <div className="bg-sky-50/50 p-3.5 rounded-lg border border-sky-50 text-[11px] text-sky-800 space-y-1">
                <span className="font-bold flex items-center space-x-1">
                  <Lightbulb size={12} className="text-sky-600 shrink-0" />
                  <span>รหัสผ่านทดสอบการใช้งาน:</span>
                </span>
                <p>ชื่อผู้ใช้: <code className="font-mono bg-white px-1 py-0.5 rounded border border-sky-100 font-bold">admin</code> | รหัสผ่าน: <code className="font-mono bg-white px-1 py-0.5 rounded border border-sky-100 font-bold">lab1234</code></p>
              </div>

              <button
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-lg transition-all shadow-xs"
              >
                เข้าสู่ระบบห้องปฏิบัติการ
              </button>
            </form>
          </div>
          </div>
        ) : (
          // ADMIN PANEL SYSTEM WITH SIDEBAR TABS
          <div className="space-y-6" id="admin-workspace-wrapper">
            <div className="space-y-6" id="admin-workspace">
              {/* Admin Navigation: Clean plain text horizontal tabs spread evenly on PC, Dropdown on Mobile */}
              <div className="bg-white border-b border-slate-200 px-2 sm:px-4 rounded-2xl shadow-3xs no-print" id="admin-tabs-nav">
                {/* PC View: Underlined Plain Text Tabs Spread Evenly Across Page */}
                <div className="hidden md:flex w-full items-end h-14">
                  {[
                    { id: 'dashboard', label: 'สรุปภาพรวม' },
                    { id: 'stock', label: 'คลังเครื่องมือ' },
                    { id: 'repair', label: 'งานซ่อมบำรุง' },
                    { id: 'quality', label: 'งานคุณภาพ (IQC & EQA)' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveAdminTab(tab.id as any)}
                      className={`h-14 flex-1 flex items-center justify-center px-4 text-sm font-semibold border-b-2 transition-all duration-250 cursor-pointer whitespace-nowrap text-center ${
                        activeAdminTab === tab.id
                          ? 'border-sky-600 text-sky-600 font-bold bg-sky-50/40'
                          : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Mobile View: Clean elegant Dropdown Menu */}
                <div className="md:hidden py-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">เลือกเมนูการประมวลผล</label>
                  <div className="relative">
                    <CustomSelect
                      value={activeAdminTab}
                      onChange={(e) => setActiveAdminTab(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 pr-10"
                    >
                      <option value="dashboard">สรุปภาพรวม (Dashboard)</option>
                      <option value="stock">คลังเครื่องมือ (DTX Stock)</option>
                      <option value="repair">งานซ่อมบำรุง</option>
                      <option value="quality">งานคุณภาพ (IQC & EQA)</option>
                      <option value="line">ตั้งค่าแจ้งเตือน LINE</option>
                      <option value="supabase">เชื่อมต่อ Supabase</option>
                      <option value="documents">จัดการคู่มือ & ประชาสัมพันธ์</option>
                    </CustomSelect>
                  </div>
                </div>
              </div>

              {/* Admin Tabs Content Viewer (Full Width for optimal space) */}
              <div className="w-full" id="admin-content-viewport">
              {activeAdminTab === 'dashboard' && (
                <Dashboard machines={machines} repairs={repairs} />
              )}
              {activeAdminTab === 'stock' && (
                <StockManagement
                  machines={machines}
                  onAddMachine={handleAddMachine}
                  onUpdateMachine={handleUpdateMachine}
                  onDeleteMachine={handleDeleteMachine}
                />
              )}
              {activeAdminTab === 'repair' && (
                <RepairManagement
                  repairs={repairs}
                  onUpdateRepair={handleUpdateRepair}
                  lineNotifyToken={lineNotifyToken}
                />
              )}
              {(activeAdminTab === 'quality' || (activeAdminTab as string) === 'qc' || (activeAdminTab as string) === 'eqa') && (
                <QualityManagement
                  machines={machines}
                  qcRecords={qcRecords}
                  lotConfigs={lotConfigs}
                  onAddQcRecord={handleAddQcRecord}
                  onUpdateLotConfigs={handleUpdateLotConfigs}
                  eqaRecords={eqaRecords}
                  onAddEqaRecord={handleAddEqaRecord}
                  initialSubTab={(activeAdminTab as string) === 'eqa' ? 'eqa' : 'iqc'}
                />
              )}
              {activeAdminTab === 'line' && (
                <div className="space-y-4">
                  <div className="bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-2xl flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
                    <div className="flex items-center space-x-2 font-bold">
                      <Smartphone size={16} className="text-emerald-600" />
                      <span>ตั้งค่าระบบ: การแจ้งเตือนผ่าน LINE Notify (เรียกจากเมนูโปรไฟล์แอดมิน)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveAdminTab('dashboard')}
                      className="font-extrabold text-emerald-700 hover:text-emerald-950 hover:underline cursor-pointer flex items-center space-x-1"
                    >
                      <span>← กลับสู่แผงควบคุมหลัก</span>
                    </button>
                  </div>
                  <LineNotifyConfig
                    token={lineNotifyToken}
                    onUpdateToken={setLineNotifyToken}
                    repairs={repairs}
                    onUpdateRepair={handleUpdateRepair}
                  />
                </div>
              )}
              {activeAdminTab === 'supabase' && (
                <div className="space-y-4">
                  <div className="bg-sky-50/80 border border-sky-200/80 p-3.5 rounded-2xl flex items-center justify-between text-xs text-sky-900 shadow-2xs">
                    <div className="flex items-center space-x-2 font-bold">
                      <Database size={16} className="text-sky-600" />
                      <span>ตั้งค่าระบบ: เชื่อมต่อฐานข้อมูลคลาวด์ Supabase (เรียกจากเมนูโปรไฟล์แอดมิน)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveAdminTab('dashboard')}
                      className="font-extrabold text-sky-700 hover:text-sky-950 hover:underline cursor-pointer flex items-center space-x-1"
                    >
                      <span>← กลับสู่แผงควบคุมหลัก</span>
                    </button>
                  </div>
                  <SupabaseConfig
                    machines={machines}
                    repairs={repairs}
                    supplies={supplies}
                    qcRecords={qcRecords}
                    lotConfigs={lotConfigs}
                    eqaRecords={eqaRecords}
                    manuals={manuals}
                    announcements={announcements}
                    setMachines={setMachines}
                    setRepairs={setRepairs}
                    setSupplies={setSupplies}
                    setQcRecords={setQcRecords}
                    setLotConfigs={setLotConfigs}
                    setEqaRecords={setEqaRecords}
                    setManuals={setManuals}
                    setAnnouncements={setAnnouncements}
                    onShowToast={setShowToast}
                  />
                </div>
              )}
              {activeAdminTab === 'documents' && (
                <div className="space-y-4">
                  <div className="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-2xl flex items-center justify-between text-xs text-amber-900 shadow-2xs">
                    <div className="flex items-center space-x-2 font-bold">
                      <FileText size={16} className="text-amber-600" />
                      <span>ตั้งค่าระบบ: จัดการเอกสารคู่มือ & ข่าวประชาสัมพันธ์ (เรียกจากเมนูโปรไฟล์แอดมิน)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveAdminTab('dashboard')}
                      className="font-extrabold text-amber-700 hover:text-amber-950 hover:underline cursor-pointer flex items-center space-x-1"
                    >
                      <span>← กลับสู่แผงควบคุมหลัก</span>
                    </button>
                  </div>
                  <DocumentsAndAnnouncementsManager
                    manuals={manuals}
                    setManuals={setManuals}
                    announcements={announcements}
                    setAnnouncements={setAnnouncements}
                    showToast={setShowToast}
                  />
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </main>

      {/* Humble App Footer */}
      <footer className="bg-white border-t border-slate-150 py-5 text-center text-[10px] text-slate-400 mt-auto no-print" id="app-footer">
        <p>© 2026 Medical Technology Department, Sangkha Hospital. All rights reserved.</p>
        <p className="mt-1 font-semibold text-slate-500">Blood Glucose POCT Management System</p>
        <p className="text-slate-400">Version 2.0.0 • Developed by MT. S. Singsard</p>
        <p className="mt-1 text-slate-300">ระบบบริหารจัดการเครื่องตรวจน้ำตาลปลายนิ้ว</p>
      </footer>

      {/* Floating System Toast Alerts */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg border border-slate-800 flex items-center space-x-2.5 animate-fade-in no-print" id="system-action-toast">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
          <span>{showToast}</span>
        </div>
      )}
    </div>
  );
}
