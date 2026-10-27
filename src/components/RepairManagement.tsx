/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import CustomSelect from "./CustomSelect";
import { RepairRequest, DtxMachine } from '../types';
import { dbService } from '../lib/supabase';
import PrintForm from './PrintForm';
import { Search, Edit, FileText, Printer, Check, X, ShieldAlert, AlertCircle, Wrench, RefreshCw, UserCheck, ChevronLeft, ChevronRight, Plus, Calendar, Clock, User, Phone, Info, CheckCircle2, Trash2 } from 'lucide-react';
import { formatToThaiDate, getThaiTodayDateOnly } from '../lib/dateUtils';

interface RepairManagementProps {
  repairs: RepairRequest[];
  onUpdateRepair: (repair: RepairRequest) => void;
  onAddRepair?: (repair: RepairRequest) => Promise<any> | void;
  onDeleteRepair?: (id: string) => void;
  machines?: DtxMachine[];
  lineNotifyToken: string;
}

export const AVAILABLE_REPAIR_ACTIONS = [
  { id: 'change_battery', label: 'เปลี่ยนถ่าน' },
  { id: 'clean_machine', label: 'ทำความสะอาดตัวเครื่อง/ช่องเสียบ' },
  { id: 'calibrate_system', label: 'ปรับตั้งค่า/รีเซ็ตระบบ' },
  { id: 'pass_iqc', label: 'ทดสอบ IQC ผ่านเกณฑ์' },
  { id: 'return_original', label: 'ส่งคืนเครื่องเดิม' },
  { id: 'provide_new', label: 'จ่ายเครื่องใหม่ทดแทน' },
  { id: 'claim_vendor', label: 'ส่งเคลมบริษัท' },
];

export default function RepairManagement({
  repairs,
  onUpdateRepair,
  onAddRepair,
  onDeleteRepair,
  machines = [],
  lineNotifyToken
}: RepairManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWard, setFilterWard] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterWard]);
  
  const [wards, setWards] = useState<{ en_name: string; thai_name: string }[]>([]);

  useEffect(() => {
    dbService.getWards()
      .then(setWards)
      .catch(err => console.error('Failed to fetch wards:', err));
  }, []);

  // Selected repair for editing or printing
  const [editingRepair, setEditingRepair] = useState<RepairRequest | null>(null);
  const [printingRepair, setPrintingRepair] = useState<RepairRequest | null>(null);
  const [batchPrintRepairs, setBatchPrintRepairs] = useState<RepairRequest[] | null>(null);

  // Multi-select state for bulk actions
  const [selectedRepairIds, setSelectedRepairIds] = useState<string[]>([]);

  // Universal In-App Confirmation Modal State (Fixes iframe sandbox blocking window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    confirmButtonClass?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'ยืนยัน',
    onConfirm: () => {}
  });

  // Deletion & Batch Print handlers
  const handleDeleteSingleRepair = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันลบประวัติแจ้งซ่อม',
      description: `คุณต้องการลบประวัติแจ้งซ่อมรหัส "${id}" ออกจากระบบใช่หรือไม่?`,
      confirmText: 'ยืนยันลบรายการ',
      confirmButtonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
      onConfirm: () => {
        if (onDeleteRepair) {
          onDeleteRepair(id);
        } else {
          dbService.deleteRepair(id).catch(console.error);
        }
        setSelectedRepairIds(prev => prev.filter(item => item !== id));
        if (editingRepair && editingRepair.id === id) {
          setEditingRepair(null);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBulkDeleteRepairs = () => {
    if (selectedRepairIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันลบรายการแจ้งซ่อมที่เลือก',
      description: `คุณต้องการลบรายการแจ้งซ่อมที่เลือกทั้ง ${selectedRepairIds.length} รายการใช่หรือไม่?`,
      confirmText: `ยืนยันลบ ${selectedRepairIds.length} รายการ`,
      confirmButtonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
      onConfirm: () => {
        selectedRepairIds.forEach(id => {
          if (onDeleteRepair) {
            onDeleteRepair(id);
          } else {
            dbService.deleteRepair(id).catch(console.error);
          }
        });
        setSelectedRepairIds([]);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBatchPrintSelected = () => {
    if (selectedRepairIds.length === 0) return;
    const selectedList = repairs.filter(r => selectedRepairIds.includes(r.id));
    setBatchPrintRepairs(selectedList);
  };

  // Edit form states
  const [editStatus, setEditStatus] = useState<RepairRequest['status']>('pending');
  const [editRequestDate, setEditRequestDate] = useState('');
  const [editReporterName, setEditReporterName] = useState('');
  const [editDiagnosed, setEditDiagnosed] = useState('');
  const [editInspection, setEditInspection] = useState('');
  const [editAction, setEditAction] = useState<RepairRequest['actionTaken']>('none');
  const [editActions, setEditActions] = useState<string[]>([]);
  const [editActionDetails, setEditActionDetails] = useState('');
  const [editOperator, setEditOperator] = useState('');
  const [editReceiver, setEditReceiver] = useState('');
  const [editCompletionDate, setEditCompletionDate] = useState('');
  
  // Bulk repair status update
  const handleBulkUpdateRepairStatus = (newStatus: RepairRequest['status']) => {
    if (selectedRepairIds.length === 0) return;
    const targetRepairs = repairs.filter(r => selectedRepairIds.includes(r.id));
    targetRepairs.forEach(r => {
      const updated: RepairRequest = {
        ...r,
        status: newStatus,
        ...(newStatus === 'completed' ? { completionDate: getThaiTodayDateOnly() } : {})
      };
      onUpdateRepair(updated);
    });
    setSelectedRepairIds([]);
  };

  // Checklist states
  const [cleanliness, setCleanliness] = useState<'pass' | 'fail' | 'pending'>('pending');
  const [buttons, setButtons] = useState<'pass' | 'fail' | 'pending'>('pending');
  const [stripSlot, setStripSlot] = useState<'pass' | 'fail' | 'pending'>('pending');
  const [batterySlot, setBatterySlot] = useState<'pass' | 'fail' | 'pending'>('pending');
  const [battery, setBattery] = useState<'pass' | 'fail' | 'pending'>('pending');
  const [screen, setScreen] = useState<'pass' | 'fail' | 'pending'>('pending');
  const [measurement, setMeasurement] = useState<'pass' | 'fail' | 'pending'>('pending');
  const [iqc, setIqc] = useState<'pass' | 'fail' | 'pending'>('pending');
  const [intercomparison, setIntercomparison] = useState<'pass' | 'fail' | 'pending'>('pending');
  const [others, setOthers] = useState('');

  // Admin Add / Retroactive Repair Form States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSelectedMachine, setNewSelectedMachine] = useState<string>('');
  const [newCustomCode, setNewCustomCode] = useState<string>('');
  const [newMachineSerial, setNewMachineSerial] = useState<string>('');
  const [newWard, setNewWard] = useState<string>('');
  const [newReporterName, setNewReporterName] = useState<string>('เจ้าหน้าที่ประจำหอผู้ป่วย');
  const [newReporterPhone, setNewReporterPhone] = useState<string>('');
  const [newReportedProblem, setNewReportedProblem] = useState<string>('');
  const [newRequestDate, setNewRequestDate] = useState<string>(getThaiTodayDateOnly());
  const [newNeedsBackup, setNewNeedsBackup] = useState<boolean>(false);
  const [newStatus, setNewStatus] = useState<RepairRequest['status']>('pending');
  const [newDiagnosedProblem, setNewDiagnosedProblem] = useState<string>('');
  const [newInspectionResult, setNewInspectionResult] = useState<string>('');
  const [newActionTaken, setNewActionTaken] = useState<RepairRequest['actionTaken']>('none');
  const [newActionsTaken, setNewActionsTaken] = useState<string[]>([]);
  const [newActionDetails, setNewActionDetails] = useState<string>('');
  const [newOperatorName, setNewOperatorName] = useState<string>('ทนพ. สมชาย ดีเลิศ');
  const [newReceiverName, setNewReceiverName] = useState<string>('');
  const [newCompletionDate, setNewCompletionDate] = useState<string>(getThaiTodayDateOnly());
  const [isSubmittingNewRepair, setIsSubmittingNewRepair] = useState<boolean>(false);
  const [simLineMsg, setSimLineMsg] = useState<string | null>(null);
  const [machineSearchTerm, setMachineSearchTerm] = useState('');
  const [isMachineSearchOpen, setIsMachineSearchOpen] = useState(false);

  const filteredMachinesForSearch = React.useMemo(() => {
    if (!machineSearchTerm.trim()) return machines;
    const term = machineSearchTerm.toLowerCase().trim();
    return machines.filter(m => 
      (m.serialNumber && m.serialNumber.toLowerCase().includes(term)) ||
      (m.machineSerial && m.machineSerial.toLowerCase().includes(term)) ||
      (m.ward && m.ward.toLowerCase().includes(term)) ||
      (m.brand && m.brand.toLowerCase().includes(term)) ||
      (m.model && m.model.toLowerCase().includes(term))
    );
  }, [machines, machineSearchTerm]);

  const handleSelectMachineForAdd = (val: string) => {
    setNewSelectedMachine(val);
    if (val === 'CUSTOM') {
      setNewCustomCode('');
      setNewMachineSerial('');
      return;
    }
    const found = machines?.find(m => m.serialNumber === val || m.machineSerial === val);
    if (found) {
      setNewCustomCode(found.serialNumber);
      setNewMachineSerial(found.machineSerial || found.serialNumber);
      if (found.ward) setNewWard(found.ward);
    }
  };

  const handleCreateNewRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = (newSelectedMachine === 'CUSTOM' ? newCustomCode : newSelectedMachine).trim();
    if (!finalCode) {
      alert('กรุณาระบุหรือเลือกรหัสเครื่อง DTX');
      return;
    }
    if (!newWard.trim()) {
      alert('กรุณาระบุหน่วยงาน / Ward ที่ส่งซ่อม');
      return;
    }
    if (!newReportedProblem.trim()) {
      alert('กรุณาระบุอาการเสียหรือปัญหาตามแจ้ง');
      return;
    }

    setIsSubmittingNewRepair(true);
    const newId = `REP-${Date.now().toString().slice(-4)}`;
    const isCompleted = newStatus === 'completed';

    const actionTakenJoined = newActionsTaken.length > 0 ? newActionsTaken.join(',') : 'none';

    const newRepair: RepairRequest = {
      id: newId,
      serialNumber: finalCode.toUpperCase(),
      machineSerial: newMachineSerial.trim() || undefined,
      ward: newWard.trim(),
      reporterName: newReporterName.trim() || 'เจ้าหน้าที่ประจำหอผู้ป่วย',
      reporterPhone: newReporterPhone.trim(),
      reportedProblem: newReportedProblem.trim(),
      requestDate: newRequestDate || getThaiTodayDateOnly(),
      status: newStatus,
      needsBackup: newNeedsBackup,
      diagnosedProblem: newDiagnosedProblem.trim() || undefined,
      inspectionResult: newInspectionResult.trim() || undefined,
      actionTaken: actionTakenJoined,
      actionsTaken: newActionsTaken,
      actionDetails: newActionDetails.trim() || undefined,
      operatorName: newOperatorName.trim() || undefined,
      receiverName: newReceiverName.trim() || undefined,
      completionDate: isCompleted ? (newCompletionDate || newRequestDate || getThaiTodayDateOnly()) : undefined,
      checklist: {
        cleanliness: isCompleted ? 'pass' : 'pending',
        buttons: isCompleted ? 'pass' : 'pending',
        stripSlot: isCompleted ? 'pass' : 'pending',
        batterySlot: isCompleted ? 'pass' : 'pending',
        battery: isCompleted ? 'pass' : 'pending',
        screen: isCompleted ? 'pass' : 'pending',
        measurement: isCompleted ? 'pass' : 'pending',
        iqc: isCompleted ? 'pass' : 'pending',
        intercomparison: isCompleted ? 'pass' : 'pending',
        others: ''
      }
    };

    try {
      if (onAddRepair) {
        await onAddRepair(newRepair);
      } else {
        await dbService.insertRepair(newRepair);
      }
      setIsAddModalOpen(false);
      // Reset form
      setNewSelectedMachine('');
      setNewCustomCode('');
      setNewMachineSerial('');
      setNewWard('');
      setNewReportedProblem('');
      setNewNeedsBackup(false);
      setNewStatus('pending');
      setNewDiagnosedProblem('');
      setNewInspectionResult('');
      setNewActionTaken('none');
      setNewActionsTaken([]);
      setNewActionDetails('');
      setNewReceiverName('');
    } catch (err: any) {
      console.error('Failed to create repair:', err);
      alert(`ไม่สามารถบันทึกข้อมูลได้: ${err?.message || err}`);
    } finally {
      setIsSubmittingNewRepair(false);
    }
  };

  const startEdit = (rep: RepairRequest) => {
    setEditingRepair(rep);
    setEditStatus(rep.status);
    setEditRequestDate(rep.requestDate || getThaiTodayDateOnly());
    setEditReporterName(rep.reporterName || 'เจ้าหน้าที่ประจำหอผู้ป่วย');
    setEditDiagnosed(rep.diagnosedProblem || '');
    setEditInspection(rep.inspectionResult || '');

    // Multi-select actions initialization
    let initialActions: string[] = [];
    if (rep.actionsTaken && Array.isArray(rep.actionsTaken) && rep.actionsTaken.length > 0) {
      initialActions = rep.actionsTaken;
    } else if (rep.actionTaken && rep.actionTaken !== 'none') {
      initialActions = rep.actionTaken.split(',').map(s => s.trim()).filter(Boolean);
    }
    setEditActions(initialActions);
    setEditAction(rep.actionTaken || 'none');
    setEditActionDetails(rep.actionDetails || '');
    setEditOperator(rep.operatorName || 'ทนพ. สมชาย ดีเลิศ');
    setEditReceiver(rep.receiverName || '');
    setEditCompletionDate(rep.completionDate || rep.requestDate || getThaiTodayDateOnly());

    // Set checklists
    const c = rep.checklist;
    setCleanliness(c.cleanliness);
    setButtons(c.buttons);
    setStripSlot(c.stripSlot);
    setBatterySlot(c.batterySlot);
    setBattery(c.battery);
    setScreen(c.screen);
    setMeasurement(c.measurement);
    setIqc(c.iqc);
    setIntercomparison(c.intercomparison);
    setOthers(c.others || '');
  };

  const handleSaveRepairChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRepair) return;

    const actionTakenJoined = editActions.length > 0 ? editActions.join(',') : 'none';

    const updated: RepairRequest = {
      ...editingRepair,
      status: editStatus,
      requestDate: editRequestDate || editingRepair.requestDate || getThaiTodayDateOnly(),
      reporterName: editReporterName.trim() || editingRepair.reporterName,
      diagnosedProblem: editDiagnosed.trim(),
      inspectionResult: editInspection.trim(),
      actionTaken: actionTakenJoined,
      actionsTaken: editActions,
      actionDetails: editActionDetails.trim(),
      operatorName: editOperator.trim(),
      receiverName: editReceiver.trim(),
      completionDate: editStatus === 'completed' ? (editCompletionDate || getThaiTodayDateOnly()) : undefined,
      checklist: {
        cleanliness,
        buttons,
        stripSlot,
        batterySlot,
        battery,
        screen,
        measurement,
        iqc,
        intercomparison,
        others: others.trim()
      }
    };

    onUpdateRepair(updated);

    // Simulate Line Notify for Status Update
    let lineStatusText = '';
    if (editStatus === 'repairing') lineStatusText = 'กำลังดำเนินการวิเคราะห์/ซ่อมบำรุง [อยู่ระหว่างดำเนินการ]';
    if (editStatus === 'waiting_claim') lineStatusText = 'ส่งต่อไปยังผู้จัดจำหน่ายเพื่อรอส่งเคลมบริษัท [รอส่งเคลม]';
    if (editStatus === 'completed') lineStatusText = 'ซ่อมบำรุงเสร็จสิ้น และทำ QC ผ่านเรียบร้อย พร้อมส่งคืนหน่วยงานแล้ว [เสร็จสิ้น]';
    
    if (lineStatusText) {
      setSimLineMsg(`[อัปเดตสถานะแจ้งซ่อม] รหัสงาน: ${updated.id}\nเครื่อง: ${updated.serialNumber} (${updated.ward})\nสถานะ: ${lineStatusText}\nผู้ดำเนินการ: ${editOperator}`);
      setTimeout(() => setSimLineMsg(null), 8000);
    }

    setEditingRepair(null);
  };

  const filteredRepairs = repairs.filter(r => {
    const matchesSearch = r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.reporterName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === '' || r.status === filterStatus;
    const matchesWard = filterWard === '' || r.ward === filterWard;

    return matchesSearch && matchesStatus && matchesWard;
  });

  const totalPages = Math.ceil(filteredRepairs.length / itemsPerPage);
  const paginatedRepairs = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRepairs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRepairs, currentPage]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800">รอดำเนินการ</span>;
      case 'repairing':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-800">กำลังซ่อม</span>;
      case 'waiting_claim':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-800">รอส่งเคลม</span>;
      case 'claimed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800">ส่งเคลมแล้ว</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800">เสร็จสิ้น/ส่งคืน Ward</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6" id="repair-management-panel">
      {/* Simulation Box floating */}
      {simLineMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-sky-50 border border-sky-100 text-sky-900 p-4 rounded-xl shadow-2xl max-w-sm space-y-2 animate-bounce">
          <div className="flex items-center space-x-1.5 border-b border-sky-100 pb-1.5 text-xs text-emerald-600 font-bold">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block animate-ping"></span>
            <span>LINE NOTIFY (ส่งไปยังผู้รับผิดชอบกลุ่มงาน)</span>
          </div>
          <p className="text-[11px] font-mono whitespace-pre-line text-slate-700 leading-normal">{simLineMsg}</p>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-100 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <Wrench size={20} className="text-sky-600" />
            <span>จัดการคำขอแจ้งซ่อมและบันทึกประวัติการบำรุงรักษา</span>
          </h2>
          <p className="text-xs text-slate-400">
            ลงข้อมูลซ่อมบำรุง บันทึกประวัติย้อนหลัง บันทึกผลวินิจฉัย และพิมพ์ส่งรายงานตามมาตรฐานกลุ่มงานเทคนิคการแพทย์
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              if (filteredRepairs.length === 0) {
                alert('ไม่มีรายการแจ้งซ่อมสำหรับพิมพ์');
                return;
              }
              setBatchPrintRepairs(filteredRepairs);
            }}
            disabled={filteredRepairs.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
            title="พิมพ์ใบรายงานการซ่อมบำรุงทุกรายการที่ผ่านการกรอง"
          >
            <Printer size={15} />
            <span>พิมพ์แบบฟอร์มทั้งหมด ({filteredRepairs.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer shadow-md shadow-sky-500/20 transition-all"
          >
            <Plus size={16} />
            <span>+ บันทึกแจ้งซ่อม / ลงประวัติย้อนหลัง</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="repair-filters">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาตามรหัสเครื่อง, เลขส่งซ่อม, ชื่อคนแจ้ง..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2.5 pl-9 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500"
          />
        </div>

        <div>
          <CustomSelect
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
          >
            <option value="">-- สถานะแจ้งซ่อมทั้งหมด --</option>
            <option value="pending">รอดำเนินการ (Pending)</option>
            <option value="repairing">กำลังซ่อม (Repairing)</option>
            <option value="waiting_claim">รอส่งเคลมบริษัท</option>
            <option value="claimed">ส่งเคลมแล้ว</option>
            <option value="completed">เสร็จสิ้น/ส่งคืน Ward (Completed)</option>
          </CustomSelect>
        </div>

        <div>
          <CustomSelect
            value={filterWard}
            onChange={(e) => setFilterWard(e.target.value)}
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
          >
            <option value="">-- แผนกส่งซ่อมทั้งหมด --</option>
            {wards.map((w, idx) => (
              <option key={idx} value={w.thai_name}>{w.thai_name}</option>
            ))}
          </CustomSelect>
        </div>
      </div>

      {/* Bulk Action Floating Bar when items selected */}
      {selectedRepairIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
          <div className="flex items-center space-x-2 font-bold">
            <span className="bg-sky-500 text-slate-950 px-2.5 py-0.5 rounded-full font-black text-[11px]">
              เลือกแล้ว {selectedRepairIds.length} รายการ
            </span>
            <span className="text-slate-300">ดำเนินการ:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleBatchPrintSelected}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition-colors shadow-2xs flex items-center space-x-1"
            >
              <Printer size={13} />
              <span>พิมพ์ใบซ่อมที่เลือก ({selectedRepairIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkUpdateRepairStatus('repairing')}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer transition-colors shadow-2xs"
            >
              เปลี่ยนเป็น "กำลังตรวจซ่อม"
            </button>
            <button
              type="button"
              onClick={() => handleBulkUpdateRepairStatus('completed')}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer transition-colors shadow-2xs"
            >
              เปลี่ยนเป็น "เสร็จสิ้น/ส่งคืน"
            </button>
            <button
              type="button"
              onClick={handleBulkDeleteRepairs}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition-colors shadow-2xs flex items-center space-x-1"
            >
              <Trash2 size={13} />
              <span>ลบที่เลือก ({selectedRepairIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRepairIds([])}
              className="px-2.5 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer"
            >
              ยกเลิกการเลือก
            </button>
          </div>
        </div>
      )}

      {/* Repair List Table */}
      <div className="overflow-x-auto border border-slate-200/90 rounded-2xl bg-white shadow-2xs" id="repairs-table-container">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-white text-slate-700 font-bold border-b border-slate-200">
              <th className="p-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={paginatedRepairs.length > 0 && selectedRepairIds.length === paginatedRepairs.length}
                  onChange={() => {
                    if (selectedRepairIds.length === paginatedRepairs.length) {
                      setSelectedRepairIds([]);
                    } else {
                      setSelectedRepairIds(paginatedRepairs.map(r => r.id));
                    }
                  }}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
              </th>
              <th className="p-4">เลขแจ้งซ่อม</th>
              <th className="p-4">รหัสเครื่อง DTX</th>
              <th className="p-4">หน่วยงานที่ส่ง</th>
              <th className="p-4">อาการเสียตามแจ้ง</th>
              <th className="p-4">วันที่อัปเดตล่าสุด</th>
              <th className="p-4">สถานะการดำเนินงาน</th>
              <th className="p-4 text-center">พิมพ์รายงาน/ดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRepairs.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center p-8 text-slate-400">
                  ยังไม่มีข้อมูลประวัติการแจ้งซ่อมบำรุง
                </td>
              </tr>
            ) : (
              paginatedRepairs.map((rep) => {
                const isSelected = selectedRepairIds.includes(rep.id);
                return (
                  <tr key={rep.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-sky-50/50' : ''}`}>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            setSelectedRepairIds(selectedRepairIds.filter(i => i !== rep.id));
                          } else {
                            setSelectedRepairIds([...selectedRepairIds, rep.id]);
                          }
                        }}
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-4 font-bold text-slate-800">{rep.id}</td>
                    <td className="p-4 font-bold text-sky-600 font-mono">{rep.serialNumber}</td>
                    <td className="p-4 text-slate-700 font-semibold">
                      <div>{rep.ward}</div>
                      {rep.needsBackup && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded-sm text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                          ต้องการเครื่องสำรอง
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 font-medium max-w-xs truncate" title={rep.reportedProblem}>
                      {rep.reportedProblem}
                    </td>
                    <td className="p-4 text-slate-500">{formatToThaiDate(rep.requestDate)}</td>
                    <td className="p-4">{getStatusBadge(rep.status)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => startEdit(rep)}
                          className="p-1.5 hover:bg-sky-50 text-sky-600 rounded-lg hover:text-sky-500 transition-colors font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                          title="กรอกข้อมูลวิเคราะห์/ซ่อม"
                        >
                          <Edit size={13} />
                          <span>ลงข้อมูลซ่อม</span>
                        </button>

                        <button
                          onClick={() => setPrintingRepair(rep)}
                          className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg hover:text-emerald-500 transition-colors font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                          title="เปิดฟอร์มพิมพ์รายงานการซ่อมบำรุง"
                        >
                          <Printer size={13} />
                          <span>ปริ้นฟอร์ม</span>
                        </button>

                        <button
                          onClick={() => handleDeleteSingleRepair(rep.id)}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg hover:text-rose-500 transition-colors font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                          title="ลบประวัติแจ้งซ่อมนี้"
                        >
                          <Trash2 size={13} />
                          <span>ลบ</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border border-slate-200/80 px-4 py-3 bg-white text-xs rounded-2xl shadow-2xs">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ก่อนหน้า
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ถัดไป
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div className="flex items-center space-x-4">
              <p className="text-slate-500 font-medium">
                แสดงรายการที่ <span className="font-bold text-slate-800">{Math.min(filteredRepairs.length, (currentPage - 1) * itemsPerPage + 1)}</span> ถึง{' '}
                <span className="font-bold text-slate-800">{Math.min(filteredRepairs.length, currentPage * itemsPerPage)}</span> จากทั้งหมด{' '}
                <span className="font-bold text-slate-800">{filteredRepairs.length}</span> รายการ
              </p>
              <div className="flex items-center space-x-1.5 text-slate-500 font-medium">
                <span>แสดง:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/25 text-[11px] font-bold"
                >
                  <option value={10}>10 รายการ</option>
                  <option value={15}>15 รายการ</option>
                  <option value={25}>25 รายการ</option>
                  <option value={50}>50 รายการ</option>
                  <option value={100}>100 รายการ</option>
                </select>
              </div>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-2xs" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    aria-current={currentPage === page ? 'page' : undefined}
                    className={`relative inline-flex items-center px-3 py-2 text-xs font-extrabold ring-1 ring-inset focus:z-20 focus:outline-offset-0 ${
                      currentPage === page
                        ? 'z-10 bg-sky-600 text-white ring-sky-600'
                        : 'text-slate-700 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Repair Management Dialog / Form Editor (Floating screen when edit) */}
      {editingRepair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" id="edit-repair-modal">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 my-8 animate-scale-up">
            <div className="bg-slate-950 text-white p-4.5 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm">อัปเดตผลวินิจฉัยและเช็คลิสต์การซ่อมบำรุง</h3>
                <p className="text-[10px] text-slate-400">หมายเลขงาน: {editingRepair.id} | เครื่อง DTX S/N: {editingRepair.serialNumber} ({editingRepair.ward})</p>
              </div>
              <button onClick={() => setEditingRepair(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveRepairChanges} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
              
              {/* Reported Problem summary header */}
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-amber-900 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-[10px] uppercase">อาการขัดข้องตามส่งเรื่อง:</span>
                  <p className="font-semibold text-xs mt-0.5 italic">"{editingRepair.reportedProblem}"</p>
                </div>
                {editingRepair.needsBackup && (
                  <div className="bg-amber-600 text-white font-extrabold text-[10px] px-2 py-1 rounded-md animate-pulse shrink-0">
                    ต้องการเครื่องสำรองด่วน
                  </div>
                )}
              </div>

              {/* Editable Dates & Reporter Name Block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-sky-50/60 p-3.5 rounded-xl border border-sky-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                    <Calendar size={13} className="text-sky-600" />
                    <span>วันที่รับเรื่อง / วันที่ตรวจวินิจฉัย * (แก้ไขได้)</span>
                  </label>
                  <input
                    type="date"
                    value={editRequestDate}
                    onChange={(e) => setEditRequestDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                    <User size={13} className="text-sky-600" />
                    <span>ชื่อผู้แจ้งซ่อม (หอผู้ป่วย)</span>
                  </label>
                  <input
                    type="text"
                    value={editReporterName}
                    onChange={(e) => setEditReporterName(e.target.value)}
                    placeholder="เช่น พยาบาลประจำหอผู้ป่วย..."
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Checklist Section Table */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <UserCheck size={15} className="text-sky-600" />
                    <span>เช็คลิสต์ตรวจเช็คตามใบฟอร์มมาตรฐาน</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">เลือกผลการตรวจในแต่ละรายการ</span>
                </h4>
                
                <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                        <th className="py-2.5 px-3 w-14 text-center border-r border-slate-200">ข้อ</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">รายการตรวจเช็คตามมาตรฐาน</th>
                        <th className="py-2.5 px-3 text-center w-60">ผลการตรวจเช็ค</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80">
                      {[
                        { id: 'cleanliness', num: '1.1', label: 'วัสดุตัวเครื่องและความสะอาด', val: cleanliness, set: setCleanliness },
                        { id: 'buttons', num: '1.2', label: 'ปุ่มเปิด/ปิด และปุ่มกด', val: buttons, set: setButtons },
                        { id: 'stripSlot', num: '1.3', label: 'ช่องเสียบแถบตรวจ Strip', val: stripSlot, set: setStripSlot },
                        { id: 'batterySlot', num: '1.4', label: 'ช่องใส่ถ่าน/ฝาปิด', val: batterySlot, set: setBatterySlot },
                        { id: 'battery', num: '2.0', label: 'ถ่าน / พลังงาน (Battery)', val: battery, set: setBattery },
                        { id: 'screen', num: '3.0', label: 'การแสดงผลหน้าจอ (Screen)', val: screen, set: setScreen },
                        { id: 'measurement', num: '4.0', label: 'การตรวจวัดค่าและผลค่าตรวจ (Glucose)', val: measurement, set: setMeasurement },
                        { id: 'iqc', num: '5.0', label: 'การทดสอบ IQC 3 Level ผ่านเกณฑ์', val: iqc, set: setIqc },
                        { id: 'intercomparison', num: '6.0', label: 'Intercomparison ผ่านเกณฑ์', val: intercomparison, set: setIntercomparison },
                      ].map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-500 border-r border-slate-200">{item.num}</td>
                          <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-200">{item.label}</td>
                          <td className="py-1.5 px-3 text-center">
                            <div className="inline-flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                              {(['pass', 'fail', 'pending'] as const).map((opt) => {
                                let activeStyle = '';
                                let optLabel = '';
                                if (opt === 'pass') {
                                  optLabel = 'ผ่าน';
                                  activeStyle = item.val === 'pass' ? 'bg-emerald-600 text-white shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900';
                                } else if (opt === 'fail') {
                                  optLabel = 'ไม่ผ่าน';
                                  activeStyle = item.val === 'fail' ? 'bg-rose-600 text-white shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900';
                                } else {
                                  optLabel = 'ยังไม่ระบุ';
                                  activeStyle = item.val === 'pending' ? 'bg-slate-500 text-white shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900';
                                }
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => item.set(opt)}
                                    className={`px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer ${activeStyle}`}
                                  >
                                    {optLabel}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Diagnosis and Action Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Diagnosed Problem */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">สาเหตุที่ตรวจพบหลังแกะเครื่องเช็ค (Diagnosed Problem) *</label>
                  <input
                    type="text"
                    placeholder="เช่น แบตเตอรี่เสื่อม หรือ เสียบแผ่นตรวจไม่ตรงช่องขาล็อคสปริง"
                    value={editDiagnosed}
                    onChange={(e) => setEditDiagnosed(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500"
                    required
                  />
                  <p className="text-[9px] text-slate-400">* เพื่อรวบรวมสถิติข้อผิดพลาดหลักของกลุ่มงาน</p>
                </div>

                {/* Inspection Result */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">ผลการตรวจสอบ (Inspection Result)</label>
                  <input
                    type="text"
                    placeholder="เช่น ค่าความคลาดเคลื่อนเกินเกณฑ์, เซนเซอร์ตอบสนองช้า"
                    value={editInspection}
                    onChange={(e) => setEditInspection(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500"
                  />
                </div>
                
                {/* Action Details */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">รายละเอียดการดำเนินการ (Action Details)</label>
                  <input
                    type="text"
                    placeholder="ระบุรายละเอียดเพิ่มเติมของการซ่อม"
                    value={editActionDetails}
                    onChange={(e) => setEditActionDetails(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500"
                  />
                </div>

                {/* Checklist Remarks */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">7. อื่น ๆ / หมายเหตุประกอบการบำรุงรักษา</label>
                  <input
                    type="text"
                    placeholder="เช่น ขัดเช็ดขั้วถ่านที่คราบสนิม ดันแผ่นขั้วให้ตรง"
                    value={others}
                    onChange={(e) => setOthers(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Action Taken Multi-Select Section */}
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <CheckCircle2 size={15} className="text-sky-600" />
                    <span>สรุปการดำเนินการ (เลือกได้มากกว่า 1) *</span>
                  </label>
                  <span className="text-[10px] text-slate-500">เลือกทุกมาตรการที่ปฏิบัติจริง</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {AVAILABLE_REPAIR_ACTIONS.map((act) => {
                    const isSelected = editActions.includes(act.id);
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setEditActions(editActions.filter(a => a !== act.id));
                          } else {
                            setEditActions([...editActions, act.id]);
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300 hover:bg-sky-50/50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white border-white text-sky-600' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span className="truncate">{act.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs">
                {/* Repair Status */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">อัปเดตสถานะงานแจ้งซ่อม *</label>
                  <CustomSelect
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-bold"
                    required
                  >
                    <option value="pending">รอดำเนินการ (Pending)</option>
                    <option value="repairing">กำลังดำเนินการตรวจบำรุง (Repairing)</option>
                    <option value="waiting_claim">รอส่งเคลมบริษัท</option>
                    <option value="claimed">ส่งเคลมบริษัทภายนอกเรียบร้อย</option>
                    <option value="completed">เสร็จสิ้น/ส่งคืน Ward (Completed)</option>
                  </CustomSelect>
                </div>

                {/* Operator Staff */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">ชื่อนักเทคนิคการแพทย์ผู้ซ่อม *</label>
                  <input
                    type="text"
                    placeholder="เช่น ทนพ. สมชาย ดีเลิศ"
                    value={editOperator}
                    onChange={(e) => setEditOperator(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    required
                  />
                </div>

                {/* Receiver Staff */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">ชื่อผู้รับมอบเครื่องคืน</label>
                  <input
                    type="text"
                    placeholder="เช่น พยาบาลประจำหอผู้ป่วย"
                    value={editReceiver}
                    onChange={(e) => setEditReceiver(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  />
                </div>

                {/* Completion Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">วันที่ซ่อมเสร็จ / ส่งคืน *</label>
                  <input
                    type="date"
                    value={editCompletionDate}
                    onChange={(e) => setEditCompletionDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-bold"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDeleteSingleRepair(editingRepair.id)}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3.5 py-2.5 rounded-lg flex items-center space-x-1 text-xs cursor-pointer transition-colors"
                >
                  <Trash2 size={14} />
                  <span>ลบรายการนี้</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingRepair(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-2.5 rounded-lg flex items-center space-x-1 cursor-pointer shadow-md shadow-sky-500/20"
                  >
                    <Check size={14} />
                    <span>บันทึกและส่งรายงานซ่อม</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Add New / Retroactive Repair Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" id="add-repair-modal">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 my-8 animate-scale-up">
            <div className="bg-slate-950 text-white p-4.5 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm flex items-center space-x-2">
                  <Plus size={16} className="text-sky-400" />
                  <span>บันทึกข้อมูลการแจ้งซ่อม (Admin / ลงประวัติย้อนหลัง)</span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  สามารถเลือกวันที่แจ้งย้อนหลัง และบันทึกผลการปิดงานซ่อมเสร็จสิ้นได้ทันที
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewRepair} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs">
              {/* Row 1: Date & Machine Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                    <Calendar size={13} className="text-sky-600" />
                    <span>วันที่แจ้งส่งซ่อม * (ลงย้อนหลังได้)</span>
                  </label>
                  <input
                    type="date"
                    value={newRequestDate}
                    onChange={(e) => setNewRequestDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:ring-1 focus:ring-sky-500"
                    required
                  />
                </div>

                <div className="space-y-1 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <span>เลือกเครื่อง DTX *</span>
                      <span className="text-[10px] text-sky-600 font-normal">(ค้นหาได้)</span>
                    </label>
                    {newSelectedMachine && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewSelectedMachine('');
                          setNewCustomCode('');
                          setNewMachineSerial('');
                          setIsMachineSearchOpen(true);
                        }}
                        className="text-[10px] text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                      >
                        ล้างเครื่องที่เลือก
                      </button>
                    )}
                  </div>

                  {/* Selected Machine Card View or Search Trigger Button */}
                  {newSelectedMachine && newSelectedMachine !== 'CUSTOM' ? (
                    <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/80 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className="font-mono font-black text-sky-800 bg-white px-2.5 py-1 rounded-lg border border-sky-200 text-xs shadow-3xs shrink-0">
                          {newCustomCode || newSelectedMachine}
                        </span>
                        <div className="truncate text-left">
                          {newMachineSerial && (
                            <div className="font-mono text-[11px] text-slate-600 truncate">
                              S/N: {newMachineSerial}
                            </div>
                          )}
                          {newWard && (
                            <div className="text-[10px] text-sky-700 font-bold truncate">
                              Ward: {newWard}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setMachineSearchTerm('');
                            setIsMachineSearchOpen(true);
                          }}
                          className="text-xs text-sky-700 hover:text-sky-900 font-bold px-2.5 py-1.5 bg-white hover:bg-sky-100/70 rounded-lg border border-sky-200 cursor-pointer transition-all flex items-center space-x-1 shadow-3xs"
                        >
                          <Search size={13} className="text-sky-600" />
                          <span>เปลี่ยนเครื่อง</span>
                        </button>
                      </div>
                    </div>
                  ) : newSelectedMachine === 'CUSTOM' ? (
                    <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/80 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-amber-900">+ ระบุรหัสเครื่องเอง (เครื่องนอกระบบ)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMachineSearchTerm('');
                          setIsMachineSearchOpen(true);
                        }}
                        className="text-xs text-amber-800 hover:text-amber-950 font-bold px-2.5 py-1.5 bg-white rounded-lg border border-amber-200 cursor-pointer shrink-0 flex items-center space-x-1 shadow-3xs"
                      >
                        <Search size={13} className="text-amber-600" />
                        <span>ค้นหาเครื่องในระบบ</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMachineSearchTerm('');
                        setIsMachineSearchOpen(true);
                      }}
                      className="w-full text-left text-xs p-3 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/50 hover:bg-sky-100/60 text-sky-800 font-bold flex items-center justify-between cursor-pointer transition-all shadow-3xs group"
                    >
                      <span className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-lg bg-sky-100 group-hover:bg-sky-200 flex items-center justify-center text-sky-700">
                          <Search size={14} />
                        </div>
                        <span>กดค้นหาเครื่อง DTX ({machines.length} เครื่องในระบบ)...</span>
                      </span>
                      <span className="text-[11px] bg-sky-600 group-hover:bg-sky-700 text-white px-2.5 py-1 rounded-lg font-black shadow-xs">
                        ค้นหาเครื่อง
                      </span>
                    </button>
                  )}

                  {/* Dedicated Search DTX Machine Modal Dialog */}
                  {isMachineSearchOpen && (
                    <div 
                      className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fade-in"
                      onClick={() => setIsMachineSearchOpen(false)}
                    >
                      <div 
                        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up text-left"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Modal Header */}
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Search size={16} className="text-sky-400" />
                            <div>
                              <h4 className="font-bold text-xs">ค้นหาและเลือกเครื่อง DTX สำหรับแจ้งซ่อม</h4>
                              <p className="text-[10px] text-slate-400">ค้นหาด้วย BGM Code, Serial Number, หรือ Ward</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsMachineSearchOpen(false)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Search Input Bar */}
                        <div className="p-3 border-b border-slate-100 bg-slate-50 space-y-2">
                          <div className="relative">
                            <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
                            <input
                              type="text"
                              autoFocus
                              placeholder="พิมพ์ค้นหารหัสเครื่อง เช่น BGM-01, S/N, หรือ Ward..."
                              value={machineSearchTerm}
                              onChange={(e) => setMachineSearchTerm(e.target.value)}
                              className="w-full text-xs p-2.5 pl-9 pr-8 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-sky-500 font-medium shadow-3xs"
                            />
                            {machineSearchTerm && (
                              <button
                                type="button"
                                onClick={() => setMachineSearchTerm('')}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                            <span>ผลการค้นหา: <strong className="text-sky-700">{filteredMachinesForSearch.length}</strong> เครื่อง (ทั้งหมด {machines.length})</span>
                            {machineSearchTerm && (
                              <button
                                type="button"
                                onClick={() => setMachineSearchTerm('')}
                                className="text-[10px] text-sky-600 font-bold hover:underline cursor-pointer"
                              >
                                ล้างคำค้นหา
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Machine List */}
                        <div className="p-3 overflow-y-auto divide-y divide-slate-100 space-y-1 flex-1">
                          {filteredMachinesForSearch.length === 0 ? (
                            <div className="py-8 text-center space-y-2">
                              <p className="text-slate-400 text-xs">ไม่พบเครื่องที่ตรงกับ "{machineSearchTerm}"</p>
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectMachineForAdd('CUSTOM');
                                  setNewCustomCode(machineSearchTerm);
                                  setIsMachineSearchOpen(false);
                                  setMachineSearchTerm('');
                                }}
                                className="text-xs text-sky-600 hover:text-sky-800 font-bold underline cursor-pointer"
                              >
                                ใช้ "{machineSearchTerm}" เป็นรหัสเครื่องนอกระบบ
                              </button>
                            </div>
                          ) : (
                            filteredMachinesForSearch.map((m) => {
                              const isSelected = (newCustomCode || newSelectedMachine) === m.serialNumber;
                              return (
                                <div
                                  key={m.id || m.serialNumber}
                                  onClick={() => {
                                    handleSelectMachineForAdd(m.serialNumber);
                                    setIsMachineSearchOpen(false);
                                    setMachineSearchTerm('');
                                  }}
                                  className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                    isSelected 
                                      ? 'bg-sky-50 border border-sky-300' 
                                      : 'hover:bg-slate-50 border border-transparent'
                                  }`}
                                >
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-mono font-black text-xs text-sky-900 bg-sky-100/80 px-2 py-0.5 rounded border border-sky-200">
                                        {m.serialNumber}
                                      </span>
                                      {m.ward && (
                                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold truncate">
                                          {m.ward}
                                        </span>
                                      )}
                                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                        m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                      }`}>
                                        {m.status || 'active'}
                                      </span>
                                    </div>
                                    <div className="font-mono text-[11px] text-slate-500 truncate flex items-center space-x-2">
                                      {m.machineSerial && <span>S/N: {m.machineSerial}</span>}
                                      {m.brand && <span>• {m.brand} {m.model || ''}</span>}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className={`text-xs px-3 py-1.5 rounded-lg font-bold shrink-0 transition-all ${
                                      isSelected
                                        ? 'bg-sky-600 text-white'
                                        : 'bg-slate-100 hover:bg-sky-600 hover:text-white text-slate-700'
                                    }`}
                                  >
                                    {isSelected ? 'เลือกอยู่' : 'เลือกเครื่องนี้'}
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectMachineForAdd('CUSTOM');
                              setIsMachineSearchOpen(false);
                              setMachineSearchTerm('');
                            }}
                            className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center space-x-1 cursor-pointer"
                          >
                            <Plus size={14} />
                            <span>+ ระบุรหัสเครื่องเอง (เครื่องนอกระบบ)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsMachineSearchOpen(false)}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer shadow-3xs"
                          >
                            ปิดหน้าต่าง
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Machine inputs if selected CUSTOM */}
              {newSelectedMachine === 'CUSTOM' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-sky-50/60 rounded-xl border border-sky-100 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700">รหัสเครื่อง (BGM Code) *</label>
                    <input
                      type="text"
                      placeholder="เช่น BGM-01"
                      value={newCustomCode}
                      onChange={(e) => setNewCustomCode(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono font-bold uppercase"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700">หมายเลขซีเรียล (Serial Number)</label>
                    <input
                      type="text"
                      placeholder="เช่น NC123456"
                      value={newMachineSerial}
                      onChange={(e) => setNewMachineSerial(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Row 2: Ward & Reporter Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">หน่วยงาน / Ward ที่ส่งซ่อม *</label>
                  <CustomSelect
                    value={newWard}
                    onChange={(e) => setNewWard(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-bold"
                    required
                  >
                    <option value="">-- เลือกหน่วยงาน / หอผู้ป่วย --</option>
                    {wards.map((w, idx) => (
                      <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                    ))}
                  </CustomSelect>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">ชื่อผู้แจ้งซ่อม</label>
                  <input
                    type="text"
                    value={newReporterName}
                    onChange={(e) => setNewReporterName(e.target.value)}
                    placeholder="เช่น เจ้าหน้าที่ประจำหอผู้ป่วย"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              {/* Row 3: Reporter Phone & Needs Backup */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">เบอร์โทรศัพท์ติดต่อ</label>
                  <input
                    type="tel"
                    value={newReporterPhone}
                    onChange={(e) => setNewReporterPhone(e.target.value)}
                    placeholder="เช่น 1102 หรือ 081-xxx-xxxx"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newNeedsBackup}
                      onChange={(e) => setNewNeedsBackup(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                    />
                    <span>ขอเบิกเครื่องสำรองใช้งานชั่วคราว</span>
                  </label>
                </div>
              </div>

              {/* Row 4: Reported Problem */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700">อาการเสีย / ปัญหาที่พบตามแจ้ง *</label>
                <textarea
                  rows={2}
                  value={newReportedProblem}
                  onChange={(e) => setNewReportedProblem(e.target.value)}
                  placeholder="ระบุอาการเสีย เช่น เครื่องเปิดไม่ติด, Error E-1, ช่องอ่านแผ่นตรวจขัดข้อง..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-1 focus:ring-sky-500"
                  required
                />
                {/* Quick tags */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-400 font-bold">อาการที่พบบ่อย:</span>
                  {[
                    "เครื่องเปิดไม่ติด",
                    "Error E-1 / E-2",
                    "อ่านค่าไม่ได้/ค้าง",
                    "ช่องใส่แผ่นตรวจขัดข้อง",
                    "ฝาปิดถ่านชำรุด",
                    "หน้าจอดับ/จอจาง",
                    "ผลตรวจคลาดเคลื่อน",
                    "ส่งสอบเทียบ/ตรวจเช็คประจำปี"
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setNewReportedProblem(prev => prev ? `${prev}, ${tag}` : tag);
                      }}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 5: Initial Status */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-700">สถานะของงานซ่อม *</label>
                <CustomSelect
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-bold"
                  required
                >
                  <option value="pending">รอดำเนินการ (ยังไม่เริ่มซ่อม)</option>
                  <option value="repairing">กำลังดำเนินการตรวจบำรุง (Repairing)</option>
                  <option value="waiting_claim">รอส่งเคลมบริษัท / รออะไหล่</option>
                  <option value="claimed">ส่งเคลมบริษัทเรียบร้อย</option>
                  <option value="completed">เสร็จสิ้น / ส่งคืน Ward แล้ว (สมบูรณ์)</option>
                </CustomSelect>
              </div>

              {/* Completed / Retroactive Details Section */}
              {newStatus === 'completed' && (
                <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 space-y-4 animate-fade-in">
                  <div className="flex items-center space-x-2 text-emerald-900 border-b border-emerald-200/60 pb-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span className="font-extrabold text-xs">ข้อมูลการปิดงานซ่อม / บันทึกผลการตรวจซ่อมย้อนหลัง</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700">วันที่ซ่อมเสร็จ / ส่งคืน *</label>
                      <input
                        type="date"
                        value={newCompletionDate}
                        onChange={(e) => setNewCompletionDate(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-bold"
                        required
                      />
                    </div>
                    <div className="space-y-1.5 col-span-full">
                      <label className="text-[10px] font-bold text-slate-700 flex items-center justify-between">
                        <span>สรุปการดำเนินการตรวจซ่อม (เลือกได้มากกว่า 1)</span>
                        <span className="text-[9px] text-slate-500 font-normal">คลิกเลือกมาตรการ</span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
                        {AVAILABLE_REPAIR_ACTIONS.map((act) => {
                          const isSelected = newActionsTaken.includes(act.id);
                          return (
                            <button
                              key={act.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setNewActionsTaken(newActionsTaken.filter(a => a !== act.id));
                                } else {
                                  setNewActionsTaken([...newActionsTaken, act.id]);
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border text-left flex items-center space-x-1.5 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50/60'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-white border-white text-sky-600' : 'border-slate-300 bg-white'
                              }`}>
                                {isSelected && <Check size={10} strokeWidth={3} />}
                              </div>
                              <span className="truncate">{act.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700">ปัญหาที่พบหลังการตรวจสอบ (Diagnosis)</label>
                    <input
                      type="text"
                      value={newDiagnosedProblem}
                      onChange={(e) => setNewDiagnosedProblem(e.target.value)}
                      placeholder="เช่น ขั้วแบตเตอรี่สัมผัสไม่ดี, ทำความสะอาดหัวอ่าน Sensor, แบตเตอรี่เสื่อม"
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-700">รายละเอียดการดำเนินการ / อะไหล่ที่เปลี่ยน</label>
                    <textarea
                      rows={2}
                      value={newActionDetails}
                      onChange={(e) => setNewActionDetails(e.target.value)}
                      placeholder="เช่น ทำความสะอาดขั้วต่อ, ทดสอบตรวจ QC ผ่านทั้ง 3 ระดับ พร้อมใช้งาน"
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700">ชื่อนักเทคนิคการแพทย์ผู้ซ่อม *</label>
                      <input
                        type="text"
                        value={newOperatorName}
                        onChange={(e) => setNewOperatorName(e.target.value)}
                        placeholder="เช่น ทนพ. สมชาย ดีเลิศ"
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-medium"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700">ชื่อผู้รับมอบเครื่องคืน</label>
                      <input
                        type="text"
                        value={newReceiverName}
                        onChange={(e) => setNewReceiverName(e.target.value)}
                        placeholder="เช่น พยาบาลประจำหอผู้ป่วย"
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewRepair}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-extrabold px-6 py-2.5 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-md shadow-sky-500/20 disabled:opacity-50 transition-all"
                >
                  {isSubmittingNewRepair ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>กำลังบันทึกข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>บันทึกข้อมูลแจ้งซ่อม</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Render Print Preview overlay if requested */}
      {(printingRepair || batchPrintRepairs) && (
        <PrintForm
          repair={printingRepair || undefined}
          repairs={batchPrintRepairs || undefined}
          onClose={() => {
            setPrintingRepair(null);
            setBatchPrintRepairs(null);
          }}
        />
      )}

      {/* Universal Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 animate-scale-in">
            <div className="flex items-center space-x-3 text-rose-600">
              <ShieldAlert size={26} />
              <h3 className="font-extrabold text-base text-slate-900">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs font-medium text-slate-600 leading-relaxed">{confirmDialog.description}</p>
            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => confirmDialog.onConfirm()}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm cursor-pointer transition-colors ${confirmDialog.confirmButtonClass || 'bg-rose-600 hover:bg-rose-700 text-white'}`}
              >
                {confirmDialog.confirmText || 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
