/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import CustomSelect from "./CustomSelect";
import { DtxMachine, MachineLocationLog } from '../types';
import { dbService } from '../lib/supabase';
import { 
  Search, Plus, Edit2, Trash2, X, RefreshCw, Layers, CheckCircle, 
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  Upload, Download, FileSpreadsheet, FileDown, AlertTriangle, 
  AlertCircle, CheckCircle2, Loader2, Sparkles, History, ArrowRightLeft,
  Calendar, User, ArrowRight, Clock, Building2, Check, ArrowRightCircle
} from 'lucide-react';

interface StockManagementProps {
  machines: DtxMachine[];
  onAddMachine: (machine: DtxMachine) => void;
  onUpdateMachine: (machine: DtxMachine) => void;
  onDeleteMachine: (id: string) => void;
  onBulkAddMachines?: (machines: DtxMachine[], overwrite?: boolean) => Promise<{ success: number; failed: number }>;
}

interface ParsedMachineRow {
  rowNum: number;
  raw: Record<string, string>;
  machine: DtxMachine;
  isValid: boolean;
  validationError?: string;
  isExisting: boolean;
  existingMachine?: DtxMachine;
}

export default function StockManagement({ 
  machines, 
  onAddMachine, 
  onUpdateMachine, 
  onDeleteMachine,
  onBulkAddMachines 
}: StockManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWard, setFilterWard] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [wards, setWards] = useState<{ en_name: string; thai_name: string }[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterWard, filterStatus]);

  useEffect(() => {
    dbService.getWards()
      .then(setWards)
      .catch(err => console.error('Failed to fetch wards:', err));
  }, []);

  // Compute deduplicated machines list (unique by serialNumber/CODE and id)
  const deduplicatedMachines = React.useMemo(() => {
    const seenCodes = new Set<string>();
    const seenIds = new Set<string>();
    const result: DtxMachine[] = [];

    for (const m of machines) {
      if (!m) continue;
      const codeKey = (m.serialNumber || '').trim().toUpperCase();
      const idKey = (m.id || '').trim();

      // If we already have a machine with this CODE or ID, skip duplicate
      if (codeKey && seenCodes.has(codeKey)) continue;
      if (idKey && seenIds.has(idKey)) continue;

      if (codeKey) seenCodes.add(codeKey);
      if (idKey) seenIds.add(idKey);
      result.push(m);
    }
    return result;
  }, [machines]);

  // Compute distinct Brands dynamically from deduplicated dtx_machines
  const distinctBrands = React.useMemo(() => {
    const brandsSet = new Set<string>();

    deduplicatedMachines.forEach((m) => {
      if (m.brand && m.brand.trim()) {
        const cleaned = m.brand.replace(/\(หลัก\)/g, '').trim();
        if (cleaned) brandsSet.add(cleaned);
      }
    });

    return Array.from(brandsSet);
  }, [deduplicatedMachines]);

  // Compute distinct Lot numbers dynamically from deduplicated dtx_machines ONLY
  const distinctLots = React.useMemo(() => {
    const lotSet = new Set<string>();

    deduplicatedMachines.forEach((m) => {
      if (m.lotNumber && m.lotNumber.trim()) {
        lotSet.add(m.lotNumber.trim());
      }
    });

    return Array.from(lotSet);
  }, [deduplicatedMachines]);

  // Add/Edit Modal state
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentMachineId, setCurrentMachineId] = useState('');

  // Form states
  const [serialNumber, setSerialNumber] = useState('');
  const [machineSerial, setMachineSerial] = useState('');
  const [brand, setBrand] = useState('');
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [customBrand, setCustomBrand] = useState('');
  const [model, setModel] = useState('');
  const [ward, setWard] = useState('');
  const [status, setStatus] = useState<DtxMachine['status']>('active');
  const [receiveDate, setReceiveDate] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [isCustomLot, setIsCustomLot] = useState(false);
  const [customLot, setCustomLot] = useState('');
  const [remark, setRemark] = useState('');

  // =========================================================================
  // Location History & Transfer States
  // =========================================================================
  const [selectedMachineForHistory, setSelectedMachineForHistory] = useState<DtxMachine | null>(null);
  const [isOpenHistoryModal, setIsOpenHistoryModal] = useState(false);
  const [transferToWard, setTransferToWard] = useState('');
  const [transferActionType, setTransferActionType] = useState<MachineLocationLog['actionType']>('transfer');
  const [transferReason, setTransferReason] = useState('');
  const [transferOperator, setTransferOperator] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferStatus, setTransferStatus] = useState<DtxMachine['status']>('active');
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);

  // =========================================================================
  // CSV Import States
  // =========================================================================
  const [isOpenCsvModal, setIsOpenCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedMachineRow[]>([]);
  const [importStrategy, setImportStrategy] = useState<'skip_existing' | 'overwrite_existing'>('skip_existing');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'duplicate' | 'invalid'>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResultToast, setImportResultToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if current typed CODE is duplicate
  const trimmedCode = serialNumber.trim().toUpperCase();
  const isCodeDuplicate = !!trimmedCode && deduplicatedMachines.some(m =>
    m.serialNumber.trim().toUpperCase() === trimmedCode &&
    (modalMode === 'add' || (m.id !== currentMachineId && m.serialNumber.trim().toUpperCase() !== trimmedCode))
  );

  const openAddModal = () => {
    setModalMode('add');
    setSerialNumber('');
    setMachineSerial('');
    if (distinctBrands.length > 0) {
      setBrand(distinctBrands[0]);
      setIsCustomBrand(false);
      setCustomBrand('');
    } else {
      setBrand('__custom__');
      setIsCustomBrand(true);
      setCustomBrand('');
    }
    setModel('');
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
    setSerialNumber(machine.serialNumber || '');
    setMachineSerial(machine.machineSerial || '');

    const cleanedBrand = machine.brand ? machine.brand.replace(/\(หลัก\)/g, '').trim() : '';
    if (cleanedBrand && distinctBrands.includes(cleanedBrand)) {
      setBrand(cleanedBrand);
      setIsCustomBrand(false);
      setCustomBrand('');
    } else {
      setBrand('__custom__');
      setIsCustomBrand(true);
      setCustomBrand(cleanedBrand);
    }

    setModel(machine.model || '');
    setWard(machine.ward || '');
    setStatus(machine.status || 'active');
    setReceiveDate(machine.receiveDate || '');

    if (machine.lotNumber && distinctLots.includes(machine.lotNumber)) {
      setLotNumber(machine.lotNumber);
      setIsCustomLot(false);
      setCustomLot('');
    } else {
      setLotNumber('__custom__');
      setIsCustomLot(true);
      setCustomLot(machine.lotNumber || '');
    }

    setRemark(machine.remark || '');
    setIsOpenModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const finalBrand = (isCustomBrand ? customBrand.trim() : brand).trim();
    const finalLot = (isCustomLot ? customLot.trim() : lotNumber).trim();
    const finalWard = ward.trim() || 'ไม่ระบุหน่วยงาน';
    const finalSerial = machineSerial.trim().toUpperCase() || '-';

    if (!serialNumber.trim()) {
      alert('กรุณาระบุรหัสเครื่อง (CODE)');
      return;
    }

    if (isCodeDuplicate) {
      alert(`ข้อผิดพลาด: รหัสเครื่อง (CODE) "${trimmedCode}" ซ้ำกับเครื่องอื่นในคลัง! กรุณาตรวจสอบรหัสเครื่องใหม่อีกครั้ง`);
      return;
    }

    const existingMachine = deduplicatedMachines.find(m => m.id === currentMachineId || m.serialNumber === serialNumber.trim().toUpperCase());
    let history: MachineLocationLog[] = existingMachine?.locationHistory ? [...existingMachine.locationHistory] : [];

    // If editing and the ward was changed, automatically append an edit/transfer log
    if (modalMode === 'edit' && existingMachine && existingMachine.ward && existingMachine.ward !== finalWard) {
      history.unshift({
        id: `LOG-${Date.now()}`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        fromWard: existingMachine.ward,
        toWard: finalWard,
        actionType: 'edit',
        reason: remark.trim() || 'แก้ไขข้อมูลหน่วยงานประจำการ',
        operator: 'ผู้ดูแลระบบ'
      });
    }

    const machineData: DtxMachine = {
      id: modalMode === 'add' ? String(Date.now()) : currentMachineId,
      serialNumber: serialNumber.trim().toUpperCase(),
      machineSerial: finalSerial,
      brand: finalBrand,
      model: model.trim(),
      ward: finalWard,
      status: status || 'active',
      receiveDate: receiveDate || new Date().toISOString().split('T')[0],
      lotNumber: finalLot,
      remark: remark.trim(),
      locationHistory: history.length > 0 ? history : undefined,
    };

    if (modalMode === 'add') {
      onAddMachine(machineData);
    } else {
      onUpdateMachine(machineData);
    }

    setIsOpenModal(false);
  };

  const openHistoryModal = (machine: DtxMachine) => {
    setSelectedMachineForHistory(machine);
    setTransferToWard('');
    setTransferActionType('return_to_lab');
    setTransferReason('');
    setTransferOperator('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferStatus(machine.status || 'active');
    setIsOpenHistoryModal(true);
  };

  const applyReturnToLabPreset = () => {
    const labWard = wards.find(w => w.thai_name.includes('LAB') || w.thai_name.includes('ห้องปฏิบัติการ'))?.thai_name || 'ห้องปฏิบัติการเทคนิคการแพทย์ (LAB)';
    setTransferToWard(labWard);
    setTransferActionType('return_to_lab');
    setTransferReason('คนไข้ Home Ward สิ้นสุดการรักษา/ส่งคืนแลปเพื่อใช้เป็นเครื่องสำรองหมุนเวียน');
    setTransferStatus('active');
  };

  const applyBackupLoanPreset = () => {
    setTransferActionType('backup_loan');
    setTransferReason('จ่ายยืมเป็นเครื่องสำรองทดแทนเครื่องส่งซ่อม');
    setTransferStatus('active');
  };

  const applyWardTransferPreset = () => {
    setTransferActionType('transfer');
    setTransferReason('โอนย้ายสถานที่ติดตั้ง/ประจำการใหม่');
    setTransferStatus('active');
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineForHistory) return;
    if (!transferToWard) {
      alert('กรุณาเลือกหน่วยงานปลายทาง');
      return;
    }

    setIsSavingTransfer(true);
    try {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const newLog: MachineLocationLog = {
        id: `LOG-${Date.now()}`,
        date: transferDate ? `${transferDate} ${nowStr.split(' ')[1] || '12:00'}` : nowStr,
        fromWard: selectedMachineForHistory.ward || 'ไม่ระบุ',
        toWard: transferToWard,
        actionType: transferActionType,
        reason: transferReason.trim() || (transferActionType === 'return_to_lab' ? 'ส่งคืนแลปเพื่อสำรอง' : 'โอนย้ายสถานที่ติดตั้ง'),
        operator: transferOperator.trim() || 'เจ้าหน้าที่'
      };

      const existingLogs = selectedMachineForHistory.locationHistory || [];
      const updatedHistory = [newLog, ...existingLogs];

      const updatedMachine: DtxMachine = {
        ...selectedMachineForHistory,
        ward: transferToWard,
        status: transferStatus,
        locationHistory: updatedHistory,
        remark: transferReason.trim() 
          ? `[${transferActionType === 'return_to_lab' ? 'ส่งคืนแลป' : transferActionType === 'backup_loan' ? 'ยืมสำรอง' : 'โอนย้าย'}] ${transferReason.trim()}`
          : selectedMachineForHistory.remark
      };

      await onUpdateMachine(updatedMachine);
      setSelectedMachineForHistory(updatedMachine);
      setTransferReason('');
      alert(`บันทึกประวัติการย้ายเครื่อง ${selectedMachineForHistory.serialNumber} ไปยัง "${transferToWard}" เรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error(err);
      alert(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
    } finally {
      setIsSavingTransfer(false);
    }
  };

  const handleCreateInitialLog = async () => {
    if (!selectedMachineForHistory) return;
    const initialLog: MachineLocationLog = {
      id: `LOG-${Date.now()}`,
      date: selectedMachineForHistory.receiveDate ? `${selectedMachineForHistory.receiveDate} 08:30` : new Date().toISOString().replace('T', ' ').substring(0, 16),
      fromWard: 'คลังพัสดุ / บริษัทส่งมอบ',
      toWard: selectedMachineForHistory.ward || 'ไม่ระบุ',
      actionType: 'initial_deploy',
      reason: 'บันทึกประวัติแรกเริ่มประจำการเครื่อง',
      operator: 'ผู้ดูแลระบบ'
    };

    const updatedMachine: DtxMachine = {
      ...selectedMachineForHistory,
      locationHistory: [initialLog]
    };

    await onUpdateMachine(updatedMachine);
    setSelectedMachineForHistory(updatedMachine);
  };

  const handleDelete = (id: string, serial: string) => {
    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบเครื่อง DTX รหัส ${serial} ออกจากระบบ?`)) {
      onDeleteMachine(id);
    }
  };

  // =========================================================================
  // CSV Import Helpers & Parser Logic
  // =========================================================================

  const parseCsvLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        if (inQuotes && line[i + 1] === char) {
          current += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const normalizeDate = (val: string): string => {
    if (!val || !val.trim()) return new Date().toISOString().split('T')[0];
    const cleaned = val.trim();
    
    // Check YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleaned)) {
      const [y, m, d] = cleaned.split('-').map(Number);
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // Check DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      let [_, d, m, y] = dmyMatch;
      let yearNum = Number(y);
      // If Buddhist Era year (e.g. 2569 -> 2026)
      if (yearNum > 2400) {
        yearNum -= 543;
      }
      return `${yearNum}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    return new Date().toISOString().split('T')[0];
  };

  const normalizeStatus = (val: string): DtxMachine['status'] => {
    if (!val) return 'active';
    const s = val.trim().toLowerCase();
    if (s.includes('active') || s.includes('ใช้งาน') || s.includes('ปกติ') || s.includes('พร้อม') || s.includes('คืน')) return 'active';
    if (s.includes('lost') || s.includes('สูญหาย') || s.includes('หาย')) return 'lost';
    if (s.includes('waiting') || s.includes('รอเคลม') || s.includes('รอส่งเคลม') || s.includes('ชำรุด') || s.includes('เสีย')) return 'waiting_claim';
    if (s.includes('claimed') || s.includes('เคลมแล้ว') || s.includes('ส่งเคลม')) return 'claimed';
    if (s.includes('unknown') || s.includes('ไม่ทราบ')) return 'unknown';
    return 'active';
  };

  const parseCsvText = (text: string) => {
    setIsParsingCsv(true);
    setCsvParseError(null);

    try {
      // 1. Remove BOM and normalize line endings
      const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = cleanText.split('\n').filter(l => l.trim().length > 0);

      if (lines.length < 2) {
        setCsvParseError('ไฟล์ CSV ต้องมีหัวตาราง (Header) และข้อมูลอย่างน้อย 1 แถว');
        setIsParsingCsv(false);
        return;
      }

      // 2. Detect delimiter (comma vs semicolon vs tab)
      const firstLine = lines[0];
      let delimiter = ',';
      const commaCount = (firstLine.match(/,/g) || []).length;
      const semiCount = (firstLine.match(/;/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;
      if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
      else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

      // 3. Parse headers
      const rawHeaders = parseCsvLine(firstLine, delimiter).map(h => h.toLowerCase().replace(/[\s_\-]/g, ''));
      
      const headerMap: {
        codeIdx: number;
        serialIdx: number;
        brandIdx: number;
        modelIdx: number;
        wardIdx: number;
        lotIdx: number;
        dateIdx: number;
        statusIdx: number;
        remarkIdx: number;
      } = {
        codeIdx: -1,
        serialIdx: -1,
        brandIdx: -1,
        modelIdx: -1,
        wardIdx: -1,
        lotIdx: -1,
        dateIdx: -1,
        statusIdx: -1,
        remarkIdx: -1,
      };

      rawHeaders.forEach((h, idx) => {
        if (h.includes('รหัส') || h.includes('bgm') || h.includes('code') || (h.includes('serial') && !h.includes('number') && headerMap.codeIdx === -1) || h.includes('เครื่อง')) {
          if (headerMap.codeIdx === -1) headerMap.codeIdx = idx;
        } else if (h.includes('ซีเรียล') || h.includes('s/n') || h.includes('sn') || h.includes('machineserial') || (h.includes('serial') && headerMap.serialIdx === -1)) {
          if (headerMap.serialIdx === -1) headerMap.serialIdx = idx;
        } else if (h.includes('แบรนด์') || h.includes('ยี่ห้อ') || h.includes('brand') || h.includes('make')) {
          headerMap.brandIdx = idx;
        } else if (h.includes('รุ่น') || h.includes('โมเดล') || h.includes('model')) {
          headerMap.modelIdx = idx;
        } else if (h.includes('หน่วยงาน') || h.includes('วอร์ด') || h.includes('แผนก') || h.includes('ward') || h.includes('dept') || h.includes('department')) {
          headerMap.wardIdx = idx;
        } else if (h.includes('lot') || h.includes('ล็อต') || h.includes('ล๊อต')) {
          headerMap.lotIdx = idx;
        } else if (h.includes('วัน') || h.includes('date') || h.includes('rec') || h.includes('install')) {
          headerMap.dateIdx = idx;
        } else if (h.includes('สถานะ') || h.includes('status')) {
          headerMap.statusIdx = idx;
        } else if (h.includes('หมายเหตุ') || h.includes('remark') || h.includes('note')) {
          headerMap.remarkIdx = idx;
        }
      });

      // Fallback if headers were simple index order
      if (headerMap.codeIdx === -1 && rawHeaders.length > 0) headerMap.codeIdx = 0;
      if (headerMap.serialIdx === -1 && rawHeaders.length > 1) headerMap.serialIdx = 1;
      if (headerMap.wardIdx === -1 && rawHeaders.length > 2) headerMap.wardIdx = 2;

      const seenCodesInFile = new Set<string>();
      const parsed: ParsedMachineRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i], delimiter);
        if (cols.length === 0 || cols.every(c => !c.trim())) continue;

        const rawCode = headerMap.codeIdx >= 0 ? cols[headerMap.codeIdx] || '' : '';
        const rawSerial = headerMap.serialIdx >= 0 ? cols[headerMap.serialIdx] || '' : '';
        const rawBrand = headerMap.brandIdx >= 0 ? cols[headerMap.brandIdx] || '' : '';
        const rawModel = headerMap.modelIdx >= 0 ? cols[headerMap.modelIdx] || '' : '';
        const rawWard = headerMap.wardIdx >= 0 ? cols[headerMap.wardIdx] || '' : '';
        const rawLot = headerMap.lotIdx >= 0 ? cols[headerMap.lotIdx] || '' : '';
        const rawDate = headerMap.dateIdx >= 0 ? cols[headerMap.dateIdx] || '' : '';
        const rawStatus = headerMap.statusIdx >= 0 ? cols[headerMap.statusIdx] || '' : '';
        const rawRemark = headerMap.remarkIdx >= 0 ? cols[headerMap.remarkIdx] || '' : '';

        const codeVal = rawCode.trim().toUpperCase();
        const serialVal = (rawSerial.trim() || codeVal).toUpperCase();
        const brandVal = rawBrand.trim();
        const modelVal = rawModel.trim();
        const wardVal = rawWard.trim();
        const lotVal = rawLot.trim();
        const dateVal = normalizeDate(rawDate);
        const statusVal = normalizeStatus(rawStatus);
        const remarkVal = rawRemark.trim();

        // If ward is missing, use default
        const effectiveWard = wardVal || 'ไม่ระบุหน่วยงาน';
        const effectiveSerial = serialVal || codeVal;

        // Check validation - only codeVal is strictly required
        let isValid = true;
        let validationError = '';

        if (!codeVal) {
          isValid = false;
          validationError = 'ไม่พบรหัสเครื่อง (CODE)';
        } else if (seenCodesInFile.has(codeVal)) {
          isValid = false;
          validationError = 'รหัสเครื่องซ้ำกันภายในไฟล์ CSV เดียวกัน';
        }

        if (codeVal) {
          seenCodesInFile.add(codeVal);
        }

        // Check if exists in current database/system
        const existingMachine = machines.find(m => m.serialNumber.trim().toUpperCase() === codeVal);
        const isExisting = !!existingMachine;

        const machineObj: DtxMachine = {
          id: existingMachine ? existingMachine.id : `imp-${Date.now()}-${i}`,
          serialNumber: codeVal,
          machineSerial: effectiveSerial,
          brand: brandVal,
          model: modelVal,
          ward: effectiveWard,
          lotNumber: lotVal,
          receiveDate: dateVal,
          status: statusVal,
          remark: remarkVal || undefined
        };

        parsed.push({
          rowNum: i,
          raw: { codeVal, serialVal, brandVal, modelVal, wardVal, lotVal, dateVal, statusVal, remarkVal },
          machine: machineObj,
          isValid,
          validationError: validationError || undefined,
          isExisting,
          existingMachine
        });
      }

      if (parsed.length === 0) {
        setCsvParseError('ไม่พบแถวข้อมูลที่สามารถอ่านได้ในไฟล์ CSV');
      } else {
        setParsedRows(parsed);
      }
    } catch (err: any) {
      console.error('CSV Parsing Error:', err);
      setCsvParseError(`เกิดข้อผิดพลาดในการอ่านไฟล์ CSV: ${err.message || err}`);
    } finally {
      setIsParsingCsv(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        parseCsvText(content);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel')) {
      setCsvFile(file);
      setCsvFileName(file.name);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target?.result as string;
        if (content) {
          parseCsvText(content);
        }
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      alert('กรุณาเลือกไฟล์รูปแบบ .csv เท่านั้น');
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ['รหัสเครื่อง(CODE)', 'หมายเลขซีเรียล(S/N)', 'แบรนด์', 'รุ่น', 'หน่วยงานประจำการ', 'LOT', 'วันที่รับเครื่อง(YYYY-MM-DD)', 'สถานะ(active/inactive/lost)', 'หมายเหตุ'];
    const sampleWard1 = wards.length > 0 ? wards[0].thai_name : 'หอผู้ป่วยใน 1';
    const sampleWard2 = wards.length > 1 ? wards[1].thai_name : 'ห้องฉุกเฉิน (ER)';
    const sampleWard3 = wards.length > 2 ? wards[2].thai_name : 'หอผู้ป่วยวิกฤต (ICU)';

    const sampleRows = [
      ['BGM-901', '103A2002FB1', 'VivaChek', 'Fad', sampleWard1, 'LOT-2026-01', '2026-01-15', 'active', 'เครื่องประจำหอผู้ป่วย'],
      ['BGM-902', '103A2002FB2', 'VivaChek', 'Fad', sampleWard2, 'LOT-2026-01', '2026-02-10', 'active', 'ประจำรถเข็นฉุกเฉิน'],
      ['BGM-903', '103A2002FB3', 'Accu-Chek', 'Instant', sampleWard3, 'LOT-2026-02', '2026-03-01', 'active', 'เครื่องใหม่'],
    ];

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...sampleRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'dtx_machines_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (machines.length === 0) {
      alert('ยังไม่มีข้อมูลเครื่อง DTX ในระบบให้ส่งออก');
      return;
    }

    const headers = ['รหัสเครื่อง(CODE)', 'หมายเลขซีเรียล(S/N)', 'แบรนด์', 'รุ่น', 'หน่วยงานประจำการ', 'LOT', 'วันที่รับเครื่อง', 'สถานะ', 'หมายเหตุ'];
    
    const rows = (sortedAndFilteredMachines.length > 0 ? sortedAndFilteredMachines : machines).map(m => [
      m.serialNumber,
      m.machineSerial || '',
      m.brand || '',
      m.model || '',
      m.ward || '',
      m.lotNumber || '',
      m.receiveDate || '',
      m.status || 'active',
      m.remark || ''
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dtx_machines_stock_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    // Filter candidate machines according to validation and strategy
    const candidatesToImport: DtxMachine[] = [];
    let skippedCount = 0;

    parsedRows.forEach(row => {
      if (!row.isValid) return;

      if (row.isExisting) {
        if (importStrategy === 'overwrite_existing') {
          candidatesToImport.push(row.machine);
        } else {
          skippedCount++;
        }
      } else {
        candidatesToImport.push(row.machine);
      }
    });

    if (candidatesToImport.length === 0) {
      alert('ไม่มีรายการที่สามารถนำเข้าได้ (รายการทั้งหมดอาจไม่ถูกต้อง หรือถูกข้ามเนื่องจากซ้ำกับข้อมูลเดิม)');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: candidatesToImport.length });

    try {
      if (onBulkAddMachines) {
        const res = await onBulkAddMachines(candidatesToImport, importStrategy === 'overwrite_existing');
        setImportResultToast(`นำเข้าข้อมูลสำเร็จ ${res.success} รายการ${res.failed > 0 ? ` (ไม่สำเร็จ ${res.failed} รายการ)` : ''}${skippedCount > 0 ? ` ข้ามรายการซ้ำ ${skippedCount} รายการ` : ''}`);
      } else {
        // Fallback sequential execution
        let success = 0;
        for (let i = 0; i < candidatesToImport.length; i++) {
          const m = candidatesToImport[i];
          const exists = machines.find(x => x.serialNumber === m.serialNumber || x.id === m.id);
          if (exists && importStrategy === 'overwrite_existing') {
            onUpdateMachine(m);
          } else {
            onAddMachine(m);
          }
          success++;
          setImportProgress({ current: i + 1, total: candidatesToImport.length });
        }
        setImportResultToast(`นำเข้าข้อมูลสำเร็จ ${success} รายการ${skippedCount > 0 ? ` (ข้ามรายการซ้ำ ${skippedCount} รายการ)` : ''}`);
      }

      // Close modal and reset state after a short delay
      setTimeout(() => {
        setIsImporting(false);
        setIsOpenCsvModal(false);
        setCsvFile(null);
        setCsvFileName('');
        setParsedRows([]);
      }, 1000);

    } catch (err: any) {
      console.error('Import execution error:', err);
      alert(`เกิดข้อผิดพลาดในการนำเข้า: ${err.message || err}`);
      setIsImporting(false);
    }
  };

  const validRowsCount = parsedRows.filter(r => r.isValid && !r.isExisting).length;
  const duplicateRowsCount = parsedRows.filter(r => r.isValid && r.isExisting).length;
  const invalidRowsCount = parsedRows.filter(r => !r.isValid).length;

  const filteredPreviewRows = parsedRows.filter(r => {
    if (previewFilter === 'valid') return r.isValid && !r.isExisting;
    if (previewFilter === 'duplicate') return r.isValid && r.isExisting;
    if (previewFilter === 'invalid') return !r.isValid;
    return true;
  });

  // Sorting states - Default sorting to serialNumber (CODE) asc
  const [sortField, setSortField] = useState<keyof DtxMachine>('serialNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filtered machines - always based on deduplicated data
  const filteredMachines = deduplicatedMachines.filter(m => {
    const matchesSearch = m.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (m.machineSerial && m.machineSerial.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          m.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWard = filterWard === '' || m.ward === filterWard;
    const matchesStatus = filterStatus === '' || m.status === filterStatus;
    return matchesSearch && matchesWard && matchesStatus;
  });

  // Sort machines
  const sortedAndFilteredMachines = React.useMemo(() => {
    const sorted = [...filteredMachines];
    sorted.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (typeof valA === 'string') {
        valA = valA.trim().toLowerCase();
      }
      if (typeof valB === 'string') {
        valB = valB.trim().toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredMachines, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedAndFilteredMachines.length / itemsPerPage);
  const paginatedMachines = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFilteredMachines.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFilteredMachines, currentPage]);

  const handleSort = (field: keyof DtxMachine) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: keyof DtxMachine) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="inline ml-1 text-slate-400 group-hover:text-slate-600 transition-colors" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp size={12} className="inline ml-1 text-sky-600" />
      : <ArrowDown size={12} className="inline ml-1 text-sky-600" />;
  };

  const getStatusDisplay = (s: string) => {
    const baseClasses = "inline-flex items-center justify-center w-[74px] py-1 rounded-md text-[10px] text-center shadow-2xs whitespace-nowrap";
    switch (s) {
      case 'active':
        return <span className={`${baseClasses} font-extrabold bg-emerald-500 text-white uppercase tracking-wider`}>active</span>;
      case 'inactive':
        return <span className={`${baseClasses} font-extrabold bg-rose-600 text-white uppercase tracking-wider`}>inactive</span>;
      case 'lost':
        return <span className={`${baseClasses} font-bold bg-orange-100 text-orange-800 border border-orange-200`}>สูญหาย</span>;
      case 'unknown':
        return <span className={`${baseClasses} font-bold bg-slate-100 text-slate-600`}>ไม่ทราบ</span>;
      case 'waiting_claim':
        return <span className={`${baseClasses} font-bold bg-amber-500 text-white`}>รอส่งเคลม</span>;
      case 'claimed':
        return <span className={`${baseClasses} font-bold bg-sky-500 text-white`}>ส่งเคลมแล้ว</span>;
      default:
        return <span className={`${baseClasses} font-bold bg-slate-100 text-slate-800`}>{s}</span>;
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
          <p className="text-xs text-slate-400">ควบคุมจำนวน ประจำการ วินิจฉัยสถานะ บันทึก LOT และนำเข้า/ส่งออกข้อมูลเครื่อง DTX ทั้งหมดในโรงพยาบาล</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center space-x-1.5 transition-all shadow-2xs border border-slate-200/80 cursor-pointer"
            title="ส่งออกรายการเครื่อง DTX เป็นไฟล์ CSV"
            id="export-csv-btn"
          >
            <Download size={14} className="text-slate-500" />
            <span>ส่งออก CSV</span>
          </button>

          {/* CSV Import Button */}
          <button
            onClick={() => {
              setParsedRows([]);
              setCsvFile(null);
              setCsvFileName('');
              setCsvParseError(null);
              setIsOpenCsvModal(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
            title="นำเข้าไฟล์ CSV เพิ่มเครื่อง DTX จำนวนมาก"
            id="import-csv-btn"
          >
            <Upload size={14} />
            <span>นำเข้าไฟล์ CSV</span>
          </button>

          {/* Add Single Machine Button */}
          <button
            onClick={openAddModal}
            className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 transition-all shadow-md shadow-sky-600/10 cursor-pointer"
            id="add-machine-btn"
          >
            <Plus size={14} />
            <span>เพิ่มเครื่อง DTX ใหม่</span>
          </button>
        </div>
      </div>

      {/* Result Toast if set */}
      {importResultToast && (
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between text-xs text-emerald-900 animate-fadeIn">
          <div className="flex items-center space-x-2 font-bold">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{importResultToast}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setImportResultToast(null)} 
            className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="stock-filters">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาตามรหัสเครื่อง/แบรนด์/รุ่น/S/N..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2.5 pl-9 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500"
          />
        </div>

        <div>
          <CustomSelect
            value={filterWard}
            onChange={(e) => setFilterWard(e.target.value)}
            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
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
            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
          >
            <option value="">-- สถานะทั้งหมด --</option>
            <option value="active">active (ใช้งานปกติ)</option>
            <option value="lost">สูญหาย</option>
            <option value="unknown">ไม่ทราบสถานะ</option>
            <option value="waiting_claim">รอส่งเคลม</option>
            <option value="claimed">ส่งเคลมแล้ว</option>
          </CustomSelect>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto border border-slate-100 rounded-xl" id="stock-table-container">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-[11px] sm:text-xs">
              <th 
                className="px-3 py-3 text-center whitespace-nowrap cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('serialNumber')}
              >
                <div className="inline-flex items-center justify-center space-x-1">
                  <span>CODE</span>
                  {renderSortIcon('serialNumber')}
                </div>
              </th>
              <th 
                className="px-3 py-3 text-center whitespace-nowrap cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('machineSerial')}
              >
                <div className="inline-flex items-center justify-center space-x-1">
                  <span>S/N</span>
                  {renderSortIcon('machineSerial')}
                </div>
              </th>
              <th 
                className="px-3 py-3 text-center whitespace-nowrap cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('brand')}
              >
                <div className="inline-flex items-center justify-center space-x-1">
                  <span>แบรนด์</span>
                  {renderSortIcon('brand')}
                </div>
              </th>
              <th 
                className="px-2.5 py-3 text-center whitespace-nowrap cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('model')}
              >
                <div className="inline-flex items-center justify-center space-x-1">
                  <span>รุ่น</span>
                  {renderSortIcon('model')}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-center whitespace-nowrap cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('ward')}
              >
                <div className="inline-flex items-center justify-center space-x-1">
                  <span>หน่วยงานประจำการ</span>
                  {renderSortIcon('ward')}
                </div>
              </th>
              <th 
                className="px-3 py-3 text-center whitespace-nowrap cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('lotNumber')}
              >
                <div className="inline-flex items-center justify-center space-x-1">
                  <span>LOT</span>
                  {renderSortIcon('lotNumber')}
                </div>
              </th>
              <th 
                className="px-3 py-3 text-center whitespace-nowrap cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('receiveDate')}
              >
                <div className="inline-flex items-center justify-center space-x-1">
                  <span>วันที่จ่ายเครื่อง</span>
                  {renderSortIcon('receiveDate')}
                </div>
              </th>
              <th 
                className="px-3 py-3 text-center whitespace-nowrap cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="inline-flex items-center justify-center space-x-1">
                  <span>สถานะ</span>
                  {renderSortIcon('status')}
                </div>
              </th>
              <th className="px-3 py-3 text-center whitespace-nowrap">
                <div className="inline-flex items-center justify-center">
                  <span>หมายเหตุ</span>
                </div>
              </th>
              <th className="px-3 py-3 text-center whitespace-nowrap">
                <div className="inline-flex items-center justify-center">
                  <span>จัดการ</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedMachines.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center p-8 text-slate-400">
                  ยังไม่มีข้อมูลรายการเครื่องตรวจวัดน้ำตาล
                </td>
              </tr>
            ) : (
              paginatedMachines.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-2.5 font-bold text-slate-800 text-center whitespace-nowrap">{m.serialNumber}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-600 font-semibold text-center whitespace-nowrap">{m.machineSerial || '-'}</td>
                  <td className="px-3 py-2.5 text-slate-700 font-semibold text-center whitespace-nowrap">{m.brand || '-'}</td>
                  <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                    <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                      {m.model || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 font-semibold text-left whitespace-nowrap">{m.ward || '-'}</td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <span className="font-mono text-[10px] bg-sky-50 text-sky-700 font-bold px-2 py-0.5 rounded border border-sky-100">
                      {m.lotNumber || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 text-center whitespace-nowrap">{m.receiveDate || '-'}</td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">{getStatusDisplay(m.status)}</td>
                  <td className="px-3 py-2.5 text-slate-500 italic text-center whitespace-nowrap" title={m.remark || ''}>
                    {m.remark && m.remark.trim() ? (
                      m.remark.trim().length > 8 ? `${m.remark.trim().slice(0, 8)}...` : m.remark.trim()
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center space-x-1.5">
                      <button
                        onClick={() => openHistoryModal(m)}
                        className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg hover:text-amber-500 transition-colors cursor-pointer relative"
                        title="ประวัติการโอนย้าย/ส่งคืนแลป/เปลี่ยนสถานที่ประจำการ"
                      >
                        <History size={13} />
                        {m.locationHistory && m.locationHistory.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white rounded-full text-[8px] font-black flex items-center justify-center shadow-xs">
                            {m.locationHistory.length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => openEditModal(m)}
                        className="p-1.5 hover:bg-sky-50 text-sky-600 rounded-lg hover:text-sky-500 transition-colors cursor-pointer"
                        title="แก้ไขข้อมูลเครื่อง"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id, m.serialNumber)}
                        className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg hover:text-rose-500 transition-colors cursor-pointer"
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border border-slate-100 px-4 py-3 bg-white text-xs rounded-xl shadow-2xs">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-slate-200 text-xs font-bold rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              ก่อนหน้า
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center px-4 py-2 border border-slate-200 text-xs font-bold rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              ถัดไป
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-slate-500 font-medium">
                แสดงลำดับที่ <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> ถึง <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, sortedAndFilteredMachines.length)}</span> จากทั้งหมด <span className="font-bold text-slate-800">{sortedAndFilteredMachines.length}</span> รายการ
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 text-[11px]">จำนวนต่อหน้า:</span>
              <CustomSelect
                value={String(itemsPerPage)}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-xs font-bold p-1 px-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </CustomSelect>

              <nav className="relative z-0 inline-flex rounded-lg shadow-2xs -space-x-px ml-2" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-1.5 rounded-l-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pageNum = idx + 1;
                  if (totalPages > 5) {
                    if (currentPage > 3 && currentPage < totalPages - 2) {
                      pageNum = currentPage - 2 + idx;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + idx;
                    }
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`relative inline-flex items-center px-3 py-1.5 border text-xs font-bold ${
                        currentPage === pageNum
                          ? 'z-10 bg-sky-50 border-sky-500 text-sky-600'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-1.5 rounded-r-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CSV IMPORT MODAL */}
      {/* ========================================================================= */}
      {isOpenCsvModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[100] animate-fadeIn" id="csv-import-modal-overlay">
          <div className="bg-white w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-5 border-b border-slate-100 flex items-start sm:items-center justify-between bg-slate-50/50 gap-2">
              <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0 mt-0.5 sm:mt-0">
                  <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h3 className="text-xs sm:text-base font-bold text-slate-800">
                      นำเข้าข้อมูลเครื่อง DTX จากไฟล์ CSV
                    </h3>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Batch Importer
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                    อัปโหลดไฟล์ CSV เพื่อเพิ่มหรืออัปเดตเครื่องตรวจวัดน้ำตาลในคลังพร้อมกัน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isImporting && setIsOpenCsvModal(false)}
                disabled={isImporting}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5 flex-1 text-xs">
              {/* Step 1: Upload / Dropzone & Template */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <Upload size={13} className="text-sky-600" />
                    <span>1. เลือกไฟล์ CSV หรือลากไฟล์มาวาง</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="w-full sm:w-auto justify-center text-[11px] sm:text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center space-x-1.5 cursor-pointer bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-200 transition-all"
                  >
                    <FileDown size={13} />
                    <span>ดาวน์โหลดไฟล์ตัวอย่าง (Template CSV)</span>
                  </button>
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 ${
                    isDragOver 
                      ? 'border-sky-500 bg-sky-50/50' 
                      : csvFile
                      ? 'border-emerald-400 bg-emerald-50/30'
                      : 'border-slate-200 hover:border-sky-400 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,application/vnd.ms-excel"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  {isParsingCsv ? (
                    <div className="flex flex-col items-center space-y-2 py-3">
                      <Loader2 size={24} className="text-sky-600 animate-spin" />
                      <span className="text-xs font-bold text-slate-600">กำลังอ่านและตรวจสอบโครงสร้างไฟล์ CSV...</span>
                    </div>
                  ) : csvFile ? (
                    <div className="flex items-center space-x-3 py-1">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                        <FileSpreadsheet size={18} />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                          <span className="truncate max-w-[200px] sm:max-w-md">{csvFileName}</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono">
                            {(csvFile.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-slate-400">คลิกหรือลากไฟล์ใหม่มาวางเพื่อเปลี่ยนไฟล์</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl sm:rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600">
                        <Upload size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">
                          ลากไฟล์ CSV มาวางที่นี่ หรือ <span className="text-sky-600 underline">คลิกเลือกไฟล์</span>
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                          รองรับไฟล์ .csv (UTF-8, Excel) บังคับเฉพาะ<strong>รหัสเครื่อง (CODE)</strong> ข้อมูลอื่นๆ ที่เว้นว่างระบบจะเติมค่าเริ่มต้นให้อัตโนมัติ
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Error Box if parsing failed */}
              {csvParseError && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start space-x-2 text-xs text-rose-800">
                  <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">เกิดข้อผิดพลาดในการอ่านไฟล์:</span>
                    <p className="mt-0.5 text-[11px]">{csvParseError}</p>
                  </div>
                </div>
              )}

              {/* Step 2: Preview & Validation Stats */}
              {parsedRows.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <Sparkles size={13} className="text-amber-500" />
                      <span>2. ผลตรวจสอบ ({parsedRows.length} รายการ)</span>
                    </span>

                    {/* Conflict Strategy Radios */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-bold bg-slate-50 p-1.5 sm:p-2 rounded-xl border border-slate-200">
                      <span className="text-slate-400 text-[10px] sm:text-[11px]">หากรหัสซ้ำ:</span>
                      <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                        <input
                          type="radio"
                          name="importStrategy"
                          value="skip_existing"
                          checked={importStrategy === 'skip_existing'}
                          onChange={() => setImportStrategy('skip_existing')}
                          className="accent-sky-600"
                        />
                        <span>ข้ามที่ซ้ำ ({duplicateRowsCount})</span>
                      </label>
                      <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                        <input
                          type="radio"
                          name="importStrategy"
                          value="overwrite_existing"
                          checked={importStrategy === 'overwrite_existing'}
                          onChange={() => setImportStrategy('overwrite_existing')}
                          className="accent-sky-600"
                        />
                        <span className="text-amber-600">อัปเดตทับเดิม</span>
                      </label>
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('all')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        previewFilter === 'all' 
                          ? 'border-sky-500 bg-sky-50/50 ring-1 ring-sky-500' 
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400 font-bold">ทั้งหมดในไฟล์</div>
                      <div className="text-sm font-black text-slate-800 mt-0.5">{parsedRows.length} รายการ</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewFilter('valid')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        previewFilter === 'valid' 
                          ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' 
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="text-[10px] text-emerald-600 font-bold flex items-center space-x-1">
                        <CheckCircle2 size={11} />
                        <span>พร้อมเพิ่มใหม่</span>
                      </div>
                      <div className="text-sm font-black text-emerald-600 mt-0.5">{validRowsCount} รายการ</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewFilter('duplicate')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        previewFilter === 'duplicate' 
                          ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500' 
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="text-[10px] text-amber-600 font-bold flex items-center space-x-1">
                        <AlertTriangle size={11} />
                        <span>ซ้ำกับในคลัง</span>
                      </div>
                      <div className="text-sm font-black text-amber-600 mt-0.5">{duplicateRowsCount} รายการ</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewFilter('invalid')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        previewFilter === 'invalid' 
                          ? 'border-rose-500 bg-rose-50/50 ring-1 ring-rose-500' 
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="text-[10px] text-rose-600 font-bold flex items-center space-x-1">
                        <AlertCircle size={11} />
                        <span>ข้อมูลไม่สมบูรณ์</span>
                      </div>
                      <div className="text-sm font-black text-rose-600 mt-0.5">{invalidRowsCount} รายการ</div>
                    </button>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-52 sm:max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="sticky top-0 bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">แถว</th>
                          <th className="p-2">รหัส (CODE)</th>
                          <th className="p-2">ซีเรียล (S/N)</th>
                          <th className="p-2">แบรนด์</th>
                          <th className="p-2">รุ่น</th>
                          <th className="p-2">หน่วยงาน</th>
                          <th className="p-2">LOT</th>
                          <th className="p-2">วันที่</th>
                          <th className="p-2">สถานะ</th>
                          <th className="p-2">ผลการตรวจ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPreviewRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="text-center p-5 text-slate-400">
                              ไม่พบรายการในหมวดนี้
                            </td>
                          </tr>
                        ) : (
                          filteredPreviewRows.map((r, idx) => (
                            <tr 
                              key={idx} 
                              className={`transition-colors ${
                                !r.isValid 
                                  ? 'bg-rose-50/40' 
                                  : r.isExisting 
                                  ? 'bg-amber-50/30' 
                                  : 'hover:bg-slate-50/60'
                              }`}
                            >
                              <td className="p-2 font-mono text-slate-400">{r.rowNum}</td>
                              <td className="p-2 font-bold text-slate-800">{r.machine.serialNumber || '-'}</td>
                              <td className="p-2 font-mono text-slate-600">{r.machine.machineSerial || '-'}</td>
                              <td className="p-2 text-slate-700 font-medium">{r.machine.brand || '-'}</td>
                              <td className="p-2 font-bold text-slate-700">{r.machine.model || '-'}</td>
                              <td className="p-2 font-semibold text-slate-700">{r.machine.ward || '-'}</td>
                              <td className="p-2 font-mono text-sky-700">{r.machine.lotNumber}</td>
                              <td className="p-2 text-slate-500">{r.machine.receiveDate}</td>
                              <td className="p-2">{getStatusDisplay(r.machine.status)}</td>
                              <td className="p-2">
                                {!r.isValid ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                    ✗ {r.validationError}
                                  </span>
                                ) : r.isExisting ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    {importStrategy === 'overwrite_existing' ? '⚡ จะอัปเดตทับ' : '⚠ จะข้าม (ซ้ำ)'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    ✓ พร้อมนำเข้า
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Progress Indicator during execution */}
              {isImporting && (
                <div className="bg-sky-50 p-3.5 rounded-xl border border-sky-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-sky-900">
                    <span className="flex items-center space-x-2">
                      <Loader2 size={15} className="animate-spin text-sky-600" />
                      <span>กำลังบันทึกข้อมูลเครื่องเข้าสู่ฐานข้อมูลคลัง...</span>
                    </span>
                    <span>{importProgress.current} / {importProgress.total}</span>
                  </div>
                  <div className="w-full bg-sky-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-sky-600 h-1.5 transition-all duration-200 rounded-full"
                      style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-slate-50/50">
              <div className="text-[11px] sm:text-xs text-slate-500 text-center sm:text-left">
                {parsedRows.length > 0 && (
                  <span>
                    จะนำเข้าทั้งหมด: <strong className="text-slate-800">{importStrategy === 'overwrite_existing' ? validRowsCount + duplicateRowsCount : validRowsCount}</strong> รายการ
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsOpenCsvModal(false)}
                  disabled={isImporting}
                  className="w-1/3 sm:w-auto justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isImporting || parsedRows.length === 0 || (importStrategy === 'skip_existing' && validRowsCount === 0 && duplicateRowsCount > 0)}
                  className="w-2/3 sm:w-auto justify-center bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 shadow-md shadow-emerald-600/10 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>กำลังนำเข้า...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      <span>
                        ยืนยันนำเข้า ({importStrategy === 'overwrite_existing' ? validRowsCount + duplicateRowsCount : validRowsCount} รายการ)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT SINGLE MACHINE MODAL */}
      {/* ========================================================================= */}
      {isOpenModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 z-[100] animate-fadeIn" id="machine-modal-overlay">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-100 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                <Layers size={16} className="text-sky-600" />
                <span>{modalMode === 'add' ? 'เพิ่มเครื่อง DTX ใหม่' : `แก้ไขข้อมูลเครื่อง (${serialNumber})`}</span>
              </h3>
              <button 
                onClick={() => setIsOpenModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                {/* CODE */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700">รหัสเครื่อง (CODE) *</label>
                  <input
                    type="text"
                    placeholder="เช่น BGM-001"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className={`w-full text-xs p-2.5 rounded-lg border font-mono font-bold uppercase transition-colors ${
                      isCodeDuplicate 
                        ? 'border-rose-500 bg-rose-50/50 text-rose-800' 
                        : 'border-slate-200 focus:outline-hidden focus:border-sky-500'
                    }`}
                    required
                  />
                  {isCodeDuplicate && (
                    <p className="text-[10px] font-bold text-rose-600 animate-fadeIn">
                      รหัสเครื่องนี้ซ้ำกับเครื่องอื่นในคลัง!
                    </p>
                  )}
                </div>

                {/* Manufacturer Serial Number */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700">หมายเลขซีเรียล (S/N) <span className="font-normal text-slate-400 text-[10px]">(เว้นว่างได้ถ้ายังไม่แกะกล่อง)</span></label>
                  <input
                    type="text"
                    placeholder="เช่น 103A2002FB7 หรือเว้นว่าง"
                    value={machineSerial}
                    onChange={(e) => setMachineSerial(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 font-mono font-bold uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    {distinctBrands.map((b, idx) => (
                      <option key={idx} value={b}>{b}</option>
                    ))}
                    <option value="__custom__">+ เพิ่มแบรนด์ใหม่ (พิมพ์เอง)</option>
                  </CustomSelect>
                  {isCustomBrand && (
                    <input
                      type="text"
                      placeholder="พิมพ์ชื่อแบรนด์ใหม่..."
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      className="w-full text-xs p-2.5 mt-1 rounded-lg border border-sky-300 focus:outline-hidden focus:border-sky-500 bg-sky-50/40 font-bold"
                      required
                    />
                  )}
                </div>

                {/* Model */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700">รุ่น (Model) *</label>
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
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer shadow-md shadow-sky-600/10"
                >
                  <CheckCircle size={13} />
                  <span>บันทึกข้อมูล</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LOCATION HISTORY & TRANSFER LOG MODAL */}
      {/* ========================================================================= */}
      {isOpenHistoryModal && selectedMachineForHistory && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 z-[100] animate-fadeIn" id="history-modal-overlay">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    ประวัติการประจำการและโอนย้ายเครื่อง (Movement & History Log)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    เครื่องรหัส <strong className="text-slate-700 font-mono">{selectedMachineForHistory.serialNumber}</strong> (S/N: {selectedMachineForHistory.machineSerial || '-'})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpenHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              
              {/* Machine Quick Summary Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">รหัสเครื่อง (CODE)</span>
                  <span className="font-bold text-slate-800 font-mono text-xs">{selectedMachineForHistory.serialNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">แบรนด์ / รุ่น</span>
                  <span className="font-semibold text-slate-700">{selectedMachineForHistory.brand || '-'} ({selectedMachineForHistory.model || '-'})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">หน่วยงานปัจจุบัน</span>
                  <span className="font-bold text-sky-700 flex items-center">
                    <Building2 size={11} className="mr-1 text-sky-600 shrink-0" />
                    <span className="truncate">{selectedMachineForHistory.ward || '-'}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">สถานะปัจจุบัน</span>
                  <div className="mt-0.5">{getStatusDisplay(selectedMachineForHistory.status)}</div>
                </div>
              </div>

              {/* Action Form: Log New Transfer */}
              <div className="bg-sky-50/40 p-4 rounded-xl border border-sky-100 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <ArrowRightLeft size={14} className="text-sky-600" />
                    <span>บันทึกการโอนย้าย / ส่งคืนแลป / เบิกหมุนเวียน</span>
                  </h4>

                  {/* Fast Action Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={applyReturnToLabPreset}
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer border border-emerald-300/60"
                      title="สำหรับกรณี Home Ward หรือหน่วยงานส่งเครื่องกลับมาไว้แลปเพื่อเวียนใช้"
                    >
                      🏢 ส่งคืนแลป (สำรอง/เวียน)
                    </button>
                    <button
                      type="button"
                      onClick={applyBackupLoanPreset}
                      className="bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer border border-purple-300/60"
                    >
                      🔁 ยืมสำรองแทนเครื่องซ่อม
                    </button>
                    <button
                      type="button"
                      onClick={applyWardTransferPreset}
                      className="bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer border border-sky-300/60"
                    >
                      ➡️ ย้าย Ward ประจำการ
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveTransfer} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    
                    {/* Destination Ward */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700">หน่วยงานปลายทาง (ย้ายไปที่) *</label>
                      <CustomSelect
                        value={transferToWard}
                        onChange={(e) => setTransferToWard(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                        required
                      >
                        <option value="">-- เลือกหน่วยงานปลายทาง --</option>
                        {wards.map((w, idx) => (
                          <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                        ))}
                      </CustomSelect>
                    </div>

                    {/* Action Type */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700">ประเภทรายการ *</label>
                      <CustomSelect
                        value={transferActionType}
                        onChange={(e) => setTransferActionType(e.target.value as any)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                        required
                      >
                        <option value="return_to_lab">🏢 ส่งคืนห้องแลป (สำรองหมุนเวียน)</option>
                        <option value="backup_loan">🔁 จ่ายยืมสำรองทดแทนซ่อม</option>
                        <option value="transfer">➡️ โอนย้ายเปลี่ยน Ward ประจำการ</option>
                        <option value="edit">✏️ แก้ไขข้อมูลสถานที่</option>
                      </CustomSelect>
                    </div>

                    {/* Transfer Date */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700">วันที่ดำเนินการ</label>
                      <input
                        type="date"
                        value={transferDate}
                        onChange={(e) => setTransferDate(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Reason / Remarks */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-700">เหตุผล / รายละเอียดการย้าย *</label>
                      <input
                        type="text"
                        placeholder="เช่น คนไข้ Home Ward สิ้นสุดการรักษา ส่งคืนแลปเพื่อใช้สำรองหมุนเวียน"
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                        required
                      />
                    </div>

                    {/* Operator */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700">ผู้ดำเนินการ / ผู้ส่งมอบ</label>
                      <input
                        type="text"
                        placeholder="ชื่อเจ้าหน้าที่ผู้ดำเนินการ"
                        value={transferOperator}
                        onChange={(e) => setTransferOperator(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-600">ปรับสถานะตัวเครื่องเป็น:</span>
                      <CustomSelect
                        value={transferStatus}
                        onChange={(e) => setTransferStatus(e.target.value as any)}
                        className="text-xs p-1 px-2 rounded-lg border border-slate-200 bg-white font-bold"
                      >
                        <option value="active">active (พร้อมใช้งาน)</option>
                        <option value="inactive">inactive (ปิดใช้งาน/พักเครื่อง)</option>
                        <option value="waiting_claim">รอส่งเคลม</option>
                      </CustomSelect>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingTransfer}
                      className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      {isSavingTransfer ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>กำลังบันทึก...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={13} />
                          <span>บันทึกการโอนย้าย</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Section 2: Historical Movement Timeline */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Clock size={14} className="text-slate-500" />
                    <span>เส้นทางและประวัติการเคลื่อนย้ายทั้งหมด ({selectedMachineForHistory.locationHistory?.length || 0} รายการ)</span>
                  </h4>

                  {(!selectedMachineForHistory.locationHistory || selectedMachineForHistory.locationHistory.length === 0) && (
                    <button
                      type="button"
                      onClick={handleCreateInitialLog}
                      className="text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-sky-200"
                    >
                      + เริ่มบันทึกประวัติเริ่มต้น (ตาม Ward ปัจจุบัน)
                    </button>
                  )}
                </div>

                {(!selectedMachineForHistory.locationHistory || selectedMachineForHistory.locationHistory.length === 0) ? (
                  <div className="text-center p-6 bg-slate-50/60 rounded-xl border border-slate-100 space-y-2">
                    <History size={24} className="mx-auto text-slate-300" />
                    <p className="text-xs text-slate-500 font-medium">ยังไม่มีประวัติการโอนย้ายที่บันทึกไว้สำหรับเครื่องนี้</p>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      เมื่อมีการส่งคืนแลป โอนย้ายเปลี่ยน Ward หรือบันทึกการจ่ายยืมสำรอง ระบบจะบันทึกประวัติและไทม์ไลน์การเคลื่อนย้ายให้อัตโนมัติ
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {selectedMachineForHistory.locationHistory.map((log, idx) => {
                      const isReturnLab = log.actionType === 'return_to_lab';
                      const isBackup = log.actionType === 'backup_loan';
                      const isInitial = log.actionType === 'initial_deploy';
                      const isEdit = log.actionType === 'edit';

                      return (
                        <div key={log.id || idx} className="relative pl-8 space-y-1">
                          {/* Timeline Node Icon */}
                          <div className={`absolute left-1.5 top-1.5 w-4.5 h-4.5 -ml-0.5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-xs ${
                            isReturnLab ? 'bg-emerald-500 ring-4 ring-emerald-100' :
                            isBackup ? 'bg-purple-500 ring-4 ring-purple-100' :
                            isInitial ? 'bg-slate-500 ring-4 ring-slate-100' :
                            isEdit ? 'bg-amber-500 ring-4 ring-amber-100' :
                            'bg-sky-500 ring-4 ring-sky-100'
                          }`}>
                            {idx === 0 ? '★' : idx + 1}
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5 hover:border-slate-300 transition-colors">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              {/* Action Badge */}
                              <div className="flex items-center space-x-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                  isReturnLab ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  isBackup ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  isInitial ? 'bg-slate-100 text-slate-700 border-slate-200' :
                                  isEdit ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  'bg-sky-50 text-sky-700 border-sky-200'
                                }`}>
                                  {isReturnLab ? '🏢 ส่งคืนห้องปฏิบัติการ (LAB)' :
                                   isBackup ? '🔁 จ่ายยืมสำรองทดแทนซ่อม' :
                                   isInitial ? '📦 บันทึกแรกเริ่มประจำการ' :
                                   isEdit ? '✏️ แก้ไขข้อมูลสถานที่' :
                                   '➡️ โอนย้ายเปลี่ยน Ward'}
                                </span>

                                {idx === 0 && (
                                  <span className="text-[9px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                                    สถานที่ปัจจุบัน
                                  </span>
                                )}
                              </div>

                              {/* Date & Time */}
                              <span className="text-[11px] text-slate-400 font-mono flex items-center">
                                <Clock size={11} className="mr-1 text-slate-300" />
                                {log.date}
                              </span>
                            </div>

                            {/* Movement Route */}
                            <div className="flex items-center space-x-2 text-xs font-bold pt-0.5">
                              <span className="text-slate-500">{log.fromWard || 'ไม่ระบุ'}</span>
                              <ArrowRight size={12} className="text-slate-400 shrink-0" />
                              <span className="text-sky-700 font-black">{log.toWard}</span>
                            </div>

                            {/* Reason / Details */}
                            {log.reason && (
                              <p className="text-slate-600 text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                                {log.reason}
                              </p>
                            )}

                            {/* Operator */}
                            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                              <span className="flex items-center">
                                <User size={10} className="mr-1 text-slate-300" />
                                ผู้บันทึก: <strong className="text-slate-600 ml-1">{log.operator || 'เจ้าหน้าที่'}</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpenHistoryModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                ปิดหน้าต่าง
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
