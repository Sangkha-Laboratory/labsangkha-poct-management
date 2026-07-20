/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RepairRequest } from '../types';
import { INITIAL_WARDS } from '../mockData';
import PrintForm from './PrintForm';
import { Search, Edit, FileText, Printer, Check, X, ShieldAlert, AlertCircle, Wrench, RefreshCw, UserCheck } from 'lucide-react';

interface RepairManagementProps {
  repairs: RepairRequest[];
  onUpdateRepair: (repair: RepairRequest) => void;
  lineNotifyToken: string;
}

export default function RepairManagement({ repairs, onUpdateRepair, lineNotifyToken }: RepairManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWard, setFilterWard] = useState('');

  // Selected repair for editing or printing
  const [editingRepair, setEditingRepair] = useState<RepairRequest | null>(null);
  const [printingRepair, setPrintingRepair] = useState<RepairRequest | null>(null);

  // Edit form states
  const [editStatus, setEditStatus] = useState<RepairRequest['status']>('pending');
  const [editDiagnosed, setEditDiagnosed] = useState('');
  const [editAction, setEditAction] = useState<RepairRequest['actionTaken']>('none');
  const [editOperator, setEditOperator] = useState('');
  const [editReceiver, setEditReceiver] = useState('');
  
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

  // Simulation LINE message popups
  const [simLineMsg, setSimLineMsg] = useState<string | null>(null);

  const startEdit = (rep: RepairRequest) => {
    setEditingRepair(rep);
    setEditStatus(rep.status);
    setEditDiagnosed(rep.diagnosedProblem || '');
    setEditAction(rep.actionTaken || 'none');
    setEditOperator(rep.operatorName || 'ทนพ. สมชาย ดีเลิศ');
    setEditReceiver(rep.receiverName || rep.reporterName);

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

    const updated: RepairRequest = {
      ...editingRepair,
      status: editStatus,
      diagnosedProblem: editDiagnosed.trim(),
      actionTaken: editAction,
      operatorName: editOperator.trim(),
      receiverName: editReceiver.trim(),
      completionDate: editStatus === 'completed' ? new Date().toISOString().split('T')[0] : undefined,
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
      setSimLineMsg(`🔔 [อัปเดตสถานะแจ้งซ่อม] รหัสงาน: ${updated.id}\nเครื่อง: ${updated.serialNumber} (${updated.ward})\nสถานะ: ${lineStatusText}\nผู้ดำเนินการ: ${editOperator}`);
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
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800">เสร็จสิ้น/ส่งคืนวอร์ด</span>;
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
      <div className="border-b border-slate-100 pb-5">
        <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
          <Wrench size={20} className="text-sky-600" />
          <span>จัดการคำขอแจ้งซ่อมและบันทึกประวัติการบำรุงรักษา</span>
        </h2>
        <p className="text-xs text-slate-400">
          ลงข้อมูลซ่อมบำรุง บันทึกปัญหาที่พบล่าสุด แปลงข้อมูลสลับเข้าฟอร์มมาตรฐานของกลุ่มงานเทคนิคการแพทย์ และปริ้นส่งรายงานได้ทันที
        </p>
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
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
          >
            <option value="">-- สถานะแจ้งซ่อมทั้งหมด --</option>
            <option value="pending">รอดำเนินการ (Pending)</option>
            <option value="repairing">กำลังซ่อม (Repairing)</option>
            <option value="waiting_claim">รอส่งเคลมบริษัท</option>
            <option value="claimed">ส่งเคลมแล้ว</option>
            <option value="completed">เสร็จสิ้น/ส่งคืนวอร์ด (Completed)</option>
          </select>
        </div>

        <div>
          <select
            value={filterWard}
            onChange={(e) => setFilterWard(e.target.value)}
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
          >
            <option value="">-- แผนกส่งซ่อมทั้งหมด --</option>
            {INITIAL_WARDS.map((w, idx) => (
              <option key={idx} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Repair List Table */}
      <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white" id="repairs-table-container">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
              <th className="p-4">เลขแจ้งซ่อม</th>
              <th className="p-4">รหัสเครื่อง DTX</th>
              <th className="p-4">หน่วยงานที่ส่ง</th>
              <th className="p-4">อาการเสียตามแจ้ง</th>
              <th className="p-4">วันที่แจ้ง</th>
              <th className="p-4">สถานะการดำเนินงาน</th>
              <th className="p-4 text-center">พิมพ์รายงาน/ดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRepairs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-slate-400">
                  ไม่มีประวัติแจ้งซ่อมบำรุงที่ตรงเงื่อนไขการกรอง
                </td>
              </tr>
            ) : (
              filteredRepairs.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50/50 transition-colors">
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
                  <td className="p-4 text-slate-500">{rep.requestDate}</td>
                  <td className="p-4">{getStatusBadge(rep.status)}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => startEdit(rep)}
                        className="p-1.5 hover:bg-sky-50 text-sky-600 rounded-lg hover:text-sky-500 transition-colors font-bold text-[11px] flex items-center space-x-1"
                        title="กรอกข้อมูลวิเคราะห์/ซ่อม"
                      >
                        <Edit size={13} />
                        <span>ลงข้อมูลซ่อม</span>
                      </button>

                      <button
                        onClick={() => setPrintingRepair(rep)}
                        className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg hover:text-emerald-500 transition-colors font-bold text-[11px] flex items-center space-x-1"
                        title="เปิดฟอร์มพิมพ์รายงานการซ่อมบำรุง"
                      >
                        <Printer size={13} />
                        <span>ปริ้นฟอร์ม</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
                    ⚠️ ต้องการเครื่องสำรองด่วน
                  </div>
                )}
              </div>

              {/* Checklist Section Grid */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-1 flex items-center">
                  <UserCheck size={14} className="mr-1 text-sky-600" />
                  <span>เช็คลิสต์ตรวจเช็คตามใบฟอร์มมาตรฐาน</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2.5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  {/* Cleanliness */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">1.1. ความสะอาดวัสดุตัวเครื่อง</span>
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                      {(['pass', 'fail', 'pending'] as const).map(opt => (
                        <button key={opt} type="button" onClick={() => setCleanliness(opt)} className={`px-2 py-1 text-[10px] font-bold rounded ${cleanliness === opt ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500'}`}>
                          {opt === 'pass' ? 'ผ่าน' : opt === 'fail' ? 'ไม่ผ่าน' : 'ยังไม่ระบุ'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">1.2. ปุ่มเปิด/ปิด และปุ่มกด</span>
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                      {(['pass', 'fail', 'pending'] as const).map(opt => (
                        <button key={opt} type="button" onClick={() => setButtons(opt)} className={`px-2 py-1 text-[10px] font-bold rounded ${buttons === opt ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500'}`}>
                          {opt === 'pass' ? 'ผ่าน' : opt === 'fail' ? 'ไม่ผ่าน' : 'ยังไม่ระบุ'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Strip slot */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">1.3. ช่องเสียบแถบตรวจ Strip</span>
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                      {(['pass', 'fail', 'pending'] as const).map(opt => (
                        <button key={opt} type="button" onClick={() => setStripSlot(opt)} className={`px-2 py-1 text-[10px] font-bold rounded ${stripSlot === opt ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500'}`}>
                          {opt === 'pass' ? 'ผ่าน' : opt === 'fail' ? 'ไม่ผ่าน' : 'ยังไม่ระบุ'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Battery slot */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">1.4. ช่องใส่ถ่าน/ฝาปิด</span>
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                      {(['pass', 'fail', 'pending'] as const).map(opt => (
                        <button key={opt} type="button" onClick={() => setBatterySlot(opt)} className={`px-2 py-1 text-[10px] font-bold rounded ${batterySlot === opt ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500'}`}>
                          {opt === 'pass' ? 'ผ่าน' : opt === 'fail' ? 'ไม่ผ่าน' : 'ยังไม่ระบุ'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Battery */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">2. ถ่าน / พลังงาน</span>
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                      {(['pass', 'fail', 'pending'] as const).map(opt => (
                        <button key={opt} type="button" onClick={() => setBattery(opt)} className={`px-2 py-1 text-[10px] font-bold rounded ${battery === opt ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500'}`}>
                          {opt === 'pass' ? 'ดี/เปลี่ยนแล้ว' : opt === 'fail' ? 'หมด/เสื่อม' : 'ยังไม่ระบุ'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Screen */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">3. หน้าจอแสดงผล</span>
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                      {(['pass', 'fail', 'pending'] as const).map(opt => (
                        <button key={opt} type="button" onClick={() => setScreen(opt)} className={`px-2 py-1 text-[10px] font-bold rounded ${screen === opt ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500'}`}>
                          {opt === 'pass' ? 'ผ่าน' : opt === 'fail' ? 'ไม่ผ่าน' : 'ยังไม่ระบุ'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Measurement */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">4. ผลค่าตรวจวัด (Glucose)</span>
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                      {(['pass', 'fail', 'pending'] as const).map(opt => (
                        <button key={opt} type="button" onClick={() => setMeasurement(opt)} className={`px-2 py-1 text-[10px] font-bold rounded ${measurement === opt ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500'}`}>
                          {opt === 'pass' ? 'ปกติ' : opt === 'fail' ? 'คลาดเคลื่อน' : 'ยังไม่ระบุ'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* IQC */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">5. การทดสอบ IQC 3 Level</span>
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                      {(['pass', 'fail', 'pending'] as const).map(opt => (
                        <button key={opt} type="button" onClick={() => setIqc(opt)} className={`px-2 py-1 text-[10px] font-bold rounded ${iqc === opt ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500'}`}>
                          {opt === 'pass' ? 'ผ่าน' : opt === 'fail' ? 'หลุดเกณฑ์' : 'ยังไม่ระบุ'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Intercomparison */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">6. Intercomparison</span>
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                      {(['pass', 'fail', 'pending'] as const).map(opt => (
                        <button key={opt} type="button" onClick={() => setIntercomparison(opt)} className={`px-2 py-1 text-[10px] font-bold rounded ${intercomparison === opt ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500'}`}>
                          {opt === 'pass' ? 'ผ่าน' : opt === 'fail' ? 'ไม่ผ่าน' : 'ยังไม่ระบุ'}
                        </button>
                      ))}
                    </div>
                  </div>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl">
                {/* Action Taken */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">สรุปการดำเนินการ *</label>
                  <select
                    value={editAction}
                    onChange={(e) => setEditAction(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    required
                  >
                    <option value="none">-- เลือกมาตรการ --</option>
                    <option value="change_battery">เปลี่ยนถ่าน (Change Battery)</option>
                    <option value="return_original">คืนเครื่องเดิม (Return Device)</option>
                    <option value="provide_new">จ่ายเครื่องใหม่ทดแทน (Provide New)</option>
                  </select>
                </div>

                {/* Repair Status */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">อัปเดตสถานะงานแจ้งซ่อม *</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-bold"
                    required
                  >
                    <option value="pending">รอดำเนินการ (Pending)</option>
                    <option value="repairing">กำลังดำเนินการตรวจบำรุง (Repairing)</option>
                    <option value="waiting_claim">รอส่งเคลมบริษัท</option>
                    <option value="claimed">ส่งเคลมบริษัทภายนอกเรียบร้อย</option>
                    <option value="completed">เสร็จสิ้น/ส่งคืนวอร์ด (Completed)</option>
                  </select>
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
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingRepair(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-2.5 rounded-lg flex items-center space-x-1"
                >
                  <Check size={14} />
                  <span>บันทึกและส่งรายงานซ่อม</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Render Print Preview overlay if requested */}
      {printingRepair && (
        <PrintForm
          repair={printingRepair}
          onClose={() => setPrintingRepair(null)}
        />
      )}
    </div>
  );
}
