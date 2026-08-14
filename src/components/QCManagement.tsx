/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import CustomSelect from "./CustomSelect";
import { QcRecord, QcLotConfig, DtxMachine } from '../types';
import { dbService } from '../lib/supabase';
import { INITIAL_LOT_CONFIGS } from '../mockData';
import { Plus, Settings, BarChart2, CheckCircle, AlertTriangle, FileText, Download, Sliders, Calendar, User, Eye, Lightbulb, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface QCManagementProps {
  machines: DtxMachine[];
  qcRecords: QcRecord[];
  lotConfigs: QcLotConfig[];
  onAddQcRecord: (record: QcRecord) => void;
  onUpdateLotConfigs: (configs: QcLotConfig[]) => void;
  role?: string;
}

export default function QCManagement({ machines, qcRecords, lotConfigs, onAddQcRecord, onUpdateLotConfigs, role = 'admin' }: QCManagementProps) {
  const [activeSubTab, setActiveSubTab] = useState<'log' | 'config' | 'chart'>('log');
  
  const [wards, setWards] = useState<{ en_name: string; thai_name: string }[]>([]);

  useEffect(() => {
    dbService.getWards()
      .then(setWards)
      .catch(err => console.error('Failed to fetch wards:', err));
  }, []);
  
  // Filtering states
  const [filterWard, setFilterWard] = useState('');
  const [filterLot, setFilterLot] = useState('LOT2026-A');
  const [filterMonth, setFilterMonth] = useState('');
  const [activeLevels, setActiveLevels] = useState<{ [key: number]: boolean }>({ 1: true, 2: true, 3: true });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterWard, filterLot, filterMonth]);

  const toggleLevel = (lvl: number) => {
    setActiveLevels(prev => {
      const next = { ...prev, [lvl]: !prev[lvl] };
      if (!next[1] && !next[2] && !next[3]) return prev; // Keep at least one selected
      return next;
    });
  };

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

  const handleWardChange = (wardName: string) => {
    setQcWard(wardName);
    if (qcSerial) {
      const matchedMachine = machines.find(m => m.serialNumber === qcSerial);
      if (matchedMachine && matchedMachine.ward !== wardName) {
        setQcSerial('');
      }
    }
  };

  const handleSerialChange = (serial: string) => {
    setQcSerial(serial);
    const matchedMachine = machines.find(m => m.serialNumber === serial);
    if (matchedMachine) {
      if (!qcWard) {
        setQcWard(matchedMachine.ward);
      }
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
      alert('ไม่พบข้อมูลการกำหนดค่าเป้าหมาย LOT นี้ กรุณาตั้งค่าก่อน');
      return;
    }

    const l1 = Number(level1Val);
    const l2 = Number(level2Val);
    const l3 = Number(level3Val);

    // Calculate Out of Control status using Min/Max ranges, or fallback to Target +/- 3SD
    const getStatus = (val: number, min: number, max: number, target: number, sd: number) => {
      if (min !== undefined && max !== undefined && (min !== 0 || max !== 0)) {
        return (val < min || val > max) ? 'out_of_control' : 'normal';
      }
      return (val < target - 3 * sd || val > target + 3 * sd) ? 'out_of_control' : 'normal';
    };

    const level1Status = getStatus(l1, config.level1Min, config.level1Max, config.level1Target, config.level1SD);
    const level2Status = getStatus(l2, config.level2Min, config.level2Max, config.level2Target, config.level2SD);
    const level3Status = getStatus(l3, config.level3Min, config.level3Max, config.level3Target, config.level3SD);

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
    
    // If we're adding a new lot (index equals length)
    if (editingLotIdx === lotConfigs.length) {
      newConfigs.push(editedLot);
    } else {
      newConfigs[editingLotIdx!] = editedLot;
    }
    
    onUpdateLotConfigs(newConfigs);
    setEditingLotIdx(null);
    setEditedLot(null);
  };

  const handleAddLotConfig = () => {
    const newLotIdx = lotConfigs.length;
    setEditingLotIdx(newLotIdx);
    setEditedLot({
      lotNumber: `LOT-${new Date().getFullYear()}-NEW`,
      level1Target: 0, level1Min: 0, level1Max: 0, level1SD: 0,
      level2Target: 0, level2Min: 0, level2Max: 0, level2SD: 0,
      level3Target: 0, level3Min: 0, level3Max: 0, level3SD: 0,
    });
  };

  // Stats Calculations
  const getCalculatedStats = (records: QcRecord[], lot: string, level: 1 | 2 | 3, month: string) => {
    const activeLotConfig = lotConfigs.find(c => c.lotNumber === lot);
    const filtered = records.filter(r => 
      r.lotNumber === lot && 
      (filterWard === '' || r.ward === filterWard) &&
      (month === '' || r.date.startsWith(month))
    );
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

    // Out of control count based on the recorded status
    const outOfControlCount = filtered.filter(r => 
      (level === 1 && r.level1Status === 'out_of_control') ||
      (level === 2 && r.level2Status === 'out_of_control') ||
      (level === 3 && r.level3Status === 'out_of_control')
    ).length;

    return {
      n,
      mean: Math.round(mean * 100) / 100,
      sd: Math.round(sd * 100) / 100,
      cv: Math.round(cv * 100) / 100,
      outOfControlCount
    };
  };

  const level1Stats = getCalculatedStats(qcRecords, filterLot, 1, filterMonth);
  const level2Stats = getCalculatedStats(qcRecords, filterLot, 2, filterMonth);
  const level3Stats = getCalculatedStats(qcRecords, filterLot, 3, filterMonth);

  // Filtered QC records for table display
  const tableRecords = qcRecords.filter(r => 
    (filterWard === '' || r.ward === filterWard) &&
    (filterLot === '' || r.lotNumber === filterLot) &&
    (filterMonth === '' || r.date.startsWith(filterMonth))
  ).sort((a, b) => b.date.localeCompare(a.date));

  const totalPages = Math.ceil(tableRecords.length / itemsPerPage);
  const paginatedQC = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return tableRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [tableRecords, currentPage]);

  // CSV/JSON Export Helper
  const handleExportCSV = () => {
    const headers = ['วันที่ทำ QC', 'รับเครื่อง', 'ส่งคืนเครื่อง', 'หน่วยงาน', 'รหัสเครื่อง DTX', 'LOT น้ำยา', 'ผู้ตรวจ', 'Level 1', 'Level 1 สถานะ', 'Level 2', 'Level 2 สถานะ', 'Level 3', 'Level 3 สถานะ'];
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

  const availableMonths = Array.from(new Set(qcRecords.map(r => r.date.substring(0, 7)))).sort((a, b) => b.localeCompare(a));

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


      {/* Stats Dashboard Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="qc-stats-cards">
        {/* Level 1 Stats Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-md shadow-slate-200/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 rounded-md">Level 1 (Low)</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">LOT {filterLot}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center py-1">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">Mean (เป้าหมาย)</span>
              <span className="text-base font-extrabold text-slate-900">{level1Stats.mean}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">S.D. (ค่าเบี่ยงเบน)</span>
              <span className="text-base font-extrabold text-slate-900">{level1Stats.sd}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">C.V.%</span>
              <span className={`text-base font-extrabold ${level1Stats.cv > 10 ? 'text-rose-600' : 'text-emerald-600'}`}>{level1Stats.cv}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] pt-2.5 border-t border-slate-100">
            <span className="text-slate-500 font-medium">ทดสอบทั้งหมด: {level1Stats.n} ครั้ง</span>
            {level1Stats.outOfControlCount > 0 ? (
              <span className="text-rose-600 font-bold flex items-center bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                <AlertTriangle size={10} className="mr-0.5" /> หลุดเกณฑ์: {level1Stats.outOfControlCount} ครั้ง
              </span>
            ) : (
              <span className="text-emerald-600 font-bold">✓ สถิติปกติในเกณฑ์ที่กำหนด</span>
            )}
          </div>
        </div>

        {/* Level 2 Stats Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-md shadow-slate-200/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 bg-sky-50 border border-sky-200 text-sky-800 px-2.5 py-0.5 rounded-md">Level 2 (Normal)</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">LOT {filterLot}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center py-1">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">Mean (เป้าหมาย)</span>
              <span className="text-base font-extrabold text-slate-900">{level2Stats.mean}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">S.D. (ค่าเบี่ยงเบน)</span>
              <span className="text-base font-extrabold text-slate-900">{level2Stats.sd}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">C.V.%</span>
              <span className={`text-base font-extrabold ${level2Stats.cv > 8 ? 'text-rose-600' : 'text-sky-600'}`}>{level2Stats.cv}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] pt-2.5 border-t border-slate-100">
            <span className="text-slate-500 font-medium">ทดสอบทั้งหมด: {level2Stats.n} ครั้ง</span>
            {level2Stats.outOfControlCount > 0 ? (
              <span className="text-rose-600 font-bold flex items-center bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                <AlertTriangle size={10} className="mr-0.5" /> หลุดเกณฑ์: {level2Stats.outOfControlCount} ครั้ง
              </span>
            ) : (
              <span className="text-emerald-600 font-bold">✓ สถิติปกติในเกณฑ์ที่กำหนด</span>
            )}
          </div>
        </div>

        {/* Level 3 Stats Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-md shadow-slate-200/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 bg-purple-50 border border-purple-200 text-purple-800 px-2.5 py-0.5 rounded-md">Level 3 (High)</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">LOT {filterLot}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center py-1">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">Mean (เป้าหมาย)</span>
              <span className="text-base font-extrabold text-slate-900">{level3Stats.mean}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">S.D. (ค่าเบี่ยงเบน)</span>
              <span className="text-base font-extrabold text-slate-900">{level3Stats.sd}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">C.V.%</span>
              <span className={`text-base font-extrabold ${level3Stats.cv > 8 ? 'text-rose-600' : 'text-purple-600'}`}>{level3Stats.cv}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] pt-2.5 border-t border-slate-100">
            <span className="text-slate-500 font-medium">ทดสอบทั้งหมด: {level3Stats.n} ครั้ง</span>
            {level3Stats.outOfControlCount > 0 ? (
              <span className="text-rose-600 font-bold flex items-center bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                <AlertTriangle size={10} className="mr-0.5" /> หลุดเกณฑ์: {level3Stats.outOfControlCount} ครั้ง
              </span>
            ) : (
              <span className="text-emerald-600 font-bold">✓ สถิติปกติในเกณฑ์ที่กำหนด</span>
            )}
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: LOG LIST */}
      {activeSubTab === 'log' && (
        <div className="space-y-4" id="qc-log-subtab">
          {/* Controls filter row */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3" id="qc-log-filters">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <div className="flex items-center text-slate-500 font-bold px-2 py-1 bg-slate-100 rounded-md shrink-0">
                <Sliders size={13} className="mr-1 text-slate-600" />
                <span>ตัวกรอง IQC:</span>
              </div>

              {/* Filter Month */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-semibold whitespace-nowrap">เดือน:</span>
                <CustomSelect
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="text-xs p-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white font-medium min-w-[130px]"
                >
                  <option value="">-- ทุกเดือน --</option>
                  {availableMonths.map((m, idx) => (
                    <option key={idx} value={m}>{m}</option>
                  ))}
                </CustomSelect>
              </div>

              {/* Filter Ward */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-semibold whitespace-nowrap">หน่วยงาน:</span>
                <CustomSelect
                  value={filterWard}
                  onChange={(e) => setFilterWard(e.target.value)}
                  className="text-xs p-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white font-medium min-w-[170px]"
                >
                  <option value="">-- ทุกหน่วยงาน --</option>
                  {wards.map((w, idx) => (
                    <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                  ))}
                </CustomSelect>
              </div>

              {/* Filter Lot */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-semibold whitespace-nowrap">LOT:</span>
                <CustomSelect
                  value={filterLot}
                  onChange={(e) => setFilterLot(e.target.value)}
                  className="text-xs p-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white font-bold text-slate-700 min-w-[150px]"
                >
                  {lotConfigs.map((cfg, idx) => (
                    <option key={idx} value={cfg.lotNumber}>LOT: {cfg.lotNumber}</option>
                  ))}
                </CustomSelect>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 ml-auto">
              <button
                onClick={handleExportCSV}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-2 rounded-lg flex items-center space-x-1 transition-all cursor-pointer shadow-2xs"
              >
                <Download size={13} />
                <span>Export สรุป (.csv)</span>
              </button>

              {role === 'admin' ? (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1 transition-all cursor-pointer shadow-md shadow-sky-600/10"
                >
                  <Plus size={13} />
                  <span>บันทึกผล QC</span>
                </button>
              ) : (
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center space-x-1">
                  <Eye size={13} className="text-sky-600" />
                  <span>สิทธิ์เจ้าหน้าที่: เข้าดูข้อมูล (Read-Only)</span>
                </span>
              )}
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
                {/* Target Ward selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">เลือกหน่วยงาน (Ward) *</label>
                  <CustomSelect
                    value={qcWard}
                    onChange={(e) => handleWardChange(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    required
                  >
                    <option value="">-- เลือกหน่วยงาน --</option>
                    {wards.map((w, idx) => (
                      <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                    ))}
                  </CustomSelect>
                </div>

                {/* Serial selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">เลือกเครื่องตรวจวัดน้ำตาล (DTX CODE) *</label>
                  <CustomSelect
                    value={qcSerial}
                    onChange={(e) => handleSerialChange(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    required
                  >
                    <option value="">-- เลือกเครื่อง --</option>
                    {machines
                      .filter(m => m.status === 'active' && (!qcWard || m.ward === qcWard))
                      .map(m => (
                        <option key={m.id} value={m.serialNumber}>{m.serialNumber} ({m.ward}) - LOT {m.lotNumber}</option>
                      ))}
                  </CustomSelect>
                </div>

                {/* Lot Number (auto) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">LOT ของเครื่อง (ระบุอัตโนมัติ)</label>
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
                  <th className="p-3">LOT</th>
                  <th className="p-3">L1 (Low)</th>
                  <th className="p-3">L2 (Normal)</th>
                  <th className="p-3">L3 (High)</th>
                  <th className="p-3">ผู้บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedQC.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center p-8 text-slate-400">
                      ยังไม่มีข้อมูลบันทึกการควบคุมคุณภาพ (QC)
                    </td>
                  </tr>
                ) : (
                  paginatedQC.map((r) => (
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border border-slate-100 px-4 py-3 bg-white text-xs rounded-xl shadow-2xs">
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
                    แสดงรายการที่ <span className="font-bold text-slate-800">{Math.min(tableRecords.length, (currentPage - 1) * itemsPerPage + 1)}</span> ถึง{' '}
                    <span className="font-bold text-slate-800">{Math.min(tableRecords.length, currentPage * itemsPerPage)}</span> จากทั้งหมด{' '}
                    <span className="font-bold text-slate-800">{tableRecords.length}</span> รายการ
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
        </div>
      )}

      {/* SUB-TAB 2: LEVEY-JENNINGS CHARTS */}
      {activeSubTab === 'chart' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5" id="qc-chart-subtab">
          <div className="space-y-1 pb-2 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-800 text-base flex items-center space-x-2">
              <TrendingUp size={18} className="text-sky-600" />
              <span>Levey-Jennings Control Charts (IQC Trend)</span>
            </h3>
            <p className="text-xs text-slate-500">กราฟวิเคราะห์แนวโน้มควบคุมคุณภาพตามเวลา สำหรับเครื่องตรวจวัดน้ำตาลรายหน่วยงาน</p>
          </div>

          {/* Filter Toolbar for LJ Chart */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs" id="lj-chart-filters">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Filter Icon Only */}
              <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-200/80 shadow-2xs flex items-center justify-center shrink-0" title="ตัวกรองกราฟ">
                <Sliders size={16} className="text-sky-600" />
              </div>

              {/* Filter Ward */}
              <div className="flex-1 min-w-[150px] flex items-center space-x-2 bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
                <span className="text-slate-500 font-bold whitespace-nowrap pl-1 text-[11px]">หน่วยงาน:</span>
                <CustomSelect
                  value={filterWard}
                  onChange={(e) => setFilterWard(e.target.value)}
                  className="p-1.5 bg-white rounded-lg border-0 font-semibold text-slate-800 text-xs w-full focus:ring-0"
                >
                  <option value="">-- ทุกหน่วยงาน --</option>
                  {wards.map((w, idx) => (
                    <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                  ))}
                </CustomSelect>
              </div>

              {/* Month selector */}
              <div className="flex-1 min-w-[130px] flex items-center space-x-2 bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
                <span className="text-slate-500 font-bold whitespace-nowrap pl-1 text-[11px]">เดือน:</span>
                <CustomSelect
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="p-1.5 bg-white rounded-lg border-0 font-semibold text-slate-800 text-xs w-full focus:ring-0"
                >
                  <option value="">-- ทุกเดือน --</option>
                  {availableMonths.map((m, idx) => (
                    <option key={idx} value={m}>{m}</option>
                  ))}
                </CustomSelect>
              </div>

              {/* Lot selector */}
              <div className="flex-1 min-w-[130px] flex items-center space-x-2 bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
                <span className="text-slate-500 font-bold whitespace-nowrap pl-1 text-[11px]">LOT:</span>
                <CustomSelect
                  value={filterLot}
                  onChange={(e) => setFilterLot(e.target.value)}
                  className="p-1.5 bg-white rounded-lg border-0 font-bold text-slate-800 text-xs w-full focus:ring-0"
                >
                  {lotConfigs.map((cfg, idx) => (
                    <option key={idx} value={cfg.lotNumber}>LOT: {cfg.lotNumber}</option>
                  ))}
                </CustomSelect>
              </div>
            </div>

            {/* Level Selector - L (Green), N (Sky), H (Red) checkboxes */}
            <div className="flex items-center space-x-1.5 bg-white rounded-xl p-1.5 border border-slate-200/90 shadow-2xs shrink-0">
              <span className="text-[11px] font-extrabold text-slate-600 px-1 whitespace-nowrap">ระดับ QC:</span>
              
              {/* Level 1 (L) */}
              <button
                type="button"
                onClick={() => toggleLevel(1)}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer font-extrabold text-xs border ${
                  activeLevels[1]
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!activeLevels[1]}
                  readOnly
                  className="accent-emerald-600 w-3.5 h-3.5 rounded cursor-pointer pointer-events-none"
                />
                <span className="text-emerald-700">L</span>
                <span className="text-[10px] font-normal opacity-80">(Low)</span>
              </button>

              {/* Level 2 (N) */}
              <button
                type="button"
                onClick={() => toggleLevel(2)}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer font-extrabold text-xs border ${
                  activeLevels[2]
                    ? 'bg-sky-50 text-sky-800 border-sky-300 shadow-2xs'
                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!activeLevels[2]}
                  readOnly
                  className="accent-sky-600 w-3.5 h-3.5 rounded cursor-pointer pointer-events-none"
                />
                <span className="text-sky-700">N</span>
                <span className="text-[10px] font-normal opacity-80">(Normal)</span>
              </button>

              {/* Level 3 (H) - Red */}
              <button
                type="button"
                onClick={() => toggleLevel(3)}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer font-extrabold text-xs border ${
                  activeLevels[3]
                    ? 'bg-rose-50 text-rose-800 border-rose-300 shadow-2xs'
                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!activeLevels[3]}
                  readOnly
                  className="accent-rose-600 w-3.5 h-3.5 rounded cursor-pointer pointer-events-none"
                />
                <span className="text-rose-700">H</span>
                <span className="text-[10px] font-normal opacity-80">(High)</span>
              </button>
            </div>
          </div>

          {/* SVG LEVEY-JENNINGS PLOT */}
          {(() => {
            const currentLotConfig = lotConfigs.find(c => c.lotNumber === filterLot);
            const filteredChartRecords = qcRecords
              .filter(r => 
                r.lotNumber === filterLot && 
                (filterWard === '' || r.ward === filterWard) &&
                (filterMonth === '' || r.date.startsWith(filterMonth))
              )
              .sort((a, b) => a.date.localeCompare(b.date));

            if (!currentLotConfig) {
              return <p className="text-xs text-center text-slate-400 py-12">ไม่พบ LOT ที่กำหนดในระบบ</p>;
            }

            // Define config for each level
            const levelDefs = [
              { level: 1, key: 'L', label: 'Level 1 (Low)', shortLabel: 'L (Low)', dataKey: 'level1' as const, color: '#10b981', stats: level1Stats, badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { level: 2, key: 'N', label: 'Level 2 (Normal)', shortLabel: 'N (Normal)', dataKey: 'level2' as const, color: '#0284c7', stats: level2Stats, badgeBg: 'bg-sky-50 text-sky-700 border-sky-200' },
              { level: 3, key: 'H', label: 'Level 3 (High)', shortLabel: 'H (High)', dataKey: 'level3' as const, color: '#f43f5e', stats: level3Stats, badgeBg: 'bg-rose-50 text-rose-700 border-rose-200' },
            ];

            const activeLevelDefs = levelDefs.filter(d => activeLevels[d.level]);

            if (filteredChartRecords.length === 0) {
              return (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                  <BarChart2 size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-500">ไม่มีข้อมูลบันทึก QC ของ LOT {filterLot} เพื่อพล็อตแนวโน้ม</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">กรุณารันผลลัพธ์ QC หรือเปลี่ยนตัวเลือก LOT ด้านบน</p>
                </div>
              );
            }

            // Calculate min and max range based on all enabled active levels
            let rangeMin = Infinity;
            let rangeMax = -Infinity;

            activeLevelDefs.forEach(d => {
              const target = d.stats.mean;
              const sd = d.stats.sd || 1;
              const minVal = target - 3.5 * sd;
              const maxVal = target + 3.5 * sd;
              if (minVal < rangeMin) rangeMin = minVal;
              if (maxVal > rangeMax) rangeMax = maxVal;
            });

            if (!isFinite(rangeMin) || !isFinite(rangeMax) || rangeMin === rangeMax) {
              rangeMin = 0;
              rangeMax = 400;
            }

            // Dimensions of our SVG
            const width = 800;
            const height = 340;
            const paddingLeft = 65;
            const paddingRight = 45;
            const paddingTop = 30;
            const paddingBottom = 45;

            const plotWidth = width - paddingLeft - paddingRight;
            const plotHeight = height - paddingTop - paddingBottom;

            // Coordinate conversion functions
            const getX = (index: number) => {
              if (filteredChartRecords.length <= 1) return paddingLeft + plotWidth / 2;
              return paddingLeft + (index / (filteredChartRecords.length - 1)) * plotWidth;
            };

            const getY = (val: number) => {
              const fraction = (val - rangeMin) / (rangeMax - rangeMin);
              return paddingTop + plotHeight - fraction * plotHeight;
            };

            return (
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
                  <span className="font-extrabold text-slate-800 flex items-center space-x-1.5">
                    <span>แนวโน้มผลการวิเคราะห์ QC (เปรียบเทียบระดับ {activeLevelDefs.map(d => d.key).join(', ')})</span>
                  </span>

                  {/* Active Level Badges & Indicators */}
                  <div className="flex flex-wrap items-center gap-2">
                    {activeLevelDefs.map(d => (
                      <span key={d.level} className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${d.badgeBg}`}>
                        <span className="w-2 h-2 rounded-full mr-1.5 inline-block" style={{ backgroundColor: d.color }}></span>
                        {d.shortLabel} (Target: {Math.round(d.stats.mean)})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <svg className="w-full min-w-[720px] h-84" viewBox={`0 0 ${width} ${height}`}>
                    {/* Background Rect */}
                    <rect x={paddingLeft} y={paddingTop} width={plotWidth} height={plotHeight} fill="#f8fafc" rx="4" />

                    {/* Render target and SD lines for active levels */}
                    {activeLevelDefs.map(d => {
                      const target = d.stats.mean;
                      const sd = d.stats.sd || 1;

                      if (activeLevelDefs.length === 1) {
                        // Full SD gridlines when single level selected
                        const lines = [
                          { val: target, color: d.color, label: 'Mean', strokeWidth: 1.5, strokeDash: '' },
                          { val: target + sd, color: '#94a3b8', label: '+1 SD', strokeWidth: 1, strokeDash: '4,4' },
                          { val: target - sd, color: '#94a3b8', label: '-1 SD', strokeWidth: 1, strokeDash: '4,4' },
                          { val: target + 2 * sd, color: '#f59e0b', label: '+2 SD', strokeWidth: 1.2, strokeDash: '4,2' },
                          { val: target - 2 * sd, color: '#f59e0b', label: '-2 SD', strokeWidth: 1.2, strokeDash: '4,2' },
                          { val: target + 3 * sd, color: '#ef4444', label: '+3 SD', strokeWidth: 1.5, strokeDash: '' },
                          { val: target - 3 * sd, color: '#ef4444', label: '-3 SD', strokeWidth: 1.5, strokeDash: '' },
                        ];

                        return (
                          <g key={`grid-single-${d.level}`}>
                            {/* Translucent control zones */}
                            <rect x={paddingLeft} y={getY(target + 2 * sd)} width={plotWidth} height={getY(target - 2 * sd) - getY(target + 2 * sd)} fill="#10b981" fillOpacity="0.04" />
                            <rect x={paddingLeft} y={getY(target + 3 * sd)} width={plotWidth} height={getY(target + 2 * sd) - getY(target + 3 * sd)} fill="#f59e0b" fillOpacity="0.08" />
                            <rect x={paddingLeft} y={getY(target - 2 * sd)} width={plotWidth} height={getY(target - 3 * sd) - getY(target - 2 * sd)} fill="#f59e0b" fillOpacity="0.08" />

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
                          </g>
                        );
                      } else {
                        // Target lines when multiple levels selected
                        return (
                          <g key={`grid-multi-${d.level}`}>
                            {/* Mean line */}
                            <line
                              x1={paddingLeft}
                              y1={getY(target)}
                              x2={width - paddingRight}
                              y2={getY(target)}
                              stroke={d.color}
                              strokeWidth={1.5}
                              strokeDasharray="4,3"
                            />
                            <text
                              x={paddingLeft - 8}
                              y={getY(target) + 4}
                              textAnchor="end"
                              fill={d.color}
                              className="font-mono text-[9px] font-bold"
                            >
                              {Math.round(target)}
                            </text>
                            <text
                              x={width - paddingRight + 5}
                              y={getY(target) + 4}
                              textAnchor="start"
                              fill={d.color}
                              className="font-bold text-[8px]"
                            >
                              {d.key} Mean
                            </text>
                          </g>
                        );
                      }
                    })}

                    {/* Draw timeline path for each active level */}
                    {activeLevelDefs.map(d => {
                      let pathD = '';
                      filteredChartRecords.forEach((rec, idx) => {
                        const val = rec[d.dataKey];
                        const x = getX(idx);
                        const y = getY(val);
                        if (idx === 0) pathD = `M ${x} ${y}`;
                        else pathD += ` L ${x} ${y}`;
                      });

                      return (
                        <path
                          key={`path-${d.level}`}
                          d={pathD}
                          fill="transparent"
                          stroke={d.color}
                          strokeWidth="2.5"
                          className="transition-all"
                        />
                      );
                    })}

                    {/* Plot data points for each active level */}
                    {activeLevelDefs.map(d => {
                      const target = d.stats.mean;
                      const sd = d.stats.sd || 1;

                      return filteredChartRecords.map((rec, idx) => {
                        const val = rec[d.dataKey];
                        const x = getX(idx);
                        const y = getY(val);
                        const isOut = val < target - 3 * sd || val > target + 3 * sd;

                        return (
                          <g key={`pt-${d.level}-${rec.id}`} className="group cursor-pointer">
                            <circle
                              cx={x}
                              cy={y}
                              r={isOut ? '6' : '4.5'}
                              fill={isOut ? '#ef4444' : d.color}
                              stroke="white"
                              strokeWidth="1.5"
                            />
                            {/* Tooltip Hover Area */}
                            <title>
                              {`ระดับ: ${d.label}\nวันที่: ${rec.date}\nวอร์ด: ${rec.ward}\nเครื่อง: ${rec.serialNumber}\nค่าวิเคราะห์: ${val}\nสถานะ: ${isOut ? 'หลุดเกณฑ์ 3SD (Out of Control!)' : 'ปกติ'}`}
                            </title>

                            {/* X-axis date labels (only once) */}
                            {d.level === activeLevelDefs[0].level && (
                              <text
                                x={x}
                                y={height - paddingBottom + 20}
                                textAnchor="middle"
                                fill="#64748b"
                                transform={`rotate(15 ${x} ${height - paddingBottom + 20})`}
                                className="text-[8px] font-mono font-medium"
                              >
                                {rec.date.substring(5)}
                              </text>
                            )}
                          </g>
                        );
                      });
                    })}
                  </svg>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs text-[11px] text-slate-600 leading-relaxed">
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                <Settings size={16} className="text-sky-600" />
                <span>กำหนดค่าเป้าหมายจำแนกตาม LOT (Target & Range Configuration)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">ระบุค่าควบคุม Target, Min/Max Limit, และ Standard Deviation (SD) เพื่อป้อนให้ระบบคำนวณกราฟและสถานะโดยอัตโนมัติ</p>
            </div>
            {!editingLotIdx && editingLotIdx !== 0 && (
              <button 
                onClick={handleAddLotConfig}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 shrink-0 hover:bg-slate-800 shadow-sm transition-all"
              >
                <Plus size={14} />
                <span>เพิ่ม Lot ใหม่</span>
              </button>
            )}
          </div>

          <div className="space-y-4" id="configs-editor-list">
            {(editingLotIdx === lotConfigs.length ? [...lotConfigs, editedLot!] : lotConfigs).map((cfg, idx) => {
              const isEditing = editingLotIdx === idx;
              return (
                <div key={idx} className="border border-slate-100 rounded-xl p-4 space-y-4 hover:border-slate-200 transition-all bg-slate-50/20">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2">
                      {isEditing && editedLot ? (
                        <input
                          type="text"
                          value={editedLot.lotNumber}
                          onChange={(e) => setEditedLot({ ...editedLot, lotNumber: e.target.value })}
                          className="font-mono font-bold text-xs px-2 py-1 border border-slate-300 rounded focus:border-sky-500 focus:outline-hidden"
                          placeholder="ชื่อ Lot"
                        />
                      ) : (
                        <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">{cfg.lotNumber}</span>
                      )}
                      <span className="text-xs font-semibold text-slate-500 hidden sm:inline-block">สำหรับกลุ่มแถบตรวจวัดค่าน้ำตาล POCT</span>
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
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="config-editing-fields">
                        {/* Level 1 Fields */}
                      <div className="bg-emerald-50/10 p-3.5 rounded-lg border border-emerald-100 space-y-3 text-xs">
                        <h4 className="font-bold text-emerald-700">เกณฑ์ Level 1 (Low)</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-500 block">Min Range</label>
                            <input type="number" step="any" value={editedLot.level1Min} onChange={(e) => setEditedLot({ ...editedLot, level1Min: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-500 block">Max Range</label>
                            <input type="number" step="any" value={editedLot.level1Max} onChange={(e) => setEditedLot({ ...editedLot, level1Max: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                          </div>
                        </div>
                      </div>

                      {/* Level 2 Fields */}
                      <div className="bg-sky-50/10 p-3.5 rounded-lg border border-sky-100 space-y-3 text-xs">
                        <h4 className="font-bold text-sky-700">เกณฑ์ Level 2 (Normal)</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-500 block">Min Range</label>
                            <input type="number" step="any" value={editedLot.level2Min} onChange={(e) => setEditedLot({ ...editedLot, level2Min: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-500 block">Max Range</label>
                            <input type="number" step="any" value={editedLot.level2Max} onChange={(e) => setEditedLot({ ...editedLot, level2Max: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                          </div>
                        </div>
                      </div>

                      {/* Level 3 Fields */}
                      <div className="bg-purple-50/10 p-3.5 rounded-lg border border-purple-100 space-y-3 text-xs">
                        <h4 className="font-bold text-purple-700">เกณฑ์ Level 3 (High)</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-500 block">Min Range</label>
                            <input type="number" step="any" value={editedLot.level3Min} onChange={(e) => setEditedLot({ ...editedLot, level3Min: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-500 block">Max Range</label>
                            <input type="number" step="any" value={editedLot.level3Max} onChange={(e) => setEditedLot({ ...editedLot, level3Max: Number(e.target.value) })} className="w-full p-2 border border-slate-200 rounded" />
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs" id="config-static-fields">
                      {/* Level 1 Summary */}
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-emerald-700 block">Level 1 (Low)</span>
                        <div className="mt-1 font-mono space-y-0.5 text-[11px] text-slate-600">
                          {(cfg.level1Min !== undefined && cfg.level1Max !== undefined && (cfg.level1Min !== 0 || cfg.level1Max !== 0)) ? (
                            <p>Range limit: <span className="font-bold text-slate-800">{cfg.level1Min} - {cfg.level1Max}</span></p>
                          ) : (
                            <p className="text-slate-400 italic">ไม่ได้กำหนดช่วง (Range)</p>
                          )}
                        </div>
                      </div>

                      {/* Level 2 Summary */}
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-sky-700 block">Level 2 (Normal)</span>
                        <div className="mt-1 font-mono space-y-0.5 text-[11px] text-slate-600">
                          {(cfg.level2Min !== undefined && cfg.level2Max !== undefined && (cfg.level2Min !== 0 || cfg.level2Max !== 0)) ? (
                            <p>Range limit: <span className="font-bold text-slate-800">{cfg.level2Min} - {cfg.level2Max}</span></p>
                          ) : (
                            <p className="text-slate-400 italic">ไม่ได้กำหนดช่วง (Range)</p>
                          )}
                        </div>
                      </div>

                      {/* Level 3 Summary */}
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-purple-700 block">Level 3 (High)</span>
                        <div className="mt-1 font-mono space-y-0.5 text-[11px] text-slate-600">
                          {(cfg.level3Min !== undefined && cfg.level3Max !== undefined && (cfg.level3Min !== 0 || cfg.level3Max !== 0)) ? (
                            <p>Range limit: <span className="font-bold text-slate-800">{cfg.level3Min} - {cfg.level3Max}</span></p>
                          ) : (
                            <p className="text-slate-400 italic">ไม่ได้กำหนดช่วง (Range)</p>
                          )}
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
