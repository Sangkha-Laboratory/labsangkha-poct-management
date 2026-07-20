/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DtxMachine, RepairRequest, SupplyRequest, QcRecord, QcLotConfig, EqaRecord } from './types';
import {
  INITIAL_MACHINES,
  INITIAL_LOT_CONFIGS,
  INITIAL_QC_RECORDS,
  INITIAL_REPAIRS,
  INITIAL_SUPPLIES,
  INITIAL_EQA_RECORDS
} from './mockData';

// Component Imports
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import StockManagement from './components/StockManagement';
import QCManagement from './components/QCManagement';
import RepairManagement from './components/RepairManagement';
import EQAManagement from './components/EQAManagement';
import LineNotifyConfig from './components/LineNotifyConfig';

import { Activity, ShieldCheck, User, ShieldAlert, Wrench, Package, BarChart2, Layers, Smartphone, Database, Lock, Unlock, Menu, X, ChevronDown, Home, LogIn, LogOut, Search, BookOpen, ArrowLeft, Microscope, Lightbulb } from 'lucide-react';

export default function App() {
  // Global States loaded from localStorage or fallback to initial mocks
  const [machines, setMachines] = useState<DtxMachine[]>(() => {
    const saved = localStorage.getItem('dtx_machines');
    return saved ? JSON.parse(saved) : INITIAL_MACHINES;
  });

  const [repairs, setRepairs] = useState<RepairRequest[]>(() => {
    const saved = localStorage.getItem('dtx_repairs');
    return saved ? JSON.parse(saved) : INITIAL_REPAIRS;
  });

  const [supplies, setSupplies] = useState<SupplyRequest[]>(() => {
    const saved = localStorage.getItem('dtx_supplies');
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIES;
  });

  const [qcRecords, setQcRecords] = useState<QcRecord[]>(() => {
    const saved = localStorage.getItem('dtx_qc_records');
    return saved ? JSON.parse(saved) : INITIAL_QC_RECORDS;
  });

  const [lotConfigs, setLotConfigs] = useState<QcLotConfig[]>(() => {
    const saved = localStorage.getItem('dtx_lot_configs');
    return saved ? JSON.parse(saved) : INITIAL_LOT_CONFIGS;
  });

  const [eqaRecords, setEqaRecords] = useState<EqaRecord[]>(() => {
    const saved = localStorage.getItem('dtx_eqa_records');
    return saved ? JSON.parse(saved) : INITIAL_EQA_RECORDS;
  });

  const [lineNotifyToken, setLineNotifyToken] = useState<string>(() => {
    return localStorage.getItem('dtx_line_token') || '';
  });

  // Navigation Roles & Active Tab inside Admin & User
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [activeUserTab, setActiveUserTab] = useState<'repair' | 'supply' | 'track' | 'guide'>('repair');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'stock' | 'qc' | 'repair' | 'eqa' | 'line'>('dashboard');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showTimeoutNotice, setShowTimeoutNotice] = useState(false);

  // Night Mode State
  const [isNightMode, setIsNightMode] = useState<boolean>(() => {
    return localStorage.getItem('dtx_night_mode') === 'true';
  });
  const [showToast, setShowToast] = useState<string>('');

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const toggleNightMode = () => {
    const nextVal = !isNightMode;
    setIsNightMode(nextVal);
    localStorage.setItem('dtx_night_mode', String(nextVal));
    setShowToast(nextVal 
      ? 'เปิดใช้งานโหมดถนอมสายตาเวรดึก (Night Shift Mode) เรียบร้อย' 
      : 'กลับสู่โหมดหน้าจอปกติความสว่างมาตรฐาน'
    );
  };

  // Sliding 30-Minute Session Timeout for Admin Portal
  useEffect(() => {
    if (!isAdminLoggedIn) return;

    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setIsAdminLoggedIn(false);
        setAdminPassword('');
        setShowTimeoutNotice(true);
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

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('dtx_machines', JSON.stringify(machines));
  }, [machines]);

  useEffect(() => {
    localStorage.setItem('dtx_repairs', JSON.stringify(repairs));
  }, [repairs]);

  useEffect(() => {
    localStorage.setItem('dtx_supplies', JSON.stringify(supplies));
  }, [supplies]);

  useEffect(() => {
    localStorage.setItem('dtx_qc_records', JSON.stringify(qcRecords));
  }, [qcRecords]);

  useEffect(() => {
    localStorage.setItem('dtx_lot_configs', JSON.stringify(lotConfigs));
  }, [lotConfigs]);

  useEffect(() => {
    localStorage.setItem('dtx_eqa_records', JSON.stringify(eqaRecords));
  }, [eqaRecords]);

  useEffect(() => {
    localStorage.setItem('dtx_line_token', lineNotifyToken);
  }, [lineNotifyToken]);

  // Handlers for data updates passed to children
  const handleAddRepair = (newRepair: RepairRequest) => {
    setRepairs(prev => [newRepair, ...prev]);
  };

  const handleAddSupply = (newSupply: SupplyRequest) => {
    setSupplies(prev => [newSupply, ...prev]);
  };

  const handleUpdateRepair = (updatedRepair: RepairRequest) => {
    setRepairs(prev => prev.map(r => r.id === updatedRepair.id ? updatedRepair : r));
    
    // If completed, update lastQCDate in corresponding machine
    if (updatedRepair.status === 'completed') {
      setMachines(prev => prev.map(m => {
        if (m.serialNumber === updatedRepair.serialNumber) {
          return { ...m, status: 'active', lastQCDate: new Date().toISOString().split('T')[0] };
        }
        return m;
      }));
    } else if (updatedRepair.status === 'waiting_claim') {
      setMachines(prev => prev.map(m => {
        if (m.serialNumber === updatedRepair.serialNumber) {
          return { ...m, status: 'waiting_claim' };
        }
        return m;
      }));
    } else if (updatedRepair.status === 'claimed') {
      setMachines(prev => prev.map(m => {
        if (m.serialNumber === updatedRepair.serialNumber) {
          return { ...m, status: 'claimed' };
        }
        return m;
      }));
    }
  };

  const handleAddMachine = (newMachine: DtxMachine) => {
    setMachines(prev => [...prev, newMachine]);
  };

  const handleUpdateMachine = (updatedMachine: DtxMachine) => {
    setMachines(prev => prev.map(m => m.id === updatedMachine.id ? updatedMachine : m));
  };

  const handleDeleteMachine = (id: string) => {
    setMachines(prev => prev.filter(m => m.id !== id));
  };

  const handleAddQcRecord = (newRecord: QcRecord) => {
    setQcRecords(prev => [newRecord, ...prev]);
    // Also update machine's lastQCDate and active status if normal
    setMachines(prev => prev.map(m => {
      if (m.serialNumber === newRecord.serialNumber) {
        return {
          ...m,
          lastQCDate: newRecord.date,
          status: (newRecord.level1Status === 'normal' && newRecord.level2Status === 'normal' && newRecord.level3Status === 'normal') ? 'active' : m.status
        };
      }
      return m;
    }));
  };

  const handleUpdateLotConfigs = (newConfigs: QcLotConfig[]) => {
    setLotConfigs(newConfigs);
  };

  const handleAddEqaRecord = (newEqa: EqaRecord) => {
    setEqaRecords(prev => [newEqa, ...prev]);
  };

  return (
    <div 
      className="min-h-screen bg-slate-50/50 flex flex-col font-sans transition-all duration-300 relative" 
      style={isNightMode ? { filter: 'sepia(0.24) brightness(0.92) contrast(0.96)' } : undefined}
      id="app-root"
    >
      {/* Top Main Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs no-print relative" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div onClick={() => { setRole('user'); setActiveUserTab('repair'); }} className="flex items-center gap-2 sm:gap-2.5 cursor-pointer">
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
              <div className="flex items-center space-x-2 mr-2 bg-emerald-50 text-emerald-800 px-4 py-2 rounded-xl border border-emerald-100/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs md:text-xs font-bold tracking-wide">ห้องปฏิบัติการผู้ดูแลระบบ (Admin)</span>
              </div>
            )}

            {/* Template Decorative Icons */}
            <div className="flex items-center space-x-2 border-l border-slate-200 pl-4 h-8">
              <button 
                onClick={toggleNightMode}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isNightMode ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                title={isNightMode ? "ปิดโหมดถนอมสายตา" : "เปิดโหมดถนอมสายตาเวรดึก"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              </button>
              <button 
                onClick={() => {
                  if (role === 'admin') {
                    setRole('user');
                  } else {
                    setRole('admin');
                    if (!isAdminLoggedIn) {
                      setShowToast('🔑 กรุณาเข้าสู่ระบบด้วยรหัสผ่านแอดมิน (lab1234)');
                    }
                  }
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors animate-fade-in ${role === 'admin' ? 'bg-sky-600 text-white shadow-md shadow-sky-500/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                title={role === 'admin' ? "กลับสู่หน้าหลักแจ้งซ่อม/เบิก" : "เข้าสู่ระบบผู้ดูแลระบบ (Admin Login)"}
              >
                <User size={14} />
              </button>
            </div>
          </div>

          {/* Mobile Navigation Icons */}
          <div className="flex md:hidden items-center space-x-2.5">
            <button 
              onClick={toggleNightMode}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isNightMode ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}
              title="โหมดมืด"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            </button>
            <button 
              onClick={() => {
                setRole('admin');
                setIsMobileMenuOpen(false);
                if (!isAdminLoggedIn) {
                  setShowToast('🔑 กรุณาเข้าสู่ระบบด้วยรหัสผ่านแอดมิน (lab1234)');
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
          />
        ) : !isAdminLoggedIn ? (
          // ADMIN LOGIN FORM
          <div className="max-w-md mx-auto space-y-4 mt-8">
            <button
              type="button"
              onClick={() => setRole('user')}
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
            {/* Admin Header with Mobile-friendly Logout */}
            <div className="bg-gradient-to-r from-sky-50 to-blue-50/50 p-4 rounded-2xl border border-sky-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-sky-600 text-white rounded-xl shadow-xs">
                  <Unlock size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800">แผงควบคุมระบบแอดมิน (Admin Panel)</h2>
                  <p className="text-[10px] text-slate-500 font-medium font-sans">เข้าสู่ระบบสำเร็จ • เซสชันผู้ใช้งาน 30 นาที (Auto Timeout)</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setRole('user');
                  }}
                  className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-2xs border border-slate-200 cursor-pointer"
                  id="admin-back-top-btn"
                >
                  <ArrowLeft size={13} className="text-sky-600" />
                  <span>กลับสู่หน้าหลัก (Staff View)</span>
                </button>
                <button
                  onClick={() => {
                    setIsAdminLoggedIn(false);
                    setAdminPassword('');
                  }}
                  className="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-2xs border border-rose-100 cursor-pointer"
                  id="admin-logout-top-btn"
                >
                  <Lock size={13} />
                  <span>ออกจากระบบ (Logout)</span>
                </button>
              </div>
            </div>

            <div className="space-y-6" id="admin-workspace">
              {/* Admin Navigation: Clean plain text horizontal tabs on PC, Dropdown on Mobile */}
              <div className="bg-white border-b border-slate-200 px-4 rounded-2xl shadow-3xs no-print" id="admin-tabs-nav">
                {/* PC View: Underlined Plain Text Tabs (Benchmarks / Tasks style) */}
                <div className="hidden md:flex space-x-6 overflow-x-auto scrollbar-none h-14 items-end">
                  {[
                    { id: 'dashboard', label: 'สรุปภาพรวม' },
                    { id: 'stock', label: 'คลังเครื่องมือ' },
                    { id: 'qc', label: 'วิเคราะห์คุณภาพ (QC 3 Level)' },
                    { id: 'repair', label: 'งานซ่อมบำรุง' },
                    { id: 'eqa', label: 'ประเมินภายนอก (EQA)' },
                    { id: 'line', label: 'ตั้งค่าแจ้งเตือน LINE' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveAdminTab(tab.id as any)}
                      className={`h-14 flex items-center px-1 text-sm font-semibold border-b-2 transition-all duration-250 cursor-pointer whitespace-nowrap ${
                        activeAdminTab === tab.id
                          ? 'border-sky-600 text-sky-600 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
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
                    <select
                      value={activeAdminTab}
                      onChange={(e) => setActiveAdminTab(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2.5 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 pr-10"
                    >
                      <option value="dashboard">สรุปภาพรวม (Dashboard)</option>
                      <option value="stock">คลังเครื่องมือ (DTX Stock)</option>
                      <option value="qc">วิเคราะห์คุณภาพ (QC 3 Level)</option>
                      <option value="repair">งานแจ้งซ่อม & วินิจฉัย</option>
                      <option value="eqa">ประเมินภายนอก (EQA)</option>
                      <option value="line">ตั้งค่าแจ้งเตือน LINE</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                      <ChevronDown size={14} />
                    </div>
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
              {activeAdminTab === 'qc' && (
                <QCManagement
                  machines={machines}
                  qcRecords={qcRecords}
                  lotConfigs={lotConfigs}
                  onAddQcRecord={handleAddQcRecord}
                  onUpdateLotConfigs={handleUpdateLotConfigs}
                />
              )}
              {activeAdminTab === 'repair' && (
                <RepairManagement
                  repairs={repairs}
                  onUpdateRepair={handleUpdateRepair}
                  lineNotifyToken={lineNotifyToken}
                />
              )}
              {activeAdminTab === 'eqa' && (
                <EQAManagement
                  eqaRecords={eqaRecords}
                  onAddEqaRecord={handleAddEqaRecord}
                />
              )}
              {activeAdminTab === 'line' && (
                <LineNotifyConfig
                  token={lineNotifyToken}
                  onUpdateToken={setLineNotifyToken}
                  repairs={repairs}
                  onUpdateRepair={handleUpdateRepair}
                />
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
        <p className="text-slate-400">Version 2.0.0 • Developed by MT.S. S. Singsard</p>
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
