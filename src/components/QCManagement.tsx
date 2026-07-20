/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { QcRecord, QcLotConfig, DtxMachine } from '../types';
import { INITIAL_WARDS, INITIAL_LOT_CONFIGS } from '../mockData';
import { Plus, Settings, BarChart2, CheckCircle, AlertTriangle, FileText, Download, Sliders, Calendar, User, Eye, Lightbulb } from 'lucide-react';

interface QCManagementProps {
  machines: DtxMachine[];
  qcRecords: QcRecord[];
  lotConfigs: QcLotConfig[];
  onAddQcRecord: (record: QcRecord) => void;
  onUpdateLotConfigs: (configs: QcLotConfig[]) => void;
}

export default function QCManagement({ machines, qcRecords, lotConfigs, onAddQcRecord, onUpdateLotConfigs }: QCManagementProps) {
  const [activeSubTab, setActiveSubTab] = useState<'log' | 'config' | 'chart'>('log');
  
  // Filtering states
  const [filterWard, setFilterWard] = useState('');
  const [filterLot, setFilterLot] = useState('LOT2026-A');
  const [selectedChartLevel, setSelectedChartLevel] = useState<1 | 2 | 3>(1);

  // New Record Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [qcDate, setQcDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [qcWard, setQcWard] = useState('');
  const [qcSerial, setQcSerial] = useState('');
  const [qcOperator, setQcOperator] = useState('');
  const [qcLot, setQcLot] = useState('LOT2026-A');
  const [level1Val, setLevel1Val] = useState('');
  const [level2Val, setLevel2Val] = useState('');
  const [level3Val, setLevel3Val] = useState('');

  // Lot Config editing states
  const [editingLotIdx, setEditingLotIdx] = useState<number | null>(null);
  const [editedLot, setEditedLot] = useState<QcLotConfig | null>(null);

  const handleSerialChange = (serial: string) => {
    setQcSerial(serial);
    const matchedMachine = machines.find(m => m.serialNumber === serial);
    if (matchedMachine) {
      setQcWard(matchedMachine.ward);
      setQcLot(matchedMachine.lotNumber);
    }
  };

  const handleAddQcSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcSerial || !qcOperator || !level1Val || !level2Val || !level3Val) {
      alert('กรุณากรอกข้อมูลและค่าผลการตรวจวัดให้ครบถ้วน');
      return;
    }

    const config = lotConfigs.find(c => c.lotNumber === qcLot);
    if (!config) {
      alert('ไม่พบข้อมูลการกำหนดค่าเป้าหมายล็อตนี้ กรุณาตั้งค่าก่อน');
      return;
    }

    const l1 = Number(level1Val);
    const l2 = Number(level2Val);
    const l3 = Number(level3Val);

    // Calculate Out of Control status (using 3SD i.e. Target +/- 3*SD)
    const level1Status = (l1 < config.level1Target - 3 * config.level1SD || l1 > config.level1Target + 3 * config.level1SD) ? 'out_of_control' : 'normal';
    const level2Status = (l2 < config.level2Target - 3 * config.level2SD || l2 > config.level2Target + 3 * config.level2SD) ? 'out_of_control' : 'normal';
    const level3Status = (l3 < config.level3Target - 3 * config.level3SD || l3 > config.level3Target + 3 * config.level3SD) ? 'out_of_control' : 'normal';

    const newRecord: QcRecord = {
      id: `QC-${Date.now()}`,
      date: qcDate,
      receiveDate,
      returnDate,
      ward: qcWard,
      serialNumber: qcSerial,
      operator: qcOperator,
      lotNumber: qcLot,
      level1: l1,
      level2: l2,
      level3: l3,
      level1Status,
      level2Status,
      level3Status
    };

    onAddQcRecord(newRecord);
    setShowAddForm(false);
    
    // Clear inputs
    setLevel1Val('');
    setLevel2Val('');
    setLevel3Val('');
  };

  const handleStartEditLot = (idx: number) => {
    setEditingLotIdx(idx);
    setEditedLot({ ...lotConfigs[idx] });
  };

  const handleSaveLotConfig = () => {
    if (!editedLot) return;
    const newConfigs = [...lotConfigs];
    newConfigs[editingLotIdx!] = editedLot;
    onUpdateLotConfigs(newConfigs);
    setEditingLotIdx(null);
    setEditedLot(null);
  };

  // Stats Calculations
  const getCalculatedStats = (records: QcRecord[], lot: string, level: 1 | 2 | 3) => {
    const activeLotConfig = lotConfigs.find(c => c.lotNumber === lot);
    const filtered = records.filter(r => r.lotNumber === lot && (filterWard === '' || r.ward === filterWard));
    const values = filtered.map(r => level === 1 ? r.level1 : level === 2 ? r.level2 : r.level3);
    const n = values.length;

    if (n === 0) {
      return { n, mean: 0, sd: 0, cv: 0, outOfControlCount: 0, target: activeLotConfig ? (level === 1 ? activeLotConfig.level1Target : level === 2 ? activeLotConfig.level2Target : activeLotConfig.level3Target) : 0 };
    }

    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    
    let sd = 0;
    if (n > 1) {
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
      sd = Math.sqrt(variance);
    }
    
    const cv = mean > 0 ? (sd / mean) * 100 : 0;

    // Out of control count based on Lot Config target +/- 3SD
    let outOfControlCount = 0;
    if (activeLotConfig) {
      const target = level === 1 ? activeLotConfig.level1Target : level === 2 ? activeLotConfig.level2Target : activeLotConfig.level3Target;
      const targetSD = level === 1 ? activeLotConfig.level1SD : level === 2 ? activeLotConfig.level2SD : activeLotConfig.level3SD;
      outOfControlCount = values.filter(v => v < target - 3 * targetSD || v > target + 3 * targetSD).length;
    }

    return {
      n,
      mean: Math.round(mean * 100) / 100,
      sd: Math.round(sd * 100) / 100,
      cv: Math.round(cv * 100) / 100,
      outOfControlCount,
      target: activeLotConfig ? (level === 1 ? activeLotConfig.level1Target : level === 2 ? activeLotConfig.level2Target : activeLotConfig.level3Target) : 0
    };
  };

  const level1Stats = getCalculatedStats(qcRecords, filterLot, 1);
  const level2Stats = getCalculatedStats(qcRecords, filterLot, 2);
  const level3Stats = getCalculatedStats(qcRecords, filterLot, 3);

  // Filtered QC records for table display
  const tableRecords = qcRecords.filter(r => 
    (filterWard === '' || r.ward === filterWard) &&
    (filterLot === '' || r.lotNumber === filterLot)
  ).sort((a, b) => b.date.localeCompare(a.date));

  // CSV/JSON Export Helper
  const handleExportCSV = () => {
    const headers = ['วันที่ทำ QC', 'รับเครื่อง', 'ส่งคืนเครื่อง', 'หน่วยงาน', 'รหัสเครื่อง DTX', 'ล็อตน้ำยา', 'ผู้ตรวจ', 'Level 1', 'Level 1 สถานะ', 'Level 2', 'Level 2 สถานะ', 'Level 3', 'Level 3 สถานะ'];
    const csvRows = [headers.join(',')];

    tableRecords.forEach(r => {
      const row = [
        r.date,
        r.receiveDate,
        r.returnDate,
        `"${r.ward}"`,
        r.serialNumber,
        r.lotNumber,
        `"${r.operator}"`,
        r.level1,
        r.level1Status === 'out_of_control' ? 'Out of Control' : 'Normal',
        r.level2,
        r.level2Status === 'out_of_control' ? 'Out of Control' : 'Normal',
        r.level3,
        r.level3Status === 'out_of_control' ? 'Out of Control' : 'Normal'
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `QC_Summary_${filterLot || 'All'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="qc-management-panel">
      {/* Tab Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <BarChart2 size={20} className="text-sky-600" />
            <span>ระบบบันทึกและคำนวณสถิติควบคุมคุณภาพ (QC 3 Level POCT)</span>
          </h2>
          <p className="text-xs text-slate-400">บันทึกค่าควบคุมคุณภาพน้ำยา 3 ระดับ วิเคราะห์ค่าเฉลี่ย, SD, CV% และระบบแจ้งเตือนเมื่อหลุดเกณฑ์ 3SD</p>
        </div>
        
        <div className="flex space-x-2 shrink-0">
          <button
            onClick={() => setActiveSubTab('log')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === 'log' ? 'bg-slate-950 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:text-slate-900'}`}
          >
            รายการบันทึก QC
          </button>
          <button
            onClick={() => setActiveSubTab('chart')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === 'chart' ? 'bg-slate-950 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:text-slate-900'}`}
          >
            Levey-Jennings Chart
          </button>
          <button
            onClick={() => setActiveSubTab('config')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === 'config' ? 'bg-slate-950 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:text-slate-900'}`}
          >
            ตั้งค่า Lot / Range
          </button>
        </div>
      </div>

      {/* Lab Responsibility Banner & VivaChek Fad Standard */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex items-start space-x-3 text-xs text-sky-900">
        <div className="bg-sky-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 shrink-0">IQC INFO</div>
        <div className="space-y-1">
          <p className="font-bold text-sky-950">การควบคุมคุณภาพภายใน (IQC) และระบบวัสดุอุปกรณ์หลัก</p>
          <p className="text-sky-800/90 leading-relaxed">
            ปกติการทดสอบควบคุมคุณภาพภายใน <span className="font-bold">IQC 3 Level</span> จะดำเนินการโดย <span className="font-bold text-sky-950 underline">เจ้าหน้าที่กลุ่มงานเทคนิคการแพทย์ (ห้องแลปผู้รับผิดชอบ)</span> เพื่อรักษาระบบมาตรฐานความเที่ยงตรงของอุปกรณ์ก่อนส่งกลับหน่วยงาน
          </p>
          <p className="text-sky-800/90 leading-relaxed">
            * <span className="font-bold">VivaChek Fad</span> เป็นยี่ห้อและรุ่นมาตรฐานหลักของโรงพยาบาลสังขะ ซึ่งเป็นชื่อของทั้ง <span className="font-bold">ตัวเครื่องตรวจวัด (Device)</span> และ <span className="font-bold">แผ่นตรวจวัดน้ำตาล (Test Strips)</span> ที่ใช้ร่วมกันในการควบคุมคุณภาพและการเจาะจริง
          </p>
        </div>
      </div>

      {/* Stats Dashboard Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="qc-stats-cards">
        {/* Level 1 Stats Card */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Level 1 (Low)</span>
            <span className="text-[10px] font-semibold text-slate-400">ล็อต {filterLot}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center py-1">
            <div>
              <span className="text-[10px] text-slate-400 block">Mean (เป้าหมาย)</span>
              <span className="text-sm font-bold text-slate-800">{level1Stats.mean} <span className="text-[9px] text-slate-400 font-normal">({level1Stats.target})</span></span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">S.D. (ค่าเบี่ยงเบน)</span>
              <span className="text-sm font-bold text-slate-800">{level1Stats.sd}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">C.V.%</span>
              <span className={`text-sm font-bold ${level1Stats.cv > 10 ? 'text-rose-600' : 'text-sky-600'}`}>{level1Stats.cv}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-50">
            <span className="text-slate-400">ทดสอบทั้งหมด: {level1Stats.n} ครั้ง</span>
            {level1Stats.outOfControlCount > 0 ? (
              <span className="text-rose-600 font-bold flex items-center bg-rose-50 px-1.5 py-0.5 rounded">
                <AlertTriangle size={10} className="mr-0.5" /> หลุดเกณฑ์: {level1Stats.outOfControlCount} ครั้ง
              </span>
            ) : (
              <span className="text-emerald-600 font-bold">✓ สถิติปกติในเกณฑ์ 3SD</span>
            )}
          </div>
        </div>

        {/* Level 2 Stats Card */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 bg-sky-50 text-sky-700 px-2 py-0.5 rounded">Level 2 (Normal)</span>
            <span className="text-[10px] font-semibold text-slate-400">ล็อต {filterLot}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center py-1">
            <div>
              <span className="text-[10px] text-slate-400 block">Mean (เป้าหมาย)</span>
              <span className="text-sm font-bold text-slate-800">{level2Stats.mean} <span className="text-[9px] text-slate-400 font-normal">({level2Stats.target})</span></span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">S.D. (ค่าเบี่ยงเบน)</span>
              <span className="text-sm font-bold text-slate-800">{level2Stats.sd}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">C.V.%</span>
              <span className={`text-sm font-bold ${level2Stats.cv > 8 ? 'text-rose-600' : 'text-sky-600'}`}>{level2Stats.cv}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-50">
            <span className="text-slate-400">ทดสอบทั้งหมด: {level2Stats.n} ครั้ง</span>
            {level2Stats.outOfControlCount > 0 ? (
              <span className="text-rose-600 font-bold flex items-center bg-rose-50 px-1.5 py-0.5 rounded">
                <AlertTriangle size={10} className="mr-0.5" /> หลุดเกณฑ์: {level2Stats.outOfControlCount} ครั้ง
              </span>
            ) : (
              <span className="text-emerald-600 font-bold">✓ สถิติปกติในเกณฑ์ 3SD</span>
            )}
          </div>
        </div>

        {/* Level 3 Stats Card */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 bg-purple-50 text-purple-700 px-2 py-0.5 rounded">Level 3 (High)</span>
            <span className="text-[10px] font-semibold text-slate-400">ล็อต {filterLot}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center py-1">
            <div>
              <span className="text-[10px] text-slate-400 block">Mean (เป้าหมาย)</span>
              <span className="text-sm font-bold text-slate-800">{level3Stats.mean} <span className="text-[9px] text-slate-400 font-normal">({level3Stats.target})</span></span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">S.D. (ค่าเบี่ยงเบน)</span>
              <span className="text-sm font-bold text-slate-800">{level3Stats.sd}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">C.V.%</span>
              <span className={`text-sm font-bold ${level3Stats.cv > 8 ? 'text-rose-600' : 'text-purple-600'}`}>{level3Stats.cv}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-50">
            <span className="text-slate-400">ทดสอบทั้งหมด: {level3Stats.n} ครั้ง</span>
            {level3Stats.outOfControlCount > 0 ? (
              <span className="text-rose-600 font-bold flex items-center bg-rose-50 px-1.5 py-0.5 rounded">
                <AlertTriangle size={10} className="mr-0.5" /> หลุดเกณฑ์: {level3Stats.outOfControlCount} ครั้ง
              </span>
            ) : (
              <span className="text-emerald-600 font-bold">✓ สถิติปกติในเกณฑ์ 3SD</span>
            )}
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: LOG LIST */}
      {activeSubTab === 'log' && (
        <div className="space-y-4" id="qc-log-subtab">
          {/* Controls filter row */}
          <div className="bg-slate-50 p-4 rounded-xl flex flex-wrap gap-3 items-center justify-between" id="qc-log-filters">
            <div className="flex flex-wrap items-center gap-3">
              {/* Filter Ward */}
              <select
                value={filterWard}
                onChange={(e) => setFilterWard(e.target.value)}
                className="text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">-- กรองตามวอร์ด (ทั้งหมด) --</option>
                {INITIAL_WARDS.map((w, idx) => (
                  <option key={idx} value={w}>{w}</option>
                ))}
              </select>

              {/* Filter Lot */}
              <select
                value={filterLot}
                onChange={(e) => setFilterLot(e.target.value)}
                className="text-xs p-2.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700"
              >
                {lotConfigs.map((cfg, idx) => (
                  <option key={idx} value={cfg.lotNumber}>แสดงเฉพาะ ล็อต: {cfg.lotNumber}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportCSV}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-2.5 rounded-lg flex items-center space-x-1 transition-all"
              >
                <Download size={13} />
                <span>Export สรุป (.csv)</span>
              </button>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center space-x-1 transition-all shadow-md shadow-sky-600/10"
              >
                <Plus size={13} />
                <span>บันทึกผล QC รายวัน</span>
              </button>
            </div>
          </div>

          {/* Quick Add QC Record Form */}
          {showAddForm && (
            <form onSubmit={handleAddQcSubmit} className="bg-slate-50/50 p-5 rounded-xl border border-sky-100 space-y-4 animate-scale-up" id="quick-qc-form">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-sky-950 flex items-center">
                  <Plus size={14} className="mr-1" /> แบบฟอร์มบันทึกผลควบคุมคุณภาพด่วน (3 Level)
                </h4>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 text-xs font-semibold hover:text-slate-600">ปิดแบบฟอร์ม</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">วันที่รัน QC</label>
                  <input type="date" value={qcDate} onChange={(e) => setQcDate(e.target.value)} className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white" required />
                </div>
                {/* Receive Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">วันที่รับเครื่องมา</label>
                  <input type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white" required />
                </div>
                {/* Return Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">วันที่ส่งเครื่องคืนวอร์ด</label>
                  <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white" required />
                </div>
                {/* Operator */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">ผู้ทำการวิเคราะห์ QC *</label>
                  <input type="text" placeholder="เช่น ทนพ. สมชาย ดีเลิศ" value={qcOperator} onChange={(e) => setQcOperator(e.target.value)} className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Serial selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">เลือกเครื่องตรวจวัดน้ำตาล (DTX CODE) *</label>
                  <select
                    value={qcSerial}
                    onChange={(e) => handleSerialChange(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    required
                  >
                    <option value="">-- เลือกเครื่อง --</option>
                    {machines.filter(m => m.status === 'active').map(m => (
                      <option key={m.id} value={m.serialNumber}>{m.serialNumber} ({m.ward}) - ล็อต {m.lotNumber}</option>
                    ))}
                  </select>
                </div>
                {/* Target Ward (auto) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">หน่วยงาน (ระบุอัตโนมัติ)</label>
                  <input type="text" value={qcWard} disabled className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500" />
                </div>
                {/* Lot Number (auto) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">ล็อตของเครื่อง (ระบุอัตโนมัติ)</label>
                  <input type="text" value={qcLot} disabled className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-3.5 rounded-lg border border-slate-100 font-bold text-slate-700">
                {/* Level 1 Value */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-600 block">Level 1 (Target: {lotConfigs.find(c => c.lotNumber === qcLot)?.level1Target || 0}) *</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="ใส่ค่าที่วัดได้"
                    value={level1Val}
                    onChange={(e) => setLevel1Val(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-emerald-50/10 focus:border-emerald-500"
                    required
                  />
                </div>
                {/* Level 2 Value */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-sky-600 block">Level 2 (Target: {lotConfigs.find(c => c.lotNumber === qcLot)?.level2Target || 0}) *</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="ใส่ค่าที่วัดได้"
                    value={level2Val}
                    onChange={(e) => setLevel2Val(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-sky-50/10 focus:border-sky-500"
                    required
                  />
                </div>
                {/* Level 3 Value */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-purple-600 block">Level 3 (Target: {lotConfigs.find(c => c.lotNumber === qcLot)?.level3Target || 0}) *</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="ใส่ค่าที่วัดได้"
                    value={level3Val}
                    onChange={(e) => setLevel3Val(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-purple-50/10 focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors flex items-center space-x-1"
                >
                  <CheckCircle size={13} />
                  <span>บันทึกและรันคำนวณ 3SD</span>
                </button>
              </div>
            </form>
          )}

          {/* Table display */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                  <th className="p-3">วันที่รัน QC</th>
                  <th className="p-3">รับเครื่อง - ส่งคืน</th>
                  <th className="p-3">หน่วยงาน</th>
                  <th className="p-3">รหัสเครื่อง (CODE)</th>
                  <th className="p-3">ล็อตเครื่อง (LOT)</th>
                  <th className="p-3">L1 (Low)</th>
                  <th className="p-3">L2 (Normal)</th>
                  <th className="p-3">L3 (High)</th>
                  <th className="p-3">ผู้บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center p-8 text-slate-400">
                      ไม่พบรายการบันทึกควบคุมคุณภาพตามที่เลือก
                    </td>
                  </tr>
                ) : (
                  tableRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-semibold text-slate-800">{r.date}</td>
                      <td className="p-3 text-slate-500">{r.receiveDate} ถึง {r.returnDate}</td>
                      <td className="p-3 text-slate-700 font-bold">{r.ward}</td>
                      <td className="p-3 font-semibold text-slate-600">{r.serialNumber}</td>
                      <td className="p-3 font-mono text-[10px] text-sky-700 font-semibold">{r.lotNumber}</td>
                      
                      {/* L1 value */}
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold flex items-center ${r.level1Status === 'out_of_control' ? 'bg-rose-50 text-rose-600' : 'text-slate-800'}`}>
                          {r.level1} {r.level1Status === 'out_of_control' && <AlertTriangle size={12} className="text-rose-500 ml-1 shrink-0" />}
                        </span>
                      </td>

                      {/* L2 value */}
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold flex items-center ${r.level2Status === 'out_of_control' ? 'bg-rose-50 text-rose-600' : 'text-slate-800'}`}>
                          {r.level2} {r.level2Status === 'out_of_control' && <AlertTriangle size={12} className="text-rose-500 ml-1 shrink-0" />}
                        </span>
                      </td>

                      {/* L3 value */}
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold flex items-center ${r.level3Status === 'out_of_control' ? 'bg-rose-50 text-rose-600' : 'text-slate-800'}`}>
                          {r.level3} {r.level3Status === 'out_of_control' && <AlertTriangle size={12} className="text-rose-500 ml-1 shrink-0" />}
                        </span>
                      </td>

                      <td className="p-3 text-slate-500 font-medium">{r.operator}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LEVEY-JENNINGS CHARTS */}
      {activeSubTab === 'chart' && (
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-6" id="qc-chart-subtab">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Levey-Jennings Control Charts (IQC Trend)</h3>
              <p className="text-xs text-slate-500">กราฟวิเคราะห์แนวโน้มควบคุมคุณภาพตามเวลา สำหรับเครื่องตรวจวัดน้ำตาลรายหน่วยงาน</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Level Selector */}
              <div className="flex bg-white rounded-lg p-0.5 border border-slate-200 font-bold shadow-xs">
                <button
                  onClick={() => setSelectedChartLevel(1)}
                  className={`px-3 py-1.5 rounded-md transition-all ${selectedChartLevel === 1 ? 'bg-sky-600 text-white' : 'text-slate-600'}`}
                >
                  Level 1 (Low)
                </button>
                <button
                  onClick={() => setSelectedChartLevel(2)}
                  className={`px-3 py-1.5 rounded-md transition-all ${selectedChartLevel === 2 ? 'bg-sky-600 text-white' : 'text-slate-600'}`}
                >
                  Level 2 (Normal)
                </button>
                <button
                  onClick={() => setSelectedChartLevel(3)}
                  className={`px-3 py-1.5 rounded-md transition-all ${selectedChartLevel === 3 ? 'bg-sky-600 text-white' : 'text-slate-600'}`}
                >
                  Level 3 (High)
                </button>
              </div>

              {/* Lot selector */}
              <select
                value={filterLot}
                onChange={(e) => setFilterLot(e.target.value)}
                className="p-2 bg-white rounded-lg border border-slate-200 font-semibold"
              >
                {lotConfigs.map((cfg, idx) => (
                  <option key={idx} value={cfg.lotNumber}>ล็อต: {cfg.lotNumber}</option>
                ))}
              </select>
            </div>
          </div>

          {/* SVG LEVEY-JENNINGS PLOT */}
          {(() => {
            const currentLotConfig = lotConfigs.find(c => c.lotNumber === filterLot);
            const filteredChartRecords = qcRecords
              .filter(r => r.lotNumber === filterLot && (filterWard === '' || r.ward === filterWard))
              .sort((a, b) => a.date.localeCompare(b.date));

            if (!currentLotConfig) {
              return <p className="text-xs text-center text-slate-400 py-12">ไม่พบล็อตที่กำหนดในระบบ</p>;
            }

            // Extract level targets and SDs
            const target = selectedChartLevel === 1 ? currentLotConfig.level1Target : selectedChartLevel === 2 ? currentLotConfig.level2Target : currentLotConfig.level3Target;
            const sd = selectedChartLevel === 1 ? currentLotConfig.level1SD : selectedChartLevel === 2 ? currentLotConfig.level2SD : currentChartLevelSD();
            
            function currentChartLevelSD() {
              return selectedChartLevel === 3 ? currentLotConfig!.level3SD : 1.0;
            }

            const rangeMin = target - 3.5 * sd;
            const rangeMax = target + 3.5 * sd;

            if (filteredChartRecords.length === 0) {
              return (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                  <BarChart2 size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-500">ไม่มีข้อมูลบันทึก QC ของล็อต {filterLot} เพื่อพล็อตแนวโน้ม</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">กรุณารันผลลัพธ์ QC หรือเปลี่ยนตัวเลือกล็อตด้านบน</p>
                </div>
              );
            }

            // Dimensions of our SVG
            const width = 800;
            const height = 320;
            const paddingLeft = 60;
            const paddingRight = 40;
            const paddingTop = 30;
            const paddingBottom = 40;

            const plotWidth = width - paddingLeft - paddingRight;
            const plotHeight = height - paddingTop - paddingBottom;

            // Coordinate conversion functions
            const getX = (index: number) => {
              if (filteredChartRecords.length <= 1) return paddingLeft + plotWidth / 2;
              return paddingLeft + (index / (filteredChartRecords.length - 1)) * plotWidth;
            };

            const getY = (val: number) => {
              const fraction = (val - rangeMin) / (rangeMax - rangeMin);
              // Invert Y coordinate because SVG 0,0 is top-left
              return paddingTop + plotHeight - fraction * plotHeight;
            };

            // Build gridlines for Target, +/-1SD, +/-2SD, +/-3SD
            const lines = [
              { val: target, color: '#10b981', label: 'Mean', strokeWidth: 1.5, strokeDash: '' },
              { val: target + sd, color: '#94a3b8', label: '+1 SD', strokeWidth: 1, strokeDash: '4,4' },
              { val: target - sd, color: '#94a3b8', label: '-1 SD', strokeWidth: 1, strokeDash: '4,4' },
              { val: target + 2 * sd, color: '#f59e0b', label: '+2 SD', strokeWidth: 1.2, strokeDash: '4,2' },
              { val: target - 2 * sd, color: '#f59e0b', label: '-2 SD', strokeWidth: 1.2, strokeDash: '4,2' },
              { val: target + 3 * sd, color: '#ef4444', label: '+3 SD', strokeWidth: 1.5, strokeDash: '' },
              { val: target - 3 * sd, color: '#ef4444', label: '-3 SD', strokeWidth: 1.5, strokeDash: '' },
            ];

            return (
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs px-2">
                  <span className="font-bold text-slate-700">ลานวิเคราะห์ Levey-Jennings (เครื่องประมวลผล QC ในระบบ)</span>
                  <div className="flex items-center space-x-3 text-[10px]">
                    <span className="flex items-center"><span className="w-2.5 h-1 bg-emerald-500 mr-1 inline-block"></span> Mean</span>
                    <span className="flex items-center"><span className="w-2.5 h-1 bg-amber-500 mr-1 inline-block"></span> +/- 2SD Warning</span>
                    <span className="flex items-center"><span className="w-2.5 h-1 bg-rose-500 mr-1 inline-block"></span> +/- 3SD Out-Of-Control</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <svg className="w-full min-w-[700px] h-80" viewBox={`0 0 ${width} ${height}`}>
                    {/* Background Rect */}
                    <rect x={paddingLeft} y={paddingTop} width={plotWidth} height={plotHeight} fill="#f8fafc" />

                    {/* Translucent control zones background (Green zone +/-2SD, Red out) */}
                    <rect x={paddingLeft} y={getY(target + 2 * sd)} width={plotWidth} height={getY(target - 2 * sd) - getY(target + 2 * sd)} fill="#10b981" fillOpacity="0.04" />
                    <rect x={paddingLeft} y={getY(target + 3 * sd)} width={plotWidth} height={getY(target + 2 * sd) - getY(target + 3 * sd)} fill="#f59e0b" fillOpacity="0.08" />
                    <rect x={paddingLeft} y={getY(target - 2 * sd)} width={plotWidth} height={getY(target - 3 * sd) - getY(target - 2 * sd)} fill="#f59e0b" fillOpacity="0.08" />

                    {/* Plot standard SD grid lines */}
                    {lines.map((line, idx) => (
                      <g key={idx}>
                        <line
                          x1={paddingLeft}
                          y1={getY(line.val)}
                          x2={width - paddingRight}
                          y2={getY(line.val)}
                          stroke={line.color}
                          strokeWidth={line.strokeWidth}
                          strokeDasharray={line.strokeDash}
                        />
                        <text
                          x={paddingLeft - 8}
                          y={getY(line.val) + 4}
                          textAnchor="end"
                          fill={line.color}
                          className="font-mono text-[9px] font-bold"
                        >
                          {Math.round(line.val)}
                        </text>
                        <text
                          x={width - paddingRight + 5}
                          y={getY(line.val) + 4}
                          textAnchor="start"
                          fill={line.color}
                          className="font-semibold text-[8px]"
                        >
                          {line.label}
                        </text>
                      </g>
                    ))}

                    {/* Draw timeline path */}
                    {(() => {
                      let pathD = '';
                      filteredChartRecords.forEach((rec, idx) => {
                        const val = selectedChartLevel === 1 ? rec.level1 : selectedChartLevel === 2 ? rec.level2 : rec.level3;
                        const x = getX(idx);
                        const y = getY(val);
                        if (idx === 0) pathD = `M ${x} ${y}`;
                        else pathD += ` L ${x} ${y}`;
                      });

                      return (
                        <path
                          d={pathD}
                          fill="transparent"
                          stroke="#0284c7" // sky-600
                          strokeWidth="2.5"
                          className="transition-all"
                        />
                      );
                    })()}

                    {/* Plot data points */}
                    {filteredChartRecords.map((rec, idx) => {
                      const val = selectedChartLevel === 1 ? rec.level1 : selectedChartLevel === 2 ? rec.level2 : rec.level3;
                      const x = getX(idx);
                      const y = getY(val);
                      const isOut = val < target - 3 * sd || val > target + 3 * sd;

                      return (
                        <g key={rec.id} className="group cursor-pointer">
                          <circle
                            cx={x}
                            cy={y}
                            r={isOut ? '6' : '4.5'}
                            fill={isOut ? '#ef4444' : '#0284c7'}
                            stroke="white"
                            strokeWidth="1.5"
                          />
                          {/* Tooltip Hover Area */}
                          <title>
                            {`วันที่: ${rec.date}\nวอร์ด: ${rec.ward}\nเครื่อง: ${rec.serialNumber}\nค่าวิเคราะห์: ${val}\nสถานะ: ${isOut ? 'หลุดเกณฑ์ 3SD (Out of Control!)' : 'ปกติ'}`}
                          </title>

                          {/* X-axis date labels */}
                          <text
                            x={x}
                            y={height - paddingBottom + 18}
                            textAnchor="middle"
                            fill="#64748b"
                            transform={`rotate(15 ${x} ${height - paddingBottom + 18})`}
                            className="text-[8px] font-mono font-medium"
                          >
                            {rec.date.substring(5)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                  <span className="font-bold text-slate-700 flex items-center space-x-1 mb-1">
                    <Lightbulb size={13} className="text-amber-500 shrink-0" />
                    <span>การอ่านผลและควบคุมระดับห้องปฏิบัติการ (Rule Interpretation):</span>
                  </span>
                  เราประยุกต์ใช้ <span className="font-bold">กฎการควบคุม 3SD (Out-Of-Control Rule)</span> เป็นหลัก เนื่องจากเป็นสถิติเบื้องต้นที่ครอบคลุมและสามารถลดโอกาสผิดพลาดในการวิเคราะห์ในวอร์ดได้ดี หากจุดใดปรากฏเป็น <span className="text-rose-600 font-bold">"จุดสีแดง" (ออกนอกเกณฑ์เส้นสีแดง)</span> แสดงว่าเครื่องหรือแผ่นตรวจชุดนั้น ๆ เกิดความผิดพลาดชนิดระบบ (Systematic Error) หรือแบบสุ่มขนาดใหญ่ (Random Error) ต้องระงับการใช้งานและหาสาเหตุก่อนส่งกลับไปประจำการที่ Ward
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* SUB-TAB 3: LOT RANGE CONFIGURATION */}
      {activeSubTab === 'config' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6" id="qc-config-subtab">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
              <Settings size={16} className="text-sky-600" />
              <span>กำหนดค่าเป้าหมายจำแนกตามล็อต (Target & Range Configuration)</span>
            </h3>
            <p className="text-xs text-slate-400">ระบุค่าควบคุม Target, Min/Max Limit, และ Standard Deviation (SD) เพื่อป้อนให้ระบบคำนวณกราฟและสถานะโดยอัตโนมัติ</p>
          </div>

          <div className="space-y-4" id="configs-editor-list">
            {lotConfigs.map((cfg, idx) => {
              const isEditing = editingLotIdx === idx;
              return (
                <div key={idx} className="border border-slate-100 rounded-xl p-4 space-y-4 hover:border-slate-200 transition-all bg-slate-50/20">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">{cfg.lotNumber}</span>
                      <span className="text-xs font-semibold text-slate-500">สำหรับกลุ่มแถบตรวจวัดค่าน้ำตาล POCT</span>
                    </div>
                    {isEditing ? (
                      <div className="flex space-x-1.5 text-xs">
                        <button
                          onClick={handleSaveLotConfig}
                          className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-md"
                        >
                          บันทึก
                        </button>
                        <button
                          onClick={() => { setEditingLotIdx(null); setEditedLot(null); }}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-3 py-1.5 rounded-md"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEditLot(idx)}
                        className="bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1.5 rounded-md flex items-center space-x-1"
                      >
                        <Sliders size={12} />
                        <span>แก้ไขเกณฑ์กำหนด</span>
                      </button>
                    )}
                  </div>

                  {isEditing && editedLot ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="config-editing-fields">
                      {/* Level 1 Fields */}
                      <div className="bg-emerald-50/10 p-3.5 rounded-lg border border-emerald-100 space-y-3 text-xs">
                        <h4 className="font-bold text-emerald-700">เกณฑ์ Level 1 (Low)</h4>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 block">Target Mean</label>
                          <input type="number" value={editedLot.level1Target} onChange={(e) => setEditedLot({ ...editedLot, level1Target: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 block">S.D. Target</label>
                          <input type="number" step="any" value={editedLot.level1SD} onChange={(e) => setEditedLot({ ...editedLot, level1SD: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                      </div>

                      {/* Level 2 Fields */}
                      <div className="bg-sky-50/10 p-3.5 rounded-lg border border-sky-100 space-y-3 text-xs">
                        <h4 className="font-bold text-sky-700">เกณฑ์ Level 2 (Normal)</h4>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 block">Target Mean</label>
                          <input type="number" value={editedLot.level2Target} onChange={(e) => setEditedLot({ ...editedLot, level2Target: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 block">S.D. Target</label>
                          <input type="number" step="any" value={editedLot.level2SD} onChange={(e) => setEditedLot({ ...editedLot, level2SD: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                      </div>

                      {/* Level 3 Fields */}
                      <div className="bg-purple-50/10 p-3.5 rounded-lg border border-purple-100 space-y-3 text-xs">
                        <h4 className="font-bold text-purple-700">เกณฑ์ Level 3 (High)</h4>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 block">Target Mean</label>
                          <input type="number" value={editedLot.level3Target} onChange={(e) => setEditedLot({ ...editedLot, level3Target: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 block">S.D. Target</label>
                          <input type="number" step="any" value={editedLot.level3SD} onChange={(e) => setEditedLot({ ...editedLot, level3SD: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs" id="config-static-fields">
                      {/* Level 1 Summary */}
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-emerald-700 block">Level 1 (Low)</span>
                        <div className="mt-1 font-mono space-y-0.5 text-[11px] text-slate-600">
                          <p>Mean Target: <span className="font-bold text-slate-800">{cfg.level1Target}</span> mg/dL</p>
                          <p>SD Standard: <span className="font-bold text-slate-800">{cfg.level1SD}</span></p>
                          <p>3SD Range: <span className="font-bold text-slate-800">{cfg.level1Target - 3 * cfg.level1SD} - {cfg.level1Target + 3 * cfg.level1SD}</span></p>
                        </div>
                      </div>

                      {/* Level 2 Summary */}
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-sky-700 block">Level 2 (Normal)</span>
                        <div className="mt-1 font-mono space-y-0.5 text-[11px] text-slate-600">
                          <p>Mean Target: <span className="font-bold text-slate-800">{cfg.level2Target}</span> mg/dL</p>
                          <p>SD Standard: <span className="font-bold text-slate-800">{cfg.level2SD}</span></p>
                          <p>3SD Range: <span className="font-bold text-slate-800">{cfg.level2Target - 3 * cfg.level2SD} - {cfg.level2Target + 3 * cfg.level2SD}</span></p>
                        </div>
                      </div>

                      {/* Level 3 Summary */}
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-purple-700 block">Level 3 (High)</span>
                        <div className="mt-1 font-mono space-y-0.5 text-[11px] text-slate-600">
                          <p>Mean Target: <span className="font-bold text-slate-800">{cfg.level3Target}</span> mg/dL</p>
                          <p>SD Standard: <span className="font-bold text-slate-800">{cfg.level3SD}</span></p>
                          <p>3SD Range: <span className="font-bold text-slate-800">{cfg.level3Target - 3 * cfg.level3SD} - {cfg.level3Target + 3 * cfg.level3SD}</span></p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
