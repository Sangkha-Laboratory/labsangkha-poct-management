/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import CustomSelect from "./CustomSelect";
import { DtxMachine, RepairRequest, SupplyRequest, UserManual, Announcement } from '../types';
import { dbService } from '../lib/supabase';
import { DTX_MAINTENANCE_GUIDELINES, DTX_ERROR_CODES, TROUBLESHOOTING_GUIDE } from '../constants/deviceGuide';
import { Wrench, Package, Search, Download, ExternalLink, CheckCircle, Smartphone, AlertCircle, RefreshCw, Eye, BookOpen, Clock, Ban, Droplet, Sparkles, Monitor, Info, AlertTriangle, ShieldAlert, FileText, Check, Award, Lightbulb, Phone, Megaphone, Bell, Calendar, User, FileCheck, Battery, Plus, Minus, Layers } from 'lucide-react';

interface LandingPageProps {
  machines: DtxMachine[];
  repairs: RepairRequest[];
  supplies: SupplyRequest[];
  onAddRepair: (repair: RepairRequest) => void;
  onAddSupply: (supply: SupplyRequest) => void;
  lineNotifyToken: string;
  activeTab?: 'repair' | 'supply' | 'track' | 'guide';
  onActiveTabChange?: (tab: 'repair' | 'supply' | 'track' | 'guide') => void;
  manuals?: UserManual[];
  announcements?: Announcement[];
}

export default function LandingPage({ 
  machines = [], 
  repairs = [], 
  supplies = [], 
  onAddRepair, 
  onAddSupply, 
  lineNotifyToken = '',
  activeTab: controlledActiveTab,
  onActiveTabChange,
  manuals: propManuals = [],
  announcements: propAnnouncements = []
}: LandingPageProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<'repair' | 'supply' | 'track' | 'guide'>('repair');
  
  const [wards, setWards] = useState<{ en_name: string; thai_name: string }[]>([]);

  useEffect(() => {
    dbService.getWards()
      .then(res => setWards(Array.isArray(res) ? res : []))
      .catch(err => {
        console.error('Failed to fetch wards:', err);
        setWards([]);
      });
  }, []);

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = (tab: 'repair' | 'supply' | 'track' | 'guide') => {
    if (onActiveTabChange) {
      onActiveTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  let deletedManualIds: string[] = [];
  let deletedAnnIds: string[] = [];
  try {
    deletedManualIds = JSON.parse(localStorage.getItem('dtx_deleted_manual_ids') || '[]');
    deletedAnnIds = JSON.parse(localStorage.getItem('dtx_deleted_ann_ids') || '[]');
  } catch (e) {}

  const currentManuals = (propManuals || []).filter(m => m && !m.isDeleted && !deletedManualIds.includes(m.id) && !['man1', 'man2', 'man3'].includes(m.id));
  const currentAnnouncements = (propAnnouncements || []).filter(a => a && !a.isDeleted && !deletedAnnIds.includes(a.id) && !['ann-1', 'ann-2'].includes(a.id));
  const featuredAnnouncement = currentAnnouncements.find(a => a.pinned) || currentAnnouncements[0];

  // Repair form states
  const [repairSerial, setRepairSerial] = useState('');
  const [repairMachineSerial, setRepairMachineSerial] = useState('');
  const [customSerial, setCustomSerial] = useState('');
  const [customMachineSerial, setCustomMachineSerial] = useState('');
  const [repairWard, setRepairWard] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reportedProblem, setReportedProblem] = useState('');
  const [needsBackup, setNeedsBackup] = useState(false);
  
  // Supply form states
  const [supplyWard, setSupplyWard] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [supplyItemType, setSupplyItemType] = useState<'machine' | 'strip' | 'lancet' | 'control_solution' | 'battery'>('machine');
  const [supplyQty, setSupplyQty] = useState(1);
  const [supplyReason, setSupplyReason] = useState('');

  // Status tracking states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{ repairs: RepairRequest[]; supplies: SupplyRequest[] } | null>(null);

  // Success states
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [latestSubmittedRepair, setLatestSubmittedRepair] = useState<RepairRequest | null>(null);
  const [latestSubmittedSupply, setLatestSubmittedSupply] = useState<SupplyRequest | null>(null);
  const [showLinePhoneSimulation, setShowLinePhoneSimulation] = useState(false);

  // Guide and troubleshooting states
  const [errorCodeSearch, setErrorCodeSearch] = useState('');
  const [guideSubTab, setGuideSubTab] = useState<'maintenance' | 'errors' | 'documents' | 'announcements'>('maintenance');

  // Auto-fill ward and serial when selecting machine serial number in repair form
  const handleSerialChange = (serial: string) => {
    setRepairSerial(serial);
    if (serial === 'CUSTOM') {
      return;
    }
    const matchedMachine = machines.find(m => m.serialNumber.toLowerCase() === serial.trim().toLowerCase());
    if (matchedMachine) {
      setRepairWard(matchedMachine.ward);
      setRepairMachineSerial(matchedMachine.machineSerial || '');
    }
  };

  const handleRepairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSerial = repairSerial === 'CUSTOM' ? customSerial : repairSerial;
    const finalMachineSerial = repairMachineSerial === 'CUSTOM' ? customMachineSerial : repairMachineSerial;

    if (!finalSerial || !repairWard || !reporterName || !reportedProblem) {
      alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    const newRepairId = `REP-${Math.floor(100 + Math.random() * 900)}`;
    const newRepair: RepairRequest = {
      id: newRepairId,
      serialNumber: finalSerial.toUpperCase().trim(),
      machineSerial: finalMachineSerial ? finalMachineSerial.toUpperCase().trim() : '',
      ward: repairWard,
      reporterName,
      reporterPhone,
      reportedProblem,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      needsBackup,
      checklist: {
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
    };

    onAddRepair(newRepair);
    setLatestSubmittedRepair(newRepair);
    setLatestSubmittedSupply(null);
    
    // Clear form
    setRepairSerial('');
    setRepairMachineSerial('');
    setCustomSerial('');
    setCustomMachineSerial('');
    setReporterName('');
    setReporterPhone('');
    setReportedProblem('');
    setNeedsBackup(false);

    setSuccessMsg(`ส่งคำขอแจ้งซ่อมสำเร็จ! หมายเลขคำขอของคุณคือ: ${newRepairId}`);
    setShowSuccessToast(true);
    setShowLinePhoneSimulation(true);

    // Auto switch to tracking tab with search prefilled
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 5000);
  };

  const handleSupplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplyWard || !requesterName || supplyQty <= 0) {
      alert('กรุณากรอกข้อมูลให้ถูกต้องครบถ้วน');
      return;
    }

    const newSupplyId = `SUP-${Math.floor(100 + Math.random() * 900)}`;
    const newSupply: SupplyRequest = {
      id: newSupplyId,
      ward: supplyWard,
      requesterName,
      itemType: supplyItemType,
      quantity: Number(supplyQty),
      reason: supplyReason,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    };

    onAddSupply(newSupply);
    setLatestSubmittedSupply(newSupply);
    setLatestSubmittedRepair(null);

    // Clear form
    setRequesterName('');
    setSupplyQty(1);
    setSupplyReason('');

    setSuccessMsg(`ส่งคำขอเบิกอุปกรณ์สำเร็จ! หมายเลขคำขอของคุณคือ: ${newSupplyId}`);
    setShowSuccessToast(true);
    setShowLinePhoneSimulation(true);
    
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 5000);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setSearchResult(null);
      return;
    }

    // Filter repairs by Serial Number, Request ID, or Ward
    const matchedRepairs = repairs.filter(r => 
      r.id.toLowerCase().includes(query) || 
      r.serialNumber.toLowerCase().includes(query) ||
      r.ward.toLowerCase().includes(query)
    );

    // Filter supplies by Request ID, Ward, or Requester Name
    const matchedSupplies = supplies.filter(s => 
      s.id.toLowerCase().includes(query) || 
      s.ward.toLowerCase().includes(query) ||
      s.requesterName.toLowerCase().includes(query)
    );

    setSearchResult({ repairs: matchedRepairs, supplies: matchedSupplies });
  };

  const translateItemType = (type: string) => {
    switch (type) {
      case 'machine': return 'เครื่องตรวจน้ำตาล DTX';
      case 'strip': return 'แผ่นทดสอบ (Strips)';
      case 'lancet': return 'เข็มเจาะปลายนิ้ว (Lancets)';
      case 'control_solution': return 'น้ำยาควบคุมคุณภาพ (IQC)';
      case 'battery': return 'ถ่านกระดุม / ถ่าน AAA';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800"><Clock size={12} className="mr-1" />รอดำเนินการ</span>;
      case 'repairing':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800"><RefreshCw size={12} className="mr-1 animate-spin" />กำลังตรวจสอบ/ซ่อม</span>;
      case 'waiting_claim':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-800">รอส่งเคลมบริษัท</span>;
      case 'claimed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800">ส่งเคลมแล้ว</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800"><CheckCircle size={12} className="mr-1" />ซ่อมเสร็จสิ้น/ส่งคืนวอร์ด</span>;
      case 'approved':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800"><CheckCircle size={12} className="mr-1" />อนุมัติจ่ายแล้ว</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800">ปฏิเสธคำขอ</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  // State for active troubleshooting card
  const [openTsId, setOpenTsId] = useState<string | null>(null);

  // Synchronized differential scroll offset (Parallax sync between unequal column heights)
  const [syncScrollOffset, setSyncScrollOffset] = useState(0);

  useEffect(() => {
    const handleSyncScroll = () => {
      if (window.innerWidth < 1024) {
        setSyncScrollOffset(0);
        return;
      }
      const leftCol = document.getElementById('left-form-column');
      const rightCol = document.getElementById('sidebar-right-column');
      const workspace = document.getElementById('landing-workspace');

      if (!leftCol || !rightCol || !workspace) return;

      const leftHeight = leftCol.offsetHeight;
      const rightHeight = rightCol.offsetHeight;
      const heightDiff = rightHeight - leftHeight;

      if (heightDiff > 0) {
        const workspaceRect = workspace.getBoundingClientRect();
        const startY = 80;
        const scrollDistance = Math.max(1, leftHeight - (window.innerHeight - startY));
        const currentProgress = Math.min(1, Math.max(0, (startY - workspaceRect.top) / scrollDistance));

        // Smoothly interpolate the right column offset to match the scroll progress exactly
        setSyncScrollOffset(-(currentProgress * heightDiff));
      } else {
        setSyncScrollOffset(0);
      }
    };

    window.addEventListener('scroll', handleSyncScroll, { passive: true });
    window.addEventListener('resize', handleSyncScroll, { passive: true });
    handleSyncScroll();

    return () => {
      window.removeEventListener('scroll', handleSyncScroll);
      window.removeEventListener('resize', handleSyncScroll);
    };
  }, [activeTab, openTsId]);

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6" id="landing-container">
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 sm:px-5 py-3 sm:py-4 rounded-xl shadow-2xl flex items-start space-x-3 max-w-md animate-bounce" id="success-toast">
          <CheckCircle size={22} className="shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-xs sm:text-sm">ดำเนินการสำเร็จ</h4>
            <p className="text-[11px] sm:text-xs text-emerald-50 mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Hero Welcome Banner - Balanced & Responsive */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs text-slate-800 dark:text-white p-5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border-2 border-sky-200/90 dark:border-sky-800/80 shadow-lg shadow-sky-900/5 relative overflow-hidden animate-fade-in" id="hero-banner">
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-sky-300/20 dark:bg-sky-400/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-80 h-80 bg-indigo-300/20 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 md:flex items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl text-center md:text-left">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              ระบบบริหารจัดการเครื่อง POCT ครบวงจร
            </h1>
            <p className="text-xs sm:text-sm font-bold text-sky-600 dark:text-sky-300">
              ควบคุมคุณภาพได้มาตรฐาน ใช้งานมั่นใจ รายงานสถานะแบบรวดเร็ว
            </p>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed max-w-xl">
              บริการเบิก-คืน ซ่อมบำรุง และควบคุมคุณภาพเครื่องตรวจน้ำตาลปลายนิ้ว (DTX) พร้อมติดตามสถานะงานซ่อมได้ตลอด 24 ชั่วโมง
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1.5 justify-center md:justify-start">
              <button
                type="button"
                onClick={() => { 
                  setActiveTab('repair'); 
                  setTimeout(() => {
                    document.getElementById('landing-workspace')?.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-extrabold px-4.5 sm:px-5 py-2.5 sm:py-3 rounded-xl transition-all shadow-md shadow-sky-600/20 cursor-pointer flex items-center space-x-2"
              >
                <Wrench size={15} />
                <span>เริ่มแจ้งส่งซ่อมเครื่อง</span>
              </button>
              <button
                type="button"
                onClick={() => { 
                  setActiveTab('track'); 
                  setTimeout(() => {
                    document.getElementById('landing-workspace')?.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
                className="bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 text-xs sm:text-sm font-bold px-4.5 sm:px-5 py-2.5 sm:py-3 rounded-xl transition-all border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer flex items-center space-x-2"
              >
                <Search size={15} className="text-sky-600 dark:text-sky-300" />
                <span>ตรวจสอบสถานะล่าสุด</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Announcements & PR Notice Board */}
      {currentAnnouncements.length > 0 && featuredAnnouncement && (
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl border border-sky-700/40 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 animate-fade-in" id="announcements-banner">
          <div className="flex items-start space-x-3">
            <div className="p-2 sm:p-2.5 bg-sky-800/80 text-amber-300 border border-sky-600/40 rounded-xl shrink-0 mt-0.5 shadow-xs">
              <Megaphone size={18} />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-sky-800/80 text-sky-100 border border-sky-600/30 rounded-md">
                  ประกาศ / ประชาสัมพันธ์
                </span>
                {featuredAnnouncement.pinned && (
                  <span className="text-[9.5px] sm:text-[10px] font-extrabold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md shadow-2xs">
                    ปักหมุด
                  </span>
                )}
                <span className="text-[10.5px] sm:text-[11px] font-medium text-sky-200/80">{featuredAnnouncement.date}</span>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white leading-snug">{featuredAnnouncement.title}</h3>
              <p className="text-[11px] sm:text-xs text-sky-100/90 line-clamp-1">{featuredAnnouncement.content}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className="text-xs font-bold text-sky-300 hover:text-white bg-sky-900/60 hover:bg-sky-800 px-3.5 py-1.5 sm:py-2 rounded-xl border border-sky-600/30 transition-all shrink-0 whitespace-nowrap self-end md:self-center cursor-pointer"
          >
            ดูประกาศทั้งหมด ({currentAnnouncements.length}) →
          </button>
        </div>
      )}

      {/* Main Grid Content */}
      <div className={
        (activeTab === 'repair' || activeTab === 'supply')
          ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          : "grid grid-cols-1 gap-6"
      } id="landing-workspace">
        {/* Left Side: Dynamic Forms / Action view */}
        <div 
          id="left-form-column"
          className={
            (activeTab === 'repair' || activeTab === 'supply')
              ? "lg:col-span-8 space-y-6"
              : "space-y-6"
          }
        >

          {/* Form Content 1: Repair Request */}
          {activeTab === 'repair' && (
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-md shadow-slate-200/50 dark:shadow-none space-y-5" id="repair-form-container">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3.5 mb-4">
                <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">กรอกข้อมูลเพื่อส่งเครื่องซ่อมบำรุง</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ระบบจะทำการบันทึกข้อมูลและออกหมายเลขติดตามสถานะให้ท่านอัตโนมัติ</p>
              </div>

              <form onSubmit={handleRepairSubmit} className="space-y-4" id="repair-landing-form">
                {/* ชื่อผู้แจ้ง * */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">ชื่อผู้แจ้ง *</label>
                  <input
                    type="text"
                    placeholder="กรอกชื่อ-นามสกุลผู้แจ้ง เช่น พว. สมใจ จิตดี"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 transition-colors"
                    required
                  />
                </div>

                {/* หน่วยงาน/แผนก * */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">หน่วยงาน/แผนก *</label>
                  <CustomSelect
                    value={repairWard}
                    onChange={(e) => {
                      const ward = e.target.value;
                      setRepairWard(ward);
                      setRepairSerial('');
                      setRepairMachineSerial('');
                      setCustomSerial('');
                      setCustomMachineSerial('');
                    }}
                    className="w-full text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white transition-colors"
                    required
                  >
                    <option value="">เลือกหน่วยงาน/แผนก</option>
                    {(wards || []).map((w, idx) => (
                      <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                    ))}
                  </CustomSelect>
                </div>

                {/* รหัสเครื่อง (Code) * */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">รหัสเครื่อง (Code) *</label>
                  <CustomSelect
                    value={repairSerial}
                    onChange={(e) => {
                      const serial = e.target.value;
                      handleSerialChange(serial);
                    }}
                    className="w-full text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white font-semibold transition-colors"
                    required
                  >
                    <option value="">เลือก Code</option>
                    {repairWard && (machines || []).filter(m => m && m.ward === repairWard).map(m => (
                      <option key={m.id} value={m.serialNumber}>{m.serialNumber} ({m.brand} {m.model})</option>
                    ))}
                    <option value="CUSTOM">-- ระบุรหัสเครื่องเอง (เครื่องนอกระบบ) --</option>
                  </CustomSelect>

                  {repairSerial === 'CUSTOM' && (
                    <input
                      type="text"
                      placeholder="กรอกรหัสเครื่องเอง เช่น BGM-099"
                      value={customSerial}
                      onChange={(e) => setCustomSerial(e.target.value)}
                      className="w-full text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 font-semibold mt-2 transition-colors"
                      required
                    />
                  )}
                </div>

                {/* Serial Number * */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Serial Number *</label>
                  <CustomSelect
                    value={repairMachineSerial}
                    onChange={(e) => {
                      const mSerial = e.target.value;
                      setRepairMachineSerial(mSerial);
                      if (mSerial !== 'CUSTOM' && mSerial !== '') {
                        const matched = (machines || []).find(m => m && m.machineSerial === mSerial);
                        if (matched) {
                          setRepairSerial(matched.serialNumber);
                        }
                      }
                    }}
                    className="w-full text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white font-mono transition-colors"
                    required
                  >
                    <option value="">เลือก Serial</option>
                    {repairWard && (machines || []).filter(m => m && m.ward === repairWard).map(m => (
                      <option key={m.id} value={m.machineSerial}>{m.machineSerial || 'ไม่มี Serial'}</option>
                    ))}
                    <option value="CUSTOM">-- ระบุ Serial Number เอง --</option>
                  </CustomSelect>

                  {repairMachineSerial === 'CUSTOM' && (
                    <input
                      type="text"
                      placeholder="กรอกหมายเลข Serial Number เอง เช่น 311A0012BBD"
                      value={customMachineSerial}
                      onChange={(e) => setCustomMachineSerial(e.target.value)}
                      className="w-full text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 font-mono mt-2 transition-colors"
                      required
                    />
                  )}
                </div>

                {/* รายละเอียด / อาการ */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">รายละเอียด / อาการ</label>
                  <textarea
                    rows={3}
                    placeholder="กรุณาอธิบายอาการชำรุด เช่น เสียบแถบตรวจแล้วไม่อ่านค่า หรือเปิดเครื่องไม่ติด..."
                    value={reportedProblem}
                    onChange={(e) => setReportedProblem(e.target.value)}
                    className="w-full text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 transition-colors"
                    required
                  ></textarea>
                </div>

                {/* ขอเบิกเครื่องสำรองใช้ชั่วคราว */}
                <div className="flex items-start space-x-2.5 py-1">
                  <input
                    type="checkbox"
                    id="needsBackup"
                    checked={needsBackup}
                    onChange={(e) => setNeedsBackup(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 rounded-sm border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <label htmlFor="needsBackup" className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight cursor-pointer">
                    ต้องการขอเบิกเครื่องสำรองใช้ชั่วคราวระหว่างรอซ่อม
                    <span className="block text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">ในกรณีที่หน่วยงานไม่มีเครื่องสำรองใช้งานในตึก</span>
                  </label>
                </div>

                {/* Troubleshooting advice shortcut */}
                <div className="bg-sky-50/50 dark:bg-sky-950/30 p-3.5 rounded-xl border border-sky-100 dark:border-sky-900/40 text-sm text-sky-800 dark:text-sky-300 flex items-start space-x-2.5">
                  <Lightbulb size={18} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-sm text-sky-900 dark:text-sky-200">
                    <span className="font-bold">ตรวจสอบเบื้องต้น:</span> แนะนำให้อ่านหัวข้อ <span className="font-bold underline cursor-pointer hover:text-sky-700" onClick={() => setActiveTab('guide')}>"แนวทางการดูแลเครื่องเบื้องต้น"</span> ด้านขวา เพื่อทดสอบแก้ไขปัญหาก่อนส่ง เพื่อไม่ให้เสียเวลาใช้งานอุปกรณ์ของท่าน
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-sky-600/15 cursor-pointer"
                    id="submit-repair-btn"
                  >
                    <span>ส่งคำร้อง</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Form Content 2: Supply Request */}
          {activeTab === 'supply' && (
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-md shadow-slate-200/50 dark:shadow-none space-y-5" id="supply-form-container">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3.5 mb-4">
                <div className="flex items-center space-x-2 text-sky-600 mb-1">
                  <Package size={22} />
                  <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">ส่งคำขอเบิกเครื่องตรวจน้ำตาล DTX</h2>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  ยื่นคำขอเบิกเครื่องตรวจน้ำตาล DTX เพิ่มเติมสำหรับใช้งานประจำหน่วยงาน/วอร์ด
                </p>
              </div>

              <form onSubmit={handleSupplySubmit} className="space-y-4" id="supply-landing-form">
                {/* Item Type Info Card (Fixed to DTX Machine) */}
                <div className="p-4 rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/60 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-sky-600 text-white rounded-xl shadow-xs">
                      <Monitor size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-sky-950 dark:text-sky-300">รายการที่ขอเบิก</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">เครื่องตรวจน้ำตาล DTX (Blood Glucose Monitor)</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-sky-700 dark:text-sky-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-sky-100 dark:border-sky-800 shadow-2xs">
                    หน่วยนับ: เครื่อง
                  </span>
                </div>

                {/* Requester & Ward Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Requester / ชื่อผู้แจ้ง */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-1">
                      <User size={14} className="text-slate-400" />
                      <span>ชื่อผู้แจ้ง *</span>
                    </label>
                    <input
                      type="text"
                      placeholder="กรอกชื่อ-นามสกุลผู้แจ้ง เช่น พว. สมใจ จิตดี"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      className="w-full text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 transition-colors"
                      required
                    />
                  </div>

                  {/* Ward / หน่วยงาน/แผนก */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-1">
                      <Wrench size={14} className="text-slate-400" />
                      <span>หน่วยงาน/แผนก *</span>
                    </label>
                    <CustomSelect
                      value={supplyWard}
                      onChange={(e) => setSupplyWard(e.target.value)}
                      className="w-full text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white transition-colors"
                      required
                    >
                      <option value="">เลือกหน่วยงาน/แผนก</option>
                      {(wards || []).map((w, idx) => (
                        <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                      ))}
                    </CustomSelect>
                  </div>
                </div>

                {/* Quantity / จำนวนที่ขอเบิก */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <span>จำนวนเครื่องที่ขอเบิก *</span>
                    <span className="text-xs font-normal text-slate-500">
                      (หน่วยนับ: เครื่อง)
                    </span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setSupplyQty(Math.max(1, (supplyQty || 1) - 1))}
                      className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all border border-slate-200 cursor-pointer"
                      title="ลดจำนวน"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="ระบุจำนวน"
                      value={supplyQty || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setSupplyQty(val ? parseInt(val, 10) : 0);
                      }}
                      className="w-full text-center font-bold text-slate-800 text-sm md:text-base p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setSupplyQty((supplyQty || 0) + 1)}
                      className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all border border-slate-200 cursor-pointer"
                      title="เพิ่มจำนวน"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Reason / เหตุผลประกอบการเบิก */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">เหตุผลประกอบการเบิก / อธิบายความจำเป็น (ไม่บังคับ)</label>
                  <textarea
                    rows={3}
                    placeholder="ระบุเหตุผลประกอบการเบิก เช่น เพื่อทดแทนตัวเดิมที่ส่งซ่อม/เคลม หรือเปิดหน่วยงานใหม่..."
                    value={supplyReason}
                    onChange={(e) => setSupplyReason(e.target.value)}
                    className="w-full text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 transition-colors"
                  ></textarea>
                </div>

                {/* Submit Button */}
                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-md shadow-sky-600/15 cursor-pointer"
                    id="submit-supply-btn"
                  >
                    <Package size={18} />
                    <span>ส่งคำขอเบิกเครื่องตรวจน้ำตาล DTX</span>
                  </button>

                  <div className="bg-sky-50/60 dark:bg-sky-950/30 p-3 rounded-xl border border-sky-100 dark:border-sky-900/40 flex items-start space-x-2 text-xs text-sky-800 dark:text-sky-300">
                    <Info size={16} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                    <span>
                      เมื่อยื่นคำขอเรียบร้อยแล้ว ระบบจะส่งการแจ้งเตือนไปยังทีมเจ้าหน้าที่ห้องปฏิบัติการโดยอัตโนมัติ ท่านสามารถติดตามสถานะได้ในแท็บ "ติดตามสถานะ"
                    </span>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Form Content 3: Track Status */}
          {activeTab === 'track' && (
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-md shadow-slate-200/50 dark:shadow-none space-y-6" id="track-status-container">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg md:text-xl font-bold text-slate-800">ติดตามสถานะคำขอและประวัติเครื่อง</h2>
                <p className="text-xs md:text-sm text-slate-400">ระบุรหัสเครื่องตรวจ (เช่น BGM-009) หรือหมายเลขคำขอส่งซ่อม (เช่น REP-748) เพื่อตรวจสอบสถานะ</p>
              </div>

              {/* Search Bar */}
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-3.5 md:top-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="พิมพ์รหัสเครื่อง, เลขส่งซ่อม หรือชื่อตึก/วอร์ด..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs md:text-sm p-3.5 md:p-4 pl-10 md:pl-11 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 font-semibold text-slate-700 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs md:text-sm px-6 rounded-xl transition-all shrink-0 cursor-pointer"
                >
                  ค้นหาคำขอ
                </button>
              </form>

              {/* Search Results Display */}
              {searchResult ? (
                <div className="space-y-6" id="search-results-panel">
                  {/* Repairs Results */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center space-x-1.5">
                      <Wrench size={15} className="text-slate-500 shrink-0" />
                      <span>รายการคำขอส่งซ่อมบำรุง ({(searchResult?.repairs || []).length})</span>
                    </h3>
                    {(searchResult?.repairs || []).length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 bg-slate-50 text-center rounded-lg">ไม่พบข้อมูลการส่งซ่อมที่ตรงกัน</p>
                    ) : (
                      <div className="space-y-3">
                        {(searchResult?.repairs || []).map((rep) => (
                          <div key={rep.id} className="border border-slate-100 rounded-xl p-4 space-y-3 hover:border-slate-200 bg-white transition-all shadow-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-bold text-sky-600">{rep.id}</span>
                                  <span className="text-xs font-semibold text-slate-700">เครื่อง: {rep.serialNumber}</span>
                                  {rep.needsBackup && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                      ต้องการเครื่องสำรอง
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400">ส่งเรื่องเมื่อ: {rep.requestDate} | โดย {rep.reporterName} ({rep.ward})</p>
                              </div>
                              <div>{getStatusBadge(rep.status)}</div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="font-semibold text-slate-500 block text-[10px] uppercase">อาการแจ้งเสีย</span>
                                <p className="text-slate-700 font-medium">{rep.reportedProblem}</p>
                              </div>
                              {rep.diagnosedProblem && (
                                <div className="bg-sky-50/40 p-2.5 rounded-lg border border-sky-50">
                                  <span className="font-bold text-sky-950 block text-[10px]">ผลการตรวจวินิจฉัย/ซ่อม</span>
                                  <p className="text-sky-900 mt-0.5 font-medium">{rep.diagnosedProblem}</p>
                                  {rep.actionTaken && (
                                    <span className="inline-block mt-1.5 text-[9px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                                      การดำเนินการ: {
                                        rep.actionTaken === 'change_battery' ? 'เปลี่ยนถ่าน' :
                                        rep.actionTaken === 'return_original' ? 'ส่งคืนเครื่องเดิม' :
                                        rep.actionTaken === 'provide_new' ? 'จ่ายเครื่องใหม่ทดแทน' : 'เสร็จสิ้นการบำรุงรักษา'
                                      }
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* visual progress track */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                              <div className="flex items-center space-x-1 text-slate-500">
                                <span className="font-semibold">สถานะปัจจุบัน:</span>
                                <span>
                                  {rep.status === 'pending' && 'รอนักเทคนิคการแพทย์รับเครื่อง'}
                                  {rep.status === 'repairing' && 'อยู่ระหว่างวิเคราะห์ขัดข้องและทำ QC'}
                                  {rep.status === 'waiting_claim' && 'ส่งต่อไปยังผู้จัดจำหน่ายเพื่อรอส่งเคลม'}
                                  {rep.status === 'claimed' && 'เครื่องอยู่ระหว่างดำเนินการจัดส่งเคลมและตรวจเช็ค'}
                                  {rep.status === 'completed' && `รับเครื่องคืนเรียบร้อยเมื่อ ${rep.completionDate || '-'}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Supply Results */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center space-x-1.5">
                      <Package size={15} className="text-slate-500 shrink-0" />
                      <span>รายการคำขอเบิกวัสดุ ({(searchResult?.supplies || []).length})</span>
                    </h3>
                    {(searchResult?.supplies || []).length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 bg-slate-50 text-center rounded-lg">ไม่พบข้อมูลการขอเบิกที่ตรงกัน</p>
                    ) : (
                      <div className="space-y-3">
                        {(searchResult?.supplies || []).map((sup) => (
                          <div key={sup.id} className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 bg-white transition-all shadow-xs flex flex-wrap justify-between items-center gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-slate-500">{sup.id}</span>
                                <span className="text-xs font-bold text-slate-800">{translateItemType(sup.itemType)} (x{sup.quantity})</span>
                              </div>
                              <p className="text-[10px] text-slate-400">ขอเบิกโดย {sup.requesterName} ({sup.ward}) เมื่อ {sup.requestDate}</p>
                              <p className="text-xs text-slate-600 font-medium italic">"{sup.reason}"</p>
                            </div>
                            <div className="shrink-0">{getStatusBadge(sup.status)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200" id="search-placeholder">
                  <Search size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-500">พิมพ์ค้นหาด้านบน เพื่อตรวจสอบประวัติและติดตามงาน</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">ลองค้นหาคำว่า "BGM-009" หรือ "ตึกติดเชื้อ" เพื่อดูข้อมูลตัวอย่าง</p>
                </div>
              )}
            </div>
          )}

          {/* Tab Content 4: Guides and Manuals */}
          {activeTab === 'guide' && (
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-md shadow-slate-200/50 dark:shadow-none space-y-6" id="manuals-tab-container">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">ข้อมูลและคู่มือการดูแลรักษาเครื่องตรวจน้ำตาลปลายนิ้ว (DTX)</h2>
                  <p className="text-xs text-slate-400">แนวทางปฏิบัติเพื่อป้องกันความเสียหายและการทำงานที่ถูกต้องของตัวเครื่องตามมาตรฐานโรงพยาบาลสังขะ</p>
                </div>
              </div>

              {/* Guide Sub-Tabs: Spread evenly across full width */}
              <div className="bg-sky-50/80 dark:bg-slate-800 p-1.5 rounded-2xl w-full shadow-2xs border border-sky-100 dark:border-slate-700" id="guide-subtabs-nav">
                <div className="flex flex-col sm:flex-row w-full gap-1 font-bold">
                  <button
                    type="button"
                    onClick={() => setGuideSubTab('maintenance')}
                    className={`flex-1 py-2.5 px-3 text-xs rounded-xl transition-all text-center cursor-pointer whitespace-nowrap ${
                      guideSubTab === 'maintenance'
                        ? 'bg-sky-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <span className="flex items-center justify-center space-x-1.5">
                      <Lightbulb size={14} className="shrink-0" />
                      <span>การดูแลรักษาเครื่อง</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideSubTab('errors')}
                    className={`flex-1 py-2.5 px-3 text-xs rounded-xl transition-all text-center cursor-pointer whitespace-nowrap ${
                      guideSubTab === 'errors'
                        ? 'bg-sky-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <span className="flex items-center justify-center space-x-1.5">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>รหัส Error และวิธีแก้ไข</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideSubTab('documents')}
                    className={`flex-1 py-2.5 px-3 text-xs rounded-xl transition-all text-center cursor-pointer whitespace-nowrap ${
                      guideSubTab === 'documents'
                        ? 'bg-sky-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <span className="flex items-center justify-center space-x-1.5">
                      <FileText size={14} className="shrink-0" />
                      <span>เอกสารคู่มือ PDF</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideSubTab('announcements')}
                    className={`flex-1 py-2.5 px-3 text-xs rounded-xl transition-all text-center cursor-pointer whitespace-nowrap ${
                      guideSubTab === 'announcements'
                        ? 'bg-sky-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <span className="flex items-center justify-center space-x-1.5">
                      <Bell size={14} className="shrink-0" />
                      <span>ข่าวประชาสัมพันธ์</span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Sub-Tab 1: Maintenance Guidelines */}
              {guideSubTab === 'maintenance' && (
                <div className="space-y-4 animate-scale-up" id="subtab-maintenance">
                  <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-2xs flex items-start space-x-3 text-xs">
                    <Info className="text-sky-600 shrink-0 mt-0.5" size={16} />
                    <div className="space-y-1 text-sky-950">
                      <span className="font-bold">คำแนะนำทั่วไปสำหรับการดูแลเครื่องตรวจ (งานชันสูตรสาธารณสุข กลุ่มงานเทคนิคการแพทย์)</span>
                      <p className="text-sky-900 leading-relaxed text-[11px]">เพื่อยืดอายุการใช้งาน ป้องกันผลตรวจคลาดเคลื่อน และความเสียหายรุนแรงต่อแผงวงจรควบคุมอิเล็กทรอนิกส์ กรุณาปฏิบัติตามแนวทางด้านล่างนี้อย่างเคร่งครัด</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {DTX_MAINTENANCE_GUIDELINES.map((guideline, index) => {
                      const getMaintenanceIcon = (icon: string) => {
                        switch (icon) {
                          case 'ban': return <Ban className="text-sky-600" size={18} />;
                          case 'droplet': return <Droplet className="text-sky-600" size={18} />;
                          case 'sparkles': return <Sparkles className="text-sky-600" size={18} />;
                          case 'monitor': return <Monitor className="text-sky-600" size={18} />;
                          case 'refresh': return <RefreshCw className="text-sky-600" size={18} />;
                          default: return <Info className="text-sky-600" size={18} />;
                        }
                      };
                      return (
                        <div key={guideline.id} className="border border-slate-100 p-4.5 rounded-xl bg-white shadow-xs space-y-3 hover:border-sky-100 hover:shadow-sm transition-all flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2.5">
                              <div className="p-2 bg-sky-50 rounded-lg shrink-0">
                                {getMaintenanceIcon(guideline.iconName)}
                              </div>
                              <h4 className="text-xs font-extrabold text-slate-800">{index + 1}. {guideline.title}</h4>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed pl-1">
                              {guideline.description}
                            </p>
                          </div>
                          {guideline.tip && (
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[10px] text-slate-600">
                              <span className="font-bold text-slate-700 flex items-center space-x-1 mb-1">
                                <Lightbulb size={12} className="text-sky-600 shrink-0" />
                                <span>เกร็ดความรู้ / ข้อควรระวัง:</span>
                              </span>
                              {guideline.tip}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="text-center pt-3 text-[10px] text-slate-400 font-medium">
                    งานชันสูตรสาธารณสุข กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลสังขะ
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Error Codes Lookups */}
              {guideSubTab === 'errors' && (
                <div className="space-y-4 animate-scale-up" id="subtab-errors">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                      <input
                        type="text"
                        placeholder="พิมพ์ค้นหารหัสข้อผิดพลาด เช่น E 1, E 5, HI, LO..."
                        value={errorCodeSearch}
                        onChange={(e) => setErrorCodeSearch(e.target.value)}
                        className="w-full text-xs p-2.5 pl-9 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                      />
                    </div>
                    {errorCodeSearch && (
                      <button
                        type="button"
                        onClick={() => setErrorCodeSearch('')}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 self-center px-2"
                      >
                        ล้างค่าค้นหา
                      </button>
                    )}
                  </div>

                  {/* Desktop View Table */}
                  <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                          <th className="p-3 w-28 text-center">รหัสหน้าจอ</th>
                          <th className="p-3 w-1/3">ความหมายของอาการ</th>
                          <th className="p-3">วิธีแก้ไขและคำแนะนำเบื้องต้น</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {DTX_ERROR_CODES.filter(ec => 
                          ec.code.toLowerCase().includes(errorCodeSearch.toLowerCase()) ||
                          ec.meaning.toLowerCase().includes(errorCodeSearch.toLowerCase()) ||
                          ec.solution.toLowerCase().includes(errorCodeSearch.toLowerCase())
                        ).map((ec) => {
                          const getSeverityBadge = (severity: 'warning' | 'error' | 'critical') => {
                            switch (severity) {
                              case 'warning':
                                return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-100">เฝ้าระวัง</span>;
                              case 'error':
                                return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-100">ผิดพลาด</span>;
                              case 'critical':
                                return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-50 text-red-700 border border-red-100">วิกฤต</span>;
                              default:
                                return null;
                            }
                          };
                          return (
                            <tr key={ec.code} className="hover:bg-slate-50/40 transition-colors">
                              <td className="p-4 text-center font-bold bg-slate-50/20">
                                <div className="space-y-1">
                                  <span className="text-sm font-extrabold text-rose-600 block font-mono">{ec.code}</span>
                                  {getSeverityBadge(ec.severity)}
                                </div>
                              </td>
                              <td className="p-4 text-slate-700 font-medium leading-relaxed">
                                {ec.meaning}
                              </td>
                              <td className="p-4">
                                <div className="bg-emerald-50/35 border border-emerald-50/80 p-3 rounded-lg text-[11px] text-slate-700 space-y-1 font-sans">
                                  <div className="font-bold text-emerald-800 flex items-center space-x-1">
                                    <Check size={12} />
                                    <span>วิธีแก้ไขปัญหา:</span>
                                  </div>
                                  <p className="leading-relaxed text-slate-600 font-medium">
                                    {ec.solution}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {DTX_ERROR_CODES.filter(ec => 
                          ec.code.toLowerCase().includes(errorCodeSearch.toLowerCase()) ||
                          ec.meaning.toLowerCase().includes(errorCodeSearch.toLowerCase()) ||
                          ec.solution.toLowerCase().includes(errorCodeSearch.toLowerCase())
                        ).length === 0 && (
                          <tr>
                            <td colSpan={3} className="text-center py-8 text-slate-400 text-xs">
                              ไม่พบคู่มือรหัสข้อผิดพลาดที่คุณค้นหา กรุณาลองใช้คำค้นหาอื่น เช่น "E 1", "E 5", "HI", "LO"
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View - Cards with wrap protection */}
                  <div className="block md:hidden space-y-4">
                    {DTX_ERROR_CODES.filter(ec => 
                      ec.code.toLowerCase().includes(errorCodeSearch.toLowerCase()) ||
                      ec.meaning.toLowerCase().includes(errorCodeSearch.toLowerCase()) ||
                      ec.solution.toLowerCase().includes(errorCodeSearch.toLowerCase())
                    ).map((ec) => {
                      const getSeverityBadge = (severity: 'warning' | 'error' | 'critical') => {
                        switch (severity) {
                          case 'warning':
                            return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-100">เฝ้าระวัง</span>;
                          case 'error':
                            return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-100">ผิดพลาด</span>;
                          case 'critical':
                            return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-50 text-red-700 border border-red-100">วิกฤต</span>;
                          default:
                            return null;
                        }
                      };
                      return (
                        <div key={ec.code} className="bg-white p-4.5 rounded-xl border border-slate-100 space-y-3.5 shadow-2xs">
                          <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-400">รหัสหน้าจอ:</span>
                              <span className="text-base font-extrabold text-rose-600 font-mono tracking-tight leading-none">{ec.code}</span>
                            </div>
                            {getSeverityBadge(ec.severity)}
                          </div>
                          
                          <div className="space-y-1">
                            <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">ความหมายของอาการ:</span>
                            <p className="text-xs font-bold text-slate-700 leading-relaxed break-words">{ec.meaning}</p>
                          </div>

                          <div className="bg-emerald-50/40 border border-emerald-100/50 p-3.5 rounded-lg text-xs space-y-1.5">
                            <span className="font-extrabold text-emerald-800 flex items-center space-x-1 text-[11px]">
                              <Check size={12} className="shrink-0" />
                              <span>วิธีแก้ไขปัญหา:</span>
                            </span>
                            <p className="text-slate-600 leading-relaxed font-medium text-[11px] break-words">{ec.solution}</p>
                          </div>
                        </div>
                      );
                    })}
                    
                    {DTX_ERROR_CODES.filter(ec => 
                      ec.code.toLowerCase().includes(errorCodeSearch.toLowerCase()) ||
                      ec.meaning.toLowerCase().includes(errorCodeSearch.toLowerCase()) ||
                      ec.solution.toLowerCase().includes(errorCodeSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        ไม่พบคู่มือรหัสข้อผิดพลาดที่คุณค้นหา กรุณาลองใช้คำค้นหาอื่น เช่น "E 1", "E 5", "HI", "LO"
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: Documents and Files */}
              {guideSubTab === 'documents' && (
                <div className="animate-scale-up" id="guides-list">
                  {currentManuals.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      ยังไม่มีเอกสารคู่มือในระบบขณะนี้
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentManuals.map((manual) => (
                        <div key={manual.id} className="border border-slate-100 p-4 rounded-xl hover:border-sky-100 hover:bg-sky-50/10 transition-all flex items-start space-x-3.5 bg-white shadow-2xs">
                          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg shrink-0">
                            <Download size={20} />
                          </div>
                          <div className="space-y-1.5 flex-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded-md">
                              {manual.category === 'guide' ? 'เอกสาร PDF' : manual.category === 'video' ? 'วิดีโอสาธิต' : 'แบบฟอร์ม'}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 leading-snug">{manual.title}</h4>
                            <p className="text-[11px] text-slate-500">{manual.description}</p>
                            {manual.fileName && (
                              <div className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-flex items-center space-x-1">
                                <FileCheck size={12} />
                                <span>{manual.fileName}</span>
                              </div>
                            )}
                            <div>
                              {manual.downloadUrl ? (
                                <a
                                  href={manual.downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-bold text-sky-600 hover:text-sky-500 hover:underline pt-1 inline-flex items-center space-x-1"
                                >
                                  <ExternalLink size={13} />
                                  <span>{manual.fileName || 'เปิดลิงก์เอกสารออนไลน์'}</span>
                                </a>
                              ) : manual.fileData ? (
                                <a
                                  href={manual.fileData}
                                  download={manual.fileName || 'manual.pdf'}
                                  className="text-xs font-bold text-sky-600 hover:text-sky-500 hover:underline pt-1 inline-flex items-center space-x-1"
                                >
                                  <Download size={13} />
                                  <span>ดาวน์โหลดเอกสาร ({manual.fileName || 'PDF'})</span>
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => alert(`ดาวน์โหลดเอกสาร: ${manual.title}`)}
                                  className="text-xs font-bold text-sky-600 hover:text-sky-500 hover:underline pt-1 inline-flex items-center space-x-1 cursor-pointer"
                                >
                                  <Download size={13} />
                                  <span>ดาวน์โหลดคู่มือมาตรฐาน (.pdf)</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 4: Announcements & PR */}
              {guideSubTab === 'announcements' && (
                <div className="space-y-4 animate-scale-up" id="announcements-list-view">
                  {currentAnnouncements.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      ยังไม่มีประกาศหรือข่าวประชาสัมพันธ์ในขณะนี้
                    </div>
                  ) : (
                    currentAnnouncements.map((ann) => (
                      <div key={ann.id} className={`border p-4.5 rounded-xl space-y-2 bg-white shadow-2xs ${ann.pinned ? 'border-sky-300 bg-sky-50/15' : 'border-slate-100'}`}>
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${ann.category === 'alert' ? 'bg-rose-50 text-rose-700' : ann.category === 'event' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
                            {ann.category === 'alert' ? 'ประกาศด่วน' : ann.category === 'event' ? 'กิจกรรม' : 'ข่าวสาร'}
                          </span>
                          {ann.pinned && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white">
                              ปักหมุด
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                            <Calendar size={11} />
                            <span>{ann.date}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                            <User size={11} />
                            <span>{ann.author}</span>
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">{ann.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{ann.content}</p>
                        {ann.attachmentUrl && (
                          <div className="pt-2">
                            <a
                              href={ann.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-sky-600 hover:underline inline-flex items-center space-x-1 bg-sky-50 px-3 py-1.5 rounded-lg"
                            >
                              <ExternalLink size={13} />
                              <span>{ann.attachmentName || 'เปิดลิงก์เอกสารแนบ'}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: POCT Contact & Troubleshooting Guide (Harmoniously Scaled) */}
        {(activeTab === 'repair' || activeTab === 'supply') && (
          <div 
            className="lg:col-span-4 space-y-6 lg:sticky lg:top-6 self-start transition-transform duration-150 ease-out" 
            id="sidebar-right-column"
            style={{
              transform: syncScrollOffset !== 0 ? `translate3d(0, ${syncScrollOffset}px, 0)` : undefined
            }}
          >
            {/* Card 1: POCT Lab Contact & Status */}
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-md shadow-slate-200/50 dark:shadow-none space-y-4" id="poct-contact-card">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base md:text-lg flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <span>สถานะห้องปฏิบัติการ POCT</span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลสังขะ</p>
              </div>

              <div className="space-y-3.5 text-sm">
                {/* Operating Hours */}
                <div className="bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-2xl border border-sky-100 dark:border-sky-900/40 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2.5">
                  <p className="font-bold text-sky-900 dark:text-sky-300 flex items-center space-x-2 text-sm">
                    <Clock size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>เวลาทำการตรวจสอบและจัดส่ง:</span>
                  </p>
                  <ul className="space-y-2 text-slate-600 dark:text-slate-300 text-sm pl-1">
                    <li className="flex items-start space-x-2">
                      <span className="text-sky-500 font-bold">•</span>
                      <span><strong>วันทำการปกติ:</strong> 08:00 น. - 16:00 น.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-sky-500 font-bold shrink-0">•</span>
                      <span><strong>นอกเวลาราชการ:</strong> สามารถส่งคำขอผ่านระบบและนำส่งเครื่องที่งานชันสูตรได้ตลอด 24 ชั่วโมง ทั้งนี้ สามารถรับเครื่องคืนได้ในวันและเวลาราชการ</span>
                    </li>
                  </ul>
                </div>

                {/* Staff Contact Information */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 space-y-2.5">
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2 text-sm">
                    <Phone size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>ช่องทางติดต่อเจ้าหน้าที่:</span>
                  </p>
                  <ul className="space-y-2 text-slate-600 dark:text-slate-300 text-sm pl-1">
                    <li className="flex items-start space-x-2">
                      <span className="text-slate-400 font-bold">•</span>
                      <span>เบอร์โทรภายใน: <strong className="text-slate-800 dark:text-slate-200 font-semibold">กด 115</strong></span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-slate-400 font-bold">•</span>
                      <span>ผู้ประสานงานหลัก: <strong className="text-slate-800 dark:text-slate-200 font-medium">ทนพญ.สมิตา สิงห์สาด</strong></span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-slate-400 font-bold">•</span>
                      <span>หัวหน้างานชันสูตร: <strong className="text-slate-800 dark:text-slate-200 font-medium">ทนพ.ไพศาล มุมทอง</strong></span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Card 2: Troubleshooting & Maintenance Guide Accordion */}
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-md shadow-slate-200/50 dark:shadow-none space-y-4" id="interactive-troubleshoot-panel">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base md:text-lg flex items-center space-x-2">
                  <BookOpen size={18} className="text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>แนวทางการดูแลเครื่องเบื้องต้น</span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ตรวจสอบและแก้ไขด่วนได้ทันทีเพื่อลดการส่งซ่อม</p>
              </div>

              {/* Minimal Clean Accordion Container */}
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scroll-smooth" id="troubleshoot-accordion">
                {DTX_MAINTENANCE_GUIDELINES.map((ts, index) => {
                  const isOpen = openTsId === ts.id;
                  return (
                    <div 
                      key={ts.id} 
                      className={`rounded-xl transition-all duration-200 border ${
                        isOpen 
                          ? 'border-sky-200 dark:border-sky-900/60 bg-sky-50/30 dark:bg-sky-950/20 shadow-xs' 
                          : 'border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenTsId(isOpen ? null : ts.id)}
                        className="w-full p-3.5 text-left flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center space-x-2.5 pr-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            isOpen 
                              ? 'bg-sky-500 text-white' 
                              : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                            {ts.title}
                          </span>
                        </div>
                        <span className="text-slate-400 text-xs shrink-0 font-bold">{isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div className="p-4 pt-1 bg-transparent space-y-3 text-sm">
                          {/* Description */}
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">แนวทางปฏิบัติ:</span>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                              {ts.description}
                            </p>
                          </div>
                          {/* Tip / Solution */}
                          {ts.tip && (
                            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-300 space-y-1">
                              <span className="text-xs font-bold flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-300">
                                <Lightbulb size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>ข้อแนะนำพิเศษ:</span>
                              </span>
                              <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
                                {ts.tip}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('guide');
                    setGuideSubTab('errors');
                  }}
                  className="text-sm font-bold text-sky-600 dark:text-sky-400 hover:text-sky-500 hover:underline cursor-pointer flex items-center justify-center space-x-1.5 mx-auto py-1"
                >
                  <Search size={15} />
                  <span>ค้นหารหัสข้อผิดพลาดบนหน้าจอ (Error Codes) →</span>
                </button>
              </div>
            </div>

            {/* Section: Line Notification Simulation Phone */}
            {showLinePhoneSimulation && (latestSubmittedRepair || latestSubmittedSupply) && (
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4 animate-fade-in" id="line-notify-sim">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Smartphone size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">จำลองการแจ้งเตือน LINE</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLinePhoneSimulation(false)}
                    className="text-slate-400 hover:text-white text-[10px] bg-slate-800 px-2 py-0.5 rounded"
                  >
                    ปิดจำลอง
                  </button>
                </div>

                <div className="bg-slate-800 p-3.5 rounded-xl border border-slate-700 relative text-slate-300 space-y-3 font-sans" id="line-phone-message">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-extrabold text-white">L</div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold text-slate-100 block">LINE Notify</span>
                      <span className="text-[8px] text-slate-400 block">เมื่อสักครู่</span>
                    </div>
                  </div>
                  
                  {latestSubmittedRepair ? (
                    <div className="bg-[#1e293b] p-3 rounded-lg border border-slate-700/50 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 border-b border-slate-700/60 pb-1">
                        <span>แจ้งซ่อมเครื่อง DTX ด่วน!</span>
                        <span className="text-[9px] bg-emerald-950/50 text-emerald-400 border border-emerald-900 px-1 py-0.5 rounded">{latestSubmittedRepair.id}</span>
                      </div>
                      <div className="space-y-1 font-mono text-[10px] text-slate-300 leading-snug">
                        <p><span className="text-slate-400">รหัสเครื่อง:</span> <span className="text-sky-400 font-bold">{latestSubmittedRepair.serialNumber}</span></p>
                        <p><span className="text-slate-400">หน่วยงาน:</span> {latestSubmittedRepair.ward}</p>
                        <p><span className="text-slate-400">อาการเสีย:</span> <span className="text-amber-400">{latestSubmittedRepair.reportedProblem}</span></p>
                        <p><span className="text-slate-400">เครื่องสำรอง:</span> <span className={latestSubmittedRepair.needsBackup ? "text-amber-400 font-bold" : "text-slate-450"}>{latestSubmittedRepair.needsBackup ? "✓ ต้องการ" : "✗ ไม่ต้องการ"}</span></p>
                        <p><span className="text-slate-400">ผู้แจ้งซ่อม:</span> {latestSubmittedRepair.reporterName}</p>
                        <p><span className="text-slate-400">สถานะ:</span> <span className="text-amber-500 font-bold">● รอดำเนินการ (Pending)</span></p>
                      </div>
                      <div className="pt-1.5 border-t border-slate-700/60 text-[8px] text-slate-400">
                        * ข้อความจะถูกส่งไปกลุ่มผู้รับผิดชอบงานตรวจวิเคราะห์ POCT
                      </div>
                    </div>
                  ) : latestSubmittedSupply ? (
                    <div className="bg-[#1e293b] p-3 rounded-lg border border-slate-700/50 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 border-b border-slate-700/60 pb-1">
                        <span>คำขอเบิกเครื่องตรวจ DTX!</span>
                        <span className="text-[9px] bg-emerald-950/50 text-emerald-400 border border-emerald-900 px-1 py-0.5 rounded">{latestSubmittedSupply.id}</span>
                      </div>
                      <div className="space-y-1 font-mono text-[10px] text-slate-300 leading-snug">
                        <p><span className="text-slate-400">รายการ:</span> <span className="text-sky-400 font-bold">{translateItemType(latestSubmittedSupply.itemType)}</span></p>
                        <p><span className="text-slate-400">จำนวนที่ขอเบิก:</span> <span className="text-emerald-400 font-bold">{latestSubmittedSupply.quantity} เครื่อง</span></p>
                        <p><span className="text-slate-400">หน่วยงาน:</span> {latestSubmittedSupply.ward}</p>
                        <p><span className="text-slate-400">ผู้ขอเบิก:</span> {latestSubmittedSupply.requesterName}</p>
                        {latestSubmittedSupply.reason && (
                          <p><span className="text-slate-400">เหตุผล:</span> <span className="text-slate-300">{latestSubmittedSupply.reason}</span></p>
                        )}
                        <p><span className="text-slate-400">สถานะ:</span> <span className="text-amber-500 font-bold">● รอดำเนินการ (Pending)</span></p>
                      </div>
                      <div className="pt-1.5 border-t border-slate-700/60 text-[8px] text-slate-400">
                        * ข้อความส่งตรงถึงแผนกคลังพัสดุและเจ้าหน้าที่ห้อง Lab POCT
                      </div>
                    </div>
                  ) : null}
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed text-center">
                  {lineNotifyToken ? (
                    <span className="text-emerald-400">✓ มีการเชื่อมต่อกับ Token จริงในฝั่งแอดมินแล้ว</span>
                  ) : (
                    <span>* สามารถนำ LINE Notify Token ใส่ในฝั่งแอดมิน เพื่อส่งแจ้งเตือนเข้าแชทกลุ่มไลน์จริงได้ทันที</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
