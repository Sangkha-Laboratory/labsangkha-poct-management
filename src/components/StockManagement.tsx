/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import CustomSelect from "./CustomSelect";
import { DtxMachine } from '../types';
import { dbService } from '../lib/supabase';
import { Search, Plus, Edit2, Trash2, X, RefreshCw, Layers, CheckCircle } from 'lucide-react';

interface StockManagementProps {
  machines: DtxMachine[];
  onAddMachine: (machine: DtxMachine) => void;
  onUpdateMachine: (machine: DtxMachine) => void;
  onDeleteMachine: (id: string) => void;
}

export default function StockManagement({ machines, onAddMachine, onUpdateMachine, onDeleteMachine }: StockManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWard, setFilterWard] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [wards, setWards] = useState<{ en_name: string; thai_name: string }[]>([]);

  useEffect(() => {
    dbService.getWards()
      .then(setWards)
      .catch(err => console.error('Failed to fetch wards:', err));
  }, []);

  // Compute distinct Brands dynamically from dtx_machines (machines prop)
  const distinctBrands = React.useMemo(() => {
    const brandsSet = new Set<string>();
    // Always include VivaChek first
    brandsSet.add('VivaChek');

    machines.forEach((m) => {
      if (m.brand && m.brand.trim()) {
        const cleaned = m.brand.replace(/\(หลัก\)/g, '').trim();
        if (cleaned) brandsSet.add(cleaned);
      }
    });

    return Array.from(brandsSet);
  }, [machines]);

  // Compute distinct Lot numbers dynamically from dtx_machines (machines prop) ONLY
  const distinctLots = React.useMemo(() => {
    const lotSet = new Set<string>();

    machines.forEach((m) => {
      if (m.lotNumber && m.lotNumber.trim()) {
        lotSet.add(m.lotNumber.trim());
      }
    });

    return Array.from(lotSet);
  }, [machines]);

  // Add/Edit Modal state
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentMachineId, setCurrentMachineId] = useState('');

  // Form states
  const [serialNumber, setSerialNumber] = useState('');
  const [machineSerial, setMachineSerial] = useState('');
  const [brand, setBrand] = useState('VivaChek');
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [customBrand, setCustomBrand] = useState('');
  const [model, setModel] = useState('Fad');
  const [ward, setWard] = useState('');
  const [status, setStatus] = useState<DtxMachine['status']>('active');
  const [receiveDate, setReceiveDate] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [isCustomLot, setIsCustomLot] = useState(false);
  const [customLot, setCustomLot] = useState('');
  const [remark, setRemark] = useState('');

  // Check if current typed CODE is duplicate
  const trimmedCode = serialNumber.trim().toUpperCase();
  const isCodeDuplicate = !!trimmedCode && machines.some(m =>
    m.serialNumber.trim().toUpperCase() === trimmedCode &&
    (modalMode === 'add' || m.id !== currentMachineId)
  );

  const openAddModal = () => {
    setModalMode('add');
    setSerialNumber('');
    setMachineSerial('');
    setBrand('VivaChek');
    setIsCustomBrand(false);
    setCustomBrand('');
    setModel('Fad');
    setWard('');
    setStatus('active');
    setReceiveDate(new Date().toISOString().split('T')[0]);
    if (distinctLots.length > 0) {
      setLotNumber(distinctLots[0]);
      setIsCustomLot(false);
      setCustomLot('');
    } else {
      setLotNumber('__custom__');
      setIsCustomLot(true);
      setCustomLot('');
    }
    setRemark('');
    setIsOpenModal(true);
  };

  const openEditModal = (machine: DtxMachine) => {
    setModalMode('edit');
    setCurrentMachineId(machine.id);
    setSerialNumber(machine.serialNumber);
    setMachineSerial(machine.machineSerial || '');

    const cleanedBrand = machine.brand ? machine.brand.replace(/\(หลัก\)/g, '').trim() : 'VivaChek';
    if (distinctBrands.includes(cleanedBrand)) {
      setBrand(cleanedBrand);
      setIsCustomBrand(false);
      setCustomBrand('');
    } else {
      setBrand('__custom__');
      setIsCustomBrand(true);
      setCustomBrand(cleanedBrand);
    }

    setModel(machine.model);
    setWard(machine.ward);
    setStatus(machine.status);
    setReceiveDate(machine.receiveDate);

    if (distinctLots.includes(machine.lotNumber)) {
      setLotNumber(machine.lotNumber);
      setIsCustomLot(false);
      setCustomLot('');
    } else {
      setLotNumber('__custom__');
      setIsCustomLot(true);
      setCustomLot(machine.lotNumber);
    }

    setRemark(machine.remark || '');
    setIsOpenModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const finalBrand = isCustomBrand ? customBrand.trim() : brand;
    const finalLot = isCustomLot ? customLot.trim() : lotNumber;

    if (!serialNumber.trim() || !machineSerial.trim() || !ward || !finalBrand || !finalLot) {
      alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รวมถึงรหัสเครื่อง, หมายเลขซีเรียล S/N, แบรนด์, หน่วยงาน และ LOT)');
      return;
    }

    if (isCodeDuplicate) {
      alert(`ข้อผิดพลาด: รหัสเครื่อง (CODE) "${trimmedCode}" ซ้ำกับเครื่องอื่นในคลัง! กรุณาตรวจสอบรหัสเครื่องใหม่อีกครั้ง`);
      return;
    }

    const machineData: DtxMachine = {
      id: modalMode === 'add' ? String(Date.now()) : currentMachineId,
      serialNumber: serialNumber.trim().toUpperCase(),
      machineSerial: machineSerial.trim().toUpperCase(),
      brand: finalBrand,
      model,
      ward,
      status,
      receiveDate,
      lotNumber: finalLot,
      remark: remark.trim(),
    };

    if (modalMode === 'add') {
      onAddMachine(machineData);
    } else {
      onUpdateMachine(machineData);
    }

    setIsOpenModal(false);
  };

  const handleDelete = (id: string, serial: string) => {
    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบเครื่อง DTX รหัส ${serial} ออกจากระบบ?`)) {
      onDeleteMachine(id);
    }
  };

  // Filtered machines
  const filteredMachines = machines.filter(m => {
    const matchesSearch = m.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (m.machineSerial && m.machineSerial.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          m.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWard = filterWard === '' || m.ward === filterWard;
    const matchesStatus = filterStatus === '' || m.status === filterStatus;
    return matchesSearch && matchesWard && matchesStatus;
  });

  const getStatusDisplay = (s: string) => {
    switch (s) {
      case 'active':
        return <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-500 text-white uppercase tracking-wider shadow-2xs">active</span>;
      case 'inactive':
        return <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-rose-600 text-white uppercase tracking-wider shadow-2xs">inactive</span>;
      case 'lost':
        return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">สูญหาย</span>;
      case 'unknown':
        return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">ไม่ทราบ</span>;
      case 'waiting_claim':
        return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500 text-white">รอส่งเคลม</span>;
      case 'claimed':
        return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-sky-500 text-white">ส่งเคลมแล้ว</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800">{s}</span>;
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6" id="stock-management-panel">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-1.5">
            <Layers size={20} className="text-sky-600" />
            <span>จัดการคลังเครื่องตรวจวัดน้ำตาล (DTX Stock Inventory)</span>
          </h2>
          <p className="text-xs text-slate-400">ควบคุมจำนวน ประจำการ วินิจฉัยสถานะ และบันทึก LOT ของเครื่องทั้งหมดในโรงพยาบาล</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center space-x-1.5 transition-all shrink-0 shadow-md shadow-sky-600/10"
          id="add-machine-btn"
        >
          <Plus size={14} />
          <span>เพิ่มเครื่อง DTX ใหม่</span>
        </button>
      </div>

      {/* Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="stock-filters">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาตามรหัสเครื่อง/แบรนด์/รุ่น..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2.5 pl-9 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500"
          />
        </div>

        <div>
          <CustomSelect
            value={filterWard}
            onChange={(e) => setFilterWard(e.target.value)}
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
          >
            <option value="">-- หน่วยงานทั้งหมด --</option>
            {wards.map((w, idx) => (
              <option key={idx} value={w.thai_name}>{w.thai_name}</option>
            ))}
          </CustomSelect>
        </div>

        <div>
          <CustomSelect
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
          >
            <option value="">-- สถานะทั้งหมด --</option>
            <option value="active">active (ใช้งานปกติ)</option>
            <option value="inactive">inactive (ปิดใช้งาน/เรียกคืน)</option>
            <option value="lost">สูญหาย</option>
            <option value="unknown">ไม่ทราบสถานะ</option>
            <option value="waiting_claim">รอส่งเคลม</option>
            <option value="claimed">ส่งเคลมแล้ว</option>
          </CustomSelect>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto border border-slate-100 rounded-xl" id="stock-table-container">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
              <th className="p-4">รหัสเครื่อง (CODE)</th>
              <th className="p-4">หมายเลขซีเรียล (S/N)</th>
              <th className="p-4">แบรนด์/รุ่น</th>
              <th className="p-4">หน่วยงานประจำการ</th>
              <th className="p-4">LOT</th>
              <th className="p-4">วันที่จ่ายเครื่อง</th>
              <th className="p-4 text-center">สถานะ</th>
              <th className="p-4">หมายเหตุ</th>
              <th className="p-4 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredMachines.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center p-8 text-slate-400">
                  ยังไม่มีข้อมูลรายการเครื่องตรวจวัดน้ำตาล
                </td>
              </tr>
            ) : (
              filteredMachines.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-bold text-slate-800">{m.serialNumber}</td>
                  <td className="p-4 font-mono text-slate-600 font-semibold">{m.machineSerial || '-'}</td>
                  <td className="p-4 text-slate-600 font-medium">
                    {m.brand} <span className="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">{m.model}</span>
                  </td>
                  <td className="p-4 text-slate-700 font-semibold">{m.ward}</td>
                  <td className="p-4">
                    <span className="font-mono text-[10px] bg-sky-50 text-sky-700 font-bold px-2 py-0.5 rounded border border-sky-100">
                      {m.lotNumber}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{m.receiveDate}</td>
                  <td className="p-4 text-center">{getStatusDisplay(m.status)}</td>
                  <td className="p-4 text-slate-500 italic max-w-[150px] truncate" title={m.remark || ''}>
                    {m.remark || '-'}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => openEditModal(m)}
                        className="p-1.5 hover:bg-sky-50 text-sky-600 rounded-lg hover:text-sky-500 transition-colors"
                        title="แก้ไขข้อมูลเครื่อง"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id, m.serialNumber)}
                        className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg hover:text-rose-500 transition-colors"
                        title="ลบเครื่องนี้ออก"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Stock Summary Metrics Footer */}
      <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-wrap justify-between items-center gap-3 text-xs text-slate-500">
        <p>แสดงทั้งหมด <span className="font-bold text-slate-800">{filteredMachines.length}</span> จาก <span className="font-bold text-slate-800">{machines.length}</span> รายการเครื่องตรวจน้ำตาล</p>
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>active: {machines.filter(m => m.status === 'active').length}</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
            <span>inactive: {machines.filter(m => m.status === 'inactive').length}</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
            <span>สูญหาย: {machines.filter(m => m.status === 'lost').length}</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            <span>รอส่งเคลม: {machines.filter(m => m.status === 'waiting_claim').length}</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span>
            <span>ส่งเคลมแล้ว: {machines.filter(m => m.status === 'claimed').length}</span>
          </span>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" id="stock-modal">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 animate-scale-up my-auto">
            <div className="bg-slate-900 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {modalMode === 'add' ? 'เพิ่มเครื่องตรวจวัดน้ำตาลเข้าคลัง' : 'แก้ไขข้อมูลเครื่องตรวจวัดน้ำตาล (DTX)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* CODE */}
                <div className="space-y-1.5 col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700">รหัสเครื่อง (CODE) *</label>
                    {isCodeDuplicate && (
                      <span className="text-[11px] font-bold text-rose-600 animate-pulse">
                        ⚠️ รหัสเครื่องซ้ำในระบบ!
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="เช่น BGM-016"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    disabled={modalMode === 'edit'}
                    className={`w-full text-xs p-2.5 rounded-lg border font-bold disabled:bg-slate-50 disabled:text-slate-400 ${
                      isCodeDuplicate
                        ? 'border-rose-500 bg-rose-50/60 focus:border-rose-600 text-rose-900 focus:outline-none'
                        : 'border-slate-200 focus:outline-hidden focus:border-sky-500'
                    }`}
                    required
                  />
                </div>

                {/* Machine Serial Number (S/N) */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] font-bold text-slate-700">หมายเลขซีเรียลตัวเครื่อง (S/N) *</label>
                  <input
                    type="text"
                    placeholder="เช่น 311A0012BBD"
                    value={machineSerial}
                    onChange={(e) => setMachineSerial(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 font-mono"
                    required
                  />
                </div>

                {/* Brand */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700">แบรนด์ *</label>
                  <CustomSelect
                    value={brand}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBrand(val);
                      if (val === '__custom__') {
                        setIsCustomBrand(true);
                      } else {
                        setIsCustomBrand(false);
                      }
                    }}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                    required
                  >
                    {distinctBrands.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="__custom__">+ เพิ่มแบรนด์ใหม่ (พิมพ์เอง)</option>
                  </CustomSelect>
                  {isCustomBrand && (
                    <input
                      type="text"
                      placeholder="พิมพ์ชื่อแบรนด์ใหม่..."
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      className="w-full text-xs p-2.5 mt-1 rounded-lg border border-sky-300 focus:outline-hidden focus:border-sky-500 bg-sky-50/40 font-semibold"
                      required
                    />
                  )}
                </div>

                {/* Model */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700">รุ่น *</label>
                  <input
                    type="text"
                    placeholder="เช่น Fad"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Ward */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700">หน่วยงาน *</label>
                  <CustomSelect
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                    required
                  >
                    <option value="">-- เลือกหน่วยงาน --</option>
                    {wards.map((w, idx) => (
                      <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                    ))}
                  </CustomSelect>
                </div>

                {/* Lot Configuration mapping */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700">LOT *</label>
                  <CustomSelect
                    value={lotNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLotNumber(val);
                      if (val === '__custom__') {
                        setIsCustomLot(true);
                      } else {
                        setIsCustomLot(false);
                      }
                    }}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                    required
                  >
                    {distinctLots.map((lot, idx) => (
                      <option key={idx} value={lot}>{lot}</option>
                    ))}
                    <option value="__custom__">+ เพิ่ม LOT ใหม่ (พิมพ์เอง)</option>
                  </CustomSelect>
                  {isCustomLot && (
                    <input
                      type="text"
                      placeholder="พิมพ์ LOT ใหม่..."
                      value={customLot}
                      onChange={(e) => setCustomLot(e.target.value)}
                      className="w-full text-xs p-2.5 mt-1 rounded-lg border border-sky-300 focus:outline-hidden focus:border-sky-500 bg-sky-50/40 font-mono font-bold"
                      required
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Receive Date */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700">วันที่จ่ายเครื่อง</label>
                  <input
                    type="date"
                    value={receiveDate}
                    onChange={(e) => setReceiveDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700">สถานะตัวเครื่อง *</label>
                  <CustomSelect
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                    required
                  >
                    <option value="active">active (ใช้งานปกติ)</option>
                    <option value="inactive">inactive (ปิดใช้งาน/เรียกคืน)</option>
                    <option value="lost">สูญหาย</option>
                    <option value="unknown">ไม่ทราบสถานะ</option>
                    <option value="waiting_claim">รอส่งเคลม</option>
                    <option value="claimed">ส่งเคลมแล้ว</option>
                  </CustomSelect>
                </div>
              </div>

              {/* Remark */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700">หมายเหตุ</label>
                <input
                  type="text"
                  placeholder="เช่น เรียกเก็บคืนแล้ว, ชำรุดชั่วคราว, อื่นๆ"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOpenModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-lg transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors flex items-center space-x-1"
                >
                  <CheckCircle size={13} />
                  <span>บันทึกข้อมูล</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
