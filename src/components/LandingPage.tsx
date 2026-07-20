/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DtxMachine, RepairRequest, SupplyRequest } from '../types';
import { INITIAL_WARDS, TROUBLESHOOTING_GUIDE, MANUALS_LIST, DTX_MAINTENANCE_GUIDELINES, DTX_ERROR_CODES } from '../mockData';
import { Wrench, Package, Search, Download, CheckCircle, Smartphone, AlertCircle, RefreshCw, Eye, BookOpen, Clock, Ban, Droplet, Sparkles, Monitor, Info, AlertTriangle, ShieldAlert, FileText, Check, Award, Lightbulb, Phone } from 'lucide-react';

interface LandingPageProps {
  machines: DtxMachine[];
  repairs: RepairRequest[];
  supplies: SupplyRequest[];
  onAddRepair: (repair: RepairRequest) => void;
  onAddSupply: (supply: SupplyRequest) => void;
  lineNotifyToken: string;
  activeTab?: 'repair' | 'supply' | 'track' | 'guide';
  onActiveTabChange?: (tab: 'repair' | 'supply' | 'track' | 'guide') => void;
}

export default function LandingPage({ 
  machines, 
  repairs, 
  supplies, 
  onAddRepair, 
  onAddSupply, 
  lineNotifyToken,
  activeTab: controlledActiveTab,
  onActiveTabChange
}: LandingPageProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<'repair' | 'supply' | 'track' | 'guide'>('repair');

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = (tab: 'repair' | 'supply' | 'track' | 'guide') => {
    if (onActiveTabChange) {
      onActiveTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

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
  const [showLinePhoneSimulation, setShowLinePhoneSimulation] = useState(false);

  // Guide and troubleshooting states
  const [errorCodeSearch, setErrorCodeSearch] = useState('');
  const [guideSubTab, setGuideSubTab] = useState<'maintenance' | 'errors' | 'documents'>('maintenance');

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
    if (!supplyWard || !requesterName || !supplyReason || supplyQty <= 0) {
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

    // Clear form
    setRequesterName('');
    setSupplyQty(1);
    setSupplyReason('');

    setSuccessMsg(`ส่งคำขอเบิกอุปกรณ์สำเร็จ! หมายเลขคำขอของคุณคือ: ${newSupplyId}`);
    setShowSuccessToast(true);
    
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

  return (
    <div className="max-w-6xl mx-auto space-y-8" id="landing-container">
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-4 rounded-xl shadow-2xl flex items-start space-x-3 max-w-md animate-bounce" id="success-toast">
          <CheckCircle size={24} className="shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">ดำเนินการสำเร็จ</h4>
            <p className="text-xs text-emerald-50 mt-1">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Hero Welcome */}
      <div className="bg-gradient-to-br from-slate-50 via-sky-50/40 to-white text-slate-800 p-8 md:p-12 rounded-3xl border border-slate-100 shadow-2xs text-center md:text-left relative overflow-hidden animate-fade-in" id="hero-banner">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-300/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 md:flex items-center justify-between">
          <div className="space-y-4 max-w-xl">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              บริหารจัดการเครื่อง POCT ครบวงจร
            </h1>
            <p className="text-base md:text-lg font-bold text-sky-600">
              ควบคุมคุณภาพได้มาตรฐาน วอร์ดใช้งานมั่นใจ
            </p>
            <p className="text-slate-500 text-xs md:text-xs leading-relaxed max-w-lg">
              บริการส่งซ่อมเครื่องตรวจน้ำตาลปลายนิ้ว (DTX) เบิกแผ่นตรวจ-อุปกรณ์ ตรวจสอบค่าน้ำยาควบคุมคุณภาพ (IQC 3 Level) ของล็อต VivaChek Fad และติดตามสถานะได้ทันที
            </p>
            <div className="flex flex-wrap gap-2.5 pt-2 justify-center md:justify-start">
              <button
                onClick={() => { 
                  setActiveTab('repair'); 
                  setTimeout(() => {
                    document.getElementById('landing-workspace')?.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
                className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all shadow-md shadow-sky-500/15 cursor-pointer"
              >
                เริ่มแจ้งส่งซ่อมเครื่อง
              </button>
              <button
                onClick={() => { 
                  setActiveTab('track'); 
                  setTimeout(() => {
                    document.getElementById('landing-workspace')?.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
                className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-6 py-2.5 rounded-full transition-all border border-slate-200 shadow-3xs cursor-pointer"
              >
                ตรวจสอบสถานะล่าสุด
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className={
        (activeTab === 'repair' || activeTab === 'supply')
          ? "grid grid-cols-1 lg:grid-cols-3 gap-8"
          : "grid grid-cols-1 gap-8"
      } id="landing-workspace">
        {/* Left Side: Dynamic Forms / Action view */}
        <div className={
          (activeTab === 'repair' || activeTab === 'supply')
            ? "lg:col-span-2 space-y-6"
            : "space-y-6"
        }>

          {/* Form Content 1: Repair Request */}
          {activeTab === 'repair' && (
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm" id="repair-form-container">
              <div className="border-b border-slate-100 pb-4 mb-5">
                <h2 className="text-lg md:text-xl font-bold text-slate-800">กรอกข้อมูลเพื่อส่งเครื่องซ่อมบำรุง</h2>
                <p className="text-xs md:text-sm text-slate-400">ระบบจะทำการจัดบันทึกข้อมูลและแปลงข้อมูลเป็นเอกสารรายงาน เพื่อให้ท่านปริ้นใช้งานภายหลังได้</p>
              </div>

              <form onSubmit={handleRepairSubmit} className="space-y-4" id="repair-landing-form">
                {/* ชื่อผู้แจ้ง * */}
                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold text-slate-700">ชื่อผู้แจ้ง *</label>
                  <input
                    type="text"
                    placeholder="กรอกชื่อ-นามสกุลผู้แจ้ง เช่น พว. สมใจ จิตดี"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full text-xs md:text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 transition-colors"
                    required
                  />
                </div>

                {/* หน่วยงาน/แผนก * */}
                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold text-slate-700">หน่วยงาน/แผนก *</label>
                  <select
                    value={repairWard}
                    onChange={(e) => {
                      const ward = e.target.value;
                      setRepairWard(ward);
                      setRepairSerial('');
                      setRepairMachineSerial('');
                      setCustomSerial('');
                      setCustomMachineSerial('');
                    }}
                    className="w-full text-xs md:text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white transition-colors"
                    required
                  >
                    <option value="">เลือกหน่วยงาน/แผนก</option>
                    {INITIAL_WARDS.map((w, idx) => (
                      <option key={idx} value={w}>{w}</option>
                    ))}
                  </select>
                </div>

                {/* รหัสเครื่อง (Code) * */}
                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold text-slate-700">รหัสเครื่อง (Code) *</label>
                  <select
                    value={repairSerial}
                    onChange={(e) => {
                      const serial = e.target.value;
                      handleSerialChange(serial);
                    }}
                    className="w-full text-xs md:text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white font-semibold transition-colors"
                    required
                  >
                    <option value="">เลือก Code</option>
                    {repairWard && machines.filter(m => m.ward === repairWard).map(m => (
                      <option key={m.id} value={m.serialNumber}>{m.serialNumber} ({m.brand} {m.model})</option>
                    ))}
                    <option value="CUSTOM">-- ระบุรหัสเครื่องเอง (เครื่องนอกระบบ) --</option>
                  </select>

                  {repairSerial === 'CUSTOM' && (
                    <input
                      type="text"
                      placeholder="กรอกรหัสเครื่องเอง เช่น BGM-099"
                      value={customSerial}
                      onChange={(e) => setCustomSerial(e.target.value)}
                      className="w-full text-xs md:text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 font-semibold mt-2 transition-colors"
                      required
                    />
                  )}
                </div>

                {/* Serial Number * */}
                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold text-slate-700">Serial Number *</label>
                  <select
                    value={repairMachineSerial}
                    onChange={(e) => {
                      const mSerial = e.target.value;
                      setRepairMachineSerial(mSerial);
                      if (mSerial !== 'CUSTOM' && mSerial !== '') {
                        const matched = machines.find(m => m.machineSerial === mSerial);
                        if (matched) {
                          setRepairSerial(matched.serialNumber);
                        }
                      }
                    }}
                    className="w-full text-xs md:text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white font-mono transition-colors"
                    required
                  >
                    <option value="">เลือก Serial</option>
                    {repairWard && machines.filter(m => m.ward === repairWard).map(m => (
                      <option key={m.id} value={m.machineSerial}>{m.machineSerial || 'ไม่มี Serial'}</option>
                    ))}
                    <option value="CUSTOM">-- ระบุ Serial Number เอง --</option>
                  </select>

                  {repairMachineSerial === 'CUSTOM' && (
                    <input
                      type="text"
                      placeholder="กรอกหมายเลข Serial Number เอง เช่น 311A0012BBD"
                      value={customMachineSerial}
                      onChange={(e) => setCustomMachineSerial(e.target.value)}
                      className="w-full text-xs md:text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 font-mono mt-2 transition-colors"
                      required
                    />
                  )}
                </div>

                {/* รายละเอียด / อาการ */}
                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold text-slate-700">รายละเอียด / อาการ</label>
                  <textarea
                    rows={3}
                    placeholder="กรุณาอธิบายอาการชำรุด เช่น เสียบแถบตรวจแล้วไม่อ่านค่า หรือเปิดเครื่องไม่ติด..."
                    value={reportedProblem}
                    onChange={(e) => setReportedProblem(e.target.value)}
                    className="w-full text-xs md:text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 transition-colors"
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
                  <label htmlFor="needsBackup" className="text-xs font-bold text-slate-700 leading-tight cursor-pointer">
                    ต้องการขอเบิกเครื่องสำรองใช้ชั่วคราวระหว่างรอซ่อม
                    <span className="block text-[10px] text-slate-400 font-normal mt-0.5">ในกรณีที่หน่วยงานไม่มีเครื่องสำรองใช้งานในตึก</span>
                  </label>
                </div>

                {/* Troubleshooting advice shortcut */}
                <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-50/80 text-xs text-sky-800 flex items-start space-x-2.5">
                  <Lightbulb size={16} className="text-sky-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[11px] md:text-xs text-sky-900">
                    <span className="font-bold">ตรวจสอบเบื้องต้น:</span> แนะนำให้ท่านเลื่อนอ่านหัวข้อ <span className="font-bold underline cursor-pointer" onClick={() => setActiveTab('guide')}>"แนวทางการดูแลและเช็คเครื่องเบื้องต้น"</span> ด้านขวา เพื่อทดลองทดสอบขจัดปัญหาก่อนส่ง เพื่อไม่ให้เสียเวลาใช้งานอุปกรณ์ของท่าน
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-sky-600/15"
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
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm" id="supply-form-container">
              <div className="border-b border-slate-100 pb-4 mb-5">
                <h2 className="text-lg md:text-xl font-bold text-slate-800">ส่งคำขอเบิกอุปกรณ์และวัสดุ DTX</h2>
              </div>

              <form onSubmit={handleSupplySubmit} className="space-y-4" id="supply-landing-form">
                {/* Requester / ชื่อผู้แจ้ง */}
                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold text-slate-700">ชื่อผู้แจ้ง *</label>
                  <input
                    type="text"
                    placeholder="กรอกชื่อ-นามสกุลผู้แจ้ง เช่น พว. สมใจ จิตดี"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="w-full text-xs md:text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 transition-colors"
                    required
                  />
                </div>

                {/* Ward / หน่วยงาน/แผนก */}
                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold text-slate-700">หน่วยงาน/แผนก *</label>
                  <select
                    value={supplyWard}
                    onChange={(e) => setSupplyWard(e.target.value)}
                    className="w-full text-xs md:text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white transition-colors"
                    required
                  >
                    <option value="">เลือกหน่วยงาน/แผนก</option>
                    {INITIAL_WARDS.map((w, idx) => (
                      <option key={idx} value={w}>{w}</option>
                    ))}
                  </select>
                </div>

                {/* Quantity / จำนวนที่ขอเบิก */}
                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold text-slate-700">จำนวนที่ขอเบิก *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="ระบุจำนวนเฉพาะตัวเลข"
                    value={supplyQty || ''}
                    onChange={(e) => {
                      // Only allow digits
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setSupplyQty(val ? parseInt(val, 10) : 0);
                    }}
                    className="w-full text-xs md:text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 transition-colors"
                    required
                  />
                </div>

                {/* Reason / เหตุผลประกอบการเบิก */}
                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold text-slate-700">เหตุผลประกอบการเบิก / อธิบายความจำเป็น *</label>
                  <textarea
                    rows={3}
                    placeholder="ระบุเหตุผลประกอบการเบิก เช่น เพื่อทดแทนตัวเดิมที่ส่งเคลม หรือ แถบวัดเดิมหมดสต็อกก่อนสิ้นเดือน..."
                    value={supplyReason}
                    onChange={(e) => setSupplyReason(e.target.value)}
                    className="w-full text-xs md:text-sm p-3 md:p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 transition-colors"
                    required
                  ></textarea>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-sky-600/15 cursor-pointer"
                    id="submit-supply-btn"
                  >
                    <span>ส่งคำร้อง</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Form Content 3: Track Status */}
          {activeTab === 'track' && (
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6" id="track-status-container">
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
                      <span>รายการคำขอส่งซ่อมบำรุง ({searchResult.repairs.length})</span>
                    </h3>
                    {searchResult.repairs.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 bg-slate-50 text-center rounded-lg">ไม่พบข้อมูลการส่งซ่อมที่ตรงกัน</p>
                    ) : (
                      <div className="space-y-3">
                        {searchResult.repairs.map((rep) => (
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
                      <span>รายการคำขอเบิกวัสดุ ({searchResult.supplies.length})</span>
                    </h3>
                    {searchResult.supplies.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 bg-slate-50 text-center rounded-lg">ไม่พบข้อมูลการขอเบิกที่ตรงกัน</p>
                    ) : (
                      <div className="space-y-3">
                        {searchResult.supplies.map((sup) => (
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
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6" id="manuals-tab-container">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">ข้อมูลและคู่มือการดูแลรักษาเครื่องตรวจน้ำตาลปลายนิ้ว (DTX)</h2>
                  <p className="text-xs text-slate-400">แนวทางปฏิบัติเพื่อป้องกันความเสียหายและการทำงานที่ถูกต้องของตัวเครื่องตามมาตรฐานโรงพยาบาลสังขะ</p>
                </div>
              </div>

              {/* Guide Sub-Tabs */}
              <div className="flex bg-slate-100/80 p-1 rounded-xl w-full max-w-lg font-bold shadow-xs">
                <button
                  type="button"
                  onClick={() => setGuideSubTab('maintenance')}
                  className={`flex-1 py-2 text-xs rounded-lg transition-all text-center ${guideSubTab === 'maintenance' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  <span className="flex items-center justify-center space-x-1">
                    <Lightbulb size={13} className="shrink-0" />
                    <span>การดูแลรักษาเครื่อง</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setGuideSubTab('errors')}
                  className={`flex-1 py-2 text-xs rounded-lg transition-all text-center ${guideSubTab === 'errors' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  <span className="flex items-center justify-center space-x-1">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>รหัส Error และวิธีแก้ไข</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setGuideSubTab('documents')}
                  className={`flex-1 py-2 text-xs rounded-lg transition-all text-center ${guideSubTab === 'documents' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  📄 เอกสารคู่มือ PDF
                </button>
              </div>

              {/* Sub-Tab 1: Maintenance Guidelines */}
              {guideSubTab === 'maintenance' && (
                <div className="space-y-4 animate-scale-up" id="subtab-maintenance">
                  <div className="bg-sky-50/40 border border-sky-100 p-4 rounded-xl flex items-start space-x-3 text-xs">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-scale-up" id="guides-list">
                  {MANUALS_LIST.map((manual) => (
                    <div key={manual.id} className="border border-slate-100 p-4 rounded-xl hover:border-sky-100 hover:bg-sky-50/10 transition-all flex items-start space-x-3.5">
                      <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg shrink-0">
                        <Download size={20} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded-md">
                          {manual.category === 'guide' ? 'เอกสาร PDF' : 'วิดีโอสาธิต'}
                        </span>
                        <h4 className="text-xs font-bold text-slate-800 leading-snug">{manual.title}</h4>
                        <p className="text-[11px] text-slate-500">{manual.description}</p>
                        <button className="text-xs font-bold text-sky-600 hover:text-sky-500 hover:underline pt-2 inline-flex items-center space-x-0.5">
                          <span>ดาวน์โหลด (.pdf)</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: POCT Contact & LINE Simulation */}
        {(activeTab === 'repair' || activeTab === 'supply') && (
          <div className="space-y-6">
            {/* Section: POCT Lab Contact & Status */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4" id="poct-contact-card">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-xs md:text-sm flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <span>สถานะห้องปฏิบัติการ POCT</span>
                </h3>
                <p className="text-[10px] text-slate-400">กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลสังขะ</p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-sky-50/40 p-3 rounded-xl border border-sky-100 text-slate-600 leading-relaxed text-[11px] space-y-1">
                  <p className="font-bold text-sky-800 flex items-center space-x-1.5 mb-1.5">
                    <Clock size={14} className="text-sky-600 shrink-0" />
                    <span>เวลาทำการตรวจสอบและจัดส่ง:</span>
                  </p>
                  <p>• วันทำการปกติ: 08:00 น. - 16:00 น.</p>
                  <p>• นอกเวลาราชการ: สามารถส่งคำขอผ่านระบบและนำส่งเครื่องที่งานชันสูตรได้ตลอด 24 ชั่วโมง ทั้งนี้ สามารถรับเครื่องคืนได้ในวันและเวลาราชการ</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1.5">
                  <p className="font-bold text-slate-700 flex items-center space-x-1.5 mb-1.5">
                    <Phone size={14} className="text-sky-600 shrink-0" />
                    <span>ช่องทางติดต่อเจ้าหน้าที่:</span>
                  </p>
                  <p>• เบอร์ติดต่อภายในห้อง Lab: <span className="font-mono font-bold text-slate-800">กด 115</span></p>
                  <p>• ผู้ประสานงานหลัก: <span className="font-bold text-slate-700">ทนพญ.สมิตา สิงห์สาด</span></p>
                  <p>• หัวหน้างานชันสูตร: <span className="font-bold text-slate-700">ทนพ. ไพศาล มุมทอง</span></p>
                </div>
              </div>
            </div>

            {/* Section: Troubleshooting Guide Accordion */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4" id="interactive-troubleshoot-panel">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-xs md:text-sm flex items-center space-x-1.5">
                  <BookOpen size={16} className="text-sky-600" />
                  <span>แนวทางการดูแลเครื่องเบื้องต้น</span>
                </h3>
                <p className="text-[11px] text-slate-400">ตรวจสอบอาการง่าย ๆ ด้วยตัวคุณเองเพื่อลดการส่งซ่อมซ้ำซ้อน</p>
              </div>

              <div className="space-y-2.5" id="troubleshoot-accordion">
                {TROUBLESHOOTING_GUIDE.map((ts) => {
                  const isOpen = openTsId === ts.id;
                  return (
                    <div key={ts.id} className="border border-slate-100 rounded-xl overflow-hidden transition-all bg-slate-50/40">
                      <button
                        type="button"
                        onClick={() => setOpenTsId(isOpen ? null : ts.id)}
                        className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-xs font-bold text-slate-700 leading-tight">{ts.problem}</span>
                        <span className="text-slate-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div className="p-4 bg-white border-t border-slate-100 space-y-3 animate-fade-in text-xs">
                          {/* Symptoms */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-rose-600 block">อาการติดขัดที่พบบ่อย:</span>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-500 text-[11px]">
                              {ts.symptoms.map((s, idx) => (
                                <li key={idx}>{s}</li>
                              ))}
                            </ul>
                          </div>
                          {/* Solution */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-emerald-600 block">วิธีแก้ไขเบื้องต้น:</span>
                            <p className="text-slate-700 leading-relaxed text-[11px] whitespace-pre-line bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-50 font-medium">
                              {ts.solution}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section: Line Notification Simulation Phone */}
            {showLinePhoneSimulation && latestSubmittedRepair && (
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
                  
                  <div className="bg-[#1e293b] p-3 rounded-lg border border-slate-700/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 border-b border-slate-700/60 pb-1">
                      <span>🔔 แจ้งซ่อมเครื่อง DTX ด่วน!</span>
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
