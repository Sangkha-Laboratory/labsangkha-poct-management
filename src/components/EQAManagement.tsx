/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import CustomSelect from "./CustomSelect";
import { EqaRecord, EqaAttachment, DtxMachine } from '../types';
import { dbService } from '../lib/supabase';
import { 
  Plus, CheckCircle, Shield, Award, AlertTriangle, MessageSquare, 
  FileText, ExternalLink, Eye, Upload, Calendar, Building2, Clock, 
  FolderKanban, CheckSquare, Search, Filter, X, Trash2, Edit3, Image as ImageIcon,
  Sparkles, Link2, Smartphone, Send, Laptop, Hash, Check, BellRing
} from 'lucide-react';
import { formatToThaiDate } from '../lib/dateUtils';

interface EQAManagementProps {
  machines?: DtxMachine[];
  eqaRecords: EqaRecord[];
  onAddEqaRecord: (record: EqaRecord) => void;
}

const COMMON_ORGANIZERS = [
  'ศูนย์ประเมินคุณภาพ คณะแพทยศาสตร์ โรงพยาบาลรามาธิบดี',
  'สภาเทคนิคการแพทย์ ร่วมกับ กรมวิทยาศาสตร์การแพทย์',
  'ศูนย์ประเมินผลควบคุมคุณภาพทางห้องปฏิบัติการ จุฬาลงกรณ์มหาวิทยาลัย',
  'ศูนย์บริหารจัดการคุณภาพการตรวจวิเคราะห์ คณะเทคนิคการแพทย์ มหาวิทยาลัยมหิดล',
  'ศูนย์วิทยาศาสตร์การแพทย์ (กรมวิทยาศาสตร์การแพทย์)',
];

export default function EQAManagement({ machines = [], eqaRecords, onAddEqaRecord }: EQAManagementProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    url?: string;
    attachment?: EqaAttachment;
    round: string;
    organizer?: string;
  } | null>(null);

  // Form States
  const [organizer, setOrganizer] = useState('');
  const [round, setRound] = useState('');
  const [actionStatus, setActionStatus] = useState<EqaRecord['actionStatus']>('in_progress');
  const [actionDate, setActionDate] = useState(new Date().toISOString().split('T')[0]);
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Machine Count & Tested Machines (SN + Ward + Optional Level Values)
  const [machineCount, setMachineCount] = useState<number>(1);
  const [testedMachines, setTestedMachines] = useState<{
    serialNumber: string;
    ward: string;
    level1Value?: string | number;
    level1Target?: string | number;
    level2Value?: string | number;
    level2Target?: string | number;
    level3Value?: string | number;
    level3Target?: string | number;
  }[]>([]);
  const [customSerialInput, setCustomSerialInput] = useState('');
  const [customWardInput, setCustomWardInput] = useState('');
  const [wards, setWards] = useState<{ en_name: string; thai_name: string }[]>([]);

  // Submission Due Date
  const [dueDate, setDueDate] = useState<string>(() => {
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 14); // 14 days from today
    return defaultDue.toISOString().split('T')[0];
  });

  useEffect(() => {
    dbService.getWards()
      .then(setWards)
      .catch(err => console.error('Failed to fetch wards:', err));
  }, []);
  
  // EQA Level Values & Targets
  const [l1Val, setL1Val] = useState('');
  const [l1Target, setL1Target] = useState('');
  const [l2Val, setL2Val] = useState('');
  const [l2Target, setL2Target] = useState('');
  const [l3Val, setL3Val] = useState('');
  const [l3Target, setL3Target] = useState('');
  const [feedback, setFeedback] = useState('');

  // OneDrive & File Preview Attachment
  const [documentUrl, setDocumentUrl] = useState('');
  const [attachment, setAttachment] = useState<EqaAttachment | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Toggle Machine (SN + Ward) selection
  const handleToggleMachine = (m: { serialNumber: string; ward: string }) => {
    const exists = testedMachines.some(item => item.serialNumber === m.serialNumber);
    if (exists) {
      const updated = testedMachines.filter(item => item.serialNumber !== m.serialNumber);
      setTestedMachines(updated);
      setMachineCount(updated.length || 1);
    } else {
      const updated = [...testedMachines, { serialNumber: m.serialNumber, ward: m.ward }];
      setTestedMachines(updated);
      setMachineCount(updated.length);
    }
  };

  // Add custom SN & Ward
  const handleAddCustomMachine = () => {
    const sn = customSerialInput.trim().toUpperCase();
    const ward = customWardInput.trim();
    if (!sn) {
      alert('กรุณากรอก Serial Number (SN)');
      return;
    }
    if (testedMachines.some(item => item.serialNumber === sn)) {
      alert('Serial Number นี้มีในรายการแล้ว');
      return;
    }
    const updated = [...testedMachines, { serialNumber: sn, ward: ward || 'หน่วยงานทั่วไป' }];
    setTestedMachines(updated);
    setMachineCount(updated.length);
    setCustomSerialInput('');
    setCustomWardInput('');
  };

  // Remove machine by SN
  const handleRemoveMachine = (sn: string) => {
    const updated = testedMachines.filter(item => item.serialNumber !== sn);
    setTestedMachines(updated);
    setMachineCount(updated.length || 1);
  };

  // Select all machines from system
  const handleSelectAllMachines = () => {
    const all = machines.map(m => ({ serialNumber: m.serialNumber, ward: m.ward }));
    setTestedMachines(all);
    setMachineCount(all.length || 1);
  };

  // Calculate days remaining before due date
  const getDaysLeft = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // LINE Notification Trigger for EQA Deadline Alert
  const handleSendLineReminder = (rec: EqaRecord) => {
    const daysLeft = getDaysLeft(rec.dueDate);
    let deadlineStatusText = 'ยังไม่ได้กำหนด';
    if (daysLeft !== null) {
      if (daysLeft < 0) deadlineStatusText = `เกินกำหนดส่งแล้ว ${Math.abs(daysLeft)} วัน!`;
      else if (daysLeft === 0) deadlineStatusText = 'ครบกำหนดส่งวันนี้!';
      else deadlineStatusText = `เหลือเวลาอีก ${daysLeft} วัน`;
    }

    const machinesInfo = rec.testedMachines?.length 
      ? rec.testedMachines.map(m => `SN: ${m.serialNumber} (${m.ward})`).join(', ')
      : rec.testedSerials?.length ? rec.testedSerials.join(', ') : 'ไม่ได้ระบุ';

    const messageText = 
      `🔔 [แจ้งเตือน EQA ใกล้ครบกำหนดส่ง]\n` +
      `• โครงการ: ${rec.organizer || '-'}\n` +
      `• รอบการประเมิน: ${rec.round}\n` +
      `• จำนวนเครื่องที่ทำ: ${rec.machineCount || rec.testedMachines?.length || rec.testedSerials?.length || 1} เครื่อง\n` +
      `• รายการเครื่อง & Ward: ${machinesInfo}\n` +
      `• วันกำหนดส่งผล: ${rec.dueDate ? formatToThaiDate(rec.dueDate) : '-'} (${deadlineStatusText})\n` +
      `• สถานะปัจจุบัน: ${rec.actionStatus === 'pending' ? 'รอดำเนินการ' : rec.actionStatus === 'in_progress' ? 'กำลังทดสอบ' : rec.actionStatus === 'submitted' ? 'ส่งผลแล้ว' : 'เสร็จสิ้น'}\n\n` +
      `กรุณาเร่งรัดบันทึกผลและจัดส่งรายงานให้หน่วยงานประเมินตามกำหนดค่ะ`;

    // Check line token
    const token = localStorage.getItem('dtx_line_token') || 'demo_token';
    console.log('Sending LINE Notification:', { token, messageText });
    
    showToast(`📲 ส่งการแจ้งเตือน LINE เตือนกำหนดส่ง EQA รอบ "${rec.round}" ให้ผู้เกี่ยวข้องเรียบร้อยแล้ว!`);
  };

  // File Upload Handler (Image / PDF)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileType = file.type.includes('image') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'other';
    
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: fileType,
        dataUrl: reader.result as string
      });
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!round || !organizer) {
      alert('กรุณากรอกหน่วยงานที่จัดโครงการ และรอบการประเมิน');
      return;
    }

    let score: number | undefined = undefined;
    let status: EqaRecord['status'] = 'pass';

    // Calculate score if levels are provided
    if (l1Val && l1Target && l2Val && l2Target && l3Val && l3Target) {
      const val1 = Number(l1Val);
      const tar1 = Number(l1Target);
      const val2 = Number(l2Val);
      const tar2 = Number(l2Target);
      const val3 = Number(l3Val);
      const tar3 = Number(l3Target);

      const dev1 = Math.abs((val1 - tar1) / (tar1 || 1));
      const dev2 = Math.abs((val2 - tar2) / (tar2 || 1));
      const dev3 = Math.abs((val3 - tar3) / (tar3 || 1));
      const avgDev = (dev1 + dev2 + dev3) / 3;

      score = Math.max(0, Math.round((1 - avgDev) * 1000) / 10);
      
      if (score >= 95) status = 'excellent';
      else if (score >= 90) status = 'pass';
      else if (score >= 80) status = 'warning';
      else status = 'fail';
    } else if (actionStatus === 'pending' || actionStatus === 'in_progress') {
      status = 'pending';
    }

    const newRecord: EqaRecord = {
      id: `EQA-${Date.now()}`,
      organizer: organizer.trim(),
      round: round.trim(),
      actionStatus,
      actionDate,
      testDate,
      dueDate: dueDate || undefined,
      machineCount: machineCount || (testedMachines.length > 0 ? testedMachines.length : 1),
      testedMachines: testedMachines.length > 0 ? testedMachines.map(m => ({
        serialNumber: m.serialNumber,
        ward: m.ward,
        level1Value: m.level1Value ? Number(m.level1Value) : undefined,
        level1Target: m.level1Target ? Number(m.level1Target) : undefined,
        level2Value: m.level2Value ? Number(m.level2Value) : undefined,
        level2Target: m.level2Target ? Number(m.level2Target) : undefined,
        level3Value: m.level3Value ? Number(m.level3Value) : undefined,
        level3Target: m.level3Target ? Number(m.level3Target) : undefined,
      })) : undefined,
      testedSerials: testedMachines.length > 0 ? testedMachines.map(m => m.serialNumber) : undefined,
      level1Value: l1Val ? Number(l1Val) : undefined,
      level1Target: l1Target ? Number(l1Target) : undefined,
      level2Value: l2Val ? Number(l2Val) : undefined,
      level2Target: l2Target ? Number(l2Target) : undefined,
      level3Value: l3Val ? Number(l3Val) : undefined,
      level3Target: l3Target ? Number(l3Target) : undefined,
      score,
      status,
      feedback: feedback.trim() || (actionStatus === 'completed' ? 'ผลลัพธ์ผ่านเกณฑ์เปรียบเทียบใน POCT' : 'อยู่ระหว่างดำเนินการทดสอบ EQA'),
      documentUrl: documentUrl.trim() || undefined,
      attachmentFile: attachment
    };

    onAddEqaRecord(newRecord);
    setShowAddForm(false);
    showToast('บันทึกข้อมูลและรอบการประเมิน EQA เรียบร้อยแล้ว');
    
    // Clear Form
    setOrganizer('');
    setRound('');
    setActionStatus('in_progress');
    setActionDate(new Date().toISOString().split('T')[0]);
    setTestDate(new Date().toISOString().split('T')[0]);
    setTestedMachines([]);
    setCustomSerialInput('');
    setCustomWardInput('');
    setMachineCount(1);
    setL1Val('');
    setL1Target('');
    setL2Val('');
    setL2Target('');
    setL3Val('');
    setL3Target('');
    setFeedback('');
    setDocumentUrl('');
    setAttachment(undefined);
  };

  const getActionStatusBadge = (s?: EqaRecord['actionStatus']) => {
    switch (s) {
      case 'pending':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center w-max shadow-2xs">
            <Clock size={12} className="mr-1 animate-pulse" /> รอดำเนินการ (Pending)
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 flex items-center w-max shadow-2xs">
            <FolderKanban size={12} className="mr-1 animate-spin" /> กำลังทดสอบ/วิเคราะห์ (In Progress)
          </span>
        );
      case 'submitted':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center w-max shadow-2xs">
            <CheckSquare size={12} className="mr-1" /> ส่งผลแล้ว (Submitted)
          </span>
        );
      case 'completed':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center w-max shadow-2xs">
            <CheckCircle size={12} className="mr-1" /> ประเมินผลเสร็จสิ้น (Completed)
          </span>
        );
    }
  };

  const getGradeStatusBadge = (s?: string) => {
    switch (s) {
      case 'excellent':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center w-max"><Award size={12} className="mr-1" /> ผ่านเกณฑ์ดีเยี่ยม (Excellent)</span>;
      case 'pass':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 flex items-center w-max"><CheckCircle size={12} className="mr-1" /> ผ่านเกณฑ์มาตรฐาน (Pass)</span>;
      case 'warning':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center w-max"><AlertTriangle size={12} className="mr-1" /> พึงเฝ้าระวัง (Warning)</span>;
      case 'fail':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 flex items-center w-max"><AlertTriangle size={12} className="mr-1" /> ต่ำกว่าเกณฑ์มาตรฐาน (Fail)</span>;
      case 'pending':
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 flex items-center w-max"><Clock size={12} className="mr-1" /> รอผลประเมิน</span>;
    }
  };

  // Filter & Search Logic
  const filteredRecords = eqaRecords.filter((rec) => {
    const matchesSearch = 
      (rec.round || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.organizer || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.feedback || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && (rec.actionStatus === statusFilter || (statusFilter === 'completed' && !rec.actionStatus));
  });

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 relative" id="eqa-management-panel">
      {/* Toast Notification Alert */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-3 text-xs animate-bounce no-print">
          <Smartphone size={18} className="text-emerald-400 shrink-0" />
          <span className="font-bold">{toastMsg}</span>
          <button type="button" onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white ml-2">
            <X size={14} />
          </button>
        </div>
      )}
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <Shield size={22} className="text-sky-600" />
            <span>การประเมินคุณภาพจากภายนอก (EQA POCT Assessment & Report)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ติดตามโครงการ EQA บันทึกรอบการประเมิน ผลการตรวจสอบ และรายงานผลพร้อมลิงก์จัดเก็บ OneDrive & ภาพพรีวิวหน้าเว็บ
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all shadow-md shadow-sky-600/20 shrink-0"
        >
          <Plus size={15} />
          <span>เพิ่มโครงการ/รอบ EQA ใหม่</span>
        </button>
      </div>

      {/* Info Notice Box: OneDrive & File Preview */}
      <div className="bg-gradient-to-r from-sky-50 via-slate-50 to-indigo-50/50 p-4 rounded-xl border border-sky-100 text-xs text-slate-700 flex items-start space-x-3">
        <Sparkles size={18} className="text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-800">การจัดเก็บไฟล์รายงานผลบน OneDrive และแสดงภาพพรีวิวบนหน้าเว็บ</p>
          <p className="text-[11.5px] text-slate-600 leading-relaxed">
            ท่านสามารถใส่ <span className="font-bold text-sky-800">ลิงก์แชร์ OneDrive</span> ในช่องเอกสารเพื่อให้ไฟล์ถูกจัดเก็บบน Cloud Storage ขององค์กรอย่างปลอดภัย และยังสามารถ <span className="font-bold text-sky-800">แนบไฟล์รูปภาพ หรือ PDF</span> ในช่องไฟล์แนบ เพื่อให้ผู้ใช้งานท่านอื่นเปิดดูรูปภาพและเอกสารรายงานผลบนหน้าเว็บได้ทันทีโดยไม่ต้องดาวน์โหลด
          </p>
        </div>
      </div>

      {/* Add / Edit EQA Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-5 animate-scale-up" id="eqa-form">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center space-x-2">
              <FolderKanban size={18} className="text-sky-600" />
              <h3 className="text-xs font-extrabold text-slate-800">บันทึกข้อมูลและรายงานผล EQA รอบใหม่</h3>
            </div>
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)} 
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* 1. Organizer */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="font-bold text-slate-700 flex items-center space-x-1">
                <Building2 size={14} className="text-sky-600" />
                <span>1. หน่วยงานที่จัดโครงการ (Organizer / Institution) *</span>
              </label>
              <input
                type="text"
                list="organizer-suggestions"
                placeholder="ระบุชื่อหน่วยงาน เช่น ศูนย์ประเมินคุณภาพ คณะแพทยศาสตร์ โรงพยาบาลรามาธิบดี"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500 font-medium"
                required
              />
              <datalist id="organizer-suggestions">
                {COMMON_ORGANIZERS.map((org, i) => (
                  <option key={i} value={org} />
                ))}
              </datalist>
            </div>

            {/* 2. Round */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center space-x-1">
                <FolderKanban size={14} className="text-sky-600" />
                <span>2. รอบการประเมิน (Evaluation Round/Cycle) *</span>
              </label>
              <input
                type="text"
                placeholder="เช่น รอบที่ 1/2569 หรือ EQA Cycle 2/2026"
                value={round}
                onChange={(e) => setRound(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500 font-medium"
                required
              />
            </div>

            {/* 3. Action Status */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center space-x-1">
                <Clock size={14} className="text-sky-600" />
                <span>3. สถานะการดำเนินการ (Action Status) *</span>
              </label>
              <CustomSelect
                value={actionStatus}
                onChange={(e) => setActionStatus(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500 font-bold text-slate-700"
              >
                <option value="pending">รอดำเนินการ (Pending)</option>
                <option value="in_progress">กำลังทดสอบ/วิเคราะห์ (In Progress)</option>
                <option value="submitted">ส่งผลแล้ว / รอใบรายงาน (Submitted)</option>
                <option value="completed">ประเมินผลเสร็จสิ้น (Completed)</option>
              </CustomSelect>
            </div>

            {/* 4. Dates */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center space-x-1">
                <Calendar size={14} className="text-sky-600" />
                <span>4. วันที่ดำเนินการ (Action Date) *</span>
              </label>
              <input
                type="date"
                value={actionDate}
                onChange={(e) => setActionDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center space-x-1">
                <Calendar size={14} className="text-sky-600" />
                <span>5. วันที่ส่งผลวิเคราะห์ (Test/Submission Date) *</span>
              </label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500"
                required
              />
            </div>

            {/* 6. Submission Due Date */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 flex items-center space-x-1">
                <BellRing size={14} className="text-amber-600" />
                <span>6. วันกำหนดส่งผลการประเมิน (Submission Deadline) *</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-amber-300 bg-amber-50/50 focus:outline-hidden focus:border-amber-500 font-bold text-slate-800"
                required
              />
              <p className="text-[10px] text-amber-700 font-medium">* ระบบจะสามารถส่งการแจ้งเตือน LINE เตือนผู้เกี่ยวข้องเมื่อใกล้ครบกำหนดส่ง</p>
            </div>

            {/* 7. Machine Count & Serial Numbers / Wards */}
            <div className="md:col-span-2 bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <Laptop size={15} className="text-sky-600" />
                  <span>7. จำนวนเครื่องและระบุ Serial Number (SN) พร้อมหน่วยงาน (Ward) เครื่องที่ทดสอบ EQA</span>
                </label>
                <div className="flex items-center space-x-2">
                </div>
              </div>

              {/* Serial & Ward Selection / Custom Add */}
              <div className="space-y-3 text-xs">
                <p className="text-[11px] text-slate-500 font-medium">
                  คลิกเลือกเครื่องจากคลังในระบบ หรือกรอก Serial Number และ Ward (หน่วยงาน) เพิ่มเติม:
                </p>

                {machines.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <button
                      type="button"
                      onClick={handleSelectAllMachines}
                      className="px-2.5 py-1 text-[10px] font-bold bg-sky-100 text-sky-800 rounded-lg hover:bg-sky-200 transition-colors shadow-2xs cursor-pointer"
                    >
                      + เลือกทุกเครื่องในคลัง ({machines.length} เครื่อง)
                    </button>
                    {machines.map((m) => {
                      const isSelected = testedMachines.some(item => item.serialNumber === m.serialNumber);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleToggleMachine({ serialNumber: m.serialNumber, ward: m.ward })}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center space-x-1.5 border cursor-pointer ${
                            isSelected
                              ? 'bg-sky-600 text-white border-sky-600 font-bold shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                          }`}
                        >
                          {isSelected && <Check size={11} />}
                          <span>{m.serialNumber}</span>
                          <span className="text-[10px] opacity-90">({m.ward})</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Custom SN & Ward Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                  <div className="relative sm:col-span-5">
                    <Hash size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Serial Number (เช่น SN-231088)"
                      value={customSerialInput}
                      onChange={(e) => setCustomSerialInput(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-sky-500"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <CustomSelect
                      value={customWardInput}
                      onChange={(e) => setCustomWardInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomMachine();
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-sky-500 bg-white"
                    >
                      <option value="">เลือก Ward / หน่วยงาน</option>
                      {wards.map(w => (
                        <option key={w.en_name} value={w.thai_name}>{w.thai_name}</option>
                      ))}
                    </CustomSelect>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddCustomMachine}
                      className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      + เพิ่มช่อง
                    </button>
                  </div>
                </div>

                {/* Added Machines List with Ward and 3-Level Values */}
                {testedMachines.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <span className="text-[11px] font-bold text-sky-900 block">
                      ระบุผลการวิเคราะห์เปรียบเทียบ 3 ระดับ (Level 1, 2, 3) แยกตามรายเครื่อง ({testedMachines.length} เครื่อง):
                    </span>
                    <div className="space-y-3 max-h-[480px] overflow-y-auto p-2.5 bg-sky-50/40 rounded-xl border border-sky-100">
                      {testedMachines.map((item, idx) => (
                        <div key={item.serialNumber} className="bg-white p-3.5 rounded-xl border border-sky-200/80 shadow-xs space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded text-[11px]">#{idx + 1}</span>
                              <span className="font-mono font-extrabold text-slate-900 text-xs">SN: {item.serialNumber}</span>
                              <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">Ward: {item.ward}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveMachine(item.serialNumber)}
                              className="text-rose-500 hover:text-rose-700 font-bold text-xs px-2 py-1 rounded hover:bg-rose-50 cursor-pointer transition-colors flex items-center space-x-1"
                              title="ลบรายการ"
                            >
                              <span>× ลบเครื่องนี้</span>
                            </button>
                          </div>

                          {/* Per-machine 3 Levels inputs */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                            {/* Level 1 */}
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                              <span className="font-bold text-slate-800 block border-b border-slate-200/60 pb-1">Level 1 (Low)</span>
                              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                                <div>
                                  <label className="text-[9px] text-slate-500">ค่าวิเคราะห์ได้</label>
                                  <input 
                                    type="number" 
                                    placeholder="เช่น 46" 
                                    value={item.level1Value || ''} 
                                    onChange={(e) => {
                                      const updated = testedMachines.map(m => m.serialNumber === item.serialNumber ? { ...m, level1Value: e.target.value } : m);
                                      setTestedMachines(updated);
                                    }} 
                                    className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white" 
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-500">ค่ากลางเป้าหมาย</label>
                                  <input 
                                    type="number" 
                                    placeholder="เช่น 45" 
                                    value={item.level1Target || ''} 
                                    onChange={(e) => {
                                      const updated = testedMachines.map(m => m.serialNumber === item.serialNumber ? { ...m, level1Target: e.target.value } : m);
                                      setTestedMachines(updated);
                                    }} 
                                    className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white" 
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Level 2 */}
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                              <span className="font-bold text-slate-800 block border-b border-slate-200/60 pb-1">Level 2 (Normal)</span>
                              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                                <div>
                                  <label className="text-[9px] text-slate-500">ค่าวิเคราะห์ได้</label>
                                  <input 
                                    type="number" 
                                    placeholder="เช่น 120" 
                                    value={item.level2Value || ''} 
                                    onChange={(e) => {
                                      const updated = testedMachines.map(m => m.serialNumber === item.serialNumber ? { ...m, level2Value: e.target.value } : m);
                                      setTestedMachines(updated);
                                    }} 
                                    className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white" 
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-500">ค่ากลางเป้าหมาย</label>
                                  <input 
                                    type="number" 
                                    placeholder="เช่น 120" 
                                    value={item.level2Target || ''} 
                                    onChange={(e) => {
                                      const updated = testedMachines.map(m => m.serialNumber === item.serialNumber ? { ...m, level2Target: e.target.value } : m);
                                      setTestedMachines(updated);
                                    }} 
                                    className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white" 
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Level 3 */}
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                              <span className="font-bold text-slate-800 block border-b border-slate-200/60 pb-1">Level 3 (High)</span>
                              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                                <div>
                                  <label className="text-[9px] text-slate-500">ค่าวิเคราะห์ได้</label>
                                  <input 
                                    type="number" 
                                    placeholder="เช่น 312" 
                                    value={item.level3Value || ''} 
                                    onChange={(e) => {
                                      const updated = testedMachines.map(m => m.serialNumber === item.serialNumber ? { ...m, level3Value: e.target.value } : m);
                                      setTestedMachines(updated);
                                    }} 
                                    className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white" 
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-500">ค่ากลางเป้าหมาย</label>
                                  <input 
                                    type="number" 
                                    placeholder="เช่น 310" 
                                    value={item.level3Target || ''} 
                                    onChange={(e) => {
                                      const updated = testedMachines.map(m => m.serialNumber === item.serialNumber ? { ...m, level3Target: e.target.value } : m);
                                      setTestedMachines(updated);
                                    }} 
                                    className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white" 
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Document Attachment & OneDrive Links */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4 text-xs">
            <h4 className="font-extrabold text-slate-800 flex items-center space-x-1.5">
              <Link2 size={16} className="text-sky-600" />
              <span>เอกสารรายงานผล & ลิงก์จัดเก็บ OneDrive</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* OneDrive URL */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center space-x-1">
                  <ExternalLink size={13} className="text-sky-600" />
                  <span>ลิงก์เอกสารจัดเก็บบน OneDrive (OneDrive Link)</span>
                </label>
                <input
                  type="url"
                  placeholder="วาง URL หรือ Share Link จาก OneDrive ที่นี่"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 font-mono text-[11px]"
                />
                <p className="text-[10px] text-slate-400">* คัดลอกลิงก์แชร์จาก OneDrive ของโรงพยาบาลมาวางเพื่อการอ้างอิงระยะยาว</p>
              </div>

              {/* Attachment for Direct Web Preview */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center space-x-1">
                  <Upload size={13} className="text-sky-600" />
                  <span>แนบไฟล์รายงานผลสำหรับพรีวิวบนหน้าเว็บ (รูปภาพ/PDF)</span>
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-slate-50 cursor-pointer"
                />
                {isUploading && <p className="text-[10px] text-sky-600 animate-pulse">กำลังโหลดไฟล์...</p>}
                {attachment && (
                  <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-[11px] text-emerald-800 font-medium">
                    <span className="truncate max-w-[200px]">{attachment.name} ({attachment.type.toUpperCase()})</span>
                    <button type="button" onClick={() => setAttachment(undefined)} className="text-rose-600 hover:underline text-[10px] ml-2">ลบไฟล์</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* EQA 3 Level Grid Inputs (Optional or when completed) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 flex items-center space-x-1">
              <Shield size={14} className="text-sky-600" />
              <span>ผลการวิเคราะห์เปรียบเทียบ 3 ระดับ (กรณีมีผลการทดสอบแล้ว)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200 text-xs">
              {/* Level 1 */}
              <div className="space-y-2">
                <span className="font-bold text-slate-700 block text-xs border-b border-slate-100 pb-1">Level 1 (Low)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">ค่าวิเคราะห์ได้</label>
                    <input type="number" placeholder="เช่น 46" value={l1Val} onChange={(e) => setL1Val(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">ค่ากลางเป้าหมาย</label>
                    <input type="number" placeholder="เช่น 45" value={l1Target} onChange={(e) => setL1Target(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Level 2 */}
              <div className="space-y-2">
                <span className="font-bold text-slate-700 block text-xs border-b border-slate-100 pb-1">Level 2 (Normal)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">ค่าวิเคราะห์ได้</label>
                    <input type="number" placeholder="เช่น 120" value={l2Val} onChange={(e) => setL2Val(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">ค่ากลางเป้าหมาย</label>
                    <input type="number" placeholder="เช่น 120" value={l2Target} onChange={(e) => setL2Target(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Level 3 */}
              <div className="space-y-2">
                <span className="font-bold text-slate-700 block text-xs border-b border-slate-100 pb-1">Level 3 (High)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">ค่าวิเคราะห์ได้</label>
                    <input type="number" placeholder="เช่น 312" value={l3Val} onChange={(e) => setL3Val(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">ค่ากลางเป้าหมาย</label>
                    <input type="number" placeholder="เช่น 310" value={l3Target} onChange={(e) => setL3Target(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-700">ข้อคิดเห็นและข้อแนะนำพัฒนาการวิเคราะห์ (Feedback / Committee Remarks)</label>
            <input
              type="text"
              placeholder="ระบุข้อแนะนำเพิ่มเติม หรือสรุปความคลาดเคลื่อนระบบ"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-colors flex items-center space-x-1.5"
            >
              <CheckCircle size={15} />
              <span>บันทึกข้อมูล EQA</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อรอบ EQA, หน่วยงาน..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-sky-500 font-medium"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end text-xs">
          <Filter size={14} className="text-slate-400" />
          <span className="text-slate-500 font-bold">สถานะ:</span>
          <CustomSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-1.5 text-xs border border-slate-200 bg-white rounded-lg focus:outline-hidden focus:border-sky-500 font-bold text-slate-700"
          >
            <option value="all">ทั้งหมด ({eqaRecords.length})</option>
            <option value="pending">รอดำเนินการ</option>
            <option value="in_progress">กำลังทดสอบ</option>
            <option value="submitted">ส่งผลแล้ว</option>
            <option value="completed">ประเมินผลเสร็จสิ้น</option>
          </CustomSelect>
        </div>
      </div>

      {/* EQA Records List */}
      <div className="space-y-4" id="eqa-cards-list">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Shield size={32} className="mx-auto text-slate-300" />
            <p className="text-slate-500 font-medium text-xs">ยังไม่มีข้อมูลรายการการทดสอบ EQA</p>
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div key={rec.id} className="border border-slate-200/80 p-5 rounded-2xl hover:border-sky-300 hover:shadow-md transition-all space-y-4 bg-white relative">
              
              {/* Header Info */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-100">
                      {rec.round}
                    </span>
                    {getActionStatusBadge(rec.actionStatus)}
                    {rec.dueDate && (() => {
                      const daysLeft = getDaysLeft(rec.dueDate);
                      if (daysLeft === null || rec.actionStatus === 'completed') return null;
                      if (daysLeft < 0) {
                        return (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center animate-pulse">
                            <AlertTriangle size={12} className="mr-1" /> เกินกำหนดส่งแล้ว {Math.abs(daysLeft)} วัน
                          </span>
                        );
                      } else if (daysLeft === 0) {
                        return (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center animate-pulse">
                            <Clock size={12} className="mr-1" /> ครบกำหนดส่งวันนี้!
                          </span>
                        );
                      } else if (daysLeft <= 7) {
                        return (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center">
                            <Clock size={12} className="mr-1" /> ใกล้ครบกำหนดส่ง (อีก {daysLeft} วัน)
                          </span>
                        );
                      } else {
                        return (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200 flex items-center">
                            <Calendar size={12} className="mr-1" /> กำหนดส่งอีก {daysLeft} วัน
                          </span>
                        );
                      }
                    })()}
                  </div>
                  {rec.organizer && (
                    <p className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 mt-1">
                      <Building2 size={13} className="text-slate-400 shrink-0" />
                      <span>{rec.organizer}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 font-medium pt-0.5">
                    {rec.actionDate && <span>วันที่ดำเนินการ: {formatToThaiDate(rec.actionDate)}</span>}
                    {rec.testDate && <span>วันที่ส่งตรวจ: {formatToThaiDate(rec.testDate)}</span>}
                    {rec.dueDate && (
                      <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        วันกำหนดส่งผล: {formatToThaiDate(rec.dueDate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score & Rating Badge */}
                <div className="flex items-center space-x-3 shrink-0">
                  {rec.score !== undefined && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold">คะแนนประเมิน</span>
                      <span className="text-base font-extrabold text-sky-600 font-mono">{rec.score}%</span>
                    </div>
                  )}
                  <div>{getGradeStatusBadge(rec.status)}</div>
                </div>
              </div>

              {/* Machine Count & Serial Numbers / Wards Info Bar */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold text-slate-800">
                    <Laptop size={15} className="text-sky-600 shrink-0" />
                    <span>จำนวนเครื่องที่ทำ EQA: <span className="text-sky-700 font-extrabold">{rec.machineCount || rec.testedMachines?.length || rec.testedSerials?.length || 1} เครื่อง</span></span>
                  </div>
                </div>
                
                {rec.testedMachines && rec.testedMachines.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-500 font-medium">รายการเครื่อง & Ward:</span>
                    {rec.testedMachines.map(m => (
                      <span key={m.serialNumber} className="bg-white text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-2xs flex items-center space-x-1.5">
                        <span className="font-mono text-sky-700">SN: {m.serialNumber}</span>
                        <span className="text-[10px] bg-sky-50 text-sky-900 px-1.5 py-0.5 rounded font-semibold">({m.ward})</span>
                      </span>
                    ))}
                  </div>
                ) : rec.testedSerials && rec.testedSerials.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-500 font-medium">SN เครื่อง:</span>
                    {rec.testedSerials.map(sn => (
                      <span key={sn} className="bg-white text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold shadow-2xs">
                        SN: {sn}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">ไม่ได้ระบุ Serial Number</span>
                )}
              </div>

              {/* Grid 3 Level Details (If available) */}
              {(rec.level1Value !== undefined || rec.level2Value !== undefined || rec.level3Value !== undefined) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Level 1 Detail */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] text-slate-500 font-extrabold block">Level 1 (Low)</span>
                    <p className="font-mono text-[11px] text-slate-700">
                      ค่าวิเคราะห์: <span className="font-bold text-slate-900">{rec.level1Value ?? '-'}</span> | เป้าหมาย: <span className="font-bold text-slate-900">{rec.level1Target ?? '-'}</span>
                    </p>
                  </div>

                  {/* Level 2 Detail */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] text-slate-500 font-extrabold block">Level 2 (Normal)</span>
                    <p className="font-mono text-[11px] text-slate-700">
                      ค่าวิเคราะห์: <span className="font-bold text-slate-900">{rec.level2Value ?? '-'}</span> | เป้าหมาย: <span className="font-bold text-slate-900">{rec.level2Target ?? '-'}</span>
                    </p>
                  </div>

                  {/* Level 3 Detail */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] text-slate-500 font-extrabold block">Level 3 (High)</span>
                    <p className="font-mono text-[11px] text-slate-700">
                      ค่าวิเคราะห์: <span className="font-bold text-slate-900">{rec.level3Value ?? '-'}</span> | เป้าหมาย: <span className="font-bold text-slate-900">{rec.level3Target ?? '-'}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Feedback and Committee Notes */}
              {rec.feedback && (
                <div className="bg-sky-50/40 p-3 rounded-xl border border-sky-100/80 flex items-start space-x-2 text-xs">
                  <MessageSquare size={15} className="text-sky-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-extrabold text-sky-950 text-[10px] block">ข้อคิดเห็นและข้อเสนอแนะ:</span>
                    <p className="text-sky-900 font-medium mt-0.5 italic text-[11px]">"{rec.feedback}"</p>
                  </div>
                </div>
              )}

              {/* Document Actions & Preview Section */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {/* LINE Notification Reminder Button */}
                  <button
                    type="button"
                    onClick={() => handleSendLineReminder(rec)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all text-[11px] shadow-2xs cursor-pointer active:scale-95"
                    title="ส่งข้อความแจ้งเตือนผ่าน LINE Notify ถึงทีมผู้เกี่ยวข้อง"
                  >
                    <Smartphone size={13} className="text-emerald-200" />
                    <span>แจ้งเตือน LINE ผู้เกี่ยวข้อง</span>
                  </button>

                  {/* OneDrive Link Button */}
                  {rec.documentUrl && (
                    <a
                      href={rec.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold px-3 py-1.5 rounded-lg border border-sky-200 flex items-center space-x-1.5 transition-colors text-[11px]"
                    >
                      <ExternalLink size={13} />
                      <span>เปิดเอกสารบน OneDrive</span>
                    </a>
                  )}

                  {/* Attached File Preview Button */}
                  {rec.attachmentFile && (
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({
                        title: `รายงานผล EQA - ${rec.round}`,
                        url: rec.documentUrl,
                        attachment: rec.attachmentFile,
                        round: rec.round,
                        organizer: rec.organizer
                      })}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors text-[11px] shadow-2xs cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>พรีวิวเอกสาร ({rec.attachmentFile.type.toUpperCase()})</span>
                    </button>
                  )}
                </div>

                {!rec.documentUrl && !rec.attachmentFile && (
                  <span className="text-[11px] text-slate-400 italic">ยังไม่ได้แนบเอกสารรายงานผล</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Full Document & File Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                  <FileText size={16} className="text-sky-400" />
                  <span>{previewDoc.title}</span>
                </h3>
                {previewDoc.organizer && <p className="text-xs text-slate-400 mt-0.5">{previewDoc.organizer}</p>}
              </div>
              <div className="flex items-center space-x-2">
                {previewDoc.url && (
                  <a
                    href={previewDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition-colors"
                  >
                    <ExternalLink size={13} />
                    <span>เปิดใน OneDrive</span>
                  </a>
                )}
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content Preview Area */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 flex flex-col items-center justify-center">
              {previewDoc.attachment?.type === 'image' && previewDoc.attachment.dataUrl ? (
                <div className="space-y-3 text-center">
                  <img
                    src={previewDoc.attachment.dataUrl}
                    alt="EQA Preview"
                    className="max-h-[65vh] object-contain mx-auto rounded-xl shadow-md border border-slate-200 bg-white p-2"
                  />
                  <p className="text-xs text-slate-500 font-medium">ภาพแสดงผลรายงาน EQA ({previewDoc.attachment.name})</p>
                </div>
              ) : previewDoc.attachment?.type === 'pdf' && previewDoc.attachment.dataUrl ? (
                <iframe
                  src={previewDoc.attachment.dataUrl}
                  title="PDF EQA Report Preview"
                  className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white shadow-md"
                />
              ) : (
                <div className="text-center py-12 space-y-4">
                  <FileText size={48} className="mx-auto text-slate-400" />
                  <p className="text-sm font-bold text-slate-700">ไม่พบไฟล์ตัวอย่างในหน้าเว็บ</p>
                  {previewDoc.url && (
                    <a
                      href={previewDoc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 bg-sky-600 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-sky-500 transition-colors"
                    >
                      <ExternalLink size={14} />
                      <span>เปิดดูเอกสารที่จัดเก็บบน OneDrive</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
