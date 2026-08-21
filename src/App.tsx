/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import CustomSelect from "./components/CustomSelect";
import { dbService } from './lib/supabase';
import { DtxMachine, RepairRequest, SupplyRequest, QcRecord, QcLotConfig, EqaRecord, UserManual, Announcement } from './types';
import { Activity, ShieldCheck, User, ShieldAlert, Wrench, Package, BarChart2, Layers, Smartphone, Database, Lock, Unlock, Menu, X, ChevronDown, ChevronLeft, ChevronRight, Home, LogIn, LogOut, Search, BookOpen, ArrowLeft, Microscope, Lightbulb, FileText, Megaphone, Sun, Moon, Image as ImageIcon, Upload, RotateCcw, Bell, LayoutGrid, Settings, Phone, Mail, MapPin } from 'lucide-react';

import { DEFAULT_HOSPITAL_LOGO_BASE64 } from './assets/hospitalLogoBase64';

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
import { isSupabaseConfigured, getSupabaseConfigInfo, loginWithSupabaseAuth } from './lib/supabase';

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

  const [role, setRole] = useState<'user' | 'staff' | 'admin'>(() => {
    const savedRole = localStorage.getItem('dtx_role');
    const session = localStorage.getItem('dtx_admin_session');
    const lastActiveStr = localStorage.getItem('dtx_admin_last_active');
    if (session === 'true' && lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      if (Date.now() - lastActive < 30 * 60 * 1000) {
        return savedRole === 'staff' ? 'staff' : savedRole === 'user' ? 'user' : 'admin';
      }
    }
    return savedRole === 'admin' ? 'admin' : savedRole === 'staff' ? 'staff' : 'user';
  });

  const [activeUserTab, setActiveUserTab] = useState<'repair' | 'supply' | 'track' | 'guide'>(() => {
    const saved = localStorage.getItem('dtx_active_user_tab');
    return (saved as any) || 'repair';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdminProfileOpen, setIsAdminProfileOpen] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'stock' | 'quality' | 'repair' | 'line' | 'supabase' | 'documents'>(() => {
    const saved = localStorage.getItem('dtx_active_admin_tab');
    return (saved as any) || 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('dtx_active_user_tab', activeUserTab);
  }, [activeUserTab]);

  useEffect(() => {
    localStorage.setItem('dtx_active_admin_tab', activeAdminTab);
  }, [activeAdminTab]);

  useEffect(() => {
    localStorage.setItem('dtx_role', role);
  }, [role]);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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

  // Logo States with safe storage sanitization (Embedded Base64 Data URL)
  const [hospitalLogo, setHospitalLogo] = useState<string>(() => {
    const saved = localStorage.getItem('dtx_hospital_logo');
    // If saved is a legacy broken relative path, fallback to embedded Base64
    if (!saved || saved === '/SKH.png' || saved === './SKH.png' || saved === 'SKH.png' || !saved.startsWith('data:')) {
      return DEFAULT_HOSPITAL_LOGO_BASE64;
    }
    return saved;
  });
  const [deptLogo, setDeptLogo] = useState<string>(() => {
    const saved = localStorage.getItem('dtx_dept_logo');
    if (!saved || saved === '/SKH.png' || saved === './SKH.png' || saved === 'SKH.png' || !saved.startsWith('data:')) {
      return DEFAULT_HOSPITAL_LOGO_BASE64;
    }
    return saved;
  });
  const [showLogoModal, setShowLogoModal] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [footerLogoError, setFooterLogoError] = useState<boolean>(false);

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
        setShowToast('อัปเดตกำหนดค่าเป้าหมาย LOT น้ำยาบนระบบคลาวด์แล้ว');
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
      className="min-h-screen bg-slate-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col font-sans transition-all duration-300 relative text-slate-800 dark:text-slate-100" 
      id="app-root"
    >
      {/* Background Soft Dimensional Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 no-print" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-sky-100/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-sky-50/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-sky-100/15 rounded-full blur-3xl"></div>
      </div>
      {/* Top Main Navigation Bar (User View & Login View) */}
      {!(role === 'admin' && isAdminLoggedIn) && (
        <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-sky-100 dark:border-slate-800 sticky top-0 z-40 shadow-md shadow-slate-200/50 dark:shadow-none no-print relative" id="app-header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div onClick={() => { setRole('user'); localStorage.setItem('dtx_role', 'user'); setActiveUserTab('repair'); }} className="flex items-center gap-2 sm:gap-2.5 cursor-pointer">
              {/* ไอคอนกล้องจุลทรรศน์ */}
              <div className="w-7 h-7 sm:w-9 sm:h-9 flex-shrink-0 bg-sky-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                <Microscope className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              {/* ข้อความชื่อหน่วยงาน */}
              <div>
                <h1 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white leading-tight whitespace-nowrap">
                  กลุ่มงานเทคนิคการแพทย์
                </h1>
                <p className="text-[8px] sm:text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tight">
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
                <div className="flex items-center mr-2">
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

          {/* Mobile Drop-down list */}
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
      )}

      {/* Admin Top Right Toolbar Bar (Matching Reference Image) */}
      {role === 'admin' && isAdminLoggedIn && (
        <div 
          className={`fixed top-0 right-0 z-20 h-16 pointer-events-none transition-all duration-300 no-print ${
            isSidebarCollapsed ? 'left-16' : 'left-60'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-end space-x-3 pointer-events-none">
          {/* Live Sync Status Pill */}
          <div className="pointer-events-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-100 dark:border-slate-800 rounded-full px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black">LIVE</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
              Last updated: {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="pointer-events-auto w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-amber-300 flex items-center justify-center shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title={isDarkMode ? "โหมดสว่าง" : "โหมดมืด"}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Admin Profile Pill */}
          <div className="relative pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsAdminProfileOpen(!isAdminProfileOpen)}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 pl-3.5 pr-1 py-1 rounded-full text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs flex items-center space-x-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <span className="font-bold text-slate-800 dark:text-slate-100">admin</span>
              <span className="bg-sky-500 text-white font-black px-2 py-0.5 rounded-full text-[10px] shadow-2xs">
                AD
              </span>
            </button>

            {/* Profile Dropdown Menu */}
            {isAdminProfileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsAdminProfileOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-2 z-50 animate-in fade-in duration-150">
                  <div className="p-3 bg-slate-900 text-white rounded-xl mb-1 space-y-0.5">
                    <div className="text-xs font-bold">Admin Profile</div>
                    <div className="text-[10px] text-slate-400">POCT Management</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRole('user');
                      localStorage.setItem('dtx_role', 'user');
                      setIsAdminProfileOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left cursor-pointer"
                  >
                    <ArrowLeft size={14} className="text-sky-500 shrink-0" />
                    <span>กลับสู่หน้าผู้ใช้งาน (Staff View)</span>
                  </button>
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
                      setShowToast('ออกจากระบบผู้ดูแลเรียบร้อยแล้ว');
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all text-left cursor-pointer"
                  >
                    <LogOut size={14} className="shrink-0" />
                    <span>ออกจากระบบ (Logout)</span>
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <main 
        className={`flex-1 w-full relative z-10 transition-all duration-300 min-h-screen bg-slate-50/70 dark:bg-slate-950 ${
          role === 'admin' && isAdminLoggedIn
            ? `pt-16 pb-16 ${isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60'}`
            : 'py-6 md:py-8'
        }`} 
        id="app-workspace"
      >
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
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

            <div className="bg-white dark:bg-slate-900 p-7 sm:p-8 rounded-2xl border border-sky-100 dark:border-slate-800 shadow-sm space-y-6 animate-scale-up" id="admin-login-form">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 rounded-full flex items-center justify-center mx-auto shadow-xs">
                  <Lock size={22} />
                </div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">เข้าสู่ระบบเจ้าหน้าที่ & ผู้ดูแลระบบ (Staff / Admin Login)</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">เฉพาะเจ้าหน้าที่ห้องปฏิบัติการและผู้ดูแลระบบที่ได้รับอนุญาต</p>

                {/* Info Notice: Landing Page is Public */}
                <div className="bg-sky-50/80 dark:bg-sky-950/50 p-3 rounded-xl border border-sky-100 dark:border-sky-900/60 text-left text-[11px] text-sky-900 dark:text-sky-300 space-y-1">
                  <span className="font-bold flex items-center space-x-1">
                    <Lightbulb size={13} className="text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>สำหรับหน่วยงานภายนอก / ผู้ใช้งานทั่วไป:</span>
                  </span>
                  <p className="text-slate-600 dark:text-slate-300">
                    สามารถใช้งานระบบแจ้งส่งซ่อม, บันทึก QC/EQA, เบิกอุปกรณ์ และดาวน์โหลดคู่มือ บน<strong className="text-sky-700 dark:text-sky-400">หน้าแรก (Landing Page) ได้ทันทีโดยไม่ต้องเข้าสู่ระบบ</strong>
                  </p>
                </div>

                {/* Connection Status Badge */}
                <div className="pt-1">
                  {isSupabaseConfigured() ? (
                    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>พร้อมเชื่อมต่อ Supabase Auth / Master Admin</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>โหมดสแตนด์อโลน (สามารถใช้รหัส Master Admin เข้าได้ทันที)</span>
                    </span>
                  )}
                </div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                setLoginError('');
                setIsLoggingIn(true);

                const res = await loginWithSupabaseAuth(adminUsername, adminPassword);
                if (res.success && res.user) {
                  const userRole = (res.user.role || '').toLowerCase();
                  const assignedRole = (userRole === 'admin' || adminUsername.toLowerCase() === 'admin' || (res.user.email && res.user.email.toLowerCase().startsWith('admin@'))) ? 'admin' : 'staff';
                  
                  setIsAdminLoggedIn(true);
                  localStorage.setItem('dtx_admin_session', 'true');
                  localStorage.setItem('dtx_admin_last_active', String(Date.now()));
                  localStorage.setItem('dtx_role', assignedRole);
                  setRole(assignedRole);
                  setShowTimeoutNotice(false);
                  setShowToast(`เข้าสู่ระบบสำเร็จในฐานะ ${assignedRole === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'เจ้าหน้าที่ (Staff)'} (${res.user.name || res.user.email})`);
                } else {
                  setLoginError(res.error || 'ชื่อผู้ใช้งาน/อีเมล หรือรหัสผ่านไม่ถูกต้อง (หากยังไม่ได้สร้างบัญชีใน Supabase Auth สามารถใช้ admin / lab1234)');
                }
                setIsLoggingIn(false);
              }} className="space-y-4 text-xs">
                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 dark:bg-rose-950/60 dark:border-rose-900/60 dark:text-rose-300 rounded-xl text-center font-bold animate-shake">
                    {loginError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">ชื่อผู้ใช้งาน หรือ อีเมล (Username / Email) *</label>
                  <input
                    type="text"
                    placeholder="เช่น admin หรือ user@sangkha-hospital.com"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-sky-500 bg-slate-50/50 dark:bg-slate-800 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">รหัสผ่าน (Password) *</label>
                  <input
                    type="password"
                    placeholder="กรอกรหัสผ่าน"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-sky-500 bg-slate-50/50 dark:bg-slate-800 font-medium"
                    required
                  />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">เข้าใช้งานด่วนด้วย Master Admin:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminUsername('admin');
                      setAdminPassword('lab1234');
                    }}
                    className="text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer"
                  >
                    ใส่ admin / lab1234 อัตโนมัติ
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-sky-300 text-white font-bold py-3 rounded-xl transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>กำลังตรวจสอบสิทธิ์...</span>
                    </>
                  ) : (
                    <span>เข้าสู่ระบบ (Sign In)</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          // ADMIN PANEL SYSTEM WITH FLUSH LEFT EDGE SIDEBAR
          <div className="w-full min-h-[80vh]" id="admin-workspace-wrapper">
            {/* Desktop Fixed Full-Height Left Edge Sidebar */}
            <aside 
              className={`fixed left-0 top-0 bottom-0 z-40 hidden lg:flex flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 transition-all duration-300 no-print overflow-y-auto ${
                isSidebarCollapsed ? 'w-16 p-2.5 items-center' : 'w-60 p-4'
              }`}
              id="admin-sidebar"
            >
              {/* Sidebar Top Section */}
              <div className="w-full space-y-5">
                {/* Header branding & Hamburger toggle */}
                <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center py-2' : 'justify-between px-1'}`}>
                  {!isSidebarCollapsed ? (
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-sky-500/20">
                        <Microscope size={18} />
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight truncate">
                        POCT Management
                      </span>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer shrink-0"
                    title={isSidebarCollapsed ? "ขยายแถบเมนู (Expand)" : "พับเก็บเมนู (Collapse)"}
                    id="sidebar-toggle-btn"
                  >
                    <Menu size={20} />
                  </button>
                </div>

                {/* Sidebar Navigation Items */}
                <nav className="space-y-4 w-full">
                  {[
                    {
                      groupLabel: 'MAIN',
                      items: [
                        { id: 'dashboard', label: 'Overview', icon: LayoutGrid },
                        { id: 'stock', label: 'All Stock', icon: Layers, badge: machines.length },
                        { id: 'repair', label: 'Repairs', icon: Wrench, badge: repairs.filter(r => r.status !== 'completed').length },
                      ]
                    },
                    {
                      groupLabel: 'CONTENT',
                      items: [
                        { id: 'documents', label: 'Announcements', icon: Megaphone },
                        { id: 'quality', label: 'Support IQC/EQA', icon: ShieldCheck },
                        { id: 'line', label: 'LINE Settings', icon: Settings },
                        { id: 'supabase', label: 'System Logs', icon: Database },
                      ]
                    }
                  ].map((group, idx) => (
                    <div key={idx} className="space-y-1">
                      {!isSidebarCollapsed && (
                        <div className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider px-3 uppercase mb-1.5">
                          {group.groupLabel}
                        </div>
                      )}
                      <div className="space-y-1">
                        {group.items.map((item) => {
                          const IconComp = item.icon;
                          const isActive = activeAdminTab === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setActiveAdminTab(item.id as any)}
                              title={isSidebarCollapsed ? item.label : undefined}
                              className={`w-full flex items-center transition-all cursor-pointer text-xs ${
                                isSidebarCollapsed 
                                  ? 'justify-center w-10 h-10 rounded-2xl mx-auto' 
                                  : 'px-3.5 py-2.5 space-x-3 rounded-2xl text-left font-bold'
                              } ${
                                isActive
                                  ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/20'
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white font-medium'
                              }`}
                            >
                              <IconComp size={18} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                              {!isSidebarCollapsed && (
                                <span className="truncate flex-1">{item.label}</span>
                              )}
                              {!isSidebarCollapsed && item.badge !== undefined && item.badge > 0 ? (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}>
                                  {item.badge}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>
              </div>

              {/* Sidebar Footer / Logout Action */}
              <div className="w-full pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setRole('user');
                    localStorage.setItem('dtx_role', 'user');
                    setIsAdminLoggedIn(false);
                    setShowToast('ออกจากระบบผู้ดูแลเรียบร้อยแล้ว');
                  }}
                  className={`w-full flex items-center transition-all cursor-pointer text-xs font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 ${
                    isSidebarCollapsed ? 'justify-center w-10 h-10 rounded-2xl mx-auto' : 'px-3.5 py-2.5 space-x-3 rounded-2xl'
                  }`}
                  title="LOGOUT"
                >
                  <LogOut size={18} className="shrink-0" />
                  {!isSidebarCollapsed && <span>LOGOUT</span>}
                </button>
              </div>
            </aside>

            {/* Mobile Dropdown Menu for Small Screens */}
            <div className="lg:hidden w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3 rounded-2xl shadow-xs no-print mb-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">เลือกเมนูผู้ดูแลระบบ</label>
              <CustomSelect
                value={activeAdminTab}
                onChange={(e) => setActiveAdminTab(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="dashboard">สรุปภาพรวม (Overview)</option>
                <option value="stock">คลังเครื่องมือ (DTX Stock)</option>
                <option value="repair">งานซ่อมบำรุง (Repairs)</option>
                <option value="quality">งานคุณภาพ (IQC & EQA)</option>
                <option value="documents">จัดการคู่มือ & ประชาสัมพันธ์</option>
                <option value="line">ตั้งค่าแจ้งเตือน LINE</option>
                <option value="supabase">เชื่อมต่อ Supabase</option>
              </CustomSelect>
            </div>

            {/* Main Admin Content Viewport */}
            <div className="w-full min-w-0 space-y-6" id="admin-content-viewport">
              {activeAdminTab === 'dashboard' && (
                <Dashboard 
                  machines={machines} 
                  repairs={repairs} 
                  onNavigateTab={(tab) => setActiveAdminTab(tab as any)}
                />
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
                  role={role}
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
        )}
        </div>
      </main>

      {/* Redesigned Clean Footer */}
      <footer 
        className={`bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 py-6 mt-auto no-print text-slate-500 dark:text-slate-400 font-light text-xs transition-all duration-300 ${
          role === 'admin' && isAdminLoggedIn ? (isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60') : ''
        }`} 
        id="app-footer"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6">
          {/* Left Side: Logo | Vertical Line | Text aligned left in 3 exact lines */}
          <div className="flex items-center space-x-4 sm:space-x-5 text-left">
            {footerLogoError ? (
              <div 
                className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-500 flex items-center justify-center text-white shadow-xs shrink-0" 
                title="โรงพยาบาลสังขะ SANGKHA HOSPITAL"
                id="footer-fallback-emblem"
              >
                <Microscope size={20} className="text-white" />
              </div>
            ) : (
              <img 
                src={hospitalLogo || DEFAULT_HOSPITAL_LOGO_BASE64} 
                alt="โรงพยาบาลสังขะ SANGKHA HOSPITAL" 
                className="h-10 sm:h-11 w-auto object-contain shrink-0" 
                onError={() => {
                  setFooterLogoError(true);
                }}
              />
            )}
            <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />
            <div className="flex flex-col text-[11px] sm:text-xs font-light leading-relaxed text-slate-500 dark:text-slate-400 text-left">
              <span>© 2026 Medical Technology Department, Sangkha Hospital. All rights reserved.</span>
              <span>Blood Glucose POCT Management System</span>
              <span>Version 2.0.0 • Developed by MT. S. Singsard</span>
            </div>
          </div>

          {/* Right Side: Contact us block with icons */}
          <div className="flex flex-col text-left md:text-right text-[11px] sm:text-xs font-light leading-relaxed text-slate-500 dark:text-slate-400 shrink-0 space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Contact us</span>
            <div className="flex items-center space-x-1.5 md:justify-end">
              <Phone size={13} className="text-slate-400 shrink-0" />
              <span>044-571-028 ต่อ 115</span>
            </div>
            <div className="flex items-center space-x-1.5 md:justify-end">
              <Mail size={13} className="text-slate-400 shrink-0" />
              <span>labsangkha@outlook.com</span>
            </div>
            <div className="flex items-center space-x-1.5 md:justify-end">
              <MapPin size={13} className="text-slate-400 shrink-0" />
              <span>อาคารผู้ป่วยนอก ชั้น 2</span>
            </div>
          </div>
        </div>
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
